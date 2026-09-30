import { test, expect } from '@playwright/test';
import { abrir } from './ayuda.js';

test('la cámara de Windows se abre en el navegador y llega a /camara/video', async ({ page, request }) => {
  const errores = await abrir(page);
  await page.getByRole('button', { name: 'Buscar cámaras' }).click();
  const camara = page.locator('.opcion', { hasText: 'fake' }).first();
  await expect(camara).toBeVisible({ timeout: 20_000 });
  await camara.click();
  await expect(page.locator('.mensaje', { hasText: 'lista.' })).toBeVisible({ timeout: 30_000 });
  const e = await (await request.get('/api/camaras')).json();
  expect(e.camwin.activa).toBe(true);
  const r = await request.get('/camara/foto');
  expect(r.headers()['content-type']).toBe('image/jpeg');
  expect(errores).toEqual([]);
});
