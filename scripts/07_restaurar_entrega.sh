#!/usr/bin/env bash
# Reconstruye en un workspace nuevo las fuentes exactas de la entrega, sin tocar el hardware.
set -Eeuo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${ROS2_WS_ENTREGA:-$HOME/ros2_ws_entrega}"
if [[ "${1:-}" == "--help" ]]; then
    printf 'Uso: ROS2_WS_ENTREGA=~/ros2_ws_entrega bash scripts/07_restaurar_entrega.sh\n'
    printf 'Requiere un directorio nuevo, Ubuntu 22.04 y ROS 2 Humble. No inicia el robot.\n'
    exit 0
fi
[[ -f /opt/ros/humble/setup.bash ]] || { echo 'No se encontró ROS 2 Humble.' >&2; exit 1; }
[[ ! -e "$DEST" ]] || { echo "El directorio ya existe: $DEST. Indique una ruta nueva." >&2; exit 1; }
command -v colcon >/dev/null || { echo 'No se encontró colcon.' >&2; exit 1; }
command -v rosdep >/dev/null || { echo 'No se encontró rosdep.' >&2; exit 1; }
mkdir -p "$DEST/src"
cp -a "$REPO/entrega/src/." "$DEST/src/"
chmod +x "$DEST"/src/so_arm_100_hardware/scripts/*.py
set +u
source /opt/ros/humble/setup.bash
set -u
cd "$DEST"
rosdep install --from-paths src --ignore-src -r -y --rosdistro humble
colcon build --symlink-install
printf '\nWorkspace preparado: %s\n' "$DEST"
printf 'El hardware no se ha iniciado. Para operar: bash scripts/soarm.sh (ver docs/14).\n'
