// SO-ARM100 · el video del proyecto. 11 escenas de 8 compases a 120 BPM = 176 s.
// window.cuadro(t) dibuja el instante t; herramientas/capturar.mjs lo graba.
import { Plato } from './plato3d.js';
import { ESCENA, prog, clamp, golpe, esperarImagenes, el } from './motor.js';
import { intro, problema, solucion, robot, funciona, matematica } from './escenas_1.js';
import { resultados, estudio1, estudio2, repositorio, cierre } from './escenas_2.js';

const ESCENAS = [intro, problema, solucion, robot, funciona, matematica, resultados, estudio1, estudio2, repositorio, cierre];
// Secciones de la música (musica.py) con bombo: ahí late el acento de luz.
const CON_BOMBO = (t) => (t >= 16 && t < 80) || (t >= 96 && t < 168);

const capa = document.getElementById('capa');
const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d', { willReadFrequently: true });
const gl = document.getElementById('gl');
const grano = document.getElementById('grano');
const gctx = grano.getContext('2d');
const cortina = document.getElementById('cortina');
const destello = document.getElementById('destello');
const negro = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: '0' } });
document.body.append(negro);

let plato;
const nodos = [];

// Ruido de película: 8 texturas fijas que se alternan.
const texturasGrano = [];
function prepararGrano() {
  let semilla = 11;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  for (let k = 0; k < 8; k++) {
    const im = gctx.createImageData(960, 540);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = azar() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    texturasGrano.push(im);
  }
}

async function iniciar() {
  await document.fonts.load('900 100px Rubik');
  await document.fonts.load('500 20px Plex');
  await document.fonts.load('400 20px Plex');
  const [modelo, grafo] = await Promise.all([
    fetch('../recursos/modelo.json').then((r) => r.json()),
    fetch('../recursos/grafo.json').then((r) => r.json()),
  ]);
  plato = new Plato();
  await plato.iniciar(gl, modelo);
  for (const e of ESCENAS) {
    const n = el('div', { class: 'escena' });
    capa.append(n);
    nodos.push(n);
    e.montar(n, { grafo });
  }
  prepararGrano();
  await document.fonts.ready;
}

window.duracion = ESCENAS.length * ESCENA;
window.listo = iniciar();

window.cuadro = async (t) => {
  const i = clamp(Math.floor(t / ESCENA), 0, ESCENAS.length - 1);
  const tl = t - i * ESCENA;
  nodos.forEach((n, k) => { n.style.display = k === i ? 'block' : 'none'; });
  ctx.clearRect(0, 0, 1920, 1080);
  const r = ESCENAS[i].cuadro(tl, t, ctx) || {};

  // 3D
  if (r.gl) {
    gl.style.display = 'block';
    gl.style.opacity = r.opacidad3d ?? 1;
    plato.renderer.toneMappingExposure = r.exposicion ?? 1;
    const acento = CON_BOMBO(t) ? golpe(t, 0.15) : 0;
    plato.borde1.intensity = 4.0 * (r.gl.borde ?? 1) + 2.5 * acento;
    plato.borde2.intensity = 1.8 + 1.2 * acento;
    const [junta, intensidad] = r.resaltar || [null, 0];
    plato.robot.poner(r.gl.q);
    plato.resaltar(junta, intensidad);
    plato.dibujar(r.gl);
    r.despues?.(plato);
  } else {
    gl.style.display = 'none';
    r.despues?.(plato);
  }

  // Transición entre escenas: una cortina de luz cruza en el corte, sobre el tiempo fuerte.
  const corte = Math.round(t / ESCENA) * ESCENA;
  const d = t - corte;
  if (corte > 0 && corte < window.duracion && Math.abs(d) < 0.2) {
    const s = prog(d, -0.2, 0.2);
    cortina.style.transform = `translateX(${-120 + s * 600}%) skewX(-18deg)`;
    cortina.style.opacity = 0.8;
  } else cortina.style.opacity = 0;
  const flash = Math.max(corte > 0 && d >= 0 && d < 0.2 ? 1 - d / 0.2 : 0, r.destello || 0);
  destello.style.opacity = 0.3 * flash;
  negro.style.opacity = r.negro ?? (t < 0.15 ? 1 - t / 0.15 : 0);

  // El lienzo 2D sólo se muestra en las escenas que dibujan en él; leer un píxel
  // obliga al navegador a terminar el dibujo antes de la captura.
  lienzo.style.display = r.lienzo ? 'block' : 'none';
  ctx.getImageData(0, 0, 1, 1);

  // Grano
  gctx.putImageData(texturasGrano[Math.floor(t * 30) % 8], 0, 0);

  await esperarImagenes();
};

// Vista en un navegador normal: ?t=segundos para un instante, ?ver=1 para reproducir.
const p = new URLSearchParams(location.search);
if (p.has('t') || p.has('ver')) {
  window.listo.then(() => {
    if (p.has('t')) window.cuadro(Number(p.get('t')));
    else {
      const t0 = performance.now();
      const bucle = async () => { await window.cuadro(((performance.now() - t0) / 1000) % window.duracion); requestAnimationFrame(bucle); };
      bucle();
    }
  });
}
