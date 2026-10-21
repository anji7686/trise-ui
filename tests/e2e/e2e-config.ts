import { loadEnv } from 'vite';

const loadedEnv = loadEnv('e2e', process.cwd(), '');

// Shell values always win. The e2e files are loaded only by the Playwright
// process and are never exposed as Vite production/browser configuration.
export function loadLocalE2EEnv() {
  for (const [name, value] of Object.entries(loadedEnv)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
  return process.env;
}

export function e2eEnv(name: string) {
  return process.env[name]?.trim() || loadedEnv[name]?.trim() || '';
}

export function e2eApiV1Base() {
  const configured = e2eEnv('TRISE_E2E_API_URL') || 'http://127.0.0.1:3000/api/v1';
  const url = new URL(configured);
  url.pathname = `${url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1`;
  return url.toString().replace(/\/$/, '');
}
