// Lección 17: seguridad y normas. Categorías de parada, aplicaciones
// colaborativas (supervisión de velocidad y separación), ISO 9283 con los
// ensayos reales y una evaluación de riesgos del SO-ARM100.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, grafica, lectura, botones, deslizador, figura, grados } from './comun.js';

export default {
  titulo: 'Seguridad y normas',
  resumen: 'Qué dicen las normas de robótica, cómo se detiene un robot de forma segura, cómo trabajan los robots junto a personas y cómo se miden exactitud y repetibilidad.',
  conceptos: [
    ['ISO 10218-1 y -2', 'Requisitos de seguridad del robot industrial (parte 1) y de la aplicación o celda completa (parte 2). Revisadas en 2025.'],
    ['Aplicación colaborativa', 'Tarea en la que persona y robot comparten el espacio de trabajo. Desde 2025, la norma habla de aplicaciones colaborativas, no de «robots colaborativos».'],
    ['Categorías de parada', 'IEC 60204-1: 0 corta la energía de inmediato; 1 frena y luego corta; 2 frena y mantiene la energía.'],
    ['SSM y PFL', 'Supervisión de velocidad y separación; limitación de potencia y fuerza. Los dos modos colaborativos más usados.'],
    ['ISO 9283', 'Norma que define cómo medir exactitud y repetibilidad de posición de un robot: $RP = \\bar{l} + 3S_l$.'],
  ],
  referencias: [
    'ISO 10218-1:2025 y ISO 10218-2:2025, <i>Robotics — Safety requirements</i> (incorporan contenido de ISO/TS 15066:2016).',
    'IEC 60204-1, <i>Safety of machinery — Electrical equipment of machines</i> (categorías de parada 0, 1 y 2).',
    'ISO 9283:1998, <i>Manipulating industrial robots — Performance criteria and related test methods</i>.',
    'Association for Advancing Automation (A3), «Updated ISO 10218: FAQ» (2025).',
  ],
  pasos: [
    {
      titulo: 'Tres maneras de detenerse',
      texto: 'Las normas de máquinas definen tres <b>categorías de parada</b>. Pulse cada una y mire la velocidad y qué pasa con el brazo. Un brazo sin frenos, como éste, <b>cae</b> si se le quita la energía en cualquier postura.',
      ancho: true,
      preparar(app, cuerpo) {
        const g = grafica({ ancho: 600, alto: 160, x: [0, 2], y: [0, 1.1], xEtq: 'tiempo desde la orden de parada (s)', yEtq: 'velocidad / energía' });
        const lec = lectura();
        const q = [0, 0.1, -0.2, 0.4, 0, 0.5];
        let cat = null, t0 = 0;
        const curvas = (c) => {
          const v = [], e = [];
          for (let t = 0; t <= 2; t += 0.02) {
            const frena = Math.max(0, 1 - t / 0.5);
            v.push([t, c === 0 ? Math.max(0, 1 - t / 1.1) : frena]);
            e.push([t, c === 0 ? 0 : c === 1 ? (t < 0.55 ? 1 : 0) : 1]);
          }
          return [{ color: '#c2ef4e', puntos: v, nombre: 'velocidad' }, { color: '#fd44b0', puntos: e, punteada: true, nombre: 'energía' }];
        };
        const textos = {
          0: 'Categoría 0: se corta la energía en el acto. El robot se detiene sin control (por fricción o frenos). Sin frenos, el brazo cae por su peso.',
          1: 'Categoría 1: el controlador frena el movimiento y, ya detenido, se corta la energía. Parada controlada; luego, sin par.',
          2: 'Categoría 2: el controlador frena y mantiene la energía: el robot queda sostenido en su postura.',
        };
        cuerpo.append(g, botones(['Categoría 0', () => { cat = 0; t0 = performance.now(); }], ['Categoría 1', () => { cat = 1; t0 = performance.now(); }], ['Categoría 2', () => { cat = 2; t0 = performance.now(); }], ['Reiniciar', () => { cat = null; }]), lec);
        return animar((t) => {
          if (cat === null) {
            q[0] = 0.6 * Math.sin(t * 1.5); q[1] = 0.1; q[2] = -0.2;
            app.escena.fijarPostura(q);
            g.dibujar([]); lec.textContent = 'El brazo se mueve. Elija una categoría de parada.';
            return;
          }
          const s = (performance.now() - t0) / 1000;
          g.dibujar(curvas(cat));
          lec.textContent = textos[cat];
          const sinPar = cat === 0 || (cat === 1 && s > 0.55);
          if (sinPar) { q[1] = Math.min(1.5, q[1] + 0.04); q[2] = Math.max(-1.4, q[2] - 0.03); }
          app.escena.fijarPostura(q);
        });
      },
      detalle: `<p>La norma IEC 60204-1 (equipo eléctrico de máquinas) define tres <b>categorías de parada</b>:</p>
<table><tr><th>Categoría</th><th>Qué pasa</th><th>Uso típico</th></tr>
<tr><td>0</td><td>Se corta de inmediato la energía de los motores: parada no controlada</td><td>Emergencia cuando no se puede confiar en el control</td></tr>
<tr><td>1</td><td>Se frena de forma controlada y, al detenerse, se corta la energía</td><td>Parada de emergencia habitual en robots industriales</td></tr>
<tr><td>2</td><td>Se frena de forma controlada y la energía se mantiene</td><td>Paradas de proceso, pausas, parada supervisada</td></tr></table>
<p>Los robots industriales tienen <b>frenos</b> en los motores que se aplican al cortar la energía: en categoría 0 o 1 el brazo queda sostenido por los frenos. El SO-ARM100 <b>no tiene frenos</b>: sus servos sólo sostienen mientras tienen par. Por eso en la aplicación:</p>
<ul><li><b>Parada inmediata</b> (Ctrl+C) se parece a una categoría 0: corta el software y el brazo puede caer si no está en <code>home</code>. La aplicación lo advierte antes.</li>
<li><b>Home y apagar</b> se parece a una categoría 1: primero lleva el brazo a una postura de reposo y después quita el par.</li>
<li><b>Cerrar la teleoperación</b> (Q) deja el brazo sostenido en <code>init</code>: una categoría 2.</li></ul>
<p>La parada de emergencia física de este montaje es el interruptor de la fuente de 12 V: siempre debe estar al alcance.</p>`,
    },
    {
      titulo: 'Trabajar junto a personas: velocidad y separación',
      texto: 'Mueva a la <b>persona</b> (cilindro) hacia el robot. Con <b>supervisión de velocidad y separación</b> el robot trabaja rápido lejos, frena en la zona durazno y se detiene en la fucsia.',
      preparar(app, cuerpo) {
        const persona = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0xffb287, transparent: true, opacity: 0.85 }));
        persona.rotation.x = Math.PI / 2;
        app.escena.extras.add(persona);
        const zona = (r, color) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r, 96), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); m.position.set(0, -0.0452, 0.002); app.escena.extras.add(m); };
        zona(0.45, 0xfd44b0); zona(0.65, 0xffb287);
        let dist = 0.9;
        const lec = lectura();
        const q = [0, 0.2, -0.3, 0.6, 0, 0.5];
        let fase = 0, tPrev = 0;
        cuerpo.append(deslizador('Distancia de la persona', { min: 0.25, max: 1.0, paso: 0.01, valor: dist, formato: (x) => `${(x * 1000).toFixed(0)} mm`, alCambiar: (x) => { dist = x; } }), lec);
        return animar((t) => {
          const dt = t - tPrev; tPrev = t;
          persona.position.set(dist * 0.7, -0.0452 - dist * 0.7, 0.15);
          const d = Math.hypot(persona.position.x, persona.position.y + 0.0452);
          const escala = d < 0.45 ? 0 : d < 0.65 ? (d - 0.45) / 0.2 * 0.5 : 1;
          fase += dt * 2.2 * escala;
          q[0] = 0.8 * Math.sin(fase); q[1] = 0.2 + 0.15 * Math.sin(fase * 1.7);
          app.escena.fijarPostura(q);
          lec.textContent = `persona a ${(d * 1000).toFixed(0)} mm del eje   →   velocidad del robot ${(escala * 100).toFixed(0)} %${escala === 0 ? '   (parada supervisada)' : ''}`;
        });
      },
      detalle: `<p>Las normas ISO 10218-1 y 10218-2 se revisaron en <b>2025</b> e incorporaron el contenido de la especificación técnica ISO/TS 15066 (2016) sobre colaboración. Un cambio de lenguaje importante: ya no se habla de «robot colaborativo», sino de <b>aplicación colaborativa</b>, porque la seguridad depende de toda la tarea (la herramienta, la pieza, la velocidad, la postura de la persona), no sólo del robot.</p>
<p>Las formas de colaboración que se han usado desde las normas de 2011 y la ISO/TS 15066:</p>
<ul><li><b>Parada supervisada de seguridad</b>: el robot se detiene (sin cortar la energía) mientras la persona está en el espacio compartido.</li>
<li><b>Guiado manual</b>: la persona mueve el robot con la mano, con un dispositivo de habilitación.</li>
<li><b>Supervisión de velocidad y separación</b> (SSM): sensores (escáneres láser, cámaras) miden la distancia a la persona, y el robot reduce la velocidad o se detiene para que siempre pueda frenar antes del contacto. Es lo que simula este paso.</li>
<li><b>Limitación de potencia y fuerza</b> (PFL): el contacto puede ocurrir, pero el robot limita fuerzas y presiones por debajo de valores que dependen de la región del cuerpo. Requiere medir fuerzas o par en las articulaciones (lección 12).</li></ul>
<p>La distancia de separación mínima no es arbitraria: se calcula con la velocidad de la persona, el tiempo de reacción del sistema, la distancia de frenado del robot y la incertidumbre de los sensores.</p>`,
    },
    {
      titulo: 'Exactitud y repetibilidad (ISO 9283)',
      texto: 'Dos robots: uno <b>exacto pero poco repetible</b> y otro <b>repetible pero inexacto</b>. La norma ISO 9283 define cómo medir ambas cosas. El SO-ARM100 midió <b>RP = 2,3 mm</b> en el ensayo A2.',
      ancho: true,
      preparar(app, cuerpo) {
        const svg = el('div', { class: 'figura-leccion' });
        let s = 3;
        const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
        const nube = (cx, cy, dx, dy, r, col) => Array.from({ length: 30 }, () => `<circle cx="${cx + dx + azar() * r}" cy="${cy + dy + azar() * r}" r="3" fill="${col}"/>`).join('');
        svg.innerHTML = `<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
          ${[110, 300, 490].map((cx) => `<circle cx="${cx}" cy="100" r="70" fill="none" stroke="#362d59"/><circle cx="${cx}" cy="100" r="40" fill="none" stroke="#362d59"/><line x1="${cx - 8}" y1="100" x2="${cx + 8}" y2="100" stroke="#fff"/><line x1="${cx}" y1="92" x2="${cx}" y2="108" stroke="#fff"/>`).join('')}
          ${nube(110, 100, 0, 0, 70, '#ffb287')}${nube(300, 100, 38, -30, 14, '#c2ef4e')}${nube(490, 100, 0, 0, 14, '#a597ff')}
          <text x="110" y="200" fill="#ffb287" text-anchor="middle">exacto, poco repetible</text>
          <text x="300" y="200" fill="#c2ef4e" text-anchor="middle">repetible, inexacto</text>
          <text x="490" y="200" fill="#a597ff" text-anchor="middle">exacto y repetible</text></svg>`;
        cuerpo.append(svg, lectura('Ensayo A2 (25/09/2026): 30 llegadas a la misma postura. Distancia media al centro 0,54 mm,\ndesviación 0,59 mm  →  RP = l̄ + 3·S = 2,30 mm (según los codificadores de los servos).'));
        app.escena.fijarPostura([0, 0.3, -0.3, 0.6, 0, 0.5]);
      },
      detalle: `<p>ISO 9283 define dos magnitudes distintas, que se confunden a menudo:</p>
<ul><li><b>Exactitud de posición</b> (AP): la distancia entre la posición que se pidió y el <b>promedio</b> de las posiciones alcanzadas. Mide errores sistemáticos (ceros, longitudes). Se corrige calibrando (lección 16).</li>
<li><b>Repetibilidad de posición</b> (RP): cuánto se dispersan las llegadas alrededor de su propio promedio. Mide holguras, rigidez y control. No se corrige calibrando.</li></ul>
<p>La repetibilidad se calcula con $n$ llegadas (la norma pide 30) a la misma pose, con posiciones medidas $P_j$ y su centro $\\bar{P}$:</p>
$$l_j = \\|P_j - \\bar{P}\\|, \\qquad \\bar{l} = \\frac{1}{n}\\sum l_j, \\qquad S_l = \\sqrt{\\frac{\\sum (l_j - \\bar{l})^2}{n-1}}, \\qquad RP = \\bar{l} + 3 S_l$$
<p>El ensayo A2 de este proyecto aplicó exactamente esa fórmula: 30 llegadas, $\\bar{l} = 0{,}54$ mm, $S_l = 0{,}59$ mm y <b>RP = 2,30 mm</b>. Dos matices honestos: las posiciones salen de la cinemática directa aplicada a los <b>codificadores del propio servo</b> (no de un instrumento externo), y la nube real en el papel puede ser mayor por holguras que el codificador no ve. Para comparar: un robot industrial de 6 ejes pequeño declara repetibilidades de centésimas de milímetro.</p>`,
    },
    {
      titulo: 'Evaluación de riesgos del SO-ARM100',
      texto: 'Toda celda robótica empieza con una evaluación de riesgos: qué puede salir mal, qué tan grave sería y qué medida lo reduce. Esta es la de este montaje.',
      preparar(app, cuerpo) {
        cuerpo.append(el('div', { class: 'texto-largo', html: `<table><tr><th>Peligro</th><th>Medida en el proyecto</th></tr>
<tr><td>Caída del brazo al perder el par</td><td>Posturas seguras: <code>init</code> al cerrar, <code>home</code> antes de apagar; aviso antes de la parada inmediata</td></tr>
<tr><td>Movimiento inesperado al arrancar</td><td>v14: sincroniza con la postura real antes de mover; límites de velocidad</td></tr>
<tr><td>Atrapamiento de dedos en la pinza</td><td>Par de la pinza limitado; no acercar la mano con la teleoperación activa</td></tr>
<tr><td>Movimiento fuera de límites</td><td>Límites más estrechos que los del URDF, recortados dos veces (aplicación y servidor)</td></tr>
<tr><td>Orden desde otra página web</td><td>El servidor sólo escucha en 127.0.0.1 y rechaza órdenes de otro origen</td></tr>
<tr><td>Sobrecalentamiento</td><td>Ensayo A4 y límite de temperatura; el hombro llegó a 54 °C</td></tr>
<tr><td>Parada de emergencia</td><td>Interruptor de la fuente de 12 V al alcance</td></tr></table>` }));
        app.escena.fijarPostura([0, -1.4, 1.4, 1.0, 1.5708, 0.5]);
      },
      detalle: `<p>La <b>evaluación de riesgos</b> (ISO 12100) sigue siempre los mismos pasos: identificar peligros, estimar su riesgo (gravedad y probabilidad), y reducirlo con este orden de preferencia:</p>
<ol><li><b>Diseño inherentemente seguro</b>: eliminar el peligro (por ejemplo, un robot pequeño y lento).</li>
<li><b>Protecciones técnicas</b>: resguardos, sensores, funciones de seguridad (límites, velocidad supervisada).</li>
<li><b>Información para el uso</b>: avisos, manuales, formación.</li></ol>
<p>El SO-ARM100 es un robot de baja energía: pesa poco, sus servos tienen par limitado y se mueve despacio. Eso reduce mucho la gravedad de un golpe, pero no la elimina (una pinza puede pellizcar, un brazo que cae puede golpear). Además, <b>no tiene funciones de seguridad certificadas</b>: ningún componente cumple un nivel de prestaciones (PL) de ISO 13849. Es adecuado para enseñanza e investigación con supervisión, no para una aplicación colaborativa industrial.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Un robot vuelve 30 veces a un punto y todas las llegadas caen en un círculo de 0,1 mm, pero ese círculo está a 3 mm del punto pedido. ¿Cómo es?',
        opciones: ['Exacto y repetible', 'Repetible pero inexacto', 'Exacto pero poco repetible', 'Ni exacto ni repetible'],
        correcta: 1,
        explicacion: 'Las llegadas están juntas (buena repetibilidad), pero su promedio está lejos del objetivo (mala exactitud). Se arregla calibrando.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, -0.3, 0.6, 0, 0.5]); },
    },
  ],
};
