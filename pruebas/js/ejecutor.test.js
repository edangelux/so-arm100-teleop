// El intérprete: variables, bucles, condiciones, procedimientos, Offs y RelTool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, cadena } from './comun.js';

const mm = (v) => v.toArray().map((x) => Math.round(x * 1000));

test('FOR y TPWrite', async () => {
  const r = await ejecutar('FOR i FROM 1 TO 5 DO\n  TPWrite i;\nENDFOR');
  assert.deepEqual(r.mensajes, ['1', '2', '3', '4', '5']);
});

test('WHILE, asignación e Incr', async () => {
  const r = await ejecutar('VAR num k := 0;\nVAR num s := 0;\nWHILE k < 10 DO\n  Incr k;\n  s := s + k;\nENDWHILE\nTPWrite "Suma = " + s;');
  assert.deepEqual(r.mensajes, ['Suma = 55']);
});

test('IF, ELSEIF y ELSE con funciones', async () => {
  const r = await ejecutar('FOR i FROM 1 TO 4 DO\n  IF Trunc(i / 2) * 2 = i THEN\n    TPWrite i + " par";\n  ELSE\n    TPWrite i + " impar";\n  ENDIF\nENDFOR');
  assert.deepEqual(r.mensajes, ['1 impar', '2 par', '3 impar', '4 par']);
});

test('los procedimientos se llaman por su nombre y main es el principio', async () => {
  const r = await ejecutar('PROC main()\n  saludo;\n  saludo;\nENDPROC\nPROC saludo()\n  TPWrite "Hola";\nENDPROC');
  assert.deepEqual(r.mensajes, ['Hola', 'Hola']);
});

test('un WHILE infinito se corta con un error', async () => {
  await assert.rejects(ejecutar('VAR num k := 0;\nWHILE k < 1 DO\n  k := 0;\nENDWHILE'), /no termina/);
});

test('una variable sin declarar es un error con su línea', async () => {
  await assert.rejects(ejecutar('TPWrite x;'), (e) => e.linea === 1 && /no existe/.test(e.message));
});

test('MoveL termina en el punto pedido', async () => {
  const r = await ejecutar('MoveJ [0, -200, 100, -90, 0], v500, fine;');
  const qf = r.tramos.at(-1).q.at(-1);
  assert.deepEqual(mm(cadena.pose(qf).p), [0, -200, 100]);
});

test('Offs desplaza en el marco de la base', async () => {
  const r = await ejecutar('CONST robtarget p := [0, -200, 20, -90, 0];\nMoveJ Offs(p, 0, 0, 60), v500, fine;');
  assert.deepEqual(mm(cadena.pose(r.tramos.at(-1).q.at(-1)).p), [0, -200, 80]);
});

test('un punto fuera del alcance es un error, no un movimiento', async () => {
  await assert.rejects(ejecutar('MoveJ [0, -600, 100, -90, 0], v500, fine;'), /fuera del alcance/);
});

test('SetDO registra la salida', async () => {
  const r = await ejecutar('SetDO do1, 1;\nSetDO do1, 0;');
  assert.deepEqual(r.salidas, [['do1', 1], ['do1', 0]]);
});

test('operadores: NOT, AND, OR, comparaciones y división', async () => {
  const r = await ejecutar([
    'TPWrite NOT 0;', 'TPWrite NOT 5;', 'TPWrite 1 AND 0;', 'TPWrite 1 AND 2;', 'TPWrite 0 OR 0;', 'TPWrite 0 OR 3;',
    'TPWrite 2 <> 3;', 'TPWrite 2 <> 2;', 'TPWrite 2 <= 2;', 'TPWrite 3 >= 4;', 'TPWrite 7 / 2;', 'TPWrite -3 + 1;', 'TPWrite 2 * 3 - 1;',
  ].join('\n'));
  assert.deepEqual(r.mensajes, ['1', '0', '0', '1', '0', '1', '1', '0', '1', '0', '3.5', '-2', '5']);
});

test('dividir entre cero es un error', async () => {
  await assert.rejects(ejecutar('TPWrite 1 / 0;'), /entre cero/);
});
