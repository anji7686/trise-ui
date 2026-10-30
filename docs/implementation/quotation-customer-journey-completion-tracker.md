# Quotation and Customer Journey Completion Tracker

**Overall status: IMPLEMENTATION COMPLETE · OPERATIONS RECONCILIATION PENDING**  
Last updated: 2026-10-30

This tracker consolidates the remaining work identified during the quotation,
AMC and Customer portal review. Each implementation item stays pending until its
focused checks pass and the user-facing behavior is verified where browser
access is available.

## Completed

- [x] Customer quotation journey: secure email deep link and sign-in, customer-scoped exact-revision review, provider branding, scope and payment/terms review, revision-bound messages, provider-review gate, explicit customer acceptance/decline and approver evidence. A development quotation was accepted live and the recorded revision/outbox event was checked. Evidence: [customer quotation review work plan](customer-quotation-review-work-plan.md).
- [x] Customer quotation review tabs: Scope & pricing, Payment & terms,
  Revisions & activity and Messages switch to one selected panel at a time;
  the active tab is announced accessibly and supports arrow/Home/End keyboard
  navigation. The live desktop review was checked panel by panel. Focused
  desktop and mobile E2E checks passed.
- [x] Quotation customer change flow: before customer acceptance, changing customer creates a replacement draft revision and retains the previous revision and its delivery/review history; accepted quotations cannot be reassigned.
- [x] AMC sample renewal journey: accepted renewal and active successor contract were verified in development.
- [x] AMC contract detail: correct covered-lift names, compact contract header, shared tabs and embedded, collapsible journey history were verified live.
- [x] Blank material warranty: an unchanged preview-only draft saved successfully with blank warranty omitted; database read confirmed no blank warranty field was persisted.
- [x] Customer email delivery: user confirmed receipt of the test quotation email.
- [x] AMC preventive maintenance checklists: active versioned checklists can be
  pinned to a provider plan; the selected immutable definitions carry into the
  quotation and successor contract, with customer-safe summaries on quotation,
  PDF and contract details. API journey tests passed (86 tests / 837
  assertions); Customer tests, typecheck and both app builds passed; OpenAPI
  validation passed. Live Operations plan editor showed five active choices and
  the Review step reflected the selected `Lift periodic inspection checklist ·
  v1` without saving a new plan.
- [x] Customer portal acceptance matrix: authenticated customer routes were
  exercised at desktop and mobile widths, including quotation, multi-lift
  quotation, AMC coverage, assets, documents and preview, alerts/preferences,
  feedback, help, profile, sign-in and Service History. Successful, empty,
  denied, retry, partial-error and stale-revision states passed. Keyboard-only
  navigation and 200% browser zoom were checked; the mobile quotation and
  project-history spacing issues found during review were fixed. Across the
  main and additional route runs, 65 cases passed; the two mobile skips are
  deliberate because those viewport/state matrices run once on desktop. A
  route-heading timing flake was fixed by extending the hydration wait, then
  the affected desktop and mobile test passed.
- [x] Customer portal capability parity: the supported current API-backed
  routes and capabilities are mapped in the [customer portal redesign
  workplan](customer-portal-redesign-workplan.md). Family/site-member invites
  and a standalone QR/quick-service requester remain deferred because the
  current API has no matching customer workflow. This closes supported
  capability mapping; it does not claim exact visual acceptance of every
  proposed mock screen.
- [x] Notification worker readiness: development Redis, Sidekiq, subscribed
  queues, notification/outbox pumps and accepted delivery records were checked;
  the customer confirmed receipt of the test email. Production prerequisites
  and verification steps are documented in the API repository's [quotation
  email worker readiness guide](../../../trise-api/docs/quotation-email-worker-readiness.md).
  One older `PROCESSING` delivery remains unchanged because local records cannot
  prove whether SMTP accepted it; the guide documents the safe reconciliation
  check and avoids a duplicate-risk retry.

## Pending

- [ ] **Reconcile one stale quotation delivery against secured SMTP logs.**
  Delivery `01a16e5f-19e8-7adf-8e8a-93d0b6d8afba` remains `PROCESSING` after one
  attempt. It has no SMTP message ID or acceptance timestamp. Current Sidekiq
  inspection found no matching job in queued, scheduled, retry or dead sets;
  local API logs contain the queued event but no SMTP acceptance event, and the
  Sidekiq log has no matching delivery. Check secured SMTP/provider logs before
  resolving or retrying it; the result remains ambiguous and a blind retry can
  send a duplicate. SMTP provider logs are not connected to this workspace.

## Verification log

- 2026-10-30: Reviewed quotation and portal implementation notes, API tax
  serialization, customer quotation rendering, PDF tax rendering, and existing
  quotation tax tests. Confirmed tax rates are absent from the customer
  quotation breakdown and PDF component totals; this is the first active item.
- 2026-10-30: Added a Journey history tab inside AMC contract details, collapsed
  the overview by default and removed the nested Journey-history popup. Live
  browser view, TypeScript and diff checks passed.
- 2026-10-30: Completed customer quotation tax disclosure. Customer API now
  includes immutable tax rule/version/rates and component names/rates/amounts;
  customer web derives a legacy total rate from component snapshots when the
  aggregate rule record is incomplete; PDF labels include component rates.
  `show_tax_details=false` suppresses tax values in both customer payload and
  PDF. Live taxed quotation `Q-4d234e09c74b` displayed the saved 18% rule and
  CGST/SGST breakdown. Focused API tests passed (59 tests / 545 assertions),
  customer UI tests passed (15 tests), typecheck/build passed, and OpenAPI
  validation passed. The hidden-tax PDF integration case found and fixed a
  nil-width table bug; both visible and hidden PDF generation now return valid
  PDF responses.
- 2026-10-30: Completed the AMC checklist snapshot journey. Provider plan
  versions pin active checklist definitions and item snapshots; quotation lines,
  generated PDFs, AMC contract asset scopes and customer-safe quote/contract
  views retain the selected version. API coverage passed 86 tests / 837
  assertions; Customer quotation tests passed (15); UI typecheck, Customer and
  Operations production builds, and OpenAPI validation passed. The live provider
  plan wizard displayed five active templates and showed the selected `Lift
  periodic inspection checklist · v1` on Review. No new plan was saved.
- 2026-10-30: Completed Customer acceptance coverage. The quotation, AMC,
  document, project and Service History run passed 28 cases with one
  desktop-only viewport matrix intentionally skipped on mobile. The initial
  notification layout run had one route-heading timing flake; after extending
  the route wait, the focused desktop and mobile rerun passed. The additional
  alerts, asset, document-preview, feedback, help, profile and sign-in run
  passed 37 cases with one desktop-only feedback eligibility case skipped on
  mobile. Keyboard navigation and native-browser 200% zoom passed; the long
  tax-rule and mobile spacing issues were corrected and visually rechecked.
- 2026-10-30: Closed the Customer capability map against supported API routes.
  Feedback, Service History and provider help/contact are implemented API-backed
  features. Family/site-member invitations and standalone QR/quick-service
  requests remain deferred because no matching Customer API workflow exists.
  The paused exact-screen mock comparison remains separate.
- 2026-10-30: Verified worker readiness: Redis returned `PONG`, one Sidekiq
  process was registered, the `critical`/`mailers`/`background` queues were
  subscribed, notification/outbox pumps were scheduled, and the mailers queue
  was empty. Two quotation deliveries were `SMTP_ACCEPTED`; the customer had
  confirmed receipt of the controlled email. A four-hour-old `PROCESSING`
  delivery (attempt 1) was left untouched without SMTP log proof; it has no
  matching queued/scheduled/retry/dead job or local app-log entry. This is the
  sole pending operational reconciliation. Added the production setup and
  deployment verification guide in the API repository.
- 2026-10-30: Final checks passed: 86 API integration tests / 837 assertions,
  UI lint, UI TypeScript and E2E TypeScript checks, both production builds, and
  `git diff --check` in both repositories. The Operations build reports a large
  chunk advisory but succeeds.
- 2026-10-30: Fixed Customer quotation section navigation. Live browser clicks
  confirmed all four destinations select and show their target; added active
  section tracking, reduced-motion-aware scrolling, sticky section navigation
  below the fixed header and a matching scroll offset. Desktop/mobile focused
  E2E checks passed (2/2), as did lint, UI and E2E TypeScript checks, Customer
  production build and diff check.
- 2026-10-30: Replaced the quotation review's stacked sections with accessible
  exclusive tab panels. Live clicks confirmed Scope & pricing, Payment & terms
  and Revisions & activity replace the displayed panel; dark theme and button
  spacing were checked in the browser. Focused desktop/mobile E2E passed (2/2),
  as did Customer typecheck, lint and quotation unit tests (15).
- 2026-10-30: Rechecked stale delivery `01a16e5f-19e8-7adf-8e8a-93d0b6d8afba`:
  it is still `PROCESSING` (attempt 1), without `accepted_at` or an external
  message ID. Sidekiq has one registered worker, 0 queued jobs, 2 scheduled,
  1 retry and 0 dead jobs; none matches this delivery. Local API logs show the
  queued event only. External SMTP/provider evidence is unavailable here, so
  the delivery remains untouched and pending reconciliation.
- 2026-10-30: Refined the customer quotation review layout after live review.
  The review header is more compact, the single scope line fills the panel,
  and the customer side navigation stays fixed while scrolling on desktop.
  Live browser checks confirmed the scope card fits at the top viewport and the
  sidebar stays in place on scroll. Customer quotation E2E checks passed on
  desktop and mobile for the standard review and eight-lift comparison (4/4);
  UI typecheck, E2E typecheck, lint, 15 quotation unit tests, and diff checks
  passed.
- 2026-10-30: Improved quotation readability after a second visual review:
  increased secondary-text contrast and minimum font sizes, strengthened the
  scope/price hierarchy, and tuned the dark theme's review label contrast.
  Live light and dark views were checked. Standard quotation review and the
  eight-lift layout passed again on desktop and mobile (4/4); lint, UI/E2E
  typechecks, quotation unit tests (15), and diff checks passed.
- 2026-10-30: Fixed the phone view where the sticky tab bar could cover the
  decision card while scrolling. Tabs now scroll normally on phones and remain
  sticky on wider screens. On phones the decision card follows the selected
  tab panel, with E2E geometry checks confirming clear separation and order.
  Customer quotation review passed on desktop and mobile, with lint, E2E
  typecheck and diff checks passing.
