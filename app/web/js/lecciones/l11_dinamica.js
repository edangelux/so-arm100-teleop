// Lección 11: dinámica. Masas y centros de masa del URDF, par por gravedad
// en cada postura, carga útil y comparación con el ensayo A3.
import * as THREE from 'three';
import { el } from '../ui.js';
import { mini, esfera, etiqueta, barras, deslizador, lectura, formula, BRAZO, NOMBRE, grados } from './comun.js';

const PAR_MAX = 1.86;          // N·m: par de bloqueo del STS3215 de 7,4 V según el fabricante (19 kg·cm)
const G = new THREE.Vector3(0, 0, -9.81);
const ESLABONES = ['Shoulder_Rotation_Pitch', 'Upper_Arm', 'Lower_Arm', 'Wrist_Pitch_Roll', 'Fixed_Gripper', 'Moving_Jaw'];
const DISTALES = { Shoulder_Rotation: 0, Shoulder_Pitch: 1, Elbow: 2, Wrist_Pitch: 3, Wrist_Roll: 4 };   // índice del primer eslabón que mueve
const POSES_A3 = { medio: [0, -0.9, 0.9, 0, 0], init: [0, 0, 0, 0, 0], extendido: [0, 0.5, -0.5, 0, 0] };
const MEDIDO = {   // esfuerzo medido en el ensayo A3 (resultados del 25 de septiembre de 2026), % hombro / codo
  0: { medio: [10.4, 4.8], init: [7.2, 19.2], extendido: [10.4, 18.5] },
  50: { medio: [12.8, 7.2], init: [8.8, 25.6], extendido: [12.0, 26.4] },
  227: { medio: [24.8, 11.2], init: [14.4, 39.2], extendido: [19.2, 50.4] },
};

// Par que cada articulación debe hacer para sostener el brazo (y una masa en la punta).
export function paresGravedad(app, q, carga = 0) {
  const M = app.cadena.marcosEslabones([...q.slice(0, 5), q[5] ?? 0.5]);
  const f = app.cadena.fk(q);
  const cdm = ESLABONES.map((n) => ({ n, m: app.modelo.eslabones[n].masa, c: new THREE.Vector3(...app.modelo.eslabones[n].cdm).applyMatrix4(M[n]) }));
  const punta = app.cadena.efector(q);
  return BRAZO.map((j) => {
    const junta = app.modelo.juntas.find((x) => x.nombre === j);
    const eje = new THREE.Vector3(...junta.eje).normalize().transformDirection(f[j]);
    const p = new THREE.Vector3().setFromMatrixPosition(f[j]);
    let tau = 0;
    for (const e of cdm.slice(DISTALES[j])) tau += e.c.clone().sub(p).cross(G.clone().multiplyScalar(e.m)).dot(eje);
    tau += punta.clone().sub(p).cross(G.clone().multiplyScalar(carga)).dot(eje);
    return -tau;                  // lo que tiene que aportar el motor
  });
}

export default {
  titulo: 'Dinámica',
  resumen: 'Qué pares tienen que hacer los servos para sostener y mover el brazo, calculados con las masas del URDF y comparados con lo que midió el ensayo de carga.',
  conceptos: [
    ['Centro de masa', 'Punto donde se puede considerar concentrado el peso de un eslabón. El URDF lo declara en <code>&lt;inertial&gt;&lt;origin&gt;</code>.'],
    ['Par por gravedad $g(q)$', 'El par que cada articulación necesita sólo para sostener el brazo quieto. Depende de la postura.'],
    ['Ecuación de movimiento', '$M(q)\\ddot{q} + C(q,\\dot{q})\\dot{q} + g(q) = \\tau$: inercia, efectos de velocidad y gravedad.'],
    ['Carga útil', 'La masa máxima que el robot puede manejar en la pinza sin superar el par de sus motores, con un margen.'],
    ['Par de bloqueo', 'El par máximo del motor con el eje detenido. Del STS3215 de 7,4 V: 19 kg·cm ≈ 1,86 N·m según el fabricante.'],
  ],
  referencias: [
    'Featherstone, R. <i>Rigid Body Dynamics Algorithms</i> (Newton–Euler recursivo).',
    'Hoja de datos Feetech STS3215 (7,4 V): par de bloqueo 19 kg·cm.',
    'pruebas/resultados/2026-09-25/resumen.md: ensayo A3 con 0, 50 y 227 g.',
    'docs/12 del repositorio: el balance de par de diseño y la especificación de 80 g a 0,30 m.',
  ],
  pasos: [
    {
      titulo: 'Dónde está el peso',
      texto: 'Cada esfera es el <b>centro de masa</b> de un eslabón, con su masa del URDF. El brazo móvil pesa unos 610 g; la base, 193 g más.',
      preparar(app, cuerpo) {
        const q = [0.3, 0.2, -0.4, 0.4, 0, 0.5];
        app.escena.fijarPostura(q);
        const M = app.cadena.marcosEslabones(q);
        let total = 0;
        for (const n of ['Base', ...ESLABONES]) {
          const e = app.modelo.eslabones[n];
          const c = new THREE.Vector3(...e.cdm).applyMatrix4(M[n]);
          esfera(app, c, 0.006 + e.masa * 0.06, 0xfd44b0, 0.9);
          etiqueta(app, `${(e.masa * 1000).toFixed(0)} g`, c.clone().add(new THREE.Vector3(0, 0, 0.022)));
          total += e.masa;
        }
        cuerpo.append(lectura(`masa total del modelo: ${(total * 1000).toFixed(0)} g   ·   sin la base: ${((total - app.modelo.eslabones.Base.masa) * 1000).toFixed(0)} g`));
      },
      detalle: (app) => `<p>El URDF declara para cada eslabón su <b>masa</b>, la posición de su <b>centro de masa</b> y su <b>tensor de inercia</b> (en <code>&lt;inertial&gt;</code>). Esos datos salen del modelo CAD y son los que usan Gazebo y cualquier cálculo dinámico:</p>
<table><tr><th>Eslabón</th><th>Masa</th></tr>
${['Base', ...ESLABONES].map((n) => `<tr><td>${n}</td><td>${(app.modelo.eslabones[n].masa * 1000).toFixed(1)} g</td></tr>`).join('')}</table>
<p>Un servo STS3215 pesa unos 55 g según el fabricante, así que buena parte de la masa de cada eslabón es el servo de la articulación siguiente. Es una característica de los brazos con los motores en las articulaciones: cada motor tiene que cargar con los que vienen después. Los robots industriales grandes llevan los motores de la muñeca atrás, cerca del hombro, y transmiten el giro con ejes o correas por esta misma razón.</p>`,
    },
    {
      titulo: 'El par por gravedad',
      texto: 'Mueva el brazo y agregue masa en la pinza. Las barras son el par que debe hacer cada servo sólo para <b>sostenerse</b>, comparado con su par de bloqueo (1,86 N·m).',
      ancho: true,
      preparar(app, cuerpo) {
        const q = [0, 0, 0, 0, 0, 0.5];
        app.escena.fijarPostura(q);
        let carga = 0;
        const b = barras([]);
        const act = () => {
          const t = paresGravedad(app, q, carga);
          b.fijar(BRAZO.slice(0, 4).map((n, i) => ({ etq: NOMBRE[n], frac: Math.abs(t[i]) / PAR_MAX, texto: `${Math.abs(t[i]).toFixed(2)} N·m · ${(100 * Math.abs(t[i]) / PAR_MAX).toFixed(0)} %` })));
        };
        cuerpo.append(formula('\\tau_i = \\hat{z}_i \\cdot \\sum_{k \\,\\ge\\, i} (c_k - p_i) \\times m_k\\,\\vec{g}'),
          deslizador('Masa en la pinza', { min: 0, max: 0.3, paso: 0.001, valor: 0, formato: (x) => `${(x * 1000).toFixed(0)} g`, alCambiar: (x) => { carga = x; act(); } }),
          b, mini(app, q, act, { articulaciones: ['Shoulder_Pitch', 'Elbow', 'Wrist_Pitch'] }));
        act();
      },
      detalle: `<p>Con el brazo quieto, cada articulación tiene que equilibrar el peso de <b>todo lo que tiene delante</b>. El par de un peso respecto de un eje es fuerza por brazo de palanca, que en forma vectorial es un producto cruz proyectado sobre el eje:</p>
$$\\tau_i = \\hat{z}_i \\cdot \\sum_{k \\ge i} (c_k - p_i) \\times m_k\\,\\vec{g} \\;+\\; \\hat{z}_i \\cdot (p_{\\text{punta}} - p_i) \\times m_{\\text{carga}}\\,\\vec{g}$$
<p>donde $p_i$ es un punto del eje $i$, $c_k$ el centro de masa del eslabón $k$ y $\\vec{g} = (0, 0, -9{,}81)$ m/s². Observe en la figura:</p>
<ul><li>El <b>giro de la base</b> no carga peso: su eje es vertical y la gravedad es paralela a él.</li>
<li>El <b>hombro</b> es el más cargado cuando el brazo está horizontal: sostiene todo con el mayor brazo de palanca.</li>
<li>Con el brazo recogido (<code>home</code>), el centro de masa queda casi sobre el eje del hombro y su par cae prácticamente a cero (0,03 N·m). Por eso <code>home</code> es la postura de apagado: si el servo pierde el par, el brazo no cae con fuerza.</li></ul>
<p>Este cálculo es el término $g(q)$ de la ecuación de movimiento completa. El proyecto hizo un balance equivalente en su diseño (docs/12), del que salió la especificación de <b>80 g a 0,30 m</b>.</p>`,
    },
    {
      titulo: 'Modelo contra medición',
      texto: 'El ensayo A3 sostuvo 0, 50 y <b>227 g</b> en tres posturas. La tabla compara el par del modelo con el <b>esfuerzo</b> que informaron los servos. Las tendencias coinciden en el codo; en el hombro, no.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura([0, 0.5, -0.5, 0, 0, 0.5]);
        const filas = [];
        for (const g of [0, 50, 227]) for (const [pose, q] of Object.entries(POSES_A3)) {
          const t = paresGravedad(app, q, g / 1000);
          const [mh, mc] = MEDIDO[g][pose];
          filas.push(`<tr><td>${g} g</td><td>${pose}</td><td>${(100 * Math.abs(t[1]) / PAR_MAX).toFixed(0)} %</td><td>${mh} %</td><td>${(100 * Math.abs(t[2]) / PAR_MAX).toFixed(0)} %</td><td>${mc} %</td></tr>`);
        }
        cuerpo.append(el('div', { class: 'texto-largo', html: `<table><tr><th>Carga</th><th>Postura</th><th>Hombro, modelo</th><th>Hombro, medido</th><th>Codo, modelo</th><th>Codo, medido</th></tr>${filas.join('')}</table>` }),
          el('div', { class: 'nota' }, 'Modelo: par por gravedad ÷ 1,86 N·m. Medido: esfuerzo que informa el servo (registro de carga), en el ensayo del 25 de septiembre de 2026.'));
      },
      detalle: `<p>El ensayo A3 llevó el brazo a tres posturas (<code>medio</code>, <code>init</code> y <code>extendido</code>) y registró el esfuerzo de cada servo sin carga, con 50 g y con <b>227 g</b> en la pinza (la especificación de diseño era 80 g; la masa disponible fue de 227 g, casi el triple). Lo que muestra la comparación:</p>
<ul><li><b>El brazo sostuvo 227 g en las tres posturas</b>, con el codo como articulación más exigida (50 % de esfuerzo en <code>extendido</code>) y un error de posición de hasta 5,5° en el codo. Es un resultado mejor que la especificación de diseño.</li>
<li>En el <b>codo</b>, el modelo y la medición siguen la misma tendencia: el esfuerzo crece con la carga (en <code>init</code>, el modelo da 26, 33 y 60 %, y el servo informó 19, 26 y 39 %). En las tres posturas del ensayo el antebrazo queda horizontal, así que el modelo da el mismo par en las tres.</li>
<li>En el <b>hombro</b>, el servo informó mucho menos esfuerzo que el que predice el modelo (por ejemplo 7 % frente a 31 % en <code>init</code> sin carga).</li></ul>
<p>La diferencia del hombro no invalida el modelo: el «esfuerzo» que informa el STS3215 es una lectura de <b>carga</b> derivada de la corriente del motor, no un sensor de par. Con una reductora de alta relación, la <b>fricción de los engranajes</b> ayuda a sostener cargas estáticas, y el motor puede necesitar poca corriente para mantener una postura aunque el par en la salida sea grande. Un ensayo que distinguiera ambos efectos necesitaría medir el par a la salida (por ejemplo, con un dinamómetro en la pinza).</p>
<p>Conclusión de ingeniería: el balance de par estático es <b>conservador</b> para este brazo, y la carga útil real supera la de diseño. El límite práctico lo pondrá la <b>temperatura</b> en uso continuo (ensayo A4: el servo del hombro ya estaba a 54 °C al empezar, cerca de su límite de 55 °C configurado en el ensayo).</p>`,
    },
    {
      titulo: 'Moverse cuesta más que sostenerse',
      texto: 'Al acelerar aparece un par extra: $\\tau = I\\,\\ddot{q}$. Aquí se estima la inercia del brazo alrededor del hombro con sus masas puntuales y se compara con el par de la gravedad.',
      preparar(app, cuerpo) {
        const q = [0, 0, 0, 0, 0, 0.5];
        app.escena.fijarPostura(q);
        app.escena.resaltar('Shoulder_Pitch');
        let acel = 3;
        const lec = lectura();
        const act = () => {
          const M = app.cadena.marcosEslabones(q);
          const f = app.cadena.fk(q);
          const j = app.modelo.juntas.find((x) => x.nombre === 'Shoulder_Pitch');
          const eje = new THREE.Vector3(...j.eje).normalize().transformDirection(f.Shoulder_Pitch);
          const p = new THREE.Vector3().setFromMatrixPosition(f.Shoulder_Pitch);
          let I = 0;
          for (const n of ESLABONES.slice(1)) {
            const e = app.modelo.eslabones[n];
            const c = new THREE.Vector3(...e.cdm).applyMatrix4(M[n]).sub(p);
            const d = c.sub(eje.clone().multiplyScalar(c.dot(eje)));
            I += e.masa * d.lengthSq();
          }
          const tg = Math.abs(paresGravedad(app, q)[1]);
          lec.textContent = `inercia alrededor del hombro ≈ ${(I * 1e4).toFixed(1)} ·10⁻⁴ kg·m²   (masas puntuales)\npar para acelerar a ${acel.toFixed(1)} rad/s²: ${(I * acel).toFixed(3)} N·m\npar por gravedad en esta postura: ${tg.toFixed(3)} N·m`;
        };
        cuerpo.append(deslizador('Aceleración del hombro', { min: 0, max: 20, paso: 0.1, valor: acel, formato: (x) => `${x.toFixed(1)} rad/s²`, alCambiar: (x) => { acel = x; act(); } }), lec,
          mini(app, q, act, { articulaciones: ['Elbow', 'Wrist_Pitch'] }));
        act();
      },
      detalle: `<p>La ecuación completa del movimiento de un manipulador es</p>
$$M(q)\\,\\ddot{q} + C(q, \\dot{q})\\,\\dot{q} + g(q) = \\tau$$
<ul><li>$M(q)$: matriz de inercia, cuánto cuesta acelerar cada articulación (depende de la postura: el brazo estirado tiene más inercia alrededor del hombro).</li>
<li>$C(q,\\dot{q})\\dot{q}$: efectos centrífugos y de Coriolis, que aparecen al moverse varias articulaciones a la vez.</li>
<li>$g(q)$: gravedad, el paso anterior.</li></ul>
<p>Se obtiene con el método de <b>Lagrange</b> (energías cinética y potencial) o con el de <b>Newton–Euler recursivo</b> (fuerzas y momentos eslabón por eslabón, eficiente para calcular en tiempo real).</p>
<p>La estimación con masas puntuales muestra un dato útil: con las aceleraciones de este brazo (el planificador usa unos pocos rad/s²), el par de inercia es mucho menor que el de la gravedad. En brazos pequeños y lentos domina la gravedad; en robots industriales rápidos, la inercia. Los servos de modelismo no compensan la dinámica (sólo controlan posición), y por eso el ensayo A1 ve errores que dependen de la carga.</p>
<p>Controladores más avanzados usan este modelo para <b>anticiparse</b>: control de par calculado, $\\tau = M(q)\\,(\\ddot{q}_d + K_d\\dot{e} + K_p e) + C\\dot{q} + g(q)$, que se trata en la lección 12.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: '¿Por qué el <b>giro de la base</b> no necesita par para sostener el brazo quieto, sin importar la postura?',
        opciones: ['Porque su servo es más fuerte', 'Porque su eje es vertical, paralelo a la gravedad', 'Porque está más cerca del suelo', 'Porque tiene freno'],
        correcta: 1,
        explicacion: 'El par del peso sobre un eje es $\\hat{z} \\cdot (r \\times m\\vec{g})$. Si $\\hat{z}$ es paralelo a $\\vec{g}$, ese producto es siempre cero.',
      },
      preparar(app) { app.escena.fijarPostura([0.4, 0.3, 0.2, 0.3, 0, 0.5]); },
    },
  ],
};
