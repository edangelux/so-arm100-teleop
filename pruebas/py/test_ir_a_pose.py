"""scripts/ir_a_pose.py con un ROS falso: llega a home aunque Gazebo vaya lento."""
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FALSO = Path(__file__).with_name('ros_falso')


def correr(rtf, atascado=False):
    env = dict(os.environ, PYTHONPATH=str(FALSO), RTF=str(rtf), ATASCADO='1' if atascado else '0')
    return subprocess.run([sys.executable, str(RAIZ / 'scripts' / 'ir_a_pose.py'), 'home', '--topico', '/x', '--estados', '/y'],
                          env=env, capture_output=True, text=True, timeout=120)


def test_llega_con_el_reloj_real():
    r = correr(1.0)
    assert r.returncode == 0, r.stdout + r.stderr
    assert 'En home' in r.stdout


def test_llega_con_gazebo_al_30_por_ciento():
    # Con la espera medida en la pared, este caso quedaba a medio camino.
    r = correr(0.3)
    assert r.returncode == 0, r.stdout + r.stderr


def test_si_no_se_mueve_lo_dice_y_no_insiste_para_siempre():
    r = correr(1.0, atascado=True)
    assert r.returncode == 2
    assert 'no respondió' in r.stderr
