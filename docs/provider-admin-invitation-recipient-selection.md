# Provider Administrator invitation recipient selection

The Platform Administration provider access form now loads active, verified users before invitation details are entered.

- Provider users are loaded from the existing provider-user directory scoped to the selected provider.
- Business users use the existing server-side business filter and remain limited to the selected provider's Business.
- Users can filter by display name, email or mobile, select a recipient, and submit the existing invitation request with the internal `user_id`.
- Manual entry remains available for an existing verified identity; the API remains authoritative and rejects unknown, inactive or unverified identities.
- “Create or verify a user first” opens the existing provider Contacts flow, where an authorized administrator can use the existing provider-admin invitation option before returning to this form.

No new permission, membership, invitation state or backend workflow was introduced.
