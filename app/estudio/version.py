"""Huella del código del servidor.

La página (app/web) se lee del disco en cada petición, pero el servidor carga su
código Python una sola vez al arrancar. Si el repositorio se actualiza con el
servidor encendido, la página nueva puede pedir rutas que el servidor viejo no
conoce. abrir.sh compara esta huella con la del servidor en marcha y lo reinicia
cuando no coinciden.
"""
import hashlib
from pathlib import Path

APP = Path(__file__).resolve().parent.parent


def huella():
    h = hashlib.sha1()
    for f in [APP / 'servidor.py', *sorted((APP / 'estudio').glob('*.py'))]:
        h.update(f.name.encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:12]


if __name__ == '__main__':
    print(huella())
