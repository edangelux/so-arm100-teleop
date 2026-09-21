# Atajos del SO-ARM100: órdenes de una palabra para no escribir rutas ni opciones.
#
# Se cargan desde ~/.bashrc (lo agrega scripts/instalar_atajos.sh) y leen la
# configuración de ~/.soarm.conf, que se crea con «soarm-config».
#
#   teleop            arranca todo: pregunta la cámara (integrada, virtual o
#                     teléfono por Wi-Fi, con su IP), detecta el brazo (en WSL2
#                     lo conecta con usbipd), elige el modo (ambos si hay brazo,
#                     sim si no) y abre MoveIt. Ubuntu nativo, máquina virtual y WSL2
#   teleop sim|real|ambos [opciones de soarm.sh]
#   centrar           lleva los seis servos a 2048 (ROS cerrado)
#   servos            lista los servos con posición, carga y temperatura
#   soarm-ensayo ...  ensayos de rendimiento (docs/17)
#   soarm-registros   muestra la carpeta y el final de los registros de la última sesión
#   soarm-actualizar  git pull del repositorio
#   soarm-camara      elige y prueba la cámara sin arrancar nada
#   soarm-diagnostico revisa la instalación completa y guarda un informe
#   soarm-config      crea o cambia ~/.soarm.conf
#   soarm-ayuda       esta lista
#
# Todo lo que hacen estas órdenes también se puede hacer a mano con
# scripts/soarm.sh; los atajos sólo evitan repetir rutas y opciones.

_soarm_conf="$HOME/.soarm.conf"
_soarm_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ui.bash
source "$_soarm_dir/ui.bash"

_soarm_cargar() {
    SOARM_REPO="$HOME/so-arm100-teleop"
    SOARM_CAM="0"
    SOARM_PUERTO="/dev/ttyACM0"
    SOARM_MODO="auto"
    SOARM_VERSION="14"
    SOARM_MOVEIT="1"
    SOARM_VELOCIDAD=""
    SOARM_BUSID=""
    SOARM_SOFTWARE_GL="auto"
    SOARM_PREGUNTAR_CAMARA="1"
    # shellcheck disable=SC1090
    [[ -f "$_soarm_conf" ]] && source "$_soarm_conf"
}

_soarm_wsl() { [[ "$(soarm_entorno)" == wsl ]]; }

_soarm_software_gl() {  # 0 si conviene renderizar por software
    case "$SOARM_SOFTWARE_GL" in
        1) return 0;; 0) return 1;;
    esac
    # WSL2 y máquinas virtuales: Gazebo necesita OpenGL por software (docs/14).
    [[ "$(soarm_entorno)" != nativo ]]
}

_soarm_scs() { echo "$HOME/ros2_ws_entrega/src/so_arm_100_hardware/include/SCServo_Linux"; }

_soarm_compilar() {
    # Compila una utilidad de brazo-fisico/utilidades si falta o si el fuente es más nuevo.
    local nombre="$1" fuente="$2" bin="$HOME/.local/bin/soarm_$1" scs
    scs="$(_soarm_scs)"
    [[ -d "$scs" ]] || { echo "Falta el workspace compilado; ejecute: bash scripts/soarm.sh instalar" >&2; return 1; }
    mkdir -p "$HOME/.local/bin"
    if [[ ! -x "$bin" || "$fuente" -nt "$bin" ]]; then
        echo "Compilando $nombre..." >&2
        g++ -std=c++14 -O2 -I "$scs" "$fuente" "$scs"/*.cpp -o "$bin" 2>/dev/null || { echo "No compiló $nombre" >&2; return 1; }
    fi
    echo "$bin"
}

_soarm_ros_abierto() { pgrep -f "so_arm_100_bringup.*hardware.launch.py" >/dev/null 2>&1; }

soarm-conectar() {
    # Deja el puerto del brazo disponible. En WSL2 lo pasa desde Windows con usbipd;
    # en Ubuntu nativo y en máquina virtual lo busca entre /dev/ttyACM* y /dev/ttyUSB*.
    _soarm_cargar
    local silencio="${1:-}"
    [[ -e "$SOARM_PUERTO" ]] && return 0
    local encontrados=()
    mapfile -t encontrados < <(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null)
    if [[ ${#encontrados[@]} -eq 1 ]]; then
        [[ -n "$silencio" ]] || echo "El brazo aparece en ${encontrados[0]} (no en $SOARM_PUERTO); se usa ese."
        SOARM_PUERTO="${encontrados[0]}"
        return 0
    fi
    local ent; ent="$(soarm_entorno)"
    if [[ "$ent" == wsl ]] && command -v usbipd.exe >/dev/null 2>&1; then
        local busid="$SOARM_BUSID"
        [[ -n "$busid" ]] || busid="$(usbipd.exe list 2>/dev/null | tr -d '\r' | grep -iE 'CH34|USB-SERIAL|USB Serial' | awk '{print $1}' | head -1)"
        if [[ -n "$busid" ]]; then
            [[ -n "$silencio" ]] || echo "Conectando la placa de los servos (BUSID $busid) desde Windows..."
            if usbipd.exe attach --wsl --busid "$busid" >/dev/null 2>&1; then
                local i
                for i in $(seq 1 20); do
                    mapfile -t encontrados < <(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null)
                    [[ ${#encontrados[@]} -gt 0 ]] && break
                    sleep 0.5
                done
                if [[ ${#encontrados[@]} -gt 0 ]]; then
                    [[ -e "$SOARM_PUERTO" ]] || SOARM_PUERTO="${encontrados[0]}"
                    [[ -n "$silencio" ]] || echo "Brazo disponible en $SOARM_PUERTO."
                    return 0
                fi
            elif [[ -z "$silencio" ]]; then
                ui_error "SO-ARM100 — brazo" "Windows no dejó pasar la placa a WSL. Ejecute una sola vez en PowerShell como administrador:

    usbipd bind --busid $busid

y vuelva a intentarlo."
                return 1
            fi
        fi
    fi
    [[ -n "$silencio" ]] && return 1
    local ayuda
    case "$ent" in
        wsl) ayuda="Conecte el cable USB de la placa de los servos. En WSL2 también hace falta usbipd en Windows (winget install usbipd).";;
        vm)  ayuda="Conecte el cable USB de la placa y páselo a la máquina virtual: en VirtualBox, menú Dispositivos → USB → USB-SERIAL CH343 (o similar); en VMware, VM → Dispositivos extraíbles.";;
        *)   ayuda="Conecte el cable USB de la placa de los servos y encienda su fuente.";;
    esac
    if [[ ${#encontrados[@]} -gt 1 ]]; then
        ayuda="Hay varios puertos serie (${encontrados[*]}). Indique cuál es el del brazo con soarm-config."
    fi
    ui_error "SO-ARM100 — brazo" "No se encontró el brazo.

$ayuda"
    return 1
}

_soarm_tiene() { local x="$1"; shift; [[ " $* " == *" $x "* ]]; }

teleop() {
    _soarm_cargar
    local modo="$SOARM_MODO" version="$SOARM_VERSION" moveit="$SOARM_MOVEIT" resto=() extra=() a
    for a in "$@"; do
        case "$a" in
            sim|real|ambos) modo="$a";;
            --v13|--v14|--v15) version="${a#--v}";;
            --moveit) moveit=1;;
            --sin-moveit) moveit=0;;
            *) resto+=("$a");;
        esac
    done
    if [[ "$modo" == auto ]]; then
        if soarm-conectar silencio; then modo=ambos; else modo=sim; fi
        echo "Modo elegido automáticamente: $modo (ambos si el brazo está conectado; si no, sim)"
    fi
    if [[ "$modo" != sim ]]; then
        soarm-conectar || return 1
        if ! groups | grep -qw dialout; then
            echo "Su usuario no está en el grupo dialout: ejecute wsl --shutdown en PowerShell y reabra Ubuntu." >&2
            return 1
        fi
        _soarm_tiene --puerto "${resto[@]}" || extra+=(--puerto "$SOARM_PUERTO")
    fi
    [[ "$version" == 13 ]] || extra+=("--v$version")
    [[ "$moveit" == 1 ]] && extra+=(--moveit)
    if ! _soarm_tiene --camara "${resto[@]}"; then
        local cam="$SOARM_CAM"
        if [[ "$SOARM_PREGUNTAR_CAMARA" == 1 ]] && ! _soarm_tiene --dry-run "${resto[@]}"; then
            cam="$(bash "$_soarm_dir/elegir_camara.sh" | tail -1)" || { echo "Cámara no elegida; no se arranca."; return 1; }
            [[ -n "$cam" ]] || { echo "Cámara no elegida; no se arranca."; return 1; }
        fi
        extra+=(--camara "$cam")
    fi
    if [[ -n "$SOARM_VELOCIDAD" ]] && ! _soarm_tiene --velocidad "${resto[@]}"; then
        extra+=(--velocidad "$SOARM_VELOCIDAD")
    fi
    if [[ "$modo" != real ]] && _soarm_software_gl && ! _soarm_tiene --software-gl "${resto[@]}"; then
        extra+=(--software-gl)
    fi
    if [[ "$modo" != sim && "$version" == 13 ]] && ! _soarm_tiene --dry-run "${resto[@]}"; then
        echo "La versión 13 arranca ordenando cero: se centran los servos antes."
        centrar || return 1
    fi
    echo "→ bash scripts/soarm.sh $modo ${extra[*]} ${resto[*]}"
    (cd "$SOARM_REPO" && bash scripts/soarm.sh "$modo" "${extra[@]}" "${resto[@]}")
}

teleop-sim()   { teleop sim "$@"; }
teleop-real()  { teleop real "$@"; }
teleop-ambos() { teleop ambos "$@"; }

centrar() {
    _soarm_cargar
    _soarm_ros_abierto && { echo "El lanzador tiene el puerto abierto; ciérrelo antes (x en su menú)." >&2; return 1; }
    soarm-conectar || return 1
    local bin
    bin="$(_soarm_compilar centrar "$SOARM_REPO/brazo-fisico/utilidades/originales/center_servos.cpp" | tail -1)" || return 1
    [[ -x "$bin" ]] || return 1
    echo "Centrando los seis servos en 2048. Sostenga el brazo."
    "$bin"
}

servos() {
    _soarm_cargar
    _soarm_ros_abierto && { echo "El lanzador tiene el puerto abierto; ciérrelo antes (x en su menú)." >&2; return 1; }
    soarm-conectar || return 1
    local bin
    bin="$(_soarm_compilar servos "$SOARM_REPO/brazo-fisico/utilidades/originales/list_servos.cpp" | tail -1)" || return 1
    [[ -x "$bin" ]] && "$bin"
}

soarm-ensayo() {
    _soarm_cargar
    local e="$SOARM_REPO/pruebas/ensayos" modo=real
    _soarm_ros_abierto || modo=sim
    local tipo="${1:-}"; [[ $# -gt 0 ]] && shift
    ( source /opt/ros/humble/setup.bash >/dev/null 2>&1
      [[ -f "$HOME/ros2_ws_entrega/install/setup.bash" ]] && source "$HOME/ros2_ws_entrega/install/setup.bash"
      cd "$SOARM_REPO" || exit 1
      case "$tipo" in
        a1) python3 "$e/ensayo_precision.py" --tipo estatico --modo "$modo" "$@";;
        a5) python3 "$e/ensayo_precision.py" --tipo escalon --modo "$modo" "$@";;
        a2) python3 "$e/ensayo_repetibilidad.py" --modo "$modo" "$@";;
        a3) python3 "$e/ensayo_carga.py" --modo "$modo" --etiqueta "${1:-sin_carga}" "${@:2}";;
        a4) _soarm_ros_abierto && { echo "Cierre el lanzador antes del ensayo térmico." >&2; exit 1; }
            bin="$(_soarm_compilar termico "$SOARM_REPO/brazo-fisico/utilidades/ensayos/ensayo_termico.cpp" | tail -1)" || exit 1
            d="$SOARM_REPO/pruebas/resultados/$(date +%F)"; mkdir -p "$d"
            "$bin" "${1:-30}" "${2:-20}" "${3:-55}" "$d/a4_termico_$(date +%H%M%S).csv" "$SOARM_PUERTO";;
        b1) python3 "$e/registrador.py" --modo "${1:-real}" --version "v$SOARM_VERSION";;
        analizar) python3 "$e/analizar.py" "${1:-$SOARM_REPO/pruebas/resultados/$(date +%F)}";;
        *) echo "Uso: soarm-ensayo a1 | a5 | a2 | a3 ETIQUETA | a4 [minutos] | b1 [sim|real|ambos] | analizar [carpeta]"
           echo "Detalles en docs/17-ensayos-de-rendimiento.md"; exit 2;;
      esac )
}

soarm-registros() {
    local s
    s="$(ls -td "${XDG_STATE_HOME:-$HOME/.local/state}"/soarm/sesion-* 2>/dev/null | head -1)"
    [[ -n "$s" ]] || { echo "No hay sesiones registradas."; return 1; }
    echo "Última sesión: $s"
    local f
    for f in "$s"/*.log; do echo "════ $(basename "$f")"; tail -n "${1:-15}" "$f"; done
}

soarm-actualizar() { _soarm_cargar; (cd "$SOARM_REPO" && git pull); }

soarm-config() {
    _soarm_cargar
    local v
    echo "Configuración de los atajos (Enter conserva el valor entre corchetes)."
    read -r -p "Carpeta del repositorio [$SOARM_REPO]: " v; SOARM_REPO="${v:-$SOARM_REPO}"
    read -r -p "Cámara: número o URL de DroidCam [$SOARM_CAM]: " v; SOARM_CAM="${v:-$SOARM_CAM}"
    read -r -p "Puerto del brazo [$SOARM_PUERTO]: " v; SOARM_PUERTO="${v:-$SOARM_PUERTO}"
    read -r -p "Modo por omisión: auto, sim, real o ambos [$SOARM_MODO]: " v; SOARM_MODO="${v:-$SOARM_MODO}"
    read -r -p "Versión de la teleoperación: 13, 14 o 15 [$SOARM_VERSION]: " v; SOARM_VERSION="${v:-$SOARM_VERSION}"
    read -r -p "Abrir MoveIt y RViz: 1 sí, 0 no [$SOARM_MOVEIT]: " v; SOARM_MOVEIT="${v:-$SOARM_MOVEIT}"
    read -r -p "Tope de velocidad en rad/s, vacío = 8 [$SOARM_VELOCIDAD]: " v; SOARM_VELOCIDAD="${v:-$SOARM_VELOCIDAD}"
    read -r -p "BUSID de usbipd, vacío = detectar [$SOARM_BUSID]: " v; SOARM_BUSID="${v:-$SOARM_BUSID}"
    read -r -p "OpenGL por software: auto, 1 o 0 [$SOARM_SOFTWARE_GL]: " v; SOARM_SOFTWARE_GL="${v:-$SOARM_SOFTWARE_GL}"
    read -r -p "Preguntar la cámara al arrancar: 1 sí, 0 usar la guardada [$SOARM_PREGUNTAR_CAMARA]: " v; SOARM_PREGUNTAR_CAMARA="${v:-$SOARM_PREGUNTAR_CAMARA}"
    cat > "$_soarm_conf" <<CONF
# Configuración de los atajos del SO-ARM100 (scripts/atajos.bash). Se cambia con soarm-config.
SOARM_REPO="$SOARM_REPO"
SOARM_CAM="$SOARM_CAM"
SOARM_PUERTO="$SOARM_PUERTO"
SOARM_MODO="$SOARM_MODO"
SOARM_VERSION="$SOARM_VERSION"
SOARM_MOVEIT="$SOARM_MOVEIT"
SOARM_VELOCIDAD="$SOARM_VELOCIDAD"
SOARM_BUSID="$SOARM_BUSID"
SOARM_SOFTWARE_GL="$SOARM_SOFTWARE_GL"
SOARM_PREGUNTAR_CAMARA="$SOARM_PREGUNTAR_CAMARA"
SOARM_CAM_TIPO="${SOARM_CAM_TIPO:-}"
SOARM_CAM_IP="${SOARM_CAM_IP:-}"
SOARM_CAM_DEV="${SOARM_CAM_DEV:-}"
CONF
    echo "Guardado en $_soarm_conf"
}

soarm-ayuda() {
    sed -n '1,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    _soarm_cargar
    echo "Configuración actual ($_soarm_conf): modo $SOARM_MODO, v$SOARM_VERSION, MoveIt $SOARM_MOVEIT, cámara $SOARM_CAM"
}

soarm-camara() { bash "$_soarm_dir/elegir_camara.sh"; }
soarm-diagnostico() { bash "$_soarm_dir/diagnostico.sh" "$@"; }
