# Functional verification report

> 2026-10-11 continuation: approved Batch 5 source additions and fresh checks are documented in [Batch 5 results](provider-subscription-batch5-results.md). Browser and PostgreSQL acceptance remain blocked; this does not establish authenticated/live acceptance.


10 October 2026. Evidence levels are kept separate.

| Check | Status | Evidence/limit |
| --- | --- | --- |
| E2E configuration and discovery | PASSED | Seven discoverable cases: six UI viewport/app combinations and one API case |
| TypeScript e2e types | PASSED | `test:e2e:typecheck` |
| Operations signed-out workflow | BLOCKED | Missing Chromium; retry fails before navigation |
| Rails `/up` and anonymous authorization | BLOCKED | API case attempted: `connect EPERM 127.0.0.1:3000` |
| Existing UI regression suite | PASSED | 90 tests rerun; unit/markup evidence, not browser acceptance |
| Backend history unit tests | PASSED in prior batch | 8 isolated tests, 25 assertions |
| Database integrations | BLOCKED | PostgreSQL access restricted |
| Authenticated roles and tenant isolation | UNTESTED in browser | No verified development account/session |
| Full inspect → reproduce → fix → retest demonstration | BLOCKED | No real screen opened; no fabricated defect |

Role coverage awaiting working browser and dedicated local accounts:

| Role | Read-only first checks | Subsequent synthetic workflow |
| --- | --- | --- |
| Platform Administrator | Grant-specific platform navigation; provider scope | Subscription review/history and billing validation |
| Domain Administrator | Verify implemented role/capabilities from API | Only workflows actually exposed by those capabilities |
| Provider Administrator | Provider membership, entitlements/limits | Onboarding, subscription and provider configuration |
| Provider Staff | Scoped requests/bookings/jobs | Request handling and assignment where authorized |
| Technician/Agent | My Work and authorized assignments | Visit execution and evidence against isolated jobs |
| Customer | Authorized provider/assets/documents | Service request and refresh consistency |

AMC is represented by Customer coverage where supported; notifications by alerts
and existing Rails notification tests. Standalone unsupported screens are not
assumed. For each workflow record method, payload shape, response status and
resulting UI; compare after refresh. Validate cross-provider reads/mutations using
known synthetic IDs and assert backend rejection, not just hidden controls.
Identify repeated requests by method/path/timing and distinguish React development
StrictMode reads from duplicate mutations. No production/shared writes, database
reset, external sends or authorization modifications were performed.

Next execution batch is one real Operations subscription screen. Capture the
initial defect, add the smallest regression, run required checks, reload and
repeat the original steps; only then expand the role matrix. Current environment
prevents that batch from starting.

Current checks also pass application TypeScript, ESLint, both production builds,
bundle budgets and diff whitespace checks. Browser configuration is separately
typechecked; no application UI code changed in this setup batch.

## Latest readiness recheck

See `browser-readiness-report.md`. Standard-cache Chromium is now installed and
the forced-empty-cache defect is fixed. Browser launch and localhost API access
still fail under the current host policy; full screen acceptance remains blocked.


## Priority batches — 11 October 2026

Batches 1–3 are implemented with existing contracts. Next-action guidance,
reason prompts, evidence currency, duration-specific invoice wording, due-change
review, incremental history/filters, add-on selection, contact/office editing and
administrator/delegation handoff are covered by source/unit/contract checks.

Validation: 118 UI tests, 10 isolated Ruby tests / 33 assertions, application/E2E
typechecks, ESLint, scoped Ruby style checks, both production builds, bundle
budgets and diff checks PASS. Seven E2E cases are discovered; discovery is not
browser execution. Database integration and browser acceptance remain BLOCKED.
No host-policy recovery, new screenshots or real-browser pass is claimed.

See [detailed priority results](provider-subscription-priority-results.md) and
[sequential workplan](../provider-subscription-priority-workplan.md). Batch 5's
commercial/missing-contract decisions await review. Outbound delivery is ON HOLD.


Browser connection was attempted again on 11 October 2026 and remains BLOCKED
before navigation by missing host `sandboxPolicy` metadata. See the
[per-use-case browser acceptance checklist](provider-subscription-browser-acceptance.md).
No new rendered screen or functional workflow pass is claimed.


## Fresh batch verification — 11 October 2026

The requested status list was stale: batches 1–3 already contain their planned
implementation. Source review and fresh automated checks confirm the existing
next-action/reason/currency helpers, due-change and add-on eligibility, independent
history cursors, revision-aware contact/office commands and administrator handoff.
No additional application change was needed in this verification pass.

| Check rerun | Result |
| --- | --- |
| UI regression suite | PASS: 118 tests across 19 files |
| Application and E2E TypeScript | PASS |
| ESLint, Customer and Operations production builds | PASS |
| Initial JavaScript bundle budgets | PASS: Customer 69,508; Operations 127,703 compressed bytes (204,800-byte limit each) |
| Isolated Ruby suite | PASS: 10 tests, 33 assertions, no skips |
| Four scoped Ruby files, RuboCop with cache disabled | PASS: no offenses; default home cache was unwritable |
| E2E discovery | PASS: 7 cases; discovery does not establish acceptance |
| In-app Browser connection | BLOCKED before execution: missing host `sandboxPolicy` metadata |
| Operations desktop E2E | BLOCKED before page creation: installed headless Chromium exits with `SIGTRAP` |
| API-public E2E | BLOCKED: `connect EPERM 127.0.0.1:3000` on `/up` |
| Rails history/platform/provider-self-service integrations | BLOCKED before tests execute: PostgreSQL connection denied |
| UI, API and architecture whitespace checks | PASS |

The two selected E2E cases exited as failures caused by their environment gates;
they are not passing workflows or confirmed application defects. Current error
contexts are under ignored `test-results/`; no page screenshot was produced.

Batch 4's automated work and report refresh are complete. Live database,
rendered and authenticated acceptance remain pending. Batch 5 remains a review
package: commercial rules and unsupported invitation/read/lifecycle contracts
cannot be inferred from generic task authorization. Outbound reminders remain
ON HOLD. Existing uncommitted application work was preserved.
