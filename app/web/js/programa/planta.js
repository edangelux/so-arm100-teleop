// Vista en planta de la celda de trabajo (desde arriba), en SVG.
// Marco de la base del robot, en mm: x hacia la derecha, y hacia atrás del
// brazo (el brazo trabaja en y negativa, hacia abajo en el dibujo), z hacia arriba.
import { DISPOSICION } from './celda.js';

const COLOR = { cubo1: '#fd44b0', cubo2: '#c2ef4e', cubo3: '#ffb287' };
export const NOMBRE_COLOR = { cubo1: 'fucsia', cubo2: 'lima', cubo3: 'durazno' };
const NS = 'http://www.w3.org/2000/svg';

// Ventana del dibujo en mm: x de −180 a 250, y de +60 a −340.
const X0 = -180, X1 = 250, Y0 = 60, Y1 = -340;
const sx = (x) => x - X0;
const sy = (y) => Y0 - y;

function nodo(tag, attrs = {}, texto) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texto != null) e.textContent = texto;
  return e;
}

// piezas: [{nombre, x, y, z?, sujeta?}] en mm. opciones.cotas: escribe coordenadas.
export function planta(piezas, { cotas = true, titulo = 'Planta de la celda' } = {}) {
  const svg = nodo('svg', { viewBox: `0 0 ${X1 - X0} ${Y0 - Y1}`, class: 'planta', role: 'img', 'aria-label': titulo });
  const g = (attrs) => svg.appendChild(nodo('g', attrs));
  // Rejilla cada 50 mm.
  const rej = g({ class: 'planta-rejilla' });
  for (let x = -150; x <= 250; x += 50) rej.appendChild(nodo('line', { x1: sx(x), y1: 0, x2: sx(x), y2: Y0 - Y1 }));
  for (let y = 50; y >= -340; y -= 50) rej.appendChild(nodo('line', { x1: 0, y1: sy(y), x2: X1 - X0, y2: sy(y) }));

  // Base del robot y ejes.
  const base = g({ class: 'planta-base' });
  base.appendChild(nodo('circle', { cx: sx(0), cy: sy(0), r: 38 }));
  base.appendChild(nodo('text', { x: sx(0), y: sy(0) + 4, 'text-anchor': 'middle' }, 'base'));
  const ejes = g({ class: 'planta-ejes' });
  ejes.appendChild(nodo('line', { x1: sx(0), y1: sy(0), x2: sx(80), y2: sy(0), 'marker-end': 'url(#flecha)' }));
  ejes.appendChild(nodo('line', { x1: sx(0), y1: sy(0), x2: sx(0), y2: sy(-80), 'marker-end': 'url(#flecha)' }));
  ejes.appendChild(nodo('text', { x: sx(86), y: sy(0) + 4 }, '+x'));
  ejes.appendChild(nodo('text', { x: sx(4), y: sy(-92) }, '−y (frente del brazo)'));
  const defs = nodo('defs');
  const m = nodo('marker', { id: 'flecha', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  m.appendChild(nodo('path', { d: 'M0,0 L10,5 L0,10 z', class: 'planta-flecha' }));
  defs.appendChild(m);
  svg.prepend(defs);

  // Bandeja.
  const b = DISPOSICION.bandeja;
  const gb = g({ class: 'planta-bandeja' });
  gb.appendChild(nodo('rect', { x: sx(b.x - b.ancho / 2), y: sy(b.y + b.largo / 2), width: b.ancho, height: b.largo, rx: 4 }));
  gb.appendChild(nodo('text', { x: sx(b.x), y: sy(b.y + b.largo / 2) - 6, 'text-anchor': 'middle' }, cotas ? `bandeja · centro [${b.x}, ${b.y}]` : 'bandeja'));

  // Sensor de presencia di1.
  const e = DISPOSICION.entrada;
  const gs = g({ class: 'planta-sensor' });
  gs.appendChild(nodo('circle', { cx: sx(e.x), cy: sy(e.y), r: e.radio }));
  gs.appendChild(nodo('text', { x: sx(e.x) - e.radio - 4, y: sy(e.y) + 4, 'text-anchor': 'end' }, 'di1'));

  // Torre de luces.
  const gt = g({ class: 'planta-torre' });
  gt.appendChild(nodo('circle', { cx: sx(200), cy: sy(-300), r: 9 }));
  gt.appendChild(nodo('text', { x: sx(200), y: sy(-300) + 24, 'text-anchor': 'middle' }, 'luces do1–do3'));

  // Piezas (las apiladas se dibujan de abajo arriba y se desplazan un poco para verse).
  const orden = [...piezas].sort((p, q) => (p.z ?? 0) - (q.z ?? 0));
  const gp = g({ class: 'planta-piezas' });
  for (const p of orden) {
    const nivel = Math.max(0, Math.round(((p.z ?? 12.5) - 12.5) / 25));
    const dx = nivel * 5, dy = -nivel * 5;
    const r = nodo('rect', { x: sx(p.x) - 12.5 + dx, y: sy(p.y) - 12.5 + dy, width: 25, height: 25, rx: 2,
      fill: COLOR[p.nombre] || '#fff', class: p.sujeta ? 'sujeta' : '' });
    gp.appendChild(r);
    if (cotas) {
      const t = nodo('text', { x: sx(p.x) + 18 + dx, y: sy(p.y) + 4 + dy }, `${p.nombre}${p.sujeta ? ' (en la pinza)' : ''} [${Math.round(p.x)}, ${Math.round(p.y)}${nivel ? `, piso ${nivel + 1}` : ''}]`);
      gp.appendChild(t);
    }
  }
  return svg;
}
