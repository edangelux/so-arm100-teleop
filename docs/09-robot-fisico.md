# 09 — Estado del robot físico

[← Anterior: análisis cinemático](08-analisis-cinematico.md) · [Volver al inicio](../README.md)

---

> ## Resumen en una línea
>
> **Este repositorio está verificado para simulación. Para el brazo físico NO está listo, y este documento explica exactamente qué falta.**

Si alguien clona el repositorio, corre `scripts/install.sh`, conecta el SO-ARM100 por USB e intenta teleoperarlo, **no va a funcionar**. Va a fallar en el arranque, antes de mover un servo. Abajo está cada motivo, con el archivo y la línea donde está.

Esto no es una advertencia genérica por precaución: son bloqueos concretos, identificados leyendo los archivos, y ninguno de ellos se ha probado con el brazo delante.

---

## Lo que sí está verificado

| Ruta | Estado |
|---|---|
| Ubuntu 22.04 en VirtualBox → ROS 2 Humble → Gazebo → MoveIt 2 → teleoperación por visión | **Verificado en una instalación real desde cero** |
| *Plan & Execute* de MoveIt en RViz sobre el robot simulado | **Verificado** |
| Teleoperación por visión con MediaPipe sobre el robot simulado | **Verificado** |
| Instalación nativa por ISO / USB ([docs/02](02-instalacion-nativa-iso.md)) | **No verificada por nadie** |
| **Brazo físico** | **No verificado. Bloqueado — ver abajo** |

---

## Los bloqueos, en orden de aparición

### 1. El paquete del driver no se instala, y no tiene versión para Humble

La interfaz de hardware que habla con los servos es el plugin `so_arm_100_controller/SOARM100Interface`, referenciado en:

```
so_arm_100_description/ros2_control/so_arm_100_5dof_position.ros2_control.xacro
so_arm_100_moveit_config/config/so_arm_100.ros2_control.xacro
```

Ese plugin **no vive en el repositorio `brukg/SO-100-arm`** que clona la fase 4 del instalador. Vive en un repositorio aparte: [`brukg/so_arm_100_hardware`](https://github.com/brukg/so_arm_100_hardware).

Y ahí está el problema: en el índice oficial de paquetes de ROS, `so_arm_100_hardware` **solo tiene versión liberada para Jazzy (0.1.1)**. Para Humble, el índice dice literalmente *"No version for distro humble"*. El README del repositorio original ofrece `sudo apt install ros-jazzy-so-arm-100-hardware` — no existe el equivalente `ros-humble-`.

**Consecuencia:** hay que compilarlo desde el código fuente sobre Humble. Puede que compile sin cambios; puede que no. **Nadie lo ha comprobado.** Y si el plugin no carga, `controller_manager` aborta y no arranca nada.

### 2. El controlador de la pinza es el de Jazzy — el mismo error que ya arreglamos en simulación

`so_arm_100_moveit_config/config/hardware_controllers.yaml`:

```yaml
gripper_controller:
  type: parallel_gripper_action_controller/GripperActionController
```

`parallel_gripper_action_controller` **no existe en Humble**. Este es exactamente el error que rompió la simulación y que se resolvió cambiándolo a `position_controllers/GripperActionController` — pero ese arreglo se aplicó **solo a la configuración de simulación**, deliberadamente:

> El archivo de hardware se dejó sin tocar porque cambiarlo a ciegas, sin el robot conectado para probar el resultado, es exactamente el tipo de suposición que ya costó tiempo antes en este proyecto.

**Consecuencia garantizada al lanzar `hardware.launch.py`:**

```
Error loading controller 'gripper_controller'
```

**El arreglo probablemente es el mismo cambio de una línea.** Pero hay que hacerlo con el brazo conectado y comprobar que la pinza responde, porque el controlador de Humble tiene una interfaz de acción ligeramente distinta.

### 3. El overlay se come los parámetros del puerto serie

El overlay reemplaza `so_arm_100_moveit_config/config/so_arm_100.urdf.xacro` por una versión que soporta simulación. Comparando con el original:

| Argumento xacro | Original | Overlay |
|---|---|---|
| `serial_port` | declarado | **falta** |
| `serial_baudrate` | declarado | **falta** |
| `servo_speed` | declarado | **falta** |
| `servo_acceleration` | declarado | **falta** |

`hardware.launch.py` sí pasa esos valores (`xacro.process_file(..., mappings={...})`), pero como el xacro del overlay no los declara, **se ignoran en silencio** y el sistema cae a los valores por defecto de la macro: `/dev/ttyUSB0` a `1000000` baudios.

**Consecuencia:** lanzar con `serial_port:=/dev/ttyACM0` **no hace nada**. Y muchas placas de servos Feetech enumeran justamente como `ttyACM0`, no `ttyUSB0`. Este es el escenario del [issue #10 abierto en el repositorio original](https://github.com/brukg/SO-100-arm/issues/10), que reporta `open:: No such file or directory` → `Failed to initialize motors` en esa situación exacta, y sigue sin resolverse.

**Arreglo:** volver a declarar los cuatro argumentos en el xacro del overlay y pasarlos a la macro `so_arm_100_5dof_system`.

### 4. Sin calibración, los ángulos están mal

El README del repositorio original lo documenta: la interfaz de hardware convierte *ticks* de servo a radianes, y **sin un archivo de calibración usa un mapeo genérico** `(ticks − 2048)·2π/4096`, que da rangos articulares equivocados. El síntoma descrito es que la pinza aparece medio abierta en RViz cuando físicamente está abierta del todo.

El procedimiento es:

```bash
ros2 run so_arm_100_hardware calibrate_arm.py
```

y después declarar el archivo resultante en el xacro:

```xml
<param name="calibration_file">$(find so_arm_100_hardware)/config/calibration.yaml</param>
```

**Nada de esto lo hace el instalador**, porque el paquete que trae `calibrate_arm.py` ni siquiera se descarga (bloqueo 1).

### 5. Permisos del puerto serie

El instalador agrega tu usuario al grupo `video` para la cámara, pero **no al grupo `dialout`**, que es el que da acceso a `/dev/ttyUSB0` y `/dev/ttyACM0`.

**Consecuencia:** `Permission denied` al abrir el puerto. Falta:

```bash
sudo usermod -a -G dialout $USER
```

y reiniciar la sesión. En máquina virtual hace falta además pasar el dispositivo USB a la VM (*Dispositivos → USB*), lo cual ya está cubierto en [docs/01](01-instalacion-maquina-virtual.md), captura `vm-21`.

### 6. El nodo de teleoperación no es seguro para hardware real

Este es el bloqueo más importante, porque los cinco anteriores impiden que el brazo se mueva, y este hace que **se mueva mal**.

`teleop_vision.py` tiene tres características que en simulación son inofensivas y en un brazo físico no:

**a) No sabe dónde está el brazo.** El nodo publica en `/arm_controller/joint_trajectory` pero **nunca se suscribe a `/joint_states`**. Arranca con:

```python
q_cmd = [0.0]*5      # línea 423
```

En Gazebo el robot aparece en cero, así que coincide. **El brazo físico arranca donde lo dejaste.** El primer mensaje que se publica dice "estar en todo-ceros dentro de 40 ms". Los servos van a intentar llegar a la postura de inicio a la máxima velocidad que puedan, desde donde estén.

Lo mismo pasa **cada vez que se presiona `C`** para recalibrar, porque en la línea 516 `q_cmd` se vuelve a poner en cero.

**b) El tope de velocidad es de simulación.**

```python
MAX_JOINT_VEL = 8.0    # rad/s  ≈ 458 °/s
```

Ese valor se dejó alto a propósito ([E3] en la cabecera del script) porque el filtro One Euro es el que suaviza y el tope solo actúa como red de seguridad. Para un servo Feetech con la inercia del brazo y una carga en la pinza, es un valor sin sentido.

**c) No hay compensación de gravedad.** En Gazebo el `joint_trajectory_controller` mantiene la posición contra la gravedad simulada sin esfuerzo. En el brazo real, un comando de posición pura con los servos en modo posición puede no sostener el brazo extendido, y la diferencia entre lo comandado y lo real no se realimenta a ninguna parte.

**Lo mínimo que habría que cambiar antes de conectar el brazo:**

1. Suscribirse a `/joint_states` e inicializar `q_cmd` con la postura real del brazo.
2. Al calibrar, **no** saltar a cero: usar la postura actual como punto de partida.
3. Bajar `MAX_JOINT_VEL` a un valor conservador (del orden de 0.5–1.0 rad/s) y subirlo solo después de probar.
4. Aumentar `time_from_start` de 40 ms a algo que el servo pueda cumplir.
5. Añadir una rampa de arranque: los primeros segundos, moverse muy despacio.

---

## Entonces, ¿qué haría falta para que funcione?

En orden. Cada paso depende del anterior y **ninguno está verificado**:

| # | Paso | Riesgo |
|---|---|---|
| 1 | Clonar y compilar `so_arm_100_hardware` desde fuente sobre Humble | Puede no compilar; es código pensado para Jazzy |
| 2 | Corregir `hardware_controllers.yaml` → `position_controllers/GripperActionController` | Bajo; es el mismo cambio que funcionó en simulación |
| 3 | Devolver los argumentos serie al xacro del overlay | Bajo |
| 4 | `usermod -a -G dialout`, reiniciar sesión, pasar el USB a la VM | Bajo |
| 5 | Identificar el puerto real (`ls /dev/ttyUSB* /dev/ttyACM*`) y los IDs de los servos (1–6) | Bajo |
| 6 | Correr `calibrate_arm.py` y declarar el `calibration_file` | Medio; sin esto los rangos están mal |
| 7 | Probar con `ros2 topic pub` un movimiento pequeño de **un solo joint**, con el brazo sin carga | **Aquí es donde se puede dañar algo** |
| 8 | Aplicar los cambios de seguridad del bloqueo 6 a `teleop_vision.py` | Medio |
| 9 | Recién entonces, teleoperar | — |

**El paso 7 es el que hay que hacer con cuidado.** Con el brazo apoyado, sin carga en la pinza, la mano en el interruptor de la fuente, y moviendo una sola articulación pocos grados.

---

## Por qué el repositorio se queda así, a propósito

Se podrían escribir hoy mismo los arreglos de los bloqueos 2, 3 y 5 — son cambios de una o dos líneas y probablemente correctos.

No se hace, y la razón está en el historial de este proyecto: **cada vez que en esta documentación se dio por bueno un valor sin probarlo, costó tiempo real.** El controlador de la pinza en simulación se "arregló" una primera vez con un controlador equivocado; las dependencias de MediaPipe se fijaron a ojo y rompieron una instalación que funcionaba. Los dos se resolvieron solo al probarlos de verdad.

Escribir configuración de hardware sin el hardware delante reproduciría exactamente ese error, con la diferencia de que aquí el fallo no es un mensaje en la terminal: es un servo forzando contra un tope.

**Cuando el brazo esté conectado, estos pasos se hacen y se prueban uno por uno, y este documento se convierte en la guía de la instalación física.** Hasta entonces dice lo que realmente se sabe.

---

## Fuentes

- [`brukg/so_arm_100_hardware`](https://github.com/brukg/so_arm_100_hardware) — interfaz de hardware ros2_control
- [`so_arm_100_hardware` en el índice de ROS](https://index.ros.org/p/so_arm_100_hardware/) — versiones liberadas por distribución
- [`brukg/SO-100-arm`](https://github.com/brukg/SO-100-arm) — README con los requisitos de hardware y el procedimiento de calibración
- [Issue #10 — Error ros2_control_node when running hardware.launch.py](https://github.com/brukg/SO-100-arm/issues/10)
