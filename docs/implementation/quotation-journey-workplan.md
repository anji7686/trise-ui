# Quotation journey implementation work plan

**Status: IMPLEMENTATION COMPLETE · EXTERNAL DELIVERY RECONCILIATION PENDING · 2026-10-30**

This plan covers the provider quotation journey, customer review, and AMC
handoff. The goal is to close real workflow gaps while preserving the behavior
of installation, service, repair, renewal, and other quotation purposes. The
existing completion evidence remains in the
[quotation and customer journey tracker](quotation-customer-journey-completion-tracker.md).

Use existing API contracts and approved domain rules. A task that requires a
new API contract, schema/cardinality change, permission change, or a business
decision about tax, settlement, activation, safety, or contract policy stays
blocked on the relevant architecture/product approval; the UI must not invent
that behavior.

## Work sequence and acceptance evidence

| ID | Workstream | Status | Acceptance evidence |
| --- | --- | --- | --- |
| QW-01 | Reconcile the live UI, API, tracker, and architecture plan; record supported quotation purposes and lifecycle capabilities | COMPLETE | All 11 API purposes are centralized in `quotation-types.ts`; existing customer, API and architecture trackers checked; only the historical SMTP delivery remains externally unresolved |
| QW-02 | Fix the AMC checklist message and show the selected plan's actual linked checklist in draft review | COMPLETE | Provider form lists checklist name/version/count per selected lift; plan versions without checklists are labeled accurately; API quotation snapshot tests pass |
| QW-03 | Make mock readiness checks reflect scenario state; clearly distinguish simulated actions from real workflow | COMPLETE | Four blocker scenarios show a blocked policy check and disable issue; later-stage checks show pending; design verification passed with no browser errors or responsive overflow |
| QW-04 | Verify quotation create/edit/revise/issue behavior for installation, repair/service, AMC, and renewal; preserve purpose-specific fields and rules | COMPLETE | Authenticated browser E2E visits every supported create route and checks headings, lift context, and stage-payment isolation; existing lifecycle E2E covers edit, revision, issue, provider approval and acceptance |
| QW-05 | Verify multi-lift line assignments, shared items, price/tax totals, inclusive/exclusive treatment, templates, and customer/PDF snapshot parity | COMPLETE | Existing API and UI suites cover multi-lift scope, tax snapshots and customer/PDF output; eight-lift customer review and tax visibility/suppression were verified live (see completion tracker) |
| QW-06 | Verify provider review, customer change request, exact-revision decision, communication, delivery status/recovery, audit/timeline, and role-gated actions | COMPLETE · 1 EXTERNAL RECONCILIATION | Provider review, customer change, exact-revision decisions, conversation, timeline and role gates are verified in existing API/UI coverage; one historical SMTP `PROCESSING` record still needs provider-side log evidence |
| QW-07 | Verify accepted quotation handoff to installation project or AMC contract, including renewal predecessor and per-asset scope | COMPLETE | Existing live development journeys verified installation project conversion and accepted AMC renewal successor contract |
| QW-08 | Reconcile post-acceptance billing/payment and service stages against existing APIs and approved policy; document exclusions if unresolved | COMPLETE · POLICY BOUNDARY PRESERVED | Existing finance and lifecycle permissions remain server-enforced; this work introduces no settlement, activation or post-acceptance policy changes |
| QW-09 | Run regression verification for all quotation purposes, themes, desktop/mobile layouts, and key error/recovery cases | COMPLETE | Authenticated purpose-route E2E; 71 UI test files / 473 tests; lint, UI/E2E typechecks, production builds, bundle limits and diff checks passed; responsive/customer regression evidence is in the completion tracker |
| QW-10 | Update tracker and user-facing implementation handoff with completed items and any approval-gated remainder | COMPLETE · EXTERNAL RECONCILIATION PENDING | This plan and the quotation/customer tracker record the only outstanding external SMTP evidence requirement |

## Known discrepancies and boundary

- Resolved: the provider AMC quote form now lists the selected plan version's
  pinned checklist names, versions and counts; it no longer claims the quote
  cannot carry them.
- Resolved for the current implementation: the mock's missing-specification,
  unmatched-catalog, missing-tax and expired-validity scenarios block issue.
  These remain mock scenarios, not server acceptance evidence.
- The older architecture plan's TODOs predate the implementation evidence
  linked here. No architecture or permission decision was changed.
- Remaining operational item: delivery
  `01a16e5f-19e8-7adf-8e8a-93d0b6d8afba` is still PROCESSING without SMTP
  acceptance evidence. Do not retry until secured SMTP/provider logs resolve
  whether it was accepted.

## Regression boundary

Quotation behavior remains purpose-scoped. AMC-only controls must remain inside
the AMC create/revision path. Shared fixes to totals, customer preview, PDF,
revision history, or action controls must preserve installation and
service/repair quotation behavior. Verify generated API types rather than
creating client-only business rules.

## Progress log

- **2026-10-30:** Added the five quotation purposes that were missing from the
  new-quotation chooser. Centralized all eleven valid purpose codes so route
  parsing and labels share one source. Repair and parts now include linked asset
  selection, while installation stage-payment configuration remains purpose
  gated. Added purpose coverage and AMC checklist summary unit tests.
- **2026-10-30:** Corrected the provider AMC form's stale checklist warning and
  listed each selected plan's pinned checklist names, versions and check counts
  before draft creation. UI lint passed; the full UI suite passed (473 tests / 71
  files); focused quotation and provider-plan API integration tests passed (61
  runs / 572 assertions). Production builds passed before the latest type-route
  changes; typecheck/build and live route checks are in progress.
- **2026-10-30:** Added readiness states to the mock for missing specs, unmatched
  pricing, missing tax and expired validity. Each blocks mock issue, while
  delivery, revision and acceptance remain pending until reached. The design
  verifier passed those four scenarios plus the 30 existing responsive checks
  with no browser errors or overflow. Evidence is in
  [design verification](../../../trise-architecture/docs/design/amc-journey/VERIFICATION.md).
- **2026-10-30:** Live Operations browser confirmed the chooser now exposes all
  eleven API purposes, Repair and Parts route to their matching forms, both
  include customer-linked lift selection, and New Asset opens its correct
  generic form. Repair and Parts no longer receive installation stage-payment
  controls. No quotation was created or issued during this check.
- **2026-10-30:** Added an authenticated, read-only browser E2E that opens all
  eleven chooser cards and verifies purpose-specific headings, lift selection
  for service/repair/parts, and stage-payment controls only for installation,
  modification and takeover. Passed 1/1 on Operations desktop; it creates no
  quotation and makes no commercial state changes.
- **2026-10-30:** Final regression gates passed: UI lint, UI typecheck, E2E
  typecheck, 71 UI test files / 473 tests, both production builds, compressed
  initial bundle budgets and `git diff --check`. Operations emits the existing
  Vite advisory for a large uncompressed chunk; configured compressed limits
  pass. Existing focused API integration suites passed earlier in this work.
- **2026-10-30:** Reconciled the workplan with prior completed evidence for
  customer review, eight-lift scope, tax/PDF disclosure, provider review,
  customer decisions, installation conversion and AMC renewal. All
  implementation workstreams are complete; only the separately tracked
  external SMTP reconciliation remains pending.
