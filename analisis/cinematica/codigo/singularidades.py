# -*- coding: utf-8 -*-
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from cinematica import fk_urdf, CAD, LIMS, J
from jacobiano import jacobiano

def w_yoshikawa(q):
    """Indice de manipulabilidad para jacobiano NO cuadrado 6x5.
       Con m>n hay que usar det(J^T J), no det(J J^T) -- este ultimo es
       identicamente cero porque J J^T es 6x6 de rango <= 5."""
    Jg = jacobiano(q)
    return float(np.sqrt(max(np.linalg.det(Jg.T @ Jg), 0.0)))

def w_lineal(q):
    Jv = jacobiano(q)[:3,:]
    return float(np.sqrt(max(np.linalg.det(Jv @ Jv.T), 0.0)))

def sigma_min(q):
    return float(np.linalg.svd(jacobiano(q), compute_uv=False).min())

if __name__=='__main__':
    np.set_printoptions(precision=6, suppress=True)
    Jg = jacobiano(np.zeros(5))
    print("POR QUE LA FORMULA HABITUAL FALLA CON UN JACOBIANO 6x5")
    print(f"   det(J J^T) con J 6x5  = {np.linalg.det(Jg@Jg.T):.3e}   <- siempre cero, J J^T es 6x6 de rango <= 5")
    print(f"   det(J^T J) con J 6x5  = {np.linalg.det(Jg.T@Jg):.6f}   <- este es el correcto")
    print(f"   producto de los 5 valores singulares = {np.prod(np.linalg.svd(Jg,compute_uv=False)):.6f}")
    print(f"   sqrt(det(J^T J))                     = {w_yoshikawa(np.zeros(5)):.6f}   (coinciden)\n")

    # ---- busqueda de las configuraciones peor condicionadas ----
    # El barrido es vectorizado: 200 000 jacobianos en un solo producto matricial.
    # Hacerlo con un bucle de Python sobre jacobiano() tarda decenas de minutos.
    from vec import jac_batch, w_batch
    rng = np.random.default_rng(11)
    N = 200000
    Q = rng.uniform(LIMS[:,0], LIMS[:,1], size=(N,5))
    print(f"barriendo {N} configuraciones (vectorizado, unos segundos)...", flush=True)
    Jg_lote = jac_batch(Q)
    w, sig = w_batch(Jg_lote)
    sm = sig.min(axis=1)
    print(f"BARRIDO DE {N} CONFIGURACIONES DENTRO DE LOS LIMITES ARTICULARES")
    print(f"   w      min={w.min():.3e}   mediana={np.median(w):.3e}   max={w.max():.3e}")
    print(f"   sigma5 min={sm.min():.3e}  mediana={np.median(sm):.3e}  max={sm.max():.3e}")
    k = np.argsort(w)[:5]
    print("\n   las 5 configuraciones peor condicionadas (grados):")
    for i in k:
        print(f"     q = {np.degrees(Q[i]).round(1)}   w = {w[i]:.3e}   sigma_min = {sm[i]:.3e}")

    # ---- singularidad de hombro: centro de muneca sobre el eje de la base ----
    print("\n\nSINGULARIDAD DE HOMBRO (el punto de la muneca cae sobre el eje 1)")
    print("   El eje 1 pasa por (0,-0.0452,0.0165) con direccion (0,0,-1) en base_link.")
    print("   Distancia radial del centro de muneca al eje 1, y w, barriendo q2 y q3:\n")
    print(f"   {'q2 (deg)':>9} {'q3 (deg)':>9} {'r_muneca (m)':>13} {'w':>12} {'sigma_min':>11}")
    for q2 in (-1.4,-0.7,0.0,0.7,1.4):
        for q3 in (-1.4,0.0,1.4):
            q=np.array([0,q2,q3,0,0.0])
            _,Ts=fk_urdf(q); o_w=Ts[8][2][:3,3]          # origen de Wrist_Roll
            r=np.hypot(o_w[0]-0.0, o_w[1]-(-0.0452))     # radio respecto al eje vertical
            print(f"   {np.degrees(q2):9.1f} {np.degrees(q3):9.1f} {r:13.5f} {w_yoshikawa(q):12.3e} {sigma_min(q):11.3e}")
