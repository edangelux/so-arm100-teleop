# 15 — Versión 14, MoveIt junto a la teleoperación y posturas seguras

[← Anterior: lanzador unificado](14-lanzador-v13.md) · [Volver al inicio](../README.md) · [Siguiente: v15, estimación de ángulos →](16-v15-estimacion-de-angulos.md)

---

> **Estado (21 de septiembre de 2026):** probado en simulación (cierre en `init`, menú y `home`) y con el brazo físico en modo `real` con `--v14` (cierre en `init` y apagado en `home`). **`--moveit` no se ha comprobado todavía** en ningún modo, ni el modo `ambos` con estas funciones. Los resultados están en [Resultados](#resultados). La versión 13, la presentada en la defensa, sigue intacta en `entrega/teleoperacion/teleop_v13.py` y sigue siendo la que el lanzador usa por omisión.

Este capítulo agrega tres cosas al sistema presentado:

1. **Posturas seguras al cerrar y al apagar.** Al cerrar la teleoperación, el brazo va a `init` y se queda sostenido. Al apagar, puede ir antes a `home`, una postura de reposo en la que no cae al perder el par.
2. **La versión 14 de la teleoperación**, que arranca y reanuda desde la postura real del brazo en lugar de suponerla.
3. **MoveIt 2 y RViz dentro de la misma sesión.** Se pausa la teleoperación, se planifica y ejecuta con MoveIt y se reanuda sin salto.

Las tres parten del mismo problema, el **bloqueo 6** de [docs/09](09-robot-fisico.md): la versión 13 no sabe dónde está el brazo.

---

## El problema de fondo

La versión 13 guarda en memoria la última posición que ordenó (`q_cmd`) y nunca la compara con la posición real. Eso produce un tirón en tres situaciones:

| Situación | Qué hace v13 | Qué pasa en el brazo |
|---|---|---|
| Arranque | `q_cmd` empieza en cero y se publica desde el primer cuadro | Si el brazo no estaba en cero, va hasta allí en 40 ms |
| Calibración con `C` | `q_cmd` vuelve a cero | Salto a cero desde donde esté |
| Reanudar tras `P`, después de mover el brazo con MoveIt | Vuelve a publicar el `q_cmd` viejo | Salto a la postura que tenía antes de la pausa |

Cuarenta milisegundos para recorrer, por ejemplo, un radián equivalen a unos 25 rad/s. El servo no puede seguir esa orden: acelera al máximo, y el movimiento resultante es un golpe sobre los engranajes y sobre lo que esté cerca.

Además, cuando el lanzador termina, el controlador del brazo (`so_arm_100_hardware`, en `on_deactivate`) **desactiva el par de los seis servos**. Sin par, el brazo cae por su propio peso desde la postura en que estuviera.

---

## 1. Posturas seguras: `init` y `home`

Las dos posturas son las que ya declaraba la configuración de MoveIt del proyecto (`so_arm_100_moveit_config/config/so_arm_100.srdf`). Se copian a `scripts/poses_seguras.json`, que es el archivo que las define para el lanzador:

| Postura | Shoulder_Rotation | Shoulder_Pitch | Elbow | Wrist_Pitch | Wrist_Roll | Para qué |
|---|---:|---:|---:|---:|---:|---|
| `init` | 0 | 0 | 0 | 0 | 0 | Referencia de trabajo: es la postura cero del modelo, la misma a la que lleva `center_servos` (2048 pasos) |
| `home` | 0 | −1,4 | 1,4 | 1,0 | 1,5708 | Reposo: el brazo plegado sobre sí mismo, apto para quedar sin par |

Valores en radianes. Si `home` resultara incómoda en el montaje real (por ejemplo, porque la pinza toca la mesa), se corrige en `poses_seguras.json`, primero en Gazebo.

### Cómo se mueve el brazo a una postura: `scripts/ir_a_pose.py`

El programa hace seis cosas, en este orden:

1. **Lee la postura actual** en el tópico de estados articulares. Si en 5 s no llega nada, **no mueve el brazo**: sin saber dónde está, no se puede calcular un movimiento seguro.
2. **Comprueba que el controlador escucha** el tópico de trayectorias. Si no escucha, tampoco mueve nada.
3. **Calcula la duración** a partir de la articulación que más tiene que recorrer:

   ```
   duración = max( |objetivo_i − actual_i| ) / velocidad      (mínimo 1 s)
   ```

   Con la velocidad por omisión de 0,5 rad/s, ir de `init` a `home` (1,57 rad en la muñeca) toma unos 3,1 s. Así ninguna articulación supera los 0,5 rad/s, y las demás van más lentas porque todas llegan a la vez.
4. **Envía una sola trayectoria** con ese tiempo. El controlador `joint_trajectory_controller` interpola desde la postura actual hasta el objetivo.
5. **Comprueba que el brazo empezó a moverse.** Si en 1 s ninguna articulación se movió más de 0,02 rad, reenvía la trayectoria, hasta tres veces. Un mensaje publicado justo después de conectar puede perderse mientras DDS termina de enlazar el publicador con el controlador; así pasó en la primera prueba física (véase [Resultados](#resultados)).
6. **Espera a que el brazo llegue**, con un error máximo de 0,10 rad por articulación y un plazo de la duración más 4 s. Informa del error final de cada articulación y de cuál es la peor.

Recorta además cada objetivo a los mismos límites articulares que usa `teleop_v13.py`, de modo que nunca pide algo que la teleoperación tampoco pediría.

| Modo | Tópico al que envía | Estados que lee |
|---|---|---|
| `sim` | `/arm_controller/joint_trajectory` | `/joint_states` |
| `real` | `/real/arm_controller/joint_trajectory` | `/real/joint_states` |
| `ambos` | los dos anteriores | `/real/joint_states`, porque el brazo físico es el que puede dañarse |

La velocidad se cambia con la variable de entorno `SOARM_RETURN_VEL`, por ejemplo `SOARM_RETURN_VEL=0.3`.

### Qué pasa al cerrar

```
 Q en la ventana de visión
        │
        ▼
 la teleoperación termina ──► el lanzador lleva el brazo a init (0,5 rad/s)
                                         │
                                         ▼
          [Enter] reabrir     [h] home y apagar     [x] apagar sin mover
              │                     │                        │
     teleoperación nueva   brazo a home, luego        apagado inmediato:
     desde init            se apaga todo              el brazo pierde el par
```

El menú se contesta **en la terminal**, no en la ventana de la cámara: al pulsar `Q` esa ventana ya se cerró.

- **`Q` ya no apaga el robot.** Cierra la teleoperación, lleva el brazo a `init` y deja todo lo demás en marcha: Gazebo, el controlador, los espejos y, si se abrió, MoveIt. Mientras tanto el brazo mantiene el par en `init`, y se puede seguir usando MoveIt desde RViz.
- **`Enter`** reabre la teleoperación. Con la versión 13 esto también es seguro, porque la v13 arranca ordenando cero y el brazo ya está en `init`, que es cero.
- **`h`** lleva el brazo a `home` y, sólo si llegó, apaga la sesión. Si no pudo llegar, no apaga: pide sostener el brazo y elegir `x`, o reintentar.
- **`x`** apaga sin mover. El brazo pierde el par en la postura en que esté.
- **`Ctrl+C`**, en cualquier momento, apaga en el acto **sin mover el brazo**. Es deliberado: si alguien pulsa `Ctrl+C` porque algo va mal, el lanzador no debe iniciar un movimiento por su cuenta. La parada de emergencia sigue siendo el interruptor de la fuente.

Esto vale para las dos versiones de la teleoperación, porque lo hace el lanzador y no el programa de visión. El algoritmo de la v13 no cambia.

---

## 2. La versión 14: `teleop_vision/teleop_v14.py`

Es una copia de `teleop_v13.py` con cuatro cambios, marcados en el código como `[V14-1]` a `[V14-4]`. El seguimiento es idéntico: los ángulos de MediaPipe, los filtros One Euro, las zonas muertas, los signos, las ganancias, los límites y el horizonte de 40 ms. Para ver exactamente qué cambió:

```bash
diff entrega/teleoperacion/teleop_v13.py teleop_vision/teleop_v14.py
```

| Marca | Cambio | Por qué |
|---|---|---|
| `[V14-1]` | Se suscribe a los estados articulares (`/joint_states` en `sim`; `/real/joint_states` en `real` y `ambos`). Al arrancar espera hasta 10 s la primera postura medida y la usa como `q_cmd` inicial. Si no llega, no arranca | Elimina el salto a cero del arranque |
| `[V14-2]` | Al calibrar con `C` y al reanudar tras `P`, `q_cmd` se toma de la postura medida y no de la última enviada | Permite pausar, mover con MoveIt y reanudar sin salto |
| `[V14-3]` | Tras calibrar o reanudar entra en **SINCRONIZANDO**: el tope de velocidad baja a 0,5 rad/s hasta que la orden alcanza al gesto del operador (error menor que 0,10 rad en las cinco articulaciones). Después vuelve el tope normal | Si el operador está en una postura distinta de la del brazo, el brazo va hacia ella despacio en lugar de saltar |
| `[V14-4]` | No publica nada hasta la primera calibración. En pausa, igual que v13, no publica nada | Nada se mueve antes de que el operador esté listo |

### Cómo funciona la sincronización

El lazo de control de v13 ya limitaba cuánto puede cambiar `q_cmd` en cada cuadro:

```
q_cmd[i] ← q_cmd[i] + recorte( objetivo_i − q_cmd[i],  −v_max·Δt,  +v_max·Δt )
```

donde `objetivo_i` es el ángulo del operador filtrado y `Δt` el tiempo entre cuadros. La v14 no cambia esa fórmula: sólo cambia **desde dónde empieza** `q_cmd` (la postura medida) y **qué `v_max` usa** mientras sincroniza (0,5 rad/s en lugar de hasta 8 rad/s).

Un ejemplo: el brazo está en `init` y el operador calibra con el codo algo doblado. El objetivo de ese instante es cero, porque la postura de calibración define el cero, así que no hay nada que sincronizar. Otro ejemplo: se pausa, MoveIt lleva el brazo a `home` y se reanuda con el operador en otra postura. `q_cmd` parte de `home`, el brazo avanza a 0,5 rad/s hacia el gesto, y la pantalla muestra **SINCRONIZANDO: QUEDESE QUIETO**. Cuando la diferencia baja de 0,10 rad, la terminal imprime `SINCRONIZADO` y la teleoperación sigue con normalidad.

El operador debe **quedarse quieto** mientras dura la sincronización. Si se mueve más rápido que 0,5 rad/s, la orden no lo alcanza y la sincronización se prolonga, pero el brazo nunca va más rápido que ese tope.

---

## 3. MoveIt 2 y RViz dentro de la sesión: `--moveit`

```bash
bash scripts/soarm.sh sim   --moveit --v14 --camara "$CAM" --software-gl
bash scripts/soarm.sh ambos --moveit --v14 --camara "$CAM" --puerto /dev/ttyACM0 --software-gl
```

El lanzador abre `move_group` y RViz con `scripts/moveit/moveit_soarm.launch.py`. Ese launch reutiliza la configuración del proyecto (SRDF, cinemática, límites y la vista `moveit.rviz`) y sólo elige, según el modo, a qué controladores manda MoveIt y de dónde lee la postura:

| Modo | MoveIt manda a | Lee la postura en | Tiempo |
|---|---|---|---|
| `sim` | `/arm_controller` y `/gripper_controller` de Gazebo (`controladores_sim.yaml`) | `/joint_states` | simulado |
| `real` | `/real/arm_controller` y `/real/gripper_controller` (`controladores_real.yaml`) | `/real/joint_states` | de reloj |
| `ambos` | `mirror_controller` de `trajectory_mirror_node`, que reenvía cada plan a las dos plantas (el `moveit_controllers.yaml` del propio paquete, el mismo de la defensa) | `/joint_states` de Gazebo | simulado |

MoveIt es **auxiliar**: si RViz se cierra, el lanzador avisa y la teleoperación sigue.

### Cómo usarlo

1. Teleoperar con normalidad.
2. Pulsar **`P`** en la ventana de visión. La teleoperación deja de publicar.
3. En RViz, panel *MotionPlanning*, pestaña *Planning*: elegir el objetivo arrastrando el marcador del efector, o elegir `init` o `home` en *Goal State*. Pulsar **Plan** y revisar la trayectoria en pantalla; después, **Execute**.
4. Pulsar **`P`** otra vez. Con `--v14`, la teleoperación parte de donde dejó MoveIt el brazo y sincroniza despacio.

**No se debe ejecutar un plan con la teleoperación activa.** Los dos mandan al mismo controlador: cada cuadro de la teleoperación reemplaza la trayectoria de MoveIt, y el brazo alterna entre las dos órdenes.

**Con la versión 13 no se debe reanudar tras mover con MoveIt.** La v13 volvería a la postura anterior a la pausa en 40 ms. Con v13 lo seguro es cerrar con `Q`, que lleva el brazo a `init`, y reabrir con `Enter`.

---

## Secuencia de prueba

Todo esto es nuevo y no se ha ejecutado. Se prueba **primero en simulación**, después con el brazo físico solo y despacio, y al final con las dos plantas. En el brazo físico, siempre con la mano en el interruptor de la fuente.

```bash
cd ~/so-arm100-teleop && git pull
source ~/.soarm_env
```

| # | Orden | Qué comprobar |
|---|---|---|
| 1 | `bash scripts/soarm.sh sim --camara "$CAM" --software-gl` y salir con `Q` | Gazebo lleva el brazo a `init`; aparece el menú; `Enter` reabre; `h` lleva a `home` y apaga |
| 2 | Mirar `home` en Gazebo en el paso anterior | Que el brazo no atraviese la base ni el suelo. Si lo hace, se ajusta `scripts/poses_seguras.json` |
| 3 | `bash scripts/soarm.sh sim --v14 --camara "$CAM" --software-gl` | La terminal imprime `Postura medida`; al calibrar aparece SINCRONIZANDO y luego SINCRONIZADO |
| 4 | `bash scripts/soarm.sh sim --v14 --moveit --camara "$CAM" --software-gl` | RViz muestra el brazo; con `P`, Plan y Execute hacia `home`, Gazebo lo sigue; con `P` otra vez, no hay salto |
| 5 | `~/center_servos` y luego `bash scripts/soarm.sh real --v14 --camara "$CAM" --velocidad 0.5` | Igual que el 3, con el brazo físico. Al salir con `Q` va a `init`; con `h`, a `home` |
| 6 | `~/center_servos` y luego `bash scripts/soarm.sh ambos --v14 --moveit --camara "$CAM" --software-gl --velocidad 0.5` | Igual que el 4, con las dos plantas siguiendo a MoveIt |

Se guardan los registros de cada sesión (`~/.local/state/soarm/sesion-*`), incluidos `vision.log` y `moveit.log`, y lo que imprime la terminal al ir a `init` y a `home`: el error final de cada movimiento es el dato que muestra si la postura se alcanzó.

---

## Resultados

**Simulación.** Funcionaron el cierre en `init`, el menú y `home`. MoveIt y RViz (`--moveit`) quedan pendientes de comprobar.

**Qué abre cada modo.** `real` levanta sólo el controlador del brazo físico y la cámara: no abre Gazebo. MoveIt y RViz se abren sólo con `--moveit`. Para ver Gazebo, RViz y el brazo físico a la vez se usa `ambos --moveit`.

**Brazo físico, modo `real`, `--v14`, velocidad 0,5 rad/s:**

| Acción | Resultado impreso | Lectura |
|---|---|---|
| `Q` → `init` | desplazamiento 0,32 rad, 1,0 s; error máximo 0,080 rad | Llegó |
| `Enter`, `Q` → `init` | desplazamiento 0,09 rad, 1,0 s; error máximo 0,080 rad | Llegó |
| `h` → `home`, primer intento | desplazamiento 1,57 rad, 3,1 s; **no se alcanzó**, error 1,572 rad | El brazo no se movió: el error es el desplazamiento completo |
| `h` → `home`, segundo intento | error máximo 0,078 rad | Llegó; la sesión se apagó con el brazo en reposo |

Dos lecturas:

1. **El primer intento hacia `home` no movió nada.** El error final igual al desplazamiento pedido indica que la trayectoria nunca llegó al controlador. Es el comportamiento de un mensaje publicado antes de que DDS terminara de enlazar publicador y suscriptor. Se corrigió con el reenvío del paso 5.
2. **El error de llegada se quedó en unos 0,08 rad (4,6 grados)** en las tres llegadas, en el límite de la tolerancia de entonces. Es mayor que el error de posicionamiento medido en el proyecto (0,49 a 1,49 grados), así que probablemente una articulación cargada por la gravedad se queda corta. `ir_a_pose.py` ahora informa del error de cada articulación para saber cuál es, y la tolerancia pasa a 0,10 rad. El operador juzgó la postura `home` alcanzada suficiente para el reposo.

## Archivos

| Archivo | Qué es |
|---|---|
| `teleop_vision/teleop_v14.py` | La versión 14; cambios marcados `[V14-n]` |
| `teleop_vision/ejecutar_v14.py` | Envoltorio que le da las conexiones del modo, igual que `ejecutar_v13.py` |
| `teleop_vision/runtime_config.py` | Agrega el tópico de estados articulares de cada modo |
| `scripts/poses_seguras.json` | Definición de `init` y `home` |
| `scripts/ir_a_pose.py` | Lleva el brazo a una postura con nombre, a velocidad limitada |
| `scripts/moveit/moveit_soarm.launch.py` | MoveIt 2 y RViz según el modo |
| `scripts/moveit/controladores_sim.yaml` · `controladores_real.yaml` | A qué controladores manda MoveIt en `sim` y en `real` |
| `scripts/soarm.sh` | Opciones `--v14` y `--moveit`, retorno a `init` y menú de cierre |
