#!/usr/bin/env bash
#
# Fase 5 — Aplicar el overlay de configuración verificada
#
# QUÉ ES ESTO
#   Los paquetes de brukg/SO-100-arm, tal como vienen, NO arrancan en ROS 2
#   Humble. Están escritos contra Jazzy en varios puntos, y además el
#   urdf.xacro de MoveIt no coincide con el del paquete de descripción, así que
#   Gazebo y MoveIt no se pueden lanzar juntos.
#
#   La carpeta overlay/ de este repositorio contiene los archivos ya corregidos
#   y **probados en una instalación real**. Este script los copia sobre el clon
#   del repositorio original y recompila.
#
# QUÉ CORRIGE CADA ARCHIVO
#
#   config/ros2_controllers.yaml
#   config/controllers_5dof.yaml
#       gripper_controller pasa de 'parallel_gripper_action_controller/
#       GripperActionController' (solo existe en Jazzy) a
#       'position_controllers/GripperActionController', que sí existe en Humble.
#       Sin esto: "Error loading controller" y el spawner de gripper_controller
#       muere al lanzar.
#
#   config/moveit_controllers.yaml
#       'ParallelGripperCommand' -> 'GripperCommand', por el mismo motivo.
#
#   config/kinematics.yaml
#       El solucionador pasa de IKFast (so_arm_100_5dof_arm/IKFastKinematicsPlugin)
#       a KDL. El plugin IKFast no compila de forma fiable en Humble y no es
#       necesario: KDL resuelve la cinemática de este brazo sin problema.
#
#   config/so_arm_100.urdf.xacro
#   config/so_arm_100.srdf
#       El robot pasa a llamarse 'so_arm_100_5dof' y el xacro se reescribe para
#       usar la misma estructura que so_arm_100_description (bloque use_sim con
#       el mundo fijo, y ros2_control parametrizado). ESTE es el arreglo que
#       permite lanzar Gazebo y MoveIt a la vez: antes cada uno cargaba un URDF
#       distinto y no se entendían entre sí.
#
#   launch/move_group.launch.py
#   launch/moveit_rviz.launch.py
#       Reescritos para construir el nodo a mano con use_sim_time=true. Los
#       generadores de moveit_configs_utils no permiten pasar ese parámetro, y
#       sin él MoveIt usa el reloj de pared mientras Gazebo usa el de simulación:
#       las trayectorias quedan desfasadas.
#
#   launch/gz_moveit.launch.py   (archivo nuevo)
#       Lanza Gazebo + move_group + RViz de una sola vez. Es el punto de entrada
#       que se usa normalmente.
#
# Se guarda una copia .original de cada archivo antes de sobrescribirlo.
# Es idempotente: puedes correrlo las veces que quieras.

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_REPO="$(cd "${DIR_SCRIPTS}/.." && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root

WS="${ROS2_WS:-$HOME/ros2_ws}"
DIR_ROBOT="${WS}/src/SO-100-arm"
DIR_OVERLAY="${DIR_REPO}/overlay"

titulo "Fase 5 · Overlay de configuración verificada"

[ -d "${DIR_ROBOT}" ] || morir "No se encontró ${DIR_ROBOT}
       Ejecuta primero:  bash scripts/04_workspace.sh"
[ -d "${DIR_OVERLAY}" ] || morir "No se encontró ${DIR_OVERLAY}
       ¿Está completo el repositorio?  git pull"

# --- Copiar ----------------------------------------------------------------
COPIADOS=0
IGUALES=0

while IFS= read -r RELATIVO; do
    ORIGEN="${DIR_OVERLAY}/${RELATIVO}"
    DESTINO="${DIR_ROBOT}/${RELATIVO}"

    mkdir -p "$(dirname "${DESTINO}")"

    if [ -f "${DESTINO}" ] && cmp -s "${ORIGEN}" "${DESTINO}"; then
        IGUALES=$((IGUALES + 1))
        continue
    fi

    # Respaldo, solo la primera vez que se toca cada archivo
    if [ -f "${DESTINO}" ] && [ ! -f "${DESTINO}.original" ]; then
        cp -p "${DESTINO}" "${DESTINO}.original"
        paso "respaldo: $(basename "${DESTINO}").original"
    fi

    cp "${ORIGEN}" "${DESTINO}"
    ok "aplicado: ${RELATIVO}"
    COPIADOS=$((COPIADOS + 1))
done < <(cd "${DIR_OVERLAY}" && find . -type f | sed 's|^\./||' | sort)

printf '\n'
if [ "${COPIADOS}" -eq 0 ]; then
    ok "El overlay ya estaba aplicado (${IGUALES} archivos sin cambios)"
else
    ok "${COPIADOS} archivo(s) aplicados, ${IGUALES} ya estaban al día"
fi

# --- Verificación ----------------------------------------------------------
titulo "Verificando"
CFG="${DIR_ROBOT}/so_arm_100_moveit_config/config"

if grep -q "parallel_gripper_action_controller" "${CFG}"/*.yaml 2>/dev/null; then
    morir "Sigue habiendo 'parallel_gripper_action_controller' en la configuración.
       Ese tipo no existe en Humble y el lanzamiento fallará."
fi
ok "Sin referencias a controladores de Jazzy"

grep -q "position_controllers/GripperActionController" "${CFG}/ros2_controllers.yaml" \
    && ok "gripper_controller: position_controllers/GripperActionController"

grep -q "kdl_kinematics_plugin" "${CFG}/kinematics.yaml" \
    && ok "Solucionador de cinemática: KDL"

[ -f "${DIR_ROBOT}/so_arm_100_bringup/launch/gz_moveit.launch.py" ] \
    && ok "Launch combinado gz_moveit.launch.py presente"

# --- Recompilar ------------------------------------------------------------
titulo "Recompilando"
set +u
# shellcheck source=/dev/null
source /opt/ros/humble/setup.bash
set -u

cd "${WS}"
colcon build --symlink-install \
    --packages-select so_arm_100_moveit_config so_arm_100_bringup

titulo "Fase 5 completada"
cat <<FINAL

Lanza el sistema en una terminal ${NEGRITA}NUEVA${FIN}:

  ${NEGRITA}cd ~/ros2_ws${FIN}
  ${NEGRITA}ros2 launch so_arm_100_bringup gz_moveit.launch.py${FIN}

Esto abre Gazebo, move_group y RViz a la vez. Y en otra terminal:

  ${NEGRITA}python3 ${DIR_REPO}/teleop_vision/teleop_vision.py${FIN}

Los archivos '.original' quedan junto a los modificados por si quieres volver
a la configuración del repositorio original:
  ${CFG}

FINAL
