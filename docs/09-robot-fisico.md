# 09 — Estado del robot físico

[← Anterior: análisis cinemático](08-analisis-cinematico.md) · [Volver al inicio](../README.md) · [Siguiente: espejo simulación ↔ robot real →](10-espejo-simulacion-y-robot-real.md)

---

> ## Resumen en una línea
>
> **La cadena de software del brazo físico está compilada y verificada sobre ROS 2 Humble. Quedan dos cosas por hacer antes de conectar, y este documento dice exactamente cuáles.**

Este documento tuvo antes otra conclusión. Decía que el brazo físico estaba bloqueado y enumeraba seis bloqueos identificados **leyendo el código, sin el hardware delante**. Esa versión terminaba así:

> *"Cuando el brazo esté conectado, estos pasos se hacen y se prueban uno por uno, y este documento se convierte en la guía de la instalación física."*

Eso ya ocurrió, parcialmente. Cuatro de los seis bloqueos se resolvieron y se verificaron; dos siguen abiertos. **Los seis se conservan abajo con su diagnóstico original**, porque la predicción se cumplió al pie de la letra y sirve de referencia a quien reproduzca el trabajo.

---

## Estado por componente

| Componente | Estado | Quién y cuándo |
|---|---|---|
| Ubuntu 22.04 → ROS 2 Humble → Gazebo → MoveIt 2 → teleoperación por visión | **Verificado en simulación** | Instalación real desde cero |
| *Plan & Execute* de MoveIt sobre el robot simulado | **Verificado en simulación** | Instalación real desde cero |
| [Instalación nativa por ISO / USB](02-instalacion-nativa-iso.md) | **No verificado** | Nadie |
| Interfaz de hardware (`so_arm_100_hardware`) sobre Humble | **Compilado y verificado** | Cristhian Guido, WSL2, 06/08/2026 |
| Controladores del lado físico (`hardware_controllers.yaml`) | **Compilado y verificado** | Cristhian Guido, WSL2, 06/08/2026 |
| Arquitectura de doble planta (espacio de nombres `/real`) | **Compilado y verificado** | Cristhian Guido, WSL2, 12/09/2026 |
| Nodos espejo (`trajectory_mirror`) | **Compilado, sin registro de operación** | Cristhian Guido, WSL2, 12/09/2026 |
| Cámara bajo WSL2 con paso por USB/IP | **Verificado** | Cristhian Guido, 10/09/2026 — ver [docs/11](11-instalacion-wsl2.md) |
| **Calibración del brazo** | **No hecha** | — |
| **Límites de seguridad del nodo de teleoperación** | **Abierto** | — |
| **Registro de comunicación con los servos** | **No existe** | — |

### Qué significa exactamente «compilado y verificado»

Significa que el código compila, instala y expone el plugin correcto, comprobado sobre los binarios resultantes. **No** significa que exista un registro de los servos respondiendo por el bus serie. Ese registro no se ha tomado todavía; la sección [Generar el registro de operación](#generar-el-registro-de-operación) explica cómo, y son cuatro comandos.

Se distingue a propósito, porque son dos afirmaciones distintas y solo una está probada.

---

## Cómo instalar el lado físico

Después de las fases 1 a 5:

```bash
bash ~/so-arm100-teleop/scripts/06_brazo_fisico.sh
```

La fase 6 clona el driver en un commit fijo, le aplica el parche de Humble, aplica el parche del lado físico a `SO-100-arm`, instala el paquete espejo y te agrega al grupo `dialout`. Lo que **no** hace es calibrar tu brazo ni tocar los límites de seguridad del nodo de teleoperación: eso es responsabilidad tuya y está explicado abajo.

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

### 3. El overlay se come los parámetros del puerto serie — **ABIERTO**

Sigue vigente, palabra por palabra. El overlay de la fase 5 reemplaza `so_arm_100_moveit_config/config/so_arm_100.urdf.xacro` por una versión adaptada a la simulación, y esa versión **no declara** los cuatro argumentos del puerto serie:

| Argumento xacro | Original | Overlay de este repositorio |
|---|---|---|
| `serial_port` | declarado | **falta** |
| `serial_baudrate` | declarado | **falta** |
| `servo_speed` | declarado | **falta** |
| `servo_acceleration` | declarado | **falta** |

**Consecuencia:** lanzar con `serial_port:=/dev/ttyACM0` no hace nada; se ignora en silencio y se cae al valor por omisión `/dev/ttyUSB0`. Es el escenario del [issue #10 del repositorio original](https://github.com/brukg/SO-100-arm/issues/10).

**Por qué sigue abierto.** El montaje sobre el que se verificó el lado físico usa el xacro **original**, no el del overlay, y por eso allí el problema no se manifiesta. Aplicar el arreglo a ciegas al xacro del overlay significaría escribir configuración de hardware sin haberla probado, que es precisamente lo que este documento se negó a hacer antes y sigue negándose a hacer.

**El arreglo, cuando se pruebe**, es volver a declarar los cuatro argumentos y pasarlos a la macro `so_arm_100_5dof_system`. Mientras tanto: **si tu placa enumera como `ttyACM0`, no uses el xacro del overlay para el lado físico.**

---

### 4. Sin calibración, los ángulos están mal — **ABIERTO, y es obligatorio**

Sigue vigente y ahora se sabe algo más, que empeora el asunto: el `calibration.yaml` que circula con el repositorio original **no es un archivo vacío ni un valor por omisión neutro. Es una calibración real, de otro brazo**, fechada:

```yaml
timestamp: '2025-02-02T13:26:42.812769'
```

Con valores concretos en pasos de codificador — centro del hombro en 1703, centro del codo en 1152 — que corresponden a un brazo montado por otra persona, con los servos en otra posición angular.

**Es peor que no tener calibración**, porque un archivo ausente da un error visible y un archivo equivocado da movimiento equivocado. Si comandas tu brazo con esta calibración, va a ángulos que no son los que pides y puede empujar contra sus propios topes mecánicos.

**Obligatorio antes de energizar, con el brazo sostenido o apoyado:**

```bash
ros2 run so_arm_100_hardware calibrate_arm.py
```

Y después comprueba que el archivo generado lleve **la fecha de hoy**:

```bash
head -1 ~/ros2_ws/src/so_arm_100_hardware/config/calibration.yaml
```

Si sale `2025-02-02`, la calibración no corrió.

> Si obtienes `Permission denied` al ejecutarlo, es porque el script perdió el bit de ejecución al pasar por Windows o por un archivo comprimido:
> ```bash
> chmod +x ~/ros2_ws/src/so_arm_100_hardware/scripts/*.py
> ```

---

### 5. Permisos del puerto serie — **RESUELTO**

Lo hace la fase 6:

```bash
sudo usermod -a -G dialout $USER
```

**Tienes que cerrar sesión y volver a entrar** para que surta efecto. En máquina virtual hace falta además pasar el dispositivo USB a la VM (*Dispositivos → USB*), cubierto en [docs/01](01-instalacion-maquina-virtual.md), captura `vm-21`. Bajo WSL2 el procedimiento es distinto y está en [docs/11](11-instalacion-wsl2.md).

---

### 6. El nodo de teleoperación no es seguro para hardware real — **ABIERTO. Lee esto antes de conectar**

**Este bloqueo sigue íntegro y es el más importante de los dos que quedan**, porque los otros impiden que el brazo se mueva y este hace que se mueva mal.

Se verificó que el nodo, en la versión que se ejecutó contra el brazo, **conserva las tres características**:

```python
MAX_JOINT_VEL = 8.0                                  # rad/s  ≈ 458 °/s
q_cmd = [0.0]*5                                      # al arrancar
q_cmd = [0.0]*5                                      # otra vez al recalibrar con C
p.time_from_start = Duration(sec=0, nanosec=40000000)
```

y que **no se suscribe a `/joint_states`** en ningún punto.

**a) No sabe dónde está el brazo.** El primer mensaje publicado dice «estar en todo-ceros dentro de 40 ms». En Gazebo el robot aparece en cero y coincide. El brazo físico arranca donde lo dejaste, y los servos van a intentar llegar a la postura de inicio a la máxima velocidad que puedan, desde donde estén. Lo mismo cada vez que presionas `C` para recalibrar.

**b) El tope de velocidad es de simulación.** 8,0 rad/s se dejó alto a propósito (`[E3]` en la cabecera del script) porque el filtro One Euro es el que suaviza de verdad y el tope solo es red de seguridad. Para un servo Feetech con la inercia del brazo y carga en la pinza, no tiene sentido.

**c) No hay compensación de gravedad.** En Gazebo el controlador mantiene la posición sin esfuerzo. En el brazo real, una consigna de posición pura puede no sostener el brazo extendido, y la diferencia no se realimenta a ninguna parte.

**Lo mínimo antes de conectar:**

1. Suscribirse a `/joint_states` e inicializar `q_cmd` con la postura real.
2. Al calibrar, **no** saltar a cero: partir de la postura actual.
3. Bajar `MAX_JOINT_VEL` a 0,5–1,0 rad/s y subirlo solo después de probar.
4. Aumentar `time_from_start` a algo que el servo pueda cumplir.
5. Rampa de arranque: los primeros segundos, muy despacio.

**Ninguno de los cinco está aplicado en este repositorio.** No se aplican a ciegas por la misma razón que el bloqueo 3, y porque cambiar un tope de velocidad sin medir el resultado es cambiar un riesgo conocido por uno desconocido.

---

## Generar el registro de operación

Es lo único que falta para que la fila «registro de comunicación con los servos» de la tabla de arriba deje de decir *no existe*. Con el brazo conectado y ya calibrado:

```bash
mkdir -p ~/so-arm100-teleop/pruebas

# 1. El sistema reconoce el hardware físico
ros2 control list_hardware_interfaces -c /real/controller_manager \
  > ~/so-arm100-teleop/pruebas/01_interfaces.txt

# 2. Los controladores del lado físico están activos
ros2 control list_controllers -c /real/controller_manager \
  > ~/so-arm100-teleop/pruebas/02_controladores.txt

# 3. Telemetría real saliendo de los codificadores
timeout 10 ros2 topic echo /real/joint_states \
  > ~/so-arm100-teleop/pruebas/03_telemetria.txt

# 4. La consigna del script llega al brazo físico
timeout 10 ros2 topic echo /real/arm_controller/joint_trajectory \
  > ~/so-arm100-teleop/pruebas/04_consignas.txt
```

**El tercero es el decisivo.** Mientras corre, mueve el brazo con la mano. Si las posiciones cambian en el archivo, los codificadores magnéticos están reportando por el bus serie, y eso no admite otra lectura.

Cuando esos cuatro archivos existan, actualiza la tabla de estado de este documento y la del README.

---

## Orden recomendado, con el riesgo de cada paso

| # | Paso | Estado | Riesgo |
|---|---|---|---|
| 1 | `bash scripts/06_brazo_fisico.sh` | Automatizado | Bajo |
| 2 | Cerrar sesión y volver a entrar (grupo `dialout`) | Manual | Ninguno |
| 3 | Identificar el puerto (`ls /dev/ttyUSB* /dev/ttyACM*`) | Manual | Ninguno |
| 4 | Si tu placa es `ttyACM0`: ver bloqueo 3 | Manual | Bajo |
| 5 | `calibrate_arm.py` con el brazo sostenido | Manual | Medio |
| 6 | Mover **una sola** articulación pocos grados con `ros2 topic pub` | Manual | **Aquí se puede dañar algo** |
| 7 | Aplicar los límites de seguridad del bloqueo 6 | Manual | Medio |
| 8 | Tomar el registro de operación (arriba) | Manual | Bajo |
| 9 | Recién entonces, teleoperar con el espejo — ver [docs/10](10-espejo-simulacion-y-robot-real.md) | — | — |

**El paso 6 es el delicado.** Brazo apoyado, sin carga en la pinza, la mano en el interruptor de la fuente, una articulación, pocos grados.

---

## Por qué este documento sigue diciendo lo que no se sabe

La versión anterior terminaba explicando por qué no se escribían los arreglos sin probarlos:

> *"Cada vez que en esta documentación se dio por bueno un valor sin probarlo, costó tiempo real. Escribir configuración de hardware sin el hardware delante reproduciría ese error, con la diferencia de que aquí el fallo no es un mensaje en la terminal: es un servo forzando contra un tope."*

Ese criterio no ha cambiado, y es la razón de que los bloqueos 3 y 6 sigan abiertos en lugar de aparecer como resueltos con un arreglo plausible. Lo que sí cambió es que los bloqueos 1, 2 y 5 **se probaron**, y por eso pasaron a la columna de resueltos con la evidencia al lado.

La tabla de estado de arriba se mantiene actualizada con quién verificó cada cosa y cuándo. Una fila sin nombre y sin fecha significa que nadie lo ha hecho.

---

## Fuentes

- [`brukg/so_arm_100_hardware`](https://github.com/brukg/so_arm_100_hardware) — interfaz de hardware ros2_control
- [`so_arm_100_hardware` en el índice de ROS](https://index.ros.org/p/so_arm_100_hardware/) — versiones liberadas por distribución
- [`brukg/SO-100-arm`](https://github.com/brukg/SO-100-arm) — README con requisitos de hardware y procedimiento de calibración
- [Issue #10 — Error ros2_control_node when running hardware.launch.py](https://github.com/brukg/SO-100-arm/issues/10)
