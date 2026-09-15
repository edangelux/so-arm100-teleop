# -*- coding: utf-8 -*-
"""FK y jacobiano vectorizados (N configuraciones a la vez)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from cinematica import J, CAD, rpy_R, T_from, LIMS

FIX  = [T_from(J[n]['xyz'], J[n]['rpy']) for n in CAD]
AX   = [J[n]['axis']/np.linalg.norm(J[n]['axis']) for n in CAD]
T_B  = T_from(J['base_link_joint']['xyz'], J['base_link_joint']['rpy'])
T_EE = T_from(J['End_Effector_Joint']['xyz'], J['End_Effector_Joint']['rpy'])

def _rot_batch(k, q):
    K = np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    I = np.eye(3)
    R = I + np.sin(q)[:,None,None]*K + (1-np.cos(q))[:,None,None]*(K@K)
    T = np.zeros((len(q),4,4)); T[:,:3,:3]=R; T[:,3,3]=1
    return T

def fk_batch(Q):
    """Q: (N,5). Devuelve T_ee (N,4,4), ejes z (N,5,3), origenes o (N,5,3)."""
    N=len(Q); T=np.broadcast_to(T_B,(N,4,4)).copy()
    Z=np.zeros((N,5,3)); O=np.zeros((N,5,3))
    for i in range(5):
        T = T @ FIX[i]
        Z[:,i,:] = T[:,:3,:3] @ AX[i]
        O[:,i,:] = T[:,:3,3]
        T = T @ _rot_batch(AX[i], Q[:,i])
    T = T @ T_EE
    return T, Z, O

def jac_batch(Q):
    T,Z,O = fk_batch(Q)
    on = T[:,:3,3][:,None,:]                      # (N,1,3)
    Jg = np.zeros((len(Q),6,5))
    Jg[:,:3,:] = np.cross(Z, on-O).transpose(0,2,1)
    Jg[:,3:,:] = Z.transpose(0,2,1)
    return Jg

def w_batch(Jg):
    """sqrt(det(J^T J)) = producto de valores singulares (jacobiano 6x5)."""
    s = np.linalg.svd(Jg, compute_uv=False)
    return np.prod(s,axis=1), s

if __name__=='__main__':
    from jacobiano import jacobiano
    rng=np.random.default_rng(5); Q=rng.uniform(LIMS[:,0],LIMS[:,1],size=(200,5))
    Jb=jac_batch(Q)
    e=max(np.abs(Jb[i]-jacobiano(Q[i])).max() for i in range(200))
    print(f"jacobiano vectorizado vs escalar: error maximo = {e:.3e}")
