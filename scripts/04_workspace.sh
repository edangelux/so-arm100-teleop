#!/usr/bin/env bash
#
# Fase 4 — Workspace de ROS 2, paquetes del SO-ARM100 y compilación
#
# Nota sobre el repositorio del robot:
#   Los paquetes de ROS 2 (URDF, MoveIt, bringup) están en brukg/SO-100-arm.
#   El repositorio TheRobotStudio/SO-ARM100 contiene SOLO los STL, los CAD y la
#   lista de materiales — no tiene paquetes de ROS 2. Clonarlo en src/ es una
#   causa frecuente de "package not found".

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root
comprobar_ubuntu_2204

WS="${ROS2_WS:-$HOME/ros2_ws}"
REPO_ROBOT="https://github.com/brukg/SO-100-arm.git"
# El overlay de la fase 5 está verificado contra este commit exacto. Si upstream
# cambia, los archivos del overlay podrían no encajar, así que se fija la
# versión. Para usar la última:  COMMIT_ROBOT=main bash scripts/04_workspace.sh
COMMIT_ROBOT="${COMMIT_ROBOT:-789b6b2c32819d792105b068a4c70c32767d4e46}"
DIR_ROBOT="${WS}/src/SO-100-arm"

titulo "Fase 4 · Workspace y compilación"

if [ ! -d /opt/ros/humble ]; then
    morir "No se encontró ROS 2 Humble. Ejecuta primero: bash scripts/01_ros2_humble.sh"
fi

# Los setup.bash de ROS no son compatibles con 'set -u' (ver nota en la fase 1).
set +u
# shellcheck source=/dev/null
source /opt/ros/humble/setup.bash
set -u

# --- 1. Workspace ----------------------------------------------------------
paso "Preparando el workspace en ${WS}"
mkdir -p "${WS}/src"
ok "Workspace listo"

# --- 2. Paquetes del robot -------------------------------------------------
titulo "Paquetes del SO-ARM100"
if [ -d "${DIR_ROBOT}/.git" ]; then
    paso "El repositorio ya existe; actualizando"
    git -C "${DIR_ROBOT}" pull --ff-only || aviso "No se pudo actualizar (¿tienes cambios locales?). Se continúa con la copia actual."
else
    paso "Clonando ${REPO_ROBOT}"
    git clone "${REPO_ROBOT}" "${DIR_ROBOT}"
fi

paso "Fijando el repositorio en ${COMMIT_ROBOT:0:12}"
git -C "${DIR_ROBOT}" checkout -q "${COMMIT_ROBOT}" 2>/dev/null || \
    aviso "No se pudo fijar el commit; se sigue con la rama actual."
ok "Paquetes del robot en ${DIR_ROBOT}"

# El plugin IKFast es opcional y es el que más falla al compilar.
# MoveIt funciona perfectamente con el solucionador KDL por defecto.
PLUGIN_IKFAST="${DIR_ROBOT}/so_arm_100_5dof_arm_ikfast_plugin"
if [ -d "${PLUGIN_IKFAST}" ] && [ "${COMPILAR_IKFAST:-0}" != "1" ]; then
    touch "${PLUGIN_IKFAST}/COLCON_IGNORE"
    aviso "Se omite so_arm_100_5dof_arm_ikfast_plugin (opcional, falla a menudo al compilar)."
    aviso "Para incluirlo: COMPILAR_IKFAST=1 bash scripts/04_workspace.sh"
fi

# --- 3. Dependencias -------------------------------------------------------
titulo "Resolviendo dependencias con rosdep"
cd "${WS}"
# -r continúa aunque alguna dependencia no exista como binario en Humble.
# Las advertencias amarillas son normales.
rosdep install --from-paths src --ignore-src -r -y || \
    aviso "rosdep terminó con advertencias. Suele ser inofensivo; se continúa."

# --- 4. Compilación --------------------------------------------------------
titulo "Compilando (esto tarda entre 3 y 15 minutos)"

# Con poca RAM, compilar en paralelo agota la memoria y mata la terminal.
RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
ARGS_BUILD=(--symlink-install)
if [ "${RAM_MB}" -lt 6000 ]; then
    aviso "Se detectaron ${RAM_MB} MB de RAM. Compilando secuencialmente para no agotar la memoria."
    ARGS_BUILD+=(--executor sequential --parallel-workers 1)
fi

cd "${WS}"
colcon build "${ARGS_BUILD[@]}"

# --- 5. Entorno ------------------------------------------------------------
titulo "Configurando el entorno"
anadir_a_bashrc "source ${WS}/install/setup.bash"

set +u
# shellcheck source=/dev/null
source "${WS}/install/setup.bash"
set -u

# --- 6. Verificación -------------------------------------------------------
titulo "Verificación"
PAQUETES="$(ros2 pkg list 2>/dev/null | grep '^so_arm' || true)"
if [ -n "${PAQUETES}" ]; then
    ok "Paquetes disponibles:"
    printf '    %s\n' ${PAQUETES}
else
    error "No se encontraron los paquetes so_arm_*. Revisa la salida de colcon build."
    aviso "Ver docs/06-solucion-de-problemas.md"
fi

titulo "Fase 4 completada"
printf '\n%sCierra esta terminal y abre una nueva%s, luego:\n\n' "${NEGRITA}" "${FIN}"
printf '  Terminal 1:  cd %s && ros2 launch so_arm_100_bringup gz.launch.py\n' "${WS}"
printf '  Terminal 2:  python3 %s/teleop_vision/teleop_vision.py\n\n' "$(cd "${DIR_SCRIPTS}/.." && pwd)"
