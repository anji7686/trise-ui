import { defineConfig } from 'playwright/test';
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { localDevelopmentUrl } from './tests/e2e/browser-policy';
import { e2eEnv, loadLocalE2EEnv } from './tests/e2e/e2e-config';

loadLocalE2EEnv();

const scripts = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).scripts as Record<string, string>;
function appUrl(name: string, override?: string) {
  const port = scripts[`dev:${name}`].match(/--port\s+(\d+)/)?.[1];
  if (!port && !override) throw new Error(`Cannot discover ${name} port; set TRISE_E2E_${name.toUpperCase()}_URL`);
  const url = localDevelopmentUrl(override || `http://127.0.0.1:${port}`);
  return url.origin;
}
const apiUrl = e2eEnv('TRISE_E2E_API_URL') || loadEnv('development', process.cwd(), 'VITE_').VITE_API_BASE_URL || readFileSync(new URL('./.env.example', import.meta.url), 'utf8').match(/^VITE_API_BASE_URL=(.+)$/m)?.[1];
if (!apiUrl) throw new Error('API tests require a local development API URL');
localDevelopmentUrl(apiUrl);
if (e2eEnv('TRISE_E2E_DEVELOPMENT_SIGN_IN') === 'true') {
  const requiredAccounts = [
    'GLOBAL_ADMIN', 'PLATFORM_REVIEWER', 'PROVIDER_ADMIN', 'PROVIDER_REVIEWER',
    'OPERATOR', 'CUSTOMER', 'AGENT', 'MARKETING_EXECUTIVE', 'MARKETING_MANAGER',
    'ASSET_ADMINISTRATOR'
  ];
  const missing = requiredAccounts.filter(persona => !e2eEnv(`TRISE_E2E_${persona}_EMAIL`));
  if (missing.length) {
    throw new Error([
      'Authenticated E2E is enabled, but required role fixtures are missing:',
      ...missing.map(persona => `  - TRISE_E2E_${persona}_EMAIL`),
      'Copy .env.e2e.example to .env.e2e.local and fill placeholders with approved local test identities.',
      'Do not put secrets, tokens, cookies, or real credentials in the UI repository.'
    ].join('\n'));
  }
}
const viewports = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } };
const expandedVisualViewports = {
  'large-desktop': { width: 1920, height: 1080 },
  'ipad-portrait': { width: 768, height: 1024 },
  'ipad-landscape': { width: 1024, height: 768 },
  'large-tablet': { width: 800, height: 1280 },
  'small-mobile': { width: 375, height: 667 },
};
const expandedVisualProjects = e2eEnv('TRISE_E2E_EXPANDED_VISUAL') === 'true'
  ? ['customer', 'operations'].flatMap(app => Object.entries(expandedVisualViewports).map(([size, viewport]) => ({
    name: `${app}-visual-${size}`,
    testMatch: /critical-visual-workflows\.spec\.ts$/,
    use: { baseURL: appUrl(app, process.env[`TRISE_E2E_${app.toUpperCase()}_URL`]), viewport },
  })))
  : [];
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, retries: 1, workers: 2,
  timeout: 30_000, forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]], outputDir: 'test-results',
  use: { browserName: 'chromium', channel: process.env.TRISE_E2E_CHANNEL === 'chrome' ? 'chrome' : undefined, headless: true, launchOptions: { chromiumSandbox: true, timeout: 15_000, ignoreDefaultArgs: ['--unsafely-disable-devtools-self-xss-warnings'] }, screenshot: 'only-on-failure', trace: 'on-first-retry', video: 'retain-on-failure',
    storageState: { cookies: [], origins: [] } },
  projects: [{ name: 'api-public', testMatch: /api-public\.spec\.ts/, use: { baseURL: apiUrl } }, ...['customer', 'operations'].flatMap(app => Object.entries(viewports).map(([size, viewport]) => ({
    name: `${app}-${size}`, testMatch: process.env.TRISE_E2E_DEVELOPMENT_SIGN_IN === 'true'
      ? app === 'operations' ? /\/(?:public|development-sign-in|marketing-leads|marketing-quotations|elevator-operations-continuous|maintenance-preventive-execution|amc-preventive-maintenance|inspection-qualification-browser|operations-project-shipments|provider-operations-dashboard|provider-admin-provider-scope|provider-onboarding-baseline|agent-compliance|asset-compliance|business-compliance|compliance-evidence-submission|compliance-document-transfer|platform-compliance-approval|platform-review-transaction|provider-review-transaction|roles-permissions|roles-permissions-redesign|subscription-invoice-browser|team-access-simplification|tax-management|operations-visual-reference|critical-visual-workflows|customer-sites-assets|provider-work-intake)\.spec\.ts$/ : /\/(?:public|development-sign-in|customer-installation-projects|critical-visual-workflows)\.spec\.ts$/
  : '**/public.spec.ts',
    use: { baseURL: appUrl(app, process.env[`TRISE_E2E_${app.toUpperCase()}_URL`]), viewport }
  }))), ...expandedVisualProjects, { name: 'webkit-operations-desktop', testMatch: /\/tax-management\.spec\.ts$/, use: { browserName: 'webkit', baseURL: appUrl('operations', process.env.TRISE_E2E_OPERATIONS_URL), viewport: viewports.desktop, launchOptions: { timeout: 15_000 } } }]
});
