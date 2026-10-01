// Graba SO-ARM100 Estudio (la aplicación real, sin ROS) cuadro por cuadro.
//
// El reloj de la página es virtual (RELOJ, más abajo): performance.now, Date.now,
// setTimeout y setInterval sólo avanzan 1/30 s entre captura y captura, así que
// el brazo 3D, los deslizadores y la ejecución de los programas se ven fluidos
// aunque el navegador sin GPU tarde mucho más en dibujar cada cuadro.
// requestAnimationFrame sigue siendo el del navegador (si se detuviera, el
// navegador no produciría cuadros para la captura) pero recibe el tiempo virtual.
// page.clock de Playwright no sirve aquí por eso mismo: congela los cuadros.
//
// Necesita la aplicación abierta sin ROS:
//   python3 app/servidor.py --sin-ros --puerto 8651
// Uso:
//   node showreel/herramientas/capturar_app.mjs [toma ...]
// Deja showreel/salida/app/<toma>/0001.jpg, 0002.jpg…
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.APP_URL || 'http://127.0.0.1:8651/';
const SALIDA = path.resolve('showreel/salida/app');
const FPS = 30;
const DT = 1000 / FPS;

const navegador = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const RELOJ = () => {
  const inicio = Date.now();
  const rafNativo = window.requestAnimationFrame.bind(window);
  const timeoutNativo = window.setTimeout.bind(window);
  let vt = 0;
  let sig = 1;
  const timers = new Map();
  performance.now = () => vt;
  Date.now = () => inicio + vt;
  window.requestAnimationFrame = (cb) => rafNativo(() => cb(vt));
  window.setTimeout = (fn, ms = 0, ...a) => { const id = sig++; timers.set(id, { due: vt + Math.max(0, Number(ms) || 0), fn, a }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = sig++; const p = Math.max(1, Number(ms) || 0); timers.set(id, { due: vt + p, fn, a, cada: p }); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.__avanzar = async (ms) => {
    const fin = vt + ms;
    for (let guarda = 0; guarda < 5000; guarda++) {
      let prox = null;
      for (const [id, t] of timers) if (t.due <= fin && (!prox || t.due < prox[1].due)) prox = [id, t];
      if (!prox) break;
      const [id, t] = prox;
      vt = Math.max(vt, t.due);
      if (t.cada) t.due += t.cada; else timers.delete(id);
      try { typeof t.fn === 'function' ? t.fn(...t.a) : null; } catch (e) { console.error(e); }
      await null; await null; await null;
    }
    vt = fin;
    await new Promise((ok) => timeoutNativo(ok, 0));
  };
  window.__cuadro = () => new Promise((ok) => rafNativo(() => rafNativo(ok)));
};

async function avanzar(pagina, ms) {
  for (let r = ms; r > 0; r -= 50) await pagina.evaluate((x) => window.__avanzar(x), Math.min(50, r));
}

async function abrir() {
  const pagina = await navegador.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: Number(process.env.DSF || 1) });
  pagina.on('pageerror', (e) => console.error('[app]', e.message));
  await pagina.addInitScript(RELOJ);
  await pagina.goto(URL);
  for (let i = 0; i < 300; i++) {
    await avanzar(pagina, 100);
    if (await pagina.evaluate(() => Boolean(window.estudio?.estado))) break;
  }
  await avanzar(pagina, 1500);
  // La escena 3D se dibuja una sola vez por cuadro capturado, no en cada cuadro
  // del navegador: sin GPU, cada dibujo cuesta cientos de milisegundos.
  await pagina.evaluate(() => { const e = window.estudio.escena; e.renderer.setAnimationLoop(null); if (!window.__sombras) { e.renderer.shadowMap.enabled = false; } });
  return pagina;
}

async function pestana(pagina, nombre) {
  await pagina.locator('header button, nav button, header a, nav a', { hasText: nombre }).first().click();
  await avanzar(pagina, 600);
}

// Graba `segundos` de la página; `accion(n)` corre antes del cuadro n.
async function grabar(pagina, toma, segundos, accion) {
  const dir = path.join(SALIDA, toma);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(segundos * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (accion) await accion(i);
    await pagina.evaluate((x) => window.__avanzar(x), DT);
    await pagina.evaluate(() => { window.estudio.escena._cuadro(); return window.__cuadro(); });
    await pagina.screenshot({ path: path.join(dir, `${String(i + 1).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 30 === 0) process.stderr.write(`\r${toma}: ${i}/${n} · ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/cuadro   `);
  }
  process.stderr.write(`\r${toma}: ${n} cuadros en ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}

// Mueve un deslizador de la sección Mover poco a poco (como si lo arrastrara alguien).
async function deslizar(pagina, indice, valor) {
  await pagina.evaluate(([i, v]) => {
    const r = [...document.querySelectorAll('input[type=range]')].filter((x) => x.offsetParent)[i];
    if (!r) return;
    r.value = v;
    r.dispatchEvent(new Event('input', { bubbles: true }));
  }, [indice, valor]);
}

const TOMAS = {
  // Sesión: la pantalla de inicio, con el brazo 3D y las opciones de la sesión.
  async sesion() {
    const p = await abrir();
    await pestana(p, 'Sesión');
    await grabar(p, 'sesion', Number(process.env.SEG || 5));
    await p.close();
  },

  // Mover: los deslizadores mueven el brazo virtual.
  async mover() {
    const p = await abrir();
    await pestana(p, 'Mover');
    const rangos = await p.evaluate(() => [...document.querySelectorAll('input[type=range]')].filter((x) => x.offsetParent)
      .map((x) => [Number(x.min), Number(x.max), Number(x.value)]));
    const guion = [[0, 0.55], [1, -0.35], [2, 0.6], [3, -0.5], [4, 1.2]];
    await grabar(p, 'mover', 8, async (n) => {
      const t = n / FPS;
      for (const [k, objetivo] of guion) {
        const ini = 0.6 + k * 1.3;
        const s = Math.min(1, Math.max(0, (t - ini) / 1.4));
        if (s > 0 && s <= 1 && rangos[k]) {
          const e = s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2;
          const [lo, hi, v0] = rangos[k];
          const fin = lo + (hi - lo) * (objetivo + 1) / 2;
          await deslizar(p, k, v0 + (fin - v0) * e);
        }
      }
    });
    await p.close();
  },

  // Aprender: el plan de 18 lecciones y la lección de grados de libertad.
  async aprender() {
    const p = await abrir();
    await pestana(p, 'Aprender');
    await grabar(p, 'aprender', 4);
    await p.close();
  },

  // Lección 1, paso 2: el codo se mueve solo, con su eje y su arco dibujados.
  async leccion_gdl() {
    const p = await abrir();
    await pestana(p, 'Aprender');
    await p.locator('button.modulo', { hasText: '¿Qué es un robot?' }).click();
    await avanzar(p, 400);
    await p.locator('button', { hasText: 'Siguiente' }).first().click();
    await avanzar(p, 300);
    await grabar(p, 'leccion_gdl', 6);
    await p.close();
  },

  // Lección 14: visión y teleoperación, el tema de este proyecto.
  async leccion_vision() {
    const p = await abrir();
    await pestana(p, 'Aprender');
    await p.locator('button.modulo', { hasText: 'Visión y teleoperación' }).click();
    await avanzar(p, 400);
    await grabar(p, 'leccion_vision', 5);
    await p.close();
  },

  // Taller RAPID: un ejercicio con su editor y sus comprobaciones.
  async taller() {
    const p = await abrir();
    await pestana(p, 'Aprender');
    await p.locator('button.modulo', { hasText: 'Taller 2' }).click();
    await avanzar(p, 600);
    await grabar(p, 'taller', 4);
    await p.close();
  },

  // Programar: «Tomar y colocar un cubo» ejecutándose en la celda virtual.
  async programar() {
    const p = await abrir();
    await pestana(p, 'Programar');
    await p.evaluate(async () => {
      const s = (await import('/js/secciones/programar.js')).default;
      const { EJEMPLOS } = await import('/js/programa/ejemplos.js');
      s.celda.reiniciar();
      s.fijarDestino('virtual');
      s.override = 1;
      s.fijarTexto(EJEMPLOS.find((e) => e.id === 'tomar').texto);
    });
    await avanzar(p, 800);
    await grabar(p, 'programar', 22, async (n) => {
      if (n === 15) {
        await p.evaluate(async () => {
          const s = (await import('/js/secciones/programar.js')).default;
          s.ejecutar(false);
        });
      }
    });
    await p.close();
  },

  // Programar: apilar tres cubos (bucles y procedimientos).
  async apilar() {
    const p = await abrir();
    await pestana(p, 'Programar');
    await p.evaluate(async () => {
      const s = (await import('/js/secciones/programar.js')).default;
      const { EJEMPLOS } = await import('/js/programa/ejemplos.js');
      s.celda.reiniciar();
      s.fijarDestino('virtual');
      s.override = 1;
      s.fijarTexto(EJEMPLOS.find((e) => e.id === 'apilar').texto);
    });
    await avanzar(p, 800);
    await grabar(p, 'apilar', 30, async (n) => {
      if (n === 5) {
        await p.evaluate(async () => {
          const s = (await import('/js/secciones/programar.js')).default;
          s.ejecutar(false);
        });
      }
    });
    await p.close();
  },

  // Ensayos: la sección que ejecuta A1 a A5 con un botón.
  async ensayos() {
    const p = await abrir();
    await pestana(p, 'Ensayos');
    await grabar(p, 'ensayos', 3);
    await p.close();
  },
};

const pedidas = process.argv.slice(2);
for (const nombre of pedidas.length ? pedidas : Object.keys(TOMAS)) {
  if (!TOMAS[nombre]) { console.error(`Toma desconocida: ${nombre}`); continue; }
  await TOMAS[nombre]();
}
await navegador.close();
