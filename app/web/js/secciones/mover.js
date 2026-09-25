// Mover: articulación por articulación, arrastrando la pinza (cinemática inversa) o por puntos grabados.
import { enviar } from '../api.js';
import { el, aviso, grados } from '../ui.js';
import { COLORES } from '../escena.js';

const JUNTAS = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll', 'Gripper'];

const seccion = {
  id: 'mover', titulo: 'Mover el brazo', corto: 'Mover', icono: 'mover',
  puntos: [],

  montar(nodo, app) {
    this.app = app;
    this.deslizadores = {};
    const tarjetaArt = el('div', { class: 'tarjeta' }, el('h3', { html: `Articulaciones` }));
    for (const [i, n] of JUNTAS.entries()) {
      const j = app.modelo.juntas.find((x) => x.nombre === n);
      const valor = el('span', { class: 'valor' });
      const r = el('input', { type: 'range', min: j.limite[0], max: j.limite[1], step: 0.005, value: 0 });
      r.addEventListener('input', () => { const q = app.qManual.slice(); q[i] = +r.value; app.fijarManual(q); });
      const fila = el('div', { class: 'articulacion', onmouseenter: () => app.escena.resaltar(n), onmouseleave: () => app.escena.resaltar(null) },
        el('div', { class: 'cabeza' },
          el('div', { class: 'nombre' }, el('i', { style: `background:${COLORES[n]}` }), j.etiqueta),
          valor),
        r,
        el('div', { class: 'fila', style: 'justify-content:space-between' },
          el('span', { class: 'etq' }, `${grados(j.limite[0]).toFixed(0)}°`), el('span', { class: 'etq' }, n), el('span', { class: 'etq' }, `${grados(j.limite[1]).toFixed(0)}°`)));
      this.deslizadores[n] = { r, valor };
      tarjetaArt.append(fila);
    }
    this.lectura = el('div', { class: 'nota' });
    this.botonEjecutar = el('button', { class: 'boton primario ancho grande', html: `Mover el robot a esta postura`, onclick: () => this.ejecutar() });
    this.velocidad = el('select', { class: 'campo', style: 'width:auto' },
      ...[['0.3', 'Lento 0.3 rad/s'], ['0.5', 'Normal 0.5 rad/s'], ['1.0', 'Rápido 1 rad/s']].map(([v, t]) => el('option', { value: v, selected: v === '0.5' }, t)));
    this.estadoMover = el('div');
    this.listaPuntos = el('div', { class: 'opciones' });
    this.botonIK = el('button', { class: 'boton ancho', html: `Arrastrar la pinza en 3D`, onclick: () => this.alternarIK() });

    nodo.append(
      el('h2', {}, 'Mover el brazo'),
      el('p', { class: 'sub' }, 'Pase el ratón por un deslizador y la articulación se marca en 3D. Con el robot encendido, la silueta verde indica a dónde va a ir.'),
      el('div', { class: 'tarjeta' },
        el('h3', { html: `Posturas` }),
        el('div', { class: 'fila' },
          ...Object.keys(app.modelo.poses).map((p) => el('button', { class: 'boton crece', onclick: () => this.aPostura(p) }, p)),
          el('button', { class: 'boton crece', title: 'Copia la postura en que está el robot', html: `Actual`, onclick: () => this.copiarActual() })),
        el('div', { class: 'fila' }, this.botonIK)),
      tarjetaArt,
      el('div', { class: 'tarjeta' },
        el('h3', { html: `Dónde queda la pinza` }), this.lectura),
      el('div', { class: 'tarjeta' },
        el('h3', { html: `Ejecutar` }), this.estadoMover,
        el('div', { class: 'fila', style: 'margin-bottom:8px' }, el('span', { class: 'etq crece' }, 'Velocidad'), this.velocidad),
        this.botonEjecutar),
      el('div', { class: 'tarjeta' },
        el('h3', { html: `Secuencia de puntos` }),
        el('p', { class: 'nota' }, 'Guarde posturas y reprodúzcalas en orden: la base de la programación de un robot industrial.'),
        el('div', { class: 'fila' },
          el('button', { class: 'boton crece', html: `Guardar punto`, onclick: () => { this.puntos.push(app.qManual.slice()); this.pintarPuntos(); } }),
          el('button', { class: 'boton crece', html: `Reproducir`, onclick: () => this.reproducir() })),
        this.listaPuntos),
    );
    app.on('manual', (q) => this.pintar(q));
    app.on('estado', () => this.pintarEstado());
    app.escena.alArrastrar = (pos) => this.resolverIK(pos);
    this.pintar(app.qManual);
  },

  alMostrar(app) {
    this.copiarActual();
    this.pintarEstado();
  },
  alOcultar(app) {
    if (this.ik) this.alternarIK();
    app.escena.fijarFantasma(null);
  },

  enVivo() { const s = this.app.estado?.sesion; return !!(this.app.fuenteViva() && s?.estado === 'menu' && this.app.estado.ros.disponible); },

  pintarEstado() {
    const s = this.app.estado?.sesion;
    let msg, tipo;
    if (this.enVivo()) { msg = `Se moverá el ${s.modo === 'sim' ? 'robot de Gazebo' : s.modo === 'real' ? 'brazo físico' : 'brazo físico y Gazebo'}.`; tipo = 'ok'; }
    else if (s && s.estado === 'teleop') { msg = 'La teleoperación está activa: ciérrela (Q) para mover desde aquí.'; tipo = 'aviso'; }
    else { msg = 'Sin sesión en marcha: se mueve el robot virtual de la aplicación. Para mover el brazo real, inicie una sesión y cierre la teleoperación.'; tipo = 'aviso'; }
    this.estadoMover.replaceChildren(el('div', { class: `mensaje ${tipo}`, style: 'margin:0 0 10px' }, msg));
    this.botonEjecutar.innerHTML = `${this.enVivo() ? 'Mover el robot a esta postura' : 'Animar en el robot virtual'}`;
  },

  pintar(q) {
    JUNTAS.forEach((n, i) => {
      const d = this.deslizadores[n];
      if (document.activeElement !== d.r) d.r.value = q[i];
      d.valor.innerHTML = `${grados(q[i]).toFixed(1)}°<small>${q[i].toFixed(3)} rad</small>`;
    });
    const p = this.app.cadena.efector(q);
    const w = this.app.cadena.manipulabilidad(q);
    const alcance = Math.hypot(p.x, p.y);
    this.lectura.replaceChildren(
      el('div', { class: 'fila', style: 'font-family:var(--mono);gap:14px' },
        el('span', {}, `x ${(p.x * 1000).toFixed(0)}`), el('span', {}, `y ${(p.y * 1000).toFixed(0)}`), el('span', {}, `z ${(p.z * 1000).toFixed(0)} mm`)),
      el('div', { class: 'etq', style: 'margin-top:6px' }, `Alcance horizontal ${(alcance * 1000).toFixed(0)} mm · manipulabilidad w = ${(w * 1e3).toFixed(2)}·10⁻³`),
      el('div', { style: `height:6px;border-radius:6px;margin-top:6px;background:linear-gradient(90deg,var(--peligro),var(--aviso),var(--ok));opacity:.35;position:relative` },
        el('div', { style: `position:absolute;top:-3px;left:${Math.min(100, w / 0.018 * 100)}%;width:3px;height:12px;background:#fff;border-radius:2px` })),
      ...(w < 0.002 ? [el('div', { class: 'mensaje aviso' }, 'Cerca de una singularidad: el brazo pierde capacidad de moverse en alguna dirección.')] : []),
    );
  },

  aPostura(nombre) {
    const q = [...this.app.modelo.poses[nombre], this.app.qManual[5]];
    this.app.fijarManual(q);
  },

  copiarActual() { this.app.fijarManual(this.app.posturaActual(), { fantasma: false }); },

  alternarIK() {
    this.ik = !this.ik;
    this.botonIK.classList.toggle('exito', this.ik);
    const pos = this.app.cadena.efector(this.app.qManual);
    this.app.escena.mostrarObjetivo(this.ik, pos);
    if (this.ik) aviso('Arrastre las flechas de la esfera lima: el robot calcula su postura (cinemática inversa).');
  },

  resolverIK(pos) {
    const r = this.app.cadena.ik(pos, this.app.qManual.slice(0, 5));
    this.app.fijarManual([...r.q, this.app.qManual[5]]);
    this.app.escena.objetivo.material.color.set(r.alcanzado ? 0xc2ef4e : 0xfd44b0);
  },

  async ejecutar(q = this.app.qManual) {
    if (!this.enVivo()) { this.app.escena.fijarPostura(q, true); return 1.5; }
    try {
      const r = await enviar('/api/mover', { q: q.slice(0, 5), velocidad: +this.velocidad.value });
      const actual = this.app.posturaActual();
      if (Math.abs((actual[5] ?? 0) - q[5]) > 0.03) await enviar('/api/pinza', { valor: q[5] });
      aviso(`Moviendo… ${r.duracion} s`, 'ok');
      return r.duracion;
    } catch (err) { aviso(err.message, 'mal'); return null; }
  },

  pintarPuntos() {
    this.listaPuntos.replaceChildren(...this.puntos.map((q, i) =>
      el('div', { class: 'punto-guardado' },
        el('span', { class: 'n' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'crece' }, q.slice(0, 5).map((v) => grados(v).toFixed(0) + '°').join('  ')),
        el('button', { class: 'boton pequeno', title: 'Llevar el robot virtual a este punto', html: 'Ir', onclick: () => this.app.fijarManual(q) }),
        el('button', { class: 'boton pequeno silencioso', title: 'Borrar este punto', html: 'Borrar', onclick: () => { this.puntos.splice(i, 1); this.pintarPuntos(); } }))));
  },

  async reproducir() {
    if (!this.puntos.length) { aviso('Guarde al menos un punto.'); return; }
    for (const q of this.puntos) {
      this.app.fijarManual(q);
      const d = await this.ejecutar(q);
      if (d == null) return;
      await new Promise((ok) => setTimeout(ok, (d + 0.6) * 1000));
    }
    aviso('Secuencia terminada.', 'ok');
  },
};
export default seccion;
