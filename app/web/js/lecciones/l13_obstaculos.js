// Lección 13: planificación con obstáculos. Detección de colisiones,
// espacio de configuraciones y RRT sobre un corte de 2 dimensiones.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, caja, lectura, botones, linea, esfera, grados } from './comun.js';

const Q3 = -0.11, Q4 = 1.2;                                  // codo y muñeca fijos en este corte
const CAJA = { c: new THREE.Vector3(0.0, -0.29, 0.05), m: new THREE.Vector3(0.04, 0.05, 0.05) };   // centro y semimedidas (m)
const RADIO = 0.018;                                        // grosor de los eslabones
const INICIO = [-1.1, 0.3], META = [1.1, 0.3];            // (q1 base, q2 hombro)
const LIM = { q1: [-1.9, 1.9], q2: [-1.2, 1.2] };

const postura = (a, b) => [a, b, Q3, Q4, 0, 0.5];

// Puntos a lo largo del esqueleto del brazo.
function esqueleto(app, q) {
  const f = app.cadena.fk(q);
  const P = ['Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'efector'].map((n) => new THREE.Vector3().setFromMatrixPosition(f[n]));
  const pts = [];
  for (let i = 0; i < P.length - 1; i++) for (let k = 0; k <= 8; k++) pts.push(P[i].clone().lerp(P[i + 1], k / 8));
  return pts;
}

function distanciaCaja(p) {
  const d = new THREE.Vector3(Math.max(Math.abs(p.x - CAJA.c.x) - CAJA.m.x, 0), Math.max(Math.abs(p.y - CAJA.c.y) - CAJA.m.y, 0), Math.max(Math.abs(p.z - CAJA.c.z) - CAJA.m.z, 0));
  return d.length();
}

function choca(app, q) {
  const pts = esqueleto(app, q);
  return pts.some((p) => distanciaCaja(p) < RADIO || p.z < 0.005);
}

function segmentoLibre(app, a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.03);
  for (let k = 1; k <= n; k++) if (choca(app, postura(a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n)))) return false;
  return true;
}

function mapaC(app, W, H) {
  const libre = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const q1 = LIM.q1[0] + ((i + 0.5) / W) * (LIM.q1[1] - LIM.q1[0]);
    const q2 = LIM.q2[1] - ((j + 0.5) / H) * (LIM.q2[1] - LIM.q2[0]);
    libre.push(!choca(app, postura(q1, q2)));
  }
  return libre;
}

// Lienzo del espacio de configuraciones: eje x = base, eje y = hombro.
function lienzo(app, alClic) {
  const W = 96, H = 64, esc = 5;
  const c = el('canvas', { width: W * esc, height: H * esc, class: 'figura-leccion', style: 'cursor:crosshair;image-rendering:pixelated' });
  const libre = mapaC(app, W, H);
  const ctx = c.getContext('2d');
  const aPix = ([a, b]) => [((a - LIM.q1[0]) / (LIM.q1[1] - LIM.q1[0])) * W * esc, ((LIM.q2[1] - b) / (LIM.q2[1] - LIM.q2[0])) * H * esc];
  const deqPix = (x, y) => [LIM.q1[0] + (x / (W * esc)) * (LIM.q1[1] - LIM.q1[0]), LIM.q2[1] - (y / (H * esc)) * (LIM.q2[1] - LIM.q2[0])];
  c.dibujar = ({ arbol = [], camino = [], actual = null } = {}) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { ctx.fillStyle = libre[j * W + i] ? '#1f1633' : '#fd44b0'; ctx.fillRect(i * esc, j * esc, esc, esc); }
    ctx.strokeStyle = 'rgba(117,83,255,0.9)'; ctx.lineWidth = 1;
    for (const [a, b] of arbol) { const p = aPix(a), q = aPix(b); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
    if (camino.length) { ctx.strokeStyle = '#c2ef4e'; ctx.lineWidth = 3; ctx.beginPath(); camino.forEach((p, k) => (k ? ctx.lineTo(...aPix(p)) : ctx.moveTo(...aPix(p)))); ctx.stroke(); }
    for (const [p, col] of [[INICIO, '#ffffff'], [META, '#c2ef4e']]) { const [x, y] = aPix(p); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); }
    if (actual) { const [x, y] = aPix(actual); ctx.strokeStyle = '#ffb287'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#bdb8c0'; ctx.font = '12px Rubik, sans-serif';
    ctx.fillText('giro de la base q₁ →', W * esc - 130, H * esc - 8);
    ctx.fillText('↑ hombro q₂', 6, 16);
  };
  c.addEventListener('pointerdown', (ev) => { const r = c.getBoundingClientRect(); alClic?.(deqPix((ev.clientX - r.left) * (c.width / r.width), (ev.clientY - r.top) * (c.height / r.height))); });
  return c;
}

function rrt(app, { pasoMax = 0.12, iter = 4000 } = {}) {
  const nodos = [{ q: INICIO, padre: -1 }];
  const aristas = [];
  for (let k = 0; k < iter; k++) {
    const muestra = Math.random() < 0.1 ? META : [LIM.q1[0] + Math.random() * (LIM.q1[1] - LIM.q1[0]), LIM.q2[0] + Math.random() * (LIM.q2[1] - LIM.q2[0])];
    let mejor = 0, dmin = Infinity;
    nodos.forEach((n, i) => { const d = Math.hypot(n.q[0] - muestra[0], n.q[1] - muestra[1]); if (d < dmin) { dmin = d; mejor = i; } });
    const desde = nodos[mejor].q;
    const s = Math.min(1, pasoMax / (dmin || 1));
    const nuevo = [desde[0] + (muestra[0] - desde[0]) * s, desde[1] + (muestra[1] - desde[1]) * s];
    if (!segmentoLibre(app, desde, nuevo)) continue;
    nodos.push({ q: nuevo, padre: mejor });
    aristas.push([desde, nuevo]);
    if (Math.hypot(nuevo[0] - META[0], nuevo[1] - META[1]) < pasoMax && segmentoLibre(app, nuevo, META)) {
      nodos.push({ q: META, padre: nodos.length - 1 });
      aristas.push([nuevo, META]);
      const camino = [];
      for (let i = nodos.length - 1; i >= 0; i = nodos[i].padre) camino.unshift(nodos[i].q);
      return { aristas, camino, iteraciones: k + 1, nodos: nodos.length };
    }
  }
  return { aristas, camino: [], iteraciones: iter, nodos: nodos.length };
}

// Atajos: si dos puntos del camino se ven sin chocar, se eliminan los intermedios.
function suavizar(app, camino) {
  const c = camino.slice();
  for (let k = 0; k < 120 && c.length > 2; k++) {
    const i = Math.floor(Math.random() * (c.length - 2)), j = i + 2 + Math.floor(Math.random() * (c.length - i - 2));
    if (segmentoLibre(app, c[i], c[j])) c.splice(i + 1, j - i - 1);
  }
  return c;
}

export default {
  titulo: 'Planificación con obstáculos',
  resumen: 'Cómo encuentra un robot un camino que no choque: detección de colisiones, el espacio de configuraciones y los planificadores por muestreo como RRT, que usa MoveIt.',
  conceptos: [
    ['Espacio de configuraciones (C)', 'El espacio de todas las posturas posibles: un punto por cada combinación de ángulos. Los obstáculos del mundo se vuelven regiones prohibidas de C.'],
    ['Detección de colisiones', 'Comprobar si alguna parte del robot toca un obstáculo en una postura. Se hace con formas simples: cápsulas, cajas, mallas convexas.'],
    ['RRT', '<i>Rapidly-exploring Random Tree</i>: un árbol que crece hacia muestras al azar hasta alcanzar la meta.'],
    ['Completitud probabilística', 'Si existe un camino, la probabilidad de que RRT lo encuentre tiende a 1 con suficientes muestras.'],
    ['MoveIt', 'El marco de planificación de ROS: usa OMPL (RRT y otros), comprueba colisiones con FCL y respeta los límites del robot.'],
  ],
  referencias: [
    'LaValle, S. M. (2006). <i>Planning Algorithms</i>, Cambridge University Press (libre acceso en línea).',
    'Kuffner, J. y LaValle, S. (2000). «RRT-Connect: an efficient approach to single-query path planning».',
    'docs/15 del repositorio: configuración de MoveIt 2 para el SO-ARM100.',
  ],
  pasos: [
    {
      titulo: 'Un obstáculo en el camino',
      texto: 'Hay que llevar la pinza de la izquierda a la derecha. Si sólo se gira la base, el brazo <b>atraviesa la caja</b>. Pulse <b>Intentar</b>.',
      preparar(app, cuerpo) {
        caja(app, CAJA.c, CAJA.m.toArray().map((v) => v * 2), 0xfd44b0, 0.55);
        const q = postura(...INICIO);
        app.escena.fijarPostura(q);
        const lec = lectura('Listo.');
        let t0 = null;
        const marca = esfera(app, new THREE.Vector3(), 0.012, 0xfd44b0, 0);
        cuerpo.append(lec, botones(['Intentar', () => { t0 = performance.now(); marca.material.opacity = 0; }]));
        return animar(() => {
          if (t0 === null) return;
          const s = Math.min(1, (performance.now() - t0) / 3000);
          const qq = postura(INICIO[0] + (META[0] - INICIO[0]) * s, INICIO[1]);
          app.escena.fijarPostura(qq);
          const pts = esqueleto(app, qq);
          const p = pts.find((x) => distanciaCaja(x) < RADIO);
          if (p) { marca.position.copy(p); marca.material.opacity = 0.9; lec.textContent = `¡Choque! Base en ${grados(qq[0]).toFixed(0)}°`; t0 = null; }
          else lec.textContent = `Base en ${grados(qq[0]).toFixed(0)}°: sin choque`;
        });
      },
      detalle: `<p>Un planificador necesita responder rápido una pregunta muy repetida: <b>en esta postura, ¿el robot toca algo?</b> Para eso se aproximan robot y obstáculos con formas sencillas.</p>
<p>En esta lección cada eslabón es una <b>cápsula</b> (un segmento con radio de 18 mm) que va de una articulación a la siguiente, y el obstáculo es una caja alineada con los ejes. Comprobar el choque es calcular la distancia de puntos del segmento a la caja:</p>
$$d(p, \\text{caja}) = \\big\\|\\max(|p - c| - m,\\; 0)\\big\\|$$
<p>con $c$ el centro y $m$ las semimedidas de la caja, componente a componente. Si la distancia es menor que el radio, hay choque. También cuenta como choque que el brazo toque la mesa.</p>
<p>MoveIt usa la biblioteca <b>FCL</b> con las mallas de colisión del URDF (etiquetas <code>&lt;collision&gt;</code>, que en el SO-ARM100 son las mismas mallas reducidas al 90 %) y comprueba también las colisiones del robot consigo mismo.</p>`,
    },
    {
      titulo: 'El espacio de configuraciones',
      texto: 'Cada punto del mapa es una postura: <b>base</b> en horizontal, <b>hombro</b> en vertical (codo y muñeca fijos). Las zonas fucsia son posturas que chocan. Haga clic en el mapa para mover el robot.',
      ancho: true,
      preparar(app, cuerpo) {
        caja(app, CAJA.c, CAJA.m.toArray().map((v) => v * 2), 0xfd44b0, 0.55);
        let actual = INICIO.slice();
        const lec = lectura();
        const c = lienzo(app, (p) => { actual = p; mover(); });
        const mover = () => {
          app.escena.fijarPostura(postura(...actual));
          c.dibujar({ actual });
          lec.textContent = `base ${grados(actual[0]).toFixed(0)}°  hombro ${grados(actual[1]).toFixed(0)}°  →  ${choca(app, postura(...actual)) ? 'CHOCA' : 'libre'}`;
        };
        cuerpo.append(c, lec);
        mover();
      },
      detalle: `<p>El truco de la planificación de movimiento es cambiar de espacio. En lugar de pensar en un brazo que se mueve entre obstáculos, se piensa en un <b>punto</b> que se mueve en el <b>espacio de configuraciones</b> $\\mathcal{C}$: el espacio de todas las combinaciones de ángulos.</p>
<ul><li>Cada postura del robot es un punto de $\\mathcal{C}$.</li>
<li>Cada obstáculo del mundo real se convierte en una región prohibida $\\mathcal{C}_{obs}$: las posturas en las que algo choca.</li>
<li>Planificar es encontrar una curva dentro de $\\mathcal{C}_{libre} = \\mathcal{C} \\setminus \\mathcal{C}_{obs}$ que una la postura inicial con la final.</li></ul>
<p>Aquí se muestra un <b>corte de 2 dimensiones</b> (base y hombro; codo y muñeca fijos) para poder dibujarlo. El espacio completo del SO-ARM100 tiene 5 dimensiones. Calcular el mapa completo sería inviable: con 100 valores por articulación serían $100^5 = 10^{10}$ comprobaciones. Por eso los planificadores reales no construyen el mapa: lo exploran por muestreo.</p>
<p>Observe la forma de la región prohibida: una caja pequeña en el mundo produce una mancha grande y curva en $\\mathcal{C}$, porque muchas posturas distintas llevan alguna parte del brazo a tocarla.</p>`,
    },
    {
      titulo: 'RRT: un árbol que explora',
      texto: 'Pulse <b>Planificar</b>. El árbol violeta crece desde el inicio hacia muestras al azar, sin entrar en las zonas fucsia, hasta tocar la meta. Luego se <b>acorta</b> el camino y el robot lo recorre.',
      ancho: true,
      preparar(app, cuerpo) {
        caja(app, CAJA.c, CAJA.m.toArray().map((v) => v * 2), 0xfd44b0, 0.55);
        app.escena.fijarPostura(postura(...INICIO));
        const c = lienzo(app);
        c.dibujar();
        const lec = lectura('Listo.');
        let vivo = true, recorrido = null, t0 = 0;
        const rastro = linea(app, [new THREE.Vector3(), new THREE.Vector3()], 0xc2ef4e);
        const planificar = async () => {
          const r = rrt(app);
          if (!r.camino.length) { lec.textContent = `No se encontró camino en ${r.iteraciones} iteraciones. Pruebe otra vez.`; return; }
          for (let k = 0; k <= r.aristas.length && vivo; k += 25) { c.dibujar({ arbol: r.aristas.slice(0, k) }); lec.textContent = `árbol: ${Math.min(k, r.aristas.length)} ramas`; await new Promise((x) => setTimeout(x, 16)); }
          const corto = suavizar(app, r.camino);
          c.dibujar({ arbol: r.aristas, camino: corto });
          lec.textContent = `${r.nodos} nodos en ${r.iteraciones} iteraciones · camino de ${r.camino.length} puntos, acortado a ${corto.length}`;
          // Camino denso para animar.
          const denso = [];
          for (let i = 0; i < corto.length - 1; i++) for (let k = 0; k < 20; k++) denso.push([corto[i][0] + (corto[i + 1][0] - corto[i][0]) * (k / 20), corto[i][1] + (corto[i + 1][1] - corto[i][1]) * (k / 20)]);
          denso.push(META);
          rastro.fijar(denso.map((p) => app.cadena.efector(postura(...p))));
          recorrido = denso; t0 = performance.now();
        };
        cuerpo.append(c, lec, botones(['Planificar', planificar]));
        const parar = animar(() => {
          if (!recorrido) return;
          const k = Math.floor(((performance.now() - t0) / 20) % (recorrido.length + 60));
          const p = recorrido[Math.min(k, recorrido.length - 1)];
          app.escena.fijarPostura(postura(...p));
          c.dibujar({ camino: recorrido, actual: p });
        });
        return () => { vivo = false; parar(); };
      },
      detalle: `<p><b>RRT</b> (LaValle, 1998) resuelve la planificación sin construir el mapa de $\\mathcal{C}$:</p>
<ol><li>Tomar una postura al azar $q_{rand}$ (a veces, la meta directamente, para acelerar).</li>
<li>Buscar el nodo del árbol más cercano, $q_{near}$.</li>
<li>Avanzar desde $q_{near}$ hacia $q_{rand}$ un paso de longitud máxima fija; llamar al resultado $q_{new}$.</li>
<li>Si el tramo $q_{near} \\to q_{new}$ no choca (se comprueba en varios puntos intermedios), agregar $q_{new}$ al árbol.</li>
<li>Repetir hasta que un nodo pueda conectarse con la meta.</li></ol>
<p>Las muestras al azar hacen que el árbol se extienda sobre todo hacia las zonas vacías y aún no exploradas (sesgo de Voronoi). RRT es <b>probabilísticamente completo</b>: si hay un camino, lo encuentra con probabilidad que tiende a 1. Pero el camino que da es quebrado y largo; por eso siempre se <b>acorta</b> después (aquí, uniendo puntos que se ven sin chocar).</p>
<p>Variantes que se usan en la práctica: <b>RRT-Connect</b> (dos árboles, uno desde cada extremo; es el planificador por omisión de MoveIt), <b>RRT*</b> (converge al camino más corto) y <b>PRM</b> (construye un grafo reutilizable para muchas consultas).</p>`,
    },
    {
      titulo: 'Así lo hace MoveIt',
      texto: 'En este proyecto, MoveIt 2 planifica para el SO-ARM100 (docs/15). Pida un destino y MoveIt corre un planificador de OMPL, comprueba colisiones con las mallas del URDF y entrega la trayectoria al controlador.',
      preparar(app, cuerpo) {
        app.escena.fijarPostura([0.4, 0.2, 0.2, 0.9, 0, 0.5]);
        cuerpo.append(el('div', { class: 'texto-largo', html: `<table><tr><th>Etapa</th><th>Quién la hace</th></tr>
<tr><td>Recibir el destino (postura o pose)</td><td>RViz o un programa, por <code>move_group</code></td></tr>
<tr><td>Cinemática inversa si el destino es una pose</td><td>complemento KDL</td></tr>
<tr><td>Buscar un camino sin choques</td><td>OMPL (RRT-Connect por omisión)</td></tr>
<tr><td>Comprobar colisiones</td><td>FCL con las mallas <code>&lt;collision&gt;</code> y la matriz ACM del SRDF</td></tr>
<tr><td>Dar tiempos al camino</td><td>parametrización temporal con límites de velocidad y aceleración</td></tr>
<tr><td>Ejecutar</td><td>controlador de trayectorias de ros2_control</td></tr></table>` }));
      },
      detalle: `<p><b>MoveIt 2</b> es el marco de manipulación de ROS 2. En este proyecto se abre con <code>teleop</code> y la opción MoveIt (o con la casilla de la sección Sesión), y permite mover el brazo desde RViz arrastrando el marcador interactivo de la pinza.</p>
<p>Piezas que usa:</p>
<ul><li><b>URDF</b>: geometría, límites y mallas de colisión.</li>
<li><b>SRDF</b> (<code>so_arm_100.srdf</code>): grupos de articulaciones (brazo, pinza), posturas con nombre (<code>init</code>, <code>home</code>) y la <b>matriz de colisiones permitidas</b> (ACM), que evita comprobar pares de piezas que nunca pueden chocar, como eslabones vecinos.</li>
<li><b>OMPL</b>: la biblioteca de planificadores por muestreo (RRT, RRT-Connect, PRM, KPIECE…).</li>
<li><b>Planificador Pilz</b>: alternativa determinista que genera movimientos industriales PTP, LIN y CIRC, los mismos de la pestaña Programar.</li></ul>
<p>La diferencia con esta lección es de escala: MoveIt trabaja en las 5 dimensiones del brazo, con mallas reales y con toda la escena (mesa, objetos, la propia pinza), y lo resuelve en décimas de segundo.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: '¿Por qué RRT no calcula primero el mapa completo del espacio de configuraciones?',
        opciones: ['Porque no hace falta: los robots nunca chocan', 'Porque en 5 o 6 dimensiones sería una cantidad enorme de comprobaciones', 'Porque el mapa sólo existe en 2D', 'Porque MoveIt no lo permite'],
        correcta: 1,
        explicacion: 'El número de celdas crece exponencialmente con las dimensiones ($N^d$). Muestrear al azar sólo explora lo necesario para conectar inicio y meta.',
      },
      preparar(app) { app.escena.fijarPostura([0.4, 0.2, 0.2, 0.9, 0, 0.5]); },
    },
  ],
};

