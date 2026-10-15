# Browser and localhost verification recovery

## Observed blocker

The terminal Playwright launch check on 2026-10-13 also stopped before
Chromium launch because the installed global npm runtime failed with:

```text
ERR_REQUIRE_ESM: require() of ES Module .../@npmcli/agent/.../http-proxy-agent/dist/index.js ...
```

The command used the repository Playwright CLI with one worker and no retries.
No browser page, screenshot, console log or network trace was produced. The
failure is in the Node/npm toolchain, not an application result; browser
acceptance remains BLOCKED until the local Playwright/npm installation is
repaired safely.

The browser JavaScript tool rejects a minimal `1 + 1` call with:

```
js: codex/sandbox-state-meta: missing field `sandboxPolicy`
```

This occurs before JavaScript execution, browser connection, or TRISE page
navigation. It cannot be repaired in React, Rails, Google login configuration
or a browser bootstrap script. Adding an application variable named
`sandboxPolicy` would not supply the host-owned tool metadata.

## Playwright CLI launch evidence (2026-10-13)

The repository Playwright CLI was also run with the installed Node 24 binary to
avoid the incompatible Node 18/npm wrapper. Chromium launched, then exited with
`SIGTRAP` before the first page was created. Playwright reported:

```text
browserType.launch: Target page, context or browser has been closed
[pid] exception while trying to kill process: Error: kill EPERM
[pid] <process did exit: exitCode=null, signal=SIGTRAP>
```

The only browser stderr observed was macOS thermal-state and DNS watcher
diagnostics. No TRISE page, screenshot, console, HTTP or request evidence was
produced. Browser acceptance remains BLOCKED; repository Chromium sandbox and
host security settings were not changed.

The authenticated Tax Management Playwright test was attempted after the
signed-out smoke test passed, but Chromium reproduced the same pre-page
`SIGTRAP` termination. The test output is preserved under the Playwright
`test-results/tax-management-*/error-context.md` artifact.

## Isolated launch comparison (2026-10-13)

With `DEBUG=pw:browser,pw:api`, the failure is at
`browserType.launch`; no browser context or page is created. A subsequent
signed-out smoke run reproduced the same failure, so authentication is not the
trigger. The managed arm64 Chromium shell exited with `SIGTRAP` and the
installed Google Chrome 155.0.8059.40 channel exited with `SIGABRT`. Both
executables and Node 24.21.0 are arm64-compatible on macOS 15.5. The browser
fixture does not launch a second browser process.

The Chrome channel was attempted as the supported fallback and also failed
before page creation. No browser security flags, sandbox settings, personal
profiles or HTTPS bypasses were added. Authenticated UI acceptance remains
BLOCKED; API and component checks remain the available fallback evidence.

## Root-cause analysis (2026-10-13)

Crash reports under `~/Library/Logs/DiagnosticReports/` establish that this is
not an authenticated fixture or TRISE application failure:

- `chrome-headless-shell-2026-10-13-185223.ips`: direct shell launch from zsh,
  arm64, `EXC_BREAKPOINT/SIGTRAP`, code 5. The stack is in Chromium's Rust
  font-format and child-process security-policy code.
- `Google Chrome-2026-10-13-185053.ips`: direct/Playwright Chrome launch,
  arm64, `EXC_CRASH/SIGABRT`, code 6, `abort() called` during application
  registration.
- `Playwright-2026-10-13-185140.ips`: WebKit fallback, arm64,
  `EXC_CRASH/SIGABRT`, code 6, in macOS `NSApplication`/`RegisterApplication`
  during WebKit startup.
- The earlier Chrome-channel report at 18:43 was translated x86_64 under
  Rosetta; the later direct report was arm64 and still aborted, so Rosetta is
  not the complete cause.

Independent commands and outcomes:

```text
Playwright managed Chromium: browserType.launch -> SIGTRAP
Playwright Google Chrome channel: browserType.launch -> SIGABRT
Direct arm64 Google Chrome with fresh profile: exit 134
Direct managed chrome-headless-shell with fresh profile: exit 133/SIGTRAP
Playwright WebKit fallback: launch -> SIGABRT
```

The direct managed-shell reproduction proves Playwright authentication,
storage state, fixtures, workers and application navigation are not causing the
Chromium failure. The WebKit and direct Chrome reports show a broader local
macOS browser-process initialization problem. No code-signing failure was
reported (`codeSigningValidationCategory` was valid), and the binaries are
arm64-compatible. The exact OS-level trigger is not exposed by the reports;
likely candidates are managed macOS GUI/process policy or a browser/macOS
compatibility fault, but this is intentionally not asserted as proven.

Installed Codex reports version `26.602.40724`, build `3593`; the Browser plugin
directory has the same version. A version mismatch has not been established.
The evidence indicates a host/tool metadata contract failure; the exact host
component responsible is not observable from this session.

Localhost is a separate restriction: HTTP connection attempts to the running
API are rejected with `Operation not permitted`; Rails integration tests fail
connecting to PostgreSQL. Listening ports do not prove healthy API responses.

## Recovery steps outside this session

1. Save work, fully quit Codex, install any available Codex update, reopen this
   workspace and reconnect the Browser plugin/tool. Retry in a fresh session.
   This is a recovery attempt, not a verified fix for the specific error.
2. Use a session permission profile that allows local development HTTP and
   PostgreSQL connections. Broad filesystem or production permissions are not
   required for these checks; do not disable all safety controls.
3. If the minimal browser-tool call still fails, report Codex version/build,
   the exact error above, and that `1 + 1` fails before browser bootstrap.
   Share sanitized diagnostics through OpenAI support, not credentials or
   database contents.
4. From an ordinary local terminal, run the prepared API verification command:

```sh
cd /Users/anjanreddy/wrk/trise/trise-api
export PATH="/Users/anjanreddy/.rbenv/versions/4.0.7/bin:$PATH"
bin/rails test test/integration/subscription_history_pagination_api_test.rb test/integration/platform_subscription_api_test.rb test/integration/provider_subscription_self_service_api_test.rb
```

Then open Operations at `http://127.0.0.1:4174` and sign in normally. Verify
provider switching, history beyond 100 records, independent provider history
paging, action errors/retries, and checklist/timeline layout at desktop and
narrow widths. No authentication bypass is part of recovery.

OpenAI's [plugin troubleshooting guidance](https://developers.openai.com/plugins/deploy/troubleshooting)
recommends distinguishing client, server and component failures. It does not
document this exact `sandboxPolicy` error or a guaranteed repair. The layer
diagnosis above is based on the actual tool failure, not that general guide.

## Manual permissions for this workspace

1. Open Settings > Browser > Agent permissions (if available), and add site exceptions for `http://127.0.0.1:4174` (Operations), `http://127.0.0.1:4173` (Customer), and `http://127.0.0.1:3000` (API). Allow browsing for these development origins. Sign in yourself using the normal flow; do not paste passwords, OTPs or tokens into chat. See [official browser controls](https://learn.chatgpt.com/docs/browser).
2. Command/network access is separate. Use the permissions control beneath the composer (or `/permissions` in the CLI) to select a supported profile. The [reviewable local profile](testing/policies/trise-local.config.toml) allowlists `localhost` and `127.0.0.1`; manually merge/select it in a new supported session only if managed policy permits. Do not mix named profiles with legacy sandbox settings. See [official profiles](https://learn.chatgpt.com/docs/permissions) and [permissions picker](https://learn.chatgpt.com/docs/sandboxing).
3. The host must also allow local PostgreSQL TCP access to `127.0.0.1:5433`. Browser site exceptions do not grant database access. If the managed profile cannot grant it, use the ordinary local terminal for the development/test commands in [Batch 5 verification](testing/provider-subscription-batch5-results.md), or have the workspace administrator enable that exact local connection.
4. Fully restart/update the app and reconnect Browser in a fresh session. The current `sandboxPolicy` metadata failure occurs before any browser permission prompt. Site exceptions cannot by themselves repair that host/tool failure. If it persists, share the exact error and app/plugin versions with support; no application code or guessed config key fixes it.

This session automatically rejects sandbox escalation requests. Your Batch 5 approval authorizes the work, but does not change the host sandbox or make a browser prompt available. No automatic approval-review rejection was received; the restrictions are the active managed permissions policy and tool failure.
