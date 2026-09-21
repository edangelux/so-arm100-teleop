# 14 — Lanzador unificado de la versión presentada

[← Anterior: cierre del proyecto](12-cierre-del-proyecto.md) · [Volver al inicio](../README.md)

---

`scripts/soarm.sh` instala y opera el sistema **tal como se presentó en la defensa**: ejecuta `teleop_v13.py` sin modificar su algoritmo y levanta, en el orden correcto, los procesos que necesita cada modo. Sustituye a las cinco terminales de la [secuencia de la defensa](10-espejo-simulacion-y-robot-real.md#la-secuencia-de-la-defensa) por una sola orden.

Requiere Ubuntu 22.04 con ROS 2 Humble, nativo, en máquina virtual o bajo WSL2. Git Bash de Windows no sirve para ejecutarlo: sólo para publicar cambios en Git.

## Instalación

```bash
cd ~/so-arm100-teleop
bash scripts/soarm.sh instalar
```

Instala ROS 2 Humble y Gazebo si faltan, crea el entorno de Python con las versiones exactas que usó el equipo de la entrega (`entrega/entorno/requirements-recuperado.txt`, con MediaPipe 0.10.21), copia las fuentes de `entrega/src/` a un workspace nuevo, resuelve dependencias con `rosdep`, compila con `colcon` y agrega el usuario a los grupos `video` y `dialout`. Después de la instalación hay que cerrar sesión y volver a entrar para que los grupos surtan efecto.

Por omisión usa `~/ros2_ws_entrega` y `~/teleop_venv_entrega`, distintos de los de la instalación por fases, para que una no pise a la otra. Si el workspace ya existe y tiene archivos distintos de las fuentes, **no los sobrescribe**: se detiene y pide otra ruta con `--ws`.

## Los tres modos

```bash
bash scripts/soarm.sh sim                              # sólo el gemelo digital
bash scripts/soarm.sh real  --puerto /dev/ttyACM0      # sólo el brazo físico
bash scripts/soarm.sh ambos --puerto /dev/ttyACM0      # las dos plantas a la vez
```

| Modo | Procesos que levanta | Tópico del brazo | Acción de la pinza |
|---|---|---|---|
| `sim` | Gazebo | `/arm_controller/joint_trajectory` | `/gripper_controller/gripper_cmd` |
| `real` | Hardware bajo `/real` | `/real/arm_controller/joint_trajectory` | `/real/gripper_controller/gripper_cmd` |
| `ambos` | Gazebo, hardware y los dos nodos espejo | `/arm_controller/joint_trajectory`, replicado a `/real` | `/mirror_gripper_controller/gripper_cmd` |

En cada modo el lanzador **espera a que los controladores estén activos** antes de abrir la teleoperación; en `ambos` espera además a que aparezca la acción espejo de la pinza. Si un componente se detiene, cierra la sesión entera. Al salir con `Q` en la ventana de visión, o con `Ctrl+C` en la terminal, termina todos los procesos que inició.

No se levanta MoveIt: la teleoperación de la versión 13 es articular directa y no pasa por el planificador.

## Opciones

| Opción | Por omisión | Qué cambia |
|---|---|---|
| `--puerto RUTA` | `/dev/ttyACM0` | Puerto serie de la placa de servos |
| `--camara N` | `0` | Índice de la cámara (`/dev/videoN`) |
| `--ancho N --alto N` | `640 480` | Resolución de captura, en formato MJPG |
| `--velocidad RAD_S` | `8.0` | Tope de velocidad articular, entre 0 y 8 rad/s |
| `--baud N` | `1000000` | Velocidad del bus serie |
| `--servo-speed N` | `2400` | Velocidad interna del servo, en pasos por segundo |
| `--servo-accel N` | `50` | Aceleración interna del servo |
| `--config RUTA` | `~/teleop_config.json` | Signos y ganancias guardados con `S` |
| `--ws RUTA` · `--venv RUTA` | `~/ros2_ws_entrega` · `~/teleop_venv_entrega` | Workspace y entorno de Python |
| `--software-gl` | — | Renderizado por software, para máquinas virtuales sin aceleración 3D |
| `--dry-run` | — | Muestra el plan sin instalar ni iniciar nada |

Los valores por omisión son los que se usaron en la defensa. `--velocidad` es el único que conviene cambiar antes de conectar el brazo por primera vez: un valor de 0,5 a 1,0 rad/s atenúa el riesgo del bloqueo 6 de [docs/09](09-robot-fisico.md). Es un ajuste recomendado, no uno que se haya validado con el brazo.

## Comprobaciones

```bash
bash scripts/soarm.sh ambos --dry-run      # qué haría, sin hacerlo
bash scripts/soarm.sh verificar            # paquetes, entorno de Python, cámara y puerto
```

Los registros de cada sesión quedan en `~/.local/state/soarm/`, un directorio por sesión y un archivo por proceso. El nodo de visión escribe además sus propios `~/fps_log.csv` y `~/latency_log.csv`, que **no son** los registros de [`pruebas/datos_originales/`](../pruebas/): ésos son los de la entrega y no se tocan.

## Cómo está construido

| Archivo | Función |
|---|---|
| `scripts/soarm.sh` | Valida las opciones, instala o levanta los procesos, espera a los controladores y cierra todo al salir |
| `teleop_vision/ejecutar_v13.py` | Carga `entrega/teleoperacion/teleop_v13.py` y sustituye, antes de arrancar, sus constantes de conexión |
| `teleop_vision/runtime_config.py` | Traduce el modo elegido a tópico, acción, cámara, resolución, velocidad y archivo de configuración |
| `scripts/preparar_workspace.py` | Copia las fuentes al workspace sin sobrescribir cambios locales |
| `scripts/07_restaurar_entrega.sh` | Reconstruye el workspace de la entrega en una ruta nueva, sin iniciar el hardware |

El envoltorio sólo cambia siete constantes de `teleop_v13.py`: `ARM_TOPIC`, `GRIPPER_ACTION`, `CAMERA_INDEX`, `CAMERA_WIDTH`, `CAMERA_HEIGHT`, `MAX_JOINT_VEL` y `CONFIG_FILE`. Filtros One Euro, zonas muertas, signos, ganancias, límites articulares, cálculo angular, calibración y horizonte de 40 ms quedan exactamente como se presentaron. El archivo original no se modifica: su SHA-256 está en [`entrega/manifiesto_origen.json`](../entrega/manifiesto_origen.json).

## Alcance de lo verificado

El lanzador se probó en sus cuatro modos con `--dry-run`, con entradas inválidas y con la selección de tópicos de cada modo, y se comprobó que el envoltorio localiza el `teleop_v13.py` original. **No se ejecutó todavía contra el brazo ni sobre una instalación nueva de ROS 2**: la secuencia que automatiza es la de la defensa, pero el guion en sí no estaba en el equipo de la entrega. La primera ejecución real conviene hacerla en modo `sim`, después en `real` con `--velocidad 0.5` y el brazo sostenido, y sólo después en `ambos`.
