# TRISE UI design system instructions for AI implementation

This is the canonical UI implementation guide for TRISE Operations,
Platform Administration, Provider workspaces, and shared UI primitives. Apply
these rules to every new screen, redesign, modal, form, table, and detail view.
The API, authorization model, current reference screens, and approved design
tokens remain authoritative over this document when they conflict.

## 1. Source of truth and reuse

Before changing a screen:

1. Inspect the closest UBold/reference screen and the existing TRISE screen.
2. Identify the existing shell, primitive, token, layout, and interaction
   pattern to reuse.
3. Confirm the API resource, allowed actions, role scope, loading state, empty
   state, denied state, validation errors, conflict responses, and audit event.
4. Keep a single source of truth for a record. Do not duplicate the same
   requirement, survey, timeline, notification, or activity in multiple panels.

Use these implementation sources first:

- Theme tokens: `packages/design-tokens/src/theme.css`.
- Shared buttons and primitives: `packages/ui-primitives/src/primitives.css`
  and `packages/ui-primitives/src/index.tsx`.
- Operations shell and cross-screen patterns:
  `apps/operations/src/styles.css`, `operations-pages.css`, and
  `operations-design.css`.
- Existing reference catalogue: `../trise-architecture/docs/ubold-reference-index.md`
  and `docs/design/`.

Do not add a one-off visual system to a feature stylesheet when a shared
primitive, token, or pattern already exists.

## 2. Logo and brand usage

- Use the approved TRISE India logo asset through the existing
  `TriseBrandHeader`, `Wordmark`, or approved brand component.
- Preserve the source aspect ratio and clear space. Never stretch, rotate,
  recolor, crop, or recreate the logo with text/CSS.
- Use the light logo treatment on dark brand surfaces and the dark/readable
  treatment on light surfaces. The logo must remain readable in both themes.
- Keep the logo in the shell/header location. Do not repeat it inside every
  card, modal, form, or table.
- Provide meaningful alternative text for the logo image and keep decorative
  logo marks `aria-hidden` where the adjacent accessible name is present.
- Do not commit a new logo asset without checking the approved asset catalogue.

## 3. Typography, tokens, and color

- Use the token font stack: `Inter, ui-sans-serif, system-ui, sans-serif`.
- Use `--text` for primary content, `--secondary` for supporting content,
  `--border` for boundaries, `--surface` for cards/dialogs, `--elevated` for
  controls and raised surfaces, `--background` for the page, and `--primary`
  for the main action.
- Never hard-code a light-only white/black/blue value in a shared component.
  If a special brand color is required, map it to a named token and provide a
  dark-theme value.
- Status and priority colors must communicate meaning consistently:
  success/active = green, warning/pending = amber, blocked/error = red,
  informational/in-review = blue, neutral/closed = slate. Always include
  readable text or an icon; color alone must not carry meaning.
- Use the shared status classes and their paired backgrounds: `status-success`
  uses a readable green foreground on a pale green background,
  `status-warning` uses amber on pale amber, `status-danger` uses red on pale
  red, `status-info` uses blue on pale blue, and `status-neutral` uses slate
  on pale slate. Dark theme values must use the corresponding dark tinted
  background and light readable foreground. Keep the same mapping for every
  list, detail, dashboard, timeline, dialog, and table.
- Status pills must not be used as large buttons or section headings. Keep them
  compact, allow long labels to wrap safely, and preserve a visible border or
  contrast boundary in both themes.
- Keep visual hierarchy compact: page title, short description, action group,
  summary, filters, content, pagination. Avoid decorative whitespace that
  separates an action from the record it controls.
- Use the same label, value, helper text, and error font sizes across a
  feature. Do not use UUIDs as prominent UI labels; show the human reference
  and expose technical IDs only as secondary copy or an explicit technical
  detail.

## 4. Buttons and actions

Use the shared `Button` primitive and one of these variants:

| Use case | Variant | Treatment |
| --- | --- | --- |
| Create, save, submit, continue, confirm | `primary` | Filled primary color |
| Cancel, back, search, preview, secondary navigation | `secondary` | Neutral surface with border |
| Delete, revoke, reject, disable, irreversible action | `danger` | Semantic red with confirmation where needed |
| Previous/next, low-emphasis utility, inline link action | `quiet` | Transparent, text-first |

Rules:

- Standard action buttons are compact and consistent: approximately 36px
  height, 12px horizontal padding, 12px text, and 6px radius. Quiet actions
  may use approximately 32px height.
- Do not make action buttons full width. Never add `width: 100%` to `.button`
  or stretch a button through a grid/flex action row. Let action groups wrap
  naturally on narrow screens. Full-width controls are limited to navigation,
  segmented controls, record cards, and non-action inputs.
- Keep actions in a named action row with `display:flex`, `gap`,
  `flex-wrap:wrap`, and `align-items:center`. Align primary actions at the end
  of the row unless the reference pattern requires a different hierarchy.
- A row with one meaningful action may show that action directly. A row with
  multiple actions uses the standard three-dot action menu plus `View`.
- Do not use a primary color for every action. Make the destructive or
  irreversible action visually distinct and place it away from the primary
  action.
- Buttons must expose disabled, busy, hover, focus, and keyboard states. Do
  not hide an unauthorized action only as a security measure; the API remains
  authoritative.

## 5. Forms

- Use a page form for simple workflows, a drawer for focused edits, and a
  wizard/stepper only for genuinely sequential multi-stage work.
- Desktop forms use aligned two-column fields where appropriate:
  `minmax(0,1fr)` columns with consistent gaps. Collapse to one column on
  mobile. Avoid a single short input occupying an unnecessarily wide row.
- Every input has a visible label. Helper text sits below the control and
  errors sit next to the affected field. Do not rely on placeholder text as a
  label.
- Use authorized select/searchable-select/reference data for enums, countries,
  states, cities, providers, users, equipment types, standards, and statuses.
  Avoid free-text entry when the platform has a controlled catalogue.
- Show required state, server validation, 409 revision conflict, loading, save
  success, and retry state without losing entered values.
- Keep form actions compact and aligned at the bottom/right. Do not create a
  second action bar for the same submit/cancel operation.
- In read-only or concluded workflows, render a read view; do not leave a
  disabled edit form visible unless the user explicitly needs a draft preview.

## 6. Read-only detail views

- Use a modern details layout with bordered rows or cards. Labels align in one
  column and values align in the next; long values wrap without breaking the
  page.
- Hide empty optional fields instead of showing repeated “not available” rows.
  Keep meaningful empty states when the user needs to take action.
- Show only the final/latest active snapshot in the main view. Keep previous
  revisions in the journey/timeline/audit view.
- Show lifecycle, ownership, status, source, timestamps, and the next allowed
  action near the record header.
- Concluded records are read-only. Hide or disable update, upload, follow-up,
  and transition actions consistently across the page and API response.

## 7. Tabs, steppers, and accordions

- Tabs are for peer sections; only the active panel is visible. Do not render
  all tab contents in one long page.
- Tabs use one shared visual pattern: a bounded tab row, consistent height and
  padding, visible active indicator, readable inactive text, and a focus ring.
  Do not mix filled tabs, underlined tabs, and unstyled text tabs in the same
  screen unless they represent different navigation levels.
- Use a stepper only when moving through a defined workflow. Show completed,
  current, blocked, and unavailable steps clearly. A user may open a completed
  step when the role allows it; a blocked step explains why.
- Tabs and steppers must be horizontally scrollable or wrap at narrow widths;
  text must not overlap or become clipped.
- Tab labels and controls must have `min-width: 0` on the parent, safe text
  wrapping or horizontal scrolling on the tab row, and no absolute-positioned
  content that can cover a neighboring tab. Active panels must have a clear
  top/side boundary and enough spacing from the tab row.
- Use accordions for repeated snapshots, milestones, and technical sections.
  Open the latest/final snapshot by default, keep earlier revisions collapsed,
  and preserve the open state when data refreshes.
- Do not duplicate the same section title, summary, or action in both the tab
  header and the tab body.

## 8. Tables, filters, and pagination

- Use a full-page table/list template for index screens. Avoid half-width tables
  beside an oversized empty detail area unless the reference explicitly calls
  for master-detail.
- Use readable human columns: name/reference, owner/initiator, source, status,
  priority, updated date, and actions. Keep technical IDs secondary.
- Headers are short, aligned, and stable. Cells wrap safely; do not rely on a
  horizontal scrollbar for ordinary desktop content.
- Standardize pagination to 15 rows per page unless the API/reference requires
  another limit. Always show result count and disabled previous/next states.
- Filters use a compact toolbar with visible labels, consistent field heights,
  aligned controls, clear result count, and a responsive one-column mobile
  layout. Search and select controls must not overlap.
- Use `Status`/`Priority` components for lifecycle and priority values. Do not
  encode status using arbitrary text colors in each feature.
- The actions column is compact. One action can be a visible button; multiple
  actions use the three-dot menu with `View` as the safe default.

## 8.1 Sections and overlap prevention

- Every section has a clear boundary, heading, description, content region, and
  action region. Use consistent gaps; do not place a heading, filter, tab, or
  action on top of another element to save space.
- Section headings are flexible and wrap at narrow widths. Text containers,
  grid/flex children, tables, cards, and dialogs use `min-width: 0` where they
  participate in a constrained layout. Long names, references, email
  addresses, and technical values use safe wrapping.
- Keep section action groups beside the heading on wide screens and below the
  heading when space is constrained. Do not let an action group push the title
  outside the viewport.
- Use one outer spacing system. Do not add competing negative margins or
  nested padding that causes filters, tables, cards, or modal footers to
  overlap.
- When a content area scrolls, only the content area should scroll. Keep the
  dialog header and action footer visible, and ensure sticky elements have a
  surface background and a stacking order that does not cover form fields.
- Check overlap at long translations, long status labels, 200% browser zoom,
  narrow mobile width, and dark theme before accepting the screen.

## 9. Dialogs, drawers, notices, and previews

- Use `OperationsDialog` or the existing shared dialog pattern. Do not use
  browser `alert()` for confirmations, success, errors, maintenance, or
  notices.
- Dialogs have a clear title, close action, scrollable content, and a compact
  footer/action row. Keep footer actions visible or sticky when content scrolls.
- Dialog width is content-appropriate and capped by the viewport. On mobile,
  use the available width with safe padding; never allow content or buttons to
  overflow.
- Use one modal for one task. Do not open a second modal for the same timeline,
  record details, or follow-up history. Use tabs/accordions inside the modal
  when the content is related.
- Photo, PDF, DOC, and XLS evidence opens in the approved preview/gallery
  dialog. Do not open private evidence in a new tab automatically.
- Notices use a consistent semantic bar: success, warning, error, or
  informational. Keep the message actionable and do not repeat it in several
  locations.
- Server-confirmed mutation results use the shared `ActionNotification`
  pattern: a colored semantic bar, accessible live-region role, concise title,
  result detail, and dismiss action. Use it for success and operation-level
  errors across provider, commercial, project, workforce, configuration, and
  platform screens. Keep field validation beside the affected field and do not
  render the same result again as a separate inline success/error paragraph.
- Commercial quotation editors may use a compact checkbox grid for optional
  terms, a controlled selector for platform-master/provider templates, and an
  inline preview before applying a template. Item-specific warranty belongs on
  the material line and must not be hidden inside the quotation-level warranty
  text. Disabled terms are omitted from the submitted draft payload. Provider
  terms template create/update/archive belongs on the dedicated Provider
  Administration screen for Service Provider Admin and Provider Reviewer roles;
  quotation entry is selection/apply only.

## 10. Responsive and theme acceptance

Every screen and popup must be checked at desktop and narrow/mobile widths:

- No clipped headings, overlapping inputs, hidden actions, or horizontal page
  overflow.
- Action groups wrap without changing the semantic order. Buttons remain
  compact and touchable without becoming full width.
- Tables transition to the approved responsive card layout or remain readable
  within the content width.
- Detail rows collapse cleanly while preserving label/value association.
- Tabs, steppers, and accordions remain selectable and do not expose inactive
  panels accidentally.
- Light and dark themes have readable text, borders, status colors, inputs,
  dialogs, overlays, logos, and focus rings.
- Respect reduced-motion preferences and keyboard focus.

## 11. AI implementation and verification checklist

Before declaring a UI change complete, verify:

- [ ] The closest reference screen and existing implementation were reviewed.
- [ ] Shared tokens/primitives were reused; no competing button or logo system
      was introduced.
- [ ] Role/API authorization, lifecycle status, and allowed actions are shown
      correctly.
- [ ] Loading, empty, error, denied, conflict, and success states are covered.
- [ ] Buttons use the correct variant, compact size, and no forced full width.
- [ ] Status/priority labels use the shared semantic foreground/background
      palette in light and dark themes.
- [ ] Forms, read views, tabs, accordions, tables, filters, pagination, and
      dialogs follow this guide without duplicate content.
- [ ] Section headings, tabs, filters, fields, tables, and modal footers were
      checked for overlap, clipping, and long-content wrapping.
- [ ] Light and dark theme behavior was rendered and inspected.
- [ ] Desktop and narrow responsive behavior was rendered and inspected.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, the applicable production
      build, and `git diff --check` pass.
- [ ] Browser evidence is reported separately from automated checks. Do not
      claim visual acceptance from compilation alone.

## 12. New and updated feature access gate

Every new feature, API operation, screen, action, and change to an existing
workflow must pass an access review before it is considered implemented. A
role label in the UI is not proof of authorization; the API capability and
provider/customer scope remain the final authority.

For every new or updated operation:

1. Define the resource, lifecycle states, read scope, write scope, transition
   scope, and audit event before building the UI.
2. Map each API route to the canonical permission/capability and verify the
   controller/service enforces it server-side. Do not rely on a hidden button,
   disabled control, route guard, or client-side role check for security.
3. Add the operation to the capability projection and navigation only when the
   server advertises the capability. A visible menu item must have a working
   authorized route; an unavailable capability must not render a misleading
   action or empty page.
4. Verify the positive and negative role matrix: Provider Administrator,
   Provider Reviewer, Marketing Manager, Marketing Executive, Operations
   Manager, Dispatcher, Technician/Agent, Asset Coordinator, Billing &
   Accounts, Customer, and Platform Administration where applicable. Include
   provider isolation, customer ownership, assigned-user scope, concluded or
   abandoned lifecycle state, and maintenance restrictions.
5. Verify the full request lifecycle: loading, 401/session expiry and refresh,
   403 denied, 404 scoped-not-found, 409 stale revision/concluded workflow,
   422 field validation, 429 rate limit, 5xx retry, success, audit log, and
   notification behavior. Error states must remain inside the shared notice
   pattern and must not falsely report a permission problem as authentication.
6. Add focused API authorization tests, UI capability/action-gating tests, and
   at least one authenticated browser journey for an allowed role and a denied
   role. Test both direct route access and the menu entry so a user cannot gain
   access by typing a URL.
7. Re-run adjacent regression tests for every role and lifecycle model touched,
   then record the exact commands and browser evidence. Do not mark a feature
   complete when only typecheck/build passes.

Required implementation record for each feature:

| Check | Evidence |
| --- | --- |
| API route and permission | Controller/service mapping and focused authorization test |
| Capability and menu | Capability projection, navigation result, allowed/denied screenshots |
| Lifecycle | Allowed transitions, concluded/abandoned behavior, stale revision test |
| Scope | Provider/customer/assignment boundary test |
| Session | Expired-token refresh and sign-in recovery test |
| Audit and notice | Audit/event record plus success, denied, conflict, and validation states |
| Regression | Typecheck, lint, focused tests, full applicable suite, and browser journey |
