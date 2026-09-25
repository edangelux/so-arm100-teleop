// Piezas comunes de las lecciones: animaciones, deslizadores, marcos de
// coordenadas, flechas y nubes en la escena 3D, gráficas SVG y fórmulas.
// Todo lo que una lección agrega a la escena va en app.escena.extras, que el
// reproductor de lecciones vacía al cambiar de paso.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import katex from '../../vendor/katex/katex.mjs';
import { el, grados } from '../ui.js';
import { COLORES } from '../escena.js';

export const BRAZO = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll'];
export const NOMBRE = { Shoulder_Rotation: 'Giro de la base', Shoulder_Pitch: 'Hombro', Elbow: 'Codo', Wrist_Pitch: 'Flexión de muñeca', Wrist_Roll: 'Giro de muñeca', Gripper: 'Pinza' };
export const EJES = { x: 0xfd44b0, y: 0xc2ef4e, z: 0x7553ff };     // x rojo-fucsia, y verde-lima, z azul-violeta
export const GRADO = Math.PI / 180;
export { grados };

// ------------------------------------------------------------ tiempo
export function animar(f) {
  let vivo = true;
  const t0 = performance.now();
  const paso = () => { if (!vivo) return; f((performance.now() - t0) / 1000); requestAnimationFrame(paso); };
  paso();
  return () => { vivo = false; };
}

// Junta varias funciones de limpieza en una.
export const juntar = (...fs) => () => fs.forEach((f) => f && f());

// ------------------------------------------------------------ fórmulas
// Sustituye $$…$$ (bloque) y $…$ (en línea) por KaTeX.
export function mate(html) {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => katex.renderToString(t, { displayMode: true, throwOnError: false }))
    .replace(/\$([^$\n]+?)\$/g, (_, t) => katex.renderToString(t, { throwOnError: false }));
}
export const formula = (tex, bloque = true) => el('div', { class: bloque ? 'formula' : 'formula en-linea', html: katex.renderToString(tex, { displayMode: bloque, throwOnError: false }) });

// ------------------------------------------------------------ controles
export function deslizador(etiqueta, { min, max, paso = 0.01, valor = 0, formato = (v) => v.toFixed(2), color = null, alCambiar }) {
  const lectura = el('span', { class: 'lectura' }, formato(valor));
  const r = el('input', { type: 'range', min, max, step: paso, value: valor });
  r.addEventListener('input', () => { lectura.textContent = formato(+r.value); alCambiar?.(+r.value); });
  const fila = el('div', { class: 'desl' },
    el('span', { class: 'desl-etq' }, color ? el('i', { style: `background:${color}` }) : null, etiqueta), r, lectura);
  fila.fijar = (v) => { r.value = v; lectura.textContent = formato(+v); };
  fila.valor = () => +r.value;
  return fila;
}

// Cinco (o seis) deslizadores que mueven el robot virtual.
export function mini(app, q, alCambiar, { articulaciones = BRAZO, resaltar = true } = {}) {
  const cont = el('div', { class: 'desl-grupo' });
  const todos = [...BRAZO, 'Gripper'];
  const filas = {};
  articulaciones.forEach((n) => {
    const i = todos.indexOf(n);
    const j = app.modelo.juntas.find((x) => x.nombre === n);
    const d = deslizador(NOMBRE[n], {
      min: j.limite[0], max: j.limite[1], paso: 0.01, valor: q[i] ?? 0, color: COLORES[n],
      formato: (v) => `${grados(v).toFixed(0)}°`,
      alCambiar: (v) => { q[i] = v; app.escena.fijarPostura(q); alCambiar?.(); },
    });
    if (resaltar) {
      d.addEventListener('pointerenter', () => app.escena.resaltar(n));
      d.addEventListener('pointerleave', () => app.escena.resaltar(null));
    }
    filas[n] = d;
    cont.append(d);
  });
  cont.filas = filas;
  return cont;
}

export function botones(...pares) {
  return el('div', { class: 'fila', style: 'flex-wrap:wrap;gap:6px;margin-top:8px' },
    ...pares.map(([t, f, c = '']) => el('button', { class: `boton pequeno ${c}`, onclick: f }, t)));
}

export function lectura(texto = '') { return el('div', { class: 'lectura-leccion' }, texto); }

// ------------------------------------------------------------ escena
const extras = (app) => app.escena.extras;

// Quita de la escena todo lo que agregó un paso, incluidas las etiquetas HTML anidadas.
export function vaciar(app) {
  const ex = app.escena.extras;
  ex.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); o.geometry?.dispose?.(); });
  ex.clear();
}

export function flecha(app, origen, dir, largo, color, grosor = 1) {
  const f = new THREE.ArrowHelper(dir.clone().normalize(), origen, largo, color, 0.018 * grosor, 0.011 * grosor);
  extras(app).add(f);
  return f;
}

export function etiqueta(app, texto, pos, clase = '') {
  const div = el('div', { class: `etiqueta3d ${clase}`, html: texto });
  const o = new CSS2DObject(div);
  o.position.copy(pos);
  extras(app).add(o);
  return o;
}

// Marco de coordenadas en la pose T (Matrix4 en el marco de la base, metros).
export function marco(app, T, { largo = 0.06, nombre = '', etiquetas = true } = {}) {
  const g = new THREE.Group();
  const ejes = {};
  for (const [k, v] of [['x', new THREE.Vector3(1, 0, 0)], ['y', new THREE.Vector3(0, 1, 0)], ['z', new THREE.Vector3(0, 0, 1)]]) {
    const f = new THREE.ArrowHelper(v, new THREE.Vector3(), largo, EJES[k], largo * 0.25, largo * 0.14);
    g.add(f);
    ejes[k] = f;
    if (etiquetas) {
      const o = new CSS2DObject(el('div', { class: 'etiqueta-eje', style: `color:#${EJES[k].toString(16).padStart(6, '0')}` }, k));
      o.position.copy(v.clone().multiplyScalar(largo * 1.18));
      g.add(o);
    }
  }
  if (nombre) {
    const o = new CSS2DObject(el('div', { class: 'etiqueta3d' }, nombre));
    o.position.set(-0.012, -0.012, -0.012);
    g.add(o);
  }
  g.matrixAutoUpdate = false;
  g.matrix.copy(T);
  extras(app).add(g);
  g.fijar = (M) => { g.matrix.copy(M); g.matrixWorldNeedsUpdate = true; };
  return g;
}

export function linea(app, puntos, color = 0xffffff, opacidad = 1) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineBasicMaterial({ color, transparent: opacidad < 1, opacity: opacidad }));
  extras(app).add(l);
  l.fijar = (pts) => l.geometry.setFromPoints(pts);
  return l;
}

export function nube(app, puntos, colores, tamano = 0.006) {
  const geo = new THREE.BufferGeometry().setFromPoints(puntos);
  if (colores) geo.setAttribute('color', new THREE.Float32BufferAttribute(colores.flatMap((c) => [c.r, c.g, c.b]), 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: tamano, vertexColors: !!colores, color: colores ? 0xffffff : 0xc2ef4e, transparent: true, opacity: 0.9, sizeAttenuation: true }));
  extras(app).add(p);
  return p;
}

export function esfera(app, pos, radio = 0.012, color = 0xc2ef4e, opacidad = 0.85) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: opacidad }));
  m.position.copy(pos);
  extras(app).add(m);
  return m;
}

export function caja(app, pos, tam, color = 0xfd44b0, opacidad = 0.5) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...tam), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: opacidad, depthWrite: opacidad >= 1 }));
  m.position.copy(pos);
  extras(app).add(m);
  return m;
}

// Marco de la pinza (efector) para q, en el marco de la base.
export const marcoEfector = (app, q) => app.cadena.fk(q).efector;

// ------------------------------------------------------------ gráficas SVG
// grafica({ ancho, alto, x: [min, max], y: [min, max], xEtq, yEtq, series: [{ color, puntos: [[x, y]], ancho, punteada }] })
export function grafica(o) {
  const W = o.ancho || 480, H = o.alto || 200, m = { i: 44, d: 12, s: 12, b: 30 };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'grafica');
  const sx = (x) => m.i + ((x - o.x[0]) / (o.x[1] - o.x[0])) * (W - m.i - m.d);
  const sy = (y) => H - m.b - ((y - o.y[0]) / (o.y[1] - o.y[0])) * (H - m.s - m.b);
  const partes = [];
  const marcas = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
  for (const v of marcas(o.y[0], o.y[1], 4)) partes.push(`<line x1="${m.i}" x2="${W - m.d}" y1="${sy(v)}" y2="${sy(v)}" class="g-rejilla"/><text x="${m.i - 6}" y="${sy(v) + 4}" text-anchor="end" class="g-num">${+v.toFixed(2)}</text>`);
  for (const v of marcas(o.x[0], o.x[1], 5)) partes.push(`<text x="${sx(v)}" y="${H - m.b + 16}" text-anchor="middle" class="g-num">${+v.toFixed(2)}</text>`);
  if (o.xEtq) partes.push(`<text x="${W - m.d}" y="${H - 2}" text-anchor="end" class="g-etq">${o.xEtq}</text>`);
  if (o.yEtq) partes.push(`<text x="${m.i}" y="${m.s - 2}" class="g-etq">${o.yEtq}</text>`);
  svg.innerHTML = partes.join('');
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.append(g);
  svg.dibujar = (series) => {
    g.innerHTML = series.map((s) => {
      const d = s.puntos.filter((p) => Number.isFinite(p[1])).map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(Math.max(o.y[0], Math.min(o.y[1], p[1]))).toFixed(1)}`).join('');
      const marca = s.marca ? `<circle cx="${sx(s.marca[0])}" cy="${sy(s.marca[1])}" r="4" fill="${s.color}"/>` : '';
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.ancho || 2}" ${s.punteada ? 'stroke-dasharray="5 4"' : ''}/>${marca}${s.nombre ? `<text x="${sx(s.puntos[s.puntos.length - 1][0]) - 4}" y="${sy(s.puntos[s.puntos.length - 1][1]) - 6}" text-anchor="end" class="g-serie" fill="${s.color}">${s.nombre}</text>` : ''}`;
    }).join('');
  };
  svg.dibujar(o.series || []);
  return svg;
}

// Matriz como tabla (valores con n decimales). resaltar: {fila: [..], col: [..]}.
export function matriz(filas, { decimales = 3, clases = null } = {}) {
  const t = el('table', { class: 'matriz' });
  t.fijar = (M) => {
    t.replaceChildren(...M.map((f, i) => el('tr', {}, ...f.map((v, j) => el('td', { class: clases?.(i, j) || '' }, typeof v === 'number' ? (Math.abs(v) < 5e-4 ? '0' : v.toFixed(decimales)) : v)))));
  };
  t.fijar(filas);
  return t;
}

// Matriz 4×4 de three.js a filas.
export const filas4 = (M) => { const e = M.elements; return [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => e[c * 4 + r])); };

// ------------------------------------------------------------ vistas
export function vista(app, posicion, objetivo) {
  app.escena._animarCamara(new THREE.Vector3(...posicion), new THREE.Vector3(...objetivo));
}

// Convierte un punto del marco de la base (URDF) a coordenadas de la escena, para la cámara.
export function aEscena(app, p) {
  app.escena.soporte.updateMatrixWorld(true);
  return p.clone().applyMatrix4(app.escena.raiz.matrixWorld);
}

// Barras horizontales: [{ etq, frac (0 a 1), texto }]. fijar(nuevas) las actualiza.
export function barras(filas) {
  const cont = el('div', { class: 'barras' });
  cont.fijar = (fs) => {
    cont.replaceChildren(...fs.map((f) => {
      const frac = Math.max(0, Math.min(1, f.frac));
      return el('div', { class: 'barra-dato' },
        el('span', {}, f.etq),
        el('div', { class: 'pista' }, el('div', { class: `relleno ${frac > 0.8 ? 'muy' : frac > 0.5 ? 'alto' : ''}`, style: `width:${(frac * 100).toFixed(1)}%` })),
        el('span', { class: 'v' }, f.texto));
    }));
  };
  cont.fijar(filas);
  return cont;
}

// Figura SVG a partir de su código (para diagramas fijos de las lecciones).
export const figura = (svg) => el('div', { class: 'figura-leccion', html: svg });

// Geometría plana del brazo, medida del propio modelo en la postura cero:
// hombro, codo y muñeca giran en un plano vertical que pasa por el eje de la base.
export function geometriaPlana(app) {
  if (app._geoPlana) return app._geoPlana;
  const f = app.cadena.fk([0, 0, 0, 0, 0]);
  const P = (n) => new THREE.Vector3().setFromMatrixPosition(f[n]);
  const eje = P('Shoulder_Rotation');                 // (0, −45,2, 16,5) mm: el eje vertical pasa por x = 0, y = −45,2 mm
  const plano = (v) => [-(v.y - eje.y), v.z];         // [distancia horizontal al eje, altura]
  const [h, c, m, p] = ['Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'efector'].map((n) => plano(P(n)));
  const g = {
    ejeY: eje.y, r0: h[0], z0: h[1],
    L2: Math.hypot(c[0] - h[0], c[1] - h[1]), a2: Math.atan2(c[1] - h[1], c[0] - h[0]),
    L3: Math.hypot(m[0] - c[0], m[1] - c[1]), a3: Math.atan2(m[1] - c[1], m[0] - c[0]),
    L4: Math.hypot(p[0] - m[0], p[1] - m[1]),
  };
  // Directa en forma cerrada: [x, y, z] (m) y cabeceo de la pinza (rad).
  g.directa = (q) => {
    const f2 = g.a2 - q[1], f3 = g.a3 - q[1] - q[2], f4 = -q[1] - q[2] - q[3];
    const r = g.r0 + g.L2 * Math.cos(f2) + g.L3 * Math.cos(f3) + g.L4 * Math.cos(f4);
    const z = g.z0 + g.L2 * Math.sin(f2) + g.L3 * Math.sin(f3) + g.L4 * Math.sin(f4);
    return { x: -r * Math.sin(q[0]), y: g.ejeY - r * Math.cos(q[0]), z, r, cab: f4, f2, f3 };
  };
  // Inversa geométrica: las dos soluciones (codo arriba y codo abajo) o ninguna.
  g.inversa = (x, y, z, cab) => {
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const rAbs = Math.hypot(x, y - g.ejeY);
    const q1a = Math.atan2(-x, -(y - g.ejeY));
    const sols = [];
    let info = null;
    // Con la base girada 180°, el mismo punto queda «detrás» del hombro (r negativa).
    for (const [q1, r] of [[q1a, rAbs], [norm(q1a + Math.PI), -rAbs]]) {
      const rw = r - g.L4 * Math.cos(cab) - g.r0, zw = z - g.L4 * Math.sin(cab) - g.z0;
      const D = (rw * rw + zw * zw - g.L2 * g.L2 - g.L3 * g.L3) / (2 * g.L2 * g.L3);
      if (!info) info = { q1, rw, zw, D };
      if (Math.abs(D) > 1) continue;
      for (const s of [1, -1]) {
        const d = s * Math.acos(D);                  // ángulo del antebrazo respecto del brazo
        const f2 = Math.atan2(zw, rw) - Math.atan2(g.L3 * Math.sin(d), g.L2 + g.L3 * Math.cos(d));
        const f3 = f2 + d;
        const q2 = norm(g.a2 - f2), q3 = norm(g.a3 - q2 - f3), q4 = norm(-q2 - q3 - cab);
        const q = [q1, q2, q3, q4];
        const dentro = q.every((v, i) => v >= app.cadena.limites[i][0] - 1e-6 && v <= app.cadena.limites[i][1] + 1e-6);
        sols.push({ q, codo: s > 0 ? 'arriba' : 'abajo', dentro, detras: r < 0 });
      }
    }
    return { ...info, soluciones: sols };
  };
  app._geoPlana = g;
  return g;
}

// Jacobiano de posición 3×n (columnas ∂p/∂qᵢ) por diferencias finitas, en m/rad.
export function jacobiano(app, q, n = 4) {
  const h = 1e-6, p = app.cadena.efector(q), J = [];
  for (let i = 0; i < n; i++) { const qq = q.slice(); qq[i] += h; J.push(app.cadena.efector(qq).sub(p).divideScalar(h)); }
  return J;                                              // arreglo de Vector3 (columnas)
}

// Valores y vectores propios de una matriz simétrica 3×3 (método de Jacobi).
export function propios3(A) {
  const a = A.map((f) => f.slice());
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let barrido = 0; barrido < 30; barrido++) {
    let fuera = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) fuera += a[p][q] * a[p][q];
    if (fuera < 1e-22) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      const c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  return { valores: [a[0][0], a[1][1], a[2][2]], vectores: [0, 1, 2].map((i) => new THREE.Vector3(V[0][i], V[1][i], V[2][i])) };
}

// J·Jᵀ (3×3) a partir de las columnas de J.
export function JJt(J) {
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => J.reduce((s, col) => s + col.getComponent(r) * col.getComponent(c), 0)));
}

// ------------------------------------------------------------ tornillos (Lynch y Park, cap. 3)
const hat = (w) => new THREE.Matrix3().set(0, -w.z, w.y, w.z, 0, -w.x, -w.y, w.x, 0);

// e^{[S]θ} para el tornillo S = (ω, v); ω unitario o nulo (traslación pura).
export function expTornillo(w, v, th) {
  const T = new THREE.Matrix4();
  if (w.lengthSq() < 1e-12) { T.makeTranslation(v.x * th, v.y * th, v.z * th); return T; }
  const R = new THREE.Matrix4().makeRotationAxis(w.clone().normalize(), th);
  // G(θ) v = (Iθ + (1 − cos θ)[ω] + (θ − sin θ)[ω]²) v
  const W = hat(w), W2 = W.clone().multiply(W);
  const Gv = v.clone().multiplyScalar(th)
    .add(v.clone().applyMatrix3(W).multiplyScalar(1 - Math.cos(th)))
    .add(v.clone().applyMatrix3(W2).multiplyScalar(th - Math.sin(th)));
  T.copy(R).setPosition(Gv);
  return T;
}

// Logaritmo de una transformación: tornillo (ω, v) y ángulo θ (o distancia si es traslación pura).
export function logTornillo(T) {
  const R = new THREE.Matrix4().extractRotation(T);
  const p = new THREE.Vector3().setFromMatrixPosition(T);
  const q = new THREE.Quaternion().setFromRotationMatrix(R);
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const th = 2 * Math.acos(Math.min(1, q.w));
  if (th < 1e-7) { const d = p.length(); return { w: new THREE.Vector3(), v: d > 0 ? p.clone().divideScalar(d) : new THREE.Vector3(), th: d }; }
  const w = new THREE.Vector3(q.x, q.y, q.z).normalize();
  // v = G⁻¹(θ) p = (I/θ − [ω]/2 + (1/θ − cot(θ/2)/2)[ω]²) p
  const W = hat(w), W2 = W.clone().multiply(W);
  const v = p.clone().divideScalar(th)
    .sub(p.clone().applyMatrix3(W).multiplyScalar(0.5))
    .add(p.clone().applyMatrix3(W2).multiplyScalar(1 / th - 0.5 / Math.tan(th / 2)));
  return { w, v, th };
}

// Cuaternión dual (parte real r, parte dual d = ½ t r) de una transformación.
export function cuaternionDual(T) {
  const r = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(T));
  const t = new THREE.Vector3().setFromMatrixPosition(T);
  const tq = new THREE.Quaternion(t.x, t.y, t.z, 0);
  const d = tq.multiply(r);
  return { r, d: new THREE.Quaternion(d.x / 2, d.y / 2, d.z / 2, d.w / 2) };
}
