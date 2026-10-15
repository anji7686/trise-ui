# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public.spec.ts >> signed-out screen protects private workflows and fits the viewport
- Location: tests/e2e/public.spec.ts:3:1

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /Users/anjanreddy/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --user-data-dir=/var/folders/tt/nbcp2pcd7rn5rm6vp34zsl5m0000gn/T/playwright_chromiumdev_profile-r3buw9 --remote-debugging-pipe --no-startup-window
<launched> pid=12795
[pid=12795][err] [1012/104605.396675:ERROR:base/power_monitor/thermal_state_observer_mac.mm:122] ThermalStateObserverMac unable to register to power notifications. Result: 9
[pid=12795][err] [1012/104605.413714:ERROR:net/dns/dns_config_service_posix.cc:139] DNS config watch failed to start.
[pid=12795][err] [1012/104605.416328:WARNING:net/dns/dns_config_service_posix.cc:198] Failed to read DnsConfig.
Call log:
  - <launching> /Users/anjanreddy/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --user-data-dir=/var/folders/tt/nbcp2pcd7rn5rm6vp34zsl5m0000gn/T/playwright_chromiumdev_profile-r3buw9 --remote-debugging-pipe --no-startup-window
  - <launched> pid=12795
  - [pid=12795][err] [1012/104605.396675:ERROR:base/power_monitor/thermal_state_observer_mac.mm:122] ThermalStateObserverMac unable to register to power notifications. Result: 9
  - [pid=12795][err] [1012/104605.413714:ERROR:net/dns/dns_config_service_posix.cc:139] DNS config watch failed to start.
  - [pid=12795][err] [1012/104605.416328:WARNING:net/dns/dns_config_service_posix.cc:198] Failed to read DnsConfig.
  - [pid=12795] <gracefully close start>
  - [pid=12795] <kill>
  - [pid=12795] <will force kill>
  - [pid=12795] exception while trying to kill process: Error: kill EPERM
  - [pid=12795] <process did exit: exitCode=null, signal=SIGTRAP>
  - [pid=12795] starting temporary directories cleanup
  - [pid=12795] finished temporary directories cleanup
  - [pid=12795] <gracefully close end>

```