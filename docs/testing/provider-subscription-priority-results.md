# Provider/subscription priority batch results

> Superseded status: Batch 5 approved and source implemented; see [fresh Batch 5 results](provider-subscription-batch5-results.md). PostgreSQL and browser acceptance remain blocked.


11 October 2026. Code and automated verification; **no real-browser acceptance**.
See [workplan](../provider-subscription-priority-workplan.md) for scope and workflow.

| Capability | Implementation | Verification |
| --- | --- | --- |
| Next subscription action and accepted commercial terms | Implemented; approval/payment/activation stay separate | PASS unit/source; BLOCKED browser |
| Review reasons and invoice correction decision | Implemented through existing review commands; request decision reasons displayed | PASS checks; BLOCKED authenticated API/browser |
| Evidence currency | Explicit stated currency; missing/invalid currency rejected when amount supplied | PASS regression; BLOCKED real form/network |
| Duration-specific new invoice wording | Six accepted durations; unknown terms remain generic; historic snapshots retained | PASS isolated Ruby; integration prepared but database BLOCKED |
| Due-change queue | Loaded approved/scheduled records with due requested time; explicit apply remains backend checked | PASS regression; BLOCKED browser/API |
| Incremental changes/invoices | Independent cursors on manager, billing and provider detail; incomplete history explicitly labelled | PASS checks; BLOCKED live pagination |
| Loaded provider/status/date filters | Case-insensitive search, exact statuses, inclusive API dates | PASS regression; BLOCKED browser |
| Invoice add-ons | Active catalogue, published version, accepted currency, positive integer units | PASS regression; BLOCKED issuance/network |
| Contacts and offices | Revision-aware editing, contact ending/reason, pagination; contact-point IDs used for mutations | PASS mocked API contracts; BLOCKED authenticated writes |
| Administrator handoff | Readiness guidance; no unsupported invite/membership creation | PASS static markup; BLOCKED role browser |
| Delegated onboarding | Existing create/end API, bounded time, capability visibility, revision/reason/idempotency | PASS mocked contracts/static markup; BLOCKED live authorization |
| Office deactivation, assignment list, evidence review-reason reads, admin invitations | No supporting inspected API contract | NOT IMPLEMENTED; review package prepared |
| Commercial edge rules | Current backend behavior retained | REVIEW REQUIRED; no new denials/charge calculations |
| Outbound reminders | Excluded from active work | ON HOLD by user instruction |

Actual checks: 118 UI tests across 19 files; 10 isolated Ruby tests with 33
assertions; TypeScript application/E2E checks; ESLint; RuboCop for four touched
Ruby files; both production builds; bundle budgets; E2E discovery (7 cases,
not execution); whitespace checks. Initial compressed JS: Customer 69,508 bytes,
Operations below the 204,800-byte initial-JS budget. No Customer source/style changes
were introduced by these priority batches.

Database integrations and authenticated tenant/role rejection tests remain
BLOCKED. Existing host evidence remains in the local ignored browser artifacts;
no new screenshots or traces were produced by unit or markup tests. Existing
security checks were preserved. No reset, external reminder send, commit or push.

Host-side next step: an administrator must provide a managed session permitting
loopback development HTTP/PostgreSQL and browser launch, repair host-owned browser
metadata, and expose connected MCP tools. Do not edit sandboxPolicy or disable
browser/macOS security. Follow [readiness report](browser-readiness-report.md).


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
