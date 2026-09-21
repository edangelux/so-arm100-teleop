#!/usr/bin/env python3
"""Ejecuta teleop_v13.py, la versión presentada en la defensa, sin modificar su algoritmo.

El original se conserva byte a byte en entrega/teleoperacion/teleop_v13.py.
Este envoltorio sólo sustituye, antes de arrancar, las constantes de conexión
(tópico del brazo, acción de la pinza, cámara, resolución, velocidad máxima y
archivo de configuración) según el modo elegido en scripts/soarm.sh. Si la
cámara es una URL, como la de DroidCam, le entrega además la cámara por red
de camara_red.py.
"""
from pathlib import Path
import importlib.util
from runtime_config import settings
from camara_red import Cv2ConCamaraRed, es_url


def main():
    values = settings()
    original = Path(__file__).resolve().parents[1] / 'entrega/teleoperacion/teleop_v13.py'
    spec = importlib.util.spec_from_file_location('soarm_v13_original', original)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name, value in values.items():
        setattr(module, name, value)
    if es_url(values['CAMERA_INDEX']):
        # Cámara por red: teleop_v13.py sigue llamando a cv2.VideoCapture igual,
        # pero recibe una cámara que lee la URL en lugar de /dev/videoN.
        module.cv2 = Cv2ConCamaraRed(values['CAMERA_INDEX'],
                                     values['CAMERA_WIDTH'], values['CAMERA_HEIGHT'])
        print('SO-ARM100 v13 | cámara por red:', values['CAMERA_INDEX'])
    Path(values['CONFIG_FILE']).parent.mkdir(parents=True, exist_ok=True)
    print('SO-ARM100 v13 | configuración:', values)
    module.main()


if __name__ == '__main__':
    main()
