# SO-ARM100 teleop — guía para Claude Code

Proyecto de fin de carrera (Mecatrónica, ULSA Nicaragua): brazo SO-ARM100 de 5 grados de libertad con
teleoperación por visión (MediaPipe), ROS 2 Humble, Gazebo, MoveIt y la aplicación **SO-ARM100 Estudio** (`app/`).
Todo se escribe en español.

## Reglas que no se discuten

- **Commits sólo a nombre del autor.** Nada de `Co-Authored-By: Claude`, `Generated with Claude Code` ni enlaces
  a claude.ai (lo apaga `.claude/settings.json`; no lo cambies).
- **No hagas commit ni push** salvo que el autor lo pida en ese momento: prepara los cambios y dale los comandos.
- **No toques el movimiento del brazo real** sin pedido explícito: `scripts/poses_seguras.json`, las velocidades y
  aceleraciones de `scripts/soarm.sh`, el controlador `so_arm_100_hardware`. Un cambio ahí ya dañó un servo.
- **No agregues al repositorio** `cad/`, `analisis/`, `docs/entregables/`, `__pycache__/` ni los CSV de
  `pruebas/resultados/` (sólo cambian finales de línea).
- **Verifica antes de decir que algo funciona**: corre las pruebas y muestra el resultado. Si no se puede probar
  (ROS, Gazebo, el brazo), dilo.

## Comandos

| Qué | Comando |
|---|---|
| Abrir la aplicación (WSL) | `soarm-app` · reiniciar el servidor: `soarm-app --parar && soarm-app` |
| Todo lo rápido (lint, código muerto, duplicados, pruebas JS) | `npm run calidad` |
| Pruebas de Python (servidor, puente de ROS, cámara) | `pytest` y `ruff check app pruebas/py` |
| Pruebas de extremo a extremo (Chromium, cámara falsa, retos y taller) | `npm run e2e` |
| Mutación del intérprete RAPID (lento) | `npm run mutacion` |

La primera vez: `npm ci`, `npx playwright install --with-deps chromium`, `pip install ruff pytest`.

## Dónde está cada cosa

- `app/servidor.py` y `app/estudio/`: servidor HTTP (sólo biblioteca estándar). `puente_ros.py` arranca
  `nodo_puente.py` en un proceso aparte con ROS cargado; `camwin.py` recibe la cámara de Windows.
- `app/web/js/`: la página (módulos ES sin compilar). `programa/`: lenguaje RAPID, intérprete, planificador,
  celda y retos. `lecciones/`: las 18 lecciones y el taller RAPID (`taller.js`, `taller_rapid.js`).
- `scripts/soarm.sh`: el lanzador de sesiones (Gazebo, brazo, MoveIt, teleoperación).
- Documentación: `docs/18-aplicacion-estudio.md` (la aplicación) y `docs/19-programar.md` (Programar).
  Los documentos son detallados, técnicos y con figuras; se entregan como `.md`.
- Pruebas: `pruebas/js/` (node:test), `pruebas/py/` (pytest), `e2e/` (Playwright).

## Cómo trabajar

1. Entender antes de cambiar: leer el código y los documentos del área.
2. Si es un error: reproducirlo con una prueba que falle, después arreglarlo.
3. Cambios pequeños, con `npm run calidad` y `pytest` en verde.
4. Si cambia el comportamiento visible, actualizar el documento y las capturas.
