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

Faltan 3 pasos. Están explicados clic por clic; si nunca has usado Linux,
síguelos tal cual y no te saltes el primero.


${AMARILLO}${NEGRITA}PASO 1 · REINICIA LA MÁQUINA VIRTUAL${FIN}

  Sí, reiniciar de verdad. No es por si acaso: durante la instalación tu
  usuario recibió permiso para usar la cámara, y en Linux ese permiso solo
  se activa al volver a iniciar sesión. Si te lo saltas, el programa de
  teleoperación no encontrará la cámara y no sabrás por qué.

  Cómo hacerlo:
    1. Mira la ${NEGRITA}esquina superior derecha${FIN} de la pantalla de Ubuntu
       (donde están los iconos de volumen, red y batería).
    2. Haz clic ahí. Se abre un menú.
    3. Elige ${NEGRITA}"Apagar / Cerrar sesión"${FIN} y luego ${NEGRITA}"Reiniciar"${FIN}.
    4. Espera a que vuelva a arrancar y escribe tu contraseña.

  Tarda menos de un minuto. Después de esto, la cámara ya funciona.


${AMARILLO}${NEGRITA}PASO 2 · ABRE UNA TERMINAL Y LANZA LA SIMULACIÓN${FIN}

  Presiona a la vez las teclas:   ${NEGRITA}Ctrl + Alt + T${FIN}
  Se abre una ventana negra: eso es la terminal.

  Copia estas dos líneas, pégalas ahí y presiona Enter:

    ${NEGRITA}cd ~/ros2_ws${FIN}
    ${NEGRITA}ros2 launch so_arm_100_bringup gz_moveit.launch.py${FIN}

  Para pegar en la terminal de Linux se usa ${NEGRITA}Ctrl + Shift + V${FIN}
  (con Shift, no el Ctrl+V de siempre).

  Se abrirán dos ventanas: ${NEGRITA}Gazebo${FIN} (el simulador con el robot) y
  ${NEGRITA}RViz${FIN} (la vista técnica). Espera a que carguen del todo — la primera
  vez tarda un minuto.

  ${NEGRITA}No cierres esta terminal.${FIN} Mientras la simulación corra, esa ventana
  se queda ocupada escribiendo mensajes. Es normal.


${AMARILLO}${NEGRITA}PASO 3 · ABRE OTRA TERMINAL Y LANZA LA TELEOPERACIÓN${FIN}

  Presiona otra vez ${NEGRITA}Ctrl + Alt + T${FIN}. Se abre una terminal NUEVA,
  aparte de la anterior. Necesitas las dos abiertas al mismo tiempo.

  Pega esto y presiona Enter:

    ${NEGRITA}python3 ${DIR_REPO}/teleop_vision/teleop_vision.py${FIN}

  Se abre una ventana con la imagen de tu cámara.

  Ponte de frente, con el brazo y ${NEGRITA}la mano bien visibles${FIN}, haz clic sobre
  esa ventana de video para seleccionarla, y presiona la tecla ${NEGRITA}C${FIN}.
  Eso le dice al robot "esta postura mía es tu punto de partida".

  A partir de ahí, muévete y el robot te copia.
  Para salir: presiona ${NEGRITA}Q${FIN} sobre la ventana de video.


${NEGRITA}¿ALGO NO FUNCIONÓ?${FIN}

  Este comando revisa la instalación y te dice qué falta:

    ${NEGRITA}bash ${DIR_SCRIPTS}/verificar.sh${FIN}

  Y aquí está cada error conocido con su causa y su solución:

    ${DIR_REPO}/docs/06-solucion-de-problemas.md

  Guía de uso completa (todas las teclas, cómo ajustar el robot):

    ${DIR_REPO}/docs/05-ejecucion.md

  Todo lo que pasó durante esta instalación quedó guardado en:

    ${SO_ARM_REGISTRO}

FINAL
