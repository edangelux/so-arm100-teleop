# 10 — Espejo: simulación y robot real a la vez

[← Anterior: estado del robot físico](09-robot-fisico.md) · [Volver al inicio](../README.md) · [Siguiente: instalación en WSL2 →](11-instalacion-wsl2.md)

---

Este documento explica cómo el sistema comanda **el robot simulado y el brazo físico al mismo tiempo**, con la misma consigna, sin duplicar el nodo de teleoperación.

> **Estado:** la arquitectura de réplica **se operó en la defensa del proyecto**, con los dos nodos espejo gobernando a la vez el gemelo digital y el brazo físico. La secuencia exacta que se usó está en [La secuencia de la defensa](#la-secuencia-de-la-defensa). El launch conjunto `gz_moveit_real.launch.py` es una alternativa que agrupa esos pasos y no se ejecutó de principio a fin. Estado de cada componente en [docs/09](09-robot-fisico.md).

---

## El problema

El robot simulado y el brazo físico son dos plantas distintas, cada una con su propio `controller_manager` y sus propios controladores. Ambos declaran controladores con el mismo nombre: `arm_controller`, `gripper_controller`, `joint_state_broadcaster`.

Si se lanzan los dos en el espacio de nombres por omisión, se pisan: dos `controller_manager` compitiendo por los mismos nombres de tópico y de acción, dos `joint_state_broadcaster` publicando en `/joint_states`, y RViz mostrando la superposición de ambos.

## La solución: un espacio de nombres para el lado físico

Todo el lado físico se lanza dentro del espacio de nombres `/real`. La pieza que lo hace está en `hardware.launch.py`:

```python
NS = 'real'
```

y se aplica al `robot_state_publisher`, al `controller_manager` y a los seis spawners de controladores. El resultado:

| Planta | Controlador del brazo | Acción de la pinza | Estados articulares |
|---|---|---|---|
| Gazebo | `/arm_controller/joint_trajectory` | `/gripper_controller/gripper_cmd` | `/joint_states` |
| Brazo físico | `/real/arm_controller/joint_trajectory` | `/real/gripper_controller/gripper_cmd` | `/real/joint_states` |

Conviven sin tocarse. **Esa separación es lo que hace posible todo lo demás.**

---

## Los dos nodos espejo

El paquete `trajectory_mirror` trae dos nodos. **No hacen lo mismo y hacen falta los dos**, por razones distintas.

### `topic_mirror_node` — para la teleoperación por visión

Se suscribe a `/arm_controller/joint_trajectory` y republica el mensaje idéntico en `/real/arm_controller/joint_trajectory`. No filtra, no escala, no verifica.

Es el que sirve para la teleoperación, porque `teleop_vision.py` comanda el brazo **publicando en un tópico**. Con este nodo corriendo, cada consigna que el script manda a Gazebo llega también al brazo físico, sin tocar una línea del script.

### `trajectory_mirror_node` — para MoveIt 2

Levanta dos servidores de acción, `mirror_controller/follow_joint_trajectory` y `mirror_gripper_controller/gripper_cmd`. Cada objetivo que recibe lo reenvía en paralelo a las dos plantas, espera a que ambas terminen y devuelve el código de error del brazo físico.

Es el que sirve para MoveIt, porque MoveIt comanda por **acción**, no por tópico.

```
                     ┌──────────────────────────┐
  teleop_vision.py ──┤ /arm_controller/         │──→ Gazebo
      (tópico)       │   joint_trajectory       │
                     └────────────┬─────────────┘
                                  │ topic_mirror_node
                                  ↓
                     /real/arm_controller/joint_trajectory ──→ brazo físico

                     ┌──────────────────────────┐
  MoveIt 2 ──────────┤ /mirror_controller/      │
     (acción)        │   follow_joint_trajectory│
                     └────────────┬─────────────┘
                                  │ trajectory_mirror_node
                     ┌────────────┴─────────────┐
                     ↓                          ↓
         /arm_controller/follow_...   /real/arm_controller/follow_...
              (Gazebo)                      (brazo físico)
```

---

## La pinza: por qué necesita un tratamiento aparte

Aquí hay una asimetría que conviene entender antes de que dé problemas.

Como explica [docs/07](07-como-funciona.md), **el brazo se comanda por tópico y la pinza por acción**. No es un capricho: `position_controllers/GripperActionController` solo acepta acciones.

Consecuencia directa: `topic_mirror_node` espeja un **tópico**, así que cubre el brazo y **no cubre la pinza**. Si solo corres ese nodo, el brazo físico se mueve y la pinza no.

La solución no necesita código nuevo, porque `trajectory_mirror_node` ya trae un servidor de acción para la pinza que reenvía a las dos plantas. Basta apuntar el script a ese servidor:

```bash
export SOARM_GRIPPER_ACTION=/mirror_gripper_controller/gripper_cmd
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

`teleop_vision.py` lee esa variable de entorno y, si no está definida, usa `/gripper_controller/gripper_cmd` como siempre. **El comportamiento por omisión no cambia**, de modo que quien no tenga brazo físico sigue corriendo el script exactamente igual que antes.

---

## La secuencia de la defensa

El historial de órdenes del equipo con el que se presentó el proyecto registra, en este orden, los cinco procesos que se levantaron. Cada uno ocupa su propia terminal:

```bash
# Terminal 1 — gemelo digital en Gazebo
ros2 launch so_arm_100_bringup gz.launch.py

# Terminal 2 — brazo físico bajo el espacio de nombres /real
ros2 launch so_arm_100_bringup hardware.launch.py serial_port:=/dev/ttyACM0

# Terminal 3 — espejo de acciones (MoveIt y pinza)
ros2 run trajectory_mirror trajectory_mirror_node

# Terminal 4 — espejo del tópico de teleoperación
ros2 run trajectory_mirror topic_mirror_node

# Terminal 5 — teleoperación, versión 13
source ~/teleop_venv/bin/activate
python3 ~/teleop_scripts/teleop_v13.py
```

En la versión 13 la acción de la pinza está fijada en el código a `/mirror_gripper_controller/gripper_cmd`, la que ofrece `trajectory_mirror_node`, de modo que no hace falta ninguna variable de entorno.

Esa misma secuencia es la que automatiza `bash scripts/soarm.sh ambos`, que además espera a que los controladores de cada planta estén activos antes de abrir la teleoperación y cierra todos los procesos al salir. Véase [docs/14](14-lanzador-v13.md).

## Orden de arranque con el launch conjunto

```bash
# Terminal 1 — las dos plantas y los dos espejos
ros2 launch so_arm_100_bringup gz_moveit_real.launch.py serial_port:=/dev/ttyUSB0
```

```bash
# Terminal 2 — comprobar ANTES de teleoperar
ros2 control list_controllers                                # Gazebo: 3 activos
ros2 control list_controllers -c /real/controller_manager    # físico: 3 activos
ros2 node list | grep mirror                                 # /topic_mirror y /trajectory_mirror
ros2 topic list | grep real                                  # /real/arm_controller/joint_trajectory
```

```bash
# Terminal 3 — teleoperación
cd ~/ros2_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
export SOARM_GRIPPER_ACTION=/mirror_gripper_controller/gripper_cmd
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

> **La primera vez, con el brazo sostenido a mano o apoyado, sin carga en la pinza y con un dedo en el interruptor de la fuente.** El nodo de teleoperación arranca suponiendo que el brazo está en todo-ceros; en Gazebo eso es inofensivo, en el brazo físico no. Es el bloqueo 6 de [docs/09](09-robot-fisico.md), que la versión 13 conserva.

---

## El retardo de arranque de los espejos

`gz_moveit_real.launch.py` arranca los dos nodos espejo **12 segundos después** que el resto. No es un capricho:

```python
RETARDO_ESPEJOS = 12.0
```

`trajectory_mirror_node` hace `wait_for_server(timeout_sec=3.0)` sobre los cuatro controladores y **aborta el objetivo si alguno no responde**. En una máquina virtual, Gazebo tarda bastante más que eso en activar sus controladores la primera vez, porque además cachea las mallas.

Si ves `No se pudo conectar a /arm_controller (Gazebo)`, sube ese valor. El arreglo correcto sería que el nodo reintentara en lugar de abortar, pero eso exige tocar el nodo y no vale la pena antes de haberlo probado tal como está.

---

## Diagnóstico

| Síntoma | Causa más probable |
|---|---|
| Gazebo se mueve, el brazo físico no | `topic_mirror` no arrancó, o `hardware.launch.py` no encontró el puerto serie |
| El brazo físico se mueve, la pinza física no | Falta `export SOARM_GRIPPER_ACTION=...` |
| MoveIt aborta el objetivo al planificar | `trajectory_mirror` no está corriendo, o arrancó antes que los controladores — sube `RETARDO_ESPEJOS` |
| El brazo físico va a ángulos equivocados | La calibración es la de fábrica — [docs/09, bloqueo 4](09-robot-fisico.md) |
| `No se pudo conectar a /real/arm_controller` | Los controladores del lado físico no llegaron a activarse. Revisa permisos del puerto (`dialout`) y que el puerto exista |
| `Permission denied` al abrir `/dev/ttyUSB0` | Falta cerrar sesión y volver a entrar tras `usermod -a -G dialout` |
| Lanzar con `serial_port:=/dev/ttyACM0` no surte efecto | [docs/09, bloqueo 3](09-robot-fisico.md): ocurre con el xacro del overlay, no con el workspace de la entrega |

---

## Las tres frecuencias, y por qué no coinciden

El sistema opera sobre tres lazos desacoplados, y los dos lados de la simulación no corren al mismo ritmo:

| Lado | Archivo | `update_rate` |
|---|---|---|
| Gazebo (overlay de este repositorio) | `controllers_5dof.yaml` | 100 Hz |
| Gazebo (configuración original) | `ros2_controllers.yaml` | 50 Hz |
| Brazo físico | `hardware_controllers.yaml` | 200 Hz |

No impide que el espejo funcione: cada controlador interpola por su cuenta. Pero **explica por qué el brazo físico y el simulado se ven algo distintos ejecutando la misma consigna**, y esa diferencia es observable de forma directa poniendo ambos a seguir la misma trayectoria. Es, de hecho, una de las cosas que esta estación permite enseñar.

---

## Créditos

La arquitectura de doble planta con espacio de nombres `/real` y el paquete `trajectory_mirror` son trabajo de **Cristhian E. Guido Meléndez**, integrante del equipo del proyecto.
