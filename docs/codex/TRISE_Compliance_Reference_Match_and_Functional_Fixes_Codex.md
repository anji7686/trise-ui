# TRISE INDIA — Compliance Reference-Match and Functional Repair

**Codex implementation instruction — 15 October 2026**  
**UI:** `~/wrk/lre/trise-ui`  
**API:** `~/wrk/lre/trise-api` (inspect and edit only as authorized/necessary)  
**Architecture:** `~/wrk/lre/trise-architecture` (read ADRs/contracts and update impacted decisions)

## Mission and acceptance contract

**Implement the actual screens and repair the broken flows. This is not a planning-only, CSS-only, mock-data or screenshot-generation task.** Reconcile the existing implementation with the two-page `TRISE_Simplified_Compliance_Designs.pdf`, plus the user's later decisions that override details of that mockup. Reuse TRISE navigation, logo, type system and design tokens. Preserve existing routes, entity ownership, permissions, evidence gates, immutable compliance versions, audit history and API contracts unless an approved change is required.

### Authoritative precedence (important: do not blindly copy the PDF)
1. **Current explicit functional requirements in this instruction** take precedence: e.g., popup-based Legal Identity, separate Documents tab, and **no automatically expanded approval forms on initial page load**.
2. The **two-page PDF is the visual reference**: page 1 for Business Verification, page 2 for Platform Approval Inbox. Use its hierarchy, spacing, cards, typography, color contrast, search/filter bar, split-pane review pattern and actionable empty states.
3. Existing architecture, server-authoritative statuses, security constraints and API contracts govern behavior. The PDF's sample data is illustrative, **not source data**.

### Required reference files
- `docs/design/reference/TRISE_Simplified_Compliance_Designs.pdf` — page 1 Business Verification; page 2 Approval Inbox.
- `docs/design/reference/business_verification_reference.png` — rendering of PDF page 1.
- `docs/design/reference/approval_inbox_reference.png` — rendering of PDF page 2.
- `docs/design/current/platform_review_before.png` and `docs/design/current/platform_review_expanded_before.png` — present behavior.
- `docs/design/current/business_document_upload_before.png` — current upload modal (if copied from package).

If paths differ, discover the actual imported files; do not silently skip visual comparison. If the reference is missing, report it as a blocker to claiming visual parity; functional implementation can continue.

---

## A. Observed problems to verify and resolve

| ID | Current screenshot / report | Expected correction and verification |
|---|---|---|
| UI-01 | Platform Compliance Review opens with 4 extremely tall Licence Authorization cards, text truncated and reviewer controls embedded in the first card | Replace default page with **Approval Inbox** resembling reference PDF p.2: compact metrics, filters, searchable request list, selected-request details. Move Licence Authorizations into a separate **Licences / Authorization requests** filter or tab with a compact table. No forms in list cards. |
| UI-02 | Request details, raw JSON, immutable versions and audit lines extend the page to very large height | Detail pane with **Changes / Evidence / Activity / Details** subtabs. Structured changed-field diff. Versions/audit tables or timelines with pagination (default 10), not 10+ paragraphs inline. |
| UI-03 | UUIDs are used as prominent subject/provider labels | Show human-readable business/provider name, licence title, requirement display name and meaningful business reference. Keep UUID internally and optionally copyable under advanced details. Never use a truncated UUID as the primary title. |
| UI-04 | Business document uploader repeats headings and hardcodes 'Business verification' classification | Single clear title; required **Document classification** dropdown sourced from permitted classifications, includes safe **Other** option where allowed; context-linked GST/registration/logo uploads; states and progress. |
| UI-05 | Drag/drop region appears interactive but user reports it does not work | Make **Browse files** button + hidden native file input the reliable primary path; fix accessible dropzone only if supported and tested. Selecting, clearing and reselecting same file must work. |
| UI-06 | Upload state unclear; after upload user remains in form and doesn't see record | Progress → API result → scanning/finalization state → success feedback → return to Documents/list/context, preserve filters and highlight new row. Do not label uploaded as verified. |
| UI-07 | Preview disabled for platform admin | Trace actual preview eligibility and auth policy; allow authorized platform reviewer/admin to preview business/provider documents through scoped, audited, secure preview API **when allowed by scan/security policy**. Show exact reason if not viewable; no blanket bypass. |
| UI-08 | Business logo missing under Registrations & Brands and from Business/Provider lists | Create **Business logo** management action with crop/zoom preview, versioning/scan/activation; render cropped thumbnail before business name in list/detail. Provider list/detail should use provider's own logo, or verified business fallback only where relationship/branding policy allows. |
| UI-09 | Licence authorization record details missing; API displays 'An internal error occurred' | Reproduce, trace precise request/response and sanitized server logs, fix underlying Rails/controller/service/serializer/DB issue; test create/read/detail and review lifecycle. Do not mask a 500 by swallowing it or rendering mock records. |
| UI-10 | Default compliance page keeps opening provider licence approval content | **Default to Approval Inbox queue**. Detail is blank/selection prompt until user selects a request, unless there is an explicit deep link. Do not auto-select first licence/request on a fresh visit. |
| UI-11 | Business Verification page does not look like reference | Apply PDF page-1 branded visual structure: clear business heading, incomplete/status alert, compact cards, coherent body, controlled form dialogs; do not stack all forms. |
| UI-12 | Action placement and permissions ambiguous | Separate `request/submission`, `reviewer assignment`, `approval decision` into authorized workflows. Show current step and next action. Business user does not gain platform approval rights. |

**Important:** These are observations and user-reported failures; API root causes, actual document access rules and exact endpoints must be established from the live code and dev/test data. Do not report unexecuted tests as passed.

---

## B. Target page layout and navigation

### B1. Platform Administration → Compliance Review = **Approval Inbox** (PDF page 2)

On a fresh direct navigation:

1. Title: `Approval Inbox` with single subtitle and `View audit history` link.
2. One compact summary row (server-backed): Submitted requests, Awaiting assignment, Current queue scope. Don't compute totals from a partial page.
3. One aligned filter bar: search by **name / display reference / title**, status, request type, date range, Refresh. Server-side filtering and pagination; preserve filter values in URL or route state.
4. Desktop master-detail layout: **~30–36% request list / remainder detail panel**, responsive to stacked layout for tablet/mobile.
5. **Initial state: no request auto-opened**. Show `Select a request to review changes, evidence and history.` In a deep link (`?request=...` or existing route), select only the authorized, existing request.
6. Request row: meaningful request title, business/provider name, subject/category, submitted date, status and assigned reviewer. No raw UUID string as primary label.
7. Selected detail: header + **Changes, Evidence, Activity, Details** tabs; changed-field comparison for approved vs proposed, highlight what changed; secure evidence preview; status; reviewer assignment and decision sequentially as allowed by server. Only include permitted decisions.
8. Reviewer assignment form must not share a narrow card with a decision form. Use explicit step labels, required reasons, revision/idempotency safeguards, 409 conflict reload, error messages and duplicate-click prevention.
9. Do **not** render full immutable version history/audit log by default below the request. Show a short recent timeline and `View all` to server-paginated 10 rows, newest first; no guessed pagination totals for keyset APIs.
10. `Licence Authorizations` should not be the landing page. Provide a distinct `Licence authorizations` filter/tab/table or subordinate route, accessible through `Request type=Licence` if supported. Separate approved source licence information from pending provider authorization requests.

**Do not** put giant four-column licence approval cards, UUID-heavy text or default-open forms above the request queue.

### B2. Business → Business Verification (PDF page 1)

Keep the reference's branded white cards, navy navigation and primary headline, but apply the later user-approved tab/modal direction:

- Header with **business logo thumbnail, registered business name, business-active status and verification state separately**.
- Compact attention banner with clear actionable reason supplied by server.
- At-a-glance overview cards: Legal Identity, GST, Registrations & Brands, Licence/Provider Authorizations. No repeated large forms in the default view.
- Seven top navigation areas or matching app route conventions: **Overview, GST, Registrations & Brands, Licence Authorizations, Documents, Requests & Reviews, History & Audit**. Use overflow navigation on small screens.
- Legal Identity action opens a bounded modal with structured fields, required reasons and eligibility-safe evidence picker, not a permanent page-long form.
- GST action opens modal with GST-specific proof selection/upload and association to canonical tax records only.
- Registrations & Brands has list/table, **Business logo** card/action, registration requests with relevant documents and guided detail modal.
- Documents table, upload modal, inline preview modal and clear scan/lifecycle states.
- Licence Authorizations has a table/list, `View details`, `Request association` or `New authorization` only if the actual API/role permits.
- Requests & Reviews list with context-specific status and timeline. History & Audit subtabs use independent recent-10 pagination.
- On opening the Overview, there must be no auto-opened form; show useful summary and next action instead.

### B3. Human-readable labels across the platform

Render display names + disambiguators in Business lists, Service Provider lists/details, selectors, review subjects, documents, licence records, audit messages and notifications. If names clash, add organization/location/business reference. Do not fabricate missing names; use an explicit neutral fallback plus an actionable data-quality alert and log the serializer/API gap. UUID stays in route/API/DB; technical details may expose a copyable ID to authorized staff only.

---

## C. Business logo upload, crop, management and thumbnails

**Ownership:** The Business logo is a Business/Branding asset, manageable from **Registrations & Brands** and viewable from Business Overview; do not conflate it with a registration certificate, a trademark, or proof of legal identity. Provider branding remains a separate provider asset unless an explicit governed fallback is approved.

1. Add `Manage business logo` action in Registrations & Brands; show current logo thumbnail and state (`No logo`, `Pending scan`, `Ready`, etc. **only if supported by API**).
2. Modal: choose **PNG/JPEG/WebP** from a true native file input; validate bytes/MIME/size via API policy (do not trust extension). Avoid enabling SVG without sanitization and a specific policy.
3. Client shows adjustable square crop preview with zoom and keyboard-operable controls; minimum viable crop should preserve focus, aspect, and mobile usability. Do not upload the original as publicly served content without the approved upload/security pipeline.
4. Store immutable original/private source and derived crop variant(s) through existing document/image APIs if supported, including approval/scan/finalize gates; if these APIs are absent, implement an appropriately reviewed API extension, not a frontend-only `localStorage` logo.
5. Suggested variants: `40x40` list thumbnails, `96x96` detail avatar and high-res version for retina. Use optimized thumbnail/signed media delivery rather than transferring full original for each list row.
6. Avoid EXIF orientation bugs and strip unsafe metadata where applicable. Allow replacement; preserve history, respect caching/ETag/invalidation and rollback rules.
7. Logo does **not** become globally visible in lists until cleared by applicable upload/scan/activation policy. Before then display existing approved logo or deterministic initials placeholder.
8. Update Business list: `[thumbnail] Registered business name` and business detail header. Update Provider list/detail: `[provider logo OR policy-authorized business logo fallback OR initials] Provider display name`.
9. Multi-business/provider ownership cannot leak another tenant's logo. Crop + preview + save + refresh + replacement + list display must be covered in integration and browser tests.

---

## D. Unified upload experience and document classification

### D1. Reusable `DocumentUploadDialog`
- Title contextualized by origin (`Upload business document`, `Attach GST certificate`, `Attach registration evidence`, `Upload logo`). No duplicate inner header.
- **Document classification required dropdown** loaded from existing allowed catalog: business verification, GST, licence, registration, brand/trademark, general supporting evidence, image, etc. **Only show the categories actually supported.**
- Include `Other` where policy supports a custom classification; choosing Other reveals required `Specify document type` and optional purpose/description. Backend must validate and persist the controlled Other metadata; don't use Other to evade mandatory classification, size or evidence rules. Distinguish **document format** (PDF/image/Word/Excel) from **business classification** (GST certificate/licence/logo/Other).
- Origin context preselects relevant category (GST flow defaults GST; logo flow defaults logo). User may choose another category only if server policy permits; warn when a chosen category is ineligible for that requirement.
- Native file input remains visible through a `Browse files` action; drag/drop is optional and must actually work with dragenter/dragover/drop, prevent browser navigation, handle drop/file API, keyboard and touch. Remove the dashed interactive claim if unsupported.
- Show filename, file type, readable size, Replace/Remove action, validation and upload progress.
- Detect duplicate upload attempts; handle zero bytes, unsupported format, over limit, permission errors and aborted/retried uploads safely.
- On API success: show `Uploaded — scanning pending` or actual returned status; do **not** claim `Verified`, `Clean`, `Active` or `approved evidence` before authoritative result.
- If scan asynchronous: immediately show new row with badge and background refresh/polling according to existing mechanisms; don't claim it is eligible evidence yet.
- After successful upload, close dialog and return to origin list/context (Documents, GST, Registration), retain filters/page and highlight newest row. If job starts but the network result is uncertain, reconcile using idempotency/reference rather than sending duplicate uploads.

### D2. Document list and preview
- Columns: meaningful filename, category/classification, owner/linked entity, file type/size, uploaded/updated, lifecycle, scan/readiness, actions. Server-side search/filter/pagination where supported.
- **Authorized platform admin and reviewer must be able to preview eligible business/provider documents** without opening an external tab, through backend-scoped authentication/authorization and audit. Implement the permission correctly; do not force a provider-account selection for platform-wide users. Ensure role and subject scope are evaluated server-side.
- Distinguish user-visible `Preview unavailable because document is not scanned/cleared`, `Preview not generated`, `Unauthorized`, `File missing`, `Unsupported format`, and `Temporary error`. Never silently enable a dangerous preview solely to meet UI request.
- Inline modal viewer: PDF with sandboxed authenticated embedded viewer, images using approved signed/proxied response, Word/Excel via **server-generated sanitized preview rendition** where supported; if absent offer secure download and record backend conversion gap, not a broken iframe to Office/third-party services.
- No exposed raw S3 keys, external permanently public URLs, third-party document viewers receiving private content, unsafe HTML, or broad admin bypass. Enforce MIME/content validation and CSP, avoid active content execution.
- Controlled download separately if user has access. Preview itself can be disabled while document cannot clear scan checks; display cause and remediation.
- Docs selected as evidence must satisfy classification, finalized version, malware scan and required authorization checks. Preserve ClamAV and all activation gates.

---

## E. Licence Authorization details and API 500 error — diagnose and fix

**User-reported issue:** clicking or loading licence authorization new-record details yields generic `An internal error occurred`, with missing detail fields. Current screenshots alone do not prove the root cause.

### E1. Reproduce and record evidence, safely
1. Find the exact UI action (`New authorization`, `View`, etc.) and route. Capture **method, path, status code, request correlation ID, sanitized request shape, sanitized response and role/context** from development/test environment. Do not store auth tokens or personal credentials in logs.
2. Search actual Rails route/controller/service/serializer/policy and frontend API client/handler for this action. Trace a single request through API logs and, if relevant, DB reads and validation failures.
3. Determine whether it is: missing required selection/source licence, wrong provider/business scope, malformed payload, nil relationship, schema/serializer mismatch, enum validation, migration gap, optimistic lock, permission denial incorrectly mapped to 500, or genuine server exception. **Do not guess which.**
4. Reproduce with a fixture/source business licence and provider association in development/test. Compare state at form-open vs submit to identify where failure occurs.
5. Fix underlying API behavior with an appropriate meaningful status (`400` schema, `401/403` auth, `404` missing/scoped record, `409` conflict, `422` validation where appropriate, `500` actual server fault). Return bounded structured error code, user-facing message and request ID, no stack traces.
6. Handle errors in React with field-specific feedback and retry/reload. Disable impossible actions with a clear reason and link to prerequisite business licence or verification if relevant.
7. Add Rails request/service tests and React integration test for broken case + happy path, then inspect actual logs to confirm no unhandled exception.

### E2. New record / detail workflow
- `Licence Authorizations` list table: meaningful provider, business, source licence title/code, activities, scope/territories, effective validity, status, reviewer (if visible), and actions. Date fields only when supported.
- `View details` opens a bounded read-only drawer/dialog: Overview, Source licence, Scope, Evidence, Timeline. Render missing data explicitly, not empty unlabelled cards.
- `New authorization` or `Request association` opens a guided modal **only if backend and role support initiation**. Select approved source Business licence and related authorized provider, confirm activities/territory **not broader than source**, reason, evidence, review, submit.
- Requests need platform assignment/review through Platform Approval Inbox (not permanent approval buttons in each card). Do not let business/provider members approve merely because they can view the record.
- Revalidation records need exact source-version linkage and clear reason/timeline; do not silently create approvals.
- Preserve revision, idempotency and immutable authoritative versions. Approved data must not change from a draft submission.

---

## F. Explicit UX issues to remove (regression guard)

- No giant 4-column licence cards on Platform Approval Inbox initial view.
- No automatically expanded review request/decision form on first visit.
- No default JSON diff or full raw JSON editing for routine users.
- No page-long multi-section stacks for Business Verification.
- No repeated document upload heading or a drag/drop control that fails.
- No UUIDs as names in list rows, header cards, timeline or action labels.
- No misleading `Available` implying `Safe to preview/use as evidence`.
- No `Review` button that requires different context without explaining it.
- No empty `An internal error occurred` without event/correlation and actionable state.
- No simulated counts, demo data or fabricated domain states in production paths.

---

## G. Implementation sequence — small reviewable batches

**Batch 0: Baseline and reproducible diagnostics**
- Read architecture ADRs, repo instructions and OpenAPI; map existing routes/actions and roles. Inventory current API/permissions and evidence state. Reproduce licence API error. Gather current viewport screenshots and reference screenshots at matching viewports. Record baseline tests and backend gaps.

**Batch 1: Fix Platform Approval Inbox structure (highest visual priority)**
- Replace default licence-card view with the PDF p.2 layout. Preserve separate permission-bound licence request access. Add empty initial detail, select/deep-link behaviors, structured comparison, filters, actions. Test role boundaries and screenshots.

**Batch 2: Business Verification reference fidelity**
- PDF p.1 consistent header/status/cards; tabs and Legal Identity modal per latest requirements. Remove redundant vertical sections, refine spacing, alignment, labels and typography. Preserve all legacy actions via new navigation.

**Batch 3: Upload form/classification/file selection/status/navigation**
- Implement consistent context classification dropdown + safe Other + Browse + tested dropzone (or remove), progress/scan status, return-to-list and item highlighting. GST and registration context-aware attachments.

**Batch 4: Business logo and provider/business thumbnails**
- Cropping UI, secure versioned storage/activation, variants and fallback rule, Business and Provider list/detail placement, cache behavior and tests.

**Batch 5: Document preview authorization and inline viewers**
- Trace disabled preview for authorized platform users; fix scoped backend policy if incorrect; implement secure in-modal PDF/image and rendition-based Office preview where supported, otherwise authorized download with explicit explanation. Preserve scan gates.

**Batch 6: Licence record details and API exception fix**
- Reproduce/root-cause/fix `An internal error occurred`; deliver new/detail workflow only when domain supports it; add Rails/React regression tests and error response contracts.

**Batch 7: Requests, histories, audit, responsive/accessibility**
- Ten-row recent history, independently paged table/timeline, filters and audit. No default enormous history. Mobile and keyboard support, sticky non-blocking navigation and modal behavior.

**Batch 8: Integration & visual comparison**
- E2E role journeys + current/reference screenshot comparisons and build validations. Present side-by-side screenshots for both PDF reference screens and explain deliberate deviations caused by later user requirements.

If backend changes require a new ADR or migration, create a scoped plan, document risks and obtain required approval before applying destructive or production changes. Do not use dangerous migration shortcuts or touch live production data.

---

## H. Required tests and executable evidence

### H1. UX / visual acceptance

| ID | Scenario | Required evidence |
|---|---|---|
| VIS-01 | Platform inbox 1440px: PDF p.2 hierarchy of title → metrics → filters → split queue/details | before/after full-page screenshot with visually checked differences |
| VIS-02 | Fresh inbox initial view has **no selected request and no inline licence approval cards** | browser test + screenshot |
| VIS-03 | Selecting one request opens only its detail; deep link opens correct authorized request | E2E test |
| VIS-04 | Business Verification 1440px: PDF p.1 typography, branding, compact summary/status | before/after screenshot |
| VIS-05 | Business tab navigation does not create long, simultaneous forms | screenshot and keyboard test |
| VIS-06 | 1024px / 768px / 390px screens: no overlap, horizontal clipping, inaccessible buttons | responsive screenshots/tests |
| VIS-07 | Long names and duplicate names render meaningful identity and context, not UUIDs | component tests |

### H2. Upload, logo, document and security acceptance

| ID | Scenario | Required evidence |
|---|---|---|
| DOC-01 | Browse button opens native picker; select, clear and select same file | browser test |
| DOC-02 | Drag/drop either works properly or is not advertised | browser test |
| DOC-03 | Classification list is server-allowed; `Other` requires description and is persisted safely | API + UI tests |
| DOC-04 | GST upload links to GST request, registration evidence links to its record, not unrelated business logo | integration test |
| DOC-05 | Upload shows progress, server outcome, scan pending, then returns to table and highlights document | browser test |
| DOC-06 | Malware/unscanned/rejected files never become usable approved evidence or public logos | Rails policy/negative tests |
| DOC-07 | Business logo crop/preview/save/replace with scanned approved variant | browser + API test |
| DOC-08 | Business list thumbnail before name; detail header logo; Provider own/fallback logo respects business scope | E2E + authorization tests |
| DOC-09 | Authorized Platform reviewer can preview eligible PDF/image inline without unsafe public URL | Rails authorization + browser test |
| DOC-10 | Unauthorized platform/user/other tenant can't preview document; blocked scan has precise reason | negative API tests |
| DOC-11 | Word/Excel uses safe rendition or offers authorized download with accurate explanation | format tests |
| DOC-12 | Document preview/dowload is scoped, token-safe, logged and does not leak object keys | security tests |

### H3. Licences, review, history, backend acceptance

| ID | Scenario | Required evidence |
|---|---|---|
| API-01 | Previously failing licence new/details action no longer returns unexpected 500; root cause documented | failing-before/passing-after Rails request test + sanitized log/correlation |
| API-02 | Missing source licence / invalid scope / unauthorized provider returns appropriate structured error | request/policy tests |
| API-03 | Valid licence detail resolves readable labels, status, source/scope and timeline | API + UI test |
| API-04 | New authorization respects source licence activities/territories and required evidence | backend contract/validation test |
| API-05 | Submitted licence request cannot self-approve if the role forbids it; reviewer role authorized | policy + E2E |
| API-06 | Review assignment and decisions preserve immutable versions, revision and idempotency | integration tests |
| API-07 | Versions and audit history newest-first, 10 at a time, correct cursor/pagination semantics | API/UI tests |
| API-08 | Business and platform queue scopes remain distinct; no cross-tenant record leakage | policy test |
| API-09 | Network/validation errors present useful user messages + request reference, not silent generic failure | browser test |

### H4. Mandatory final validation

- Run repository-appropriate `typecheck`, lint, unit/component tests, integration/Playwright/browser tests (if available), Rails request/service/policy tests for changed APIs, production UI builds, and `git diff --check`.
- Provide **PASS / FAIL / BLOCKED / NOT RUN** per scenario, with exact command, timestamp, role/test fixture and relevant screenshot or test output. Do **not** claim success for unexecuted tests.
- Report all changed files, new/modified endpoints, migrations, ADRs, tests and active known gaps.
- Include `before vs after` screenshots for Business Verification and Approval Inbox at **same viewport** as reference. Visual deviations from reference must be itemized and justified.
- Deliver an explicit `functional coverage map`: every control and route in old UI → new route/tab/modal/action and test evidence. No lost capabilities.

---

## I. User-facing copy and example interactions

**Initial Platform Approval Inbox:**
> Approval Inbox — Find and review changes submitted by businesses and service providers. Select a request to see its details.

**Initial selected Business overview:**
> Business Verification — Review current approved details, manage documents and submit changes for platform review.

**Business logo:** `Registrations & Brands → Business logo → Upload and crop → Save → Scanning/verification → Available in Business list once cleared.`

**Document upload:** `Documents → Upload document → Classification (Other + description if allowed) → Browse → Upload → Status → Documents list.`

**No licence available:**
> No approved business-owned licence is available for this provider. Ask an authorized business administrator to submit or confirm the source licence before requesting a provider authorization.

**Preview blocked:**
> Preview isn't available yet because this document has not passed the required scan. You can check its status in Documents.

**Authorization issue:**
> You don't have permission to preview this document. Contact an authorized administrator.

**Server error:**
> We couldn't load the licence authorization. Please retry or share reference [safe request ID] with support.

**Not a security bypass:** No example copy above changes authoritative policy. Use real server states and relevant permitted actions.

---

## J. Instructions for Codex execution

**Do the work, not only a plan.** Proceed batch by batch. Before editing, confirm which repository roots exist, how to start test fixtures, and which uploaded references are present. If you cannot reproduce the reported 500 or lack permission to change backend, accurately state the blocker and provide exact failing endpoint/log context for the backend team. Never claim a fix merely because the error text was hidden.

For each completed batch, respond with: what changed, file paths, API dependencies, screenshot links/locations, exact tests run and results, unresolved issues and next batch. Maintain code reviewable changes, do not rewrite unrelated modules, and preserve security-critical controls.
