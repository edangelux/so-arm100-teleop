#!/usr/bin/env python3
"""Ejecuta teleop_v15.py con las conexiones del modo elegido en scripts/soarm.sh.

Hace lo mismo que ejecutar_v13.py: sustituye antes de arrancar las constantes
de conexión (tópico del brazo, acción de la pinza, cámara, resolución,
velocidad máxima, archivo de configuración y, en v14 y v15, el tópico de estados
articulares) y, si la cámara es una URL, entrega la cámara por red de
camara_red.py.
"""
from pathlib import Path
import importlib.util
from runtime_config import settings
from camara_red import Cv2ConCamaraRed, es_url


def main():
    values = settings()
    original = Path(__file__).resolve().with_name('teleop_v15.py')
    spec = importlib.util.spec_from_file_location('soarm_v15', original)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name, value in values.items():
        setattr(module, name, value)
    if es_url(values['CAMERA_INDEX']):
        module.cv2 = Cv2ConCamaraRed(values['CAMERA_INDEX'],
                                     values['CAMERA_WIDTH'], values['CAMERA_HEIGHT'])
        print('SO-ARM100 v15 | cámara por red:', values['CAMERA_INDEX'])
    Path(values['CONFIG_FILE']).parent.mkdir(parents=True, exist_ok=True)
    print('SO-ARM100 v15 | configuración:', values)
    module.main()


if __name__ == '__main__':
    main()
