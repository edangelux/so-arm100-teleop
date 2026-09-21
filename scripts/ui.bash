# Diálogos del SO-ARM100: ventanas (zenity) cuando hay escritorio y, si no,
# preguntas en la terminal. Lo usan scripts/atajos.bash y scripts/elegir_camara.sh.
#
#   ui_menu  "Título" "Texto" "Opción 1" "Opción 2" ...   → imprime la opción elegida
#   ui_entrada "Título" "Texto" "valor por omisión"       → imprime lo escrito
#   ui_aviso / ui_error "Título" "Texto"
#   ui_pregunta "Título" "Texto"                          → 0 sí, 1 no
#
# SOARM_UI=terminal obliga a usar la terminal aunque haya escritorio.
# Todas devuelven 1 si la persona cancela.

# Parte las líneas largas para que las ventanas no se estiren fuera de la pantalla.
ui_envolver() { printf '%s' "$1" | fold -s -w 88; }

ui_grafica() {
    [[ "${SOARM_UI:-auto}" != terminal ]] && command -v zenity >/dev/null 2>&1 &&
        [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]
}

ui_menu() {
    local titulo="$1" texto="$2"; shift 2
    if ui_grafica; then
        texto="$(ui_envolver "$texto")"
        local args=() primera=TRUE o
        for o in "$@"; do args+=("$primera" "$o"); primera=FALSE; done
        # El alto crece con el número de opciones y con las líneas del texto.
        local lineas; lineas="$(printf '%s\n' "$texto" | wc -l)"
        zenity --list --radiolist --title="$titulo" --text="$texto" --column="" --column="Opción" \
            --ok-label="Aceptar" --cancel-label="Cancelar" --hide-header \
            --width=620 --height=$((170 + 46 * $# + 22 * lineas)) "${args[@]}" 2>/dev/null
        return
    fi
    local i=1 o r
    printf '\n== %s ==\n%s\n' "$titulo" "$texto" >&2
    for o in "$@"; do printf '  %d) %s\n' "$i" "$o" >&2; i=$((i + 1)); done
    while true; do
        read -r -p "Elija un número [1]: " r >&2 || return 1
        r="${r:-1}"
        [[ "$r" == q ]] && return 1
        if [[ "$r" =~ ^[0-9]+$ && "$r" -ge 1 && "$r" -le $# ]]; then
            printf '%s\n' "${!r}"
            return 0
        fi
        echo "Escriba un número entre 1 y $# (q cancela)." >&2
    done
}

ui_entrada() {
    local titulo="$1" texto="$2" def="${3:-}" r
    if ui_grafica; then
        texto="$(ui_envolver "$texto")"
        zenity --entry --title="$titulo" --text="$texto" --entry-text="$def" --width=560 \
            --ok-label="Aceptar" --cancel-label="Cancelar" 2>/dev/null
        return
    fi
    printf '\n== %s ==\n%s\n' "$titulo" "$texto" >&2
    read -r -p "[$def]: " r >&2 || return 1
    printf '%s\n' "${r:-$def}"
}

ui_aviso() {
    if ui_grafica; then zenity --info --title="$1" --text="$(ui_envolver "$2")" --width=520 --ok-label="Aceptar" 2>/dev/null
    else printf '\n%s\n%s\n' "$1" "$2" >&2; fi
}

ui_error() {
    if ui_grafica; then zenity --error --title="$1" --text="$(ui_envolver "$2")" --width=560 --ok-label="Aceptar" 2>/dev/null
    else printf '\nERROR — %s\n%s\n' "$1" "$2" >&2; fi
}

ui_pregunta() {
    if ui_grafica; then zenity --question --title="$1" --text="$(ui_envolver "$2")" --width=520 --ok-label="Sí" --cancel-label="No" 2>/dev/null; return; fi
    local r
    printf '\n%s\n%s\n' "$1" "$2" >&2
    read -r -p "¿Sí o no? [s]: " r >&2 || return 1
    [[ -z "$r" || "${r,,}" == s* ]]
}

# Muestra una ventana de «trabajando» mientras corre una orden; imprime su salida.
ui_esperando() {
    local texto="$1"; shift
    if ui_grafica; then
        local tmp rc; tmp="$(mktemp)"
        ( "$@" >"$tmp" 2>/dev/null; echo $? >"$tmp.rc"; echo 100 ) |
            zenity --progress --pulsate --auto-close --no-cancel --title="SO-ARM100" --text="$texto" 2>/dev/null
        cat "$tmp"; rc="$(cat "$tmp.rc" 2>/dev/null || echo 1)"; rm -f "$tmp" "$tmp.rc"
        return "$rc"
    else
        echo "$texto" >&2
        "$@"
    fi
}

# Entorno de ejecución: wsl, vm o nativo.
soarm_entorno() {
    if [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qi 'microsoft.*wsl\|wsl2' /proc/version 2>/dev/null; then
        echo wsl
    elif command -v systemd-detect-virt >/dev/null 2>&1 && [[ "$(systemd-detect-virt 2>/dev/null)" != none ]] &&
         [[ "$(systemd-detect-virt 2>/dev/null)" != wsl ]]; then
        echo vm
    else
        echo nativo
    fi
}
