# -*- coding: utf-8 -*-
"""Cinematica inversa en forma cerrada del SO-ARM100 sobre su espacio de tareas
   alcanzable (5 dimensiones): posicion + direccion del eje de la herramienta + giro."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from dh_soarm100 import FILAS, T_BASE, T_TOOL, A_dh, fk_dh
from cinematica import LIMS

OFF = np.array([f['theta_off'] for f in FILAS])
D   = np.array([f['d']         for f in FILAS])
A   = np.array([f['a']         for f in FILAS])
AL  = np.array([f['alpha']     for f in FILAS])
L3  = -T_TOOL[2,3]                      # 0.1501 m, desplazamiento de la herramienta sobre z5

def ik(T_obj, codo='arriba', tol=1e-7, verificar=True):
    """Devuelve las soluciones q (5,) que alcanzan la pose T_obj (marco base_link).

    Toda candidata se sustituye en la cinematica directa y se descarta si no
    reproduce la pose pedida dentro de 'tol'.  Sin esa comprobacion el
    procedimiento devuelve candidatas para poses que el mecanismo NO puede
    alcanzar -- por ejemplo cualquier pose con el eje de la herramienta fuera del
    plano del brazo -- y el que llame a la funcion se lo creeria.  Pasar
    verificar=False solo para estudiar el comportamiento interno."""
    T0 = np.linalg.inv(T_BASE) @ T_obj           # pose en el marco DH 0
    p0 = T0[:3,3]
    a_tool = T0[:3,1]                            # eje de la herramienta (y_EE) en marco 0
    sols=[]
    for th1 in (np.arctan2(p0[1],p0[0]), np.arctan2(p0[1],p0[0])+np.pi):
        A1 = A_dh(th1, D[0], A[0], AL[0])
        Ti = np.linalg.inv(A1)
        p1 = Ti[:3,:3] @ p0 + Ti[:3,3]           # objetivo en marco 1 (plano x-y)
        a1 = Ti[:3,:3] @ a_tool
        if abs(p1[2]) > 1e-5: continue           # el objetivo debe caer en el plano del brazo
        # el punto de la herramienta esta a L3 del origen 3, en la direccion -a1
        W = p1[:2] + L3*a1[:2]
        R2 = W @ W
        c3 = (R2 - A[1]**2 - A[2]**2)/(2*A[1]*A[2])
        if abs(c3) > 1.0: continue               # fuera de alcance
        for signo in ((1,) if codo=='arriba' else (-1,) if codo=='abajo' else (1,-1)):
            th3 = signo*np.arccos(np.clip(c3,-1,1))
            th2 = np.arctan2(W[1],W[0]) - np.arctan2(A[2]*np.sin(th3), A[1]+A[2]*np.cos(th3))
            phi = np.arctan2(-a1[1], -a1[0])     # angulo de la direccion de la herramienta en el plano
            th4 = phi - th2 - th3 - np.pi/2
            # th5: giro residual alrededor del eje de la herramienta
            Tp = T_BASE @ A1 @ A_dh(th2,D[1],A[1],AL[1]) @ A_dh(th3,D[2],A[2],AL[2]) @ A_dh(th4,D[3],A[3],AL[3])
            Rr = Tp[:3,:3].T @ T_obj[:3,:3] @ np.linalg.inv(T_TOOL[:3,:3])
            th5 = np.arctan2(Rr[1,0], Rr[0,0])
            q = np.array([th1,th2,th3,th4,th5]) - OFF
            q = (q + np.pi) % (2*np.pi) - np.pi
            if verificar and np.abs(fk_dh(q, T_TOOL) - T_obj).max() > tol:
                continue                          # candidata que no reproduce la pose
            sols.append(q)
    return sols

def dentro(q):
    return np.all(q >= LIMS[:,0]-1e-9) and np.all(q <= LIMS[:,1]+1e-9)

if __name__=='__main__':
    from vec import fk_batch
    np.set_printoptions(precision=6, suppress=True)
    print(f"Desplazamiento de la herramienta sobre el eje de giro: L3 = {L3:.4f} m\n")
    rng=np.random.default_rng(4)
    n_ok=0; n_tot=0; errp=[]; errR=[]; nsol=[]
    for _ in range(5000):
        q = rng.uniform(LIMS[:,0],LIMS[:,1])
        T,_,_ = fk_batch(q[None,:]); T=T[0]
        S = ik(T, codo='ambos')
        n_tot+=1
        buenas=[]
        for qs in S:
            Ts,_,_ = fk_batch(qs[None,:]); Ts=Ts[0]
            ep=np.linalg.norm(Ts[:3,3]-T[:3,3]); eR=np.abs(Ts[:3,:3]-T[:3,:3]).max()
            if ep<1e-8 and eR<1e-6:
                buenas.append(qs); errp.append(ep); errR.append(eR)
        nsol.append(len(buenas))
        if buenas: n_ok+=1
    print("VERIFICACION DE LA CINEMATICA INVERSA CERRADA (5000 poses generadas con FK)")
    print(f"   poses resueltas             : {n_ok}/{n_tot}  ({100*n_ok/n_tot:.2f} %)")
    print(f"   error de posicion   maximo  : {max(errp):.3e} m")
    print(f"   error de orientacion maximo : {max(errR):.3e}")
    print(f"   soluciones exactas por pose : media {np.mean(nsol):.2f}  (codo arriba / codo abajo)")
