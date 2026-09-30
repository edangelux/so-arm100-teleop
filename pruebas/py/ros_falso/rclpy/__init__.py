"""rclpy falso: el reloj del robot avanza RTF veces lo que avanza la pared."""
import os
import time

RTF = float(os.environ.get('RTF', '1'))
ATASCADO = os.environ.get('ATASCADO') == '1'
_activo = True


def init():
    pass


def ok():
    return _activo


def shutdown():
    global _activo
    _activo = False


def spin_once(nodo, timeout_sec=0.05):
    time.sleep(0.01)
    nodo.simular(0.01)
