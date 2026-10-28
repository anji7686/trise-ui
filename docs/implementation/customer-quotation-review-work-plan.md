# Customer quotation review implementation plan

## Goal

Deliver a customer-facing quotation review that opens from the email, uses the existing TRISE sign-in, shows only the signed-in customer's authorized quotation, and records acceptance against the exact issued revision.

## Work sequence

1. **Review the current contract and access boundaries.** Confirm customer app routes, sign-in return behavior, quotation serialization, approval eligibility, existing terms snapshots, and existing email delivery behavior.
2. **Build the live review journey.** Add a deep link to one quotation, customer-scoped list and detail screens, scope and specification, commercial totals and payment stages, warranty/AMC/conditions, revision and decision records, acknowledgement checklist, and explicit acceptance confirmation. Use server data and existing idempotent API commands.
3. **Update quotation email.** Remove the PDF attachment and provide a review link to the customer portal. The quotation detail remains behind existing authentication and server authorization.
4. **Verify.** Run UI typecheck, tests, lint, builds and bundle checks; run the API quotation delivery and acceptance tests; exercise signed-out redirect, authenticated detail, responsive rendering, and one safe development acceptance in the browser.

## Current implementation boundary

The API now provides exact quotation-family conversation reads, revision-bound customer questions/change requests and provider replies, plus an exact-snapshot customer-authorized provider-logo read. Approval records capture the signed-in approver name and role with an explicit authority attestation. Message writes are idempotent, immutable, and emit an outbox event for participant notifications. The customer portal remains behind the existing sign-in and quotation/customer relationship authorization.

## Verification status

Final audit — 2026-10-28:

- Added provider/revision-scoped immutable quotation communications, exact-snapshot provider-logo delivery, approver evidence fields, and platform-global notification delivery lineage. The schema includes migration `20261028161000`; all migrations are applied in the development database and schema/docs were regenerated.
- Added platform defaults for both conversation updates and quotation acceptance. The acceptance handler uses provider-specific notification configuration when present and falls back to the platform catalogue; the API integration test now verifies that global fallback.
- UI verification after those changes: typecheck passed; 46 test files and 298 tests passed, including new customer and provider conversation request-contract checks; lint passed; customer and operations builds passed; configured initial compressed bundle limits passed (Customer 78,635 bytes, Operations 181,492 bytes).
- API verification: the final full suite passed (1,112 tests / 8,046 assertions); the focused quotation and notification suites passed (66 tests / 546 assertions), including the customer provider-logo authorization test. API documentation validation passed for 679 canonical operations, 428 implemented operations, 239 application tables, 220 RLS tables and 10 ERD groups.
- Live browser audit used the development quotation `Q-8f7e8e414785`: provider approved R4, the signed-in customer reviewed the scope and terms, attested as “Demo Community Customer” / “Authorized Test Approver”, and accepted. The portal rendered ACCEPTED at R5. A read-only database check confirmed the R5 decision snapshot and one `quotation.approved` outbox event. The customer and provider also saw their R4 conversation, and the customer notification bell showed one unread conversation notification. The separate earlier accepted E2E record was left unchanged.
- The same review page had previously been checked at 390 px with no horizontal overflow. Current desktop browser review confirmed both sides of the R4 conversation and preserved the awaiting-provider-approval gate.
- The local environment has no running Sidekiq/outbox worker. The live conversation notification was dispatched through the application event dispatcher. The acceptance event happened before its platform trigger was seeded, and the database correctly prevents backdating published triggers; acceptance notification delivery is verified by the API integration test using a fresh event. Production notification delivery requires the configured worker/pump to be running.
- The Operations bundle still emits Vite's >500 kB uncompressed chunk advisory. Configured compressed initial-bundle budgets pass. `git diff --check` passed in UI, API and architecture repositories.
