#!/usr/bin/env bash
#
# Fase 2 — Simulación: Gazebo, MoveIt 2 y ros2_control
#
# Nota sobre Gazebo:
#   Este proyecto usa el Gazebo NUEVO (`gz sim`, antes Ignition), que es lo que
#   instala `ros-humble-ros-gz`. NO se instala `ros-humble-gazebo-ros-pkgs`,
#   que corresponde a Gazebo Classic (Gazebo 11), un simulador distinto y ya
#   descontinuado. Tener los dos a la vez es una causa clásica de
#   "el mundo carga pero el robot no aparece".

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root
comprobar_ubuntu_2204

titulo "Fase 2 · Gazebo, MoveIt 2 y controladores"

if [ ! -d /opt/ros/humble ]; then
    morir "No se encontró ROS 2 Humble en /opt/ros/humble.
       Ejecuta primero: bash scripts/01_ros2_humble.sh"
fi

# --- Aviso si hay Gazebo Classic instalado ---------------------------------
if dpkg -l 2>/dev/null | grep -qE '^ii\s+(gazebo11|ros-humble-gazebo-ros-pkgs)'; then
    aviso "Se detectó Gazebo Classic (gazebo11 / gazebo-ros-pkgs) instalado."
    aviso "Este proyecto usa el Gazebo nuevo (gz sim). Tenerlos juntos puede causar conflictos."
    aviso "Si la simulación falla, míralo en docs/06-solucion-de-problemas.md"
fi

sudo apt-get update

paso "Instalando Gazebo (gz sim) y el puente con ROS 2"
apt_instalar \
    ros-humble-ros-gz \
    ros-humble-ros-gz-sim \
    ros-humble-ros-gz-bridge \
    ros-humble-gz-ros2-control

paso "Instalando ros2_control y los controladores"
apt_instalar \
    ros-humble-ros2-control \
    ros-humble-ros2-controllers \
    ros-humble-joint-trajectory-controller \
    ros-humble-position-controllers \
    ros-humble-effort-controllers \
    ros-humble-joint-state-broadcaster \
    ros-humble-controller-manager

paso "Instalando MoveIt 2"
apt_instalar \
    ros-humble-moveit \
    ros-humble-moveit-ros-planning-interface \
    ros-humble-moveit-kinematics

paso "Instalando utilidades de descripción del robot"
apt_instalar \
    ros-humble-joint-state-publisher \
    ros-humble-joint-state-publisher-gui \
    ros-humble-xacro \
    ros-humble-tf-transformations \
    ros-humble-robot-state-publisher

titulo "Fase 2 completada"
if command -v gz >/dev/null 2>&1; then
    ok "Gazebo: $(gz sim --version 2>/dev/null | head -n1)"
else
    aviso "El comando 'gz' no está en el PATH todavía. Abre una terminal nueva y prueba: gz sim --version"
fi
printf '\nSiguiente: %sbash scripts/03_vision_python.sh%s\n\n' "${NEGRITA}" "${FIN}"
