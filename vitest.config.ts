import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'] },
  resolve: { alias: { '@trise/tokens': resolve(__dirname, 'packages/design-tokens/src'), '@trise/api-client': resolve(__dirname, 'packages/api-client/src') } }
});
