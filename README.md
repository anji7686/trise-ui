# TRISE UI foundation

Two independently built Vite applications share design tokens, API client,
authentication boundary, primitives, and locale resources:

- Customer: `http://127.0.0.1:4173`
- Operations: `http://127.0.0.1:4174`
- API: `http://127.0.0.1:3000/api/v1`

```sh
npm ci
npm run generate:api
npm run typecheck
npm run test
npm run build
npm run check:bundle
npm run dev:customer
# in another terminal
npm run dev:operations
```

Typecheck rebuilds all referenced packages with `tsc -b --force` so a fresh
checkout does not reuse tracked TypeScript build metadata for missing or stale
declaration outputs.

Start the local API in a separate terminal with its ignored environment file:

```sh
cd ~/wrk/lre/trise-api
set -a; source .env.local; set +a
bin/rails server -b 127.0.0.1 -p 3000
```

The canonical OpenAPI is read from `../trise-architecture/api/openapi.yaml`.
Authentication uses Google Identity Services credential exchange: the browser
receives an ID token and posts it to `/session/google`; this is not an OAuth
authorization-code redirect flow, so no `VITE_AUTH_REDIRECT_URI` is used. Set
`VITE_GOOGLE_CLIENT_ID` only after the same OAuth client ID is configured as the
Rails `GOOGLE_CLIENT_ID`. The local web session uses an HttpOnly refresh cookie
and a readable CSRF cookie; production must keep `TRISE_COOKIE_SECURE=true`.

For local setup, configure the Google Web application client with authorized
JavaScript origins `http://127.0.0.1:4173` and
`http://127.0.0.1:4174`. No redirect URI is required. Configure Rails with
`GOOGLE_CLIENT_ID`, `TRISE_ACCESS_TOKEN_SECRET`, `TRISE_REFRESH_TOKEN_PEPPER`,
and `TRISE_ALLOWED_ORIGINS=http://127.0.0.1:4173,http://127.0.0.1:4174`.
The public client ID is safe in browser configuration. This credential-exchange
flow does not use `GOOGLE_CLIENT_SECRET`; never expose a client secret through a
`VITE_` variable or commit it. Any secret pasted into a shared channel should
be revoked and rotated in Google Cloud Console. The preview screens render no
private records until the real exchange succeeds.

The approved TRISE INDIA logo is copied from
`../trise-architecture/logos/trise-logo.png` into each app's public assets and
used by both local shells. No credentials, production URLs, or private data are
committed.
