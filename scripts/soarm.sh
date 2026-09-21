#!/usr/bin/env bash
# Lanzador unificado de instalación y operación del sistema presentado.
# Ejecuta teleop_v13.py, conservado sin cambios en entrega/teleoperacion/,
# y selecciona las conexiones de simulación, del brazo físico o de ambos.
set -Eeuo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WS="${ROS2_WS_ENTREGA:-$HOME/ros2_ws_entrega}"
VENV="${SOARM_VENV:-$HOME/teleop_venv_entrega}"
PORT="${SOARM_PORT:-/dev/ttyACM0}"
CAMERA="${SOARM_CAMERA:-0}"
WIDTH="${SOARM_WIDTH:-640}"
HEIGHT="${SOARM_HEIGHT:-480}"
VELOCITY="${SOARM_MAX_VEL:-8.0}"
BAUD="${SOARM_BAUD:-1000000}"
SERVO_SPEED="${SOARM_SERVO_SPEED:-2400}"
SERVO_ACCEL="${SOARM_SERVO_ACCEL:-50}"
CONFIG="${SOARM_CONFIG:-$HOME/teleop_config.json}"
DRY=0
SOFTWARE_GL=0
VERSION=13
MOVEIT=0
RETURN_VEL="${SOARM_RETURN_VEL:-0.5}"
ACTION="${1:-ayuda}"
[[ $# -eq 0 ]] || shift
help_text() {
    cat <<'HELP'
SO-ARM100 — teleoperación gestual: versión 13 (la presentada en la defensa) o 14

  bash scripts/soarm.sh instalar [--ws RUTA] [--venv RUTA]
  bash scripts/soarm.sh sim     [opciones]
  bash scripts/soarm.sh real    [opciones]
  bash scripts/soarm.sh ambos   [opciones]
  bash scripts/soarm.sh verificar [opciones]

Opciones:
  --ws RUTA            Workspace (~/ros2_ws_entrega)
  --venv RUTA          Entorno Python (~/teleop_venv_entrega)
  --puerto RUTA        Puerto físico (/dev/ttyACM0)
  --camara N|URL       Cámara: número de /dev/videoN (0) o URL de una cámara por red,
                       p. ej. DroidCam: http://192.168.1.50:4747/video
  --ancho N --alto N   Resolución (640 x 480), formato MJPG
  --velocidad RAD_S   Tope de velocidad articular (8.0); rango (0, 8]
  --baud N            Bus serie (1000000)
  --servo-speed N     Velocidad interna del servo (2400 ticks/s)
  --servo-accel N     Aceleración del servo (50)
  --config RUTA       Signos/ganancias (~/teleop_config.json)
  --software-gl       Renderizado por software, para máquinas virtuales sin aceleración
  --v14               Usa teleop_v14.py: arranca y reanuda desde la postura medida
  --moveit            Abre además MoveIt 2 y RViz (pausar con P antes de planificar)
  --dry-run           Muestra el plan sin instalar ni iniciar procesos

El algoritmo de v13 no se modifica: filtros, signos, calibración y horizonte de 40 ms.
v14 conserva ese algoritmo y sólo cambia el arranque y la reanudación (docs/15).
Puesta a cero y límites conocidos: docs/09-robot-fisico.md.
Q en la ventana de visión cierra la teleoperación y lleva el brazo a init; después
esta terminal ofrece reabrirla, llevarlo a home y apagar, o apagar sin mover.
Ctrl+C apaga en el acto, sin mover el brazo: al perder el par, el brazo cae.
Requiere Ubuntu 22.04 con ROS 2 Humble (nativo, máquina virtual o WSL2).
HELP
}
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
need_value() { [[ $# -ge 2 && -n "$2" ]] || die "Falta el valor de $1"; }
while [[ $# -gt 0 ]]; do
    case "$1" in
        --ws) need_value "$@"; WS="$2"; shift 2;;
        --venv) need_value "$@"; VENV="$2"; shift 2;;
        --puerto) need_value "$@"; PORT="$2"; shift 2;;
        --camara) need_value "$@"; CAMERA="$2"; shift 2;;
        --ancho) need_value "$@"; WIDTH="$2"; shift 2;;
        --alto) need_value "$@"; HEIGHT="$2"; shift 2;;
        --velocidad) need_value "$@"; VELOCITY="$2"; shift 2;;
        --baud) need_value "$@"; BAUD="$2"; shift 2;;
        --servo-speed) need_value "$@"; SERVO_SPEED="$2"; shift 2;;
        --servo-accel) need_value "$@"; SERVO_ACCEL="$2"; shift 2;;
        --config) need_value "$@"; CONFIG="$2"; shift 2;;
        --software-gl) SOFTWARE_GL=1; shift;;
        --v14) VERSION=14; shift;;
        --moveit) MOVEIT=1; shift;;
        --dry-run) DRY=1; shift;;
        --help|-h) help_text; exit 0;;
        *) die "Opción desconocida: $1";;
    esac
done
case "$ACTION" in
    ayuda|help|--help|-h) help_text; exit 0;;
    instalar|sim|real|ambos|verificar) ;;
    *) die "Modo desconocido: $ACTION";;
esac
[[ "$CAMERA" =~ ^[0-9]+$ || "$CAMERA" =~ ^(https?|rtsp):// ]] || die 'Cámara inválida: debe ser un número de /dev/video o una URL http:// o rtsp://.'
for value in "$WIDTH" "$HEIGHT" "$BAUD" "$SERVO_SPEED" "$SERVO_ACCEL"; do
    [[ "$value" =~ ^[1-9][0-9]*$ ]] || die 'Los parámetros numéricos deben ser enteros positivos.'
done
[[ "$VELOCITY" =~ ^([0-9]+([.][0-9]*)?|[.][0-9]+)$ ]] || die 'Velocidad inválida.'
awk -v v="$VELOCITY" 'BEGIN {exit !(v>0 && v<=8)}' || die 'Velocidad fuera de (0, 8].'
plan() {
    printf 'Modo: %s\nWorkspace: %s\nPython: %s/bin/python\nTeleoperación: v%s\n' "$ACTION" "$WS" "$VENV" "$VERSION"
    if [[ "$CAMERA" =~ ^[0-9]+$ ]]; then
        printf 'Cámara: /dev/video%s, MJPG %sx%s; velocidad máxima: %s rad/s\n' "$CAMERA" "$WIDTH" "$HEIGHT" "$VELOCITY"
    else
        printf 'Cámara por red: %s, redimensionada a %sx%s; velocidad máxima: %s rad/s\n' "$CAMERA" "$WIDTH" "$HEIGHT" "$VELOCITY"
    fi
    case "$ACTION" in
        instalar) printf 'Plan: ROS 2 + Gazebo + entorno Python + fuentes + rosdep + colcon.\n';;
        sim) printf 'Brazo: /arm_controller/joint_trajectory\nPinza: /gripper_controller/gripper_cmd\n';;
        real) printf 'Brazo: /real/arm_controller/joint_trajectory\nPinza: /real/gripper_controller/gripper_cmd\n';;
        ambos) printf 'Brazo: /arm_controller/joint_trajectory + topic_mirror\nPinza: /mirror_gripper_controller/gripper_cmd\n';;
    esac
    [[ "$ACTION" != real && "$ACTION" != ambos ]] || printf 'Puerto: %s; baud: %s; servo-speed: %s; servo-accel: %s\n' "$PORT" "$BAUD" "$SERVO_SPEED" "$SERVO_ACCEL"
    [[ "$MOVEIT" -eq 0 ]] || printf 'MoveIt 2 + RViz: sí (scripts/moveit/moveit_soarm.launch.py modo:=%s)\n' "$ACTION"
}
plan
[[ "$DRY" -eq 0 ]] || exit 0
[[ "$(uname -s)" == Linux ]] || die 'Este lanzador requiere Linux o WSL2; Git Bash no ejecuta ROS 2.'
[[ "$EUID" -ne 0 ]] || die 'Ejecute el lanzador como usuario normal con sudo, no como root.'
check_camera_url() {
    # Un flujo MJPEG no termina nunca: se leen 3 s y se comprueba que sea video.
    # No basta con que lleguen datos: DroidCam responde con una página de texto
    # cuando ya atiende a otro cliente (el cliente de Windows o un navegador).
    local tipo
    tipo="$(curl -s --max-time 3 -o /dev/null -w '%{content_type}' "$CAMERA" 2>/dev/null || true)"
    if [[ "${tipo,,}" == multipart/* || "${tipo,,}" == image/* || "${tipo,,}" == video/* ]]; then
        sleep 2   # DroidCam tarda en liberar la conexión de la comprobación.
        return 0
    fi
    printf 'La dirección respondió con tipo «%s», no con video.\n' "${tipo:-ninguno}" >&2
    return 1
}
load_ros() {
    [[ -f /opt/ros/humble/setup.bash ]] || die 'No se encontró ROS 2 Humble.'
    set +u
    source /opt/ros/humble/setup.bash
    if [[ -f "$WS/install/setup.bash" ]]; then source "$WS/install/setup.bash"; fi
    set -u
}
if [[ "$ACTION" == instalar ]]; then
    source /etc/os-release
    [[ "$ID" == ubuntu && "$VERSION_ID" == 22.04 ]] || die 'La instalación requiere Ubuntu 22.04.'
    # Detecta conflictos con un workspace existente antes de tocar paquetes del sistema.
    python3 "$REPO/scripts/preparar_workspace.py" "$REPO/entrega/src" "$WS"
    if [[ ! -f /opt/ros/humble/setup.bash ]]; then bash "$REPO/scripts/01_ros2_humble.sh"; fi
    bash "$REPO/scripts/02_simulacion.sh"
    sudo apt-get install -y python3-venv python3-pip python3-colcon-common-extensions python3-rosdep libyaml-cpp-dev libportaudio2 v4l-utils build-essential curl
    if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then sudo rosdep init; fi
    rosdep update
    [[ ! -e "$VENV" || -f "$VENV/pyvenv.cfg" ]] || die 'La ruta del entorno existe y no es un entorno virtual.'
    [[ -f "$VENV/pyvenv.cfg" ]] || python3 -m venv --system-site-packages "$VENV"
    "$VENV/bin/python" -m pip install -r "$REPO/entrega/entorno/requirements-recuperado.txt"
    # rclpy procede de ROS 2 (/opt/ros/humble); se carga antes de comprobar el entorno.
    load_ros
    "$VENV/bin/python" -c 'import cv2, mediapipe as mp, numpy, rclpy; mp.solutions.pose; mp.solutions.hands; print(cv2.__version__, mp.__version__, numpy.__version__)'
    sudo usermod -a -G dialout,video "$USER"
    cd "$WS"
    rosdep install --from-paths src --ignore-src -r -y --rosdistro humble
    colcon build --symlink-install
    printf '\nInstalación completa. Si se agregaron grupos al usuario, cierre sesión y vuelva a entrar.\n'
    exit 0
fi
load_ros
[[ -f "$WS/install/setup.bash" ]] || die 'El workspace no está compilado; ejecute primero: bash scripts/soarm.sh instalar'
[[ -x "$VENV/bin/python" ]] || die 'No se encontró Python en el entorno seleccionado.'
export SOARM_MODE="$ACTION" SOARM_CAMERA="$CAMERA" SOARM_WIDTH="$WIDTH" SOARM_HEIGHT="$HEIGHT"
export SOARM_MAX_VEL="$VELOCITY" SOARM_CONFIG="$CONFIG"
export RCUTILS_COLORIZED_OUTPUT=0
[[ "$SOFTWARE_GL" -eq 0 ]] || export LIBGL_ALWAYS_SOFTWARE=1
if [[ "$ACTION" == verificar ]]; then
    "$VENV/bin/python" -c 'import rclpy, cv2, mediapipe as mp, numpy; mp.solutions.pose; print(cv2.__version__,mp.__version__,numpy.__version__)'
    ros2 pkg prefix so_arm_100_bringup
    ros2 pkg prefix so_arm_100_hardware
    ros2 pkg prefix trajectory_mirror
    if [[ "$CAMERA" =~ ^[0-9]+$ ]]; then ls -l "/dev/video$CAMERA" 2>/dev/null || true; else check_camera_url && echo "Cámara por red accesible: $CAMERA"; fi
    ls -l "$PORT" 2>/dev/null || true
    exit 0
fi
if [[ "$CAMERA" =~ ^[0-9]+$ ]]; then
    [[ -r "/dev/video$CAMERA" && -w "/dev/video$CAMERA" ]] || die "Cámara inaccesible: /dev/video$CAMERA. Revise la conexión USB (o USB/IP en WSL2) y el grupo video."
else
    check_camera_url || die "Cámara por red inaccesible: $CAMERA. Compruebe que la aplicación del teléfono está abierta, que ambos equipos están en la misma red y que ni el cliente de DroidCam para Windows ni un navegador tienen el video abierto: DroidCam atiende a un solo cliente."
fi
if [[ "$ACTION" != sim ]]; then
    [[ -c "$PORT" && -r "$PORT" && -w "$PORT" ]] || die "Puerto inaccesible: $PORT. Revise la conexión USB (o USB/IP en WSL2) y el grupo dialout."
fi
for command in setsid timeout flock; do command -v "$command" >/dev/null || die "Falta el programa $command"; done
RUN_BASE="${XDG_STATE_HOME:-$HOME/.local/state}/soarm"
mkdir -p "$RUN_BASE"
exec 9>"$RUN_BASE/session.lock"
flock -n 9 || die 'Ya hay otra sesión del lanzador abierta para este usuario.'
RUN_DIR="$(mktemp -d "$RUN_BASE/sesion-$(date +%Y%m%d-%H%M%S)-XXXXXX")"
pids=()
aux_pids=()
vision_pid=''
cleanup() {
    trap - EXIT INT TERM
    local all=("${pids[@]}" "${aux_pids[@]}")
    [[ -z "$vision_pid" ]] || all+=("$vision_pid")
    for pid in "${all[@]}"; do kill -INT -- "-$pid" 2>/dev/null || true; done
    sleep 2
    for pid in "${all[@]}"; do kill -TERM -- "-$pid" 2>/dev/null || true; done
    printf '\nProcesos de esta sesión cerrados. Registros: %s\n' "$RUN_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
start() {
    local name="$1"; shift
    setsid "$@" >"$RUN_DIR/$name.log" 2>&1 &
    pids+=("$!")
}
start_aux() {
    local name="$1"; shift
    setsid "$@" >"$RUN_DIR/$name.log" 2>&1 &
    aux_pids+=("$!")
}
check_aux() {
    local pid
    for pid in "${aux_pids[@]}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            printf 'AVISO: MoveIt/RViz se cerró; la teleoperación sigue. Registros: %s\n' "$RUN_DIR"
            aux_pids=()
            return
        fi
    done
}
alive() { for pid in "${pids[@]}"; do kill -0 "$pid" 2>/dev/null || die "Un proceso terminó de forma inesperada. Registros: $RUN_DIR"; done; }
wait_controllers() {
    local manager="$1" result deadline=$((SECONDS+120))
    while (( SECONDS < deadline )); do
        alive
        # Humble imprime códigos de color ANSI al inicio de cada línea; se quitan antes
        # de buscar. Se aceptan los dos formatos de Humble: «nombre  tipo  estado» y
        # «nombre[tipo] estado».
        result="$(timeout 6 ros2 control list_controllers -c "$manager" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' || true)"
        if grep -Eq '^arm_controller([[:space:]]|\[).*[[:space:]]active' <<<"$result" &&
           grep -Eq '^gripper_controller([[:space:]]|\[).*[[:space:]]active' <<<"$result"; then return; fi
        sleep 1
    done
    die "Los controladores de $manager no se activaron en 120 s. Registros: $RUN_DIR"
}
if [[ "$ACTION" != real ]]; then
    start gazebo ros2 launch so_arm_100_bringup gz.launch.py
    wait_controllers /controller_manager
fi
if [[ "$ACTION" != sim ]]; then
    start hardware ros2 launch so_arm_100_bringup hardware.launch.py "serial_port:=$PORT" "serial_baudrate:=$BAUD" "servo_speed:=$SERVO_SPEED" "servo_acceleration:=$SERVO_ACCEL"
    wait_controllers /real/controller_manager
fi
if [[ "$ACTION" == ambos ]]; then
    start espejo_acciones ros2 run trajectory_mirror trajectory_mirror_node
    start espejo_topico ros2 run trajectory_mirror topic_mirror_node
    deadline=$((SECONDS+30))
    until timeout 5 ros2 action list 2>/dev/null | grep -Fxq /mirror_gripper_controller/gripper_cmd; do
        alive
        (( SECONDS < deadline )) || die 'La acción espejo de la pinza no apareció en 30 s.'
        sleep 1
    done
fi
if [[ "$MOVEIT" -eq 1 ]]; then
    # MoveIt es auxiliar: si se cierra (por ejemplo, RViz), la teleoperación sigue.
    start_aux moveit ros2 launch "$REPO/scripts/moveit/moveit_soarm.launch.py" "modo:=$ACTION"
    printf 'MoveIt 2 y RViz abiertos. Pause la teleoperación con P antes de ejecutar un plan.\n'
fi
case "$ACTION" in
    sim)   POSE_TOPICS=(--topico /arm_controller/joint_trajectory); POSE_STATES=/joint_states;;
    real)  POSE_TOPICS=(--topico /real/arm_controller/joint_trajectory); POSE_STATES=/real/joint_states;;
    ambos) POSE_TOPICS=(--topico /arm_controller/joint_trajectory --topico /real/arm_controller/joint_trajectory)
           POSE_STATES=/real/joint_states;;
esac
go_pose() {
    # Devuelve 0 si llegó; distinto de 0 si no pudo mover o no llegó.
    timeout 90 python3 "$REPO/scripts/ir_a_pose.py" "$1" "${POSE_TOPICS[@]}" \
        --estados "$POSE_STATES" --velocidad "$RETURN_VEL"
}
start_vision() {
    local runner="$REPO/teleop_vision/ejecutar_v13.py"
    [[ "$VERSION" -eq 13 ]] || runner="$REPO/teleop_vision/ejecutar_v14.py"
    setsid "$VENV/bin/python" "$runner" >>"$RUN_DIR/vision.log" 2>&1 &
    vision_pid=$!
    printf 'Teleoperación v%s iniciada. C: referencia gestual; P: pausa; Q: cerrar y volver a init. Registros: %s\n' "$VERSION" "$RUN_DIR"
}
session_menu() {
    local answer
    printf '\n[Enter] reabrir la teleoperación   [h] llevar a home y apagar   [x] apagar sin mover\n> '
    while true; do
        alive
        check_aux
        if read -r -t 1 answer; then
            case "${answer,,}" in
                '') return 0;;
                h) if go_pose home; then
                       printf 'Brazo en home. Se apaga la sesión.\n'; exit 0
                   fi
                   printf 'No se pudo llevar el brazo a home. Sosténgalo y elija [x] para apagar, o reintente [h].\n> ';;
                x) printf 'Apagando sin mover: el brazo pierde el par.\n'; exit 0;;
                *) printf 'Opción no válida.\n> ';;
            esac
        fi
    done
}
while true; do
    start_vision
    while kill -0 "$vision_pid" 2>/dev/null; do
        alive
        check_aux
        sleep 1
    done
    wait "$vision_pid" || printf 'La teleoperación terminó con error; vea %s/vision.log\n' "$RUN_DIR"
    vision_pid=''
    printf 'Teleoperación cerrada. Llevando el brazo a init a %s rad/s...\n' "$RETURN_VEL"
    go_pose init || printf 'AVISO: el brazo no llegó a init. Revise su postura antes de reabrir.\n'
    session_menu
done
