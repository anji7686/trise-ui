# UI verification report

> 2026-10-11 continuation: approved Batch 5 source additions and fresh checks are documented in [Batch 5 results](provider-subscription-batch5-results.md). Browser and PostgreSQL acceptance remain blocked; this does not establish authenticated/live acceptance.


10 October 2026. No screen has received rendered browser acceptance in this
session. Source inventory below is not a successful screen inspection.

| Application/screen family | Discovered source/routes | Status |
| --- | --- | --- |
| Customer sign-in | `apps/customer/src/main.tsx` | BLOCKED; three viewport tests prepared |
| Customer workflows | home, assets/detail/request, requests/detail, bookings, alerts, profile, quotations, coverage, documents/detail | UNTESTED in browser |
| Operations sign-in | `apps/operations/src/main.tsx` | BLOCKED; desktop attempted, launch failed |
| Platform | overview, providers/detail, plans, subscriptions, requests, usage, billing | UNTESTED in browser |
| Provider/dispatcher | overview, requests, bookings, jobs, customers, onboarding, configuration, business profile, subscription, workforce, audit | UNTESTED in browser |
| Technician/Agent | jobs/my-work, visit/execution and evidence panels | UNTESTED in browser |
| Domain administrator | No separate named domain-admin UI established from inspected navigation | UNTESTED; verify actual grants, do not invent screen |

Source discovery: hash routing in both `main.tsx` files; capability-filtered
Operations navigation in `navigation.ts`. Role visibility is API-derived.

Prepared first-screen test checks heading/sign-out privacy, page overflow,
protected deep link, refresh persistence and accessible DOM. It does not validate
signed-in keyboard navigation, modal alignment, search, filters, forms or tables.
Those remain untested at all viewport sizes.

Execution: Operations desktop failed before page creation because Chromium was
missing; retry trace and error context saved under `test-results`. Browser tool
connection separately failed with missing `sandboxPolicy`. Download failed DNS.
No screenshots or videos could be captured because no page opened. No visual
application defect is confirmed, fixed or browser-retested.

Installed Chrome fallback also closed before page creation (`SIGABRT`, cleanup
`EPERM`). No UI acceptance resulted from that attempt.

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
