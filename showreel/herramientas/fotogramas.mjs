// Saca fotogramas sueltos de la página de escenas para revisarlos sin grabar todo.
//   node showreel/herramientas/fotogramas.mjs <url> <carpeta> t1 t2 t3 …
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [url, carpeta, ...tiempos] = process.argv.slice(2);
fs.mkdirSync(carpeta, { recursive: true });
const navegador = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 } });
pagina.on('pageerror', (e) => console.error('[página]', e.message));
pagina.on('console', (m) => { if (m.type() === 'error') console.error('[página]', m.text()); });
await pagina.goto(url);
await pagina.waitForFunction(() => window.listo !== undefined, null, { timeout: 120000 });
await pagina.evaluate(() => window.listo);
for (const t of tiempos) {
  await pagina.evaluate((x) => window.cuadro(x), Number(t));
  await pagina.screenshot({ path: path.join(carpeta, `t${String(t).padStart(6, '0')}.png`) });
}
await navegador.close();
