# Operations UI refinement — 11 October 2026

## Provider subscription and audit detail update

Redesigned the accepted subscription card using the UBold `Task Details.pdf`
grouped summary pattern; inspected `Time Line Template.pdf` and its dated
vertical event markers for the subscription-history popup. A missing
subscription now offers a published-plan request in provider details when the
signed-in account has the existing subscription-write capability. Timeline
records are fetched from the provider-scoped subscription, request, change and
invoice APIs when opened. Provider details now also has a separate Audit
history tab using only the bounded `audit_history` included in the
platform-authorized provider detail response. An attempted provider-scoped
`/audit-events` read returned `Provider context is not authorized`; that
request was removed and is not retried. The table sorts the returned events
newest-first, shows 10 per page, and filters those returned records by date,
action and actor type. The Request ID column is replaced with the provider/
party display name from provider details; this identifies the subject of the
history, not the acting user. The response has no individual actor name or user
ID, so the table cannot identify a person or show audit records beyond the
bounded provider detail payload. The server remains authoritative for audit
access.
Formal browser rendering is not claimed because the preserved Chromium launch
blocker remains unresolved.

User authorized typography, alignment, semantic colors, compact forms/dialogs,
and searchable selectors with a three-character minimum and sorted results.
Existing uncommitted work and Customer rendering are preserved.

References inspected before edits: local UBold `Tables.pdf` (compact table rows,
search above the table, distinct status colors, restrained row actions),
`Task Details.pdf` (grouped detail cards, readable labels and history), and
`Form.pdf` (labelled compact inputs, consistent heights and validation).
The architecture index's long screenshot filenames are absent in this checkout;
these present local PDFs supply the corresponding patterns.

Apply these patterns in Operations only. Short request/invoice/contact forms
open in accessible dialogs; long business-profile/office forms remain grouped
pages. Opening a selector lists all loaded authorized records in sorted order. Search
filters after three trimmed characters; results retain actual IDs and expose
keyboard selection. Existing
API permissions, revisions, idempotency and business decisions remain intact.

Implemented Operations-only typography, label/control spacing, aligned filter toolbars,
compact table actions, readable plan/version labels, grouped detail cards, semantic
status badges, responsive navigation and dark-theme button contrast. Provider
registration, contact create/edit, subscription requests and invoice creation open
native modal dialogs with Escape, focus restoration, explicit Tab wrapping and
busy close guards. New plan is separate from catalogue search; its longer form
remains a page. Long business-profile/office forms remain grouped pages.

Actual Chrome DevTools MCP evidence (separate from Playwright):

- Operations: inspected provider directory/detail, registration, contact editing,
  office form, subscriptions, requests, billing and plan catalogue using the
  normally authenticated existing platform account and earlier approved sample.
- Provider search: the selector now opens with all loaded authorized providers
  sorted. Search filters after three characters; a three-character MCP query
  returned the real test provider. Clear restored blank search and the directory
  returned to seven loaded providers.
  No new provider/contact/subscription/invoice was committed in this UI pass.
- Request selector (updated behavior): opening Provider showed all seven loaded
  providers in sorted order with no query. Typing MC kept all seven visible; MCP
  filtered to the actual test provider. The published-plan selector showed both
  currently published choices, sorted, before typing (the ended Plan 1 is not
  offered). Selection retained real IDs. Escape closes the results first,
  then the dialog and restores New request focus. Shift+Tab at Close wrapped to
  Create request; Tab there returned to Close, both inside the modal.
- Request and invoice submission with a missing date triggered native required
  validation and sent no business POST. Empty provider registration likewise
  blocked submission. Existing paid invoice and active subscription remained
  readable; contact edit loaded existing values and Cancel made no write.
- Operations reviewed at 1440x900, 820x1180 and 390x844. Narrow filters stack,
  forms/dialogs fit the viewport, and wide tables scroll inside their container.
  Mobile document width measured 390 at viewport 390. Light and dark status
  colors reviewed, and theme restored to System.
- Customer signed-out screen inspected at desktop/mobile; no Customer or shared
  primitive stylesheet changed. Protected Customer workflows were not rerun.
- Instrumented fresh Operations read: no uncaught exceptions, unhandled
  rejections or failed fetches. Two initial /me 401s were followed by refresh
  200 and successful API reads. Tool console/network evidence preserves these.
  Customer retains the previously recorded GSI origin-not-allowed error and
  signed-out/session 401s; Google sign-in is not accepted by this pass.

14 real screenshots and sanitized diagnostics are in
[ui-refinement-20261011](../evidence/ui-refinement-20261011/), including
[desktop requests](../evidence/ui-refinement-20261011/requests-desktop.png),
[mobile requests](../evidence/ui-refinement-20261011/requests-mobile.png),
[request search](../evidence/ui-refinement-20261011/request-search-dialog.png),
[contact edit](../evidence/ui-refinement-20261011/contact-edit-desktop.png),
[dark theme](../evidence/ui-refinement-20261011/requests-dark.png), and
[plans](../evidence/ui-refinement-20261011/plans-desktop.png).
The updated all-provider dropdown is captured at
[request-all-providers-dropdown.png](../evidence/ui-refinement-20261011/request-all-providers-dropdown.png). Screenshots of forms were captured during the review; later fixes also added
focus wrapping, closed the previous selector on focus movement, and retained
nowrap badges and styled onboarding tabs. This is sampled rendered acceptance,
not an assertion that every Operations/provider route has been exercised.

Automated checks: typecheck, lint, 134 tests in 22 files, Customer and Operations
production builds, bundle budgets and git diff --check passed. No API/domain,
authentication, grant, migration or production rollout changes in this UI pass.
The preserved sandbox-enabled Playwright CLI launch failure still blocks formal
Playwright acceptance; no retry or sandbox bypass is authorized.


## Provider detail section redesign — 11 October 2026

The provider detail page now separates Overview, Subscription, Business details,
Documents and Review history into compact, responsive section controls. Overview
keeps provider identity/status and platform audit history together; subscription
records, business evidence, document preview and review decisions render only in
their respective section. The existing onboarding steps and action permissions
remain available. Historical plan IDs resolve to plan name/version when the API
returns that version.

Inspected the existing rendered page before changes and used the recorded UBold
Task Details grouped-detail pattern. Authenticated MCP review confirmed Overview,
Subscription, Business details, Documents and Review history render correctly;
mobile at 390x844 wraps the section buttons into two columns with no page-width
overflow. No business writes occurred. Screenshots: [Overview](../evidence/ui-refinement-20261011/provider-details-overview.png),
[Subscription](../evidence/ui-refinement-20261011/provider-details-subscription.png),
[mobile Review history](../evidence/ui-refinement-20261011/provider-details-review-mobile.png).

## Default onboarding demonstration subscription — 11 October 2026

Provider onboarding now preselects the published “Platform Demonstration” plan:
INR 0, 14 days, 15 managed assets and 2 agents. Leaving that selection in place
does not submit a paid-plan request. The API assigns it transactionally at the
provider's first activation only when there is no explicit pending/accepted plan
request. Validity starts at the server-recorded business verification timestamp;
the end date is exactly 14 days later. Explicit plan selections retain the
existing review and payment flow. The Operations screen follows the UBold
subscription catalogue's plan-card hierarchy and restrained status treatment;
the subscription panel presents the default and its validity basis as grouped
details.

Validation: Operations TypeScript check, changed-file ESLint and production
build passed; the onboarding routing/workflow tests passed (34 tests). Focused
API regression tests passed (21 tests, 145 assertions), and the bundle budget
check passed. The full UI suite passed under the repository-supported Node 24
runtime (134 tests across 22 files). An initial Node 18 run was also attempted;
Node 18 is below the Vite requirement and caused two environment-related
`crypto` failures, so it is not used as the final suite result. Chromium was
not retried: the preserved launch failure still blocks browser-rendered
acceptance, and no new screenshots or page diagnostics were captured for this
change.



## Provider detail section redesign — 11 October 2026

The provider detail page now separates Overview, Subscription, Business details,
Documents and Review history into compact, responsive section controls. Overview
keeps provider identity/status and platform audit history together; subscription
records, business evidence, document preview and review decisions render only in
their respective section. The existing onboarding steps and action permissions
remain available. Historical plan IDs resolve to plan name/version when the API
returns that version.

Inspected the existing rendered page before changes and used the recorded UBold
Task Details grouped-detail pattern. Authenticated MCP review confirmed Overview,
Subscription, Business details, Documents and Review history render correctly;
mobile at 390x844 wraps the section buttons into two columns with no page-width
overflow. No business writes occurred. Screenshots: [Overview](../evidence/ui-refinement-20261011/provider-details-overview.png),
[Subscription](../evidence/ui-refinement-20261011/provider-details-subscription.png),
[mobile Review history](../evidence/ui-refinement-20261011/provider-details-review-mobile.png).


## Provider detail dashboard redesign — 11 October 2026

Reviewed the actual provider-detail screenshot and the existing React route,
provider onboarding, business-profile, document, review, subscription, audit,
capability and OpenAPI contracts before editing. Applied the local UBold
`Task Details.pdf` hierarchy: compact provider identity and independent status
badges, evidence-derived onboarding progress, grouped overview cards, and a
bounded recent-activity list. The redesigned detail navigation retains all six
sections: Overview, Subscription, Business details, Documents, Reviews &
approvals, and Audit history. Tabs are addressable by `?tab=...`, keyboard
operable, and the subscription section is shown only when the existing
subscription and plan read capabilities are present. The Operations shell now
identifies Platform Administration and provides a keyboard-dismissible mobile
navigation drawer.

The overview uses existing provider, business, onboarding, subscription,
usage and audit APIs. Optional provider-detail reads now fail independently so
one unavailable endpoint does not erase other successful sections. Usage
warnings depend on the API's `exceeded` result; no plans, prices or usage values
are fabricated. Readiness comes from independent workflow evidence and does
not infer all onboarding completion from Active lifecycle status. Existing
mutation routes and server authorization remain authoritative; no API contract,
permission or database change was introduced.

Known data limits are shown rather than filled with synthetic values: the
current business-profile contract does not supply an industry/category field;
its contact profile does not supply the contact email; and audit results expose
actor type but not the acting user's display name or identifier. Provider audit
history remains bounded by the provider detail response. These are integration
or domain-data gaps, not UI-created values.

Non-browser validation is recorded after the implementation checks below.
Browser-rendered visual acceptance remains **BLOCKED** by the previously
preserved sandbox-enabled Chromium launch crash. No browser relaunch was made;
no screenshots or authenticated UI outcomes are claimed for this redesign.
