// Lección 3: espacio de trabajo alcanzable y diestro.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, nube, esfera, etiqueta, grafica, figura, GRADO } from './comun.js';

// Nube de puntos de la punta con ángulos al azar dentro de los límites.
function muestras(app, n, fijar = null) {
  const lim = app.cadena.limites;
  const pts = [], w = [];
  for (let k = 0; k < n; k++) {
    const q = lim.map(([lo, hi], i) => (fijar && fijar[i] !== undefined ? fijar[i] : lo + Math.random() * (hi - lo)));
    pts.push(app.cadena.efector(q));
    w.push(app.cadena.manipulabilidad(q));
  }
  return { pts, w };
}

const color = (t) => new THREE.Color().setHSL(0.78 - 0.55 * Math.max(0, Math.min(1, t)), 0.85, 0.6);

export default {
  titulo: 'Espacio de trabajo',
  resumen: 'El conjunto de puntos que la pinza puede alcanzar, su forma, su tamaño y por qué la orientación lo reduce.',
  conceptos: [
    ['Espacio de trabajo alcanzable', 'Todos los puntos a los que la punta puede llegar con alguna orientación.'],
    ['Espacio de trabajo diestro', 'Los puntos a los que llega con una orientación dada (por ejemplo, pinza hacia abajo). Siempre es más pequeño.'],
    ['Alcance', 'La mayor distancia horizontal desde el eje de la base: 431,7 mm en el SO-ARM100.'],
    ['Método de Monte Carlo', 'Estimar una región probando muchas combinaciones de ángulos al azar y calculando dónde queda la punta.'],
  ],
  referencias: [
    'analisis/cinematica/ANALISIS_CINEMATICO.md: espacio de trabajo y alcance radial de 431,70 mm.',
    'Siciliano, B. et al. <i>Robotics: Modelling, Planning and Control</i>, sección 2.11 (espacio de trabajo).',
  ],
  pasos: [
    {
      titulo: 'Miles de posturas al azar',
      texto: 'Se eligen ángulos al azar dentro de los límites y se marca dónde queda la punta. Con miles de puntos aparece la forma del <b>espacio de trabajo</b>. El color indica la manipulabilidad: violeta, baja; lima, alta.',
      vista: 'iso',
      preparar(app, cuerpo) {
        const cont = el('div', { class: 'contador' }, '0 puntos');
        cuerpo.append(cont);
        app.escena.fijarPostura([0, 0, 0, 0, 0, 0.5]);
        let total = 0, p = null;
        const todos = [], cols = [];
        return animar(() => {
          if (total >= 6000) return;
          const { pts, w } = muestras(app, 150);
          todos.push(...pts); cols.push(...w.map((x) => color(x / 0.016)));
          total += 150;
          p?.removeFromParent();
          p = nube(app, todos, cols, 0.005);
          cont.textContent = `${total} puntos`;
        });
      },
      detalle: `<p>El <b>espacio de trabajo</b> de un manipulador es la región del espacio que puede alcanzar su efector. Para un brazo con límites articulares no hay una fórmula sencilla de su forma, así que se estima por <b>Monte Carlo</b>: se toman muchas combinaciones de ángulos al azar dentro de los límites, se calcula dónde queda la punta con la cinemática directa (lección 6) y se dibujan todos los puntos.</p>
<p>La nube muestra tres rasgos del SO-ARM100:</p>
<ul><li>Es aproximadamente una <b>esfera hueca recortada</b>, centrada cerca del hombro.</li>
<li>No llega detrás de la base, porque el giro de la base está limitado a unos ±110°.</li>
<li>Tiene poca densidad en los bordes: pocas combinaciones de ángulos llevan la punta tan lejos.</li></ul>
<p>El color es el <b>índice de manipulabilidad</b> de Yoshikawa (lección 8): mide cuánto puede moverse la punta en todas direcciones desde esa postura. Cerca del borde exterior el brazo está estirado y el índice cae.</p>`,
    },
    {
      titulo: 'Un corte por el plano del brazo',
      texto: 'Como el hombro, el codo y la muñeca giran en el mismo plano, basta estudiar un corte. Cada punto es una postura con la base en 0°: distancia horizontal desde el eje contra altura.',
      ancho: true,
      preparar(app, cuerpo) {
        const g = grafica({ ancho: 600, alto: 300, x: [-0.2, 0.45], y: [-0.2, 0.45], xEtq: 'distancia horizontal al eje de la base (m)', yEtq: 'altura z (m)' });
        cuerpo.append(g);
        const lim = app.cadena.limites;
        const pts = [];
        for (let k = 0; k < 3500; k++) {
          const q = [0, ...lim.slice(1, 4).map(([lo, hi]) => lo + Math.random() * (hi - lo)), 0];
          const p = app.cadena.efector(q);
          pts.push([-(p.y + 0.0452), p.z]);
        }
        const puntos = pts.map((p) => `<circle cx="0" cy="0" r="1.4" fill="#c2ef4e" opacity="0.6" transform="translate(${44 + ((p[0] + 0.2) / 0.65) * (600 - 56)},${300 - 30 - ((p[1] + 0.2) / 0.65) * (300 - 42)})"/>`).join('');
        g.insertAdjacentHTML('beforeend', puntos);
        const brazo = (q) => {
          const f = app.cadena.fk(q);
          return ['Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'efector'].map((n) => { const v = new THREE.Vector3().setFromMatrixPosition(f[n]); return [-(v.y + 0.0452), v.z]; });
        };
        g.dibujar([{ color: '#fd44b0', ancho: 4, puntos: [[0, 0], [0, 0.119], ...brazo([0, 0, 0, 0, 0])] }]);
        const nube3d = [];
        for (const [r, z] of pts.slice(0, 2500)) nube3d.push(new THREE.Vector3(0, -r - 0.0452, z));
        nube(app, nube3d, null, 0.004);
        app.escena.fijarPostura([0, 0, 0, 0, 0, 0.5]);
        app.escena.vista('lado');
      },
      detalle: `<p>Los ejes del hombro, el codo y la flexión de muñeca son <b>paralelos</b> (el análisis cinemático lo verificó: $z_2 \\times z_3 = z_3 \\times z_4 = 0$). Por eso esas tres articulaciones mueven la punta dentro de un <b>plano vertical</b>, y la base sólo gira ese plano. El espacio de trabajo en 3D es la región del corte barrida por el giro de la base.</p>
<p>Las longitudes que dan forma al corte salen del URDF:</p>
<table><tr><th>Tramo</th><th>Longitud</th></tr>
<tr><td>Eje de la base → eje del hombro (horizontal)</td><td>30,6 mm</td></tr>
<tr><td>Altura del eje del hombro sobre la mesa</td><td>119,0 mm</td></tr>
<tr><td>Brazo (hombro → codo)</td><td>116,0 mm</td></tr>
<tr><td>Antebrazo (codo → muñeca)</td><td>135,0 mm</td></tr>
<tr><td>Muñeca → punta de la pinza</td><td>150,1 mm</td></tr></table>
<p>El <b>alcance</b> es la suma de todo estirado:</p>
$$r_{\\max} = 30{,}6 + 116{,}0 + 135{,}0 + 150{,}1 = 431{,}7\\ \\text{mm}$$
<p>que coincide con el valor del análisis cinemático del proyecto (431,70 mm). El borde interior aparece porque los límites impiden doblar el brazo sobre sí mismo.</p>`,
    },
    {
      titulo: 'Con la pinza hacia abajo',
      texto: 'Para tomar piezas de una mesa, la pinza suele apuntar <b>hacia abajo</b>. Los puntos lima son los que el brazo alcanza así; los violeta sólo con otra orientación. Esto es el <b>espacio diestro</b>.',
      preparar(app, cuerpo) {
        const lim = app.cadena.limites;
        const alc = [], diestro = [];
        let k = 0;
        const nota = el('div', { class: 'lectura-leccion' }, 'Calculando…');
        cuerpo.append(nota);
        const xs = [], ys = [], zs = [];
        for (let x = -0.3; x <= 0.3001; x += 0.03) xs.push(x);
        for (let y = -0.44; y <= -0.04; y += 0.03) ys.push(y);
        for (let z = 0.01; z <= 0.3; z += 0.03) zs.push(z);
        const celdas = [];
        for (const z of zs) for (const y of ys) for (const x of xs) celdas.push(new THREE.Vector3(x, y, z));
        let pAl = null, pDi = null;
        app.escena.fijarPostura([0, -0.3, 0.9, 1.0, 0, 0.5]);
        app.escena.vista('iso');
        void lim;
        return animar(() => {
          if (k >= celdas.length) return;
          for (let m = 0; m < 120 && k < celdas.length; m++, k++) {
            const p = celdas[k];
            const r = Math.hypot(p.x, p.y + 0.0452);
            if (r > 0.432) continue;
            const abajo = app.cadena.ikPose(p, -90 * GRADO, 0, [0, 0, 0, 0, 0], { iteraciones: 50 });
            if (abajo.alcanzado) { diestro.push(p); continue; }
            const cualquiera = app.cadena.ik(p, [Math.atan2(-p.x, -p.y), 0.2, 0.2, 0.2, 0]);
            if (cualquiera.alcanzado) alc.push(p);
          }
          pAl?.removeFromParent(); pDi?.removeFromParent();
          pAl = nube(app, alc, alc.map(() => new THREE.Color(0x7553ff)), 0.008);
          pDi = nube(app, diestro, diestro.map(() => new THREE.Color(0xc2ef4e)), 0.01);
          nota.textContent = `${Math.round((100 * k) / celdas.length)} %   con la pinza hacia abajo: ${diestro.length} puntos · sólo con otra orientación: ${alc.length}`;
        });
      },
      detalle: `<p>Un robot no sólo tiene que llegar a un punto: casi siempre tiene que llegar con una <b>orientación</b> concreta. El <b>espacio de trabajo diestro</b> es la parte del espacio alcanzable en la que la herramienta puede tener la orientación pedida.</p>
<p>Con la pinza vertical hacia abajo, la muñeca tiene que quedar 150 mm encima del punto, así que el hombro y el codo deben llevar la muñeca a una altura mayor. Resultado:</p>
<ul><li>La pinza hacia abajo llega a la mesa sólo entre unos 100 y 260 mm delante del origen de la base (y de −100 a −260 mm en las coordenadas de la aplicación).</li>
<li>Con la pinza hacia abajo, el punto más alto que se alcanza está a unos 100 mm de la mesa (por eso el ejemplo «Apilar» de la pestaña Programar se acerca a la pila desde 35 mm y no desde 60).</li>
<li>Muy cerca de la base no se llega: el límite del codo (±85°) no deja doblar el brazo lo suficiente.</li></ul>
<p>Un brazo de 6 GDL tiene un espacio diestro más amplio porque puede orientar la pinza sin mover la muñeca de sitio. Con 5 GDL, <b>la orientación no es libre</b>: sólo se eligen el cabeceo y el giro de la pinza, y la dirección horizontal la impone la base.</p>`,
    },
    {
      titulo: '¿Se puede llegar?',
      texto: 'Tres esferas: A, B y C. Una está fuera del alcance. ¿Cuál?',
      pregunta: {
        enunciado: '¿Qué punto está <b>fuera</b> del espacio de trabajo?',
        opciones: ['A: 200 mm delante de la base, a 150 mm de altura', 'B: 500 mm delante de la base, a 120 mm de altura', 'C: 120 mm a la izquierda y 180 mm delante, sobre la mesa'],
        correcta: 1,
        explicacion: 'B está a 500 − 45 = 455 mm del eje de la base, más que el alcance máximo de 431,7 mm con todo estirado. A y C están dentro (C, con la pinza inclinada).',
      },
      preparar(app) {
        app.escena.fijarPostura([0, 0, 0, 0, 0, 0.5]);
        app.escena.vista('iso');
        const pts = { A: new THREE.Vector3(0, -0.2, 0.15), B: new THREE.Vector3(0, -0.5, 0.12), C: new THREE.Vector3(-0.12, -0.18, 0.02) };
        for (const [n, p] of Object.entries(pts)) { esfera(app, p, 0.014, 0xffb287, 0.9); etiqueta(app, n, p.clone().add(new THREE.Vector3(0, 0, 0.03))); }
      },
    },
    {
      titulo: 'Sin orientación libre',
      texto: 'Última pregunta.',
      pregunta: {
        enunciado: 'El SO-ARM100 tiene 5 GDL. ¿Qué parte de la orientación de la pinza <b>no</b> puede elegir libremente si ya fijó la posición de la punta?',
        opciones: ['El cabeceo (hacia arriba o abajo)', 'El giro de la pinza sobre su eje', 'La dirección horizontal a la que apunta (guiñada)', 'Ninguna: con 5 GDL todo es libre'],
        correcta: 2,
        explicacion: 'La dirección horizontal la impone la base: la pinza siempre apunta dentro del plano vertical del brazo. Cabeceo y giro sí se eligen.',
      },
      preparar(app) { app.escena.fijarPostura([0.5, 0.3, 0.3, 0.9, 0, 0.5]); },
    },
  ],
};
