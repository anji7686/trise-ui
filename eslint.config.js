import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['dist/**', '**/dist/**', '**/*.js', 'packages/api-client/src/generated.d.ts'] }, eslint.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: { globals: { alert: 'readonly', document: 'readonly', fetch: 'readonly', Headers: 'readonly', localStorage: 'readonly', matchMedia: 'readonly', sessionStorage: 'readonly', console: 'readonly', process: 'readonly' } }
});
