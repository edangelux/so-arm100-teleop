import { test, expect } from '@playwright/test';
import { abrir, pestana } from './ayuda.js';

// Soluciones de los cuatro retos de la tarjeta Retos. Si cambian los retos o la
// celda, estas pruebas lo detectan.
const PICK = (desde, hasta, dz = 0) => [
  `MoveJ Offs(${desde}, 0, 0, 60), v500, z10;`, `MoveL ${desde}, v80, fine;`, 'GripperClose;', `MoveL Offs(${desde}, 0, 0, 60), v150, z10;`,
  `MoveJ Offs(${hasta}, 0, 0, 60), v500, z10;`, `MoveL Offs(${hasta}, 0, 0, ${dz}), v80, fine;`, 'GripperOpen;', `MoveL Offs(${hasta}, 0, 0, 60), v150, z10;`];
const DECL = 'CONST robtarget a := [-110, -150, 10, -90, 0];\nCONST robtarget m := [-110, -200, 10, -90, 0];\nCONST robtarget c := [-110, -250, 10, -90, 0];\nCONST robtarget b := [110, -200, 13, -90, 0];\nMoveAbsJ init, v500, fine;\nGripperOpen;\n';
const SOLUCIONES = {
  lima: DECL + PICK('m', 'b').join('\n'),
  todos: DECL + 'FOR k FROM 0 TO 2 DO\n  MoveJ Offs(a, 0, -50 * k, 60), v500, z10;\n  MoveL Offs(a, 0, -50 * k, 0), v80, fine;\n  GripperClose;\n  MoveL Offs(a, 0, -50 * k, 60), v150, z10;\n  MoveJ Offs(b, -30 + 30 * k, 0, 60), v500, z10;\n  MoveL Offs(b, -30 + 30 * k, 0, 0), v80, fine;\n  GripperOpen;\n  MoveL Offs(b, -30 + 30 * k, 0, 60), v150, z10;\nENDFOR',
  inversa: DECL + [...PICK('a', 'b'), ...PICK('c', 'a', 3), ...PICK('b', 'c', 3)].join('\n'),
};

test('los retos se resuelven y se comprueban en el robot virtual', async ({ page }) => {
  test.setTimeout(400_000);
  const errores = await abrir(page);
  await pestana(page, 'Programar');
  const ejemplo6 = await page.evaluate(async () => (await import('/js/programa/ejemplos.js')).EJEMPLOS.find((e) => e.id === 'apilar').texto);
  const casos = [['lima', SOLUCIONES.lima], ['todos', SOLUCIONES.todos], ['torre', ejemplo6], ['inversa', SOLUCIONES.inversa]];
  for (const [id, texto] of casos) {
    const faltan = await page.evaluate(async ([id, texto]) => {
      const s = (await import('/js/secciones/programar.js')).default;
      const { RETOS } = await import('/js/programa/retos.js');
      s.celda.reiniciar();
      s.fijarDestino('virtual');
      s.override = 1;
      s.fijarTexto(texto);
      await s.ejecutar(false);
      const piezas = Object.fromEntries(s.celda.resumen().map((p) => [p.nombre, p]));
      return RETOS.find((r) => r.id === id).revisar(piezas);
    }, [id, texto]);
    expect(faltan, `reto ${id}`).toEqual([]);
  }
  expect(errores).toEqual([]);
});
