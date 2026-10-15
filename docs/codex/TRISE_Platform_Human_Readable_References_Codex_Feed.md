# TRISE India — Platform-wide Human-Readable References Standard

**Codex implementation instruction | 15 October 2026**

**Primary repository:** `~/wrk/lre/trise-ui`  
**Inspect and modify if genuinely required and authorized:** `~/wrk/lre/trise-api`, `~/wrk/lre/trise-architecture`  
**Applies to:** All user-facing TRISE surfaces — Platform Administration, Business, Service Provider, Customer, Agent, subscription/billing, compliance, operations, service jobs, assets, documents, notifications, dashboards, search, exports and printable views.

## Mission

Eliminate **raw UUIDs as visible primary references** across the user experience. Show meaningful human-readable names, contextual descriptions and existing business reference codes instead. Keep UUIDv7 as internal immutable identity for database relationships, API requests/responses, routing, permissions, audit correlation and events. **Do not change primary keys or invent a new identifier system just for presentation.**

This standard supplements the existing Business Compliance UI redesign and Compliance UX refactor plans. Audit the entire frontend, not only Compliance.

## 1. Mandatory presentation contract

1. **Never show a raw UUID in ordinary page headings, breadcrumbs, forms, labels, dropdown items, table cells, badges, popovers, request cards, toast messages, empty states, timelines, notifications, search results, or document descriptions.**
2. Use the entity's **display name** or **natural business title** as the primary label. Add relevant context such as business/provider, type, location, jurisdiction or role as secondary text where needed.
3. For transactional records, show an **existing authoritative human-friendly reference number** where available (e.g., request number, service job number, asset code, invoice number). Inspect schemas before using any code; do not fabricate references or claim uniqueness if not guaranteed.
4. For same-name entities, disambiguate visibly with business name, locality, record type, site, asset code or an existing business reference. Never rely on name alone as identity.
5. If a display name is absent, use a neutral localized fallback such as **“Name unavailable”**, accompanied by authorized contextual attributes. **Do not fall back to a UUID** or leak a linked record from a different tenant.
6. Preserve UUIDs **under the hood** in selected option values, API payloads, React keys, route parameters, mutation metadata, event correlation and backend logs. Do not identify a record by its name in mutation requests.
7. Retain deep-link compatibility and existing API contracts. A route may contain an opaque UUID without displaying it in the user interface; do not rewrite routing just for aesthetics.
8. Avoid embedding UUID strings in human-readable error messages. Map responses to safe entity labels; preserve correlation IDs in approved technical logging/diagnostics if supported.
9. If an explicitly privileged diagnostics feature requires internal identifiers, keep them in a separate **role-protected technical diagnostics view/action** (for example, “Copy internal ID”), never in normal screens, tooltips or primary tables. Follow current architecture and security policy.
10. Labels must not imply authorization or eligibility. A pretty display name must not hide meaningful status or scope constraints.

## 2. Entity display mapping

| Domain record | Primary human-readable label | Secondary context (when available and authorized) |
|---|---|---|
| Business | Registered/trading business name | Constitution, city, verified status |
| Service provider | Provider display name | Owning business, specialization, operating location |
| Customer | Person/organization display name | Customer type and service location |
| User / platform team | Full/preferred name | Email or role only where authorized |
| Agent | Agent full name | Role, provider, credential status |
| Property / service location | Property/building/site name | City, block, address fragment |
| Asset | Asset name or registered asset code | Asset type, customer and installation location |
| Component | Component name | Parent asset, model/serial only where appropriate |
| Service request / complaint | Existing ticket/reference number or descriptive title | Customer/asset and date/status |
| Service job / visit | Existing job/visit reference or descriptive task | Asset, assignee, scheduled date |
| AMC / contract | Contract title or existing contract number | Covered customer/assets and date range |
| Plan / subscription | Plan name and tier | Subscribing provider, billing period |
| Invoice / payment | Existing invoice/receipt number | Party, date, amount |
| Compliance requirement | Published human-readable requirement title | Applies to Business/Provider/Agent/Asset; jurisdiction |
| Compliance request | Requirement title + subject | Existing request number (if available), status and date |
| Licence / authorization | Licence name/reference | Issuer, owner, scope, validity and provider |
| Tax registration | GSTIN and registered name (per privacy policy) | State/jurisdiction, association status |
| Registration / brand / trademark | Registered business/brand name | Registration category/number, jurisdiction |
| Document | Original meaningful filename or document title | Type, subject, version, scan status |
| Audit event / version | Human-readable event title and affected entity | Actor, timestamp, version number and action |
| Notification | Event/title and recipient display name | Channel, delivery state and time |

**Important:** This table gives presentation conventions, not authoritative schemas. Confirm actual attribute names and existing reference numbers from Rails/OpenAPI before implementation.

## 3. UI components and patterns

Build or reuse a small typed presentation layer; suggested interfaces/functions are illustrative, not fixed names:

- `EntityDisplayName` / `EntitySummary` for headings, cells, chips and captions.
- `EntityOption` for selector data with `{ id, label, description?, disabled?, status? }`; submit `id`, display `label`.
- `EntityBreadcrumb` that resolves display labels without writing UUIDs into breadcrumb text.
- `EntityLink` that renders a friendly label but navigates using a secure stable route.
- A label resolver that safely normalizes API response fields without guessing names or implicitly fetching inaccessible entities.

Use typed domain-specific resolvers instead of one simplistic global `id -> name` map when domain context is required. Favor server-provided explicit display objects / lightweight summary projections and batch lookups over one API call per row. Ensure consistent loading, fallback and error treatment.

Example (conceptual only):

```ts
const option = {
  value: provider.id,                  // UUID: hidden form state / API
  label: provider.display_name,        // user sees this
  description: provider.business_name, // optional, authorized context
};
```

**Bad UI:** `Provider 01a0ed1c-94dc-7702-9ea8-64187649b5a3`  
**Good UI:** `Lift Rise Elevators — Demo Operations` — `Service Provider · Elevator Maintenance`

**Bad UI:** `Requirement DEMO_ASSET_EVIDENCE_APPROVAL`  
**Good UI:** `Asset Regulatory Evidence Approval` — `Passenger Lift · Building 1` (only when these are authoritative labels)

**Bad UI:** `Subject 01a12c3e-...`  
**Good UI:** `TRISE E2E Sample Business` — `Business verification request`

## 4. App-wide audit scope

Inspect and fix all occurrence types, not just the screen in the screenshot:

- Left/right navigation, breadcrumbs, page titles and compact header panels.
- Form select menus, multiselect chips, search suggestions, dependent lookup fields and modal summaries.
- List/table cells, detail drawers, request card titles, statuses and permission screens.
- Compliance: Business Verification, GST association, Registrations & Brands, Licence Authorizations, Provider Compliance Center, Platform Approval Inbox, Requests & Reviews, Version History and Audit Logs.
- Operations: Customers, properties/service locations, assets and components, service requests, jobs, work assignments, schedules, service visits, AMC/maintenance and evidence.
- Subscriptions, pricing plans, seats/agents, billing/usage and tax/finance views.
- In-app notifications, exports, report PDFs, print views, emails and other templates generated by the UI/backends where in scope.
- Loading placeholders, zero-state messages, validation feedback, permission errors and activity timelines.

Use static searches for UUID patterns and suspicious `*_id`, `.id`, `JSON.stringify`, `split('-')`, substring/UUID truncation, field-key renderers, and `providerId/customerId/assetId` displayed in JSX. **Do not blindly replace all `.id` usages:** React keys, API calls, value bindings and foreign keys must remain unchanged.

## 5. Data contracts and security

1. Review real API responses for needed summary fields, including nested resources and relationships.
2. Where an endpoint returns only foreign keys, add an appropriate **authorized read projection / batch lookup** if required. Prefer minimal backward-compatible API additions; record backend dependencies if backend changes are out of scope.
3. Prevent N+1 network requests and repeated label resolution for paginated lists; batch or include scoped summaries.
4. Enforce tenancy and RBAC at data retrieval, not just at rendering. A label lookup must never become a cross-tenant enumeration channel.
5. For cross-boundary links (e.g., Business owns Licence, Provider uses Authorization), show only the permitted relationship summary.
6. Handle loading/error/missing/deleted/inaccessible/renamed records without revealing raw IDs. Where necessary, show “Record unavailable” and a permitted audit explanation.
7. For immutable historical audit versions, display the snapshot label **at event time** when recorded; if displaying the current label too, distinguish it clearly. Never rewrite immutable history to update names.
8. Do not expose secrets, tokens, raw storage keys, private URLs or personally sensitive information in UI descriptions.
9. Search by authorized display names and existing business codes; continue accepting existing opaque identifiers in internal links/API. Preserve paginated server-side filtering.
10. For duplicate names and localization, support secondary context, accessible full labels and truncation/overflow tooltips containing human-friendly information only.

## 6. Implementation batches

### Batch 0 — Inventory and design decision
- Read repo instructions, ADRs, domain APIs and UI checklist.
- Generate `docs/ui-human-readable-reference-inventory.md` enumerating visible ID occurrences with route, component, entity type, current text, replacement field(s), API support, access restrictions and migration status.
- Rank high-volume UI pages first; differentiate user-facing references from necessary hidden identifiers.

### Batch 1 — Shared infrastructure
- Implement typed display/option/link building blocks and any appropriate domain-specific label adapters.
- Add tests for name fallbacks, duplicate names, missing/inaccessible entities, permission scopes and loading.
- Ensure no UI component renders technical ID fallback.

### Batch 2 — Compliance screens (highest priority)
- Business Verification: readable business/provider labels, GST/registration names, licences, requests, documents, history and audit timeline.
- Provider Compliance Center: agent, asset, customer, provider, licence and territory labels, request wizard and forms.
- Platform Approval Inbox: submission subject, requirement title, before/after field labels, actor and assignment selector.
- Keep authoritative status, review permissions, evidence readiness, immutable versions and revision guards intact.

### Batch 3 — Operational workspaces
- Customers, Assets, Locations, Requests, Jobs, Assignments, Service Visits, AMC and Notifications; all display references human-readably.
- Introduce back-compatible server summary projections when required and approved.

### Batch 4 — Administration / commercial / exports
- Business/provider management, users, roles and permissions, subscriptions, invoices, plans, reports, downloadable documents and UI-generated messages.
- Maintain export data semantics: human-readable columns for nontechnical exports; internal IDs only in explicit authorized technical export contracts.

### Batch 5 — Quality gates and rollout
- Visual review of desktop, tablet and mobile routes and representative modal/detail/table states.
- Run tests, accessibility checks, lint, typecheck and production builds; note exact results.
- Use incremental PRs. Roll back UI-specific changes safely if any authorized entity resolution creates data leaks or unexpected query load.
- Update architecture ADRs only if a genuine architecture change was made; update UI checklist and developer display standards.

## 7. Acceptance criteria and evidence

Report each test as PASS, FAIL, BLOCKED or NOT RUN; do not claim tests passed unless executed:

1. Business, Provider, Customer and Agent pages show names, not raw UUIDs.
2. Assets and service requests show names/codes and sufficient disambiguating context.
3. All compliance request tables, reviewer selections, approval history and licence lists avoid raw UUID labels.
4. Entity selectors display friendly names while submitting stable UUID values to the original endpoints.
5. Search and pagination continue to operate with server-authoritative scopes.
6. Duplicate names are distinguishable and lead to the correct entity.
7. Loading, missing, deleted and inaccessible linked records have safe fallbacks without UUID exposure.
8. UI audit timelines use affected entity names and recorded actor display names; immutable log payloads are unchanged.
9. Export/PDF/email templates have readable labels where appropriate and authorized.
10. User-facing errors, notifications and breadcrumbs no longer expose raw UUIDs.
11. No cross-tenant or role-inaccessible names leak from label lookups or caches.
12. Rendering lists does not introduce uncontrolled N+1 API requests.
13. Deep links, mutation payloads and idempotency/revision behavior remain compatible.
14. No false claims about regulatory eligibility, document clearance or approvals are introduced.
15. Run TypeScript checks, ESLint, existing tests, relevant integration/e2e tests and customer/operations/platform build commands. Provide commands, results and browser screenshots if available.
16. Inventory each exception where UUIDs remain in technical-only diagnostics or externally specified machine-readable integration exports, with the explicit authorization and rationale.

## 8. Non-goals / caution

- Do not replace UUID primary keys with entity names.
- Do not generate unstable or undocumented human-readable reference numbers.
- Do not use UUID substring/truncation as a human-friendly reference.
- Do not perform mass DB migrations simply to improve display labels.
- Do not bypass Rails policies or scope label lookups to a broader tenant.
- Do not overwrite historical immutable event snapshots.
- Do not invent fake names for missing data.
- Do not create fake backend APIs or mock production data.

## 9. Codex execution command (paste into Codex)

```text
Read and implement docs/codex/TRISE_Platform_Human_Readable_References_Codex_Feed.md.
This is a TRISE-wide UI standard, not just a Business Compliance fix.
Inspect trise-ui, the relevant trise-api contracts and architecture instructions.
Produce the inventory, then implement shared label helpers and fix all user-facing UUID display references in small batches.
Keep UUIDs for APIs, database, routing and React keys; display only authorized human-readable labels and existing business codes.
Protect tenant isolation, permissions, document scanning and immutable audit history.
Verify selectors still submit stable IDs, search/pagination work and missing/duplicate names are safely handled.
Run automated checks and report changed files, exact test results, unresolved endpoints and remaining technical-only exceptions after each batch.
Proceed through batches unless a new backend contract or architectural/security change needs approval.
```
