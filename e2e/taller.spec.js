import { test, expect } from '@playwright/test';
import { abrir } from './ayuda.js';

// Las 33 soluciones de referencia del Taller de programación cumplen todas sus
// comprobaciones, y ningún programa inicial las cumple (no se resuelve sin escribir).
test('taller RAPID: soluciones correctas y programas iniciales incompletos', async ({ page }) => {
  test.setTimeout(600_000);
  const errores = await abrir(page);
  const r = await page.evaluate(async () => {
    const { TALLERES } = await import('/js/lecciones/taller_rapid.js');
    const { corregir } = await import('/js/lecciones/taller.js');
    const app = window.estudio;
    app.celda.mostrar(true);
    const out = [];
    for (const t of TALLERES) for (const paso of t.pasos) {
      if (!paso.ej) continue;
      const sol = await corregir(app, paso.ej, paso.ej.solucion);
      const ini = await corregir(app, paso.ej, paso.ej.inicial || '');
      out.push({ id: paso.ej.id, sol: sol.ok, ini: ini.ok,
        fallos: sol.resultados.flatMap((e) => e.items.filter((i) => !i.ok).map((i) => `${i.texto}: ${i.motivo}`)) });
    }
    return out;
  });
  expect(r.length).toBe(33);
  for (const x of r) {
    expect(x.fallos, `solución de ${x.id}`).toEqual([]);
    expect(x.ini, `programa inicial de ${x.id}`).toBe(false);
  }
  expect(errores).toEqual([]);
});
