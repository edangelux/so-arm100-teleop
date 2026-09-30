import { test, expect } from '@playwright/test';
import { abrir, pestana } from './ayuda.js';

test('todas las pestañas abren sin errores de JavaScript', async ({ page }) => {
  const errores = await abrir(page);
  for (const p of ['Sesión', 'Mover', 'Programar', 'Aprender', 'Ensayos', 'Revisar', 'Ajustes']) await pestana(page, p);
  expect(errores).toEqual([]);
});

test('el servidor informa su estado', async ({ request }) => {
  const e = await (await request.get('/api/estado')).json();
  expect(e.entorno).toBe('wsl');
  expect(e.ros.disponible).toBe(false);
});
