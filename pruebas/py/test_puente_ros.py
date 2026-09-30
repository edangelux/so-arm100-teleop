"""Puente con ROS: proceso aparte, órdenes, comprobaciones de seguridad y reconexión."""
import time
from pathlib import Path

import pytest

from estudio import puente_ros as pr

NODO = Path(__file__).with_name('nodo_falso.py')


@pytest.fixture
def puente(monkeypatch, tmp_path):
    monkeypatch.setenv('XDG_STATE_HOME', str(tmp_path))
    monkeypatch.setattr(pr, 'NODO', NODO)
    monkeypatch.setattr(pr, 'CARGA_ROS', 'exec python3 -u "$0"')
    monkeypatch.setattr(pr, 'REGISTRO', tmp_path / 'nodo_ros.log')
    p = pr.Puente()
    limite = time.time() + 10
    while not (p.disponible and p.estado()['sim']) and time.time() < limite:
        time.sleep(0.1)
    yield p
    p.cerrar()


def esperar_llegada(p, q, limite=5):
    t = time.time() + limite
    while time.time() < t:
        if p.q['sim'] and max(abs(a - b) for a, b in zip(p.q['sim'], q)) < 1e-6:
            return
        time.sleep(0.05)
    raise AssertionError('no llegó')


def test_arranca_y_recibe_articulaciones(puente):
    e = puente.estado()
    assert e['disponible'] and e['sim']


def test_mover_limita_y_devuelve_duracion(puente):
    assert puente.mover('sim', [0.5, 0, 0, 0, 0], 0.5) == 1.0


def test_trayectoria_rechaza_velocidad_excesiva(puente):
    with pytest.raises(RuntimeError, match='rad/s'):
        puente.trayectoria('sim', [{'q': [0.01, 0, 0, 0, 0], 't': 0.05}, {'q': [1.0, 0, 0, 0, 0], 't': 0.1}])


def test_trayectoria_rechaza_limites(puente):
    with pytest.raises(RuntimeError, match='límites'):
        puente.trayectoria('sim', [{'q': [3.0, 0, 0, 0, 0], 't': 5}])


def test_primer_punto_cercano_se_retrasa_en_vez_de_rechazar(puente):
    # El robot medido está en 0; el plan empieza 0,2 rad más allá a los 20 ms (robot atrasado).
    duracion = puente.trayectoria('sim', [{'q': [0.2, 0, 0, 0, 0], 't': 0.02}, {'q': [0.25, 0, 0, 0, 0], 't': 0.07}])
    assert duracion >= 0.2 + 0.05 - 1e-6


def test_primer_punto_lejano_y_rapido_se_rechaza(puente):
    with pytest.raises(RuntimeError, match='no está donde el programa cree'):
        puente.trayectoria('sim', [{'q': [1.0, 0, 0, 0, 0], 't': 0.05}])


def test_punto_lejano_con_tiempo_suficiente_vale(puente):
    assert puente.trayectoria('sim', [{'q': [1.0, 0, 0, 0, 0], 't': 2.0}]) == 2.0
    esperar_llegada(puente, [1.0, 0, 0, 0, 0])


def test_pinza_devuelve_el_error_del_nodo(puente):
    with pytest.raises(RuntimeError, match='pinza sin servidor'):
        puente.pinza('sim', 0.5)


def test_se_reinicia_si_el_nodo_muere(puente):
    puente._proc.kill()
    limite = time.time() + 10
    while time.time() < limite and not (puente.disponible and puente.estado()['sim']):
        time.sleep(0.1)
    assert puente.estado()['sim']


def test_reconecta_si_no_llegan_datos(monkeypatch, tmp_path):
    monkeypatch.setenv('NODO_MUDO', '1')
    monkeypatch.setenv('NODO_ARRANQUES', str(tmp_path / 'arranques'))
    monkeypatch.setenv('XDG_STATE_HOME', str(tmp_path))
    monkeypatch.setattr(pr, 'NODO', NODO)
    monkeypatch.setattr(pr, 'CARGA_ROS', 'exec python3 -u "$0"')
    monkeypatch.setattr(pr, 'REGISTRO', tmp_path / 'nodo_ros.log')
    p = pr.Puente()
    try:
        time.sleep(6)            # arrancó mudo hace más de 5 s
        assert not p.estado()['sim']
        assert p.mover('sim', [0.1, 0, 0, 0, 0], 0.5) == 1.0
        assert (tmp_path / 'arranques').read_text() == '2'
    finally:
        p.cerrar()


def test_desactivado_no_arranca_nada():
    p = pr.Puente.desactivado('prueba')
    assert not p.disponible and p.motivo == 'prueba'
    with pytest.raises(RuntimeError):
        p.mover('sim', [0, 0, 0, 0, 0])
