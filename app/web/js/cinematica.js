// Cinemática del SO-ARM100 calculada en el navegador a partir del mismo URDF.
// Sirve para que la aplicación funcione sin ROS (aprendizaje) y para la
// cinemática inversa al arrastrar la pinza. Unidades: metros y radianes;
// marco de la base del URDF (z hacia arriba).
import * as THREE from 'three';

export const BRAZO = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll'];

export function transformacionOrigen(j) {
  const m = new THREE.Matrix4();
  // URDF: rpy fijo = Rz(yaw)·Ry(pitch)·Rx(roll), que en three.js es el orden 'ZYX'.
  m.makeRotationFromEuler(new THREE.Euler(j.rpy[0], j.rpy[1], j.rpy[2], 'ZYX'));
  m.setPosition(j.xyz[0], j.xyz[1], j.xyz[2]);
  return m;
}

// Resuelve A·x = b (sistemas pequeños) por eliminación de Gauss con pivoteo parcial.
export function resolver(A, b) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / d;
      for (let k2 = c; k2 <= n; k2++) M[r][k2] -= k * M[c][k2];
    }
  }
  return M.map((fila, i) => fila[n] / (fila[i] || 1e-12));
}

export class Cadena {
  constructor(modelo) {
    this.modelo = modelo;
    const porHijo = Object.fromEntries(modelo.juntas.map((j) => [j.hijo, j]));
    // Recorre del efector hacia la base para obtener la cadena principal.
    const cadena = [];
    let eslabon = 'End_Effector';
    while (porHijo[eslabon]) { cadena.unshift(porHijo[eslabon]); eslabon = porHijo[eslabon].padre; }
    this.cadena = cadena;
    this.origenes = cadena.map(transformacionOrigen);
    this.limites = BRAZO.map((n) => modelo.juntas.find((j) => j.nombre === n).limite);
  }

  // Marcos de cada articulación y del efector para las cinco articulaciones q.
  fk(q) {
    const marcos = {};
    const T = new THREE.Matrix4();
    const R = new THREE.Matrix4();
    this.cadena.forEach((j, i) => {
      T.multiply(this.origenes[i]);
      const k = BRAZO.indexOf(j.nombre);
      if (k >= 0) {
        marcos[j.nombre] = T.clone();                      // marco antes de girar: aquí vive el eje
        R.makeRotationAxis(new THREE.Vector3(...j.eje).normalize(), q[k]);
        T.multiply(R);
      }
    });
    marcos.efector = T.clone();
    return marcos;
  }

  // Marco de cada eslabón (después de girar su articulación), incluida la
  // mandíbula móvil de la pinza. q puede traer el sexto valor (pinza).
  marcosEslabones(q) {
    const out = {};
    const T = new THREE.Matrix4();
    const R = new THREE.Matrix4();
    const todas = [...BRAZO, 'Gripper'];
    this.cadena.forEach((j, i) => {
      T.multiply(this.origenes[i]);
      const k = BRAZO.indexOf(j.nombre);
      if (k >= 0) T.multiply(R.makeRotationAxis(new THREE.Vector3(...j.eje).normalize(), q[k] ?? 0));
      out[j.hijo] = T.clone();
    });
    const g = this.modelo.juntas.find((j) => j.nombre === 'Gripper');
    if (g && out[g.padre]) {
      const M = out[g.padre].clone().multiply(transformacionOrigen(g)).multiply(R.makeRotationAxis(new THREE.Vector3(...g.eje).normalize(), q[todas.indexOf('Gripper')] ?? 0));
      out[g.hijo] = M;
    }
    out.base_link = new THREE.Matrix4();
    return out;
  }

  efector(q) {
    return new THREE.Vector3().setFromMatrixPosition(this.fk(q).efector);
  }

  // Cinemática inversa de posición por mínimos cuadrados amortiguados
  // (Levenberg–Marquardt) sobre las cuatro primeras articulaciones: el giro de
  // muñeca no mueve la punta porque la punta está sobre su propio eje.
  ik(objetivo, q0, { iteraciones = 80, tolerancia = 0.0015, lambda = 0.015 } = {}) {
    const q = q0.slice();
    const n = 4, h = 1e-4;
    let err = Infinity;
    for (let it = 0; it < iteraciones; it++) {
      const p = this.efector(q);
      const e = new THREE.Vector3().subVectors(objetivo, p);
      err = e.length();
      if (err < tolerancia) break;
      const J = [];                                        // 3×4, columnas = ∂p/∂qi
      for (let i = 0; i < n; i++) {
        const qq = q.slice(); qq[i] += h;
        J.push(new THREE.Vector3().subVectors(this.efector(qq), p).divideScalar(h));
      }
      // dq = Jᵀ (J Jᵀ + λ² I)⁻¹ e
      const A = new THREE.Matrix3();
      const a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += J[i].getComponent(r) * J[i].getComponent(c);
        a[r][c] = s + (r === c ? lambda * lambda : 0);
      }
      A.set(a[0][0], a[0][1], a[0][2], a[1][0], a[1][1], a[1][2], a[2][0], a[2][1], a[2][2]).invert();
      const y = e.clone().applyMatrix3(A);
      for (let i = 0; i < n; i++) {
        const dq = Math.max(-0.15, Math.min(0.15, J[i].dot(y)));
        const [lo, hi] = this.limites[i];
        q[i] = Math.max(lo, Math.min(hi, q[i] + dq));
      }
    }
    return { q, error: err, alcanzado: err < 0.004 };
  }

  // Pose de la herramienta: punta p, dirección de aproximación a (hacia donde
  // apunta la pinza), cabeceo = elevación de a sobre la horizontal (−90° = hacia
  // abajo) y giro = ángulo de la muñeca. Un brazo de 5 GDL no puede elegir la
  // guiñada de la pinza: a siempre queda en el plano vertical del brazo.
  pose(q) {
    const T = this.fk(q).efector;
    const e = T.elements;
    const a = new THREE.Vector3(-e[4], -e[5], -e[6]);      // −Y del marco de la pinza
    const eje = new THREE.Vector3(e[8], e[9], e[10]);        // eje de la flexión de muñeca
    return {
      p: new THREE.Vector3().setFromMatrixPosition(T),
      a, eje,
      cab: Math.asin(Math.max(-1, Math.min(1, a.z))),
      giro: q[4] ?? 0,
      T,
    };
  }

  // Cinemática inversa de pose (posición + cabeceo) por mínimos cuadrados
  // amortiguados sobre las cuatro primeras articulaciones; el giro va directo a
  // la quinta. Si la semilla no converge prueba otras, apuntando la base hacia
  // el objetivo. Devuelve también los errores para que quien llama decida.
  ikPose(p, cab, giro, q0, { iteraciones = 120, lambda = 0.01 } = {}) {
    const semillas = [q0.slice(0, 5)];
    const guinada = Math.atan2(-p.x, -p.y);
    semillas.push([guinada, 0.2, 0.4, 0.6, 0], [guinada, -0.6, 1.0, 0.9, 0], [guinada, 0.6, -0.3, 1.2, 0]);
    let mejor = null;
    for (const s of semillas) {
      const r = this._ikPose(p, cab, giro, s, iteraciones, lambda);
      if (!mejor || r.costo < mejor.costo) mejor = r;
      if (r.alcanzado) break;
    }
    return mejor;
  }

  _ikPose(p, cab, giro, q0, iteraciones, lambda) {
    const W = 0.15;                                          // m por rad: pesa el cabeceo frente a la posición
    const q = q0.slice(0, 5);
    const [lo4, hi4] = this.limites[4];
    q[4] = Math.max(lo4, Math.min(hi4, giro));
    const tarea = (qq) => { const ps = this.pose(qq); return [ps.p.x, ps.p.y, ps.p.z, W * ps.cab]; };
    const meta = [p.x, p.y, p.z, W * cab];
    let e = [0, 0, 0, 0], err = Infinity, errCab = Infinity;
    for (let it = 0; it < iteraciones; it++) {
      const f = tarea(q);
      e = meta.map((m, i) => m - f[i]);
      err = Math.hypot(e[0], e[1], e[2]);
      errCab = Math.abs(e[3] / W);
      if (err < 0.0004 && errCab < 0.004) break;
      const h = 1e-5, J = [];                                // J[i] = columna i (4 componentes)
      for (let i = 0; i < 4; i++) {
        const qq = q.slice(); qq[i] += h;
        const fi = tarea(qq);
        J.push(fi.map((v, k) => (v - f[k]) / h));
      }
      const A = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => J.reduce((s, col) => s + col[r] * col[c], 0) + (r === c ? lambda * lambda : 0)));
      const y = resolver(A, e);
      for (let i = 0; i < 4; i++) {
        const dq = Math.max(-0.2, Math.min(0.2, J[i].reduce((s, v, k) => s + v * y[k], 0)));
        const [lo, hi] = this.limites[i];
        q[i] = Math.max(lo, Math.min(hi, q[i] + dq));
      }
    }
    return { q, error: err, errorCab: errCab, costo: err + 0.05 * errCab, alcanzado: err < 0.002 && errCab < 0.02 };
  }

  // Índice de manipulabilidad de Yoshikawa w = √det(J Jᵀ), para la posición.
  manipulabilidad(q) {
    const h = 1e-4, p = this.efector(q), J = [];
    for (let i = 0; i < 4; i++) { const qq = q.slice(); qq[i] += h; J.push(new THREE.Vector3().subVectors(this.efector(qq), p).divideScalar(h)); }
    const m = new THREE.Matrix3();
    const a = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      let s = 0; for (let i = 0; i < 4; i++) s += J[i].getComponent(r) * J[i].getComponent(c); a.push(s);
    }
    m.set(...a);
    return Math.sqrt(Math.max(m.determinant(), 0));
  }
}
