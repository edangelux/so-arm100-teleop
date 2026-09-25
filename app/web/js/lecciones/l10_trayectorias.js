// Lección 10: planificación de trayectorias. Perfiles de velocidad,
// movimiento articular contra cartesiano y zonas de aproximación.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, grafica, lectura, botones, linea, esfera, GRADO, grados } from './comun.js';
import { Planificador, muestrear } from '../programa/movimiento.js';

// Perfiles de una articulación que recorre D radianes. Devuelven muestras [t, pos, vel, acel].
function trapecio(D, vmax, amax) {
  let ta = vmax / amax, tv = D / vmax - ta;
  if (tv < 0) { ta = Math.sqrt(D / amax); tv = 0; vmax = amax * ta; }
  const T = 2 * ta + tv, out = [];
  for (let k = 0; k <= 300; k++) {
    const t = (T * k) / 300;
    let p, v, a;
    if (t < ta) { a = amax; v = amax * t; p = 0.5 * amax * t * t; }
    else if (t < ta + tv) { a = 0; v = vmax; p = 0.5 * amax * ta * ta + vmax * (t - ta); }
    else { const u = T - t; a = -amax; v = amax * u; p = D - 0.5 * amax * u * u; }
    out.push([t, p, v, a]);
  }
  return out;
}

// Curva S: la aceleración del trapecio suavizada con una ventana de ancho tj
// (limita el tirón a amax/tj). La distancia no cambia; el tiempo crece en tj.
function curvaS(D, vmax, amax, tj) {
  const base = trapecio(D, vmax, amax);
  const T = base[base.length - 1][0] + tj, n = 600, dt = T / n;
  const acelBase = (t) => { if (t < 0 || t > base[base.length - 1][0]) return 0; const i = Math.min(base.length - 1, Math.round((t / base[base.length - 1][0]) * 300)); return base[i][3]; };
  const out = [];
  let v = 0, p = 0;
  for (let k = 0; k <= n; k++) {
    const t = k * dt;
    let s = 0; const m = 20;
    for (let j = 0; j < m; j++) s += acelBase(t - (j / m) * tj);
    const a = s / m;
    out.push([t, p, v, a]);
    v += a * dt; p += v * dt;
  }
  return out;
}

function quintico(D, T) {
  const out = [];
  for (let k = 0; k <= 300; k++) {
    const t = (T * k) / 300, s = t / T;
    out.push([t, D * (10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5), (D / T) * (30 * s ** 2 - 60 * s ** 3 + 30 * s ** 4), (D / T ** 2) * (60 * s - 180 * s ** 2 + 120 * s ** 3)]);
  }
  return out;
}

export default {
  titulo: 'Planificación de trayectorias',
  resumen: 'No basta con saber adónde ir: hay que decidir cómo acelerar, por qué camino y cuándo detenerse. De eso dependen el tiempo de ciclo, las vibraciones y el desgaste.',
  conceptos: [
    ['Camino y trayectoria', 'El camino es la curva geométrica; la trayectoria es el camino con tiempos: dónde está el robot en cada instante.'],
    ['Perfil trapezoidal', 'Acelera con aceleración constante, crucero a velocidad constante y frena. La aceleración salta: tirón infinito.'],
    ['Curva S', 'Limita también el tirón (derivada de la aceleración). Movimiento más suave, un poco más lento.'],
    ['Polinomio quíntico', '$q(t)$ de grado 5 con posición, velocidad y aceleración nulas al inicio y al final.'],
    ['Movimiento articular (PTP) y cartesiano (LIN)', 'En PTP cada articulación interpola su ángulo; en LIN la punta sigue una recta y hay que resolver la inversa en cada punto.'],
    ['Zona de aproximación', 'Distancia a un punto intermedio a partir de la cual el robot empieza a girar hacia el siguiente, sin detenerse.'],
  ],
  referencias: [
    'Biagiotti, L. y Melchiorri, C. (2008). <i>Trajectory Planning for Automatic Machines and Robots</i>, Springer.',
    'app/web/js/programa/movimiento.js: el planificador de la pestaña Programar (perfil con límites de velocidad y aceleración, zonas por Bézier).',
  ],
  pasos: [
    {
      titulo: 'Tres maneras de ir de A a B',
      texto: 'El codo gira 90°. Elija un perfil y compare las curvas de <b style="color:#c2ef4e">posición</b>, <b style="color:#ffb287">velocidad</b> y <b style="color:#fd44b0">aceleración</b>. El punto blanco marca el instante del robot.',
      ancho: true,
      preparar(app, cuerpo) {
        const D = Math.PI / 2, vmax = 1.2, amax = 3;
        const perfiles = { Trapezoidal: trapecio(D, vmax, amax), 'Curva S': curvaS(D, vmax, amax, 0.35), Quíntico: quintico(D, 2.2) };
        let actual = 'Trapezoidal';
        const gP = grafica({ ancho: 620, alto: 110, x: [0, 2.6], y: [0, 1.6], yEtq: 'posición (rad)' });
        const gV = grafica({ ancho: 620, alto: 110, x: [0, 2.6], y: [0, 1.4], yEtq: 'velocidad (rad/s)' });
        const gA = grafica({ ancho: 620, alto: 120, x: [0, 2.6], y: [-3.5, 3.5], yEtq: 'aceleración (rad/s²)', xEtq: 'tiempo (s)' });
        const lec = lectura();
        const q = [0, 0.2, -0.785, 0.4, 0, 0.5];
        app.escena.resaltar('Elbow');
        cuerpo.append(botones(...Object.keys(perfiles).map((k) => [k, () => { actual = k; }])), gP, gV, gA, lec);
        return animar((t) => {
          const P = perfiles[actual];
          const T = P[P.length - 1][0];
          const tt = t % (T + 0.8);
          const m = P.reduce((best, x) => (Math.abs(x[0] - tt) < Math.abs(best[0] - tt) ? x : best), P[0]);
          const f = tt > T ? P[P.length - 1] : m;
          q[2] = -0.785 + f[1];
          app.escena.fijarPostura(q);
          app.escena.resaltar('Elbow');
          gP.dibujar([{ color: '#c2ef4e', puntos: P.map((x) => [x[0], x[1]]), marca: [f[0], f[1]] }]);
          gV.dibujar([{ color: '#ffb287', puntos: P.map((x) => [x[0], x[2]]), marca: [f[0], f[2]] }]);
          gA.dibujar([{ color: '#fd44b0', puntos: P.map((x) => [x[0], x[3]]), marca: [f[0], f[3]] }]);
          lec.textContent = `${actual}: duración ${T.toFixed(2)} s   velocidad máx ${Math.max(...P.map((x) => x[2])).toFixed(2)} rad/s   aceleración máx ${Math.max(...P.map((x) => Math.abs(x[3]))).toFixed(2)} rad/s²`;
        });
      },
      detalle: `<p>Un movimiento entre dos posturas necesita un <b>perfil de tiempo</b>. Los tres clásicos:</p>
<h4>Trapezoidal</h4>
<p>Tres tramos: aceleración constante $a_{max}$, velocidad de crucero $v_{max}$, frenado $-a_{max}$. La velocidad tiene forma de trapecio (o triángulo si la distancia es corta). Es el más rápido con esos dos límites, pero la <b>aceleración salta</b> de golpe: el tirón (<i>jerk</i>) es infinito en cuatro instantes, y eso excita vibraciones en la estructura y en la carga.</p>
<h4>Curva S</h4>
<p>Añade un límite al tirón $j_{max}$: la aceleración sube y baja en rampa, y la velocidad tiene forma de S en los cambios. Es el perfil habitual en máquinas herramienta y robots industriales. Aquí se construye suavizando la aceleración del trapecio con una ventana de 0,35 s, lo que equivale a un tirón máximo $a_{max}/0{,}35$.</p>
<h4>Polinomio quíntico</h4>
$$q(t) = q_0 + \\Delta q\\,(10 s^3 - 15 s^4 + 6 s^5), \\qquad s = t/T$$
<p>Es el polinomio de menor grado con posición, velocidad y aceleración fijadas en los dos extremos (6 condiciones → grado 5). Su aceleración es continua y no hay tramo de crucero: fácil de calcular, pero no aprovecha los límites del motor.</p>
<p>El brazo real no ve directamente estas curvas: el <code>JointTrajectoryController</code> de ros2_control recibe puntos con tiempos y los interpola con splines (cúbicas si llegan velocidades, quínticas si llegan también aceleraciones).</p>`,
    },
    {
      titulo: 'MoveJ contra MoveL',
      texto: 'Mismo inicio, mismo final. Con <b style="color:#a597ff">MoveJ</b> cada articulación interpola su ángulo y la punta hace una curva; con <b style="color:#c2ef4e">MoveL</b> la punta va en línea recta. Pulse cada botón.',
      preparar(app, cuerpo) {
        const plan = new Planificador(app.cadena);
        const a = { tipo: 'cart', p: [-150, -200, 120], cab: -60, giro: 0 }, b = { tipo: 'cart', p: [150, -200, 120], cab: -60, giro: 0 };
        const q0 = plan.articulacionesDe(a, [0, 0, 0, 0, 0], 0);
        const tJ = plan.planificar([{ instr: 'MoveJ', destino: b, vel: 300, zona: 0, linea: 1 }], q0);
        const tL = plan.planificar([{ instr: 'MoveL', destino: b, vel: 150, zona: 0, linea: 1 }], q0);
        linea(app, tJ.p, 0xa597ff);
        linea(app, tL.p, 0xc2ef4e);
        esfera(app, tJ.p[0], 0.01, 0xffffff, 1); esfera(app, tJ.p[tJ.p.length - 1], 0.01, 0xffffff, 1);
        const lec = lectura(`MoveJ: ${tJ.duracion.toFixed(2)} s, la punta recorre ${(tJ.largo * 1000).toFixed(0)} mm\nMoveL: ${tL.duracion.toFixed(2)} s, la punta recorre ${(tL.largo * 1000).toFixed(0)} mm (la recta mide 300 mm)`);
        let tr = null, t0 = 0;
        const correr = (x) => { tr = x; t0 = performance.now(); };
        cuerpo.append(botones(['Ejecutar MoveJ', () => correr(tJ)], ['Ejecutar MoveL', () => correr(tL)]), lectura('En Programar: MoveJ p2, v300, fine;  /  MoveL p2, v150, fine;'), lec);
        app.escena.fijarPostura([...q0, 0, 0.5]);
        return animar(() => {
          if (!tr) return;
          const t = (performance.now() - t0) / 1000;
          app.escena.fijarPostura([...muestrear(tr, t).q, 0.5]);
          if (t > tr.duracion + 0.8) app.escena.fijarPostura([...q0, 0, 0.5]), tr = null;
        });
      },
      detalle: `<p>Los robots industriales ofrecen dos tipos básicos de movimiento:</p>
<table><tr><th></th><th>Articular (PTP, MoveJ)</th><th>Cartesiano (LIN, MoveL)</th></tr>
<tr><td>Qué interpola</td><td>los ángulos de cada articulación</td><td>la posición y orientación de la punta</td></tr>
<tr><td>Camino de la punta</td><td>una curva que depende de la postura</td><td>una línea recta</td></tr>
<tr><td>Cálculo</td><td>sencillo; la inversa sólo en el destino</td><td>la inversa en cada punto del camino</td></tr>
<tr><td>Singularidades</td><td>no le afectan</td><td>pueden detenerlo</td></tr>
<tr><td>Uso</td><td>desplazamientos en el aire, rápidos</td><td>acercarse a la pieza, soldar, pegar, dibujar</td></tr></table>
<p>La regla práctica en una celda: <b>MoveJ para llegar cerca, MoveL para el último tramo</b>. Es exactamente el patrón del ejemplo «Tomar y colocar» de la pestaña Programar: <code>MoveJ</code> a un punto de aproximación encima de la pieza y <code>MoveL</code> para bajar.</p>
<p>Con MoveJ, cada articulación arranca y termina a la vez (movimiento <b>sincronizado</b>): la que tiene que girar más fija el tiempo y las demás se ajustan. Así el movimiento es suave y la duración mínima.</p>`,
    },
    {
      titulo: 'Zonas: detenerse o redondear',
      texto: 'Un cuadrado dibujado dos veces. En <b style="color:#fd44b0">fine</b> el robot se detiene en cada esquina; con <b style="color:#c2ef4e">z20</b> empieza a girar 20 mm antes y no se detiene. Compare los tiempos.',
      preparar(app, cuerpo) {
        const plan = new Planificador(app.cadena);
        const a = [-50, -160, 80];
        const pts = [[100, 0], [100, -100], [0, -100], [0, 0]].map(([dx, dy]) => ({ tipo: 'cart', p: [a[0] + dx, a[1] + dy, a[2]], cab: -90, giro: 0 }));
        const q0 = plan.articulacionesDe({ tipo: 'cart', p: a, cab: -90, giro: 0 }, [0, 0, 0, 0, 0], 0);
        const tf = plan.planificar(pts.map((d, i) => ({ instr: 'MoveL', destino: d, vel: 100, zona: 0, linea: i + 1 })), q0);
        const tz = plan.planificar(pts.map((d, i) => ({ instr: 'MoveL', destino: d, vel: 100, zona: i < 3 ? 20 : 0, linea: i + 1 })), q0);
        linea(app, tf.p, 0xfd44b0);
        linea(app, tz.p.map((p) => p.clone().add(new THREE.Vector3(0, 0, 0.002))), 0xc2ef4e);
        const gv = grafica({ ancho: 560, alto: 150, x: [0, Math.max(tf.duracion, tz.duracion)], y: [0, 0.12], xEtq: 'tiempo (s)', yEtq: 'velocidad de la punta (m/s)' });
        gv.dibujar([{ color: '#fd44b0', puntos: tf.t.map((t, i) => [t, tf.v[i]]) }, { color: '#c2ef4e', puntos: tz.t.map((t, i) => [t, tz.v[i]]) }]);
        let tr = tf, t0 = performance.now();
        cuerpo.append(gv, lectura(`fine: ${tf.duracion.toFixed(2)} s   ·   z20: ${tz.duracion.toFixed(2)} s   (${(100 * (1 - tz.duracion / tf.duracion)).toFixed(0)} % menos)`),
          botones(['Ver fine', () => { tr = tf; t0 = performance.now(); }], ['Ver z20', () => { tr = tz; t0 = performance.now(); }]));
        return animar(() => {
          const t = ((performance.now() - t0) / 1000) % (tr.duracion + 0.6);
          app.escena.fijarPostura([...muestrear(tr, t).q, 0.5]);
        });
      },
      detalle: `<p>En un programa, cada punto puede ser un <b>punto de paso</b> o un <b>punto de parada</b>:</p>
<ul><li><code>fine</code>: el robot llega exactamente al punto, con velocidad cero, antes de seguir. Obligatorio donde hay que tomar o soltar una pieza.</li>
<li><code>zN</code> (zona de N mm): cuando la punta entra en una esfera de N mm alrededor del punto, el robot ya empieza a ir hacia el siguiente. La esquina se redondea y la velocidad no cae a cero.</li></ul>
<p>La gráfica muestra el efecto: con <code>fine</code> la velocidad baja a cero cuatro veces; con <code>z20</code> sólo baja un poco en cada esquina. El tiempo de ciclo baja y el movimiento castiga menos a la mecánica.</p>
<p>Cómo lo hace el planificador de esta aplicación (<code>movimiento.js</code>):</p>
<ol><li>calcula el camino de cada instrucción (curva en MoveJ, recta en MoveL, arco en MoveC),</li>
<li>en cada esquina con zona reemplaza los últimos y primeros milímetros por una <b>curva de Bézier</b> en el espacio articular,</li>
<li>asigna velocidades recorriendo el camino hacia adelante y hacia atrás, respetando la velocidad pedida, 1,5 rad/s por articulación y una aceleración máxima, y parando en los puntos <code>fine</code>.</li></ol>
<p>El paso 3 es la idea de los controladores numéricos con «mirar adelante» (<i>look-ahead</i>): conocer las esquinas que vienen para frenar a tiempo.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Un robot debe acercarse a una pieza desde 60 mm arriba y tomarla. ¿Qué combinación es la habitual?',
        opciones: ['MoveL al punto de aproximación y MoveJ para bajar', 'MoveJ al punto de aproximación y MoveL para bajar, con fine en la pieza', 'Todo con MoveJ y z50', 'Todo con MoveL y z50'],
        correcta: 1,
        explicacion: 'MoveJ es rápido para el desplazamiento en el aire; MoveL garantiza bajar en recta sin golpear la pieza de lado; y fine asegura que la pinza está quieta y en su sitio al cerrarse.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, 0.3, 0.9, 0, 0.5]); },
    },
    {
      titulo: 'El tirón',
      texto: 'Última.',
      pregunta: {
        enunciado: '¿Qué limita la <b>curva S</b> que el trapecio no limita?',
        opciones: ['La velocidad', 'La aceleración', 'El tirón (derivada de la aceleración)', 'La distancia'],
        correcta: 2,
        explicacion: 'El trapecio limita velocidad y aceleración, pero su aceleración salta de golpe. La curva S añade un límite al tirón, y por eso vibra menos.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, 0.3, 0.9, 0, 0.5]); },
    },
  ],
};
