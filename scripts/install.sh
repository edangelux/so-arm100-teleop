#!/usr/bin/env bash
#
# Instalador maestro — Teleoperación por visión del SO-ARM100
#
# Uso:
#   bash scripts/install.sh              instala todo
#   bash scripts/install.sh --desde 3    reanuda desde la fase 3
#   bash scripts/install.sh --si         no pide confirmación (desatendido)
#
# Ejecuta en orden:
#   Fase 1  ROS 2 Humble
#   Fase 2  Gazebo, MoveIt 2, ros2_control
#   Fase 3  OpenCV, MediaPipe, permisos de cámara
#   Fase 4  Workspace, paquetes del robot, compilación
#   Fase 5  Overlay de configuración verificada (Humble + Gazebo/MoveIt)

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_REPO="$(cd "${DIR_SCRIPTS}/.." && pwd)"

# Se restaura el bit de ejecución por si se perdió al descargar el repositorio.
# Pasa, sobre todo, al subir los archivos por la web de GitHub o al clonar
# desde Windows: los scripts llegan sin permiso de ejecución y el primer
# intento falla con "Permission denied".
chmod +x "${DIR_SCRIPTS}"/*.sh "${DIR_REPO}"/teleop_vision/*.py 2>/dev/null || true

# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

DESDE=1
CONFIRMAR=1

while [ $# -gt 0 ]; do
    case "$1" in
        --desde|--from) DESDE="${2:-1}"; shift 2 ;;
        --si|--yes|-y)  CONFIRMAR=0; shift ;;
        -h|--help)
            sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) morir "Opción desconocida: $1  (usa --help)" ;;
    esac
done

comprobar_no_root

cat <<BANNER

${NEGRITA}╔══════════════════════════════════════════════════════════════╗
║   Teleoperación por Visión — Manipulador SO-ARM100          ║
║   ROS 2 Humble · Gazebo · MoveIt 2 · MediaPipe               ║
╚══════════════════════════════════════════════════════════════╝${FIN}

Se instalará:
  Fase 1 · ROS 2 Humble Desktop y herramientas de compilación
  Fase 2 · Gazebo (gz sim), MoveIt 2 y ros2_control
  Fase 3 · OpenCV, MediaPipe y permisos de cámara
  Fase 4 · Workspace ~/ros2_ws, paquetes del robot y compilación
  Fase 5 · Overlay de configuración verificada

Duración estimada: 20–40 minutos según tu conexión.
Se te pedirá la contraseña de sudo varias veces.

BANNER

comprobar_ubuntu_2204

if [ "${CONFIRMAR}" -eq 1 ]; then
    read -r -p "¿Continuar? [S/n] " respuesta
    case "${respuesta}" in
        [nN]*) echo "Cancelado."; exit 0 ;;
    esac
fi

# El registro arranca DESPUÉS de la pregunta: redirigir la salida antes haría
# que el prompt no se viera bien.
iniciar_registro
paso "Registro de esta instalación: ${SO_ARM_REGISTRO}"

INICIO=$(date +%s)

ejecutar_fase() {
    local num="$1" script="$2"
    if [ "${num}" -lt "${DESDE}" ]; then
        aviso "Saltando fase ${num} (--desde ${DESDE})"
        return 0
    fi
    bash "${DIR_SCRIPTS}/${script}"
}

ejecutar_fase 1 01_ros2_humble.sh
ejecutar_fase 2 02_simulacion.sh
ejecutar_fase 3 03_vision_python.sh
ejecutar_fase 4 04_workspace.sh
ejecutar_fase 5 05_aplicar_overlay.sh

FIN_T=$(date +%s)
MINUTOS=$(( (FIN_T - INICIO) / 60 ))

cat <<FINAL

${VERDE}${NEGRITA}╔══════════════════════════════════════════════════════════════╗
║                   INSTALACIÓN COMPLETADA                     ║
╚══════════════════════════════════════════════════════════════╝${FIN}

Tiempo total: ${MINUTOS} minutos.

${AMARILLO}IMPORTANTE:${FIN} cierra esta terminal y abre una nueva antes de continuar.
Si es la primera vez que se agrega tu usuario al grupo 'video', cierra
sesión y vuelve a entrar para que la cámara funcione sin sudo.

${NEGRITA}Terminal 1 — simulación (Gazebo + MoveIt + RViz):${FIN}
  cd ~/ros2_ws
  ros2 launch so_arm_100_bringup gz_moveit.launch.py

${NEGRITA}Terminal 2 — teleoperación:${FIN}
  python3 ${DIR_REPO}/teleop_vision/teleop_vision.py

Espera a que Gazebo cargue por completo antes de lanzar la teleoperación.
Con la ventana de video enfocada y TU MANO VISIBLE, presiona ${NEGRITA}C${FIN} para calibrar.

Diagnóstico:   ${DIR_SCRIPTS}/verificar.sh
Ejecución:     ${DIR_REPO}/docs/05-ejecucion.md
Problemas:     ${DIR_REPO}/docs/06-solucion-de-problemas.md

FINAL
