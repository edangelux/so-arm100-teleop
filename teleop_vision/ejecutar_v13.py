#!/usr/bin/env python3
"""Ejecuta teleop_v13.py, la versión presentada en la defensa, sin modificar su algoritmo.

El original se conserva byte a byte en entrega/teleoperacion/teleop_v13.py.
Este envoltorio sólo sustituye, antes de arrancar, las constantes de conexión
(tópico del brazo, acción de la pinza, cámara, resolución, velocidad máxima y
archivo de configuración) según el modo elegido en scripts/soarm.sh.
"""
from pathlib import Path
import importlib.util
from runtime_config import settings


def main():
    values = settings()
    original = Path(__file__).resolve().parents[1] / 'entrega/teleoperacion/teleop_v13.py'
    spec = importlib.util.spec_from_file_location('soarm_v13_original', original)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name, value in values.items():
        setattr(module, name, value)
    Path(values['CONFIG_FILE']).parent.mkdir(parents=True, exist_ok=True)
    print('SO-ARM100 v13 | configuración:', values)
    module.main()


if __name__ == '__main__':
    main()
