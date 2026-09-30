"""Nodo de ROS falso para las pruebas del puente (app/estudio/puente_ros.py).

Habla el mismo protocolo que app/estudio/nodo_puente.py, sin ROS. Su postura
sigue la última trayectoria recibida. Con NODO_MUDO=1 no publica articulaciones
hasta el segundo arranque (simula un nodo que perdió el enlace de DDS).
"""
import json
import os
import sys
import threading
import time
from pathlib import Path

ARRANQUES = os.environ.get('NODO_ARRANQUES', '')
n = 0
if ARRANQUES:
    ruta = Path(ARRANQUES)
    n = int(ruta.read_text()) if ruta.exists() else 0
    ruta.write_text(str(n + 1))
mudo = os.environ.get('NODO_MUDO') == '1' and n == 0
q = [0.0] * 5
cerrojo = threading.Lock()


def decir(o):
    sys.stdout.write(json.dumps(o) + '\n')
    sys.stdout.flush()


def leer():
    global q
    for linea in sys.stdin:
        o = json.loads(linea)
        if o['op'] == 'trayectoria':
            with cerrojo:
                q = list(o['puntos'][-1]['q'])
        decir({'t': 'r', 'id': o['id'], 'ok': o['op'] == 'trayectoria', 'error': 'pinza sin servidor'})
    os._exit(0)


decir({'t': 'listo'})
threading.Thread(target=leer, daemon=True).start()
while True:
    with cerrojo:
        actual = None if mudo else q + [0.0]
    decir({'t': 'q', 'sim': actual, 'real': None, 'n': {'sim': 0 if mudo else 1, 'real': 0}, 'd': {'sim': 0, 'real': 0}})
    time.sleep(0.05)
