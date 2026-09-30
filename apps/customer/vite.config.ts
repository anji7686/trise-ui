import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
const workspace = resolve(__dirname, '../..');
export default defineConfig({ root: 'apps/customer', envDir: workspace, plugins: [react()], resolve: { alias: { '@trise/tokens': resolve(workspace, 'packages/design-tokens/src'), '@trise/auth': resolve(workspace, 'packages/auth/src/index.tsx'), '@trise/api-client': resolve(workspace, 'packages/api-client/src/index.ts'), '@trise/i18n': resolve(workspace, 'packages/i18n/src/index.ts'), '@trise/ui': resolve(workspace, 'packages/ui-primitives/src/index.tsx') } }, server: { fs: { allow: [workspace] } }, build: { outDir: '../../dist/customer', emptyOutDir: true } });
