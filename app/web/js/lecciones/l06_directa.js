// Lección 6: cinemática directa. Del ángulo de cada articulación a la pose de la pinza.
import * as THREE from 'three';
import { el } from '../ui.js';
import { mini, marco, esfera, linea, formula, figura, lectura, botones, geometriaPlana, GRADO, grados } from './comun.js';

const POSE = [0.3, 0.35, -0.6, 0.55, 0, 0.5];

function esquema(g) {
  // Dibujo del brazo en su plano, con las longitudes y los ángulos φ medidos desde la horizontal.
  const s = 520;
  return `<svg viewBox="0 0 ${s} 230" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
  <line x1="20" y1="205" x2="500" y2="205" stroke="#362d59"/>
  <rect x="30" y="150" width="40" height="55" fill="#422082"/>
  <circle cx="60" cy="150" r="6" fill="#fd44b0"/><text x="10" y="140" fill="#bdb8c0">hombro (r₀, z₀)</text>
  <line x1="60" y1="150" x2="120" y2="55" stroke="#efefef" stroke-width="8" stroke-linecap="round"/>
  <text x="104" y="110" fill="#fff">L₂ = ${(g.L2 * 1000).toFixed(1)} mm</text>
  <path d="M 90 150 A 30 30 0 0 0 76 124" fill="none" stroke="#c2ef4e" stroke-width="2"/><text x="94" y="140" fill="#c2ef4e">φ₂</text>
  <circle cx="120" cy="55" r="6" fill="#c2ef4e"/>
  <line x1="120" y1="55" x2="290" y2="75" stroke="#efefef" stroke-width="8" stroke-linecap="round"/>
  <text x="170" y="52" fill="#fff">L₃ = ${(g.L3 * 1000).toFixed(1)} mm</text>
  <circle cx="290" cy="75" r="6" fill="#ffb287"/>
  <line x1="290" y1="75" x2="455" y2="130" stroke="#efefef" stroke-width="8" stroke-linecap="round"/>
  <text x="360" y="88" fill="#fff">L₄ = ${(g.L4 * 1000).toFixed(1)} mm</text>
  <line x1="290" y1="75" x2="360" y2="75" stroke="#8f879a" stroke-dasharray="4 3"/>
  <path d="M 330 75 A 40 40 0 0 1 328 88" fill="none" stroke="#7553ff" stroke-width="2"/><text x="336" y="104" fill="#a597ff">φ₄ = cabeceo</text>
  <circle cx="455" cy="130" r="5" fill="#fd44b0"/><text x="440" y="152" fill="#fd44b0">punta (r, z)</text>
  </svg>`;
}

export default {
  titulo: 'Cinemática directa',
  resumen: 'Dados los cinco ángulos, calcular dónde queda la pinza y hacia dónde apunta. Primero con matrices; después, para este brazo, con una fórmula de trigonometría.',
  conceptos: [
    ['Cinemática directa', 'Función $x = f(q)$: de los ángulos articulares $q$ a la pose del efector. Siempre tiene una sola respuesta.'],
    ['Espacio articular y cartesiano', 'El primero usa los ángulos (5 números); el segundo, posición y orientación de la pinza.'],
    ['Brazo plano', 'Hombro, codo y muñeca tienen ejes paralelos: la punta se mueve en un plano vertical que la base hace girar.'],
  ],
  referencias: [
    'analisis/cinematica/ANALISIS_CINEMATICO.md: cinemática directa verificada contra el URDF con error de $10^{-15}$.',
    'Siciliano, B. et al. <i>Robotics</i>, sección 2.9 (cinemática directa de manipuladores planos).',
  ],
  pasos: [
    {
      titulo: 'De ángulos a posición',
      texto: 'Mueva las articulaciones: la aplicación multiplica las cinco transformaciones y da la <b>posición</b> de la punta y su <b>cabeceo</b>. Para unos ángulos dados hay <b>una sola</b> respuesta.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const m = marco(app, app.cadena.fk(q).efector, { largo: 0.06 });
        const lec = lectura();
        const act = () => {
          const ps = app.cadena.pose(q);
          m.fijar(ps.T);
          lec.textContent = `q = [${q.slice(0, 5).map((v) => grados(v).toFixed(0).padStart(4)).join(', ')}]°\n→  x ${(ps.p.x * 1000).toFixed(1)}  y ${(ps.p.y * 1000).toFixed(1)}  z ${(ps.p.z * 1000).toFixed(1)} mm   cabeceo ${grados(ps.cab).toFixed(1)}°   giro ${grados(q[4]).toFixed(1)}°`;
        };
        cuerpo.append(formula('\\begin{bmatrix} x \\\\ y \\\\ z \\\\ \\text{cab} \\\\ \\text{giro}\\end{bmatrix} = f(q_1, q_2, q_3, q_4, q_5)'), lec, mini(app, q, act));
        act();
      },
      detalle: `<p>La <b>cinemática directa</b> responde: con estos ángulos, ¿dónde está la pinza? Es la composición de transformaciones de la lección 5:</p>
$$T_0^{\\,pinza}(q) = T_0^1(q_1)\\,T_1^2(q_2)\\,T_2^3(q_3)\\,T_3^4(q_4)\\,T_4^5(q_5)\\,T_5^{\\,pinza}$$
<p>De la matriz resultante se leen la posición (última columna) y la orientación (bloque $R$). Tres propiedades importantes:</p>
<ul><li><b>Siempre existe y es única</b>: a cada postura le corresponde una sola pose de la pinza.</li>
<li><b>Es barata</b>: cinco productos de matrices 4×4. La aplicación la calcula miles de veces por segundo (por ejemplo, para la nube de puntos de la lección 3).</li>
<li><b>Es la base de todo lo demás</b>: la inversa, el jacobiano y la detección de colisiones se construyen sobre ella.</li></ul>
<p>En este proyecto la calculan tres programas distintos, y deben coincidir: <code>robot_state_publisher</code> de ROS (a partir del URDF), el nodo de teleoperación (para la manipulabilidad) y esta aplicación (<code>cinematica.js</code>).</p>`,
    },
    {
      titulo: 'Una fórmula para este brazo',
      texto: 'Como hombro, codo y muñeca giran en el mismo plano, la posición sale con trigonometría: cada tramo suma su <b>coseno</b> a la distancia horizontal y su <b>seno</b> a la altura.',
      ancho: true,
      preparar(app, cuerpo) {
        const g = geometriaPlana(app);
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const lec = lectura();
        const bola = esfera(app, app.cadena.efector(q), 0.012, 0xfd44b0, 0.6);
        const act = () => {
          const d = g.directa(q);
          const p = app.cadena.efector(q);
          bola.position.set(d.x, d.y, d.z);
          lec.textContent = `φ₂ = ${grados(d.f2).toFixed(1)}°   φ₃ = ${grados(d.f3).toFixed(1)}°   φ₄ = ${grados(d.cab).toFixed(1)}°\nfórmula:  r ${(d.r * 1000).toFixed(1)}  z ${(d.z * 1000).toFixed(1)}  →  x ${(d.x * 1000).toFixed(1)}  y ${(d.y * 1000).toFixed(1)} mm\nmatrices: x ${(p.x * 1000).toFixed(1)}  y ${(p.y * 1000).toFixed(1)}  z ${(p.z * 1000).toFixed(1)} mm   diferencia ${(p.distanceTo(new THREE.Vector3(d.x, d.y, d.z)) * 1000).toFixed(3)} mm`;
        };
        cuerpo.append(figura(esquema(g)), lec, mini(app, q, act, { articulaciones: ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch'] }));
        act();
      },
      detalle: (app) => {
        const g = geometriaPlana(app);
        const f = (v) => (v * 1000).toFixed(1).replace('.', '{,}');
        const a = (v) => grados(v).toFixed(2).replace('.', '{,}');
        return `<p>Se mide la posición en el plano del brazo con dos coordenadas: $r$, la distancia horizontal al eje de la base, y $z$, la altura. Los ángulos $\\varphi$ se miden <b>desde la horizontal</b>. Del URDF, en la postura cero:</p>
<table><tr><th>Constante</th><th>Valor</th><th>Qué es</th></tr>
<tr><td>$r_0,\\ z_0$</td><td>${f(g.r0)} mm, ${f(g.z0)} mm</td><td>eje del hombro</td></tr>
<tr><td>$L_2,\\ \\varphi_2^0$</td><td>${f(g.L2)} mm, ${a(g.a2)}°</td><td>brazo, casi vertical</td></tr>
<tr><td>$L_3,\\ \\varphi_3^0$</td><td>${f(g.L3)} mm, ${a(g.a3)}°</td><td>antebrazo, casi horizontal</td></tr>
<tr><td>$L_4$</td><td>${f(g.L4)} mm</td><td>muñeca → punta</td></tr></table>
<p>Cada articulación del plano resta su ángulo a los tramos que vienen después (un $q$ positivo inclina hacia abajo):</p>
$$\\varphi_2 = ${a(g.a2)}^\\circ - q_2,\\qquad \\varphi_3 = ${a(g.a3)}^\\circ - q_2 - q_3,\\qquad \\varphi_4 = -q_2 - q_3 - q_4$$
<p>La posición en el plano es la suma de los tres tramos:</p>
$$r = r_0 + L_2\\cos\\varphi_2 + L_3\\cos\\varphi_3 + L_4\\cos\\varphi_4$$
$$z = z_0 + L_2\\sin\\varphi_2 + L_3\\sin\\varphi_3 + L_4\\sin\\varphi_4$$
<p>y la base gira ese plano alrededor de su eje vertical (en $x = 0$, $y = ${f(g.ejeY)}$ mm; el brazo mira hacia $-y$):</p>
$$x = -r\\sin q_1, \\qquad y = ${f(g.ejeY)}\\,\\text{mm} - r\\cos q_1$$
<p>El cabeceo de la pinza es $\\varphi_4$, y el giro de muñeca $q_5$ no mueve la punta porque la punta está sobre su eje. La lectura muestra que la fórmula y el producto de matrices coinciden (la diferencia es de milésimas de milímetro, por el redondeo de las constantes).</p>`;
      },
    },
    {
      titulo: 'Recorrer la cadena',
      texto: 'Pulse <b>Animar</b>: cada articulación gira por turnos y el rastro muestra el aporte de cada una a la posición de la punta.',
      preparar(app, cuerpo) {
        const q = [0, 0, 0, 0, 0, 0.5];
        app.escena.fijarPostura(q);
        const rastro = [];
        const l = linea(app, [new THREE.Vector3(), new THREE.Vector3()], 0xc2ef4e);
        let vivo = true, en = false;
        const lec = lectura('Listo.');
        const animarCadena = async () => {
          if (en) return; en = true;
          rastro.length = 0;
          const metas = [[0, 0.6], [1, 0.45], [2, -0.7], [3, 0.8], [0, -0.3]];
          for (const [i, meta] of metas) {
            app.escena.resaltar(['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch'][i]);
            const desde = q[i];
            for (let k = 1; k <= 45 && vivo; k++) {
              q[i] = desde + (meta - desde) * (k / 45);
              app.escena.fijarPostura(q);
              rastro.push(app.cadena.efector(q));
              l.fijar(rastro);
              lec.textContent = `q${i + 1} → ${grados(q[i]).toFixed(0)}°`;
              await new Promise((r) => requestAnimationFrame(r));
            }
          }
          app.escena.resaltar(null);
          en = false;
        };
        cuerpo.append(lec, botones(['Animar', animarCadena], ['Volver a cero', () => { q.fill(0); q[5] = 0.5; rastro.length = 0; l.fijar([new THREE.Vector3(), new THREE.Vector3()]); app.escena.fijarPostura(q); }]));
        return () => { vivo = false; };
      },
      detalle: `<p>Cada tramo del rastro corresponde a una sola articulación moviéndose con las demás quietas:</p>
<ul><li>El <b>giro de la base</b> mueve la punta en un arco horizontal alrededor del eje vertical.</li>
<li>El <b>hombro</b>, el <b>codo</b> y la <b>muñeca</b> mueven la punta en arcos dentro del plano vertical del brazo. Cuanto más lejos está la punta de la articulación, más largo el arco para el mismo ángulo.</li></ul>
<p>Esa relación entre «cuánto gira la articulación» y «cuánto se mueve la punta» es exactamente lo que mide el <b>jacobiano</b> (lección 8): para cada articulación, la velocidad que le da a la punta por cada radián por segundo.</p>
<p>Consecuencia práctica, que midió el ensayo A1: un error de 1° en el hombro mueve la punta mucho más que 1° en la muñeca, porque el hombro está a unos 400 mm de la punta y la muñeca a 150 mm. En arco, $s = r\\,\\theta$: $400 \\times 0{,}0175 \\approx 7$ mm frente a $150 \\times 0{,}0175 \\approx 2{,}6$ mm.</p>`,
    },
    {
      titulo: 'Calcule usted',
      texto: 'Use la fórmula del paso 2.',
      pregunta: {
        enunciado: 'Con todos los ángulos en 0 (postura <code>init</code>), la punta está en $r = 30{,}6 + 116\\cos 76^\\circ + 135\\cos 2{,}2^\\circ + 150{,}1$. ¿Cuánto vale $r$ aproximadamente?',
        opciones: ['$297$ mm', '$344$ mm', '$432$ mm', '$401$ mm'],
        correcta: 1,
        explicacion: '$30{,}6 + 28{,}1 + 134{,}9 + 150{,}1 = 343{,}7$ mm. Con el eje de la base en $y = -45{,}2$ mm, eso da $y = -388{,}8$ mm: justo lo que muestra la barra de arriba en init.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0, 0, 0, 0, 0.5]); },
    },
    {
      titulo: 'Una pregunta de concepto',
      texto: 'Última.',
      pregunta: {
        enunciado: '¿Por qué el giro de muñeca $q_5$ no aparece en las fórmulas de $x$, $y$, $z$?',
        opciones: ['Porque vale siempre cero', 'Porque la punta está sobre el eje de ese giro', 'Porque es una articulación prismática', 'Por un error del modelo'],
        correcta: 1,
        explicacion: 'Un giro no mueve los puntos que están sobre su eje. $q_5$ sólo cambia la orientación de los dedos, no dónde está la punta.',
      },
      preparar(app) { app.escena.fijarPostura(POSE); },
    },
  ],
};
