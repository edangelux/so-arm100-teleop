// Lo que se manda al brazo real o a Gazebo desde Programar: para los ocho ejemplos,
// cada tramo tiene tiempos que crecen, 5 ángulos, velocidades por debajo de 1,6 rad/s
// y dentro de los límites. Es la misma comprobación que hace el servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, cadena } from './comun.js';
import { EJEMPLOS } from '../../app/web/js/programa/ejemplos.js';
import { puntosParaRobot } from '../../app/web/js/programa/movimiento.js';

for (const ej of EJEMPLOS) {
  test(`ejemplo «${ej.titulo}»: trayectorias válidas para el robot`, async () => {
    const r = await ejecutar(ej.texto);
    assert.ok(r.tramos.length > 0);
    for (const tr of r.tramos) {
      const { puntos, mueve } = puntosParaRobot(tr);
      if (!mueve) continue;
      let previoQ = Array.from(tr.q[0]).slice(0, 5), previoT = 0;
      for (const p of puntos) {
        assert.equal(p.q.length, 5);
        assert.ok(p.t > previoT, 'los tiempos crecen');
        const vel = Math.max(...p.q.map((v, j) => Math.abs(v - previoQ[j]))) / (p.t - previoT);
        assert.ok(vel <= 1.6, `velocidad ${vel.toFixed(2)} rad/s`);
        p.q.forEach((v, j) => { const [lo, hi] = cadena.limites[j]; assert.ok(v >= lo - 1e-3 && v <= hi + 1e-3, `límite de J${j + 1}`); });
        previoQ = p.q; previoT = p.t;
      }
    }
  });
}

test('un tramo que no mueve nada no se envía', () => {
  const q = [0, 0, 0, 0, 0];
  assert.equal(puntosParaRobot({ t: [0, 0.005], q: [q, q] }).mueve, false);
});

test('dos muestras casi simultáneas no dan tiempos iguales', () => {
  const { puntos } = puntosParaRobot({ t: [0, 0.001, 0.002], q: [[0, 0, 0, 0, 0], [0.01, 0, 0, 0, 0], [0.02, 0, 0, 0, 0]] });
  for (let i = 1; i < puntos.length; i++) assert.ok(puntos[i].t > puntos[i - 1].t);
});
