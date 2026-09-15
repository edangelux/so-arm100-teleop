# -*- coding: utf-8 -*-
"""Analisis cinematico del SO-ARM100 a partir del URDF real."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np, re, xml.etree.ElementTree as ET

def rpy_R(r,p,y):
    cr,sr,cp,sp,cy,sy = np.cos(r),np.sin(r),np.cos(p),np.sin(p),np.cos(y),np.sin(y)
    return np.array([[cy*cp, cy*sp*sr-sy*cr, cy*sp*cr+sy*sr],
                     [sy*cp, sy*sp*sr+cy*cr, sy*sp*cr-cy*sr],
                     [-sp,   cp*sr,          cp*cr]])

def T_from(xyz,rpy):
    T=np.eye(4); T[:3,:3]=rpy_R(*rpy); T[:3,3]=xyz; return T

def rot_axis(axis,q):
    k=np.asarray(axis,float); k=k/np.linalg.norm(k)
    K=np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    R=np.eye(3)+np.sin(q)*K+(1-np.cos(q))*K@K
    T=np.eye(4); T[:3,:3]=R; return T

def cargar(path='so_arm_100_5dof_arm.urdf.xacro'):
    s=open(path,encoding='utf-8').read().replace('${prefix}','')
    s=re.sub(r'xmlns:xacro="[^"]*"','',s); s=re.sub(r'</?xacro:[^>]*>','',s)
    root=ET.fromstring(s)
    J={}
    for j in root.iter('joint'):
        o=j.find('origin'); a=j.find('axis'); l=j.find('limit')
        J[j.get('name')]=dict(
            tipo=j.get('type'),
            xyz=np.array([float(v) for v in (o.get('xyz') if o is not None else '0 0 0').split()]),
            rpy=np.array([float(v) for v in (o.get('rpy') if o is not None else '0 0 0').split()]),
            axis=np.array([float(v) for v in a.get('xyz').split()]) if a is not None else None,
            lim=(float(l.get('lower')),float(l.get('upper'))) if l is not None else None,
            padre=j.find('parent').get('link'), hijo=j.find('child').get('link'))
    return J

J = cargar()
CAD = ['Shoulder_Rotation','Shoulder_Pitch','Elbow','Wrist_Pitch','Wrist_Roll']
LIMS = np.array([J[n]['lim'] for n in CAD])

def fk_urdf(q, hasta=None):
    """FK desde base_link. Devuelve la lista de transformadas acumuladas."""
    q=np.asarray(q,float); Ts=[]
    T=T_from(J['base_link_joint']['xyz'], J['base_link_joint']['rpy'])
    for i,n in enumerate(CAD):
        T = T @ T_from(J[n]['xyz'], J[n]['rpy'])
        Ts.append((n,'origen',T.copy()))          # marco de la articulacion antes de girar
        T = T @ rot_axis(J[n]['axis'], q[i])
        Ts.append((n,'girado',T.copy()))
    T = T @ T_from(J['End_Effector_Joint']['xyz'], J['End_Effector_Joint']['rpy'])
    Ts.append(('End_Effector','fijo',T.copy()))
    return T, Ts

def ejes_y_puntos(q=None):
    """z_i (direccion del eje de la articulacion i+1) y un punto sobre el, en base."""
    if q is None: q=np.zeros(5)
    _,Ts = fk_urdf(q)
    z=[]; p=[]
    for i,n in enumerate(CAD):
        T = Ts[2*i][2]                      # marco del origen de la articulacion
        z.append(T[:3,:3] @ (J[n]['axis']/np.linalg.norm(J[n]['axis'])))
        p.append(T[:3,3])
    return np.array(z), np.array(p)

if __name__=='__main__':
    np.set_printoptions(precision=6, suppress=True)
    z,p = ejes_y_puntos()
    print("EJES DE LAS 5 ARTICULACIONES EN CONFIGURACION CERO (marco base_link)\n")
    for i,n in enumerate(CAD):
        print(f"  {i+1}. {n:20s} z = {z[i]}   punto = {p[i]}")
    print("\nPARALELISMO ENTRE EJES CONSECUTIVOS (|z_i x z_j|, 0 = paralelos)")
    for i in range(4):
        c=np.cross(z[i],z[i+1])
        print(f"  z{i+1} x z{i+2} = {np.linalg.norm(c):.6f}   ({'PARALELOS' if np.linalg.norm(c)<1e-6 else 'no paralelos'})")
    T,_ = fk_urdf(np.zeros(5))
    print("\nPOSE DEL EFECTOR EN CERO\n", T)


def marcos_de_eslabon(q):
    """Transformada del marco de cada link visual (donde vive su malla STL)."""
    q=np.asarray(q,float); M={}
    T=T_from(J['base_link_joint']['xyz'], J['base_link_joint']['rpy']); M['Base']=T.copy()
    for i,n in enumerate(CAD):
        T = T @ T_from(J[n]['xyz'], J[n]['rpy']) @ rot_axis(J[n]['axis'], q[i])
        M[J[n]['hijo']] = T.copy()
    M[J['Gripper']['hijo']] = M[J['Gripper']['padre']] @ T_from(J['Gripper']['xyz'], J['Gripper']['rpy'])
    return M
