# Provider and subscription browser acceptance

11 October 2026. **PARTIAL — core authenticated local provider/subscription/billing workflows executed through MCP; terminal Playwright acceptance BLOCKED.** Google authentication testing remains unverified.

Chrome DevTools opens both real local React applications and reaches Rails. The approved development email/secret mechanism now supplies normal existing-user sessions. The [readiness report](browser-readiness-report.md) records provider registration/profile/contact/office/lifecycle, subscription approval/payment/activation/upgrade, usage and invoice payment results, actual synthetic local records, screenshots, diagnosed defects and automated checks. Interactive MCP evidence is separate from terminal Playwright Test acceptance; the earlier sandbox-enabled CLI launch failed and was not retried. No auth bypass or new authority grants were used.

## Execution order and use cases

Use dedicated development identities, isolated providers and synthetic financial
references. Read-only cases first. Capture sanitized console/exception/network
evidence, DOM and screenshots; inspect unexpected responses rather than hiding
errors. For writes, verify the exact payload, backend response, resulting UI and
fresh read after reload. Use current revisions and retain retry idempotency keys.

Core portions of P01–P07/P10, S01–S08 and B01/B04 now have actual authenticated evidence. These checklist IDs contain additional branches, so they are not blanket PASS labels. P08/P09, S09, B02/B03, A02 and complete X01/X02 matrices remain unexecuted; A01 accurately displayed Not Configured and restricted invitation capability without creating grants. See the latest readiness section for exact executed steps and remaining acceptance.

| ID | Use case | Expected browser acceptance |
| --- | --- | --- |
| P01 | Sign-in, sign-out and protected links | Authorized navigation follows actual grants; anonymous deep links expose no private records; logout clears private state |
| P02 | Provider directory search, status filter, pagination | Clear labels and empty state; cursor loading retains scope and avoids duplicates; selecting a provider opens its correct detail |
| P03 | Register and edit provider | Required/invalid fields explained; create versus edit is clear; persisted values survive reload; stale revisions are reported |
| P04 | Business profile save, submit, review | Draft save and submission are distinct; reviewer sees evidence and reason; pending review is not displayed as verification |
| P05 | Contact creation | Email/mobile validation is understandable; primary conflicts reported; contact creates no login or membership |
| P06 | Contact edit/end | Mutation uses contact-point ID, not assignment ID; expected revision and reason retained; ended contact persists after reload |
| P07 | Office create/edit | Address/coordinate validation clear; clearing coordinates works; revised address persists; unavailable deactivation is not offered |
| P08 | Contact/office pagination and provider switching | Loaded counts are explicit; more pages reachable; stale responses never populate a different provider |
| P09 | Documents/logo upload, preview, download | Only authorized development attachments; loading/error states visible; denied or expired transfer does not expose another provider's document |
| P10 | Onboarding readiness and provider lifecycle | Missing/unknown evidence labelled accurately; activation is a separate business-verification-gated command; applicable restrictions require reasons |
| S01 | Published plan selection and request submission | Accepted version and requested date clear; published choices only; request is not shown as an active subscription |
| S02 | Request approve/reject with reason | Reason required; cancel/Escape sends no mutation; confirm sends captured reason/revision; recorded request decision visible after refresh |
| S03 | Request/change payment evidence | Explicit stated currency, including non-INR; reference/amount validation; evidence submission does not imply verification |
| S04 | Evidence verify/reject/request correction | Separate decisions and correction/resubmission guidance; no invented review-history data; successful review state persists |
| S05 | Subscription activation | Approved request with verified evidence succeeds when eligible; missing payment/authorization is rejected; provider lifecycle remains separate |
| S06 | Accepted terms, validity, usage and next action | Currency/duration/limits come from accepted records; unknown information is not zero/false; validity projection does not claim automatic suspension |
| S07 | Request/submit change or renewal | Correct subscription and target version captured; cancellation omits target plan; server checks revisions and commercial gates |
| S08 | Due-change review and explicit application | Future scheduled changes never appear applied; due queue reflects loaded records; payment, timing and revision failures are understandable |
| S09 | History filters and independent pagination | Provider/status/API-date filters readable; loaded scope explicit; boundary dates correct; changes/invoices paginate separately beyond 100 records |
| B01 | Invoice subscription/tax selection | Search scope and load-more control clear; selected active subscription belongs to intended provider; backend validates tax/date eligibility |
| B02 | Invoice add-ons | Published currency-compatible versions only; integer units clear; invalid/stale selections rejected; displayed totals are server-calculated |
| B03 | Invoice duration wording | New DAY/TEN_DAYS/WEEK/MONTH/QUARTER/YEAR invoices show accurate accepted-duration description; historical snapshots retained |
| B04 | Invoice evidence, corrections and paid state | Invoice-specific evidence verified before marking paid; rejected/unverified evidence cannot pay an invoice; refreshed collection state consistent |
| A01 | Administrator setup and handoff | Unknown readiness distinct from not configured; membership versus delegation clear; unsupported invitation creation not offered |
| A02 | Time-bounded delegated onboarding assignment | Existing-user ID/start/end validation; create/end responses and revisions preserved; latest-result-only scope explicit; no implicit platform/membership grant |
| X01 | Authorization and tenant isolation | Readers cannot mutate; writers cannot assume reviewer powers; cross-provider operations rejected by backend; revoked/expired grants lose access |
| X02 | Duplicate clicks, failed request, refresh and retry | No duplicate mutation; uncertain retry preserves key; error remains visible; refresh reflects authoritative data |

## Clear and easy interface criteria

For every applicable screen, run desktop 1440×900, tablet 820×1180 and mobile
390×844 checks using the configured viewport projects/patterns:

- The page title, selected provider and next action are obvious without reading
  an implementation note. Plan approval, payment review and activation have
  distinct labels and status indicators.
- Labels identify currency, quantity units, date meaning and required fields.
  Errors explain how to correct the entry near the affected field.
- The primary action is easy to identify. Save, submit, review, activate and
  mark-paid states are distinct; pending/loading actions cannot be repeated.
- Tables remain readable, with overflow inside the table rather than the page.
  Filters/counts describe loaded records and pagination is discoverable.
- Modal focus stays within the dialog; keyboard users can reach controls,
  cancel with Escape and return to the trigger. Buttons/inputs have accessible
  names and visible focus.
- Empty, unavailable, loading, failed and successful states are distinct.
  Success is confirmed by a fresh backend read rather than optimistic text alone.

A case passes only after its original steps execute in a real browser and the
expected result is observed. A code/unit pass is recorded separately. Confirmed
defects require evidence, a maintainable fix, relevant regression checks and a
browser retest before being closed as browser-verified.

## Required host recovery

The host administrator must repair the browser transport's missing required
metadata and start a session with the reviewed development permissions active.
That session needs approved loopback HTTP/API/database access and browser launch.
Connect and expose the configured MCP tools if they are to be used. Changing
project files cannot repair host-owned metadata. Do not manually alter
sandboxPolicy or disable browser/macOS security.

After recovery, verify the browser connection and local health first, then run
P01/P02/S06 as read-only checks before isolated mutations. Outbound reminder
delivery remains ON HOLD. No database resets, production/shared mutations,
external sends, commits or pushes are authorized by this checklist.

Related: [readiness report](browser-readiness-report.md),
[automated batch results](provider-subscription-priority-results.md),
[defect register](browser-defect-register.md).
