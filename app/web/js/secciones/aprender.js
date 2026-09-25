// Aprender: mapa de módulos de robótica, de lo básico a lo industrial, y el
// reproductor de lecciones. Cada lección es una lista de pasos; cada paso
// tiene un texto corto sobre la escena, una interacción, y una explicación
// larga (con fórmulas) en el panel derecho.
import { el, aviso } from '../ui.js';
import { mate, vaciar } from '../lecciones/comun.js';
import gdl from '../lecciones/gdl.js';
import l02 from '../lecciones/l02_articulaciones.js';
import l03 from '../lecciones/l03_espacio.js';
import l04 from '../lecciones/l04_orientacion.js';
import l05 from '../lecciones/l05_homogeneas.js';
import l06 from '../lecciones/l06_directa.js';
import l07 from '../lecciones/l07_inversa.js';
import l08 from '../lecciones/l08_jacobiano.js';
import l09 from '../lecciones/l09_duales.js';
import l10 from '../lecciones/l10_trayectorias.js';
import l11 from '../lecciones/l11_dinamica.js';
import l12 from '../lecciones/l12_control.js';
import l13 from '../lecciones/l13_obstaculos.js';
import l14 from '../lecciones/l14_vision.js';
import l15 from '../lecciones/l15_programacion.js';
import l16 from '../lecciones/l16_calibracion.js';
import l17 from '../lecciones/l17_seguridad.js';
import l18 from '../lecciones/l18_celda.js';

const PLAN = [
  ['basico', 'Básico', [
    ['1', '¿Qué es un robot? Grados de libertad', 'Eslabones, articulaciones y cuántos movimientos independientes tiene el brazo', gdl],
    ['2', 'Tipos de articulación', 'Giratorias y lineales, límites y cómo mide un servo su ángulo', l02],
    ['3', 'Espacio de trabajo', 'Hasta dónde llega la pinza y por qué hay zonas imposibles', l03],
  ]],
  ['intermedio', 'Intermedio', [
    ['4', 'Posición y orientación', 'Matrices de rotación, ángulos de Euler, bloqueo de cardán y cuaterniones', l04],
    ['5', 'Transformaciones homogéneas y D-H', 'Cómo se encadenan los marcos de cada eslabón', l05],
    ['6', 'Cinemática directa', 'De los ángulos a la posición de la pinza', l06],
    ['7', 'Cinemática inversa', 'De la posición deseada a los ángulos: varias soluciones o ninguna', l07],
    ['8', 'Jacobiano y singularidades', 'Velocidades, manipulabilidad y posturas donde el robot se traba', l08],
  ]],
  ['avanzado', 'Avanzado', [
    ['9', 'Cuaterniones duales y teoría de tornillos', 'Rotación y traslación en un solo objeto; producto de exponenciales; ScLERP', l09],
    ['10', 'Planificación de trayectorias', 'Perfiles trapezoidal, curva S y quíntico; articular contra cartesiano', l10],
    ['11', 'Dinámica', 'Par por gravedad en cada postura y carga útil, con los ensayos reales', l11],
    ['12', 'Control', 'PID del servo, respuesta al escalón medida, impedancia', l12],
    ['13', 'Planificación con obstáculos', 'Espacio de configuraciones, colisiones y RRT', l13],
    ['14', 'Visión y teleoperación', 'Cámara, MediaPipe, filtros y latencia: cómo funciona este proyecto', l14],
  ]],
  ['industrial', 'Industrial', [
    ['15', 'Programación de robots industriales', 'Marcos, jog, MoveJ, MoveL, MoveC, zonas, Offs y retos en la pestaña Programar', l15],
    ['16', 'Calibración', 'Ceros de los servos, TCP y cámara-robot (mano-ojo)', l16],
    ['17', 'Seguridad y normas', 'ISO 10218, ISO/TS 15066, ISO 9283 y categorías de parada', l17],
    ['18', 'Integración de celda y gemelo digital', 'Señales, PLC, OPC UA, ciclo de trabajo y OEE', l18],
  ]],
];

const CLAVE = 'soarm-lecciones-hechas';
const hechas = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')); } catch { return new Set(); } };
const marcarHecha = (id) => { try { const s = hechas(); s.add(id); localStorage.setItem(CLAVE, JSON.stringify([...s])); } catch { /* sin almacenamiento */ } };

const vaciarExtras = vaciar;

const seccion = {
  id: 'aprender', titulo: 'Aprender robótica', corto: 'Aprender', icono: 'aprender',

  montar(nodo, app) {
    this.app = app;
    this.nodo = nodo;
    this.pintarMapa();
  },

  alOcultar() { if (this.cerrarLeccion) this.cerrarLeccion(); },

  pintarMapa() {
    const h = hechas();
    const partes = [
      el('h2', {}, 'Aprender robótica'),
      el('p', { class: 'sub' }, 'Dieciocho lecciones sobre este mismo brazo, desde qué es un grado de libertad hasta una celda industrial. Cada una tiene pasos que se tocan en 3D, una explicación detallada con fórmulas y preguntas. Funcionan sin ROS y sin el robot.'),
    ];
    for (const [, titulo, modulos] of PLAN) {
      partes.push(el('div', { class: 'nivel' }, titulo));
      for (const [n, t, d, leccion] of modulos) {
        const id = `l${n}`;
        partes.push(el('button', { class: `modulo ${leccion ? 'listo' : ''}`, onclick: () => leccion && this.abrir(leccion, id) },
          el('div', { class: 'num' }, String(n).padStart(2, '0')),
          el('div', {}, el('strong', {}, t), el('span', {}, d)),
          el('span', { class: 'candado' }, h.has(id) ? 'Hecha' : `${leccion?.pasos.length ?? ''} pasos`)));
      }
    }
    this.nodo.replaceChildren(...partes);
  },

  abrir(leccion, id) {
    const app = this.app;
    if (this.cerrarLeccion) this.cerrarLeccion();
    app.enLeccion = true;
    app.escena.fijarFantasma(null);
    app.escena.vista('leccion');
    document.getElementById('chip-fuente').textContent = `Lección: ${leccion.titulo}`;
    const capa = document.getElementById('capa-leccion');
    capa.classList.remove('oculto');
    let i = 0;
    let limpiar = null;
    const cerrar = () => {
      limpiar?.();
      limpiar = null;
      this.cerrarLeccion = null;
      capa.classList.add('oculto');
      capa.classList.remove('ancha');
      capa.replaceChildren();
      app.enLeccion = false;
      app.escena.resaltar(null);
      app.escena.alClicArticulacion = null;
      vaciarExtras(app);
      app.escena.verEtiquetas(false);
      app.escena.verEjes(false);
      app.celda?.mostrar(false);
      app.escena.fijarPostura(app.qManual);
      app.refrescar();
      this.pintarMapa();
    };
    this.cerrarLeccion = cerrar;
    const pintar = () => {
      limpiar?.();
      limpiar = null;
      vaciarExtras(app);
      app.escena.resaltar(null);
      app.escena.alClicArticulacion = null;
      app.escena.verEtiquetas(false);
      app.celda?.mostrar(false);
      const paso = leccion.pasos[i];
      const ultimo = i === leccion.pasos.length - 1;
      const cuerpo = el('div', { class: 'cuerpo-paso' });
      const siguiente = el('button', { class: 'boton primario', html: ultimo ? 'Terminar' : 'Siguiente ➔',
        onclick: () => { if (ultimo) { marcarHecha(id); aviso(`Lección «${leccion.titulo}» completada.`, 'ok'); cerrar(); } else { i++; pintar(); } } });
      const listo = () => { siguiente.disabled = false; };
      if (paso.reto || paso.pregunta) siguiente.disabled = true;
      capa.classList.toggle('ancha', !!paso.ancho);
      capa.replaceChildren(
        el('div', { class: 'paso' }, `${leccion.titulo} · paso ${i + 1} de ${leccion.pasos.length}`),
        el('h3', {}, paso.titulo),
        el('p', { html: mate(paso.texto) }),
        cuerpo,
        el('div', { class: 'fila pie-leccion' },
          el('button', { class: 'boton', html: 'Atrás', disabled: i === 0, onclick: () => { i--; pintar(); } }),
          el('span', { class: 'crece' }),
          el('button', { class: 'boton', onclick: cerrar }, 'Salir'),
          siguiente),
        el('div', { class: 'puntos' }, ...leccion.pasos.map((_, k) => el('i', { class: k <= i ? 'hecho' : '' }))),
      );
      if (paso.vista) app.escena.vista(paso.vista);
      if (paso.pregunta) cuerpo.append(this.pregunta(paso.pregunta, listo));
      try {
        limpiar = paso.preparar?.(app, cuerpo, listo) || null;
      } catch (e) {
        console.error(e);
        cuerpo.append(el('div', { class: 'mensaje mal' }, `Este paso no pudo prepararse: ${e.message}`));
      }
      if (paso.programa) {
        cuerpo.append(el('div', { class: 'fila', style: 'margin-top:10px' },
          el('button', { class: 'boton pequeno', onclick: () => { cerrar(); app.abrirPrograma?.(paso.programa); } }, 'Abrir este programa en Programar')));
      }
      this.pintarGuia(leccion, i);
    };
    pintar();
  },

  // Pregunta de opción múltiple: sólo deja seguir con la respuesta correcta.
  pregunta(p, listo) {
    const caja = el('div', { class: 'pregunta' });
    const explicacion = el('div', { class: 'nota', style: 'margin-top:8px' });
    const opciones = p.opciones.map((o, k) => el('button', { class: 'opcion-preg', html: mate(o), onclick: (ev) => {
      if (k === p.correcta) {
        ev.currentTarget.classList.add('bien');
        opciones.forEach((b) => { b.disabled = true; });
        explicacion.innerHTML = mate(`<b>Correcto.</b> ${p.explicacion || ''}`);
        listo();
      } else {
        ev.currentTarget.classList.add('mal');
        ev.currentTarget.disabled = true;
        explicacion.innerHTML = mate(p.pista ? `No es esa. ${p.pista}` : 'No es esa; pruebe otra.');
      }
    } }));
    caja.append(el('div', { class: 'enunciado', html: mate(p.enunciado) }), ...opciones, explicacion);
    return caja;
  },

  // Panel derecho: índice, explicación detallada del paso y conceptos clave.
  pintarGuia(leccion, actual) {
    const paso = leccion.pasos[actual];
    this.nodo.replaceChildren(...[
      el('h2', {}, leccion.titulo),
      el('p', { class: 'sub', html: mate(leccion.resumen) }),
      paso.detalle ? el('div', { class: 'tarjeta explicacion' }, el('h3', {}, `Paso ${actual + 1}: ${paso.titulo}`), el('div', { class: 'texto-largo', html: mate(typeof paso.detalle === 'function' ? paso.detalle(this.app) : paso.detalle) })) : null,
      el('div', { class: 'tarjeta' }, el('h3', {}, 'Pasos'),
        ...leccion.pasos.map((p, k) => el('div', { class: 'fila', style: `opacity:${k === actual ? 1 : 0.55};padding:4px 0` },
          el('span', { style: 'width:28px;font-family:var(--mono);font-size:13px;color:var(--texto-2)' }, `${k + 1}`), el('span', {}, p.titulo)))),
      ...(leccion.conceptos ? [el('div', { class: 'tarjeta' }, el('h3', {}, 'Conceptos clave'),
        ...leccion.conceptos.map(([t, d]) => el('div', { style: 'margin-bottom:10px' }, el('strong', { html: mate(t) }), el('div', { class: 'nota', html: mate(d) }))))] : []),
      ...(leccion.referencias ? [el('div', { class: 'tarjeta' }, el('h3', {}, 'Para seguir leyendo'),
        ...leccion.referencias.map((r) => el('div', { class: 'nota', style: 'margin-bottom:6px', html: r })))] : []),
    ].filter(Boolean));
    this.nodo.scrollTop = 0;
    this.nodo.parentElement.scrollTop = 0;
  },
};
export default seccion;
