#!/usr/bin/env bash
# Instala los atajos de una palabra (teleop, centrar, servos, soarm-*) en ~/.bashrc
# y crea ~/.soarm.conf. Se puede ejecutar varias veces: no duplica nada.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINEA="[[ -f \"$REPO/scripts/atajos.bash\" ]] && source \"$REPO/scripts/atajos.bash\"   # atajos SO-ARM100"
if grep -Fq "scripts/atajos.bash" "$HOME/.bashrc" 2>/dev/null; then
    echo "Los atajos ya estaban en ~/.bashrc."
else
    printf '\n%s\n' "$LINEA" >> "$HOME/.bashrc"
    echo "Atajos agregados a ~/.bashrc."
fi
CONF="$HOME/.soarm.conf"
if [[ -f "$CONF" ]]; then
    echo "Se conserva la configuración existente: $CONF"
else
    CAM=0; PUERTO=/dev/ttyACM0
    if [[ -f "$HOME/.soarm_env" ]]; then
        # Reutiliza la cámara y el puerto de la guía de pruebas en WSL2.
        CAM="$(bash -c 'source ~/.soarm_env >/dev/null 2>&1; echo "${CAM:-0}"')"
        PUERTO="$(bash -c 'source ~/.soarm_env >/dev/null 2>&1; echo "${PUERTO:-/dev/ttyACM0}"')"
    fi
    cat > "$CONF" <<CONF
# Configuración de los atajos del SO-ARM100 (scripts/atajos.bash). Se cambia con soarm-config.
SOARM_REPO="$REPO"
SOARM_CAM="$CAM"
SOARM_PUERTO="$PUERTO"
SOARM_MODO="auto"
SOARM_VERSION="14"
SOARM_MOVEIT="1"
SOARM_VELOCIDAD=""
SOARM_BUSID=""
CONF
    echo "Configuración creada: $CONF (cámara: $CAM)"
fi
# Ventanas de diálogo para elegir la cámara y avisar de errores sin leer la terminal.
if ! command -v zenity >/dev/null 2>&1; then
    echo "Instalando zenity (ventanas de diálogo)..."
    sudo apt-get install -y zenity mesa-utils >/dev/null 2>&1 && echo "zenity instalado." ||
        echo "No se pudo instalar zenity; las preguntas saldrán en la terminal."
fi

# Iconos en el menú de aplicaciones: abren una terminal con la orden ya escrita.
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
icono() {  # archivo, nombre, comentario, orden, icono
    cat >"$APPS/$1" <<DESK
[Desktop Entry]
Type=Application
Name=$2
Comment=$3
Exec=bash -ic '$4; echo; read -rp "Pulse Enter para cerrar esta ventana..."'
Terminal=true
Icon=$5
Categories=Science;Education;
DESK
    chmod +x "$APPS/$1"
}
icono soarm-teleop.desktop "SO-ARM100 Teleoperación" "Arranca la teleoperación del brazo SO-ARM100" teleop applications-science
icono soarm-diagnostico.desktop "SO-ARM100 Diagnóstico" "Revisa la instalación del SO-ARM100" soarm-diagnostico utilities-system-monitor
ESCRITORIO="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [[ -d "$ESCRITORIO" && "$ESCRITORIO" != "$HOME" ]]; then
    cp "$APPS/soarm-teleop.desktop" "$ESCRITORIO/"
    gio set "$ESCRITORIO/soarm-teleop.desktop" metadata::trusted true 2>/dev/null || true
    echo "Icono «SO-ARM100 Teleoperación» en el escritorio."
fi
echo "Iconos agregados al menú de aplicaciones."
echo "Abra una terminal nueva, o ejecute «source ~/.bashrc», y escriba soarm-ayuda."
