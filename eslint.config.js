// Linter del JavaScript de SO-ARM100 Estudio (ESLint 10, configuración «flat»).
// npm run lint
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['app/web/vendor/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'reports/**', '.stryker-tmp/**'] },
  js.configs.recommended,
  {
    files: ['app/web/js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, katex: 'readonly' } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // El video del proyecto: escenas que corren en el navegador y herramientas de Node.
    files: ['showreel/**/*.js', 'showreel/**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }], 'prefer-const': 'error' },
  },
  {
    files: ['pruebas/js/**/*.js', 'e2e/**/*.js', '*.config.js', '*.config.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
