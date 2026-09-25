// Aprender: mapa de módulos de robótica, de lo básico a lo industrial, y el reproductor de lecciones.
import { el } from '../ui.js';
import gdl from '../lecciones/gdl.js';

// Plan completo. Las lecciones se agregan por fases; las marcadas con leccion ya se pueden abrir.
const PLAN = [
  ['basico', 'Básico', [
    ['1', '¿Qué es un robot? Grados de libertad', 'Eslabones, articulaciones y cuántos movimientos independientes tiene el brazo', gdl],
    ['2', 'Tipos de articulación', 'Giratorias y lineales, límites y cómo se miden sus ángulos'],
    ['3', 'Espacio de trabajo', 'Hasta dónde llega la pinza y por qué hay zonas imposibles'],
  ]],
  ['intermedio', 'Intermedio', [
    ['4', 'Posición y orientación', 'Matrices de rotación, ángulos de Euler y cuaterniones'],
    ['5', 'Transformaciones homogéneas y D-H', 'Cómo se encadenan los marcos de cada eslabón'],
    ['6', 'Cinemática directa', 'De los ángulos a la posición de la pinza'],
    ['7', 'Cinemática inversa', 'De la posición deseada a los ángulos: soluciones múltiples o ninguna'],
    ['8', 'Jacobiano y singularidades', 'Velocidades, manipulabilidad y posturas donde el robot se «traba»'],
  ]],
  ['avanzado', 'Avanzado', [
    ['9', 'Cuaterniones duales y teoría de tornillos', 'Rotación y traslación en un solo número; producto de exponenciales; interpolación ScLERP'],
    ['10', 'Planificación de trayectorias', 'Perfiles trapezoidal y curva S, splines, jerk, SLERP'],
    ['11', 'Dinámica', 'Newton–Euler y Lagrange: pares por gravedad y por aceleración, carga útil'],
    ['12', 'Control', 'PID del servo, control de par calculado, impedancia y admitancia'],
    ['13', 'Planificación con obstáculos', 'MoveIt, espacio de configuraciones, RRT y detección de colisiones'],
    ['14', 'Visión y teleoperación', 'Cámara, MediaPipe, filtros, latencia: cómo funciona este proyecto'],
  ]],
  ['industrial', 'Industrial', [
    ['15', 'Programación de robots industriales', 'Marcos base, usuario y herramienta (TCP); jog; movimientos PTP, LIN y CIRC; zonas de aproximación'],
    ['16', 'Calibración', 'Cinemática, TCP y mano-ojo (cámara-robot)'],
    ['17', 'Seguridad y normas', 'ISO 10218, ISO/TS 15066 (cobots), ISO 9283 (desempeño), categorías de parada'],
    ['18', 'Integración de celda y gemelo digital', 'PLC, E/S, Modbus y OPC UA, ciclo de pick & place, OEE'],
  ]],
];

const seccion = {
  id: 'aprender', titulo: 'Aprender robótica', corto: 'Aprender', icono: 'aprender',

  montar(nodo, app) {
    this.app = app;
    this.nodo = nodo;
    this.pintarMapa();
  },

  pintarMapa() {
    const partes = [
      el('h2', {}, 'Aprender robótica'),
      el('p', { class: 'sub' }, 'Dieciocho lecciones sobre este mismo brazo, desde qué es un grado de libertad hasta una celda industrial. Funcionan sin ROS y sin el robot. Las que aparecen atenuadas llegan en las próximas fases.'),
    ];
    for (const [nivel, titulo, modulos] of PLAN) {
      partes.push(el('div', { class: 'nivel' }, titulo));
      for (const [n, t, d, leccion] of modulos) {
        partes.push(el('button', { class: `modulo ${leccion ? 'listo' : ''}`, onclick: () => leccion && this.abrir(leccion) },
          el('div', { class: `num n-${nivel}` }, String(n).padStart(2, '0')),
          el('div', {}, el('strong', {}, t), el('span', {}, d)),
          el('span', { class: 'candado' }, leccion ? 'Abrir' : 'Pronto')));
      }
    }
    this.nodo.replaceChildren(...partes);
  },

  abrir(leccion) {
    const app = this.app;
    app.enLeccion = true;
    app.escena.vista('leccion');
    document.getElementById('chip-fuente').textContent = `Lección: ${leccion.titulo}`;
    const capa = document.getElementById('capa-leccion');
    capa.classList.remove('oculto');
    let i = 0;
    let limpiar = null;
    const cerrar = () => {
      limpiar?.();
      capa.classList.add('oculto');
      capa.replaceChildren();
      app.enLeccion = false;
      app.escena.resaltar(null);
      app.escena.extras.clear();
      app.escena.verEtiquetas(false);
      app.refrescar();
      this.pintarMapa();
    };
    const pintar = () => {
      limpiar?.();
      const paso = leccion.pasos[i];
      const cuerpo = el('div');
      const siguiente = el('button', { class: 'boton primario', html: i === leccion.pasos.length - 1 ? 'Terminar' : 'Siguiente ➔',
        onclick: () => { if (i === leccion.pasos.length - 1) cerrar(); else { i++; pintar(); } } });
      if (paso.reto) siguiente.disabled = true;
      capa.replaceChildren(
        el('div', { class: 'paso' }, `${leccion.titulo} · paso ${i + 1} de ${leccion.pasos.length}`),
        el('h3', {}, paso.titulo),
        el('p', { html: paso.texto }),
        cuerpo,
        el('div', { class: 'fila', style: 'margin-top:12px' },
          el('button', { class: 'boton', html: 'Atrás', disabled: i === 0, onclick: () => { i--; pintar(); } }),
          el('span', { class: 'crece' }),
          el('button', { class: 'boton', onclick: cerrar }, 'Salir'),
          siguiente),
        el('div', { class: 'puntos' }, ...leccion.pasos.map((_, k) => el('i', { class: k <= i ? 'hecho' : '' }))),
      );
      app.escena.resaltar(null);
      limpiar = paso.preparar?.(app, cuerpo, () => { siguiente.disabled = false; siguiente.classList.add('exito'); }) || null;
      this.pintarGuia(leccion, i);
    };
    pintar();
  },

  // En el panel derecho: el índice de la lección y los conceptos clave.
  pintarGuia(leccion, actual) {
    this.nodo.replaceChildren(
      el('h2', {}, leccion.titulo),
      el('p', { class: 'sub' }, leccion.resumen),
      el('div', { class: 'tarjeta' }, el('h3', { html: `Pasos` },),
        ...leccion.pasos.map((p, k) => el('div', { class: 'fila', style: `opacity:${k === actual ? 1 : 0.55};padding:4px 0` },
          el('span', { class: `num`, style: 'width:28px;font-family:var(--mono);font-size:13px;color:var(--texto-2)' }, `${k + 1}`), el('span', {}, p.titulo)))),
      ...(leccion.conceptos ? [el('div', { class: 'tarjeta' }, el('h3', { html: `Conceptos clave` }),
        ...leccion.conceptos.map(([t, d]) => el('div', { style: 'margin-bottom:10px' }, el('strong', {}, t), el('div', { class: 'nota' }, d))))] : []),
    );
  },
};
export default seccion;
