# Human-readable reference inventory

Updated 2026-10-15. UUIDs remain in route parameters, React keys, mutation payloads and API methods. The entries below are the user-facing occurrences audited in the current frontend and their migration status.

| Area / route | Entity | Current visible value | Replacement / API support | Status |
|---|---|---|---|---|
| Platform Businesses | Business | `Business ID <id>` secondary text | Business name, provider count and relationship | Needs cleanup in `platform-admin.tsx` |
| Business Compliance | Business | Business name or raw API fallback | `displayName` / authorized Business summary | Implemented |
| Business Compliance | Requirements | Internal requirement codes in API data | Published requirement name | Implemented |
| Business Compliance | Requests/history | Request and event payload identifiers | Requirement title, status, actor and version | Implemented for primary tables; detail payload still needs API display projections |
| Platform Approval Inbox | Business/Provider/Agent/Asset | Subject and request UUIDs in detail/audit fields | Subject display summary and requirement title | Partial; existing page needs summary fields from API |
| Licence authorizations | Provider/Business/source version | Provider, Business and source version UUID text | Provider/business names, licence reference, version number | Backend summary projection needed |
| Provider Compliance Center | Agent/Asset/Licence/Territory | Some fallback labels use opaque IDs | Existing display name/code and scoped summaries | Partial; provider endpoints do not return all linked labels |
| Operations jobs/visits | Job/Visit/Agent | Job fallback, Visit ID and agent fallback | Job reference/title, visit reference, agent name | Partial; API contract lacks stable references for some records |
| Customer workspace | Provider/Asset/Booking/Job | Provider fallback, booking/job/current-version IDs | Provider/asset names, descriptive booking/job labels, version number | Partial; customer API needs authorized relationship summaries |
| Documents | Document version | Current version UUID | Version number and scan state | Needs cleanup in customer document detail |
| Typed configuration | Review reference | “Review reference UUID” input and raw-id fallback | Authorized technical diagnostics label / server reference | Needs cleanup; contract accepts opaque review id internally |
| Notifications/emails | Event metadata | API-supplied identifiers in some bodies | Event title and recipient/entity display data | Backend template audit required |
| Exports/reports | Export rows | Contract-specific IDs may be included | Human-readable columns for ordinary exports | Requires per-export contract audit |

## Display infrastructure

`apps/operations/src/human-readable.tsx` provides typed `displayName`, `contextLabel`, `EntitySummary`, `EntityOption`, and opaque-ID detection. It never truncates or presents UUIDs as labels and returns “Name unavailable” when an authorized display field is absent. The helper has unit coverage for missing, UUID-only and contextual records.

## Required backend follow-up

Several API responses currently expose only foreign keys for linked records. Names cannot be safely guessed or loaded with one request per row. Add scoped summary projections or batch lookups for Approval Inbox subjects, licence authorizations, Provider Compliance linked resources, Customer relationship fields, and notification/export templates. Until then, the UI must show a neutral unavailable label rather than a raw UUID.

