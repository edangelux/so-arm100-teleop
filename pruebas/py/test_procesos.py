"""Estados de la sesión que la aplicación deduce de la salida de soarm.sh."""
from estudio.procesos import Sesion


def leer(lineas):
    s = Sesion()
    for linea in lineas:
        s._linea(linea)
    return s.estado


def test_ciclo_normal():
    assert leer(['Teleoperación v15 iniciada. Registros: /tmp/x']) == 'teleop'
    assert leer(['Teleoperación cerrada. Llevando el brazo a init a 0.5 rad/s...']) == 'moviendo'
    assert leer(['[Enter] reabrir la teleoperación   [h] llevar a home y apagar   [x] apagar sin mover']) == 'menu'


def test_si_home_falla_vuelve_al_menu():
    s = Sesion()
    s._linea('[Enter] reabrir la teleoperación   [h] llevar a home y apagar   [x] apagar sin mover')
    s._estado('cerrando')          # lo que hace la aplicación al pulsar «Llevar a home y apagar»
    s._linea('No se alcanzó home: error máximo 0.623 rad (Wrist_Roll).')
    s._linea('No se pudo llevar el brazo a home. Sosténgalo y elija [x] para apagar, o reintente [h].')
    assert s.estado == 'menu'


def test_registros():
    s = Sesion()
    s._linea('Teleoperación v15 iniciada. Registros: /home/r/.local/state/soarm/sesion-1')
    assert s.registros == '/home/r/.local/state/soarm/sesion-1'
