# -*- coding: utf-8 -*-
"""Verificacion cruzada completa: corre TODAS las comprobaciones y las resume en una tabla.

   Es el programa que hay que ejecutar para responder a la pregunta "¿esto esta bien?".
   Cada linea de la tabla compara un resultado propio contra una fuente independiente.
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import time, numpy as np
from cinematica import fk_urdf, ejes_y_puntos, LIMS
from dh_soarm100 import FILAS, T_BASE, T_TOOL, GEO, fk_dh
from jacobiano import jacobiano, jacobiano_numerico
from inversa import ik, dentro
from vec import fk_batch, jac_batch, w_batch

np.set_printoptions(precision=6, suppress=True)
RES = []


def apunta(que, contra, n, err, ok=None, nota=''):
    if ok is None:
        ok = err < 1e-8
    RES.append((que, contra, n, err, ok, nota))


def barra(t=''):
    print('\n' + '=' * 78)
    if t: print(' ' + t); print('=' * 78)


# ------------------------------------------------------------------ 1
barra('1. Cinematica directa por D-H contra el modelo descriptivo')
rng = np.random.default_rng(7); e = 0.0
for _ in range(20000):
    q = rng.uniform(LIMS[:, 0], LIMS[:, 1])
    e = max(e, np.abs(fk_dh(q, T_TOOL) - fk_urdf(q)[0]).max())
print(f'   20 000 configuraciones aleatorias, error maximo = {e:.3e}')
apunta('Cinematica directa por D-H', 'cinematica del modelo descriptivo', 20000, e)

# ------------------------------------------------------------------ 1-bis
barra('1-bis. Configuracion de origen y extremos del recorrido articular')
# El muestreo aleatorio del paso anterior no garantiza por si solo haber visitado
# la configuracion de origen ni los topes mecanicos, que son justamente las tres
# configuraciones que un revisor comprueba a mano.  Se verifican de forma explicita.
_casos = [('configuracion de origen  q = 0', np.zeros(5)),
          ('todos los topes inferiores', LIMS[:, 0].copy()),
          ('todos los topes superiores', LIMS[:, 1].copy())]
e = 0.0
for _nom, _q in _casos:
    _d = np.abs(fk_dh(_q, T_TOOL) - fk_urdf(_q)[0]).max()
    e = max(e, _d)
    print(f'   {_nom:30s} error = {_d:.3e}')
_p0 = fk_urdf(np.zeros(5))[0][:3, 3] * 1000
print(f'   posicion del efector en q = 0: ({_p0[0]:.2f}, {_p0[1]:.2f}, {_p0[2]:.2f}) mm')
apunta('Configuracion de origen y topes mecanicos', 'cinematica del modelo descriptivo', 3, e,
       nota='las tres configuraciones que se verifican a mano')

# ------------------------------------------------------------------ 2
barra('2. Jacobiano geometrico contra diferencias finitas')
# mismo muestreo que jacobiano.py, sobre el rango articular completo
rng = np.random.default_rng(11); e = 0.0
for _ in range(3000):
    q = rng.uniform(LIMS[:, 0], LIMS[:, 1])
    e = max(e, np.abs(jacobiano(q) - jacobiano_numerico(q)).max())
print(f'   3 000 configuraciones, error maximo = {e:.3e}')
apunta('Jacobiano geometrico', 'diferencias finitas centradas', 3000, e, ok=e < 1e-6,
       nota='el residuo es el truncamiento del metodo de diferencias')

# ------------------------------------------------------------------ 3
barra('3. Contraste contra el Robotics Toolbox de Peter Corke')
try:
    from toolbox_python import BRAZO, comparar, comparar_ets
    ep, eo, ej = comparar(5000)
    print(f'   posicion    : {ep.max():.3e} m')
    print(f'   orientacion : {eo.max():.3e}')
    print(f'   jacobiano   : {ej.max():.3e}')
    apunta('Cinematica directa', 'Robotics Toolbox, modelo D-H', 5000, ep.max())
    apunta('Orientacion del efector', 'Robotics Toolbox', 5000, eo.max())
    apunta('Jacobiano geometrico', 'Robotics Toolbox', 5000, ej.max())
    ee = comparar_ets(5000)
    print(f'   transformadas elementales del modelo descriptivo : {ee.max():.3e}')
    apunta('Cinematica directa', 'Robotics Toolbox, transformadas elementales', 5000, ee.max())
    J0 = np.asarray(BRAZO.jacob0(np.zeros(5)))
    print(f'\n   manipulabilidad del propio toolbox en q=0 : {BRAZO.manipulability(np.zeros(5)):.6f}')
    print(f'   sqrt(det(J^T J)) segun este trabajo        : {np.sqrt(np.linalg.det(J0.T @ J0)):.6f}')
except ImportError:
    print('   roboticstoolbox-python no instalado; se omite.')

# ------------------------------------------------------------------ 4
barra('4. Estructura de la cadena')
z, p = ejes_y_puntos(np.zeros(5))
for i in range(4):
    c = np.linalg.norm(np.cross(z[i], z[i + 1]))
    print(f'   |z{i+1} x z{i+2}| = {c:.6e}   {"PARALELOS" if c < 1e-9 else "no paralelos"}')
par = max(np.linalg.norm(np.cross(z[1], z[2])), np.linalg.norm(np.cross(z[2], z[3])))
apunta('Paralelismo de los tres cabeceos', 'ejes del modelo descriptivo', 3, par,
       nota='z2, z3 y z4 comparten direccion exactamente')

# ------------------------------------------------------------------ 5
barra('5. La posicion del efector no depende de q5')
rng = np.random.default_rng(3); e = 0.0
for _ in range(2000):
    q = rng.uniform(LIMS[:, 0], LIMS[:, 1])
    a = fk_dh(q, T_TOOL)[:3, 3]
    q2 = q.copy(); q2[4] = rng.uniform(LIMS[4, 0], LIMS[4, 1])
    e = max(e, np.abs(fk_dh(q2, T_TOOL)[:3, 3] - a).max())
jc = np.abs([jacobiano(rng.uniform(LIMS[:, 0], LIMS[:, 1]))[:3, 4] for _ in range(500)]).max()
print(f'   desplazamiento maximo al barrer solo q5      = {e:.3e} m')
print(f'   maxima columna lineal 5 del jacobiano        = {jc:.3e}')
apunta('Independencia de la posicion respecto de q5', 'barrido directo', 2000, max(e, jc))

# ------------------------------------------------------------------ 6
barra('6. El eje de la herramienta vive en el plano del brazo')
rng = np.random.default_rng(5); d = 0.0
for _ in range(200000 // 20):
    Q = rng.uniform(LIMS[:, 0], LIMS[:, 1], size=(20, 5))
    T, _, _ = fk_batch(Q)
    pos = T[:, :3, 3]; eje = T[:, :3, 1]
    n = np.cross(np.array([0., 0., 1.]), pos - T_BASE[:3, 3])
    nn = np.linalg.norm(n, axis=1)
    # cuando el efector cae SOBRE el eje de la base el plano no esta definido y la
    # medida no significa nada; se excluye una vecindad de 10 mm alrededor del eje
    m = nn > 0.010
    d = max(d, np.abs(np.einsum('ij,ij->i', eje[m], n[m] / nn[m, None])).max())
print(f'   200 000 configuraciones (excluyendo 10 mm alrededor del eje de la base)')
print(f'   desviacion maxima del eje de la herramienta fuera del plano = {d:.3e}')
apunta('El eje de la herramienta permanece en el plano del brazo', 'barrido directo', 200000, d,
       ok=d < 1e-3, nota='excluida una vecindad de 10 mm del eje de la base, donde el plano no existe')

# ------------------------------------------------------------------ 7
barra('7. Cinematica inversa cerrada')
rng = np.random.default_rng(13)
ok = 0; ep = 0.0; eo = 0.0; ns = []; nt = []
for _ in range(3000):
    q = rng.uniform(LIMS[:, 0] * 0.9, LIMS[:, 1] * 0.9)
    T = fk_dh(q, T_TOOL)
    sols = [s for s in ik(T, codo='ambos') if dentro(s)]
    todas = ik(T, codo='ambos')
    if not sols: continue
    ok += 1; ns.append(len(sols)); nt.append(len(todas))
    Tb = fk_dh(sols[0], T_TOOL)
    ep = max(ep, np.abs(Tb[:3, 3] - T[:3, 3]).max())
    eo = max(eo, np.abs(Tb[:3, :3] - T[:3, :3]).max())
print(f'   poses resueltas         : {ok}/3000  ({100*ok/3000:.2f} %)')
print(f'   error maximo de posicion: {ep:.3e} m')
print(f'   soluciones exactas por pose          : {np.mean(nt):.2f}  (ramas de base x ramas de codo)')
print(f'   de esas, dentro de los limites       : {np.mean(ns):.2f}')
apunta('Cinematica inversa cerrada', 'ida y vuelta por cinematica directa', 3000, ep,
       ok=(ok == 3000 and ep < 1e-9), nota=f'{ok}/3000 resueltas; {np.mean(nt):.2f} soluciones exactas por pose, {np.mean(ns):.2f} dentro de los limites')

# ------------------------------------------------------------------ 8
barra('8. Poses SE(3) arbitrarias: no alcanzables')
rng = np.random.default_rng(17); ok2 = 0
for _ in range(1000):
    q = rng.uniform(LIMS[:, 0] * 0.9, LIMS[:, 1] * 0.9)
    T = fk_dh(q, T_TOOL).copy()
    A = rng.normal(size=(3, 3)); U, _, Vt = np.linalg.svd(A)
    R = U @ Vt
    if np.linalg.det(R) < 0: R[:, 0] *= -1
    T[:3, :3] = R
    if [s for s in ik(T) if dentro(s)]: ok2 += 1
print(f'   poses resueltas: {ok2}/1000  ({100*ok2/1000:.2f} %)')
print('   -> tiene que ser 0: cinco grados de libertad no alcanzan una pose de seis')
apunta('Poses SE(3) arbitrarias', 'procedimiento cerrado', 1000, float(ok2), ok=(ok2 == 0),
       nota='0 de 1000 es el resultado correcto, no un fallo')

# ------------------------------------------------------------------ 9
barra('9. Manipulabilidad y singularidad')
J0 = jacobiano(np.zeros(5))
print(f'   det(J J^T) en q=0        = {np.linalg.det(J0 @ J0.T):.3e}   (siempre cero: 6x6 de rango <= 5)')
print(f'   sqrt(det(J^T J)) en q=0  = {np.sqrt(np.linalg.det(J0.T @ J0)):.6f}')
print(f'   producto de sigmas       = {np.prod(np.linalg.svd(J0, compute_uv=False)):.6f}')
g3 = np.linspace(LIMS[2, 0], LIMS[2, 1], 4001)
Q = np.zeros((len(g3), 5)); Q[:, 2] = g3
wv, _ = w_batch(jac_batch(Q))
i = int(np.argmin(wv))
pred = -np.degrees(FILAS[2]['theta_off'])
Js = jacobiano(Q[i])
print(f'   minimo de w en q3        = {np.degrees(g3[i]):.3f} deg   (prediccion: {pred:.3f} deg)')
print(f'   w en la singularidad     = {wv[i]:.3e}   mediana fuera = {np.median(wv):.3e}')
print(f'   rango en la singularidad = {np.linalg.matrix_rank(Js, tol=1e-7)}')
apunta('Ubicacion de la singularidad', 'prediccion -theta3 de la tabla D-H', 4001,
       abs(np.degrees(g3[i]) - pred), ok=abs(np.degrees(g3[i]) - pred) < 0.05,
       nota=f'q3 = {np.degrees(g3[i]):.3f} deg, rango 5 -> 4')

# ------------------------------------------------------------------ 10
barra('10. Espacio de trabajo')
# La posicion depende solo de q2, q3 y q4.  Se barre una malla fina de esas tres
# variables DENTRO de los limites: un optimizador sin restricciones se sale del
# recorrido mecanico y devuelve extremos que el robot no puede alcanzar.
n = 161
g = [np.linspace(LIMS[i, 0], LIMS[i, 1], n) for i in (1, 2, 3)]
G2, G3, G4 = np.meshgrid(*g, indexing='ij')
Q = np.zeros((G2.size, 5)); Q[:, 1] = G2.ravel(); Q[:, 2] = G3.ravel(); Q[:, 3] = G4.ravel()
P = fk_batch(Q)[0][:, :3, 3]
r = np.hypot(P[:, 0] - T_BASE[0, 3], P[:, 1] - T_BASE[1, 3])
print(f'   malla de {n}^3 = {G2.size} configuraciones, dentro de los limites')
print(f'   alcance radial maximo desde el eje de la base = {r.max()*1000:.2f} mm')
print(f'   distancia maxima al origen del modelo         = {np.linalg.norm(P, axis=1).max()*1000:.2f} mm')
print(f'   altura maxima sobre el plano de montaje       = {P[:,2].max()*1000:.2f} mm')
print(f'   altura minima                                 = {P[:,2].min()*1000:.2f} mm')
print(f'   recorrido angular de la base                  = {np.degrees(LIMS[0,0]):+.1f} a {np.degrees(LIMS[0,1]):+.1f} grados')

# ------------------------------------------------------------------ tabla
barra('RESUMEN')
print(f"{'que se comprueba':46s}{'muestras':>9}{'error max':>13}   estado")
print('-' * 78)
todo = True
for que, contra, n, err, ok, nota in RES:
    print(f'{que:46s}{n:>9}{err:>13.3e}   {"OK" if ok else "REVISAR"}')
    print(f'    contra: {contra}' + (f'  ({nota})' if nota else ''))
    todo &= ok
print('-' * 78)
print('TODAS LAS COMPROBACIONES PASAN' if todo else 'HAY AL MENOS UNA COMPROBACION QUE NO PASA')
