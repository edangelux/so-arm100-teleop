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
