#!/usr/bin/env python3
"""Reúne en showreel/recursos/ todo lo que el video toma del repositorio.

- modelo.json: el robot (juntas, ejes, límites, mallas) leído del mismo URDF que
  usan Gazebo, MoveIt y SO-ARM100 Estudio (app/estudio/modelo.py).
- fotos/: fotografías y capturas de la defensa, sacadas de las presentaciones en
  docs/entregables/ con pdfimages (poppler-utils). Esas presentaciones no se suben
  al repositorio, así que este paso sólo funciona en una copia que las tenga.
- grafo.json: el grafo de conocimiento de graphify (graphify-out/graph.json) con
  una disposición fija calculada aquí, para poder recorrerlo cuadro por cuadro.

Uso, desde la raíz del repositorio:
  python showreel/herramientas/preparar_recursos.py [ruta/a/graph.json]
"""
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
REC = RAIZ / 'showreel' / 'recursos'
sys.path.insert(0, str(RAIZ / 'app'))
sys.path.insert(0, str(RAIZ / 'docs' / 'mapa'))

# Imagen de la presentación técnica → nombre en recursos/fotos. El número es el
# que asigna `pdfimages -list` (columna «num»).
FOTOS_TECNICA = {
    5: 'laboratorio.png',          # Laboratorio de la ULSA con su única estación
    11: 'brazo_mesa.png',          # El brazo armado junto al monitor
    82: 'brazo_mano.jpg',          # El brazo y la mano del operador
    49: 'piezas_impresas.jpg',     # Piezas impresas en 3D
    71: 'construccion.png',        # Secuencia de construcción
    88: 'teleop_gazebo.png',       # Teleoperación: operador con MediaPipe y Gazebo
    37: 'teleop_gazebo_2.png',
    23: 'puntos_mediapipe.png',    # Puntos anatómicos y ángulos medidos
    55: 'operador_estacion.png',   # Operando el brazo físico desde la laptop
    14: 'cad_render.png',          # Render CAD (SolidWorks)
    6: 'cad_render_2.png',
    52: 'espacio_trabajo.png',     # Espacio de trabajo calculado
    64: 'marcos_dh.png',           # Dimensiones y marcos D-H
    65: 'verificacion.png',        # Salida de la verificación cinemática
}


def modelo():
    from estudio.modelo import cargar_modelo
    (REC / 'modelo.json').write_text(json.dumps(cargar_modelo()), encoding='utf-8')
    print('modelo.json')


def fotos():
    pdf = RAIZ / 'docs' / 'entregables' / 'presentacion_tecnica.pdf'
    if not pdf.exists():
        print(f'No está {pdf}; se dejan las fotos que ya hubiera en recursos/fotos.')
        return
    destino = REC / 'fotos'
    destino.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdfimages', '-j', '-png', str(pdf), f'{tmp}/t'], check=True)
        for num, nombre in FOTOS_TECNICA.items():
            hallado = sorted(Path(tmp).glob(f't-{num:03d}.*'))
            if hallado:
                shutil.copy(hallado[0], destino / nombre)
    print(f'fotos: {len(list(destino.iterdir()))} archivos')


def grafo(ruta):
    import networkx as nx
    from figura_mapa import ZONAS, zona
    g = json.loads(Path(ruta).read_text(encoding='utf-8'))
    ids = {n['id']: i for i, n in enumerate(g['nodes'])}
    G = nx.Graph()
    G.add_nodes_from(range(len(ids)))
    aristas = []
    for e in g['links']:
        a, b = ids.get(e['source']), ids.get(e['target'])
        if a is not None and b is not None and a != b:
            G.add_edge(a, b)
            aristas.append([a, b])
    claves = list(ZONAS)
    zonas = [claves.index(zona(n.get('source_file'))) for n in g['nodes']]
    # Disposición: cada zona en su lugar de la figura 21.1 (docs/img/mapa_repositorio.svg),
    # como un disco de girasol (espiral de Vogel): los nodos más conectados al centro.
    pos = {}
    for z, clave in enumerate(claves):
        miembros = [i for i, zz in enumerate(zonas) if zz == z]
        if not miembros:
            continue
        _, _, x, y, _ = ZONAS[clave]
        cx, cy = (x - 760) / 560, -(y - 540) / 560
        miembros.sort(key=lambda i: -G.degree(i))
        for k, i in enumerate(miembros):
            r = 0.0105 * (k + 0.5) ** 0.5
            a = k * 2.39996323
            pos[i] = (cx + r * math.cos(a), cy + r * math.sin(a))
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    s = 2 / max(max(xs) - min(xs), max(ys) - min(ys))
    grado = dict(G.degree())
    nodos = [[round((pos[i][0] - cx) * s, 4), round((pos[i][1] - cy) * s, 4), zonas[i], grado[i]] for i in range(len(ids))]
    destacados = {}
    for n in g['nodes']:
        if n['label'] in ('SOARM100Interface', 'teleop_v13.py', 'OneEuro', 'puente_ros.py', 'nodo_puente.py',
                          'soarm.sh', 'Ejecutor', 'puntosParaRobot()', 'shoulder_elbow_angles()', 'el()'):
            destacados.setdefault(n['label'], ids[n['id']])
    salida = {
        'zonas': [{'clave': k, 'titulo': ZONAS[k][0], 'color': ZONAS[k][4]} for k in claves],
        'nodos': nodos, 'aristas': aristas, 'destacados': destacados,
        'commit': g.get('built_at_commit', '')[:7],
    }
    (REC / 'grafo.json').write_text(json.dumps(salida, separators=(',', ':')), encoding='utf-8')
    print(f'grafo.json: {len(nodos)} nodos, {len(aristas)} aristas')


if __name__ == '__main__':
    REC.mkdir(parents=True, exist_ok=True)
    modelo()
    fotos()
    grafo(sys.argv[1] if len(sys.argv) > 1 else RAIZ / 'graphify-out' / 'graph.json')
