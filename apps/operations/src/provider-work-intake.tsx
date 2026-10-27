import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@trise/auth";
import { Button, FilterToolbar, PageHeader } from "@trise/ui";
import { OperationsDialog } from "./operations-dialog";
import {
  ActionFeedback,
  EmptyState,
  ProviderActionMenu,
} from "./operations-shared";
import { OperationsStatus as Status } from "./operations-status";
import {
  operationsData,
  DEFAULT_PAGE_SIZE,
  type Collection,
  type GenericAttributes,
  type ProviderWorkJourney,
  type RequirementCatalogue,
  type WorkIntakeAttributes,
  type WorkIntakeMatch,
  type Resource,
} from "./data";
import type { OperationsRoute } from "./operations-pages";
import { accessData, type AssignmentCandidate } from "./access-data";
import { ProviderDocumentsStep } from "./provider-documents";
import { SvgIcon } from "./icons";
import {
  JourneyTimelineDialog,
  WorkflowChainAction,
} from "./provider-journey-timeline";
import {
  WorkflowFollowUpAction,
  WorkflowFollowUpDialog,
} from "./workflow-follow-ups";
import "./provider-work-intake.css";

const SOURCES = [
  "MARKETING",
  "PROVIDER_DIRECT",
  "REFERRAL",
  "EXISTING_ASSET",
  "AMC_RENEWAL",
  "INTERNAL_REQUEST",
  "PARTNER",
];
const WORK_TYPES = [
  "NEW_INSTALLATION",
  "MODIFICATION",
  "TAKEOVER",
  "AMC",
  "REPAIR",
  "INSPECTION",
];
const REFERRAL_ROLES = [
  "Customer / property owner",
  "Existing customer",
  "Partner / channel partner",
  "Dealer / distributor",
  "Consultant",
  "Architect",
  "Builder / developer",
  "Contractor",
  "Facility manager",
  "Society / community representative",
  "Property manager",
  "Agent / broker",
  "Government / institution",
  "Employee / internal team",
  "AMC / maintenance provider",
  "Other",
];
const ROUTE_TEAM_LABELS: Record<string, string> = {
  LEAD: "Marketing / Sales",
  QUOTATION: "Commercials",
  SERVICE_REQUEST: "Service Operations",
  SERVICE_JOB: "Dispatch & Field Service",
  PROJECT: "Projects & Delivery",
  AMC: "Service Programs",
};
const DEFAULT_ELEVATOR_EQUIPMENT_TYPES = [
  { code: "PASSENGER_TRACTION", label: "Passenger traction" },
  { code: "PASSENGER_MRL", label: "Passenger MRL" },
  { code: "FREIGHT_TRACTION", label: "Freight traction" },
  { code: "INDUSTRIAL_FREIGHT_LIFT", label: "Industrial freight lift" },
  { code: "HYDRAULIC", label: "Hydraulic lift" },
  { code: "HOME_LIFT", label: "Home lift" },
];
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorMessage = (error: unknown) =>
  (error as { message?: string })?.message ||
  "The request could not be completed.";
const newKey = () => crypto.randomUUID();
const locationLabel = (location: Resource<GenericAttributes>) =>
  String(
    location.attributes.name ||
      location.attributes.display_name ||
      location.attributes.address_line_1 ||
      "Service location",
  );
type IntakeQueue = "ALL" | "RELATIONSHIP" | "ASSESSMENT" | "ACTIVE" | "CLOSED";
type LocationCandidate = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};
const queueTitle = (queue: IntakeQueue) =>
  ({
    ALL: "Intake register",
    RELATIONSHIP: "Needs relationship review",
    ASSESSMENT: "Needs assessment",
    ACTIVE: "Active work",
    CLOSED: "Closed",
  })[queue];
const activityTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Time unavailable";
const transitionName = (value: unknown) => {
  if (!value || typeof value !== "object") return "Not assigned";
  const person = value as { name?: string | null; email?: string | null };
  return person.name || person.email || "Not assigned";
};
type IntakeStep =
  | "RELATIONSHIP"
  | "REQUIREMENTS"
  | "ASSETS"
  | "ASSIGNMENT"
  | "ASSESSMENT"
  | "HANDOFF"
  | "CLOSED";
const intakeStep = (item: WorkIntakeAttributes): IntakeStep => {
  if (item.status === "CLOSED") return "CLOSED";
  if (item.relationship_status === "SUGGESTED" && item.match_suggestions.length)
    return "RELATIONSHIP";
  if (item.assessment_task.status !== "COMPLETED")
    return item.assigned_to_user_id ? "ASSESSMENT" : "ASSIGNMENT";
  if (!item.workflow_route || item.status !== "EXECUTION") return "HANDOFF";
  return "ASSETS";
};
const visibleIntakeStep = (step: IntakeStep): IntakeStep =>
  step === "ASSIGNMENT" ? "ASSESSMENT" : step;
const nextAction = (item: WorkIntakeAttributes) => {
  if (item.status === "CLOSED") return "Workflow concluded";
  if (item.relationship_status === "SUGGESTED" && item.match_suggestions.length)
    return "Review possible match";
  if (item.assessment_task.status === "OPEN" && item.assigned_to_user_id)
    return "Owner acceptance pending";
  if (item.assessment_task.status !== "COMPLETED")
    return item.assigned_to_user_id ? "Complete assessment" : "Assign an owner";
  if (!item.workflow_route) return "Choose downstream workflow";
  if (item.status !== "EXECUTION")
    return `Hand off to ${item.downstream_team || label(item.workflow_route)}`;
  if (item.status === "EXECUTION") return "Track execution";
  return "Closed";
};
const nextActionDescription = (
  item: WorkIntakeAttributes,
  recommended: string,
) =>
  recommended === "Review possible match"
    ? "Review the suggested record below before the owner starts work."
    : recommended === "Assign an owner"
      ? "Allocate this intake to one provider team member. The backend will create the correct Lead or downstream route automatically."
      : recommended === "Owner acceptance pending"
        ? "The assigned owner has one action: accept the intake to start the assessment."
        : recommended === "Complete assessment"
          ? "The owner is working on the assessment. Complete it to move the shared journey to the next team."
          : recommended === "Choose downstream workflow"
            ? "Assessment is complete. Select the authorized downstream workflow and confirm the handoff."
            : recommended.startsWith("Hand off")
              ? "Assessment is complete. Confirm the route once and the selected downstream team can take over."
              : recommended === "Track execution"
                ? "This intake has been handed to the downstream workflow. Continue in the linked work area."
                : item.status === "CLOSED"
                  ? "This intake is closed and retained for reference."
                  : "Continue with the current Work Intake action.";
const routeTeamLabel = (route?: string) =>
  ROUTE_TEAM_LABELS[route || ""] || (route ? label(route) : "To be selected");

export function ProviderWorkIntakeWorkspace({
  providerId,
  route,
  canCreate,
  canEdit,
  canAssign,
}: {
  providerId: string;
  route: OperationsRoute;
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
}) {
  const [items, setItems] = useState<Collection<WorkIntakeAttributes> | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [workType, setWorkType] = useState("");
  const [status, setStatus] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [activeQueue, setActiveQueue] = useState<IntakeQueue>("ALL");
  const limit = DEFAULT_PAGE_SIZE;
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [detailHeaderActions, setDetailHeaderActions] =
    useState<ReactNode>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setItems(
        await operationsData.providerWorkIntakes(providerId, {
          limit,
          ...cursor,
          q: query || undefined,
          source: source || undefined,
          work_type: workType || undefined,
          status: status || undefined,
          relationship_status: relationshipStatus || undefined,
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [
    providerId,
    limit,
    cursor,
    query,
    source,
    workType,
    status,
    relationshipStatus,
  ]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  const refresh = async () => {
    await load();
  };
  const open = useCallback((id: string) => {
    window.location.hash = `work-intake/${encodeURIComponent(id)}`;
  }, []);
  const back = useCallback(() => {
    window.location.hash = "work-intake";
  }, []);
  const saved = async (record: Resource<WorkIntakeAttributes>) => {
    setCreateOpen(false);
    setNotice(
      `${record.attributes.reference_code} was saved. Possible matches are advisory; no record was linked automatically.`,
    );
    back();
    await refresh();
  };
  const updateDetailHeaderActions = useCallback(
    (actions: ReactNode) => setDetailHeaderActions(actions),
    [],
  );
  const visibleItems = useMemo(() => {
    if (!items) return [];
    return items.data.filter((item) => {
      if (activeQueue === "RELATIONSHIP")
        return (
          item.attributes.status !== "CLOSED" &&
          item.attributes.relationship_status === "SUGGESTED" &&
          item.attributes.match_suggestions.length > 0
        );
      if (activeQueue === "ASSESSMENT")
        return (
          item.attributes.status !== "CLOSED" &&
          item.attributes.assessment_task.status !== "COMPLETED"
        );
      if (activeQueue === "ACTIVE") return item.attributes.status !== "CLOSED";
      if (activeQueue === "CLOSED") return item.attributes.status === "CLOSED";
      return true;
    });
  }, [activeQueue, items]);
  const queueCounts = useMemo(
    () => ({
      all: items?.data.length ?? 0,
      relationship:
        items?.data.filter(
          (item) =>
            item.attributes.status !== "CLOSED" &&
            item.attributes.relationship_status === "SUGGESTED" &&
            item.attributes.match_suggestions.length > 0,
        ).length ?? 0,
      assessment:
        items?.data.filter(
          (item) =>
            item.attributes.status !== "CLOSED" &&
            item.attributes.assessment_task.status !== "COMPLETED",
        ).length ?? 0,
      active:
        items?.data.filter((item) => item.attributes.status !== "CLOSED")
          .length ?? 0,
      closed:
        items?.data.filter((item) => item.attributes.status === "CLOSED")
          .length ?? 0,
    }),
    [items],
  );

  return (
    <section className="content feature-page provider-work-intake">
      <PageHeader
        title={route.id ? "Work Intake details" : "Work Intake"}
        description={
          route.id
            ? "Review the request, complete the next action, and keep the provider record moving."
            : "Capture new work once, then move it through relationship review, assessment, and execution."
        }
        action={
          route.id ? (
            detailHeaderActions
          ) : canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>Create intake</Button>
          ) : undefined
        }
      />
      {notice && (
        <ActionFeedback>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </ActionFeedback>
      )}
      {error && (
        <div className="provider-work-intake-error" role="alert">
          <strong>{error}</strong>
          <Button variant="secondary" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}
      {route.id ? (
        <IntakeDetail
          providerId={providerId}
          id={route.id}
          canEdit={canEdit}
          canAssign={canAssign}
          back={back}
          onHeaderActions={updateDetailHeaderActions}
          changed={async (message) => {
            setNotice(message);
            await refresh();
          }}
        />
      ) : (
        <>
          <nav
            className="provider-work-intake-queues"
            aria-label="Work intake queues"
          >
            <button
              type="button"
              className={activeQueue === "ALL" ? "active" : ""}
              onClick={() => setActiveQueue("ALL")}
            >
              <span>All intakes</span>
              <strong>{items ? queueCounts.all : "—"}</strong>
              <small>Everything on this page</small>
            </button>
            <button
              type="button"
              className={
                activeQueue === "RELATIONSHIP"
                  ? "active needs-attention"
                  : "needs-attention"
              }
              onClick={() => setActiveQueue("RELATIONSHIP")}
            >
              <span>Needs relationship review</span>
              <strong>{items ? queueCounts.relationship : "—"}</strong>
              <small>Only suggested matches</small>
            </button>
            <button
              type="button"
              className={activeQueue === "ASSESSMENT" ? "active" : ""}
              onClick={() => setActiveQueue("ASSESSMENT")}
            >
              <span>Needs assessment</span>
              <strong>{items ? queueCounts.assessment : "—"}</strong>
              <small>Provider-owned follow-up</small>
            </button>
            <button
              type="button"
              className={activeQueue === "ACTIVE" ? "active" : ""}
              onClick={() => setActiveQueue("ACTIVE")}
            >
              <span>Active work</span>
              <strong>{items ? queueCounts.active : "—"}</strong>
              <small>Open, assessment, or execution</small>
            </button>
            <button
              type="button"
              className={activeQueue === "CLOSED" ? "active" : ""}
              onClick={() => setActiveQueue("CLOSED")}
            >
              <span>Closed</span>
              <strong>{items ? queueCounts.closed : "—"}</strong>
              <small>Completed intake records</small>
            </button>
          </nav>
          <FilterToolbar
            resultLabel={
              items
                ? `${visibleItems.length} matching intake records on this page`
                : "Loading provider-scoped intake…"
            }
          >
            <label>
              Search intakes
              <input
                aria-label="Search intakes"
                placeholder="Reference, title or site…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor({});
                }}
              />
            </label>
          </FilterToolbar>
          <details className="provider-work-intake-more-filters">
            <summary>
              More filters
              {[source, workType, status, relationshipStatus].filter(Boolean)
                .length
                ? ` · ${[source, workType, status, relationshipStatus].filter(Boolean).length} active`
                : ""}
            </summary>
            <div className="provider-work-intake-filter-grid">
              <label>
                Source
                <select
                  aria-label="Filter by source"
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value);
                    setCursor({});
                  }}
                >
                  <option value="">All sources</option>
                  {SOURCES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Work type
                <select
                  aria-label="Filter by work type"
                  value={workType}
                  onChange={(event) => {
                    setWorkType(event.target.value);
                    setCursor({});
                  }}
                >
                  <option value="">All work types</option>
                  {WORK_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setCursor({});
                  }}
                >
                  <option value="">All statuses</option>
                  {["OPEN", "ASSESSMENT", "EXECUTION", "CLOSED"].map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Relationship
                <select
                  aria-label="Filter by relationship status"
                  value={relationshipStatus}
                  onChange={(event) => {
                    setRelationshipStatus(event.target.value);
                    setCursor({});
                  }}
                >
                  <option value="">All relationships</option>
                  {["UNRESOLVED", "SUGGESTED", "CONFIRMED", "DISMISSED"].map(
                    (item) => (
                      <option key={item} value={item}>
                        {label(item)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </details>
          {!items && !error && (
            <p className="notice">Loading authorized work intake…</p>
          )}
          {items &&
            (visibleItems.length ? (
              <div className="provider-work-intake-table-wrap">
                <div className="provider-work-intake-table-heading">
                  <div>
                    <h2>{queueTitle(activeQueue)}</h2>
                    <p>Select an intake to see the next recommended action.</p>
                  </div>
                  <span>{visibleItems.length} shown</span>
                </div>
                <table className="provider-work-intake-table">
                  <thead>
                    <tr>
                      <th>Work item</th>
                      <th>Initiator</th>
                      <th>Owner</th>
                      <th>Channel</th>
                      <th>Next action</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Work item">
                          <strong>{item.attributes.title}</strong>
                          <span className="intake-reference">
                            {item.attributes.reference_code}
                          </span>
                          <small>
                            {item.attributes.site_summary ||
                              "Site not specified"}
                            {item.attributes.site_coordinates?.latitude != null
                              ? " · Location captured"
                              : ""}
                          </small>
                        </td>
                        <td data-label="Initiator">
                          <strong>
                            {item.attributes.created_by?.name ||
                              "Provider team member"}
                          </strong>
                          <small>
                            {item.attributes.created_by?.email ||
                              "Initiated in provider workspace"}
                          </small>
                        </td>
                        <td data-label="Owner">
                          <strong>
                            {item.attributes.assigned_to?.name ||
                              "Not assigned"}
                          </strong>
                          <small>
                            {item.attributes.assigned_to?.email ||
                              "Awaiting team assignment"}
                          </small>
                        </td>
                        <td data-label="Channel">
                          <span>{label(item.attributes.source)}</span>
                          <small>
                            {label(item.attributes.work_type)}
                            {item.attributes.source === "REFERRAL" &&
                            item.attributes.referral_contact?.number
                              ? ` · ${item.attributes.referral_contact.number}`
                              : ""}
                          </small>
                        </td>
                        <td data-label="Next action">
                          <strong className="intake-next-action">
                            {nextAction(item.attributes)}
                          </strong>
                          <small>
                            {item.attributes.relationship_status === "SUGGESTED"
                              ? `${item.attributes.match_suggestions.length} possible match(es)`
                              : label(item.attributes.relationship_status)}
                          </small>
                        </td>
                        <td data-label="Status">
                          <Status>
                            {item.attributes.journey_status_label ===
                            "ABANDONED"
                              ? "ABANDONED"
                              : label(item.attributes.status)}
                          </Status>
                          {item.attributes.journey_status_label ===
                          "ABANDONED" ? (
                            <small className="workflow-concluded-label">
                              Journey abandoned
                            </small>
                          ) : item.attributes.journey_stage_status ===
                            "COMPLETED" ? (
                            <small className="workflow-concluded-label">
                              Workflow concluded
                            </small>
                          ) : (
                            <small>
                              {label(item.attributes.assessment_task.status)}{" "}
                              assessment
                            </small>
                          )}
                        </td>
                        <td data-label="Updated">
                          <small>
                            {new Date(
                              item.attributes.created_at || "",
                            ).toLocaleDateString()}
                          </small>
                        </td>
                        <td data-label="Actions">
                          <ProviderActionMenu
                            label={`Actions for ${item.attributes.reference_code}`}
                            actions={[
                              {
                                id: "review",
                                label: "Open intake",
                                onSelect: () => open(item.id),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No work intake records found"
                description="Create an intake or change the server-side filters. A possible duplicate never blocks intake creation."
              />
            ))}
          {items && (
            <div className="server-pagination" aria-label="Work intake pages">
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!items.page?.previous}
                  onClick={() =>
                    setCursor({ before: items.page?.previous || undefined })
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  disabled={!items.page?.next}
                  onClick={() =>
                    setCursor({ after: items.page?.next || undefined })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          {createOpen && (
            <IntakeCreateDialog
              providerId={providerId}
              close={() => setCreateOpen(false)}
              saved={(record) => void saved(record)}
            />
          )}
        </>
      )}
    </section>
  );
}

function IntakeCreateDialog({
  providerId,
  close,
  saved,
}: {
  providerId: string;
  close: () => void;
  saved: (record: Resource<WorkIntakeAttributes>) => void;
}) {
  const [form, setForm] = useState({
    source: "",
    work_type: "",
    title: "",
    requester_name: "",
    requester_contact_reference: "",
    site_summary: "",
    description: "",
    referral_contact_name: "",
    referral_contact_number: "",
    referral_contact_email: "",
    referral_contact_role: "",
    referral_details: "",
    unit_count: "",
    unit_stops: "",
    unit_capacity: "",
    unit_type: "PASSENGER_TRACTION",
  });
  const [requirementCatalogue, setRequirementCatalogue] =
    useState<RequirementCatalogue | null>(null);
  const [step, setStep] = useState(1);
  const [assetQuery, setAssetQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locations, setLocations] =
    useState<Collection<GenericAttributes> | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [coordinates, setCoordinates] = useState({
    latitude: "",
    longitude: "",
    accuracy: "",
    source: "",
    capturedAt: "",
  });
  const [geoStatus, setGeoStatus] = useState("");
  const [matches, setMatches] = useState<WorkIntakeMatch[]>([]);
  const [matchChecked, setMatchChecked] = useState(false);
  const [selection, setSelection] = useState<WorkIntakeMatch | null>(null);
  const [relationshipReason, setRelationshipReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void operationsData
      .elevatorRequirementCatalogue(providerId)
      .then(setRequirementCatalogue)
      .catch(() => setRequirementCatalogue(null));
  }, [providerId]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      operationsData
        .locations(providerId, undefined, { query: locationQuery, limit: 20 })
        .then((result) => {
          if (active) setLocations(result);
        })
        .catch(() => {
          if (active) setLocations(null);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [providerId, locationQuery]);
  async function checkMatches() {
    setBusy(true);
    setError("");
    try {
      const result = await operationsData.providerWorkIntakeMatches(
        providerId,
        {
          title: form.title,
          site_summary: form.site_summary,
          asset_query: assetQuery || undefined,
        },
      );
      setMatches(result.data);
      setMatchChecked(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { ...form };
      const unitCount = Number(form.unit_count);
      if (unitCount > 0 || form.unit_stops || form.unit_capacity) {
        body.requirements = {
          business_operation_code: "ELEVATOR_SERVICES",
          profile_mode: "PER_UNIT",
          units: Array.from(
            { length: Math.max(1, unitCount || 1) },
            (_, index) => ({
              unit_key: `UNIT-${index + 1}`,
              label: `Unit ${index + 1}`,
              equipment_type_code: form.unit_type || undefined,
              stops: form.unit_stops ? Number(form.unit_stops) : undefined,
              capacity_kg: form.unit_capacity
                ? Number(form.unit_capacity)
                : undefined,
            }),
          ),
        };
      }
      delete body.unit_count;
      delete body.unit_stops;
      delete body.unit_capacity;
      delete body.unit_type;
      if (selectedLocationId) body.service_location_id = selectedLocationId;
      if (coordinates.latitude || coordinates.longitude) {
        body.site_latitude = Number(coordinates.latitude);
        body.site_longitude = Number(coordinates.longitude);
        body.site_coordinate_accuracy_m = coordinates.accuracy
          ? Number(coordinates.accuracy)
          : undefined;
        body.site_coordinate_source = coordinates.source || "MANUAL";
        body.site_coordinates_captured_at =
          coordinates.capturedAt || new Date().toISOString();
      }
      if (selection?.kind === "ASSET") body.asset_id = selection.id;
      if (selection?.kind === "PROJECT") body.project_id = selection.id;
      if (selection) body.relationship_decision_reason = relationshipReason;
      saved(
        await operationsData.createProviderWorkIntake(
          providerId,
          body,
          newKey(),
        ),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const coordinatesComplete =
    (!coordinates.latitude && !coordinates.longitude) ||
    (coordinates.latitude !== "" && coordinates.longitude !== "");
  const referralComplete =
    form.source !== "REFERRAL" ||
    (form.referral_contact_name.trim().length > 0 &&
      form.referral_contact_number.trim().length > 0);
  const requirementsComplete =
    (!form.unit_count && !form.unit_stops && !form.unit_capacity) ||
    (Number(form.unit_count) > 0 &&
      Number(form.unit_stops) > 0 &&
      Number(form.unit_capacity) > 0 &&
      Boolean(form.unit_type));
  const ready = Boolean(
    form.source &&
    form.work_type &&
    form.title.trim().length > 0 &&
    coordinatesComplete &&
    referralComplete &&
    requirementsComplete &&
    (!selection || relationshipReason.trim().length >= 3),
  );
  const stepReady =
    step === 1
      ? Boolean(form.source && form.work_type && form.title.trim())
      : step === 2
        ? referralComplete
        : step === 3
          ? coordinatesComplete
          : ready;
  function captureCoordinates() {
    if (!navigator.geolocation) {
      setGeoStatus(
        "Browser location is not available. Enter coordinates manually.",
      );
      return;
    }
    setGeoStatus("Requesting current device location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
          accuracy: position.coords.accuracy
            ? position.coords.accuracy.toFixed(2)
            : "",
          source: "BROWSER_GEOLOCATION",
          capturedAt: new Date().toISOString(),
        });
        setGeoStatus("Current coordinates captured.");
      },
      () =>
        setGeoStatus(
          "Location permission was not granted. Enter coordinates manually.",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <OperationsDialog title="Create Work Intake" busy={busy} onClose={close}>
      <form
        className="provider-form provider-work-intake-form provider-work-intake-wizard"
        onSubmit={(event) => void submit(event)}
      >
        <div className="provider-work-intake-wizard-intro">
          <div>
            <strong>Capture a new request in four simple steps</strong>
            <p>
              Only the information needed for the current step is shown. You can
              go back without losing your entries.
            </p>
          </div>
          <span>Provider-scoped</span>
        </div>
        <ol
          className="provider-work-intake-steps"
          aria-label="Create intake steps"
        >
          {["Basics", "Requester", "Site", "Review"].map((title, index) => (
            <li
              key={title}
              className={
                step === index + 1
                  ? "current"
                  : step > index + 1
                    ? "complete"
                    : ""
              }
            >
              <span>{index + 1}</span>
              <strong>{title}</strong>
            </li>
          ))}
        </ol>
        {step === 1 && (
          <section className="provider-work-intake-step-panel">
            <div className="provider-work-intake-step-heading">
              <span>Step 1 of 4</span>
              <h3>Start with the work request</h3>
              <p>
                Choose where the request came from and what kind of work is
                needed.
              </p>
            </div>
            <div className="provider-work-intake-form-grid">
              <label>
                Work source *
                <select
                  required
                  value={form.source}
                  onChange={(event) =>
                    setForm({ ...form, source: event.target.value })
                  }
                >
                  <option value="">Choose source</option>
                  {SOURCES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Work type *
                <select
                  required
                  value={form.work_type}
                  onChange={(event) =>
                    setForm({ ...form, work_type: event.target.value })
                  }
                >
                  <option value="">Choose work type</option>
                  {WORK_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Work title *
                <input
                  required
                  autoFocus
                  maxLength={200}
                  placeholder="Example: PG Building lift installation"
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                Site or project name
                <input
                  maxLength={240}
                  placeholder="Example: PG Building, Bengaluru"
                  value={form.site_summary}
                  onChange={(event) =>
                    setForm({ ...form, site_summary: event.target.value })
                  }
                />
              </label>
              <section className="provider-work-intake-form-section wide">
                <div>
                  <h3>
                    Initial elevator requirements <small>(optional)</small>
                  </h3>
                  <p>
                    Capture the known unit scope once. The Lead and Survey forms
                    will continue from this canonical draft; unknown fields can
                    be completed later.
                  </p>
                </div>
                <div className="provider-work-intake-form-grid">
                  <label>
                    Unit count
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={form.unit_count}
                      onChange={(event) =>
                        setForm({ ...form, unit_count: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Stops / floors
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={form.unit_stops}
                      onChange={(event) =>
                        setForm({ ...form, unit_stops: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Capacity (kg)
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={form.unit_capacity}
                      onChange={(event) =>
                        setForm({ ...form, unit_capacity: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Equipment type
                    <select
                      value={form.unit_type}
                      onChange={(event) =>
                        setForm({ ...form, unit_type: event.target.value })
                      }
                    >
                      <option value="">Select from catalogue</option>
                      {(
                        requirementCatalogue?.groups.find(
                          (group) => group.code === "EQUIPMENT_TYPE",
                        )?.options || []
                      ).map((option) => (
                        <option value={option.code} key={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {!requirementsComplete && (
                  <small className="provider-work-intake-inline-error">
                    Enter unit count, stops and capacity together, or leave the
                    initial requirements blank.
                  </small>
                )}
              </section>
            </div>
          </section>
        )}
        {step === 2 && (
          <section className="provider-work-intake-step-panel">
            <div className="provider-work-intake-step-heading">
              <span>Step 2 of 4</span>
              <h3>Who requested this work?</h3>
              <p>
                Add the requester. Referral name and phone are required when the
                source is Referral.
              </p>
            </div>
            <div className="provider-work-intake-form-grid">
              <label>
                Requester name
                <input
                  autoFocus
                  maxLength={160}
                  value={form.requester_name}
                  onChange={(event) =>
                    setForm({ ...form, requester_name: event.target.value })
                  }
                />
              </label>
              <label>
                Contact reference
                <input
                  maxLength={200}
                  value={form.requester_contact_reference}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      requester_contact_reference: event.target.value,
                    })
                  }
                />
              </label>
              {form.source === "REFERRAL" && (
                <section className="provider-work-intake-form-section wide">
                  <div>
                    <h3>Referral contact</h3>
                    <p>
                      The contact number is the primary tracking reference for
                      this referral.
                    </p>
                  </div>
                  <div className="provider-work-intake-form-grid">
                    <label>
                      Referral contact name *
                      <input
                        required
                        maxLength={160}
                        value={form.referral_contact_name}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            referral_contact_name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Primary referral contact number *
                      <input
                        required
                        maxLength={40}
                        inputMode="tel"
                        placeholder="+91 98765 43210"
                        value={form.referral_contact_number}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            referral_contact_number: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Referral email
                      <input
                        type="email"
                        maxLength={254}
                        value={form.referral_contact_email}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            referral_contact_email: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Referral relationship / role
                      <select
                        value={form.referral_contact_role}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            referral_contact_role: event.target.value,
                          })
                        }
                      >
                        <option value="">Select relationship or role</option>
                        {REFERRAL_ROLES.map((role) => (
                          <option value={role} key={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wide">
                      Referral notes
                      <textarea
                        rows={2}
                        maxLength={5000}
                        value={form.referral_details}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            referral_details: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              )}
              <label className="wide">
                Request notes
                <textarea
                  rows={4}
                  maxLength={5000}
                  placeholder="What did the requester ask for?"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>
            </div>
          </section>
        )}
        {step === 3 && (
          <section className="provider-work-intake-step-panel">
            <div className="provider-work-intake-step-heading">
              <span>Step 3 of 4</span>
              <h3>Confirm the site</h3>
              <p>
                Link an authorized service location or capture the coordinates
                observed at intake. This snapshot will not overwrite the
                canonical site.
              </p>
            </div>
            <div className="provider-work-intake-form-grid">
              <label className="wide">
                Search authorized service locations
                <input
                  autoFocus
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Search site name or address"
                />
              </label>
              <label className="wide">
                Linked service location
                <select
                  value={selectedLocationId}
                  onChange={(event) =>
                    setSelectedLocationId(event.target.value)
                  }
                >
                  <option value="">No existing site selected</option>
                  {locations?.data.map((location) => (
                    <option key={location.id} value={location.id}>
                      {locationLabel(location)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="provider-work-intake-location-actions wide">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={captureCoordinates}
                >
                  Use my current site location
                </Button>
                <span>
                  {geoStatus ||
                    "Location permission is requested only when you choose this action."}
                </span>
              </div>
              <div className="provider-work-intake-coordinate-grid wide">
                <label>
                  Latitude
                  <input
                    inputMode="decimal"
                    placeholder="e.g. 17.3850"
                    value={coordinates.latitude}
                    onChange={(event) =>
                      setCoordinates({
                        ...coordinates,
                        latitude: event.target.value,
                        source: "MANUAL",
                        capturedAt: new Date().toISOString(),
                      })
                    }
                  />
                </label>
                <label>
                  Longitude
                  <input
                    inputMode="decimal"
                    placeholder="e.g. 78.4867"
                    value={coordinates.longitude}
                    onChange={(event) =>
                      setCoordinates({
                        ...coordinates,
                        longitude: event.target.value,
                        source: "MANUAL",
                        capturedAt: new Date().toISOString(),
                      })
                    }
                  />
                </label>
                <label>
                  Accuracy (metres)
                  <input
                    inputMode="decimal"
                    placeholder="Optional"
                    value={coordinates.accuracy}
                    onChange={(event) =>
                      setCoordinates({
                        ...coordinates,
                        accuracy: event.target.value,
                        source: "MANUAL",
                        capturedAt: new Date().toISOString(),
                      })
                    }
                  />
                </label>
              </div>
              {!coordinatesComplete && (
                <small className="provider-work-intake-inline-error">
                  Enter both latitude and longitude, or clear both fields.
                </small>
              )}
            </div>
          </section>
        )}
        {step === 4 && (
          <section className="provider-work-intake-step-panel">
            <div className="provider-work-intake-step-heading">
              <span>Step 4 of 4</span>
              <h3>Review before creating</h3>
              <p>
                Possible matches are advisory. Nothing is linked automatically
                unless you explicitly select and explain a relationship.
              </p>
            </div>
            <div className="provider-work-intake-review-summary">
              <div>
                <span>Request</span>
                <strong>{form.title || "Not supplied"}</strong>
                <small>
                  {label(form.source)} · {label(form.work_type)}
                </small>
              </div>
              <div>
                <span>Requester</span>
                <strong>{form.requester_name || "Not supplied"}</strong>
                <small>
                  {form.source === "REFERRAL"
                    ? form.referral_contact_number || "Referral phone required"
                    : form.requester_contact_reference ||
                      "No contact reference"}
                </small>
              </div>
              <div>
                <span>Site</span>
                <strong>{form.site_summary || "Not specified"}</strong>
                <small>
                  {selectedLocationId
                    ? "Authorized location selected"
                    : coordinates.latitude && coordinates.longitude
                      ? "Coordinates captured"
                      : "No site link or coordinates"}
                </small>
              </div>
            </div>
            <label className="provider-work-intake-asset-lookup">
              Optional existing Asset or Project lookup
              <input
                value={assetQuery}
                onChange={(event) => setAssetQuery(event.target.value)}
                placeholder="Name, identifier, or provider-scoped ID"
              />
            </label>
            <div className="provider-work-intake-match-check">
              <Button
                type="button"
                variant="secondary"
                busy={busy}
                disabled={!form.title.trim() && !assetQuery.trim()}
                onClick={() => void checkMatches()}
              >
                Check possible matches
              </Button>
              <span>Searches are provider-scoped warnings only.</span>
            </div>
            {matchChecked && (
              <section
                className="provider-work-intake-candidates"
                aria-label="Possible related records"
              >
                <h3>Provider-scoped suggestions</h3>
                {matches.length ? (
                  matches.map((match) => (
                    <article
                      key={`${match.kind}-${match.id}`}
                      className={selection?.id === match.id ? "selected" : ""}
                    >
                      <div>
                        <Status>{match.confidence}</Status>
                        <strong>{match.label}</strong>
                        <small>{match.reason}</small>
                      </div>
                      {["ASSET", "PROJECT"].includes(match.kind) && (
                        <Button
                          type="button"
                          variant={
                            selection?.id === match.id ? "primary" : "secondary"
                          }
                          onClick={() =>
                            setSelection(
                              selection?.id === match.id ? null : match,
                            )
                          }
                        >
                          {selection?.id === match.id
                            ? "Selected"
                            : "Select relationship"}
                        </Button>
                      )}
                    </article>
                  ))
                ) : (
                  <p>
                    No matching Asset or Project was found. You can continue; an
                    assessment task will be created.
                  </p>
                )}
              </section>
            )}
            {selection && (
              <label>
                Reason for selecting this {selection.kind.toLowerCase()} *
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  value={relationshipReason}
                  onChange={(event) =>
                    setRelationshipReason(event.target.value)
                  }
                />
              </label>
            )}
          </section>
        )}
        {error && (
          <div role="alert" className="provider-work-intake-error">
            {error}
          </div>
        )}
        <div className="provider-form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => (step === 1 ? close() : setStep(step - 1))}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              disabled={!stepReady}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" busy={busy} disabled={!ready}>
              Create intake
            </Button>
          )}
        </div>
      </form>
    </OperationsDialog>
  );
}

function IntakeDetail({
  providerId,
  id,
  canEdit,
  canAssign,
  back,
  onHeaderActions,
  changed,
}: {
  providerId: string;
  id: string;
  canEdit: boolean;
  canAssign: boolean;
  back: () => void;
  onHeaderActions: (actions: ReactNode) => void;
  changed: (message: string) => Promise<void>;
}) {
  const { session } = useAuth();
  const [item, setItem] = useState<Resource<WorkIntakeAttributes> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationCandidate, setLocationCandidate] =
    useState<LocationCandidate | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [journey, setJourney] = useState<ProviderWorkJourney | null>(null);
  const [assignmentCandidates, setAssignmentCandidates] = useState<
    AssignmentCandidate[]
  >([]);
  const [assignmentKind, setAssignmentKind] = useState("QUALIFICATION");
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [routeSelection, setRouteSelection] = useState("");
  const [routeReason, setRouteReason] = useState("");
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [takeOverBusy, setTakeOverBusy] = useState(false);
  const [assessment, setAssessment] = useState({
    current_state_assessment: "",
    remaining_scope_assessment: "",
    responsibility_boundary: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
  const [abandonPaymentDisposition, setAbandonPaymentDisposition] =
    useState("NO_REFUND_DUE");
  const [abandonBusy, setAbandonBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    requester_name: "",
    requester_contact_reference: "",
    site_summary: "",
    referral_contact_name: "",
    referral_contact_number: "",
    referral_contact_email: "",
    referral_contact_role: "",
    referral_details: "",
    unit_count: "",
    unit_stops: "",
    unit_capacity: "",
    unit_type: "",
  });
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [requirementsBusy, setRequirementsBusy] = useState(false);
  const [requirementsError, setRequirementsError] = useState("");
  const [requirementsForm, setRequirementsForm] = useState({
    unit_count: "",
    unit_stops: "",
    unit_capacity: "",
    unit_type: "PASSENGER_TRACTION",
  });
  const [requirementCatalogue, setRequirementCatalogue] =
    useState<RequirementCatalogue | null>(null);
  const [activeDetailStep, setActiveDetailStep] =
    useState<IntakeStep>("RELATIONSHIP");
  const load = useCallback(
    () =>
      operationsData.genericDetail(
        providerId,
        `/provider-work-intakes/${encodeURIComponent(id)}`,
      ) as Promise<Resource<WorkIntakeAttributes>>,
    [providerId, id],
  );
  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) {
          setItem(data);
          const loadedStep = intakeStep(data.attributes);
          setActiveDetailStep(
            loadedStep === "CLOSED"
              ? "RELATIONSHIP"
              : visibleIntakeStep(loadedStep),
          );
          setRouteSelection(
            data.attributes.workflow_route ||
              data.attributes.allowed_workflow_routes?.[0] ||
              "",
          );
          setAssessment({
            current_state_assessment:
              data.attributes.assessment_task.current_state || "",
            remaining_scope_assessment:
              data.attributes.assessment_task.remaining_scope || "",
            responsibility_boundary:
              data.attributes.assessment_task.responsibility_boundary || "",
          });
        }
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    void operationsData
      .providerWorkIntakeJourney(providerId, id)
      .then((value) => {
        if (active) setJourney(value);
      })
      .catch(() => {
        // The detail record remains usable when an older environment has no journey link yet.
      });
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(() => {
    void operationsData
      .elevatorRequirementCatalogue(providerId)
      .then(setRequirementCatalogue)
      .catch(() => setRequirementCatalogue(null));
  }, [providerId]);
  function focusWorkflowStep(record: Resource<WorkIntakeAttributes>) {
    const nextStep = intakeStep(record.attributes);
    setActiveDetailStep(
      nextStep === "CLOSED" ? "RELATIONSHIP" : visibleIntakeStep(nextStep),
    );
  }
  const openEdit = useCallback(() => {
    if (!item || !canEdit) return;
    const current = item.attributes;
    const firstUnit = current.requirement_scope?.units?.[0] || {};
    setEditForm({
      title: current.title || "",
      description: current.description || "",
      requester_name: current.requester_name || "",
      requester_contact_reference: current.requester_contact_reference || "",
      site_summary: current.site_summary || "",
      referral_contact_name: current.referral_contact?.name || "",
      referral_contact_number: current.referral_contact?.number || "",
      referral_contact_email: current.referral_contact?.email || "",
      referral_contact_role: current.referral_contact?.role || "",
      referral_details: current.referral_contact?.details || "",
      unit_count: String(
        current.requirement_scope?.units?.length ||
          current.requirements?.quantity ||
          "",
      ),
      unit_stops: String(firstUnit.stops || current.requirements?.stops || ""),
      unit_capacity: String(
        firstUnit.capacity_kg || current.requirements?.capacity_kg || "",
      ),
      unit_type: String(
        firstUnit.equipment_type_code ||
          firstUnit.type ||
          current.requirements?.equipment_type_code ||
          "",
      ),
    });
    setEditError("");
    setEditOpen(true);
  }, [canEdit, item]);
  const openRequirements = useCallback(() => {
    if (
      !item ||
      !canEdit ||
      item.attributes.status === "CLOSED" ||
      item.attributes.journey_stage_status === "COMPLETED" ||
      item.attributes.journey_status === "CANCELLED"
    )
      return;
    const current = item.attributes;
    const firstUnit = current.requirement_scope?.units?.[0] || {};
    setRequirementsForm({
      unit_count: String(
        current.requirement_scope?.units?.length ||
          current.requirements?.quantity ||
          "",
      ),
      unit_stops: String(firstUnit.stops || current.requirements?.stops || ""),
      unit_capacity: String(
        firstUnit.capacity_kg || current.requirements?.capacity_kg || "",
      ),
      unit_type: String(
        firstUnit.equipment_type_code ||
          firstUnit.type ||
          current.requirements?.equipment_type_code ||
          "PASSENGER_TRACTION",
      ),
    });
    setRequirementsError("");
    setRequirementsOpen(true);
  }, [canEdit, item]);
  async function saveRequirements(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    const unitCount = Number(requirementsForm.unit_count);
    const stops = Number(requirementsForm.unit_stops);
    const capacity = Number(requirementsForm.unit_capacity);
    if (!Number.isInteger(unitCount) || unitCount < 1 || unitCount > 50) {
      setRequirementsError("Enter a unit count between 1 and 50.");
      return;
    }
    if (!Number.isInteger(stops) || stops < 1 || stops > 300) {
      setRequirementsError("Enter stops / floors between 1 and 300.");
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
      setRequirementsError("Enter capacity between 1 and 10,000 kg.");
      return;
    }
    if (!requirementsForm.unit_type) {
      setRequirementsError("Select the equipment type.");
      return;
    }
    setRequirementsBusy(true);
    setRequirementsError("");
    try {
      const response = await operationsData.updateProviderWorkIntake(
        providerId,
        id,
        {
          requirements: {
            ...(item.attributes.requirements || {}),
            business_operation_code: "ELEVATOR_SERVICES",
            profile_mode: "PER_UNIT",
            units: Array.from({ length: unitCount }, (_, index) => ({
              unit_key: `UNIT-${index + 1}`,
              label: `Unit ${index + 1}`,
              equipment_type_code: requirementsForm.unit_type,
              stops,
              capacity_kg: capacity,
            })),
          },
          expected_revision: item.attributes.revision,
        },
        newKey(),
      );
      setItem(response);
      setRequirementsOpen(false);
      await changed(
        "Requirements captured. Lead, Survey, and Quotation will use this same canonical scope.",
      );
    } catch (cause) {
      setRequirementsError(errorMessage(cause));
    } finally {
      setRequirementsBusy(false);
    }
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!item || !editForm.title.trim()) {
      setEditError("Work title is required.");
      return;
    }
    if (
      attributes.source === "REFERRAL" &&
      (!editForm.referral_contact_name.trim() ||
        !editForm.referral_contact_number.trim())
    ) {
      setEditError("Referral contact name and phone are required.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      const payload: Record<string, unknown> = {
        ...editForm,
        expected_revision: item.attributes.revision,
      };
      const unitCount = Number(editForm.unit_count);
      if (
        editForm.unit_count ||
        editForm.unit_stops ||
        editForm.unit_capacity ||
        editForm.unit_type
      ) {
        payload.requirements = {
          ...(item.attributes.requirements || {}),
          business_operation_code: "ELEVATOR_SERVICES",
          profile_mode: "PER_UNIT",
          units: Array.from(
            { length: Math.max(1, unitCount || 1) },
            (_, index) => ({
              unit_key: `UNIT-${index + 1}`,
              label: `Unit ${index + 1}`,
              equipment_type_code: editForm.unit_type || undefined,
              stops: editForm.unit_stops
                ? Number(editForm.unit_stops)
                : undefined,
              capacity_kg: editForm.unit_capacity
                ? Number(editForm.unit_capacity)
                : undefined,
            }),
          ),
        };
      }
      delete payload.unit_count;
      delete payload.unit_stops;
      delete payload.unit_capacity;
      delete payload.unit_type;
      const response = await operationsData.updateProviderWorkIntake(
        providerId,
        id,
        payload,
        newKey(),
      );
      setItem(response);
      setEditOpen(false);
      await changed("Work Intake details and audit record were updated.");
    } catch (cause) {
      setEditError(errorMessage(cause));
    } finally {
      setEditBusy(false);
    }
  }
  async function abandonJourney(event: FormEvent) {
    event.preventDefault();
    if (abandonReason.trim().length < 3) {
      setError("Enter a clear abandonment reason.");
      return;
    }
    setAbandonBusy(true);
    setError("");
    try {
      const result = await operationsData.abandonProviderWorkIntake(
        providerId,
        id,
        {
          reason: abandonReason.trim(),
          payment_disposition: abandonPaymentDisposition,
        },
        newKey(),
      );
      setJourney(result);
      setAbandonOpen(false);
      setAbandonReason("");
      setItem((current) =>
        current
          ? {
              ...current,
              attributes: {
                ...current.attributes,
                status: "CLOSED",
                journey_stage_status: "COMPLETED",
                journey_status: "CANCELLED",
                journey_status_label: "ABANDONED",
                journey_abandonment_reason:
                  result.attributes.abandonment_reason || abandonReason.trim(),
              },
            }
          : current,
      );
      await changed(
        "Journey abandoned. All downstream operations are now blocked and the audit record was saved.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setAbandonBusy(false);
    }
  }

  useEffect(() => {
    if (!canAssign) return;
    let active = true;
    void accessData
      .assignmentCandidates(providerId, { limit: 100 })
      .then((result) => {
        if (!active) return;
        setAssignmentCandidates(
          result.data.filter(
            (candidate, index, candidates) =>
              index ===
              candidates.findIndex(
                (item) =>
                  item.attributes.user_id === candidate.attributes.user_id,
              ),
          ),
        );
        setAssignmentUserId(
          (current) => current || item?.attributes.assigned_to_user_id || "",
        );
      })
      .catch((cause) => {
        if (active) setAssignmentError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [canAssign, providerId, item?.attributes.assigned_to_user_id]);
  async function decide(
    action: "REVIEW" | "DISMISS" | "CONFIRM",
    match: WorkIntakeMatch,
  ) {
    if (!item || reason.trim().length < 3) {
      setError("Enter a short reason before recording this match decision.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response =
        await operationsData.decideProviderWorkIntakeRelationship(
          providerId,
          id,
          {
            action,
            candidate_kind: match.kind,
            candidate_id: match.id,
            reason,
            expected_revision: item.attributes.revision,
          },
          newKey(),
        );
      setItem(response);
      focusWorkflowStep(response);
      setReason("");
      setDecision(`${label(action)} decision recorded for ${label(match.kind)}.`);
      await changed("Relationship decision and audit event were saved.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveAssessment(status: string) {
    if (!item) return;
    if (
      status === "COMPLETED" &&
      ["MODIFICATION", "TAKEOVER"].includes(item.attributes.work_type) &&
      Object.values(assessment).some((value) => !value.trim())
    ) {
      setError(
        "Complete current state, remaining scope, and responsibility boundary before completing this assessment.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await operationsData.updateProviderWorkIntakeAssessment(
        providerId,
        id,
        {
          ...assessment,
          status,
          expected_revision: item.attributes.revision,
          reason: reason || "Assessment reviewed by provider user",
        },
        newKey(),
      );
      setItem(response);
      focusWorkflowStep(response);
      await changed(`Assessment task marked ${label(status)}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveAssignment() {
    if (!item) return;
    if (!assignmentUserId) {
      setAssignmentError(
        "Select a provider team member before saving the assignment.",
      );
      return;
    }
    if (assignmentReason.trim().length < 3) {
      setAssignmentError(
        "Add a short reason so the assignment history is clear.",
      );
      return;
    }
    setAssignmentBusy(true);
    setAssignmentError("");
    try {
      const response = await operationsData.assignProviderWorkIntake(
        providerId,
        id,
        {
          assigned_to_user_id: assignmentUserId,
          assignment_kind: assignmentKind,
          reason: assignmentReason.trim(),
          expected_revision: item.attributes.revision,
        },
        newKey(),
      );
      setItem(response);
      focusWorkflowStep(response);
      setAssignmentReason("");
      await changed(
        "Assignment saved. The selected provider team member was notified.",
      );
    } catch (cause) {
      setAssignmentError(errorMessage(cause));
    } finally {
      setAssignmentBusy(false);
    }
  }
  async function takeOver() {
    if (!item) return;
    setTakeOverBusy(true);
    setError("");
    try {
      const response = await operationsData.takeOverProviderWorkIntake(
        providerId,
        id,
        item.attributes.revision,
        newKey(),
      );
      setItem(response);
      focusWorkflowStep(response);
      await changed(
        "You accepted this intake and the assessment is now in progress.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setTakeOverBusy(false);
    }
  }
  async function saveRouteDecision() {
    if (!item) return;
    if (!routeSelection) {
      setRouteError("Select the downstream workflow before saving.");
      return;
    }
    if (routeReason.trim().length < 3) {
      setRouteError("Add a short reason so the route decision is auditable.");
      return;
    }
    setRouteBusy(true);
    setRouteError("");
    try {
      const response = await operationsData.decideProviderWorkIntakeRoute(
        providerId,
        id,
        {
          workflow_route: routeSelection,
          reason: routeReason.trim(),
          expected_revision: item.attributes.revision,
        },
        newKey(),
      );
      setItem(response);
      focusWorkflowStep(response);
      setRouteReason("");
      await changed(`Downstream route set to ${label(routeSelection)}.`);
    } catch (cause) {
      setRouteError(errorMessage(cause));
    } finally {
      setRouteBusy(false);
    }
  }
  function captureCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Browser location is not available.");
      return;
    }
    setLocationMessage("Requesting current device location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationCandidate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
        setLocationMessage(
          "Location captured. Review the coordinates before saving.",
        );
      },
      () =>
        setLocationMessage(
          "Location permission was not granted. Enter coordinates manually during intake.",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  async function confirmCurrentLocation() {
    if (!locationCandidate || !item) return;
    setLocationBusy(true);
    setLocationMessage("Saving the confirmed site location…");
    try {
      const response = await operationsData.updateProviderWorkIntake(
        providerId,
        id,
        {
          site_latitude: locationCandidate.latitude,
          site_longitude: locationCandidate.longitude,
          site_coordinate_accuracy_m: locationCandidate.accuracy || undefined,
          site_coordinate_source: "BROWSER_GEOLOCATION",
          site_coordinates_captured_at: locationCandidate.capturedAt,
          expected_revision: item.attributes.revision,
        },
        newKey(),
      );
      setItem(response);
      setLocationCandidate(null);
      setLocationMessage("Current site location saved.");
      await changed("Current site coordinates and audit record were saved.");
    } catch (cause) {
      setLocationMessage(errorMessage(cause));
    } finally {
      setLocationBusy(false);
    }
  }
  const openActivity = useCallback(() => {
    setActivityOpen(true);
    if (journey || activityBusy) return;
    setActivityBusy(true);
    setActivityError("");
    void operationsData
      .providerWorkIntakeJourney(providerId, id)
      .then(setJourney)
      .catch((cause) => setActivityError(errorMessage(cause)))
      .finally(() => setActivityBusy(false));
  }, [activityBusy, id, journey, providerId]);
  const openFollowUps = useCallback(() => {
    setFollowUpOpen(true);
    if (journey || activityBusy) return;
    setActivityBusy(true);
    setActivityError("");
    void operationsData
      .providerWorkIntakeJourney(providerId, id)
      .then(setJourney)
      .catch((cause) => setActivityError(errorMessage(cause)))
      .finally(() => setActivityBusy(false));
  }, [activityBusy, id, journey, providerId]);
  useEffect(() => {
    if (!item) {
      onHeaderActions(null);
      return;
    }
    const workflowConcluded =
      item.attributes.status === "CLOSED" ||
      item.attributes.journey_stage_status === "COMPLETED" ||
      item.attributes.journey_status === "CANCELLED";
    onHeaderActions(
      <div
        className="provider-work-intake-header-actions"
        aria-label="Work Intake actions"
      >
        <Button variant="secondary" className="workflow-back-action" onClick={back} title="Back to Work Intake list">
          <SvgIcon name="arrow-left" size={15} /> Back
        </Button>
        {canEdit && !workflowConcluded && (
          <Button
            type="button"
            variant="danger"
            className="workflow-abandon-action"
            onClick={() => setAbandonOpen(true)}
          >
            <SvgIcon name="x" size={15} /> Stop
          </Button>
        )}
        <WorkflowFollowUpAction
          providerId={providerId}
          journeyId={journey?.id}
          targetResourceKind="ProviderWorkIntake"
          targetResourceId={id}
          onClick={openFollowUps}
        />
        <Button type="button" variant="secondary" className="workflow-timeline-action" onClick={openActivity} title="View timeline and audit history">
          <SvgIcon name="activity" size={15} /> Timeline
        </Button>
        <WorkflowChainAction
          journey={journey}
          currentResourceKind="ProviderWorkIntake"
          currentResourceId={id}
        />
      </div>,
    );
    return () => onHeaderActions(null);
  }, [back, canEdit, id, item, journey, onHeaderActions, openActivity, openFollowUps]);
  if (!item)
    return (
      <div>
        {error ? (
          <div className="provider-work-intake-error" role="alert">
            {error}
          </div>
        ) : (
          <p className="notice">Loading provider-scoped intake…</p>
        )}
        <Button variant="secondary" onClick={back}>
          Back to Work Intake
        </Button>
      </div>
    );
  const attributes = item.attributes;
  const requirementScope = attributes.requirement_scope;
  const requirementUnits = requirementScope?.units || [];
  const workflowConcluded =
    attributes.status === "CLOSED" ||
    attributes.journey_stage_status === "COMPLETED" ||
    attributes.journey_status === "CANCELLED";
  canEdit = canEdit && !workflowConcluded;
  const recommended = nextAction(attributes);
  const step = intakeStep(attributes);
  const steps: Array<{ key: IntakeStep; title: string }> = [
    { key: "RELATIONSHIP", title: "Relationship" },
    { key: "REQUIREMENTS", title: "Requirements" },
    { key: "ASSETS", title: "Assets & documents" },
    { key: "ASSESSMENT", title: "Owner & assessment" },
    { key: "HANDOFF", title: "Handoff" },
  ];
  const workflowStep: IntakeStep | null =
    step === "CLOSED" ? null : visibleIntakeStep(step);
  const stepIndex = Math.max(
    0,
    steps.findIndex((entry) => entry.key === workflowStep),
  );
  const leadLinked = Boolean(item.relationships.marketing_lead);
  const showAssignment =
    canAssign &&
    !workflowConcluded &&
    !leadLinked &&
    attributes.status !== "CLOSED" &&
    attributes.assessment_task.status !== "COMPLETED";
  const ownerIsCurrentUser = Boolean(
    session?.userId && attributes.assigned_to_user_id === session.userId,
  );
  const canTakeOver =
    canEdit &&
    ownerIsCurrentUser &&
    attributes.status === "OPEN" &&
    attributes.assessment_task.status === "OPEN";
  const assessmentActorCanEdit =
    canEdit &&
    ownerIsCurrentUser &&
    attributes.assessment_task.status === "IN_PROGRESS";
  const showRoute =
    canEdit &&
    attributes.status !== "CLOSED" &&
    attributes.assessment_task.status === "COMPLETED" &&
    step === "HANDOFF";
  const equipmentTypeOptions =
    requirementCatalogue?.groups.find(
      (group) => group.code === "EQUIPMENT_TYPE",
    )?.options || DEFAULT_ELEVATOR_EQUIPMENT_TYPES;
  return (
    <div className="provider-work-intake-detail">
      <div className="provider-work-intake-detail-heading">
        <div className="provider-work-intake-record">
          <div className="provider-work-intake-record-summary">
            <Status>
              {attributes.journey_status_label === "ABANDONED"
                ? "ABANDONED"
                : label(attributes.status)}
            </Status>
            <h2>{attributes.title}</h2>
            <p>
              {attributes.reference_code} · {label(attributes.source)} ·{" "}
              {label(attributes.work_type)}
            </p>
            {attributes.journey_status_label === "ABANDONED" && (
              <small className="workflow-concluded-label">
                Journey abandoned
                {attributes.journey_abandonment_reason
                  ? ` · ${attributes.journey_abandonment_reason}`
                  : ""}
              </small>
            )}
          </div>
          <div className="provider-work-intake-current-step-inline">
            <span className="provider-work-intake-eyebrow">
              Current workflow step
            </span>
            <strong>{recommended}</strong>
            <small>{nextActionDescription(attributes, recommended)}</small>
          </div>
          {workflowConcluded && (
            <div
              className={`workflow-concluded-inline${attributes.journey_status_label === "ABANDONED" ? " workflow-concluded-inline--abandoned" : ""}`}
              role="status"
            >
              <span className="workflow-concluded-inline-icon" aria-hidden="true">
                <SvgIcon
                  name={attributes.journey_status_label === "ABANDONED" ? "x" : "shield"}
                  size={14}
                />
              </span>
              <span className="workflow-concluded-inline-copy">
                <strong>
                  {attributes.journey_status_label === "ABANDONED"
                    ? "Journey abandoned — read-only"
                    : "Workflow concluded — read-only"}
                </strong>
                <small>
                  {attributes.journey_status_label === "ABANDONED"
                    ? "No further updates or downstream actions are allowed."
                    : "Closed record retained. Continue in the linked downstream workflow."}
                </small>
              </span>
            </div>
          )}
        </div>
      </div>
      <ol
        className="provider-work-intake-progress workflow-detail-tabs"
        aria-label="Work Intake workflow sections"
      >
        {steps.map((entry, index) => (
          <li
            key={entry.key}
            className={`${activeDetailStep === entry.key ? "current" : ""} ${workflowStep === entry.key ? "workflow-current" : index < stepIndex ? "complete" : ""}`}
          >
            <button
              type="button"
              aria-current={activeDetailStep === entry.key ? "step" : undefined}
              onClick={() => setActiveDetailStep(entry.key)}
            >
              <span>{index + 1}</span>
              <strong>{entry.title}</strong>
              {workflowStep === entry.key && <small>Current</small>}
            </button>
          </li>
        ))}
      </ol>
      {activeDetailStep === "RELATIONSHIP" && (
        <>
          {attributes.relationship_status !== "CONFIRMED" && !leadLinked && (
            <div
              className={`provider-work-intake-warning ${attributes.relationship_status === "UNRESOLVED" && !attributes.match_suggestions.length ? "informational" : ""}`}
              role="status"
            >
              <strong>
                {attributes.match_suggestions.length
                  ? `Relationship ${label(attributes.relationship_status)}`
                  : "No existing record linked"}
              </strong>
              <p>
                {attributes.match_suggestions.length
                  ? "Potential matches are non-blocking. Review, dismiss or explicitly confirm a related Asset or Project."
                  : "This request can continue as new work. No relationship review is blocking the assessment."}
              </p>
            </div>
          )}
          {leadLinked && (
            <div
              className="provider-work-intake-warning informational"
              role="status"
            >
              <strong>Lead created and linked</strong>
              <p>
                The Lead owns the downstream qualification now. Work Intake
                evidence, referral details, location, and future updates remain
                available through the shared journey.
              </p>
            </div>
          )}
          {attributes.match_suggestions.length > 0 && (
            <section className="provider-work-intake-candidates provider-work-intake-detail-candidates">
              <h3>Suggested related records</h3>
              {attributes.match_suggestions.map((match) => (
                <article key={`${match.kind}-${match.id}`}>
                  <div>
                    <Status>{match.confidence}</Status>
                    <strong>{match.label}</strong>
                    <small>{match.reason}</small>
                  </div>
                  {canEdit && (
                    <div className="provider-work-intake-actions">
                      <label className="match-reason">
                        Decision reason
                        <input
                          aria-label={`Reason for ${match.label}`}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <Button
                        variant="secondary"
                        busy={busy}
                        onClick={() => void decide("REVIEW", match)}
                      >
                        Review
                      </Button>
                      <Button
                        variant="secondary"
                        busy={busy}
                        onClick={() => void decide("DISMISS", match)}
                      >
                        Dismiss
                      </Button>
                      {["ASSET", "PROJECT"].includes(match.kind) && (
                        <Button
                          busy={busy}
                          onClick={() => void decide("CONFIRM", match)}
                        >
                          Confirm link
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}
      {activeDetailStep === "REQUIREMENTS" && (
        <section
          className="provider-work-intake-requirements-workspace"
          aria-label="Work Intake requirements"
        >
          <div className="provider-work-intake-assessment-workspace-header">
            <div>
              <span className="provider-work-intake-eyebrow">
                Optional at Work Intake
              </span>
              <h3>Capture the initial elevator scope</h3>
              <p>
                You can capture requirements now or continue with the request
                and add them later. Before a quotation is submitted, the
                canonical requirement profile must be complete.
              </p>
            </div>
            <Status>
              {requirementUnits.length ? "Captured" : "Not captured"}
            </Status>
          </div>
          <div className="provider-work-intake-requirements-summary">
            <div>
              <span>Current source</span>
              <strong>
                {requirementScope?.source === "CANONICAL_REVISION"
                  ? `Revision ${requirementScope.revision_number || "current"}`
                  : "Work Intake draft"}
              </strong>
            </div>
            <div>
              <span>Unit profile</span>
              <strong>
                {requirementUnits.length
                  ? `${requirementUnits.length} unit${requirementUnits.length === 1 ? "" : "s"}`
                  : "Not recorded"}
              </strong>
            </div>
            <div>
              <span>Downstream rule</span>
              <strong>Required before quotation submission</strong>
            </div>
          </div>
          <div className="provider-work-intake-detail-grid provider-work-intake-detail-grid--single">
            <section>
              <div className="provider-work-intake-section-heading">
                <div>
                  <h3>Current requirement profile</h3>
                  <small>
                    One canonical scope reused by the downstream journey
                  </small>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Unit count</dt>
                  <dd>
                    {requirementUnits.length ||
                      attributes.requirements?.quantity ||
                      "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Units</dt>
                  <dd>
                    {requirementUnits.length
                      ? requirementUnits
                          .map(
                            (unit, index) =>
                              `${String(unit.label || `Unit ${index + 1}`)} · ${String(unit.equipment_type_code || unit.type || "Type not selected")} · ${String(unit.stops || "—")} stops · ${String(unit.capacity_kg || "—")} kg`,
                          )
                          .join(" · ")
                      : "No unit-level requirements captured yet"}
                  </dd>
                </div>
                <div>
                  <dt>Shared requirements</dt>
                  <dd>
                    {attributes.requirements
                      ? Object.entries(attributes.requirements)
                          .filter(
                            ([key]) =>
                              ![
                                "units",
                                "quantity",
                                "stops",
                                "capacity_kg",
                                "profile_mode",
                              ].includes(key),
                          )
                          .map(
                            ([key, value]) =>
                              `${label(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
                          )
                          .join(" · ") || "Partial scope only"
                      : "No shared requirements captured yet"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <div className="provider-work-intake-actions">
            <Button type="button" onClick={openRequirements}>
              <SvgIcon name="clipboard" size={15} />{" "}
              {requirementUnits.length
                ? "Update requirements"
                : "Capture requirements"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setActiveDetailStep("ASSETS")}
            >
              {requirementUnits.length ? "Continue to assets" : "Skip for now"}
            </Button>
          </div>
        </section>
      )}
      {decision && (
        <ActionFeedback>
          <span>{decision}</span>
          <button type="button" onClick={() => setDecision("")}>
            Dismiss
          </button>
        </ActionFeedback>
      )}
      {error && (
        <div role="alert" className="provider-work-intake-error">
          {error}
        </div>
      )}
      {activeDetailStep === "RELATIONSHIP" && (
        <div className="provider-work-intake-detail-grid provider-work-intake-detail-grid--single">
          <section>
            <div className="provider-work-intake-section-heading">
              <div>
                <h3>Request details</h3>
                <small>Relationship, site, and intake information</small>
              </div>
              {canEdit && (
                <Button type="button" variant="secondary" onClick={openEdit}>
                  <SvgIcon name="pencil" size={14} /> Edit intake details
                </Button>
              )}
            </div>
            <dl>
              <div>
                <dt>Requester</dt>
                <dd>{attributes.requester_name || "Not supplied"}</dd>
              </div>
              <div>
                <dt>Contact reference</dt>
                <dd>
                  {attributes.requester_contact_reference || "Not supplied"}
                </dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>{attributes.site_summary || "Not specified"}</dd>
              </div>
              {attributes.source === "REFERRAL" && (
                <div>
                  <dt>Referral contact</dt>
                  <dd>
                    <strong>
                      {attributes.referral_contact?.name || "Not supplied"}
                    </strong>
                    <br />
                    {attributes.referral_contact?.number ||
                      "No tracking number"}
                    {attributes.referral_contact?.role
                      ? ` · ${attributes.referral_contact.role}`
                      : ""}
                    {attributes.referral_contact?.email && (
                      <>
                        <br />
                        {attributes.referral_contact.email}
                      </>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>Coordinates</dt>
                <dd>
                  {attributes.site_coordinates?.latitude != null &&
                  attributes.site_coordinates.longitude != null
                    ? `${attributes.site_coordinates.latitude.toFixed(7)}, ${attributes.site_coordinates.longitude.toFixed(7)}${attributes.site_coordinates.accuracy_m != null ? ` · ±${attributes.site_coordinates.accuracy_m} m` : ""}`
                    : "Not captured"}
                </dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{attributes.description || "No description supplied."}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{attributes.revision}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
      {activeDetailStep === "ASSESSMENT" && (
        <section
          className="provider-work-intake-assignment-workspace"
          aria-label="Work Intake owner and assessment"
        >
          <div className="provider-work-intake-assessment-workspace-header">
            <div>
              <span className="provider-work-intake-eyebrow">Assign owner</span>
              <h3>Choose the person responsible for this intake</h3>
              <p>
                Managers and provider administrators select one team member.
                That person is notified and completes the work assessment in the
                next tab.
              </p>
            </div>
            <Status>
              {attributes.assigned_to ? "Assigned" : "Needs assignment"}
            </Status>
          </div>
          {showAssignment ? (
            <div className="provider-work-intake-assessment-block provider-work-intake-assignment-block">
              <div className="provider-work-intake-assessment-block-heading">
                <div>
                  <h4>Owner assignment</h4>
                  <small>
                    Assignment changes ownership only; it does not complete the
                    Work Intake.
                  </small>
                </div>
                <SvgIcon name="users" size={22} />
              </div>
              {assignmentError && (
                <div className="provider-work-intake-error" role="alert">
                  {assignmentError}
                </div>
              )}
              <div className="provider-work-intake-assignment-grid">
                <div className="provider-work-intake-current-assignee">
                  <span>Current intake owner</span>
                  <strong>
                    {attributes.assigned_to?.name || "Not assigned"}
                  </strong>
                  <small>
                    {attributes.assigned_to?.email ||
                      "Select a provider team member below"}
                  </small>
                  {attributes.assigned_to?.membership_context && (
                    <em>{label(attributes.assigned_to.membership_context)}</em>
                  )}
                </div>
                <label>
                  Assignment type
                  <select
                    value={assignmentKind}
                    onChange={(event) => setAssignmentKind(event.target.value)}
                  >
                    <option value="QUALIFICATION">
                      Qualification / intake review
                    </option>
                    <option value="SITE_SURVEY">Site survey</option>
                    <option value="TECHNICAL_ASSESSMENT">
                      Technical assessment
                    </option>
                    <option value="COMMERCIAL_FOLLOW_UP">
                      Commercial follow-up
                    </option>
                    <option value="INTAKE_OWNER">Overall intake owner</option>
                  </select>
                </label>
                <label>
                  Provider team member
                  <select
                    value={assignmentUserId}
                    onChange={(event) =>
                      setAssignmentUserId(event.target.value)
                    }
                    disabled={!assignmentCandidates.length}
                  >
                    <option value="">Select active team member</option>
                    {assignmentCandidates.map((candidate) => (
                      <option
                        value={candidate.attributes.user_id}
                        key={candidate.id}
                      >
                        {candidate.attributes.name ||
                          candidate.attributes.email ||
                          "Provider member"}{" "}
                        ·{" "}
                        {label(
                          candidate.attributes.membership_context ||
                            "Provider team",
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason
                  <input
                    value={assignmentReason}
                    maxLength={500}
                    onChange={(event) =>
                      setAssignmentReason(event.target.value)
                    }
                    placeholder="Why is this person taking the next action?"
                  />
                </label>
              </div>
              <div className="provider-work-intake-assignment-actions">
                <small>
                  {assignmentCandidates.length
                    ? `${assignmentCandidates.length} active provider team members available`
                    : "Loading active provider team members…"}
                </small>
                <Button
                  type="button"
                  busy={assignmentBusy}
                  disabled={!assignmentCandidates.length}
                  onClick={() => void saveAssignment()}
                >
                  Save assignment &amp; notify
                </Button>
              </div>
            </div>
          ) : (
            <div className="provider-work-intake-assignment-readonly">
              <strong>
                {attributes.assigned_to
                  ? `Assigned to ${transitionName(attributes.assigned_to)}`
                  : "Assignment is pending"}
              </strong>
              <span>
                {attributes.assigned_to
                  ? "Only an authorized manager or provider administrator can change the owner."
                  : "You do not have permission to assign this Work Intake. An authorized manager must assign it before assessment can begin."}
              </span>
            </div>
          )}
        </section>
      )}
      {activeDetailStep === "ASSESSMENT" && (
        <section
          className="provider-work-intake-assessment-workspace"
          aria-label="Assignee action"
        >
          <div className="provider-work-intake-assessment-workspace-header">
            <div>
              <span className="provider-work-intake-eyebrow">
                Work assessment
              </span>
              <h3>Complete the assigned work</h3>
              <p>
                {attributes.assigned_to
                  ? `Assigned to ${transitionName(attributes.assigned_to)}.`
                  : "No owner has been assigned yet."}{" "}
                {leadLinked
                  ? "The Lead is already linked; this intake carries the shared assessment context."
                  : "Only the selected owner completes this step before the intake moves to the next workflow."}
              </p>
            </div>
            <Status>{label(attributes.assessment_task.status)}</Status>
          </div>
          {canTakeOver && (
            <section
              className="provider-work-intake-takeover"
              aria-label="Owner acceptance"
            >
              <div>
                <span className="provider-work-intake-eyebrow">
                  Your next action
                </span>
                <h3>Accept this intake and start work</h3>
                <p>
                  This Work Intake is assigned to you. Accept it once to start
                  the assessment and record the owner handoff.
                </p>
              </div>
              <Button
                type="button"
                busy={takeOverBusy}
                onClick={() => void takeOver()}
              >
                Accept &amp; start work
              </Button>
            </section>
          )}
          {attributes.assessment_task.status === "OPEN" &&
            attributes.assigned_to &&
            !ownerIsCurrentUser && (
              <div className="provider-work-intake-owner-waiting" role="status">
                <strong>Waiting for owner acceptance</strong>
                <span>
                  {transitionName(attributes.assigned_to)} must take ownership
                  before the assessment can start.
                </span>
              </div>
            )}
          <div className="provider-work-intake-assessment-block provider-work-intake-assessment-details">
            <div className="provider-work-intake-assessment-block-heading">
              <div>
                <h4>Assessment details</h4>
                <small>
                  Capture the current condition, remaining scope, and
                  responsibility boundary when required.
                </small>
              </div>
            </div>
            {["MODIFICATION", "TAKEOVER"].includes(attributes.work_type) && (
              <div className="provider-work-intake-assessment-fields">
                <label>
                  Current condition and inherited work *
                  <textarea
                    rows={3}
                    maxLength={5000}
                    readOnly={!assessmentActorCanEdit}
                    value={assessment.current_state_assessment}
                    onChange={(event) =>
                      setAssessment({
                        ...assessment,
                        current_state_assessment: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Remaining scope *
                  <textarea
                    rows={3}
                    maxLength={5000}
                    readOnly={!assessmentActorCanEdit}
                    value={assessment.remaining_scope_assessment}
                    onChange={(event) =>
                      setAssessment({
                        ...assessment,
                        remaining_scope_assessment: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Provider responsibility boundary *
                  <textarea
                    rows={3}
                    maxLength={5000}
                    readOnly={!assessmentActorCanEdit}
                    value={assessment.responsibility_boundary}
                    onChange={(event) =>
                      setAssessment({
                        ...assessment,
                        responsibility_boundary: event.target.value,
                      })
                    }
                  />
                </label>
                {attributes.assessment_task.completed_at && (
                  <small>
                    Assessment completed ·{" "}
                    {new Date(
                      attributes.assessment_task.completed_at,
                    ).toLocaleString()}
                  </small>
                )}
              </div>
            )}
            {assessmentActorCanEdit && (
              <div className="provider-work-intake-actions">
                <Button
                  variant="secondary"
                  busy={busy}
                  onClick={() => void saveAssessment("COMPLETED")}
                >
                  Complete assessment
                </Button>
              </div>
            )}
            {!attributes.assigned_to && (
              <div className="provider-work-intake-owner-waiting" role="status">
                <strong>Owner required</strong>
                <span>
                  Open the Assign owner tab and select a team member before work
                  can begin.
                </span>
              </div>
            )}
          </div>
          {assessmentActorCanEdit && (
            <div className="provider-work-intake-assessment-block provider-work-intake-location-block">
              <div className="provider-work-intake-assessment-block-heading">
                <div>
                  <h4>
                    <SvgIcon name="map-pin" size={17} /> Site location
                  </h4>
                  <small>
                    Capture and confirm the current device coordinates for this
                    Work Intake.
                  </small>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  busy={locationBusy}
                  onClick={captureCurrentLocation}
                >
                  <SvgIcon name="map-pin" size={15} /> Use current site location
                </Button>
              </div>
              {locationMessage && (
                <small
                  className="provider-work-intake-location-message"
                  role="status"
                >
                  {locationMessage}
                </small>
              )}
            </div>
          )}
        </section>
      )}
      {activeDetailStep === "HANDOFF" &&
        (showRoute ? (
          <section
            className="provider-work-intake-route-card"
            aria-label="Downstream workflow route"
          >
            <div>
              <span className="provider-work-intake-eyebrow">
                Downstream workflow handoff
              </span>
              <h3>
                {attributes.workflow_route
                  ? "Confirm the next team"
                  : "Choose the next workflow"}
              </h3>
              <p>
                Assessment is complete. Confirming this route starts the
                downstream team’s queue; it does not bypass quotation, approval
                or dispatch controls.
              </p>
            </div>
            {routeError && (
              <div className="provider-work-intake-error" role="alert">
                {routeError}
              </div>
            )}
            <div className="provider-work-intake-route-grid">
              <div className="provider-work-intake-current-route">
                <span>Next team</span>
                <strong>
                  {attributes.downstream_team ||
                    routeTeamLabel(
                      routeSelection || attributes.allowed_workflow_routes?.[0],
                    )}
                </strong>
                <small>
                  {attributes.workflow_route_decision_reason ||
                    "The selected team will receive the downstream workflow after handoff."}
                </small>
              </div>
              {(attributes.allowed_workflow_routes || []).length > 1 ? (
                <label>
                  Next workflow
                  <select
                    value={routeSelection}
                    onChange={(event) => setRouteSelection(event.target.value)}
                  >
                    {(attributes.allowed_workflow_routes || []).map((route) => (
                      <option value={route} key={route}>
                        {label(route)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="provider-work-intake-route-fixed">
                  <span>Next workflow</span>
                  <strong>
                    {label(
                      attributes.allowed_workflow_routes?.[0] ||
                        "No route available",
                    )}
                  </strong>
                  <small>
                    {attributes.work_type === "NEW_INSTALLATION"
                      ? "New Installation always starts with Marketing / Sales as a Lead."
                      : "This is the only workflow authorized for this Work Intake type."}
                  </small>
                </div>
              )}
              <label>
                Decision reason
                <input
                  value={routeReason}
                  maxLength={500}
                  onChange={(event) => setRouteReason(event.target.value)}
                  placeholder="Why is this route appropriate?"
                />
              </label>
            </div>
            <div className="provider-work-intake-next-step-callout">
              <span
                className="provider-work-intake-next-step-icon"
                aria-hidden="true"
              >
                <SvgIcon name="arrow-right" size={20} />
              </span>
              <div>
                <span className="provider-work-intake-eyebrow">
                  Next required action
                </span>
                <strong>
                  {attributes.workflow_route
                    ? `Confirm handoff to ${label(routeSelection || attributes.workflow_route)}`
                    : routeSelection === "LEAD"
                      ? "Create Lead and hand off"
                      : `Send this intake to ${label(routeSelection || attributes.allowed_workflow_routes?.[0] || "the next workflow")}`}
                </strong>
                <small>
                  {attributes.workflow_route
                    ? "This closes the Work Intake and activates the selected downstream workflow."
                    : attributes.work_type === "NEW_INSTALLATION"
                      ? "This creates the Lead, closes the Work Intake, and starts the Sales & Survey journey."
                      : "The selected team will receive the next workflow record after handoff."}
                </small>
              </div>
              <Button
                type="button"
                className="provider-work-intake-next-step-button"
                busy={routeBusy}
                onClick={() => void saveRouteDecision()}
              >
                {attributes.workflow_route
                  ? "Confirm route & hand off"
                  : "Save route & hand off"}
              </Button>
            </div>
          </section>
        ) : (
          <section className="provider-work-intake-step-empty">
            <h3>Handoff is not ready yet</h3>
            <p>
              Complete the Work assessment step before selecting the downstream
              workflow. The allowed route will appear here when the backend
              marks the assessment complete.
            </p>
          </section>
        ))}
      {activeDetailStep === "ASSETS" && (
        <div className="provider-work-intake-evidence-stack">
          <ProviderDocumentsStep
            providerId={providerId}
            targetId={id}
            canUpload={canEdit}
            scope="intake"
            intakeType="photos"
            initialClassification="WORK_INTAKE_PHOTO"
            compactIntake
            assetCenter
            onChanged={() => void load().then(setItem)}
          />
        </div>
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
              Confirm that the current device is at the Work Intake site before
              saving these coordinates.
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
                <dd>{activityTime(locationCandidate.capturedAt)}</dd>
              </div>
            </dl>
            <small className="provider-work-intake-location-note">
              The address is not inferred from free text. The provider API
              stores the coordinates, accuracy, capture source, timestamp, and
              audit event.
            </small>
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
      {editOpen && (
        <OperationsDialog
          title="Edit Work Intake details"
          busy={editBusy}
          onClose={() => setEditOpen(false)}
        >
          <form
            className="provider-form provider-work-intake-form"
            onSubmit={(event) => void saveEdit(event)}
          >
            <p className="provider-form-note">
              These details can be updated while the Work Intake is open. Every
              save creates a new revision and audit event. Relationship
              decisions remain separately recorded as Review, Dismiss, or
              Confirm actions.
            </p>
            <div className="provider-work-intake-form-grid">
              <label>
                Work title *
                <input
                  required
                  maxLength={200}
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm({ ...editForm, title: event.target.value })
                  }
                />
              </label>
              <label>
                Site or project name
                <input
                  maxLength={240}
                  value={editForm.site_summary}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      site_summary: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Requester name
                <input
                  maxLength={160}
                  value={editForm.requester_name}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      requester_name: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Contact reference
                <input
                  maxLength={200}
                  value={editForm.requester_contact_reference}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      requester_contact_reference: event.target.value,
                    })
                  }
                />
              </label>
              <section className="provider-work-intake-form-section wide">
                <div>
                  <h3>Initial elevator requirements</h3>
                  <p>
                    These values update the same canonical draft used by Lead,
                    Survey, and Quotation. Leave blank to keep the existing
                    scope.
                  </p>
                </div>
                <div className="provider-work-intake-form-grid">
                  <label>
                    Unit count
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={editForm.unit_count}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          unit_count: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Stops / floors
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={editForm.unit_stops}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          unit_stops: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Capacity (kg)
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={editForm.unit_capacity}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          unit_capacity: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Equipment type
                    <select
                      value={editForm.unit_type}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          unit_type: event.target.value,
                        })
                      }
                    >
                      <option value="">Keep existing type</option>
                      <option value="PASSENGER_TRACTION">
                        Passenger traction
                      </option>
                      <option value="PASSENGER_MRL">Passenger MRL</option>
                      <option value="FREIGHT_TRACTION">Freight traction</option>
                      <option value="HYDRAULIC">Hydraulic</option>
                    </select>
                  </label>
                </div>
              </section>
              <label className="wide">
                Request notes
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              {attributes.source === "REFERRAL" && (
                <section className="provider-work-intake-form-section wide">
                  <div>
                    <h3>Referral contact</h3>
                    <p>
                      The referral phone remains the primary tracking reference.
                    </p>
                  </div>
                  <div className="provider-work-intake-form-grid">
                    <label>
                      Referral contact name *
                      <input
                        required
                        maxLength={160}
                        value={editForm.referral_contact_name}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            referral_contact_name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Primary referral contact number *
                      <input
                        required
                        maxLength={40}
                        inputMode="tel"
                        value={editForm.referral_contact_number}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            referral_contact_number: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Referral email
                      <input
                        type="email"
                        maxLength={254}
                        value={editForm.referral_contact_email}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            referral_contact_email: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Referral relationship / role
                      <select
                        value={editForm.referral_contact_role}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            referral_contact_role: event.target.value,
                          })
                        }
                      >
                        <option value="">Select relationship or role</option>
                        {editForm.referral_contact_role &&
                          !REFERRAL_ROLES.includes(
                            editForm.referral_contact_role,
                          ) && (
                            <option value={editForm.referral_contact_role}>
                              {editForm.referral_contact_role} (existing)
                            </option>
                          )}
                        {REFERRAL_ROLES.map((role) => (
                          <option value={role} key={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wide">
                      Referral notes
                      <textarea
                        rows={2}
                        maxLength={5000}
                        value={editForm.referral_details}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            referral_details: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              )}
            </div>
            {editError && (
              <div className="provider-work-intake-error" role="alert">
                {editError}
              </div>
            )}
            <div className="provider-form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={editBusy}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={editBusy}>
                Save changes
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {abandonOpen && (
        <OperationsDialog
          title="Abandon provider journey"
          busy={abandonBusy}
          onClose={() => setAbandonOpen(false)}
        >
          <form
            className="provider-form provider-work-intake-form"
            onSubmit={(event) => void abandonJourney(event)}
          >
            <p className="provider-form-note">
              This authority-controlled action stops further work across the
              linked Lead, Survey, quotation, project and service records.
              Existing history remains available for audit.
            </p>
            <label>
              Reason *
              <textarea
                required
                minLength={3}
                maxLength={2000}
                rows={4}
                value={abandonReason}
                onChange={(event) => setAbandonReason(event.target.value)}
                placeholder="Explain why this journey is being abandoned."
              />
            </label>
            <label>
              Payment disposition
              <select
                value={abandonPaymentDisposition}
                onChange={(event) =>
                  setAbandonPaymentDisposition(event.target.value)
                }
              >
                <option value="NO_REFUND_DUE">No refund due</option>
                <option value="REFUND_REQUIRED">
                  Refund required — Finance must process it
                </option>
                <option value="REFUND_ALREADY_COMPLETED">
                  Refund already completed — payments must be reversed
                </option>
              </select>
            </label>
            <div className="provider-form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={abandonBusy}
                onClick={() => setAbandonOpen(false)}
              >
                Keep journey open
              </Button>
              <Button type="submit" variant="danger" busy={abandonBusy}>
                Abandon journey
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {activityOpen && (
        <JourneyTimelineDialog
          journey={journey}
          loading={activityBusy}
          error={activityError}
          emptyLabel="No activity events are available for this journey."
          onClose={() => setActivityOpen(false)}
        />
      )}
      <WorkflowFollowUpDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        providerId={providerId}
        targetResourceKind="ProviderWorkIntake"
        targetResourceId={id}
        stage={attributes.workflow_stage || "INTAKE"}
        readOnly={workflowConcluded}
      />
      {requirementsOpen && (
        <OperationsDialog
          title="Capture Work Intake requirements"
          busy={requirementsBusy}
          onClose={() => setRequirementsOpen(false)}
        >
          <form
            className="provider-form provider-work-intake-form"
            onSubmit={(event) => void saveRequirements(event)}
          >
            <p className="provider-form-note">
              Capture the elevator scope once here. This canonical requirement
              profile is carried forward to Lead, Site Survey, and Quotation
              without repeating unit count, stops, or capacity.
            </p>
            <div className="provider-work-intake-form-section">
              <div>
                <h3>Elevator unit profile</h3>
                <p>
                  For multiple lifts, the same profile is applied to each unit.
                  Detailed revisions remain available in the journey timeline.
                </p>
              </div>
              <div className="provider-work-intake-form-grid">
                <label>
                  Number of units *
                  <input
                    required
                    type="number"
                    min="1"
                    max="50"
                    value={requirementsForm.unit_count}
                    onChange={(event) =>
                      setRequirementsForm({
                        ...requirementsForm,
                        unit_count: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Stops / floors per unit *
                  <input
                    required
                    type="number"
                    min="1"
                    max="300"
                    value={requirementsForm.unit_stops}
                    onChange={(event) =>
                      setRequirementsForm({
                        ...requirementsForm,
                        unit_stops: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Capacity per unit (kg) *
                  <input
                    required
                    type="number"
                    min="1"
                    max="10000"
                    value={requirementsForm.unit_capacity}
                    onChange={(event) =>
                      setRequirementsForm({
                        ...requirementsForm,
                        unit_capacity: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Equipment type *
                  <select
                    required
                    value={requirementsForm.unit_type}
                    onChange={(event) =>
                      setRequirementsForm({
                        ...requirementsForm,
                        unit_type: event.target.value,
                      })
                    }
                  >
                    {equipmentTypeOptions.map((option) => (
                      <option value={option.code} key={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {requirementsError && (
              <div className="provider-work-intake-error" role="alert">
                {requirementsError}
              </div>
            )}
            <div className="provider-form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={requirementsBusy}
                onClick={() => setRequirementsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={requirementsBusy}>
                <SvgIcon name="save" size={15} /> Save requirements
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
    </div>
  );
}
