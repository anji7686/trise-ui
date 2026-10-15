# Provider and subscription improvement batches

> Current status (2026-10-11): Batch 5 is approved and source implementation is present. Automated checks pass; PostgreSQL migration/integration/RLS and real-browser acceptance remain open due to host restrictions. This update supersedes earlier review-required/ON HOLD statements below. See [Batch 5 verification](testing/provider-subscription-batch5-results.md).


User-authorized implementation, 10 October 2026. Preserve Customer rendering,
server authorization, provider boundaries, revisions, and existing user changes.

| Batch | Work | Acceptance |
| --- | --- | --- |
| 1 | Provider-scoped subscription/request lookup, cursor traversal for selectors, load-more subscriptions/requests, local effective dates | Providers beyond the first global page remain visible; local time round-trips correctly; pagination failures never become empty-state success |
| 2 | Ignore stale responses on provider/search/route changes; serialize invoice/change actions; show failures; retain idempotency keys on uncertain retries | Older responses cannot overwrite newer selections; repeated actions do not run concurrently; failures are actionable |
| 3 | Provider readiness checklist; subscription expiry/capacity alerts; combined subscription history | Use only returned records and timestamps; never infer approval, payment, activation, or notification delivery |
| 4 | Regression tests, typecheck, lint, production builds, bundle budgets, diff check; authenticated desktop/narrow browser checks if available | Report automated, rendered, and authenticated evidence separately |

Visual references inspected before UI edits: `TRISE_Subscription_UI_Design.pdf`
(grouped commercial cards) and `Time Line Template.pdf` (compact dated history)
under the architecture repository's UBold directory. The filenames listed for
ecommerce detail/list in its index are absent in this checkout. Adapt existing
Operations primitives and table overflow; do not change shared Customer styles.

Existing API boundaries: subscriptions/requests accept `providerId` and cursor
pagination; plans support cursor pagination. Changes and invoices now support opt-in cursor pagination and provider filters;
legacy unpaginated responses retain their existing limits. Provider self-service
history has independent request/change/invoice cursors. The OpenAPI contract and
generated client are updated. No schema, auth, or new endpoint work is included.

## Batch delivery status

Batches 1–3 are implemented. Subscription/request tables now offer load-more;
provider detail queries retain `providerId` across pages. Selectors follow plan
and subscription cursors with repetition/size guards. Failed/incomplete reads
remain errors. Provider directory loads its first cursor and ignores older reads.
Local-date defaults round-trip in India. Subscription commands serialize actions
and retain retry keys after network/server uncertainty; invoice and change
failures appear in the UI. Provider switching clears subscription state.

The final review has an evidence checklist with links to each onboarding stage.
Platform/provider subscription screens show on-screen expiry warnings within
30 days, capacity warnings from 80%, and dated subscription timelines. Thresholds
are presentation hints, not new server eligibility rules. Approval, payment,
membership setup, subscription activation and provider activation stay separate.
History only displays timestamps returned by existing APIs. Review/evidence
detail is included for the displayed subscription's request (or a current request
when no subscription exists); other request rows show their requested dates.

Batch 4 automated verification: 90 tests across 16 files, TypeScript, lint,
Customer/Operations production builds, bundle budgets, and diff checks. The added
regression tests cover cursor/provider isolation, incomplete reads, stale
generations, serialized commands, safe retry keys, India date conversion,
validity/capacity notices, timeline truthfulness, and checklist evidence. Markup
rendering tests are not desktop/narrow visual acceptance.

Authenticated/rendered browser verification remains outstanding: the in-app
browser tool fails before connection with `missing field sandboxPolicy`.
Localhost/database requests from this managed session are blocked, so API
integration verification remains outstanding too. Existing server listeners
were observed on ports 3000/4173/4174 during the preceding verification task.

## Backend continuation

History pagination is implemented with signed cursors bound to the collection,
principal and provider filter. Platform screens traverse all available pages;
provider screens expose independent load-more controls. Existing pagination
traversal guards report incomplete reads instead of presenting partial success.
Eight isolated backend tests (25 assertions) pass. Three database integration
tests cover more than 100 records, equal timestamps, provider isolation,
independent history cursors and legacy limits; execution remains blocked by this
session's localhost policy. Ruby syntax and targeted RuboCop checks pass.

Reminder preview is implemented as a read-only service with explicit time windows
and stable candidate identities. It does not send messages or schedule workers.
Real delivery remains PROPOSED in
`../../trise-architecture/docs/subscription-reminder-delivery-proposal.md` because
ADR-042 excludes platform event workers and permits local simulated delivery.
Recipients, delivery adapter and durable outbox require architecture review.

See `browser-environment-blocker.md` for the host-owned sandboxPolicy failure,
recovery steps and the outstanding browser/database acceptance checklist.
