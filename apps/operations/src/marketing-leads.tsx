import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, PageHeader } from "@trise/ui";
import { useAuth } from "@trise/auth";
import {
  DEFAULT_PAGE_SIZE,
  operationsData,
  type Collection,
  type GenericAttributes,
  type MarketingLeadAttributes,
  type ProviderWorkJourney,
  type RequirementRevisionAttributes,
  type RequirementCatalogue,
  type WorkIntakeAttributes,
  type Resource,
} from "./data";
import {
  OperationsPriority as Priority,
  OperationsStatus as Status,
} from "./operations-status";
import { OperationsDialog } from "./operations-dialog";
import { SiteSurveyWizard } from "./site-survey-wizard";
import { ActionNotification, ProviderActionMenu } from "./operations-shared";
import { ProviderDocumentsStep } from "./provider-documents";
import { SvgIcon } from "./icons";
import {
  JourneyTimelineDialog,
  WorkflowChainAction,
} from "./provider-journey-timeline";
import { RequirementMultiChoice } from "./requirement-multi-choice";
import { JourneyAbandonAction } from "./journey-abandon-action";
import { accessData } from "./access-data";
import {
  WorkflowFollowUpAction,
  WorkflowFollowUpDialog,
} from "./workflow-follow-ups";

type Props = { providerId: string; route?: { id?: string } };
type LocationCandidate = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};
const leadEventLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const leadStatusLabel = (value: string) =>
  value === "LOST" ? "Rejected" : leadEventLabel(value);
const leadEventTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Time unavailable";
const leadReadableValue = (value: unknown): string => {
  if (value == null || value === "") return "Not supplied";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([key, item]) => `${leadEventLabel(key)}: ${leadReadableValue(item)}`,
      )
      .join(" · ");
  return String(value);
};
const sortLeadActivities = (rows: Resource<GenericAttributes>[]) =>
  [...rows].sort(
    (left, right) =>
      new Date(
        String(left.attributes.occurred_at || left.attributes.created_at || 0),
      ).getTime() -
      new Date(
        String(
          right.attributes.occurred_at || right.attributes.created_at || 0,
        ),
      ).getTime(),
  );
const REQUIRED_REQUIREMENT_FIELDS = [
  "equipment_type_code",
  "industry_segment",
  "application",
  "technology",
  "drive_type",
  "capacity_kg",
  "stops",
  "quantity",
  "speed_band",
  "door_configuration",
  "door_type",
  "machine_room",
  "control_system",
  "finish",
];
const REQUIRED_REQUIREMENT_MULTI_FIELDS = [
  "safety_features",
  "standards_references",
];
const PENDING_ACTION_NOTIFICATION_KEY = "trise.pending-action-notification";

function carryActionNotification(message: string) {
  try {
    sessionStorage.setItem(
      PENDING_ACTION_NOTIFICATION_KEY,
      JSON.stringify({ message, createdAt: Date.now() }),
    );
  } catch {
    // Storage is an enhancement for cross-route feedback; the API result remains authoritative.
  }
}

function consumeActionNotification() {
  try {
    const raw = sessionStorage.getItem(PENDING_ACTION_NOTIFICATION_KEY);
    if (!raw) return "";
    sessionStorage.removeItem(PENDING_ACTION_NOTIFICATION_KEY);
    const payload = JSON.parse(raw) as { message?: unknown; createdAt?: unknown };
    const createdAt = Number(payload.createdAt || 0);
    return typeof payload.message === "string" && Date.now() - createdAt < 30_000
      ? payload.message
      : "";
  } catch {
    return "";
  }
}

export function MarketingLeads({ providerId, route }: Props) {
  const { session } = useAuth();
  const [effectivePermissions, setEffectivePermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    setEffectivePermissions(null);
    if (!session?.userId) {
      setEffectivePermissions([]);
      return () => {
        active = false;
      };
    }
    void accessData
      .selfEffectivePermissions(providerId)
      .then((preview) => {
        if (!active) return;
        setEffectivePermissions(
          preview.data.attributes.membership_active
            ? preview.data.attributes.permissions
                .filter((permission) => permission.grant_effective)
                .map((permission) => permission.code)
            : [],
        );
      })
      .catch(() => {
        // Hide mutation controls if the permission preview is unavailable.
        // The API remains the final authorization boundary.
        if (active) setEffectivePermissions([]);
      });
    return () => {
      active = false;
    };
  }, [providerId, session?.userId]);

  if (route?.id)
    return (
      <MarketingLeadDetail
        providerId={providerId}
        id={route.id}
        effectivePermissions={effectivePermissions}
        back={() => {
          window.location.hash = "leads";
        }}
      />
    );
  return (
    <MarketingLeadRegister
      providerId={providerId}
      effectivePermissions={effectivePermissions}
    />
  );
}

function RequirementRevisionSection({
  providerId,
  leadId,
  catalogue,
  revisions,
  surveyId,
  onSaved,
  readOnly = false,
}: {
  providerId: string;
  leadId: string;
  catalogue: RequirementCatalogue | null;
  revisions: Resource<RequirementRevisionAttributes>[];
  surveyId: string;
  onSaved: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(!readOnly && revisions.length === 0);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const latest = revisions[0] || null;
  const requirementScope = (latest?.attributes.requirement_scope || {}) as {
    requirements?: Record<string, unknown>;
    units?: Array<Record<string, unknown>>;
  };
  const values = (requirementScope.requirements ||
    latest?.attributes.requirements ||
    {}) as Record<string, unknown>;
  const unitValues = (requirementScope.units ||
    (Array.isArray(values.units) ? values.units : [])) as Array<
    Record<string, unknown>
  >;
  const displayValues = Object.fromEntries(
    Object.entries(values).filter(
      ([key]) =>
        !["units", "profile_mode", "quantity", "stops", "capacity_kg"].includes(
          key,
        ),
    ),
  );
  const text = (key: string, fallback = "") =>
    typeof values[key] === "string" || typeof values[key] === "number"
      ? String(values[key])
      : fallback;
  const array = (key: string) =>
    Array.isArray(values[key]) ? values[key].map((item) => String(item)) : [];
  const options = (code: string) =>
    catalogue?.groups.find((group) => group.code === code)?.options || [];
  const optionValue = (key: string, fallback = "") => text(key, fallback);
  const catalogueGroupFor = (key: string) =>
    (
      ({
        equipment_type_code: "EQUIPMENT_TYPE",
        lift_type: "EQUIPMENT_TYPE",
        industry_segment: "INDUSTRY_SEGMENT",
        application: "APPLICATION",
        technology: "TECHNOLOGY",
        speed_band: "SPEED_BAND",
        door_configuration: "DOOR_CONFIGURATION",
        door_type: "DOOR_TYPE",
        machine_room: "MACHINE_ROOM",
        control_system: "CONTROL_SYSTEM",
        finish: "FINISH",
        accessibility_features: "ACCESSIBILITY_FEATURE",
        safety_features: "SAFETY_FEATURE",
        standards_references: "STANDARDS_REFERENCE",
      }) as Record<string, string>
    )[key];
  const readableRequirementValue = (key: string, value: unknown) => {
    const group = catalogueGroupFor(key);
    if (!group) return leadReadableValue(value);
    const labels = options(group).reduce<Record<string, string>>(
      (result, option) => {
        result[option.code] = option.label;
        return result;
      },
      {},
    );
    if (Array.isArray(value))
      return value.length
        ? value.map((item) => labels[String(item)] || String(item)).join(", ")
        : "None";
    return labels[String(value)] || leadReadableValue(value);
  };
  const stepLabels = [
    "Core scope",
    "Design & capacity",
    "Accessibility & compliance",
  ];

  useEffect(() => {
    setEditing(!readOnly && revisions.length === 0);
    setStep(0);
  }, [latest?.id, readOnly]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const missing = [
      ...REQUIRED_REQUIREMENT_FIELDS.filter((field) => {
        const value = form.get(field);
        return value === null || value.toString().trim() === "";
      }),
      ...REQUIRED_REQUIREMENT_MULTI_FIELDS.filter(
        (field) =>
          form.getAll(field).filter((value) => value.toString().trim() !== "")
            .length === 0,
      ),
    ];
    if (missing.length) {
      setError(
        `Complete mandatory requirements before saving: ${missing.map(leadEventLabel).join(", ")}`,
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      await operationsData.createRequirementRevision(
        providerId,
        leadId,
        {
          site_survey_id: surveyId || undefined,
          requirements: {
            business_operation_code: "ELEVATOR_SERVICES",
            capacity_kg: Number(form.get("capacity_kg")),
            stops: Number(form.get("stops")),
            quantity: Number(form.get("quantity")),
            equipment_type_code: form.get("equipment_type_code"),
            industry_segment: form.get("industry_segment"),
            application: form.get("application"),
            technology: form.get("technology"),
            speed_band: form.get("speed_band"),
            door_configuration: form.get("door_configuration"),
            door_type: form.get("door_type"),
            machine_room: form.get("machine_room"),
            control_system: form.get("control_system"),
            finish: form.get("finish"),
            drive_type: form.get("drive_type"),
            accessibility_features: form.getAll("accessibility_features"),
            safety_features: form.getAll("safety_features"),
            standards_references: form.getAll("standards_references"),
            notes: form.get("notes"),
          },
        },
        crypto.randomUUID(),
      );
      setEditing(false);
      await onSaved();
    } catch (cause) {
      setError((cause as Error).message || "Requirements could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lead-detail-card lead-detail-section">
      <div className="lead-detail-card-heading">
        <div>
          <span className="eyebrow">Requirements</span>
          <h2>Requirements revision</h2>
        </div>
        <small>
          {latest
            ? `Revision ${latest.attributes.revision_number} · ${revisions.length} retained`
            : "Capture catalogue values; link a submitted survey when available"}
        </small>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {latest && !editing ? (
        <div className="lead-requirements-view">
          <div className="lead-requirements-view-toolbar">
            <div>
              <strong>Saved requirements</strong>
              <small>
                {latest.attributes.approved
                  ? "Approved revision"
                  : "Captured revision"}
                {surveyId
                  ? " · linked to site survey"
                  : " · survey link pending"}
              </small>
            </div>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                  setStep(0);
                }}
              >
                Edit requirements
              </Button>
            )}
          </div>
          <dl>
            {Object.entries(displayValues).map(([key, value]) => (
              <div key={key}>
                <dt>{leadEventLabel(key)}</dt>
                <dd>{readableRequirementValue(key, value)}</dd>
              </div>
            ))}
            {unitValues.length > 0 && (
              <div className="lead-requirements-unit-summary">
                <dt>Elevator units</dt>
                <dd>
                  {unitValues
                    .map(
                      (unit, index) =>
                        `${String(unit.label || `Unit ${index + 1}`)} · ${readableRequirementValue("equipment_type_code", unit.equipment_type_code || unit.type)} · ${String(unit.stops || "—")} stops · ${String(unit.capacity_kg || "—")} kg`,
                    )
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>
          <p className="lead-requirements-version-note">
            Editing creates the next revision. Earlier revisions remain
            preserved in the journey timeline.
          </p>
        </div>
      ) : readOnly ? (
        <p className="notice">
          No submitted requirement revision is available for this Lead. The
          Reviewer role can inspect captured revisions but cannot create or
          edit requirements.
        </p>
      ) : (
        <form
          className="lead-requirements-form"
          onSubmit={(event) => void save(event)}
        >
          <nav
            className="lead-requirement-stepper"
            aria-label="Requirement revision steps"
          >
            {stepLabels.map((label, index) => (
              <button
                type="button"
                key={label}
                className={
                  index === step ? "current" : index < step ? "complete" : ""
                }
                disabled={index > step}
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            ))}
          </nav>
          <div className="lead-requirement-step-panel" hidden={step !== 0}>
            <div className="lead-requirements-grid">
              <label>
                Equipment type
                <select
                  name="equipment_type_code"
                  required
                  defaultValue={optionValue(
                    "equipment_type_code",
                    optionValue("lift_type"),
                  )}
                >
                  <option value="">Select from catalogue</option>
                  {options("EQUIPMENT_TYPE").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Industry / site segment
                <select
                  name="industry_segment"
                  required
                  defaultValue={optionValue("industry_segment")}
                >
                  <option value="">Select from catalogue</option>
                  {options("INDUSTRY_SEGMENT").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Application
                <select
                  name="application"
                  required
                  defaultValue={optionValue("application")}
                >
                  <option value="">Select from catalogue</option>
                  {options("APPLICATION").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Technology
                <select
                  name="technology"
                  required
                  defaultValue={optionValue("technology")}
                >
                  <option value="">Select from catalogue</option>
                  {options("TECHNOLOGY").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="lead-requirement-step-panel" hidden={step !== 1}>
            <div className="lead-requirements-grid">
              <label>
                Capacity (kg)
                <input
                  name="capacity_kg"
                  type="number"
                  min="1"
                  max="10000"
                  required
                  defaultValue={optionValue("capacity_kg")}
                />
              </label>
              <label>
                Stops
                <input
                  name="stops"
                  type="number"
                  min="1"
                  max="300"
                  required
                  defaultValue={optionValue("stops")}
                />
              </label>
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max="100"
                  required
                  defaultValue={optionValue("quantity", "1")}
                />
              </label>
              <label>
                Speed band
                <select
                  name="speed_band"
                  required
                  defaultValue={optionValue("speed_band")}
                >
                  <option value="">Select from catalogue</option>
                  {options("SPEED_BAND").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Door configuration
                <select
                  name="door_configuration"
                  required
                  defaultValue={optionValue("door_configuration")}
                >
                  <option value="">Select from catalogue</option>
                  {options("DOOR_CONFIGURATION").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Door type
                <select
                  name="door_type"
                  required
                  defaultValue={optionValue("door_type")}
                >
                  <option value="">Select from catalogue</option>
                  {options("DOOR_TYPE").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Machine room
                <select
                  name="machine_room"
                  required
                  defaultValue={optionValue("machine_room")}
                >
                  <option value="">Select from catalogue</option>
                  {options("MACHINE_ROOM").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Control system
                <select
                  name="control_system"
                  required
                  defaultValue={optionValue("control_system")}
                >
                  <option value="">Select from catalogue</option>
                  {options("CONTROL_SYSTEM").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Finish
                <select
                  name="finish"
                  required
                  defaultValue={optionValue("finish")}
                >
                  <option value="">Select from catalogue</option>
                  {options("FINISH").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Drive type
                <select
                  name="drive_type"
                  required
                  defaultValue={optionValue("drive_type")}
                >
                  <option value="">Select from catalogue</option>
                  {options("DRIVE_TYPE").map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="lead-requirement-step-panel" hidden={step !== 2}>
            <div className="lead-requirements-grid">
              <RequirementMultiChoice
                name="accessibility_features"
                title="Accessibility features"
                help="Select every accessibility feature required for the site."
                options={options("ACCESSIBILITY_FEATURE")}
                defaultValue={array("accessibility_features")}
              />
              <RequirementMultiChoice
                name="safety_features"
                title="Safety / emergency features"
                help="Select the safety and emergency functions to include in the technical scope."
                options={options("SAFETY_FEATURE")}
                defaultValue={array("safety_features")}
              />
              <RequirementMultiChoice
                name="standards_references"
                title="Standards references"
                help="Select the applicable reference standards; final compliance remains subject to authority review."
                options={options("STANDARDS_REFERENCE")}
                defaultValue={array("standards_references")}
              />
            </div>
            <label>
              Additional requirements / notes
              <textarea
                name="notes"
                rows={3}
                maxLength={5000}
                defaultValue={text("notes")}
                placeholder="Record customer preferences or site constraints not represented by a catalogue option."
              />
            </label>
          </div>
          <div className="lead-requirements-form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={saving || step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            {step < stepLabels.length - 1 ? (
              <Button
                type="button"
                disabled={saving}
                onClick={() =>
                  setStep((current) =>
                    Math.min(stepLabels.length - 1, current + 1),
                  )
                }
              >
                Continue
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    if (latest) setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!catalogue || saving}>
                  {saving
                    ? "Saving…"
                    : latest
                      ? "Save new revision"
                      : "Capture requirements"}
                </Button>
              </>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function MarketingLeadDetail({
  providerId,
  id,
  effectivePermissions,
  back,
}: {
  providerId: string;
  id: string;
  effectivePermissions: string[] | null;
  back: () => void;
}) {
  const { session } = useAuth();
  const roleContext = session?.providerCapabilities
    .find((context) => context.providerId === providerId)
    ?.roleContext?.toUpperCase();
  const canAbandon = Boolean(
    session?.platformAdmin ||
    [
      "PROVIDER_ADMIN",
      "ADMIN",
      "MARKETING_MANAGER",
      "OPERATIONS_REVIEWER",
    ].includes(roleContext || ""),
  );
  const canOpenQuotationWorkspace = Boolean(
    session?.providerCapabilities.some(
      (context) =>
        context.providerId === providerId &&
        context.capabilities.includes("quotations"),
    ),
  );
  const can = (code: string) => effectivePermissions?.includes(code) === true;
  const canEditLead = can("LEAD_EDIT");
  const canRecordInteraction = can("FOLLOW_UP_LOG");
  const reviewOnly = effectivePermissions !== null && can("LEAD_READ") && !canEditLead;
  const [lead, setLead] = useState<Resource<MarketingLeadAttributes> | null>(
    null,
  );
  const [journey, setJourney] = useState<ProviderWorkJourney | null>(null);
  const [surveys, setSurveys] = useState<
    Resource<import("./data").SiteSurveyAttributes>[]
  >([]);
  const [requirements, setRequirements] = useState<
    Resource<RequirementRevisionAttributes>[]
  >([]);
  const [activities, setActivities] = useState<Resource<GenericAttributes>[]>(
    [],
  );
  const [quotations, setQuotations] = useState<Resource<GenericAttributes>[]>(
    [],
  );
  const [, setRequirementCatalogue] = useState<RequirementCatalogue | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const [qualificationDecision, setQualificationDecision] = useState<
    "QUALIFIED" | "LOST"
  >("QUALIFIED");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [locationCandidate, setLocationCandidate] =
    useState<LocationCandidate | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [journeyStepBusy, setJourneyStepBusy] = useState(false);
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() => consumeActionNotification());
  const [assetCounts, setAssetCounts] = useState<{
    photos: number;
    documents: number;
  } | null>(null);

  async function load() {
    setError("");
    const [
      leadResult,
      initialJourneyResult,
      surveyResult,
      requirementResult,
      activityResult,
      quotationResult,
      documentResult,
    ] = await Promise.all([
      operationsData.marketingLead(providerId, id),
      operationsData.marketingLeadJourney(providerId, id),
      operationsData.siteSurveys(providerId, id),
      operationsData.requirementRevisions(providerId, id),
      operationsData.leadActivities(providerId, id),
      canOpenQuotationWorkspace
        ? operationsData
            .quotations(providerId, { leadId: id, limit: DEFAULT_PAGE_SIZE })
            .catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
      operationsData
        .marketingLeadDocuments(providerId, id)
        .catch(() => ({ data: [] })),
    ]);
    const journeyResult =
      initialJourneyResult ||
      (canAbandon
        ? await operationsData.ensureMarketingLeadJourney(
            providerId,
            id,
            crypto.randomUUID(),
          )
        : null);
    setLead(leadResult);
    setJourney(journeyResult);
    setSurveys(surveyResult.data);
    setRequirements(requirementResult.data);
    setActivities(activityResult.data);
    setQuotations(quotationResult.data);
    const documents = documentResult.data as Array<{
      attributes: { media_type?: string; classification?: string };
    }>;
    setAssetCounts({
      photos: documents.filter(
        (document) =>
          document.attributes.media_type?.startsWith("image/") ||
          document.attributes.classification === "WORK_INTAKE_PHOTO",
      ).length,
      documents: documents.filter(
        (document) => !document.attributes.media_type?.startsWith("image/"),
      ).length,
    });
  }

  useEffect(() => {
    void load().catch((cause) =>
      setError((cause as Error).message || "Lead details could not be loaded."),
    );
  }, [providerId, id, canAbandon, canOpenQuotationWorkspace]);
  useEffect(() => {
    const refresh = () => {
      void load().catch((cause) =>
        setError((cause as Error).message || "Lead details could not be loaded."),
      );
    };
    window.addEventListener("trise-follow-up-refresh", refresh);
    return () => window.removeEventListener("trise-follow-up-refresh", refresh);
  }, [providerId, id, canAbandon, canOpenQuotationWorkspace]);
  useEffect(() => {
    void operationsData
      .elevatorRequirementCatalogue(providerId)
      .then(setRequirementCatalogue)
      .catch((cause) =>
        setError(
          (cause as Error).message ||
            "Requirement catalogue could not be loaded.",
        ),
      );
  }, [providerId]);
  useEffect(() => {
    if (!lead) return;
    setActiveJourneyStep(
      {
        NEW: 0,
        CONTACTED: 1,
        QUALIFIED: 2,
        QUOTATION_PENDING: 3,
        WON: 4,
        LOST: 4,
      }[lead.attributes.status] ?? 0,
    );
  }, [lead?.id, lead?.attributes.status]);

  async function updateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await operationsData.updateMarketingLead(
        providerId,
        id,
        {
          title: form.get("title"),
          prospect_name: form.get("prospect_name"),
          primary_contact_reference:
            form.get("primary_contact_reference") || undefined,
          priority: form.get("priority"),
          next_follow_up_at: form.get("next_follow_up_at")
            ? new Date(String(form.get("next_follow_up_at"))).toISOString()
            : null,
          expected_revision: lead.attributes.revision,
        },
        crypto.randomUUID(),
      );
      setEditOpen(false);
      setMessage("Lead updated by the server.");
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await operationsData.createLeadActivity(
        providerId,
        id,
        {
          activity_type: form.get("activity_type"),
          occurred_at: form.get("occurred_at")
            ? new Date(String(form.get("occurred_at"))).toISOString()
            : undefined,
          outcome: form.get("outcome") || undefined,
          next_action: form.get("next_action") || undefined,
          notes: form.get("notes"),
        },
        crypto.randomUUID(),
      );
      const firstFollowUp =
        lead?.attributes.status === "NEW" && activities.length === 0;
      setActivityOpen(false);
      setMessage(
        firstFollowUp
          ? "First interaction recorded. Continue to move the Lead to Contacted."
          : "Interaction recorded by the server.",
      );
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCurrentLocation() {
    const intakeId = journey?.attributes.links.find(
      (link) => link.resource_kind === "ProviderWorkIntake",
    )?.resource_id;
    if (!locationCandidate || !intakeId) {
      setLocationMessage(
        "This Lead has no linked Work Intake location record to update.",
      );
      return;
    }
    setLocationBusy(true);
    setLocationMessage("Saving the confirmed site location…");
    try {
      const intake = (await operationsData.genericDetail(
        providerId,
        `/provider-work-intakes/${encodeURIComponent(intakeId)}`,
      )) as Resource<WorkIntakeAttributes>;
      await operationsData.updateProviderWorkIntake(
        providerId,
        intakeId,
        {
          site_latitude: locationCandidate.latitude,
          site_longitude: locationCandidate.longitude,
          site_coordinate_accuracy_m: locationCandidate.accuracy || undefined,
          site_coordinate_source: "BROWSER_GEOLOCATION",
          site_coordinates_captured_at: locationCandidate.capturedAt,
          expected_revision: intake.attributes.revision,
        },
        crypto.randomUUID(),
      );
      setLocationCandidate(null);
      setLocationMessage("Current site location saved with an audit event.");
      await load();
    } catch (cause) {
      setLocationMessage(
        (cause as Error).message ||
          "The current site location could not be saved.",
      );
    } finally {
      setLocationBusy(false);
    }
  }

  function openJourneyStep(index: number) {
    setActiveJourneyStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitQualificationDecision(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!lead || journeyStepBusy) return;
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("decision") || "QUALIFIED") as
      | "QUALIFIED"
      | "LOST";
    const reason = String(form.get("decision_reason") || "").trim();
    if (decision === "LOST" && reason.length < 3) {
      setError("Add a short rejection reason before rejecting this Lead.");
      return;
    }
    setJourneyStepBusy(true);
    setError("");
    try {
      await operationsData.updateMarketingLead(
        providerId,
        id,
        {
          status: decision,
          ...(decision === "LOST" ? { lost_reason: reason } : {}),
          expected_revision: lead.attributes.revision,
        },
        crypto.randomUUID(),
      );
      setQualificationOpen(false);
      setMessage(
        decision === "QUALIFIED"
          ? "Lead accepted and qualified."
          : "Lead rejected and closed with the recorded reason.",
      );
      await load();
    } catch (cause) {
      setError(
        (cause as Error).message ||
          "The Lead qualification decision could not be saved.",
      );
    } finally {
      setJourneyStepBusy(false);
    }
  }

  if (error && !lead)
    return (
      <section className="content feature-page">
        <div className="feature-error" role="alert">
          <strong>{error}</strong>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
        <Button variant="secondary" onClick={back}>
          Back to Leads
        </Button>
      </section>
    );
  if (!lead)
    return (
      <section className="content feature-page">
        <p className="notice">Loading Lead details…</p>
      </section>
    );

  const attributes = lead.attributes;
  const context = journey?.attributes.context;
  const leadStepIndex =
    {
      NEW: 0,
      CONTACTED: 1,
      QUALIFIED: 2,
      QUOTATION_PENDING: 3,
      WON: 4,
      LOST: 4,
    }[attributes.status] ?? 0;
  const steps = [
    "Qualification",
    "Assets & documents",
    "Survey & requirements",
    "Quotation",
    attributes.status === "LOST" ? "Closed lost" : "Handover",
  ];
  const leadStopsAtQuotation =
    attributes.status === "QUOTATION_PENDING" || attributes.status === "WON";
  const workflowConcluded =
    attributes.journey_stage_status === "COMPLETED" ||
    (journey ? journey.attributes.status !== "ACTIVE" : false);
  const firstFollowUpRequired =
    attributes.status === "NEW" &&
    activities.length === 0 &&
    !workflowConcluded;
  const linkedQuotation = quotations[0] || null;
  const openQuotation = () => {
    if (!canOpenQuotationWorkspace) return;
    window.location.hash = linkedQuotation
      ? `quotations/${linkedQuotation.id}`
      : "quotations";
  };
  const displayedJourneyStep = leadStopsAtQuotation
    ? Math.min(activeJourneyStep, 3)
    : activeJourneyStep;
  const visibleStepCount = leadStopsAtQuotation
    ? 4
    : Math.min(steps.length, leadStepIndex + 2);
  const journeyAbandoned = journey?.attributes.status === "CANCELLED";
  const currentStepLabel = journeyAbandoned
    ? "Journey abandoned"
    : reviewOnly
      ? "This session is read-only. Review the captured journey records; authorized Sales or Operations roles own the next mutation."
    : firstFollowUpRequired
      ? "First interaction required"
      : attributes.status === "NEW"
        ? "Qualification in progress"
        : attributes.status === "CONTACTED"
          ? "Qualification in progress"
          : attributes.status === "QUALIFIED"
            ? "Prepare quotation"
            : attributes.status === "QUOTATION_PENDING"
              ? "Quotation in progress"
              : attributes.status === "WON"
                ? "Lead journey completed"
                : "Lead closed";
  const currentStepDescription = journeyAbandoned
    ? `No further workflow actions are allowed.${journey?.attributes.abandonment_reason ? ` Reason: ${journey.attributes.abandonment_reason}` : ""}`
    : firstFollowUpRequired
      ? "Record the first interaction before moving this Lead to Contacted."
      : attributes.status === "NEW" || attributes.status === "CONTACTED"
        ? "Continue the Sales & Marketing qualification journey."
        : attributes.status === "QUALIFIED"
          ? "Survey and requirements are ready for the quotation workflow."
          : attributes.status === "QUOTATION_PENDING"
            ? "Continue in Sales & Quotations; this Lead remains the journey record."
            : attributes.status === "WON"
              ? "The approved quotation has completed the Lead journey."
              : "This Lead is closed and retained for reference.";
  return (
    <section className="content feature-page provider-leads lead-detail-page">
      <PageHeader
        eyebrow="Sales & Marketing"
        title="Lead details"
        description={
          reviewOnly
            ? "Review the provider-scoped Lead, survey, requirements, assets and linked quotation journey."
            : "Review the prospect, complete the next action, and keep the Sales & Survey journey moving."
        }
        action={
          <div className="lead-detail-page-actions">
            <Button variant="secondary" className="workflow-back-action" onClick={back} title="Back to Leads and Surveys">
              <SvgIcon name="arrow-left" size={15} /> Back
            </Button>
            {!workflowConcluded &&
              canEditLead &&
              ["NEW", "CONTACTED"].includes(attributes.status) && (
                <Button
                  onClick={() => {
                    setQualificationDecision("QUALIFIED");
                    setQualificationOpen(true);
                  }}
                >
                  Review qualification
                </Button>
              )}
            <Button variant="secondary" className="workflow-timeline-action" onClick={() => setTimelineOpen(true)} title="View timeline and audit history">
              <SvgIcon name="activity" size={15} /> Timeline
            </Button>
            <WorkflowChainAction
              journey={journey}
              currentResourceKind="MarketingLead"
              currentResourceId={id}
            />
            <WorkflowFollowUpAction
              providerId={providerId}
              journeyId={journey?.id}
              targetResourceKind="MarketingLead"
              targetResourceId={id}
              onClick={() => setFollowUpOpen(true)}
            />
            <JourneyAbandonAction
              providerId={providerId}
              journey={journey}
              canAbandon={canAbandon && !workflowConcluded}
              onAbandoned={(updated) => {
                setJourney(updated);
                setMessage(
                  "Journey abandoned. Linked records are now read-only.",
                );
                void load();
              }}
            />
          </div>
        }
      />
      <div className="lead-detail-record-heading">
        <div className="lead-detail-record">
          <div className="lead-detail-record-summary">
            <div className="lead-detail-record-summary-top">
              <Status>
                {journeyAbandoned
                  ? "Abandoned"
                  : leadStatusLabel(attributes.status)}
              </Status>
              {!workflowConcluded && canEditLead && (
                <Button
                  variant="secondary"
                  onClick={() => setEditOpen(true)}
                >
                  Edit lead
                </Button>
              )}
            </div>
            <h2>{attributes.title}</h2>
            <p>
              {attributes.reference_code} · {attributes.prospect_name} ·{" "}
              {leadEventLabel(attributes.source)}
            </p>
          </div>
          <div className="lead-detail-current-step-inline">
            <span className="eyebrow">Current workflow step</span>
            <strong>{currentStepLabel}</strong>
            <small>{currentStepDescription}</small>
          </div>
          {workflowConcluded && (
            <div
              className={`workflow-concluded-inline${journeyAbandoned ? " workflow-concluded-inline--abandoned" : ""}`}
              role="status"
            >
              <span className="workflow-concluded-inline-icon" aria-hidden="true">
                <SvgIcon name={journeyAbandoned ? "x" : "shield"} size={14} />
              </span>
              <span className="workflow-concluded-inline-copy">
                <strong>
                  {journeyAbandoned
                    ? "Journey abandoned — read-only"
                    : "Workflow concluded — read-only"}
                </strong>
                <small>
                  {journeyAbandoned
                    ? "No further updates or downstream actions are allowed."
                    : "Stage complete. Continue in the linked quotation or downstream workflow."}
                </small>
              </span>
            </div>
          )}
        </div>
      </div>
      <ol
        className="lead-detail-progress"
        style={{
          gridTemplateColumns: `repeat(${Math.min(visibleStepCount, 5)}, minmax(0, 1fr))`,
        }}
        aria-label="Lead journey progress"
      >
        {steps.slice(0, visibleStepCount).map((step, index) => {
          const canOpen = index <= leadStepIndex;
          const canAdvance =
            index === leadStepIndex + 1 &&
            attributes.status !== "LOST" &&
            !leadStopsAtQuotation;
          const requiresFollowUp = index === 1 && firstFollowUpRequired;
          const enabled = canOpen || canAdvance;
          return (
            <li
              className={`${index === displayedJourneyStep ? "current " : ""}${index < leadStepIndex && index < displayedJourneyStep ? "complete" : ""}`.trim()}
              key={step}
            >
              <button
                type="button"
                disabled={!enabled || journeyStepBusy}
                aria-current={
                  index === displayedJourneyStep ? "step" : undefined
                }
                onClick={() =>
                  canOpen
                    ? openJourneyStep(index)
                    : requiresFollowUp
                      ? setFollowUpOpen(true)
                      : openJourneyStep(index)
                }
              >
                <span>{index + 1}</span>
                <strong>{step}</strong>
                {canAdvance && (
                  <small>
                    {requiresFollowUp ? "Record interaction" : "Open"}
                  </small>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {message && (
        <ActionNotification
          title="Update completed"
          onClose={() => setMessage("")}
        >
          {message}
        </ActionNotification>
      )}
      {error && (
        <ActionNotification
          kind="error"
          title="Lead action needs attention"
          onClose={() => setError("")}
        >
          {error}
        </ActionNotification>
      )}
      {firstFollowUpRequired && canRecordInteraction && (
        <section
          className="lead-detail-next-action"
          aria-label="Next Lead action"
        >
          <div>
            <span className="eyebrow">Next required action</span>
            <h2>Record the first interaction</h2>
            <p>
              Save the first call, email, meeting, or site visit. The Lead can
              move to Contacted after this activity is recorded.
            </p>
          </div>
          <Button type="button" onClick={() => setFollowUpOpen(true)}>
            <SvgIcon name="plus" size={15} /> Record first interaction
          </Button>
        </section>
      )}
      <div className="lead-detail-summary-grid">
        <section>
          <span>Prospect</span>
          <strong>{attributes.prospect_name}</strong>
          <small>
            {attributes.primary_contact_reference || "No contact reference"}
          </small>
        </section>
        <section>
          <span>Origin</span>
          <strong>
            {context?.work?.work_type
              ? leadEventLabel(context.work.work_type)
              : "Marketing Lead"}
          </strong>
          <small>{leadEventLabel(context?.work?.source || attributes.source)}</small>
        </section>
        <section>
          <span>Referral</span>
          <strong>
            {context?.referral?.tracking_number || "Not supplied"}
          </strong>
          <small>{context?.referral?.name || "No referral captured"}</small>
        </section>
        <section>
          <span>Assets</span>
          <strong>{`${assetCounts?.photos ?? context?.evidence?.photos ?? 0} photos · ${assetCounts?.documents ?? context?.evidence?.documents ?? 0} documents`}</strong>
          <small>Preserved in the shared journey</small>
        </section>
      </div>
      {activeJourneyStep === 0 && (
        <section
          className="lead-detail-card lead-detail-section lead-context-view"
          aria-label="Lead context"
        >
          <div className="lead-detail-card-heading lead-context-heading">
            <div>
              <span className="eyebrow">Lead context</span>
              <h2>Site and follow-up details</h2>
              <p>Key information captured for the current Sales journey.</p>
            </div>
            <Status>{leadEventLabel(attributes.priority)}</Status>
          </div>
          <div className="lead-context-grid">
            <div className="lead-context-item lead-context-item-wide">
              <span>Site</span>
              <strong>
                {context?.site?.summary ||
                  "Not captured in the originating intake"}
              </strong>
              <small>Originating site or service location</small>
            </div>
            <div className="lead-context-item">
              <span>Coordinates</span>
              <strong>
                {context?.site?.latitude != null &&
                context.site.longitude != null
                  ? String(context.site.latitude.toFixed(7)) +
                    ", " +
                    String(context.site.longitude.toFixed(7))
                  : "Not captured"}
              </strong>
              <small>
                {context?.site?.accuracy_m != null
                  ? "GPS accuracy ±" +
                    String(context.site.accuracy_m) +
                    " m"
                  : "Site coordinates unavailable"}
              </small>
            </div>
            <div className="lead-context-item">
              <span>Next follow-up</span>
              <strong>
                {attributes.next_follow_up_at
                  ? new Date(attributes.next_follow_up_at).toLocaleDateString(
                      "en-IN",
                      { day: "2-digit", month: "short", year: "numeric" },
                    )
                  : "Not scheduled"}
              </strong>
              <small>
                {attributes.next_follow_up_at
                  ? new Date(attributes.next_follow_up_at).toLocaleTimeString(
                      "en-IN",
                      { hour: "2-digit", minute: "2-digit" },
                    )
                  : "Use Follow-ups to schedule a reminder"}
              </small>
            </div>
          </div>
          <div className="lead-context-footer">
            <span>
              Record revision <strong>R{attributes.revision}</strong>
            </span>
            <span>
              Source <strong>{leadEventLabel(attributes.source)}</strong>
            </span>
            <span>
              Site capture{" "}
              <strong>
                {context?.site?.latitude != null &&
                context.site.longitude != null
                  ? "Available"
                  : "Pending"}
              </strong>
            </span>
          </div>
        </section>
      )}
      {activeJourneyStep === 1 && (
        <section
          id="lead-detail-evidence"
          className="lead-detail-card lead-detail-section"
        >
          <div className="lead-detail-card-heading">
            <div>
              <span className="eyebrow">Lead assets</span>
              <h2>Assets &amp; documents</h2>
            </div>
            <small>Private, provider-scoped preview</small>
          </div>
          <ProviderDocumentsStep
            providerId={providerId}
            targetId={id}
            canUpload={!workflowConcluded && canEditLead}
            scope="lead"
            intakeType="photos"
            compactIntake
            assetCenter
            initialClassification="WORK_INTAKE_PHOTO"
            onChanged={() => void load()}
          />
        </section>
      )}
      {activeJourneyStep === 2 && (
        <>
          <section
            id="lead-detail-survey"
            className="lead-detail-card lead-detail-section"
          >
            <div className="lead-detail-card-heading">
              <div>
                <span className="eyebrow">Survey &amp; requirements</span>
                <h2>Site survey and active requirements</h2>
              </div>
              <small>
                {surveys.length} survey record(s) · {requirements.length}{" "}
                requirement revision(s)
              </small>
            </div>
            <SiteSurveyWizard
              providerId={providerId}
              leadId={id}
              leadTitle={`${attributes.reference_code} · ${attributes.title}`}
              onSubmitted={() => {
                void load();
              }}
              onRequirementSaved={async () => {
                setMessage(
                  "Requirement revision saved. A new timeline event was recorded.",
                );
                await load();
              }}
              onMessage={setMessage}
              onLocationCaptured={(location) => {
                setLocationCandidate(location);
                setLocationMessage(
                  "Location captured. Review the coordinates before saving.",
                );
              }}
              readOnly={workflowConcluded || !canEditLead}
            />
          </section>
        </>
      )}
      {attributes.status === "LOST" ? (
        <section
          id="lead-detail-closed"
          className="lead-detail-stage-panel lead-detail-closed-panel"
          aria-label="Rejected Lead"
        >
          <div className="lead-detail-stage-heading">
            <div>
              <span className="eyebrow">Lead closed</span>
              <h2>Lead rejected</h2>
              <p>
                This Lead was rejected during qualification. The journey is
                concluded and no further activities, uploads, or handover
                actions are available from this record.
              </p>
            </div>
            <Status>Rejected</Status>
          </div>
          {attributes.lost_reason && (
            <p className="lead-detail-closed-reason">
              <strong>Reason:</strong> {attributes.lost_reason}
            </p>
          )}
        </section>
      ) : leadStopsAtQuotation ? (
        <section
          id="lead-detail-quotation"
          className="lead-detail-stage-panel lead-detail-quotation-boundary"
        >
          <span className="eyebrow">Quotation workflow</span>
          <div className="lead-detail-stage-heading">
            <div>
              <h2>Lead converted into quotation</h2>
              <p>
                {attributes.status === "WON"
                  ? "The quotation has completed its approval path. Further delivery and handover activity is managed outside the Lead record."
                  : "This Lead has moved into the quotation workflow. Quotation details, review, approval, and customer delivery are managed in Sales &amp; Quotations."}
              </p>
            </div>
            <Status>{leadStatusLabel(attributes.status)}</Status>
          </div>
          {linkedQuotation ? (
            <p className="lead-detail-linked-quotation">
              <strong>
                {String(
                  linkedQuotation.attributes.quotation_number ||
                    "Quotation draft",
                )}
              </strong>
              <span>
                {leadEventLabel(String(linkedQuotation.attributes.status || "DRAFT"))} ·
                Revision R{String(linkedQuotation.attributes.revision || "1")} ·{" "}
                {String(linkedQuotation.attributes.currency || "INR")}{" "}
                {String(linkedQuotation.attributes.total || "0")}
              </span>
            </p>
          ) : (
            <p className="notice">
              {canOpenQuotationWorkspace
                ? "The linked quotation is still being prepared. Open Sales &amp; Quotations to continue."
                : "Quotation preparation and status review are assigned to an authorized Sales &amp; Quotations role."}
            </p>
          )}
          {canOpenQuotationWorkspace ? (
            <Button onClick={openQuotation}>Open Sales &amp; Quotations</Button>
          ) : (
            <p className="notice lead-detail-capability-note">
              Quotation preparation is assigned to an authorized Sales &amp;
              Quotations role. This session can continue Lead follow-ups and
              review the Lead journey, but cannot open or modify quotation
              records.
            </p>
          )}
        </section>
      ) : activeJourneyStep === 3 ? (
        <section id="lead-detail-quotation" className="lead-detail-stage-panel">
          <span className="eyebrow">Quotation</span>
          <h2>Prepare the customer quotation</h2>
          <p>
            The Lead has completed the survey and requirements stage.
            {canOpenQuotationWorkspace
              ? " Open Sales & Quotations to prepare, review, and submit the quotation."
              : " Quotation preparation is assigned to an authorized Sales & Quotations role."}
          </p>
          {canOpenQuotationWorkspace ? (
            <Button onClick={openQuotation}>Open Sales &amp; Quotations</Button>
          ) : (
            <p className="notice lead-detail-capability-note">
              Your Marketing Executive session does not have the server
              quotation capability. Ask a Marketing Manager or Provider Admin
              to continue the quotation workflow.
            </p>
          )}
        </section>
      ) : (
        activeJourneyStep === 4 && (
          <section
            id="lead-detail-handover"
            className="lead-detail-stage-panel"
          >
            <span className="eyebrow">Handover</span>
            <h2>Continue project handover</h2>
            <p>
              After the quotation is approved, continue delivery and handover
              from Projects &amp; Delivery. The Lead history remains linked.
            </p>
            <Button
              onClick={() => {
                window.location.hash = "projects";
              }}
            >
              Open Projects &amp; Delivery
            </Button>
          </section>
        )
      )}
      {locationCandidate && (
        <OperationsDialog
          title="Confirm current site location"
          busy={locationBusy}
          onClose={() => {
            setLocationCandidate(null);
            setLocationMessage("Location capture cancelled.");
          }}
        >
          <div className="provider-work-intake-location-confirm">
            <div className="provider-work-intake-location-confirm-icon">
              <SvgIcon name="map-pin" size={24} />
            </div>
            <h3>Use this device location?</h3>
            <p>
              Confirm that the current device is at the Lead site before saving
              these coordinates.
            </p>
            <dl>
              <div>
                <dt>Latitude</dt>
                <dd>{locationCandidate.latitude.toFixed(7)}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd>{locationCandidate.longitude.toFixed(7)}</dd>
              </div>
              <div>
                <dt>Accuracy</dt>
                <dd>±{Math.round(locationCandidate.accuracy)} m</dd>
              </div>
              <div>
                <dt>Captured</dt>
                <dd>{leadEventTime(locationCandidate.capturedAt)}</dd>
              </div>
            </dl>
            <small className="provider-work-intake-location-note">
              The linked Work Intake stores the coordinates, accuracy, capture
              source, timestamp, and audit event.
            </small>
            {locationMessage && (
              <p className="lead-detail-location-message" role="status">
                {locationMessage}
              </p>
            )}
            <div className="provider-work-intake-location-confirm-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={locationBusy}
                onClick={() => {
                  setLocationCandidate(null);
                  setLocationMessage("Location capture cancelled.");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                busy={locationBusy}
                onClick={() => void confirmCurrentLocation()}
              >
                Confirm &amp; save location
              </Button>
            </div>
          </div>
        </OperationsDialog>
      )}
      {timelineOpen && (
        <JourneyTimelineDialog
          journey={journey}
          loading={false}
          error=""
          emptyLabel="No journey events are available for this Lead."
          onClose={() => setTimelineOpen(false)}
        />
      )}
      <WorkflowFollowUpDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        providerId={providerId}
        targetResourceKind="MarketingLead"
        targetResourceId={id}
        stage={attributes.workflow_stage || "LEAD"}
        readOnly={workflowConcluded || !canRecordInteraction}
        title="Activity & follow-up history"
      />
      {qualificationOpen && (
        <OperationsDialog
          title="Qualification decision"
          busy={journeyStepBusy}
          className="lead-workflow-dialog lead-qualification-dialog"
          onClose={() => setQualificationOpen(false)}
        >
          <form
            className="lead-workflow-form"
            onSubmit={(event) => void submitQualificationDecision(event)}
          >
            <div className="lead-qualification-intro">
              <span className="eyebrow">Explicit lifecycle action</span>
              <h3>Accept or reject this Lead</h3>
              <p>
                Opening a journey section is navigation only. This decision is
                the only action here that changes the Lead stage and records a
                server audit event.
              </p>
            </div>
            <fieldset>
              <legend>Decision</legend>
              <label>
                Outcome
                <select
                  name="decision"
                  value={qualificationDecision}
                  onChange={(event) =>
                    setQualificationDecision(
                      event.target.value as "QUALIFIED" | "LOST",
                    )
                  }
                >
                  <option value="QUALIFIED">Accept · Qualified</option>
                  <option value="LOST">Reject · Closed</option>
                </select>
              </label>
              <label className="lead-form-span">
                Rejection reason
                <textarea
                  name="decision_reason"
                  minLength={qualificationDecision === "LOST" ? 3 : undefined}
                  required={qualificationDecision === "LOST"}
                  placeholder="Required when rejecting this Lead"
                  rows={3}
                />
                <small>
                  A rejection is stored as the existing closed-lost status so
                  reports and downstream workflow remain compatible.
                </small>
              </label>
            </fieldset>
            {attributes.status === "NEW" && activities.length === 0 && (
              <p className="notice">
                Record the first interaction before accepting this Lead. The
                server will not qualify a new Lead without that evidence.
              </p>
            )}
            <div className="lead-workflow-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={journeyStepBusy}
                onClick={() => setQualificationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={qualificationDecision === "LOST" ? "danger" : undefined}
                busy={journeyStepBusy}
                disabled={
                  journeyStepBusy ||
                  (qualificationDecision === "QUALIFIED" &&
                    attributes.status === "NEW" &&
                    activities.length === 0)
                }
              >
                {qualificationDecision === "LOST"
                  ? "Reject lead"
                  : "Accept & qualify"}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {editOpen && canEditLead && (
        <OperationsDialog
          title="Update lead"
          busy={busy}
          className="lead-workflow-dialog"
          onClose={() => setEditOpen(false)}
        >
          <form
            className="lead-workflow-form"
            onSubmit={(event) => void updateLead(event)}
          >
            <fieldset>
              <legend>Lead identity</legend>
              <label>
                Reference code
                <input value={attributes.reference_code} readOnly />
                <small>Reference codes remain immutable.</small>
              </label>
              <label>
                Prospect
                <input
                  name="prospect_name"
                  required
                  maxLength={200}
                  defaultValue={attributes.prospect_name}
                />
              </label>
              <label>
                Opportunity title
                <input
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={attributes.title}
                />
              </label>
              <label>
                Primary contact reference
                <input
                  name="primary_contact_reference"
                  maxLength={320}
                  defaultValue={attributes.primary_contact_reference || ""}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Sales management</legend>
              <label>
                Priority
                <select name="priority" defaultValue={attributes.priority}>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label>
                Lead stage
                <input value={leadStatusLabel(attributes.status)} readOnly />
                <small>
                  Use Review qualification for an explicit accept or reject
                  decision. Opening a journey tab never changes this stage.
                </small>
              </label>
              <label>
                Next follow-up
                <input
                  name="next_follow_up_at"
                  type="datetime-local"
                  defaultValue={
                    attributes.next_follow_up_at
                      ? new Date(attributes.next_follow_up_at)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
            </fieldset>
            <div className="lead-workflow-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Save changes
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {activityOpen && canRecordInteraction && (
        <OperationsDialog
          title="Record interaction"
          busy={busy}
          className="lead-workflow-dialog"
          onClose={() => setActivityOpen(false)}
        >
          <div className="lead-follow-up-dialog">
            <section className="lead-follow-up-dialog-history">
              <div className="lead-dialog-section-heading">
                <div>
                  <span className="eyebrow">Lead interactions</span>
                  <h3>Interaction history</h3>
                  <p>Previous interactions are shown from oldest to newest.</p>
                </div>
                <strong>{activities.length} recorded</strong>
              </div>
              {activities.length ? (
                <ol className="lead-detail-activity-list">
                  {sortLeadActivities(activities).map((activity) => (
                    <li key={activity.id}>
                      <div>
                        <strong>
                          {leadEventLabel(
                            String(
                              activity.attributes.activity_type || "Activity",
                            ),
                          )}
                        </strong>
                        <small>
                          {leadEventTime(
                            String(activity.attributes.occurred_at || ""),
                          )}
                        </small>
                      </div>
                      <p>
                        {String(
                          activity.attributes.notes ||
                            activity.attributes.outcome ||
                            "No notes recorded",
                        )}
                      </p>
                      {activity.attributes.outcome != null && (
                        <small>
                          Outcome: {String(activity.attributes.outcome)}
                        </small>
                      )}
                      {activity.attributes.next_action != null && (
                        <small>
                          Next action: {String(activity.attributes.next_action)}
                        </small>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="notice">No interaction has been recorded yet.</p>
              )}
            </section>
            <form
              className="lead-workflow-form lead-follow-up-dialog-form"
              onSubmit={(event) => void recordInteraction(event)}
            >
              <h3>New interaction details</h3>
              <fieldset>
                <legend>Interaction</legend>
                <label>
                  Lead
                  <input
                    value={`${attributes.reference_code} · ${attributes.title}`}
                    readOnly
                  />
                </label>
                <label>
                  Activity type
                  <select name="activity_type" defaultValue="CALL">
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="SITE_VISIT">Site visit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label>
                  Activity date
                  <input
                    name="occurred_at"
                    type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </label>
                <label>
                  Outcome
                  <input name="outcome" maxLength={500} />
                </label>
              </fieldset>
              <fieldset>
                <legend>Next action and notes</legend>
                <label>
                  Next action
                  <input name="next_action" maxLength={500} />
                </label>
                <label>
                  Summary / notes
                  <textarea name="notes" required maxLength={4000} rows={4} />
                </label>
              </fieldset>
              <div className="lead-workflow-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActivityOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" busy={busy}>
                  Save interaction
                </Button>
              </div>
            </form>
          </div>
        </OperationsDialog>
      )}
    </section>
  );
}

function MarketingLeadRegister({
  providerId,
  effectivePermissions,
}: {
  providerId: string;
  effectivePermissions: string[] | null;
}) {
  const can = (code: string) => effectivePermissions?.includes(code) === true;
  const canCreateLead = can("LEAD_CREATE");
  const canEditLead = can("LEAD_EDIT");
  const canRecordInteraction = can("FOLLOW_UP_LOG");
  const [leads, setLeads] =
    useState<Collection<MarketingLeadAttributes> | null>(null);
  const [relationships, setRelationships] =
    useState<Collection<GenericAttributes> | null>(null);
  const [selected, setSelected] =
    useState<Resource<MarketingLeadAttributes> | null>(null);
  const [selectedLeadTab, setSelectedLeadTab] = useState("Overview");
  const [requirementCatalogue, setRequirementCatalogue] =
    useState<RequirementCatalogue | null>(null);
  const [selectedRequirements, setSelectedRequirements] = useState<
    Resource<RequirementRevisionAttributes>[]
  >([]);
  const [selectedActivities, setSelectedActivities] = useState<
    Resource<GenericAttributes>[]
  >([]);
  const automaticLeadSelection = useRef(true);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [surveyId, setSurveyId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [pageCursor, setPageCursor] = useState<{
    after?: string;
    before?: string;
  }>({});
  const pageLimit = DEFAULT_PAGE_SIZE;

  useEffect(() => {
    let active = true;
    setLeads(null);
    setRelationships(null);
    setSelected(null);
    automaticLeadSelection.current = true;
    void Promise.all([
      operationsData.marketingLeads(providerId, {
        ...pageCursor,
        limit: pageLimit,
        query: search.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        source: sourceFilter === "ALL" ? undefined : sourceFilter,
        priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      }),
      operationsData
        .customerRelationships(providerId)
        .catch(() => ({ data: [] })),
    ])
      .then(([leadRows, relationshipRows]) => {
        if (!active) return;
        setLeads(leadRows);
        setRelationships(relationshipRows as Collection<GenericAttributes>);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [
    providerId,
    pageCursor,
    pageLimit,
    search,
    statusFilter,
    sourceFilter,
    priorityFilter,
  ]);

  useEffect(() => {
    setPageCursor({});
    setSelected(null);
    automaticLeadSelection.current = true;
  }, [search, statusFilter, sourceFilter, priorityFilter]);

  useEffect(() => {
    setSelectedRequirements([]);
    setSelectedActivities([]);
    if (!selected) return;
    setSelectedLeadTab("Overview");
    void Promise.all([
      operationsData.requirementRevisions(providerId, selected.id),
      operationsData.siteSurveys(providerId, selected.id),
      operationsData.leadActivities(providerId, selected.id),
    ])
      .then(([revisions, surveys, activityRows]) => {
        setSelectedRequirements(revisions.data);
        setSurveyId(
          surveys.data.find((survey) => survey.attributes.status !== "DRAFT")
            ?.id ||
            surveys.data[0]?.id ||
            "",
        );
        setSelectedActivities(activityRows.data);
      })
      .catch((cause) => setError((cause as Error).message));
  }, [providerId, selected]);

  useEffect(() => {
    void operationsData
      .elevatorRequirementCatalogue(providerId)
      .then(setRequirementCatalogue)
      .catch((cause) =>
        setError(
          (cause as Error).message ||
            "Requirement catalogue could not be loaded.",
        ),
      );
  }, [providerId]);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await operationsData.createMarketingLead(
        providerId,
        {
          reference_code: form.get("reference_code"),
          source: form.get("source"),
          title: form.get("title"),
          prospect_name: form.get("prospect_name"),
          primary_contact_reference:
            form.get("primary_contact_reference") || undefined,
          customer_relationship_id:
            form.get("customer_relationship_id") || undefined,
        },
        crypto.randomUUID(),
      );
      setLeads((current) =>
        current ? { ...current, data: [created, ...current.data] } : current,
      );
      window.location.hash = `leads/${encodeURIComponent(created.id)}`;
      setFormOpen(false);
      formElement.reset();
      carryActionNotification("Lead created by the server.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await operationsData.updateMarketingLead(
        providerId,
        selected.id,
        {
          title: form.get("title"),
          prospect_name: form.get("prospect_name"),
          primary_contact_reference:
            form.get("primary_contact_reference") || undefined,
          priority: form.get("priority"),
          next_follow_up_at: form.get("next_follow_up_at")
            ? new Date(String(form.get("next_follow_up_at"))).toISOString()
            : null,
          expected_revision: selected.attributes.revision,
        },
        crypto.randomUUID(),
      );
      automaticLeadSelection.current = false;
      setSelected(updated);
      setLeads((current) =>
        current
          ? {
              ...current,
              data: current.data.map((lead) =>
                lead.id === updated.id ? updated : lead,
              ),
            }
          : current,
      );
      setEditOpen(false);
      setMessage("Lead updated by the server.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await operationsData.createLeadActivity(
        providerId,
        selected.id,
        {
          activity_type: form.get("activity_type"),
          occurred_at: form.get("occurred_at")
            ? new Date(String(form.get("occurred_at"))).toISOString()
            : undefined,
          outcome: form.get("outcome") || undefined,
          next_action: form.get("next_action") || undefined,
          notes: form.get("notes"),
        },
        crypto.randomUUID(),
      );
      setActivityOpen(false);
      setSelectedActivities(
        (await operationsData.leadActivities(providerId, selected.id)).data,
      );
      setMessage("Follow-up recorded by the server.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !leads)
    return (
      <section className="notice state-error" role="alert">
        <strong>{error}</strong>
      </section>
    );
  if (!leads)
    return (
      <section className="notice" role="status">
        <strong>Loading leads…</strong>
      </section>
    );
  const filteredLeads = leads.data;
  const newLeads = leads.data.filter(
    (lead) => lead.attributes.status === "NEW",
  ).length;
  const followUps = leads.data.filter(
    (lead) => lead.attributes.status === "CONTACTED",
  ).length;
  const surveysPending = leads.data.filter(
    (lead) => lead.attributes.status === "QUALIFIED",
  ).length;
  const readyForQuote = leads.data.filter((lead) =>
    ["QUALIFIED", "READY_FOR_QUOTE"].includes(lead.attributes.status),
  ).length;
  return (
    <section className="content provider-leads">
      <div className="feature-page-heading">
        <div>
          <span className="eyebrow">Sales &amp; Marketing</span>
          <h2>Leads &amp; site surveys</h2>
          <p>
            {canCreateLead
              ? "Capture prospects, plan site surveys, and move opportunities toward quotation."
              : "Review provider-scoped prospects, surveys, requirements and linked quotation journeys."}
          </p>
        </div>
        {canCreateLead && (
          <Button aria-label="New lead" onClick={() => setFormOpen(true)}>
            + Add lead
          </Button>
        )}
      </div>
      <div className="feature-summary-grid">
        <div>
          <span>New leads</span>
          <strong>{newLeads}</strong>
          <small>of {leads.data.length} on this page</small>
        </div>
        <div>
          <span>Follow-ups</span>
          <strong>{followUps}</strong>
          <small>Contacted leads on this page</small>
        </div>
        <div>
          <span>Surveys pending</span>
          <strong>{surveysPending}</strong>
          <small>Qualified leads on this page</small>
        </div>
        <div>
          <span>Ready for quotation</span>
          <strong>{readyForQuote}</strong>
          <small>Eligible leads on this page</small>
        </div>
      </div>
      {formOpen && canCreateLead && (
        <OperationsDialog
          title="Create lead"
          busy={busy}
          className="lead-workflow-dialog"
          onClose={() => setFormOpen(false)}
        >
          <p className="lead-dialog-intro">
            Create a provider-scoped sales lead. This does not create a Customer
            or Project.
          </p>
          <form className="lead-workflow-form" onSubmit={createLead}>
            <div className="form-grid">
              <label>
                Reference code
                <input
                  name="reference_code"
                  required
                  maxLength={40}
                  placeholder="LEAD-100"
                />
              </label>
              <label>
                Source
                <input
                  name="source"
                  required
                  maxLength={40}
                  placeholder="FIELD"
                />
              </label>
              <label>
                Prospect name
                <input name="prospect_name" required maxLength={200} />
              </label>
              <label>
                Opportunity title
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Primary contact reference
                <input name="primary_contact_reference" maxLength={320} />
              </label>
              <label>
                Existing customer/prospect (optional)
                <select name="customer_relationship_id">
                  <option value="">Create a new prospect relationship</option>
                  {relationships?.data.map((relationship) => (
                    <option key={relationship.id} value={relationship.id}>
                      {String(
                        relationship.attributes.display_name ||
                          relationship.attributes.name ||
                          relationship.id,
                      )}{" "}
                      ·{" "}
                      {String(
                        relationship.attributes.relationship_kind ||
                          "relationship",
                      )}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="lead-workflow-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Create lead"}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      <div className="leads-workspace leads-workspace--full">
        <section className="leads-list-panel">
          <div className="section-heading">
            <div>
              <h3>Leads ({leads.data.length})</h3>
              <p>
                All prospects and survey opportunities. Choose View to open the
                authorized lead workspace.
              </p>
            </div>
          </div>
          <div className="leads-filters">
            <input
              aria-label="Search leads"
              placeholder="Search by name, company or location…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter leads by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              {Array.from(
                new Set(leads.data.map((lead) => lead.attributes.status)),
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter leads by source"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="ALL">All sources</option>
              {Array.from(
                new Set(leads.data.map((lead) => lead.attributes.source)),
              ).map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter leads by priority"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="ALL">All priorities</option>
              {Array.from(
                new Set(leads.data.map((lead) => lead.attributes.priority)),
              ).map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
          {filteredLeads.length === 0 ? (
            <p className="notice">
              No leads match the current filters in this Provider workspace.
            </p>
          ) : (
            <div className="lead-register-scroll">
              <table className="lead-register">
                <thead>
                  <tr>
                    <th scope="col">Lead / prospect</th>
                    <th scope="col">Initiator</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Reference / source</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={
                        selected?.id === lead.id ? "is-selected" : undefined
                      }
                    >
                      <td data-label="Lead / prospect">
                        <button
                          type="button"
                          className="lead-register-select"
                          onClick={() => {
                            window.location.hash = `leads/${encodeURIComponent(lead.id)}`;
                          }}
                        >
                          {lead.attributes.title}
                        </button>
                        <small>{lead.attributes.prospect_name}</small>
                      </td>
                      <td data-label="Initiator">
                        <strong>
                          {lead.attributes.created_by?.name ||
                            "Provider team member"}
                        </strong>
                        <small>
                          {lead.attributes.created_by?.email ||
                            "Created in provider workspace"}
                        </small>
                      </td>
                      <td data-label="Owner">
                        <strong>
                          {lead.attributes.assigned_marketing_executive?.name ||
                            lead.attributes.marketing_manager?.name ||
                            "Not assigned"}
                        </strong>
                        <small>
                          {lead.attributes.assigned_marketing_executive
                            ? "Marketing executive"
                            : lead.attributes.marketing_manager
                              ? "Marketing manager"
                              : "Awaiting assignment"}
                        </small>
                      </td>
                      <td data-label="Reference / source">
                        {lead.attributes.reference_code}
                        <small>{leadEventLabel(lead.attributes.source)}</small>
                      </td>
                      <td data-label="Priority">
                        <Priority>{lead.attributes.priority}</Priority>
                      </td>
                      <td data-label="Status">
                        <Status>
                          {lead.attributes.journey_status_label === "ABANDONED"
                            ? "ABANDONED"
                            : leadStatusLabel(lead.attributes.status)}
                        </Status>
                        {lead.attributes.journey_status_label ===
                        "ABANDONED" ? (
                          <small className="workflow-concluded-label">
                            Journey abandoned
                          </small>
                        ) : (
                          lead.attributes.journey_stage_status ===
                            "COMPLETED" && (
                            <small className="workflow-concluded-label">
                              Workflow concluded
                            </small>
                          )
                        )}
                      </td>
                      <td data-label="Actions">
                        <ProviderActionMenu
                          label={`Actions for lead ${lead.attributes.title || "Lead"}`}
                          actions={[
                            {
                              id: "view",
                              label: "View lead",
                              onSelect: () => {
                                window.location.hash = `leads/${encodeURIComponent(lead.id)}`;
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="server-pagination" aria-label="Lead pages">
            <span>Showing {filteredLeads.length} of this provider page</span>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={!leads.page?.previous}
                onClick={() => {
                  automaticLeadSelection.current = true;
                  setSelected(null);
                  setPageCursor({ before: leads.page?.previous || undefined });
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                disabled={!leads.page?.next}
                onClick={() => {
                  automaticLeadSelection.current = true;
                  setSelected(null);
                  setPageCursor({ after: leads.page?.next || undefined });
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
        {selected && (
          <OperationsDialog
            title={String(selected.attributes.title)}
            onClose={() => {
              automaticLeadSelection.current = false;
              setSelected(null);
            }}
            className="lead-detail-dialog"
          >
            <aside
              className="detail-card lead-detail-panel"
              aria-label="Lead details"
            >
              <nav
                className="lead-detail-tabs workflow-detail-tabs"
                aria-label="Lead detail sections"
                role="tablist"
              >
                {(
                  [
                    "Overview",
                    "Documents & photos",
                    "Site Survey",
                    "Requirements",
                  ] as const
                ).map((tab) => {
                  const tabId = tab.toLowerCase().replaceAll(" ", "-");
                  return (
                    <button
                      key={tab}
                      id={`lead-tab-${tabId}`}
                      type="button"
                      role="tab"
                      aria-controls={`lead-panel-${tabId}`}
                      aria-selected={selectedLeadTab === tab}
                      className={selectedLeadTab === tab ? "active" : ""}
                      onClick={() => setSelectedLeadTab(tab)}
                    >
                      {tab}
                    </button>
                  );
                })}
              </nav>
              <section
                id="lead-panel-overview"
                role="tabpanel"
                aria-labelledby="lead-tab-overview"
                hidden={selectedLeadTab !== "Overview"}
              >
                <dl>
                  <dt>Prospect</dt>
                  <dd>{selected.attributes.prospect_name}</dd>
                  <dt>Status</dt>
                  <dd>{leadStatusLabel(selected.attributes.status)}</dd>
                  <dt>Priority</dt>
                  <dd>
                    <Priority>{selected.attributes.priority}</Priority>
                  </dd>
                  <dt>Revision</dt>
                  <dd>{selected.attributes.revision}</dd>
                </dl>
                {canEditLead && (
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    Edit lead
                  </Button>
                )}
              </section>
              <section
                id="lead-panel-documents-photos"
                role="tabpanel"
                aria-labelledby="lead-tab-documents-&-photos"
                hidden={selectedLeadTab !== "Documents & photos"}
              >
                <div className="lead-dialog-section-heading">
                  <div>
                    <span className="eyebrow">Lead assets</span>
                    <h4>Documents &amp; photos</h4>
                  </div>
                  <small>Private, provider-scoped preview</small>
                </div>
                <div className="lead-detail-evidence-stack">
                  <ProviderDocumentsStep
                    providerId={providerId}
                    targetId={selected.id}
                    canUpload={canEditLead}
                    scope="lead"
                    intakeType="photos"
                    compactIntake
                    initialClassification="WORK_INTAKE_PHOTO"
                    onChanged={async () => {
                      setSelectedActivities(
                        (
                          await operationsData.leadActivities(
                            providerId,
                            selected.id,
                          )
                        ).data,
                      );
                    }}
                  />
                  <ProviderDocumentsStep
                    providerId={providerId}
                    targetId={selected.id}
                    canUpload={canEditLead}
                    scope="lead"
                    intakeType="documents"
                    compactIntake
                    initialClassification="WORK_INTAKE_DOCUMENT"
                    onChanged={() => undefined}
                  />
                </div>
              </section>
              <section
                id="lead-panel-site-survey"
                role="tabpanel"
                aria-labelledby="lead-tab-site-survey"
                hidden={selectedLeadTab !== "Site Survey"}
              >
                <SiteSurveyWizard
                  providerId={providerId}
                  leadId={selected.id}
                  leadTitle={`${selected.attributes.reference_code} · ${selected.attributes.title}`}
                  onSubmitted={setSurveyId}
                  onMessage={setMessage}
                  readOnly={!canEditLead}
                />
              </section>
              <section
                id="lead-panel-requirements"
                role="tabpanel"
                aria-labelledby="lead-tab-requirements"
                hidden={selectedLeadTab !== "Requirements"}
              >
                <RequirementRevisionSection
                  providerId={providerId}
                  leadId={selected.id}
                  catalogue={requirementCatalogue}
                  revisions={selectedRequirements}
                  surveyId={surveyId}
                  readOnly={!canEditLead}
                  onSaved={async () => {
                    setMessage(
                      "Requirement revision saved. A new timeline event was recorded.",
                    );
                    setSelectedRequirements(
                      (
                        await operationsData.requirementRevisions(
                          providerId,
                          selected.id,
                        )
                      ).data,
                    );
                  }}
                />
              </section>
              <section
                className="lead-dialog-follow-up lead-detail-follow-up-section"
                aria-label="Interaction history"
              >
                <div className="lead-dialog-section-heading">
                  <div>
                    <span className="eyebrow">Lead interactions</span>
                    <h4>Interaction history</h4>
                    <p>Completed interactions for this Lead.</p>
                  </div>
                  {canRecordInteraction && (
                    <Button type="button" onClick={() => setActivityOpen(true)}>
                      <SvgIcon name="plus" size={15} /> Record interaction
                    </Button>
                  )}
                </div>
                {selectedActivities.length ? (
                  <ol className="lead-detail-activity-list">
                    {sortLeadActivities(selectedActivities).map((activity) => (
                      <li key={activity.id}>
                        <div>
                          <strong>
                            {leadEventLabel(
                              String(
                                activity.attributes.activity_type || "Activity",
                              ),
                            )}
                          </strong>
                          <small>
                            {leadEventTime(
                              String(activity.attributes.occurred_at || ""),
                            )}
                          </small>
                        </div>
                        <p>
                          {String(
                            activity.attributes.notes ||
                              activity.attributes.outcome ||
                              "No notes recorded",
                          )}
                        </p>
                        {activity.attributes.outcome != null && (
                          <small>
                            Outcome: {String(activity.attributes.outcome)}
                          </small>
                        )}
                        {activity.attributes.next_action != null && (
                          <small>
                            Next action:{" "}
                            {String(activity.attributes.next_action)}
                          </small>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="notice">No follow-up recorded yet.</p>
                )}
              </section>
            </aside>
          </OperationsDialog>
        )}
      </div>
      {editOpen && selected && canEditLead && (
        <OperationsDialog
          title="Update lead"
          busy={busy}
          className="lead-workflow-dialog"
          onClose={() => setEditOpen(false)}
        >
          <p className="lead-dialog-intro">
            Changes are revision checked. Previously captured surveys and
            requirement revisions remain preserved.
          </p>
          <form
            className="lead-workflow-form"
            onSubmit={(event) => void updateLead(event)}
          >
            <fieldset>
              <legend>Lead identity</legend>
              <label>
                Reference code
                <input value={selected.attributes.reference_code} readOnly />
              </label>
              <label>
                Prospect
                <input
                  name="prospect_name"
                  required
                  maxLength={200}
                  defaultValue={selected.attributes.prospect_name}
                />
              </label>
              <label>
                Opportunity title
                <input
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={selected.attributes.title}
                />
              </label>
              <label>
                Primary contact reference
                <input
                  name="primary_contact_reference"
                  maxLength={320}
                  defaultValue={
                    selected.attributes.primary_contact_reference || ""
                  }
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Sales management</legend>
              <label>
                Priority
                <select
                  name="priority"
                  defaultValue={selected.attributes.priority}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label>
                Lead stage
                <input
                  value={leadStatusLabel(selected.attributes.status)}
                  readOnly
                />
                <small>
                  Use the Lead detail page’s Review qualification action for an
                  explicit lifecycle decision.
                </small>
              </label>
              <label>
                Next follow-up
                <input
                  name="next_follow_up_at"
                  type="datetime-local"
                  defaultValue={
                    selected.attributes.next_follow_up_at
                      ? new Date(selected.attributes.next_follow_up_at)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
            </fieldset>
            <div className="lead-workflow-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {activityOpen && selected && canRecordInteraction && (
        <OperationsDialog
          title="Record interaction"
          busy={busy}
          className="lead-workflow-dialog"
          onClose={() => setActivityOpen(false)}
        >
          <div className="lead-follow-up-dialog">
            <section className="lead-follow-up-dialog-history">
              <div className="lead-dialog-section-heading">
                <div>
                  <span className="eyebrow">Lead interactions</span>
                  <h3>Interaction history</h3>
                  <p>Previous interactions are shown from oldest to newest.</p>
                </div>
                <strong>{selectedActivities.length} recorded</strong>
              </div>
              {selectedActivities.length ? (
                <ol className="lead-detail-activity-list">
                  {sortLeadActivities(selectedActivities).map((activity) => (
                    <li key={activity.id}>
                      <div>
                        <strong>
                          {leadEventLabel(
                            String(
                              activity.attributes.activity_type || "Activity",
                            ),
                          )}
                        </strong>
                        <small>
                          {leadEventTime(
                            String(activity.attributes.occurred_at || ""),
                          )}
                        </small>
                      </div>
                      <p>
                        {String(
                          activity.attributes.notes ||
                            activity.attributes.outcome ||
                            "No notes recorded",
                        )}
                      </p>
                      {activity.attributes.outcome != null && (
                        <small>
                          Outcome: {String(activity.attributes.outcome)}
                        </small>
                      )}
                      {activity.attributes.next_action != null && (
                        <small>
                          Next action: {String(activity.attributes.next_action)}
                        </small>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="notice">No interaction has been recorded yet.</p>
              )}
            </section>
            <form
              className="lead-workflow-form lead-follow-up-dialog-form"
              onSubmit={(event) => void recordInteraction(event)}
            >
              <h3>New interaction details</h3>
              <fieldset>
                <legend>Interaction</legend>
                <label>
                  Lead
                  <input
                    value={`${selected.attributes.reference_code} · ${selected.attributes.title}`}
                    readOnly
                  />
                </label>
                <label>
                  Activity type
                  <select name="activity_type" defaultValue="CALL">
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="SITE_VISIT">Site visit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label>
                  Activity date
                  <input
                    name="occurred_at"
                    type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </label>
                <label>
                  Outcome
                  <input name="outcome" maxLength={500} />
                </label>
              </fieldset>
              <fieldset>
                <legend>Next action and notes</legend>
                <label>
                  Next action
                  <input name="next_action" maxLength={500} />
                </label>
                <label className="lead-form-span">
                  Summary / notes
                  <textarea name="notes" required maxLength={4000} rows={4} />
                </label>
              </fieldset>
              <div className="lead-workflow-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setActivityOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save interaction"}
                </Button>
              </div>
            </form>
          </div>
        </OperationsDialog>
      )}
      {message && (
        <ActionNotification
          title="Update completed"
          onClose={() => setMessage("")}
        >
          {message}
        </ActionNotification>
      )}
      {error && (
        <ActionNotification
          kind="error"
          title="Lead action needs attention"
          onClose={() => setError("")}
        >
          {error}
        </ActionNotification>
      )}
    </section>
  );
}
