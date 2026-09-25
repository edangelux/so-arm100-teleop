// Lección 2: tipos de articulación, límites y cómo mide un servo su ángulo.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, deslizador, linea, esfera, etiqueta, figura, BRAZO, NOMBRE, GRADO, grados } from './comun.js';
import { COLORES } from '../escena.js';

const POSE = [0.3, 0.25, -0.45, 0.4, 0, 0.5];

const TIPOS = `
<svg viewBox="0 0 520 170" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif">
  <text x="130" y="22" fill="#fff" font-size="15" font-weight="700" text-anchor="middle">Giratoria (R)</text>
  <rect x="40" y="95" width="80" height="26" rx="6" fill="#422082"/>
  <circle cx="125" cy="108" r="17" fill="#1f1633" stroke="#c2ef4e" stroke-width="3"/>
  <circle cx="125" cy="108" r="4" fill="#c2ef4e"/>
  <g transform="rotate(-35 125 108)"><rect x="125" y="96" width="95" height="24" rx="6" fill="#efefef"/></g>
  <path d="M 158 132 A 40 40 0 0 0 166 78" fill="none" stroke="#fd44b0" stroke-width="2.5" marker-end="url(#pf)"/>
  <text x="130" y="160" fill="#bdb8c0" font-size="13" text-anchor="middle">gira un ángulo θ alrededor de un eje</text>
  <line x1="260" y1="30" x2="260" y2="150" stroke="#362d59"/>
  <text x="390" y="22" fill="#fff" font-size="15" font-weight="700" text-anchor="middle">Lineal o prismática (P)</text>
  <rect x="300" y="88" width="190" height="40" rx="6" fill="none" stroke="#422082" stroke-width="3"/>
  <rect x="330" y="96" width="90" height="24" rx="5" fill="#efefef"/>
  <line x1="340" y1="72" x2="440" y2="72" stroke="#fd44b0" stroke-width="2.5" marker-end="url(#pf)" marker-start="url(#pi)"/>
  <text x="390" y="160" fill="#bdb8c0" font-size="13" text-anchor="middle">se desliza una distancia d por una guía</text>
  <defs>
    <marker id="pf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#fd44b0"/></marker>
    <marker id="pi" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="#fd44b0"/></marker>
  </defs>
</svg>`;

// Dibuja el arco de giro permitido de una articulación y la marca de su posición actual.
function arcoLimites(app, nombre, q) {
  const i = BRAZO.indexOf(nombre);
  const j = app.modelo.juntas.find((x) => x.nombre === nombre);
  const M = app.cadena.fk(q)[nombre];
  const pos = new THREE.Vector3().setFromMatrixPosition(M);
  const eje = new THREE.Vector3(...j.eje).normalize().transformDirection(M);
  // Radio: hacia la punta, proyectado en el plano perpendicular al eje.
  const haciaPunta = app.cadena.efector(q).sub(pos);
  let r = haciaPunta.sub(eje.clone().multiplyScalar(haciaPunta.dot(eje)));
  if (r.lengthSq() < 1e-8) r = new THREE.Vector3(1, 0, 0).cross(eje);
  r.normalize().multiplyScalar(0.07);
  const [lo, hi] = j.limite;
  const pts = [];
  for (let k = 0; k <= 64; k++) {
    const th = lo + ((hi - lo) * k) / 64 - q[i];
    pts.push(pos.clone().add(r.clone().applyAxisAngle(eje, th)));
  }
  const arco = linea(app, pts, COLORES[nombre]);
  const bordes = [lo, hi].map((th) => linea(app, [pos, pos.clone().add(r.clone().applyAxisAngle(eje, th - q[i]))], 0x8f879a));
  const punta = esfera(app, pos.clone().add(r), 0.006, 0xffffff, 1);
  return [arco, ...bordes, punta];
}

export default {
  titulo: 'Tipos de articulación',
  resumen: 'Cómo se mueve cada articulación, hasta dónde puede girar y cómo el servomotor sabe en qué ángulo está.',
  conceptos: [
    ['Articulación giratoria (R)', 'Une dos eslabones y permite un giro alrededor de un eje. Su variable es un ángulo $\\theta$.'],
    ['Articulación prismática (P)', 'Permite un desplazamiento lineal a lo largo de una guía. Su variable es una distancia $d$.'],
    ['Límite articular', 'Ángulo mínimo y máximo que la articulación puede alcanzar sin chocar consigo misma ni con otra pieza.'],
    ['Codificador (encoder)', 'Sensor que mide la posición del eje. El del STS3215 es magnético de 12 bits: 4096 pasos por vuelta.'],
    ['Servomotor', 'Motor, reductora, codificador y controlador en una sola caja: recibe un ángulo y lo sostiene.'],
  ],
  referencias: [
    'Craig, J. J. <i>Introduction to Robotics: Mechanics and Control</i>, cap. 3 (tipos de articulación y cadenas cinemáticas).',
    'Hoja de datos del fabricante: Feetech STS3215, servomotor de bus serie con codificador magnético de 12 bits.',
    'docs/09 del repositorio: cómo se fijó el cero de cada servo en 2048 pasos.',
  ],
  pasos: [
    {
      titulo: 'Giratoria o lineal',
      texto: 'Casi todas las articulaciones de los robots son de dos tipos: <b>giratorias</b> (R), que rotan, y <b>prismáticas</b> (P), que se deslizan. Las cinco del SO-ARM100 son giratorias.',
      preparar(app, cuerpo) {
        cuerpo.append(figura(TIPOS));
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        return animar((t) => {
          q[0] = 0.3 + 0.5 * Math.sin(t * 0.9);
          app.escena.fijarPostura(q);
          app.escena.resaltar('Shoulder_Rotation');
        });
      },
      detalle: `<p>Una <b>articulación</b> une dos eslabones y deja libre un solo movimiento. Los dos tipos básicos son:</p>
<ul><li><b>Giratoria o de revolución (R):</b> los eslabones giran uno respecto del otro alrededor de un eje, como una bisagra. La variable articular es un ángulo $\\theta$.</li>
<li><b>Prismática o lineal (P):</b> un eslabón se desliza sobre el otro a lo largo de una guía, como un cajón. La variable es una distancia $d$.</li></ul>
<p>Con estas letras se nombra la estructura de un robot, de la base a la punta:</p>
<table><tr><th>Robot</th><th>Estructura</th><th>Dónde se usa</th></tr>
<tr><td>Cartesiano (pórtico)</td><td>PPP</td><td>Impresoras 3D, fresadoras, paletizado de gran tamaño</td></tr>
<tr><td>SCARA</td><td>RRPR</td><td>Montaje rápido de piezas pequeñas sobre una mesa</td></tr>
<tr><td>Articulado de 6 ejes</td><td>RRRRRR</td><td>Soldadura, pintura, manipulación general</td></tr>
<tr><td><b>SO-ARM100</b></td><td><b>RRRRR</b> + pinza</td><td>Enseñanza e investigación</td></tr></table>
<p>La pinza también gira (su mandíbula móvil), pero no cambia dónde está la punta: es la <b>herramienta</b>, no un grado de libertad del brazo.</p>
<p>Hay articulaciones con más de un movimiento, como la rótula (3 giros), pero en robótica se modelan como varias articulaciones de un grado seguidas.</p>`,
    },
    {
      titulo: 'Cada articulación tiene límites',
      texto: 'Elija una articulación y muévala. El arco muestra <b>todo el giro permitido</b>; las líneas grises son los topes. Pasar de ahí haría chocar las piezas o forzaría los cables.',
      preparar(app, cuerpo) {
        const q = POSE.slice();
        let actual = 'Elbow';
        let dibujo = [];
        const lectura = el('div', { class: 'lectura-leccion' });
        const desl = deslizador('', { min: -2, max: 2, paso: 0.01, valor: q[2], formato: (v) => `${grados(v).toFixed(0)}°`, alCambiar: (v) => { q[BRAZO.indexOf(actual)] = v; pintar(); } });
        const pintar = () => {
          dibujo.forEach((o) => o.removeFromParent());
          app.escena.fijarPostura(q);
          app.escena.resaltar(actual);
          dibujo = arcoLimites(app, actual, q);
          const j = app.modelo.juntas.find((x) => x.nombre === actual);
          lectura.textContent = `${NOMBRE[actual]}: ${grados(q[BRAZO.indexOf(actual)]).toFixed(0)}°   límite ${grados(j.limite[0]).toFixed(0)}° a ${grados(j.limite[1]).toFixed(0)}° (URDF: ${grados(j.limite_urdf[0]).toFixed(0)}° a ${grados(j.limite_urdf[1]).toFixed(0)}°)`;
        };
        const elegir = (n) => {
          actual = n;
          const j = app.modelo.juntas.find((x) => x.nombre === n);
          const r = desl.querySelector('input');
          r.min = j.limite[0]; r.max = j.limite[1];
          desl.fijar(q[BRAZO.indexOf(n)]);
          desl.querySelector('.desl-etq').textContent = NOMBRE[n];
          pintar();
        };
        cuerpo.append(el('div', { class: 'fila', style: 'flex-wrap:wrap;gap:6px' },
          ...BRAZO.map((n) => el('button', { class: 'boton pequeno', onclick: () => elegir(n) }, NOMBRE[n]))), desl, lectura);
        elegir('Elbow');
      },
      detalle: (app) => `<p>Cada articulación tiene un <b>rango</b>: un ángulo mínimo y uno máximo. En el URDF se declara con <code>&lt;limit lower="…" upper="…"/&gt;</code> en radianes. La aplicación y la teleoperación usan límites un poco más estrechos (los de <code>teleop_v13.py</code>), para no llegar nunca al tope mecánico:</p>
<table><tr><th>Articulación</th><th>URDF</th><th>Usado por el proyecto</th></tr>
${BRAZO.map((n) => { const j = app.modelo.juntas.find((x) => x.nombre === n); return `<tr><td>${NOMBRE[n]}</td><td>${grados(j.limite_urdf[0]).toFixed(1)}° a ${grados(j.limite_urdf[1]).toFixed(1)}°</td><td>${grados(j.limite[0]).toFixed(1)}° a ${grados(j.limite[1]).toFixed(1)}°</td></tr>`; }).join('')}</table>
<p>Por qué existen los límites:</p>
<ul><li><b>Choques internos:</b> a partir de cierto ángulo, un eslabón toca al anterior.</li>
<li><b>Cables:</b> los cables del bus pasan por las articulaciones; más giro los estira.</li>
<li><b>Posturas inútiles o peligrosas:</b> el codo doblado del todo hacia atrás no sirve para trabajar y acerca la pinza a la base.</li></ul>
<p>Los límites definen el <b>espacio articular</b>: el conjunto de todas las combinaciones de ángulos permitidas, que es una «caja» de 5 dimensiones. La lección 3 muestra a qué región del espacio corresponde esa caja.</p>`,
    },
    {
      titulo: 'Cómo mide el servo su ángulo',
      texto: 'Dentro del STS3215 hay un <b>codificador magnético de 12 bits</b>: divide la vuelta en $2^{12} = 4096$ pasos. El proyecto toma <b>2048 pasos como 0°</b>. Mueva el ángulo y vea la lectura.',
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        app.escena.resaltar('Elbow');
        const svg = el('div', { class: 'figura-leccion' });
        const lectura = el('div', { class: 'lectura-leccion' });
        const pintar = (th) => {
          q[2] = th;
          app.escena.fijarPostura(q);
          const pasos = Math.round(2048 + (th * 4096) / (2 * Math.PI));
          const recon = ((pasos - 2048) * 2 * Math.PI) / 4096;
          const a = -th + Math.PI / 2;               // en la esfera, 0 rad arriba
          const x = 90 + 60 * Math.cos(a), y = 90 - 60 * Math.sin(a);
          let marcas = '';
          for (let k = 0; k < 64; k++) { const b = (k / 64) * 2 * Math.PI; marcas += `<line x1="${90 + 66 * Math.cos(b)}" y1="${90 - 66 * Math.sin(b)}" x2="${90 + (k % 8 ? 70 : 75) * Math.cos(b)}" y2="${90 - (k % 8 ? 70 : 75) * Math.sin(b)}" stroke="#8f879a"/>`; }
          svg.innerHTML = `<svg viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif">
            <circle cx="90" cy="90" r="64" fill="#150f23" stroke="#362d59" stroke-width="2"/>${marcas}
            <text x="90" y="10" fill="#bdb8c0" font-size="11" text-anchor="middle">2048 = 0°</text>
            <line x1="90" y1="90" x2="${x}" y2="${y}" stroke="#ffb287" stroke-width="4" stroke-linecap="round"/>
            <circle cx="90" cy="90" r="7" fill="#fd44b0"/>
            <text x="190" y="50" fill="#fff" font-size="15">Ángulo pedido: <tspan font-family="IBM Plex Mono" fill="#ffb287">${grados(th).toFixed(3)}°</tspan></text>
            <text x="190" y="80" fill="#fff" font-size="15">Lectura del codificador: <tspan font-family="IBM Plex Mono" fill="#c2ef4e">${pasos} pasos</tspan></text>
            <text x="190" y="110" fill="#fff" font-size="15">Ángulo que se reconstruye: <tspan font-family="IBM Plex Mono">${grados(recon).toFixed(3)}°</tspan></text>
            <text x="190" y="140" fill="#bdb8c0" font-size="13">Error de cuantización: ${(grados(th - recon)).toFixed(3)}° (máximo ±0,044°)</text>
          </svg>`;
          lectura.textContent = `pasos = 2048 + θ · 4096 / 360°   →   un paso = 360° / 4096 = 0,0879°`;
        };
        cuerpo.append(svg, deslizador('Ángulo del codo', { min: -1.49, max: 1.49, paso: 0.0005, valor: q[2], formato: (v) => `${grados(v).toFixed(2)}°`, alCambiar: pintar }), lectura);
        pintar(q[2]);
      },
      detalle: `<p>Un <b>servomotor de bus serie</b> como el Feetech STS3215 reúne cuatro piezas en una caja:</p>
<ol><li>un motor de corriente continua,</li><li>una <b>reductora</b> de engranajes que multiplica el par y reduce la velocidad,</li><li>un <b>codificador magnético</b>: un imán en el eje de salida y un sensor que mide la dirección de su campo,</li><li>un microcontrolador que compara el ángulo pedido con el medido y alimenta el motor (lección 12).</li></ol>
<p>El codificador es de 12 bits, así que distingue $2^{12} = 4096$ posiciones por vuelta. La <b>resolución</b> es</p>
$$\\Delta\\theta = \\frac{360^\\circ}{4096} = 0{,}0879^\\circ$$
<p>En el proyecto, el cero mecánico del modelo corresponde a <b>2048 pasos</b>, la mitad de la vuelta. El controlador de ros2_control convierte con</p>
$$\\theta\\,[\\text{rad}] = (\\text{pasos} - 2048)\\,\\frac{2\\pi}{4096}$$
<p>Por eso, antes de montar cada servo en su eslabón, se llevó a 2048 pasos (orden <code>centrar</code> o botón <b>Centrar</b> en Sesión). Si un servo se monta con el eje desplazado un diente del estriado, todo su ángulo queda corrido: lo trata la lección 16.</p>
<p><b>Resolución no es precisión.</b> El codificador distingue 0,09°, pero el ensayo A1 midió que el hombro queda en promedio a 1,5° de lo pedido: el error viene de la carga y del controlador, no del sensor.</p>`,
    },
    {
      titulo: 'Un servo es un lazo de control',
      texto: 'El servo recibe un <b>ángulo deseado</b>, lo compara con el que mide su codificador y mueve el motor hasta que la diferencia se anula. Esto se llama <b>lazo cerrado</b>.',
      preparar(app, cuerpo) {
        cuerpo.append(figura(`<svg viewBox="0 0 560 150" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="13">
          <defs><marker id="f2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#bdb8c0"/></marker></defs>
          <text x="10" y="58" fill="#fff">θ deseado</text><line x1="72" y1="54" x2="98" y2="54" stroke="#bdb8c0" marker-end="url(#f2)"/>
          <circle cx="112" cy="54" r="13" fill="none" stroke="#fff"/><text x="106" y="59" fill="#fff">Σ</text>
          <line x1="125" y1="54" x2="158" y2="54" stroke="#bdb8c0" marker-end="url(#f2)"/><text x="130" y="46" fill="#ffb287" font-size="11">error</text>
          <rect x="160" y="34" width="100" height="40" rx="6" fill="#422082"/><text x="210" y="58" fill="#fff" text-anchor="middle">Controlador</text>
          <line x1="260" y1="54" x2="288" y2="54" stroke="#bdb8c0" marker-end="url(#f2)"/>
          <rect x="290" y="34" width="80" height="40" rx="6" fill="#422082"/><text x="330" y="58" fill="#fff" text-anchor="middle">Motor</text>
          <line x1="370" y1="54" x2="398" y2="54" stroke="#bdb8c0" marker-end="url(#f2)"/>
          <rect x="400" y="34" width="86" height="40" rx="6" fill="#422082"/><text x="443" y="58" fill="#fff" text-anchor="middle">Reductora</text>
          <line x1="486" y1="54" x2="540" y2="54" stroke="#bdb8c0" marker-end="url(#f2)"/><text x="494" y="46" fill="#fff" font-size="11">θ real</text>
          <line x1="515" y1="54" x2="515" y2="118" stroke="#bdb8c0"/>
          <rect x="300" y="100" width="130" height="36" rx="6" fill="#150f23" stroke="#c2ef4e"/><text x="365" y="123" fill="#c2ef4e" text-anchor="middle">Codificador</text>
          <line x1="515" y1="118" x2="432" y2="118" stroke="#bdb8c0" marker-end="url(#f2)"/>
          <line x1="300" y1="118" x2="112" y2="118" stroke="#bdb8c0"/><line x1="112" y1="118" x2="112" y2="69" stroke="#bdb8c0" marker-end="url(#f2)"/>
          <text x="118" y="92" fill="#fd44b0">−</text></svg>`));
        const q = POSE.slice();
        app.escena.resaltar('Elbow');
        let objetivo = -0.45, real = -0.45, v = 0;
        const lectura = el('div', { class: 'lectura-leccion' });
        cuerpo.append(el('div', { class: 'fila', style: 'gap:6px' },
          el('button', { class: 'boton pequeno', onclick: () => { objetivo = 0.4; } }, 'Pedir +23°'),
          el('button', { class: 'boton pequeno', onclick: () => { objetivo = -0.45; } }, 'Pedir −26°'),
          el('button', { class: 'boton pequeno', onclick: () => { objetivo = -1.2; } }, 'Pedir −69°')), lectura);
        let tPrev = 0;
        return animar((t) => {
          const dt = Math.min(0.05, t - tPrev); tPrev = t;
          // Modelo sencillo: el controlador acelera hacia el objetivo y frena al llegar.
          const e = objetivo - real;
          v += (18 * e - 7 * v) * dt;
          real += v * dt;
          q[2] = real;
          app.escena.fijarPostura(q);
          lectura.textContent = `deseado ${grados(objetivo).toFixed(1)}°   medido ${grados(real).toFixed(1)}°   error ${grados(e).toFixed(1)}°`;
        });
      },
      detalle: `<p>El esquema de la figura se repite en toda la automatización: una <b>consigna</b> (el ángulo deseado), un <b>controlador</b> que calcula cuánto mover el motor a partir del <b>error</b> y un <b>sensor</b> que cierra el lazo.</p>
<p>En el SO-ARM100 hay dos lazos anidados:</p>
<ul><li><b>Dentro de cada servo</b>, el lazo de posición del microcontrolador corre a alta frecuencia con el codificador.</li>
<li><b>Fuera</b>, ros2_control envía a los servos los puntos de una trayectoria por el bus serie; el controlador <code>JointTrajectoryController</code> decide qué ángulo pedir en cada instante.</li></ul>
<p>Que el ángulo medido no llegue del todo al pedido cuando el brazo carga peso (error de estado estacionario) es típico de un controlador con mucha acción proporcional y poca integral. Se estudia en la lección 12, con la respuesta al escalón medida en el ensayo A5.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Dos preguntas rápidas sobre el codificador.',
      pregunta: {
        enunciado: 'Un servo de 4096 pasos por vuelta marca <b>2560 pasos</b>. Con el cero en 2048, ¿qué ángulo tiene?',
        opciones: ['$22{,}5^\\circ$', '$45^\\circ$', '$90^\\circ$', '$2560^\\circ$'],
        correcta: 1,
        pista: 'Reste el cero y multiplique por 360°/4096.',
        explicacion: '$(2560 - 2048) \\cdot 360^\\circ / 4096 = 512 \\cdot 0{,}0879^\\circ = 45^\\circ$.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0, 0.785, 0, 0, 0.5]); app.escena.resaltar('Elbow'); },
    },
    {
      titulo: 'Una más',
      texto: 'Piense en el tipo de articulación.',
      pregunta: {
        enunciado: 'Un robot SCARA mueve la herramienta arriba y abajo con una sola articulación. ¿De qué tipo es?',
        opciones: ['Giratoria (R)', 'Prismática (P)', 'Rótula', 'Ninguna: lo hace la pinza'],
        correcta: 1,
        explicacion: 'Su estructura es RRPR: dos giros en el plano, un desplazamiento vertical (P) y un giro de la herramienta.',
      },
      preparar(app) { app.escena.fijarPostura(POSE); },
    },
  ],
};
