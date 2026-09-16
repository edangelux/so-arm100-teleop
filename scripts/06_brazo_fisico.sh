#!/usr/bin/env bash
#
# Fase 6 — Brazo físico (OPCIONAL)
#
# QUÉ ES ESTO
#   Las fases 1 a 5 dejan funcionando la SIMULACIÓN. Esta fase agrega lo que
#   hace falta para mover además el SO-ARM100 real por USB.
#
#   No se ejecuta desde install.sh. Se corre a mano, y solo si tienes el brazo.
#
# QUÉ HACE, EN ORDEN
#   1. Clona brukg/so_arm_100_hardware en un commit FIJO y le aplica el parche
#      que lo adapta a Humble. Sin ese parche no compila: el código del
#      repositorio original está escrito contra la API de ros2_control de Jazzy.
#   2. Aplica al clon de SO-100-arm el parche que introduce el espacio de
#      nombres /real y corrige los controladores de Jazzy en la configuración
#      de hardware.
#   3. Copia los archivos nuevos de MoveIt Servo, que el parche no puede llevar
#      porque git diff no incluye archivos sin seguimiento.
#   4. Copia el paquete trajectory_mirror y el launch conjunto.
#   5. Agrega tu usuario al grupo dialout (acceso al puerto serie).
#   6. Compila.
#
# LO QUE ESTA FASE **NO** HACE, Y TIENES QUE HACER TÚ
#   - Calibrar el brazo. El calibration.yaml que trae el repositorio original
#     es el de fábrica y NO corresponde a tu brazo. Ver docs/09.
#   - Revisar los límites de seguridad del nodo de teleoperación antes de
#     conectar. Ver docs/09, bloqueo 6. Sigue abierto.
#
# Es idempotente: puedes correrlo las veces que quieras.
#
set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_REPO="$(cd "${DIR_SCRIPTS}/.." && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root

WS="${ROS2_WS:-$HOME/ros2_ws}"
SRC="${WS}/src"
DIR_ROBOT="${SRC}/SO-100-arm"
DIR_HW="${SRC}/so_arm_100_hardware"
DIR_FIS="${DIR_REPO}/brazo-fisico"

# Commits contra los que se generaron los parches. NO los cambies a la ligera:
# si el repositorio original avanza, el parche deja de aplicar y hay que
# regenerarlo. Anclar aquí es lo que hace que esta fase siga funcionando dentro
# de un año.
COMMIT_HW="088e355e49443bb802e090152e3fb25114d2f2fb"
COMMIT_ARM="35a59dbc6e48b1308c14d4d239048570e935f810"

titulo "Fase 6 · Brazo físico"

[ -d "${DIR_ROBOT}" ] || morir "No se encontró ${DIR_ROBOT}
       Ejecuta primero las fases 1 a 5:  bash scripts/install.sh"
[ -d "${DIR_FIS}" ] || morir "No se encontró ${DIR_FIS}
       ¿Está completo el repositorio?  git pull"

# --- 1. Driver del brazo ---------------------------------------------------
titulo "1/6 · Interfaz de hardware (so_arm_100_hardware)"

if [ ! -d "${DIR_HW}" ]; then
    paso "Clonando brukg/so_arm_100_hardware"
    git clone https://github.com/brukg/so_arm_100_hardware.git "${DIR_HW}"
else
    ok "Ya estaba clonado"
fi

paso "Fijando el commit ${COMMIT_HW:0:7}"
git -C "${DIR_HW}" fetch --quiet origin || aviso "No se pudo hacer fetch; se usa lo que hay en local"
git -C "${DIR_HW}" checkout --quiet "${COMMIT_HW}"

PARCHE_HW="${DIR_FIS}/parches/01-so_arm_100_hardware-humble.patch"
if git -C "${DIR_HW}" apply --reverse --check "${PARCHE_HW}" 2>/dev/null; then
    ok "El parche de Humble ya estaba aplicado"
else
    paso "Aplicando el parche de Humble"
    git -C "${DIR_HW}" apply --check "${PARCHE_HW}" \
        || morir "El parche 01 no aplica limpiamente sobre ${COMMIT_HW:0:7}.
       Esto no debería ocurrir con el commit anclado. Reporta el problema
       adjuntando la salida de:  git -C ${DIR_HW} log --oneline -1"
    git -C "${DIR_HW}" apply "${PARCHE_HW}"
    ok "Parche aplicado: firma on_init de Humble + enlazado de yaml-cpp"
fi

# Los scripts pierden el bit de ejecución al pasar por Windows o por un zip.
chmod +x "${DIR_HW}"/scripts/*.py 2>/dev/null || true

# --- 2. Parche de SO-100-arm ----------------------------------------------
titulo "2/6 · Espacio de nombres /real y controladores de hardware"

paso "Fijando el commit ${COMMIT_ARM:0:7} de SO-100-arm"
git -C "${DIR_ROBOT}" fetch --quiet origin || aviso "No se pudo hacer fetch; se usa lo que hay en local"

if ! git -C "${DIR_ROBOT}" diff --quiet || ! git -C "${DIR_ROBOT}" diff --cached --quiet; then
    aviso "SO-100-arm tiene cambios locales (es normal: son los del overlay de la fase 5)."
    aviso "  El parche 02 se aplica solo sobre los archivos del lado físico, que el"
    aviso "  overlay de simulación no toca. Si falla, corre la fase 5 de nuevo después."
fi

PARCHE_ARM="${DIR_FIS}/parches/02-SO-100-arm-humble-y-namespace-real.patch"
if git -C "${DIR_ROBOT}" apply --reverse --check "${PARCHE_ARM}" 2>/dev/null; then
    ok "El parche del lado físico ya estaba aplicado"
else
    paso "Aplicando el parche del lado físico"
    if git -C "${DIR_ROBOT}" apply --check "${PARCHE_ARM}" 2>/dev/null; then
        git -C "${DIR_ROBOT}" apply "${PARCHE_ARM}"
        ok "Parche aplicado"
    else
        aviso "El parche 02 no aplica limpiamente (probablemente por el overlay de la fase 5)."
        paso "Reintentando con tolerancia a contexto (--3way)"
        git -C "${DIR_ROBOT}" apply --3way "${PARCHE_ARM}" \
            || morir "No se pudo aplicar el parche 02.
       Aplica a mano los cambios de hardware_controllers.yaml descritos en
       docs/09, sección 'Bloqueo 2', y vuelve a correr esta fase."
        ok "Parche aplicado con --3way (revisa que no hayan quedado marcas de conflicto)"
    fi
fi

# --- 3. Archivos nuevos de MoveIt Servo -----------------------------------
titulo "3/6 · Archivos de MoveIt Servo"
cp -v "${DIR_FIS}/extras/so_arm_100_moveit_config/config/servo_params.yaml" \
      "${DIR_ROBOT}/so_arm_100_moveit_config/config/"
cp -v "${DIR_FIS}/extras/so_arm_100_moveit_config/launch/servo.launch.py" \
      "${DIR_ROBOT}/so_arm_100_moveit_config/launch/"
ok "servo_params.yaml y servo.launch.py copiados"

# --- 4. Paquete espejo y launch conjunto ----------------------------------
titulo "4/6 · Paquete trajectory_mirror"
rm -rf "${SRC}/trajectory_mirror"
cp -r "${DIR_FIS}/trajectory_mirror" "${SRC}/trajectory_mirror"
ok "trajectory_mirror copiado a ${SRC}/trajectory_mirror"

cp -v "${DIR_FIS}/launch/gz_moveit_real.launch.py" \
      "${DIR_ROBOT}/so_arm_100_bringup/launch/"
ok "gz_moveit_real.launch.py copiado"

# --- 5. Permisos del puerto serie -----------------------------------------
titulo "5/6 · Permisos del puerto serie"
if id -nG "$USER" | grep -qw dialout; then
    ok "Tu usuario ya está en el grupo dialout"
else
    paso "Agregando ${USER} al grupo dialout"
    sudo usermod -a -G dialout "$USER"
    aviso "Tienes que CERRAR SESIÓN Y VOLVER A ENTRAR para que surta efecto."
    aviso "  Sin eso obtendrás 'Permission denied' al abrir /dev/ttyUSB0."
fi

# --- 6. Compilar -----------------------------------------------------------
titulo "6/6 · Compilando"
set +u
# shellcheck source=/dev/null
source /opt/ros/humble/setup.bash
set -u

cd "${WS}"
colcon build --symlink-install \
    --packages-select so_arm_100_hardware trajectory_mirror \
                      so_arm_100_moveit_config so_arm_100_bringup

titulo "Fase 6 completada"
cat <<FINAL

${NEGRITA}Antes de conectar el brazo, dos cosas obligatorias:${FIN}

  1. ${NEGRITA}Calibra TU brazo.${FIN} El calibration.yaml que viene del repositorio
     original es el de fábrica y no corresponde a tu montaje:

       ${NEGRITA}ros2 run so_arm_100_hardware calibrate_arm.py${FIN}

     Comprueba después que el archivo generado lleve la fecha de hoy.

  2. ${NEGRITA}Lee docs/09, bloqueo 6.${FIN} El nodo de teleoperación arranca
     asumiendo que el brazo está en todo-ceros. En Gazebo eso es inofensivo;
     en el brazo físico, no. Ese bloqueo sigue ABIERTO.

Cuando ambas estén hechas:

  ${NEGRITA}ros2 launch so_arm_100_bringup gz_moveit_real.launch.py serial_port:=/dev/ttyUSB0${FIN}

La guía completa del espejo está en docs/10-espejo-simulacion-y-robot-real.md

FINAL
