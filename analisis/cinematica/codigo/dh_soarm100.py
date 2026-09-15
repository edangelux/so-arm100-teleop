# -*- coding: utf-8 -*-
"""Extraccion automatica de los parametros Denavit-Hartenberg (convencion clasica)
   a partir de los ejes reales del URDF, y verificacion contra la FK del URDF."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from cinematica import fk_urdf, ejes_y_puntos, CAD, LIMS, J

TOL = 1e-9

def unit(v):
    n=np.linalg.norm(v); return v/n if n>TOL else v

def normal_comun(p0,z0,p1,z1):
    """Devuelve (x, foot0, o1, a, caso) para la normal comun de dos rectas."""
    c = np.cross(z0,z1)
    nc = np.linalg.norm(c)
    if nc < 1e-6:                                  # ejes PARALELOS
        w = p1 - p0
        perp = w - np.dot(w,z0)*z0                 # componente perpendicular
        a = np.linalg.norm(perp)
        x = unit(perp) if a > 1e-9 else unit(np.cross(z0,[1,0,0]) if abs(z0[0])<0.9 else np.cross(z0,[0,1,0]))
        foot0 = p0                                  # regla estandar: normal por o_{i-1} -> d=0
        o1 = p0 + a*x
        return x, foot0, o1, a, 'paralelos'
    # ejes no paralelos: puntos mas cercanos entre las dos rectas
    w = p0 - p1
    A=np.array([[np.dot(z0,z0), -np.dot(z0,z1)],[np.dot(z0,z1), -np.dot(z1,z1)]])
    b=np.array([-np.dot(z0,w), -np.dot(z1,w)])
    t = np.linalg.solve(A,b)
    foot0 = p0 + t[0]*z0
    o1    = p1 + t[1]*z1
    d = o1 - foot0
    if np.linalg.norm(d) < 1e-9:                   # ejes que se cortan -> a = 0
        return unit(c), foot0, o1, 0.0, 'se cortan'
    x = unit(d)
    return x, foot0, o1, float(np.linalg.norm(d)), 'oblicuos'

def extraer_dh():
    z_j, p_j = ejes_y_puntos(np.zeros(5))          # ejes de las 5 articulaciones
    T_ee,_ = fk_urdf(np.zeros(5))
    # eje virtual 6 para cerrar el ultimo marco: misma direccion que z5, por el punto del efector
    Z = [unit(z_j[i]) for i in range(5)] + [unit(z_j[4])]
    P = [p_j[i] for i in range(5)] + [T_ee[:3,3]]

    # marco 0: z0 sobre el eje 1; x0 se elige como la normal comun hacia el eje 2
    x0,_,_,_,_ = normal_comun(P[0],Z[0],P[1],Z[1])
    O = [P[0]]; X = [x0]
    filas=[]
    for i in range(1,6):
        x_i, foot, o_i, a_i, caso = normal_comun(O[i-1],Z[i-1],P[i],Z[i])
        d_i = float(np.dot(foot - O[i-1], Z[i-1]))
        th  = float(np.arctan2(np.dot(np.cross(X[i-1],x_i),Z[i-1]), np.dot(X[i-1],x_i)))
        al  = float(np.arctan2(np.dot(np.cross(Z[i-1],Z[i]),x_i), np.dot(Z[i-1],Z[i])))
        O.append(o_i); X.append(x_i)
        filas.append(dict(i=i, theta_off=th, d=d_i, a=a_i, alpha=al, caso=caso))
    T0 = np.eye(4)
    T0[:3,0]=X[0]; T0[:3,1]=np.cross(Z[0],X[0]); T0[:3,2]=Z[0]; T0[:3,3]=O[0]
    return filas, T0, (O,X,Z)

def A_dh(theta,d,a,alpha):
    ct,st,ca,sa = np.cos(theta),np.sin(theta),np.cos(alpha),np.sin(alpha)
    return np.array([[ct,-st*ca, st*sa, a*ct],
                     [st, ct*ca,-ct*sa, a*st],
                     [0 ,    sa,    ca,    d],
                     [0 ,     0,     0,    1]])

FILAS, T_BASE, GEO = extraer_dh()

def fk_dh(q, T_tool=None):
    T = T_BASE.copy()
    for k,f in enumerate(FILAS):
        th = f['theta_off'] + (q[k] if k < 5 else 0.0)
        T = T @ A_dh(th, f['d'], f['a'], f['alpha'])
    return T if T_tool is None else T @ T_tool

# herramienta constante: lo que falta entre el marco DH 5 y el marco End_Effector
T_TOOL = np.linalg.inv(fk_dh(np.zeros(5))) @ fk_urdf(np.zeros(5))[0]

if __name__=='__main__':
    np.set_printoptions(precision=6, suppress=True)
    print("TABLA DENAVIT-HARTENBERG (convencion clasica)  T = Rz(th) Tz(d) Tx(a) Rx(al)\n")
    print(f"{'i':>2} {'theta_i':>26} {'d_i (m)':>12} {'a_i (m)':>12} {'alpha_i':>14}   caso")
    for k,f in enumerate(FILAS):
        nom = f"q{k+1} + {np.degrees(f['theta_off']):8.3f}deg" if k<5 else f"{np.degrees(f['theta_off']):8.3f}deg"
        print(f"{f['i']:>2} {nom:>26} {f['d']:12.6f} {f['a']:12.6f} {np.degrees(f['alpha']):11.4f}deg   {f['caso']}")
    print("\nT_base (base_link -> marco DH 0):\n", T_BASE)
    print("\nT_tool (marco DH 5 -> End_Effector):\n", T_TOOL)

    rng=np.random.default_rng(7); err=[]
    for _ in range(20000):
        q = rng.uniform(LIMS[:,0], LIMS[:,1])
        err.append(np.abs(fk_dh(q,T_TOOL) - fk_urdf(q)[0]).max())
    err=np.array(err)
    print(f"\nVERIFICACION FK_DH vs FK_URDF sobre 20000 configuraciones aleatorias")
    print(f"   error maximo  = {err.max():.3e}")
    print(f"   error medio   = {err.mean():.3e}")
