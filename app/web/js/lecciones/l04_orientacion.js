// Lección 4: posición y orientación. Matriz de rotación, rotaciones
// elementales, ángulos de Euler, bloqueo de cardán y cuaterniones (SLERP).
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, mini, marco, matriz, deslizador, formula, linea, botones, lectura, grados } from './comun.js';

const P0 = new THREE.Vector3(0, -0.33, 0.28);        // punto de demostración, delante y arriba del brazo
const APARTE = [1.0, -0.35, 0.7, 0.5, 0, 0.5];       // el brazo girado a un lado, para no tapar

const filas3 = (M) => { const e = M.elements; return [0, 1, 2].map((r) => [0, 1, 2].map((c) => e[c * 4 + r])); };

function cuboDemo(app) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.015), new THREE.MeshStandardMaterial({ color: 0xefefef, roughness: 0.5 }));
  const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xfd44b0 }));
  nariz.rotation.z = -Math.PI / 2; nariz.position.x = 0.034;
  g.add(m, nariz);
  g.position.copy(P0);
  app.escena.extras.add(g);
  return g;
}

export default {
  titulo: 'Posición y orientación',
  resumen: 'Cómo se describe hacia dónde apunta la pinza: matrices de rotación, ángulos de Euler y cuaterniones.',
  conceptos: [
    ['Marco de coordenadas', 'Tres ejes perpendiculares x, y, z pegados a un cuerpo. Su origen da la posición y sus direcciones, la orientación.'],
    ['Matriz de rotación $R$', 'Matriz 3×3 cuyas columnas son los ejes del marco girado, escritos en el marco de referencia. Cumple $R^\\top R = I$ y $\\det R = 1$.'],
    ['Ángulos de Euler', 'Tres giros seguidos alrededor de ejes. En robótica es común ZYX: guiñada $\\psi$, cabeceo $\\theta$ y alabeo $\\phi$.'],
    ['Bloqueo de cardán', 'Con cabeceo de ±90°, dos giros de Euler actúan sobre el mismo eje y se pierde un grado de libertad de la representación.'],
    ['Cuaternión unitario', '$q = (\\cos\\tfrac{\\theta}{2},\\ \\hat{n}\\,\\sin\\tfrac{\\theta}{2})$: cuatro números para un giro $\\theta$ alrededor del eje $\\hat{n}$, sin bloqueo de cardán.'],
    ['SLERP', 'Interpolación esférica entre dos cuaterniones: gira a velocidad constante por el camino más corto.'],
  ],
  referencias: [
    'Lynch, K. y Park, F. <i>Modern Robotics</i>, cap. 3 (movimientos rígidos, rotaciones y exponenciales).',
    'Shoemake, K. (1985). «Animating rotation with quaternion curves», SIGGRAPH: origen de SLERP.',
    'docs/08 del repositorio: por qué el proyecto no usa cuaterniones como objetivo de control con 5 GDL.',
  ],
  pasos: [
    {
      titulo: 'Un marco pegado a la pinza',
      texto: 'Los tres ejes muestran hacia dónde apunta la pinza: <b style="color:#fd44b0">x</b>, <b style="color:#c2ef4e">y</b>, <b style="color:#7553ff">z</b>. Mueva la muñeca: la matriz $R$ cambia. Cada <b>columna</b> es un eje de la pinza visto desde la base.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = [0.2, 0.2, -0.3, 0.3, 0.4, 0.5];
        app.escena.fijarPostura(q);
        const T = app.cadena.fk(q).efector;
        const m = marco(app, T, { largo: 0.07 });
        const tabla = matriz(filas3(T), { clases: (i, j) => ['r', 'p', 'u'][j] });
        const pos = lectura();
        const act = () => {
          const M = app.cadena.fk(q).efector;
          m.fijar(M);
          tabla.fijar(filas3(M));
          const p = new THREE.Vector3().setFromMatrixPosition(M);
          pos.textContent = `posición p = (${(p.x * 1000).toFixed(0)}, ${(p.y * 1000).toFixed(0)}, ${(p.z * 1000).toFixed(0)}) mm   ·   columnas de R: eje x | eje y | eje z`;
        };
        cuerpo.append(el('div', { class: 'fila', style: 'gap:16px;align-items:center' }, formula('R ='), tabla), pos,
          mini(app, q, act, { articulaciones: ['Wrist_Pitch', 'Wrist_Roll', 'Shoulder_Rotation'] }));
        act();
      },
      detalle: `<p>Para decir dónde está un objeto rígido hacen falta dos cosas: su <b>posición</b> (un punto) y su <b>orientación</b> (hacia dónde mira). La forma estándar es pegarle un <b>marco de coordenadas</b>: un origen y tres ejes perpendiculares.</p>
<p>La orientación se escribe como una <b>matriz de rotación</b>. Si $\\hat{x}_1, \\hat{y}_1, \\hat{z}_1$ son los ejes del marco de la pinza escritos con las coordenadas de la base, entonces</p>
$$R = \\begin{bmatrix} \\hat{x}_1 & \\hat{y}_1 & \\hat{z}_1 \\end{bmatrix} = \\begin{bmatrix} r_{11} & r_{12} & r_{13}\\\\ r_{21} & r_{22} & r_{23}\\\\ r_{31} & r_{32} & r_{33} \\end{bmatrix}$$
<p>Cada columna es un vector unitario, y las tres son perpendiculares entre sí. Por eso $R$ cumple</p>
$$R^\\top R = I, \\qquad \\det R = +1$$
<p>La primera propiedad dice que <b>la inversa es la transpuesta</b>: $R^{-1} = R^\\top$, lo que hace muy barato «deshacer» un giro.</p>
<p>Aunque tiene 9 números, una rotación sólo tiene <b>3 grados de libertad</b>: las 6 condiciones de ortonormalidad quitan los demás. En la pinza del SO-ARM100, el eje de aproximación (hacia donde apunta) es el $-y$ del marco del URDF.</p>`,
    },
    {
      titulo: 'Rotaciones elementales',
      texto: 'Cualquier giro se puede armar con giros alrededor de x, y o z. Elija un eje y gire el objeto: la matriz tiene siempre la misma forma, con $\\cos$ y $\\sin$ del ángulo.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura(APARTE);
        const obj = cuboDemo(app);
        const m = marco(app, new THREE.Matrix4().setPosition(P0), { largo: 0.06 });
        let eje = 'z', ang = 0.6;
        const tex = { x: 'R_x(\\theta)=\\begin{bmatrix}1&0&0\\\\0&\\cos\\theta&-\\sin\\theta\\\\0&\\sin\\theta&\\cos\\theta\\end{bmatrix}', y: 'R_y(\\theta)=\\begin{bmatrix}\\cos\\theta&0&\\sin\\theta\\\\0&1&0\\\\-\\sin\\theta&0&\\cos\\theta\\end{bmatrix}', z: 'R_z(\\theta)=\\begin{bmatrix}\\cos\\theta&-\\sin\\theta&0\\\\\\sin\\theta&\\cos\\theta&0\\\\0&0&1\\end{bmatrix}' };
        const f = el('div');
        const tabla = matriz([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
        const act = () => {
          const R = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(eje === 'x' ? 1 : 0, eje === 'y' ? 1 : 0, eje === 'z' ? 1 : 0), ang);
          obj.quaternion.setFromRotationMatrix(R);
          m.fijar(R.clone().setPosition(P0));
          f.replaceChildren(formula(tex[eje]));
          tabla.fijar(filas3(R));
        };
        const d = deslizador('Ángulo θ', { min: -3.14, max: 3.14, paso: 0.01, valor: ang, formato: (v) => `${grados(v).toFixed(0)}°`, alCambiar: (v) => { ang = v; act(); } });
        cuerpo.append(botones(['Eje x', () => { eje = 'x'; act(); }], ['Eje y', () => { eje = 'y'; act(); }], ['Eje z', () => { eje = 'z'; act(); }]),
          el('div', { class: 'fila', style: 'gap:18px;align-items:center;flex-wrap:wrap' }, f, tabla), d);
        act();
      },
      detalle: `<p>Las tres <b>rotaciones elementales</b> giran un ángulo $\\theta$ alrededor de uno de los ejes del marco de referencia:</p>
$$R_x(\\theta)=\\begin{bmatrix}1&0&0\\\\0&c_\\theta&-s_\\theta\\\\0&s_\\theta&c_\\theta\\end{bmatrix}\\quad R_y(\\theta)=\\begin{bmatrix}c_\\theta&0&s_\\theta\\\\0&1&0\\\\-s_\\theta&0&c_\\theta\\end{bmatrix}\\quad R_z(\\theta)=\\begin{bmatrix}c_\\theta&-s_\\theta&0\\\\s_\\theta&c_\\theta&0\\\\0&0&1\\end{bmatrix}$$
<p>con $c_\\theta = \\cos\\theta$ y $s_\\theta = \\sin\\theta$. El eje de giro no cambia: por eso su fila y su columna son las de la identidad.</p>
<p>Dos giros seguidos se combinan <b>multiplicando matrices</b>, y el orden importa:</p>
$$R_z(90^\\circ)\\,R_x(90^\\circ) \\neq R_x(90^\\circ)\\,R_z(90^\\circ)$$
<p>Pruébelo con un libro: gire 90° sobre la mesa y luego 90° hacia usted, y después al revés. Terminan en posiciones distintas. Las rotaciones en 3D <b>no conmutan</b>.</p>
<p>Cada articulación del SO-ARM100 es exactamente una rotación elemental alrededor de su propio eje; la cinemática directa (lección 6) las multiplica en orden.</p>`,
    },
    {
      titulo: 'Ángulos de Euler: guiñada, cabeceo y alabeo',
      texto: 'Tres números para una orientación: primero se gira la <b>guiñada</b> $\\psi$ (alrededor de z), luego el <b>cabeceo</b> $\\theta$ (y) y al final el <b>alabeo</b> $\\phi$ (x). Es la convención ZYX de los aviones.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura(APARTE);
        const obj = cuboDemo(app);
        const m = marco(app, new THREE.Matrix4().setPosition(P0), { largo: 0.06 });
        const e = { z: 0.5, y: 0.3, x: 0.2 };
        const tabla = matriz(filas3(new THREE.Matrix4()));
        const act = () => {
          const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(e.x, e.y, e.z, 'ZYX'));
          obj.quaternion.setFromRotationMatrix(R);
          m.fijar(R.clone().setPosition(P0));
          tabla.fijar(filas3(R));
        };
        const d = (n, k) => deslizador(n, { min: -3.14, max: 3.14, paso: 0.01, valor: e[k], formato: (v) => `${grados(v).toFixed(0)}°`, alCambiar: (v) => { e[k] = v; act(); } });
        cuerpo.append(formula('R = R_z(\\psi)\\,R_y(\\theta)\\,R_x(\\phi)'), tabla,
          d('Guiñada ψ (z)', 'z'), d('Cabeceo θ (y)', 'y'), d('Alabeo φ (x)', 'x'));
        act();
      },
      detalle: `<p>Los <b>ángulos de Euler</b> describen una orientación con tres giros elementales seguidos. Hay 12 convenciones posibles según el orden de los ejes; en robótica y aviación es común <b>ZYX</b> (también llamada RPY, <i>roll–pitch–yaw</i>):</p>
$$R(\\psi,\\theta,\\phi) = R_z(\\psi)\\,R_y(\\theta)\\,R_x(\\phi)$$
<p>Leída de izquierda a derecha, cada giro se aplica sobre los ejes <b>ya girados</b> del paso anterior (ejes móviles). Leída de derecha a izquierda, son giros sobre los ejes fijos de la base. Las dos lecturas dan la misma matriz.</p>
<p>Para recuperar los ángulos desde una matriz:</p>
$$\\theta = -\\arcsin r_{31}, \\qquad \\psi = \\operatorname{atan2}(r_{21}, r_{11}), \\qquad \\phi = \\operatorname{atan2}(r_{32}, r_{33})$$
<p>El URDF usa esta convención en <code>rpy="…"</code>: por ejemplo, la articulación del giro de muñeca tiene <code>rpy="0 1.57079 0"</code>, un cabeceo de 90° respecto de la muñeca. La aplicación la convierte con <code>new THREE.Euler(r, p, y, 'ZYX')</code>.</p>
<p>Son cómodos para una persona (tres ángulos con nombre), pero tienen un defecto serio, que muestra el siguiente paso.</p>`,
    },
    {
      titulo: 'El bloqueo de cardán',
      texto: 'Tres anillos anidados, como un giroscopio. Pulse <b>Cabeceo 90°</b> y mueva la guiñada y el alabeo: <b>hacen lo mismo</b>. Se perdió un grado de libertad de la representación.',
      preparar(app, cuerpo) {
        app.escena.fijarPostura(APARTE);
        const c = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
        const ext = new THREE.Group(), med = new THREE.Group(), int = new THREE.Group();
        const aro = (r, color) => new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 12, 96), c(color));
        // Cada aro contiene su eje de giro, como en un giroscopio real.
        const a1 = aro(0.07, 0x7553ff); a1.rotation.x = Math.PI / 2;          // gira en z: plano xz
        const a2 = aro(0.058, 0xc2ef4e); a2.rotation.y = Math.PI / 2;         // gira en y: plano yz
        const a3 = aro(0.046, 0xfd44b0);                                      // gira en x: plano xy
        const flecha = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.03, 0, 0), 0.07, 0xffffff, 0.015, 0.01);
        ext.add(a1, med); med.add(a2, int); int.add(a3, flecha);
        ext.position.copy(P0);
        app.escena.extras.add(ext);
        const e = { z: 0.3, y: 0.2, x: 0.1 };
        const act = () => { ext.rotation.z = e.z; med.rotation.y = e.y; int.rotation.x = e.x; };
        const dz = deslizador('Guiñada ψ (z)', { min: -3.14, max: 3.14, valor: e.z, formato: (v) => `${grados(v).toFixed(0)}°`, alCambiar: (v) => { e.z = v; act(); } });
        const dy = deslizador('Cabeceo θ (y)', { min: -1.57, max: 1.57, valor: e.y, formato: (v) => `${grados(v).toFixed(0)}°`, alCambiar: (v) => { e.y = v; act(); } });
        const dx = deslizador('Alabeo φ (x)', { min: -3.14, max: 3.14, valor: e.x, formato: (v) => `${grados(v).toFixed(0)}°`, alCambiar: (v) => { e.x = v; act(); } });
        cuerpo.append(dz, dy, dx, botones(['Cabeceo 90°', () => { e.y = Math.PI / 2 - 1e-3; dy.fijar(e.y); act(); }], ['Cabeceo 0°', () => { e.y = 0; dy.fijar(0); act(); }]));
        act();
      },
      detalle: `<p>Con cabeceo $\\theta = 90^\\circ$ la matriz ZYX se reduce a</p>
$$R = \\begin{bmatrix} 0 & \\sin(\\phi-\\psi) & \\cos(\\phi-\\psi)\\\\ 0 & \\cos(\\phi-\\psi) & -\\sin(\\phi-\\psi)\\\\ -1 & 0 & 0\\end{bmatrix}$$
<p>Sólo depende de la <b>diferencia</b> $\\phi-\\psi$: infinitas parejas (guiñada, alabeo) dan la misma orientación, y ningún cambio pequeño de los ángulos produce ciertos giros pequeños del objeto. Esto se llama <b>bloqueo de cardán</b> (<i>gimbal lock</i>). Las plataformas inerciales del programa Apolo usaban tres anillos y tenían que evitar esa posición.</p>
<p>Consecuencias prácticas:</p>
<ul><li>Interpolar entre dos orientaciones promediando ángulos de Euler da giros raros cerca del bloqueo.</li>
<li>Recuperar los ángulos desde $R$ se vuelve inestable ($r_{11}$ y $r_{21}$ son casi cero en la fórmula de la guiñada).</li></ul>
<p>No es un defecto del objeto: es un defecto de <b>la representación</b>. Ninguna representación con sólo tres números evita todas las singularidades. La solución habitual es el cuaternión.</p>`,
    },
    {
      titulo: 'Cuaterniones y SLERP',
      texto: 'Dos objetos van de la orientación A a la B. El <b>fucsia</b> interpola los ángulos de Euler; el <b>lima</b> usa <b>SLERP</b> sobre cuaterniones. Compare las trayectorias de sus puntas.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura(APARTE);
        const A = new THREE.Euler(0, 0, 0, 'ZYX');
        const B = new THREE.Euler(2.6, 1.25, -2.4, 'ZYX');
        const qA = new THREE.Quaternion().setFromEuler(A), qB = new THREE.Quaternion().setFromEuler(B);
        const mk = (color, dx) => {
          const g = new THREE.Group();
          const f = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.06, color, 0.016, 0.01);
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.008), new THREE.MeshStandardMaterial({ color }));
          g.add(f, s);
          g.position.copy(P0).add(new THREE.Vector3(dx, 0, 0));
          app.escena.extras.add(g);
          return g;
        };
        const gE = mk(0xfd44b0, -0.06), gS = mk(0xc2ef4e, 0.06);
        const tE = [], tS = [];
        const punta = (g) => new THREE.Vector3(0.06, 0, 0).applyQuaternion(g.quaternion).add(g.position);
        const lE = linea(app, [P0, P0], 0xfd44b0), lS = linea(app, [P0, P0], 0xc2ef4e);
        const lec = lectura();
        cuerpo.append(lec);
        return animar((t) => {
          const s = (Math.sin(t * 0.7 - Math.PI / 2) + 1) / 2;
          gE.rotation.set(A.x + (B.x - A.x) * s, A.y + (B.y - A.y) * s, A.z + (B.z - A.z) * s, 'ZYX');
          gS.quaternion.slerpQuaternions(qA, qB, s);
          if (tE.length < 400) { tE.push(punta(gE)); tS.push(punta(gS)); lE.fijar(tE); lS.fijar(tS); }
          const q = gS.quaternion;
          lec.textContent = `SLERP  q = (w ${q.w.toFixed(3)}, x ${q.x.toFixed(3)}, y ${q.y.toFixed(3)}, z ${q.z.toFixed(3)})   |q| = ${Math.hypot(q.w, q.x, q.y, q.z).toFixed(3)}   s = ${s.toFixed(2)}`;
        });
      },
      detalle: `<p>Un <b>cuaternión unitario</b> representa un giro de ángulo $\\theta$ alrededor del eje unitario $\\hat{n}$ con cuatro números:</p>
$$q = \\left(\\cos\\tfrac{\\theta}{2},\\; n_x \\sin\\tfrac{\\theta}{2},\\; n_y \\sin\\tfrac{\\theta}{2},\\; n_z \\sin\\tfrac{\\theta}{2}\\right), \\qquad \\|q\\| = 1$$
<p>Ventajas frente a Euler y matrices:</p>
<ul><li><b>Sin bloqueo de cardán</b>: cuatro números con una sola condición ($\\|q\\|=1$) cubren todas las orientaciones sin singularidades.</li>
<li>Componer giros es multiplicar cuaterniones (16 multiplicaciones, frente a 27 de las matrices).</li>
<li>Renormalizar un cuaternión con error numérico es trivial; reortogonalizar una matriz no.</li>
<li>$q$ y $-q$ representan el mismo giro: al interpolar se elige el signo que da el camino corto.</li></ul>
<p>La <b>interpolación esférica</b> (SLERP) recorre el arco más corto sobre la esfera de los cuaterniones unitarios a velocidad angular constante:</p>
$$\\operatorname{slerp}(q_A, q_B, s) = \\frac{\\sin((1-s)\\Omega)}{\\sin\\Omega}\\,q_A + \\frac{\\sin(s\\Omega)}{\\sin\\Omega}\\,q_B, \\qquad \\cos\\Omega = q_A\\cdot q_B$$
<p>En la figura, la punta lima describe un arco limpio; la fucsia, que promedia ángulos de Euler, da un rodeo. Por eso ROS (TF), MoveIt y los controladores industriales usan cuaterniones internamente: <code>geometry_msgs/Quaternion</code> es el tipo con que viaja toda orientación en ROS 2.</p>
<p>En este proyecto la teleoperación no usa cuaterniones como objetivo: con 5 GDL la orientación alcanzable es una familia de 2 parámetros, y un cuaternión pediría orientaciones que el brazo no puede tomar (docs/08).</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta sobre representaciones.',
      pregunta: {
        enunciado: 'Una matriz de rotación tiene 9 números y un cuaternión 4. ¿Cuántos <b>grados de libertad</b> tiene una orientación en el espacio?',
        opciones: ['2', '3', '4', '9'],
        correcta: 1,
        explicacion: 'Tres. La matriz tiene 6 restricciones (columnas unitarias y perpendiculares) y el cuaternión una ($\\|q\\| = 1$): 9 − 6 = 4 − 1 = 3.',
      },
      preparar(app) { app.escena.fijarPostura(APARTE); },
    },
    {
      titulo: 'La inversa de un giro',
      texto: 'Última.',
      pregunta: {
        enunciado: 'Si $R$ lleva la base a la orientación de la pinza, ¿cómo se obtiene el giro contrario $R^{-1}$ sin invertir la matriz?',
        opciones: ['Cambiando el signo de todos los elementos', 'Transponiendo: $R^{-1} = R^\\top$', 'Calculando el determinante', 'No se puede sin invertir'],
        correcta: 1,
        explicacion: 'Como $R^\\top R = I$, la transpuesta es la inversa. Para un cuaternión, basta cambiar el signo de la parte vectorial (el conjugado).',
      },
      preparar(app) { app.escena.fijarPostura(APARTE); },
    },
  ],
};
