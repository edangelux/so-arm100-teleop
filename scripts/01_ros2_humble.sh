#!/usr/bin/env bash
#
# Fase 1 — ROS 2 Humble Hawksbill
#
# Instala: locales UTF-8, repositorio APT de ROS 2, ros-humble-desktop,
#          herramientas de compilación y rosdep.
#
# Es idempotente: puedes volver a ejecutarlo sin romper nada.

set -Eeuo pipefail
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "${DIR_SCRIPTS}/comun.sh"

comprobar_no_root
comprobar_ubuntu_2204

titulo "Fase 1 · ROS 2 Humble"

# --- 1. Localización UTF-8 -------------------------------------------------
paso "Configurando localización UTF-8"
sudo apt-get update
apt_instalar locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8
ok "Locale UTF-8 configurado"

# --- 2. Herramientas base --------------------------------------------------
paso "Instalando herramientas base"
apt_instalar software-properties-common curl gnupg lsb-release git python3-pip ca-certificates

comprobar_internet

paso "Habilitando el repositorio 'universe'"
sudo add-apt-repository -y universe

# --- 3. Repositorio APT de ROS 2 -------------------------------------------
# Método actual (2025+): un paquete .deb instala el repositorio y la llave GPG,
# y se encarga de rotarla. El método antiguo (curl de ros.key) todavía funciona
# pero deja de servir cada vez que la llave expira.
titulo "Repositorio APT de ROS 2"

if [ -f /etc/apt/sources.list.d/ros2.list ] && [ -f /usr/share/keyrings/ros-archive-keyring.gpg ]; then
    aviso "Se detectó una configuración antigua del repositorio de ROS (ros2.list + ros.key)."
    aviso "Se reemplazará por el paquete ros2-apt-source, que mantiene la llave al día."
    sudo rm -f /etc/apt/sources.list.d/ros2.list /usr/share/keyrings/ros-archive-keyring.gpg
fi

paso "Consultando la última versión de ros2-apt-source"
ROS_APT_SOURCE_VERSION="$(curl -fsSL https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest \
    | grep -F '"tag_name"' | head -n1 | awk -F'"' '{print $4}')"

if [ -z "${ROS_APT_SOURCE_VERSION}" ]; then
    aviso "No se pudo consultar la API de GitHub. Usando el método clásico como respaldo."
    sudo curl -fsSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
        -o /usr/share/keyrings/ros-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo "$UBUNTU_CODENAME") main" \
        | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
    ok "Repositorio agregado (método clásico)"
else
    paso "Descargando ros2-apt-source ${ROS_APT_SOURCE_VERSION}"
    CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
    DEB_URL="https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.${CODENAME}_all.deb"
    curl -fsSL -o /tmp/ros2-apt-source.deb "${DEB_URL}"
    sudo apt-get install -y /tmp/ros2-apt-source.deb
    rm -f /tmp/ros2-apt-source.deb
    ok "Repositorio de ROS 2 configurado con ros2-apt-source ${ROS_APT_SOURCE_VERSION}"
fi

# --- 4. ROS 2 Humble Desktop ----------------------------------------------
titulo "ROS 2 Humble Desktop"
aviso "Esta es la descarga grande (~2 GB). Puede tardar de 10 a 30 minutos."

sudo apt-get update
apt_instalar \
    ros-humble-desktop \
    ros-dev-tools \
    python3-colcon-common-extensions \
    python3-rosdep \
    python3-vcstool

# --- 5. rosdep -------------------------------------------------------------
titulo "Inicializando rosdep"
if [ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]; then
    sudo rosdep init
    ok "rosdep inicializado"
else
    paso "rosdep ya estaba inicializado"
fi
rosdep update
ok "Base de datos de rosdep actualizada"

# --- 6. Entorno ------------------------------------------------------------
titulo "Configurando el entorno"
anadir_a_bashrc "source /opt/ros/humble/setup.bash"

# shellcheck source=/dev/null
source /opt/ros/humble/setup.bash

titulo "Fase 1 completada"
ok "ROS_DISTRO = ${ROS_DISTRO:-(no definido)}"
printf '\nSiguiente: %sbash scripts/02_simulacion.sh%s\n\n' "${NEGRITA}" "${FIN}"
