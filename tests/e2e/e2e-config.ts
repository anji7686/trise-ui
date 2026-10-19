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
