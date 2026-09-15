# -*- coding: utf-8 -*-
"""Jacobiano geometrico 6x5, singularidades e indice de manipulabilidad."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from cinematica import fk_urdf, CAD, LIMS, J
from dh_soarm100 import fk_dh, T_TOOL, FILAS, T_BASE, A_dh

def jacobiano(q):
    """Jacobiano geometrico 6x5 del efector, expresado en el marco base."""
    T,Ts = fk_urdf(q)
    o_n = T[:3,3]
    Jg = np.zeros((6,5))
    for i,n in enumerate(CAD):
        Ti = Ts[2*i][2]                                   # marco del eje i (antes de girar)
        z_i = Ti[:3,:3] @ (J[n]['axis']/np.linalg.norm(J[n]['axis']))
        o_i = Ti[:3,3]
        Jg[:3,i] = np.cross(z_i, o_n - o_i)               # parte lineal
        Jg[3:,i] = z_i                                    # parte angular
    return Jg

def jacobiano_numerico(q, h=1e-7):
    """Comprobacion por diferencias finitas (lineal exacto, angular por log de R)."""
    T0,_ = fk_urdf(q); Jn = np.zeros((6,5))
    for i in range(5):
        qp = np.array(q,float); qp[i]+=h
        qm = np.array(q,float); qm[i]-=h
        Tp,_ = fk_urdf(qp); Tm,_ = fk_urdf(qm)
        Jn[:3,i] = (Tp[:3,3]-Tm[:3,3])/(2*h)
        dR = (Tp[:3,:3]-Tm[:3,:3])/(2*h) @ T0[:3,:3].T
        Jn[3:,i] = np.array([dR[2,1]-dR[1,2], dR[0,2]-dR[2,0], dR[1,0]-dR[0,1]])/2
    return Jn

def manipulabilidad(q, parte='completa'):
    Jg = jacobiano(q)
    if parte=='lineal':  Jg = Jg[:3,:]
    if parte=='angular': Jg = Jg[3:,:]
    return float(np.sqrt(max(np.linalg.det(Jg @ Jg.T), 0.0)))

def sigmas(q, parte='completa'):
    Jg = jacobiano(q)
    if parte=='lineal':  Jg = Jg[:3,:]
    return np.linalg.svd(Jg, compute_uv=False)

if __name__=='__main__':
    np.set_printoptions(precision=6, suppress=True)
    # misma semilla y mismo muestreo que verificacion_total.py, para que la cifra
    # que imprime este modulo coincida con la publicada en la documentacion
    rng=np.random.default_rng(11)
    e=[]
    for _ in range(3000):
        q=rng.uniform(LIMS[:,0],LIMS[:,1])
        e.append(np.abs(jacobiano(q)-jacobiano_numerico(q)).max())
    print(f"VERIFICACION del jacobiano analitico contra diferencias finitas (3000 config.)")
    print(f"   error maximo = {max(e):.3e}\n")

    print("JACOBIANO 6x5 EN LA CONFIGURACION CERO (filas: vx,vy,vz,wx,wy,wz)")
    print(jacobiano(np.zeros(5)))
    print("\n   rango =", np.linalg.matrix_rank(jacobiano(np.zeros(5)), tol=1e-9))
    print("   valores singulares =", sigmas(np.zeros(5)))

    print("\n\nEL RANGO NUNCA PUEDE SER 6: la matriz es 6x5.")
    print("Se analiza entonces el rango de la parte LINEAL (3x5) y el rango total (5).")
    print(f"\n{'configuracion':46s} {'rango J':>7} {'w_completa':>12} {'w_lineal':>10} {'sigma_min':>10}")
    casos = {
        'cero (q = 0)'                          : np.zeros(5),
        'brazo extendido (codo 0, hombro 0)'    : np.array([0,0,0,0,0.0]),
        'codo plegado al limite (q3 = +1.5)'    : np.array([0,0,1.5,0,0.0]),
        'codo plegado al limite (q3 = -1.5)'    : np.array([0,0,-1.5,0,0.0]),
        'codo a 45 grados'                      : np.array([0,0,0.785,0,0.0]),
        'codo a 90 grados'                      : np.array([0,0,1.571*0.955,0,0.0]),
        'postura de trabajo tipica'             : np.array([0.4,-0.5,0.9,0.3,0.6]),
        'muneca girada 90 grados'               : np.array([0,0,0.8,0,1.5708]),
    }
    for nom,q in casos.items():
        Jg=jacobiano(q)
        print(f"{nom:46s} {np.linalg.matrix_rank(Jg,tol=1e-9):>7} "
              f"{manipulabilidad(q):>12.6e} {manipulabilidad(q,'lineal'):>10.3e} {sigmas(q).min():>10.3e}")
