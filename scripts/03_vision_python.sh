#!/usr/bin/env bash
#
# Fase 3 — Visión artificial: OpenCV, MediaPipe y permisos de cámara
#
# DOS TRAMPAS QUE YA MORDIERON, y cómo se evitan aquí:
#
# 1) NumPy 2 rompe OpenCV y MediaPipe
#    Ambos están compilados contra NumPy 1.x en Ubuntu 22.04. Con NumPy 2 el
#    'import cv2' revienta con:
#        A module that was compiled using NumPy 1.x cannot be run in NumPy 2.x
#        AttributeError: _ARRAY_API not found
#    No basta con instalar "numpy<2" al principio: CUALQUIER paquete que se
#    instale después y que pida numpy>=2 lo vuelve a subir en silencio.
#    (Una versión anterior de este script instalaba jax y jaxlib — que no son
#    dependencias de MediaPipe — y hacían exactamente eso.)
#    SOLUCIÓN: un archivo de restricciones de pip que se pasa a TODAS las
#    instalaciones. Con él, pip no puede subir NumPy ni aunque un paquete se lo
#    pida: falla la instalación de ese paquete en vez de romper el entorno.
#
# 2) El OpenCV de pip choca con el Qt de ROS 2
#    El paquete 'opencv-python' de pip trae su propia copia de Qt, que choca con
#    la que instala ROS 2 (RViz también usa Qt). Síntoma:
#        qt.qpa.plugin: Could not load the Qt platform plugin "xcb"
#    SOLUCIÓN: OpenCV se instala desde APT (python3-opencv) y a MediaPipe se le
#    pide --no-deps para que no arrastre su propia copia.

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

# --- 2. Restricción de NumPy -----------------------------------------------
# Este archivo se pasa a todas las instalaciones de pip de aquí en adelante.
RESTRICCIONES="$(mktemp)"
echo "numpy<2" > "${RESTRICCIONES}"
trap 'rm -f "${RESTRICCIONES}"' EXIT

# Restos de instalaciones anteriores que EXIGEN numpy>=2. Si quedan, cualquier
# 'pip install' posterior intenta subir NumPy otra vez. jax/jaxlib los instalaba
# por error una version anterior de este script; ml-dtypes viene con ellos.
titulo "Limpiando paquetes que fuerzan NumPy 2"
for PAQUETE in jax jaxlib ml-dtypes; do
    if python3 -m pip show "${PAQUETE}" >/dev/null 2>&1; then
        paso "Desinstalando ${PAQUETE} (exige numpy>=2 y no hace falta aqui)"
        python3 -m pip uninstall -y "${PAQUETE}" >/dev/null
    fi
done
ok "Sin paquetes que fuercen NumPy 2"

titulo "MediaPipe"
paso "Actualizando pip"
python3 -m pip install --upgrade pip

paso "Fijando NumPy 1.x"
python3 -m pip install -c "${RESTRICCIONES}" "numpy<2"

# VERSIÓN FIJA, y no es capricho: MediaPipe ELIMINÓ el módulo 'solutions' a
# partir de la 0.10.26. teleop_vision.py usa mp.solutions.pose y
# mp.solutions.hands, así que con cualquier versión más nueva falla con:
#     AttributeError: module 'mediapipe' has no attribute 'solutions'
# Probado versión por versión: 0.10.21 lo tiene, 0.10.26 ya no.
# 0.10.21 es la última que sirve para este proyecto.
MEDIAPIPE_VERSION="${MEDIAPIPE_VERSION:-0.10.21}"

# --no-deps: evita que MediaPipe arrastre opencv-contrib-python y vuelva a
# meter el Qt conflictivo, y evita que instale jax/jaxlib, que exigen numpy>=2.
paso "Instalando MediaPipe ${MEDIAPIPE_VERSION} sin sus dependencias"
python3 -m pip install -c "${RESTRICCIONES}" --no-deps "mediapipe==${MEDIAPIPE_VERSION}"

# Dependencias REALES de MediaPipe 0.10.21, sacadas de sus propios metadatos y
# comprobadas una por una en un entorno limpio. Se omiten:
#   - opencv-contrib-python : ya está el de APT (conflicto de Qt)
#   - numpy                 : ya fijado arriba
#   - jax, jaxlib           : NO hacen falta para 'solutions' y fuerzan numpy>=2
# 'certifi' no es obvio pero SÍ hace falta: sin él, 'import mediapipe' falla en
# mediapipe/tasks/python/core/base_options.py.
# 'protobuf<5' tampoco es opcional: con protobuf 5 o superior aparece
#     AttributeError: 'MessageFactory' object has no attribute 'GetPrototype'
paso "Instalando las dependencias reales de MediaPipe"
python3 -m pip install -c "${RESTRICCIONES}" \
    absl-py \
    "attrs>=19.1.0" \
    certifi \
    "flatbuffers>=2.0" \
    matplotlib \
    "protobuf<5,>=4.25.3" \
    sentencepiece \
    "sounddevice>=0.4.4"

# --- 3. Permisos de cámara -------------------------------------------------
titulo "Permisos de cámara"
if groups "$USER" | grep -qw video; then
    ok "El usuario '$USER' ya pertenece al grupo 'video'"
    CAMARA_NECESITA_REINICIO=0
else
    sudo usermod -a -G video "$USER"
    ok "Usuario '$USER' agregado al grupo 'video'"
    CAMARA_NECESITA_REINICIO=1
fi

# --- 4. Verificación -------------------------------------------------------
titulo "Verificación"

# Que nada haya vuelto a subir NumPy por detrás
NUMPY_MAYOR="$(python3 -c "import numpy; print(numpy.__version__.split('.')[0])" 2>/dev/null || echo "?")"
if [ "${NUMPY_MAYOR}" = "2" ]; then
    aviso "Algo subió NumPy a 2.x. Se vuelve a fijar en 1.x."
    python3 -m pip install -c "${RESTRICCIONES}" "numpy<2" --force-reinstall
fi

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

# Que MediaPipe traiga el módulo 'solutions', que es el que usa teleop_vision.py
if python3 -c "import mediapipe as mp; mp.solutions.pose; mp.solutions.hands" 2>/dev/null; then
    ok "mediapipe.solutions disponible (pose y hands)"
else
    error "Esta versión de MediaPipe no trae 'mediapipe.solutions'."
    aviso "  MediaPipe eliminó ese módulo a partir de la 0.10.26, y"
    aviso "  teleop_vision.py lo necesita. Vuelve a la 0.10.21:"
    aviso "    python3 -m pip install --no-deps 'mediapipe==0.10.21' --force-reinstall"
fi

if ls /dev/video* >/dev/null 2>&1; then
    ok "Cámara(s) detectada(s): $(ls /dev/video* | tr '\n' ' ')"
else
    aviso "No se detectó ninguna cámara en /dev/video*"
    aviso "En VirtualBox: menú Dispositivos → Webcams → selecciona tu cámara."
    aviso "Ver docs/06-solucion-de-problemas.md"
fi

titulo "Fase 3 completada"
if [ "${CAMARA_NECESITA_REINICIO}" -eq 1 ]; then
    printf '\n%sTu usuario se acaba de agregar al grupo "video".%s\n' "${AMARILLO}" "${FIN}"
    printf 'Ese cambio NO se aplica hasta que cierres sesión y vuelvas a entrar.\n'
    printf 'Sin eso, la cámara no funcionará. Se te recuerda al final de la instalación.\n'
fi
printf '\nSiguiente: %sbash scripts/04_workspace.sh%s\n\n' "${NEGRITA}" "${FIN}"
