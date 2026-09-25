// Lección 8: jacobiano, elipsoide de manipulabilidad, singularidades y τ = Jᵀ F.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, mini, deslizador, matriz, lectura, grafica, barras, flecha, formula, jacobiano, propios3, JJt, BRAZO, NOMBRE, grados } from './comun.js';

const POSE = [0.2, 0.35, -0.5, 0.6, 0, 0.5];

// Elipsoide de manipulabilidad en la punta, con semiejes √λ de J·Jᵀ (escalado para verse).
function elipsoide(app) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshStandardMaterial({ color: 0x7553ff, transparent: true, opacity: 0.45, emissive: 0x2a1a70 }));
  app.escena.extras.add(m);
  m.fijar = (q, escala = 0.35) => {
    const J = jacobiano(app, q);
    const { valores, vectores } = propios3(JJt(J));
    const M = new THREE.Matrix4().makeBasis(vectores[0], vectores[1], vectores[2]);
    m.quaternion.setFromRotationMatrix(M);
    m.scale.set(...valores.map((v) => Math.max(0.0015, Math.sqrt(Math.max(v, 0)) * escala)));
    m.position.copy(app.cadena.efector(q));
    return { valores, w: Math.sqrt(Math.max(0, valores[0] * valores[1] * valores[2])) };
  };
  return m;
}

export default {
  titulo: 'Jacobiano y singularidades',
  resumen: 'Cómo se traducen las velocidades de las articulaciones en velocidad de la pinza, cuánto «libre» está el brazo para moverse, y dónde se traba.',
  conceptos: [
    ['Jacobiano $J(q)$', 'Matriz de derivadas: $\\dot{x} = J(q)\\,\\dot{q}$. Cada columna es la velocidad que da a la punta una articulación girando a 1 rad/s.'],
    ['Singularidad', 'Postura en la que $J$ pierde rango: hay direcciones en las que la punta no puede moverse, por rápido que giren las articulaciones.'],
    ['Manipulabilidad de Yoshikawa', '$w = \\sqrt{\\det(J J^\\top)}$: volumen del elipsoide de velocidades. Vale 0 en una singularidad.'],
    ['Dualidad velocidad–fuerza', '$\\tau = J^\\top F$: el mismo jacobiano da qué par debe hacer cada articulación para ejercer la fuerza $F$ en la punta.'],
  ],
  referencias: [
    'Yoshikawa, T. (1985). «Manipulability of robotic mechanisms», International Journal of Robotics Research.',
    'analisis/cinematica: singularidad en $q_3 = -73{,}825^\\circ$ y por qué $\\det(J J^\\top)$ con $J$ de 6×5 siempre es 0.',
    'README del proyecto: el nodo de teleoperación muestra la manipulabilidad en pantalla.',
  ],
  pasos: [
    {
      titulo: 'Velocidades de las articulaciones, velocidad de la punta',
      texto: 'Haga girar las articulaciones con los deslizadores de <b>velocidad</b>. La flecha es la velocidad de la punta: $\\dot{x} = J\\dot{q}$. Cada <b>columna</b> de $J$ es el aporte de una articulación.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const qd = [0, 0, 0, 0];
        const f = flecha(app, new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0.001, 0xc2ef4e, 1.4);
        const tabla = matriz([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { decimales: 0 });
        const lec = lectura();
        const act = () => {
          const J = jacobiano(app, q);
          tabla.fijar([0, 1, 2].map((r) => J.map((c) => c.getComponent(r) * 1000)));
          const v = J.reduce((s, c, i) => s.addScaledVector(c, qd[i]), new THREE.Vector3());
          const p = app.cadena.efector(q);
          f.position.copy(p);
          if (v.length() > 1e-6) { f.setDirection(v.clone().normalize()); f.setLength(Math.min(0.25, v.length() * 0.6), 0.02, 0.012); f.visible = true; } else f.visible = false;
          lec.textContent = `velocidad de la punta = (${(v.x * 1000).toFixed(0)}, ${(v.y * 1000).toFixed(0)}, ${(v.z * 1000).toFixed(0)}) mm/s   |v| = ${(v.length() * 1000).toFixed(0)} mm/s`;
        };
        cuerpo.append(el('div', { class: 'fila', style: 'gap:12px;align-items:center' }, formula('J\\;[\\text{mm/rad}] ='), tabla), lec,
          ...BRAZO.slice(0, 4).map((n, i) => deslizador(`${NOMBRE[n]} q̇`, { min: -1, max: 1, paso: 0.01, valor: 0, formato: (x) => `${x.toFixed(2)} rad/s`, alCambiar: (x) => { qd[i] = x; act(); } })));
        act();
      },
      detalle: `<p>Si las articulaciones giran con velocidades $\\dot{q} = (\\dot{q}_1, \\dots, \\dot{q}_n)$, la punta se mueve con una velocidad $\\dot{x}$ que depende linealmente de ellas:</p>
$$\\dot{x} = J(q)\\,\\dot{q}, \\qquad J_{ij} = \\frac{\\partial x_i}{\\partial q_j}$$
<p>La matriz $J$ es el <b>jacobiano</b>. Depende de la postura: el mismo giro del hombro mueve más la punta con el brazo estirado que plegado.</p>
<p>En la figura, $J$ tiene 3 filas (velocidad en x, y, z) y 4 columnas (base, hombro, codo, muñeca; el giro de muñeca no mueve la punta). Sus unidades son mm/rad: un valor de 300 significa que girar esa articulación 1 rad/s mueve la punta a 300 mm/s en ese eje.</p>
<p>Para una articulación giratoria, la columna tiene una forma geométrica sencilla:</p>
$$J_i = \\hat{z}_i \\times (p_{\\text{punta}} - p_i)$$
<p>donde $\\hat{z}_i$ es el eje de giro y $p_i$ un punto del eje: la velocidad es perpendicular al eje y al brazo de palanca, y proporcional a la distancia. La aplicación la calcula numéricamente (derivando la cinemática directa), lo que da el mismo resultado.</p>
<p>El jacobiano completo tiene además 3 filas de velocidad angular (6×5 en total); aquí se usa la parte lineal.</p>`,
    },
    {
      titulo: 'El elipsoide de manipulabilidad',
      texto: 'Si todas las articulaciones giran a 1 rad/s en todas las combinaciones, la punta puede ir a cualquier velocidad dentro de un <b>elipsoide</b>. Mueva el brazo: donde se aplana, el robot «se traba» en esa dirección.',
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const e = elipsoide(app);
        const lec = lectura();
        const act = () => { const r = e.fijar(q); lec.textContent = `semiejes √λ = ${r.valores.map((v) => (Math.sqrt(Math.max(0, v)) * 1000).toFixed(0)).join(', ')} mm/rad   w = ${r.w.toExponential(2)}`; };
        cuerpo.append(lec, mini(app, q, act, { articulaciones: ['Shoulder_Pitch', 'Elbow', 'Wrist_Pitch'] }));
        act();
      },
      detalle: `<p>Si se piden todas las velocidades articulares de norma 1 ($\\|\\dot{q}\\| = 1$), las velocidades de la punta forman un elipsoide:</p>
$$\\dot{x}^\\top \\left(J J^\\top\\right)^{-1} \\dot{x} \\le 1$$
<p>Sus ejes son los vectores propios de $J J^\\top$ y sus semiejes, la raíz de los valores propios: $\\sqrt{\\lambda_1}, \\sqrt{\\lambda_2}, \\sqrt{\\lambda_3}$. La <b>manipulabilidad de Yoshikawa</b> es proporcional a su volumen:</p>
$$w = \\sqrt{\\det\\left(J J^\\top\\right)} = \\sqrt{\\lambda_1 \\lambda_2 \\lambda_3}$$
<ul><li>Elipsoide «redondo»: la punta se mueve igual de bien en todas las direcciones (buena postura de trabajo).</li>
<li>Elipsoide «aplastado»: hay direcciones casi imposibles. Para moverse en ellas harían falta velocidades articulares enormes.</li></ul>
<p>En <code>init</code> el SO-ARM100 tiene $w = 0{,}012545$ (con $J$ lineal de 3×5), el mismo valor que calculan el análisis cinemático y el nodo de teleoperación. <b>Cuidado</b>: con el jacobiano completo de 6×5, $JJ^\\top$ es 6×6 de rango 5 y su determinante vale 0 siempre; la fórmula válida en ese caso es $\\sqrt{\\det(J^\\top J)}$ (analisis/cinematica lo discute).</p>`,
    },
    {
      titulo: 'La singularidad del codo',
      texto: 'Pulse <b>Animar</b>: el codo va hacia <b>−73,8°</b>, donde brazo y antebrazo quedan alineados. El elipsoide se aplana hasta un disco y $w$ cae a casi cero.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = [0, 0.25, 0.4, 0.5, 0, 0.5];
        app.escena.fijarPostura(q);
        const e = elipsoide(app);
        const gr = grafica({ ancho: 600, alto: 170, x: [-85, 85], y: [0, 0.016], xEtq: 'ángulo del codo q₃ (°)', yEtq: 'manipulabilidad w' });
        const curva = [];
        for (let a = -85; a <= 85; a += 1) { const qq = q.slice(); qq[2] = a * Math.PI / 180; const J = jacobiano(app, qq); const { valores } = propios3(JJt(J)); curva.push([a, Math.sqrt(Math.max(0, valores[0] * valores[1] * valores[2]))]); }
        const lec = lectura();
        cuerpo.append(gr, lec);
        return animar((t) => {
          q[2] = -1.29 + (0.5 + 0.5 * Math.cos(t * 0.5)) * 1.7;
          app.escena.fijarPostura(q);
          const r = e.fijar(q);
          gr.dibujar([{ color: '#7553ff', puntos: curva }, { color: '#c2ef4e', puntos: [[grados(q[2]), 0], [grados(q[2]), r.w]], marca: [grados(q[2]), r.w] }]);
          lec.textContent = `q₃ = ${grados(q[2]).toFixed(1)}°   w = ${r.w.toExponential(2)}${Math.abs(grados(q[2]) + 73.8) < 6 ? '   ← singularidad: brazo y antebrazo alineados' : ''}`;
        });
      },
      detalle: `<p>Una <b>singularidad</b> es una postura en la que el jacobiano pierde rango: sus columnas dejan de generar todas las direcciones. En el SO-ARM100 la principal ocurre cuando <b>brazo y antebrazo quedan alineados</b>:</p>
$$q_3 = \\varphi_3^0 - \\varphi_2^0 \\approx 2{,}21^\\circ - 76{,}03^\\circ = -73{,}8^\\circ$$
<p>En esa postura, girar el hombro o el codo mueve la muñeca en la misma dirección (perpendicular a la línea brazo–antebrazo), y la punta no puede alejarse ni acercarse al hombro «de golpe».</p>
<p>Tipos de singularidad:</p>
<ul><li><b>De frontera</b>: el brazo estirado en el borde del espacio de trabajo. Inevitable: es donde termina el alcance.</li>
<li><b>Interiores</b>: alineaciones dentro del espacio de trabajo (dos ejes que coinciden, como el bloqueo de cardán de la lección 4). Son las peligrosas, porque se atraviesan sin querer.</li></ul>
<p>Por qué importa en la práctica: cerca de una singularidad, para mantener la punta en línea recta (<code>MoveL</code>) una articulación tendría que girar muy rápido. Los controladores industriales se detienen con un error del tipo «cerca de singularidad». La pestaña Programar hace lo mismo: si entre dos puntos del camino una articulación tendría que saltar más de 14°, se detiene y avisa en la línea correspondiente.</p>`,
    },
    {
      titulo: 'Del peso a los pares: τ = Jᵀ F',
      texto: 'Cuelgue una masa en la pinza. El mismo jacobiano dice qué <b>par</b> debe hacer cada articulación para sostenerla: $\\tau = J^\\top F$. Compare con los 227 g del ensayo A3.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = [0, 0, 0, 0, 0, 0.5];
        app.escena.fijarPostura(q);
        let masa = 0.227;
        const b = barras([]);
        const f = flecha(app, new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0.08, 0xfd44b0, 1.4);
        const act = () => {
          const J = jacobiano(app, q);
          const F = new THREE.Vector3(0, 0, -9.81 * masa);
          const tau = J.map((c) => c.dot(F));
          f.position.copy(app.cadena.efector(q));
          f.setLength(0.03 + masa * 0.3, 0.02, 0.012);
          b.fijar(BRAZO.slice(0, 4).map((n, i) => ({ etq: NOMBRE[n], frac: Math.abs(tau[i]) / 1.86, texto: `${Math.abs(tau[i]).toFixed(3)} N·m` })));
        };
        cuerpo.append(formula('\\tau = J^\\top F, \\qquad F = (0,\\,0,\\,-m g)'),
          deslizador('Masa en la pinza', { min: 0, max: 0.3, paso: 0.001, valor: masa, formato: (x) => `${(x * 1000).toFixed(0)} g`, alCambiar: (x) => { masa = x; act(); } }),
          b, el('div', { class: 'nota' }, 'La barra llena equivale a 1,86 N·m, el par de bloqueo del STS3215 de 7,4 V según el fabricante. Sólo el peso de la masa; el del propio brazo se suma en la lección 11.'),
          mini(app, q, act, { articulaciones: ['Shoulder_Pitch', 'Elbow', 'Wrist_Pitch'] }));
        act();
      },
      detalle: `<p>El jacobiano también relaciona fuerzas. Por el principio de trabajos virtuales, la potencia en la punta ($F \\cdot \\dot{x}$) tiene que ser igual a la de las articulaciones ($\\tau \\cdot \\dot{q}$):</p>
$$F^\\top \\dot{x} = F^\\top J\\,\\dot{q} = \\tau^\\top \\dot{q} \\quad\\Rightarrow\\quad \\tau = J^\\top F$$
<p>Para una masa $m$ colgada de la pinza, $F = (0, 0, -mg)$ y el par de cada articulación es el peso por su brazo de palanca horizontal. Con los 227 g del ensayo A3, en <code>init</code>:</p>
<ul><li>el <b>hombro</b> (a 313 mm de la punta en horizontal) necesita $2{,}23 \\times 0{,}313 \\approx 0{,}70$ N·m,</li>
<li>el <b>codo</b> (a unos 285 mm) necesita $\\approx 0{,}64$ N·m,</li>
<li>la <b>muñeca</b> (a 150 mm) necesita $\\approx 0{,}33$ N·m.</li></ul>
<p>Hay que sumar el peso del propio brazo (lección 11). El ensayo A3 midió que, con 227 g, el codo llegó al <b>50 % de esfuerzo</b> en la postura extendida y fue la articulación más cargada, lo que concuerda con este cálculo. En el hombro, con más palanca, el servo informó menos esfuerzo (19 %); la lección 11 explica por qué la lectura de esfuerzo de un servo no es proporcional al par.</p>
<p>La dualidad también explica las singularidades desde el lado de las fuerzas: en una singularidad hay direcciones en las que la punta puede resistir fuerzas enormes sin par en las articulaciones (el brazo estirado aguanta bien un empuje a lo largo de sí mismo).</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Cerca de una singularidad, ¿qué pasa si se exige a la punta moverse en línea recta a velocidad constante?',
        opciones: ['Nada especial', 'Alguna articulación necesitaría una velocidad enorme', 'La punta se mueve más rápido', 'El robot cambia solo a codo abajo'],
        correcta: 1,
        explicacion: 'Como $J$ casi no tiene inversa, $\\dot{q} = J^{-1}\\dot{x}$ crece sin límite. Por eso los controladores (y la pestaña Programar) detienen un MoveL que atraviesa una singularidad.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.4, -1.2, 0.5, 0, 0.5]); },
    },
  ],
};
