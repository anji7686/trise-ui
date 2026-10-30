import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button, SortedSelect, InfoNotice } from "@trise/ui";
import { accessData } from "./access-data";
import {
  operationsData,
  type GenericAttributes,
  type ProviderWorkFollowUpAttributes,
  type ProviderWorkJourney,
  type Resource,
} from "./data";
import { OperationsDialog } from "./operations-dialog";
import { OperationsStatus as Status } from "./operations-status";
import { ActionNotification } from "./operations-shared";
import { ProviderDocumentsStep } from "./provider-documents";
import { SvgIcon } from "./icons";
import { WorkflowModelIcon, workflowModelIconForStage } from "./workflow-model-icons";
import "./workflow-follow-ups.css";

const PURPOSES = [
  ["CALL", "Call"],
  ["EMAIL", "Email"],
  ["MEETING", "Meeting"],
  ["SITE_VISIT", "Site visit"],
  ["PAYMENT_REMINDER", "Payment reminder"],
  ["DOCUMENT_REQUEST", "Document request"],
  ["QUOTATION_REVIEW", "Quotation review"],
  ["INSTALLATION_COORDINATION", "Installation coordination"],
  ["AMC_RENEWAL", "AMC renewal"],
  ["SERVICE_CHECKIN", "Service check-in"],
  ["OTHER", "Other"],
] as const;
const STAGES = [
  ["INTAKE", "Work Intake"],
  ["LEAD", "Lead"],
  ["SURVEY", "Site survey"],
  ["REQUIREMENTS", "Requirements"],
  ["QUOTATION", "Quotation"],
  ["PROJECT", "Project / installation"],
  ["AMC", "AMC"],
  ["SERVICE", "Service"],
  ["HANDOVER", "Handover"],
] as const;

type FollowUpRecord = Resource<ProviderWorkFollowUpAttributes>;
type InteractionRecord = Resource<GenericAttributes>;
type ActivityThreadItem =
  | {
      kind: "follow-up";
      id: string;
      occurredAt: string;
      sortAt: string;
      record: FollowUpRecord;
    }
  | {
      kind: "interaction";
      id: string;
      occurredAt: string;
      sortAt: string;
      record: InteractionRecord;
    };
type Props = {
  providerId: string;
  journeyId?: string | null;
  stage?: string;
  targetResourceKind?: string;
  targetResourceId?: string;
  interactionLeadId?: string | null;
  evidenceTargetKind?:
    | "MarketingLead"
    | "ProviderWorkIntake"
    | "ProviderWorkFollowUp";
  evidenceTargetId?: string | null;
  readOnly?: boolean;
  title?: string;
  embedded?: boolean;
  initializeIfMissing?: boolean;
};
type FormState = {
  subject: string;
  purpose: string;
  stage: string;
  scheduledAt: string;
  reminderMinutes: string;
  assignedToUserId: string;
  contactName: string;
  contactReference: string;
  notes: string;
};
function canonicalStage(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const milestones: Record<string, string> = {
    WORK_INTAKE: "INTAKE",
    LEAD_SURVEY: "LEAD",
    SALES_QUOTATION: "QUOTATION",
    PROJECT_INSTALLATION: "PROJECT",
    AMC_SERVICE: "AMC",
  };
  return milestones[normalized] || normalized;
}
export function WorkflowFollowUpsForResource({
  providerId,
  targetResourceKind,
  targetResourceId,
  stage,
  readOnly = false,
  title,
  embedded = false,
  initializeIfMissing = false,
}: {
  providerId: string;
  targetResourceKind: string;
  targetResourceId: string;
  stage: string;
  readOnly?: boolean;
  title?: string;
  embedded?: boolean;
  initializeIfMissing?: boolean;
}) {
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journey, setJourney] = useState<ProviderWorkJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(true);
  useEffect(() => {
    let active = true;
    setLoadingJourney(true);
    void operationsData
      .providerWorkJourneyForResource(providerId, targetResourceKind, targetResourceId)
      .then((result) => {
        if (!result && initializeIfMissing && !readOnly) {
          return operationsData.ensureProviderWorkJourneyForResource(
            providerId,
            targetResourceKind,
            targetResourceId,
            crypto.randomUUID(),
          );
        }
        return result;
      })
      .then((result) => {
        if (active) {
          setJourney(result);
          setJourneyId(result?.id || null);
        }
      })
      .catch(() => {
        if (active) {
          setJourney(null);
          setJourneyId(null);
        }
      })
      .finally(() => {
        if (active) setLoadingJourney(false);
      });
    return () => {
      active = false;
    };
  }, [initializeIfMissing, providerId, readOnly, targetResourceKind, targetResourceId]);
  if (loadingJourney)
    return (
      <section className="workflow-follow-ups">
        <p className="notice">Loading shared journey follow-ups…</p>
      </section>
    );
  const interactionLeadId =
    targetResourceKind === "MarketingLead"
      ? targetResourceId
      : journey?.attributes.links.find(
          (link) => link.resource_kind === "MarketingLead",
        )?.resource_id;
  const evidenceTarget = interactionLeadId
    ? { kind: "MarketingLead" as const, id: interactionLeadId }
    : targetResourceKind === "ProviderWorkIntake"
      ? { kind: "ProviderWorkIntake" as const, id: targetResourceId }
      : journeyId
        ? { kind: "ProviderWorkFollowUp" as const, id: journeyId }
        : null;
  return (
    <WorkflowFollowUps
      providerId={providerId}
      journeyId={journeyId}
      stage={stage}
      targetResourceKind={targetResourceKind}
      targetResourceId={targetResourceId}
      interactionLeadId={interactionLeadId}
      evidenceTargetKind={evidenceTarget?.kind}
      evidenceTargetId={evidenceTarget?.id}
      readOnly={readOnly}
      title={title}
      embedded={embedded}
    />
  );
}

type WorkflowFollowUpActionProps = {
  providerId: string;
  journeyId?: string | null;
  targetResourceKind: string;
  targetResourceId: string;
  onClick: () => void;
};

/**
 * Detail-page action for the shared follow-up schedule. It deliberately uses
 * the same provider-scoped endpoint as the dialog so the action reflects the
 * actual open reminders for this journey, not a client-side guess.
 */
export function WorkflowFollowUpAction({
  providerId,
  journeyId,
  targetResourceKind,
  targetResourceId,
  onClick,
}: WorkflowFollowUpActionProps) {
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const journey = journeyId
          ? { id: journeyId }
          : await operationsData.providerWorkJourneyForResource(
              providerId,
              targetResourceKind,
              targetResourceId,
            );
        if (!journey?.id) {
          if (active) setActiveCount(0);
          return;
        }
        const result = await operationsData.providerWorkFollowUps(providerId, {
          journeyId: journey.id,
        });
        if (active)
          setActiveCount(
            (result.data as FollowUpRecord[]).filter(
              (record) => record.attributes.status === "SCHEDULED",
            ).length,
          );
      } catch {
        if (active) setActiveCount(0);
      }
    };
    const refresh = () => {
      void load();
    };
    void load();
    window.addEventListener("trise-follow-up-refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("trise-follow-up-refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [providerId, journeyId, targetResourceKind, targetResourceId]);

  const reminder = activeCount > 0;
  return (
    <Button
      type="button"
      variant="secondary"
      className={`workflow-follow-up-action${reminder ? " is-reminder" : ""}`}
      onClick={onClick}
      aria-label={
        reminder
          ? `${activeCount} scheduled follow-up reminder${activeCount === 1 ? "" : "s"}`
          : "Open follow-up history"
      }
      title={
        reminder
          ? `${activeCount} open scheduled follow-up${activeCount === 1 ? "" : "s"}`
          : "Open follow-up history"
      }
    >
      <span className="workflow-follow-up-action-icon" aria-hidden="true">
        <SvgIcon name={reminder ? "bell" : "calendar"} size={15} />
        {reminder && <span className="workflow-follow-up-action-dot" />}
      </span>
      <span>{reminder ? "Due" : "Follow-ups"}</span>
      {reminder && (
        <span
          className="workflow-follow-up-action-count"
          aria-label={`${activeCount} open`}
        >
          {activeCount > 99 ? "99+" : activeCount}
        </span>
      )}
    </Button>
  );
}

type WorkflowFollowUpDialogProps = {
  open: boolean;
  onClose: () => void;
  providerId: string;
  targetResourceKind: string;
  targetResourceId: string;
  stage: string;
  title?: string;
  readOnly?: boolean;
};

export function WorkflowFollowUpDialog({
  open,
  onClose,
  providerId,
  targetResourceKind,
  targetResourceId,
  stage,
  title,
  readOnly = false,
}: WorkflowFollowUpDialogProps) {
  if (!open) return null;
  return (
    <OperationsDialog
      className="workflow-follow-up-dialog"
      title={title || "Journey follow-ups"}
      onClose={onClose}
    >
      <WorkflowFollowUpsForResource
        providerId={providerId}
        targetResourceKind={targetResourceKind}
        targetResourceId={targetResourceId}
        stage={stage}
        readOnly={readOnly}
        title={title}
        embedded
        initializeIfMissing={!readOnly}
      />
    </OperationsDialog>
  );
}

const inputTime = (date = new Date(Date.now() + 60 * 60 * 1000)) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const minimumScheduleTime = () =>
  inputTime(new Date(Math.ceil((Date.now() + 5 * 60_000) / 60_000) * 60_000));
const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Time unavailable";
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const compactRepeatedSentence = (value?: string | null) => {
  const text = value?.trim() || "";
  const match = text.match(/^(.+?[.!?])\s+(.+?[.!?])(?:\s+|$)(.*)$/s);
  if (
    match &&
    match[1].trim().toLowerCase() === match[2].trim().toLowerCase()
  ) {
    return `${match[1]}${match[3] ? ` ${match[3].trim()}` : ""}`;
  }
  return text;
};
const key = () => crypto.randomUUID();
const notifyFollowUpRefresh = () =>
  window.dispatchEvent(new Event("trise-follow-up-refresh"));
function hasNextFollowUp(record: FollowUpRecord, rows: FollowUpRecord[]) {
  const attributes = record.attributes;
  if (attributes.next_follow_up_id) return true;
  return rows.some((candidate) => {
    if (
      candidate.id === record.id ||
      candidate.attributes.status !== "SCHEDULED"
    )
      return false;
    if (candidate.attributes.previous_follow_up_id === record.id) return true;
    const sameContact = attributes.contact_reference
      ? candidate.attributes.contact_reference === attributes.contact_reference
      : Boolean(
          attributes.contact_name &&
          candidate.attributes.contact_name === attributes.contact_name,
        );
    return (
      sameContact &&
      candidate.attributes.subject === `Next: ${attributes.subject}` &&
      new Date(candidate.attributes.scheduled_at).getTime() >
        new Date(attributes.scheduled_at).getTime()
    );
  });
}

function FollowUpPanel({
  embedded,
  title,
  busy,
  onClose,
  children,
}: {
  embedded: boolean;
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!embedded)
    return (
      <OperationsDialog title={title} busy={busy} onClose={onClose}>
        {children}
      </OperationsDialog>
    );
  return (
    <section
      className="workflow-follow-up-inline-dialog"
      role="dialog"
      aria-label={title}
    >
      <header>
        <strong>{title}</strong>
        <Button
          type="button"
          variant="quiet"
          disabled={busy}
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          ×
        </Button>
      </header>
      {children}
    </section>
  );
}

type EvidenceContext = {
  type: "journey" | "interaction" | "follow-up";
  recordId: string;
  mode: "view" | "upload";
};

function JourneyEvidenceCapture({
  providerId,
  targetId,
  targetKind,
  context,
  mode,
  canUpload,
  onClose,
  onChanged,
}: {
  providerId: string;
  targetId: string;
  targetKind:
    | "MarketingLead"
    | "ProviderWorkIntake"
    | "LeadActivity"
    | "ProviderWorkFollowUp"
    | "Quotation"
    | "ServiceCase"
    | "ServiceRequest"
    | "ServiceJob"
    | "MaintenanceContract";
  context: "journey" | "interaction" | "follow-up";
  mode: "view" | "upload";
  canUpload: boolean;
  onClose?: () => void;
  onChanged: () => void;
}) {
  return (
    <section
      className="workflow-follow-up-evidence"
      aria-label="Assets for this activity"
    >
      <div className="workflow-follow-up-evidence-heading">
        <div className="workflow-follow-up-evidence-context">
          <SvgIcon name="clipboard" size={15} />
          <span>
            Assets for this{" "}
            {context === "journey"
              ? "workflow record"
              : context === "interaction"
                ? "interaction"
                : "follow-up response"}
          </span>
        </div>
        {mode === "upload" && onClose && (
          <Button type="button" variant="quiet" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
      <ProviderDocumentsStep
        providerId={providerId}
        targetId={targetId}
        canUpload={canUpload}
        scope={
          targetKind === "MarketingLead" ||
          targetKind === "LeadActivity" ||
          targetKind === "ProviderWorkFollowUp"
            ? "lead"
            : targetKind === "ProviderWorkIntake"
              ? "intake"
              : "journey"
        }
        documentTargetKind={
          targetKind === "LeadActivity"
            ? "LEAD_ACTIVITY"
            : targetKind === "ProviderWorkFollowUp"
              ? "PROVIDER_WORK_FOLLOW_UP"
              : targetKind === "ProviderWorkIntake"
                ? "PROVIDER_WORK_INTAKE"
                : targetKind === "Quotation"
                  ? "QUOTATION"
                  : targetKind === "ServiceCase"
                    ? "SERVICE_CASE"
                    : targetKind === "ServiceRequest"
                      ? "SERVICE_REQUEST"
                    : targetKind === "ServiceJob"
                      ? "SERVICE_JOB"
                      : targetKind === "MaintenanceContract"
                        ? "MAINTENANCE_CONTRACT"
              : undefined
        }
        activityEvidence={
          targetKind === "LeadActivity" || targetKind === "ProviderWorkFollowUp"
        }
        intakeType="photos"
        initialClassification="WORK_INTAKE_PHOTO"
        compactIntake
        assetCenter={mode === "view"}
        uploadOnly={mode === "upload"}
        onChanged={onChanged}
      />
    </section>
  );
}

export function WorkflowFollowUps({
  providerId,
  journeyId,
  stage = "LEAD",
  targetResourceKind,
  targetResourceId,
  interactionLeadId,
  evidenceTargetKind,
  evidenceTargetId,
  readOnly = false,
  title = "Scheduled follow-ups",
  embedded = false,
}: Props) {
  const [rows, setRows] = useState<FollowUpRecord[]>([]);
  const [interactions, setInteractions] = useState<InteractionRecord[]>([]);
  const [candidates, setCandidates] = useState<
    Array<{
      id: string;
      attributes: {
        user_id: string;
        name?: string | null;
        email?: string | null;
        membership_context?: string | null;
      };
    }>
  >([]);
  const [open, setOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(Boolean(journeyId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [interactionError, setInteractionError] = useState("");
  const [message, setMessage] = useState("");
  const [nextFrom, setNextFrom] = useState<FollowUpRecord | null>(null);
  const [interactionBusy, setInteractionBusy] = useState(false);
  const [evidenceContext, setEvidenceContext] =
    useState<EvidenceContext | null>(null);
  const [assetAvailability, setAssetAvailability] = useState<
    Record<string, boolean>
  >({});
  const [journeyAssetSummary, setJourneyAssetSummary] = useState({
    images: 0,
    documents: 0,
  });
  const [form, setForm] = useState<FormState>({
    subject: "",
    purpose: "CALL",
    stage: canonicalStage(stage),
    scheduledAt: inputTime(),
    reminderMinutes: "15",
    assignedToUserId: "",
    contactName: "",
    contactReference: "",
    notes: "",
  });

  const reload = () => {
    if (!journeyId) {
      setRows([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return operationsData
      .providerWorkFollowUps(providerId, { journeyId })
      .then((result) =>
        setRows(
          (result.data as FollowUpRecord[]).sort(
            (left, right) =>
              new Date(right.attributes.scheduled_at).getTime() -
              new Date(left.attributes.scheduled_at).getTime(),
          ),
        ),
      )
      .catch((cause) =>
        setError((cause as Error).message || "Follow-ups could not be loaded."),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void reload();
  }, [providerId, journeyId]);
  const reloadInteractions = () => {
    if (journeyId) {
      return operationsData
        .journeyActivities(providerId, journeyId)
        .then((result) =>
          setInteractions(
            (result.data as InteractionRecord[]).sort(
              (left, right) =>
                new Date(String(right.attributes.occurred_at || "")).getTime() -
                new Date(String(left.attributes.occurred_at || "")).getTime(),
            ),
          ),
        )
        .catch((cause) =>
          setInteractionError(
            (cause as Error).message || "Interactions could not be loaded.",
          ),
        );
    }
    if (!interactionLeadId) {
      setInteractions([]);
      return Promise.resolve();
    }
    return operationsData
      .leadActivities(providerId, interactionLeadId)
      .then((result) =>
        setInteractions(
          (result.data as InteractionRecord[]).sort(
            (left, right) =>
              new Date(String(right.attributes.occurred_at || "")).getTime() -
              new Date(String(left.attributes.occurred_at || "")).getTime(),
          ),
        ),
      )
      .catch((cause) =>
        setInteractionError(
          (cause as Error).message || "Interactions could not be loaded.",
        ),
      );
  };
  useEffect(() => {
    void reloadInteractions();
  }, [journeyId, providerId, interactionLeadId]);
  useEffect(() => {
    if (!evidenceTargetKind || !evidenceTargetId) {
      setAssetAvailability({});
      return;
    }
    const targets = [
      ...interactions.map((record) => ({
        key: `interaction-${record.id}`,
        id: record.id,
      })),
      ...rows.map((record) => ({
        key: `follow-up-${record.id}`,
        id: record.id,
      })),
    ];
    if (!targets.length) {
      setAssetAvailability({});
      return;
    }
    let active = true;
    setAssetAvailability(
      Object.fromEntries(targets.map(({ key }) => [key, false])),
    );
    void Promise.all(
      targets.map(async ({ key, id }) => {
        try {
          const result = await operationsData.journeyActivityDocuments(
            providerId,
            id,
          );
          return [key, result.data.length > 0] as const;
        } catch {
          return [key, false] as const;
        }
      }),
    ).then((entries) => {
      if (active) setAssetAvailability(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [evidenceTargetId, evidenceTargetKind, interactions, providerId, rows]);
  useEffect(() => {
    if (!targetResourceKind || !targetResourceId) {
      setJourneyAssetSummary({ images: 0, documents: 0 });
      return;
    }
    let active = true;
    void operationsData
      .journeyResourceDocuments(providerId, targetResourceId)
      .then((result) => {
        if (active) {
          setJourneyAssetSummary({
            images: result.data.filter((document) =>
              document.attributes.media_type.startsWith("image/"),
            ).length,
            documents: result.data.filter(
              (document) => !document.attributes.media_type.startsWith("image/"),
            ).length,
          });
        }
      })
      .catch(() => {
        if (active) setJourneyAssetSummary({ images: 0, documents: 0 });
      });
    return () => {
      active = false;
    };
  }, [providerId, targetResourceId, targetResourceKind]);
  const journeyAssetAvailable =
    journeyAssetSummary.images + journeyAssetSummary.documents > 0;
  useEffect(() => {
    if (readOnly) return;
    let active = true;
    void accessData
      .assignmentCandidates(providerId, { limit: 100 })
      .then((result) => {
        if (active) setCandidates(result.data as typeof candidates);
      })
      .catch(() => {
        if (active) setCandidates([]);
      });
    return () => {
      active = false;
    };
  }, [providerId, readOnly]);
  useEffect(() => {
    if (responseId !== null && open) {
      setOpen(false);
      setNextFrom(null);
    }
    if (cancelId !== null && (open || responseId !== null)) {
      setOpen(false);
      setNextFrom(null);
      setResponseId(null);
    }
  }, [cancelId, open, responseId]);

  function updateForm(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  function openSchedule(record?: FollowUpRecord) {
    setError("");
    setMessage("");
    setResponseId(null);
    setInteractionOpen(false);
    setEvidenceContext(null);
    setCancelId(null);
    setCancelReason("");
    setNextFrom(record || null);
    if (record) {
      const attributes = record.attributes;
      setForm((current) => ({
        ...current,
        subject: `Next: ${attributes.subject}`.slice(0, 200),
        purpose: attributes.purpose,
        stage: canonicalStage(attributes.stage),
        scheduledAt: inputTime(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        reminderMinutes: current.reminderMinutes || "15",
        assignedToUserId: attributes.assigned_to_user_id || "",
        contactName: attributes.contact_name || "",
        contactReference: attributes.contact_reference || "",
        notes: attributes.notes || "",
      }));
    } else {
      setForm((current) => ({
        ...current,
        subject: "",
        purpose: "CALL",
        stage: canonicalStage(stage),
        scheduledAt: inputTime(),
        assignedToUserId: "",
        contactName: "",
        contactReference: "",
        notes: "",
      }));
    }
    setOpen(true);
  }
  function openInteraction() {
    setOpen(false);
    setNextFrom(null);
    setResponseId(null);
    setCancelId(null);
    setCancelReason("");
    setError("");
    setInteractionError("");
    setEvidenceContext(null);
    setInteractionOpen(true);
  }
  function openResponse(recordId: string) {
    setOpen(false);
    setNextFrom(null);
    setCancelId(null);
    setCancelReason("");
    setError("");
    setInteractionOpen(false);
    setEvidenceContext(null);
    setResponseId(recordId);
  }
  function openCancel(recordId: string) {
    setOpen(false);
    setNextFrom(null);
    setResponseId(null);
    setInteractionOpen(false);
    setEvidenceContext(null);
    setCancelId(recordId);
    setCancelReason("");
    setError("");
  }
  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journeyId) return;
    const scheduledAt = new Date(form.scheduledAt);
    if (
      Number.isNaN(scheduledAt.getTime()) ||
      scheduledAt.getTime() < Date.now() + 5 * 60_000
    ) {
      setError(
        "Choose a scheduled time at least 5 minutes from now. Past or immediate times are not allowed.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const reminderAt = new Date(
        scheduledAt.getTime() - Number(form.reminderMinutes || 0) * 60_000,
      );
      await operationsData.createProviderWorkFollowUp(
        providerId,
        {
          journey_id: journeyId,
          target_resource_kind: targetResourceKind,
          target_resource_id: targetResourceId,
          previous_follow_up_id: nextFrom?.id,
          stage: form.stage,
          subject: form.subject.trim(),
          purpose: form.purpose,
          scheduled_at: scheduledAt.toISOString(),
          reminder_at: reminderAt.toISOString(),
          assigned_to_user_id: form.assignedToUserId || undefined,
          contact_name: form.contactName.trim() || undefined,
          contact_reference: form.contactReference.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        key(),
      );
      setMessage(
        "Follow-up scheduled. The reminder will appear in the provider notification bell before it is due.",
      );
      notifyFollowUpRefresh();
      window.dispatchEvent(new Event("trise-notifications-refresh"));
      setOpen(false);
      setNextFrom(null);
      setForm((current) => ({
        ...current,
        subject: "",
        notes: "",
        contactName: "",
        contactReference: "",
        scheduledAt: inputTime(new Date(Date.now() + 60 * 60 * 1000)),
      }));
      await reload();
    } catch (cause) {
      setError((cause as Error).message || "Follow-up could not be scheduled.");
    } finally {
      setBusy(false);
    }
  }
  async function complete(
    record: FollowUpRecord,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = String(formData.get("response") || "").trim();
    if (!response) return;
    setBusy(true);
    setError("");
    try {
      await operationsData.completeProviderWorkFollowUp(
        providerId,
        record.id,
        {
          expected_revision: record.attributes.revision,
          response,
          outcome: String(formData.get("outcome") || "").trim() || undefined,
          notes: String(formData.get("notes") || "").trim() || undefined,
        },
        key(),
      );
      setResponseId(null);
      setEvidenceContext(null);
      notifyFollowUpRefresh();
      await reload();
    } catch (cause) {
      setError(
        (cause as Error).message || "Follow-up response could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel(record: FollowUpRecord, reason: string) {
    setBusy(true);
    setError("");
    try {
      await operationsData.cancelProviderWorkFollowUp(
        providerId,
        record.id,
        { expected_revision: record.attributes.revision, reason },
        key(),
      );
      notifyFollowUpRefresh();
      await reload();
      setCancelId(null);
      setCancelReason("");
    } catch (cause) {
      setError((cause as Error).message || "Follow-up could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }
  async function recordInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journeyId || !targetResourceKind || !targetResourceId) {
      setInteractionError(
        "This workflow record is not linked to an active journey target yet.",
      );
      return;
    }
    const formData = new FormData(event.currentTarget);
    setInteractionBusy(true);
    setInteractionError("");
    try {
      await operationsData.createJourneyActivity(
        providerId,
        journeyId,
        {
          activity_type: formData.get("activity_type"),
          occurred_at: formData.get("occurred_at")
            ? new Date(String(formData.get("occurred_at"))).toISOString()
            : undefined,
          outcome: formData.get("outcome") || undefined,
          next_action: formData.get("next_action") || undefined,
          notes: formData.get("notes"),
          target_resource_kind: targetResourceKind,
          target_resource_id: targetResourceId,
        },
        key(),
      );
      setInteractionOpen(false);
      setEvidenceContext(null);
      setMessage(
        "Interaction recorded. It is now part of this shared journey.",
      );
      await reloadInteractions();
      notifyFollowUpRefresh();
    } catch (cause) {
      setInteractionError(
        (cause as Error).message || "Interaction could not be recorded.",
      );
    } finally {
      setInteractionBusy(false);
    }
  }

  const activityItems: ActivityThreadItem[] = [
    ...rows.map((record) => ({
      kind: "follow-up" as const,
      id: `follow-up-${record.id}`,
      occurredAt:
        record.attributes.status === "COMPLETED"
          ? record.attributes.completed_at || record.attributes.scheduled_at
          : record.attributes.status === "CANCELLED"
            ? record.attributes.cancelled_at || record.attributes.scheduled_at
            : record.attributes.scheduled_at,
      sortAt:
        record.attributes.status === "COMPLETED"
          ? record.attributes.completed_at ||
            record.attributes.created_at ||
            record.attributes.scheduled_at
          : record.attributes.status === "CANCELLED"
            ? record.attributes.cancelled_at ||
              record.attributes.created_at ||
              record.attributes.scheduled_at
            : record.attributes.created_at || record.attributes.scheduled_at,
      record,
    })),
    ...interactions.map((record) => ({
      kind: "interaction" as const,
      id: `interaction-${record.id}`,
      occurredAt: String(record.attributes.occurred_at || ""),
      sortAt: String(
        record.attributes.created_at || record.attributes.occurred_at || "",
      ),
      record,
    })),
  ].sort((left, right) => {
    const timeDifference =
      new Date(right.sortAt).getTime() - new Date(left.sortAt).getTime();
    return timeDifference || right.id.localeCompare(left.id);
  });
  const responseRecord = responseId
    ? rows.find((record) => record.id === responseId) || null
    : null;
  const responseAssetsOpen =
    responseRecord !== null &&
    evidenceContext?.type === "follow-up" &&
    evidenceContext.recordId === responseRecord.id &&
    evidenceContext.mode === "upload";
  const directAssetsOpen = evidenceContext?.type === "journey";
  const activeAction = interactionOpen
    ? "interaction"
    : open
      ? "schedule"
      : directAssetsOpen
        ? "assets"
        : null;

  return (
    <section className="workflow-follow-ups" aria-label={title}>
      <header className="workflow-follow-ups-heading">
        <div className="workflow-follow-ups-heading-copy">
          <span className="eyebrow">Shared journey thread</span>
          <h3><WorkflowModelIcon name={workflowModelIconForStage(stage)} size={20} /> Activity &amp; follow-up</h3>
          <p>
            One history follows this journey from Work Intake through Lead,
            Quotation, Project, Installation, Handover and AMC. Scheduled
            reminders and past interactions are shown together.
          </p>
        </div>
        {!readOnly && (
          <div
            className="workflow-follow-ups-action-tabs"
            role="tablist"
            aria-label="Journey actions"
          >
            {journeyId && targetResourceKind && targetResourceId && (
              <Button
                type="button"
                variant="secondary"
                className={`workflow-follow-ups-action-tab workflow-follow-ups-action-tab--interaction${activeAction === "interaction" ? " is-active" : ""}`}
                role="tab"
                aria-selected={activeAction === "interaction"}
                onClick={openInteraction}
              >
                Log past interaction
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className={`workflow-follow-ups-action-tab workflow-follow-ups-action-tab--schedule${activeAction === "schedule" ? " is-active" : ""}`}
              role="tab"
              aria-selected={activeAction === "schedule"}
              onClick={() => openSchedule()}
              disabled={!journeyId}
            >
              Schedule follow-up
            </Button>
            {journeyId && targetResourceKind && targetResourceId && (
              <Button
                type="button"
                variant="secondary"
                aria-label="Add assets"
                className={`workflow-follow-ups-action-tab workflow-follow-ups-action-tab--assets${activeAction === "assets" ? " is-active" : ""}`}
                role="tab"
                aria-selected={activeAction === "assets"}
                onClick={() => {
                  if (directAssetsOpen) {
                    setEvidenceContext(null);
                    return;
                  }
                  setOpen(false);
                  setInteractionOpen(false);
                  setResponseId(null);
                  setCancelId(null);
                  setCancelReason("");
                  setError("");
                  setInteractionError("");
                  setEvidenceContext({
                    type: "journey",
                    recordId: targetResourceId,
                    mode: "upload",
                  });
                }}
              >
                {directAssetsOpen ? "Hide assets" : "Add assets"}
              </Button>
            )}
          </div>
        )}
      </header>
      {error && (
        <ActionNotification
          kind="error"
          title="Follow-up action needs attention"
          onClose={() => setError("")}
        >
          {error}
        </ActionNotification>
      )}
      {message && (
        <ActionNotification
          title="Follow-up update completed"
          onClose={() => setMessage("")}
        >
          {message}
        </ActionNotification>
      )}
      {directAssetsOpen && targetResourceKind && targetResourceId && (
        <JourneyEvidenceCapture
          providerId={providerId}
          targetId={targetResourceId}
          targetKind={targetResourceKind as Parameters<
            typeof JourneyEvidenceCapture
          >[0]["targetKind"]}
          context="journey"
          mode={evidenceContext?.mode || "upload"}
          canUpload={!readOnly}
          onClose={() => setEvidenceContext(null)}
          onChanged={() => {
            void operationsData
              .journeyResourceDocuments(providerId, targetResourceId)
              .then((result) =>
                setJourneyAssetSummary({
                  images: result.data.filter((document) =>
                    document.attributes.media_type.startsWith("image/"),
                  ).length,
                  documents: result.data.filter(
                    (document) =>
                      !document.attributes.media_type.startsWith("image/"),
                  ).length,
                }),
              );
            setEvidenceContext({
              type: "journey",
              recordId: targetResourceId,
              mode: "view",
            });
            setMessage("Assets attached to the active workflow record.");
            notifyFollowUpRefresh();
          }}
        />
      )}
      {!journeyId && !interactionLeadId ? (
        <p className="notice">
          A shared journey is not linked yet. Activity and follow-ups become
          available when this record enters the lifecycle.
        </p>
      ) : loading ? (
        <p className="notice">Loading the shared activity thread…</p>
      ) : (
        <section
          className="workflow-follow-up-thread"
          aria-label="Activity and follow-up thread"
        >
          <header className="workflow-follow-up-thread-heading">
            <div>
              <span className="eyebrow">Single chronological stream</span>
              <h4>Activity &amp; follow-up history</h4>
              <p>
                A completed reminder stays on its original record. Use “Log past
                interaction” only for an unscheduled activity.
              </p>
            </div>
            <span className="workflow-follow-up-thread-count">
              {activityItems.length + (journeyAssetAvailable ? 1 : 0)}{" "}
              {activityItems.length + (journeyAssetAvailable ? 1 : 0) === 1
                ? "entry"
                : "entries"}
            </span>
          </header>
          {interactionError && (
            <ActionNotification
              kind="error"
              title="Interaction action needs attention"
              onClose={() => setInteractionError("")}
            >
              {interactionError}
            </ActionNotification>
          )}
          {journeyAssetAvailable && targetResourceKind && targetResourceId && (
            <article className="workflow-follow-up-thread-card is-assets">
              <div className="workflow-follow-up-thread-card-label">
                <span className="workflow-follow-up-thread-marker" />
                <strong>Workflow assets</strong>
                <Status>ATTACHED</Status>
              </div>
              <div className="workflow-follow-up-thread-card-content">
                <div className="workflow-follow-up-card-title">
                  <strong>
                    {journeyAssetSummary.images} images · {journeyAssetSummary.documents} documents
                  </strong>
                  <small>Attached to this workflow record</small>
                </div>
                <p className="workflow-follow-up-notes">
                  Photos and documents are retained with this journey and can
                  be reviewed without opening the upload form.
                </p>
                <div className="workflow-follow-up-card-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      setEvidenceContext(
                        evidenceContext?.type === "journey" &&
                          evidenceContext.mode === "view"
                          ? null
                          : {
                              type: "journey",
                              recordId: targetResourceId,
                              mode: "view",
                            },
                      )
                    }
                  >
                    {evidenceContext?.type === "journey" &&
                    evidenceContext.mode === "view"
                      ? "Hide assets"
                      : "View assets"}
                  </Button>
                </div>
              </div>
            </article>
          )}
          {activityItems.length ? (
            <ol className="workflow-follow-up-thread-list">
              {activityItems.map((item) => {
                if (item.kind === "interaction") {
                  const attributes = item.record.attributes;
                  const hasAssets =
                    assetAvailability[`interaction-${item.record.id}`];
                  return (
                    <li
                      key={item.id}
                      className="workflow-follow-up-thread-card is-interaction"
                    >
                      <div className="workflow-follow-up-thread-card-label">
                        <span className="workflow-follow-up-thread-marker" />
                        <strong>Past interaction</strong>
                        <Status>RECORDED</Status>
                      </div>
                      <div className="workflow-follow-up-thread-card-content workflow-follow-up-interaction-details">
                        <div className="workflow-follow-up-card-title">
                          <strong>
                            {label(
                              String(attributes.activity_type || "Interaction"),
                            )}
                          </strong>
                          <small>{dateTime(item.occurredAt)}</small>
                        </div>
                        <div className="workflow-follow-up-interaction-note">
                          <small>Notes</small>
                          <p>
                            {String(
                              attributes.notes ||
                                attributes.outcome ||
                                "No notes recorded",
                            )}
                          </p>
                        </div>
                        {attributes.outcome != null && (
                          <div className="workflow-follow-up-interaction-fact">
                            <small>Outcome</small>
                            <strong>{String(attributes.outcome)}</strong>
                          </div>
                        )}
                        {attributes.next_action != null && (
                          <div className="workflow-follow-up-interaction-fact">
                            <small>Next action</small>
                            <strong>{String(attributes.next_action)}</strong>
                          </div>
                        )}
                        {hasAssets &&
                          evidenceTargetKind &&
                          evidenceTargetId && (
                            <div className="workflow-follow-up-card-actions">
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  setEvidenceContext(
                                    evidenceContext?.type === "interaction" &&
                                      evidenceContext.recordId ===
                                        item.record.id &&
                                      evidenceContext.mode === "view"
                                      ? null
                                      : {
                                          type: "interaction",
                                          recordId: item.record.id,
                                          mode: "view",
                                        },
                                  )
                                }
                              >
                                {evidenceContext?.type === "interaction" &&
                                evidenceContext.recordId === item.record.id &&
                                evidenceContext.mode === "view"
                                  ? "Hide assets"
                                  : "View assets"}
                              </Button>
                            </div>
                          )}
                        {evidenceContext?.type === "interaction" &&
                          evidenceContext.recordId === item.record.id &&
                          evidenceTargetKind &&
                          evidenceTargetId && (
                            <JourneyEvidenceCapture
                              providerId={providerId}
                              targetId={item.record.id}
                              targetKind="LeadActivity"
                              context="interaction"
                              mode={evidenceContext.mode}
                              canUpload={!readOnly}
                              onClose={() => setEvidenceContext(null)}
                              onChanged={() => {
                                setAssetAvailability((current) => ({
                                  ...current,
                                  [`interaction-${item.record.id}`]: true,
                                }));
                                notifyFollowUpRefresh();
                              }}
                            />
                          )}
                      </div>
                    </li>
                  );
                }

                const record = item.record;
                const attributes = record.attributes;
                const hasAssets = assetAvailability[`follow-up-${record.id}`];
                const hasNext = hasNextFollowUp(record, rows);
                const canScheduleNext =
                  !readOnly && attributes.status === "COMPLETED" && !hasNext;
                return (
                  <li
                    key={item.id}
                    className={
                      "workflow-follow-up-thread-card is-follow-up status-" +
                      attributes.display_status.toLowerCase()
                    }
                  >
                    <div className="workflow-follow-up-thread-card-label">
                      <span className="workflow-follow-up-thread-marker"><WorkflowModelIcon name={workflowModelIconForStage(attributes.stage)} size={15} /></span>
                      <strong>Scheduled follow-up</strong>
                      <Status>{attributes.display_status}</Status>
                    </div>
                    <div className="workflow-follow-up-thread-card-content">
                      <div className="workflow-follow-up-card-title">
                        <strong>{attributes.subject}</strong>
                        <small>{dateTime(item.occurredAt)}</small>
                      </div>
                      <div
                        className="workflow-follow-up-meta"
                        aria-label="Follow-up details"
                      >
                        <span>
                          <small>Purpose · stage</small>
                          <strong>
                            {label(attributes.purpose)} ·{" "}
                            {label(attributes.stage)}
                          </strong>
                        </span>
                        <span>
                          <small>Scheduled</small>
                          <strong>{dateTime(attributes.scheduled_at)}</strong>
                        </span>
                        <span>
                          <small>Reminder</small>
                          <strong>{dateTime(attributes.reminder_at)}</strong>
                        </span>
                        <span>
                          <small>Assigned to</small>
                          <strong>
                            {attributes.assigned_to?.name ||
                              attributes.assigned_to?.email ||
                              "Current provider user"}
                          </strong>
                        </span>
                        {(attributes.contact_name ||
                          attributes.contact_reference) && (
                          <span>
                            <small>Contact</small>
                            <strong>
                              {attributes.contact_name || "Contact"}
                              {attributes.contact_reference
                                ? " · " + attributes.contact_reference
                                : ""}
                            </strong>
                          </span>
                        )}
                      </div>
                      {compactRepeatedSentence(attributes.notes) &&
                        compactRepeatedSentence(attributes.notes) !==
                          (attributes.response || "").trim() && (
                          <p className="workflow-follow-up-notes">
                            {compactRepeatedSentence(attributes.notes)}
                          </p>
                        )}
                      {attributes.status === "COMPLETED" && (
                        <div className="workflow-follow-up-response">
                          <strong>{attributes.outcome || "Completed"}</strong>
                          <span>
                            {attributes.response || "Response recorded."}
                          </span>
                        </div>
                      )}
                      {((!readOnly && attributes.status === "SCHEDULED") ||
                        canScheduleNext ||
                        hasNext ||
                        (hasAssets &&
                          evidenceTargetKind &&
                          evidenceTargetId)) && (
                        <div className="workflow-follow-up-card-actions">
                          {!readOnly && attributes.status === "SCHEDULED" && (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => openResponse(record.id)}
                              >
                                Record response
                              </Button>
                              <Button
                                type="button"
                                variant="quiet"
                                disabled={busy}
                                onClick={() => openCancel(record.id)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {canScheduleNext && (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => openSchedule(record)}
                            >
                              Schedule next
                            </Button>
                          )}
                          {hasNext && (
                            <span className="workflow-follow-up-next-state">
                              Next follow-up scheduled
                            </span>
                          )}
                          {hasAssets &&
                            evidenceTargetKind &&
                            evidenceTargetId && (
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  setEvidenceContext(
                                    evidenceContext?.type === "follow-up" &&
                                      evidenceContext.recordId === record.id &&
                                      evidenceContext.mode === "view"
                                      ? null
                                      : {
                                          type: "follow-up",
                                          recordId: record.id,
                                          mode: "view",
                                        },
                                  )
                                }
                              >
                                {evidenceContext?.type === "follow-up" &&
                                evidenceContext.recordId === record.id &&
                                evidenceContext.mode === "view"
                                  ? "Hide assets"
                                  : "View assets"}
                              </Button>
                            )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="notice">No activity or follow-ups recorded yet.</p>
          )}
          {interactionOpen && (
            <>
              <form
                className="workflow-follow-up-interaction-form"
                onSubmit={(event) => void recordInteraction(event)}
              >
                <label>
                  Interaction type
                  <SortedSelect name="activity_type" defaultValue="CALL">
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="SITE_VISIT">Site visit</option>
                    <option value="OTHER">Other</option>
                  </SortedSelect>
                </label>
                <label>
                  Occurred at
                  <input
                    name="occurred_at"
                    type="datetime-local"
                    defaultValue={inputTime(new Date())}
                    required
                  />
                </label>
                <label>
                  Outcome
                  <input name="outcome" maxLength={500} />
                </label>
                <label>
                  Next action
                  <input name="next_action" maxLength={500} />
                </label>
                <label className="workflow-follow-up-form-wide">
                  Notes
                  <textarea name="notes" required maxLength={4000} rows={3} />
                </label>
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={interactionBusy}
                    onClick={() => {
                      setInteractionOpen(false);
                      setEvidenceContext(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={interactionBusy}>
                    Save past interaction
                  </Button>
                </div>
              </form>
            </>
          )}
          {responseRecord && (
            <FollowUpPanel
              embedded={embedded}
              title="Record follow-up response"
              busy={busy}
              onClose={() => {
                setResponseId(null);
                setEvidenceContext(null);
              }}
            >
              {!responseAssetsOpen && (
                <form
                  className="workflow-follow-up-response-form"
                  onSubmit={(event) => void complete(responseRecord, event)}
                >
                  <p className="provider-form-note">
                    Close this reminder only after recording what happened and
                    the next business outcome.
                  </p>
                  <label>
                    Response *
                    <textarea
                      name="response"
                      required
                      maxLength={4000}
                      rows={4}
                      placeholder="What did the contact or team member confirm?"
                    />
                  </label>
                  <label>
                    Outcome
                    <input
                      name="outcome"
                      maxLength={160}
                      placeholder="e.g. Visit confirmed"
                    />
                  </label>
                  <label>
                    Additional notes
                    <textarea name="notes" maxLength={4000} rows={3} />
                  </label>
                  <div className="provider-form-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setResponseId(null);
                        setEvidenceContext(null);
                      }}
                    >
                      Keep open
                    </Button>
                    {evidenceTargetKind && evidenceTargetId && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setEvidenceContext(
                            evidenceContext?.type === "follow-up" &&
                              evidenceContext.recordId === responseRecord.id &&
                              evidenceContext.mode === "upload"
                              ? null
                              : {
                                  type: "follow-up",
                                  recordId: responseRecord.id,
                                  mode: "upload",
                                },
                          )
                        }
                      >
                        {evidenceContext?.type === "follow-up" &&
                        evidenceContext.recordId === responseRecord.id
                          ? "Hide assets"
                          : "Add assets"}
                      </Button>
                    )}
                    <Button type="submit" busy={busy}>
                      Complete follow-up
                    </Button>
                  </div>
                </form>
              )}
              {responseAssetsOpen && (
                <p className="provider-form-note">
                  Add assets for this response, then select Done to return to
                  the response form.
                </p>
              )}
              {evidenceContext?.type === "follow-up" &&
                evidenceContext.recordId === responseRecord.id &&
                evidenceTargetKind &&
                evidenceTargetId && (
                  <JourneyEvidenceCapture
                    providerId={providerId}
                    targetId={responseRecord.id}
                    targetKind="ProviderWorkFollowUp"
                    context="follow-up"
                    mode="upload"
                    canUpload={!readOnly}
                    onClose={() => setEvidenceContext(null)}
                    onChanged={() => {
                      setAssetAvailability((current) => ({
                        ...current,
                        [`follow-up-${responseRecord.id}`]: true,
                      }));
                      notifyFollowUpRefresh();
                    }}
                  />
                )}
            </FollowUpPanel>
          )}
          {open && (
            <FollowUpPanel
              embedded={embedded}
              title={
                nextFrom ? "Schedule next follow-up" : "Schedule follow-up"
              }
              busy={busy}
              onClose={() => {
                setOpen(false);
                setNextFrom(null);
              }}
            >
              <form
                className="workflow-follow-up-form"
                onSubmit={(event) => void schedule(event)}
              >
                <p className="provider-form-note">
                  {nextFrom
                    ? "Previous customer, contact, assignment, purpose, and journey stage have been carried forward. Set the next step and schedule time."
                    : "Times are saved as timestamps and displayed in the configured Asia/Kolkata business timezone."}
                </p>
                <div className="workflow-follow-up-form-grid">
                  <label>
                    {nextFrom ? "Next step / subject *" : "Subject *"}
                    <input
                      required
                      maxLength={200}
                      value={form.subject}
                      onChange={(event) =>
                        updateForm("subject", event.target.value)
                      }
                      placeholder={
                        nextFrom
                          ? "e.g. Confirm revised quotation"
                          : "Confirm site visit"
                      }
                    />
                  </label>
                  <label>
                    Purpose
                    <SortedSelect
                      value={form.purpose}
                      onChange={(event) =>
                        updateForm("purpose", event.target.value)
                      }
                    >
                      {PURPOSES.map(([value, text]) => (
                        <option value={value} key={value}>
                          {text}
                        </option>
                      ))}
                    </SortedSelect>
                  </label>
                  <label>
                    Journey stage
                    <SortedSelect
                      value={form.stage}
                      onChange={(event) =>
                        updateForm("stage", event.target.value)
                      }
                    >
                      {STAGES.map(([value, text]) => (
                        <option value={value} key={value}>
                          {text}
                        </option>
                      ))}
                    </SortedSelect>
                  </label>
                  <label>
                    Scheduled time *
                    <input
                      required
                      type="datetime-local"
                      min={minimumScheduleTime()}
                      value={form.scheduledAt}
                      onChange={(event) => {
                        updateForm("scheduledAt", event.target.value);
                        const input = event.currentTarget;
                        window.setTimeout(() => input.blur(), 0);
                      }}
                    />
                    <small className="provider-form-help">
                      Must be at least 5 minutes from now.
                    </small>
                  </label>
                  <label>
                    Reminder
                    <SortedSelect
                      value={form.reminderMinutes}
                      onChange={(event) =>
                        updateForm("reminderMinutes", event.target.value)
                      }
                    >
                      <option value="0">At scheduled time</option>
                      <option value="15">15 minutes before</option>
                      <option value="30">30 minutes before</option>
                      <option value="60">1 hour before</option>
                      <option value="1440">1 day before</option>
                    </SortedSelect>
                  </label>
                  <label>
                    Assign to
                    <SortedSelect
                      value={form.assignedToUserId}
                      onChange={(event) =>
                        updateForm("assignedToUserId", event.target.value)
                      }
                    >
                      <option value="">Current provider user</option>
                      {candidates.map((candidate) => (
                        <option
                          value={candidate.attributes.user_id}
                          key={candidate.attributes.user_id}
                        >
                          {candidate.attributes.name ||
                            candidate.attributes.email ||
                            "Provider team member"}
                          {candidate.attributes.membership_context
                            ? ` · ${label(candidate.attributes.membership_context)}`
                            : ""}
                        </option>
                      ))}
                    </SortedSelect>
                  </label>
                  <label>
                    Contact name
                    <input
                      maxLength={160}
                      value={form.contactName}
                      onChange={(event) =>
                        updateForm("contactName", event.target.value)
                      }
                      placeholder="Customer, referral, or team contact"
                    />
                  </label>
                  <label>
                    Contact number / reference
                    <input
                      maxLength={240}
                      value={form.contactReference}
                      onChange={(event) =>
                        updateForm("contactReference", event.target.value)
                      }
                      placeholder="Phone or contact reference"
                    />
                  </label>
                  <label className="workflow-follow-up-form-wide">
                    Notes
                    <textarea
                      maxLength={4000}
                      rows={3}
                      value={form.notes}
                      onChange={(event) =>
                        updateForm("notes", event.target.value)
                      }
                      placeholder={
                        nextFrom
                          ? "Context for the next step"
                          : "Context for the assignee"
                      }
                    />
                  </label>
                </div>
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setOpen(false);
                      setNextFrom(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={busy}>
                    Save scheduled follow-up
                  </Button>
                </div>
              </form>
            </FollowUpPanel>
          )}
          {cancelId && (
            <FollowUpPanel
              embedded={embedded}
              title="Cancel follow-up"
              busy={busy}
              onClose={() => {
                setCancelId(null);
                setCancelReason("");
              }}
            >
              <form
                className="workflow-follow-up-response-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = cancelReason.trim();
                  if (!reason) return;
                  const record = rows.find((item) => item.id === cancelId);
                  if (record) void cancel(record, reason);
                }}
              >
                <p className="provider-form-note">
                  Record why this follow-up is no longer required. The reason
                  will be kept in the journey timeline and audit history.
                </p>
                <label>
                  Cancellation reason *
                  <textarea
                    required
                    autoFocus
                    maxLength={4000}
                    rows={4}
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    placeholder="e.g. Customer requested a different date"
                  />
                </label>
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setCancelId(null);
                      setCancelReason("");
                    }}
                  >
                    Keep scheduled
                  </Button>
                  <Button type="submit" variant="danger" busy={busy}>
                    Cancel follow-up
                  </Button>
                </div>
              </form>
            </FollowUpPanel>
          )}
        </section>
      )}
    </section>
  );
}

type FollowUpDeskProps = {
  providerId: string;
  onOpenTarget: (route: string) => void;
};

function followUpRoute(record: FollowUpRecord) {
  const id = record.attributes.target_resource_id;
  if (!id) return "overview";
  const kind = record.attributes.target_resource_kind?.toUpperCase();
  if (kind === "PROVIDERWORKINTAKE") return `work-intake/${id}`;
  if (kind === "MARKETINGLEAD") return `leads/${id}`;
  if (kind === "QUOTATION") return `quotations/${id}`;
  if (kind === "SERVICECASE") return `projects/${id}`;
  return "overview";
}

export function WorkflowFollowUpDesk({
  providerId,
  onOpenTarget,
}: FollowUpDeskProps) {
  const [rows, setRows] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [desktopEnabled, setDesktopEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(`trise-follow-up-desktop:${providerId}`) ===
        "enabled",
  );
  const knownDue = useRef(new Set<string>());
  const initialLoad = useRef(true);

  const load = () => {
    const now = Date.now();
    return operationsData
      .providerWorkFollowUps(providerId, {
        status: "SCHEDULED",
        from: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        to: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      })
      .then((result) => {
        const nextRows = (result.data as FollowUpRecord[]).sort(
          (left, right) =>
            new Date(left.attributes.scheduled_at).getTime() -
            new Date(right.attributes.scheduled_at).getTime(),
        );
        const dueNow = nextRows.filter(
          (record) => record.attributes.display_status === "DUE",
        );
        if (
          !initialLoad.current &&
          desktopEnabled &&
          permission === "granted"
        ) {
          dueNow
            .filter((record) => !knownDue.current.has(record.id))
            .forEach((record) => {
              new Notification(`Follow-up due: ${record.attributes.subject}`, {
                body: "Open Provider Operations to record the outcome.",
              });
            });
        }
        dueNow.forEach((record) => knownDue.current.add(record.id));
        initialLoad.current = false;
        setRows(nextRows);
        setError("");
      })
      .catch((cause) =>
        setError(
          (cause as Error).message || "Follow-up desk could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setDesktopEnabled(
      localStorage.getItem(`trise-follow-up-desktop:${providerId}`) ===
        "enabled",
    );
    initialLoad.current = true;
    knownDue.current.clear();
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [providerId, permission, desktopEnabled]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      localStorage.setItem(`trise-follow-up-desktop:${providerId}`, "enabled");
      setDesktopEnabled(true);
    }
  }

  function disableNotifications() {
    localStorage.setItem(`trise-follow-up-desktop:${providerId}`, "disabled");
    setDesktopEnabled(false);
  }

  const due = rows.filter(
    (record) => record.attributes.display_status === "DUE",
  );
  const upcoming = rows.filter(
    (record) => record.attributes.display_status === "SCHEDULED",
  );
  return (
    <section className="workflow-follow-up-desk" aria-label="Follow-up desk">
      <div className="workflow-follow-up-desk-heading">
        <div>
          <span className="eyebrow">Follow-up desk</span>
          <h3>Follow-ups</h3>
          <p>Due and upcoming reminders across provider work areas.</p>
        </div>
        <div className="workflow-follow-up-desk-actions">
          {desktopEnabled ? (
            <Button
              type="button"
              variant="secondary"
              onClick={disableNotifications}
            >
              Disable desktop reminders
            </Button>
          ) : permission === "unsupported" ? (
            <span className="workflow-follow-up-desktop-state">
              Desktop alerts unavailable in this browser
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void enableNotifications()}
            >
              Enable desktop reminders
            </Button>
          )}
          {permission === "denied" && (
            <span className="workflow-follow-up-desktop-state">
              Browser permission is blocked; allow it in browser settings.
            </span>
          )}
          <Button type="button" variant="quiet" onClick={() => void load()}>
            Refresh
          </Button>
          <span className="workflow-follow-up-refresh-note" aria-label="Updates every 60 seconds">Updates every minute</span>
        </div>
      </div>
      {error && (
        <ActionNotification
          kind="error"
          title="Reminder desk action needs attention"
          onClose={() => setError("")}
        >
          {error}
        </ActionNotification>
      )}
      <div className="workflow-follow-up-desk-stats">
        <div className="is-due">
          <strong>{due.length}</strong>
          <span>Due now</span>
        </div>
        <div>
          <strong>{upcoming.length}</strong>
          <span>Next 24 hours</span>
        </div>
      </div>
      {loading ? (
        <p className="workflow-follow-up-desk-empty" role="status">Checking scheduled reminders…</p>
      ) : due.length || upcoming.length ? (
        <div className="workflow-follow-up-desk-list">
          {[...due, ...upcoming].slice(0, 6).map((record) => (
            <button
              type="button"
              className={`workflow-follow-up-desk-row status-${record.attributes.display_status.toLowerCase()}`}
              key={record.id}
              onClick={() => onOpenTarget(followUpRoute(record))}
            >
              <span
                className="workflow-follow-up-desk-marker"
                aria-hidden="true"
              />
              <span>
                <strong>{record.attributes.subject}</strong>
                <small>
                  {label(record.attributes.stage)} ·{" "}
                  {dateTime(record.attributes.scheduled_at)} ·{" "}
                  {record.attributes.assigned_to?.name ||
                    "Assigned provider user"}
                </small>
              </span>
              <Status>{record.attributes.display_status}</Status>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="workflow-follow-up-desk-empty">
          No follow-ups due in the next 24 hours.
        </p>
      )}
    </section>
  );
}
