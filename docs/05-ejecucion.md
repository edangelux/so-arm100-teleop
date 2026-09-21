# 05 — Ejecución y control

[← Anterior: workspace y compilación](04-workspace-y-compilacion.md) · [Volver al inicio](../README.md) · [Siguiente: solución de problemas →](06-solucion-de-problemas.md)

---

> **Versión presentada.** En la defensa se ejecutó `teleop_v13.py`, conservado en [`entrega/teleoperacion/`](../entrega/teleoperacion/). La forma más directa de ejecutarlo es el lanzador unificado, `bash scripts/soarm.sh sim`, descrito en [docs/14](14-lanzador-v13.md). Este documento explica la ejecución manual, terminal por terminal, que es la que permite entender qué se levanta y en qué orden. Los controles, la calibración y los parámetros que se describen abajo son los mismos en la versión 13.

Se necesitan **dos terminales abiertas al mismo tiempo**. Una ejecuta la simulación, la otra la teleoperación por visión.

---

## Terminal 1 — Simulación

```bash
cd ~/ros2_ws
ros2 launch so_arm_100_bringup gz_moveit.launch.py
```

Esto abre **tres cosas a la vez**: Gazebo (la física y el robot), `move_group` (el planificador de MoveIt) y RViz.

Se espera a que Gazebo cargue por completo —la primera vez tarda más porque guarda las mallas en caché— y a que la consola muestre los tres controladores activos:

```
Configured and activated joint_state_broadcaster
Configured and activated arm_controller
Configured and activated gripper_controller
```

> `gz_moveit.launch.py` no viene en el repositorio original: lo instala el overlay de la [fase 5](04-workspace-y-compilacion.md#5-overlay-de-configuración-verificada). Si el comando falla con *package not found*, corre `bash scripts/05_aplicar_overlay.sh`.

**Si la máquina virtual va justa de RAM**, se lanza sólo Gazebo, sin MoveIt ni RViz. Para la teleoperación es suficiente:

```bash
ros2 launch so_arm_100_bringup gz.launch.py
```

### Comprobar que los controladores responden

Antes de lanzar la teleoperación, en una **tercera** terminal:

```bash
ros2 control list_controllers
```

Debes ver los tres en `active`:

```
joint_state_broadcaster  joint_state_broadcaster/JointStateBroadcaster   active
arm_controller           joint_trajectory_controller/JointTrajectoryController  active
gripper_controller       position_controllers/GripperActionController    active
```

Y que existan la interfaz del brazo y la de la pinza:

```bash
ros2 topic list  | grep arm_controller      # /arm_controller/joint_trajectory
ros2 action list | grep gripper             # /gripper_controller/gripper_cmd
```

> **Son dos mecanismos distintos.** El brazo se comanda por un **tópico** (`/arm_controller/joint_trajectory`) y la pinza por una **acción** (`/gripper_controller/gripper_cmd`). No es un capricho: `position_controllers/GripperActionController` solo acepta acciones. El guion ya lo maneja, pero si el brazo se mueve y la pinza no, éste es el primer sitio donde mirar.

---

## Terminal 2 — Teleoperación por visión

```bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

Se abre una ventana con el video de la cámara, el esqueleto sobre el brazo del operador y un panel con el estado de cada articulación.

---

## Cómo funciona el mapeo

> Esta sección es el resumen. La explicación completa —nodos, tópicos, acciones, y el recorrido desde la cámara hasta la física de Gazebo— está en **[07 — Cómo funciona el sistema](07-como-funciona.md)**, y la justificación de por qué se copian ángulos en vez de resolver cinemática inversa, con mediciones, en **[08 — Análisis cinemático](08-analisis-cinematico.md)**.

El sistema **no** calcula dónde poner la mano del robot en el espacio. Hace algo más directo y más robusto: **mide los ángulos de las articulaciones del operador y los replica en el robot**, articulación por articulación.

| Tu cuerpo | Articulación del robot | Cómo se mide |
|---|---|---|
| Rotación del hombro | `Shoulder_Rotation` | 3D métrico (`pose_world_landmarks`) |
| Elevación del hombro | `Shoulder_Pitch` | 3D métrico |
| Flexión del codo | `Elbow` | 3D métrico |
| Flexión de la muñeca | `Wrist_Pitch` | 2D de imagen, antebrazo vs. mano |
| Giro de la muñeca | `Wrist_Roll` | 2D de imagen, antebrazo vs. línea de nudillos |
| Pellizco pulgar-índice | `Gripper` | 2D, normalizado por el tamaño de la palma |

Hombro y codo se calculan en **3D métrico** porque sus segmentos son largos y el tracking es fiable. Las muñecas se calculan **enteramente en 2D de imagen**, mezclando `pose_landmarks` (codo, muñeca) con `mp_hands` (21 puntos de nudillos): así los dos vectores viven en el mismo marco de referencia y con alta resolución. Mezclar marcos 3D y 2D fue una fuente real de ángulos inestables.

---

## Calibración — el paso que no se puede saltar

El sistema mide **cuánto se ha movido el operador respecto de una postura de referencia**, no posiciones absolutas. Hay que fijar esa referencia primero.

1. El operador se sitúa frente a la cámara, a una distancia cómoda (60–100 cm).
2. El brazo queda en una postura neutra y relajada.
3. **La mano tiene que verse bien**: si no está visible al calibrar, las muñecas quedan sin referencia y el guion lo avisa.
4. Se presiona **`C`** o **`ESPACIO`**.

Esa postura pasa a ser el cero: todas las articulaciones del robot quedan en `0`. A partir de ahí, el robot replica los **cambios** respecto de esa postura.

Recalibra cuando quieras: si cambiaste de silla, si la deriva se acumuló, o si el mapeo se siente descentrado.

---

## Controles

| Tecla | Acción |
|---|---|
| **`C`** o **`ESPACIO`** | **Calibrar**: fija la postura actual como el cero |
| **`1`** … **`5`** | **Invertir el sentido** de esa articulación (cambia su signo) |
| **`TAB`** | Seleccionar la siguiente articulación (la marcada con `>`) |
| **`+`** / **`-`** | Subir o bajar la **ganancia** de la articulación seleccionada |
| **`B`** | Cambiar de **brazo** (derecho ↔ izquierdo). Requiere recalibrar |
| **`S`** | **Guardar** signos y ganancias en `~/teleop_config.json` |
| **`P`** | **Pausa** — deja de enviar comandos sin cerrar el programa |
| **`Q`** o **`ESC`** | Salir |

Las teclas funcionan con **la ventana de video enfocada**, no con la terminal.

### Las dos teclas que más se usan

**`1`–`5` para invertir un sentido.** Si el operador sube el brazo y el robot baja, esa articulación tiene el signo al revés; al presionar su número se invierte al instante. Depende de la cámara, de si la imagen está en espejo y de la lateralidad del operador — no hay un valor correcto universal.

**`S` para guardar.** Cuando tengas los signos y ganancias afinados, presiona `S`. Se guardan en `~/teleop_config.json` y se cargan solas la próxima vez.

> ### No borres `~/teleop_config.json` a la ligera
> Ese archivo guarda un ajuste que solo se consigue probando en vivo. Borrarlo devuelve todo a los valores por defecto del código, que pueden no ser los correctos para el montaje en uso. Antes de reiniciarlo conviene hacer una copia:
> ```bash
> cp ~/teleop_config.json ~/teleop_config.json.bak
> ```

---

## Lo que muestra la pantalla

```
v13 SIGNOS RESTAURADOS | RIGHT
>1 Shoulder_Rotation   +0.123 s=+1 g=1.0   ●────┼────
 2 Shoulder_Pitch      -0.045 s=-1 g=1.0   ──●──┼────
 3 Elbow               +0.310 s=-1 g=1.0   ────┼─●──
 4 Wrist_Pitch         +0.000 s=-1 g=1.0   ────┼────
 5 Wrist_Roll          +0.000 s=+1 g=1.0   ────┼────
Gripper +0.42 [OK]
MANO DETECTADA
w=0.00042   24.3 FPS
COPIANDO POSTURA
```

| Elemento | Qué significa |
|---|---|
| `>` | La articulación seleccionada con `TAB` |
| `s=+1` / `s=-1` | Signo actual — se invierte con la tecla del número |
| `g=1.0` | Ganancia — se ajusta con `+` / `-` |
| La barra a la derecha | Posición dentro del rango del joint; la línea blanca es el cero |
| `Gripper ... [OK]` | La acción de la pinza está disponible. Si dice `[accion NO disp.]`, el `gripper_controller` no está activo |
| `w=0.00042` | Índice de manipulabilidad `√det(J·Jᵀ)` del jacobiano de posición de 3×3 de las tres primeras articulaciones: cuánto margen de movimiento tiene el brazo en esa postura. Cerca de cero = cerca de una singularidad. Solo informativo — ver [08](08-analisis-cinematico.md) |
| `COPIANDO POSTURA` | Estado. Si dice `PULSA [C]`, aún no has calibrado |

### Los tres estados de la muñeca

| Mensaje | Qué pasa |
|---|---|
| `MANO DETECTADA` (verde) | Todo bien, las muñecas siguen la mano |
| `MANO NO DETECTADA` (rojo) | No se ve la mano; las muñecas se **congelan** en el último valor válido |
| `MUÑECA EN ESCORZO` (naranja) | La mano se ve, pero el antebrazo apunta hacia la cámara. En esa postura la proyección 2D se acorta casi a cero y cualquier ruido se amplifica en un ángulo enorme, así que el script **congela** las muñecas en vez de comandar un valor no fiable |

Si `MUÑECA EN ESCORZO` aparece a menudo, conviene girar el cuerpo para que el antebrazo quede más **perpendicular** a la cámara en lugar de apuntando hacia ella.

---

## Ajuste fino

Los parámetros están al inicio de `teleop_vision.py`:

| Constante | Qué hace |
|---|---|
| `ONE_EURO` | Filtro por articulación. `min_cutoff` bajo suaviza más en reposo; `beta` alto responde más rápido al movimiento |
| `DEADZONE` | Movimiento mínimo, en radianes, antes de que la articulación reaccione. Se sube si tiembla en reposo |
| `JOINT_LIMITS` | Límites articulares. **Copian los `<limit>` del URDF real** — no los amplíes: el script mostraría números que la física de Gazebo ya no puede seguir |
| `GRIPPER_LIMITS` | `(-0.17, 1.56)`, también del URDF |
| `MIN_FORE_LEN` etc. | Umbrales de detección de escorzo. Bájalos si las muñecas se congelan demasiado |
| `HANDS_EVERY` | Cada cuántos fotogramas se corre el detector de manos. Se sube a 3 o 4 si el procesador va justo |

> ### Sobre el filtro One Euro
> La versión anterior usaba un promedio exponencial (EMA), que obliga a elegir: o suaviza y va con retraso, o responde y tiembla. El **filtro One Euro** adapta su frecuencia de corte a la velocidad del movimiento — filtra fuerte ante movimientos lentos (elimina el temblor) y poco ante movimientos rápidos (sin retraso perceptible). Es el estándar para tracking de movimiento humano.

---

## Consejos de uso

- **Iluminación pareja y frontal.** MediaPipe pierde el tracking a contraluz.
- **Fondo despejado.** Otras personas en cuadro confunden al detector de pose.
- **Antebrazo perpendicular a la cámara** siempre que sea posible, para evitar el escorzo.
- Para grabar una demostración, Gazebo y la ventana de video se colocan lado a lado.
- Signos y ganancias se afinan **una vez** y se guardan con `S`; después no hace falta volver a tocarlos.

---

## Siguiente

**[→ 06 — Solución de problemas](06-solucion-de-problemas.md)**
