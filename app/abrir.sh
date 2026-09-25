#!/usr/bin/env bash
# Abre SO-ARM100 Estudio: arranca el servidor local, con ROS 2 si está instalado,
# y abre la aplicación en una ventana propia del navegador.
#
#   bash app/abrir.sh            abre (o reutiliza) la aplicación
#   bash app/abrir.sh --parar    detiene el servidor
#
# Funciona en Ubuntu nativo, en máquina virtual y en WSL2 (en WSL2 la ventana
# se abre con Microsoft Edge de Windows, que llega al servidor por localhost).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUERTO="${SOARM_APP_PUERTO:-8642}"
URL="http://127.0.0.1:$PUERTO"
ESTADO="${XDG_STATE_HOME:-$HOME/.local/state}/soarm"
mkdir -p "$ESTADO"
source "$REPO/scripts/ui.bash"

vivo() { curl -s --noproxy '*' -m 1 -o /dev/null "$URL/api/estado"; }

if [[ "${1:-}" == --parar ]]; then
    pkill -f "^python3 app/servidor.py --puerto $PUERTO( |$)" && echo "Servidor detenido." || echo "No había servidor."
    exit 0
fi

# Si ya hay un servidor encendido, se comprueba que corra el código actual: tras
# un «git pull» con el servidor encendido, la página nueva pediría rutas que el
# servidor viejo no conoce («Ruta desconocida»).
if vivo; then
    local_v="$(python3 "$REPO/app/estudio/version.py" 2>/dev/null)"
    remoto="$(curl -s --noproxy '*' -m 2 "$URL/api/estado" | python3 -c 'import json,sys
d=json.load(sys.stdin); print(d.get("version", "antigua"), d.get("sesion", {}).get("estado", "detenida"))' 2>/dev/null)"
    remoto_v="${remoto%% *}"; sesion_e="${remoto##* }"
    if [[ -n "$local_v" && "$remoto_v" != "$local_v" ]]; then
        if [[ "$sesion_e" == detenida ]]; then
            echo "El servidor encendido es de una versión anterior; se reinicia con el código actual."
            pkill -f "^python3 app/servidor.py --puerto $PUERTO( |$)"
            for _ in $(seq 1 20); do vivo || break; sleep 0.25; done
        else
            echo "AVISO: el servidor encendido es de una versión anterior y hay una sesión abierta ($sesion_e)."
            echo "       Cierre la sesión en la aplicación y ejecute: soarm-app --parar && soarm-app"
        fi
    fi
fi

if ! vivo; then
    (
        set +u
        # ROS y el workspace, si existen: sin ellos la aplicación funciona en modo aprendizaje.
        [[ -f /opt/ros/humble/setup.bash ]] && source /opt/ros/humble/setup.bash
        [[ -f "$HOME/ros2_ws_entrega/install/setup.bash" ]] && source "$HOME/ros2_ws_entrega/install/setup.bash"
        cd "$REPO" && setsid nohup python3 app/servidor.py --puerto "$PUERTO" >"$ESTADO/estudio.log" 2>&1 < /dev/null &
    )
    for _ in $(seq 1 40); do vivo && break; sleep 0.25; done
    if ! vivo; then
        ui_error "SO-ARM100 Estudio" "El servidor no arrancó. Detalle en $ESTADO/estudio.log:

$(tail -5 "$ESTADO/estudio.log" 2>/dev/null)"
        exit 1
    fi
fi
echo "SO-ARM100 Estudio en $URL"

# Ventana propia (modo aplicación) con el primer navegador disponible.
if [[ "$(soarm_entorno)" == wsl ]] && command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "" msedge --app="$URL" >/dev/null 2>&1 || cmd.exe /c start "" "$URL" >/dev/null 2>&1
    exit 0
fi
for b in google-chrome chromium chromium-browser microsoft-edge brave-browser; do
    if command -v "$b" >/dev/null 2>&1; then
        setsid "$b" --app="$URL" --window-size=1500,920 >/dev/null 2>&1 < /dev/null &
        exit 0
    fi
done
if command -v snap >/dev/null 2>&1 && snap list chromium >/dev/null 2>&1; then
    setsid snap run chromium --app="$URL" >/dev/null 2>&1 < /dev/null &
    exit 0
fi
xdg-open "$URL" >/dev/null 2>&1 || echo "Abra $URL en su navegador."
