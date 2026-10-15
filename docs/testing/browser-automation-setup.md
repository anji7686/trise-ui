# TRISE browser automation setup

Recorded 10 October 2026. Setup is implemented; browser acceptance is BLOCKED.

## Discovery

Workspace: `/Users/anjanreddy/wrk/trise`; sibling repositories `trise-ui`,
`trise-api`, `trise-architecture`. UI uses npm/package-lock, React 19, Vite 7,
TypeScript 5.9, ESLint 9 and Vitest 3. Rails uses Ruby 4.0.7, Bundler,
PostgreSQL and Rails/Minitest integration tests. Rails health is `GET /up`;
this checks application boot, not all database dependencies.

Customer and Operations are separate Vite apps. Administration, provider and
agent screens are inside Operations, not additional applications. Discovered
npm scripts specify Customer port 4173 and Operations port 4174; listening
processes confirmed those ports and Rails on 3000. Ports are observations, not
fixed assumptions: Playwright reads app ports from package scripts and API URL
from Vite development settings or `.env.example`. Override with
`TRISE_E2E_CUSTOMER_URL`, `TRISE_E2E_OPERATIONS_URL`, `TRISE_E2E_API_URL`.
Only localhost origins are accepted. Tests reuse running servers and never start,
reset or seed a database automatically.

Existing `.local-browser` had Playwright 1.64.0 and a standalone verification
script. The UI now owns a pinned Playwright 1.64.0 development dependency,
reusing its included `playwright/test` runner instead of adding a second runner.
Vitest discovery already excludes e2e tests. Existing user modifications remain.

## Local commands

The default shell selects Node 18 alongside npm 12, which fails with
`ERR_REQUIRE_ESM`. Use the available native Apple Silicon Node 24:

```sh
cd /Users/anjanreddy/wrk/trise/trise-ui
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH"
npm ci
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.browser-cache"
npx playwright install chromium
npm run test:e2e:typecheck
npm run test:e2e -- --list
npm run test:e2e -- --project=operations-desktop
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:report
# Optional: use already-installed Chrome (default remains Playwright Chromium)
TRISE_E2E_CHANNEL=chrome npm run test:e2e -- --project=operations-desktop
```

Run the existing `dev:customer`, `dev:operations` and Rails development commands
only if servers are absent. Config uses Playwright’s standard cache unless `PLAYWRIGHT_BROWSERS_PATH` is
explicitly set. To use the workspace cache, set the same variable for both
installation and test execution. Chromium sandbox is explicitly enabled; no authentication or authorization checks are disabled.

## Evidence and privacy

Six UI cases cover desktop 1440×900, tablet 820×1180 and mobile 390×844;
one API case checks health and anonymous private reads. Screenshot policy is
`only-on-failure`, video `retain-on-failure`, trace `on-first-retry`, retries 1.
See [Playwright recording options](https://playwright.dev/docs/api/class-testoptions).
HTML report: `playwright-report`; evidence: `test-results`. Both are ignored.

Fixtures capture console warning/error type/location, exception names,
request method/path/resource type/JSON field names, response status including
4xx/5xx, failed request metadata, and a signed-out accessible DOM snapshot.
No tokens, headers, query strings, payload values, response bodies or raw console
messages are persisted by custom diagnostics. This is deliberately metadata-only;
inspect actual messages/payloads interactively on synthetic records when tooling
works. Every error status remains in evidence; signed-out authentication 401s
are expected, not hidden. UI tests fail on page exceptions and HTTP 4xx/5xx except explicit signed-out
401s on current-user/refresh endpoints. Console errors, duplicate requests and retry patterns require
interactive classification; current tests do not establish absence of these.

Screenshots/videos/traces are not intrinsically redacted. Use synthetic local
records and dedicated development identities; keep artifacts local and inspect
before sharing. A launch failure cannot produce a page screenshot/video. The
failed launch did produce a retry trace and error context. Preserved blocker
artifacts are also in ignored `docs/evidence/browser-automation/`.

## Authentication and storage

Both apps use real Google Identity Services credential exchange, access tokens
in memory and cookie refresh. Development enrollment exists in Rails source;
its allowed identities and active role assignments were not verified against
the database. No usable role account was established in this session. No test
header, forged identity, enrollment or permission change was performed.

For approved dedicated development accounts, save storage locally after normal
interactive sign-in (requires working browser/network):

```sh
mkdir -p .auth
npx playwright codegen --save-storage=.auth/provider-admin.json "$TRISE_E2E_OPERATIONS_URL"
chmod 600 .auth/provider-admin.json
```

Set the URL variable first. Storage includes sensitive cookies: never commit it.
Authenticate separately per role. Cookie state must survive real API refresh;
if expired, sign in again. Public checks always use empty storage. Authenticated
role suites must explicitly verify `/users/me`, provider capabilities and tenant
context before exercising synthetic records; no such suite is claimed complete.

## Interactive tooling

In-app Browser skill was read and bootstrap attempted; tool failed before
execution: `js: codex/sandbox-state-meta: missing field sandboxPolicy`.
No Playwright MCP or Chrome DevTools MCP tool is connected in this session.
A config file is not evidence of a live connection.

For a host session permitting MCP configuration, connect the stdio servers using
the client settings. Official examples use `npx @playwright/mcp@latest` and
`npx chrome-devtools-mcp@latest`; review/pin the selected versions before rollout.
References: [Playwright MCP](https://github.com/microsoft/playwright-mcp),
[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp).
Example Codex configuration to review in a host session (not installed here):

```toml
[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]

[mcp_servers.chrome_devtools]
command = "npx"
args = ["chrome-devtools-mcp@latest"]
```

Ensure the MCP host resolves the same supported Node version. Global Codex settings are outside this workspace's writable roots; they were
not edited. After reconnecting, verify tool availability and navigate the actual
local screen before treating setup as successful. In-app Browser remains governed
by its own skill and is not controlled through these external servers.

## Current blockers and recovery

1. Browser tool metadata: missing `sandboxPolicy`. Fully quit/update/reopen Codex,
   reconnect tooling and use a fresh session; this is an unverified recovery step.
2. Chromium is absent. Download attempt failed `ENOTFOUND cdn.playwright.dev`.
   Run the install command above in a terminal with normal network access.
3. Localhost access is restricted here. Use a development session allowing HTTP
   and PostgreSQL. API health requests/tests cannot establish health in this one.

Do not claim inspect → reproduce → fix → browser retest until a real screen can
be opened. Start with Operations signed-out, then one authorized subscription
workflow using synthetic data. Expand role coverage only after that demonstration.

Installed Chrome was also attempted: launch closed before page creation, with
`SIGABRT` and `kill EPERM` in browser logs. This does not establish a TRISE defect.

## Secure host activation

See `browser-security-policy.md` and its inactive templates under `policies/`.
They distinguish host permissions from endpoint guards and require effective-policy
validation before browser acceptance. Current unit suite: 105 passing tests, including
15 endpoint policy cases. No host restriction has been relaxed in this session.
