# Provider Users Administration UI status

Updated 2026-10-13.

The Operations route `#/platform/provider-users` is implemented as a platform-read directory using the approved Provider Users reference image and the UBold table/detail patterns indexed by the architecture repository.

Implemented: platform navigation visibility, route guard, summary cards, Users tab, search and provider/role/status/business-operation/last-active filters, responsive membership table, loading/error/empty states, multi-membership Provider Access detail drawer, activity projection, and permission-aware provider access invitation entry point.

Last Login and Membership Last Active are rendered only from server fields; null values render “Not recorded”. Provider Operation access remains provider-membership scoped. Write controls require explicit platform capabilities and rely on API-side invitation, role, revision and membership rules. Password recovery/reset links, password setting and impersonation are out of scope and are not exposed.
