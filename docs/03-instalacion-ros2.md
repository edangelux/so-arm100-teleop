# 03 — Instalación de ROS 2 Humble, Gazebo y visión artificial

[← Anterior: instalación nativa](02-instalacion-nativa-iso.md) · [Volver al inicio](../README.md) · [Siguiente: workspace y compilación →](04-workspace-y-compilacion.md)

---

Desde aquí todo es terminal. Abre una con **Ctrl + Alt + T**.

> **Cuidado con cómo pegas los comandos.** Un espacio de más o una línea partida a la mitad y el comando falla. Si estás en máquina virtual, activa antes el portapapeles bidireccional: *Dispositivos → Portapapeles compartido → Bidireccional*. En GitHub, cada bloque de código tiene un botón de copiar en la esquina superior derecha — úsalo.

## Atajo: hacerlo todo de una vez

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Edangelux/so-arm100-teleop.git ~/so-arm100-teleop
cd ~/so-arm100-teleop && bash scripts/install.sh
```

Si prefieres entender qué hace cada paso, o si el script se detuvo en algún punto, sigue leyendo: abajo está exactamente lo mismo, bloque por bloque.

> **Si vas por la ruta manual, no termines aquí.** Este documento cubre ROS 2, Gazebo y Python. Falta el workspace y, sobre todo, el **overlay de configuración** — sin él los paquetes del robot **no arrancan en Humble**. Todo eso está en [04 — Workspace y compilación](04-workspace-y-compilacion.md), y es obligatorio.

---

## Fase 1 — Localización UTF-8

ROS 2 necesita un locale UTF-8. Sin esto, algunas herramientas fallan con errores de codificación difíciles de rastrear.

```bash
sudo apt update && sudo apt install -y locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8
```

Verifica:

```bash
locale
```

Debes ver `en_US.UTF-8` en las variables. (Tu interfaz de Ubuntu sigue en español; esto solo afecta a la codificación de caracteres.)

---

## Fase 2 — Repositorio APT de ROS 2

```bash
sudo apt install -y software-properties-common curl gnupg lsb-release git python3-pip
sudo add-apt-repository -y universe
```

Ahora se agrega el repositorio de ROS 2. **Este método cambió en 2025**: antes se descargaba la llave GPG a mano desde GitHub, y esa llave llegó a expirar y dejó a mucha gente con `apt update` roto. Ahora Open Robotics distribuye un paquete `.deb` que instala el repositorio *y* la llave, y que se actualiza solo cuando la llave rota.

```bash
export ROS_APT_SOURCE_VERSION=$(curl -s https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | grep -F "tag_name" | awk -F\" '{print $4}')
curl -L -o /tmp/ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.$(. /etc/os-release && echo $VERSION_CODENAME)_all.deb"
sudo apt install -y /tmp/ros2-apt-source.deb
```

<details>
<summary><b>Método antiguo (todavía funciona, pero no lo uses salvo que el de arriba falle)</b></summary>

```bash
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
```

Este es el método que aparece en la mayoría de tutoriales viejos. Funciona, pero cuando la llave expire otra vez tendrás que repetirlo a mano.
</details>

---

## Fase 3 — ROS 2 Humble Desktop

```bash
sudo apt update
sudo apt install -y \
    ros-humble-desktop \
    ros-dev-tools \
    python3-colcon-common-extensions \
    python3-rosdep \
    python3-vcstool
```

Esta es la descarga grande: ~2 GB, entre 10 y 30 minutos según tu conexión.

Inicializa `rosdep`, que es la herramienta que resuelve las dependencias de los paquetes que vas a compilar:

```bash
sudo rosdep init || true
rosdep update
```

> El `|| true` está a propósito: si `rosdep` ya estaba inicializado, el comando falla con "*default sources list file already exists*" y detendría el script. Con `|| true` se ignora ese caso, que es inofensivo.

Haz que ROS 2 se cargue solo en cada terminal nueva:

```bash
grep -qxF "source /opt/ros/humble/setup.bash" ~/.bashrc || echo "source /opt/ros/humble/setup.bash" >> ~/.bashrc
source /opt/ros/humble/setup.bash
```

> El `grep -qxF ... ||` evita que la línea se duplique si corres el comando dos veces. Es un detalle pequeño pero un `.bashrc` con la misma línea diez veces es una fuente real de problemas.

**Comprueba que quedó:**

```bash
ros2 --help
printenv ROS_DISTRO   # debe imprimir: humble
```

---

## Fase 4 — Gazebo, MoveIt 2 y controladores

```bash
sudo apt install -y \
    ros-humble-ros-gz \
    ros-humble-ros-gz-sim \
    ros-humble-ros-gz-bridge \
    ros-humble-gz-ros2-control \
    ros-humble-ros2-control \
    ros-humble-ros2-controllers \
    ros-humble-controller-manager \
    ros-humble-joint-trajectory-controller \
    ros-humble-joint-state-broadcaster \
    ros-humble-position-controllers \
    ros-humble-effort-controllers \
    ros-humble-moveit \
    ros-humble-moveit-ros-planning-interface \
    ros-humble-moveit-kinematics \
    ros-humble-joint-state-publisher \
    ros-humble-joint-state-publisher-gui \
    ros-humble-robot-state-publisher \
    ros-humble-xacro \
    ros-humble-tf-transformations
```

> ### Nota importante: `ros-gz`, no `gazebo-ros-pkgs`
> Muchas guías (y varios asistentes de IA) incluyen `ros-humble-gazebo-ros-pkgs`. **Ese paquete es para Gazebo Classic (Gazebo 11), que es un simulador distinto y ya descontinuado.**
>
> Los paquetes del SO-ARM100 usan el **Gazebo nuevo** (`gz sim`, antes llamado Ignition), que es lo que instala `ros-humble-ros-gz`. Instalar los dos a la vez descarga ~1 GB de más, crea comandos `gazebo` y `gz` que se confunden entre sí, y es una fuente clásica de "*el mundo carga pero el robot no aparece*".
>
> En Ubuntu 22.04 + Humble, `ros-humble-ros-gz` instala **Gazebo Fortress**, que es el emparejamiento oficialmente soportado. El repositorio original del robot menciona Gazebo Garden; Fortress funciona para la simulación de este proyecto y es mucho más fácil de instalar. Si algún día necesitas Garden, hay que agregar el repositorio de `osrfoundation` y usar `ros-humble-ros-gzgarden`, que entra en conflicto con `ros-humble-ros-gz*` — no lo hagas salvo que sepas por qué lo necesitas.

Verifica:

```bash
gz sim --version
```

---

## Fase 5 — Permisos de cámara

Para que tu usuario pueda leer `/dev/video0` sin `sudo`:

```bash
sudo usermod -a -G video $USER
```

> **Este cambio no surte efecto hasta que cierras sesión y vuelves a entrar** (o reinicias). Es el motivo por el que a mucha gente le sigue fallando la cámara justo después de correr el comando.

---

## Fase 6 — Python: OpenCV, MediaPipe y NumPy

> ### Aquí hay tres trampas. Ninguna es evidente, y las tres rompen el sistema.
> Esta fase es la que más problemas dio en la práctica. Si prefieres saltártela, corre `bash scripts/03_vision_python.sh`, que ya trae todo esto resuelto.

**1. OpenCV desde APT, nunca desde pip:**

```bash
sudo apt install -y python3-opencv python3-numpy v4l-utils
```

El paquete `opencv-python` de pip trae su **propia copia de las bibliotecas Qt**, que choca con la que instala ROS 2 (RViz también usa Qt). El síntoma es que la ventana de video no abre:

```
qt.qpa.plugin: Could not load the Qt platform plugin "xcb"
```

**2. NumPy fijado en 1.x, y protegido:**

```bash
echo "numpy<2" > /tmp/restricciones.txt
python3 -m pip install --upgrade pip
python3 -m pip install -c /tmp/restricciones.txt "numpy<2"
```

OpenCV y MediaPipe están compilados contra NumPy 1.x en Ubuntu 22.04. Con NumPy 2, `import cv2` falla con `_ARRAY_API not found`.

**No basta con instalarlo al principio:** cualquier paquete posterior que pida `numpy>=2` lo vuelve a subir en silencio. Por eso se usa un **archivo de restricciones** que se pasa a todas las instalaciones siguientes: con él, pip no puede subir NumPy ni aunque un paquete se lo exija.

**3. MediaPipe en la versión 0.10.21, y con `--no-deps`:**

```bash
python3 -m pip install -c /tmp/restricciones.txt --no-deps "mediapipe==0.10.21"
python3 -m pip install -c /tmp/restricciones.txt \
    absl-py \
    "attrs>=19.1.0" \
    certifi \
    "flatbuffers>=2.0" \
    matplotlib \
    "protobuf<5,>=4.25.3" \
    sentencepiece \
    "sounddevice>=0.4.4"
```

> **La versión importa.** MediaPipe **eliminó el módulo `solutions`** a partir de la **0.10.26**. El nodo de teleoperación usa `mp.solutions.pose` y `mp.solutions.hands`, así que con cualquier versión posterior falla al arrancar:
>
> ```
> AttributeError: module 'mediapipe' has no attribute 'solutions'
> ```
>
> Probado versión por versión: `0.10.21` lo tiene, `0.10.26` ya no. **0.10.21 es la última que sirve.**

> **Por qué `--no-deps`.** MediaPipe declara `opencv-contrib-python` (el del conflicto de Qt) y `jax` + `jaxlib`, que **exigen `numpy>=2`** y romperían el pin de NumPy. Ninguno hace falta para `solutions` — comprobado importando y usando `pose` y `hands` sin ellos. Por eso se instalan sus dependencias a mano.

> **Dos que no son obvias.** `certifi` es necesario o `import mediapipe` falla; y `protobuf` tiene que ser **menor que 5**, o aparece `AttributeError: 'MessageFactory' object has no attribute 'GetPrototype'`.

**Verifica que todo quedó bien:**

```bash
python3 -c "import cv2, mediapipe, numpy; print(cv2.__version__, mediapipe.__version__, numpy.__version__)"
python3 -c "import mediapipe as mp; print(mp.solutions.pose.Pose)"
```

La combinación verificada en una instalación real es:

```
opencv 4.5.4 | mediapipe 0.10.21 | numpy 1.26.4
```

Si el segundo comando falla con `has no attribute 'solutions'`, tienes una versión demasiado nueva:

```bash
python3 -m pip install --no-deps "mediapipe==0.10.21" --force-reinstall
```

---

## Siguiente

**[→ 04 — Workspace y compilación](04-workspace-y-compilacion.md)**

---

### Fuentes

- [ROS 2 Humble — Installation (Ubuntu Debs)](https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html)
- [ROS signing key migration guide — Open Robotics Discourse](https://discourse.openrobotics.org/t/ros-signing-key-migration-guide/43937)
- [Installing Gazebo with ROS — gazebosim.org](https://gazebosim.org/docs/latest/ros_installation/)
