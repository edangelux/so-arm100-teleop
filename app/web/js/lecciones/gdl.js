// Lección 1: ¿qué es un robot manipulador? Eslabones, articulaciones y grados de libertad.
import * as THREE from 'three';
import { el, grados } from '../ui.js';
import { COLORES } from '../escena.js';

const BRAZO = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll'];
const NOMBRE = { Shoulder_Rotation: 'Giro de la base', Shoulder_Pitch: 'Hombro', Elbow: 'Codo', Wrist_Pitch: 'Flexión de muñeca', Wrist_Roll: 'Giro de muñeca', Gripper: 'Pinza' };
const POSE = [0.35, 0.35, -0.55, 0.45, 0, 0.5];

function animar(f) {
  let vivo = true;
  const t0 = performance.now();
  const paso = () => { if (!vivo) return; f((performance.now() - t0) / 1000); requestAnimationFrame(paso); };
  paso();
  return () => { vivo = false; };
}

function mini(app, q, alCambiar) {
  // Cinco deslizadores compactos que mueven el robot virtual.
  const cont = el('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;margin-top:6px' });
  BRAZO.forEach((n, i) => {
    const j = app.modelo.juntas.find((x) => x.nombre === n);
    const r = el('input', { type: 'range', min: j.limite[0], max: j.limite[1], step: 0.01, value: q[i] });
    r.addEventListener('input', () => { q[i] = +r.value; app.escena.fijarPostura(q); alCambiar?.(); });
    r.addEventListener('pointerenter', () => app.escena.resaltar(n));
    r.addEventListener('pointerleave', () => app.escena.resaltar(null));
    cont.append(el('span', { style: 'font-size:12.5px;display:flex;align-items:center;gap:6px' },
      el('i', { style: `width:9px;height:9px;border-radius:3px;background:${COLORES[n]};display:inline-block` }), NOMBRE[n]), r);
  });
  return cont;
}

const BRAZO_HUMANO = `
<svg viewBox="0 0 460 190" class="figura" xmlns="http://www.w3.org/2000/svg" font-family="inherit">
  <text x="115" y="22" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="700">Su brazo · 7 GDL</text>
  <circle cx="40" cy="95" r="15" fill="none" stroke="#bdb8c0" stroke-width="2"/>
  <path d="M40 110 V170" stroke="#bdb8c0" stroke-width="2"/>
  <path d="M40 118 L100 118 L160 90 L200 78" stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="45" cy="118" r="9" fill="#fd44b0"/><text x="45" y="148" fill="#fd44b0" font-size="11" text-anchor="middle">Hombro 3</text>
  <circle cx="100" cy="118" r="8" fill="#ffb287"/><text x="100" y="148" fill="#ffb287" font-size="11" text-anchor="middle">Codo 1</text>
  <circle cx="130" cy="104" r="6" fill="#79628c"/><text x="130" y="76" fill="#bdb8c0" font-size="11" text-anchor="middle">Antebrazo 1</text>
  <circle cx="160" cy="90" r="8" fill="#7553ff"/><text x="178" y="120" fill="#7553ff" font-size="11" text-anchor="middle">Muñeca 2</text>
  <line x1="230" y1="30" x2="230" y2="175" stroke="#362d59"/>
  <text x="345" y="22" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="700">SO-ARM100 · 5 GDL</text>
  <rect x="265" y="160" width="60" height="10" rx="3" fill="#efefef"/>
  <path d="M295 160 L295 120 L330 80 L385 80 L420 70" stroke="#efefef" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="295" cy="160" r="7" fill="#fd44b0"/><text x="265" y="185" fill="#fd44b0" font-size="11">Base 1</text>
  <circle cx="295" cy="120" r="7" fill="#c2ef4e"/><text x="270" y="112" fill="#c2ef4e" font-size="11" text-anchor="end">Hombro 1</text>
  <circle cx="330" cy="80" r="7" fill="#ffb287"/><text x="330" y="66" fill="#ffb287" font-size="11" text-anchor="middle">Codo 1</text>
  <circle cx="385" cy="80" r="7" fill="#7553ff"/><text x="390" y="110" fill="#7553ff" font-size="11" text-anchor="middle">Muñeca 2</text>
</svg>`;

export default {
  titulo: 'Grados de libertad',
  resumen: 'Qué es un robot manipulador, qué es una articulación y por qué este brazo tiene 5 grados de libertad.',
  conceptos: [
    ['Eslabón', 'Cada pieza rígida del brazo. No se deforma: sólo se mueve con la articulación que la sostiene.'],
    ['Articulación', 'La unión entre dos eslabones que permite un movimiento. Aquí todas giran, como una bisagra.'],
    ['Grado de libertad (GDL)', 'Cada movimiento independiente. El número de GDL es cuántos números hacen falta para describir la postura completa.'],
    ['Efector final', 'Lo que el robot usa para trabajar: aquí, la pinza. Su posición es lo que casi siempre interesa.'],
    ['Espacio articular', 'Describir la postura con los ángulos de cada articulación (5 números).'],
  ],
  referencias: [
    'Craig, J. J. (2018). <i>Introduction to Robotics: Mechanics and Control</i>, 4.ª ed. Pearson. Capítulo 1.',
    'Lynch, K. M. y Park, F. C. (2017). <i>Modern Robotics</i>. Cambridge University Press. Capítulo 2 (grados de libertad y fórmula de Grübler).',
    'TheRobotStudio, <i>SO-ARM100</i>, repositorio del diseño mecánico (Apache 2.0).',
  ],
  pasos: [
    {
      titulo: 'Un robot es una cadena',
      texto: 'Piezas rígidas (<b>eslabones</b>) unidas por <b>articulaciones</b>, desde la base hasta la <b>pinza</b>. Mire cómo se ilumina cada una.',
      preparar(app) {
        app.escena.verEtiquetas(true);
        app.escena.fijarPostura(POSE);
        const orden = [...BRAZO, 'Gripper'];
        return animar((t) => app.escena.resaltar(orden[Math.floor(t / 0.9) % orden.length]));
      },
      detalle: `<p>Un <b>robot manipulador</b> es una <b>cadena cinemática abierta</b>: una sucesión de cuerpos rígidos (<b>eslabones</b>) unidos de dos en dos por <b>articulaciones</b>, que empieza en una base fija y termina en una herramienta libre (el <b>efector final</b>).</p>
<p>En el SO-ARM100 la cadena es:</p>
<table><tr><th>Eslabón</th><th>Articulación que lo mueve</th></tr>
<tr><td>Base (fija a la mesa)</td><td>—</td></tr>
<tr><td>Hombro giratorio</td><td>Giro de la base</td></tr>
<tr><td>Brazo superior</td><td>Hombro</td></tr>
<tr><td>Antebrazo</td><td>Codo</td></tr>
<tr><td>Muñeca</td><td>Flexión de muñeca</td></tr>
<tr><td>Pinza (dedo fijo)</td><td>Giro de muñeca</td></tr>
<tr><td>Dedo móvil</td><td>Pinza</td></tr></table>
<p>«Abierta» significa que cada eslabón cuelga sólo del anterior: no hay lazos cerrados, como sí los hay en un robot paralelo (por ejemplo, un robot delta de las líneas de empaque). Por eso un error en una articulación cercana a la base se propaga a todo lo que viene después, un tema que vuelve en las lecciones de calibración y de ensayos.</p>
<p>Cada articulación es un <b>servo STS3215</b>: un motor, una reductora, un codificador magnético y un controlador en la misma caja. El modelo 3D que se ve aquí se construye con las mallas y las medidas del URDF del proyecto, el mismo archivo que usan ROS 2, Gazebo y MoveIt.</p>`,
    },
    {
      titulo: 'Una articulación, un movimiento',
      texto: 'El <b>codo</b> sólo puede girar alrededor de su eje (la flecha). Basta <b>un número</b>, su ángulo, para saber dónde está: aporta <b>1 grado de libertad</b>.',
      preparar(app, cuerpo) {
        app.escena.verEtiquetas(false);
        app.escena.resaltar('Elbow');
        const lectura = el('div', { class: 'contador' }, '0°');
        cuerpo.append(lectura);
        const q = POSE.slice();
        return animar((t) => {
          q[2] = -0.55 + 0.6 * Math.sin(t * 1.4);
          app.escena.fijarPostura(q);
          app.escena.resaltar('Elbow');
          lectura.textContent = `Codo: ${grados(q[2]).toFixed(0)}°`;
        });
      },
      detalle: `<p>Una articulación <b>de revolución</b> (giratoria) deja girar un eslabón respecto del anterior alrededor de un eje fijo, como una bisagra. El movimiento queda descrito por <b>un solo número</b>, el ángulo $q$, así que la articulación aporta <b>un grado de libertad</b>.</p>
<p>Un cuerpo rígido suelto en el espacio tiene <b>6 grados de libertad</b>: tres traslaciones (x, y, z) y tres rotaciones. Una articulación de revolución le quita cinco y le deja uno. Otras articulaciones dejan más: una <b>esférica</b> (como el hombro humano) deja tres; una <b>prismática</b> (lineal) deja una traslación.</p>
<p>En el codo del SO-ARM100, la aplicación limita el ángulo a ±85° (±1,49 rad) respecto del cero del modelo. El ángulo lo mide el codificador del servo en <b>4096 pasos por vuelta</b>, es decir, $360°/4096 \\approx 0{,}088°$ por paso; la lección 2 explica cómo.</p>`,
    },
    {
      titulo: 'Encuentre las articulaciones',
      texto: 'Haga clic en cada pieza del robot para descubrir qué articulación la mueve. ¿Cuántas mueven el <b>brazo</b>?',
      reto: true,
      preparar(app, cuerpo, listo) {
        app.escena.fijarPostura(POSE);
        const halladas = new Set();
        const cont = el('div', { class: 'contador' }, '0 / 5');
        const chips = el('div', { class: 'fila', style: 'flex-wrap:wrap;gap:6px;margin-top:8px' });
        cuerpo.append(cont, chips);
        app.escena.alClicArticulacion = (n) => {
          if (!n || n === 'base_link_joint') return;
          app.escena.resaltar(n);
          if (halladas.has(n)) return;
          halladas.add(n);
          chips.append(el('span', { class: 'chip', style: `border-color:${COLORES[n]};color:${COLORES[n]}` }, NOMBRE[n]));
          const brazo = [...halladas].filter((x) => BRAZO.includes(x)).length;
          cont.textContent = `${brazo} / 5`;
          if (n === 'Gripper') chips.append(el('span', { class: 'nota' }, ' La pinza también gira, pero no mueve el brazo: es la herramienta.'));
          if (brazo === 5) { cont.textContent = '¡5 GDL!'; listo(); }
        };
        return () => { app.escena.alClicArticulacion = null; };
      },
      detalle: `<p>Los <b>grados de libertad</b> de un mecanismo se pueden contar con la fórmula de <b>Grübler–Kutzbach</b>. Para un mecanismo espacial con $N$ eslabones (contando la base), $J$ articulaciones y $f_i$ grados de libertad en cada una:</p>
$$M = 6\\,(N - 1 - J) + \\sum_{i=1}^{J} f_i$$
<p>Para el brazo del SO-ARM100 sin contar la pinza: $N = 6$ (base y cinco eslabones), $J = 5$ articulaciones de revolución con $f_i = 1$:</p>
$$M = 6\\,(6 - 1 - 5) + 5 = 5$$
<p>En una cadena abierta el término entre paréntesis siempre vale cero, así que <b>los GDL son la suma de los GDL de las articulaciones</b>. La fórmula se vuelve interesante en los mecanismos con lazos cerrados, donde cada lazo resta grados.</p>
<p>La pinza agrega una sexta articulación, pero no cambia dónde está ni hacia dónde apunta la herramienta: sólo abre y cierra los dedos. Por eso se dice que el SO-ARM100 es un brazo de <b>5 GDL con pinza</b>, y la configuración de MoveIt del proyecto lo modela con dos grupos: <code>arm</code> (cinco articulaciones) y <code>gripper</code> (una).</p>`,
    },
    {
      titulo: 'Cinco números, una postura',
      texto: 'Cada deslizador cambia <b>una sola</b> articulación. Con estos 5 números queda definida toda la postura del brazo: eso es tener <b>5 GDL</b>.',
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const pos = el('div', { class: 'nota', style: 'font-family:var(--mono);margin-top:6px' });
        const leer = () => { const p = app.cadena.efector(q); pos.textContent = `Pinza en x ${(p.x * 1000).toFixed(0)}  y ${(p.y * 1000).toFixed(0)}  z ${(p.z * 1000).toFixed(0)} mm`; };
        cuerpo.append(mini(app, q, leer), pos);
        leer();
      },
      detalle: `<p>Los cinco ángulos $q = (q_1, q_2, q_3, q_4, q_5)$ forman un punto del <b>espacio articular</b>. Cada combinación dentro de los límites es una postura, y cada postura tiene una única posición y orientación de la pinza: eso es la <b>cinemática directa</b> (lección 6).</p>
<p>La pinza, en cambio, vive en el <b>espacio cartesiano</b>: su posición $(x, y, z)$ y su orientación. Para describir por completo la pose de un objeto en el espacio hacen falta 6 números; con 5 articulaciones el brazo sólo puede elegir 5 de ellos. En el SO-ARM100 lo que no se puede elegir libremente es una de las rotaciones: la pinza siempre apunta dentro del plano vertical que contiene el eje de la base (lección 3).</p>
<p>Consecuencias prácticas de tener 5 GDL:</p>
<ul><li>Muchos puntos se alcanzan, pero no con cualquier orientación.</li>
<li>Para tomar un objeto de lado hay que girar la base hasta que el objeto quede en el plano del brazo.</li>
<li>Los programas de la pestaña Programar describen cada punto con cinco números, <code>[x, y, z, cabeceo, giro]</code>, en lugar de los seis de un robot industrial.</li></ul>`,
    },
    {
      titulo: 'Su brazo tiene 7',
      texto: 'Su brazo tiene <b>7 GDL</b>; el robot, <b>5</b>. Por eso la teleoperación no puede copiar todas sus posturas: al robot le faltan dos movimientos.',
      preparar(app, cuerpo) {
        cuerpo.append(el('div', { html: BRAZO_HUMANO }));
        app.escena.fijarPostura(POSE);
      },
      detalle: `<p>El brazo humano, del hombro a la muñeca, tiene <b>7 grados de libertad</b>:</p>
<table><tr><th>Articulación</th><th>GDL</th><th>Movimientos</th></tr>
<tr><td>Hombro</td><td>3</td><td>flexión, abducción y rotación del brazo</td></tr>
<tr><td>Codo</td><td>1</td><td>flexión</td></tr>
<tr><td>Antebrazo y muñeca</td><td>3</td><td>pronación–supinación, flexión y desviación lateral</td></tr></table>
<p>Con 7 GDL para fijar 6 números de la pose de la mano, sobra uno: el brazo humano es <b>redundante</b>. Por eso se puede mantener la mano quieta sobre la mesa y mover el codo: hay infinitas posturas para la misma pose de la mano. Algunos robots industriales y colaborativos también tienen 7 ejes por esa razón.</p>
<p>El SO-ARM100 tiene 5. La teleoperación del proyecto copia <b>ángulos</b>, no la pose de la mano: el hombro humano da el giro de la base y la elevación del hombro del robot, el codo da el codo, la muñeca da la flexión y el giro de la muñeca. La desviación lateral de la muñeca y la rotación del brazo humano no tienen dónde ir, y el sistema las ignora. La lección 14 explica cómo se calculan esos ángulos a partir de la cámara.</p>`,
    },
    {
      titulo: 'Reto: toque la esfera',
      texto: 'Mueva las articulaciones hasta que la pinza toque la <b>esfera lima</b> (a menos de 15 mm).',
      reto: true,
      preparar(app, cuerpo, listo) {
        const qMeta = [0.7, 0.45, -0.35, -0.3, 0];
        const meta = app.cadena.efector(qMeta);
        const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.015, 32, 16),
          new THREE.MeshStandardMaterial({ color: 0xc2ef4e, emissive: 0x4a5c14, transparent: true, opacity: 0.85 }));
        esfera.position.copy(meta);
        app.escena.extras.add(esfera);
        const q = [0, 0, 0, 0, 0, 0];
        app.escena.fijarPostura(q);
        const d = el('div', { class: 'contador' }, '— mm');
        let hecho = false;
        const medir = () => {
          const dist = app.cadena.efector(q).distanceTo(meta) * 1000;
          d.textContent = `${dist.toFixed(0)} mm`;
          if (dist < 15 && !hecho) { hecho = true; d.textContent = '¡Lo logró!'; esfera.material.color.set(0xfa7faa); listo(); }
        };
        cuerpo.append(d, mini(app, q, medir));
        medir();
        return () => app.escena.extras.remove(esfera);
      },
      detalle: `<p>Este reto es, sin fórmulas, el problema de la <b>cinemática inversa</b>: dado un punto, encontrar los ángulos que llevan la pinza hasta él. A mano se hace por prueba y error; la lección 7 muestra cómo lo resuelve un robot en milisegundos.</p>
<p>Estrategia que suele funcionar:</p>
<ol><li>Girar la <b>base</b> hasta que la esfera quede en el plano del brazo.</li>
<li>Ajustar <b>hombro</b> y <b>codo</b> para acercar la muñeca a la distancia y la altura correctas.</li>
<li>Terminar con la <b>flexión de muñeca</b>, que mueve la punta poco y con precisión.</li></ol>
<p>El orden no es casual: las articulaciones cercanas a la base mueven la punta mucho por cada grado (el hombro está a unos 30 cm de la punta) y las de la muñeca poco. Es la misma idea que el <b>jacobiano</b> de la lección 8 y que el jog de la pestaña Programar.</p>`,
    },
  ],
};
