# 06 — Solución de problemas

[← Anterior: ejecución](05-ejecucion.md) · [Volver al inicio](../README.md)

---

Antes de nada, corre el diagnóstico. Suele decirte exactamente qué falta:

```bash
bash ~/so-arm100-teleop/scripts/verificar.sh
```

---

## Al ejecutar los scripts

### `bash: ./scripts/install.sh: Permission denied`

El archivo está ahí, pero sin permiso de ejecución. Pasa cuando el repositorio se subió a GitHub por la web (la interfaz web no conserva ese permiso) o cuando se clonó desde Windows.

**Solución inmediata** — `bash <archivo>` ignora el permiso de ejecución:

```bash
cd ~/so-arm100-teleop
bash scripts/install.sh
```

**Solución permanente**, si es tu propio repositorio:

```bash
cd ~/so-arm100-teleop
chmod +x scripts/*.sh teleop_vision/*.py
git update-index --chmod=+x scripts/*.sh teleop_vision/*.py
git commit -m "Restaura el permiso de ejecución de los scripts"
git push
```

`git update-index --chmod=+x` marca el permiso **dentro del repositorio**, no solo en tu copia local. Funciona incluso desde Windows, donde `chmod` por sí solo no se registra porque Git tiene `core.filemode` en `false`.

---

### `bash: ./scripts/install.sh: /usr/bin/env: bad interpreter: No such file or directory`

Fíjate si al final del mensaje aparece un `^M`. Si es así, el archivo tiene finales de línea de Windows (CRLF) y Linux lee el `\r` como parte del nombre del intérprete.

```bash
sudo apt install -y dos2unix
dos2unix scripts/*.sh teleop_vision/*.py
```

El repositorio incluye un `.gitattributes` que fuerza finales de línea LF precisamente para que esto no pase. Si te ocurrió, es que clonaste una versión anterior a ese archivo.

---

## Instalación de paquetes

### `GPG error` / `NO_PUBKEY` / `The following signatures were invalid` al hacer `apt update`

La llave de firma del repositorio de ROS expiró o no se instaló bien. Es el error más común de todos.

**Solución:** reinstala el paquete de repositorio, que trae la llave actualizada.

```bash
sudo rm -f /etc/apt/sources.list.d/ros2.list /usr/share/keyrings/ros-archive-keyring.gpg
export ROS_APT_SOURCE_VERSION=$(curl -s https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | grep -F "tag_name" | awk -F\" '{print $4}')
curl -L -o /tmp/ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.$(. /etc/os-release && echo $VERSION_CODENAME)_all.deb"
sudo apt install -y /tmp/ros2-apt-source.deb
sudo apt update
```

El primer `rm` borra la configuración vieja para que no queden dos repositorios de ROS compitiendo.

---

### `E: Unable to locate package ros-humble-desktop`

Tres causas posibles, en orden de frecuencia:

1. **No estás en Ubuntu 22.04.** Comprueba:
   ```bash
   lsb_release -a
   ```
   Debe decir `22.04` y `jammy`. Si dice 24.04 (`noble`) o 20.04 (`focal`), no existe `ros-humble-desktop` para ese sistema. Hay que reinstalar Ubuntu 22.04.

2. **No corriste `sudo apt update`** después de agregar el repositorio de ROS.

3. **Falta el repositorio `universe`:**
   ```bash
   sudo add-apt-repository -y universe && sudo apt update
   ```

---

### `rosdep: command not found`

```bash
sudo apt install -y python3-rosdep
sudo rosdep init
rosdep update
```

---

### `ERROR: default sources list file already exists`

No es un error real. Significa que `rosdep` ya estaba inicializado. Sáltate `sudo rosdep init` y corre solo:

```bash
rosdep update
```

---

### `ERROR: cannot download default sources list from ... Website may be down`

Problema de red o de DNS, no de ROS. Comprueba que tienes internet dentro de la máquina virtual:

```bash
ping -c 3 raw.githubusercontent.com
```

Si no responde y estás en VirtualBox, revisa la configuración de red de la máquina virtual (**Adaptador puente** o **NAT**, cualquiera de los dos, pero conectado).

---

## Compilación

### `colcon build` falla en `so_arm_100_5dof_arm_ikfast_plugin`

Ese paquete es un solucionador de cinemática opcional y no hace falta para la simulación. MoveIt funciona con el solucionador **KDL** por defecto.

```bash
touch ~/ros2_ws/src/SO-100-arm/so_arm_100_5dof_arm_ikfast_plugin/COLCON_IGNORE
cd ~/ros2_ws && colcon build --symlink-install
```

Si quieres forzar KDL explícitamente, edita `so_arm_100_moveit_config/config/kinematics.yaml` y usa:

```yaml
kinematics_solver: kdl_kinematics_plugin/KDLKinematicsPlugin
```

---

### `colcon build` se queda congelado o mata la terminal

Te quedaste sin RAM. `colcon` compila varios paquetes en paralelo por defecto. Compila de uno en uno:

```bash
cd ~/ros2_ws
colcon build --symlink-install --executor sequential --parallel-workers 1
```

En una máquina virtual con 4 GB, esto es prácticamente obligatorio.

---

### `Package 'so_arm_100_bringup' not found`

Casi siempre es que **no hiciste `source` del workspace en esa terminal**:

```bash
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash
ros2 pkg list | grep so_arm
```

Si aún así no aparece, es que la compilación falló o el repositorio equivocado está en `src/`. Confirma:

```bash
ls ~/ros2_ws/src/SO-100-arm
```

Debe contener las carpetas `so_arm_100_bringup`, `so_arm_100_description`, `so_arm_100_moveit_config`. Si en su lugar ves archivos `.stl` y `.step`, clonaste `TheRobotStudio/SO-ARM100` — ese repositorio no tiene paquetes de ROS 2. Ve a [docs/04](04-workspace-y-compilacion.md#2-descargar-los-paquetes-del-so-arm100).

---

## Cámara

### `Error: No se pudo abrir la camara` / `Cannot open camera /dev/video0`

**Si estás en VirtualBox**, la causa casi segura es que la webcam no está pasada a la máquina virtual:

1. Menú superior de VirtualBox: **Dispositivos → Webcams →** selecciona tu cámara.
2. Verifica que el **Extension Pack** esté instalado (sin él no hay soporte de webcam).
3. Cierra cualquier aplicación en Windows que esté usando la cámara: Zoom, Teams, la app *Cámara*, el navegador. **Solo un sistema puede tomar la cámara a la vez.**

**En cualquier instalación**, comprueba que el dispositivo existe y que tienes permiso:

```bash
ls -l /dev/video*
groups | grep video
```

Si `groups` no incluye `video`:

```bash
sudo usermod -a -G video $USER
```

y luego **cierra sesión y vuelve a entrar** (o reinicia). El cambio de grupo no aplica a las sesiones que ya estaban abiertas — este es el motivo por el que a mucha gente le sigue fallando después de correr el comando.

### La cámara existe pero el video sale negro o congelado

Prueba otro índice de cámara:

```bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py --ros-args -p camera_index:=1
```

Para ver qué cámaras hay realmente:

```bash
sudo apt install -y v4l-utils
v4l2-ctl --list-devices
```

---

## Ventana de video y Qt

### La ventana de video no abre: `qt.qpa.plugin: Could not load the Qt platform plugin "xcb"`

**Causa:** el paquete `opencv-python` de `pip` incluye su propia copia de las bibliotecas Qt, y esa copia entra en conflicto con la que instala ROS 2 (`ros-humble-desktop` trae RViz, que también usa Qt). Cuando `cv2.imshow()` intenta crear la ventana, carga el plugin equivocado y falla.

**Solución A — usar el OpenCV del sistema (la más limpia):**

```bash
python3 -m pip uninstall -y opencv-python opencv-contrib-python
sudo apt install -y python3-opencv
python3 -c "import cv2; print(cv2.__version__)"
```

MediaPipe funciona con el `cv2` del sistema sin problema. Esta es la opción recomendada.

**Solución B — apuntar Qt al plugin correcto**, si por alguna razón necesitas el OpenCV de `pip`:

```bash
echo 'export QT_QPA_PLATFORM_PLUGIN_PATH=/usr/lib/x86_64-linux-gnu/qt5/plugins/platforms' >> ~/.bashrc
source ~/.bashrc
```

**Solución C — entorno virtual aislado**, si quieres mantener las dos versiones separadas de forma permanente:

```bash
python3 -m venv --system-site-packages ~/venv_teleop
source ~/venv_teleop/bin/activate
pip install "numpy<2" mediapipe
# ROS 2 sigue disponible gracias a --system-site-packages
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

---

### `A module that was compiled using NumPy 1.x cannot be run in NumPy 2.x`

`pip` instaló NumPy 2, con el que MediaPipe y OpenCV no son compatibles en este entorno.

```bash
python3 -m pip install "numpy<2" --force-reinstall
```

---

## Gazebo

### Gazebo se congela, se cierra solo, o va a 2 FPS

**En máquina virtual:** falta la aceleración 3D.

1. Apaga la máquina virtual.
2. **Configuración → Pantalla:** memoria de video **128 MB**, controlador **VMSVGA**, y marca ✅ **Habilitar aceleración 3D**.
3. Verifica que las **Guest Additions** estén instaladas (ver [docs/01](01-instalacion-maquina-virtual.md#6-guest-additions--pantalla-completa-y-portapapeles)).

Si aun así va lento, fuerza el renderizado por software — más lento pero estable:

```bash
export LIBGL_ALWAYS_SOFTWARE=1
ros2 launch so_arm_100_bringup gz.launch.py
```

**Instalación nativa:** instala los controladores propietarios de tu tarjeta:

```bash
sudo ubuntu-drivers autoinstall
sudo reboot
```

---

### Gazebo abre pero el robot no aparece

Suele ser que están instalados **Gazebo Classic y Gazebo nuevo a la vez**, y el launch está hablando con el simulador equivocado.

```bash
# ¿Tienes ambos?
dpkg -l | grep -E "gazebo11|ros-humble-gazebo-ros-pkgs"
```

Si aparece algo, desinstala Gazebo Classic:

```bash
sudo apt remove -y ros-humble-gazebo-ros-pkgs gazebo11 libgazebo11
sudo apt autoremove -y
```

Este proyecto usa el **Gazebo nuevo** (`gz sim`), que viene con `ros-humble-ros-gz`.

---

### Los controladores no se activan / `arm_controller` queda en `inactive`

Espera un poco más: el spawner de controladores a veces tarda 10–20 segundos en una máquina virtual lenta. Si pasado ese tiempo sigue inactivo:

```bash
ros2 control list_controllers
ros2 control set_controller_state arm_controller active
```

Y revisa la salida completa del `ros2 launch` buscando líneas rojas — el error real suele estar 50 líneas más arriba de donde te quedaste mirando.

---

## Teleoperación

### La ventana de video detecta mi cuerpo, pero el robot no se mueve

Recorre esta lista en orden:

1. **¿Calibraste?** Presiona **`C`** con la ventana de video enfocada. Sin calibrar, el script no publica movimiento.

2. **¿El tópico existe?** El script publica a `/arm_controller/joint_trajectory`. Si ese tópico no existe, los mensajes se pierden **sin ningún error**:
   ```bash
   ros2 topic list | grep joint_trajectory
   ```

3. **¿Llegan mensajes?**
   ```bash
   ros2 topic echo /arm_controller/joint_trajectory --once
   ```
   Si no imprime nada, el script no está publicando. Si imprime pero el robot no se mueve, el problema está del lado del controlador.

4. **¿Coinciden los nombres de los joints?** Los del mensaje deben ser idénticos a los del URDF:
   ```bash
   ros2 topic echo /joint_states --once
   ```
   Deben ser `Shoulder_Rotation`, `Shoulder_Pitch`, `Elbow`, `Wrist_Pitch`, `Wrist_Roll`, `Gripper`.

5. **¿Está activo el controlador?**
   ```bash
   ros2 control list_controllers
   ```

---

### La pinza no responde al pellizco

En la configuración original del repositorio, `gripper_controller` es de tipo `parallel_gripper_action_controller/GripperActionController`, que **se comanda por una acción de ROS, no por el tópico `joint_trajectory`**. Los mensajes que envía el script se pierden en silencio.

```bash
ros2 control list_controllers
ros2 topic list | grep gripper
```

- Si existe `/gripper_effort_controller/joint_trajectory`, apunta ahí:
  ```bash
  python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py \
      --ros-args -p gripper_topic:=/gripper_effort_controller/joint_trajectory
  ```
- Si el joint de tu pinza tiene otro nombre:
  ```bash
  python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py \
      --ros-args -p gripper_joint:=Moving_Jaw
  ```
- Si prefieres cambiar el controlador: en `so_arm_100_moveit_config/config/ros2_controllers.yaml`, define `gripper_controller` como `joint_trajectory_controller/JointTrajectoryController` sobre el joint `Gripper`, y recompila.

---

### El brazo tiembla o se mueve a saltos

Sube el suavizado (**valores más bajos suavizan más**) y baja el paso máximo por fotograma:

```bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py \
    --ros-args -p smoothing:=0.20 -p max_joint_step:=0.05
```

Si el temblor viene de que MediaPipe pierde y recupera el tracking, el problema es de iluminación, no del filtro: mejora la luz frontal y despeja el fondo.

---

### El robot se mueve muy poco / tengo que exagerar el movimiento

Sube la escala:

```bash
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py --ros-args -p scale:=0.60
```

---

### Aviso constante de singularidad

El punto objetivo está en el límite del alcance del brazo: demasiado lejos o demasiado pegado a la base. El algoritmo ya recorta el objetivo a una posición válida, así que no es un fallo — pero significa que estás trabajando en el borde del espacio alcanzable.

1. **Recalibra** (**`C`**) con el brazo en una postura más centrada y relajada.
2. Si el aviso sale prácticamente siempre, revisa los límites del espacio de trabajo. El SO-ARM100 alcanza **0.251 m** (`L1 + L2 = 0.116 + 0.135`); si `x_max` u otro límite supera ese valor, buena parte de la caja de trabajo es inalcanzable por construcción y la IK vive saturada.

   Los valores por defecto ya están ajustados a ese alcance. Compruébalos:

   ```bash
   ros2 param get /teleop_vision_node x_max
   ```

   Debe devolver `0.20`, no un valor mayor. Si necesitas más recorrido, **sube `scale`** en lugar de ampliar la caja:

   ```bash
   python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py --ros-args -p scale:=0.60
   ```

---

## Rendimiento general

### Todo va lento

- **Cierra RViz** si no lo estás usando: consume muchísimo.
- **Sube la RAM y los núcleos** de la máquina virtual (nunca más de la mitad de los de tu equipo físico).
- Considera la [instalación nativa](02-instalacion-nativa-iso.md): la diferencia en FPS es grande.
- Baja la resolución de captura editando `CAP_PROP_FRAME_WIDTH` / `HEIGHT` en `teleop_vision.py`.

---

¿Un error que no está aquí? Copia el mensaje **completo** de la terminal (no solo la última línea — la causa real suele estar varias líneas más arriba) y ábrelo como *issue* en el repositorio.
