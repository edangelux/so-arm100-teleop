#!/usr/bin/env bash
# Instala la protección contra saltos del brazo en el workspace y lo recompila.
# Si la compilación falla, deja el controlador como estaba y lo vuelve a compilar.
#   bash scripts/proteger_brazo.sh
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WS="${ROS2_WS_ENTREGA:-$HOME/ros2_ws_entrega}"
PKG="$WS/src/so_arm_100_hardware"
[[ -d "$PKG" ]] || { echo "No se encontró $PKG. Ejecute antes: bash scripts/soarm.sh instalar" >&2; exit 1; }
set +u; source /opt/ros/humble/setup.bash; set -u
if python3 "$REPO/brazo-fisico/proteccion/aplicar.py" --comprobar "$PKG" && \
   [[ "$PKG/src/so_arm_100_interface.cpp" -ot "$WS/install/so_arm_100_hardware" ]]; then
    echo "La protección contra saltos ya está instalada y compilada."
    exit 0
fi
python3 "$REPO/brazo-fisico/proteccion/aplicar.py" "$PKG" || exit 1
cp "$REPO/brazo-fisico/proteccion/limitador.hpp" "$PKG/include/so_arm_100_hardware/limitador.hpp"
echo "Compilando el controlador del brazo (1 a 3 minutos)..."
cd "$WS"
if colcon build --symlink-install --packages-select so_arm_100_hardware; then
    touch "$WS/install/so_arm_100_hardware"
    echo "Protección contra saltos instalada."
    exit 0
fi
echo "La compilación falló: se restaura el controlador original." >&2
for f in "$PKG/include/so_arm_100_hardware/so_arm_100_interface.hpp" "$PKG/src/so_arm_100_interface.cpp"; do
    [[ -f "$f.sin_proteccion" ]] && cp "$f.sin_proteccion" "$f"
done
rm -f "$PKG/include/so_arm_100_hardware/limitador.hpp"
colcon build --symlink-install --packages-select so_arm_100_hardware >/dev/null 2>&1
echo "Controlador original restaurado. Envíe la salida de arriba para corregir la protección." >&2
exit 1
