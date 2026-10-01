// Graba una página de escenas cuadro por cuadro y la codifica con ffmpeg.
//
// La página debe exponer:
//   window.listo            → promesa que se resuelve cuando cargó todo
//   window.duracion         → segundos totales
//   window.cuadro(t)        → dibuja el instante t (determinista, sin relojes)
//
// Uso (desde la raíz del repositorio, con un servidor estático en el puerto 8765):
//   node showreel/herramientas/capturar.mjs <url> <salida.mp4> [--desde s] [--hasta s]
//        [--fps 30] [--ancho 1920] [--alto 1080] [--escala 1]
//
// Cada cuadro se toma como JPEG de calidad 95 y se pasa a ffmpeg por una tubería; si se corta,
// se puede retomar con --desde y unir los trozos después.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const url = args[0];
const salida = args[1];
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
const fps = opcion('fps', 30);
const ancho = opcion('ancho', 1920);
const alto = opcion('alto', 1080);
const escala = opcion('escala', 1);

const navegador = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala });
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[página]', m.text()); });
pagina.on('pageerror', (e) => console.error('[página]', e.message));
await pagina.goto(url);
await pagina.waitForFunction(() => window.listo !== undefined, null, { timeout: 120000 });
await pagina.evaluate(() => window.listo);
const total = await pagina.evaluate(() => window.duracion);
const desde = opcion('desde', 0);
const hasta = Math.min(opcion('hasta', total), total);
const n0 = Math.round(desde * fps);
const n1 = Math.round(hasta * fps);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', salida],
{ stdio: ['pipe', 'inherit', 'inherit'] });

const inicio = Date.now();
for (let n = n0; n < n1; n++) {
  await pagina.evaluate((t) => window.cuadro(t), n / fps);
  const png = await pagina.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(png)) await new Promise((ok) => ff.stdin.once('drain', ok));
  if ((n - n0) % 30 === 0) {
    const hechos = n - n0 + 1;
    const ritmo = (Date.now() - inicio) / hechos;
    process.stderr.write(`\r${(n / fps).toFixed(1)} s · ${hechos}/${n1 - n0} cuadros · ${ritmo.toFixed(0)} ms/cuadro · faltan ${((n1 - n - 1) * ritmo / 60000).toFixed(1)} min   `);
  }
}
ff.stdin.end();
await new Promise((ok) => ff.on('close', ok));
await navegador.close();
process.stderr.write(`\nListo: ${salida} (${((Date.now() - inicio) / 60000).toFixed(1)} min)\n`);
