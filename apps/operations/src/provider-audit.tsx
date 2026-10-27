import { useEffect, useState, type FormEvent } from "react";
import { Button, PageHeader } from "@trise/ui";
import {
  operationsData,
  DEFAULT_PAGE_SIZE,
  type Collection,
  type GenericAttributes,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { formatIndiaDateTime, indiaDateTimeToIso } from './subscription-support';

const failureText = (error: unknown) =>
  (error as { message?: string })?.message ||
  "Audit history could not be loaded.";
const humanize = (value: string) => value.replace(/[_-]+/g, " ").toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

export function ProviderAudit({ providerId, accessOnly = false, embedded = false }: { providerId: string; accessOnly?: boolean; embedded?: boolean }) {
  const [records, setRecords] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [sourceId, setSourceId] = useState("");
  const [action, setAction] = useState("");
  const [resourceKind, setResourceKind] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [filters, setFilters] = useState({
    sourceId: "",
    action: "",
    resourceKind: "",
    from: "",
    through: "",
  });
  const limit = DEFAULT_PAGE_SIZE;
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      "page[limit]": String(limit),
      sort: "-created_at,id",
    });
    if (cursor.after) params.set("page[after]", cursor.after);
    if (cursor.before) params.set("page[before]", cursor.before);
    if (accessOnly) {
      params.append("filter[resource_kind][]", "Role");
      params.append("filter[resource_kind][]", "ProviderMembership");
    }
    if (filters.sourceId) params.set("filter[source_id]", filters.sourceId);
    if (filters.action) params.set("filter[action]", filters.action);
    if (filters.resourceKind)
      params.set("filter[resource_kind]", filters.resourceKind);
    if (filters.from)
      params.set(
        "filter[created_at][gte]",
        indiaDateTimeToIso(filters.from),
      );
    if (filters.through)
      params.set(
        "filter[created_at][lte]",
        indiaDateTimeToIso(filters.through),
      );
    let active = true;
    setLoading(true);
    setError("");
    void operationsData
      .genericCollection(
        providerId,
        `/${accessOnly || filters.action || filters.resourceKind ? "audit-events" : "timeline"}?${params}`,
      )
      .then((result) => {
        if (active) setRecords(result);
      })
      .catch((cause) => {
        if (active) setError(failureText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [providerId, filters, limit, cursor, accessOnly]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursor({});
    setFilters({ sourceId: sourceId.trim(), action: action.trim(), resourceKind: resourceKind.trim(), from, through });
  }

  return (
    <section className="content feature-page provider-audit-page">
      {embedded ? <header className="provider-access-audit-heading"><h2>Roles &amp; Access audit log</h2><p>Review immutable Provider-scoped changes to role definitions, assignments and memberships.</p></header> : <PageHeader
        title="Audit History"
        description="Review a readable, provider-scoped record of operational changes."
      />}
      <div className="provider-audit-overview"><span className="provider-audit-overview-icon" aria-hidden="true">↻</span><div><strong>Immutable activity history</strong><p>Events are returned by the server and remain scoped to your provider permissions.</p></div><Status>{loading ? "Loading" : `${records?.data.length || 0} events`}</Status></div>
      <form className="provider-audit-filter-form" onSubmit={apply}>
        <div className="provider-audit-filter-heading"><div><h2>Filter history</h2><p>Set any combination, then apply to refresh the results.</p></div><span>{loading ? "Loading…" : `${records?.data.length || 0} rows · ${limit} per page`}</span></div>
        <div className="provider-audit-filter-grid">
          <label>
            Event action
            <input
              aria-label="Filter audit by action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="For example, SERVICE_JOB_ASSIGNED"
              maxLength={100}
            />
          </label>
          {!accessOnly && <label>
            Resource kind
            <input
              aria-label="Filter audit by resource kind"
              value={resourceKind}
              onChange={(event) => setResourceKind(event.target.value)}
              placeholder="Role"
              maxLength={100}
            />
          </label>}
          <label>
            From
            <input
              aria-label="Audit from date and time"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            Through
            <input
              aria-label="Audit through date and time"
              type="datetime-local"
              value={through}
              onChange={(event) => setThrough(event.target.value)}
            />
          </label>
          <div className="provider-audit-filter-actions">
            <Button type="button" variant="secondary" disabled={loading} onClick={() => {
              setSourceId(""); setAction(""); setResourceKind(""); setFrom(""); setThrough(""); setCursor({});
              setFilters({ sourceId: "", action: "", resourceKind: "", from: "", through: "" });
            }}>Reset</Button>
            <Button type="submit" disabled={loading}>Apply filters</Button>
          </div>
        </div>
        <details className="provider-audit-advanced-filter">
          <summary>Advanced filter · specific record</summary>
          <label>
            Source record ID
            <input aria-label="Filter audit by source record ID" value={sourceId} onChange={(event) => setSourceId(event.target.value)} placeholder="Paste a record reference" />
          </label>
        </details>
        <p className="provider-audit-filter-note">{accessOnly ? "This view is limited by the server to role and Provider membership audit records." : "Event action and resource filters require the server-granted Audit Read permission. Results remain provider-scoped."}</p>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="provider-audit-results" aria-label="Audit activity">
      <div className="provider-audit-results-heading"><h2>Audit activity</h2><span>Newest first · Asia/Kolkata</span></div>
      {records?.data.length ? (
        <div className="provider-audit-list">
          {records.data.map((record) => {
            const source = record.relationships?.source;
            const sourceLink = Array.isArray(source) ? source[0] : source;
            const actionName = String(record.attributes.event_name || record.attributes.action || "EVENT");
            const resourceKind = String(record.attributes.resource_kind || sourceLink?.type || "Operational activity");
            const actorName = String(record.attributes.actor_name || (record.attributes.actor_user_id ? "Authorized team member" : "System event"));
            return (
              <article className="provider-audit-row" key={record.id}>
                <span className="provider-audit-marker" aria-hidden="true" />
                <div className="provider-audit-row-main"><div className="provider-audit-row-title"><h3>{humanize(String(record.attributes.summary || actionName))}</h3><Status>{humanize(resourceKind)}</Status></div><p>{actorName}</p></div>
                <time dateTime={String(record.attributes.occurred_at || record.attributes.created_at || "")}>{formatIndiaDateTime(String(record.attributes.occurred_at || record.attributes.created_at || ""))}</time>
              </article>
            );
          })}
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="provider-audit-empty">No authorized audit events match these filters.</p>
        )
      )}
      <div className="server-pagination" aria-label="Audit history pages">
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={!records?.page?.previous || loading}
            onClick={() =>
              setCursor({ before: records?.page?.previous || undefined })
            }
          >
            Previous
          </Button>
          <Button
            type="button"
            disabled={!records?.page?.next || loading}
            onClick={() =>
              setCursor({ after: records?.page?.next || undefined })
            }
          >
            Next
          </Button>
        </div>
      </div>
      </section>
    </section>
  );
}
