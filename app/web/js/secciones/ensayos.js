// Ensayos de rendimiento (docs/17): ejecutarlos con un botón y ver sus resultados.
import { obtener, enviar } from '../api.js';
import { el, aviso, confirmar, linea } from '../ui.js';

const ENSAYOS = [
  { id: 'a1', ic: 'precision', t: 'A1 · Precisión estática', d: 'Cuánto se queda corta cada articulación al sostener una postura, y si depende de la gravedad.', req: 'menu', dur: '≈ 8 min' },
  { id: 'a5', ic: 'escalon', t: 'A5 · Respuesta al escalón', d: 'Retardo, subida, establecimiento y sobrepaso de cada servo ante un salto de 0,3 rad.', req: 'menu', dur: '≈ 4 min' },
  { id: 'a2', ic: 'repetir', t: 'A2 · Repetibilidad', d: 'Vuelve 30 veces a la postura actual; con un lápiz en la pinza deja una nube de puntos en el papel.', req: 'menu', dur: '≈ 12 min' },
  { id: 'a3', ic: 'pesa', t: 'A3 · Carga útil', d: 'Error y esfuerzo del servo en tres posturas; se repite sin carga, con 50 g y con 80 g.', req: 'menu', dur: '≈ 1 min cada una', etiqueta: true },
  { id: 'a4', ic: 'temperatura', t: 'A4 · Temperatura', d: 'Vaivén continuo del hombro, codo y muñeca registrando la temperatura de los seis servos.', req: 'detenida', dur: '30 min', minutos: true },
];

function markdown(md) {
  // Conversor mínimo para el resumen.md de analizar.py: títulos, tablas, negritas e imágenes.
  const out = [];
  const lineas = md.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^#{1,3} /.test(l)) out.push(`<h3>${l.replace(/^#+ /, '')}</h3>`);
    else if (/^\|/.test(l)) {
      const filas = [];
      while (i < lineas.length && /^\|/.test(lineas[i])) { if (!/^\|[-| ]+\|$/.test(lineas[i])) filas.push(lineas[i]); i++; }
      i--;
      out.push('<table>' + filas.map((f, k) => '<tr>' + f.split('|').slice(1, -1).map((c) => (k ? `<td>${c.trim()}</td>` : `<th>${c.trim()}</th>`)).join('') + '</tr>').join('') + '</table>');
    } else if (/^!\[/.test(l)) out.push(l.replace(/!\[(.*?)\]\((.*?)\)/, '<img alt="$1" src="$2">'));
    else if (l.trim()) out.push(`<p>${l}</p>`);
  }
  return out.join('').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
}

const seccion = {
  id: 'ensayos', titulo: 'Ensayos de rendimiento', corto: 'Ensayos', icono: 'ensayos',

  montar(nodo, app) {
    this.app = app;
    this.consola = el('div', { class: 'consola' });
    this.aviso = el('div');
    this.lista = el('div');
    this.resultados = el('div');
    nodo.append(
      el('h2', {}, 'Ensayos de rendimiento'),
      el('p', { class: 'sub' }, 'Las cifras del informe salieron del cálculo. Aquí se miden. El procedimiento completo está en docs/17.'),
      this.aviso, this.lista,
      el('div', { class: 'tarjeta' }, el('h3', { html: `Salida` }), this.consola,
        el('button', { class: 'boton ancho', style: 'margin-top:8px', html: `Detener el ensayo`, onclick: () => enviar('/api/tarea/detener').catch((e) => aviso(e.message, 'mal')) })),
      el('div', { class: 'tarjeta' }, el('h3', { html: `Resultados` }), this.resultados),
    );
    app.on('log', (d) => { if (d.fuente === 'tarea') { this.consola.append(linea(d.linea)); this.consola.scrollTop = this.consola.scrollHeight; } });
    app.on('estado', () => this.pintar());
  },

  alMostrar() { this.pintar(); this.cargarResultados(); },

  pintar() {
    const s = this.app.estado?.sesion?.estado || 'detenida';
    this.aviso.replaceChildren(el('div', { class: 'mensaje aviso', style: 'margin:0 0 12px' },
      s === 'menu' ? 'Sesión abierta y teleoperación cerrada: se pueden ejecutar A1, A2, A3 y A5.'
        : s === 'detenida' ? 'Sin sesión: sólo el ensayo térmico (A4). Para los demás, inicie una sesión y cierre la teleoperación.'
          : 'Cierre la teleoperación (Q) para ejecutar ensayos.'));
    this.lista.replaceChildren(...ENSAYOS.map((e) => {
      const disponible = s === e.req;
      const extra = [];
      let etiqueta = null, minutos = null;
      if (e.etiqueta) { etiqueta = el('select', { class: 'campo', style: 'width:auto' }, ...['sin_carga', '50g', '80g'].map((v) => el('option', { value: v }, v))); extra.push(etiqueta); }
      if (e.minutos) { minutos = el('select', { class: 'campo', style: 'width:auto' }, ...['15', '30', '60', '90'].map((v) => el('option', { value: v, selected: v === '30' }, `${v} min`))); extra.push(minutos); }
      return el('div', { class: 'tarjeta', style: `opacity:${disponible ? 1 : 0.55}` },
        el('div', { class: 'fila', style: 'align-items:flex-start' },
                    el('div', { class: 'crece' }, el('strong', {}, e.t), el('div', { class: 'nota' }, e.d), el('div', { class: 'etq', style: 'margin-top:4px' }, `Duración ${e.dur}`))),
        el('div', { class: 'fila', style: 'margin-top:10px' }, ...extra, el('span', { class: 'crece' }),
          el('button', { class: 'boton primario', disabled: !disponible, html: `Ejecutar`, onclick: () => this.ejecutar(e, etiqueta?.value, minutos?.value) })));
    }));
  },

  async ejecutar(e, etiqueta, minutos) {
    const texto = e.id === 'a4'
      ? 'El brazo irá a init y se moverá en vaivén durante el tiempo elegido. Se detiene solo si un servo llega a 55 °C.'
      : 'El brazo se moverá solo. Pinza vacía (salvo en A3 con masa), espacio libre y la mano en el interruptor de la fuente.';
    if (!await confirmar(e.t, texto, { aceptar: 'Ejecutar' })) return;
    this.consola.replaceChildren();
    try { await enviar('/api/tarea', { nombre: e.id, etiqueta, minutos }); } catch (err) { aviso(err.message, 'mal'); }
  },

  async cargarResultados() {
    let lista = [];
    try { lista = await obtener('/api/resultados'); } catch { /* sin servidor */ }
    if (!lista.length) { this.resultados.replaceChildren(el('p', { class: 'nota' }, 'Todavía no hay resultados. Aparecen aquí al terminar cada ensayo.')); return; }
    const vista = el('div', { class: 'resumen-md' });
    const elegir = el('select', { class: 'campo', onchange: () => mostrar(elegir.value) }, ...lista.map((r) => el('option', { value: r.fecha }, `${r.fecha} · ${r.archivos.filter((a) => a.endsWith('.csv')).length} archivos`)));
    const mostrar = async (fecha) => {
      const r = lista.find((x) => x.fecha === fecha);
      if (!r.resumen) { vista.replaceChildren(el('p', { class: 'nota' }, 'Sin analizar todavía.')); return; }
      const md = await (await fetch(`/resultados/${fecha}/resumen.md`, { cache: 'no-store' })).text();
      vista.innerHTML = markdown(md.replace(/\]\((?!http)([^)]+\.png)\)/g, `](/resultados/${fecha}/$1)`));
    };
    this.resultados.replaceChildren(
      el('div', { class: 'fila' }, elegir,
        el('button', { class: 'boton', html: `Analizar`, onclick: () => enviar('/api/tarea', { nombre: 'analizar', fecha: elegir.value }).then(() => setTimeout(() => this.cargarResultados(), 4000)).catch((err) => aviso(err.message, 'mal')) })),
      vista);
    mostrar(lista[0].fecha);
  },
};
export default seccion;
