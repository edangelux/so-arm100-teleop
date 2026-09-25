// Lección 15: programación de robots industriales. Marcos, jog, MoveJ/MoveL/MoveC,
// zonas, Offs, señales, y retos que se resuelven en la pestaña Programar.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, marco, linea, lectura, botones, esfera, etiqueta, figura, GRADO, grados } from './comun.js';
import { Planificador, muestrear, marcoHerramienta } from '../programa/movimiento.js';

const LENGUAJES = `<table>
<tr><th>Fabricante</th><th>Lenguaje</th><th>Articular</th><th>Lineal</th><th>Circular</th><th>Desplazar un punto</th></tr>
<tr><td>ABB</td><td>RAPID</td><td><code>MoveJ</code></td><td><code>MoveL</code></td><td><code>MoveC</code></td><td><code>Offs(p,x,y,z)</code></td></tr>
<tr><td>KUKA</td><td>KRL</td><td><code>PTP</code></td><td><code>LIN</code></td><td><code>CIRC</code></td><td><code>p:{x 10}</code> (agregado)</td></tr>
<tr><td>FANUC</td><td>TP</td><td><code>J P[1]</code></td><td><code>L P[1]</code></td><td><code>C P[1] P[2]</code></td><td><code>Offset,PR[1]</code></td></tr>
<tr><td>Universal Robots</td><td>URScript</td><td><code>movej</code></td><td><code>movel</code></td><td><code>movec</code></td><td><code>pose_trans</code></td></tr>
<tr><td><b>SO-ARM100 Estudio</b></td><td>subconjunto de RAPID</td><td><code>MoveJ</code></td><td><code>MoveL</code></td><td><code>MoveC</code></td><td><code>Offs</code>, <code>RelTool</code></td></tr></table>`;

export default {
  titulo: 'Programación de robots industriales',
  resumen: 'Cómo se programa un robot de fábrica: marcos de referencia, mover a mano, enseñar puntos y las instrucciones MoveJ, MoveL y MoveC. Todo se practica en la pestaña <b>Programar</b>.',
  conceptos: [
    ['TCP', '<i>Tool Center Point</i>: el punto de la herramienta que el programa mueve. Aquí, la punta de la pinza.'],
    ['Marco de herramienta', 'Marco pegado al TCP. En la aplicación su eje z es la dirección en que apunta la pinza.'],
    ['Objeto de trabajo', 'Marco pegado a la pieza o la mesa. Si la mesa se mueve, se corrige el marco y el programa sigue valiendo.'],
    ['Jog', 'Mover el robot a mano con botones, articulación por articulación o en línea recta sobre los ejes.'],
    ['Enseñar un punto', 'Llevar el robot a mano a una posición y guardarla en el programa (<i>teach-in</i>).'],
    ['Zona', 'Cuánto puede redondear el robot al pasar por un punto sin detenerse: <code>fine</code> o <code>z10</code>.'],
  ],
  referencias: [
    'ABB. <i>Technical reference manual — RAPID Instructions, Functions and Data types</i> (MoveJ, MoveL, MoveC, Offs, speeddata, zonedata).',
    'KUKA. <i>KUKA System Software — Operating and Programming Instructions</i> (PTP, LIN, CIRC).',
    'Pestaña Programar de esta aplicación y app/web/js/programa/lenguaje.js (el subconjunto de RAPID implementado).',
  ],
  pasos: [
    {
      titulo: 'Tres marcos de referencia',
      texto: 'Un programa industrial usa varios marcos: el de la <b>base</b> del robot, el de la <b>herramienta</b> (en la punta de la pinza) y el del <b>objeto de trabajo</b> (aquí, la esquina de la bandeja).',
      preparar(app) {
        app.celda?.mostrar(true);
        const q = [0.2, 0.35, -0.2, 0.9, 0, 0.9];
        app.escena.fijarPostura(q);
        marco(app, new THREE.Matrix4(), { largo: 0.08, nombre: 'base (wobj0)' });
        const ps = app.cadena.pose(q);
        const m = marcoHerramienta(ps.p, ps.cab, q[4]);
        const T = new THREE.Matrix4().makeBasis(m.x, m.y, m.z).setPosition(ps.p);
        marco(app, T, { largo: 0.06, nombre: 'herramienta (TCP)' });
        marco(app, new THREE.Matrix4().setPosition(0.06, -0.15, 0.0), { largo: 0.06, nombre: 'bandeja (objeto de trabajo)' });
        app.escena.vista('programa');
      },
      detalle: `<p>Todo punto de un programa se expresa respecto de un marco. Los tres importantes:</p>
<ul><li><b>Base</b> (<code>wobj0</code> en RAPID, <code>&#36;ROBROOT</code> en KUKA): fijo al pie del robot. En la aplicación, el de <code>base_link</code> del URDF; el brazo mira hacia $-y$.</li>
<li><b>Herramienta</b> (<code>tool0</code> + los datos de la herramienta): define dónde está el TCP y cómo está orientado. Si se cambia la pinza por un marcador, sólo cambia este dato y el programa se reutiliza. En la aplicación, el TCP es la punta de la pinza, con $z$ en la dirección en que apunta; <code>RelTool(p, 0, 0, -50)</code> retrocede 50 mm a lo largo de ese eje.</li>
<li><b>Objeto de trabajo</b> (<code>wobjdata</code>, <code>BASE</code> en KUKA): pegado a la mesa o al utillaje. Los puntos de la pieza se enseñan respecto de él; si mañana la mesa se corre 3 cm, se vuelve a medir sólo el marco (tres puntos) y todos los puntos del programa se corrigen solos.</li></ul>
<p>El subconjunto de RAPID de la aplicación expresa todo respecto de la base y acepta <code>tool0</code> y <code>wobj0</code> por compatibilidad. Los desplazamientos con <code>Offs</code> hacen el papel de un objeto de trabajo sencillo: un punto de referencia y todo lo demás relativo a él.</p>`,
    },
    {
      titulo: 'Mover a mano (jog)',
      texto: 'La consola de programación tiene botones para mover el robot. En <b>articular</b> se mueve una articulación; en <b>cartesiano</b>, la punta avanza en línea recta sobre un eje. Pruebe los dos y compare.',
      preparar(app, cuerpo) {
        const q = [0, 0.4, 0.1, 0.9, 0, 0.9];
        app.escena.fijarPostura(q);
        const rastro = [app.cadena.efector(q)];
        const l = linea(app, rastro, 0xc2ef4e);
        const lec = lectura();
        const leer = () => { const ps = app.cadena.pose(q); lec.textContent = `punta x ${(ps.p.x * 1000).toFixed(0)}  y ${(ps.p.y * 1000).toFixed(0)}  z ${(ps.p.z * 1000).toFixed(0)} mm   cabeceo ${grados(ps.cab).toFixed(0)}°`; rastro.push(ps.p); l.fijar(rastro); };
        const art = (i, s) => { q[i] += s * 5 * GRADO; app.escena.fijarPostura(q); leer(); };
        const cart = (eje, s) => {
          const ps = app.cadena.pose(q);
          const p = ps.p.clone(); p[eje] += s * 0.01;
          const r = app.cadena.ikPose(p, ps.cab, q[4], q.slice(0, 5));
          if (r.alcanzado) { r.q.forEach((v, i) => { q[i] = v; }); app.escena.fijarPostura(q); leer(); }
        };
        cuerpo.append(el('div', { class: 'etq' }, 'Articular (5° por pulsación)'),
          botones(['Base −', () => art(0, -1)], ['Base +', () => art(0, 1)], ['Hombro −', () => art(1, -1)], ['Hombro +', () => art(1, 1)], ['Codo −', () => art(2, -1)], ['Codo +', () => art(2, 1)]),
          el('div', { class: 'etq' }, 'Cartesiano (10 mm por pulsación)'),
          botones(['X −', () => cart('x', -1)], ['X +', () => cart('x', 1)], ['Y −', () => cart('y', -1)], ['Y +', () => cart('y', 1)], ['Z −', () => cart('z', -1)], ['Z +', () => cart('z', 1)]), lec);
        leer();
      },
      detalle: `<p>El <b>jog</b> es la forma más básica de programar: se lleva el robot con los botones de la consola (<i>teach pendant</i>) hasta donde tiene que ir y se guarda la posición. Los modos habituales:</p>
<table><tr><th>Modo</th><th>Qué mueve cada botón</th><th>Cuándo sirve</th></tr>
<tr><td>Articular</td><td>una articulación</td><td>sacar al robot de una postura rara, acercarse a un límite</td></tr>
<tr><td>Cartesiano base</td><td>la punta sobre los ejes x, y, z de la base</td><td>acercarse a una mesa</td></tr>
<tr><td>Herramienta</td><td>la punta sobre los ejes de la herramienta</td><td>avanzar «hacia donde apunta» la pinza</td></tr>
<tr><td>Reorientación</td><td>la orientación, sin mover el TCP</td><td>cambiar el ángulo de ataque de la herramienta</td></tr></table>
<p>En el modo cartesiano, el controlador resuelve la cinemática inversa en cada pulsación. Con el SO-ARM100 (5 GDL) a veces no hay solución que mantenga el cabeceo: el botón no hace nada, igual que un robot industrial que avisa «fuera de alcance».</p>
<p>La pestaña Programar tiene una tarjeta <b>Mover a mano</b> con estos dos modos, pasos de 1 a 20 mm y la pinza. Lo que se ve en la escena es el robot virtual; con una sesión abierta, el brazo real se mueve al ejecutar el programa o con «Ir».</p>`,
    },
    {
      titulo: 'MoveJ, MoveL y MoveC',
      texto: 'Las tres instrucciones de movimiento, una tras otra, con su trazo: <b style="color:#a597ff">MoveJ</b> curva, <b style="color:#c2ef4e">MoveL</b> recta, <b style="color:#fd44b0">MoveC</b> arco por un punto intermedio.',
      ancho: true,
      preparar(app, cuerpo) {
        const plan = new Planificador(app.cadena);
        const P = (x, y, z) => ({ tipo: 'cart', p: [x, y, z], cab: -90, giro: 0 });
        const q0 = plan.articulacionesDe(P(-120, -180, 80), [0, 0, 0, 0, 0], 0);
        const m1 = { instr: 'MoveJ', destino: P(80, -160, 80), vel: 300, zona: 0, linea: 1 };
        const tr1 = plan.planificar([m1], q0);
        const tr2 = plan.planificar([{ instr: 'MoveL', destino: P(80, -230, 80), vel: 100, zona: 0, linea: 2 }], tr1.q[tr1.q.length - 1]);
        const tr3 = plan.planificar([{ instr: 'MoveC', via: P(-20, -255, 80), destino: P(-120, -230, 80), vel: 100, zona: 0, linea: 3 }], tr2.q[tr2.q.length - 1]);
        linea(app, tr1.p, 0xa597ff); linea(app, tr2.p, 0xc2ef4e); linea(app, tr3.p, 0xfd44b0);
        const codigo = el('pre', { class: 'lectura-leccion', style: 'margin:0' });
        const lineasCod = ['MoveJ p1, v300, fine;      ! curva, rápido', 'MoveL p2, v100, fine;      ! recta', 'MoveC pvia, p3, v100, fine; ! arco'];
        const trs = [tr1, tr2, tr3];
        const total = trs.reduce((s, t) => s + t.duracion, 0) + 1.5;
        cuerpo.append(codigo);
        return animar((t) => {
          let u = t % total, k = 0;
          while (k < 3 && u > trs[k].duracion + 0.5) { u -= trs[k].duracion + 0.5; k++; }
          k = Math.min(k, 2);
          app.escena.fijarPostura([...muestrear(trs[k], u).q, 0.5]);
          codigo.innerHTML = lineasCod.map((x, i) => (i === k ? `<span style="color:#c2ef4e">▶ ${x}</span>` : `  ${x}`)).join('\n');
        });
      },
      detalle: `<p>Las tres instrucciones básicas son iguales en todos los fabricantes; cambian los nombres:</p>
${LENGUAJES}
<p>Anatomía de una instrucción RAPID:</p>
<pre>MoveL  p2,  v100,  z10,  tool0;
 │     │     │      │     └ herramienta
 │     │     │      └ zona: redondea 10 mm (fine = se detiene)
 │     │     └ velocidad del TCP: 100 mm/s
 │     └ punto destino (robtarget)
 └ tipo de movimiento</pre>
<p><code>MoveC via, fin</code> necesita un punto intermedio: por tres puntos (el actual, el intermedio y el final) pasa un único arco de círculo. Un círculo completo se hace con dos <code>MoveC</code>.</p>
<p>En la aplicación, un <b>robtarget</b> tiene cinco números, <code>[x, y, z, cabeceo, giro]</code> (mm y grados), en lugar de posición + cuaternión, porque el brazo tiene cinco articulaciones: su orientación sólo admite cabeceo y giro (lección 3).</p>`,
    },
    {
      titulo: 'Tomar y colocar: aproximación y retirada',
      texto: 'El patrón más usado en la industria: ir <b>encima</b> de la pieza (MoveJ), <b>bajar en recta</b> (MoveL), cerrar la pinza, <b>subir en recta</b> y repetir en el destino. <code>Offs</code> calcula los puntos de arriba.',
      programa: 'tomar',
      preparar(app, cuerpo) {
        app.celda?.mostrar(true);
        app.escena.vista('programa');
        const toma = new THREE.Vector3(-0.11, -0.15, 0.01), deja = new THREE.Vector3(0.11, -0.2, 0.013);
        const up = new THREE.Vector3(0, 0, 0.06);
        for (const [p, n] of [[toma, 'toma'], [toma.clone().add(up), 'Offs(toma,0,0,60)'], [deja, 'deja'], [deja.clone().add(up), 'Offs(deja,0,0,60)']]) {
          esfera(app, p, 0.007, n.startsWith('Offs') ? 0xffb287 : 0xc2ef4e, 1);
          etiqueta(app, n, p.clone().add(new THREE.Vector3(0, 0, 0.018)));
        }
        linea(app, [toma, toma.clone().add(up), deja.clone().add(up), deja], 0x8f879a);
        cuerpo.append(el('pre', { class: 'lectura-leccion', style: 'margin:0', html: 'GripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v80, fine;\nGripperClose;\nMoveL Offs(toma, 0, 0, 60), v150, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v80, fine;\nGripperOpen;' }));
        app.escena.fijarPostura([0, 0, 0, 0, 0, 0.9]);
      },
      detalle: `<p>Por qué se programa así:</p>
<ul><li><b>Punto de aproximación</b> encima de la pieza: el movimiento rápido (MoveJ) termina en el aire, donde un camino curvo no golpea nada.</li>
<li><b>Bajada en MoveL</b> y con <code>fine</code>: la pinza entra recta, sin rozar la pieza de lado, y está quieta al cerrarse.</li>
<li><b>Zona z10</b> en los puntos de paso: el robot no se detiene arriba, lo que ahorra tiempo.</li>
<li><b>Offs</b>: los puntos de aproximación no se enseñan aparte; se calculan desde el de la pieza. Si la pieza se mueve, se enseña un solo punto.</li></ul>
<p>Con <code>WaitTime 0.3</code> después de cerrar la pinza se da tiempo a que los dedos sujeten antes de subir: la pinza real tarda unas décimas de segundo.</p>
<p>El botón de abajo abre este programa en la pestaña Programar: ejecútelo en el robot virtual, mire cómo el cubo termina en la bandeja, y modifíquelo.</p>`,
    },
    {
      titulo: 'Retos de programación',
      texto: 'Tres retos para la pestaña <b>Programar</b>, de menor a mayor. La tarjeta <b>Retos</b> de esa pestaña comprueba sola si la celda quedó como se pide.',
      programa: 'apilar',
      preparar(app, cuerpo) {
        app.celda?.mostrar(true);
        app.escena.vista('programa');
        cuerpo.append(el('div', { class: 'texto-largo', html: `<ol>
<li><b>Mover un cubo.</b> Lleve <code>cubo2</code> (el lima) a la bandeja.</li>
<li><b>Apilar.</b> Deje los tres cubos apilados en la bandeja, uno sobre otro.</li>
<li><b>Invertir la fila.</b> Deje los cubos en la fila, pero en orden inverso: el durazno donde estaba el fucsia y al revés. Pista: hace falta un lugar intermedio.</li></ol>` }));
        app.escena.fijarPostura([0, 0, 0, 0, 0, 0.9]);
      },
      detalle: `<p>Sugerencias para resolverlos:</p>
<ul><li>Empiece desde un ejemplo (<b>Ejemplos</b> → «Tomar y colocar») y cambie sólo lo necesario.</li>
<li>Use <b>Verificar</b> antes de ejecutar: detecta puntos fuera de alcance y dice el tiempo de ciclo.</li>
<li>Para apilar, cada cubo se deja 25 mm más alto: <code>Offs(pila, 0, 0, 25 * i)</code> dentro de un <code>FOR</code>.</li>
<li>Con la pinza hacia abajo el brazo sube hasta unos 100 mm: acérquese a la pila desde 35 mm, no desde 60.</li>
<li>Para invertir la fila hay que usar la bandeja (o un punto libre de la mesa) como lugar intermedio, como en el problema de las torres de Hanói.</li></ul>
<p>Cuando funcione en el robot virtual, puede ejecutarse en el brazo real: abra una sesión, cierre la teleoperación, elija <b>Brazo o Gazebo</b> y baje la velocidad al 30 % la primera vez.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'En <code>MoveL Offs(toma, 0, 0, 60), v150, z10;</code>, ¿qué hace <code>z10</code>?',
        opciones: ['Sube 10 mm', 'Deja redondear el paso por ese punto empezando 10 mm antes, sin detenerse', 'Limita la velocidad a 10 mm/s', 'Espera 10 ms'],
        correcta: 1,
        explicacion: 'Es la zona: el robot no llega exactamente al punto, empieza a ir hacia el siguiente cuando está a 10 mm. La altura la da Offs (60 mm) y la velocidad, v150.',
      },
      preparar(app) { app.celda?.mostrar(true); app.escena.fijarPostura([0, 0, 0, 0, 0, 0.9]); },
    },
  ],
};
