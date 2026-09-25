// Planificación de los movimientos de un programa: geometría del camino
// (articular, lineal o circular), redondeo de esquinas con zonas y perfil de
// velocidad con límites de velocidad y aceleración. Unidades internas: metros y
// radianes; los programas usan milímetros y grados.
import * as THREE from 'three';

export const GRADO = Math.PI / 180;
export const EJE_BASE = new THREE.Vector2(0, -0.0452);   // eje vertical del giro de la base (URDF)
export const LIMITES = {
  omega: 1.5,          // rad/s por articulación
  acel: 0.6,           // m/s² equivalentes sobre el camino
  metrica: 0.25,       // m por rad: convierte giros de articulación en «distancia» del camino
  pasoL: 0.002,        // m entre muestras de los movimientos cartesianos
  pasoJ: 0.01,         // rad entre muestras de los movimientos articulares
  salto: 0.25,         // rad: salto máximo entre muestras (si es mayor, hay una singularidad)
};

export class ErrorMovimiento extends Error {
  constructor(linea, mensaje) { super(mensaje); this.linea = linea; }
}

// Marco de la herramienta para una pose cartesiana: z = dirección de
// aproximación, y = eje de la flexión de muñeca, x = y × z; con el giro aplicado.
export function marcoHerramienta(p, cab, giro) {
  const h = new THREE.Vector2(p.x - EJE_BASE.x, p.y - EJE_BASE.y);
  if (h.lengthSq() < 1e-8) h.set(0, -1);
  h.normalize();
  const z = new THREE.Vector3(h.x * Math.cos(cab), h.y * Math.cos(cab), Math.sin(cab));
  let y = new THREE.Vector3(-h.y, h.x, 0);
  let x = new THREE.Vector3().crossVectors(y, z);
  const c = Math.cos(giro), s = Math.sin(giro);
  const x2 = x.clone().multiplyScalar(c).addScaledVector(y, s);
  y = y.clone().multiplyScalar(c).addScaledVector(x, -s);
  x = x2;
  return { x, y, z };
}

// Círculo que pasa por tres puntos: centro, normal, radio y ángulos.
function circulo(a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a);
  const n = new THREE.Vector3().crossVectors(ab, ac);
  const n2 = n.lengthSq();
  if (n2 < 1e-12) return null;                               // alineados: no hay círculo
  const t1 = new THREE.Vector3().crossVectors(n, ab).multiplyScalar(ac.lengthSq());
  const t2 = new THREE.Vector3().crossVectors(ac, n).multiplyScalar(ab.lengthSq());
  const centro = a.clone().add(t1.add(t2).divideScalar(2 * n2));
  const radio = centro.distanceTo(a);
  const u = a.clone().sub(centro).normalize();
  const nn = n.clone().normalize();
  const v = new THREE.Vector3().crossVectors(nn, u);
  const ang = (p) => { const d = p.clone().sub(centro); return Math.atan2(d.dot(v), d.dot(u)); };
  let tb = ang(b), tc = ang(c);
  if (tb < 0) tb += 2 * Math.PI;
  if (tc < 0) tc += 2 * Math.PI;
  if (tc < tb) return null;                                  // no debería ocurrir con la normal elegida
  return { centro, radio, u, v, fin: tc, via: tb };
}

export class Planificador {
  constructor(cadena) { this.cadena = cadena; }

  // Convierte un destino ya evaluado en una postura articular, sin moverse.
  articulacionesDe(d, qRef, linea) {
    if (d.tipo === 'art') {
      const q = d.q.map((v) => v * GRADO);
      q.forEach((v, i) => {
        const [lo, hi] = this.cadena.limites[i];
        if (v < lo - 1e-6 || v > hi + 1e-6) throw new ErrorMovimiento(linea, `El ángulo de la articulación ${i + 1} (${(v / GRADO).toFixed(1)}°) está fuera de su límite (${(lo / GRADO).toFixed(0)}° a ${(hi / GRADO).toFixed(0)}°).`);
      });
      return q;
    }
    const p = new THREE.Vector3(d.p[0] / 1000, d.p[1] / 1000, d.p[2] / 1000);
    const r = this.cadena.ikPose(p, d.cab * GRADO, d.giro * GRADO, qRef);
    if (!r.alcanzado) {
      throw new ErrorMovimiento(linea, `El punto [${d.p.map((v) => v.toFixed(0)).join(', ')}] con cabeceo ${d.cab.toFixed(0)}° está fuera del alcance del brazo (queda a ${(r.error * 1000).toFixed(0)} mm y ${(r.errorCab / GRADO).toFixed(0)}°).`);
    }
    return r.q;
  }

  pose(q) { const ps = this.cadena.pose(q); return { p: ps.p, cab: ps.cab, giro: q[4] }; }

  // Muestras de un movimiento: [{q, p, linea}], sin la postura inicial.
  muestras(m, q0) {
    const L = LIMITES;
    const out = [];
    const agregar = (q) => out.push({ q, p: this.cadena.efector(q), linea: m.linea, vel: m.vel });
    if (m.instr === 'MoveJ' || m.instr === 'MoveAbsJ') {
      const q1 = this.articulacionesDe(m.destino, q0, m.linea);
      const dmax = Math.max(...q1.map((v, i) => Math.abs(v - q0[i])));
      const n = Math.max(2, Math.ceil(dmax / L.pasoJ));
      for (let k = 1; k <= n; k++) agregar(q0.map((v, i) => v + (q1[i] - v) * (k / n)));
      return out;
    }
    const ini = this.pose(q0);
    const fin = m.destino.tipo === 'art'
      ? this.pose(this.articulacionesDe(m.destino, q0, m.linea))
      : { p: new THREE.Vector3(...m.destino.p.map((v) => v / 1000)), cab: m.destino.cab * GRADO, giro: m.destino.giro * GRADO };
    let geo;
    if (m.instr === 'MoveL') {
      const largo = ini.p.distanceTo(fin.p);
      const giroMax = Math.max(Math.abs(fin.cab - ini.cab), Math.abs(fin.giro - ini.giro));
      const n = Math.max(2, Math.ceil(largo / L.pasoL), Math.ceil(giroMax / L.pasoJ));
      geo = (s) => ini.p.clone().lerp(fin.p, s);
      geo.n = n;
    } else {
      const via = m.via.tipo === 'art' ? this.pose(this.articulacionesDe(m.via, q0, m.linea)).p
        : new THREE.Vector3(...m.via.p.map((v) => v / 1000));
      const c = circulo(ini.p, via, fin.p);
      if (!c) throw new ErrorMovimiento(m.linea, 'MoveC necesita tres puntos que no estén en línea recta: el inicio, el punto intermedio y el final.');
      if (c.radio > 1) throw new ErrorMovimiento(m.linea, 'El arco de MoveC es casi recto: aleje el punto intermedio de la recta.');
      const n = Math.max(4, Math.ceil((c.radio * c.fin) / L.pasoL));
      geo = (s) => c.centro.clone().addScaledVector(c.u, c.radio * Math.cos(s * c.fin)).addScaledVector(c.v, c.radio * Math.sin(s * c.fin));
      geo.n = n;
    }
    let q = q0.slice();
    for (let k = 1; k <= geo.n; k++) {
      const s = k / geo.n;
      const p = geo(s);
      const cab = ini.cab + (fin.cab - ini.cab) * s;
      const giro = ini.giro + (fin.giro - ini.giro) * s;
      const r = this.cadena.ikPose(p, cab, giro, q, { iteraciones: 60 });
      if (!r.alcanzado) {
        const mm = p.clone().multiplyScalar(1000);
        throw new ErrorMovimiento(m.linea, `${m.instr}: el camino sale del alcance del brazo cerca de [${mm.x.toFixed(0)}, ${mm.y.toFixed(0)}, ${mm.z.toFixed(0)}] mm (${Math.round(s * 100)} % del recorrido).`);
      }
      const salto = Math.max(...r.q.map((v, i) => Math.abs(v - q[i])));
      if (salto > L.salto) throw new ErrorMovimiento(m.linea, `${m.instr}: el brazo tendría que dar un salto brusco de ${(salto / GRADO).toFixed(0)}° cerca del ${Math.round(s * 100)} % del recorrido. Es una singularidad: pruebe con MoveJ o cambie el punto.`);
      q = r.q;
      agregar(q);
    }
    return out;
  }

  // Redondea la esquina entre dos tramos con una curva de Bézier cuadrática en
  // el espacio articular, empezando y terminando a «radio» metros de la esquina.
  redondear(a, b, radio) {
    if (!a.length || !b.length || radio <= 0) return;
    const esquina = a[a.length - 1];
    let i = a.length - 1;
    while (i > 0 && a[i].p.distanceTo(esquina.p) < radio) i--;
    let j = 0;
    while (j < b.length - 1 && b[j].p.distanceTo(esquina.p) < radio) j++;
    i = Math.max(i, Math.floor(a.length / 2));
    j = Math.min(j, Math.floor(b.length / 2));
    const q0 = a[i].q, q1 = esquina.q, q2 = b[j].q;
    const dmax = Math.max(...q0.map((v, k) => Math.abs(q2[k] - v)), 1e-6);
    const n = Math.max(3, Math.ceil(dmax / LIMITES.pasoJ));
    const curva = [];
    for (let k = 1; k < n; k++) {
      const s = k / n;
      const q = q0.map((v, c) => (1 - s) * (1 - s) * v + 2 * (1 - s) * s * q1[c] + s * s * q2[c]);
      curva.push({ q, p: this.cadena.efector(q), linea: s < 0.5 ? esquina.linea : b[0].linea, vel: s < 0.5 ? esquina.vel : b[0].vel });
    }
    a.splice(i + 1, a.length - i - 1, ...curva);
    b.splice(0, j);
  }

  // Planifica un grupo de movimientos que se ejecutan sin detenerse entre sí
  // (salvo los que terminan en «fine»). Devuelve la trayectoria con tiempos.
  planificar(movs, q0, override = 1) {
    const L = LIMITES;
    const tramos = [];
    let q = q0.slice(0, 5);
    for (const m of movs) {
      const s = this.muestras(m, q);
      tramos.push({ m, s });
      q = s[s.length - 1].q;
    }
    for (let k = 0; k < tramos.length - 1; k++) {
      const z = tramos[k].m.zona ?? 0;
      if (z > 0) this.redondear(tramos[k].s, tramos[k + 1].s, z / 1000);
    }
    const inicio = { q: q0.slice(0, 5), p: this.cadena.efector(q0), linea: movs[0]?.linea, vel: 0 };
    const pts = [inicio];
    const paradas = new Set([0]);
    tramos.forEach(({ m, s }) => {
      pts.push(...s);
      if (!(m.zona > 0)) paradas.add(pts.length - 1);
    });
    paradas.add(pts.length - 1);
    // Longitud de cada paso y velocidad máxima permitida en cada muestra.
    const n = pts.length;
    const ds = [0], vlim = [0];
    for (let i = 1; i < n; i++) {
      const dp = pts[i].p.distanceTo(pts[i - 1].p);
      const dq = Math.max(...pts[i].q.map((v, k) => Math.abs(v - pts[i - 1].q[k])));
      const d = Math.max(dp, dq * L.metrica, 1e-6);
      ds.push(d);
      const vTcp = ((pts[i].vel ?? 100) / 1000) * override;
      const vArt = dq > 1e-9 ? (L.omega * override * d) / dq : Infinity;
      vlim.push(Math.max(0.002, Math.min(vTcp, vArt)));
    }
    const v = new Array(n).fill(0);
    for (let i = 1; i < n; i++) v[i] = paradas.has(i) ? 0 : vlim[i];
    const a = L.acel * Math.max(0.3, override);
    for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * a * ds[i]));
    for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * a * ds[i + 1]));
    const t = [0];
    for (let i = 1; i < n; i++) t.push(t[i - 1] + (2 * ds[i]) / Math.max(v[i - 1] + v[i], 1e-4));
    const largo = ds.reduce((s, d, i) => s + (i ? pts[i].p.distanceTo(pts[i - 1].p) : 0), 0);
    return { t, q: pts.map((x) => x.q), p: pts.map((x) => x.p), linea: pts.map((x) => x.linea), v, duracion: t[n - 1], largo };
  }
}

// Postura interpolada en el instante t de una trayectoria planificada.
export function muestrear(tr, t) {
  const { t: ts, q } = tr;
  if (t <= 0) return { q: q[0], i: 0 };
  if (t >= ts[ts.length - 1]) return { q: q[q.length - 1], i: q.length - 1 };
  let lo = 0, hi = ts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
  const s = (t - ts[lo]) / Math.max(ts[hi] - ts[lo], 1e-9);
  return { q: q[lo].map((v, k) => v + (q[hi][k] - v) * s), i: lo };
}
