# Provider/subscription priority improvement batches

> Current status (2026-10-14): Batches 4 and 5 are complete through their documented automated, live-database and authenticated browser gates. Deferred outbound reminder delivery remains on hold. See [Batch 5 verification](testing/provider-subscription-batch5-results.md).


Authorized 10 October 2026. Preserve existing user work, provider isolation,
server authorization, accepted terms and separate Customer rendering.

| Batch | Scope | Acceptance | Status |
| --- | --- | --- | --- |
| 1 | Next steps/blockers, review reasons/correction feedback, duration/currency clarity | Separate decisions stay explicit; reasons reach existing APIs; historical invoices unchanged | IMPLEMENTED — automated checks pass; browser blocked |
| 2 | Due-change queue, incremental change/invoice history, provider/status/date filters, add-on invoice selection | No fake application/delivery state; server totals; compatible published add-ons and valid quantities | IMPLEMENTED — automated checks pass; browser blocked |
| 3 | Admin setup handoff, delegated onboarding assignments, contact/office management and paging | Existing contracts only; contacts do not create identities; revisions/idempotency retained | IMPLEMENTED — automated checks pass; browser blocked |
| 4 | Regression/contract tests, typecheck/lint/build/bundle/diff; browser/database checks if accessible | Distinguish automatic, source, live and browser evidence | COMPLETE — automated, live database, six-viewport browser and authenticated tax acceptance pass |
| 5 | Commercial edge rules and missing admin invitation/read contracts | Concrete decision package; architecture/authorization/schema approval before dependent implementation | COMPLETE — migration, integration/RLS, schema dump, desktop and narrow authenticated browser gates pass |
| Deferred | Outbound reminder delivery: sender, recipients, outbox and worker | Resume only on explicit user instruction | ON HOLD — user instruction, 10 October 2026 |

References inspected: `TRISE_Subscription_UI_Design.pdf` grouped commercial cards,
`Time Line Template.pdf` dated history. Apply Operations primitives, compact forms,
readable tables and explicit actions. Customer appearance stays unchanged.

Outbound reminder delivery is excluded from the active batches at the user's
request. Existing read-only reminder previews remain previews; they do not send
messages or establish delivery readiness.

The original Batch 5 gate depended on reviewed decisions: no platform membership
invitation contract was established. Existing manager-assignment commands do not
provide a list/read endpoint. Generic task authorization does not specify these
missing commercial, architecture or authorization rules.

## Batch 1 result

Implemented next-action guidance that distinguishes approval, payment verification
and activation; reason prompts for request/change/evidence decisions; invoice
evidence correction requests; explicit payment currency (no hardcoded INR).
Pending requests now receive detailed evidence loading ahead of an older accepted
request. Validation: 108 unit tests, typecheck, lint, both production builds,
bundle budgets and diff checks pass. Browser retesting remains BLOCKED.

## Batch 2 result

Change and invoice lists load incrementally with separate cursors and scoped
stale-response guards. Loaded-history provider/status filters and invoice
issue-date filters are explicit. Due changes are queued for review without
automatic application. Invoice add-ons require published versions, accepted
currency and positive integer units; amounts/taxes remain server-calculated.
Validation: 111 unit tests, typecheck, lint, builds, budgets and diff checks pass.


## Batch 3 result

Contact edits and endings use the contact-point ID, current assignment revision,
recorded reason and retained idempotency key. Office editing supports coordinate
clearing and expected revision. Both lists expose cursor loading and loaded
counts. Provider-scoped stale reads are ignored. Forms are disabled during writes.
Office deactivation remains unavailable because PATCH does not accept status.

Administrator handoff distinguishes membership readiness from delegation. The
existing manager-assignment create/end commands are exposed only with the
lifecycle capability; assignments are time-bounded in this UI and backend scope
checks remain unchanged. Only the latest returned assignment is displayed;
there is no invented assignment list, identity creation or membership invite.
Unknown administrator readiness now displays Not available.

## Batch 4 result — 11 October 2026

118 UI unit/contract/markup tests; 10 isolated Ruby tests / 33 assertions;
application and E2E typechecks; ESLint; four touched Ruby files through RuboCop;
both production builds; bundle budgets; seven E2E cases discovered; diff checks
PASS. Customer output remains the same bundle. Database/API integration execution
and rendered/authenticated browser acceptance remain BLOCKED by host restrictions.
No new screenshots, traces, real-browser pass or delivered reminders are claimed.

New invoices use accepted duration wording through `SubscriptionInvoiceDescription`.
The isolated regression covers all six durations and absent/unknown terms. An
integration assertion is prepared, syntax/style checked and NOT EXECUTED against
a database. Existing historical invoice snapshots are not rewritten.

## Batch 5 result

[Decision package](provider-subscription-policy-review.md), implementation,
live migration/integration/RLS checks, authoritative schema dump and
authenticated desktop/narrow browser acceptance are complete. Delivery of
outbound reminders remains ON HOLD.

## Operational workflow after host recovery

1. Register the provider and save business identity, contacts, offices and documents.
2. Review business evidence and capture the decision reason.
3. Select published terms and submit a subscription request; review its reasoned decision.
4. Append transaction evidence with the actual stated currency; verify or request corrections.
5. Activate the approved subscription using its verified evidence. Separately decide
   provider operational activation through its existing business-verification gate.
6. Confirm administrator membership through the authorized membership process;
   grant time-bounded platform onboarding delegation only when needed.
7. Issue an invoice using accepted currency, compatible published add-ons and an
   effective tax rate. Verify invoice-specific evidence before marking it paid.
8. Monitor loaded usage/history and review due changes. Apply each change explicitly;
   the backend rechecks eligibility. Reload and confirm the persisted result.

Browser acceptance checklist: reason modal keyboard/cancel behavior; USD evidence
payload; published versus draft/mismatched add-ons; invoice correction request;
contacts whose assignment ID differs from contact-point ID; stale revisions;
independent histories over 100 rows; assignment expiry/revocation; role/provider
isolation; refresh; desktop/tablet/mobile screenshots and sanitized diagnostics.
Use isolated development accounts/data; do not send reminders or reset databases.

Final checks repeated after the guidance/history adjustments: 118 UI tests,
application typecheck, ESLint, both builds and diff checks PASS. The final bundle
check also PASS. No dependency, authentication, schema or tenancy change was made
by the priority implementation batches.


## Latest verification pass — 11 October 2026 (superseded)

The supplied in-progress/planned statuses were checked against source and fresh
checks. Batches 1–3 are implemented and their automated validation passes. Batch 4
reports were refreshed; real-browser and database acceptance were retried and
remained blocked at that time; Batch 5 was review required at that time. See the [fresh verification
evidence](testing/provider-subscription-priority-results.md#fresh-batch-verification--11-october-2026).


## Unblock request — 11 October 2026

Batch 4's host gates were retried following the request to unblock all work.
They remain denied: in-app Browser metadata, loopback API, PostgreSQL on port
5433 and Chromium launch before page creation. Existing listeners were verified;
no healthy HTTP response or live acceptance was established. The active managed
session cannot grant itself the required host permissions.

Batch 5 now has a [concrete development approval package](../../trise-architecture/docs/provider-subscription-batch5-approval.md),
including commercial defaults, read/invitation/office contracts, privacy and
migration/rollback review. Approval was requested for the specified changes;
implementation must not be marked complete before approval and live validation.

## Batch 4 live-gate continuation — 14 October 2026

The focused Rails integration gate passed with Ruby 4.0.7 and the isolated test
database: **30 tests, 211 assertions, 0 failures, 0 errors, 0 skips**. The
documented `LEGACY` subscription tax mode was supplied only to the test
process; `.env.local` was not edited.

The existing signed-out browser matrix passed all six configured projects
(Customer and Operations at desktop, tablet and mobile): **6 passed in 5.5s**.
Evidence is in `docs/evidence/browser-automation/batch4-public-matrix-20261014/`.

The existing authenticated Platform tax-management browser test launched
successfully but failed at its expected `Submit Review` action. The page
showed `SAC_9983_TRISE_REVIEW` as `PUBLISHED`, with no draft row or Submit
Review button; the test assumes the imported candidate remains `DRAFT`. This
is a stale local development fixture/state mismatch, not a browser-startup
failure. Screenshot, video and error context are preserved in
`docs/evidence/browser-automation/batch4-tax-20261014/`.

Batch 4 is now **COMPLETE**. The UI request fix and locator-only acceptance
test fix were typechecked and linted; no database reset, direct status rewrite,
production credential change, or application security workaround was
performed. Batch 5 is complete; deferred reminder delivery remains on hold.
