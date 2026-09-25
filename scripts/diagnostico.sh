#!/usr/bin/env bash
# Revisa la instalación del SO-ARM100 de principio a fin y guarda un informe.
#
#   bash scripts/diagnostico.sh          (o el atajo: soarm-diagnostico)
#
# Sirve igual en Ubuntu nativo, en máquina virtual y en WSL2: detecta el
# entorno y ajusta las comprobaciones y los consejos. No mueve el brazo ni
# instala nada. Cada línea dice OK, AVISO (funciona, pero conviene revisar)
# o FALLA (impide operar), y en los dos últimos casos qué hacer.
# El informe queda en ~/soarm_diagnostico_AAAA-MM-DD_HHMM.txt.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$REPO/scripts/ui.bash"
USER="${USER:-$(id -un)}"
WS="${ROS2_WS_ENTREGA:-$HOME/ros2_ws_entrega}"
VENV="${SOARM_VENV:-$HOME/teleop_venv_entrega}"
CONF="$HOME/.soarm.conf"
INFORME="$HOME/soarm_diagnostico_$(date +%F_%H%M).txt"
ENT="$(soarm_entorno)"
ok=0; aviso=0; falla=0

linea() {  # estado, qué, detalle
    local e="$1" q="$2" d="${3:-}"
    case "$e" in OK) ok=$((ok+1));; AVISO) aviso=$((aviso+1));; FALLA) falla=$((falla+1));; esac
    printf '%-6s %-44s %s\n' "$e" "$q" "$d" | tee -a "$INFORME"
}
seccion() { printf '\n── %s\n' "$1" | tee -a "$INFORME"; }

: >"$INFORME"
{ echo "Diagnóstico SO-ARM100 — $(date '+%F %T')"; echo "Entorno: $ENT"; } | tee -a "$INFORME"

seccion "Sistema"
. /etc/os-release 2>/dev/null
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 22.04 ]] && linea OK "Ubuntu 22.04" "${PRETTY_NAME:-}" ||
    linea FALLA "Ubuntu 22.04" "Se encontró ${PRETTY_NAME:-desconocido}; ROS 2 Humble requiere 22.04"
case "$ENT" in
    wsl) linea OK "Entorno" "WSL2 (Gazebo usará OpenGL por software)";;
    vm)  linea OK "Entorno" "máquina virtual: $(systemd-detect-virt 2>/dev/null) (Gazebo usará OpenGL por software)";;
    *)   linea OK "Entorno" "Ubuntu nativo";;
esac
[[ "$EUID" -ne 0 ]] && linea OK "Usuario normal" "$USER" || linea FALLA "Usuario normal" "Se está usando root; use su usuario"
groups | grep -qw dialout && linea OK "Grupo dialout (puerto del brazo)" || linea FALLA "Grupo dialout (puerto del brazo)" "sudo usermod -aG dialout $USER y volver a iniciar sesión$([[ $ENT == wsl ]] && echo ' (wsl --shutdown)')"
groups | grep -qw video && linea OK "Grupo video (cámara local)" || linea AVISO "Grupo video (cámara local)" "sudo usermod -aG video $USER; no hace falta con un teléfono por Wi-Fi"

seccion "Repositorio"
if git -C "$REPO" rev-parse >/dev/null 2>&1; then
    linea OK "Repositorio" "$REPO @ $(git -C "$REPO" log --oneline -1 | cut -c1-60)"
    git -C "$REPO" fetch -q 2>/dev/null && atras="$(git -C "$REPO" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)" || atras="?"
    [[ "$atras" == 0 ]] && linea OK "Actualizado" || linea AVISO "Actualizado" "$atras cambios nuevos en GitHub: soarm-actualizar"
else
    linea FALLA "Repositorio" "$REPO no es un clon de git"
fi

seccion "ROS 2 y simulación"
if [[ -f /opt/ros/humble/setup.bash ]]; then
    linea OK "ROS 2 Humble" "/opt/ros/humble"
    set +u; source /opt/ros/humble/setup.bash; set -u
else
    linea FALLA "ROS 2 Humble" "bash scripts/soarm.sh instalar"
fi
command -v ign >/dev/null 2>&1 && linea OK "Gazebo (ign gazebo)" "$(ign gazebo --versions 2>/dev/null | head -1)" || linea FALLA "Gazebo (ign gazebo)" "bash scripts/soarm.sh instalar"
if [[ -f "$WS/install/setup.bash" ]]; then
    linea OK "Workspace compilado" "$WS"
    set +u; source "$WS/install/setup.bash"; set -u
    for p in so_arm_100_bringup so_arm_100_hardware so_arm_100_moveit_config trajectory_mirror; do
        ros2 pkg prefix "$p" >/dev/null 2>&1 && linea OK "Paquete $p" || linea FALLA "Paquete $p" "Recompilar: bash scripts/soarm.sh instalar"
    done
else
    linea FALLA "Workspace compilado" "Falta $WS/install; bash scripts/soarm.sh instalar"
fi
ros2 pkg prefix moveit_ros_move_group >/dev/null 2>&1 && linea OK "MoveIt 2" || linea AVISO "MoveIt 2" "Sin MoveIt no funciona --moveit; bash scripts/soarm.sh instalar"
ros2 pkg prefix gz_ros2_control >/dev/null 2>&1 && linea OK "gz_ros2_control" || linea FALLA "gz_ros2_control" "bash scripts/soarm.sh instalar"

seccion "Python de la teleoperación"
if [[ -x "$VENV/bin/python" ]]; then
    salida="$("$VENV/bin/python" -c 'import cv2, mediapipe as mp, numpy, rclpy; mp.solutions.pose; print(cv2.__version__, mp.__version__, numpy.__version__)' 2>&1 | tail -1)"
    [[ $? -eq 0 && "$salida" =~ ^[0-9] ]] && linea OK "OpenCV, MediaPipe, NumPy, rclpy" "$salida" || linea FALLA "OpenCV, MediaPipe, NumPy, rclpy" "$salida"
else
    linea FALLA "Entorno Python" "Falta $VENV; bash scripts/soarm.sh instalar"
fi
PY="$VENV/bin/python"; [[ -x "$PY" ]] || PY=python3
if "$PY" "$REPO/teleop_vision/prueba_geometria_v15.py" 2>/dev/null | grep -q 'elevación 60: 2D   +73.0   3D   [-+]0.0'; then
    linea OK "Geometría de la v15 (prueba sin cámara)"
else
    linea AVISO "Geometría de la v15 (prueba sin cámara)" "No reprodujo la tabla de docs/16"
fi

seccion "Pantalla y ventanas"
[[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && linea OK "Escritorio gráfico" "DISPLAY=${DISPLAY:-} WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-}" ||
    linea FALLA "Escritorio gráfico" "Sin DISPLAY: Gazebo, RViz y la cámara necesitan ventanas$([[ $ENT == wsl ]] && echo '; actualice WSL (wsl --update) para tener WSLg')"
command -v zenity >/dev/null 2>&1 && linea OK "Ventanas de diálogo (zenity)" || linea AVISO "Ventanas de diálogo (zenity)" "sudo apt install zenity; sin él las preguntas salen en la terminal"
if command -v glxinfo >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
    r="$(glxinfo -B 2>/dev/null | grep -m1 'OpenGL renderer' | cut -d: -f2- | xargs)"
    linea OK "OpenGL" "${r:-sin datos}"
else
    linea AVISO "OpenGL" "sudo apt install mesa-utils para ver el renderizador"
fi

seccion "Cámara"
n=0
for d in /sys/class/video4linux/video*; do
    [[ -e "$d" && "$(cat "$d/index" 2>/dev/null)" == 0 ]] || continue
    n=$((n+1)); linea OK "Cámara local /dev/$(basename "$d")" "$(cat "$d/name")"
done
[[ $n -gt 0 ]] || linea AVISO "Cámaras locales" "Ninguna. Sirve un teléfono por Wi-Fi$([[ $ENT == wsl ]] && echo '; una cámara USB necesita usbipd')$([[ $ENT == vm ]] && echo '; en la VM, conéctela desde el menú Dispositivos')"
[[ -f "$CONF" ]] && . "$CONF"
if [[ "${SOARM_CAM:-}" =~ ^https?:// ]]; then
    ct="$(curl -s --noproxy '*' --max-time 3 -o /dev/null -w '%{http_code} %{content_type}' "$SOARM_CAM" 2>/dev/null)"
    case "$ct" in
        *multipart/*|*image/*) linea OK "Última cámara por red" "$SOARM_CAM responde con video";;
        200*text/html*) linea AVISO "Última cámara por red" "$SOARM_CAM ocupada por otro cliente";;
        *) linea AVISO "Última cámara por red" "$SOARM_CAM no responde (la IP del teléfono puede haber cambiado; teleop la pregunta)";;
    esac
fi

seccion "Brazo"
puertos="$(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null | xargs)"
[[ -n "$puertos" ]] && linea OK "Puerto serie" "$puertos" || linea AVISO "Puerto serie" "Brazo no conectado$([[ $ENT == wsl ]] && echo ' (teleop lo conecta con usbipd)')$([[ $ENT == vm ]] && echo ' (páselo a la VM: Dispositivos → USB)')"
if [[ "$ENT" == wsl ]]; then
    command -v usbipd.exe >/dev/null 2>&1 && linea OK "usbipd (Windows)" || linea AVISO "usbipd (Windows)" "En PowerShell: winget install usbipd"
fi
command -v g++ >/dev/null 2>&1 && linea OK "Compilador para las utilidades" || linea FALLA "Compilador para las utilidades" "sudo apt install build-essential"
pgrep -f "ros2 launch so_arm_100_bringup hardware" >/dev/null && linea AVISO "Lanzador" "Hay una sesión abierta usando el puerto"

seccion "Atajos"
grep -q "scripts/atajos.bash" "$HOME/.bashrc" 2>/dev/null && linea OK "Atajos en ~/.bashrc" || linea AVISO "Atajos en ~/.bashrc" "bash scripts/instalar_atajos.sh"
[[ -f "$CONF" ]] && linea OK "Configuración" "$CONF" || linea AVISO "Configuración" "Se crea con bash scripts/instalar_atajos.sh"
ls "$HOME/.local/share/applications/soarm-teleop.desktop" >/dev/null 2>&1 && linea OK "Icono en el menú de aplicaciones" || linea AVISO "Icono en el menú de aplicaciones" "bash scripts/instalar_atajos.sh"

seccion "Aplicación SO-ARM100 Estudio"
python3 -c 'import http.server, json, socketserver' 2>/dev/null && linea OK "Python para el servidor" "$(python3 --version 2>&1)" || linea FALLA "Python para el servidor" "sudo apt install python3"
[[ -f "$REPO/app/web/vendor/three/three.module.js" ]] && linea OK "Motor 3D incluido" "three.js en app/web/vendor" || linea FALLA "Motor 3D incluido" "Falta app/web/vendor/three: git pull"
if [[ "$ENT" == wsl ]]; then
    ls /mnt/c/Program\ Files*/Microsoft/Edge/Application/msedge.exe >/dev/null 2>&1 && linea OK "Ventana de la aplicación" "Microsoft Edge de Windows" ||
        linea AVISO "Ventana de la aplicación" "Sin Edge: abra http://127.0.0.1:8642 en cualquier navegador de Windows"
else
    nav="$(command -v google-chrome chromium chromium-browser microsoft-edge brave-browser firefox 2>/dev/null | head -1)"
    [[ -n "$nav" ]] && linea OK "Navegador para la ventana" "$nav" || linea AVISO "Navegador para la ventana" "sudo snap install chromium"
fi
ls "$HOME/.local/share/applications/soarm-estudio.desktop" >/dev/null 2>&1 && linea OK "Icono de la aplicación" || linea AVISO "Icono de la aplicación" "bash scripts/instalar_atajos.sh"

printf '\nResumen: %d OK, %d AVISO, %d FALLA\n' "$ok" "$aviso" "$falla" | tee -a "$INFORME"
[[ $falla -eq 0 ]] && echo "Listo para operar: escriba teleop." | tee -a "$INFORME" ||
    echo "Corrija las líneas FALLA antes de operar." | tee -a "$INFORME"
echo "Informe guardado en $INFORME"
if [[ "$ENT" == wsl ]] && [[ -d /mnt/c/Users ]]; then
    win="$(ls -d /mnt/c/Users/*/Downloads 2>/dev/null | grep -v -E 'Public|Default' | head -1)"
    [[ -n "$win" ]] && cp "$INFORME" "$win/" && echo "Copia en Windows: $win/$(basename "$INFORME")"
fi
[[ $falla -eq 0 ]]
