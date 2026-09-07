#!/usr/bin/env bash
# Funciones y comprobaciones compartidas por todos los scripts de instalación.
# No se ejecuta directamente: los demás scripts hacen `source` de este archivo.

set -Eeuo pipefail

# --- Colores (se desactivan solos si la salida no es una terminal) ---------
if [ -t 1 ]; then
    ROJO=$'\033[0;31m'; VERDE=$'\033[0;32m'; AMARILLO=$'\033[0;33m'
    AZUL=$'\033[0;34m'; NEGRITA=$'\033[1m'; FIN=$'\033[0m'
else
    ROJO=''; VERDE=''; AMARILLO=''; AZUL=''; NEGRITA=''; FIN=''
fi

titulo()  { printf '\n%s══ %s ══%s\n' "${AZUL}${NEGRITA}" "$*" "${FIN}"; }
paso()    { printf '%s▸%s %s\n' "${AZUL}" "${FIN}" "$*"; }
ok()      { printf '%s✓%s %s\n' "${VERDE}" "${FIN}" "$*"; }
aviso()   { printf '%s!%s %s\n' "${AMARILLO}" "${FIN}" "$*"; }
error()   { printf '%s✗%s %s\n' "${ROJO}" "${FIN}" "$*" >&2; }

morir() { error "$*"; exit 1; }

# Mensaje útil cuando algo revienta a mitad del script.
trap 'error "Falló el comando en la línea $LINENO. Revisa docs/06-solucion-de-problemas.md"' ERR

# --- Comprobaciones previas ------------------------------------------------

comprobar_no_root() {
    if [ "$(id -u)" -eq 0 ]; then
        morir "No ejecutes este script con sudo ni como root.
       Córrelo como tu usuario normal; el script pedirá sudo cuando lo necesite.
       Instalar ROS como root deja los archivos con permisos que luego rompen colcon."
    fi
}

comprobar_ubuntu_2204() {
    if ! command -v lsb_release >/dev/null 2>&1; then
        sudo apt-get update -qq && sudo apt-get install -y -qq lsb-release
    fi
    local version codename
    version="$(lsb_release -rs)"
    codename="$(lsb_release -cs)"
    if [ "$version" != "22.04" ]; then
        morir "Este proyecto requiere Ubuntu 22.04 LTS (jammy). Detectado: ${version} (${codename}).
       ROS 2 Humble no tiene paquetes binarios para esta versión.
       Ver docs/01-instalacion-maquina-virtual.md o docs/02-instalacion-nativa-iso.md"
    fi
    ok "Ubuntu 22.04 (${codename}) detectado"
}

# Comprueba que haya salida a internet.
#
# Dos cosas que esta función NO debe hacer, porque ya dieron falsos negativos:
#
#   1. Usar https://packages.ros.org — ese host sirve un certificado que no
#      coincide con su propio nombre, así que curl lo rechaza con
#      CERTIFICATE_VERIFY_FAILED aunque la red esté perfecta. El repositorio
#      de ROS se sirve por http, no por https.
#   2. Usar 'curl -f' — con --fail, curl devuelve error ante un 404, y varias
#      de estas raíces no tienen índice. Aquí nos interesa que el servidor
#      RESPONDA, no que responda 200.
#
# Además nunca aborta la instalación: si la comprobación falla pero la red sí
# funciona, apt seguiría adelante sin problema. Un aviso equivocado no debe
# detener una instalación buena; y si de verdad no hay red, apt fallará
# enseguida con un mensaje claro.
comprobar_internet() {
    local destinos=(
        "http://packages.ros.org/ros2/ubuntu/dists/jammy/InRelease"
        "http://archive.ubuntu.com/ubuntu/"
        "https://github.com"
    )
    local url
    for url in "${destinos[@]}"; do
        if curl -sS --max-time 8 -o /dev/null "${url}" >/dev/null 2>&1; then
            ok "Conexión a internet verificada"
            return 0
        fi
    done
    aviso "No se pudo verificar la conexión a internet con ninguno de los destinos de prueba."
    aviso "  Si 'sudo apt update' te funciona, ignora este aviso: la instalación continúa."
    aviso "  Si no, revisa la red de la máquina virtual (ver docs/06)."
    return 0
}

# Agrega una línea a ~/.bashrc solo si no está ya presente.
anadir_a_bashrc() {
    local linea="$1"
    if grep -qxF "$linea" "$HOME/.bashrc" 2>/dev/null; then
        paso "Ya estaba en ~/.bashrc: ${linea}"
    else
        printf '%s\n' "$linea" >> "$HOME/.bashrc"
        ok "Agregado a ~/.bashrc: ${linea}"
    fi
}

# Instala paquetes apt, saltando los que ya estén instalados.
apt_instalar() {
    local faltantes=()
    local pkg
    for pkg in "$@"; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            faltantes+=("$pkg")
        fi
    done
    if [ ${#faltantes[@]} -eq 0 ]; then
        ok "Todos los paquetes ya estaban instalados"
        return 0
    fi
    paso "Instalando ${#faltantes[@]} paquete(s): ${faltantes[*]}"
    sudo apt-get install -y "${faltantes[@]}"
}
