// Utilidades de interfaz: creación de elementos, avisos y ventanas de confirmación.
export function el(etiqueta, attrs = {}, ...hijos) {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null) e.append(h instanceof Node ? h : document.createTextNode(h));
  return e;
}

export function aviso(texto, tipo = '') {
  const a = el('div', { class: `aviso-flotante ${tipo}` }, texto);
  document.getElementById('avisos').append(a);
  setTimeout(() => a.remove(), tipo === 'mal' ? 9000 : 4500);
}

export function confirmar(titulo, texto, { aceptar = 'Continuar', peligro = false } = {}) {
  return new Promise((resolver) => {
    const modal = document.getElementById('modal');
    const caja = document.getElementById('modal-caja');
    const cerrar = (v) => { modal.classList.add('oculto'); resolver(v); };
    caja.replaceChildren(
      el('h3', {}, titulo), el('p', { html: texto }),
      el('div', { class: 'fila' },
        el('button', { class: 'boton', onclick: () => cerrar(false) }, 'Cancelar'),
        el('button', { class: `boton ${peligro ? 'peligro' : 'primario'}`, onclick: () => cerrar(true) }, aceptar)));
    modal.classList.remove('oculto');
  });
}

export function preguntar(titulo, texto, valor = '') {
  return new Promise((resolver) => {
    const modal = document.getElementById('modal');
    const caja = document.getElementById('modal-caja');
    const entrada = el('input', { class: 'campo', value: valor });
    const cerrar = (v) => { modal.classList.add('oculto'); resolver(v); };
    entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') cerrar(entrada.value.trim() || null); if (e.key === 'Escape') cerrar(null); });
    caja.replaceChildren(
      el('h3', {}, titulo), el('p', { html: texto }), entrada,
      el('div', { class: 'fila', style: 'margin-top:20px' },
        el('button', { class: 'boton', onclick: () => cerrar(null) }, 'Cancelar'),
        el('button', { class: 'boton primario', onclick: () => cerrar(entrada.value.trim() || null) }, 'Aceptar')));
    modal.classList.remove('oculto');
    entrada.focus();
    entrada.select();
  });
}

export function linea(texto) {
  // Colorea la salida de la consola según su contenido.
  let clase = '';
  if (/^→|^\$/.test(texto)) clase = 'l-cmd';
  else if (/\bERROR\b|^FALLA|No se (pudo|encontr|alcanz)|Traceback|terminó con error/.test(texto)) clase = 'l-error';
  else if (/AVISO|WARN/i.test(texto)) clase = 'l-aviso';
  else if (/^OK|iniciada|Llegó|En (init|home)|listo|completa/i.test(texto)) clase = 'l-ok';
  return el('div', { class: clase }, texto);
}

export const grados = (r) => (r * 180 / Math.PI);
export const fmt = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
