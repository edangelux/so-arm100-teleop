// Lección 16: calibración. Cero de los servos, efecto de un error angular en
// la pinza, calibración del TCP por cuatro puntos y calibración cámara-robot.
import * as THREE from 'three';
import { el } from '../ui.js';
import { deslizador, lectura, botones, linea, esfera, marco, figura, grafica, BRAZO, NOMBRE, GRADO, grados } from './comun.js';
import { resolver } from '../cinematica.js';

const DIENTE = 360 / 25;       // grados por diente del estriado de 25 dientes

const MANO_OJO = `<svg viewBox="0 0 600 190" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
<rect x="20" y="130" width="70" height="40" rx="6" fill="#422082"/><text x="55" y="155" fill="#fff" text-anchor="middle">base</text>
<path d="M55 130 L90 70 L170 50" stroke="#efefef" stroke-width="8" fill="none" stroke-linecap="round"/>
<rect x="165" y="36" width="36" height="26" rx="4" fill="#fd44b0"/><text x="183" y="30" fill="#fd44b0" text-anchor="middle">cámara</text>
<rect x="330" y="120" width="90" height="50" fill="#efefef"/><g fill="#1f1633">${[0, 1, 2, 3, 4].map((i) => [0, 1, 2].map((j) => ((i + j) % 2 ? `<rect x="${330 + i * 18}" y="${120 + j * 16.6}" width="18" height="16.6"/>` : '')).join('')).join('')}</g>
<text x="375" y="186" fill="#bdb8c0" text-anchor="middle">patrón de calibración</text>
<text x="118" y="112" fill="#c2ef4e">A: movimiento de la pinza (cinemática)</text>
<line x1="201" y1="55" x2="330" y2="125" stroke="#ffb287" stroke-dasharray="5 4"/><text x="260" y="78" fill="#ffb287">B: la cámara ve el patrón</text>
<text x="210" y="30" fill="#a597ff">X: pinza → cámara (lo que se busca)</text>
<text x="450" y="60" fill="#fff" font-size="16">A · X = X · B</text>
</svg>`;

export default {
  titulo: 'Calibración',
  resumen: 'Por qué un robot bien construido no llega exactamente donde el modelo dice, y cómo se corrige: ceros de los servos, punto de la herramienta y posición de la cámara.',
  conceptos: [
    ['Calibración cinemática', 'Ajustar los parámetros del modelo (ceros, longitudes, ángulos entre ejes) para que coincidan con el robot real.'],
    ['Cero articular', 'La lectura del codificador que corresponde a 0 en el modelo. En el proyecto, 2048 pasos.'],
    ['Calibración del TCP', 'Medir dónde está la punta de la herramienta respecto de la brida, tocando un mismo punto desde varias orientaciones.'],
    ['Calibración mano-ojo', 'Encontrar la transformación entre la cámara y la pinza (o la base) resolviendo $AX = XB$.'],
    ['Exactitud contra repetibilidad', 'Llegar donde se pidió contra volver siempre al mismo sitio. La calibración mejora la primera; la segunda la fija la mecánica.'],
  ],
  referencias: [
    'Tsai, R. y Lenz, R. (1989). «A new technique for fully autonomous and efficient 3D robotics hand/eye calibration», IEEE T-RA.',
    'Daniilidis, K. (1999). «Hand-eye calibration using dual quaternions», IJRR.',
    'docs/09 del repositorio: el cero de 2048 pasos y cómo se centró cada servo antes de montarlo.',
  ],
  pasos: [
    {
      titulo: 'Un diente de error',
      texto: 'Si un servo se monta con el eje corrido <b>un diente</b> de su estriado (25 dientes: 14,4° por diente), el robot real (sólido) ya no coincide con el modelo (silueta). Elija la articulación y los dientes.',
      preparar(app, cuerpo) {
        const q = [0, 0.3, -0.2, 0.5, 0, 0.5];
        let junta = 1, dientes = 1;
        const lec = lectura();
        const act = () => {
          const real = q.slice(); real[junta] += dientes * DIENTE * GRADO;
          app.escena.fijarFantasma(q);
          app.escena.fijarPostura(real);
          const e = app.cadena.efector(real).distanceTo(app.cadena.efector(q));
          lec.textContent = `${NOMBRE[BRAZO[junta]]} corrido ${dientes} diente(s) = ${(dientes * DIENTE).toFixed(1)}°   →   la punta queda a ${(e * 1000).toFixed(0)} mm de donde el modelo la pone`;
          app.escena.resaltar(BRAZO[junta]);
        };
        cuerpo.append(botones(...BRAZO.slice(0, 4).map((n, i) => [NOMBRE[n], () => { junta = i; act(); }])),
          deslizador('Dientes de error', { min: -2, max: 2, paso: 1, valor: 1, formato: (x) => `${x}`, alCambiar: (x) => { dientes = x; act(); } }), lec);
        act();
        return () => app.escena.fijarFantasma(null);
      },
      detalle: `<p>El eje de salida de un STS3215 tiene un <b>estriado de 25 dientes</b> (25T) en el que encaja la pieza que mueve el eslabón. Si al montarla se desplaza un diente, el eslabón queda girado $360^\\circ/25 = 14{,}4^\\circ$ respecto de lo que cree el controlador. No se puede corregir apretando más: hay que desmontar o corregir el cero en el software.</p>
<p>Por eso el proyecto siguió un procedimiento (docs/09):</p>
<ol><li>Llevar cada servo a <b>2048 pasos</b> (la mitad de su vuelta) con la utilidad de centrado, antes de montarlo.</li>
<li>Montar el eslabón en la postura que el modelo llama cero (<code>init</code>: brazo vertical, antebrazo horizontal).</li>
<li>Verificar: en una sesión registrada, los cinco servos del brazo arrancaron entre 2046 y 2050 pasos, es decir, a menos de 0,2° de su cero.</li></ol>
<p>En la aplicación, el botón <b>Centrar</b> de la sección Sesión hace el paso 1 con los seis servos.</p>`,
    },
    {
      titulo: 'Cuánto se nota un grado',
      texto: 'Agregue pequeños errores de cero a cada articulación. La gráfica muestra el error en la punta para distintas posturas del hombro. La regla: <b>arco = radio × ángulo</b>.',
      ancho: true,
      preparar(app, cuerpo) {
        const err = [0, 1, 0, 0];
        const q = [0, 0, 0, 0, 0, 0.5];
        const g = grafica({ ancho: 600, alto: 170, x: [-60, 60], y: [0, 12], xEtq: 'ángulo del hombro (°)', yEtq: 'error en la punta (mm)' });
        const lec = lectura();
        const act = () => {
          const pts = [];
          for (let a = -60; a <= 60; a += 2) {
            const qm = [0, a * GRADO, -0.3, 0.4, 0, 0];
            const qr = qm.map((v, i) => v + (err[i] ?? 0) * GRADO);
            pts.push([a, app.cadena.efector(qr).distanceTo(app.cadena.efector(qm)) * 1000]);
          }
          g.dibujar([{ color: '#fd44b0', puntos: pts }]);
          const real = q.map((v, i) => v + (err[i] ?? 0) * GRADO);
          app.escena.fijarPostura(real); app.escena.fijarFantasma(q);
          lec.textContent = `en init: ${(app.cadena.efector(real).distanceTo(app.cadena.efector(q)) * 1000).toFixed(1)} mm de error`;
        };
        cuerpo.append(g, lec, ...BRAZO.slice(0, 4).map((n, i) => deslizador(`Error ${NOMBRE[n]}`, { min: -3, max: 3, paso: 0.1, valor: err[i], formato: (x) => `${x.toFixed(1)}°`, alCambiar: (x) => { err[i] = x; act(); } })));
        act();
        return () => app.escena.fijarFantasma(null);
      },
      detalle: `<p>Un error angular $\\Delta\\theta$ en una articulación desplaza la punta un arco de longitud aproximada</p>
$$\\Delta s \\approx d \\cdot \\Delta\\theta\\;[\\text{rad}]$$
<p>donde $d$ es la distancia de la punta al eje de esa articulación. En <code>init</code>, la punta está a unos 340 mm del eje de la base, 313 mm del hombro, 285 mm del codo y 150 mm de la muñeca:</p>
<table><tr><th>1° de error en…</th><th>desplaza la punta unos</th></tr>
<tr><td>la base</td><td>$343 \\times 0{,}01745 \\approx 6{,}0$ mm</td></tr>
<tr><td>el hombro</td><td>$\\approx 5{,}5$ mm</td></tr>
<tr><td>el codo</td><td>$\\approx 5{,}0$ mm</td></tr>
<tr><td>la muñeca</td><td>$\\approx 2{,}6$ mm</td></tr></table>
<p>Por eso los errores del hombro que midió el ensayo A1 (1,5° de media) importan más que los de la muñeca. En un robot industrial, la <b>calibración cinemática</b> mide la punta con un láser o una cámara en decenas de posturas y ajusta ceros, longitudes y ángulos entre ejes por mínimos cuadrados. Puede llevar la exactitud de varios milímetros a décimas.</p>
<p>La calibración no mejora la <b>repetibilidad</b> (volver siempre al mismo sitio): esa la fijan las holguras, la rigidez y el control. El ensayo A2 midió en el SO-ARM100 una repetibilidad de 2,3 mm según sus propios codificadores.</p>`,
    },
    {
      titulo: 'Calibrar el TCP con cuatro toques',
      texto: 'Se monta una herramienta nueva (por ejemplo, un marcador) y no se sabe exactamente dónde queda su punta. Se toca <b>un mismo punto</b> desde cuatro orientaciones y se resuelve un sistema lineal. Pulse <b>Medir</b>.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura([1.0, -0.35, 0.7, 0.5, 0, 0.5]);
        const S = new THREE.Vector3(0.0, -0.26, 0.05);
        esfera(app, S, 0.006, 0xffffff, 1);
        const tReal = new THREE.Vector3(0.004, -0.118, 0.003);          // punta verdadera, en el marco de la brida
        const lec = lectura('Pulse Medir.');
        const medir = () => {
          app.escena.extras.children.slice(1).forEach((o) => o.removeFromParent());
          const filas = [], b = [];
          for (let k = 0; k < 4; k++) {
            const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2 + (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1, k * Math.PI / 2 + Math.random() * 0.5));
            const tMundo = tReal.clone().applyMatrix4(R);
            const ruido = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(0.0006);
            const p = S.clone().sub(tMundo).add(ruido);                    // posición medida de la brida
            marco(app, R.clone().setPosition(p), { largo: 0.03, etiquetas: false });
            linea(app, [p, p.clone().add(tMundo)], 0xffb287);
            const e = R.elements;
            for (let r = 0; r < 3; r++) { filas.push([e[r], e[4 + r], e[8 + r], r === 0 ? -1 : 0, r === 1 ? -1 : 0, r === 2 ? -1 : 0]); b.push(-p.getComponent(r)); }
          }
          // Mínimos cuadrados: (AᵀA) x = Aᵀb, con x = (t, S).
          const AtA = [0, 1, 2, 3, 4, 5].map((i) => [0, 1, 2, 3, 4, 5].map((j) => filas.reduce((s, f) => s + f[i] * f[j], 0)));
          const Atb = [0, 1, 2, 3, 4, 5].map((i) => filas.reduce((s, f, k) => s + f[i] * b[k], 0));
          const x = resolver(AtA, Atb);
          const t = new THREE.Vector3(x[0], x[1], x[2]);
          lec.textContent = `TCP estimado (brida): (${t.toArray().map((v) => (v * 1000).toFixed(2)).join(', ')}) mm\nTCP verdadero:        (${tReal.toArray().map((v) => (v * 1000).toFixed(2)).join(', ')}) mm\nerror: ${(t.distanceTo(tReal) * 1000).toFixed(2)} mm, con ±0,3 mm de ruido en cada toque`;
        };
        cuerpo.append(botones(['Medir', medir]), lec);
      },
      detalle: `<p>El programa mueve el <b>TCP</b>, así que el controlador tiene que saber dónde está respecto de la brida (el extremo del último eslabón). Si la herramienta cambia, se recalibra con el método de los <b>cuatro puntos</b>:</p>
<ol><li>Se fija en la mesa una punta de referencia $S$ (posición desconocida).</li>
<li>Se lleva la punta de la herramienta a tocar $S$ con cuatro orientaciones muy distintas de la muñeca, y en cada una se registra la pose de la brida $(R_i, p_i)$.</li>
<li>En cada toque se cumple $R_i\\,t + p_i = S$, con $t$ el TCP en el marco de la brida (desconocido).</li></ol>
<p>Reordenando, $R_i\\,t - S = -p_i$: tres ecuaciones lineales por toque, seis incógnitas ($t$ y $S$). Con cuatro toques hay 12 ecuaciones y se resuelve por mínimos cuadrados:</p>
$$\\begin{bmatrix} R_1 & -I \\\\ \\vdots & \\vdots \\\\ R_4 & -I \\end{bmatrix}\\begin{bmatrix} t \\\\ S \\end{bmatrix} = \\begin{bmatrix} -p_1 \\\\ \\vdots \\\\ -p_4 \\end{bmatrix}$$
<p>Cuanto más distintas sean las orientaciones, mejor condicionado queda el sistema: con orientaciones parecidas, el ruido de los toques se amplifica. Los controladores industriales incluyen este procedimiento (en ABB, «método de 4 puntos» en la definición de <code>tooldata</code>; en KUKA, «XYZ 4 puntos»).</p>`,
    },
    {
      titulo: 'Cámara y robot: AX = XB',
      texto: 'Para que el robot tome lo que ve una cámara, hay que saber dónde está la cámara respecto de la pinza. Se mueve el robot a varias posturas mirando un patrón y se resuelve $AX = XB$.',
      preparar(app, cuerpo) {
        cuerpo.append(figura(MANO_OJO));
        app.escena.fijarPostura([0.3, 0.1, 0.3, 0.8, 0, 0.5]);
      },
      detalle: `<p>Con una cámara montada en la pinza (<i>eye-in-hand</i>), la transformación $X$ entre la pinza y la cámara no se puede medir con una regla con precisión. Se calcula así:</p>
<ol><li>Se coloca un patrón (tablero de ajedrez o marcadores ArUco) fijo en la mesa.</li>
<li>Se lleva el robot a varias posturas. En cada una se registra la pose de la pinza (por cinemática directa) y la pose del patrón vista por la cámara (con <code>solvePnP</code> de OpenCV).</li>
<li>Entre dos posturas, el movimiento de la pinza $A$ y el movimiento aparente del patrón $B$ cumplen $A\\,X = X\\,B$, porque la cámara viaja rígidamente con la pinza.</li></ol>
<p>Hay métodos clásicos para resolverlo: Tsai–Lenz (1989), Park–Martin, y la solución con <b>cuaterniones duales</b> de Daniilidis (1999), que resuelve rotación y traslación a la vez (lección 9). OpenCV los incluye en <code>calibrateHandEye</code>.</p>
<p>Con la cámara fija en el entorno (<i>eye-to-hand</i>, como la webcam de este proyecto frente al operador) el problema es el mismo, con $X$ = base → cámara. En la teleoperación del proyecto no hace falta, porque se copian <b>ángulos</b> de la persona, no posiciones: la cámara nunca tiene que decir dónde está un objeto respecto del robot. Una tarea de «tomar el objeto que ve la cámara» sí lo necesitaría.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'En <code>init</code>, el hombro tiene 1° de error de cero. ¿Aproximadamente cuánto se desvía la punta, que está a 313 mm de su eje?',
        opciones: ['0,3 mm', '1 mm', '5,5 mm', '31 mm'],
        correcta: 2,
        explicacion: '$313\\ \\text{mm} \\times 1^\\circ \\times \\pi/180 \\approx 5{,}5$ mm.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0, 0, 0, 0, 0.5]); },
    },
  ],
};
