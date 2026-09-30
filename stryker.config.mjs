// Pruebas de mutación del intérprete RAPID (npm run mutacion). Stryker cambia el
// código a propósito (un < por <=, un + por -…) y comprueba que las pruebas lo
// detecten. Es lento: en el CI corre una vez por semana.
export default {
  testRunner: 'command',
  commandRunner: { command: 'node --test pruebas/js/lenguaje.test.js pruebas/js/ejecutor.test.js' },
  mutate: ['app/web/js/programa/lenguaje.js', 'app/web/js/programa/ejecutor.js'],
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutacion/index.html' },
  concurrency: 2,
  timeoutMS: 20000,
  thresholds: { high: 80, low: 60, break: null },
};
