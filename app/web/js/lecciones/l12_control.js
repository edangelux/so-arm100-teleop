// Lección 12: control. PID de una articulación, respuesta al escalón medida
// (ensayo A5), error por carga (A1) y control de impedancia.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, grafica, deslizador, lectura, botones, formula, figura, esfera, linea, GRADO, grados } from './comun.js';

// Articulación simulada: J·θ̈ = u − b·θ̇ − τ_carga, con u = PID saturado a ±τmax.
function simular({ kp, ki, kd, carga = 0, paso = 0.3, T = 1.5, retardo = 0 }) {
  const J = 0.004, b = 0.03, tmax = 1.86, dt = 0.0005;
  let th = 0, w = 0, integ = 0, ePrev = paso;
  const out = [];
  const cola = [];
  for (let t = 0; t <= T; t += dt) {
    const ref = t >= retardo ? paso : 0;
    const e = ref - th;
    integ += e * dt;
    let u = kp * e + ki * integ + kd * (e - ePrev) / dt;
    ePrev = e;
    u = Math.max(-tmax, Math.min(tmax, u));
    cola.push(u);
    const a = (u - b * w - carga) / J;
    w += a * dt; th += w * dt;
    if (out.length === 0 || t - out[out.length - 1][0] >= 0.005) out.push([t, th]);
  }
  return out;
}

function metricas(curva, paso) {
  const fin = curva[curva.length - 1][1];
  const t10 = curva.find((p) => p[1] >= 0.1 * paso)?.[0], t90 = curva.find((p) => p[1] >= 0.9 * paso)?.[0];
  const max = Math.max(...curva.map((p) => p[1]));
  let ts = 0;
  for (let i = curva.length - 1; i >= 0; i--) if (Math.abs(curva[i][1] - fin) > 0.02 * paso) { ts = curva[i][0]; break; }
  return { subida: t10 !== undefined && t90 !== undefined ? t90 - t10 : NaN, sobrepaso: Math.max(0, (max - paso) / paso * 100), establecimiento: ts, error: paso - fin };
}

const A5 = [   // resultados del ensayo A5 del 25 de septiembre de 2026 (escalón de 0,3 rad)
  ['Giro de la base', 317, 174, 501, 1.1, 0.09], ['Hombro', 184, 162, 336, 0.5, -1.14], ['Codo', 162, 161, 340, 0.0, -1.10],
  ['Flexión de muñeca', 148, 192, 342, 0.0, -0.24], ['Giro de muñeca', 139, 180, 333, 0.1, -0.02],
];

export default {
  titulo: 'Control',
  resumen: 'Cómo el servo convierte un ángulo pedido en un movimiento: el controlador PID, sus compromisos, la respuesta medida del brazo real y el control de impedancia de los robots colaborativos.',
  conceptos: [
    ['PID', '$u = K_p e + K_i \\int e\\,dt + K_d \\dot{e}$: acción proporcional al error, a su acumulación y a su velocidad de cambio.'],
    ['Respuesta al escalón', 'Cómo responde el sistema a un cambio brusco de consigna: retardo, subida, sobrepaso y establecimiento.'],
    ['Error de estado estacionario', 'El error que queda al final. Con sólo acción proporcional y una carga, no se anula: $e = \\tau_{carga}/K_p$.'],
    ['Saturación', 'El motor no puede dar más par que el máximo: limita lo rápido que se corrige un error grande.'],
    ['Control de impedancia', 'Hacer que la punta se comporte como un resorte y un amortiguador virtuales, en lugar de seguir rígidamente una posición.'],
  ],
  referencias: [
    'Åström, K. J. y Murray, R. M. <i>Feedback Systems</i> (PID y respuesta al escalón). Libro de libre acceso.',
    'Hogan, N. (1985). «Impedance control: an approach to manipulation», J. Dynamic Systems, Measurement and Control.',
    'pruebas/resultados/2026-09-25/resumen.md: ensayos A1 (precisión) y A5 (escalón) del brazo real.',
  ],
  pasos: [
    {
      titulo: 'El controlador PID',
      texto: 'Una articulación simulada recibe un escalón de <b>0,3 rad</b> (como en el ensayo A5). Mueva $K_p$, $K_i$ y $K_d$ y observe la respuesta. Active la <b>carga</b> para ver qué pasa con el peso.',
      ancho: true,
      preparar(app, cuerpo) {
        const v = { kp: 8, ki: 0, kd: 0.25, carga: 0 };
        const g = grafica({ ancho: 620, alto: 200, x: [0, 1.5], y: [0, 0.45], xEtq: 'tiempo (s)', yEtq: 'ángulo (rad)' });
        const lec = lectura();
        const q = [0, 0.2, -0.6, 0.4, 0, 0.5];
        let curva = [];
        const act = () => {
          curva = simular(v);
          const m = metricas(curva, 0.3);
          g.dibujar([{ color: '#8f879a', puntos: [[0, 0.3], [1.5, 0.3]], punteada: true }, { color: '#c2ef4e', puntos: curva }]);
          lec.textContent = `subida ${Number.isFinite(m.subida) ? `${(m.subida * 1000).toFixed(0)} ms` : '— (no llega al 90 %)'}   sobrepaso ${m.sobrepaso.toFixed(1)} %   establecimiento (2 %) ${(m.establecimiento * 1000).toFixed(0)} ms   error final ${grados(m.error).toFixed(2)}°`;
        };
        cuerpo.append(formula('u(t) = K_p\\,e(t) + K_i \\int_0^t e\\,d\\tau + K_d\\,\\dot{e}(t)'), g, lec,
          deslizador('Kp (N·m/rad)', { min: 0.5, max: 30, paso: 0.1, valor: v.kp, formato: (x) => x.toFixed(1), alCambiar: (x) => { v.kp = x; act(); } }),
          deslizador('Ki (N·m/rad·s)', { min: 0, max: 60, paso: 0.5, valor: v.ki, formato: (x) => x.toFixed(1), alCambiar: (x) => { v.ki = x; act(); } }),
          deslizador('Kd (N·m·s/rad)', { min: 0, max: 0.8, paso: 0.005, valor: v.kd, formato: (x) => x.toFixed(3), alCambiar: (x) => { v.kd = x; act(); } }),
          botones(['Sin carga', () => { v.carga = 0; act(); }], ['Con carga (0,5 N·m)', () => { v.carga = 0.5; act(); }]));
        act();
        app.escena.resaltar('Elbow');
        return animar((t) => {
          const k = (t % 2.2) / 1.5;
          const i = Math.min(curva.length - 1, Math.floor(k * curva.length));
          q[2] = -0.6 + (k <= 1 ? curva[i][1] : curva[curva.length - 1][1]);
          app.escena.fijarPostura(q);
          app.escena.resaltar('Elbow');
        });
      },
      detalle: `<p>El controlador PID calcula la acción $u$ (aquí, el par del motor) a partir del error $e = \\theta_{deseado} - \\theta_{medido}$:</p>
$$u(t) = K_p\\,e(t) + K_i \\int_0^t e(\\tau)\\,d\\tau + K_d\\,\\frac{de}{dt}$$
<table><tr><th>Término</th><th>Qué hace</th><th>Si se aumenta</th></tr>
<tr><td>Proporcional $K_p$</td><td>empuja más cuanto mayor es el error</td><td>más rápido, pero más sobrepaso y oscilación</td></tr>
<tr><td>Integral $K_i$</td><td>acumula el error pasado</td><td>elimina el error final con carga, pero puede oscilar</td></tr>
<tr><td>Derivativo $K_d$</td><td>frena cuando el error baja rápido</td><td>menos sobrepaso; amplifica el ruido del sensor</td></tr></table>
<p>El modelo de la articulación es $J\\ddot{\\theta} = u - b\\dot{\\theta} - \\tau_{carga}$, con el par saturado en 1,86 N·m como un STS3215. La saturación explica por qué, con $K_p$ muy grande, la subida deja de acortarse: el motor ya da todo su par.</p>
<p>Pruebe: con sólo $K_p$ (resto en 0) y la carga activada, el ángulo final queda corto. Suba $K_i$ y el error desaparece, a costa de algo de oscilación.</p>`,
    },
    {
      titulo: 'La respuesta del brazo real',
      texto: 'El ensayo A5 midió la respuesta de cada servo del brazo a un escalón de 0,3 rad. La curva <b style="color:#ffb287">durazno</b> es el codo real (modelo ajustado a la medición); la <b style="color:#c2ef4e">lima</b>, su PID simulado con retardo.',
      ancho: true,
      preparar(app, cuerpo) {
        const L = 0.162, tau = 0.161 / Math.log(9);
        const medido = [];
        for (let t = 0; t <= 1.2; t += 0.005) medido.push([t, t < L ? 0 : 0.3 * (1 - Math.exp(-(t - L) / tau))]);
        const v = { kp: 8, ki: 0, kd: 0.25 };
        const g = grafica({ ancho: 620, alto: 200, x: [0, 1.2], y: [0, 0.4], xEtq: 'tiempo desde la orden (s)', yEtq: 'ángulo (rad)' });
        const act = () => g.dibujar([{ color: '#ffb287', puntos: medido, ancho: 3 }, { color: '#c2ef4e', puntos: simular({ ...v, T: 1.2, retardo: L }) }]);
        const tabla = el('div', { class: 'texto-largo', html: `<table><tr><th>Articulación</th><th>Retardo</th><th>Subida 10–90 %</th><th>Establecimiento</th><th>Sobrepaso</th><th>Error final</th></tr>${A5.map((r) => `<tr><td>${r[0]}</td><td>${r[1]} ms</td><td>${r[2]} ms</td><td>${r[3]} ms</td><td>${r[4]} %</td><td>${r[5]}°</td></tr>`).join('')}</table>` });
        cuerpo.append(g, deslizador('Kp', { min: 0.5, max: 30, paso: 0.1, valor: v.kp, formato: (x) => x.toFixed(1), alCambiar: (x) => { v.kp = x; act(); } }),
          deslizador('Kd', { min: 0, max: 0.8, paso: 0.005, valor: v.kd, formato: (x) => x.toFixed(3), alCambiar: (x) => { v.kd = x; act(); } }), tabla);
        act();
        app.escena.fijarPostura([0, 0.2, -0.6, 0.4, 0, 0.5]);
      },
      detalle: `<p>El ensayo A5 (docs/17) ordenó a cada servo un salto de 0,3 rad con una trayectoria de 0,1 s y registró el ángulo medido por su codificador. Los resultados del 25 de septiembre de 2026 están en la tabla. Lo que dicen:</p>
<ul><li><b>Retardo de 140 a 320 ms</b> desde la orden hasta que el servo empieza a moverse. Incluye el viaje del mensaje por ROS, el controlador de trayectorias y el bus serie. El giro de la base promedia más (317 ms) porque uno de sus cuatro escalones tardó unos 700 ms; los otros tres, unos 190 ms.</li>
<li><b>Subida de 160 a 190 ms</b> y <b>sin sobrepaso</b> apreciable: el controlador interno del servo está ajustado de forma conservadora (sobreamortiguado).</li>
<li><b>Error final de hasta 1,1°</b> en hombro y codo, que cargan peso, y casi cero en la muñeca: la huella de un control con poca acción integral.</li></ul>
<p>La curva durazno es un modelo de primer orden con retardo ajustado a los valores medidos del codo: $\\theta(t) = 0{,}3\\,(1 - e^{-(t - L)/\\tau})$ con $L = 162$ ms y $\\tau = t_{subida}/\\ln 9 = 73$ ms. No es la curva cruda del ensayo, pero reproduce su retardo y su subida.</p>
<p>Para la teleoperación, el retardo importa más que la subida: la cámara y el procesamiento tardan unos 22 ms (medido), pero el brazo tarda del orden de 150–300 ms en empezar a seguir. La lección 14 vuelve sobre esto.</p>`,
    },
    {
      titulo: 'Por qué el brazo se queda corto',
      texto: 'Con control proporcional y una carga constante, el equilibrio se alcanza cuando el par del controlador iguala al de la carga: queda un error $e = \\tau_{carga}/K_p$. Es lo que midió el ensayo A1.',
      preparar(app, cuerpo) {
        const g = grafica({ ancho: 560, alto: 170, x: [0, 30], y: [0, 6], xEtq: 'Kp (N·m/rad)', yEtq: 'error final (°) con 0,5 N·m de carga' });
        const pts = [];
        for (let kp = 1; kp <= 30; kp += 0.5) pts.push([kp, grados(0.5 / kp)]);
        g.dibujar([{ color: '#fd44b0', puntos: pts }]);
        cuerpo.append(g, lectura('Ensayo A1 (brazo real, 25/09/2026): error medio del hombro −1,53°, del codo −1,26°,\nde la flexión de muñeca −0,23° y del giro de muñeca −0,03°.'));
        app.escena.fijarPostura([0, 0.5, -0.5, 0, 0, 0.5]);
        app.escena.resaltar('Shoulder_Pitch');
      },
      detalle: `<p>En equilibrio ($\\dot{\\theta} = \\ddot{\\theta} = 0$) y sin acción integral, la ecuación del sistema se reduce a</p>
$$K_p\\,e = \\tau_{carga} \\quad\\Rightarrow\\quad e = \\frac{\\tau_{carga}}{K_p}$$
<p>El error es proporcional a la carga e inversamente proporcional a la ganancia. Así se explica el patrón del ensayo A1:</p>
<ul><li>El <b>hombro</b> y el <b>codo</b>, que sostienen el peso del brazo, tienen errores de 1,3 a 1,5° de media (y hasta 2,4° en init).</li>
<li>La <b>flexión de muñeca</b>, con poca carga, se queda en 0,2°; el <b>giro de muñeca</b>, sin carga de gravedad, en 0,03°.</li>
<li>El error depende del <b>sentido</b> del movimiento (columnas «+A» y «−A» del ensayo): cuando la gravedad ayuda, el servo llega más cerca.</li></ul>
<p>Soluciones posibles: subir la acción integral del servo (con riesgo de oscilar), compensar la gravedad en el software (sumar al ángulo pedido la desviación que predice el modelo de la lección 11), o cerrar un lazo externo con la posición medida. Los robots industriales hacen lo segundo y lo tercero.</p>`,
    },
    {
      titulo: 'Control de impedancia',
      texto: 'Arrastre la esfera lima: la punta la sigue como si estuviera unida a ella por un <b>resorte</b> con <b>amortiguador</b>. Cambie la rigidez y el amortiguamiento y compare.',
      preparar(app, cuerpo) {
        const v = { K: 60, D: 6 };
        const masa = 0.5;
        const q = [0, 0.3, -0.3, 0.9, 0, 0.5];
        app.escena.fijarPostura(q);
        const x = app.cadena.efector(q), vel = new THREE.Vector3();
        const meta = x.clone();
        app.escena.mostrarObjetivo(true, meta);
        app.escena.alArrastrar = (p) => meta.copy(p);
        const rastro = [];
        const l = linea(app, [x, x], 0xffb287);
        cuerpo.append(deslizador('Rigidez K', { min: 5, max: 300, paso: 1, valor: v.K, formato: (a) => `${a.toFixed(0)} N/m`, alCambiar: (a) => { v.K = a; } }),
          deslizador('Amortiguamiento D', { min: 0.5, max: 40, paso: 0.5, valor: v.D, formato: (a) => `${a.toFixed(1)} N·s/m`, alCambiar: (a) => { v.D = a; } }),
          lectura(`masa virtual ${masa} kg   ·   subamortiguado si D < 2√(K·m)`),
          botones(['Saltar 8 cm', () => { meta.add(new THREE.Vector3(0.08, 0, 0)); app.escena.objetivo.position.copy(meta); }]));
        let tPrev = 0;
        const parar = animar((t) => {
          const dt = Math.min(0.03, t - tPrev); tPrev = t;
          for (let k = 0; k < 6; k++) {
            const h = dt / 6;
            const F = meta.clone().sub(x).multiplyScalar(v.K).addScaledVector(vel, -v.D);
            vel.addScaledVector(F, h / masa);
            x.addScaledVector(vel, h);
          }
          const r = app.cadena.ik(x, q.slice(0, 5), { iteraciones: 8 });
          r.q.slice(0, 4).forEach((a, i) => { q[i] = a; });
          app.escena.fijarPostura(q);
          rastro.push(app.cadena.efector(q)); if (rastro.length > 240) rastro.shift();
          l.fijar(rastro);
        });
        return () => { parar(); app.escena.mostrarObjetivo(false); app.escena.alArrastrar = null; };
      },
      detalle: `<p>El control de posición intenta llevar la punta exactamente a donde se le pide, cueste lo que cueste. Si hay un obstáculo o una persona en el camino, aplica todo el par disponible. El <b>control de impedancia</b> (Hogan, 1985) cambia el objetivo: que la punta se comporte como un sistema masa–resorte–amortiguador virtual unido a la posición deseada $x_d$:</p>
$$m\\,\\ddot{x} + D\\,\\dot{x} + K\\,(x - x_d) = F_{externa}$$
<ul><li>Con $K$ grande, el robot es rígido: se parece al control de posición.</li>
<li>Con $K$ pequeña, cede ante un empujón: si alguien choca con él, la fuerza que ejerce es limitada ($F = K\\,\\Delta x$).</li>
<li>$D$ decide si llega oscilando ($D < 2\\sqrt{Km}$, subamortiguado) o suavemente.</li></ul>
<p>Es la base de los <b>robots colaborativos</b> (limitación de potencia y fuerza, lección 17), del ensamble con contacto (meter una clavija en un agujero sin atascarse) y del guiado manual. Requiere medir o estimar fuerzas: sensores de par en cada articulación o un sensor de fuerza en la muñeca. El SO-ARM100, con servos de posición, no puede hacer control de impedancia real; esta simulación muestra el comportamiento.</p>
<p>La variante inversa, el <b>control de admitancia</b>, mide la fuerza y calcula cuánto moverse: es la que usan los robots industriales rígidos equipados con un sensor de fuerza.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Un servo con control sólo proporcional sostiene un peso y queda 1,5° por debajo de lo pedido. ¿Qué término del PID eliminaría ese error?',
        opciones: ['Aumentar $K_d$', 'Agregar $K_i$ (acción integral)', 'Reducir $K_p$', 'Ninguno: es inevitable'],
        correcta: 1,
        explicacion: 'La integral acumula el error mientras exista, y aumenta el par hasta anularlo. $K_d$ sólo actúa mientras el error cambia.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.5, -0.5, 0, 0, 0.5]); },
    },
  ],
};
