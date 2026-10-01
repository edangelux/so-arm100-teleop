# Showreel: el video del proyecto

Esta carpeta produce el video de presentación de SO-ARM100: **2 min 56 s** en 1920×1080 a 30 cuadros por segundo, con música original. También produce un **teaser de 36 s** en horizontal y en vertical, y una miniatura.

Todo se genera con código, cuadro por cuadro, a partir del propio repositorio:

- el **brazo 3D** se arma con las mallas STL y el URDF de `entrega/` (los mismos que usan Gazebo, MoveIt y SO-ARM100 Estudio);
- **SO-ARM100 Estudio** se graba funcionando de verdad, sin ROS;
- el **grafo** sale de graphify;
- las **cifras** salen del README, de `pruebas/` y de `analisis/`;
- la **música** se sintetiza aquí mismo, así que no tiene derechos de terceros.

Lo único que viene de fuera son los videos y las fotos reales del brazo, que no se suben al repositorio.

## Guion

Son 11 escenas de 8 compases. A 120 BPM, cada escena dura 16 s y cada corte cae sobre el compás.

| # | Tiempo | Escena | Qué se ve |
|---|---|---|---|
| 1 | 0:00 | Gancho | El brazo 3D despierta en la oscuridad. «¿Y si un robot pudiera copiar tu brazo?» y el título |
| 2 | 0:16 | El problema | El laboratorio con una sola estación. 35 estudiantes y 450 min dan 12,86 min por estudiante |
| 3 | 0:32 | La solución | Estación abierta y replicable. El brazo real armado, las piezas impresas, el ensamble CAD y el costo de USD 336,66 |
| 4 | 0:48 | El robot | Qué es un manipulador. Las 5 articulaciones una por una, la pinza y el alcance de 431,70 mm |
| 5 | 1:04 | Cómo funciona | La tubería cámara → MediaPipe → ángulos → filtro → ROS 2 → servos, con la grabación real de Gazebo y la defensa |
| 6 | 1:20 | La matemática | Las fórmulas de `teleop_v13.py`: el marco del cuerpo, θ₁, θ₂, θ₃ y la muñeca. El filtro One Euro |
| 7 | 1:36 | Resultados | 34,05 FPS, 21,87 ms y 0,492°. El modelo cinemático verificado y los ensayos A1 a A5 del brazo real |
| 8 | 1:52 | SO-ARM100 Estudio | Sesión, Mover, Aprender y una lección, grabados de la aplicación |
| 9 | 2:08 | Programar | Tomar y colocar, apilar tres cubos, el taller RAPID y los ensayos |
| 10 | 2:24 | El repositorio | El grafo de conocimiento (2162 nodos) y la instalación en cuatro órdenes |
| 11 | 2:40 | Cierre | «Construir para entender. Medir para mejorar.», el equipo y el enlace |

## Archivos

| Archivo | Qué hace |
|---|---|
| `escenas/pelicula.html`, `pelicula.js` | La película. `window.cuadro(t)` dibuja el instante `t` |
| `escenas/escenas_1.js`, `escenas_2.js` | Las 11 escenas |
| `escenas/motor.js` | Curvas de animación, texto que sube palabra por palabra y secuencias de cuadros |
| `escenas/plato3d.js`, `robot.js` | El brazo en three.js con sus mallas reales, las luces y el piso |
| `herramientas/preparar_recursos.py` | Prepara el modelo del robot, las fotos de la presentación técnica y la disposición del grafo |
| `herramientas/preparar_clips.py` | Corta los videos reales de `originales/` en cuadros JPEG |
| `herramientas/capturar_app.mjs` | Graba SO-ARM100 Estudio con un reloj virtual, cuadro por cuadro |
| `herramientas/musica.py` | Compone y sintetiza la música, a 120 BPM |
| `herramientas/capturar.mjs` | Graba la película cuadro por cuadro y la codifica con ffmpeg |
| `herramientas/fotogramas.mjs` | Saca fotogramas sueltos para revisar una escena sin grabar todo |
| `herramientas/montar.py` | Une los tramos, pone la música y saca el teaser, la versión vertical y la miniatura |

Las carpetas `originales/`, `recursos/` y `salida/` no se suben al repositorio (están en `.gitignore`).

## Cómo se regenera

En Ubuntu (o WSL), desde la raíz del repositorio. Hace falta Node con las dependencias del proyecto (`npm ci`), Chromium de Playwright, ffmpeg, poppler-utils y, para Python, `numpy scipy soundfile networkx fonttools brotli pillow`.

**1. Poner los videos reales en `showreel/originales/`.** Llevan estos nombres:

| Nombre | Qué es |
|---|---|
| `teleop_gazebo_2026-09-02.mp4` | Grabación de pantalla con MediaPipe y Gazebo |
| `defensa_2026-09-30.mp4` | La defensa, con el brazo real copiando al operador |
| `brazo_estacion_2026-09-15.mp4` | El brazo en la estación de trabajo |
| `brazo_init_2026-09-28.mp4` | El brazo subiendo de home a init |
| `ensamble_cad.mp4` | Copia de `cad/ensamblajes/Ensamble Brazo Robótico.mp4` |

**2. Preparar recursos, clips y música:**

```bash
python3 showreel/herramientas/preparar_recursos.py graphify-out/graph.json
python3 showreel/herramientas/preparar_clips.py
python3 showreel/herramientas/musica.py showreel/salida/musica.wav
```

**3. Grabar la aplicación.** En una terminal, abrir la aplicación sin ROS:

```bash
python3 app/servidor.py --sin-ros --puerto 8651
```

En otra terminal:

```bash
node showreel/herramientas/capturar_app.mjs
```

**4. Grabar la película.** Primero se sirve el repositorio:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Después se graba en dos tramos, que se pueden lanzar por separado:

```bash
node showreel/herramientas/capturar.mjs http://127.0.0.1:8765/showreel/escenas/pelicula.html showreel/salida/trozos/a.mp4 --desde 0 --hasta 112
node showreel/herramientas/capturar.mjs http://127.0.0.1:8765/showreel/escenas/pelicula.html showreel/salida/trozos/b.mp4 --desde 112
```

**5. Montar:**

```bash
python3 showreel/herramientas/montar.py
```

Si no hay GPU, Chromium dibuja por software. En un equipo de dos núcleos, la película tarda alrededor de una hora y la aplicación media hora.

Para revisar una escena sin grabar, se abre `http://127.0.0.1:8765/showreel/escenas/pelicula.html?t=70` (un instante) o `?ver=1` (reproduce en vivo).

## Cambiar la música

`montar.py --musica mi_pista.wav` usa otra pista. Debe ir a 120 BPM y empezar en el primer tiempo; si no, los cortes no caen sobre el ritmo. Las secciones de la pista original son:

| Compases | Segundos | Sección |
|---|---|---|
| 1–8 | 0–16 | Intro |
| 9–16 | 16–32 | Subida |
| 17–32 | 32–64 | Primer drop |
| 33–40 | 64–80 | Groove |
| 41–48 | 80–96 | Pausa |
| 49–64 | 96–128 | Segundo drop |
| 65–80 | 128–160 | Groove |
| 81–88 | 160–176 | Final |

## Datos que muestra el video y de dónde salen

| Dato | Fuente |
|---|---|
| 35 estudiantes, 450 min, 12,86 min por estudiante | Presentación técnica; `docs/entregables/README.md` |
| USD 336,66 · C$ 12 456,42 | Presentación técnica, presupuesto |
| 431,70 mm de alcance | `analisis/cinematica/ANALISIS_CINEMATICO.md` |
| 34,05 FPS · 21,87 ms · 0,492° | `README.md`, «Resultados medidos»; `pruebas/recalcular_resultados.py` |
| Error de 10⁻¹⁵ en la cinemática directa, 3000 de 3000 en la inversa | `analisis/cinematica/ANALISIS_CINEMATICO.md` |
| 2,30 mm · 227 g · 54 °C · sobrepaso ≤ 1,1 % | `README.md`, ensayos del 25 de septiembre de 2026 |
| Fórmulas de los ángulos y filtro One Euro | `entrega/teleoperacion/teleop_v13.py` |
| 2162 nodos y 4548 relaciones | `graphify-out/graph.json` ([capítulo 21](../docs/21-mapa-del-repositorio.md)) |

La gráfica del filtro One Euro usa una **señal de ejemplo**, no una medición, y así lo dice en pantalla. El esqueleto de la escena de la matemática también es una animación ilustrativa: lo que viene del código son las fórmulas.
