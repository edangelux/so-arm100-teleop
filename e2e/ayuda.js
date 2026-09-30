// Utilidades compartidas por las pruebas e2e.
export async function abrir(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.estudio?.estado, null, { timeout: 30_000 });
  return errores;
}

export async function pestana(page, nombre) {
  await page.locator('header button, nav button, header a, nav a', { hasText: nombre }).first().click();
  await page.waitForTimeout(400);
}
