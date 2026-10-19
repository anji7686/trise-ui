## Agent screen visual review — 17 October 2026

The supplied Operations capture was reviewed against the current `Jobs` / `My Work`
implementation and the Agent application contract. The screen is functionally
structured around authorized assignments, server-confirmed accept/decline, visits,
state transitions and execution evidence. The current visual issue is information
density: the page presents a very long stack of similarly weighted rows, with weak
separation between queue metadata and execution actions. This makes the Agent's next
action difficult to scan and pushes the meaningful execution controls far below the
page fold.

Recommended design direction: keep the existing API and authorization boundaries,
but reshape My Work into a focused operational queue. Add a compact summary strip for
today's assignment counts, a single search/status/priority filter row, and queue rows
with a stronger left-to-right hierarchy: status/priority marker, job and site summary,
schedule/SLA metadata, then one primary next-action button. Keep accept/decline as
the proposed-assignment action pair; move visit, transition and evidence controls
into an expanded row or detail drawer. Use the UBold List/Tables and Task Details
patterns already indexed by the UI governance, adapted to TRISE labels and API data.
On narrow screens, stack metadata above actions and keep the primary action sticky or
adjacent to the assignment header; do not expose customer, location, SLA or emergency
details unless returned and authorized by the API.

Fresh terminal Playwright launch establishment was attempted with:

`TRISE_E2E_DEVELOPMENT_SIGN_IN=true npx playwright test tests/e2e/public.spec.ts --project=operations-desktop --workers=1 --retries=0 --reporter=list`

Chromium launched and then exited before page creation with `SIGTRAP`; the repository
configuration still has `chromiumSandbox: true`, and no bypass flags or Codex Browser
integration were used. The preserved raw Playwright error context is
`test-results/public-signed-out-screen-p-01e58-flows-and-fits-the-viewport-operations-desktop/error-context.md`.
No Agent navigation, screenshot, responsive check, console/request diagnostics or
authenticated workflow result is claimed. Browser acceptance for this review is
**BLOCKED**.

## Invoice browser and central-tax verification — 15 October 2026

Real host-managed Chromium startup passed the signed-out Operations smoke (**1/1**)
with the repository’s existing `chromiumSandbox: true` setting and no bypass flags.
The authenticated invoice smoke then passed (**1/1**): the four-step routed wizard
rendered, an active subscription was selected, the server tax preview returned
`READY`, and an issued invoice PDF rendered in the authenticated inline iframe.
Provider private evidence Preview/Download also passed (**1/1**), and the corrected
Business compliance and Approval Inbox tests passed (**1/1** each). No credentials,
tokens or cookies were logged or persisted.

The reported `REVIEW_REQUIRED` response was a real development governance issue, not
a browser issue. The development database had SAC `9983` description:
`candidate - verify exact entry and conditions`, which the central resolver correctly
rejects. The existing development-only approved-fixture seed was applied with the
synthetic reviewed classification description. Read-only resolution now confirms the
reported subscription has India/Karnataka recipient context, registered GSTIN,
approved SAC `9983`, published intra-state rule and `INTRA_STATE` supply type.

Development-only commands/evidence are documented in
`trise-api/docs/central-saas-tax-governance-workflow.md`. Production legal tax
classification remains subject to actual legal review; no production rule was
approved or bypassed. The current development document fixture still reports
`Not Scanned`; malware-scanning safeguards remain enabled.

Artifacts: `/tmp/trise-invoice-browser-verify.json`,
`/tmp/trise-business-browser-verify.json`, and the invoice test result directory
under `test-results/subscription-invoice-brows-3b350-oute-and-inline-PDF-preview-operations-desktop/`.

## Business compliance history and audit correction — 15 October 2026

An authenticated Global Administrator request to Business compliance history
initially returned HTTP 500 for both seeded demo Businesses, for both `versions`
and `audit`. Rails logs identified the exact error as
`NoMethodError: undefined method 'positive_integer_param' for an instance of
Api::V1::PlatformBusinessesController`. The platform capability check had
already succeeded, so this was a controller defect rather than an authorization
failure.

The shared positive-integer pagination helper was added to
`PlatformBusinessesController`, and a platform administration integration
regression now covers both history modes. Normal local development sign-in as
the approved Global Administrator then returned HTTP 200 for all four requests:
Solar Business versions **17 rows**, Solar Business audit **67 rows**, Elevator
Business versions **2 rows**, and Elevator Business audit **8 rows**.

This is authenticated API evidence, not fresh browser acceptance. The current
Codex Chromium launch blocker remains preserved; no retry or sandbox bypass was
performed for this correction.

## Service Provider Details refactor — 15 October 2026

The Operations Service Provider Details renderer was refactored to seven
focused tabs: Overview, Operations, Subscription & Billing, Documents, Team &
Access, Reviews & Approvals, and Activity History. Existing provider detail
query links for the retired Business details and Tax & Billing tabs resolve to
the Overview linked-Business summary; onboarding URLs remain unchanged.

The setup checklist is now an Overview-only expandable panel. Provider and
Business editing forms show the real Platform Administrator on-behalf context.
Subscription plan/request options are collapsed by default when an accepted
subscription exists, and unresolved plan identifiers display “Plan details
unavailable” rather than a UUID.

Automated evidence: typecheck passed, ESLint passed, **32 Vitest files / 174
tests passed**, Operations and Customer production builds passed, and
`git diff --check` passed. The Platform Administration route is now lazy-loaded;
the Operations initial bundle is **123,934 / 204,800 compressed bytes**, so
`npm run check:bundle` passes. No backend API, migration, permission grant, or
database ownership change was made; existing server authorization and audit
workflows remain the source of truth.

No fresh browser screenshots or authenticated browser acceptance are claimed;
the preserved Chromium launch blocker remains active.

## Current verification update — 15 October 2026

The prior Codex-sandbox Chromium failure remains preserved at
`/tmp/trise-playwright-chromium-launch-20261014.log`. A narrow unsandboxed
Chromium execution was subsequently able to start real Chromium, so browser
startup is **PASS outside the Codex sandbox**; no security flags were disabled.

The Business compliance browser test was reached twice. The first authenticated
run exposed a real API defect in the shared storage-key validator: Business
document keys use the literal `businesses` scope segment, which was not accepted.
That validator was corrected and covered by a Rails regression. The focused
Rails/API suite then passed **52 tests, 365 assertions, 0 failures, 0 errors,
0 skips**.

After restoring the API with its existing local development environment loaded,
the authenticated Business compliance workspace passed **3/3** in unsandboxed
Chromium across desktop, tablet and mobile. The identity endpoint returned 200
for the approved Operations origin, and the workspace rendered its real Business
legal/GST/supporting-document data.
The earlier failed-run screenshot/trace remain retained under
`test-results/business-compliance-Platfo-537d8-siness-compliance-workspace-operations-desktop/`.
The strengthened Business browser acceptance now passes **3/3** across desktop,
tablet and mobile, including real create, signed upload, finalization and
persisted Business evidence listing. The corrected canonical key shape is
`businesses/<business>/<document>/<version>`; the focused API/validator suite
passed **43 tests, 317 assertions, 0 failures, 0 errors, 0 skips**.

The authenticated Provider evidence flow subsequently passed **1/1** for
private upload/submission and **1/1** for Preview/Download in unsandboxed
Chromium. Transfers returned short-lived authorized URLs without exposing an
object key. Artifacts are recorded in `/tmp/trise-provider-evidence-submission-20261015.json`
and `/tmp/trise-provider-document-transfer-20261015.json`.

Production-only items are intentionally tagged `PRODUCTION_PENDING` in the
architecture reports: expiry scheduler execution, notification-template
publication/delivery, strict CLEAN malware scanning, and broader production
authorization/legal-variant review.

## Compliance framework implementation — 14 October 2026

Terminal Playwright was attempted once for the compliance UI verification:

`TRISE_E2E_DEVELOPMENT_SIGN_IN=true PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/trise-compliance-browser.json npx playwright test tests/e2e/public.spec.ts --workers=1 --retries=0 --reporter=list`

The attempt was **BLOCKED before Chromium launch** by the local Node/npm
environment (`ERR_REQUIRE_ESM` while npm loaded `@npmcli/agent`), so no page,
screenshot, navigation, responsive, console, request or workflow evidence was
collected. No browser retry or sandbox bypass was performed. The existing
Crashpad/Mach launch blocker remains the authoritative prior browser evidence.

Rails and React validation for this slice is recorded below; it is not browser
acceptance.

## Independent environment diagnosis — 14 October 2026

The failure was reproduced before Playwright or Chromium page creation:

- macOS Darwin 24.5.0 on ARM64 hardware (`uname` reports `RELEASE_ARM64_T8103`).
- `/opt/homebrew/bin/node`: **18.20.8**.
- `/opt/homebrew/bin/npm`: **12.2.0**, which explicitly does not support Node 18.
- `@playwright/test` / Playwright: **1.64.0**.
- `npx playwright --version` fails in npm's CommonJS proxy loader with:
  `ERR_REQUIRE_ESM` loading `@npmcli/agent` → `http-proxy-agent/dist/index.js`.

This establishes a Node/npm compatibility failure before the browser runner
starts. It does not establish that the separate prior Chromium Crashpad/Mach
SIGABRT launch issue has the same root cause. No unsafe browser flags,
sandbox disablement or operating-system security changes were attempted.

Browser acceptance remains **BLOCKED_ENVIRONMENT** until a supported Node/npm
pair can start Playwright and a real Chromium page session can be executed.

## TRISE end-to-end verification request — 12 October 2026

## Business verified identity domains — 14 October 2026

Backend/API evidence for the Business-scoped verified identity-domain workflow
passed in the local development/test environment. The latest focused Rails
coverage passed 46 tests and 293 assertions, including Global Administrator authorization,
domain normalization and global uniqueness, DNS-token verification,
verification-before-approval, revision conflicts, suspension, resend token rotation,
configurable 24–48 hour expiry enforcement, audit records,
Google Workspace `hd` claim matching, cross-provider scoping, and the invariant
that domain-based Google identity linking creates no provider membership or
role. The local development migration for `provider_identity_domains` and its
global uniqueness constraint applied successfully.

Verification links default to 48 hours and are constrained to 24–48 hours by
the server environment variable `TRISE_IDENTITY_DOMAIN_VERIFICATION_TTL_HOURS`.
Global Administrators can resend a pending verification email from the
Business identity-domain panel; resend requires a reason and current revision,
invalidates the previous link, rotates the stored digest, restarts expiry, and
records `PROVIDER_IDENTITY_DOMAIN_VERIFICATION_RESENT`. Delivery status remains
visible to the platform UI so failed local SMTP delivery is not mistaken for a
sent email.

The public verification URL now targets the Operations UI route configured by
`TRISE_PUBLIC_APP_BASE_URL` (local default `http://127.0.0.1:4174`). The UI
calls the JSON-only public verification API in the background. Opening a valid,
unexpired link consumes the one-time token and immediately shows
“Thank you — email verified” with the next step: Global Administrator approval.
Invalid, expired, already-processed, and failed submissions show concise safe
guidance to request a new link or contact the organization administrator. The
API JSON response remains available for JSON clients. Rails verification and
mailbox regressions passed 43 tests and 277 assertions after this change; no
browser acceptance claim is made because the known Chromium launch blocker
remains active.

Operations UI typecheck passed. The latest focused UI test passed, covering
Identity Domains management-action visibility and the explicit statement that
domains do not grant provider membership or roles. The feature is rendered in
Platform Administration → Service Providers → Provider Details → Business →
Identity Domains and from the Business directory. The API stores domains against
the Business, allowing multiple domains while keeping provider membership and
role authorization independent. The add flow is a modal that collects the
Business domain, a matching verification mailbox, and an audited reason. The
backend sends a one-time email verification link; the link moves the domain to
pending approval, and only a Global Administrator can then approve it. The raw
token is not returned by the admin API. The panel also exposes a resend modal
for pending verification records with inline reason and API error validation.
Database uniqueness continues to reserve every existing domain record, while
Global Administrators can now delete only pending or suspended records with a
reason and revision check. The known local legacy records `sahayya.in` and
`trise.in` were removed through that audited API service; no active domain was
deleted, and the local domain table is now empty for fresh testing.

The existing terminal Playwright Chromium Crashpad/Mach launch failure remains
the authoritative browser blocker recorded below. No browser screenshot,
authenticated navigation, console/request capture, or rendered interaction
claim is made for this feature. API and component tests are not browser
acceptance.

The local startup script applied pending development migrations and confirmed
Rails `/up` returned HTTP 200, anonymous `/api/v1/me` returned the expected 401,
and Customer and Operations returned HTTP 200. The existing approved local
development sign-in verifier passed for all five configured test accounts,
including current-user, refresh, logout, and revoked-refresh checks. Focused
Rails integration coverage passed: 30 tests and 184 assertions, including
provider registration, Business grouping, one active operation per provider,
and operation-filtered plan eligibility.
Focused plan-version and subscription regressions also passed: 11 tests and 76
assertions, including the provider subscription request and change workflows.

The requested UI MCP/browser acceptance remains **BLOCKED**. The saved terminal
Playwright launch evidence records Crashpad Mach permission errors and SIGABRT
before page creation. The TRISE session requires terminal Playwright Test to
establish Chromium launch first and forbids retrying or bypassing protections
after that failure; no MCP browser session was opened. Therefore no current
screenshots, rendered navigation/form validation, browser console/request
diagnostics, or full UI workflow outcomes were collected. The API sign-in and
integration tests are not browser acceptance. No fake verification, activation
or subscription state was introduced. Through the normal authenticated platform
API, this run created the synthetic Business
`TRISE E2E Sample Business 20261011183408`
with two `PENDING` provider accounts: `E2E-ELV-20261011183408` mapped to
`ELEVATOR_SERVICES`, and `E2E-SOLAR-20261011183408` mapped to
`SOLAR_PV_SERVICES`. The Business grouping and each account's one active
operation were confirmed through the authorized detail/operations endpoints.
Neither provider was marked verified or activated, so no subscription was
assigned to these samples.

The local catalogue's earlier published seed versions had empty operation
applicability, which correctly returned zero matches. Using normal authorized
draft, validate and publish endpoints, new versions were published for the
approved 14-day free demonstration plan (all selectable operations) and the
seed-defined Elevator Plan 2 (Elevator only). Earlier versions and prices were
preserved. A fresh server-filtered catalogue read then returned the demo and
Elevator Plan 2 for Elevator, and the demo plan for Solar. This confirms the
API workflow and sample data; it does not establish rendered UI behavior.

## Single Business Operation per provider UI and lifecycle — 12 October 2026

The registration modal and full-page registration share `ProviderForm`; its
Business Operation control already creates one association from the dynamic
catalogue and proceeds to Business Profile. Business Profile and Provider
Detail previously rendered a catalogue-wide radio list, despite the accepted
one-operation-per-provider model. The shared Operations form rules also gave
generic text-input sizing to native radio/checkbox controls. Those selectors
now exclude native selection controls, constrain them to intrinsic dimensions,
and place the Existing/New Business radio inside compact, fully clickable
inline option labels. The same single searchable control now loads the
registration-saved operation into Business Profile. Provider Detail presents
the one operation and actual available subscription state without a catalogue
selection list or Primary Operation control.

The existing Operations provider selector continues to switch only among
provider accounts returned to the authenticated user. API provider context and
authorization regressions continue to enforce membership boundaries; a
Business association does not add sibling account access. No new workspace
switcher or cross-provider aggregation is implied.

The API rejects changing or removing an operation after activation through
the existing replacement endpoint, including for held, suspended or closed
accounts; there is no controlled transition workflow yet. Before activation,
the endpoint still enforces the selectable catalogue, one-operation maximum,
revision, subscription compatibility, authorization and audit rules. This
preserves existing records and does not add a schema migration.

Automated evidence: Rails provider administration integration tests passed
(28 tests, 179 assertions), and provider-context authorization regressions
passed (12 tests, 53 assertions); the Operations UI passed TypeScript, ESLint, all
148 Vitest tests, Customer and Operations production builds, bundle budgets,
and `git diff --check` under Node 24. The uncompressed Operations chunk still
emits Vite's existing >500 kB advisory, while its compressed initial bundle
remains under budget. A Node 18 test invocation reproduced two known
`crypto.randomUUID` environment failures; rerunning under the installed Node
24 completed cleanly.

Rendered browser acceptance remains **BLOCKED** by the preserved terminal
Playwright Chromium Crashpad/Mach launch failure documented above. No Chromium
retry, MCP browser retry, or security workaround was attempted. Consequently,
this report contains no new screenshots or claims about rendered alignment,
modal behavior, responsive appearance, browser console, or interaction flows.

## Subscription administration UI standardization — 11 October 2026

The platform subscription shell now uses the clarified navigation labels and
shared Operations admin header, filters, table, empty state and pagination
components. Plans & Pricing has cursor paging, supported server filters for
name, industry and plan status, a loaded-page billing-cycle filter, grouped
detail sections and API-returned plan audit history. Provider Subscriptions
and Requests & Approvals now expose URL-addressable details; the approval list
uses Review as its primary action. Request approval/rejection, payment-evidence
review and subscription activation remain separate capability-gated API
actions. Usage distinguishes finite, unlimited and absent entitlements and
shows the subscription's returned plan/status context. Billing uses a focused
invoice table and detail route with snapshot lines, tax totals and separate
evidence review/collection actions; add-on and tax catalogue cards were removed
from the main billing page.

Automated validation with the installed Node 24 runtime passed: typecheck, lint,
all 143 Vitest tests, both production builds, bundle budgets, and
`git diff --check`. The Operations build reports Vite's existing >500 kB
uncompressed chunk advisory; the compressed bundle check remains within its
budget. Browser screenshots and interaction diagnostics were not captured for
these changes. Per the previously preserved Chromium CLI launch crash, browser
acceptance remains **BLOCKED** and no Chromium retry or security workaround was
attempted. API filtering remains partial for subscriptions, requests, changes
and invoices; those pages explicitly label loaded-page filtering. Billing
cycle on plans is also a loaded-page filter. Tax/add-on catalogue management
has no independent administration route in this UI and remains an integration
gap. Invoice detail does not include an audit-history endpoint, so no audit
timeline is fabricated.

## Provider subscription detail, timeline and audit tab — 11 October 2026

The accepted plan now uses a compact grouped detail card, and missing
subscriptions expose the existing published-plan request flow from provider
details. Subscription timeline records are fetched when the modal opens and
presented with dated vertical markers based on UBold `Time Line Template.pdf`
and the grouped detail hierarchy in `Task Details.pdf`. The separate Audit
history tab now reads only the bounded `audit_history` included in the
platform-authorized provider detail response. The provider-scoped `/audit-events`
request was rejected with `Provider context is not authorized` and was removed;
it is not retried. Returned events are sorted newest-first and shown 10 per
page with local date, action and actor-type filters. The platform detail
contract supplies actor type but no individual actor name or user ID, so the
table cannot identify a person. The Request ID column is replaced by the
provider/party display name from the authorized provider detail record; this
names the subject of the audit history, not the acting user. These controls
paginate/filter only the audit records present in the provider response, not
the full audit stream. Typecheck,
lint, builds, bundle budgets, and `git diff --check` passed. Focused timeline
tests passed (26 before the final audit-source adjustment).
The full test run had 133 passing and 2 failing tests; both failures remain in
`subscription-support.test.ts` under Node 18 because `crypto.randomUUID` is
unavailable. The browser launch blocker remains recorded. No new browser
screenshot or authenticated interaction claim is made.

## Validity and open upgrade request display — 11 October 2026

The provider detail validity section now shows only validity status and
remaining days. Reminder details were removed from this screen for later
scheduled delivery. When loaded change history contains an upgrade in
`PENDING_REVIEW`, `APPROVED` or `SCHEDULED`, the upgrade section shows its
status, source plan, target plan and requested/effective time instead of
offering a second request. The request form appears when no such open upgrade
is present. Typecheck, lint, builds, bundle budgets and `git diff --check`
passed; the two existing `subscription-support.test.ts` failures and browser
launch blocker remain as recorded below.

## Validity reminder display update — 11 October 2026

In provider details, the Validity and reminders section now hides only the
`HALF_REMAINING` reminder and chooses the next upcoming reminder from the
remaining API-provided milestones. Seven-day, three-day, one-day and expiry
reminders remain visible. No reminder records or server policy were changed.
Typecheck, lint, both production builds, bundle budgets and `git diff --check`
passed. The full UI test run remains 132 passed / 2 failed in
`subscription-support.test.ts` because the current Node 18 runtime lacks the
global `crypto.randomUUID` required by those existing tests. No rendered
browser verification was performed; Chromium remains blocked by the previously
preserved launch failure.

## Provider subscription upgrade details — 11 October 2026

The provider detail Subscription section now exposes a capability-gated upgrade
request for active subscriptions. It displays the accepted current plan price,
remaining validity in days, and the selected published target plan price. The
request carries the current subscription revision and goes through the
existing platform change endpoint; review, verified payment evidence, and
application remain separate server-authorized steps. ADR-057 defines no
proration or automatic credit, so the UI does not accept or calculate a
remaining-time credit amount. The validity summary now shows days only.

Current automated evidence: typecheck, lint, both production builds, bundle
budgets and `git diff --check` passed. The Vitest run had 132 passing and 2
failing tests (both in `subscription-support.test.ts`, where Node 18.20.8 lacks
the global `crypto.randomUUID`; npm/Vite also report this Node version is below
their supported range). No application failure was reported by those tests.
Rendered verification for this change remains **BLOCKED** by the preserved
Chromium CLI launch crash documented in
[development-sign-in-launch.log](../evidence/development-sign-in-launch.log);
the launch was not retried and no new screenshots or authenticated workflow
claims are made here.

## Provider detail sections — 11 October 2026

Provider details now use five compact sections: Overview, Subscription, Business
details, Documents and Review history. Actual authenticated MCP review covered
all five at desktop plus mobile section wrapping. Screenshots and interaction
notes are recorded in [operations-ui-refinement-20261011.md](operations-ui-refinement-20261011.md).
This remains sampled MCP evidence; formal Playwright is still blocked by the
preserved Chromium launch failure.

## Provider detail sections — 11 October 2026

Provider details now use five compact sections: Overview, Subscription, Business
details, Documents and Review history. Actual authenticated MCP review covered
all five at desktop plus mobile section wrapping. Screenshots and interaction
notes are recorded in [operations-ui-refinement-20261011.md](operations-ui-refinement-20261011.md).
This remains sampled MCP evidence; formal Playwright is still blocked by the
preserved Chromium launch failure.

## Dropdown list behavior update — 11 October 2026

Opening provider, plan, invoice subscription and tax selectors now shows all
loaded available choices alphabetically. Text input filters only after three
trimmed characters. Provider choices load across authorized result pages; the
existing published-plan filter excludes ended versions. Chrome DevTools MCP
confirmed the request selector showed all seven provider choices with no query,
then narrowed to the test provider at three characters. This interaction made
no business writes. See [dropdown screenshot](../evidence/ui-refinement-20261011/request-all-providers-dropdown.png)
and the updated [UI refinement evidence](operations-ui-refinement-20261011.md).

## Operations visual refinement — 11 October 2026

**Sampled authenticated Chrome DevTools MCP visual/interaction review completed;
formal Playwright acceptance remains BLOCKED by the preserved launch crash.**
Operations typography, filters, table actions, status colors, compact dialogs and
three-character sorted lookups were refined using inspected local UBold PDFs.

Actual desktop/tablet/mobile evidence, navigation, selector keyboard behavior,
required-field validation, existing-record outcomes, diagnostics and limitations
are recorded in [operations-ui-refinement-20261011.md](operations-ui-refinement-20261011.md).
[14 screenshots and diagnostics](../evidence/ui-refinement-20261011/) cover the
Operations provider/subscription surfaces and the unchanged signed-out Customer
screen. Fresh Operations instrumentation recorded no uncaught exceptions,
rejections or failed fetches; initial /me 401s recovered through session refresh.
Customer still reports the known Google client-origin error. No business records
were changed during this visual pass. 134 tests, typecheck, lint, both builds,
bundle checks and diff whitespace checks passed. These are separate automated
checks and MCP observations, not a Playwright pass or full-route acceptance.


## Authenticated MCP provider/subscription walkthrough — 11 October 2026

**Core local workflows executed successfully through Chrome DevTools MCP;
full browser acceptance remains PARTIAL. Terminal Playwright acceptance remains
BLOCKED by the preserved Chromium launch failure below.** The latest user
explicitly requested MCP verification using the approved local sign-in and
sample data. No additional CLI launch, in-app Browser retry, sandbox change,
auth bypass, database restore, migration or new authority grant occurred.
This section supersedes historical statements below that authenticated
workflows had not run. MCP evidence is not a Playwright Test pass.

Operations used the existing `<PRIVATE_GLOBAL_ADMIN_EMAIL>` identity with its private
local secret and actual platform capabilities. Customer used the existing
`<PRIVATE_EMAIL>` identity. Credentials and tokens are absent from artifacts.
Normal sign-in, opt-in automatic submission with email plus secret, session
refresh and logout all executed. Required empty credentials prevented submission.
Logout removed private Operations content even with a protected hash retained.
Customer retained its own navigation and showed no platform administration.

### Isolated sample and actual outcomes

The browser created **TRISE MCP E2E Provider 20261011**, code
`MCP-E2E-20261011`, ID `01a12989-7aa5-7474-9d61-0cf974917536`.
Existing providers, plans and requests were not mutated. This is explicitly
synthetic local sample data, not external business or payment verification.

| Workflow | Actual browser result |
|---|---|
| Provider directory | Search by sample code plus Active filter returned exactly the intended provider; view/detail and onboarding routes selected its correct ID. Seven records loaded; Next/Previous disabled at the single-page boundary. Multi-page loading not exercised. |
| Register provider | Empty required name blocked submission. Real registration returned 201 after the local configuration fix described below. |
| Business profile | Legal name, registration and Bengaluru address saved; navigating back read the saved data. Submit produced Pending Review; review with explicit synthetic reason produced Verified. |
| Contact | Plain mobile number rejected with `+91XXXXXXXXXX` guidance. Corrected contact created (201), then name revised (200) using the existing contact record. One active contact remained; no login or membership created. |
| Office | Registered office with manual address/coordinates created (201). Address changed to 102 Local Test Road. Clearing both coordinate inputs through real input events saved nulls and displayed Not captured. No geolocation permission requested. |
| Provider lifecycle | Separate Activate provider command with reason and confirmation returned 200; subsequent reads showed Active and Verified. Administrator setup remained Not Configured. |
| Published plan/request | Existing Plan 1 selected, request `01a1298b-d4f6-72fa-9a03-eea78ae5f86d` created (201). Pending request did not appear as an active subscription. |
| Review | Empty reason disabled confirmation; cancelling the approval modal sent no decision mutation. Confirmed approval persisted independently of payment. |
| Request payment evidence | Activation before verification returned expected 409. Reference 001 submitted, correction requested with reason; replacement 002-CORRECTED submitted and verified. Earlier corrected evidence remained visible and immutable. |
| Subscription activation | Verified approved request activated (201); fresh subscription list/detail showed Active, Approved and Verified. |
| Upgrade | Plan 2 change created (201), approved with reason (200). Apply before separate change evidence returned expected 409. Synthetic change evidence submitted/reviewed; explicit apply returned 200. Fresh reads showed new Plan 2 Active, Plan 1 Ended, change Applied, empty due queue. |
| Accepted terms/usage | Provider review showed Plan 2 INR 3,999/month, validity 11 Oct–11 Nov 2026, 100 managed assets and 5 agents. Usage GET returned 200 with zero actual sample usage and remaining limits 100/5. Reminder milestones were projections; no outbound delivery ran. |
| Billing | Invoice `TRISE-202610-FC36F905BA`, ID `01a1299a-b72b-782e-bb45-19d42486d31c`, issued (201). Server subtotal INR 3,999; tax INR 719.82; total INR 4,718.82. Mark paid without invoice evidence returned 409 despite verified request/change evidence. Invoice-specific reference submitted (201), reviewed with synthetic reason (200), then Mark paid succeeded (200). Reload and fresh collection GET still showed Paid. |

Billing initially had no tax configuration. The user subsequently authorized
Indian government/GST policy for this local sample. [CBIC IT/ITES FAQ,
question 5](https://cbic-gst.gov.in/hindi/sectoral-faq.html) states 18% for IT
services. Applying that classification to this SaaS sample is an explicit
test assumption. Through the normal authenticated application API client,
`POST /platform/subscription-tax-rates` created `LOCAL-E2E-GST-18`, jurisdiction
IN, 18%, effective 11 October 2026, ID
`01a1299a-81fb-70df-a380-a2f440fd580c` (201).
Invoice issuance and evidence/paid actions used the actual screen controls.
This model records an aggregate rate; CGST/SGST versus IGST breakdown, GSTIN,
place-of-supply determination and production statutory invoice compliance
were not established by this test. No production tax configuration changed.

### Defects, corrections and diagnostics

1. Provider POST initially returned HTTP 500. Rails development logs identified
   `SecurityError: TRISE_IDEMPOTENCY_PEPPER is not configured`. A random private
   pepper was added to ignored local API environment configuration and only
   Rails restarted. Retrying the provider form succeeded with 201. The
   migration guard, authorization and database state were not bypassed.
2. Subscription SearchableSelect sent a selected combined label into its remote
   search callback, clearing options and invalidating the selection. It now
   searches only unmatched text and retains matched authorized selections.
   Browser retest loaded sample usage and submitted the Plan 2 upgrade.
3. Usage component fragments lacked list keys. Added keyed React fragments.
   Fresh document reload and usage render showed no React key warning.

Native MCP suggestion-popup/empty-fill interactions were unreliable: some
calls timed out or changed DOM values without updating React state. For
selection and coordinate clearing, actual existing input elements received
native value/input events, then ordinary screen submit buttons were clicked.
No hidden state, identity, token or server authorization was changed. Native
suggestion-popup usability is not marked passed solely from that fallback.

Captured listeners recorded **zero uncaught exceptions, unhandled rejections
or failed fetch requests** in the instrumented walkthrough. HTTP errors were
the diagnosed/fixed 500, expected anonymous/refresh 401s and deliberate
payment-gate 409s. DevTools console additionally retained Google origin
rejection, an earlier 404 resource message and the subsequently fixed React
warning. Google authentication remains unverified. Fresh usage/billing console
captures after fixes retained only initial session-probe 401 messages.

### Visual evidence and checks

Actual screenshot artifacts: [provider directory](../evidence/local-platform-e2e-20261011/directory-desktop.png),
[provider review](../evidence/local-platform-e2e-20261011/provider-review-desktop.png),
[subscriptions desktop](../evidence/local-platform-e2e-20261011/subscriptions-desktop.png),
[tablet](../evidence/local-platform-e2e-20261011/subscriptions-tablet.png),
[mobile](../evidence/local-platform-e2e-20261011/subscriptions-mobile.png),
[billing desktop](../evidence/local-platform-e2e-20261011/billing-desktop.png),
[billing mobile](../evidence/local-platform-e2e-20261011/billing-mobile.png),
[Customer desktop](../evidence/local-platform-e2e-20261011/customer-desktop.png),
[Customer mobile](../evidence/local-platform-e2e-20261011/customer-mobile.png).
Subscription document widths matched 1440/820/390 viewports; mobile tables
overflowed inside their scroll containers, not the page. Customer matched
1440/390 and billing mobile matched 390. Mobile Operations navigation remains
large and horizontally scrollable; this is a usability limitation, not a full
mobile interaction pass. No material screen layout redesign was performed.
Direct MCP screenshot file writes were denied; returned real image bytes were
saved through workspace-authorized terminal/file tools without host changes.

Sanitized request/console/listener evidence: [browser diagnostics](../evidence/local-platform-e2e-20261011/browser-diagnostics.json)
and [billing diagnostics](../evidence/local-platform-e2e-20261011/billing-diagnostics.json).
Automated results, recorded separately: **10 API tests / 98 assertions**, zero
failures/errors/skips; **130 UI tests**, typecheck, lint, both production builds,
bundle budgets and `git diff --check` passed after code fixes.

Remaining acceptance: terminal CLI launch blocked; documents/logo attachment
transfer, contact/office end, future renewal/downgrade/cancellation, non-INR
evidence, invoice add-ons/duration variants, multi-page history, complete
keyboard/modal/mobile interaction, and cross-tenant/revocation browser matrices
were not executed. Administrator invitation/delegation grants require separate
authorization and were not created. Core sample workflows passing does not
mark those branches passed or authorize production rollout/outbound messages.

The sections below are historical evidence retained for traceability.

## Development-only credential sign-in — 11 October 2026

**Implemented and API-verified; browser acceptance BLOCKED.** The user approved
local email/secret sign-in for the five existing seed users under ADR-062.
Both development applications have loaded the explicit local form opt-in;
HTTP readiness is 200 for Customer, Operations and Rails `/up`. The form now
lists all five approved emails and offers opt-in automatic submission after
the chosen account's local secret is entered. No secret-free login was added.
This section supersedes earlier session-authentication
status only for the new local credential mechanism, not Google OAuth or Batch 5.

Before browser acceptance, one terminal CLI command was executed:
`npx playwright test tests/e2e/public.spec.ts --project=customer-desktop --workers=1 --retries=0 --max-failures=1`.
Chromium launched as a process then exited with SIGTRAP before page creation;
the log includes power-notification and DNS-watch failures and `kill EPERM`.
Chromium sandbox stayed enabled. No launch retry or protection bypass occurred.
Full evidence: [launch/crash log](../evidence/development-sign-in-launch.log).

| Evidence | Actual outcome |
|---|---|
| API authentication/session regressions | PASS: 18 tests, 79 assertions; credentials, disabled mode, production guard and route absence, explicit local origins, throttling, refresh/logout, denied platform authority and session RLS |
| Actual local HTTP, five existing accounts | PASS: each signed in, loaded matching `/me`, refreshed, logged out and received 401 for revoked refresh; credentials/tokens were not printed |
| UI automated checks including dropdown/auto-submit follow-up | PASS: typecheck, lint, 130 tests, both production builds, bundle budgets and E2E typecheck |
| Production build with local opt-in enabled | PASS: local form text and `/session/development` absent from both built applications |
| Rendered desktop/narrow forms and navigation | BLOCKED: Chromium failed before page creation; no current screenshots |
| Browser validation and authenticated workflows | NOT RUN: launch blocker; API/unit checks do not establish browser acceptance |
| Console errors, uncaught exceptions, HTTP errors, failed requests | No page-level capture possible in this CLI attempt; retained process launch log only |
| Google OAuth | User reported Google rejecting the automated browser; local credential tests do not verify Google OAuth |

Operations reference inspected: local UBold `Form.pdf`, labelled inputs and
compact form spacing within the existing panel. Customer navigation/layout was
not redesigned. No schema migrations, new users, identity mappings or authority
grants were introduced. The API tests found and fixed session `Cache-Control`
being overwritten: successful session responses now retain `no-store`.
Local secrets are in ignored, mode-0600 files; see
[local sign-in instructions](../../../trise-api/docs/development-sign-in.md).

Prepared but NOT RUN: `tests/e2e/development-sign-in.spec.ts` verifies dropdown
selection, required-field validation, real interactive sign-in, reload, logout,
viewport fit and secret-required auto submission. Enable these tests with
`TRISE_E2E_DEVELOPMENT_SIGN_IN=true` only after the Chromium blocker is resolved.
Credential test traces/videos are disabled to keep request-body secrets out of
artifacts; the existing fixture records sanitized browser diagnostics. No
additional Chromium attempt was made in this session.

The sections below retain historical browser and prior work evidence.

Latest verification: **11 October 2026**. **Chrome DevTools browsing access is VERIFIED; terminal Playwright and authenticated Batch 5 acceptance remain unverified after this permission change.**

## Platform administration walkthrough — 11 October 2026

**Google authentication testing is skipped per the user's latest instruction.** Browser review continues through Chrome DevTools, with no authentication bypass or new authority grant. Connected Operations tabs remain signed out, so provider administration, commercial decisions, billing and invitation workflows have **not** executed as authenticated actions.

Actual interactive evidence: Customer and Operations signed-out pages at **1440×900**, **820×1180** and **390×844**; measured document width matched viewport width on all six initial checks. Operations overview, provider directory/new-provider, plans, subscriptions, requests, usage and billing deep links exposed no private sidebar or business forms. Reload retained the protected screen. Tab reached the Google sign-in control. Actual console/network records showed expected anonymous API 401s and a Google origin rejection. An alternate `localhost:4174` check also produced API CORS failures; it is not a working replacement for the approved origin. No Rails 500 was observed in these checks. Complete uncaught-exception and request-failure listener coverage remains outstanding.

Saved and visually inspected screenshots: [Operations desktop](../evidence/browser-automation/platform-admin-20261011/operations-sign-in-desktop-after.png), [tablet](../evidence/browser-automation/platform-admin-20261011/operations-sign-in-tablet-after.png), [mobile](../evidence/browser-automation/platform-admin-20261011/operations-sign-in-mobile-after.png), plus Customer baselines and Operations before images in the same directory. Inline screenshot bytes were saved with the workspace-authorized terminal after direct browser-tool file writes were denied. The artifact-saving limitation was therefore resolved for these actual images without changing browser roots or security controls. Earlier retest calls were cancelled; screenshot/snapshot checks subsequently resumed after the user's steering. The mobile snapshot briefly caught Loading; the screenshot and subsequent snapshot both showed the settled sign-in page.

Changes: Operations entry wording now clearly identifies sign-in and administrative work instead of “Synthetic preview”. Source review also confirmed that the shell accepted `#/platform/...` links while provider/plan/subscription screens expected `#platform/...`; all affected platform screens now normalize the optional leading slash. Provider routing regressions cover both forms and unsupported routes. This routing fix is **source/unit-verified**, with authenticated browser retest still open. Customer rendering, server authorization and authentication behavior are unchanged.

Final automated checks: **127 tests / 20 files PASS**, application TypeScript, ESLint, Customer and Operations builds, E2E TypeScript and whitespace checks PASS. Compressed JS: Customer **69,508 bytes**, Operations **130,083 bytes**, below the **204,800-byte** budget. No terminal Chromium launch was retried. These results do not close formal Playwright or authenticated workflow acceptance.

See the [step-by-step walkthrough](platform-admin-browser-walkthrough-20261011.md) and [sanitized outcomes](../evidence/browser-automation/platform-admin-20261011/outcomes.json). All private administration steps remain explicitly NOT TESTED; no financial action, record creation, outbound message, production rollout or authority grant occurred.

## Browser permission verification — 11 October 2026

After the user reported granting browser permissions, Chrome DevTools `list_pages` returned a live `about:blank` tab. Navigation to Customer `http://127.0.0.1:4173/` and Operations `http://127.0.0.1:4174/` succeeded, each with document HTTP 200. Actual accessibility snapshots showed the Customer heading “Service care that follows your asset.” and signed-out protection, and the Operations heading “Operations overview” with “Protected operations workspace”. No private records were displayed in those snapshots.

Both pages reached Rails: anonymous `GET /api/v1/me` and `POST /api/v1/session/refresh` returned 401. Console resource errors included these expected 401s and a 404 whose resource was not identified in this check. Operations also recorded a Google `/gsi/button` response of 403; normal sign-in completion was not tested. No credential or authorization bypass was attempted.

An actual full-page Operations screenshot was returned inline and inspected. Attempts to save Customer and Operations screenshots under the TRISE workspace failed with the browser tool's “not within any of the configured workspace roots” error. This is a browser artifact-write restriction distinct from successful page navigation; no persisted screenshots are claimed.

**Verified:** browser connection, both real signed-out React pages, browser-to-Rails reachability and inline Operations screenshot capture. **Not verified:** authenticated workflows, form validation, responsive viewports, complete exception/failed-request collection or design-pattern acceptance. This Chrome DevTools check does not establish terminal Playwright launch recovery or close formal acceptance under the user's Playwright Test requirement. The built-in Browser integration was not retried; no terminal Chromium launch was repeated.

## Chromium blocker investigation — 11 October 2026

The native macOS crash report for PID 43363, captured at `09:31:01.1556 +0530`, independently confirms `EXC_BREAKPOINT` / `SIGTRAP` and signal termination code 5. A sanitized [native crash summary](../evidence/browser-automation/batch5-continuation-20261011/native-crash-summary.json) preserves the exception and faulting-thread frames without the full host report. The available symbols do **not** establish the exact cause. Earlier permission-denial logs and this executor's failed loopback access support investigating executor restrictions; they do not prove every SIGTRAP has that cause. No confirmed repository defect or supported repository repair was established.

The active session uses managed `workspace-write` restrictions and automatically rejects sandbox escalation. Changing application launch flags cannot grant executor privileges. Per user instruction, no further Chromium launches, built-in Browser retries, security bypasses or host/Codex configuration changes were attempted.

[Official sandbox documentation](https://learn.chatgpt.com/docs/sandboxing) states that spawned test runners inherit the executor sandbox and that macOS uses native enforcement. The supported next diagnostic is the **same** repository test in an ordinary authorized local terminal, with Chromium sandboxing still enabled:

```sh
cd /Users/anjanreddy/wrk/trise/trise-ui
PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/playwright test --project=customer-desktop --workers=1 --retries=0 --max-failures=1 --reporter=list --output=docs/evidence/browser-automation/authorized-terminal-check
```

If this creates a page, investigate the executor's effective managed permissions through the supported host controls; a permitted executor is required to continue acceptance here. If it also crashes, stop and preserve its log/native report for browser-runtime investigation. This comparison has **not** executed in this session. No guaranteed host fix, broader permission grant or browser acceptance is claimed.

## Batch 5 continuation — 11 October 2026, 09:31 IST

**Browser acceptance remains BLOCKED.** One terminal Playwright Test CLI run used `customer-desktop`, `--workers=1 --retries=0 --max-failures=1 --reporter=list` and a separate evidence directory. Chromium launched as a process but exited with SIGTRAP before page creation; cleanup reported `kill EPERM`, alongside thermal notification and DNS configuration warnings. The existing `chromiumSandbox: true` remained enabled, with no `--no-sandbox` launch argument. The test failed before its body (0 ms); no further browser launch was attempted.

Preserved evidence: [crash log](../evidence/browser-automation/batch5-continuation-20261011/chromium-launch.log) and [HTTP probes](../evidence/browser-automation/batch5-continuation-20261011/http-readiness.log). All three curl probes returned HTTP `000` / exit 7 despite `lsof` confirming listeners on 3000, 4173 and 4174. Fresh HTTP readiness remains unverified from this executor.

Separate Rails log review found newer evidence superseding the historical migration-blocked status below: `CreateProviderAdminInvitations (20261011100000)` ran, the migration version insert committed, and `/up` completed **200 OK at 09:28:34 +0530**. This supports the startup script's development migration/readiness result; it does not prove current executor connectivity, test-database migrations, RLS/integration acceptance or authenticated workflows. No migration was rerun during this continuation, and no fresh HTTP 500 was received.

Customer and Operations navigation, actual screenshots, page console errors, uncaught exceptions, HTTP errors/failed requests, desktop/tablet/mobile responsiveness, form validation and Batch 5 authenticated workflow outcomes remain **BLOCKED / NOT TESTED in this continuation**. Process stderr is not page diagnostics. No records, authority grants, outbound messages, application code, host security settings or Codex configuration were changed. Existing uncommitted work was preserved.

The following sections retain earlier attempts as historical evidence. Their statements that the development migration had not been applied describe those earlier attempts, not the newer startup log above. The next execution must check current development migration status before considering any migration; do not repeat setup/restore routines.

## Latest permission recheck — 11 October 2026

At approximately 09:29 local time, a new user-requested access check found Ruby listening on `127.0.0.1:3000` and Node listening on `127.0.0.1:4173` and `127.0.0.1:4174` (`lsof`). Fresh curl requests to all three origins returned HTTP `000`, exit 7. Listeners therefore remain observable, but HTTP readiness cannot be confirmed from this executor.

One Playwright Test CLI launch used the existing `customer-desktop` project, `--workers=1 --retries=0 --max-failures=1 --reporter=list` and a separate evidence output directory. The repository's `chromiumSandbox: true` remained enabled; the recorded command contains no `--no-sandbox`. Chromium exited with SIGTRAP before page creation. This run recorded DNS configuration warnings and cleanup `kill EPERM`; it did not emit the earlier explicit Mach-port diagnostic. No further browser launch was attempted.

A separate `api-public` CLI test failed on `GET http://127.0.0.1:3000/up` with `connect EPERM 127.0.0.1:3000`. This directly confirms that this executor cannot connect to the API through its present permissions. No HTTP response or fresh Rails 500 was observed, and no migration or application change was attempted.

Actual logs: [Chromium launch](../evidence/browser-automation/permissions-check-20261011/chromium-launch.log) and [API access](../evidence/browser-automation/permissions-check-20261011/api-access.log). Both CLI runs failed; neither is a workflow failure demonstrated in a rendered application. Customer and Operations browser navigation, screenshots, page console, exceptions, request diagnostics, responsiveness, form validation and authenticated workflows remain **BLOCKED / NOT TESTED**. No host security, Codex configuration, authentication or Chromium sandbox settings were changed. Existing evidence and uncommitted application work were preserved.

The built-in Browser's known `sandboxPolicy` integration failure is not an application defect. Per user instruction, it was not retried during this task. Codex metadata, working configuration, permission profiles, managed security controls and application authentication were not modified.

PASS below means the named check actually executed successfully. CLI test failures before page creation are classified as environment-blocked acceptance, not TRISE workflow failures. Compilation and unit tests do not establish browser acceptance.

## Direct terminal execution

Native Node 24 and the installed Playwright CLI were used without downloading browsers or packages:

```sh
cd /Users/anjanreddy/wrk/trise/trise-ui
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npx playwright screenshot --browser chromium --timeout 15000 about:blank docs/evidence/browser-automation/playwright-cli-20261011/chromium-launch.png
npx playwright test --project=customer-desktop --project=operations-desktop --workers=1 --retries=0 --reporter=list
npx playwright test --project=api-public --workers=1 --retries=0 --reporter=list
```

The stock screenshot command failed before page creation with:

```text
FATAL:base/apple/mach_port_rendezvous_mac.cc:159
bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.<pid>:
Permission denied (1100)
process did exit: exitCode=null, signal=SIGTRAP
```

It also logged DNS watcher/config failures and cleanup `kill EPERM`. The stock screenshot CLI uses Playwright's default launch flags, including `--no-sandbox`; this was not used as a workaround. The repository Test run independently used its existing `chromiumSandbox: true` configuration, with no `--no-sandbox` flag, and both projects crashed with SIGTRAP before page creation. No further Chromium launch attempts followed those results. The exact host rule responsible is not established; the permission denial is preserved rather than worked around.

Local crash evidence is preserved under [playwright-cli-20261011](../evidence/browser-automation/playwright-cli-20261011/) (Git-ignored):

- `chromium-launch.log`: stock CLI launch output and native crash diagnostic.
- `playwright-test.log`: two failed sandbox-enabled desktop project launches.
- `api-public.log`: API smoke execution result.
- `rails-pending-migration.txt`: narrowly extracted Rails exception.
- `migration-attempt.log`: attempted authorized development migration and PostgreSQL denial.
- `outcomes.json`: explicit workflow outcomes; no fabricated page evidence.

No `chromium-launch.png` was produced. Process stderr is not page console evidence. Existing screenshots elsewhere in the workspace are not evidence from this task.

## Application and workflow outcomes

| Check | Outcome | Actual evidence |
| --- | --- | --- |
| Direct Chromium CLI launch | FAIL / acceptance BLOCKED | Mach-port registration permission denial, SIGTRAP; no page |
| Sandbox-enabled Playwright Test | FAIL / acceptance BLOCKED | Customer desktop and Operations desktop: 2 failed launches; 0 passes |
| Customer `http://127.0.0.1:4173` real navigation | BLOCKED | Chromium failed before navigation; shell HTTP probe also returned 000/exit 7 |
| Operations `http://127.0.0.1:4174` real navigation | BLOCKED | Chromium failed before navigation; shell HTTP probe also returned 000/exit 7 |
| Screenshots | BLOCKED | No page created; no screenshot captured |
| Page console, uncaught exceptions, HTTP errors, failed requests | BLOCKED | No page existed to attach listeners or collect page diagnostics |
| Signed-out navigation, protected-route reload | BLOCKED | Desktop tests never entered their bodies |
| Tablet/mobile responsiveness, overflow, keyboard usability | NOT TESTED | Launch gate failed; viewport projects remain configured |
| Form validation | NOT TESTED | Requires rendered forms and authorized development session |
| Provider/subscription/invitation/office workflows | NOT TESTED | Requires browser, working API/database and normal authenticated development identity |
| React/Rails listeners | PASS — listener only | Node listeners 4173/4174 and Ruby listener 3000 observed; this is not HTTP health |
| Rails API-public smoke | BLOCKED | Loopback access denied; no HTTP status obtained from this executor |
| E2E TypeScript and ESLint | PASS — harness only | Executed after test fixes; no browser acceptance inferred |

## Rails port 3000 HTTP 500 diagnosis

The development log records requests to `/api/v1/me` returning through Rails' pending-migration guard:

```text
ActiveRecord::PendingMigrationError
You have 1 pending migration:
db/migrate/20261011100000_create_provider_admin_invitations.rb
```

This confirms the logged 500 cause independently of the built-in Browser integration failure. A fresh HTTP response cannot be verified from this restricted executor: curl to port 3000 failed with exit 7; the API smoke reports loopback `EPERM`.

The authorized repair was attempted with Ruby 4.0.7 using `bin/rails db:migrate`. It failed connecting to development PostgreSQL:

```text
PG::ConnectionBad: connection to server at "127.0.0.1", port 5433 failed:
Operation not permitted
```

The migration has **not** been applied here. Do not remove the pending-migration guard, mark the migration applied manually, invent a structure dump or bypass host restrictions. No confirmed rendered React defect was observable.

## Confirmed acceptance-harness fixes

- [API smoke](../../tests/e2e/api-public.spec.ts) now checks the implemented `/me` route instead of nonexistent `/users/me`.
- [Public browser tests](../../tests/e2e/public.spec.ts) now recognize anonymous `/api/v1/me` 401 responses and attach actual initial-page/protected-route screenshots after successful navigation. HTTP 500 remains a failure, never an expected authentication response.
- [Diagnostics fixture](../../tests/e2e/fixtures.ts) captures warning/error message text, uncaught exception message/stack, request-failure reason and all response statuses. Previously it recorded only console message length and exception name. URL query strings, UUIDs and common credential values are redacted; no response bodies or cookie/header values are captured. Attachments are emitted during teardown after page creation, including when workflow assertions fail.

E2E typecheck, ESLint, 121 unit tests across 20 files, and `git diff --check` pass. Playwright discovers seven cases; discovery is not execution. These checks establish no browser outcome. The updated harness is prepared for rerun; its live workflow behavior is not marked passed because Chromium remains blocked.

## Next permitted execution

Run in the user's ordinary authorized local terminal or an administrator-approved executor. Keep host security and Chromium sandbox enabled; no Codex configuration edits are required by this workflow.

1. Confirm the configured database is development, then apply the approved migration:

   ```sh
   cd /Users/anjanreddy/wrk/trise/trise-api
   export PATH="/Users/anjanreddy/.rbenv/versions/4.0.7/bin:$PATH"
   bin/rails db:migrate
   curl -i http://127.0.0.1:3000/up
   curl -i http://127.0.0.1:3000/api/v1/me
   ```

   Require `/up` 200 and anonymous `/api/v1/me` 401. Run the [Batch 5 database integration/RLS checks](provider-subscription-batch5-results.md) against the configured test database as well; migration success alone does not prove those policies.
2. Have the host administrator inspect the preserved Chromium crash/denial logs and permit supported browser execution through existing managed controls. Rerun the sandbox-enabled Playwright Test projects. Do not disable sandboxing to obtain a pass.
3. Once launch and local HTTP work, execute all six Customer/Operations viewport projects plus API smoke using `npm run test:e2e`. Review screenshots and diagnostics before recording navigation/responsiveness outcomes.
4. Sign in normally with an approved development identity and isolated test records, then execute the [implemented-workflow acceptance checklist](provider-subscription-browser-acceptance.md). Record form validation, navigation, exact workflow outcomes and before/after screenshots. Authenticated acceptance remains distinct from signed-out public tests; no test-user header, token injection, mocked API or synthetic membership establishes real-user acceptance.

The current task reached the required fallback stop condition: Playwright Chromium also failed to launch. Browser acceptance remains blocked with crash evidence preserved; Rails' separate 500 has a confirmed pending-migration cause and an attempted repair blocked by database permissions.

## Default onboarding demonstration subscription implementation — 11 October 2026

Browser acceptance remains **BLOCKED** by the preserved Chromium launch failure
above. Chromium was not retried. This implementation has no browser screenshots,
page console/exception/network diagnostics, responsive rendering evidence, or
authenticated workflow outcome; CLI and API checks below establish only their
own scopes.

The default demonstration plan is INR 0 for 14 days with 15 managed assets and
2 agents. Operations preselects it during onboarding. The API assigns it only
on first provider activation when no explicit pending/accepted plan exists and
starts validity at the persisted business-verification timestamp. A manually
selected plan retains the standard review/payment path.

Actual non-browser verification on this date: Playwright-specific Operations
typecheck passed; changed-file ESLint passed; the provider routing and
subscription workflow tests passed (34 tests); API regressions passed (21
tests, 145 assertions); Customer and Operations production builds passed; the
bundle budget check passed; and the full Vitest suite passed under the
repository-supported Node 24 runtime (134 tests across 22 files). An initial
Node 18 Vitest run had two environment-related `crypto` failures; Node 18 is
below the Vite requirement and is not the final suite result. These checks do
not establish browser acceptance.

## 2026-10-11 manual Operations sign-in session attempt

Requested a headed Operations browser for user authentication and retention for further testing. One terminal Playwright Test CLI run used the existing `operations-desktop` project with `--headed --workers=1 --retries=0 --max-failures=1`. Chromium sandbox remained enabled. Launch failed before page creation: Crashpad Mach bootstrap `Permission denied (1100)`, Crashpad settings file `Operation not permitted (1)`, then SIGABRT; cleanup also reported `kill EPERM`.

Full evidence: [launch log](../evidence/admin-session-20261011/launch.log). No retry or security workaround was attempted. The temporary manual-session test was removed. No page loaded, screenshot was captured, authentication occurred, or browser session was retained. Navigation, responsiveness, form validation and authenticated workflows were not tested; browser acceptance remains **BLOCKED**. Application code and existing uncommitted work were preserved.

## Provider detail dashboard redesign — 11 October 2026

Source and automated checks cover the Operations provider-detail redesign and
its retained Overview, Subscription, Business details, Documents, Reviews &
approvals, and Audit history tabs. They do not establish rendered browser
acceptance. In accordance with the recorded Chromium launch blocker, no
Playwright browser retry was made for this work. There are no new provider
detail screenshots, rendered viewport measurements, live console/exception or
request diagnostics, or authenticated workflow outcomes to report. See the
[UI refinement record](operations-ui-refinement-20261011.md) for the actual
implementation scope and API data limits. Browser status stays **BLOCKED**.

## Advanced provider onboarding redesign — 11 October 2026

The six-step onboarding navigation, contacts/offices dialogs, dynamic plan
comparison cards, compact Review & Activate evidence groups, and separate
operational lifecycle route were validated only by source and automated
checks. Chromium was not launched again because the earlier CLI launch
already failed with the recorded Crashpad/Mach permission error and the
workspace instruction prohibits repeated attempts or protection bypasses.
There are no new screenshots, rendered 390/768/1024/1440 px observations,
console/exception/network captures, or authenticated workflow outcomes.
Browser acceptance remains **BLOCKED**.


## Business Operations implementation verification — 11 October 2026

The Business Operations foundation and its connected provider/plan screens were checked without launching a browser. Rails integration coverage passed: 39 tests / 230 assertions across provider administration, plan catalogue, provider subscription self-service and provider lifecycle. Frontend verification passed: TypeScript typecheck, ESLint, 143 Vitest tests, and Customer/Operations production builds. The OpenAPI YAML parsed successfully and `git diff --check` passed in the API repository. The plan-operation list filter is server-backed; plan operation names are read from the catalogue.

Browser acceptance remains **BLOCKED** by the previously preserved Chromium SIGTRAP / Crashpad permission evidence above. No browser was launched for this implementation, so screenshots, responsive rendering, real auth, UI interactions, console/request errors and end-to-end workspace switching have no new evidence. The Operations workspace switcher remains unimplemented because server-side operation membership grants and operation-scoped operational queries are absent; the UI does not infer access from a selected provider-operation record.


## Seeded Business Operations and Industry display — 11 October 2026

The development-only `db/seeds/business_operations.rb` seed ran successfully after the approved migration. A Rails query confirmed all seven active/selectable catalogue records and their Industry keys: BUILDING_FACILITIES (Elevator, HVAC, Fire & Safety), RENEWABLE_ENERGY (Solar PV, Solar Water Heating), WATER_SYSTEMS (Water Purification), and ELECTRICAL (Electrical Services). The Business Profile selector now shows each operation’s Industry and searches against that value; Provider Detail has an Industry column. Plan creation and details keep Industry separate from applicable Business Operations. TypeScript, ESLint, 143 frontend tests, both builds, bundle check, and UI `git diff --check` passed after the change.

Rendered browser verification was not performed because the preserved Chromium launch blocker remains in force. No screenshot, visual alignment, viewport or interaction acceptance is claimed.

## Plan draft form layout refinement — 11 October 2026

Updated `Create draft plan` with breadcrumbs, grouped identity/billing/entitlement/applicability sections, bounded responsive layout, correct checkbox sizing, a live plan summary, and catalog loading/error/retry feedback. Source checks passed: TypeScript, ESLint, 143 unit/component tests, Customer and Operations production builds, compressed bundle check, and `git diff --check`. Operations compressed initial JS remains under the configured budget; Vite continues to report the existing large uncompressed chunk advisory.

Rendered visual/browser verification remains **BLOCKED** by the prior preserved Chromium launch failure. No screenshot, viewport, keyboard interaction, or browser acceptance is claimed for this form.

## Business directory and provider onboarding flow — 12 October 2026

Added the Platform Administration Businesses navigation item and a directory
using the existing authorized `GET /api/v1/platform/businesses` contract. The
directory supports server-side name search (minimum three characters), cursor
pagination, loading/error/empty states, provider-account counts and an
“Add provider account” action that preselects the selected Business in the
existing provider registration form. Registration still assigns one Business
Operation to each provider account and continues through the original six
onboarding steps. No Business-level onboarding stage was added because the
accepted architecture does not define shared Business profile, document or
approval workflows.

Automated evidence: TypeScript typecheck and ESLint passed; all 148 Vitest
tests passed across 23 files; Customer and Operations production builds
passed; the bundle check passed; and `git diff --check` passed. The API
provider-directory regression passed (28 tests / 177 assertions), and the
canonical plus generated OpenAPI YAML files parsed successfully. The Operations
bundle remains within the configured compressed size budget; Vite reports its
existing uncompressed chunk advisory. The only API change is a read-only
`filter[business_id]` on the existing authorized provider directory; no
database changes were made.

Browser acceptance remains **BLOCKED** by the earlier preserved sandboxed
Chromium CLI launch failure. No Chrome MCP or Playwright browser launch was
attempted for this change, and there are no new screenshots, responsive
rendering observations, console/exception/request diagnostics, authenticated
interactions or end-to-end outcomes. See the preserved launch evidence above.

## Global responsive form layout and alignment — 12 October 2026

Source inspection confirmed the Provider Registration width problem came from
two nested constraints: `.platform-page` capped administration content at
1160px and `.platform-form-card` capped the registration form at 760px. The
form sections then used a single implicit column. The onboarding stepper
required at least 960px across six cards, exceeding its containing form card.

The Operations application now has a shared responsive layout foundation in
`apps/operations/src/operations-design.css`. Platform pages can use up to
1280px of the available shell content, while provider form cards remain capped
at 1120px. Form sections and reusable form grids use two `minmax(0, 1fr)`
columns when their actual container is wide enough and stack below the
container-width breakpoints. Dialog forms follow dialog width. The onboarding
stepper uses six columns on wide layouts, three on constrained layouts, and two
on narrow layouts without a forced minimum width.

The shared layout is applied to Provider Registration, Business Profile,
Contacts and Office Locations forms, the six-step registration stepper, plan
editing and subscription request/invoice dialogs. Related onboarding forms in
the Operations workflow and typed configuration editor use the same
container-aware form treatment.
Business Operation remains a required, searchable single-select. Contact and
office API fields, validation, save flows and authorization were not changed.
Customer application styles were not changed.

Automated checks passed under Node 24: TypeScript typecheck, ESLint, all 148
Vitest tests, Customer and Operations production builds, bundle budgets, and
`git diff --check`. The Operations build retains its existing Vite warning for
an uncompressed JavaScript chunk above 500 kB; the compressed initial bundle
is within budget.

Responsive screenshots and rendered browser verification are **BLOCKED**.
The previously attempted terminal Playwright Chromium launch failed at
Crashpad/Mach bootstrap with SIGABRT before page creation. The TRISE workspace
instructions prohibit retrying or bypassing protections after that failure,
so no screenshot or visual pass is claimed for 1600, 1440, 1280, 1024, 768 or
390px, nor for a modal. This report records source-level layout changes and
automated checks only; browser acceptance remains outstanding.

## Roles & Permissions session — 2026-10-12

**BLOCKED: Chromium launch failed before page creation.** Command: `npx playwright test tests/e2e/public.spec.ts --project=operations-desktop --workers=1 --retries=0`. Repository `chromiumSandbox: true` was retained. Chromium exited with SIGTRAP; stderr includes ThermalStateObserver registration result 9, DNS watch/read failures and kill EPERM. Full error preserved in [launch evidence](roles-permissions-evidence/chromium-launch-error-context.md). No retry, browser integration fallback or sandbox changes were attempted.

Neither application was inspected in a live browser in this session. No real screenshots, authenticated workflow outcomes, navigation/responsive/form acceptance, application console errors, uncaught exceptions, HTTP errors or failed-request observations are available because launch failed. Automated tests and HTTP readiness must not be counted as browser acceptance.

Operations visual reference inspected: local UBold `Tables.pdf`, page 1, rendered with Ghostscript. Apply compact sidebar/header, title/breadcrumb, readable role tables, status badges, aligned row actions and responsive overflow; retain real API data and existing TRISE primitives. The reference index lists historical screenshot filenames that are absent locally; `Tables.pdf` is the available equivalent table reference.

Automated final evidence for this feature: Rails 565 tests / 3,969 assertions; Vitest 154 tests; TypeScript, ESLint, both builds, bundle budgets, strict OpenAPI validation and diff checks passed. These results do not change the BLOCKED browser acceptance status. New access capabilities were defined but not granted to runtime accounts.

## Roles & Permissions — host recovery and actual verification, 2026-10-12

The earlier restricted-environment launch failure is preserved above. The user
ran the CLI from normal macOS Terminal and its Operations public test passed.
The separately permitted host CLI then established Chromium launch successfully
with the existing `chromiumSandbox: true`. No security metadata, sandbox flags,
host restrictions, authentication bypass or built-in browser integration changed.

Final command:

```sh
TRISE_E2E_DEVELOPMENT_SIGN_IN=true TRISE_E2E_ACCESS_WORKFLOWS=true \
TRISE_E2E_RESTORE_ACCESS_BASELINE=true \
PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/trise-roles-final-browser-results.json \
npx playwright test --workers=1 --retries=0 --reporter=list,json,html
```

**24 passed; four intentionally desktop-only inventory/cleanup exclusions;
zero failures, retries or flaky cases.** The full role workflow ran at all
three Operations widths; Customer public and authenticated checks ran at all
three widths. Viewports: desktop 1440×900, tablet 820×1180, mobile 390×844.
Recorded evidence includes 63 real screenshots, sanitized console warnings/errors,
uncaught exceptions, HTTP statuses, failed requests and authorized cleanup.
See [machine-readable results and artifact index](roles-permissions-evidence/final-browser/summary.json).

| Actual workflow | Result |
| --- | --- |
| Both apps: protected navigation, empty sign-in validation, normal approved local login, reload and logout | Passed at three widths |
| Platform role table, default editor, required name, locked protected permissions and operation selection | Passed at three widths |
| Default submission, independent reviewer approval, author publication and immutable version actions | Passed at three widths |
| Published default enable/disable and re-enable | Passed at three widths |
| Provider navigation to Settings → Team & Access and its three tabs | Passed at three widths |
| Platform defaults locked/read-only, checked permissions visible but disabled | Passed at three widths |
| Delegated custom role creation, protected checkboxes locked, permission uncheck/save/reopen/check/save | Passed at three widths |
| Three roles on the existing Operations Coordinator, badges and persistence after reload | Passed at three widths |
| Custom enable/disable, assigned-member read-only dialog, Escape close, real invitation history | Passed at three widths |
| Page viewport bounds, actual role forms and pickers | Passed; desktop/mobile screenshots visually inspected against UBold Tables reference |
| All-operation defaults and selected-operation exclusion without an eligible provider operation | Passed at three widths |
| Selected-operation positive catalogue/assignment with matching active provider operation | Not verified live: existing approved demo providers have no active Business Operation; local configuration choice remains unanswered |

Representative rendered evidence:

- [Desktop member picker](roles-permissions-evidence/final-browser/operations-desktop/platform-publication-and-provider-multiple-role-workflows-persist-with-audited-cleanup/multiple-role-picker-1.png)
- [Mobile member picker](roles-permissions-evidence/final-browser/operations-mobile/platform-publication-and-provider-multiple-role-workflows-persist-with-audited-cleanup/multiple-role-picker-1.png)
- [Mobile custom editor](roles-permissions-evidence/final-browser/operations-mobile/platform-publication-and-provider-multiple-role-workflows-persist-with-audited-cleanup/custom-editor-2.png)
- [Mobile persisted role badges](roles-permissions-evidence/final-browser/operations-mobile/platform-publication-and-provider-multiple-role-workflows-persist-with-audited-cleanup/persisted-member-role-badges-1.png)

Observed and fixed defects: the hash-change allowlist omitted Team & Access;
role/member controls allowed stale reopening during refresh; bare role statuses
wrapped mid-word. Navigation now includes the route, mutation controls wait for
refreshed records, and existing status badges preserve readable labels. Default
and custom section headings align with their tables.

Rails HTTP 500 was diagnosed separately from `log/development.log`:
`ActiveModel::UnknownAttributeError (unknown attribute 'delegation_enforced' for Role.)`.
A fresh runner verified that the columns existed and no migrations were pending.
`bin/rails restart` refreshed the running server schema metadata; `/up` returned
200 and subsequent custom-role creation passed. No migration guard was disabled.

Final workflow diagnostics contain zero uncaught exceptions and no unexpected
local access API HTTP errors or failed requests. Expected signed-out `/me` and
`/session/refresh` 401 responses remain recorded. Google GSI returns 403 and
reports that the configured origin is not allowed; its button requests also
record `net::ERR_ABORTED`. These are preserved, not hidden or counted as successful
Google OAuth. Authentication used the approved existing local email/secret flow.
Credential-bearing traces, videos and automatic failure screenshots were disabled;
captures were taken after credential fields disappeared.

The user separately approved narrow temporary local platform grants for the
existing author/publisher and independent reviewer. Provisioning and revocation
were audited; both grants were ended and a final inspection showed zero active
grants for those accounts. Original member role sets and AUDIT_READ delegation
were restored, verification custom/default roles disabled, and immutable evidence
retained. No users, identities or memberships were fabricated, and no provider
operation was guessed or changed. Production and outbound messages remain separate.

Final automated checks: Rails **566 tests / 3,984 assertions**; Vitest **154 tests**;
application and browser TypeScript checks; ESLint; both production builds; budgets
(Customer 69,566 / Operations 156,767 compressed initial JS bytes, each ≤204,800);
strict OpenAPI **zero findings**, 491 operations including 20 access operations;
diff checks passed. The existing Vite uncompressed chunk advisory remains.

Core local browser acceptance is verified. The positive selected-operation live
case remains explicitly outstanding for the local provider configuration decision;
backend operation filtering/assignment regressions pass. This report does not grant
production rollout or permanent administrator authority.

Review checkpoints: API commits `39094b3`, `78d5a54`, `c4b54ed`, `3599bd6`;
UI commits `37b5f11`, `82a92ff`; architecture commit `fa20fcc`. Shared integration,
generated contracts and evidence files remain in the working tree alongside
preserved pre-existing work. These checkpoints do not represent a standalone
clean-checkout release package. Final `git diff --check` passed in all three repos.
# Follow-up Team & Access simplification review — 2026-10-12

The requested correction has completed source/database review, not new browser
acceptance. Local inspection found 18 disabled acceptance default roles, zero
active role assignments and zero active PLATFORM_ACCESS grants. Catalogue
filtering and legacy access presentation explain the reported screenshots.
Existing membership-only API write guards mean the requested new role-governed
staff invitations require a security compatibility decision before implementation.
See [the review](../../../trise-architecture/docs/team-access-simplification-review.md)
and [proposed ADR-067](../../../trise-architecture/adr/067-role-governed-team-memberships.md).

Baseline regressions rerun for this review: 23 Rails tests / 127 assertions and
14 frontend tests passed. The historical browser results below do not establish
acceptance of the new Add Member, canonical template or read-only-role requirements.
No browser run, new grant, invitation or development data mutation occurred in
this review batch.

## ADR-067 implementation browser verification — 2026-10-12

The approved ADR-067 implementation changed the Team & Access experience. This
new run used terminal Playwright Test and the repository's Chromium sandbox.
Chromium launched successfully through the CLI. Rails `/up`, Customer and
Operations returned HTTP 200 immediately before verification. The test used
normal approved local development sign-in for the existing Lift Rise provider
administrator; no browser authentication bypass, new platform grant or test user
was introduced.

Playwright reported **9 passed, 0 failed, 0 skipped**: signed-out Customer and
Operations routing at desktop/tablet/mobile and authenticated provider Team &
Access at all three Operations widths. The browser navigated to Members,
Available Roles and Invitations, opened Add Member, confirmed the legacy
administrator label, confirmed the absent custom-role editor under the disabled
policy, confirmed that disabled historical custom roles do not clutter the
ordinary catalogue, and checked viewport width. Current local data has no published,
enabled, assignable default roles. After loading, Add Member therefore shows an
empty-state explanation and keeps submission disabled. This run did not create
or accept an invitation in the browser. Rails integration tests cover the
existing-verified-user acceptance transaction and multiple persisted roles.

[The run manifest](team-access-simplification-evidence/summary.json) lists
actual screenshots and per-test console, uncaught-exception, HTTP-response and
failed-request captures. Representative captures: [desktop members](team-access-simplification-evidence/operations-desktop/team-access/members.png),
[mobile Add Member](team-access-simplification-evidence/operations-mobile/team-access/add-member.png),
and [tablet Available Roles](team-access-simplification-evidence/operations-tablet/team-access/available-roles.png).
Across all nine runs, no uncaught exceptions or local API HTTP 500s occurred.
Signed-out `/me` and refresh requests returned expected 401s. In each signed-in
Operations run, Google GSI returned 403 for the unregistered local origin and
one button request reported `net::ERR_ABORTED`; both are retained in the
diagnostics. Local sign-in, protected-route behavior and team-page API reads
otherwise completed. Screenshot captures contain no credential fields.

Live platform administration remains unverified in this run: the local accounts
have zero active `PLATFORM_ACCESS` grants, and provisioning a named platform
administrator/reviewer is a separate authorization action. The current provider
has no eligible default roles, so successful Add Member, role selection,
invitation acceptance, published canonical templates and action-scoped staff
workflows are **not browser-accepted**. The prior 24 browser checks belong to the
earlier roles UI and do not replace this new acceptance scope.

## Platform Roles & Permissions redesign — 12 October 2026

**Authenticated terminal Playwright acceptance passed.** Chromium launched
through the repository Playwright CLI with `chromiumSandbox: true`. The approved
local `<PRIVATE_GLOBAL_ADMIN_EMAIL>` identity authenticated normally and its current
server session exposed the separately approved full `PLATFORM_ACCESS` grant.
The read-only acceptance changed no role, delegation or provider-policy record.

The redesigned `#/platform/roles` page rendered the Default Roles, Provider Role
Settings and Permission Delegation tabs. Server search for `Provider
Administrator` returned HTTP 200 and rendered the seeded stable code. The role
directory showed bounded 10-record cursor paging, lifecycle badges, compact row
menus and actual disabled verification roles. Provider settings returned policy
state and context. Delegation rendered canonical Category → Module → Action
groups with protected controls locked.

Default Roles screenshots passed body-overflow checks at 1600, 1440, 1024, 768
and 390 px. Provider settings was captured at 1440 px and hierarchical
delegation at 390 px. The first mobile delegation run found body-level overflow;
the permission header sizing was corrected and the same zero-retry scenario then
passed twice. Evidence is in
[`docs/evidence/roles-permissions-redesign-20261012`](../evidence/roles-permissions-redesign-20261012/).
The prior long-page baseline remains
[`platform-role-table-1.png`](roles-permissions-evidence/desktop-workflow/platform-role-table-1.png).

The passing run recorded no uncaught exceptions, failed requests or HTTP 5xx.
Initial signed-out `/me` and refresh 401s recovered through normal local sign-in.
Google Identity returned the already-known local-origin 403 and logger message;
local credential authentication did not depend on Google. The Operations UI
full gate passed 160 tests, application/browser TypeScript, ESLint, both builds
and compressed bundle budgets. The corrected focused Rails role/cursor suite
passed 32 tests and 205 assertions. The full Rails suite ran 585 tests and 4,105
assertions with one unrelated existing failure: the private-storage-unconfigured
test received the configured test adapter and returned 201 instead of its
expected 503.

### Managed role-name follow-up — 12 October 2026

The governed development catalogue was verified after adding missing Electrical
Service Technician, Fire Safety Technician and HVAC Service Technician drafts.
The directory now opens with the actual `Draft` lifecycle filter and renders
meaningful stable role names and business-operation applicability. Disabled
browser-acceptance records remain available through `Disabled` or `All statuses`
for audit inspection and are absent from the initial managed catalogue view.

The zero-retry terminal Playwright scenario passed at 1600, 1440, 1024, 768 and
390 px with the Chromium sandbox enabled. It asserted the Draft filter and the
absence of `Browser verification` text in the initial table. No uncaught
exceptions, failed requests or local HTTP 5xx were recorded. The updated
desktop evidence is
[`default-roles-1440.png`](../evidence/roles-permissions-redesign-20261012/default-roles-1440.png).

## Approved visual reference follow-up — 12 October 2026

The Operations Roles & Permissions UI was compared with the approved reference
at `docs/design/trise-roles-ui-approved-reference.png`. The directory now uses
compact View and ellipsis actions, while New Role, Edit Role and View Role open
in a responsive right-side drawer. The drawer keeps its header, tab strip and
action footer visible while the permission tree scrolls independently. Details,
Responsibilities and History are available as drawer tabs; published records
remain read-only through the existing capability checks.

Terminal Playwright verification passed **2 tests** with Chromium sandboxing
enabled. It covered the directory at 1600, 1440, 1024, 768 and 390 px, the
Permissions drawer, Details tab, New Role drawer, fixed Save Draft footer,
mobile full-screen behavior and page-overflow checks. No uncaught exceptions,
failed requests or local HTTP 5xx responses were recorded. Screenshots:
[`edit-role-drawer-1440.png`](../evidence/roles-permissions-redesign-20261012/edit-role-drawer-1440.png)
and [`new-role-drawer-390.png`](../evidence/roles-permissions-redesign-20261012/new-role-drawer-390.png).

## Platform Team administration completion slice — 13 October 2026

The Platform Team UI now includes capability-gated invitation resend and
reasoned cancellation actions in the invitation history table. The backend
integration covers creation, secure token delivery without token persistence or
list exposure, revisioned resend/cancel operations, and denial for a non-
platform operator. The local bootstrap reconciliation also confirmed the
existing local identity has the canonical `PLATFORM_GLOBAL_ADMIN` role and
Platform Team capabilities; no email address is recorded here.

Automated evidence: the focused Rails Platform Team/security suite passed 73
runs and 414 assertions; the complete Rails suite passed 612 runs and 4,234
assertions. The full Operations UI suite, typecheck, ESLint, production build
and `git diff --check` remain green. Vite still reports its existing advisory
for an uncompressed chunk over 500 kB. The UI test runtime fallback uses
browser Web Crypto when available and does not change API idempotency behavior.

The local Rails readiness endpoint was rechecked and returned HTTP 200. This
does not change the browser result: terminal Playwright Chromium launch remains
blocked by the preserved Crashpad/Mach SIGABRT evidence. No retry, sandbox
bypass, screenshots, console/request capture or authenticated browser workflow
claim was made for this pass.

Terminal Playwright acceptance remains **BLOCKED** by the preserved Chromium
Crashpad/Mach launch failure documented below. No Chromium retry, sandbox
bypass, screenshot, rendered navigation, console/request capture or
authenticated invitation workflow claim is made.

## Platform Team directory and invitation UI correction — 13 October 2026

The Platform Team page now sends the explicit keyset sort `-created_at,id`;
administrator, invitation-history and role-catalogue requests are independent
and each has its own loading, error, retry and empty state. The role endpoint
returns actor-eligible records for the two protected platform roles, and the
invite form does not submit without an eligible role. Invitation history is
server-paginated and does not render invitation tokens.

Automated UI evidence for the changed data contracts passed: 23 tests, lint,
typecheck, Operations production build and `git diff --check`. Rails syntax
checks passed. Database-backed Rails regression tests and live endpoint
verification were blocked during this pass because the local PostgreSQL
service was unavailable; no migration, seed grant or production access change
was performed.

Terminal Playwright acceptance remains **BLOCKED** by the preserved Chromium
Crashpad/Mach launch failure documented below. No retry or sandbox bypass was
used, so no new screenshots or rendered browser workflow claims are made.

## Subscription Plan Details Dashboard — 13 October 2026

The Operations plan detail implementation was updated with the approved
`docs/design/TRise Quarterly Plan Dashboard.png` direction: real Overview,
Pricing & Tax, Entitlements, Versions and Audit History tabs; API-backed
summary and readiness state; capability-gated successor draft, publish and
retire actions; and responsive stacking for narrower widths. No backend
contract or authority grant was added.

HTTP readiness was rechecked successfully: Rails `/up`, Customer and
Operations each returned HTTP 200.

Browser acceptance is **BLOCKED before Chromium launch**. The required
terminal Playwright CLI was attempted first. `npx playwright` failed in the
Node 18/npm 12 proxy dependency (`ERR_REQUIRE_ESM`), and the repository-local
Playwright binary then reported that Playwright requires Node 20 or higher
while this workspace is Node 18.20.8. No Chromium retry, in-app Browser retry,
sandbox bypass, security metadata change, authentication bypass, screenshot,
console capture or authenticated rendered workflow claim was made.

Automated evidence: TypeScript typecheck passed; focused Operations data and
routing tests passed (51 tests); the Rails `platform_plan_catalogue_api_test.rb`
passed with the repository Ruby 4.0.7/Bundler 4.0.21 toolchain (5 tests, 18
assertions); Operations production build passed with the existing Node/Vite and
bundle-size warnings; and `git diff --check` passed for the changed files.
These results do not constitute browser acceptance.

## Provider and provider-user lifecycle implementation — 14 October 2026

Browser acceptance is **BLOCKED before Chromium launch**. The required terminal
Playwright CLI establishment was attempted once through `npx`, which failed in
the host npm wrapper with `ERR_REQUIRE_ESM` under Node 18.20.8. A direct local
Playwright CLI attempt then failed its runtime prerequisite: the installed
Playwright requires Node 20 or higher. These failures occurred before page
creation; no Chromium crash log exists. The exact diagnostics are preserved in
[provider-access-playwright-launch-20261014.log](../evidence/provider-access-playwright-launch-20261014.log).

No browser screenshots, authenticated navigation, responsive checks, form
validation, console/uncaught-exception diagnostics, HTTP errors or failed
requests were collected for this change. No retry, in-app Browser attempt,
Chromium sandbox bypass, auth bypass or security configuration change was made.
Rails and Operations automated results are reported separately and are not
browser acceptance.

## Node/npm compatibility remediation and Chromium retest — 14 October 2026

The host toolchain was safely aligned without changing the repository or
database. Homebrew Node 24 was already installed and was made active:

- Node: `v24.21.0`
- npm: `11.19.0`
- Playwright: `1.64.0`

`npx playwright --version` now succeeds, so the previous Node 18/npm 12
`ERR_REQUIRE_ESM` failure is resolved. A real Playwright smoke run was then
attempted using `tests/e2e/public.spec.ts` (6 projects, one worker). All six
projects failed before page creation because Chromium terminated at launch:

`FATAL: base/apple/mach_port_rendezvous_mac.cc:159: Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)`

The process exited with `SIGTRAP`. Therefore browser acceptance remains
`BLOCKED_ENVIRONMENT`, now specifically by the independent macOS Chromium
Mach/Crashpad launch failure. No unsafe Chromium flags, sandbox bypass,
operating-system security change, authentication bypass or production
configuration change was used.

## Terminal Chromium permission resolution — 14 October 2026

The same Playwright smoke suite was rerun from the authorized macOS Terminal
application after enabling Terminal under Privacy & Security → Developer
Tools. Chromium launched successfully outside the restricted Codex process
context.

Command:

```bash
TRISE_E2E_DEVELOPMENT_SIGN_IN=true \
npx playwright test tests/e2e/public.spec.ts \
  --workers=1 --retries=0 --reporter=list
```

Result: **6 passed in 5.6s** across customer and operations desktop, tablet
and mobile projects. This verifies browser launch and the public signed-out
workflow. Authenticated compliance workflows remain separately unverified
until their dedicated browser scenarios execute.

## Authenticated Agent workspace smoke — 2026-10-14

- Environment: local development sign-in with the provider-admin email supplied privately by the operator; the development secret was read from the existing local secret file and was not printed or committed.
- Result: `tests/e2e/agent-compliance.spec.ts --project=operations-desktop` — **1 passed**.
- Evidence: sign-in succeeded, the provider was selected through the real account menu, the real `/compliance` workspace rendered, the Agent certifications & permits section was present, and the test observed no HTTP 5xx responses.
- Defect corrected: the API provider capability projection recognized `compliance` but did not expose it for existing provider-admin contexts. The projection and `/api/v1/me` contract test now cover that capability.
- Remaining scope: this smoke verifies workspace access, not a full credential submission/review transaction; secure document preview/download and recurring production scheduling remain separately tracked.

## Seeded Asset Compliance Workflow — 2026-10-14

The development API now has an idempotent synthetic scenario from
`db/seeds/compliance_asset_demo.rb`: the existing demo asset is provider-scoped,
the `DEMO_ASSET_OPERATING_APPROVAL` requirement is published as a test-only
policy, and one draft request is present. No government identifier or
production approval is seeded.

The dedicated `tests/e2e/asset-compliance.spec.ts` was added and registered,
but execution remains **BLOCKED_ENVIRONMENT** before page creation by the
macOS Chromium Crashpad/Mach failure:

`bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)` / `SIGTRAP`.

The test has not been marked passed. Backend/document regressions and UI
typecheck/lint/build remain independently green.

## Authenticated Agent and Asset smoke — 2026-10-14

After binding the supplied local Provider Administrator to the seeded
`TRISE-DEMO-SOLAR` Provider and restarting the Operations Vite server, both
authenticated desktop smoke tests passed:

- `agent-compliance.spec.ts`: **1 passed**.
- `asset-compliance.spec.ts`: **1 passed**.

The Asset smoke verified the real Provider workspace, Provider-scoped asset
selection, the seeded `Demo solar water heater`, and the published synthetic
`DEMO_ASSET_OPERATING_APPROVAL` requirement returned by Rails. Full evidence
upload/preview/download and Platform decision execution remain separate
acceptance steps.

## Authenticated asset evidence and Platform approval — 2026-10-14

Using the local development sign-in identities supplied for this test scenario:

- Provider `liftriseorg@gmail.com`: the real browser workflow uploaded the
  synthetic `synthetic-asset-approval.pdf`, attached its exact document version,
  and submitted the asset request. The persisted request was verified in the
  development database as `SUBMITTED` with one evidence reference.
- Platform `triseindia@gmail.com`: a separate real browser session opened the
  newest evidence-bearing request and recorded the approval. The request became
  `APPLIED` and the asset record became `APPROVED`.
- Provider document transfer: the Preview and Download buttons each triggered
  the real provider-scoped download authorization endpoint and returned HTTP
  200 with a short-lived URL. No storage object key was returned to the browser.

Browser results: `platform-compliance-approval.spec.ts` **1 passed** and
`compliance-document-transfer.spec.ts` **1 passed**. The provider submission
test is intentionally repeat-sensitive after a successful persisted submission;
rerunning it against the same synthetic request correctly encounters the unique
record guard rather than creating a duplicate. The persisted submission and
evidence relationship were independently verified before Platform approval.

The local fixture is finalized as `NOT_SCANNED` under the existing development
storage policy and is audited as a scan bypass. This is not evidence of a
malware-clean production upload; strict CLEAN-scan activation remains a separate
security requirement.

## Synthetic Business compliance workspace — 2026-10-14

- Authenticated local Platform identity: `triseindia@gmail.com`.
- Test: `tests/e2e/business-compliance.spec.ts` on `operations-desktop`.
- Result: **PASS, 1/1**.
- Verified: Business directory navigation, Business Compliance workspace, Legal
  Identity boundary messaging, Registrations/Brands/Trademarks section and
  catalogue-backed draft control.
- This is synthetic UI/workflow evidence only. It does not verify the pending
  authoritative Business legal-identity/GST ownership schema decision.
## Terminal Chromium launch verification — 14 October 2026

At the user's request, terminal Playwright Chromium launch was retried once
using the current supported local toolchain (Node 24.21.0, npm 11.19.0,
Playwright 1.64.0):

`npx --no-install playwright screenshot --browser chromium --timeout 15000 about:blank /tmp/trise-playwright-chromium-launch-20261014.png`

The CLI resolved and launched the bundled Chromium process, but Chromium
exited before page creation with a fatal macOS Mach permission error:
`bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission
denied (1100)`, followed by `SIGTRAP`; Playwright also reported `kill EPERM`.
The complete output is preserved at
`/tmp/trise-playwright-chromium-launch-20261014.log`.

No page, screenshot, navigation, responsive, console, uncaught-exception,
HTTP-error, failed-request, authentication, or workflow evidence was
collected. No explicit sandbox override, unsafe flag, or host security change
was requested; the Playwright screenshot CLI itself emitted `--no-sandbox` in
its launch command, so this did not qualify as repository browser acceptance.
No further retry or workaround was attempted. Browser acceptance remains
**BLOCKED_ENVIRONMENT**.

## Codex host escalation and authenticated acceptance — 14 October 2026

The requested narrow host escalation was approved. The first invocation used
the existing `browser-policy.test.ts`, which is a Vitest unit test excluded
from Playwright projects; it returned `No tests found` without launching a
browser.

The existing signed-out Operations smoke was then run once with Node 24,
Playwright 1.64.0, the standard Playwright browser cache, and the configured
Chromium sandbox still enabled:

`npx playwright test tests/e2e/public.spec.ts --project=operations-desktop --workers=1 --retries=0 --reporter=list`

Result: **PASS, 1/1**. Chromium launched and created a page outside the Codex
sandbox. This confirms the prior `bootstrap_check_in`/SIGTRAP/`kill EPERM`
failure was a host sandbox restriction, not a frontend launch regression. No
Chromium security flag, application code, production credential, or
authentication permission was changed.

The approved authenticated run initially used incorrect local fixture-line
mapping and produced 11 failures after page creation; those failures are
preserved as diagnostic artifacts and are not acceptance evidence. The
repository-documented identities were then used without printing secrets:
`liftriseorg@gmail.com` as Provider and `triseindia@gmail.com` as Platform
Admin.

Corrected non-duplicate authenticated checks ran on `operations-desktop` with
one worker. Result: **6 passed, 1 failed**. Passed coverage includes provider
Agent and asset workspaces, Platform Business compliance, private evidence
Preview and Download authorization, Platform queue tenant/ownership
exclusion, and provider-scoped audit history. No credentials, tokens,
cookies, or storage states were logged or committed.

Remaining actual UI failure: `roles-permissions-redesign.spec.ts` expected the
Platform Admin Status combobox to have value `draft`, but the rendered value
was empty. This is a post-launch application/UI acceptance failure, not a
Chromium or Codex permission failure. Evidence is preserved in
`docs/evidence/browser-automation/authenticated-compliance-corrected-20261014/roles-permissions-redesign-e2072-ponsive-and-server-filtered-operations-desktop/`
(screenshot, video, and error context).

The initial incorrect-fixture run and artifacts are preserved in
`docs/evidence/browser-automation/authenticated-compliance-20261014/`. The
signed-out smoke output is in
`docs/evidence/browser-automation/authorized-smoke-20261014/`; JSON summaries
are `/tmp/trise-playwright-smoke-20261014.json` and
`/tmp/trise-authenticated-compliance-corrected-20261014.json`.

Formal authenticated acceptance is **NOT COMPLETE**. The remaining blocker is
the roles Status-control failure; the repeat-sensitive evidence-submission
transaction was not rerun against an already-finalized synthetic record, and
the mutating Platform review transaction was not claimed as passed in this
run. The original Mach/Crashpad log remains preserved at
`/tmp/trise-playwright-chromium-launch-20261014.log`.

## Fresh Chromium verification — 14 October 2026

The existing signed-out Operations smoke was rerun once in the approved host
execution using Node 24, Playwright 1.64.0, the standard browser cache, and
the repository's configured Chromium security settings:

`npx playwright test tests/e2e/public.spec.ts --project=operations-desktop --workers=1 --retries=0 --reporter=list`

Result: **PASS, 1/1 in 1.3s**. Chromium launched and created a page; the
previous Mach `bootstrap_check_in` permission denial, SIGTRAP, and `kill EPERM`
were not reproduced. Fresh output is preserved at
`docs/evidence/browser-automation/verify-smoke-20261014/`, with the JSON
summary at `/tmp/trise-playwright-smoke-verify-20261014.json`.

This verifies browser startup only. Authenticated acceptance remains
**NOT COMPLETE** because the previously recorded roles Status-control failure
and unrun repeat-sensitive/mutating workflows still require resolution or
explicit rerun.

## Batch acceptance completion — 14 October 2026

The later approved host runs completed the relevant pending acceptance gates.
Batch 4 passed its live Rails suite (**30 tests, 211 assertions**), six-
viewport signed-out browser matrix (**6/6**) and authenticated tax workflow
(**1/1**). Batch 5 passed its documented integration gate (**15 tests, 130
assertions**), focused provider invitation/membership/RLS/role gate (**23
tests, 123 assertions**), authenticated Operations desktop checks (**4/4**
including the account inventory check), and narrow/tablet checks (**3/3**).

Browser evidence is preserved in the Batch 4 and Batch 5 directories under
`docs/evidence/browser-automation/`, including screenshots, videos and test
reports where produced. Chromium launched with its configured security
settings unchanged. No production credentials, session tokens, cookies,
permissions or application security flags were changed. The original Mach
permission crash remains diagnostic evidence only at
`/tmp/trise-playwright-chromium-launch-20261014.log`; it was confirmed as a
Codex host restriction by the successful escalated launch.

## Platform review transaction completion — 14 October 2026

The existing authenticated `platform-review-transaction.spec.ts` was run
with the approved local Platform Admin and Provider Admin fixtures. The
Provider audit isolation test passed. The seeded Business licence association
was assigned to an eligible reviewer and approved successfully in the live
development database. The final persisted state is `APPROVED`, with audit
actions `PROVIDER_LICENCE_AUTHORIZATION_REQUESTED` and
`PROVIDER_LICENCE_AUTHORIZATION_APPROVE`.

During verification, two real defects were fixed: the Platform Team list
omitted the documented `effective_permissions` field, and the licence
authorization controller lacked strict-input/UUID helpers. The acceptance
test also now reacquires the card after the post-mutation render. Evidence is
preserved under
`test-results/platform-review-transactio-88e06-usiness-licence-association-operations-desktop/`
and `/tmp/trise-platform-review-final-20261014.json`.

This closes the mutating Platform review transaction gap. The remaining legal
identity/GST schema decision and strict malware-clean activation gate remain
separate.

## Business legal identity/GST implementation verification — 14 October 2026

An escalated Chromium smoke run passed **1/1** (`public.spec.ts`, operations
desktop), confirming the earlier Mach/Crashpad failure is a Codex sandbox
restriction rather than a browser or frontend startup regression.

The authenticated Business compliance workspace passed **1/1** using the
existing local development auth fixture. It rendered the real Business
Details compliance route, Legal Identity submission control and GST
Registrations section without HTTP 5xx responses. Evidence is under
`test-results/business-compliance-Platfo-537d8-siness-compliance-workspace-operations-desktop/`.

The authenticated seeded licence-association check was **skipped**, not passed,
because the earlier live transaction had already persisted `Approved`. The
approved state was visible in the captured screenshot at
`test-results/platform-review-transactio-88e06-usiness-licence-association-operations-desktop/test-failed-1.png`;
no second approval was attempted. Authenticated runs used existing fixture
emails only; secrets were read privately by the fixture and no credentials,
tokens or cookies were logged.

## Business evidence and Provider compliance verification — 14 October 2026

The Business compliance browser test was rerun after adding the canonical
Business-owned document controls. It passed **1/1** unsandboxed and verified
the real Supporting Documents section and its server-authorized upload state.
The seeded Platform account is a reviewer without the upload capability, so the
UI correctly rendered the restricted state; no false upload success was
claimed. JSON output: `/tmp/trise-business-docs-browser-20261014.json`.

The existing authenticated Provider evidence test passed **1/1** unsandboxed.
It uploaded `synthetic-asset-approval.pdf`, finalized it through private
storage, selected the exact finalized evidence version, and submitted the
asset request. JSON output: `/tmp/trise-provider-evidence-browser-20261014.json`.
The local fixture remains `NOT_SCANNED`, so this verifies transfer and
governance, not a production CLEAN malware scan.

The Provider review renderer and acceptance test were then corrected. The
review API now returns the existing JSON:API `record.attributes` shape; the
development-only fixture uses separate submitter (`liftriseorg@gmail.com`) and
reviewer (`triseindia@gmail.com`) identities so maker-checker remains enforced.
The authenticated Provider review transaction passed **1/1** unsandboxed in
10.7 seconds. It reached the real queue, submitted an approval, received HTTP
200, and recorded no page exceptions or HTTP 5xx responses. Focused API
evidence also passed **1 test / 7 assertions**, including `APPLIED`, immutable
version, `APPROVED` record state and approval audit evidence.

Evidence: `test-results/provider-review-transactio-44ae2-ng-Asset-compliance-request-operations-desktop/`
for the retained Playwright artifacts, and the API test output from
`test/integration/provider_compliance_review_api_test.rb`.

The authenticated Platform Business v1→v2 acceptance transaction then passed
**1/1** unsandboxed in 10.1 seconds. It assigned a reviewer, approved the
pending Business change, received HTTP 200, and confirmed the applied request
was no longer in the pending queue. Rails/API governance tests remain the
evidence for immutable v2 persistence. The development seed was also rerun
successfully after making its existing-association check idempotent.

The next Provider-owned review transaction was attempted with the existing
Provider Admin fixture. The test was **SKIPPED**, not passed: the selected
Provider has four pending synthetic Asset requests in the development DB, but
the fixture has no effective role assignment granting the Provider review
capabilities, so the queue API is intentionally unavailable to that account.
This is an authorization-fixture blocker, not evidence of approval. JSON output:
`/tmp/trise-provider-review-browser-20261014.json`.

The development-only fixture was then given a provider-scoped synthetic reviewer
role, and the Provider review API transaction passed **1 test / 7 assertions**:
the queue returned the pending Agent request, approval persisted the request as
`APPLIED`, the compliance record as `APPROVED`, created immutable version 1, and
recorded the approval audit action. The browser test remains **SKIPPED** because
the same API response is not currently rendered as review cards by the live UI;
this is not reported as a browser approval. No production role or permission was
changed.

### Business GST UI governance verification — 14 October 2026

Chromium launched successfully in the approved unsandboxed host execution. The
authenticated Business compliance projects passed **3/3**: desktop (**1/1** in
9.6 seconds), tablet (**1/1**) and mobile (**1/1**), using the existing approved
local development auth fixture. The test observed no page exceptions or HTTP
5xx responses. The earlier missing-fixture attempt is retained as historical
`BLOCKED_AUTH_FIXTURE` evidence; no credentials, tokens or cookies were logged.
Artifacts are under `test-results/business-compliance-*/` and the normal
HTML/JSON reports were generated.

The authenticated Platform v1→v2 transaction subsequently passed **1/1** in
9.8 seconds. It approved the seeded request and verified the authoritative
Business Details page rendered immutable versions v1 and v2 and the applied
`TEST-ONLY-BUSINESS-V2` value. The test waits for the loaded Business payload
before asserting version history, closing the previous browser comparison gap.

### Superseding Provider Agent/Asset review verification — 14 October 2026

The existing development-only Provider reviewer fixture was aligned with the
shared JSON:API response contract and separate submitter/reviewer identities.
The authenticated Provider review transaction then passed **1/1** outside the
Codex sandbox in 10.9 seconds. It loaded the real Provider review queue,
approved the pending Asset compliance request, received HTTP 200, and recorded
no page exceptions or HTTP 5xx responses.

This supersedes the earlier historical `SKIPPED` result caused by missing
Provider review capability assignment and a renderer mismatch. The run used
synthetic local data only; no production role, permission, credential, token or
cookie was changed or logged. Artifacts are under
`test-results/provider-review-transactio-*/`.

The same authenticated run also passed the targeted Provider Agent review
transaction **1/1**. It selected the `AGENT` request from the real Provider
queue, submitted the approval, received HTTP 200, and recorded no page
exceptions or HTTP 5xx responses. The development seed is idempotent and uses
synthetic Agent data; the result does not represent a production permission
change or government credential verification.

JSON output: `/tmp/trise-provider-agent-asset-review-browser.json`.

### Final verification checkpoint — 15 October 2026

The original Codex-sandbox Chromium launch was not retried. Its Mach/Crashpad
failure remains preserved at `/tmp/trise-playwright-chromium-launch-20261014.log`.
Chromium startup and the authenticated Business, Platform and Provider browser
transactions above were executed successfully in the approved unsandboxed host
environment. No credentials, session tokens or cookies were logged.

The final non-browser gates also passed: Operations/Customer production build,
TypeScript typecheck, E2E typecheck, ESLint with zero warnings, and 31 Vitest
files / 172 tests. Provider review now includes a provider-scoped exact-version
evidence preview action using the existing signed transfer endpoint; the UI
contract is verified. The fresh unsandboxed authenticated run of
`provider-review-transaction.spec.ts` passed **2/2**: Asset review opened the
real provider-scoped evidence Preview and then approved the request, and Agent
review approved its request; both responses were HTTP 200 with no page
exceptions or HTTP 5xx responses. The separate
`compliance-document-transfer.spec.ts` run passed **1/1**, exercising both
Preview and Download and confirming short-lived URLs without a storage object
key. The development-only seed was corrected to preserve provider ownership on
repeatable Asset review fixtures; no production authorization behavior was
changed. Playwright artifacts remain in the `test-results/` paths listed above.
Browser acceptance is therefore **PASS for the executed local synthetic
workflows**, with production scheduler, external notification delivery and
strict malware-scan deployment evidence still outside this report.

## Compliance administration verification checkpoint — 15 October 2026

### Closure update — 15 October 2026

The previously reported Operations bundle-budget failure is closed in the
current build: Customer is **69,743** compressed JavaScript bytes and
Operations is **123,934**, both below the 204,800-byte limit. The UI suite is
**32 files / 174 tests passed**, E2E typecheck passed, both production builds
passed, and ESLint passed with zero warnings.

The existing host-managed Chromium smoke was verified again after the earlier
Codex-sandbox Mach/Crashpad failure:

```text
TRISE_E2E_DEVELOPMENT_SIGN_IN=true npx playwright test tests/e2e/public.spec.ts --project=operations-desktop --workers=1 --retries=0
1 passed
```

No unsafe Chromium flags, credentials, session tokens or cookies were used or
logged. The Codex-sandbox launch restriction remains historical environment
evidence only; it is not a current application blocker. Authenticated local
synthetic workflow evidence remains recorded in the dated artifacts above.

The current Codex workspace verification covered the authoritative Rails API,
Operations UI source and local development services without changing the
existing application workflow data.

- Rails compliance suite: **63 tests / 243 assertions passed**.
- Operations UI: **174 Vitest tests passed across 32 files**.
- TypeScript application and E2E checks: **passed**.
- ESLint with zero warnings: **passed**.
- Customer and Operations production builds: **passed**.
- `git diff --check`: **passed**.
- Bundle budget: **FAILED** for Operations at **209,526 compressed JS bytes**
  against the **204,800-byte** limit. Customer measured 69,743 bytes.

Static inspection confirms the compliance screens use the mapped provider-admin
patterns: compact shell/header, breadcrumbs, summary cards, filter controls,
readable tables, status badges, bounded detail/dialog sections and responsive
form/table CSS. This is not a fresh rendered visual acceptance result.

The preserved Chromium Mach/Crashpad launch failure was not retried in this
Codex sandbox. Existing host-run screenshots and browser transactions remain
historical evidence; no new authenticated navigation, screenshot, console,
request, responsive or workflow evidence was collected in this checkpoint.
Compliance administration is therefore **NOT COMPLETE** pending the bundle
budget failure and fresh browser/rendered verification in an approved host
environment.

## Browser verification update — 15 October 2026

Fresh host-managed Chromium verification completed with the repository’s existing
security settings (`chromiumSandbox: true`); no bypass flags, credentials, tokens
or cookies were logged or persisted.

- Operations signed-out smoke: **1 passed**.
- Authenticated Business compliance workspace: **1 passed** after updating stale
  selectors to the current three-dot Business actions menu, tabbed Business details
  and development `Not Scanned` document lifecycle.
- Platform Approval Inbox isolation test: **1 passed** after updating the stale
  heading/search selectors to the current Approval Inbox UI.
- Provider private evidence preview/download: **1 passed**.
- New invoice browser smoke: **1 passed**. Verified the routed four-step wizard,
  immediately visible eligible subscription, readable provider/plan data and
  authenticated inline PDF iframe preview.

Artifacts:

- `/tmp/trise-invoice-browser-verify.json`
- `/tmp/trise-business-browser-verify.json`
- `test-results/subscription-invoice-brows-3b350-oute-and-inline-PDF-preview-operations-desktop/`
- `test-results/business-compliance-Platfo-537d8-siness-compliance-workspace-operations-desktop/`

The original Codex-sandbox Mach/Crashpad failure remains historical environment
evidence. Real Chromium now starts successfully outside that sandbox. Development
document fixtures correctly report `Not Scanned`; no malware-scanning safeguard was
disabled.

## Current visual-verification harness — 17 October 2026

Added `tests/e2e/critical-visual-workflows.spec.ts` for authenticated Customer,
Global Admin and Provider Admin workflows. It runs through the existing desktop
(1440×900), tablet (820×1180) and mobile (390×844) projects and captures
workflow screenshots. The suite uses securely configured role emails and the
private API development-sign-in secrets file; no credentials, tokens or cookies
are committed to this repository.

The suite is statically validated (`npm run test:e2e:typecheck`) and discovers
18 viewport/role test entries. It has not been executed in this restricted
Codex environment because Chromium launch remains blocked by the preserved
macOS Mach-port/Crashpad permission failure. Visual verification is **PENDING**,
not passed. Failed tests are configured to retain screenshots, traces and
videos; successful workflow screenshots are attached to the Playwright report.

Normal-terminal execution subsequently confirmed Chromium can launch. The first
18-test run did not reach authenticated pages: 9 role/workflow cases failed at
the local-auth helper because the running app exposed the quick-sign-in
`select[name="email"]` while the helper expected a password input. The helper
now supports both quick-account selection and password-based local sign-in.
That run is an application-test failure, not a browser-runtime failure; visual
verification remains pending until the corrected suite completes.

Normal-terminal command:

```sh
cd /Users/anjanreddy/wrk/trise/trise-ui
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH"
export TRISE_E2E_DEVELOPMENT_SIGN_IN=true
npm run test:e2e:typecheck
npx playwright test tests/e2e/critical-visual-workflows.spec.ts --workers=1 --retries=0 --reporter=list,html
npm run test:e2e:report
```

