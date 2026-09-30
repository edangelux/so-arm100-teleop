// El analizador del subconjunto de RAPID: instrucciones, bloques y errores con su línea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizar, instruccionTexto } from '../../app/web/js/programa/lenguaje.js';

test('reconoce movimientos con velocidad y zona', () => {
  const a = analizar('MoveL Offs(p, 0, 0, 60), v150, z10;');
  const n = a.lineas[0].nodo;
  assert.equal(n.tipo, 'move');
  assert.equal(n.instr, 'MoveL');
  assert.equal(n.vel, 150);
  assert.equal(n.zona, 10);
  assert.equal(n.destino.tipo, 'offs');
});

test('fine es zona 0 y vmax es 1000 o más', () => {
  const n = analizar('MoveJ p1, vmax, fine;').lineas[0].nodo;
  assert.equal(n.zona, 0);
  assert.ok(n.vel >= 1000);
});

test('el punto y coma es opcional y las mayúsculas dan igual', () => {
  const a = analizar('movej p1, v500, fine\nMOVEL p2, V100, FINE');
  assert.equal(a.errores.length, 0);
  assert.deepEqual(a.lineas.map((l) => l.nodo.instr), ['MoveJ', 'MoveL']);
});

test('declara puntos, números y procedimientos', () => {
  const a = analizar('CONST robtarget p := [0, -200, 100, -90, 0];\nVAR num n := 0;\nPROC main()\n  n := n + 1;\nENDPROC');
  assert.equal(a.errores.length, 0);
  assert.deepEqual(a.decls.map((d) => [d.clase, d.nombre]), [['robtarget', 'p'], ['num', 'n']]);
  assert.ok(a.procs.main);
});

test('un bloque sin cerrar es un error con número de línea', () => {
  const a = analizar('FOR i FROM 1 TO 3 DO\n  TPWrite i;\n');
  assert.ok(a.errores.length > 0);
  assert.ok(a.errores[0].linea >= 1);
});

test('un carácter extraño es un error en su línea', () => {
  const a = analizar('MoveJ p1, v500, fine;\nMoveJ p1 @ v500;');
  assert.equal(a.errores[0].linea, 2);
});

test('instruccionTexto reescribe lo que analizó', () => {
  for (const t of ['MoveL p1, v100, fine;', 'MoveJ Offs(p, 0, 0, 60), v500, z10;', 'SetDO do1, 1;', 'WaitDI di1, 1;', 'GripperOpen;', 'WaitTime 0.3;']) {
    const n = analizar(t).lineas[0].nodo;
    assert.equal(analizar(instruccionTexto(n)).lineas[0].nodo.tipo, n.tipo, t);
  }
});
