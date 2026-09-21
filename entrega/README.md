# Fuentes de la entrega

Esta carpeta conserva **el estado exacto del software con el que se presentó el proyecto**. Se recuperó del respaldo del equipo que se usó en la defensa y se guardó sin modificaciones: cada archivo lleva su SHA-256 en [`manifiesto_origen.json`](manifiesto_origen.json), que permite comprobar que es idéntico al original.

Del respaldo se tomó sólo lo pertinente al proyecto. Quedaron fuera el sistema operativo, los binarios compilados (`build/`, `install/`), el entorno virtual, las cachés, los historiales personales y los metadatos internos de Git.

## Contenido

| Carpeta | Qué es |
|---|---|
| `teleoperacion/teleop_v13.py` | **El nodo que se ejecutó en la defensa.** Se identificó por la secuencia de órdenes registrada en el respaldo |
| `teleoperacion/` (el resto) | Variantes exploratorias previas: control cartesiano, dos brazos, dos manos, zonas, retorno a casa y prueba de servo. Ninguna intervino en las mediciones |
| `src/SO-100-arm/` | Paquetes ROS 2 del robot con las modificaciones locales, a partir del commit `35a59dbc6e48b1308c14d4d239048570e935f810` de `brukg/SO-100-arm` |
| `src/so_arm_100_hardware/` | Interfaz de hardware adaptada a Humble, a partir del commit `088e355e49443bb802e090152e3fb25114d2f2fb` de `brukg/so_arm_100_hardware` |
| `src/trajectory_mirror/` | Los dos nodos espejo de la arquitectura de réplica |
| `utilidades_originales/` | Programas de puesta en marcha que se compilaron fuera del paquete: identificación y centrado de servos |
| `entorno/` | Versiones de Python y de los paquetes que tenía el entorno de la entrega |

## Qué se modificó respecto del código de origen

En `SO-100-arm` se cambiaron el lanzamiento del brazo físico, la configuración de Gazebo, la descripción `ros2_control`, los controladores, los límites articulares y el SRDF, y se agregó la configuración de MoveIt Servo. En la interfaz de hardware se cambiaron el `CMakeLists.txt`, la interfaz para Humble, la pose cero y los guiones auxiliares, y se agregaron los programas de medición `angular_error_test` y `bench_serial`.

## Un archivo que se excluyó

`src/so_arm_100_hardware/config/calibration.yaml` venía en el respaldo, heredado del repositorio de origen y fechado el 2 de febrero de 2025. Corresponde a otro manipulador. **El controlador nunca lo cargó**, porque ningún archivo de lanzamiento define el parámetro `calibration_file`, y se excluyó para que un tercero no lo active por error. El manifiesto conserva su SHA-256 en la sección `excluidos`. El detalle está en el bloqueo 4 de [docs/09](../docs/09-robot-fisico.md).

## Reconstruir y operar

```bash
bash scripts/07_restaurar_entrega.sh     # compila estas fuentes en ~/ros2_ws_entrega, sin tocar el hardware
bash scripts/soarm.sh sim                # o real, o ambos; véase docs/14
```

Una observación para quien lea el código: varios valores por omisión de las fuentes todavía dicen `/dev/ttyUSB0`, pero en la entrega la placa enumeraba como `/dev/ttyACM0` y se pasó explícitamente como argumento al lanzar el hardware. Los registros de `ros2_control` lo confirman.

## Licencias

Las fuentes de terceros conservan sus licencias y sus archivos `LICENSE` y `README` originales, que no se reescribieron. Los comentarios internos del código tampoco se tradujeron ni se reescribieron, para que los bytes sigan coincidiendo con el manifiesto.
