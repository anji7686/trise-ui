# TRISE India — Subscription Billing and Invoice UX Refactor

**Instruction to Codex:** Implement and verify this plan in small batches. Do not merely produce a plan or screenshots. This is a complete UI/API integration and regression-validation task.

## Source references and project discovery

- Current screens: Platform Administration > Subscriptions > Billing & Payments > New subscription invoice; Invoice detail.
- User-provided reference invoice: `TRISE-202610-B6068A69ED` (issued 13 Oct 2026).
- Confirm the *actual* frontend repository path from the checked-out working tree; prior UI documentation used `~/wrk/lre/trise-ui`, but paths have changed before. Do not assume.
- Verified backend location from the user's terminal: `~/wrk/trise/trise-api` (Ruby 4.0.7, Bundler 4.0.21, Rails 8.1.3.1, PostgreSQL development database). Do not use the obsolete `~/wrk/lre/trise-api` path.
- The prior `rails zeitwerk:check` had a `Trise::Taxation::Errors` namespace error; inspect and resolve or report it as a blocker before claiming passing eager-load/backend suites.
- Inspect Rails controllers/services/policies, OpenAPI, existing billing ADRs, accepted commercial snapshots, tax engine, recipient tax context, invoice PDF generation, payment verification, email delivery, roles and existing tests.
- Retain existing routes/API compatibility or provide safe redirects/deep links.

## Priority findings from current screenshots and reference PDF

1. Invoice creation occupies a very wide modal, with form content mainly on the left and excessive blank space on the right.
2. Nested scrolling, an anchored footer, and long two-column form panels make creation difficult to follow.
3. Subscription selector hides loaded subscriptions behind a search field and an unnecessary 3-character input instruction. It shows '2 active subscription records loaded' but poor contextual data.
4. Recipient tax context becomes editable only after selecting subscription; it appears detached from the parent Business and legally relevant recipient information.
5. Central tax-engine card and empty add-ons consume large space while the customer cannot see a complete payable summary.
6. The invoice detail page separates 'View PDF' and 'Download PDF', and the user wants 'View PDF' to **render inline**, not to navigate away or cause a download.
7. Invoice detail amounts use inconsistent currency formatting; dates and timelines could be clearer.
8. The sample PDF shows base INR 3,999, CGST INR 359.91, SGST INR 359.91, total INR 4,718.82; arithmetic is correct. Keep all monetary computations server-authoritative.
9. The sample PDF says 'Issued By: LIFT RISE ELEVATORS LLP' and 'Address not recorded' for a TRISE subscription. Verify the correct invoice *issuer* legal entity; do not silently substitute identities.
10. Sample PDF footer names `sahayya@sahayya.in`; verify the authorized support contact for the actual issuer. The sample does not visibly show a seller GSTIN. Determine requirements using the confirmed seller's registration/legal configuration; do not fabricate tax IDs.
11. Distinguish `recipient`, `subscriber`, `provider`, `linked business`, `issuer`, `payer` and `payment verifier` as separate domain roles.
12. Screenshot recipient billing context and existing issued PDF may represent distinct snapshots, so do not assume they are the same record. Explicitly test draft-to-final snapshot fidelity for each invoice.

## Target IA and navigation

- Keep Subscriptions > **Billing & Payments** as the list/home view.
- `New invoice` opens a dedicated routed page (not a modal), with breadcrumb `Subscriptions > Billing & Payments > New invoice`.
- Existing invoice opens a dedicated routed details page with a readily accessible **inline PDF preview**.
- Include a clear return link, keep navigation context, and warn on leaving unsaved draft changes (only if draft state exists).
- Use a horizontal progress stepper for invoice creation, with clear current/completed steps, appropriate Back/Continue actions, and a single final Issue button.
- A draft preview must not be described or displayed as an issued immutable tax invoice.

## New Invoice — four-step guided workflow

### Step 1: Select subscription

- Show an always-visible search input; list records immediately, even without typing three characters.
- Search/filter on the server by provider display name, linked Business name, plan display name and existing human-friendly reference/code; do not display UUIDs in ordinary UI.
- Provide compact, responsive selectable rows/cards with: provider name, subscribing Business/recipient where authoritative, plan name, billing cadence, accepted snapshot amount/currency, status, period/validity, and outstanding invoice warnings where API supports them.
- Display all paginated eligible results; do not imply client-side loaded subset equals all subscriptions.
- Enforce subscription issuance eligibility, duplicate period/invoice checks, permissions and idempotency server-side.
- Show a descriptive selected-subscription summary above the next step; offer Change subscription.
- Show meaningful empty state (no eligible subscriptions; no search matches; insufficient permission) and an actionable next step where supported.

### Step 2: Recipient and due date

- Default to authoritative recipient billing context linked to the chosen subscription and Business (not another provider's address).
- Display readable legal/billing name, billing address, contact, place of supply, tax registration status and GSTIN when applicable, including data source and verification state.
- Distinguish company/Business-owned GST registration from provider subscription issuer and delivery contact.
- Let an authorized platform admin adjust **invoice recipient billing context** only via existing permitted contract; if this requires a new contract, propose an ADR/OpenAPI change first.
- Allow 'GST not registered' only when permitted and supported, require a reason for sensitive overrides, and preserve audit actor/context. Do not edit canonical GST registrations from this form.
- Show precise field errors; prefill due date from policy when the backend provides it, and allow changing it only when permitted. Validate issued date, due date, grace period, and timezone (format human-readably, e.g., 14 Oct 2026).
- If issuer details or tax registration are missing for legally required issuance, block issue and direct authorized users to the correct issuer/billing administration area.

### Step 3: Charges, add-ons and tax

- Show the immutable accepted plan's commercial snapshot (do not recompute plan price using current catalogue rates).
- List included recurring charges and available compatible add-ons, if any. Collapse 'No compatible add-ons' to a single neutral line rather than a large empty card.
- Show central tax engine configuration as compact read-only info / tooltip, not a full half-column. Do not allow manual selection of arbitrary tax rates in central mode.
- Obtain quote/tax preview from the existing server API; debounce updates as appropriate and handle quote expiration / stale revisions.
- Show server-calculated taxable amount, tax breakdown (CGST/SGST/IGST as applicable), adjustments/add-ons, rounding, final total and currency.
- Display a sticky/right-side totals summary on large screens; stack below current step on tablet/mobile. Never invent/fallback to hardcoded tax rates.

### Step 4: Review and issue

- Show one compact review page: selected provider/Business, bill-to, *actual configured legal seller* as issuer, billing period, due date, itemized charges, tax rule summary, total payable and recipient contact.
- Show clear server-side blocking warnings and action links, including missing legal seller details, GST context or unverified required data.
- `Preview invoice` provides a clearly watermarked, provisional/unsigned preview only if API supports it; otherwise show a faithful on-screen summary without pretending a final PDF exists.
- `Issue invoice` requires confirmation, appropriate permission, current version and idempotency key. Disable concurrent duplicate clicks, surface server errors, and navigate to the issued invoice details on success.
- After issuance, issued invoice line items, tax, issuer, recipient and billing period must remain immutable. Corrections use the supported credit-note/cancellation/reissue process, never an in-place rewrite.

## Issued Invoice detail — clear page hierarchy

- Header: Invoice number, supplier/recipient, issue date, due date, payment/collection status, invoice amount.
- Actions: **Preview PDF** (primary, inline), **Download PDF** (explicit), Email/Send/Resend only where supported, and Back to invoices.
- Top summary card: final amount, tax amount, billing period, outstanding balance and payment state if actually provided by API.
- Short sections or tabs: `Overview`, `PDF Preview`, `Payments & Delivery`, `Activity`. For narrow screen, use stacked sections.
- Overview: provider and Business display names, legal issuer, bill-to, invoice number, itemized charges and tax breakdown; consistent ₹#,##0.00 formatting.
- Collapse technical tax-rule/version into 'Tax calculation details' rather than taking up the main summary.
- Payments: preserve collection and evidence verification as distinct states. Append a transaction reference/evidence via approved API; only authorized verifier can verify and mark paid, with audit and idempotency. Never equate a text reference with verified payment.
- Delivery: display email status, last attempted/sent timestamp, recipient address and error/retry where exposed by API; `Email invoice` and `Resend` must not silently send duplicates.
- Activity: server-backed, chronological events with human-readable actor and meaningful action; preserve immutable audit history.
- Use pagination when many payment events/activities exist; do not load unbounded history.

## Inline private PDF preview (required)

- `Preview PDF` must render the authoritative issued PDF **inside the TRISE web app** (tab, embedded panel, or side drawer), rather than immediately downloading or opening a new browser tab.
- Render a properly sized PDF viewer with page controls, zoom, fit width/page, loading indicator and explicit Download/Print controls if permitted. Use existing PDF.js integration if present; otherwise evaluate a maintained viewer.
- Fetch via an authenticated, authorized endpoint returning application/pdf, or a short-lived authorized transfer. Do not expose raw S3 storage keys, unrestricted public URLs, tokens, or permanent signed links.
- If using Blob/object URLs, manage lifecycle/revoke them; maintain appropriate CSP, PDF content type, PDF validation, role checks and secure rendering.
- Respect restricted/document revocation and prevent cross-tenant access. Display 401/403/404/expired/preview error states appropriately.
- Browser restrictions may limit protected PDF rendering; build a graceful fallback: an explanatory message plus separately authorized Download, never a silent forced download on View.
- Match PDF preview to the immutable issued version and verify invoice number, issuer, recipient, line items, taxes, totals and dates against the response.

## PDF content quality and correctness

- Audit issuer resolution logic: verify whether invoice seller should be TRISE's legal entity or another explicitly configured legal issuer. Do not assume the currently displayed Lift Rise Elevators LLP is correct merely because the invoice generated.
- Resolve missing issuer address from authorized legal-entity configuration; show a blocking validation/error as appropriate instead of silently outputting 'Address not recorded' on invoices requiring that identity.
- Validate seller GSTIN, buyer GSTIN, place of supply, HSN/SAC/tax codes, invoice numbering, tax-component labels, support contact and required issuer identifiers against applicable invoicing rules and domain configuration. Do not fabricate.
- Confirm PDF logo belongs to the issuing legal entity/product branding per approved policy; Business/Provider logos must not overwrite legal issuer identity.
- Standardize money formatting and layout; handle long names, multi-line addresses, multiple items and multi-page invoices without overlap.
- Keep issued PDFs stable/versioned. If a PDF template changes, historical documents should remain based on their finalized snapshots as required by policy.

## Backend and API contract audit

Before coding, map actual existing endpoints and OpenAPI definitions for:
- Search/select eligible subscriptions and accepted commercial snapshots.
- Retrieve linked Business and billing recipient context.
- Retrieve configured issuing legal entity and authorized invoice identity/tax fields.
- Server-side tax quote / preview (including effective rule/version and place of supply).
- Issue an invoice with concurrency, idempotency and duplicate-period validation.
- Retrieve invoice detail, immutable snapshot and PDF stream.
- Append and verify payment evidence; collection/settlement status.
- Email/send/resend and delivery history.
- Invoice and payment audit events.

For any missing contract, document exact request/response fields, tenant scope, permissions, errors, tests and migration/ADR requirements. Do not invent production endpoints or silently add unrelated database columns.

## Design system, accessibility and responsive behavior

- Preserve TRISE navy/white branding, with purposeful accents: navy primary actions, green only for confirmed success/paid, amber for pending or warning, red for errors/overdue; do not convey meaning by color alone.
- Desktop 1440px: page-width content max about 1200–1360px, coherent 2-column step content + compact sticky total; avoid 50% unused whitespace.
- Tablet 768–1024px: single-column step, summary below; mobile 390px: full-width fields and sticky nonblocking step actions.
- Use 14–16px legible body copy, aligned labels, consistent date/money formatting and spacing.
- Modal should be reserved for short confirmation actions, not the entire invoice workflow.
- Meet accessible focus management, Escape/back navigation, keyboard selection, screen reader labels for status/totals, and minimum target size.
- No nested scroll trap, accidental form reset, clipped footer, overlapping controls or horizontal overflow.

## Test plan — run, record evidence, do not claim unexecuted PASS

### Subscription selection
1. Two or more eligible subscriptions display immediately, no 3-character search gate.
2. Search by Business/provider/plan; server pagination and empty states work.
3. Cross-tenant or unauthorized subscriptions do not appear and cannot be issued by API.
4. Duplicate period handling and idempotent repeated Issue clicks.

### Recipient and tax
5. Prefill from correct Business; editable controls obey API policy and permission.
6. Correct issuer is not inferred from the subscriber; test conflicting entity names.
7. Valid registered and unregistered GST flows, place-of-supply and tax-component selection, no hardcoded rates.
8. Missing required seller details cause actionable validation.
9. Due date and currency formatting, backend total is source of truth.

### Invoice finalization and content
10. Compare UI summary, issued response and generated PDF snapshot for every field.
11. Sample fixture: 3,999 + 359.91 + 359.91 = 4,718.82; assert using decimal arithmetic.
12. Test multi-line addresses, multiple items, long names, multi-page PDF.
13. Historical invoices remain immutable following plan/tax configuration changes.

### PDF preview
14. Preview PDF renders within app; View PDF never silently downloads.
15. Download PDF triggers an explicit authorized download.
16. Protected file permissions, unauthorized/cross-tenant access, revoked access and error UI.
17. Viewer cleanup/revocation, loading, page navigation and mobile controls.

### Payment/delivery
18. Append evidence, verify separately, prevent unauthorized 'mark paid'.
19. Email vs resend states, duplicate sending protection, delivery logs.
20. Activity history timestamps, event names, and real actor display if available.

### Regression/build
21. Existing billing list filters/pagination and invoice navigation.
22. Existing invoice APIs and PDF endpoint compatibility.
23. Keyboard/accessibility and responsive visual tests at 390/768/1024/1440 widths.
24. Run Rails tests, frontend typecheck, ESLint, unit/integration/E2E, production builds; report exact command, results and failures.
25. Capture authenticated before/after screenshots, plus inline PDF preview, where test fixture is available; otherwise mark BLOCKED with setup instructions.

## Implementation batches / checkpoints

**Batch 0 — Discovery / schema / policy:** Document current routes, APIs, roles, issuer/recipient ownership, selected subscription flow, observed PDF anomalies and regression baseline. Resolve or record Rails Zeitwerk blocker.

**Batch 1 — Layout/routing:** Replace new-invoice modal with dedicated accessible full-page wizard. Preserve existing routes and list/detail pages.

**Batch 2 — Subscription selection and recipient:** Server-backed searchable selection, clear context, due-date and billing recipient forms.

**Batch 3 — Charges, tax and final review:** Server-authoritative quote, compact add-ons, sticky total, validation, safe Issue action.

**Batch 4 — Invoice details and PDF inline:** Rebuild summary/detail page; authenticated embedded PDF, separate Download, payment/delivery sections.

**Batch 5 — Issuer identity and PDF correctness:** Diagnose legal issuer/address/contact/GST fields; implement source-of-truth fixes with approved backend changes and regression tests.

**Batch 6 — Testing, visuals and documentation:** Run end-to-end workflows, accessible/responsive checks, OpenAPI/ADR/UI checklist updates, screenshot diffs.

After EACH batch, report:
- Source files changed and architecture/API decisions.
- Real features working against backend vs UI-only.
- Tests executed with PASS/FAIL/BLOCKED/NOT RUN.
- Security, billing/legal identity and data-integrity risks.
- Next dependencies; do not claim completion if the Rails test/runtime blocker persists.

## Core acceptance outcome

A Platform Admin should be able to:
1. Find and select a subscription by recognizable provider/Business name.
2. Review a clearly identified legal seller and bill-to party.
3. Confirm billing period, charges, tax and final total without scrolling across unrelated panels.
4. Issue once, with backend validation and immutable invoice snapshot.
5. Open an issued invoice and **view its PDF inline**, then optionally download/print.
6. Track payment evidence, verification and email delivery without mixing statuses.

Preserve TRISE multi-tenant security, commercial snapshots, published tax rules, authorized administration and immutable audit history throughout.
