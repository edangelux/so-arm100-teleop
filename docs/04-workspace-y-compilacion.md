# 04 — Workspace de ROS 2 y compilación

[← Anterior: instalación de ROS 2](03-instalacion-ros2.md) · [Volver al inicio](../README.md) · [Siguiente: ejecución →](05-ejecucion.md)

---

## 1. Crear el workspace

Un *workspace* de ROS 2 es simplemente una carpeta con un subdirectorio `src/` donde viven los paquetes de código fuente. `colcon` los compila y deja el resultado en `install/`.

```bash
mkdir -p ~/ros2_ws/src
cd ~/ros2_ws/src
```

---

## 2. Descargar los paquetes del SO-ARM100

```bash
cd ~/ros2_ws/src
git clone https://github.com/brukg/SO-100-arm.git
```

> ### ⚠️ Cuidado con el repositorio equivocado
> El repositorio **[`TheRobotStudio/SO-ARM100`](https://github.com/TheRobotStudio/SO-ARM100)** es el proyecto original del brazo, y aparece en casi todas las búsquedas — pero **contiene únicamente los archivos STL, los CAD en STEP y la lista de materiales**. No tiene URDF, ni paquetes de ROS 2, ni launch files. Si lo clonas en `src/`, `colcon build` no encuentra nada que compilar y `ros2 launch` falla con *package not found*.
>
> El repositorio con los **paquetes de ROS 2** (descripción, MoveIt, bringup, control) es **[`brukg/SO-100-arm`](https://github.com/brukg/SO-100-arm)**. Ese es el que necesitas.
>
> Usa `TheRobotStudio/SO-ARM100` solo si vas a **imprimir y ensamblar** el brazo físico.

Después del clonado tendrás estos paquetes en `~/ros2_ws/src/SO-100-arm/`:

| Paquete | Para qué sirve |
|---|---|
| `so_arm_100_description` | URDF/xacro y mallas del brazo — la definición del robot |
| `so_arm_100_moveit_config` | Configuración de MoveIt 2, cinemática, límites, controladores |
| `so_arm_100_bringup` | Launch files: Gazebo (`gz.launch.py`), hardware real, RViz |
| `so_arm_100` | Metapaquete que agrupa a los anteriores |
| `so_arm_100_5dof_arm_ikfast_plugin` | Solucionador de cinemática IKFast (opcional) |

---

## 3. Resolver dependencias

`rosdep` lee los `package.xml` de cada paquete e instala con `apt` todo lo que les falte:

```bash
cd ~/ros2_ws
rosdep install --from-paths src --ignore-src -r -y
```

> El flag `-r` significa *continuar aunque alguna dependencia no se pueda resolver*. Es necesario aquí porque algunos paquetes declaran dependencias que no existen como binario en Humble. Las advertencias amarillas son normales; los errores rojos que detienen el comando no lo son — revisa [docs/06](06-solucion-de-problemas.md).

---

## 4. Compilar

```bash
cd ~/ros2_ws
colcon build --symlink-install
```

La primera compilación tarda entre 3 y 15 minutos.

- `--symlink-install` crea enlaces simbólicos en lugar de copiar archivos. Con esto, si editas un archivo de Python o un URDF, **no tienes que recompilar** para ver el cambio.

> ### Si la compilación falla en `so_arm_100_5dof_arm_ikfast_plugin`
> Ese paquete es un solucionador de cinemática opcional y es el que más problemas de compilación da. **No lo necesitas** para la simulación: MoveIt funciona perfectamente con el solucionador KDL por defecto.
>
> Sáltalo así:
>
> ```bash
> touch ~/ros2_ws/src/SO-100-arm/so_arm_100_5dof_arm_ikfast_plugin/COLCON_IGNORE
> cd ~/ros2_ws && colcon build --symlink-install
> ```
>
> El archivo `COLCON_IGNORE` (vacío) le dice a `colcon` que ignore por completo esa carpeta.

---

## 5. Overlay de configuración verificada

**Este paso no es opcional.** Los paquetes de `brukg/SO-100-arm`, tal como vienen, **no arrancan en Humble**.

```bash
bash ~/so-arm100-teleop/scripts/05_aplicar_overlay.sh
```

El script copia sobre el clon los archivos ya corregidos que están en `overlay/`, guarda una copia `.original` de cada uno y recompila. Es idempotente.

### Qué corrige, y por qué

| Archivo | Problema | Corrección |
|---|---|---|
| `config/ros2_controllers.yaml`<br>`config/controllers_5dof.yaml` | `gripper_controller` declarado como `parallel_gripper_action_controller/GripperActionController`, que **solo existe en Jazzy** | Pasa a `position_controllers/GripperActionController` |
| `config/moveit_controllers.yaml` | `ParallelGripperCommand`, también de Jazzy | Pasa a `GripperCommand` |
| `config/kinematics.yaml` | Usa el plugin **IKFast**, que no compila de forma fiable en Humble | Pasa a **KDL**, que resuelve este brazo sin problema |
| `config/so_arm_100.urdf.xacro`<br>`config/so_arm_100.srdf` | El xacro de MoveIt **no coincide** con el del paquete de descripción | Se reescribe con la misma estructura, y el robot pasa a llamarse `so_arm_100_5dof` |
| `launch/move_group.launch.py`<br>`launch/moveit_rviz.launch.py` | Los generadores de `moveit_configs_utils` no permiten pasar `use_sim_time` | Se construye el nodo a mano con `use_sim_time: true` |
| `launch/gz_moveit.launch.py` | No existía | **Archivo nuevo**: lanza Gazebo + `move_group` + RViz de una vez |

> ### El arreglo importante es el del URDF
> Sin el overlay, el error visible es el del `gripper_controller` — es el que aborta el lanzamiento y el que vas a ver primero. Pero debajo hay uno más profundo: **Gazebo y MoveIt cargaban dos URDF distintos** y no se entendían entre sí. Por eso `gz.launch.py` y `demo.launch.py` funcionaban por separado pero no juntos. Reescribir `so_arm_100.urdf.xacro` para que use la misma estructura que `so_arm_100_description` es lo que hace posible `gz_moveit.launch.py`.
>
> Y sin `use_sim_time: true`, MoveIt usa el reloj de pared mientras Gazebo usa el de simulación: las trayectorias quedan desfasadas aunque todo lo demás esté bien.

### Sobre la versión fijada

La fase 4 fija el clon en el commit `789b6b2c`, que es contra el que está verificado este overlay. Si `brukg/SO-100-arm` cambia esos archivos, el overlay podría no encajar.

Para usar la última versión del upstream y asumir el riesgo:

```bash
COMMIT_ROBOT=main bash ~/so-arm100-teleop/scripts/04_workspace.sh
```

### Volver a la configuración original

```bash
cd ~/ros2_ws/src/SO-100-arm/so_arm_100_moveit_config/config
for f in *.original; do cp "$f" "${f%.original}"; done
cd ~/ros2_ws && colcon build --symlink-install --packages-select so_arm_100_moveit_config
```

---

## 6. Cargar el workspace automáticamente

```bash
grep -qxF "source ~/ros2_ws/install/setup.bash" ~/.bashrc || echo "source ~/ros2_ws/install/setup.bash" >> ~/.bashrc
source ~/ros2_ws/install/setup.bash
```

---

## 7. Verificar que todo quedó bien

```bash
ros2 pkg list | grep so_arm
```

Debes ver:

```
so_arm_100
so_arm_100_bringup
so_arm_100_description
so_arm_100_moveit_config
```

Si ese comando no devuelve nada, es casi siempre porque **no hiciste `source` del workspace en esta terminal**. Cada terminal nueva necesita su `source` — por eso lo agregamos al `.bashrc`, pero las terminales que ya estaban abiertas antes no lo tienen.

También puedes correr el diagnóstico completo:

```bash
bash ~/so-arm100-teleop/scripts/verificar.sh
```

---

## El ciclo de trabajo, de aquí en adelante

Cada vez que modifiques código de un paquete de ROS:

```bash
cd ~/ros2_ws
colcon build --symlink-install
source install/setup.bash
```

Y cada terminal nueva en la que vayas a usar ROS necesita:

```bash
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash
```

(Ya está en tu `.bashrc`, así que en la práctica basta con abrir una terminal nueva.)

---

## Siguiente

**[→ 05 — Ejecución y control](05-ejecucion.md)**
