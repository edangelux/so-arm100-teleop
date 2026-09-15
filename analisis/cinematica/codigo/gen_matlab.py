# -*- coding: utf-8 -*-
"""Genera SOARM100_parametros.m a partir de los valores verificados en Python.

   Escribir los parametros a mano en dos lenguajes distintos es una fuente segura
   de discrepancias: la version de MATLAB llevaba los limites articulares y las
   transformadas constantes redondeados, y por eso su espacio de trabajo no
   coincidia con el de Python.  Este generador elimina esa posibilidad."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from dh_soarm100 import FILAS, T_BASE, T_TOOL
from cinematica import LIMS, CAD

def mat(A, ind='         '):
    fil = [ind + ' '.join(f'{v:+.15e}' for v in f) for f in np.asarray(A, float)]
    return (' ;\n').join(fil)

L = []
L.append('function P = SOARM100_parametros()')
L.append('%SOARM100_PARAMETROS  Parametros cinematicos del manipulador SO-ARM100.')
L.append('%')
L.append('%   Los valores se extrajeron del modelo descriptivo publicado por el proyecto')
L.append('%   so_arm_100_description (paquete brukg/SO-100-arm), archivo')
L.append('%   so_arm_100_5dof_arm.urdf.xacro, que es el mismo que cargan el simulador y el')
L.append('%   planificador de movimiento.  El repositorio oficial del robot no publica una')
L.append('%   tabla de Denavit-Hartenberg, de modo que la tabla se derivo de los ejes y')
L.append('%   anclajes declarados en ese modelo.')
L.append('%')
L.append('%   ESTE ARCHIVO SE GENERA AUTOMATICAMENTE.  No debe editarse a mano: se obtiene')
L.append('%   con  python codigo/gen_matlab.py  a partir de los mismos modulos que producen los')
L.append('%   resultados publicados, de modo que las versiones de MATLAB y de Python no')
L.append('%   pueden discrepar.')
L.append('%')
L.append('%   Convencion clasica:  A_i = Rz(theta_i) Tz(d_i) Tx(a_i) Rx(alpha_i)')
L.append('%')
L.append('%   P.DH   -> [theta_offset  d  a  alpha]  (rad, m, m, rad), una fila por articulacion')
L.append('%   P.Tb   -> transformada constante  base_link -> marco 0')
L.append('%   P.Tt   -> transformada constante  marco 5   -> punto del efector')
L.append('%   P.lim  -> limites articulares [inferior superior] en rad')
L.append('%   P.L3   -> extension de la herramienta sobre el eje de giro de la muneca')
L.append('')
L.append("P.nombres = {" + " ".join(f"'{n}'" for n in CAD) + "};")
L.append('')
L.append('%              theta_offset            d                        a                        alpha')
filas = []
for f in FILAS:
    filas.append(f"         {f['theta_off']:+.15e} {f['d']:+.15e} {f['a']:+.15e} {f['alpha']:+.15e}")
L.append('P.DH = [\n' + ' ;\n'.join(filas) + ' ];')
L.append('')
L.append('P.Tb = [\n' + mat(T_BASE) + ' ];')
L.append('')
L.append('P.Tt = [\n' + mat(T_TOOL) + ' ];')
L.append('')
L.append('P.lim = [\n' + mat(LIMS) + ' ];')
L.append('')
L.append(f'P.L3 = {abs(T_TOOL[2,3]):.15e};')
L.append('end')
_aqui = _os.path.dirname(_os.path.abspath(__file__))
_destino = _os.path.join(_aqui, '..', 'matlab', 'SOARM100_parametros.m')
if not _os.path.isdir(_os.path.dirname(_destino)):
    _destino = _os.path.join(_aqui, 'matlab', 'SOARM100_parametros.m')
    _os.makedirs(_os.path.dirname(_destino), exist_ok=True)
_destino = _os.path.normpath(_destino)
open(_destino, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('escrito', _destino)
