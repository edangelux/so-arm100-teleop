# -*- coding: utf-8 -*-
"""Contraste del modelo propio contra el Robotics Toolbox de Peter Corke (Python).

   Construye el SO-ARM100 de DOS maneras independientes dentro del toolbox:
     A) con la tabla de Denavit-Hartenberg obtenida en este trabajo (DHRobot)
     B) con la cadena de transformadas elementales del URDF        (ERobot/ETS)
   y compara cinematica directa y jacobiano contra la implementacion propia.

   Requiere:  pip install roboticstoolbox-python
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import sys
import numpy as np
try:
    import roboticstoolbox as rtb
    from spatialmath import SE3
except ImportError:
    print(__doc__)
    print('=' * 78)
    print(' El Robotics Toolbox de Peter Corke no esta instalado en este entorno.')
    print('=' * 78)
    print(' Este programa es OPCIONAL: solo sirve para contrastar el modelo contra una')
    print(' biblioteca ajena.  Todos los resultados del analisis se reproducen sin el,')
    print(' ejecutando  analisis_cinematico_soarm100.py  o  verificacion_total.py.')
    print()
    print(' Instalacion:')
    print('     pip install roboticstoolbox-python')
    print()
    print(' En Windows la instalacion falla con frecuencia al compilar la dependencia')
    print(' "spatialgeometry", que necesita un compilador de C++:')
    print('     CMake Error: CMAKE_CXX_COMPILER not set, after EnableLanguage')
    print(' Hay tres salidas, de menos a mas trabajo:')
    print('   1. Usar Python 3.11 o 3.12.  En versiones muy nuevas todavia no existen')
    print('      ruedas precompiladas y pip se ve obligado a compilar.')
    print('        py -3.11 -m venv .venv  &&  .venv\\Scripts\\activate')
    print('        pip install roboticstoolbox-python')
    print('   2. Instalar primero la dependencia ya compilada:')
    print('        pip install --only-binary :all: spatialgeometry')
    print('        pip install roboticstoolbox-python')
    print('   3. Instalar "Build Tools for Visual Studio" con la carga de trabajo')
    print('      "Desarrollo para escritorio con C++", y repetir la instalacion.')
    print()
    print(' El contraste tambien esta disponible en MATLAB, sin compilar nada:')
    print('     SOARM100_toolbox')
    sys.exit(0)

from cinematica import LIMS
from dh_soarm100 import FILAS, T_BASE, T_TOOL, fk_dh
from jacobiano import jacobiano as jac_geom

np.set_printoptions(precision=6, suppress=True)

# ---------------------------------------------------------------- A) modelo D-H
eslabones = [rtb.RevoluteDH(d=f['d'], a=f['a'], alpha=f['alpha'], offset=f['theta_off'],
                            qlim=LIMS[k]) for k, f in enumerate(FILAS)]
BRAZO = rtb.DHRobot(eslabones, name='SO-ARM100',
                    base=SE3(T_BASE, check=False), tool=SE3(T_TOOL, check=False))

def comparar(n=5000, semilla=7):
    rng = np.random.default_rng(semilla)
    ep, eo, ej = [], [], []
    for _ in range(n):
        q = rng.uniform(LIMS[:, 0], LIMS[:, 1])
        Tt = BRAZO.fkine(q).A                    # toolbox
        Tp = fk_dh(q, T_TOOL)                    # implementacion propia
        ep.append(np.abs(Tt[:3, 3] - Tp[:3, 3]).max())
        eo.append(np.abs(Tt[:3, :3] - Tp[:3, :3]).max())
        Jt = BRAZO.jacob0(q)                     # jacobiano en el marco base
        Jp = jac_geom(q)
        ej.append(np.abs(Jt - Jp).max())
    return np.array(ep), np.array(eo), np.array(ej)

# ------------------------------------------- B) modelo por transformadas elementales
# Construido directamente de los origenes y ejes del URDF, sin pasar por D-H.
# Es la formulacion ETS que usan implementaciones independientes del SO-100.
from cinematica import J as JU, CAD, T_from

def _ets_de_origen(xyz, rpy):
    E = rtb.ET.tx(xyz[0]) * rtb.ET.ty(xyz[1]) * rtb.ET.tz(xyz[2])
    if abs(rpy[2]) > 0: E = E * rtb.ET.Rz(rpy[2])
    if abs(rpy[1]) > 0: E = E * rtb.ET.Ry(rpy[1])
    if abs(rpy[0]) > 0: E = E * rtb.ET.Rx(rpy[0])
    return E

def construir_ets():
    E = _ets_de_origen(JU['base_link_joint']['xyz'], JU['base_link_joint']['rpy'])
    for n in CAD:
        E = E * _ets_de_origen(JU[n]['xyz'], JU[n]['rpy'])
        eje = JU[n]['axis'] / np.linalg.norm(JU[n]['axis'])
        k = int(np.argmax(np.abs(eje))); signo = np.sign(eje[k])
        E = E * [rtb.ET.Rx, rtb.ET.Ry, rtb.ET.Rz][k](flip=(signo < 0))
    E = E * _ets_de_origen(JU['End_Effector_Joint']['xyz'], JU['End_Effector_Joint']['rpy'])
    return rtb.Robot(E, name='SO-ARM100 (ETS del URDF)')

BRAZO_ETS = construir_ets()

def comparar_ets(n=5000, semilla=11):
    rng = np.random.default_rng(semilla); e = []
    for _ in range(n):
        q = rng.uniform(LIMS[:, 0], LIMS[:, 1])
        e.append(np.abs(BRAZO_ETS.fkine(q).A - fk_dh(q, T_TOOL)).max())
    return np.array(e)


if __name__ == '__main__':
    print(BRAZO)
    print('\nCONTRASTE CONTRA EL ROBOTICS TOOLBOX DE PETER CORKE (Python)\n')
    ep, eo, ej = comparar()
    print(f'  posicion del efector   : error maximo {ep.max():.3e} m     medio {ep.mean():.3e}')
    print(f'  orientacion del efector: error maximo {eo.max():.3e}       medio {eo.mean():.3e}')
    print(f'  jacobiano geometrico   : error maximo {ej.max():.3e}       medio {ej.mean():.3e}')
    q0 = np.zeros(5)
    print('\n  pose en q = 0 segun el toolbox:\n', BRAZO.fkine(q0).A)
    print('\n  manipulabilidad de Yoshikawa en q = 0')
    J = BRAZO.jacob0(q0)
    print(f'    sqrt(det(J J^T)) = {np.sqrt(max(np.linalg.det(J@J.T),0)):.6e}   <- formula habitual, invalida para 6x5')
    print(f'    sqrt(det(J^T J)) = {np.sqrt(np.linalg.det(J.T@J)):.6f}          <- formula correcta')
    print(f'    rtb manipulability() = {BRAZO.manipulability(q0):.6f}')
    print(f'    valores singulares   = {np.linalg.svd(J, compute_uv=False)}')
    print(f"    manipulability(axes='trans') = {BRAZO.manipulability(q0, axes='trans'):.6f}   <- version 3x5, si valida")

    print('\n  contraste adicional: modelo por transformadas elementales del URDF (ETS)')
    e = comparar_ets()
    print(f'    error maximo contra la implementacion propia: {e.max():.3e}   medio {e.mean():.3e}')
    print(f'    cadena ETS: {BRAZO_ETS.ets()}')
