# TRISE India — Service Provider Details: Ownership, Navigation, Delegated Administration and UX Refactor

**Implementation feed for Codex**  
**Created:** 15 October 2026  
**Scope:** Platform Administration > Service Providers > Provider Details, plus necessary Business links and API contracts.  
**Frontend repository:** determine from the current checkout (`pwd`, `git remote -v`). Prior UI location was `~/wrk/lre/trise-ui`; do NOT assume that location exists.  
**Verified backend repository in user's terminal:** `~/wrk/trise/trise-api` (Ruby 4.0.7, Bundler 4.0.21, Rails 8.1.3.1).  
**Architecture:** locate the current `trise-architecture` checkout; follow existing ADRs and the published OpenAPI contract.  
**Source:** Screenshots of the currently implemented provider detail tabs supplied by the user. This specification is a UX and architecture proposal; validate actual behavior against code and running API before reporting PASS.

## Non-negotiable implementation instruction

**Implement a functional, task-oriented redesign—not a cosmetic restyling.** Preserve existing business rules, persisted data, API compatibility, role permissions, subscription billing, immutable compliance decisions, auditability and document scanning. Do not invent missing backend features or mock production responses. Work in small, reviewable batches. If a capability requires an API change, explicitly update the approved design, OpenAPI, policy tests and backend before wiring the UI.

## A. Screenshot-based findings requiring investigation

1. Header shows **Lifecycle: Active**, **Business verification: Verified**, **Onboarding readiness: Needs attention**. Setup checklist shows **Provider identity: In progress**, **Documents: Not started**, but **Plan & approval** and **Review & activate: Complete**. Determine if historical activation versus current readiness explains this, or if the projections contradict one another. Do not silently set values to 'complete'.
2. **Business Operation** section says no Business Operation is assigned; provider is already Active and the relationship is locked after activation. Distinguish pre-activation validation, legacy records, controlled transition processes and actual runtime eligibility; fix inconsistent or misleading actions.
3. **Administrators & access** shows no administrator membership and an invitation action requiring an existing verified user. Clarify inviter workflow, verification prerequisite, invitation status and default access. Never auto-enroll unrelated users.
4. **Business details** shows verified legal name, registration, address and business identity-domain management; the authoritative record belongs to the Business, not each Provider Account. Multiple Providers may share a Business, without sharing operational access or subscription entitlements.
5. **Tax & Billing** currently prompts for a legal issuing entity (legal name, PAN, entity type) while the Business already has a canonical legal/tax identity. Inspect whether 'issuing entity' is truly a provider-specific billing entity or a duplicate of Business identity; do not merge without contract/domain analysis.
6. **Subscription** is extremely tall: plan catalogue warning, next action, attention, accepted plan snapshot, validity, upgrade request, capacity and approval status in separate stacks. It contains UUID-shaped plan identifiers and the fallback 'Plan name unavailable'. Replace with one concise summary, detailed on demand.
7. **Documents** is sparse and reports no visible documents. Verify correct provider scope, server returns, permissions and empty-state copy, not just styling. Platform admins with explicit document capability need scoped preview/download; scanning gates remain intact.
8. **Reviews & approvals** is minimal. Make previous decisions discoverable, distinguish provider onboarding review from Business compliance and platform-wide compliance approvals.
9. **Audit history** lists action and actor type 'User' but lacks individual actor identity. Existing API may not record it. Improve presentation of available data now; propose a properly governed backend audit enhancement for future events if needed. Screenshot notes filtering may only apply to a bounded subset returned with provider details: do NOT label this as complete, globally paginated audit history.
10. The nine navigation tabs, six setup-step chips repeated on every tab, broad headers and long white cards compete for attention. Remove duplication without removing real features.
11. Avoid displaying UUIDs, raw IDs or database enum names as the primary labels; show business/provider names, plan name and human-readable codes when supplied by the API. UUIDs remain keys internally and may be copied from an authorized diagnostics drawer.

## B. Ownership and source-of-truth matrix — mandatory

| Data/capability | Authoritative owner | Display on Service Provider Details | Editing location / policy |
|---|---|---|---|
| Business legal name, constitution, registration, country, registered address | **Business** | Read-only linked Business summary | Business > Details/Verification; authorized delegated admin only through Business API |
| GSTIN, Business tax registrations, canonical tax documents | **Business / Tax domain** | Only scoped billing reference/status if applicable | Business > Tax/GST, canonical tax APIs; no duplicate Provider GST editing |
| Business logo, corporate brands, trademarks | **Business** | Authorized business logo/avatar if linked | Business > Branding / Registrations & Brands, through Business document + scan lifecycle |
| Business identity domains | **Business** | Optional read-only domain indicator where useful | Business > Identity Domains; do not imply domain implies Provider membership |
| Source Business licences | **Business** | Linked authorized licence references only | Business > Licences; provider association follows existing permissioned approval workflow |
| Provider display name, provider account type, lifecycle | **Provider Account** | Main header / Overview | Provider-specific edit endpoint, gated lifecycle transition |
| Business Operation classification / relationship | **Provider Account relationship to Business catalogue** | Operations | Link and update under server policy; do not broaden provider scope or permit uncontrolled post-activation reassignment |
| Provider contacts / operational locations | **Provider Account, subject to ownership model** | Operations | Provider-specific endpoints; reuse Business contacts by reference when appropriate, not copy |
| Provider administrators, invitations and permissions | **Provider Account membership** | Team & Access | Membership/invitation endpoints and RBAC; no sibling-provider access |
| Subscription, plan snapshot, quotas, renewals and upgrades | **Provider Account subscription** | Subscription & Billing | Subscription APIs; Business ownership does not share billing entitlement |
| Payment invoices / billing contact / issuing entity | **Billing domain** | Subscription & Billing when genuinely provider-scoped | Resolve canonical Business/issuer vs provider payer in ADR/OpenAPI; avoid second legal identity |
| Provider-specific documents | **Provider Account** | Documents | Provider-document APIs with permission and scan state |
| Business-owned documents | **Business** | Link to Business record, no copied provider ownership | Business document APIs and permissions |
| Provider onboarding/review status | **Provider workflow** | Overview and Reviews | Authorized workflow APIs; immutable decisions |
| Business compliance reviews | **Business compliance** | Linked status only | Business Verification / Platform Approval Inbox |
| Audit events and actor identity | **Cross-cutting audit** | Activity | Server-authoritative, immutable and scoped |

**Rule:** Moving UI presentation must not delete data or silently migrate ownership. Preserve backwards-compatible routes and links. If the current schema has duplicate ownership, write an ADR/migration proposal and obtain approval before migrating canonical records.

## C. Proposed final navigation (9 tabs -> 7)

| Final tab | Screens/sections included | Remove or relocate |
|---|---|---|
| **Overview** | Provider profile, linked Business card, lifecycle/verification/readiness states, outstanding setup tasks, quick actions, recent events | Move full setup wizard to a collapsible **Review setup** panel shown when needed; do not repeat on every tab |
| **Operations** | Business Operation association, provider type, provider contacts, operational locations, authorized operational configuration | Move Business canonical profile and corporate domains out |
| **Subscription & Billing** | Current plan, validity, actual usage vs quotas, renewal/upgrade CTA, invoices/payment summaries, short plan/approval timeline | Move long separate cards into dialogs/accordions; move canonical Business GST/legal identity to Business |
| **Documents** | Provider document table, add/upload, classification, scan lifecycle, evidence usage, inline preview and permissions | No separate full-page placeholder; no Business-document duplication |
| **Team & Access** | Provider administrators, invites, statuses, provider roles/memberships and accessible actions | Never confuse verified contact with provider administrator or platform staff |
| **Reviews & Approvals** | Provider onboarding review requests, statuses, reasons, attachments, reviewer feedback, immutable decision timeline | Business compliance approval remains in Platform Approval Inbox, not duplicated here |
| **Activity History** | Provider-scoped, chronological audit list with actor, timestamp, event and details | No client-only filtering of bounded history presented as full pagination |

**Old to new mapping:** `Overview` -> Overview; `Subscription` + provider-specific `Tax & Billing` -> Subscription & Billing; `Business details` -> linked Business summary on Overview and Business canonical page; `Business Operation` -> Operations; `Documents` -> Documents; `Reviews & approvals` -> Reviews & Approvals; `Administrators & access` -> Team & Access; `Audit history` -> Activity History. Move provider-specific identity/contact/location fields into Operations. Keep old URLs deep-linkable using redirects or route aliases.

### Navigation behavior
- Only one content area active at a time; avoid rendering all forms and lists on one page.
- At desktop width show 7 tabs, with overflow handling; on small screens use accessible tab selector or subnavigation. Preserve deep links and browser Back behavior.
- Keep compact persistent identity header: provider display name, provider code (if already human-friendly), optional provider/business thumbnail, **Lifecycle**, **Business verification**, **Setup readiness** clearly distinct. Action menu context-sensitive.
- Show long six-step setup checklist **only on Overview when expanded or on Review setup route/drawer**, not above every tab. Clicking a failing step must navigate to the correct editor.
- Use consistent spacing, 14–16px body text, generous form labels, 44px click targets where practical, focus states, loading/error/empty/success states.
- Employ existing TRISE navy and brand colors; use green for confirmed success, amber for real attention, red for blockers/errors, blue for primary actions and restrained neutral metadata. Never rely only on color; display text and icons. No rainbow decorative tiles.

## D. Detailed screen behavior

### D1. Overview — target compact layout

```text
Breadcrumb: Platform Administration > Service Providers > [Provider display name]
[Provider / business avatar] [Provider display name]         [Review setup] [Actions]
[Provider code] [Business: linked name] [Registered timestamp]
Lifecycle [Active]     Business verification [Verified]    Readiness [Needs attention]

[ATTENTION] 2 setup items need attention  [View checklist]

+ Provider information             + Subscription & usage
| Name / type / Business link      | Plan name / rate / validity
| Operations association status    | Assets used vs quota, agents vs quota
| Contact summary                  | [Manage subscription]

+ Required next steps              + Recent activity (last 3–5)
| Clear, permissioned actions      | Business profile updated
| e.g. Assign admin / documents    | Provider activated
```

Do not hardcode counts or status. Load from authoritative APIs. If a source cannot provide a field, use an honest fallback such as 'Not provided' rather than a fabricated value.

### D2. Operations
- Show **Business Operation** relation as a single selected/linked Business Operation, classification and policy status, with context on why changing it may be locked after activation.
- For missing relation + active provider, show a clearly explained exception and link to an authorized resolution workflow; do not render a dead-end 'select before activation' message with no possible action.
- Contacts and service locations remain separate from Business registered office. Keep a provider-scoped contact list and office/service-area summary; create/edit via focused modal if endpoints permit.
- Where an action is unavailable, display the blocking reason and link to the correct approval/support flow; no meaningless disabled button.

### D3. Subscription & Billing — simplify radically

**Above the fold show only:**
- Plan display name (if available), monthly/annual amount, currency, tax treatment and current subscription status.
- Billing period and expiry / renewal status.
- Two relevant usage bars: active agents and managed assets versus included capacities. Distinguish definitions from snapshot and use server metrics; do not invent installed count.
- One context-sensitive CTA: Manage plan / View upgrade request / Renew / See invoice according to allowed actions.
- A compact warning when expiring or approaching limits (e.g. 80% warning only when server semantics are established).

**In a secondary drawer/modal or secondary subviews:**
- Accepted contract snapshot and terms, plan approval history, pending upgrade, prior subscriptions, invoices and detailed usage.
- For pending upgrade, show requested plan name, date, status and timeline. Do not display raw plan UUIDs.
- Invoices and PAN/legal identity: use authoritative billing entity; do not duplicate Business canonical tax fields. PAN should be masked when displayed and available only to authorized roles.
- Clarify **plan active**, **approval approved**, **payment verified**, **provider lifecycle active** are independent states. Do not infer one from another.
- Use a visible data-unavailable state for missing plan display name, and request API enrichment; never substitute a made-up plan title.

### D4. Documents
- Provider-scoped table: **Document name, category, linked request, updated, scan state, lifecycle, Actions**; server-backed pagination when available (10/page default).
- Add document opens an accessible focused modal, with working Browse files and optional drag/drop (only if tested), classification dropdown incl. 'Other' if allowed by published catalogue, attachment progress and explicit result.
- On success refresh list, show upload state, return to originating view; keep upload/crop/activation separate as relevant.
- Inline preview of images/PDF; Office previews only from authorized server-side rendition if available. Otherwise clearly offer authorized download; never assume `<iframe>` renders every format.
- Keep provider-owned and Business-owned documents separate; Platform Admin preview requires backend explicit permission, fresh scoped access and logging as specified.
- Do not use unscanned documents as verified evidence or activate unsafe logos; preserve malware scanning and document governance.

### D5. Team & Access
- Show status banner only if admin membership really absent. Explain 'existing verified user required' with flow to invite or locate a verified user, when supported.
- Table: member display name, email, role, status, added date, actions. Invitations in separate collapsible section/table (status, sent, expires, resend/revoke if allowed).
- Platform Admin may create/send invitations on behalf of selected Provider only via explicit capabilities and audited delegation; cannot bypass email verification or automatically confer privileged access.
- Membership cannot be inferred from contact records, Business identity domains, verified email or Business ownership.

### D6. Reviews & Approvals
- Provider-scoped review summary (pending, changes needed, completed) from authoritative API.
- Request list/table with **meaningful title, category, submitted by, date, status, next action**; click opens a detail drawer or page with evidence, field-level differences, reviewer feedback, and immutable timeline.
- Decision submission only from authorized Platform Approval Inbox or a permissioned equivalent; do not duplicate review decision controls in arbitrary cards.
- Distinguish provider onboarding review and Business compliance reviews. Show related Business status read-only with a link.

### D7. Activity History
- Default last 10 events newest-first, server-backed pagination/filters and total count only if provided by API. Filters for dates, action and actor.
- Record: clear action phrase, affected resource display name, actor display name if captured, actor type as secondary data, date/time in selected timezone, event details on click.
- If actor identity not stored, show 'Actor identity unavailable' rather than inventing a person; log backend gap and propose privacy-sensitive actor-reference capture for future events.
- If only bounded events are returned, state that clearly, do not claim exhaustive history/pagination.
- Preserve immutability. Provide relevant event correlation/reference in authorized technical details, not the main table.

## E. Platform Admin acting on behalf of Business and Provider (required feature)

**Functional requirement:** Properly authorized Platform Administrators should be able to initiate and complete allowed onboarding/data-entry actions for a selected Business or Provider, with exactly the same domain validation and approval requirements as an ordinary authorized owner. This is **delegated administration**, NOT silent user impersonation.

### E1. UX
- Platform Admin selects the exact Business or Provider and sees a clear banner: `Editing as Platform Administrator for [Business/Provider display name]`.
- Buttons are contextual: `Edit Business details`, `Add Business GST`, `Update Provider contact`, `Invite Provider administrator`, `Request review`, `Manage subscription`, etc., only as authorized and supported.
- For sensitive actions, collect a reason and show a confirmation summarizing **owner, requested change, effective scope and consequences**.
- Submission is attributed to the real Platform Administrator; owner is separately represented as the affected Business/Provider, never falsely identified as the actor.
- Show server-authoritative result and timestamp in both owner history and platform audit according to current scopes.

### E2. Permission and domain enforcement
- Inspect existing roles, capabilities, policy objects and API authentication. Create/extend purpose-specific permission(s) ONLY with an ADR/OpenAPI change when needed; never grant blanket provider membership.
- Server must verify platform context, target Business/Provider, exact capability, relation/tenant boundaries, status transitions, required evidence, optimistic concurrency and idempotency.
- Approved Business identity or compliance versions remain immutable; editing them creates an authorized proposed change and review request, never a direct overwrite.
- Subscription changes must preserve accepted commercial terms, approval, payment verification and provider plan scope.
- Invitation actions must preserve verified user and role-grant rules; no automatic activation of privileged user.
- All delegated mutations capture `acting_actor`, `target_owner`, `action`, `reason` (where required), `before/after or revision refs`, `timestamp`, `request/correlation ID`, and optional on-behalf flag, using existing audit design; avoid logging secrets or full sensitive tax data.
- Owner's consent/workflow requirements, if defined by ADRs or contract, remain enforced. Read-only fallback when no approved delegation API exists.
- Add negative tests: cross-business, cross-provider, same Business sibling-provider boundary, unauthorized staff, forged owner ID, disallowed state transition, stale request, missing reason and privilege escalation.

### E3. Business vs Provider delegation examples
- **Business context:** Edit proposed legal identity, submit tax association request, manage corporate domains or Business logo, create registration/trademark request, attach Business evidence—only through authoritative Business APIs.
- **Provider context:** Edit provider profile (provider-specific fields only), contacts, permitted operational locations, invite admins, manage provider-owned documents, initiate provider licence/territory association requests and permitted subscription actions.
- Platform review/decision is **separate** from provider request submission. Maintain segregation-of-duties restrictions where required; do not let one Platform Admin create and self-approve a request if prohibited by policy.

## F. Backend/frontend contract work

1. Inspect APIs for provider details, linked Business, business operations, memberships/invites, subscriptions/entitlements, invoices, documents, provider reviews and audit. Build a typed API inventory with current request/response JSON shape, permission required, actual field source and UI consumer.
2. Resolve missing display names through authorized read projections/batch lookup—provider display name, Business registered name, plan display name, activity title, actor name. Do not invoke unrestricted cross-tenant joins.
3. Expose **separate status projections** for lifecycle, verification, readiness and subscription rather than flattening them into one 'Active' boolean. Determine if onboarding milestones are historical completion or current readiness. Document and test semantics.
4. Resolve Business Operation missing relationship for an active record: reproduce; report whether historical data needs reconciliation or relationship validation is missing. Do not rewrite production records. Provide migration/backfill proposal only if approved.
5. Resolve provider billing issuing-entity ownership, canonical legal/tax fields and invoice requirements with an ADR as needed; don't duplicate GST/PAN data to improve UI.
6. Add server-side pagination/sort/filter/count where needed for audit/documents/reviews. If absent, make UI limitations explicit until contract is implemented.
7. Where actor identity is unavailable, improve **future** audit events in a backward-compatible manner; do not backfill historical user names by guessing.
8. Correct document preview policies through authorized API capabilities, including Platform Admin delegated view; keep private storage, signed short-lived access, malware status and access logging.
9. UI permissions must be consistent with API policies; frontend-only hiding is insufficient.
10. Update the authoritative OpenAPI/ADRs and TS client types before using new fields/endpoints. Avoid breaking clients and preserve old routes.

## G. Delivery batches and stop gates

### Batch 0 — Audit and plan (no broad edits)
- Verify actual frontend checkout path; confirm correct `~/wrk/trise/trise-api` backend. Inspect git status and branch; do not overwrite unrelated work.
- Inventory all nine original tabs, related components, API endpoints, roles, data owners, tests, existing ADRs and current UX screenshots.
- Reproduce API errors if present. Produce before/after test scenarios and API gap list.
- **Gate:** no assumptions about owner of tax/Business Operation; classify confirmed versus proposed.

### Batch 1 — Correct status/readiness semantics and linked Business projections
- Diagnose Active versus In progress/Not started; distinguish readiness, lifecycle and history accurately.
- Add compact header, human-readable Business link and clear actionable setup summary.
- **Gate:** status assertions backed by fixtures and API values, no fabricated UI state.

### Batch 2 — Consolidate nine tabs into seven, preserve navigation
- Implement route mapping/deep-link redirects and responsive tabs.
- Move Business canonical details/domains to Business module presentation and retain linked read-only summary.
- **Gate:** all existing features reachable; links and back navigation tested.

### Batch 3 — Shorten Subscription & Billing and resolve ownership
- Compact snapshot/usage/expiry/upgrade surface; advanced detail on demand.
- Model payer/issuer correctly, ensure Business tax management remains in Business scope.
- **Gate:** displayed prices, terms, limits, statuses match authoritative snapshot; subscription actions permissioned.

### Batch 4 — Operations / Team & Access
- Provider-specific operations list/edit; missing relation guidance.
- Administrators + invitations UX; stable user verification and role scopes.
- **Gate:** no cross-provider access; invitations behave correctly; locked relationship semantics preserved.

### Batch 5 — Platform Admin delegated editing
- Implement on-behalf actions for both Business and Provider using approved backend capabilities, actor attribution, reason/audit and standard domain validation.
- **Gate:** positive and negative permission tests; no impersonation, no immutable version bypass, no self-approval where forbidden.

### Batch 6 — Documents, Reviews and Activity
- Provider doc list and inline authorized preview; review drawer/timeline; last 10 audit rows and server paging where available.
- **Gate:** scan lifecycle and preview security tests; scoped review list and accurate history.

### Batch 7 — Final quality and visual verification
- Desktop ~1440px, tablet 768px, mobile 390px; compare screenshots and ensure no clipping/overflow or giant unused whitespace.
- Run TS typecheck, ESLint, unit, integration tests, production builds; Rails tests, `rails zeitwerk:check` and related request/policy tests in runnable environment.
- Fix discovered regressions. Update screen/API matrix, capability checklist and ADRs; report work actually performed.

## H. Acceptance scenarios (test with real API or controlled test fixtures)

### Status + navigation
- [ ] Provider lifecycle, Business verification, onboarding readiness and subscription display separately and correspond to backend fields.
- [ ] Review setup clearly identifies incomplete tasks; finished tasks do not falsely suggest missing grants.
- [ ] Active provider with no Business Operation is explained accurately; no unsupported editing of locked relation.
- [ ] Seven top tabs cover all previous features; every old deep link still resolves.
- [ ] Business-owned legal/tax/branding/domain data is not redundantly editable on Provider pages.

### Subscription
- [ ] Current plan displays available human-readable plan name, price, cadence, validity and entitlements; UUID not primary label.
- [ ] Usage vs quota is correct and includes 'unavailable' for absent data; no made-up counts.
- [ ] Accepted snapshot and pending upgrade remain discoverable without a giant default page.
- [ ] Plan actions respect payment, approval and subscription permissions; Business sharing doesn't grant sibling access.

### Delegated Platform Admin
- [ ] Authorized Platform Admin can open the right Business/provider form and submit a valid mutation on behalf of that target.
- [ ] Audit identifies real Platform Admin actor and target owner, with required reason and request correlation.
- [ ] No silently impersonated user, no direct approved-value overwrite, no unauthorized self-approval.
- [ ] Negative cases: unauthorized role, cross-business, sibling-provider, stale revision, invalid target and missing reason rejected by backend.

### Operations and team
- [ ] Missing Business Operation state and change restrictions produce useful next action.
- [ ] Verified contacts and administrator membership are distinct; platform can invite under correct permissions.
- [ ] Invitation delivery, status, resend/revoke and membership scope operate as API permits.

### Documents, review, audit
- [ ] Document upload and listing, scan status and authorized preview operate; unsafe evidence never activated.
- [ ] Business documents do not leak into Provider ownership and vice versa.
- [ ] Review timeline distinguishes provider onboarding from Business compliance and has correct permissions.
- [ ] Audit displays last 10 server-authoritative results, truthful actor info and paging semantics; no fabricated names/totals.

### Presentation + quality
- [ ] Color communicates success / pending / blocked consistently with visible text and accessible contrast.
- [ ] Duplicate large headings, repetitive six-step ribbon and excess whitespace removed.
- [ ] Responsive layout at desktop/tablet/mobile; keyboard navigation and focus management validated.
- [ ] No UUID as primary display in tab content, tables, menus, notifications and history.
- [ ] Typecheck, lint, backend tests and build commands recorded with exact outcomes.

## I. Required Codex output format after each batch

```text
Batch:
Scope/decision:
Confirmed source-of-truth and relevant API contract:
Files changed:
API/migration/ADR changes (if any):
Permissions and security checks:
Tests actually executed, commands and outcomes:
Screenshots compared / viewport / reference:
Remaining blockers and next batch:
Status: PASS | FAIL | BLOCKED | NOT RUN
```

Do not mark PASS based solely on code inspection or an attractive screenshot. Use real browser/API tests where possible; label unavailable environments BLOCKED. Do not mark a backend error resolved without reproduction and regression verification. No production data changes without explicit separate approval.

## J. Immediate Codex kickoff prompt

```text
TRISE: Implement the attached Service Provider Details ownership and UX refactor.
Read docs/codex/TRISE_Service_Provider_Details_Redesign_Codex_Feed.md.

Verify your actual frontend checkout path and the backend at ~/wrk/trise/trise-api. Inspect the current architecture, OpenAPI, ADRs, roles, all nine existing provider tabs and tests.

First provide a concrete ownership matrix/API gap report. Then implement batches 1-7 incrementally, preserving the original features and authoritative status semantics. Do not stop at planning.

Specific priorities:
- Canonical Business legal, tax, licence, identity domain and logo data belongs to Business; Provider shows authorized linked summaries.
- Reduce nine tabs to the seven specified tabs, keep backward-compatible routes, and show setup checklist on demand.
- Shrink Subscription & Billing into clear current plan/usage/expiry/upgrade overview.
- Allow authorized Platform Admin to manage approved Business and Provider tasks on their behalf, without impersonation or bypassing verification/approval/audit.
- Use human-readable labels and restrained consistent status colors.
- Diagnose Active-vs-not-complete, missing Business Operation and missing admin issues without fabricating states.
- Retain document security, scope, compliance immutability, permission and subscription safeguards.

Run actual browser/API tests and report each batch with files, contracts, commands, results and unresolved blockers. Do not claim completion without verified functionality.
```
