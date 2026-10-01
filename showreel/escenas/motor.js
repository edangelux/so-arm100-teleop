// Herramientas de animación: todo depende sólo del tiempo t que se pide, nunca
// de un reloj, así cada cuadro sale igual cada vez que se graba.

export const BPM = 120;
export const TIEMPO = 60 / BPM;      // 0,5 s
export const COMPAS = 4 * TIEMPO;    // 2 s
export const ESCENA = 8 * COMPAS;    // 16 s

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, s) => a + (b - a) * s;
export const suave = (s) => s * s * (3 - 2 * s);
export const salida3 = (s) => 1 - (1 - s) ** 3;
export const salidaExpo = (s) => (s >= 1 ? 1 : 1 - 2 ** (-10 * s));
export const entradaSalida = (s) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);
export const rebote = (s) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (s - 1) ** 3 + c1 * (s - 1) ** 2; };

// Visibilidad con entrada y salida: 0 → 1 entre a y b, 1 → 0 entre c y d.
export const ventana = (t, a, b, c, d) => Math.min(prog(t, a, b), 1 - prog(t, c, d));

// Golpe del bombo: 1 justo en el tiempo y cae enseguida.
export const golpe = (t, caida = 0.12) => Math.exp(-((((t % TIEMPO) + TIEMPO) % TIEMPO) / caida));

// Número con coma decimal y espacio de miles, como en los documentos del proyecto.
export function numero(x, decimales = 0) {
  const [ent, dec] = Math.abs(x).toFixed(decimales).split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (x < 0 ? '−' : '') + miles + (dec ? ',' + dec : '');
}

// ------------------------------------------------------------------ DOM
export function el(etiqueta, atributos = {}, ...hijos) {
  const n = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') Object.assign(n.style, v);
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v);
  }
  for (const h of hijos) n.append(h);
  return n;
}

// Parte un texto en palabras enmascaradas para hacerlas subir una por una.
// Admite <b>…</b> como única marca, que pinta la palabra en lima.
export function palabras(html, clase = '') {
  const contenedor = el('div', { class: clase });
  const partes = html.split(/(<br>)/);
  for (const parte of partes) {
    if (parte === '<br>') { contenedor.append(el('br')); continue; }
    const fichas = parte.match(/<[a-z]+>.*?<\/[a-z]+>|\S+/g) || [];
    fichas.forEach((f, i) => {
      const m = f.match(/^<([a-z]+)>(.*)<\/\1>$/);
      const interior = el('span', { html: m ? `<span class="${{ b: 'lima', i: 'rosa', u: 'violeta', s: 'durazno' }[m[1]] || ''}">${m[2]}</span>` : f });
      contenedor.append(el('span', { class: 'pal' }, interior));
      if (i < fichas.length - 1) contenedor.append(document.createTextNode(' '));
    });
  }
  contenedor._pals = [...contenedor.querySelectorAll('.pal > span')];
  return contenedor;
}

// Anima la entrada (y la salida) de las palabras creadas con palabras().
export function animarPalabras(nodo, t, t0, { dur = 0.55, paso = 0.06, salida = null, desde = 105 } = {}) {
  const ps = nodo._pals || [];
  ps.forEach((p, i) => {
    const s = salidaExpo(prog(t, t0 + i * paso, t0 + i * paso + dur));
    let y = (1 - s) * desde;
    let o = s > 0 ? 1 : 0;
    if (salida !== null) {
      const q = entradaSalida(prog(t, salida + i * paso * 0.5, salida + i * paso * 0.5 + 0.35));
      y -= q * 105;
      if (q >= 1) o = 0;
    }
    p.style.transform = `translateY(${y}%)`;
    p.style.opacity = o;
  });
}

export function opacidad(nodo, v) { nodo.style.opacity = v; nodo.style.visibility = v <= 0.001 ? 'hidden' : 'visible'; }

export function mover(nodo, { x = 0, y = 0, s = 1, r = 0, o = null } = {}) {
  nodo.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
  if (o !== null) opacidad(nodo, o);
}

// Escribe un texto letra por letra (para terminales y rótulos técnicos).
export function teclear(nodo, texto, t, t0, porLetra = 0.035, cursor = true) {
  const n = clamp(Math.floor((t - t0) / porLetra), 0, texto.length);
  const parpadeo = cursor && (Math.floor(t * 2.5) % 2 === 0 || n < texto.length);
  nodo.textContent = texto.slice(0, n) + (parpadeo && t >= t0 ? '▌' : '');
}

// ------------------------------------------------------------------ imágenes
const pendientes = new Set();
export function esperarImagenes() {
  const ps = [...pendientes];
  pendientes.clear();
  return Promise.all(ps);
}

export function imagen(src, clase = '') {
  const im = el('img', { class: clase });
  im.src = src;
  pendientes.add(im.decode().catch(() => {}));
  return im;
}

// Secuencia de cuadros JPEG de un video (salida/clips o salida/app).
export class Secuencia {
  constructor(carpeta, total, clase = '') {
    this.carpeta = carpeta;
    this.total = total;
    this.img = el('img', { class: clase });
    this.actual = -1;
  }
  // segundos dentro del clip (a 30 cuadros por segundo)
  ir(segundos) {
    const n = clamp(Math.floor(segundos * 30) + 1, 1, this.total);
    if (n === this.actual) return;
    this.actual = n;
    this.img.src = `${this.carpeta}/${String(n).padStart(4, '0')}.jpg`;
    pendientes.add(this.img.decode().catch(() => {}));
  }
}
