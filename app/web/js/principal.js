// Arranque de la aplicación: modelo, escena 3D, navegación y datos en vivo.
import { obtener, escuchar } from './api.js';
import { Cadena } from './cinematica.js';
import { Escena } from './escena.js';
import { el, aviso } from './ui.js';
import sesion from './secciones/sesion.js';
import mover from './secciones/mover.js';
import programar from './secciones/programar.js';
import aprender from './secciones/aprender.js';
import ensayos from './secciones/ensayos.js';
import diagnostico from './secciones/diagnostico.js';
import ajustes from './secciones/ajustes.js';

const SECCIONES = [sesion, mover, programar, aprender, ensayos, diagnostico, ajustes];

class Aplicacion {
  constructor() {
    this.oyentes = {};
    this.estado = null;
    this.qVivo = { sim: null, real: null };
    this.qManual = [0, 0, 0, 0, 0, 0];
  }

  on(evento, f) { (this.oyentes[evento] ||= []).push(f); }
  emitir(evento, datos) { (this.oyentes[evento] || []).forEach((f) => f(datos)); }

  async iniciar() {
    this.modelo = await obtener('/api/modelo');
    this.cadena = new Cadena(this.modelo);
    this.escena = new Escena(document.getElementById('vista3d'), this.modelo);
    this.escena.alCambiarEfector = (p) => {
      document.getElementById('chip-efector').textContent =
        `Pinza · x ${(p.x * 1000).toFixed(0)}  y ${(p.y * 1000).toFixed(0)}  z ${(p.z * 1000).toFixed(0)} mm`;
    };
    this._herramientas();
    this._navegacion();
    await this.refrescar();
    escuchar({
      articulaciones: (d) => { this.qVivo = d; this._aplicarVivo(); },
      sesion: () => this.refrescar(),
      tarea: () => this.refrescar(),
      log: (d) => this.emitir('log', d),
      desconectado: () => this._indicadores(true),
    });
    setInterval(() => this.refrescar(), 5000);
  }

  async refrescar() {
    try {
      this.estado = await obtener('/api/estado');
    } catch {
      this._indicadores(true);
      return;
    }
    this._indicadores(false);
    this._aplicarVivo();
    this.emitir('estado', this.estado);
  }

  // Qué planta se refleja en el robot sólido.
  fuenteViva() {
    const s = this.estado?.sesion;
    if (!s || s.estado === 'detenida') return null;
    if ((s.modo === 'real' || s.modo === 'ambos') && this.qVivo.real) return 'real';
    if (this.qVivo.sim) return 'sim';
    return null;
  }

  _aplicarVivo() {
    if (this.enLeccion) return;            // las lecciones usan el robot virtual
    const f = this.fuenteViva();
    const chip = document.getElementById('chip-fuente');
    if (f) {
      this.escena.fijarPostura(this.qVivo[f]);
      chip.innerHTML = f === 'real' ? '● En vivo: <b>brazo físico</b>' : '● En vivo: <b>simulación Gazebo</b>';
      chip.style.color = 'var(--ok)';
    } else {
      chip.textContent = 'Simulación interna (sin ROS en marcha)';
      chip.style.color = '';
    }
  }

  // Postura manual: en vivo se muestra como fantasma; sin ROS mueve el robot.
  fijarManual(q, { fantasma = true } = {}) {
    this.qManual = q.slice();
    if (this.fuenteViva()) this.escena.fijarFantasma(fantasma ? q : null);
    else { this.escena.fijarFantasma(null); this.escena.fijarPostura(q, true); }
    this.emitir('manual', q);
  }

  posturaActual() {
    const f = this.fuenteViva();
    return f ? this.qVivo[f].slice() : this.escena.q.slice();
  }

  _indicadores(sinServidor) {
    const cont = document.getElementById('indicadores');
    const ind = (clase, texto, titulo = '') => el('div', { class: 'indicador', title: titulo }, el('span', { class: `punto ${clase}` }), texto);
    if (sinServidor) {
      cont.replaceChildren(ind('mal vivo', 'Sin conexión con el servidor local'));
      return;
    }
    const e = this.estado;
    const nombreEnt = { wsl: 'WSL2', vm: 'Máquina virtual', nativo: 'Ubuntu nativo' }[e.entorno] || e.entorno;
    const est = e.sesion.estado;
    const txtSesion = { detenida: 'Sesión detenida', arrancando: 'Arrancando…', teleop: 'Teleoperando', menu: 'Teleop. cerrada · en init',
      moviendo: 'Moviendo a init…', cerrando: 'Cerrando…' }[est] || est;
    const cam = e.conf.SOARM_CAM || '0';
    cont.replaceChildren(
      ind('ok', nombreEnt, 'Entorno de ejecución'),
      ind(e.ros.disponible ? 'ok' : 'aviso', e.ros.disponible ? 'ROS 2' : 'Sin ROS', e.ros.motivo || ''),
      ind(e.brazo.puertos.length ? 'ok' : '', e.brazo.puertos.length ? `Brazo ${e.brazo.puertos[0]}` : 'Brazo no conectado'),
      ind(cam.startsWith('http') ? 'ok' : '', cam.startsWith('http') ? `Cámara ${cam.replace(/^https?:\/\//, '').replace(/\/video$/, '')}` : `Cámara /dev/video${cam}`),
      ind(est === 'detenida' ? '' : est === 'teleop' ? 'ok vivo' : 'aviso vivo', txtSesion),
    );
  }

  _navegacion() {
    const riel = document.getElementById('riel');
    const panel = document.getElementById('panel');
    this.botones = {};
    for (const s of SECCIONES) {
      if (s.id === 'ajustes') riel.append(el('div', { class: 'separador' }));
      const b = el('button', { title: s.titulo, onclick: () => this.mostrar(s.id), html: s.corto });
      riel.append(b);
      this.botones[s.id] = b;
      s.nodo = el('div', { class: 'oculto' });
      panel.append(s.nodo);
      s.montar(s.nodo, this);
    }
    this.mostrar(location.hash.slice(1) || 'sesion');
  }

  mostrar(id) {
    for (const s of SECCIONES) {
      const activa = s.id === id;
      if (this.actual === s && !activa) s.alOcultar?.(this);
      s.nodo.classList.toggle('oculto', !activa);
      this.botones[s.id].classList.toggle('activo', activa);
      if (activa && this.actual !== s) { this.actual = s; s.alMostrar?.(this); }
    }
    history.replaceState(null, '', `#${id}`);
  }

  _herramientas() {
    const barra = document.getElementById('herramientas-vista');
    const conmutador = (icono, texto, f) => {
      const b = el('button', { html: texto, onclick: () => { b.classList.toggle('activo'); f(b.classList.contains('activo')); } });
      return b;
    };
    const vista = (texto, nombre) => el('button', { onclick: () => this.escena.vista(nombre) }, texto);
    barra.append(
      vista('Iso', 'iso'),
      vista('Frente', 'frente'), vista('Lado', 'lado'), vista('Arriba', 'arriba'),
      el('div', { class: 'div' }),
      conmutador('etiqueta', 'Nombres', (v) => this.escena.verEtiquetas(v)),
      conmutador('ejes', 'Ejes', (v) => this.escena.verEjes(v)),
      conmutador('rastro', 'Rastro', (v) => this.escena.verRastro(v)),
    );
  }
}

const app = new Aplicacion();
window.estudio = app;             // útil para depurar desde la consola del navegador
app.iniciar().catch((e) => { console.error(e); aviso(`No se pudo iniciar: ${e.message}`, 'mal'); });
