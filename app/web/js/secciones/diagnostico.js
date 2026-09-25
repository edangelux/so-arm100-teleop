// Diagnóstico: revisa la instalación completa y muestra cada comprobación con su corrección.
import { enviar } from '../api.js';
import { el, aviso } from '../ui.js';

const seccion = {
  id: 'diagnostico', titulo: 'Diagnóstico', corto: 'Revisar', icono: 'diagnostico',

  montar(nodo, app) {
    this.app = app;
    this.tabla = el('div');
    this.resumen = el('div');
    this.lineas = [];
    nodo.append(
      el('h2', {}, 'Diagnóstico'),
      el('p', { class: 'sub' }, 'Revisa el sistema, ROS, Gazebo, Python, la pantalla, las cámaras, el brazo y los atajos. No mueve nada ni instala nada.'),
      el('button', { class: 'boton primario ancho grande', html: `Revisar la instalación`, onclick: () => this.ejecutar() }),
      this.resumen, el('div', { class: 'tarjeta', style: 'margin-top:12px' }, this.tabla),
    );
    app.on('log', (d) => { if (d.fuente === 'tarea' && d.nombre === 'Diagnóstico') { this.lineas.push(d.linea); this.pintar(); } });
  },

  async ejecutar() {
    this.lineas = [];
    this.pintar();
    try { await enviar('/api/tarea', { nombre: 'diagnostico' }); } catch (e) { aviso(e.message, 'mal'); }
  },

  pintar() {
    const filas = [];
    for (const l of this.lineas) {
      if (l.startsWith('── ')) { filas.push(el('tr', {}, el('td', { colspan: 3, class: 'seccion-diag' }, l.slice(3)))); continue; }
      const m = l.match(/^(OK|AVISO|FALLA)\s+(.+?)(?:\s{2,}(.*))?$/);
      if (m) filas.push(el('tr', {}, el('td', { class: `e ${m[1]}` }, m[1]), el('td', {}, m[2].trim()), el('td', { class: 'd' }, m[3] || '')));
      const r = l.match(/^Resumen: (\d+) OK, (\d+) AVISO, (\d+) FALLA/);
      if (r) this.resumen.replaceChildren(el('div', { class: `mensaje ${+r[3] ? 'mal' : +r[2] ? 'aviso' : 'ok'}` },
        +r[3] ? `${r[3]} fallas impiden operar: corríjalas con la indicación de cada línea.` : `Listo para operar (${r[1]} OK, ${r[2]} avisos).`));
    }
    this.tabla.replaceChildren(filas.length ? el('table', { class: 'tabla' }, ...filas) : el('p', { class: 'nota' }, 'Pulse «Revisar la instalación».'));
  },
};
export default seccion;
