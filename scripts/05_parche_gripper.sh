#!/usr/bin/env bash
#
# Fase 5 — Parche del controlador de la pinza para ROS 2 Humble
#
# EL PROBLEMA
#   Los paquetes de brukg/SO-100-arm declaran el controlador de la pinza como:
#
#       gripper_controller:
#         type: parallel_gripper_action_controller/GripperActionController
#
#   Ese controlador se incorporó a ros2_controllers en **Jazzy**. En **Humble**
#   no existe, así que controller_manager no lo encuentra y el lanzamiento falla:
#
#       [ros2-7] Error loading controller, check controller_manager logs
#       [ERROR] process has died [...] 'ros2 control load_controller
#                --set-state active gripper_controller'
#
#   Lo mismo pasa en moveit_controllers.yaml, que lo declara como
#   'ParallelGripperCommand' — otro tipo que solo existe de Jazzy en adelante.
#
# LA SOLUCIÓN
#   Se cambia la pinza a joint_trajectory_controller/JointTrajectoryController,
#   que sí existe en Humble. Además de arreglar el lanzamiento, esto hace que
#   aparezca el tópico /gripper_controller/joint_trajectory, que es justo al que
#   publica teleop_vision.py — así la pinza responde sin configurar nada más.
#
#   Se guarda una copia .original de cada archivo antes de tocarlo.
#
# Es idempotente: si ya está parcheado, no vuelve a tocar nada.

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root

WS="${ROS2_WS:-$HOME/ros2_ws}"
DIR_CFG="${WS}/src/SO-100-arm/so_arm_100_moveit_config/config"
YAML_CTRL="${DIR_CFG}/ros2_controllers.yaml"
YAML_MOVEIT="${DIR_CFG}/moveit_controllers.yaml"

titulo "Fase 5 · Parche del controlador de la pinza (Humble)"

[ -f "${YAML_CTRL}" ] || morir "No se encontró ${YAML_CTRL}
       ¿Ejecutaste antes la fase 4?  bash scripts/04_workspace.sh"

# --- Parche ----------------------------------------------------------------
paso "Revisando la configuración de controladores"

python3 - "${YAML_CTRL}" "${YAML_MOVEIT}" <<'PY'
import sys, shutil, os

ctrl, moveit = sys.argv[1], sys.argv[2]
cambios = []

def respaldar(ruta):
    copia = ruta + ".original"
    if not os.path.exists(copia):
        shutil.copy2(ruta, copia)
        print(f"    respaldo: {os.path.basename(copia)}")

# --- ros2_controllers.yaml ------------------------------------------------
texto = open(ctrl, encoding="utf-8").read()
original = texto

# 1. El tipo del controlador: parallel_gripper_action_controller no existe en Humble
texto = texto.replace(
    "type: parallel_gripper_action_controller/GripperActionController",
    "type: joint_trajectory_controller/JointTrajectoryController",
)

# 2. JointTrajectoryController espera 'joints' (lista), no 'joint' (escalar),
#    que es lo que usaba el controlador de pinza.
texto = texto.replace(
    "gripper_controller:\n  ros__parameters:\n    joint: Gripper",
    "gripper_controller:\n  ros__parameters:\n    joints:\n      - Gripper",
)

if texto != original:
    respaldar(ctrl)
    open(ctrl, "w", encoding="utf-8").write(texto)
    cambios.append("ros2_controllers.yaml")

# --- moveit_controllers.yaml ----------------------------------------------
# MoveIt tiene que hablarle al controlador con la misma interfaz. Si la pinza
# pasa a ser un JointTrajectoryController, MoveIt debe usar FollowJointTrajectory.
if os.path.exists(moveit):
    texto = open(moveit, encoding="utf-8").read()
    original = texto
    texto = texto.replace("type: ParallelGripperCommand", "type: FollowJointTrajectory")
    texto = texto.replace("action_ns: gripper_cmd", "action_ns: follow_joint_trajectory")
    if texto != original:
        respaldar(moveit)
        open(moveit, "w", encoding="utf-8").write(texto)
        cambios.append("moveit_controllers.yaml")

# --- Verificación ---------------------------------------------------------
texto = open(ctrl, encoding="utf-8").read()
if "parallel_gripper_action_controller" in texto:
    print("    ERROR: el tipo antiguo sigue presente en ros2_controllers.yaml")
    sys.exit(1)
if "joint: Gripper" in texto:
    print("    ERROR: sigue habiendo 'joint: Gripper' (debe ser una lista 'joints')")
    sys.exit(1)

if cambios:
    print("    parcheado: " + ", ".join(cambios))
else:
    print("    sin cambios: ya estaba parcheado")
PY

ok "Configuración de controladores lista para Humble"

# --- Recompilar ------------------------------------------------------------
titulo "Recompilando so_arm_100_moveit_config"
set +u
# shellcheck source=/dev/null
source /opt/ros/humble/setup.bash
set -u

cd "${WS}"
colcon build --symlink-install --packages-select so_arm_100_moveit_config

titulo "Fase 5 completada"
cat <<FINAL

Vuelve a lanzar la simulación en una terminal NUEVA:

  ${NEGRITA}cd ~/ros2_ws${FIN}
  ${NEGRITA}ros2 launch so_arm_100_bringup gz.launch.py${FIN}

Los tres controladores deben quedar activos. Compruébalo en otra terminal:

  ${NEGRITA}ros2 control list_controllers${FIN}

Deberías ver 'gripper_controller ... active'.

Si quieres volver a la configuración original del repositorio, los archivos
'.original' están junto a los modificados en:
  ${DIR_CFG}

FINAL
