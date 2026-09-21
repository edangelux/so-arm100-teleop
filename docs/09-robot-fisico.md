# 09 — Estado del robot físico

[← Anterior: análisis cinemático](08-analisis-cinematico.md) · [Volver al inicio](../README.md) · [Siguiente: espejo simulación ↔ robot real →](10-espejo-simulacion-y-robot-real.md)

---

> ## Resumen en una línea
>
> **El brazo físico se operó con éxito y se presentó en funcionamiento en septiembre de 2026. De los seis bloqueos identificados antes de tenerlo, tres se resolvieron, dos se sortearon por otra vía y uno se conservó como limitación conocida.**

Este documento cambió de conclusión dos veces. La primera versión, escrita **leyendo el código sin el hardware delante**, declaraba bloqueado el brazo físico y enumeraba seis bloqueos. La segunda registró que cuatro se habían resuelto sobre ROS 2 Humble y que dos seguían abiertos. Esta tercera versión recoge lo que ocurrió después: el brazo se ensambló, se puso en marcha, se midió y se presentó.

**Los seis bloqueos se conservan abajo con su diagnóstico original**, cada uno con su desenlace, porque la predicción hecha sin el brazo se cumplió en lo esencial y sirve de referencia a quien reproduzca el trabajo.

---

## Estado por componente

| Componente | Estado | Evidencia |
|---|---|---|
| Ubuntu 22.04 → ROS 2 Humble → Gazebo → MoveIt 2 → teleoperación por visión | **Verificado en simulación** | Instalación real desde cero |
| *Plan & Execute* de MoveIt sobre el robot simulado | **Verificado en simulación** | Instalación real desde cero |
| [Instalación nativa por ISO / USB](02-instalacion-nativa-iso.md) | **No verificada desde cero** | — |
| Interfaz de hardware (`so_arm_100_hardware`) sobre Humble | **Operada** | Compilada el 6 de agosto; activada en 23 sesiones entre el 9 y el 19 de septiembre |
| Comunicación con los seis servos por `/dev/ttyACM0` | **Operada** | Registros de `ros2_control_node`: seis servos inicializados en cada sesión |
| Controladores del lado físico (`hardware_controllers.yaml`) | **Operados** | Activados bajo el espacio de nombres `/real` |
| Arquitectura de doble planta (espacio de nombres `/real`) | **Operada** | Secuencia de la defensa, [docs/10](10-espejo-simulacion-y-robot-real.md) |
| Nodos espejo (`trajectory_mirror`) | **Operados en la defensa** | Historial de órdenes del equipo de la entrega |
| Cámara bajo WSL2 con paso por USB/IP | **Verificada** | 10 de septiembre, [docs/11](11-instalacion-wsl2.md) |
| Referencia angular del brazo | **Centrado eléctrico en 2048 pasos** | Bloqueo 4 |
| Límites de seguridad del nodo de teleoperación | **Limitación conocida** | Bloqueo 6 |

### Qué registran exactamente las sesiones de hardware

El respaldo del equipo con el que se presentó el proyecto conserva 29 registros de `ros2_control_node`. En **23** de ellos la interfaz de hardware inicializó los seis servos, abrió el puerto y se activó. Un extracto está en [`pruebas/evidencia_ros_extracto.txt`](../pruebas/evidencia_ros_extracto.txt):

```text
[SOARM100Interface]: Servo 1 initialized at position 2046
...
[SOARM100Interface]: Servo 6 initialized at position 1960
[SOARM100Interface]: Serial communication initialized on /dev/ttyACM0
[SOARM100Interface]: Hardware interface activated
```

Las sesiones se reparten entre el 9 y el 19 de septiembre de 2026, con la mayor concentración el 12 de septiembre, cuando se trabajó la arquitectura de réplica.

---

## Cómo instalar el lado físico

Después de las fases 1 a 5:

```bash
bash ~/so-arm100-teleop/scripts/06_brazo_fisico.sh
```

La fase 6 clona el driver en un commit fijo, le aplica el parche de Humble, aplica el parche del lado físico a `SO-100-arm`, instala el paquete espejo y agrega el usuario al grupo `dialout`. Lo que **no** hace es fijar la referencia angular del brazo ni tocar los límites de seguridad del nodo de teleoperación; ambas cosas se explican abajo.

El workspace exacto con el que se presentó el proyecto se reconstruye aparte con `bash scripts/07_restaurar_entrega.sh`, y se opera con `bash scripts/soarm.sh`; véase [docs/14](14-lanzador-v13.md).

Los parches viven en `brazo-fisico/parches/` y están anclados a un commit concreto de cada repositorio original. Eso es deliberado: si `brukg` avanza mañana, el parche sigue aplicando.

---

## Los seis bloqueos, y qué pasó con cada uno

### 1. El paquete del driver no se instala, y no tiene versión para Humble — **RESUELTO**

**El diagnóstico original decía:**

> *"Hay que compilarlo desde el código fuente sobre Humble. Puede que compile sin cambios; puede que no. Nadie lo ha comprobado. Y si el plugin no carga, `controller_manager` aborta y no arranca nada."*

**Lo que ocurrió: no compila sin cambios, y hay dos motivos distintos.**

**Motivo A — el enlazado de `yaml-cpp`.** Primer intento de compilación:

```
CMake Error at CMakeLists.txt:20 (add_library):
  Target "so_arm_100_hardware" links to target "yaml-cpp::yaml-cpp" but the
  target was not found.
```

La versión de `yaml-cpp` que trae Ubuntu 22.04 no exporta el objetivo con espacio de nombres. El arreglo es de una línea:

```cmake
-  yaml-cpp::yaml-cpp
+  yaml-cpp
```

**Motivo B — la API de `ros2_control` es la de Jazzy.** Segundo intento:

```
error: 'HardwareComponentInterfaceParams' in namespace 'hardware_interface'
       does not name a type
   39 |   CallbackReturn on_init(const hardware_interface::HardwareComponentInterfaceParams & params) override;
```

`HardwareComponentInterfaceParams` no existe en Humble; se introdujo después. Hay que retro-portar la firma de `on_init` y los seis accesos a parámetros que dependían de ella:

```cpp
// Repositorio original (Jazzy)
CallbackReturn on_init(const hardware_interface::HardwareComponentInterfaceParams & params)

// Retro-porte a Humble
CallbackReturn on_init(const hardware_interface::HardwareInfo & info)
```

Ambos cambios están en `brazo-fisico/parches/01-so_arm_100_hardware-humble.patch`, tres archivos en total.

**Cómo se verificó.** El símbolo exportado por el binario compilado:

```bash
nm -DC libso_arm_100_hardware.so | grep on_init
# so_arm_100_controller::SOARM100Interface::on_init(hardware_interface::HardwareInfo const&)
```

La firma que quedó **dentro** del binario es la de Humble. Y se enlazó contra Humble, no contra Jazzy:

```bash
strings libso_arm_100_hardware.so | grep -o "/opt/ros/[a-z]*" | sort -u
# /opt/ros/humble
```

Se comprobó además la cadena completa del plugin, que es donde esto suele romperse en silencio:

| Eslabón | Valor |
|---|---|
| Nombre declarado en el XML del paquete | `so_arm_100_controller/SOARM100Interface` |
| Referencia en el xacro del lado físico | `so_arm_100_controller/SOARM100Interface` |
| Clase base | `hardware_interface::SystemInterface` |
| Índice de pluginlib instalado | `hardware_interface__pluginlib__plugin/so_arm_100_hardware` |

Coinciden. El plugin carga.

---

### 2. El controlador de la pinza es el de Jazzy — **RESUELTO**

**El diagnóstico original decía:**

> *"`parallel_gripper_action_controller` no existe en Humble. El arreglo probablemente es el mismo cambio de una línea. Pero hay que hacerlo con el brazo conectado."*

Era el mismo cambio de una línea, aplicado a `hardware_controllers.yaml`:

```yaml
-      type: parallel_gripper_action_controller/GripperActionController
+      type: position_controllers/GripperActionController
```

Está en el parche 02. Vale la pena registrar que **se llegó a esta corrección dos veces por separado**: una en este repositorio para la simulación, otra de forma independiente para el lado físico. La coincidencia confirma el diagnóstico.

---

### 3. El overlay se come los parámetros del puerto serie — **SORTEADO en la entrega**

Sigue vigente, palabra por palabra. El overlay de la fase 5 reemplaza `so_arm_100_moveit_config/config/so_arm_100.urdf.xacro` por una versión adaptada a la simulación, y esa versión **no declara** los cuatro argumentos del puerto serie:

| Argumento xacro | Original | Overlay de este repositorio |
|---|---|---|
| `serial_port` | declarado | **falta** |
| `serial_baudrate` | declarado | **falta** |
| `servo_speed` | declarado | **falta** |
| `servo_acceleration` | declarado | **falta** |

**Consecuencia:** lanzar con `serial_port:=/dev/ttyACM0` no hace nada; se ignora en silencio y se cae al valor por omisión `/dev/ttyUSB0`. Es el escenario del [issue #10 del repositorio original](https://github.com/brukg/SO-100-arm/issues/10).

**Por qué no se corrigió en el overlay.** El montaje sobre el que se verificó el lado físico usó el xacro **original**, no el del overlay, y por eso allí el problema no se manifestó. Aplicar el arreglo a ciegas al xacro del overlay habría significado escribir configuración de hardware sin probarla, que es precisamente lo que este documento se negó a hacer.

**El arreglo** es volver a declarar los cuatro argumentos y pasarlos a la macro `so_arm_100_5dof_system`. Si la placa enumera como `ttyACM0`, el xacro del overlay no sirve para el lado físico.

> **Desenlace.** En el workspace de la entrega el brazo físico se lanzó con `hardware.launch.py`, y el xacro de ese árbol **sí declara** los cuatro argumentos. Por eso `serial_port:=/dev/ttyACM0` llegó al driver, como confirman los registros: `Serial communication initialized on /dev/ttyACM0`. El defecto del overlay de la fase 5 sigue presente en `overlay/`, que es la ruta de simulación, y se documenta para quien intente usarla con el brazo.

---

### 4. Sin calibración, los ángulos están mal — **SORTEADO por centrado eléctrico**

Sigue vigente y ahora se sabe algo más, que empeora el asunto: el `calibration.yaml` que circula con el repositorio original **no es un archivo vacío ni un valor por omisión neutro. Es una calibración real, de otro brazo**, fechada:

```yaml
timestamp: '2025-02-02T13:26:42.812769'
```

Con valores concretos en pasos de codificador —centro del hombro en 1703, centro del codo en 1152— que corresponden a un brazo montado por otra persona, con los servos en otra posición angular.

**Es peor que no tener calibración**, porque un archivo ausente da un error visible y un archivo equivocado da movimiento equivocado. Un brazo comandado con esta calibración va a ángulos distintos de los pedidos y puede empujar contra sus propios topes mecánicos.

> **Desenlace.** El riesgo no llegó a materializarse, por una razón que se comprobó en el código recuperado: el driver sólo carga ese archivo si recibe el parámetro `calibration_file`, y **ningún archivo de lanzamiento ni la descripción `ros2_control` de la entrega lo define**. Sin él, el driver usa su conversión por omisión, que toma como cero **2048 pasos**, la posición central del codificador, en los seis servos (`zero_positions_` en `so_arm_100_interface.hpp`). La referencia angular se fijó entonces por otra vía: **cada servo se llevó a 2048 pasos con `center_one` antes de montarse en su eslabón**, de modo que el centro eléctrico coincidió con el cero mecánico del modelo. En una de las sesiones registradas, arrancada con el brazo en su postura centrada, los cinco servos del brazo se inicializaron entre 2046 y 2050 pasos. El archivo de 2025 se excluyó del material publicado.

Si en lugar del centrado se prefiere una calibración por recorrido, se ejecuta con el brazo sostenido o apoyado:

```bash
ros2 run so_arm_100_hardware calibrate_arm.py
```

Y después se comprueba que el archivo generado lleve **la fecha del día**:

```bash
head -1 ~/ros2_ws/src/so_arm_100_hardware/config/calibration.yaml
```

Si sale `2025-02-02`, la calibración no corrió.

> Un `Permission denied` al ejecutarlo significa que el guion perdió el bit de ejecución al pasar por Windows o por un archivo comprimido:
> ```bash
> chmod +x ~/ros2_ws/src/so_arm_100_hardware/scripts/*.py
> ```

---

### 5. Permisos del puerto serie — **RESUELTO**

Lo hace la fase 6:

```bash
sudo usermod -a -G dialout $USER
```

**Hay que cerrar sesión y volver a entrar** para que surta efecto. En máquina virtual hace falta además pasar el dispositivo USB a la VM (*Dispositivos → USB*), cubierto en [docs/01](01-instalacion-maquina-virtual.md), captura `vm-21`. Bajo WSL2 el procedimiento es distinto y está en [docs/11](11-instalacion-wsl2.md).

---

### 6. El nodo de teleoperación no es seguro para hardware real — **LIMITACIÓN CONOCIDA. Leer antes de conectar**

**Es el único de los seis que no se resolvió**, y el más importante, porque los otros impedían que el brazo se moviera y éste hace que se mueva mal.

Se verificó que el nodo, en la versión que se ejecutó contra el brazo, **conserva las tres características**:

```python
MAX_JOINT_VEL = 8.0                                  # rad/s  ≈ 458 °/s
q_cmd = [0.0]*5                                      # al arrancar
q_cmd = [0.0]*5                                      # otra vez al recalibrar con C
p.time_from_start = Duration(sec=0, nanosec=40000000)
```

y que **no se suscribe a `/joint_states`** en ningún punto.

**a) No sabe dónde está el brazo.** El primer mensaje publicado dice «estar en todo-ceros dentro de 40 ms». En Gazebo el robot aparece en cero y coincide. El brazo físico arranca donde quedó, y los servos van a intentar llegar a la postura de inicio a la máxima velocidad que puedan, desde donde estén. Lo mismo cada vez que se presiona `C` para recalibrar.

**b) El tope de velocidad es de simulación.** 8,0 rad/s se dejó alto a propósito (`[E3]` en la cabecera del script) porque el filtro One Euro es el que suaviza de verdad y el tope solo es red de seguridad. Para un servo Feetech con la inercia del brazo y carga en la pinza, no tiene sentido.

**c) No hay compensación de gravedad.** En Gazebo el controlador mantiene la posición sin esfuerzo. En el brazo real, una consigna de posición pura puede no sostener el brazo extendido, y la diferencia no se realimenta a ninguna parte.

**Lo mínimo antes de conectar:**

1. Suscribirse a `/joint_states` e inicializar `q_cmd` con la postura real.
2. Al calibrar, **no** saltar a cero: partir de la postura actual.
3. Bajar `MAX_JOINT_VEL` a 0,5–1,0 rad/s y subirlo solo después de probar.
4. Aumentar `time_from_start` a algo que el servo pueda cumplir.
5. Rampa de arranque: los primeros segundos, muy despacio.

**Ninguno de los cinco está aplicado en este repositorio.** No se aplicaron a ciegas por la misma razón que el bloqueo 3, y porque cambiar un tope de velocidad sin medir el resultado es cambiar un riesgo conocido por uno desconocido.

> **Desenlace.** La versión 13, la que se presentó, **conserva las tres características**: `MAX_JOINT_VEL = 8.0`, `q_cmd = [0.0]*5` al arrancar y al recalibrar, y ningún suscriptor de `/joint_states`. El brazo se operó así durante la puesta en marcha y la defensa. Los registros muestran que el brazo no siempre arrancó cerca del cero que el nodo supone: en varias sesiones el cabeceo de hombro se inicializó en torno a 924 pasos y el codo en 2990, es decir, a más de 80° del centro. **En esas condiciones, el primer mensaje del nodo ordena un desplazamiento grande en 40 ms**, que es exactamente el riesgo descrito arriba. Los cinco cambios de la lista quedan como la primera línea de continuación del trabajo, y el lanzador expone `--velocidad` para bajar el tope sin editar el código.

---

## El registro de operación

La versión anterior de este documento terminaba con cuatro comandos para tomar el registro que faltaba, y advertía que la fila «registro de comunicación con los servos» diría *no existe* hasta que alguien los ejecutara. **Ese registro existe ahora**, aunque no se tomó con esos cuatro comandos sino con los propios registros de `ros2_control`, que el sistema escribe solo en `~/.ros/log/` en cada lanzamiento. Son los que se recuperaron del respaldo y resume la sección [Qué registran exactamente las sesiones de hardware](#qué-registran-exactamente-las-sesiones-de-hardware).

Los cuatro comandos siguen siendo la forma más directa de verificar un montaje nuevo, con el brazo conectado:

```bash
ros2 control list_hardware_interfaces -c /real/controller_manager   # 1. hardware reconocido
ros2 control list_controllers -c /real/controller_manager           # 2. controladores activos
timeout 10 ros2 topic echo /real/joint_states                       # 3. telemetría de los codificadores
timeout 10 ros2 topic echo /real/arm_controller/joint_trajectory    # 4. consignas que llegan al brazo
```

**El tercero es el decisivo.** Mientras corre, se mueve el brazo con la mano: si las posiciones cambian, los codificadores magnéticos están reportando por el bus serie, y eso no admite otra lectura.

---

## Orden recomendado, con el riesgo de cada paso

| # | Paso | Estado | Riesgo |
|---|---|---|---|
| 1 | `bash scripts/06_brazo_fisico.sh` | Automatizado | Bajo |
| 2 | Cerrar sesión y volver a entrar (grupo `dialout`) | Manual | Ninguno |
| 3 | Identificar el puerto (`ls /dev/ttyUSB* /dev/ttyACM*`) | Manual | Ninguno |
| 4 | Si la placa es `ttyACM0`: ver bloqueo 3 | Manual | Bajo |
| 5 | Centrar cada servo en 2048 pasos con `center_one` antes de montarlo (bloqueo 4) | Manual | Bajo |
| 6 | Mover **una sola** articulación pocos grados con `ros2 topic pub` | Manual | **Aquí se puede dañar algo** |
| 7 | Aplicar los límites de seguridad del bloqueo 6 | Manual | Medio |
| 8 | Comprobar el registro de operación (arriba) | Manual | Bajo |
| 9 | Recién entonces, teleoperar con el espejo: `bash scripts/soarm.sh ambos` — ver [docs/10](10-espejo-simulacion-y-robot-real.md) y [docs/14](14-lanzador-v13.md) | — | — |

**El paso 6 es el delicado.** Brazo apoyado, sin carga en la pinza, la mano en el interruptor de la fuente, una articulación, pocos grados.

---

## Por qué este documento dice también lo que no se resolvió

La versión anterior terminaba explicando por qué no se escribían los arreglos sin probarlos:

> *"Cada vez que en esta documentación se dio por bueno un valor sin probarlo, costó tiempo real. Escribir configuración de hardware sin el hardware delante reproduciría ese error, con la diferencia de que aquí el fallo no es un mensaje en la terminal: es un servo forzando contra un tope."*

Ese criterio se mantuvo hasta el final. Los bloqueos 1, 2 y 5 pasaron a resueltos porque **se probaron**; el 3 y el 4 figuran como sorteados porque la entrega los evitó por otra vía, sin corregir el defecto de origen; y el 6 figura como limitación porque la versión presentada lo conserva. Ninguno aparece como resuelto con un arreglo plausible que no se haya ejecutado.

Cada fila de la tabla de estado lleva su evidencia al lado. Una fila sin evidencia significa que nadie lo comprobó.

---

## Fuentes

- [`brukg/so_arm_100_hardware`](https://github.com/brukg/so_arm_100_hardware) — interfaz de hardware ros2_control
- [`so_arm_100_hardware` en el índice de ROS](https://index.ros.org/p/so_arm_100_hardware/) — versiones liberadas por distribución
- [`brukg/SO-100-arm`](https://github.com/brukg/SO-100-arm) — README con requisitos de hardware y procedimiento de calibración
- [Issue #10 — Error ros2_control_node when running hardware.launch.py](https://github.com/brukg/SO-100-arm/issues/10)
