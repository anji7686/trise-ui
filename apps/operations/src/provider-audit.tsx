import { useEffect, useState, type FormEvent } from "react";
import { Button, FilterToolbar, PageHeader } from "@trise/ui";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { indiaDateTimeToIso } from './subscription-support';

const failureText = (error: unknown) =>
  (error as { message?: string })?.message ||
  "Audit history could not be loaded.";

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
  const [limit, setLimit] = useState(10);
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
    <section className="content feature-page">
      {embedded ? <header className="provider-access-audit-heading"><h2>Roles &amp; Access audit log</h2><p>Review immutable Provider-scoped changes to role definitions, assignments and memberships.</p></header> : <PageHeader
        title="Audit Logs"
        description="Review immutable provider-authorized operational history."
      />}
      <form onSubmit={apply}>
        <FilterToolbar
          resultLabel={
            loading
              ? "Loading audit history…"
              : `${records?.data.length || 0} audit events returned by the server`
          }
        >
          <label>
            Source record ID
            <input
              aria-label="Filter audit by source record ID"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder="UUID of a request, job or asset"
            />
          </label>
          <label>
            Audit action (immutable events)
            <input
              aria-label="Filter audit by action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="ROLE_UPDATED"
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
          <p className="form-help">{accessOnly ? "This view is limited by the server to role and Provider membership audit records." : "Action and resource-kind filters query immutable audit events and require the server-granted Audit Read permission. A denied request is reported without falling back to broader data."}</p>
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
          <Button type="submit" disabled={loading}>
            Apply filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => {
              setSourceId("");
              setAction("");
              setResourceKind("");
              setFrom("");
              setThrough("");
              setCursor({});
              setFilters({ sourceId: "", action: "", resourceKind: "", from: "", through: "" });
            }}
          >
            Reset
          </Button>
        </FilterToolbar>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {records?.data.length ? (
        <div className="feature-list">
          {records.data.map((record) => {
            const source = record.relationships?.source;
            const sourceId = Array.isArray(source) ? source[0]?.id : source?.id;
            return (
              <article className="feature-row" key={record.id}>
                <div>
                  <Status>
                    {String(record.attributes.event_name || record.attributes.action || "EVENT")}
                  </Status>
                  <h3>
                    {String(
                      record.attributes.summary ||
                        record.attributes.event_name ||
                        record.attributes.action ||
                        "Audit event",
                    )}
                  </h3>
                  <p>
                    {String(
                      record.attributes.occurred_at ||
                        record.attributes.created_at ||
                        "Timestamp unavailable",
                    )}
                  </p>
                  <small>
                    Source {sourceId || "not available"} · Event {record.id}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="notice">
            No authorized audit events match these filters.
          </p>
        )
      )}
      <div className="server-pagination" aria-label="Audit history pages">
        <label className="page-size-control">
          Rows per page
          <select
            aria-label="Audit rows per page"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setCursor({});
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
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
  );
}
