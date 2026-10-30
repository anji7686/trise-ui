import { useEffect, useState } from "react";
import {
  type ProviderAuditAttributes,
  type ProviderWorkJourney,
  type ProviderWorkJourneyLink,
  type Resource,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { SvgIcon } from "./icons";
import { OperationsDialog } from "./operations-dialog";
import { WorkflowModelIcon } from "./workflow-model-icons";

type JourneyMilestoneId =
  | "WORK_INTAKE"
  | "LEAD_SURVEY"
  | "SALES_QUOTATION"
  | "PROJECT_INSTALLATION"
  | "HANDOVER"
  | "AMC_SERVICE"
  | "OTHER";
type JourneyTimelineProps = {
  journey: ProviderWorkJourney | null;
  loading: boolean;
  error: string;
  emptyLabel?: string;
  showHeading?: boolean;
};

const JOURNEY_MILESTONE_DISPLAY_ORDER: JourneyMilestoneId[] = [
  "AMC_SERVICE",
  "HANDOVER",
  "PROJECT_INSTALLATION",
  "SALES_QUOTATION",
  "LEAD_SURVEY",
  "WORK_INTAKE",
  "OTHER",
];
const JOURNEY_MILESTONE_LABELS: Record<JourneyMilestoneId, string> = {
  WORK_INTAKE: "Work Intake",
  LEAD_SURVEY: "Lead & Survey",
  SALES_QUOTATION: "Sales & Quotation",
  PROJECT_INSTALLATION: "Project & Installation",
  HANDOVER: "Handover",
  AMC_SERVICE: "AMC & Service",
  OTHER: "Other activity",
};

type WorkflowChainStage = {
  code: Exclude<JourneyMilestoneId, "OTHER">;
  label: string;
  stages: string[];
};

const WORKFLOW_CHAIN_STAGES: WorkflowChainStage[] = [
  { code: "WORK_INTAKE", label: "Work Intake", stages: ["INTAKE"] },
  {
    code: "LEAD_SURVEY",
    label: "Lead & Survey",
    stages: ["LEAD", "SURVEY", "REQUIREMENTS"],
  },
  {
    code: "SALES_QUOTATION",
    label: "Sales & Quotation",
    stages: ["QUOTATION", "APPROVAL"],
  },
  {
    code: "PROJECT_INSTALLATION",
    label: "Project & Installation",
    stages: ["PROJECT"],
  },
  { code: "HANDOVER", label: "Handover", stages: ["HANDOVER"] },
  { code: "AMC_SERVICE", label: "AMC & Service", stages: ["AMC", "SERVICE"] },
];

type WorkflowChainTarget = { path: string; label: string };

const linkMetadataId = (link: ProviderWorkJourneyLink, key: string) => {
  const value = link.metadata?.[key];
  return typeof value === "string" && value ? value : "";
};

function workflowChainTarget(
  link: ProviderWorkJourneyLink,
  links: ProviderWorkJourneyLink[],
): WorkflowChainTarget | null {
  const id = link.resource_id;
  switch (link.resource_kind) {
    case "ProviderWorkIntake":
      return { path: `work-intake/${id}`, label: "Open Work Intake" };
    case "MarketingLead":
      return { path: `leads/${id}`, label: "Open Lead & Survey" };
    case "Quotation":
      return { path: `quotations/${id}`, label: "Open Quotation" };
    case "ServiceCase":
      return { path: `projects/${id}`, label: "Open Project & Installation" };
    case "ServiceJob":
      return { path: `jobs/${id}`, label: "Open Service Job" };
    case "MaintenanceContract":
      return { path: `amc/${id}`, label: "Open AMC" };
    case "SiteSurvey":
    case "RequirementRevision": {
      const lead = links.find((item) => item.resource_kind === "MarketingLead");
      return lead
        ? { path: `leads/${lead.resource_id}`, label: "Open Lead & Survey" }
        : null;
    }
    case "ServiceCaseHandoverEvidence": {
      const project = links.find((item) => item.resource_kind === "ServiceCase");
      return project
        ? {
            path: `projects/${project.resource_id}`,
            label: "Open Project & Handover",
          }
        : null;
    }
    case "ServiceVisit":
    case "ServiceReport": {
      const jobId = linkMetadataId(link, "service_job_id");
      const job = links.find(
        (item) => item.resource_kind === "ServiceJob" && item.resource_id === jobId,
      ) || links.find((item) => item.resource_kind === "ServiceJob");
      return job ? { path: `jobs/${job.resource_id}`, label: "Open Service Job" } : null;
    }
    default:
      return null;
  }
}

function workflowStageTarget(
  stage: WorkflowChainStage,
  links: ProviderWorkJourneyLink[],
): WorkflowChainTarget | null {
  const stageLinks = links
    .filter((link) => stage.stages.includes(link.stage))
    .sort((left, right) =>
      String(right.linked_at).localeCompare(String(left.linked_at)),
    );
  for (const link of stageLinks) {
    const target = workflowChainTarget(link, links);
    if (target) return target;
  }
  return null;
}

function workflowChainStatus(
  stage: WorkflowChainStage,
  links: ProviderWorkJourneyLink[],
  journey: ProviderWorkJourney | null,
) {
  const stageLinks = links.filter((link) => stage.stages.includes(link.stage));
  const milestone = journey?.attributes.workflow_milestones?.find(
    (item) => item.code === stage.code,
  );
  if (stageLinks.some((link) => link.status === "ACTIVE")) return "ACTIVE";
  if (stageLinks.length || milestone?.status === "COMPLETED") return "COMPLETED";
  return "NOT_STARTED";
}

function workflowStatusLabel(status: string) {
  if (status === "ACTIVE") return "Active";
  if (status === "COMPLETED") return "Completed";
  return "Not started";
}

export function WorkflowChainAction({
  journey,
  loading = false,
  currentResourceKind,
  currentResourceId,
}: {
  journey: ProviderWorkJourney | null;
  loading?: boolean;
  currentResourceKind?: string;
  currentResourceId?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!journey || loading) return null;
  const links = journey?.attributes.links || [];
  const initiatedCount = WORKFLOW_CHAIN_STAGES.filter((stage) =>
    links.some((link) => stage.stages.includes(link.stage)),
  ).length;
  return (
    <>
      <button
        type="button"
        className="button button-secondary workflow-chain-action"
        onClick={() => setOpen(true)}
        title="View initiated workflow records and open their detail pages"
      >
        <SvgIcon name="link" size={15} />
        <span>Journey</span>
        {initiatedCount > 0 && <span className="workflow-chain-count">{initiatedCount}</span>}
      </button>
      {open && journey && (
        <WorkflowChainDialog
          journey={journey}
          currentResourceKind={currentResourceKind}
          currentResourceId={currentResourceId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function WorkflowChainDialog({
  journey,
  currentResourceKind,
  currentResourceId,
  onClose,
}: {
  journey: ProviderWorkJourney;
  currentResourceKind?: string;
  currentResourceId?: string;
  onClose: () => void;
}) {
  const links = journey.attributes.links || [];
  const journeyStages = WORKFLOW_CHAIN_STAGES.map((stage) => {
    const stageLinks = links
      .filter((link) => stage.stages.includes(link.stage))
      .sort((left, right) =>
        String(right.linked_at).localeCompare(String(left.linked_at)),
      );
    return {
      stage,
      stageLinks,
      status: workflowChainStatus(stage, links, journey),
    };
  });
  const initiatedCount = journeyStages.filter(({ status }) => status !== "NOT_STARTED").length;
  return (
    <OperationsDialog
      title="Workflow chain"
      onClose={onClose}
      className="workflow-chain-dialog"
    >
      <div className="workflow-chain-intro">
        <span className="eyebrow">Step-by-step workflow</span>
        <strong>{initiatedCount} of {journeyStages.length} stages initiated</strong>
      </div>
      <ol className="workflow-chain-list">
        {journeyStages.map(({ stage, stageLinks, status }) => {
          const target = workflowStageTarget(stage, links);
          const isCurrent = stageLinks.some(
            (link) =>
              link.resource_kind === currentResourceKind &&
              link.resource_id === currentResourceId,
          );
          return (
            <li
              className={`workflow-chain-item workflow-chain-item--${status.toLowerCase()}${isCurrent ? " is-current" : ""}`}
              key={stage.code}
            >
              <span className="workflow-chain-marker" aria-hidden="true">
                <WorkflowModelIcon name={stage.code} size={15} />
              </span>
              <div className="workflow-chain-item-body">
                <div className="workflow-chain-item-heading">
                  <strong>{stage.label}</strong>
                  <small>{workflowStatusLabel(status)}{isCurrent ? " · Current" : ""}</small>
                </div>
                {target && (
                  <button
                    type="button"
                    className="text-button workflow-chain-open"
                    aria-label={target.label}
                    title={target.label}
                    onClick={() => {
                      window.location.hash = target.path;
                      onClose();
                    }}
                  >
                    <SvgIcon name="link" size={15} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </OperationsDialog>
  );
}

const label = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventTitle = (event: ProviderAuditAttributes) => {
  if (event.action === "WORK_JOURNEY_RESOURCE_LINKED") {
    const resourceKind = String(
      event.after?.resource_kind || event.metadata?.resource_kind || "record",
    );
    return `${label(resourceKind)} Linked to Journey`;
  }
  return label(event.action);
};
const isMajorActivity = (event: ProviderAuditAttributes) =>
  /(?:^|_)(?:CREATED|SUBMITTED|QUALIFIED|APPROVED|ACCEPTED|REJECTED|ISSUED|REVISED|REPLACED|CONVERTED|COMPLETED|ACTIVATED|CLOSED|CANCELLED|ABANDONED)(?:_|$)/.test(
    String(event.action || "").toUpperCase(),
  );
const time = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Time unavailable";
const timestamp = (event?: Resource<ProviderAuditAttributes>) =>
  new Date(
    String(event?.attributes.occurred_at || event?.attributes.created_at || 0),
  ).getTime();
const value = (item: unknown): string => {
  if (item == null || item === "") return "Not supplied";
  if (typeof item === "boolean") return item ? "Yes" : "No";
  if (Array.isArray(item)) return item.length ? item.map(value).join(", ") : "None";
  if (typeof item === "object")
    return Object.entries(item as Record<string, unknown>)
      .map(([key, entry]) => `${label(key)}: ${value(entry)}`)
      .join(" · ");
  return String(item);
};
const detailValue = (key: string, item: unknown): string =>
  key.endsWith("_at") && typeof item === "string" ? time(item) : value(item);
const details = (event: ProviderAuditAttributes): Array<[string, string]> => {
  const metadata = event.metadata || {};
  const before = event.before || {};
  const after = event.after || {};
  const rows: Array<[string, string]> = [];
  const add = (key: string, item: unknown) => {
    if (item !== undefined && item !== null && item !== "")
      rows.push([label(key), detailValue(key, item)]);
  };
  const resource = String(event.resource_kind || "").toUpperCase();
  if (resource.includes("PROVIDERWORKFOLLOWUP")) {
    add("Subject", metadata.subject || after.subject || before.subject);
    add("Purpose", metadata.purpose || after.purpose || before.purpose);
    add(
      "Scheduled for",
      metadata.scheduled_at || after.scheduled_at || before.scheduled_at,
    );
    add(
      "Reminder at",
      metadata.reminder_at || after.reminder_at || before.reminder_at,
    );
    add("Contact", metadata.contact_name || after.contact_name || before.contact_name);
    add(
      "Contact reference",
      metadata.contact_reference || after.contact_reference || before.contact_reference,
    );
    add("Response", metadata.response || after.response);
    add("Outcome", metadata.outcome || after.outcome);
    add(
      "Cancellation reason",
      event.action === "WORK_FOLLOW_UP_CANCELLED"
        ? metadata.reason || after.notes
        : undefined,
    );
  }
  add("Reason", metadata.reason);
  add("Assignment type", metadata.assignment_kind);
  add("Decision", metadata.decision || metadata.route);
  add("Next team", metadata.next_team);
  add("Workflow route", after.workflow_route || metadata.workflow_route);
  add("Current step", after.current_stage || metadata.stage);
  if (before.status || after.status)
    add(
      "Status change",
      `${value(before.status || "Not set")} → ${value(after.status || "Not set")}`,
    );
  if (before.assigned_to || after.assigned_to)
    add(
      "Ownership",
      `${value(before.assigned_to)} → ${value(after.assigned_to)}`,
    );
  if (after.resource_kind || metadata.resource_kind)
    add(
      "Linked record",
      `${label(String(after.resource_kind || metadata.resource_kind))} · ${String(after.resource_id || metadata.resource_id || "").slice(-8)}`,
    );
  return rows;
};
const milestoneFor = (
  event: Resource<ProviderAuditAttributes>,
): JourneyMilestoneId => {
  const resource = String(event.attributes.resource_kind || "").toUpperCase();
  const stage = String(
    event.attributes.metadata?.stage || event.attributes.after?.current_stage || "",
  ).toUpperCase();
  if (resource.includes("PROVIDERWORKINTAKE") || stage === "INTAKE")
    return "WORK_INTAKE";
  if (
    resource.includes("MARKETINGLEAD") ||
    resource.includes("LEADACTIVITY") ||
    resource.includes("SITESURVEY") ||
    resource.includes("REQUIREMENTREVISION") ||
    ["LEAD", "SURVEY", "REQUIREMENTS"].includes(stage)
  )
    return "LEAD_SURVEY";
  if (resource.includes("QUOTATION") || ["QUOTATION", "COMMERCIAL"].includes(stage))
    return "SALES_QUOTATION";
  if (
    resource.includes("HANDOVER") ||
    resource.includes("CUSTODY") ||
    stage === "HANDOVER"
  )
    return "HANDOVER";
  if (
    resource.includes("MAINTENANCECONTRACT") ||
    resource.includes("SERVICEREQUEST") ||
    resource.includes("SERVICEJOB") ||
    resource.includes("SERVICEVISIT") ||
    resource.includes("SERVICEREPORT") ||
    ["AMC", "SERVICE"].includes(stage)
  )
    return "AMC_SERVICE";
  if (resource.includes("SERVICECASE") || stage === "PROJECT")
    return "PROJECT_INSTALLATION";
  return "OTHER";
};
const milestones = (events: Resource<ProviderAuditAttributes>[]) => {
  const grouped = new Map<
    JourneyMilestoneId,
    Resource<ProviderAuditAttributes>[]
  >();
  const seen = new Set<string>();
  [...events]
    .sort(
      (left, right) =>
        timestamp(right) - timestamp(left) || right.id.localeCompare(left.id),
    )
    .forEach((event) => {
      const attributes = event.attributes;
      const key = [
        attributes.action,
        attributes.resource_kind,
        attributes.resource_id,
        attributes.occurred_at,
      ].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      const id = milestoneFor(event);
      grouped.set(id, [...(grouped.get(id) || []), event]);
    });
  return JOURNEY_MILESTONE_DISPLAY_ORDER.filter((id) => grouped.has(id)).map(
    (id) => ({ id, events: grouped.get(id) || [] }),
  );
};

export function JourneyTimelineAccordion({
  journey,
  loading,
  error,
  emptyLabel = "No journey events are available.",
  showHeading = true,
}: JourneyTimelineProps) {
  const groups = milestones(journey?.attributes.events || []);
  const workflowMilestones = journey?.attributes.workflow_milestones || [];
  const [openMilestone, setOpenMilestone] = useState<JourneyMilestoneId | null>(
    groups[0]?.id || null,
  );

  useEffect(() => {
    if (!openMilestone || !groups.some((group) => group.id === openMilestone))
      setOpenMilestone(groups[0]?.id || null);
  }, [journey?.id, groups.length, openMilestone]);

  if (!journey)
    return (
      <div className="provider-work-intake-activity-dialog lead-detail-activity-dialog">
        {showHeading && <div className="lead-timeline-popup-heading">
          <span className="eyebrow">Journey history</span>
          <p>Review the connected workflow history in one place.</p>
        </div>}
        {loading && <p role="status">Loading journey history…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    );

  const journeyStatus =
    journey.attributes.status === "CANCELLED"
      ? "ABANDONED"
      : label(journey.attributes.status);
  const eventsCount = groups.reduce((total, group) => total + group.events.length, 0);
  const activeStages = workflowMilestones.filter(
    (milestone) => milestone.status === "ACTIVE",
  ).length;
  const context = journey.attributes.context;
  const journeyLinks = journey.attributes.links || [];
  const lifecycleStages = WORKFLOW_CHAIN_STAGES.map((stage) => {
    const milestone = workflowMilestones.find((item) => item.code === stage.code);
    const status = milestone?.status || workflowChainStatus(stage, journeyLinks, journey);
    return {
      stage,
      status,
      isCurrent: stage.stages.includes(journey.attributes.current_stage),
      hasActivity: groups.some((group) => group.id === stage.code),
    };
  });

  return (
    <div className="provider-work-intake-activity-dialog lead-detail-activity-dialog">
      {showHeading && <div className="lead-timeline-popup-heading">
        <span className="eyebrow">Journey history</span>
        <p>Latest activity first. Select a stage to expand its history.</p>
      </div>}

      <details className="provider-work-intake-journey-summary journey-overview">
        <summary className="journey-overview-summary">
          <span className="journey-overview-summary-copy">
            <span className="provider-work-intake-eyebrow">Workflow status</span>
            <strong>Journey overview</strong>
            <small>
              {eventsCount} events · {activeStages} active {activeStages === 1 ? "stage" : "stages"} · R{journey.attributes.revision}
              {journey.attributes.abandonment_reason ? ` · ${journey.attributes.abandonment_reason}` : ""}
            </small>
          </span>
          <Status>{journeyStatus}</Status>
          <span className="journey-overview-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="journey-overview-content">

        {lifecycleStages.length > 0 && (
          <div className="journey-lifecycle-strip" aria-label="Workflow lifecycle">
            {lifecycleStages.map(({ stage, status, isCurrent, hasActivity }) => (
              <div
                className={`journey-lifecycle-item journey-lifecycle-${status.toLowerCase()}${isCurrent ? " is-current" : ""}`}
                key={stage.code}
              >
                <button
                  type="button"
                  className="journey-lifecycle-select"
                  disabled={!hasActivity}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${stage.label}: ${workflowStatusLabel(status)}`}
                  onClick={() => {
                    if (hasActivity) setOpenMilestone(stage.code);
                  }}
                >
                  <span className="journey-lifecycle-marker" aria-hidden="true">
                    <WorkflowModelIcon name={stage.code} size={14} />
                  </span>
                  <span className="journey-lifecycle-copy">
                    <strong>{stage.label}</strong>
                    <small>{workflowStatusLabel(status)}</small>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="journey-context-grid">
          <div>
            <span>Requester</span>
            <strong>{context.requester?.name || "Not supplied"}</strong>
          </div>
          <div>
            <span>Referral</span>
            <strong>
              {context.referral?.tracking_number ||
                context.referral?.name ||
                "Not supplied"}
            </strong>
          </div>
          <div>
            <span>Site coordinates</span>
            <strong>
              {context.site?.latitude != null && context.site.longitude != null
                ? `${context.site.latitude.toFixed(5)}, ${context.site.longitude.toFixed(5)}`
                : "Not captured"}
            </strong>
          </div>
          <div>
            <span>Requirements</span>
            <strong>
              {context.requirements?.latest_revision
                ? `Revision ${context.requirements.latest_revision} confirmed`
                : "Awaiting survey confirmation"}
            </strong>
          </div>
          <div>
            <span>Evidence carried</span>
            <strong>{`${context.evidence?.photos || 0} photos · ${context.evidence?.documents || 0} documents`}</strong>
          </div>
        </div>
        </div>
      </details>

      {groups.length ? (
        <section className="journey-activity-section" aria-label="Journey activity">
          <div className="journey-activity-heading">
            <div>
              <span className="provider-work-intake-eyebrow">Activity</span>
              <h3>Journey log</h3>
            </div>
            <span className="journey-activity-count">
              {eventsCount} {eventsCount === 1 ? "event" : "events"}
            </span>
          </div>
          <div className="journey-milestone-accordion">
            {groups.map((group, index) => {
              const open = openMilestone === group.id;
              return (
                <section
                  className={`journey-milestone journey-milestone--${group.id.toLowerCase()} ${open ? "is-open" : ""}`}
                  key={group.id}
                >
                  <button
                    type="button"
                    className="journey-milestone-trigger"
                    aria-expanded={open}
                    onClick={() => setOpenMilestone(open ? null : group.id)}
                  >
                    <span className="journey-milestone-step" aria-label={`Step ${index + 1}`}>
                      {group.id === "OTHER" ? <SvgIcon name="activity" size={15} /> : <WorkflowModelIcon name={group.id} size={15} />}
                    </span>
                    <span className="journey-milestone-copy">
                      <strong>{JOURNEY_MILESTONE_LABELS[group.id]}</strong>
                      <small>
                        {group.events.length} {group.events.length === 1 ? "event" : "events"}
                      </small>
                    </span>
                    <span className="journey-milestone-chevron" aria-hidden="true">
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                  {open && (
                    <ol className="provider-work-intake-timeline journey-milestone-events">
                      {group.events.map((event) => {
                        const eventDetails = details(event.attributes);
                        const major = isMajorActivity(event.attributes);
                        const eventScope = milestoneFor(event);
                        return (
                          <li
                            key={event.id}
                            className={`journey-activity-event journey-activity-event--${eventScope.toLowerCase()}${major ? " is-major" : ""}`}
                          >
                            <span
                              className="provider-work-intake-timeline-icon journey-event-icon"
                              aria-hidden="true"
                            >
                              <SvgIcon name="activity" size={15} />
                            </span>
                            <div className="provider-work-intake-timeline-card journey-event-card">
                              <div className="provider-work-intake-timeline-header">
                                <div>
                                  <strong>{eventTitle(event.attributes)}</strong>
                                  <small>{time(event.attributes.occurred_at)}</small>
                                </div>
                                <div className="journey-event-badges">
                                  <span className="journey-event-scope">{JOURNEY_MILESTONE_LABELS[eventScope]}</span>
                                  {major && <span className="journey-event-milestone">Milestone</span>}
                                  <Status>{label(event.attributes.actor_kind || "SYSTEM")}</Status>
                                </div>
                              </div>
                              <div className="provider-work-intake-actor">
                                <span>Actor</span>
                                <strong>
                                  {event.attributes.actor_name ||
                                    event.attributes.actor_email ||
                                    "System activity"}
                                </strong>
                                {event.attributes.actor_email && (
                                  <small>{event.attributes.actor_email}</small>
                                )}
                              </div>
                              {!eventDetails.length && (
                                <div className="provider-work-intake-event-context">
                                  <span className="journey-event-detail">
                                    <small>Record source</small>
                                    <strong>
                                      {label(
                                        event.attributes.resource_kind ||
                                          "Provider journey",
                                      )}
                                    </strong>
                                  </span>
                                  <span className="journey-event-detail">
                                    <small>Readable details</small>
                                    <strong>No additional fields recorded</strong>
                                  </span>
                                </div>
                              )}
                              {eventDetails.length > 0 && (
                                <div className="provider-work-intake-readable-details">
                                  {eventDetails.map(([name, text]) => (
                                  <span className="journey-event-detail" key={name}>
                                      <small>{name}</small>
                                      <strong>{text}</strong>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="platform-empty-inline">{emptyLabel}</p>
      )}
    </div>
  );
}

export function JourneyTimelineDialog({
  journey,
  loading,
  error,
  emptyLabel,
  onClose,
  title = "Journey history",
}: JourneyTimelineProps & { onClose: () => void; title?: string }) {
  return (
    <OperationsDialog
      title={title}
      className="journey-timeline-dialog"
      onClose={onClose}
    >
      <JourneyTimelineAccordion
        journey={journey}
        loading={loading}
        error={error}
        emptyLabel={emptyLabel}
      />
    </OperationsDialog>
  );
}
