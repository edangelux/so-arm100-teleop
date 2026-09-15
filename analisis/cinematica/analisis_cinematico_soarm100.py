#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
analisis_cinematico_soarm100.py
===============================
Analisis cinematico completo del manipulador SO-ARM100, autocontenido.
Reproduce todos los numeros del capitulo del documento. Solo necesita numpy
(matplotlib es opcional, para las figuras).

    python3 analisis_cinematico_soarm100.py

Los parametros salen del URDF real que cargan Gazebo y MoveIt 2:
    so_arm_100_description/urdf/so_arm_100_5dof_arm.urdf.xacro
La semilla del generador aleatorio esta fijada: los numeros salen identicos
en cualquier maquina.
"""
import numpy as np

# ---------------------------------------------------------------- parametros
# Tabla Denavit-Hartenberg, convencion clasica:  A_i = Rz(th) Tz(d) Tx(a) Rx(al)
#              theta_offset      d (m)     a (m)    alpha (rad)
DH = np.array([[ 0.0,          -0.1025,   0.0306,   np.pi/2],
               [-1.3270094336,  0.0,      0.1160,   0.0    ],
               [ 1.2884814368,  0.0,      0.1350,   0.0    ],
               [-1.5322620032,  0.0,      0.0,      np.pi/2],
               [ np.pi,         0.0,      0.0,      0.0    ]])
# transformadas constantes de los extremos
Tb = np.array([[0,-1,0, 0.0   ],[-1,0,0,-0.0452],[0,0,-1, 0.0165],[0,0,0,1]], float)
Tt = np.array([[1, 0,0, 0.0   ],[ 0,0,-1,0.0   ],[0,1, 0,-0.1501],[0,0,0,1]], float)
L3   = 0.1501                       # herramienta sobre el eje de giro de la muneca
LIMS = np.array([[-1.960,1.960],[-1.745,1.745],[-1.500,1.500],[-1.658,1.658],[-2.750,2.750]])
NOM  = ['Shoulder_Rotation','Shoulder_Pitch','Elbow','Wrist_Pitch','Wrist_Roll']
EJE_BASE = np.array([0.0,-0.0452,0.0165])

# ---------------------------------------------------------------- cinematica
def dhA(th,d,a,al):
    ct,st,ca,sa = np.cos(th),np.sin(th),np.cos(al),np.sin(al)
    return np.array([[ct,-st*ca, st*sa, a*ct],
                     [st, ct*ca,-ct*sa, a*st],
                     [0 ,    sa,    ca,    d],
                     [0 ,     0,     0,    1]])

def fk(q):
    """Cinematica directa. Devuelve (T_efector, marcos acumulados 0..5)."""
    T = Tb.copy(); Ti=[T.copy()]
    for i in range(5):
        T = T @ dhA(DH[i,0]+q[i], DH[i,1], DH[i,2], DH[i,3]); Ti.append(T.copy())
    return T @ Tt, Ti

def jacobiano(q):
    """Jacobiano geometrico 6x5 en el marco base. Filas 1-3 lineal, 4-6 angular."""
    T,Ti = fk(q); on = T[:3,3]; Jg = np.zeros((6,5))
    for i in range(5):
        z = Ti[i][:3,2]; o = Ti[i][:3,3]
        Jg[:3,i] = np.cross(z, on-o); Jg[3:,i] = z
    return Jg

def manipulabilidad(q):
    """w = sqrt(det(J^T J)). Con J de 6x5 NO sirve sqrt(det(J J^T)): esa matriz
       es 6x6 de rango <= 5 y su determinante es identicamente cero."""
    Jg = jacobiano(q)
    return float(np.sqrt(max(np.linalg.det(Jg.T @ Jg), 0.0)))

def ik(T_obj):
    """Cinematica inversa en forma cerrada sobre el espacio alcanzable (5 dimensiones).
       Devuelve la lista de soluciones (ramas de q1 y codo arriba/abajo)."""
    T0 = np.linalg.solve(Tb, T_obj); p0 = T0[:3,3]; a0 = T0[:3,1]
    sols = []; base = np.arctan2(p0[1], p0[0])
    for th1 in (base, base+np.pi):
        A1 = dhA(th1, DH[0,1], DH[0,2], DH[0,3]); Ti = np.linalg.inv(A1)
        p1 = Ti[:3,:3]@p0 + Ti[:3,3]; a1 = Ti[:3,:3]@a0
        if abs(p1[2]) > 1e-5: continue                      # debe caer en el plano del brazo
        W  = p1[:2] + L3*a1[:2]                             # punto de la muneca
        c3 = (W@W - DH[1,2]**2 - DH[2,2]**2)/(2*DH[1,2]*DH[2,2])
        if abs(c3) > 1.0: continue                          # fuera de alcance
        for s in (1,-1):                                    # codo arriba / codo abajo
            th3 = s*np.arccos(np.clip(c3,-1,1))
            th2 = np.arctan2(W[1],W[0]) - np.arctan2(DH[2,2]*np.sin(th3), DH[1,2]+DH[2,2]*np.cos(th3))
            th4 = np.arctan2(-a1[1],-a1[0]) - th2 - th3 - np.pi/2
            Tp  = Tb@A1@dhA(th2,DH[1,1],DH[1,2],DH[1,3])@dhA(th3,DH[2,1],DH[2,2],DH[2,3])@dhA(th4,DH[3,1],DH[3,2],DH[3,3])
            Rr  = Tp[:3,:3].T @ T_obj[:3,:3] @ np.linalg.inv(Tt[:3,:3])
            th5 = np.arctan2(Rr[1,0], Rr[0,0])
            q = np.array([th1,th2,th3,th4,th5]) - DH[:,0]
            sols.append((q+np.pi) % (2*np.pi) - np.pi)
    return sols

def dentro_de_limites(q):
    return bool(np.all(q>=LIMS[:,0]-1e-9) and np.all(q<=LIMS[:,1]+1e-9))

# ---------------------------------------------------------------- informe
def titulo(t): print('\n'+'='*72+f'\n {t}\n'+'='*72)

def main():
    rng = np.random.default_rng(7)
    np.set_printoptions(precision=6, suppress=True)

    titulo('1. TABLA DENAVIT-HARTENBERG (convencion clasica)')
    print(f"  {'i':>2} {'theta_i':>22} {'d_i (m)':>10} {'a_i (m)':>10} {'alpha_i':>10}   articulacion")
    for i in range(5):
        print(f"  {i+1:>2} {'q%d %+9.4f deg'%(i+1,np.degrees(DH[i,0])):>22} "
              f"{DH[i,1]:10.4f} {DH[i,2]:10.4f} {np.degrees(DH[i,3]):8.1f} deg   {NOM[i]}")

    titulo('2. ESTRUCTURA DE LA CADENA')
    _,Ti = fk(np.zeros(5)); Z=[Ti[i][:3,2] for i in range(5)]
    for i in range(4):
        c = np.linalg.norm(np.cross(Z[i],Z[i+1]))
        print(f"  |z{i+1} x z{i+2}| = {c:.6f}   {'PARALELOS' if c<1e-6 else 'no paralelos'}")
    print("  -> 1 giro vertical + 3 cabeceos paralelos + 1 giro de herramienta")
    print("  -> no existen tres ejes que se corten en un punto: NO hay muneca esferica")

    titulo('3. LA POSICION DEL EFECTOR NO DEPENDE DE q5')
    d=0
    for _ in range(1000):
        q=rng.uniform(LIMS[:,0],LIMS[:,1]); q2=q.copy(); q2[4]=rng.uniform(*LIMS[4])
        d=max(d,np.linalg.norm(fk(q)[0][:3,3]-fk(q2)[0][:3,3]))
    print(f"  variacion maxima de posicion al mover solo q5: {d:.3e} m")
    print(f"  columna 5 del jacobiano, parte lineal: {jacobiano(np.zeros(5))[:3,4]}")

    titulo('4. INDICE DE MANIPULABILIDAD CON JACOBIANO 6x5')
    J0=jacobiano(np.zeros(5))
    print(f"  det(J J^T) = {np.linalg.det(J0@J0.T):.3e}   <- SIEMPRE cero, 6x6 de rango <= 5")
    print(f"  det(J^T J) = {np.linalg.det(J0.T@J0):.6f}   <- el correcto cuando m > n")
    print(f"  w = sqrt(det(J^T J)) = {manipulabilidad(np.zeros(5)):.6f} "
          f"= producto de los valores singulares ({np.prod(np.linalg.svd(J0,compute_uv=False)):.6f})")

    titulo('5. SINGULARIDAD DE CODO')
    q3=np.linspace(LIMS[2,0],LIMS[2,1],2001)
    w=np.array([manipulabilidad(np.array([0,0,x,0,0.0])) for x in q3])
    i=int(np.argmin(w))
    print(f"  minimo de w en q3 = {np.degrees(q3[i]):+.3f} deg   "
          f"(predicho -theta3_off = {-np.degrees(DH[2,0]):+.3f} deg)")
    print(f"  w en la singularidad = {w[i]:.3e}   mediana fuera de ella = {np.median(w):.3e}")
    Js=jacobiano(np.array([0,0,-DH[2,0],0,0.0]))
    print(f"  rango en la singularidad = {np.linalg.matrix_rank(Js,tol=1e-9)}  "
          f"(fuera de ella = {np.linalg.matrix_rank(J0,tol=1e-9)})")
    print(f"  direccion articular que se pierde: {np.linalg.svd(Js)[2][-1].round(4)}")
    print("  -> movimiento coordinado de q2, q3 y q4 que no mueve al efector")

    titulo('6. CINEMATICA INVERSA CERRADA -- PRUEBA DE IDA Y VUELTA')
    N=3000; ok=0; ep=0.0; eR=0.0; ns=0
    for _ in range(N):
        q=rng.uniform(LIMS[:,0],LIMS[:,1]); T,_=fk(q); bien=False
        for qs in ik(T):
            Ts,_=fk(qs)
            e1=np.linalg.norm(Ts[:3,3]-T[:3,3]); e2=np.abs(Ts[:3,:3]-T[:3,:3]).max()
            if e1<1e-8 and e2<1e-6: ep=max(ep,e1); eR=max(eR,e2); bien=True; ns+=1
        ok+=bien
    print(f"  poses resueltas             : {ok}/{N}  ({100*ok/N:.2f} %)")
    print(f"  error de posicion maximo    : {ep:.3e} m")
    print(f"  error de orientacion maximo : {eR:.3e}")
    print(f"  soluciones validas por pose : {ns/N:.2f}")

    titulo('7. POSES SE(3) ARBITRARIAS')
    M=1000; ok2=0
    for _ in range(M):
        q=rng.uniform(LIMS[:,0],LIMS[:,1]); T,_=fk(q)
        A=rng.normal(size=(3,3)); Qr,_=np.linalg.qr(A)
        if np.linalg.det(Qr)<0: Qr[:,0]*=-1
        Tg=np.eye(4); Tg[:3,:3]=Qr; Tg[:3,3]=T[:3,3]
        for qs in ik(Tg):
            Ts,_=fk(qs)
            if np.linalg.norm(Ts[:3,3]-Tg[:3,3])<1e-8 and np.abs(Ts[:3,:3]-Qr).max()<1e-6:
                ok2+=1; break
    print(f"  poses SE(3) arbitrarias resueltas: {ok2}/{M}  ({100*ok2/M:.2f} %)")
    print("  -> la orientacion NO es libre: el eje de la herramienta esta obligado a")
    print("     vivir en el plano vertical que definen el eje de la base y el efector")

    titulo('8. ESPACIO DE TRABAJO')
    # La posicion del efector depende solo de q2, q3 y q4: la primera articulacion
    # gira el plano completo y la quinta no desplaza el efector.  Por eso basta con
    # barrer tres variables, y despues refinar cada extremo para que las cifras no
    # dependan del muestreo.
    n = 61
    g = [np.linspace(LIMS[i,0], LIMS[i,1], n) for i in (1,2,3)]
    G2,G3,G4 = np.meshgrid(*g, indexing='ij')
    Q = np.zeros((G2.size,5)); Q[:,1]=G2.ravel(); Q[:,2]=G3.ravel(); Q[:,3]=G4.ravel()
    P = np.array([fk(q)[0][:3,3] for q in Q])
    r = np.hypot(P[:,0]-EJE_BASE[0], P[:,1]-EJE_BASE[1])
    d = np.linalg.norm(P, axis=1)

    def refina(func, q0, signo):
        """Descenso local simple, sin dependencias externas."""
        x = q0[1:4].copy(); paso = 0.08
        f = lambda v: signo*func(np.array([0.0, v[0], v[1], v[2], 0.0]))
        mejor = f(x)
        while paso > 1e-10:
            avanzo = False
            for k in range(3):
                for s_ in (+1,-1):
                    y = x.copy(); y[k] += s_*paso
                    y = np.clip(y, LIMS[1:4,0], LIMS[1:4,1])
                    v = f(y)
                    if v < mejor: mejor, x, avanzo = v, y, True
            if not avanzo: paso *= 0.5
        return signo*mejor

    fr = lambda q: np.hypot(*(fk(q)[0][:2,3] - EJE_BASE[:2]))
    fz = lambda q: fk(q)[0][2,3]
    fd = lambda q: np.linalg.norm(fk(q)[0][:3,3])
    print(f"  alcance radial maximo desde el eje de la base : {refina(fr, Q[np.argmax(r)], -1)*1000:7.2f} mm")
    print(f"  distancia maxima al origen del modelo          : {refina(fd, Q[np.argmax(d)], -1)*1000:7.2f} mm")
    print(f"  altura maxima sobre el plano de montaje        : {refina(fz, Q[np.argmax(P[:,2])], -1)*1000:7.2f} mm")
    print(f"  altura minima                                  : {refina(fz, Q[np.argmin(P[:,2])], +1)*1000:7.2f} mm")
    print(f"  recorrido angular de la base                   : {np.degrees(LIMS[0,0]):+7.1f} a {np.degrees(LIMS[0,1]):+.1f} grados")

if __name__ == '__main__':
    main()
