#!/usr/bin/env bash
#
# Diagnóstico — comprueba que todo esté instalado y correctamente configurado.
# No modifica nada: solo informa.

set -uo pipefail   # sin -e a propósito: queremos que siga aunque algo falle
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"
trap - ERR   # el diagnóstico no debe abortar ante un fallo

WS="${ROS2_WS:-$HOME/ros2_ws}"
FALLOS=0

comprobar() {
    local etiqueta="$1"; shift
    if "$@" >/dev/null 2>&1; then
        ok "${etiqueta}"
    else
        error "${etiqueta}"
        FALLOS=$((FALLOS + 1))
    fi
}

informar() {  # etiqueta + valor, sin veredicto
    printf '  %-28s %s\n' "$1" "$2"
}

titulo "Sistema"
if [ "$(lsb_release -rs 2>/dev/null)" = "22.04" ]; then
    ok "Ubuntu 22.04 LTS ($(lsb_release -cs))"
else
    error "Ubuntu $(lsb_release -rs 2>/dev/null || echo '¿?') — se requiere 22.04"
    FALLOS=$((FALLOS + 1))
fi
informar "RAM total" "$(awk '/MemTotal/ {printf "%d MB", $2/1024}' /proc/meminfo)"
informar "Núcleos de CPU" "$(nproc)"
informar "Espacio libre en \$HOME" "$(df -h "$HOME" | awk 'NR==2 {print $4}')"

titulo "ROS 2"
comprobar "ROS 2 Humble instalado en /opt/ros/humble" test -d /opt/ros/humble
if [ -d /opt/ros/humble ]; then
    # shellcheck source=/dev/null
    source /opt/ros/humble/setup.bash 2>/dev/null
    informar "ROS_DISTRO" "${ROS_DISTRO:-(no definido)}"
    comprobar "Comando 'ros2' disponible" command -v ros2
    comprobar "colcon disponible" command -v colcon
    comprobar "rosdep inicializado" test -f /etc/ros/rosdep/sources.list.d/20-default.list
fi
comprobar "'source /opt/ros/humble/setup.bash' en ~/.bashrc" \
    grep -qxF "source /opt/ros/humble/setup.bash" "$HOME/.bashrc"

titulo "Simulación"
comprobar "Gazebo (gz sim)" command -v gz
if command -v gz >/dev/null 2>&1; then
    informar "Versión de Gazebo" "$(gz sim --version 2>/dev/null | head -n1)"
fi
comprobar "ros-humble-ros-gz" dpkg -s ros-humble-ros-gz
comprobar "ros-humble-gz-ros2-control" dpkg -s ros-humble-gz-ros2-control
comprobar "ros-humble-ros2-control" dpkg -s ros-humble-ros2-control
comprobar "ros-humble-ros2-controllers" dpkg -s ros-humble-ros2-controllers
comprobar "ros-humble-moveit" dpkg -s ros-humble-moveit
comprobar "ros-humble-xacro" dpkg -s ros-humble-xacro

if dpkg -l 2>/dev/null | grep -qE '^ii\s+(gazebo11|ros-humble-gazebo-ros-pkgs)'; then
    aviso "Gazebo Classic también está instalado — puede causar conflictos (ver docs/06)"
fi

titulo "Visión artificial"
for modulo in cv2 mediapipe numpy; do
    if python3 -c "import ${modulo}" >/dev/null 2>&1; then
        VER="$(python3 -c "import ${modulo}; print(getattr(${modulo}, '__version__', '?'))" 2>/dev/null)"
        ok "${modulo} ${VER}"
    else
        error "${modulo} no importa"
        FALLOS=$((FALLOS + 1))
    fi
done

NUMPY_MAYOR="$(python3 -c "import numpy; print(numpy.__version__.split('.')[0])" 2>/dev/null || echo "?")"
if [ "${NUMPY_MAYOR}" = "2" ]; then
    aviso "NumPy 2.x detectado — MediaPipe necesita NumPy 1.x."
    aviso "  Solución:  python3 -m pip install 'numpy<2' --force-reinstall"
fi

titulo "Cámara"
if ls /dev/video* >/dev/null 2>&1; then
    ok "Dispositivos: $(ls /dev/video* | tr '\n' ' ')"
else
    error "No hay dispositivos en /dev/video*"
    aviso "  VirtualBox: menú Dispositivos → Webcams → selecciona tu cámara"
    FALLOS=$((FALLOS + 1))
fi
if groups "$USER" | grep -qw video; then
    ok "El usuario '$USER' pertenece al grupo 'video'"
else
    error "El usuario '$USER' NO pertenece al grupo 'video'"
    aviso "  Solución:  sudo usermod -a -G video \$USER  (y cerrar sesión)"
    FALLOS=$((FALLOS + 1))
fi

titulo "Workspace"
comprobar "Existe ${WS}/src" test -d "${WS}/src"
comprobar "Paquetes del robot clonados" test -d "${WS}/src/SO-100-arm"
comprobar "Workspace compilado (install/)" test -d "${WS}/install"
comprobar "'source ${WS}/install/setup.bash' en ~/.bashrc" \
    grep -qxF "source ${WS}/install/setup.bash" "$HOME/.bashrc"

if [ -f "${WS}/install/setup.bash" ]; then
    # shellcheck source=/dev/null
    source "${WS}/install/setup.bash" 2>/dev/null
    PAQUETES="$(ros2 pkg list 2>/dev/null | grep '^so_arm' || true)"
    if [ -n "${PAQUETES}" ]; then
        ok "Paquetes del robot detectados:"
        printf '    %s\n' ${PAQUETES}
    else
        error "No se encontraron paquetes so_arm_*"
        FALLOS=$((FALLOS + 1))
    fi
fi

if [ -d "${WS}/src/SO-ARM100" ]; then
    aviso "Se detectó 'SO-ARM100' en src/ — ese repositorio solo tiene STL/CAD,"
    aviso "  no paquetes de ROS 2. El correcto es brukg/SO-100-arm (ver docs/04)."
fi

titulo "Nodo de teleoperación"
NODO="$(cd "${DIR_SCRIPTS}/.." && pwd)/teleop_vision/teleop_vision.py"
comprobar "teleop_vision.py existe" test -f "${NODO}"
comprobar "teleop_vision.py compila sin errores de sintaxis" python3 -m py_compile "${NODO}"

# --- Resumen ---------------------------------------------------------------
printf '\n'
if [ "${FALLOS}" -eq 0 ]; then
    printf '%s╔════════════════════════════════════════════╗%s\n' "${VERDE}${NEGRITA}" "${FIN}"
    printf '%s║   Todo en orden. Listo para ejecutar.      ║%s\n' "${VERDE}${NEGRITA}" "${FIN}"
    printf '%s╚════════════════════════════════════════════╝%s\n\n' "${VERDE}${NEGRITA}" "${FIN}"
    printf '  Terminal 1:  ros2 launch so_arm_100_bringup gz.launch.py\n'
    printf '  Terminal 2:  python3 %s\n\n' "${NODO}"
else
    printf '%s%d comprobación(es) fallida(s).%s\n' "${ROJO}${NEGRITA}" "${FALLOS}" "${FIN}"
    printf 'Consulta docs/06-solucion-de-problemas.md, o vuelve a correr la fase que falta:\n\n'
    printf '  ./scripts/install.sh --desde N\n\n'
    exit 1
fi
