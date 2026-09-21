#!/usr/bin/env bash
# Pregunta qué cámara usar, la comprueba y recuerda la elección en ~/.soarm.conf.
#
# 1. Tipo de cámara: integrada o USB, virtual (OBS, cliente de DroidCam para
#    Linux, v4l2loopback) o un teléfono por Wi-Fi (DroidCam o IP Webcam).
# 2. Integrada, USB o virtual: lista las que ve el sistema y comprueba que la
#    elegida entregue una imagen.
# 3. Teléfono: pide su IP cada vez, porque cambia con la red y con el tiempo
#    (IP dinámica). Propone la última usada, y si se deja vacío la busca sola
#    en la red. Comprueba que responda con video y, si está ocupada o no
#    responde, explica por qué y deja reintentar.
#
# Imprime en la última línea la cámara elegida (número de /dev/video o URL).
# Sale con 1 si la persona cancela. Funciona en Ubuntu nativo, en máquina
# virtual y en WSL2, con ventanas si hay escritorio y zenity, o en la terminal.
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ui.bash
source "$AQUI/ui.bash"
CONF="${SOARM_CONF:-$HOME/.soarm.conf}"
SOARM_CAM_TIPO=""; SOARM_CAM_IP=""; SOARM_CAM_DEV=""
# shellcheck disable=SC1090
[[ -f "$CONF" ]] && source "$CONF"
ENTORNO="$(soarm_entorno)"
T="SO-ARM100 — cámara"

TIPO_LOCAL="Cámara integrada o USB conectada al equipo"
TIPO_VIRTUAL="Cámara virtual (OBS, cliente de DroidCam para Linux, v4l2loopback)"
TIPO_RED="Teléfono por Wi-Fi (DroidCam o IP Webcam)"

guardar() {  # guardar CLAVE VALOR en ~/.soarm.conf
    local k="$1" v="$2"
    touch "$CONF"
    if grep -q "^$k=" "$CONF"; then
        python3 - "$CONF" "$k" "$v" <<'PY'
import sys, re
ruta, k, v = sys.argv[1:4]
s = open(ruta, encoding='utf-8').read()
s = re.sub(rf'^{k}=.*$', f'{k}="{v}"', s, flags=re.M)
open(ruta, 'w', encoding='utf-8').write(s)
PY
    else
        printf '%s="%s"\n' "$k" "$v" >>"$CONF"
    fi
}

# ------------------------------------------------------------ cámaras locales
listar() {  # imprime «/dev/videoN|nombre|virtual|fisica», sólo nodos de captura
    local d nombre idx driver clase
    # SOARM_SYS_V4L y SOARM_DEV_DIR sólo se cambian en las pruebas automáticas.
    for d in "${SOARM_SYS_V4L:-/sys/class/video4linux}"/video*; do
        [[ -e "$d" ]] || continue
        idx="$(cat "$d/index" 2>/dev/null || echo 0)"
        [[ "$idx" == 0 ]] || continue          # los nodos 1, 2... son metadatos de la misma cámara
        nombre="$(cat "$d/name" 2>/dev/null || echo cámara)"
        driver="$(basename "$(readlink -f "$d/device/driver" 2>/dev/null)" 2>/dev/null)"
        clase=fisica
        if [[ "$driver" == *loopback* || "$nombre" =~ [Dd]ummy|[Ll]oopback|OBS|[Dd]roid[Cc]am|[Vv]irtual ]]; then
            clase=virtual
        fi
        echo "${SOARM_DEV_DIR:-/dev}/$(basename "$d")|$nombre|$clase"
    done
}

ayuda_sin_camara() {
    case "$ENTORNO" in
        wsl) echo "En WSL2 las cámaras del equipo, incluida la integrada de una laptop, no se ven hasta pasarlas desde Windows con usbipd (usbipd attach --wsl --busid ...). Un teléfono por Wi-Fi no necesita ese paso.";;
        vm)  echo "En una máquina virtual la cámara debe conectarse a la máquina: en VirtualBox, menú Dispositivos → Cámaras web o Dispositivos → USB; en VMware, VM → Dispositivos extraíbles.";;
        *)   echo "Revise que la cámara esté conectada y que ninguna otra aplicación la esté usando.";;
    esac
}

probar_local() {  # 0 si entrega una imagen; si no, imprime el motivo
    local dev="$1" salida
    [[ -e "$dev" ]] || { echo "$dev no existe."; return 1; }
    [[ -r "$dev" && -w "$dev" ]] || { echo "Sin permiso sobre $dev: su usuario debe estar en el grupo video (sudo usermod -aG video \$USER y volver a iniciar sesión)."; return 1; }
    command -v v4l2-ctl >/dev/null 2>&1 || return 0
    salida="$(timeout 8 v4l2-ctl -d "$dev" --stream-mmap --stream-count=1 --stream-to=/dev/null 2>&1)"
    case $? in
        0) return 0;;
        124) echo "$dev no entregó ninguna imagen en 8 s.";;
        *) if grep -qi busy <<<"$salida"; then echo "$dev está ocupada por otra aplicación (videollamada, navegador, OBS). Ciérrela y reintente."
           else echo "$dev no entregó imagen: $(tail -1 <<<"$salida")"; fi;;
    esac
    return 1
}

elegir_local() {  # $1 = fisica | virtual
    local clase="$1" lista=() l dev
    while true; do
        lista=()
        while IFS= read -r l; do [[ "$l" == *"|$clase" ]] && lista+=("$l"); done < <(listar)
        if [[ ${#lista[@]} -eq 0 ]]; then
            local r
            r="$(ui_menu "$T" "No se encontró ninguna cámara $( [[ $clase == virtual ]] && echo virtual || echo 'integrada ni USB').

$(ayuda_sin_camara)" "Buscar de nuevo" "Elegir otro tipo de cámara")" || return 1
            [[ "$r" == "Buscar de nuevo" ]] && continue
            return 2
        fi
        if [[ ${#lista[@]} -eq 1 ]]; then
            dev="${lista[0]%%|*}"
        else
            local ops=() sel
            for l in "${lista[@]}"; do IFS='|' read -r d n _ <<<"$l"; ops+=("$d — $n"); done
            sel="$(ui_menu "$T" "Se encontraron varias cámaras. ¿Cuál se usa?" "${ops[@]}")" || return 1
            dev="${sel%% — *}"
        fi
        local motivo
        if motivo="$(ui_esperando "Probando $dev..." probar_local "$dev")"; then
            guardar SOARM_CAM_DEV "$dev"
            echo "${dev##*/video}"
            return 0
        fi
        local r
        r="$(ui_menu "$T" "La cámara $dev no funcionó.

$motivo" "Reintentar" "Elegir otro tipo de cámara")" || return 1
        [[ "$r" == Reintentar ]] || return 2
    done
}

# ------------------------------------------------------------ teléfono por red
a_url() {  # IP, IP:puerto o URL → URL de video
    local e="$1"
    e="${e// /}"
    if [[ "$e" =~ ^(https?|rtsp):// ]]; then echo "$e"; return; fi
    if [[ "$e" =~ ^[0-9.]+:[0-9]+$ ]]; then echo "http://$e/video"; return; fi
    echo "http://$e:4747/video"
}

probar_red() {  # imprime libre | ocupado | sin_respuesta | otro
    local salida codigo tipo
    salida="$(curl -s --noproxy '*' --max-time "${2:-3}" -o /dev/null -w '%{http_code} %{content_type}' "$1" 2>/dev/null)"
    codigo="${salida%% *}"; tipo="${salida#* }"; tipo="${tipo,,}"
    if [[ "$tipo" == multipart/* || "$tipo" == image/* || "$tipo" == video/* ]]; then echo libre
    elif [[ "$codigo" == 000 || -z "$codigo" ]]; then echo sin_respuesta
    elif [[ "$tipo" == text/html* ]]; then echo ocupado
    else echo otro
    fi
}

subredes() {  # prefijos a.b.c de las redes locales (y de Windows en WSL2)
    if [[ -n "${SOARM_SUBREDES:-}" ]]; then tr ' ' '\n' <<<"$SOARM_SUBREDES"; return; fi
    {
        ip -4 -o addr show scope global 2>/dev/null | grep -oE 'inet [0-9.]+' | awk '{print $2}'
        if [[ "$ENTORNO" == wsl ]] && command -v ipconfig.exe >/dev/null 2>&1; then
            ipconfig.exe 2>/dev/null | tr -d '\r' | grep -iE 'IPv4' | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
        fi
    } | grep -vE '^(127\.|172\.(1[6-9]|2[0-9]|3[01])\.)' | awk -F. 'NF>=3{print $1"."$2"."$3}' | awk '!v[$0]++' | head -3
    # En WSL2 la red propia (172.16-31) es interna; el teléfono está en la de Windows.
}

buscar() {  # imprime «IP|puerto|estado» de cada cámara encontrada
    local pref
    for pref in $(subredes); do
        for h in $(seq 1 254); do echo "$pref.$h 4747"; echo "$pref.$h 8080"; done
    done | xargs -P 96 -n 2 sh -c '
        s=$(curl -s --noproxy "*" --max-time 0.8 -o /dev/null -w "%{http_code} %{content_type}" "http://$0:$1/video" 2>/dev/null)
        case "$s" in
            *multipart/*|*image/*) echo "$0|$1|libre";;
            200*text/html*) echo "$0|$1|ocupado";;
        esac' 2>/dev/null | sort -u
}

elegir_red() {
    local entrada url estado texto r
    while true; do
        texto="Escriba la IP que muestra la aplicación del teléfono (en DroidCam: «WiFi IP»).
La IP puede cambiar de un día a otro o al cambiar de red, por eso se pregunta cada vez.

Deje el campo vacío para buscar el teléfono automáticamente en la red."
        entrada="$(ui_entrada "$T" "$texto" "$SOARM_CAM_IP")" || return 1
        if [[ -z "$entrada" ]]; then
            local hallados=() ops=() l
            while IFS= read -r l; do [[ -n "$l" ]] && hallados+=("$l"); done < <(ui_esperando "Buscando el teléfono en la red (unos segundos)..." buscar)
            if [[ ${#hallados[@]} -eq 0 ]]; then
                r="$(ui_menu "$T" "No se encontró ningún teléfono con DroidCam o IP Webcam en $(subredes | sed 's/$/.x/' | paste -sd, -).

Compruebe que la aplicación esté abierta y que el teléfono esté en la misma red Wi-Fi que este equipo." "Escribir la IP" "Buscar de nuevo" "Elegir otro tipo de cámara")" || return 1
                [[ "$r" == "Elegir otro tipo de cámara" ]] && return 2
                [[ "$r" == "Buscar de nuevo" ]] && SOARM_CAM_IP="" 
                continue
            fi
            for l in "${hallados[@]}"; do
                IFS='|' read -r ip pto est <<<"$l"
                ops+=("$ip:$pto  ($([[ $pto == 4747 ]] && echo DroidCam || echo 'IP Webcam'), $([[ $est == libre ]] && echo libre || echo 'ocupado por otro cliente'))")
            done
            r="$(ui_menu "$T" "Teléfonos encontrados:" "${ops[@]}")" || return 1
            entrada="${r%%  (*}"
        fi
        url="$(a_url "$entrada")"
        local host; host="$(sed -E 's#^[a-z]+://##; s#/.*##; s#:4747$##' <<<"$entrada")"
        estado="$(ui_esperando "Probando $url..." probar_red "$url")"
        case "$estado" in
            libre)
                guardar SOARM_CAM_IP "$host"
                echo "$url"; return 0;;
            ocupado)
                texto="El teléfono responde, pero ya está enviando el video a otro programa: el cliente de DroidCam de Windows, una pestaña del navegador u otra sesión. DroidCam atiende a un solo cliente a la vez.

Cierre ese programa, espere unos segundos y reintente.";;
            sin_respuesta)
                texto="No hubo respuesta en $url.

• ¿La aplicación está abierta en el teléfono y la pantalla encendida?
• ¿El teléfono está en la misma red Wi-Fi que este equipo?
• ¿La IP es la que muestra ahora la aplicación? Cambia con la red.";;
            *)
                texto="$url respondió, pero no con video. Revise la dirección.";;
        esac
        SOARM_CAM_IP="$host"
        r="$(ui_menu "$T" "$texto" "Reintentar" "Cambiar la IP o buscar" "Elegir otro tipo de cámara")" || return 1
        case "$r" in
            Reintentar)
                estado="$(ui_esperando "Probando $url..." probar_red "$url")"
                if [[ "$estado" == libre ]]; then guardar SOARM_CAM_IP "$SOARM_CAM_IP"; echo "$url"; return 0; fi;;
            "Elegir otro tipo de cámara") return 2;;
        esac
    done
}

# ------------------------------------------------------------ principal
principal() {
    local tipos=("$TIPO_LOCAL" "$TIPO_VIRTUAL" "$TIPO_RED") t ordenados=() r
    # La última elección aparece primero y preseleccionada.
    for t in "${tipos[@]}"; do [[ "$t" == "$SOARM_CAM_TIPO" ]] && ordenados+=("$t"); done
    for t in "${tipos[@]}"; do [[ "$t" == "$SOARM_CAM_TIPO" ]] || ordenados+=("$t"); done
    while true; do
        t="$(ui_menu "$T" "¿Qué cámara se va a usar para la teleoperación?" "${ordenados[@]}")" || return 1
        guardar SOARM_CAM_TIPO "$t"
        case "$t" in
            "$TIPO_LOCAL") r="$(elegir_local fisica)";;
            "$TIPO_VIRTUAL") r="$(elegir_local virtual)";;
            "$TIPO_RED") r="$(elegir_red)";;
        esac
        case $? in
            0) guardar SOARM_CAM "$r"; echo "$r"; return 0;;
            2) continue;;
            *) return 1;;
        esac
    done
}

principal
