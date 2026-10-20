# Platform Administration UI Design Reference

## Visual reference applied

The configuration, approval, reference-data, and audit screens apply the local
UBold `Tables.pdf` pattern for compact searchable tables, status badges, and
row actions, together with `Task Details.pdf` for grouped detail content and
chronological change history. TRISE-specific scope, capability, impact, and
approval controls replace the reference sample data and destructive actions.

## Design objective

Make complex configuration safe for Platform Administration and simple for providers. The UI must prefer search/select, checkboxes, radio buttons, and switches over free-text operations while preserving existing provider workflows.

## Screen set

1. **Common Configuration** — platform-wide defaults, locked `Asia/Kolkata`, feature flags, audit/security, notifications, reference-data status.
2. **Business Master Configuration** — Elevator & Lift catalogue with tabs for types, industries, services, checklists, maintenance rules, and standards.
3. **Provider Configuration** — adoption and operational settings; canonical catalogue appears read-only.
4. **Commercial & Tax Governance** — plans, add-ons, GST classifications, legal sources, and effective dates.
5. **Security, Notifications & Integrations** — provider baseline, templates, triggers, webhooks, retention, and audit.
6. **Customers, Sites & Assets** — operational records; no master-data enable/disable control on existing assets.
7. **Configuration Approvals** — pending global catalogue and reference-data reviews with candidate revision, reason, impact context, independent approve/revoke actions, and a route into the correct typed workspace.
8. **Reference Data** — versioned India geography/PIN imports, checksums, row counts, active status, and restore of staged datasets.
9. **Configuration Audit** — consolidated platform-scoped configuration/review/import events; provider operational audit remains separate.
10. **Business Operation Catalogue** — platform-owned operation types with searchable code/name, industry and icon selectors, draft/review/publish controls, enable/disable controls, and provider-selectability controls. This is separate from provider operation assignment.

## Shared layout

- Compact sidebar and platform context header.
- Breadcrumb, page title, explanatory scope text.
- Summary cards with authoritative counts only.
- Search and filter toolbar.
- Table with status badge, scope, revision, last updated, and action menu.
- Detail drawer with dependencies, impact, audit, and lifecycle timeline.
- Sticky action footer for Save draft, Submit for review, Approve, Publish/Activate.
- Platform Admin shows only global-safe catalogue types. Provider-only calendars, territories, dispatch policies, and emergency rules remain in the provider workspace.
- Review history is selected from the server-provided review list; operators never paste a review UUID. The detail drawer also shows configuration audit actions and domain events.
- The approval queue is a bounded server read. It never approves a changed candidate silently; the lifecycle API rechecks revision and digest before accepting the decision.
- Every selected configuration shows an impact preview before lifecycle actions: dependent definitions, provider-scoped matches, archive safety, and warnings.
- Structured catalogue collections use repeatable rows with Add row/Remove controls. Codes and descriptions remain short text fields where they are business identifiers; delimiter-based `code|value` entry is not required for asset attributes, components, checklists, calendars, holidays, assignment rules, or maintenance rules.
- Elevator & Lift asset definitions use allowlisted technology selects, industry/application/standards checkboxes, and safety/inspection/maintenance radio controls. These values are stored in the typed asset-definition metadata and remain optional for legacy non-Elevator definitions.
- The Business Operation Catalogue uses controlled industry/icon selects and checkboxes for proposed active/provider-selectable state. Save draft, submit review, approve, and publish are separate actions; publish never removes provider assignments.

## Control rules

- Enabled/disabled state: active catalogue rows are enabled for new selections; the platform action “Disable for new selections” archives the version after impact checks, while existing references are retained.
- Restore action: an archived row is restored as a new draft and must pass the normal independent review and activation flow before it becomes enabled again.
- Checkbox: independent applicability or adoption option.
- Checkbox groups: bounded channel, fulfilment-mode, and proficiency-level selections; operators do not type delimiter-separated enum lists.
- Radio group: exactly one operating mode.
- Searchable select: canonical reference selection.
- Lock icon: platform-owned/read-only field.
- Warning panel: dependency or safety impact requiring confirmation.
- Date/time controls: every `datetime-local` value is interpreted and serialized as `Asia/Kolkata` by the shared client helper; operators are not asked to choose a timezone and browser locale cannot shift the submitted instant.

## India address reference controls

- Country is a locked `India` selection because the current platform operating policy is India-only; no timezone or country text field is shown.
- State/UT, district, and city use the canonical India geography endpoint in a dependent search flow: State/UT → district → city.
- The selector displays the reference code and name, and new submissions carry both the selected code and display name. This keeps current provider, office, business-profile, and service-history contracts compatible while the server validates the code against the active reference-data import.
- Changing a parent clears dependent selections. A record cannot be saved with a typed or stale child selection, and PIN remains a six-digit premise field rather than a substitute for address geography.
- Address line, locality, landmark, office name, and coordinates remain entered or captured because they describe the exact premise and are not master-data values.

## Provider-safe copy

Use this message when a platform master row is disabled:

> Disabling stops new provider adoption. Existing assets, contracts, jobs, invoices, and service history remain unchanged.

Use this message in provider configuration:

> You can set provider-specific operating values, but cannot change platform master data.

## Accessibility and usability

- Every switch has a text label and current state.
- Every destructive or irreversible-looking action requires a reason and confirmation.
- Do not rely on color alone for status.
- Search results show code, display name, parent, and active status.
- Keyboard focus, empty states, loading states, stale revision conflicts, forbidden states, and API errors are explicit.
- Never preselect a tax registration, provider, city, or configuration where the server has not selected it.
