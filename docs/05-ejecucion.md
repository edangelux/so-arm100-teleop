# 05 — Ejecución y control

[← Anterior: workspace y compilación](04-workspace-y-compilacion.md) · [Volver al inicio](../README.md) · [Siguiente: solución de problemas →](06-solucion-de-problemas.md)

---

Se necesitan **dos terminales abiertas al mismo tiempo**. Una corre la simulación, la otra la teleoperación por visión.

---

## Terminal 1 — Simulación en Gazebo

```bash
cd ~/ros2_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
ros2 launch so_arm_100_bringup gz.launch.py
```

Se abre la ventana 3D de Gazebo con el brazo. **Espera a que cargue por completo** (la primera vez tarda más porque descarga y cachea las mallas).

En la consola, busca que los tres controladores queden activos:

```
Configured and activated joint_state_broadcaster
Configured and activated arm_controller
Configured and activated gripper_controller
```

### Argumentos disponibles

```bash
ros2 launch so_arm_100_bringup gz.launch.py dof:=5
ros2 launch so_arm_100_bringup gz.launch.py world:=empty
ros2 launch so_arm_100_bringup gz.launch.py prefix:=""
```

`dof:=5` es el valor por defecto y es el correcto para este proyecto.

> Si el comando falla con `Package 'so_arm_100_bringup' not found`, prueba también `ros2 launch so_arm_100 gz.launch.py` — el README original del repositorio usa el nombre del metapaquete. Si ninguno funciona, no hiciste `source ~/ros2_ws/install/setup.bash` en esta terminal.

### Comprobar que los controladores responden

Antes de lanzar la teleoperación, en una **tercera** terminal:

```bash
source /opt/ros/humble/setup.bash && source ~/ros2_ws/install/setup.bash
ros2 control list_controllers
ros2 topic list | grep joint_trajectory
```

Deberías ver `/arm_controller/joint_trajectory` en la lista de tópicos. Este paso vale la pena: si ese tópico no existe, el script de teleoperación va a publicar al vacío y el robot no se moverá **sin dar ningún error**.

---

## Terminal 2 — Teleoperación por visión

Abre otra terminal (**Ctrl + Alt + T**):

```bash
cd ~/ros2_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

Se abre una ventana con el video de tu cámara y el esqueleto detectado sobre tu brazo.

---

## Calibración — el paso que no se puede saltar

El sistema **no** mapea posiciones absolutas: mide **cuánto te has movido respecto a una postura de referencia**. Por eso hay que fijar esa referencia primero.

1. Siéntate frente a la cámara a una distancia cómoda (60–100 cm).
2. Deja el **brazo derecho** visible y en una postura neutra y relajada.
3. Presiona **`C`** o la **barra espaciadora**.

Ese instante queda registrado como el origen. A partir de ahí, el efector del robot parte de su posición `Home` y se mueve según te desplaces respecto a esa postura.

Puedes recalibrar cuantas veces quieras: si te cambiaste de silla, si la deriva se acumuló, o simplemente si el mapeo se siente descentrado, vuelve a presionar `C`.

---

## Controles

| Movimiento tuyo | Respuesta del robot |
|---|---|
| Mano a **izquierda / derecha** | La base rota |
| Mano **arriba / abajo** | Hombro y codo ajustan la altura del efector |
| Mano **hacia la cámara / alejándose** | Los eslabones se extienden o se recogen |
| **Pulgar junto al índice** (pellizco) | La pinza **cierra** |
| **Pulgar separado del índice** | La pinza **abre** |

| Tecla | Acción |
|---|---|
| `C` o `ESPACIO` | Calibrar el cero |
| `Q` o `ESC` | Salir |

Las teclas solo funcionan con **la ventana de video enfocada**, no con la terminal.

### Lo que ves en pantalla

```
Target: X=0.18 Y=0.00 Z=0.10     ← posición cartesiana objetivo del efector, en metros
Q: [0.00, -0.70, 0.70]           ← ángulos articulares en radianes (base, hombro, codo)
[C] Calibrar Cero | [Q] Salir
```

Si aparece un aviso de **singularidad**, significa que el punto objetivo está en el límite del alcance del brazo (demasiado lejos o demasiado pegado a la base). No es un fallo: el algoritmo ya está recortando el objetivo al alcance válido. Simplemente acerca la mano al centro de tu espacio de trabajo.

---

## Ajustar el comportamiento

Todos los parámetros están al inicio de `teleop_vision/teleop_vision.py` y también se pueden pasar como parámetros de ROS 2, sin editar el archivo:

```bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py \
    --ros-args \
    -p camera_index:=2 \
    -p smoothing:=0.25 \
    -p scale:=0.55
```

| Parámetro | Por defecto | Qué hace |
|---|---|---|
| `camera_index` | `0` | Índice de la cámara. Si tienes varias, prueba `1`, `2`… |
| `smoothing` | `0.35` | Filtro exponencial. **Más bajo = más suave pero con más retraso.** Súbelo si sientes lag, bájalo si tiembla. |
| `max_joint_step` | `0.08` | Radianes máximos de cambio por fotograma. Es el freno de seguridad contra saltos bruscos. |
| `scale` | `0.40` | Cuánto se traduce tu movimiento al del robot. Súbelo para cubrir más alcance con menos movimiento corporal. |
| `arm_topic` | `/arm_controller/joint_trajectory` | Tópico del controlador del brazo |
| `gripper_topic` | `/gripper_controller/joint_trajectory` | Tópico del controlador de la pinza |
| `gripper_joint` | `Gripper` | Nombre del joint de la pinza en el URDF |
| `x_min` / `x_max` | `0.07` / `0.20` | Límites del espacio de trabajo en X (metros) |
| `y_abs` | `0.13` | Límite lateral en Y, simétrico (metros) |
| `z_min` / `z_max` | `-0.05` / `0.16` | Límites de altura en Z (metros) |

### Sobre los límites del espacio de trabajo

El SO-ARM100 tiene un alcance físico de **L1 + L2 = 0.116 + 0.135 = 0.251 m**. Cualquier punto que se le ordene más lejos que eso es imposible: la cinemática inversa lo proyecta al borde de la esfera alcanzable y el brazo se queda "pegado" al límite en lugar de seguir tu mano.

Los límites por defecto (`X 0.07–0.20`, `Y ±0.13`, `Z −0.05–0.16`) están ajustados para que **el 97 % de esa caja sea realmente alcanzable**. Con una caja más amplia —por ejemplo `X` hasta `0.28`— más de la mitad de los puntos caen fuera del alcance, el aviso de singularidad queda encendido casi todo el tiempo y el control se siente rígido.

Si quieres más recorrido, no amplíes la caja: **sube `scale`**. Así cubres el mismo volumen alcanzable con menos movimiento corporal.

```bash
# más recorrido del robot con el mismo movimiento tuyo
python3 teleop_vision.py --ros-args -p scale:=0.60
```

> ### Si el brazo se mueve pero la pinza no
> En la configuración original del repositorio, `gripper_controller` es de tipo `parallel_gripper_action_controller/GripperActionController`, que **se comanda por una acción, no por el tópico `joint_trajectory`**. En ese caso el tópico `/gripper_controller/joint_trajectory` no existe y los mensajes se pierden en silencio.
>
> Verifica cuál es tu caso:
>
> ```bash
> ros2 control list_controllers
> ros2 topic list | grep gripper
> ```
>
> - Si ves `/gripper_effort_controller/joint_trajectory`, apunta ahí:
>   ```bash
>   python3 teleop_vision.py --ros-args -p gripper_topic:=/gripper_effort_controller/joint_trajectory
>   ```
> - Si prefieres cambiar el controlador, edita `so_arm_100_moveit_config/config/ros2_controllers.yaml` y define `gripper_controller` como `joint_trajectory_controller/JointTrajectoryController` sobre el joint `Gripper`. Luego recompila.
>
> El script imprime al arrancar los tópicos a los que está publicando, para que veas de inmediato si coinciden con los de tu sistema.

---

## Consejos de uso

- **Iluminación pareja y frontal.** MediaPipe pierde el tracking con contraluz o con una ventana detrás.
- **Fondo despejado.** Otras personas en cuadro confunden el detector de pose.
- **Ropa que contraste** con el fondo mejora bastante la detección.
- Si vas a grabar la demostración para la defensa, deja Gazebo y la ventana de video lado a lado — se aprecia mejor la correspondencia entre tu movimiento y el del robot.

---

## Siguiente

**[→ 06 — Solución de problemas](06-solucion-de-problemas.md)**
