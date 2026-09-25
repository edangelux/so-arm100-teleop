// Lección 9: teoría de tornillos, cuaterniones duales, ScLERP y producto de exponenciales.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, mini, marco, linea, lectura, formula, botones, expTornillo, logTornillo, cuaternionDual, BRAZO, NOMBRE, grados } from './comun.js';

const APARTE = [1.0, -0.35, 0.7, 0.5, 0, 0.5];
const A = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, -0.3, 0.1)).setPosition(-0.12, -0.3, 0.1);
const B = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.5, 0.4, 2.3)).setPosition(0.1, -0.24, 0.28);

function pieza(app, color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.012), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })));
  const n = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.018, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  n.rotation.z = -Math.PI / 2; n.position.x = 0.033; g.add(n);
  g.matrixAutoUpdate = false;
  app.escena.extras.add(g);
  g.fijar = (M) => { g.matrix.copy(M); g.matrixWorldNeedsUpdate = true; };
  return g;
}

const esquina = (M) => new THREE.Vector3(0.025, 0.015, 0.006).applyMatrix4(M);

// Interpolación de tornillo (equivale a ScLERP de cuaterniones duales): A·exp(s·log(A⁻¹B)).
function sclerp(Ta, Tb, s) {
  const D = Ta.clone().invert().multiply(Tb);
  const L = logTornillo(D);
  return Ta.clone().multiply(expTornillo(L.w, L.v, L.th * s));
}

// Interpolación «por separado»: posición en línea recta y orientación con SLERP.
function separado(Ta, Tb, s) {
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), e = new THREE.Vector3();
  Ta.decompose(pa, qa, e); Tb.decompose(pb, qb, e);
  return new THREE.Matrix4().compose(pa.lerp(pb, s), qa.slerp(qb, s), new THREE.Vector3(1, 1, 1));
}

// Eje del tornillo de A a B, en el marco de la base: un punto y la dirección.
function ejeTornillo(Ta, Tb) {
  const D = Tb.clone().multiply(Ta.clone().invert());      // movimiento expresado en la base
  const L = logTornillo(D);
  if (L.w.lengthSq() < 1e-9) return null;
  const punto = L.w.clone().cross(L.v);                     // punto del eje más cercano al origen: ω × v
  const paso = L.w.dot(L.v);                                // avance por radián
  return { punto, dir: L.w, th: L.th, avance: paso * L.th };
}

export default {
  titulo: 'Cuaterniones duales y teoría de tornillos',
  resumen: 'Todo movimiento de un cuerpo rígido es un tornillo: un giro alrededor de un eje más un avance a lo largo de él. Los cuaterniones duales lo representan con ocho números y permiten interpolar poses sin distorsión.',
  conceptos: [
    ['Teorema de Chasles', 'Cualquier desplazamiento rígido equivale a girar un ángulo $\\theta$ alrededor de un eje y avanzar $d$ a lo largo de ese mismo eje.'],
    ['Tornillo $S = (\\omega, v)$', 'Seis números: la dirección del eje $\\omega$ y $v = -\\omega \\times q$ (con $q$ un punto del eje) más el paso $h\\,\\omega$.'],
    ['Número dual', '$a + \\varepsilon b$ con $\\varepsilon^2 = 0$. Un cuaternión dual es $\\sigma = r + \\varepsilon\\,d$ con $r$ y $d$ cuaterniones.'],
    ['ScLERP', 'Interpolación de cuaterniones duales: el objeto recorre exactamente el tornillo de A a B, girando y avanzando a la vez.'],
    ['Producto de exponenciales', '$T(q) = e^{[S_1]q_1}\\cdots e^{[S_n]q_n}\\,M$: cinemática directa sin marcos D-H, sólo con los ejes de las articulaciones en la postura cero.'],
  ],
  referencias: [
    'Lynch, K. y Park, F. (2017). <i>Modern Robotics: Mechanics, Planning, and Control</i>, cap. 3 y 4 (tornillos y producto de exponenciales).',
    'Kavan, L. et al. (2008). «Geometric skinning with approximate dual quaternion blending», ACM TOG: ScLERP y DLB.',
    'Brockett, R. (1984). «Robotic manipulators and the product of exponentials formula».',
  ],
  pasos: [
    {
      titulo: 'Todo movimiento es un tornillo',
      texto: 'La pieza va de la pose A (violeta) a la B. Por raro que parezca el movimiento, siempre se puede hacer con <b>un solo tornillo</b>: girar alrededor del eje durazno y avanzar a lo largo de él.',
      preparar(app, cuerpo) {
        app.escena.fijarPostura(APARTE);
        pieza(app, 0x7553ff).fijar(A);
        pieza(app, 0x3f3849).fijar(B);
        const p = pieza(app, 0xc2ef4e);
        const e = ejeTornillo(A, B);
        linea(app, [e.punto.clone().addScaledVector(e.dir, -0.4), e.punto.clone().addScaledVector(e.dir, 0.4)], 0xffb287);
        const rastro = [];
        const l = linea(app, [esquina(A), esquina(A)], 0xc2ef4e);
        const lec = lectura(`eje del tornillo: dirección (${e.dir.toArray().map((v) => v.toFixed(2)).join(', ')})\ngiro θ = ${grados(e.th).toFixed(1)}°   avance d = ${(e.avance * 1000).toFixed(1)} mm   paso h = d/θ = ${(e.avance / e.th * 1000).toFixed(1)} mm/rad`);
        cuerpo.append(lec);
        return animar((t) => {
          const s = (1 - Math.cos(t * 0.8)) / 2;
          const M = sclerp(A, B, s);
          p.fijar(M);
          if (rastro.length < 300) { rastro.push(esquina(M)); l.fijar(rastro); }
        });
      },
      detalle: `<p>El <b>teorema de Chasles</b> (1830) dice que todo desplazamiento de un cuerpo rígido, por complicado que sea, es equivalente a un <b>movimiento de tornillo</b>: un giro $\\theta$ alrededor de un eje fijo en el espacio, combinado con un avance $d$ a lo largo del mismo eje. El cociente $h = d/\\theta$ es el <b>paso</b> del tornillo.</p>
<ul><li>Si $d = 0$, es un giro puro (como una articulación giratoria).</li>
<li>Si $\\theta = 0$, es una traslación pura (como una articulación prismática: paso infinito).</li></ul>
<p>Un tornillo se describe con seis números, $S = (\\omega, v)$:</p>
$$\\omega = \\text{dirección del eje}, \\qquad v = -\\omega \\times q + h\\,\\omega$$
<p>con $q$ cualquier punto del eje. Y el desplazamiento completo es la <b>exponencial</b> del tornillo multiplicado por el ángulo:</p>
$$T = e^{[S]\\theta} = \\begin{bmatrix} e^{[\\omega]\\theta} & G(\\theta)\\,v \\\\ 0 & 1\\end{bmatrix}, \\qquad G(\\theta) = I\\theta + (1 - \\cos\\theta)[\\omega] + (\\theta - \\sin\\theta)[\\omega]^2$$
<p>La lectura de la izquierda muestra el tornillo que lleva de A a B, calculado con el logaritmo de la transformación ($\\log T$), que es la operación inversa.</p>`,
    },
    {
      titulo: 'El cuaternión dual',
      texto: 'Un cuaternión dual junta rotación y traslación en <b>ocho números</b>: $\\sigma = r + \\varepsilon\\,\\tfrac{1}{2}\\,t\\,r$, con $\\varepsilon^2 = 0$. Mueva el brazo y vea los de la pinza.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = [0.3, 0.3, -0.4, 0.5, 0.3, 0.5];
        app.escena.fijarPostura(q);
        const m = marco(app, app.cadena.fk(q).efector, { largo: 0.06 });
        const lec = lectura();
        const act = () => {
          const T = app.cadena.fk(q).efector;
          m.fijar(T);
          const { r, d } = cuaternionDual(T);
          const f = (x) => x.toFixed(4).padStart(8);
          lec.textContent = `parte real   r = (${f(r.w)}, ${f(r.x)}, ${f(r.y)}, ${f(r.z)})   ← orientación\nparte dual   d = (${f(d.w)}, ${f(d.x)}, ${f(d.y)}, ${f(d.z)})   ← ½·t·r (m)\n|r| = ${Math.hypot(r.w, r.x, r.y, r.z).toFixed(4)}    r·d = ${(r.w * d.w + r.x * d.x + r.y * d.y + r.z * d.z).toExponential(1)}  (siempre 0)`;
        };
        cuerpo.append(formula('\\sigma = r + \\varepsilon\\,d, \\qquad d = \\tfrac{1}{2}\\,t\\,r, \\qquad \\varepsilon^2 = 0'), lec, mini(app, q, act));
        act();
      },
      detalle: `<p>Un <b>número dual</b> es $a + \\varepsilon b$, donde $\\varepsilon$ es un símbolo con la regla $\\varepsilon^2 = 0$ (parecido a la unidad imaginaria, pero con cuadrado cero). Si en lugar de números reales $a$ y $b$ se usan cuaterniones, se obtiene un <b>cuaternión dual</b>:</p>
$$\\sigma = r + \\varepsilon\\,d$$
<p>Para representar una pose con rotación $r$ (cuaternión unitario, lección 4) y traslación $t$:</p>
$$\\sigma = r + \\varepsilon\\,\\tfrac{1}{2}\\,t\\,r, \\qquad t = (0, t_x, t_y, t_z)$$
<p>Propiedades que lo hacen útil en robótica:</p>
<ul><li><b>Componer poses es multiplicar</b>: $\\sigma_{0}^{2} = \\sigma_0^1\\,\\sigma_1^2$, igual que con matrices 4×4, pero con 8 números en vez de 16.</li>
<li>Tiene sólo dos restricciones ($\\|r\\| = 1$ y $r \\cdot d = 0$), fáciles de restablecer si el error numérico las rompe. Una matriz 4×4 acumulada muchas veces deja de ser una rotación válida.</li>
<li>Su logaritmo es directamente el tornillo, y la interpolación natural (ScLERP) recorre ese tornillo.</li></ul>
<p>Se usan en animación de personajes (deformación de piel), en control de robots con restricciones de pose y en calibración mano-ojo, donde la ecuación $AX = XB$ se resuelve de forma elegante con cuaterniones duales (lección 16).</p>`,
    },
    {
      titulo: 'ScLERP contra interpolar por separado',
      texto: 'Dos piezas van de A a B. La <b>fucsia</b> mueve la posición en línea recta y gira aparte (SLERP); la <b>lima</b> usa <b>ScLERP</b> y sigue el tornillo. Mire las trayectorias de una esquina.',
      preparar(app, cuerpo) {
        app.escena.fijarPostura(APARTE);
        pieza(app, 0x7553ff).fijar(A);
        pieza(app, 0x3f3849).fijar(B);
        const pS = pieza(app, 0xfd44b0), pC = pieza(app, 0xc2ef4e);
        const rS = [], rC = [];
        const lS = linea(app, [esquina(A), esquina(A)], 0xfd44b0), lC = linea(app, [esquina(A), esquina(A)], 0xc2ef4e);
        cuerpo.append(lectura('Las dos terminan igual; lo que cambia es el camino intermedio.'));
        return animar((t) => {
          const s = (1 - Math.cos(t * 0.8)) / 2;
          const MS = separado(A, B, s), MC = sclerp(A, B, s);
          pS.fijar(MS); pC.fijar(MC);
          if (rS.length < 300) { rS.push(esquina(MS)); rC.push(esquina(MC)); lS.fijar(rS); lC.fijar(rC); }
        });
      },
      detalle: `<p>Para ir de la pose A a la B hay dos maneras habituales de interpolar:</p>
<ol><li><b>Por separado</b>: la posición en línea recta y la orientación con SLERP. El origen del objeto sigue una recta, pero los demás puntos del cuerpo describen curvas que dependen de dónde se puso el origen: si se elige otro punto de referencia, cambia el movimiento.</li>
<li><b>ScLERP</b> (<i>screw linear interpolation</i>): con cuaterniones duales,
$$\\sigma(s) = \\sigma_A\\,(\\sigma_A^{-1}\\sigma_B)^s$$
el objeto recorre el tornillo que une A y B, girando y avanzando uniformemente. Todos los puntos del cuerpo describen hélices alrededor del mismo eje, y el resultado <b>no depende del punto de referencia</b> elegido.</li></ol>
<p>La aplicación calcula ScLERP con la forma equivalente de matrices, $A\\,e^{s\\log(A^{-1}B)}$ (misma curva).</p>
<p>¿Cuál conviene a un robot? Depende de lo que se necesite: un <code>MoveL</code> industrial usa el método 1, porque lo que se pide es que la <b>punta de la herramienta</b> vaya en línea recta. ScLERP conviene cuando importa el movimiento de todo el cuerpo (por ejemplo, llevar una pieza larga sin barrer un volumen innecesario) y en animación.</p>`,
    },
    {
      titulo: 'El producto de exponenciales',
      texto: 'Cada articulación es un tornillo de paso cero. Con sus ejes en la postura cero (líneas durazno) y la pose inicial $M$, la cinemática directa es $T = e^{[S_1]q_1}\\cdots e^{[S_5]q_5}\\,M$. Compare con el URDF.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = [0.3, 0.3, -0.4, 0.5, 0.3, 0.5];
        const f0 = app.cadena.fk([0, 0, 0, 0, 0]);
        const S = BRAZO.map((n) => {
          const j = app.modelo.juntas.find((x) => x.nombre === n);
          const w = new THREE.Vector3(...j.eje).normalize().transformDirection(f0[n]);
          const p = new THREE.Vector3().setFromMatrixPosition(f0[n]);
          return { n, w, p, v: w.clone().cross(p).negate() };
        });
        const M = f0.efector;
        const lineas = S.map(() => linea(app, [new THREE.Vector3(), new THREE.Vector3()], 0xffb287));
        const m = marco(app, M, { largo: 0.06 });
        const lec = lectura();
        const tabla = el('div', { class: 'texto-largo', html: `<table><tr><th>Articulación</th><th>ω (eje)</th><th>q (punto del eje, mm)</th><th>v = −ω × q (m)</th></tr>${S.map((s) => `<tr><td>${NOMBRE[s.n]}</td><td>(${s.w.toArray().map((v) => v.toFixed(0)).join(', ')})</td><td>(${s.p.toArray().map((v) => (v * 1000).toFixed(1)).join(', ')})</td><td>(${s.v.toArray().map((v) => v.toFixed(3)).join(', ')})</td></tr>`).join('')}</table>` });
        const act = () => {
          const T = new THREE.Matrix4();
          S.forEach((s, i) => {
            // Eje de cada articulación en la postura actual: el tornillo movido por las anteriores.
            const Ti = T.clone();
            const p = s.p.clone().applyMatrix4(Ti), w = s.w.clone().transformDirection(Ti);
            lineas[i].fijar([p.clone().addScaledVector(w, -0.05), p.clone().addScaledVector(w, 0.05)]);
            T.multiply(expTornillo(s.w, s.v, q[i]));
          });
          T.multiply(M);
          m.fijar(T);
          const U = app.cadena.fk(q).efector;
          let e = 0; for (let i = 0; i < 16; i++) e = Math.max(e, Math.abs(T.elements[i] - U.elements[i]));
          lec.textContent = `producto de exponenciales vs. cadena del URDF: diferencia máxima ${e.toExponential(1)} (redondeo de punto flotante)`;
        };
        cuerpo.append(formula('T(q) = e^{[S_1]q_1}\\,e^{[S_2]q_2}\\,e^{[S_3]q_3}\\,e^{[S_4]q_4}\\,e^{[S_5]q_5}\\,M'), tabla, lec, mini(app, q, act));
        app.escena.fijarPostura(q);
        act();
      },
      detalle: `<p>El <b>producto de exponenciales</b> (PoE) es la alternativa moderna a Denavit–Hartenberg. No hace falta elegir marcos por eslabón: basta con</p>
<ul><li>$M$: la pose de la pinza con todos los ángulos en cero (en el SO-ARM100, la postura <code>init</code>),</li>
<li>$S_i = (\\omega_i, v_i)$: el tornillo de cada articulación en esa misma postura. Para una articulación giratoria el paso es cero, así que $v_i = -\\omega_i \\times q_i$, con $q_i$ cualquier punto de su eje.</li></ul>
$$T(q) = e^{[S_1]q_1}\\,e^{[S_2]q_2}\\cdots e^{[S_n]q_n}\\,M$$
<p>Se lee de derecha a izquierda: partiendo de $M$, se gira la última articulación, luego la anterior (que arrastra a todo lo que tiene delante), y así hasta la base.</p>
<p>La tabla muestra los tornillos del SO-ARM100 medidos del URDF. Se ve la estructura del brazo: la base gira alrededor de $-z$ (vertical), hombro, codo y flexión de muñeca alrededor de $x$ (ejes paralelos, a distintas alturas) y el giro de muñeca alrededor de $y$ (a lo largo del antebrazo en la postura cero).</p>
<p>Ventajas frente a D-H: los parámetros tienen significado físico directo (ejes y puntos), no hay casos especiales para ejes paralelos, y el jacobiano sale casi gratis: su columna $i$ es el tornillo $S_i$ movido por las articulaciones anteriores. Es la formulación de <i>Modern Robotics</i> (Lynch y Park), usada en muchos cursos actuales.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Según el teorema de Chasles, una articulación <b>prismática</b> corresponde a un tornillo con…',
        opciones: ['paso cero', 'paso infinito (sólo avance, sin giro)', 'eje vertical', 'ángulo de 90°'],
        correcta: 1,
        explicacion: 'Una prismática sólo traslada: $\\theta = 0$ y $d \\ne 0$, así que $h = d/\\theta \\to \\infty$. Una giratoria es lo contrario: paso cero.',
      },
      preparar(app) { app.escena.fijarPostura(APARTE); },
    },
  ],
};
