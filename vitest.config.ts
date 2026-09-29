import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['packages/**/*.test.ts'] },
  resolve: { alias: { '@trise/tokens': resolve(__dirname, 'packages/design-tokens/src') } }
});
