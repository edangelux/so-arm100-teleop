// Lección 18: integración de celda. Señales y apretón de manos entre el robot
// y el PLC, ciclo de barrido y escalera, redes industriales, tiempo de ciclo y
// OEE, y gemelo digital con las tres versiones del brazo del proyecto.
import * as THREE from 'three';
import { el } from '../ui.js';
import { animar, grafica, lectura, botones, deslizador, figura, barras } from './comun.js';

// Posturas sobre la entrada y sobre la bandeja de la celda virtual, con la pinza hacia abajo.
function posturasCelda(app) {
  const q0 = [0, 0.2, 0.4, 0.6, 0];
  const sobre = (x, y) => {
    const r = app.cadena.ikPose(new THREE.Vector3(x, y, 0.07), -Math.PI / 2, 0, q0);
    return [...r.q.slice(0, 5), 1.2];
  };
  return { entrada: sobre(-0.11, -0.15), bandeja: sobre(0.11, -0.2), reposo: [0, -0.4, 0.9, 0.9, 0, 0.3] };
}

const mezcla = (a, b, s) => a.map((v, i) => v + (b[i] - v) * s);
const suave = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));

// Recorrido de un ciclo de tomar y colocar en función de la fase (0 a 1).
function cicloTomar(P, s) {
  const tramos = [[P.reposo, P.entrada], [P.entrada, P.entrada], [P.entrada, P.bandeja], [P.bandeja, P.bandeja], [P.bandeja, P.reposo]];
  const k = Math.min(4, Math.floor(s * 5));
  const q = mezcla(tramos[k][0], tramos[k][1], suave(s * 5 - k));
  if (k === 1) q[5] = 1.2 - 1.0 * suave(s * 5 - 1);
  else if (k === 2) q[5] = 0.2;
  else if (k === 3) q[5] = 0.2 + 1.0 * suave(s * 5 - 3);
  return q;
}

export default {
  titulo: 'Integración de celda y gemelo digital',
  resumen: 'Un robot nunca trabaja solo: conversa con sensores, un PLC y otros equipos. Esta lección muestra cómo se coordinan, cómo se mide la productividad de una celda y qué es un gemelo digital.',
  conceptos: [
    ['Celda robótica', 'Conjunto del robot, su herramienta, las piezas, los sensores, las protecciones y el controlador que coordina todo.'],
    ['Apretón de manos', 'Intercambio de señales en el que cada equipo avisa lo que hizo y espera la confirmación del otro antes de seguir.'],
    ['PLC', 'Controlador lógico programable: una computadora industrial que lee entradas, ejecuta su programa y escribe salidas en un ciclo repetido de pocos milisegundos.'],
    ['OPC UA', 'Estándar abierto (IEC 62541) para intercambiar datos con su significado (nombre, tipo, unidades) entre máquinas y sistemas de planta.'],
    ['OEE', 'Eficiencia global del equipo: disponibilidad × rendimiento × calidad.'],
    ['Gemelo digital', 'Modelo virtual de un equipo real que se mantiene sincronizado con él y sirve para probar, supervisar y predecir.'],
  ],
  referencias: [
    'IEC 61131-3, <i>Programmable controllers — Part 3: Programming languages</i> (escalera, texto estructurado y otros).',
    'IEC 62541, <i>OPC Unified Architecture</i>.',
    'Nakajima, S. (1988). <i>Introduction to TPM: Total Productive Maintenance</i>. Productivity Press (origen del OEE).',
    'Modbus Organization, <i>Modbus Application Protocol Specification V1.1b3</i>.',
  ],
  pasos: [
    {
      titulo: 'Señales: el robot y el PLC se dan la mano',
      texto: 'Un sensor detecta una pieza en la entrada. El PLC avisa al robot con <b>pieza lista</b>; el robot responde <b>ocupado</b>, la toma, la deja y avisa <b>listo</b>. Pulse <b>Poner pieza</b> y mire el diagrama de tiempos y la torre de luces de la celda.',
      ancho: true,
      programa: 'senales',
      preparar(app, cuerpo) {
        const celda = app.celda;
        celda?.mostrar(true);
        app.escena.vista('programa');
        const P = posturasCelda(app);
        const g = grafica({ ancho: 600, alto: 190, x: [0, 12], y: [0, 4.4], xEtq: 'tiempo (s)', yEtq: 'cada señal: abajo 0, arriba 1' });
        const lec = lectura();
        const nombres = ['sensor (di1)', 'pieza lista', 'ocupado (do2)', 'listo (do1)'];
        const colores = ['#a597ff', '#ffb287', '#fd44b0', '#c2ef4e'];
        const historia = [];
        let estado = 'espera', tEstado = 0, hayPieza = false, t = 0;
        const s = { sensor: 0, lista: 0, ocupado: 0, listo: 0 };
        const luces = () => { celda?.fijarSenal('do1', s.listo); celda?.fijarSenal('do2', s.ocupado); celda?.fijarSenal('do3', estado === 'espera' && !hayPieza ? 1 : 0); };
        const textos = {
          espera: 'Robot en reposo, esperando «pieza lista». Luz fucsia (do3): celda libre.',
          aviso: 'El sensor ve la pieza. El PLC confirma durante un instante (filtro) y activa «pieza lista».',
          trabajo: 'El robot responde «ocupado» (luz durazno) y ejecuta el ciclo de tomar y colocar.',
          fin: 'Pieza en la bandeja: el robot baja «ocupado» y activa «listo» (luz lima). El PLC retira «pieza lista».',
        };
        const leyenda = el('div', { class: 'fila', style: 'flex-wrap:wrap;gap:14px;font-size:13px;margin:4px 0 2px' },
          ...nombres.map((n, k) => el('span', {}, el('i', { style: `display:inline-block;width:14px;height:3px;background:${colores[k]};vertical-align:middle;margin-right:6px` }), n)));
        cuerpo.append(g, leyenda, botones(['Poner pieza', () => { if (!hayPieza && estado === 'espera') { hayPieza = true; } }], ['Borrar gráfica', () => { historia.length = 0; t = 0; }]), lec);
        let tPrev = 0;
        const fin = animar((tt) => {
          const dt = Math.min(0.05, tt - tPrev); tPrev = tt; t += dt; tEstado += dt;
          const cambiar = (e) => { estado = e; tEstado = 0; };
          s.sensor = hayPieza ? 1 : 0;
          if (estado === 'espera' && hayPieza && tEstado > 0.1) cambiar('aviso');
          else if (estado === 'aviso' && tEstado > 0.4) { s.lista = 1; s.listo = 0; cambiar('trabajo'); }
          else if (estado === 'trabajo') {
            s.ocupado = 1;
            const fase = tEstado / 5;
            if (fase > 0.3) hayPieza = false;
            app.escena.fijarPostura(cicloTomar(P, Math.min(1, fase)));
            if (fase >= 1) { s.ocupado = 0; s.listo = 1; cambiar('fin'); }
          } else if (estado === 'fin' && tEstado > 0.3) { s.lista = 0; }
          if (estado === 'fin' && tEstado > 1.5) cambiar('espera');
          if (estado !== 'trabajo') app.escena.fijarPostura(P.reposo);
          luces();
          if (t > 12) { historia.length = 0; t = 0; }
          historia.push([t, s.sensor, s.lista, s.ocupado, s.listo]);
          g.dibujar(nombres.map((n, k) => ({
            color: colores[k],
            puntos: historia.length ? historia.map((h) => [h[0], 3.3 - k * 1.05 + 0.7 * h[k + 1]]) : [[0, 3.3 - k * 1.05]],
          })));
          lec.textContent = textos[estado];
        });
        return () => { fin(); ['do1', 'do2', 'do3'].forEach((n) => celda?.fijarSenal(n, 0)); };
      },
      detalle: `<p>La mayoría de las celdas robóticas se coordinan con <b>señales digitales</b>: cables que están a 0 V o a 24 V. El robot tiene entradas (DI) y salidas (DO); el PLC, también. El truco para que no haya carreras ni piezas perdidas es el <b>apretón de manos</b> (<i>handshake</i>): nadie da por hecho que el otro recibió una orden hasta que el otro lo confirma.</p>
<ol><li>El PLC ve la pieza y activa <b>pieza lista</b>.</li>
<li>El robot la lee (<code>WaitDI</code>), activa <b>ocupado</b> (<code>SetDO</code>) y empieza.</li>
<li>Al terminar, baja <b>ocupado</b> y activa <b>listo</b>.</li>
<li>El PLC ve <b>listo</b>, retira <b>pieza lista</b> y puede traer la siguiente pieza.</li></ol>
<p>Cada flanco tiene una espera con <b>tiempo límite</b>: si el robot activa <b>ocupado</b> y nunca llega <b>listo</b>, el PLC da una alarma en lugar de quedarse colgado. En el lenguaje de la pestaña Programar, <code>WaitDI di1, 1;</code> espera la entrada y <code>SetDO do2, 1;</code> escribe la salida. El ejemplo 7 («Señales: esperar al sensor») hace esto con la celda virtual: se puede abrir con el botón de abajo y activar <code>di1</code> a mano.</p>`,
    },
    {
      titulo: 'El PLC: ciclo de barrido y lógica de escalera',
      texto: 'Un PLC repite siempre lo mismo: <b>lee</b> todas las entradas, <b>ejecuta</b> el programa y <b>escribe</b> las salidas. Pulse <b>Marcha</b>, ponga una pieza y observe qué contactos conducen (lima). Luego pulse <b>Paro</b>.',
      ancho: true,
      preparar(app, cuerpo) {
        const P = posturasCelda(app);
        const e = { marcha: 0, paro: 0, sensor: 0, ocupado: 0 };
        const m = { M: 0, orden: 0, verde: 0, ambar: 0 };
        let barridos = 0, tRobot = -1, tMarcha = -1, tParo = -1;
        const fig = el('div', { class: 'figura-leccion' });
        const lec = lectura();
        const C = (on) => (on ? '#c2ef4e' : '#6e6590');
        // Contacto normalmente abierto (NA) o cerrado (NC) en x, y; conduce si 'pasa'.
        const contacto = (x, y, etq, nc, pasa) => `<g stroke="${C(pasa)}" stroke-width="2.5" fill="none">
          <line x1="${x - 24}" y1="${y}" x2="${x - 7}" y2="${y}"/><line x1="${x + 7}" y1="${y}" x2="${x + 24}" y2="${y}"/>
          <line x1="${x - 7}" y1="${y - 12}" x2="${x - 7}" y2="${y + 12}"/><line x1="${x + 7}" y1="${y - 12}" x2="${x + 7}" y2="${y + 12}"/>
          ${nc ? `<line x1="${x - 9}" y1="${y + 12}" x2="${x + 9}" y2="${y - 12}"/>` : ''}</g>
          <text x="${x}" y="${y - 18}" text-anchor="middle" fill="#e5dcff">${etq}</text>`;
        const bobina = (x, y, etq, on) => `<g stroke="${C(on)}" stroke-width="2.5" fill="${on ? 'rgba(194,239,78,.18)' : 'none'}">
          <path d="M${x - 6},${y - 12} Q${x - 16},${y} ${x - 6},${y + 12}"/><path d="M${x + 6},${y - 12} Q${x + 16},${y} ${x + 6},${y + 12}"/></g>
          <text x="${x}" y="${y - 18}" text-anchor="middle" fill="#e5dcff">${etq}</text>`;
        const cable = (x1, y1, x2, y2, on) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C(on)}" stroke-width="2.5"/>`;
        const dibujar = () => {
          const a1 = e.marcha || m.M, b1 = a1 && !e.paro;
          const a2 = m.M, b2 = a2 && e.sensor, c2 = b2 && !e.ocupado;
          fig.innerHTML = `<svg viewBox="0 0 600 250" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
            <line x1="30" y1="20" x2="30" y2="235" stroke="#c2ef4e" stroke-width="3"/><line x1="570" y1="20" x2="570" y2="235" stroke="#6e6590" stroke-width="3"/>
            ${cable(30, 60, 76, 60, 1)}${contacto(100, 60, 'Marcha I0.0', false, e.marcha)}${cable(124, 60, 176, 60, a1)}
            ${cable(50, 60, 50, 100, 1)}${cable(50, 100, 76, 100, 1)}${contacto(100, 100, 'M', false, m.M)}${cable(124, 100, 150, 100, m.M)}${cable(150, 100, 150, 60, m.M)}
            ${contacto(200, 60, 'Paro I0.1', true, b1)}${cable(224, 60, 494, 60, b1)}${bobina(510, 60, 'M (en marcha)', m.M)}${cable(526, 60, 570, 60, b1)}
            ${cable(30, 155, 76, 155, 1)}${contacto(100, 155, 'M', false, a2)}${cable(124, 155, 176, 155, a2)}${contacto(200, 155, 'Sensor I0.2', false, b2)}${cable(224, 155, 276, 155, b2)}
            ${contacto(300, 155, 'Robot ocupado I0.3', true, c2)}${cable(324, 155, 494, 155, c2)}${bobina(510, 155, 'Orden Q0.1', m.orden)}${cable(526, 155, 570, 155, c2)}
            ${cable(30, 215, 76, 215, 1)}${contacto(100, 215, 'M', false, m.M)}${cable(124, 215, 494, 215, m.M)}${bobina(510, 215, 'Luz verde Q0.0', m.verde)}${cable(526, 215, 570, 215, m.M)}
            <text x="36" y="248" fill="#9e86ff" font-size="11">peldaño 1: marcha con enclavamiento · peldaño 2: orden al robot · peldaño 3: piloto</text></svg>`;
        };
        cuerpo.append(fig,
          botones(['Marcha', () => { tMarcha = 0.3; }], ['Paro', () => { tParo = 0.3; }], ['Poner pieza', () => { e.sensor = 1; }]),
          lec);
        let tPrev = 0;
        const fin = animar((t) => {
          const dt = Math.min(0.05, t - tPrev); tPrev = t;
          // Pulsadores: se mantienen pulsados 0,3 s.
          e.marcha = tMarcha > 0 ? 1 : 0; tMarcha -= dt;
          e.paro = tParo > 0 ? 1 : 0; tParo -= dt;
          // 1) leer entradas (ya están en e); 2) ejecutar el programa; 3) escribir salidas.
          m.M = (e.marcha || m.M) && !e.paro ? 1 : 0;
          m.orden = m.M && e.sensor && !e.ocupado ? 1 : 0;
          m.verde = m.M;
          barridos++;
          // El robot: si recibe la orden, trabaja 4 s y avisa «ocupado».
          if (m.orden && tRobot < 0) { tRobot = 0; e.ocupado = 1; }
          if (tRobot >= 0) {
            tRobot += dt;
            if (tRobot > 1.5) e.sensor = 0;
            app.escena.fijarPostura(cicloTomar(P, Math.min(1, tRobot / 4)));
            if (tRobot >= 4) { tRobot = -1; e.ocupado = 0; }
          } else app.escena.fijarPostura(P.reposo);
          dibujar();
          lec.textContent = `barrido n.º ${barridos}   ·   entradas: marcha ${e.marcha} paro ${e.paro} sensor ${e.sensor} ocupado ${e.ocupado}   →   salidas: M ${m.M} orden ${m.orden} verde ${m.verde}`;
        });
        return fin;
      },
      detalle: `<p>Un PLC no ejecuta instrucciones «cuando llega un evento» como un programa de escritorio. Repite un <b>ciclo de barrido</b> de unos pocos milisegundos:</p>
<ol><li><b>Leer</b> todas las entradas y guardarlas en una imagen de memoria.</li>
<li><b>Ejecutar</b> el programa completo de arriba abajo, usando esa imagen.</li>
<li><b>Escribir</b> todas las salidas a la vez.</li>
<li>Diagnóstico y comunicaciones; vuelta a empezar.</li></ol>
<p>El lenguaje de <b>escalera</b> (IEC 61131-3, <i>Ladder Diagram</i>) nació para imitar los tableros de relés: dos rieles de tensión y peldaños con contactos y bobinas. Un contacto <b>normalmente abierto</b> (| |) conduce cuando su señal vale 1; uno <b>normalmente cerrado</b> (|/|) conduce cuando vale 0. La bobina se activa si hay un camino que conduce.</p>
<p>El peldaño 1 es el circuito más clásico de la automatización, el <b>enclavamiento</b> (marcha y paro): el contacto M, en paralelo con Marcha, mantiene la bobina encendida aunque el pulsador se suelte, y el contacto cerrado de Paro la corta. El peldaño 2 es el lado del PLC del apretón de manos del paso anterior: sólo da la orden si hay pieza y el robot <b>no</b> está ocupado.</p>
<p>La norma define otros cuatro lenguajes: texto estructurado (ST, parecido a Pascal), diagrama de bloques de funciones (FBD), diagrama funcional secuencial (SFC) y lista de instrucciones (IL, ya obsoleta).</p>`,
    },
    {
      titulo: 'Redes industriales: del cable al dato con nombre',
      texto: 'Un bit por cable sirve para pocas señales. Para cientos de datos (posiciones, temperaturas, contadores) se usan <b>redes industriales</b>. Mire cómo se ordenan por niveles.',
      ancho: true,
      preparar(app, cuerpo) {
        const caja = (x, y, w, t1, t2, col) => `<rect x="${x}" y="${y}" width="${w}" height="44" rx="8" fill="#150f23" stroke="${col}" stroke-width="1.5"/>
          <text x="${x + w / 2}" y="${y + 19}" text-anchor="middle" fill="#fff" font-weight="600">${t1}</text><text x="${x + w / 2}" y="${y + 35}" text-anchor="middle" fill="#9e86ff" font-size="11">${t2}</text>`;
        const enlace = (x1, y1, x2, y2, t, arriba = false) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6a5fc1" stroke-width="2" stroke-dasharray="5 4"/>${arriba ? t.split('·').map((x, k) => `<text x="${(x1 + x2) / 2}" y="${y1 - 6 + k * 20}" text-anchor="middle" fill="#ffb287" font-size="11">${x.trim()}</text>`).join('') : `<text x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 + 4}" fill="#ffb287" font-size="11">${t}</text>`}`;
        cuerpo.append(figura(`<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
          <text x="10" y="30" fill="#6e6590" font-size="11">GESTIÓN</text><text x="10" y="122" fill="#6e6590" font-size="11">CONTROL</text><text x="10" y="222" fill="#6e6590" font-size="11">CAMPO</text>
          ${caja(200, 10, 200, 'MES / SCADA', 'órdenes, históricos, OEE', '#a597ff')}
          ${caja(90, 100, 170, 'PLC de la celda', 'lógica, seguridad', '#ffb287')}
          ${caja(340, 100, 170, 'Controlador del robot', 'trayectorias, E/S', '#fd44b0')}
          ${caja(60, 200, 112, 'Sensores', 'presencia, barreras', '#c2ef4e')}
          ${caja(190, 200, 120, 'Variadores', 'cinta, motores', '#c2ef4e')}
          ${caja(380, 200, 150, 'Servos del brazo', 'bus serie TTL', '#c2ef4e')}
          ${enlace(250, 54, 185, 100, 'OPC UA')}${enlace(350, 54, 420, 100, 'OPC UA')}
          ${enlace(260, 122, 340, 122, 'E/S · PROFINET', true)}
          ${enlace(130, 144, 116, 200, 'E/S 24 V')}${enlace(175, 144, 250, 200, 'Modbus TCP')}${enlace(425, 144, 455, 200, 'bus de servos')}
          <text x="300" y="285" text-anchor="middle" fill="#9e86ff" font-size="11">Arriba, pocos mensajes con mucho significado; abajo, muchos bits muy rápidos.</text></svg>`),
        el('div', { class: 'texto-largo', html: `<table><tr><th>Medio</th><th>Qué transporta</th><th>En este proyecto</th></tr>
<tr><td>E/S digitales 24 V</td><td>Un bit por cable: sensores, pulsadores, luces</td><td>Simuladas: <code>di1</code> a <code>di4</code>, <code>do1</code> a <code>do4</code></td></tr>
<tr><td>Bus serie de servos</td><td>Posiciones, velocidades, temperaturas, a 1 Mbit/s</td><td>Protocolo Feetech por USB (placa del brazo)</td></tr>
<tr><td>Modbus TCP</td><td>Registros de 16 bits numerados, sin nombres ni tipos</td><td>No se usa</td></tr>
<tr><td>OPC UA</td><td>Variables con nombre, tipo, unidades, alarmas y métodos</td><td>No se usa; su papel lo cumplen ROS 2 y la API HTTP de la aplicación</td></tr>
<tr><td>ROS 2 (DDS)</td><td>Temas publicados y suscritos entre procesos</td><td><code>/joint_states</code>, controladores y MoveIt</td></tr></table>` }));
        app.escena.fijarPostura([0, 0.3, -0.3, 0.6, 0, 0.5]);
      },
      detalle: `<p>La automatización se describe con la <b>pirámide</b> de la norma ISA-95: campo (sensores y actuadores), control (PLC, controladores de robot), supervisión (SCADA) y gestión de producción (MES). Cada nivel necesita un tipo de comunicación distinto.</p>
<p><b>Modbus</b> (1979) es el protocolo industrial más sencillo y extendido: un maestro lee o escribe <b>registros</b> numerados de 16 bits en un esclavo. No dice qué significa cada registro: el integrador tiene que saber que el registro 40012 es, por ejemplo, la temperatura en décimas de grado.</p>
<p><b>OPC UA</b> (IEC 62541) resuelve eso: cada dato es un <b>nodo</b> con nombre, tipo, unidades y relaciones, y el cliente puede explorar el servidor sin documentación previa. Incluye cifrado y autenticación, y es la base de muchas <i>companion specifications</i>, entre ellas una para robótica (OPC 40010, <i>Robotics</i>) que define cómo publicar el estado, los ejes y los programas de un robot.</p>
<p>En este proyecto, la capa de «datos con nombre» la dan ROS 2 (temas como <code>/joint_states</code>) y la API HTTP del servidor de la aplicación (<code>/api/estado</code>, <code>/api/trayectoria</code>). Un paso natural para integrar el brazo en una celda real sería un pequeño servidor OPC UA que traduzca esos temas a nodos.</p>`,
    },
    {
      titulo: 'Tiempo de ciclo y OEE',
      texto: 'Una celda se juzga por lo que produce. El <b>OEE</b> multiplica tres porcentajes: cuánto tiempo estuvo trabajando, a qué ritmo y cuántas piezas salieron buenas. Mueva los valores; el ciclo ideal parte del ejemplo de paletizado de Programar.',
      ancho: true,
      preparar(app, cuerpo) {
        const P = posturasCelda(app);
        const v = { turno: 8, paradas: 45, ciclo: 9.0, real: 10.5, malas: 2 };
        const b = barras([]);
        const lec = lectura();
        const calcular = () => {
          const disponible = v.turno * 3600, operando = disponible - v.paradas * 60;
          const piezas = Math.floor(operando / v.real);
          const A = operando / disponible;
          const R = (piezas * v.ciclo) / operando;
          const Q = Math.max(0, piezas - (piezas * v.malas) / 100) / piezas;
          const oee = A * R * Q;
          b.fijar([
            { etq: 'Disponibilidad', frac: A, texto: `${(A * 100).toFixed(1)} %` },
            { etq: 'Rendimiento', frac: R, texto: `${(R * 100).toFixed(1)} %` },
            { etq: 'Calidad', frac: Q, texto: `${(Q * 100).toFixed(1)} %` },
            { etq: 'OEE', frac: oee, texto: `${(oee * 100).toFixed(1)} %` },
          ]);
          const buenas = Math.round(piezas * Q), ideal = Math.floor(disponible / v.ciclo);
          lec.textContent = `${piezas} piezas producidas, ${buenas} buenas, de ${ideal} posibles en el turno sin paradas ni pérdidas.\nOEE = ${(A * 100).toFixed(1)} % × ${(R * 100).toFixed(1)} % × ${(Q * 100).toFixed(1)} % = ${(oee * 100).toFixed(1)} %   ${oee >= 0.85 ? '(nivel de referencia «de clase mundial»)' : oee >= 0.6 ? '(típico)' : '(bajo)'}`;
        };
        const d = (etq, clave, o) => deslizador(etq, { ...o, valor: v[clave], alCambiar: (x) => { v[clave] = x; if (v.real < v.ciclo) { v.real = v.ciclo; realD.fijar(v.real); } calcular(); } });
        const realD = d('Ciclo real por pieza', 'real', { min: 5, max: 14, paso: 0.1, formato: (x) => `${x.toFixed(1)} s` });
        cuerpo.append(
          d('Duración del turno', 'turno', { min: 1, max: 12, paso: 0.5, formato: (x) => `${x.toFixed(1)} h` }),
          d('Paradas no planificadas', 'paradas', { min: 0, max: 180, paso: 5, formato: (x) => `${x.toFixed(0)} min` }),
          d('Ciclo ideal por pieza', 'ciclo', { min: 5, max: 12, paso: 0.1, formato: (x) => `${x.toFixed(1)} s` }),
          realD,
          d('Piezas defectuosas', 'malas', { min: 0, max: 20, paso: 0.5, formato: (x) => `${x.toFixed(1)} %` }),
          b, lec);
        calcular();
        return animar((t) => app.escena.fijarPostura(cicloTomar(P, (t / v.real) % 1)));
      },
      detalle: `<p>El <b>OEE</b> (<i>Overall Equipment Effectiveness</i>) nació con el mantenimiento productivo total (TPM) de Seiichi Nakajima. Separa las pérdidas de una máquina en tres grupos:</p>
$$D = \\frac{\\text{tiempo operando}}{\\text{tiempo planificado}}$$
$$R = \\frac{\\text{piezas} \\cdot t_{\\text{ideal}}}{\\text{tiempo operando}}$$
$$C = \\frac{\\text{piezas buenas}}{\\text{piezas}}$$
$$\\text{OEE} = D \\times R \\times C$$
<ul><li><b>Disponibilidad</b> ($D$): pierde por averías, falta de piezas, cambios de formato.</li>
<li><b>Rendimiento</b> ($R$): pierde por ciclos más lentos que el ideal y microparadas.</li>
<li><b>Calidad</b> ($C$): pierde por piezas defectuosas y retrabajos.</li></ul>
<p>El producto de los tres tiene una lectura simple: es la fracción del tiempo planificado que se usó para hacer <b>piezas buenas al ritmo ideal</b>. Un OEE del 85 % se cita a menudo como referencia de «clase mundial»; muchas líneas reales están entre 40 y 60 %.</p>
<p>El ejemplo 8 de Programar (paletizar tres cubos) tarda unos 28 s al 100 % de velocidad: unos <b>9 s por pieza</b>, que es el ciclo ideal inicial de este paso. En un robot, el tiempo de ciclo se reduce con zonas (<code>z10</code> en lugar de <code>fine</code>), trayectorias articulares (<code>MoveJ</code>) donde no hace falta línea recta y menos esperas; la lección 10 explica por qué.</p>`,
    },
    {
      titulo: 'Gemelo digital: tres brazos que son el mismo',
      texto: 'Este proyecto tiene tres versiones del mismo brazo: el <b>real</b>, el de <b>Gazebo</b> (física simulada) y el de esta <b>aplicación</b>. Todas usan el mismo modelo URDF. El fantasma sigue al brazo con un retardo, como un gemelo que recibe los datos del real.',
      ancho: true,
      preparar(app, cuerpo) {
        const P = posturasCelda(app);
        let retardo = 0.25;
        const pasado = [];
        cuerpo.append(figura(`<svg viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="12">
          <defs><marker id="pf18" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9e86ff"/></marker></defs>
          <rect x="20" y="20" width="160" height="60" rx="8" fill="#150f23" stroke="#c2ef4e"/><text x="100" y="45" text-anchor="middle" fill="#fff" font-weight="600">Brazo real</text><text x="100" y="64" text-anchor="middle" fill="#9e86ff" font-size="11">servos STS3215</text>
          <rect x="220" y="20" width="160" height="60" rx="8" fill="#150f23" stroke="#ffb287"/><text x="300" y="45" text-anchor="middle" fill="#fff" font-weight="600">ROS 2</text><text x="300" y="64" text-anchor="middle" fill="#9e86ff" font-size="11">/joint_states, controladores</text>
          <rect x="420" y="20" width="160" height="60" rx="8" fill="#150f23" stroke="#fd44b0"/><text x="500" y="45" text-anchor="middle" fill="#fff" font-weight="600">Gazebo</text><text x="500" y="64" text-anchor="middle" fill="#9e86ff" font-size="11">física, gravedad, contacto</text>
          <rect x="220" y="130" width="160" height="60" rx="8" fill="#150f23" stroke="#a597ff"/><text x="300" y="155" text-anchor="middle" fill="#fff" font-weight="600">Aplicación</text><text x="300" y="174" text-anchor="middle" fill="#9e86ff" font-size="11">modelo 3D, programas</text>
          <line x1="180" y1="44" x2="218" y2="44" stroke="#9e86ff" stroke-width="2" marker-end="url(#pf18)"/><line x1="220" y1="58" x2="182" y2="58" stroke="#9e86ff" stroke-width="2" marker-end="url(#pf18)"/>
          <line x1="380" y1="44" x2="418" y2="44" stroke="#9e86ff" stroke-width="2" marker-end="url(#pf18)"/><line x1="420" y1="58" x2="382" y2="58" stroke="#9e86ff" stroke-width="2" marker-end="url(#pf18)"/>
          <line x1="292" y1="82" x2="292" y2="128" stroke="#9e86ff" stroke-width="2" marker-end="url(#pf18)"/><line x1="308" y1="128" x2="308" y2="84" stroke="#9e86ff" stroke-width="2" marker-end="url(#pf18)"/>
          <text x="318" y="110" fill="#ffb287" font-size="11">trayectorias · estado</text><text x="500" y="100" text-anchor="middle" fill="#9e86ff" font-size="11">trajectory_mirror: lo que va</text><text x="500" y="114" text-anchor="middle" fill="#9e86ff" font-size="11">al brazo real se repite aquí</text></svg>`),
        deslizador('Retardo de comunicación', { min: 0, max: 1, paso: 0.05, valor: retardo, formato: (x) => `${(x * 1000).toFixed(0)} ms`, alCambiar: (x) => { retardo = x; } }),
        lectura('Brazo sólido: el «real». Fantasma: el gemelo, que recibe las posturas con el retardo elegido.'));
        const fin = animar((t) => {
          const q = cicloTomar(P, (t / 6) % 1);
          app.escena.fijarPostura(q);
          pasado.push([t, q]);
          while (pasado.length > 2 && pasado[1][0] <= t - retardo) pasado.shift();
          app.escena.fijarFantasma(pasado[0][1]);
        });
        return () => { fin(); app.escena.fijarFantasma(null); };
      },
      detalle: `<p>Un <b>gemelo digital</b> es un modelo virtual de un equipo concreto que se mantiene <b>conectado</b> a él: recibe sus datos (posturas, temperaturas, alarmas) y puede enviarle órdenes ya probadas. Se distingue de una simple simulación en esa conexión permanente con un equipo real.</p>
<p>En este proyecto hay tres niveles:</p>
<ul><li><b>La aplicación</b> (esta página) es un gemelo <b>cinemático</b>: calcula posturas, trayectorias y la celda virtual; cuando el destino es el brazo real, muestra al mismo tiempo lo que el brazo recibe.</li>
<li><b>Gazebo</b> es un gemelo <b>dinámico</b>: agrega masas, gravedad, fricción y contactos. El nodo <code>trajectory_mirror</code> copia a Gazebo las trayectorias que se envían al brazo real, para comparar los dos.</li>
<li><b>El brazo real</b> cierra el lazo: sus codificadores publican el estado en <code>/joint_states</code> y la aplicación lo dibuja.</li></ul>
<p>Usos típicos de un gemelo en la industria: <b>puesta en marcha virtual</b> (probar el programa del robot y del PLC antes de que exista la celda), <b>supervisión</b> (ver el estado de la máquina a distancia), y <b>mantenimiento predictivo</b> (comparar lo medido con lo esperado; por ejemplo, un servo que necesita cada vez más corriente para la misma postura). Los ensayos A1 a A5 de este proyecto son el primer paso de eso último: miden cuánto se aparta el brazo real del modelo.</p>
<p>El retardo importa: si el gemelo recibe los datos con 300 ms de atraso, cualquier decisión que tome sobre ellos (una parada, una alarma) llega tarde. El ensayo A5 midió retardos de 140 a 320 ms entre la orden y el inicio del movimiento.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Una celda planificada para 8 h estuvo parada 48 min. En el tiempo restante produjo 3000 piezas con un ciclo ideal de 7 s, y 60 salieron defectuosas. ¿Cuál es su OEE aproximado?',
        opciones: ['90 %', '71 %', '81 %', '98 %'],
        correcta: 1,
        explicacion: 'Disponibilidad = 432/480 = 90 %. Rendimiento = 3000 · 7 s / 25 920 s = 81 %. Calidad = 2940/3000 = 98 %. OEE = 0,90 × 0,81 × 0,98 ≈ 0,71. Es lo mismo que 2940 piezas buenas × 7 s / 28 800 s = 71,5 %.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, -0.3, 0.6, 0, 0.5]); },
    },
  ],
};
