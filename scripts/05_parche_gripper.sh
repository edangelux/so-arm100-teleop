#!/usr/bin/env bash
#
# OBSOLETO — NO USAR. Reemplazado por 05_aplicar_overlay.sh
#
# Este script aplicaba una solución INCORRECTA al problema del gripper_controller:
# cambiaba la pinza a joint_trajectory_controller/JointTrajectoryController.
#
# El controlador correcto para Humble es position_controllers/GripperActionController,
# y el problema del gripper era solo el más visible de seis. Faltaban además:
# controllers_5dof.yaml, kinematics.yaml, so_arm_100.urdf.xacro, so_arm_100.srdf
# y los launch de MoveIt.
#
# Aplicar este script sobre una instalación que funciona la ROMPERÍA.
#
# Se conserva como aviso, en lugar de borrarlo, para que quien lo tuviera de
# antes no lo ejecute por costumbre.

cat <<'AVISO'

  ┌────────────────────────────────────────────────────────────────┐
  │  ESTE SCRIPT ESTÁ OBSOLETO Y NO SE VA A EJECUTAR               │
  └────────────────────────────────────────────────────────────────┘

  Aplicaba un arreglo incorrecto del gripper_controller y podría romper
  una instalación que ya funciona.

  Usa en su lugar:

      bash scripts/05_aplicar_overlay.sh

  Explicación completa:  docs/04-workspace-y-compilacion.md  (sección 5)

  Si ya lo ejecutaste alguna vez, restaura los respaldos:

      cd ~/ros2_ws/src/SO-100-arm/so_arm_100_moveit_config/config
      for f in *.original; do cp "$f" "${f%.original}"; done

  ...y después aplica el overlay correcto.

AVISO
exit 1
