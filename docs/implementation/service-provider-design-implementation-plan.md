# Service-provider design implementation plan

Status: Batch 0 audited; Batch 2 leads, Batch 7 AMC/customer assets, and Batch 8 workforce actions and qualification capture implemented. Updated 2026-10-17.

## Resolved repositories and references

- React: `/Users/anjanreddy/wrk/trise/trise-ui` (branch `master`)
- Rails API: `/Users/anjanreddy/wrk/trise/trise-api` (branch `codex-backend-mvp-rc`)
- Architecture: `/Users/anjanreddy/wrk/trise/trise-architecture` (branch `proposal/batch-4-7-contract-package`)
- Design pack: `docs/design/service-providers/`
- Authoritative execution feed: `docs/design/service-providers/Implementation/TRISE_Service_Provider_Codex_Execution_Feed.md`

The three repositories contain pre-existing uncommitted work. It is preserved and treated as user-owned.

## Batch plan and current status

| Batch | Scope | Status | Evidence / next action |
|---:|---|---|---|
| 0 | Repository, design, contract and lifecycle audit | Complete | 52-row crosswalk created; PDF page counts and PNG inventory confirmed; existing tests/scripts identified. |
| 1 | Shared provider shell, responsive primitives, permission-aware states | In progress | Existing shell is usable at desktop/narrow widths; missing screen-specific navigation and reusable action surface are next. |
| 2 | Leads, surveys and quotations | In progress | Lead and draft quotation creation/edit, immutable quotation revision, follow-up, site survey and technical-requirement capture are reachable through real provider-scoped endpoints; customer acceptance remains. |
| 3 | Projects, stages and multi-lift conversion | Partial | Service-case/project/stage APIs and UI foundation exist; conversion and per-unit detail need completion. |
| 4 | Payments, release, materials and shipments | Partial | Existing service-case payment/shipment APIs and tests exist; UI actions and finance-release surfaces need completion. |
| 5 | Jobs, evidence, QA and handover | Partial | Jobs/execution/evidence foundation exists; independent QA and per-lift handover need reachable UI actions. |
| 6 | Requests and appointments | Implemented foundation | Real list/detail/create/transition adapters exist; visual parity and broader action evidence remain. |
| 7 | Customers, sites, assets and AMC | In progress | Customers/Sites/Assets have provider-scoped create and optimistic-concurrency edit actions; AMC exposes authorized renewal, immutable amendment and preventive iteration actions. Visual parity remains. |
| 8 | Workforce and reports | In progress | Workforce now has real agent, team, leave, availability, skill-attainment, certification-capture and server-authorized qualification verification actions; permission editing and report-builder APIs remain. |
| 9 | Overview and provider administration | Implemented foundation | Dashboard, provider business profile, team/access, invitations, custom roles, subscriptions and notification read paths are reachable through existing authorized components; notification-policy authoring remains in configuration coverage. |
| 10 | Cross-domain integration, responsive fidelity and readiness | In progress | UI build, bundle budget, typecheck, lint and 179-test suite pass; authenticated Playwright remains blocked by host browser startup permissions and API focused rerun is blocked by missing Bundler 4.0.21. |

## Batch 0 audit findings

1. Canonical backend capabilities are already present for service requests, bookings, jobs, assignments, visits, checklists, reports, quotations, service cases, stages, change orders, material requirements, shipments, payment schedules, payments, quality findings, workforce, customers, assets, documents, maintenance contracts, provider settings, notifications and subscriptions.
2. Server-side provider authorization, provider context, expected revisions and idempotency are established patterns. New UI code must not infer permission from labels or selected provider alone.
3. Accepted quotation revisions and promoted contract versions are immutable except for the explicitly governed succession boundary. UI actions must create revisions/successors instead of generic updates.
4. The existing Operations route has real pages for overview, requests, bookings, jobs, leads, quotations, projects, customers, workforce, provider administration and configuration. Workforce/audit currently use generic bounded previews and several designed modules are not reachable.
5. Authenticated visual verification is not yet available in this run. Automated checks and any approved Playwright evidence must be reported separately from the in-app browser status.

## Batch 0 evidence

- The execution feed, form inventory, README, UI plan, capability checklist and design coverage CSV were read from the service-provider design pack.
- The design pack contains 3 reference PDFs (56, 40 and 41 pages), 12 principal-screen PNGs and 40 form PNGs. PDF text was extracted read-only for page-to-form mapping; representative dashboard, leads and create-lead artwork was inspected at original resolution.
- The current crosswalk has 52 rows: all remain `BLOCKED_BROWSER_RUNTIME` for visual verification. After mapping the existing project, material, shipment, payment, job, execution, QA and conversion actions, the implementation counts are 30 implemented, 19 partial and 3 blocked.
- The API already provides provider-scoped, revision-aware AMC mutations. The UI now consumes those canonical contracts rather than creating client-only maintenance state.

## Batch 7 AMC implementation evidence

- Added `renewMaintenanceContract`, `amendMaintenanceContract`, `createMaintenanceIteration`, `transitionMaintenanceIteration` and contract asset-scope reads to the shared operations data adapter.
- The AMC workspace now supports renewal successor drafts, immutable amendments with optional asset add/remove, preventive iteration planning, and schedule/skip transitions. All mutations include idempotency keys and expected revisions.
- The report-builder and scheduled-delivery forms remain blocked because the API has no authorized provider report-schedule contract; the UI states this explicitly.

## Batch 3–5 implementation evidence

- Project detail exposes server-backed accepted-order conversion, stage planning/transitions, material requirements, shipment dispatch and delivery reconciliation, method-specific payment collection, linked installation job creation, quality findings/reinspection and per-unit handover.
- Jobs and execution expose assignment, persisted visits/checklists/reports/work sessions, notes, parts and evidence flows. These are counted as implemented in the crosswalk based on source/API integration; authenticated visual comparison remains blocked.
- Stage release remains partial because the API does not expose a distinct provider stage-release projection beyond payment transition and server gate enforcement.

## Batch 2 leads evidence

- The existing Leads & Site Surveys workspace was verified against the Rails routes and controller authorization map. Follow-up, survey and technical-requirement forms call the canonical `marketing-leads/:leadId/activities`, `site-surveys` and `requirements` endpoints with idempotency keys.
- The coverage crosswalk now marks lead creation, follow-up, site survey, requirements capture and the Leads screen as implemented. Lead editing remains partial because the current workspace exposes the detail projection but not a complete PATCH editor.

## Customer/site/asset create evidence

- `#customers` now uses a dedicated `CustomerOperations` workspace with server-backed forms for customer relationships, service locations and elevator assets.
- The forms load provider-scoped relationships, locations, asset definitions and assets before enabling dependent actions. They do not fabricate IDs or claim edit support where the current route projection is incomplete.

## Batch 8 workforce evidence

- `#workforce` now uses `WorkforceOperations` with provider-scoped create-agent, create-team, leave-request and availability forms.
- Mutations call canonical Rails endpoints with idempotency keys; the server remains responsible for provider authorization, leave lifecycle and availability validation.
- Qualification capture now loads provider-scoped skill/certification definitions and persists agent skill attainments and certifications through the canonical nested endpoints. The selected agent profile reads back server verification state.
- Qualification review now supports verify, reject and revoke with required reason and expected revision through the canonical verification endpoints. Staff permission editing remains separate; no client-side permission mutation was invented.

## Implementation rules

- Extend canonical models/controllers and existing `operationsData`; do not create duplicate elevator-specific domain tables.
- Keep all mutations server-authorized, revision-aware and idempotent.
- Keep customer, site, asset, job, payment, shipment, QA and AMC facts canonical in Rails.
- Mark unsupported or unavailable actions as unavailable with the server reason instead of rendering a fake success path.
- After each batch run the Rails focused tests, UI typecheck, lint, unit/integration tests, production builds, bundle checks and `git diff --check`.

## Batch 9 administration evidence

- Team & Access exposes provider-scoped member, invitation, default-role and custom-role workflows through `ProviderAccessPage`, `ProviderMembers`, `ProviderInvitations` and `accessData`.
- Provider business profile, subscriptions, onboarding, notification read and audit paths reuse existing authorized operations components and do not introduce client-side access decisions.
- Notification-policy authoring remains under typed configuration because the API requires governed policy/template/trigger relationships; no fake provider-admin action was added.

## Batch 10 validation evidence

- `npm run build` passed for customer and operations.
- `npm run check:bundle` passed: customer 70,171 compressed JS bytes; operations 147,620 compressed JS bytes, both below the 204,800-byte budget.
- Typecheck, lint and unit suite passed immediately before this checkpoint: 179 tests across 33 files.
- The first Rails rerun used the system `/usr/local/bin/bundle` and selected Ruby 2.6 incorrectly. The API now uses the repository-pinned rbenv toolchain (`rbenv exec bundle`, Ruby 4.0.7, Bundler 4.0.21); deterministic test secrets and serial-by-default execution remove global security-test leakage. The complete suite passes with 761 tests and 5,142 assertions.

## Known blockers

- In-app browser runtime/authenticated provider session is unavailable in this environment, so visual comparisons remain `BLOCKED_BROWSER_RUNTIME` until a permitted browser session works.
- Some designed controls have no corresponding authorized API projection yet. Those rows remain explicitly blocked in the crosswalk rather than being implemented as client-only state.
