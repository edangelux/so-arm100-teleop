// Ajustes: la misma configuración que usan los atajos de la terminal (~/.soarm.conf).
import { enviar } from '../api.js';
import { el, aviso } from '../ui.js';

const CAMPOS = [
  ['SOARM_PUERTO', 'Puerto del brazo', 'texto', 'Normalmente /dev/ttyACM0. Si no existe, se busca solo.'],
  ['SOARM_BUSID', 'BUSID de usbipd (WSL2)', 'texto', 'Vacío = detectarlo solo.'],
  ['SOARM_SOFTWARE_GL', 'OpenGL por software', [['auto', 'Automático (WSL2 y VM)'], ['1', 'Siempre'], ['0', 'Nunca']], 'Gazebo necesita renderizado por software en WSL2 y en máquinas virtuales.'],
  ['SOARM_VERSION', 'Versión por omisión', [['13', 'v13 (defensa)'], ['14', 'v14'], ['15', 'v15']], ''],
  ['SOARM_MOVEIT', 'Abrir MoveIt', [['1', 'Sí'], ['0', 'No']], ''],
  ['SOARM_VELOCIDAD', 'Tope de velocidad (rad/s)', 'texto', 'Vacío = 8 rad/s, el de la defensa.'],
];

const seccion = {
  id: 'ajustes', titulo: 'Ajustes', corto: 'Ajustes', icono: 'ajustes',
  montar(nodo, app) {
    this.app = app;
    this.nodo = nodo;
    app.on('estado', () => { if (!this.pintado) this.pintar(); });
  },
  pintar() {
    const conf = this.app.estado?.conf;
    if (!conf) return;
    this.pintado = true;
    const valores = {};
    const campos = CAMPOS.map(([k, t, tipo, ayuda]) => {
      const entrada = Array.isArray(tipo)
        ? el('select', { class: 'campo' }, ...tipo.map(([v, e]) => el('option', { value: v, selected: conf[k] === v }, e)))
        : el('input', { class: 'campo', value: conf[k] || '' });
      valores[k] = entrada;
      return el('div', { style: 'margin-bottom:12px' }, el('div', { class: 'etq' }, t), entrada, ayuda ? el('div', { class: 'nota', style: 'font-size:11.5px;margin-top:3px' }, ayuda) : null);
    });
    const e = this.app.estado;
    this.nodo.replaceChildren(
      el('h2', {}, 'Ajustes'),
      el('p', { class: 'sub' }, 'Se guardan en ~/.soarm.conf y los comparten la aplicación y la orden teleop de la terminal.'),
      el('div', { class: 'tarjeta' }, ...campos,
        el('button', { class: 'boton primario ancho', html: `Guardar`, onclick: async () => {
          try { await enviar('/api/conf', Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.value]))); aviso('Ajustes guardados.', 'ok'); this.app.refrescar(); } catch (err) { aviso(err.message, 'mal'); }
        } })),
      el('div', { class: 'tarjeta' }, el('h3', { html: `Este equipo` }),
        el('div', { class: 'nota' }, `Entorno: ${e.entorno} · OpenGL por software: ${e.software_gl ? 'sí' : 'no'}`),
        el('div', { class: 'nota' }, `ROS 2: ${e.ros.disponible ? 'conectado' : e.ros.motivo}`),
        el('div', { class: 'nota' }, `Grupo dialout: ${e.brazo.dialout ? 'sí' : 'no (hace falta para el brazo)'}`)),
    );
  },
};
export default seccion;
