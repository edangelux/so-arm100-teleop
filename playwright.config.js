// Pruebas de extremo a extremo de SO-ARM100 Estudio: la aplicación real, sin ROS,
// en Chromium con una cámara falsa. npm run e2e
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PUERTO = 8651;
const ESTADO = path.join(os.tmpdir(), 'soarm-e2e');
fs.rmSync(ESTADO, { recursive: true, force: true });   // cada corrida empieza con una configuración limpia
fs.mkdirSync(ESTADO, { recursive: true });

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 0.5,
    permissions: ['camera'],
    // PW_CHROMIUM: usar un Chromium ya instalado en vez del que descarga «npx playwright install».
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, deviceScaleFactor: 0.5 } }],
  webServer: {
    command: `${process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3')} app/servidor.py --sin-ros --puerto ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/api/estado`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { WSL_DISTRO_NAME: 'Ubuntu-22.04', XDG_STATE_HOME: ESTADO, HOME: ESTADO },
  },
});
