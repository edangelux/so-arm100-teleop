#!/usr/bin/env bash
#
# Fase 3 — Visión artificial: OpenCV, MediaPipe y permisos de cámara
#
# Sobre el conflicto Qt:
#   El paquete `opencv-python` de pip trae su propia copia de las bibliotecas
#   Qt, que choca con las que instala ROS 2 (RViz también usa Qt). El síntoma
#   es `qt.qpa.plugin: Could not load the Qt platform plugin "xcb"` al abrir la
#   ventana de video.
#   Por eso este script instala OpenCV desde APT (python3-opencv) y le pide a
#   pip que NO instale su propia copia. MediaPipe funciona con el cv2 del
#   sistema sin problema.

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root
comprobar_ubuntu_2204

titulo "Fase 3 · Visión artificial"

# --- 1. OpenCV desde APT ---------------------------------------------------
paso "Instalando OpenCV del sistema (evita el conflicto de Qt con ROS 2)"
sudo apt-get update
apt_instalar python3-opencv python3-numpy v4l-utils

# --- 2. MediaPipe ----------------------------------------------------------
titulo "MediaPipe"
paso "Actualizando pip"
python3 -m pip install --upgrade pip

# numpy<2 : MediaPipe y el OpenCV de Ubuntu 22.04 se compilaron contra NumPy 1.x.
#           Con NumPy 2 aparece "A module that was compiled using NumPy 1.x
#           cannot be run in NumPy 2.x" y nada arranca.
paso "Fijando NumPy 1.x (MediaPipe no es compatible con NumPy 2)"
python3 -m pip install "numpy<2"

# --no-deps evita que pip arrastre opencv-contrib-python y vuelva a meter el Qt
# conflictivo. Las demás dependencias de MediaPipe se instalan a mano abajo.
paso "Instalando MediaPipe sin su copia propia de OpenCV"
python3 -m pip install --no-deps mediapipe

paso "Instalando las dependencias restantes de MediaPipe"
python3 -m pip install \
    absl-py \
    attrs \
    flatbuffers \
    jax \
    jaxlib \
    matplotlib \
    protobuf \
    sentencepiece \
    sounddevice

# --- 3. Permisos de cámara -------------------------------------------------
titulo "Permisos de cámara"
if groups "$USER" | grep -qw video; then
    ok "El usuario '$USER' ya pertenece al grupo 'video'"
else
    sudo usermod -a -G video "$USER"
    ok "Usuario '$USER' agregado al grupo 'video'"
    aviso "Este cambio NO surte efecto hasta que cierres sesión y vuelvas a entrar (o reinicies)."
fi

# --- 4. Verificación -------------------------------------------------------
titulo "Verificación"
if python3 -c "import cv2, mediapipe, numpy" 2>/dev/null; then
    python3 - <<'PY'
import cv2, mediapipe, numpy
print(f"  OpenCV     {cv2.__version__}")
print(f"  MediaPipe  {mediapipe.__version__}")
print(f"  NumPy      {numpy.__version__}")
PY
    ok "Las tres bibliotecas importan correctamente"
else
    error "Alguna biblioteca no importa. Detalle:"
    python3 -c "import cv2, mediapipe, numpy" || true
    aviso "Ver docs/06-solucion-de-problemas.md"
fi

if ls /dev/video* >/dev/null 2>&1; then
    ok "Cámara(s) detectada(s): $(ls /dev/video* | tr '\n' ' ')"
else
    aviso "No se detectó ninguna cámara en /dev/video*"
    aviso "En VirtualBox: menú Dispositivos → Webcams → selecciona tu cámara."
    aviso "Ver docs/06-solucion-de-problemas.md#cámara"
fi

titulo "Fase 3 completada"
printf '\nSiguiente: %s./scripts/04_workspace.sh%s\n\n' "${NEGRITA}" "${FIN}"
