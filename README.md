# Teleoperación por Visión del Manipulador SO-ARM100

**ROS 2 Humble · Gazebo · MoveIt 2 · MediaPipe · Mapeo Articular Directo**

Sistema de teleoperación en tiempo real para el manipulador de 5 GDL **SO-ARM100**. Una cámara web mide los ángulos de las articulaciones del brazo y la mano del operador y los **copia articulación por articulación** al robot simulado en Gazebo. **No hay cinemática inversa en el lazo de control**: no se calcula dónde poner el efector en el espacio, se replican ángulos. El jacobiano se usa únicamente para mostrar el índice de manipulabilidad en pantalla, sin intervenir en el control. MoveIt 2 queda disponible para planificación cartesiana fuera del lazo de teleoperación. Ver [docs/07 — Cómo funciona el sistema](docs/07-como-funciona.md).

> Proyecto de Análisis y Diseño de Sistemas Mecatrónicos — Ingeniería Mecatrónica, Universidad La Salle (ULSA), Nicaragua.

---

## Instalación en 3 comandos

Si ya tienes **Ubuntu 22.04 LTS** funcionando (nativo o en máquina virtual), esto instala absolutamente todo:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Edangelux/so-arm100-teleop.git ~/so-arm100-teleop
cd ~/so-arm100-teleop && bash scripts/install.sh
```

El script tarda entre 20 y 40 minutos según tu conexión. Al terminar, **cierra y vuelve a abrir la terminal** y salta a [Ejecución](#ejecución).

> ¿Todavía no tienes Ubuntu? Empieza aquí:
> - **[Guía 01 — Máquina Virtual (VirtualBox)](docs/01-instalacion-maquina-virtual.md)** ← recomendado si tu PC tiene RAM y CPU de sobra
> - **[Guía 02 — Instalación nativa por ISO / USB](docs/02-instalacion-nativa-iso.md)** ← recomendado si tu PC es de gama básica

---

## Índice de la documentación

| # | Documento | Qué cubre |
|---|-----------|-----------|
| 01 | [Instalación en máquina virtual](docs/01-instalacion-maquina-virtual.md) | VirtualBox, Extension Pack, ajustes críticos, Guest Additions, webcam |
| 02 | [Instalación nativa por ISO](docs/02-instalacion-nativa-iso.md) | USB booteable con Rufus, BIOS/UEFI, particionado, dual boot |
| 03 | [Instalación de ROS 2 Humble](docs/03-instalacion-ros2.md) | Locales, repositorio APT, ROS 2, Gazebo, MoveIt 2, visión artificial |
| 04 | [Workspace y compilación](docs/04-workspace-y-compilacion.md) | `~/ros2_ws`, paquetes del SO-ARM100, `rosdep`, `colcon build` |
| 05 | [Ejecución y control](docs/05-ejecucion.md) | Lanzar Gazebo, lanzar la teleoperación, calibrar, gestos |
| 06 | [Solución de problemas](docs/06-solucion-de-problemas.md) | Todos los errores reales que aparecen y cómo se arreglan |
| 07 | [**Cómo funciona el sistema**](docs/07-como-funciona.md) | Arquitectura: nodos, tópicos y acciones; el recorrido de la cámara al robot; qué hace cada parte del código |

---

## Requisitos

| Componente | Requisito |
|---|---|
| Sistema operativo | **Ubuntu 22.04 LTS (Jammy Jellyfish)** — obligatorio |
| ROS 2 | Humble Hawksbill |
| RAM | 4 GB mínimo · 8 GB recomendado |
| CPU | 2 núcleos mínimo · 4 recomendado |
| Disco | 40 GB mínimo · 60–80 GB recomendado |
| Gráficos | Aceleración 3D habilitada (indispensable para Gazebo y RViz) |
| Cámara | Webcam integrada o USB funcional |

> **ROS 2 Humble exige Ubuntu 22.04.** Ubuntu 24.04 trae Python y bibliotecas incompatibles con los binarios de Humble, y 20.04 es demasiado antiguo. No hay atajo aquí.

---

## Estructura del repositorio

```
so-arm100-teleop/
├── README.md                      ← estás aquí
├── requirements.txt               ← dependencias de Python
├── docs/                          ← guía paso a paso completa
│   ├── 01-instalacion-maquina-virtual.md
│   ├── 02-instalacion-nativa-iso.md
│   ├── 03-instalacion-ros2.md
│   ├── 04-workspace-y-compilacion.md
│   ├── 05-ejecucion.md
│   ├── 06-solucion-de-problemas.md
│   └── img/                       ← capturas de pantalla
├── scripts/
│   ├── install.sh                 ← instalador maestro
│   ├── 01_ros2_humble.sh          ← ROS 2 Humble + herramientas
│   ├── 02_simulacion.sh           ← Gazebo, MoveIt 2, ros2_control
│   ├── 03_vision_python.sh        ← OpenCV, MediaPipe, permisos de cámara
│   ├── 04_workspace.sh            ← ~/ros2_ws + paquetes del robot + compilación
│   ├── 05_aplicar_overlay.sh      ← aplica la configuración verificada para Humble
│   └── verificar.sh               ← diagnóstico: qué está bien y qué falta
├── overlay/                       ← archivos de configuración ya corregidos
│   ├── so_arm_100_bringup/
│   └── so_arm_100_moveit_config/
└── teleop_vision/
    └── teleop_vision.py           ← nodo de teleoperación por visión
```

El repositorio **no vive dentro del workspace de ROS**. Se clona en tu carpeta personal (`~/so-arm100-teleop`) y el instalador crea el workspace aparte en `~/ros2_ws`, donde descarga los paquetes del robot desde su repositorio original. Así tu documentación y el código de terceros quedan separados.

---

## Instalación paso a paso (alternativa manual)

Si prefieres entender cada comando en lugar de correr el instalador, o si el script falló en algún punto, cada fase está documentada y puedes ejecutarla sola:

```bash
bash scripts/01_ros2_humble.sh      # Fase 1: ROS 2 Humble
bash scripts/02_simulacion.sh       # Fase 2: Gazebo + MoveIt 2 + controladores
bash scripts/03_vision_python.sh    # Fase 3: OpenCV + MediaPipe + cámara
bash scripts/04_workspace.sh        # Fase 4: workspace y compilación
bash scripts/05_aplicar_overlay.sh  # Fase 5: overlay de configuración verificada
```

Los scripts son **idempotentes**: puedes volver a correrlos sin romper nada. Los bloques de comandos equivalentes, uno por uno, están en [docs/03](docs/03-instalacion-ros2.md) y [docs/04](docs/04-workspace-y-compilacion.md).

---

## Ejecución

Se necesitan **dos terminales**.

### Terminal 1 — Simulación y controladores

```bash
cd ~/ros2_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
ros2 launch so_arm_100_bringup gz_moveit.launch.py
```

Abre Gazebo, `move_group` y RViz a la vez. Espera a que Gazebo cargue por completo y a que en la consola aparezcan `joint_state_broadcaster`, `arm_controller` y `gripper_controller` como **activos**.

### Terminal 2 — Teleoperación por visión

```bash
cd ~/ros2_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

### Controles

| Acción | Gesto / tecla |
|---|---|
| **Calibrar** | Postura neutra, **con la mano visible**, y presiona **`C`** o **`ESPACIO`** |
| Mover el brazo | El robot **copia los ángulos de tus articulaciones**: hombro, codo y muñeca |
| **Cerrar la pinza** | Junta el pulgar con el índice (pellizco) |
| **Abrir la pinza** | Separa el pulgar del índice |
| **Invertir un sentido** | Teclas **`1`**–**`5`** — si te mueves y el robot va al revés |
| Ajustar sensibilidad | **`TAB`** para seleccionar, **`+`** / **`-`** para la ganancia |
| **Guardar el ajuste** | **`S`** — queda en `~/teleop_config.json` |
| Cambiar de brazo | **`B`** (requiere recalibrar) · Pausa: **`P`** · Salir: **`Q`** |

La guía completa, con la explicación de cada parámetro ajustable, está en [docs/05](docs/05-ejecucion.md).

**¿Quieres entender qué pasa por dentro?** [docs/07 — Cómo funciona el sistema](docs/07-como-funciona.md) explica la arquitectura de nodos, el recorrido completo desde la cámara hasta el robot, y por qué el brazo se comanda por tópico y la pinza por acción.

---

## Verificación rápida

¿No estás seguro de si todo quedó bien instalado? Corre el diagnóstico:

```bash
bash ~/so-arm100-teleop/scripts/verificar.sh
```

Te dice, línea por línea, qué está presente y qué falta: versión de Ubuntu, ROS 2, Gazebo, MoveIt, paquetes de Python, cámara detectada y estado del workspace.

---

## ¿Algo falló?

Casi todos los errores que aparecen en la práctica están documentados con su causa y su solución en **[docs/06 — Solución de problemas](docs/06-solucion-de-problemas.md)**:

- La cámara no abre dentro de la máquina virtual (`Cannot open camera /dev/video0`)
- Gazebo se congela, se cierra o va a 2 FPS
- `qt.qpa.plugin: Could not load the Qt platform plugin "xcb"` al abrir la ventana de video
- `GPG error` / `NO_PUBKEY` al hacer `apt update`
- `rosdep: command not found` o `ERROR: cannot download default sources list`
- `Package 'so_arm_100_bringup' not found`
- El robot no se mueve aunque la ventana de video sí detecta el cuerpo
- `Error loading controller` al cargar `gripper_controller`
- Gazebo y MoveIt funcionan por separado pero no juntos
- La pinza no responde al pellizco
- El brazo se mueve al revés de como me muevo yo
- «Se abre Gazebo pero no se abre ROS»
- El brazo tiembla o se mueve a saltos

---

## Créditos y licencias

- Paquetes de ROS 2 del robot: [`brukg/SO-100-arm`](https://github.com/brukg/SO-100-arm) (Apache 2.0)
- Diseño mecánico, STL y BOM del brazo: [`TheRobotStudio/SO-ARM100`](https://github.com/TheRobotStudio/SO-ARM100)
- Detección de pose y manos: [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Google)
- Documentación, scripts de instalación y nodo de teleoperación: este repositorio, licencia MIT (ver [LICENSE](LICENSE))
