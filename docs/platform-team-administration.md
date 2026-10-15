# Platform Team UI

The Operations application exposes `#platform/team` under Platform
Administration → Access & Governance only when the server-projected
`PLATFORM_TEAM_READ` capability is present. The drawer and actions are further
gated by invitation, role and access-management capabilities; API authorization
remains authoritative.

The screen supports the two protected platform roles, administrator listing,
role/effective-permission detail, audited suspend/restore/revoke controls,
invitation creation, resend, reasoned cancellation and invitation history. It
does not display bootstrap email arrays, invitation token digests or returned
invitation tokens in tables. The invitation action controls remain capability
gated and API authorization is authoritative.

The directory sends the explicit stable sort `-created_at,id`, matching the
Rails keyset contract. Administrator, invitation-history and role-catalogue
requests load independently, so a directory error does not empty the role
select. The role select is populated from actor-eligible API results, defaults
to Operations Manager only when returned as assignable, and keeps Send
Invitation disabled until a valid role is selected.

Roles & Permissions keeps governed role versions visible across Draft, Under
Review, Review Approved and Published states by default. A Global Administrator
with review and publish capabilities may complete the full draft → review →
publish lifecycle. Operations Manager remains unable to review or publish
platform permission policy.

Automated validation on 13 October 2026 passed: 28 Vitest files and 164 tests,
typecheck, ESLint, the Operations production build and `git diff --check`.
Browser acceptance and normal authenticated invitation acceptance remain
blocked/unverified because terminal Playwright Chromium launch previously
failed with the preserved Crashpad/Mach error; no retry or security workaround
was used.
