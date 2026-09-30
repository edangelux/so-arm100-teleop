#!/usr/bin/env python3
"""Figura del mapa del repositorio a partir del grafo de graphify.

Agrupa los nodos del grafo (funciones, clases, archivos, documentos) por zona del
repositorio, cuenta las aristas que cruzan de una zona a otra y dibuja un SVG:

  - círculo: una zona; su área es proporcional a la cantidad de nodos;
  - línea continua: dependencias que el análisis de código encontró (importa, llama,
    usa…), con su número de aristas;
  - línea discontinua lima: conexiones en ejecución que el código no muestra como
    llamadas (HTTP, procesos lanzados, tópicos de ROS 2).

Uso (desde la raíz del repositorio, después de /graphify):
    python docs/mapa/figura_mapa.py graphify-out/graph.json docs/img/mapa_repositorio.svg
"""
import collections
import json
import math
import sys
from pathlib import Path

ZONAS = {  # clave: (título, subtítulo, x, y, color)
    'web':        ('Página web', 'app/web/js', 300, 170, '#7553ff'),
    'lecciones':  ('Lecciones y taller', 'app/web/js/lecciones', 600, 150, '#7553ff'),
    'programar':  ('Programar (RAPID)', 'app/web/js/programa', 900, 250, '#7553ff'),
    'servidor':   ('Servidor Estudio', 'app/servidor.py · app/estudio', 250, 390, '#fd44b0'),
    'calidad':    ('Pruebas y calidad', 'pruebas · e2e · .github', 960, 470, '#c2ef4e'),
    'scripts':    ('Lanzador y scripts', 'scripts (soarm.sh)', 560, 690, '#fd44b0'),
    'vision':     ('Teleoperación por visión', 'teleop_vision', 660, 470, '#fd44b0'),
    'externos':   ('Bibliotecas y tópicos', 'ROS 2, MediaPipe, OpenCV…', 880, 700, '#8f879a'),
    'ros':        ('Paquetes ROS 2', 'entrega · overlay', 330, 870, '#ffb287'),
    'brazo':      ('Brazo físico', 'brazo-fisico (driver, SDK)', 640, 900, '#ffb287'),
    'analisis':   ('Análisis cinemático', 'analisis · cad', 1000, 920, '#ffb287'),
    'docs':       ('Documentación', 'docs/*.md · README', 1270, 200, '#bdb8c0'),
    'capturas':   ('Capturas y figuras', 'docs/img', 1270, 440, '#bdb8c0'),
    'entregables': ('Entregables', 'docs/entregables', 1270, 680, '#bdb8c0'),
}
# Conexiones en ejecución (no son llamadas en el código): (a, b, etiqueta, lado de la curva)
EJECUCION = [
    ('web', 'servidor', 'HTTP y eventos (SSE)', 1),
    ('servidor', 'scripts', 'lanza soarm.sh', 1),
    ('servidor', 'ros', 'nodo puente: tópicos', 1),
    ('scripts', 'ros', 'ros2 launch', -1),
    ('scripts', 'vision', 'lanza la teleoperación', -1),
    ('vision', 'ros', 'trayectorias', 1),
    ('ros', 'brazo', 'bus serie', 1),
]
CONFIG = {'package.json', 'knip.json', 'playwright.config.js', 'eslint.config.js', 'stryker.config.mjs', 'pyproject.toml', '.jscpd.json'}


def zona(archivo):
    p = (archivo or '').replace('\\', '/')
    if not p:
        return 'externos'
    partes = p.split('/')
    if partes[0] == 'app':
        if p.startswith('app/web/js/lecciones'):
            return 'lecciones'
        if p.startswith('app/web/js/programa'):
            return 'programar'
        return 'web' if p.startswith('app/web') else 'servidor'
    if partes[0] in ('entrega', 'overlay'):
        return 'ros'
    if partes[0] in ('pruebas', 'e2e', '.github') or p in CONFIG:
        return 'calidad'
    if partes[0] == 'docs':
        sub = partes[1] if len(partes) > 2 else ''
        return {'img': 'capturas', 'entregables': 'entregables'}.get(sub, 'docs')
    if p in ('README.md', 'CLAUDE.md', 'requirements.txt'):
        return 'docs'
    return {'scripts': 'scripts', 'teleop_vision': 'vision', 'brazo-fisico': 'brazo', 'analisis': 'analisis', 'cad': 'analisis'}.get(partes[0], 'externos')


def radio(n):
    return 16 + 2.4 * math.sqrt(n)


def recortar(a, b, ra, rb):
    """Segmento entre los bordes de dos círculos."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    d = math.hypot(dx, dy) or 1
    return (a[0] + dx / d * ra, a[1] + dy / d * ra), (b[0] - dx / d * rb, b[1] - dy / d * rb)


def mezcla(color, fondo='#1f1633', a=0.28):
    c = [int(color[i:i + 2], 16) for i in (1, 3, 5)]
    f = [int(fondo[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(f[k] + (c[k] - f[k]) * a):02x}' for k in range(3))


def etiqueta(x, y, texto, color, tam=12.5):
    ancho = 7.2 * len(texto) * tam / 12.5 + 14
    return (f'<rect x="{x - ancho / 2:.0f}" y="{y - tam - 1:.0f}" width="{ancho:.0f}" height="{tam + 9:.0f}" rx="6" fill="#150f23" fill-opacity="0.92"/>'
            f'<text x="{x:.0f}" y="{y + 2:.0f}" font-size="{tam}" fill="{color}" text-anchor="middle">{esc(texto)}</text>')


def dentro_de_zona(x, y, nodos):
    """¿El punto cae sobre un círculo o sobre el rótulo de una zona?"""
    for k, z in ZONAS.items():
        r = radio(nodos.get(k, 0))
        if math.hypot(x - z[2], y - z[3]) < r + 12:
            return True
        if abs(x - z[2]) < 110 and z[3] + r < y < z[3] + r + 56:
            return True
    return False


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main(entrada, salida):
    g = json.loads(Path(entrada).read_text(encoding='utf-8'))
    de = {n['id']: zona(n.get('source_file')) for n in g['nodes']}
    nodos = collections.Counter(de.values())
    cruces = collections.Counter()
    for arista in g['links']:
        a, b = de.get(arista['source']), de.get(arista['target'])
        if a and b and a != b:
            cruces[tuple(sorted((a, b)))] += 1
    comunidades = len({n.get('community') for n in g['nodes']})

    W, H = 1480, 1100
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Rubik, Segoe UI, Helvetica, Arial, sans-serif">',
         '<defs><marker id="p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
         '<path d="M0,0 L10,5 L0,10 z" fill="#c2ef4e"/></marker></defs>',
         f'<rect width="{W}" height="{H}" rx="18" fill="#1f1633"/>',
         '<text x="40" y="52" font-size="28" font-weight="700" fill="#fff">Mapa del repositorio so-arm100-teleop</text>',
         f'<text x="40" y="80" font-size="15" fill="#bdb8c0">{len(g["nodes"])} nodos · {len(g["links"])} aristas · {comunidades} comunidades · '
         f'graphify sobre el commit {esc(str(g.get("built_at_commit", ""))[:7])}</text>']
    # Dependencias en el código
    etiquetas = []
    for (a, b), v in sorted(cruces.items(), key=lambda x: x[1]):
        if v < 3 or a not in ZONAS or b not in ZONAS:
            continue
        pa, pb = ZONAS[a][2:4], ZONAS[b][2:4]
        (x1, y1), (x2, y2) = recortar(pa, pb, radio(nodos[a]), radio(nodos[b]))
        ancho = 1 + 1.7 * math.log2(1 + v)
        s.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#6a5fc1" stroke-opacity="0.75" stroke-width="{ancho:.1f}" stroke-linecap="round"/>')
        if v >= 10:
            for t in (0.5, 0.38, 0.62, 0.28, 0.72):
                mx, my = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
                if not dentro_de_zona(mx, my, nodos):
                    etiquetas.append((mx, my, v))
                    break
    for mx, my, v in etiquetas:
        s.append(f'<rect x="{mx - 19:.0f}" y="{my - 11:.0f}" width="38" height="20" rx="10" fill="#150f23" stroke="#6a5fc1"/>'
                 f'<text x="{mx:.0f}" y="{my + 4:.0f}" font-size="12" fill="#fff" text-anchor="middle">{v}</text>')
    # Conexiones en ejecución
    rotulos = []
    for a, b, etq, lado in EJECUCION:
        pa, pb = ZONAS[a][2:4], ZONAS[b][2:4]
        (x1, y1), (x2, y2) = recortar(pa, pb, radio(nodos[a]) + 6, radio(nodos[b]) + 8)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        dx, dy = x2 - x1, y2 - y1
        d = math.hypot(dx, dy) or 1
        cx, cy = mx - lado * dy / d * 40, my + lado * dx / d * 40      # curva hacia un lado para no pisar la línea continua
        s.append(f'<path d="M{x1:.0f},{y1:.0f} Q{cx:.0f},{cy:.0f} {x2:.0f},{y2:.0f}" fill="none" stroke="#c2ef4e" stroke-width="2" stroke-dasharray="7 6" marker-end="url(#p)"/>')
        # El rótulo va en el punto de la curva que no cae sobre una zona ni su título.
        for t in (0.5, 0.4, 0.6, 0.3, 0.7):
            tx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2
            ty = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2
            if not dentro_de_zona(tx, ty, nodos):
                break
        rotulos.append(etiqueta(tx, ty, etq, '#c2ef4e'))
    # Zonas (relleno opaco: las líneas que pasan por detrás no se ven a través)
    for clave, (titulo, sub, x, y, color) in ZONAS.items():
        n = nodos.get(clave, 0)
        r = radio(n)
        s.append(f'<circle cx="{x}" cy="{y}" r="{r:.0f}" fill="{mezcla(color)}" stroke="{color}" stroke-width="3"/>')
        s.append(f'<text x="{x}" y="{y + 6}" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">{n}</text>')
        ancho = max(len(titulo) * 9.2, len(sub) * 7.6) + 18
        s.append(f'<rect x="{x - ancho / 2:.0f}" y="{y + r + 6:.0f}" width="{ancho:.0f}" height="42" rx="8" fill="#1f1633" fill-opacity="0.9"/>')
        s.append(f'<text x="{x}" y="{y + r + 24:.0f}" font-size="16" font-weight="600" fill="#fff" text-anchor="middle">{esc(titulo)}</text>')
        s.append(f'<text x="{x}" y="{y + r + 42:.0f}" font-size="12.5" fill="#bdb8c0" text-anchor="middle" font-family="IBM Plex Mono, Consolas, monospace">{esc(sub)}</text>')
    s.extend(rotulos)
    # Leyenda
    ly = H - 36
    s.append(f'<line x1="40" y1="{ly}" x2="80" y2="{ly}" stroke="#6a5fc1" stroke-width="5"/><text x="90" y="{ly + 5}" font-size="13" fill="#bdb8c0">dependencias en el código (número de aristas del grafo)</text>')
    s.append(f'<line x1="470" y1="{ly}" x2="510" y2="{ly}" stroke="#c2ef4e" stroke-width="2" stroke-dasharray="7 6"/><text x="520" y="{ly + 5}" font-size="13" fill="#bdb8c0">conexión en ejecución: HTTP, procesos o tópicos de ROS 2</text>')
    s.append(f'<text x="920" y="{ly + 5}" font-size="13" fill="#bdb8c0">número en el círculo: nodos de la zona</text>')
    s.append('</svg>')
    Path(salida).write_text('\n'.join(s) + '\n', encoding='utf-8')
    print(f'{salida}: {sum(nodos.values())} nodos en {len(nodos)} zonas')


if __name__ == '__main__':
    main(*(sys.argv[1:3] if len(sys.argv) >= 3 else ('graphify-out/graph.json', 'docs/img/mapa_repositorio.svg')))
