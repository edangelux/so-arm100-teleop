// Lección 14: visión y teleoperación. Cómo funciona este proyecto: de la
// imagen a los ángulos, el filtro One Euro y la cadena de tiempos.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, grafica, deslizador, lectura, figura, barras, botones, grados } from './comun.js';

const TUBERIA = `<svg viewBox="0 0 660 170" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
<defs><marker id="t14" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#bdb8c0"/></marker></defs>
${[['Cámara', '640×480 MJPEG', 10], ['MediaPipe', 'Pose + Hands', 118], ['Ángulos', 'vectores 2D/3D', 226], ['Filtro', 'One Euro + zona muerta', 334], ['Límites', 'y signos', 442], ['ros2_control', 'trayectoria', 550]].map(([t, s, x], i) => `
<rect x="${x}" y="40" width="98" height="56" rx="8" fill="${i === 3 ? '#422082' : '#150f23'}" stroke="#362d59"/>
<text x="${x + 49}" y="63" fill="#fff" text-anchor="middle" font-weight="500">${t}</text>
<text x="${x + 49}" y="81" fill="#bdb8c0" text-anchor="middle" font-size="10.5">${s}</text>
${i < 5 ? `<line x1="${x + 98}" y1="68" x2="${x + 108}" y2="68" stroke="#bdb8c0" marker-end="url(#t14)"/>` : ''}`).join('')}
<text x="10" y="24" fill="#c2ef4e">34,05 cuadros por segundo (medido)</text>
<text x="330" y="24" fill="#ffb287">procesamiento + escritura serial: 21,87 ms (medido)</text>
<text x="10" y="130" fill="#bdb8c0">Sin cinemática inversa en el lazo: se copian ángulos, articulación por articulación.</text>
<text x="10" y="150" fill="#bdb8c0">Desviación angular medida: 0,492° de promedio, 1,494° de máximo.</text>
</svg>`;

class OneEuro {
  constructor(minCorte, beta, dCorte = 1) { Object.assign(this, { minCorte, beta, dCorte, x: null, dx: 0 }); }
  static a(corte, dt) { const tau = 1 / (2 * Math.PI * corte); return 1 / (1 + tau / dt); }
  filtrar(x, dt) {
    if (this.x === null) { this.x = x; return x; }
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.a(this.dCorte, dt) * (dx - this.dx);
    const corte = this.minCorte + this.beta * Math.abs(this.dx);
    this.x += OneEuro.a(corte, dt) * (x - this.x);
    return this.x;
  }
}

export default {
  titulo: 'Visión y teleoperación',
  resumen: 'Cómo este proyecto mueve el brazo con los gestos de una persona: detección del cuerpo, cálculo de ángulos, filtrado, y de dónde viene el retardo.',
  conceptos: [
    ['Teleoperación', 'Controlar un robot a distancia en tiempo real, con una persona en el lazo.'],
    ['Mapeo articular', 'Copiar ángulos de la persona al robot articulación por articulación, sin calcular dónde va la punta.'],
    ['MediaPipe', 'Biblioteca de Google que detecta 33 puntos del cuerpo (Pose) y 21 de cada mano (Hands) en cada imagen.'],
    ['Filtro One Euro', 'Suavizado adaptativo: filtra mucho cuando la señal está quieta (quita temblor) y poco cuando se mueve rápido (poco retraso).'],
    ['Latencia', 'Tiempo desde que la persona se mueve hasta que el robot empieza a moverse. Suma cámara, procesamiento, comunicación y la respuesta del servo.'],
  ],
  referencias: [
    'Casiez, G., Roussel, N. y Vogel, D. (2012). «1€ Filter: a simple speed-based low-pass filter for noisy input in interactive systems», CHI.',
    'Lugaresi, C. et al. (2019). «MediaPipe: a framework for building perception pipelines».',
    'docs/07 del repositorio: cómo funciona el sistema; pruebas/README.md: cómo se midieron los indicadores.',
  ],
  pasos: [
    {
      titulo: 'La tubería de la teleoperación',
      texto: 'Seis etapas, 34 veces por segundo: tomar la imagen, encontrar el cuerpo, medir ángulos, filtrarlos, aplicar límites y enviarlos al brazo.',
      ancho: true,
      preparar(app, cuerpo) {
        cuerpo.append(figura(TUBERIA));
        const q = [0, 0.2, -0.4, 0.4, 0, 0.5];
        return animar((t) => { q[0] = 0.5 * Math.sin(t * 0.8); q[1] = 0.2 + 0.25 * Math.sin(t * 1.1); q[2] = -0.4 + 0.3 * Math.sin(t * 1.3 + 1); app.escena.fijarPostura(q); });
      },
      detalle: `<p>La teleoperación del proyecto (versiones 13 a 15) es un programa de Python que repite en bucle:</p>
<ol><li><b>Captura</b>: una imagen de 640×480 de la cámara (webcam o teléfono con DroidCam).</li>
<li><b>Detección</b>: MediaPipe Pose encuentra 33 puntos del cuerpo (hombros, codos, muñecas, caderas…) y MediaPipe Hands, 21 puntos de la mano (cada dos cuadros, para ahorrar cálculo).</li>
<li><b>Ángulos</b>: con los puntos se forman vectores (brazo, antebrazo, mano) y se calculan los ángulos entre ellos (paso siguiente).</li>
<li><b>Filtrado</b>: un filtro One Euro por articulación y una zona muerta para que el robot no tiemble.</li>
<li><b>Límites y signos</b>: cada ángulo se recorta a los límites del robot y se le aplica el signo que hace que el robot «copie» y no «refleje».</li>
<li><b>Envío</b>: los cinco ángulos se publican como trayectoria para ros2_control, que los manda a los servos por el bus serie.</li></ol>
<p>Es un <b>mapeo articular directo</b>: no hay cinemática inversa en el lazo. La ventaja es la simplicidad y la robustez (no hay posturas sin solución); la desventaja es que el robot no puede ir «a donde apunta la mano» si su geometría es distinta de la del brazo humano (lección 1: el humano tiene 7 GDL).</p>
<p>Los indicadores medidos del proyecto (README): 34,05 cuadros por segundo, 21,87 ms de procesamiento más escritura serial y 0,492° de desviación angular media.</p>`,
    },
    {
      titulo: 'De tres puntos a un ángulo',
      texto: 'Arrastre el <b>codo</b> o la <b>muñeca</b> del dibujo. El ángulo entre el brazo y el antebrazo se calcula con los vectores entre puntos, y el robot lo copia en su codo.',
      ancho: true,
      preparar(app, cuerpo) {
        const P = { h: [120, 60], c: [210, 150], m: [330, 120] };
        const svg = el('div', { class: 'figura-leccion' });
        const lec = lectura();
        const q = [0, 0.3, 0, 0.5, 0, 0.5];
        let arrastrando = null;
        const pintar = () => {
          const v1 = [P.c[0] - P.h[0], P.c[1] - P.h[1]], v2 = [P.m[0] - P.c[0], P.m[1] - P.c[1]];
          const flex = Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]);   // ángulo con signo entre vectores
          svg.innerHTML = `<svg viewBox="0 0 460 230" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12" style="touch-action:none">
            <circle cx="90" cy="40" r="22" fill="none" stroke="#bdb8c0" stroke-width="2"/><line x1="90" y1="62" x2="90" y2="200" stroke="#bdb8c0" stroke-width="2"/>
            <line x1="${P.h[0]}" y1="${P.h[1]}" x2="${P.c[0]}" y2="${P.c[1]}" stroke="#efefef" stroke-width="7" stroke-linecap="round"/>
            <line x1="${P.c[0]}" y1="${P.c[1]}" x2="${P.m[0]}" y2="${P.m[1]}" stroke="#c2ef4e" stroke-width="7" stroke-linecap="round"/>
            <line x1="${P.c[0]}" y1="${P.c[1]}" x2="${P.c[0] + v1[0] * 0.8}" y2="${P.c[1] + v1[1] * 0.8}" stroke="#8f879a" stroke-dasharray="4 4"/>
            <circle cx="${P.h[0]}" cy="${P.h[1]}" r="9" fill="#fd44b0"/><text x="${P.h[0] - 10}" y="${P.h[1] - 14}" fill="#fd44b0">hombro (12)</text>
            <circle data-p="c" cx="${P.c[0]}" cy="${P.c[1]}" r="12" fill="#ffb287" style="cursor:grab"/><text x="${P.c[0] - 20}" y="${P.c[1] + 28}" fill="#ffb287">codo (14)</text>
            <circle data-p="m" cx="${P.m[0]}" cy="${P.m[1]}" r="12" fill="#7553ff" style="cursor:grab"/><text x="${P.m[0] - 20}" y="${P.m[1] - 18}" fill="#a597ff">muñeca (16)</text>
          </svg>`;
          q[2] = Math.max(-1.49, Math.min(1.49, -flex));
          app.escena.fijarPostura(q);
          app.escena.resaltar('Elbow');
          lec.textContent = `v₁ = codo − hombro = (${v1.map((v) => v.toFixed(0)).join(', ')})   v₂ = muñeca − codo = (${v2.map((v) => v.toFixed(0)).join(', ')})\nflexión = atan2(v₁ × v₂, v₁ · v₂) = ${grados(flex).toFixed(1)}°   →   codo del robot ${grados(q[2]).toFixed(1)}°`;
        };
        svg.addEventListener('pointerdown', (e) => { const p = e.target.dataset?.p; if (p) { arrastrando = p; svg.setPointerCapture(e.pointerId); } });
        svg.addEventListener('pointermove', (e) => {
          if (!arrastrando) return;
          const r = svg.querySelector('svg').getBoundingClientRect();
          P[arrastrando] = [((e.clientX - r.left) / r.width) * 460, ((e.clientY - r.top) / r.height) * 230];
          pintar();
        });
        svg.addEventListener('pointerup', () => { arrastrando = null; });
        cuerpo.append(svg, lec);
        pintar();
      },
      detalle: `<p>MediaPipe devuelve cada punto del cuerpo con coordenadas normalizadas de la imagen $(x, y)$ y una estimación de profundidad $z$. Los números entre paréntesis del dibujo son los índices de MediaPipe Pose para el lado derecho: 12 (hombro), 14 (codo), 16 (muñeca).</p>
<p>Con dos vectores, brazo $v_1$ y antebrazo $v_2$, el ángulo de flexión con signo es</p>
$$\\theta = \\operatorname{atan2}(v_1 \\times v_2,\\; v_1 \\cdot v_2)$$
<p>donde en 2D el producto cruz es el número $v_{1x}v_{2y} - v_{1y}v_{2x}$. Usar <code>atan2</code> y no $\\arccos(\\hat{v}_1 \\cdot \\hat{v}_2)$ tiene dos ventajas: da el signo (hacia qué lado se dobla) y es preciso en todo el rango.</p>
<p>Problemas reales que el proyecto tuvo que resolver:</p>
<ul><li><b>Escorzo</b>: si el antebrazo apunta a la cámara, su vector en la imagen es casi nulo y el ángulo no es fiable. El programa congela la articulación cuando el vector es más corto que un mínimo (<code>MIN_FORE_LEN</code>).</li>
<li><b>Profundidad</b>: la $z$ de MediaPipe es una estimación; la versión 15 la usa para el giro de muñeca en 3D con un índice de confianza por articulación.</li>
<li><b>Proporciones</b>: brazo y antebrazo de la persona no miden como los del robot; la versión 15 agrega una ganancia por articulación calibrada con una postura de referencia.</li></ul>`,
    },
    {
      titulo: 'El filtro One Euro',
      texto: 'Una señal con ruido (gris), como el ángulo de un codo medido por la cámara. El <b style="color:#ffb287">filtro exponencial</b> fijo suaviza pero se atrasa; el <b style="color:#c2ef4e">One Euro</b> se adapta a la velocidad. Ajuste los parámetros.',
      ancho: true,
      preparar(app, cuerpo) {
        const v = { alfa: 0.15, minCorte: 1.0, beta: 0.05, ruido: 0.03 };
        const g = grafica({ ancho: 620, alto: 210, x: [0, 6], y: [-0.9, 0.9], xEtq: 'tiempo (s)', yEtq: 'ángulo (rad)' });
        const lec = lectura();
        const act = () => {
          const dt = 1 / 34, crudo = [], ema = [], oe = [];
          const f = new OneEuro(v.minCorte, v.beta);
          let e = null, errE = 0, errO = 0, n = 0;
          let semilla = 7;
          const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647 - 0.5; };
          for (let t = 0; t <= 6; t += dt) {
            const real = t < 2 ? 0.1 : t < 3.2 ? 0.1 + 0.6 * Math.sin((t - 2) * 2.6) : 0.1 + 0.6 * Math.sin(1.2 * 2.6) * Math.exp(-(t - 3.2) * 0.8);
            const x = real + v.ruido * 2 * azar();
            e = e === null ? x : e + v.alfa * (x - e);
            const o = f.filtrar(x, dt);
            crudo.push([t, x]); ema.push([t, e]); oe.push([t, o]);
            errE += (e - real) ** 2; errO += (o - real) ** 2; n++;
          }
          g.dibujar([{ color: '#5d5670', puntos: crudo, ancho: 1 }, { color: '#ffb287', puntos: ema }, { color: '#c2ef4e', puntos: oe }]);
          lec.textContent = `error cuadrático medio respecto de la señal real:  exponencial ${(Math.sqrt(errE / n) * 1000).toFixed(1)} mrad   ·   One Euro ${(Math.sqrt(errO / n) * 1000).toFixed(1)} mrad`;
        };
        cuerpo.append(g, lec,
          deslizador('α exponencial', { min: 0.02, max: 1, paso: 0.01, valor: v.alfa, formato: (x) => x.toFixed(2), alCambiar: (x) => { v.alfa = x; act(); } }),
          deslizador('corte mínimo (Hz)', { min: 0.1, max: 5, paso: 0.05, valor: v.minCorte, formato: (x) => x.toFixed(2), alCambiar: (x) => { v.minCorte = x; act(); } }),
          deslizador('beta', { min: 0, max: 1, paso: 0.005, valor: v.beta, formato: (x) => x.toFixed(3), alCambiar: (x) => { v.beta = x; act(); } }),
          deslizador('ruido', { min: 0, max: 0.1, paso: 0.001, valor: v.ruido, formato: (x) => `${(x * 1000).toFixed(0)} mrad`, alCambiar: (x) => { v.ruido = x; act(); } }));
        act();
        app.escena.fijarPostura([0, 0.3, -0.3, 0.5, 0, 0.5]);
      },
      detalle: `<p>Las posiciones que da MediaPipe tiemblan de un cuadro a otro aunque la persona esté quieta. Copiar ese temblor al robot lo haría vibrar. Hay que filtrar, pero todo filtro pasa bajos introduce <b>retraso</b>: es el compromiso central.</p>
<h4>Filtro exponencial (EMA)</h4>
$$\\hat{x}_k = \\hat{x}_{k-1} + \\alpha\\,(x_k - \\hat{x}_{k-1})$$
<p>Con $\\alpha$ pequeño suaviza mucho y se atrasa; con $\\alpha$ grande sigue rápido y deja pasar el ruido. Un solo valor no sirve para las dos situaciones.</p>
<h4>Filtro One Euro</h4>
<p>Casiez, Roussel y Vogel (2012) propusieron cambiar $\\alpha$ según la velocidad de la señal. Se estima la derivada $\\dot{\\hat{x}}$ (filtrada) y se ajusta la frecuencia de corte:</p>
$$f_c = f_{c,\\min} + \\beta\\,|\\dot{\\hat{x}}|, \\qquad \\alpha = \\frac{1}{1 + \\dfrac{1}{2\\pi f_c\\,\\Delta t}}$$
<ul><li>Señal quieta: $f_c \\approx f_{c,\\min}$, filtrado fuerte, sin temblor.</li>
<li>Señal rápida: $f_c$ sube, casi no filtra, poco retraso.</li></ul>
<p>La teleoperación del proyecto usa One Euro por articulación (parámetros en <code>ONE_EURO</code> de <code>teleop_v14.py</code>: corte mínimo de 0,5 a 1,2 Hz y beta de 0,03 a 0,05) y además una <b>zona muerta</b>: cambios menores que unos 0,012 rad no se envían.</p>`,
    },
    {
      titulo: '¿Dónde se va el tiempo?',
      texto: 'La latencia total es una suma. Lo que midió el proyecto: un cuadro cada 29 ms, 22 ms de procesamiento y escritura, y 140 a 320 ms hasta que el servo empieza a moverse (ensayo A5).',
      preparar(app, cuerpo) {
        const b = barras([
          { etq: 'Intervalo entre cuadros', frac: 29.4 / 350, texto: '29 ms' },
          { etq: 'Procesamiento + serie', frac: 21.9 / 350, texto: '22 ms' },
          { etq: 'Hasta que el servo arranca', frac: 184 / 350, texto: '140–320 ms' },
          { etq: 'Subida del servo 10–90 %', frac: 170 / 350, texto: '160–190 ms' },
        ]);
        cuerpo.append(b, el('div', { class: 'nota' }, 'Barra llena = 350 ms. Valores medidos: README del proyecto (cuadros y procesamiento) y ensayo A5 del 25/09/2026 (servos).'));
        app.escena.fijarPostura([0, 0.3, -0.3, 0.5, 0, 0.5]);
      },
      detalle: `<p>Para una persona que teleopera, la latencia se nota a partir de unos 100–200 ms: el robot parece «ir detrás» del gesto. Las fuentes en este sistema:</p>
<table><tr><th>Etapa</th><th>Tiempo</th><th>Fuente</th></tr>
<tr><td>Esperar el siguiente cuadro</td><td>hasta 29 ms (34 FPS)</td><td>medido</td></tr>
<tr><td>MediaPipe + cálculo + escritura serial</td><td>21,87 ms</td><td>medido (indicador del proyecto)</td></tr>
<tr><td>Filtro One Euro</td><td>variable: pequeño en movimiento rápido</td><td>diseño</td></tr>
<tr><td>Desde la orden hasta que el servo arranca</td><td>140 a 320 ms</td><td>ensayo A5</td></tr>
<tr><td>Movimiento del servo (subida 10–90 %)</td><td>160 a 190 ms</td><td>ensayo A5</td></tr></table>
<p>La conclusión es clara: el cuello de botella no es la visión (unos 50 ms en total) sino la <b>respuesta del lado del robot</b>, que incluye el controlador de trayectorias de ros2_control y la dinámica del servo. Mejorarla pasaría por enviar trayectorias más cortas, ajustar el controlador o reducir la interpolación, no por una cámara más rápida.</p>
<p>Las versiones del programa atacan otros problemas: la <b>v14</b> sincroniza el brazo con su postura real al arrancar (lee <code>/joint_states</code>) para no dar un salto; la <b>v15</b> estima la confianza de cada ángulo, calibra una ganancia por persona y calcula el giro de muñeca en 3D.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'El robot tiembla cuando la persona está quieta frente a la cámara. En el filtro One Euro, ¿qué parámetro conviene <b>bajar</b>?',
        opciones: ['beta', 'El corte mínimo $f_{c,\\min}$', 'Los cuadros por segundo', 'El límite de la articulación'],
        correcta: 1,
        explicacion: 'En reposo la frecuencia de corte vale $f_{c,\\min}$. Bajarla filtra más el temblor en reposo; beta controla cuánto se abre el filtro al moverse.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, -0.3, 0.5, 0, 0.5]); },
    },
  ],
};
