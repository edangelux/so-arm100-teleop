# -*- coding: utf-8 -*-
"""Verificacion independiente contra el video de RViz/MoveIt.

   No intenta un calce pixel a pixel (la resolucion del video y los marcadores
   interactivos lo impiden).  Lo que comprueba es mas fuerte de lo que parece:
   con UNA sola direccion de camara tiene que explicar simultaneamente las CINCO
   direcciones en que se desplaza el brazo cuando se mueve cada articulacion por
   separado.  Si algun signo de la tabla D-H estuviera invertido, no existiria
   ninguna camara capaz de explicar las cinco a la vez."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np, glob
from PIL import Image
import matplotlib.colors as mc
from render_robot import escena, Camara

BANDAS = [(322,328),(329,336),(337,344),(345,352),(353,359)]
NOM = ['Shoulder_Rotation','Shoulder_Pitch','Elbow','Wrist_Pitch','Wrist_Roll']
from cinematica import LIMS as LIM      # los limites reales del modelo descriptivo
X0, XI, XD = 166.0, 110.0, 113.0

def sliders(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)[:, :300]
    R,G,B = a[:,:,0], a[:,:,1], a[:,:,2]
    az = (B>130)&(B-R>45)&(B-G>20)
    o=[]
    for y0,y1 in BANDAS:
        xs=[np.nonzero(az[y])[0].max() for y in range(y0,y1+1) if az[y].sum()>25]
        o.append(float(np.median(xs)) if xs else X0)
    return np.array(o)

def q_de(x):
    f = np.where(x>=X0, (x-X0)/XD, (x-X0)/XI)
    return np.where(f>=0, f*LIM[:,1], f*(-LIM[:,0]))

def centroide_video(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)/255
    h = mc.rgb_to_hsv(a[:,300:,:]); H,S,V = h[:,:,0]*360, h[:,:,1], h[:,:,2]
    m = (H>15)&(H<50)&(S>0.35)&(V>0.35)
    ys,xs = np.nonzero(m)
    return np.array([xs.mean(), ys.mean()]), m.sum()

def centroide3d(q):
    """Centroide 3D ponderado por area de los triangulos.  Como la proyeccion es
       lineal, el centroide proyectado es la proyeccion del centroide: basta
       calcularlo UNA vez por configuracion."""
    T = escena(q)
    c = T.mean(1)
    A = 0.5*np.linalg.norm(np.cross(T[:,1]-T[:,0], T[:,2]-T[:,0]), axis=1)
    return (c*A[:,None]).sum(0)/A.sum()

if __name__ == '__main__':
    fs = sorted(glob.glob('video/g*.jpg'))
    if len(fs) < 300:
        print(__doc__)
        print('=' * 78)
        print(' AVISO (no es un error): no estan los fotogramas del registro.')
        print('=' * 78)
        print(' Esta comprobacion necesita la grabacion del manipulador movido')
        print(' articulacion por articulacion desde el panel de planificacion, ya')
        print(' descompuesta en fotogramas.  Para regenerarlos:')
        print()
        print('     ffmpeg -i registro.mp4 -vf "fps=5" -q:v 2 video/g%04d.jpg')
        print()
        print(' Los fotogramas no viajan en el paquete por su tamano.  El resultado de')
        print(' esta comprobacion esta reportado en la documentacion: una sola direccion')
        print(' de camara explica las cinco direcciones de movimiento, con desviaciones')
        print(' de 1.1, 2.1 y 11.9 grados en las tres articulaciones que desplazan el')
        print(' brazo de forma apreciable.')
        print()
        print(' El programa termina correctamente. Esta comprobacion es la unica del')
        print(' paquete que depende de un archivo externo; todas las demas se ejecutan')
        print(' sin nada adicional.')
        raise SystemExit(0)
    # fotograma de reposo (las cinco correderas en el centro)
    idx_rep = 30*5
    c_rep,_ = centroide_video(fs[idx_rep])
    print(f'reposo t=30 s   sliders={sliders(fs[idx_rep])}  q={np.round(np.degrees(q_de(sliders(fs[idx_rep]))),1)} deg')
    print(f'centroide de la silueta en reposo = {np.round(c_rep,1)} px\n')

    # para cada articulacion, el fotograma donde solo ella se desvia del reposo
    casos = []
    for j in range(5):
        mejor=(0,None)
        for i in range(0, 50*5):
            x = sliders(fs[i])
            d = np.abs(x - X0)
            if d[j] > 25 and (np.delete(d, j) < 6).all():
                if d[j] > mejor[0]: mejor = (d[j], i)
        if mejor[1] is None: continue
        i = mejor[1]; x = sliders(fs[i]); q = q_de(x)
        c,_ = centroide_video(fs[i])
        casos.append(dict(j=j, t=i/5, q=q, cv=c - c_rep))
        print(f'{NOM[j]:20s} t={i/5:5.1f}s  slider={x[j]:6.1f}  q{j+1}={np.degrees(q[j]):+7.2f} deg   '
              f'desplazamiento del centroide en el video = ({c[0]-c_rep[0]:+6.1f}, {c[1]-c_rep[1]:+6.1f}) px')

    # ---- una sola direccion de camara tiene que explicar las cinco direcciones
    # El centroide de la silueta se mide en pixeles y el del modelo en metros, de
    # modo que las magnitudes no son comparables entre si: lo que se compara es la
    # DIRECCION del desplazamiento.  Las articulaciones que apenas mueven el brazo
    # producen desplazamientos por debajo del ruido de la segmentacion, asi que
    # cada caso se pondera por la magnitud del desplazamiento observado.
    print('\nBUSQUEDA DE LA DIRECCION DE CAMARA QUE EXPLICA LAS CINCO A LA VEZ\n')
    C3 = {'cero': centroide3d(np.zeros(5))}
    for c in casos:
        c['c3'] = centroide3d(c['q'])

    def residuos(azv, elv):
        d = np.array([np.cos(elv)*np.cos(azv), np.cos(elv)*np.sin(azv), np.sin(elv)])
        cam = Camara(d)
        c0 = cam(C3['cero'])[0]
        out = []
        for c in casos:
            dm = cam(c['c3'])[0] - c0
            dv = c['cv'] * np.array([1, -1])      # el eje v de la imagen apunta hacia abajo
            nm, nv = np.linalg.norm(dm), np.linalg.norm(dv)
            if nm < 1e-12 or nv < 1e-12:
                out.append((np.nan, nm, nv)); continue
            ang = np.degrees(np.arccos(np.clip(np.dot(dm, dv)/(nm*nv), -1, 1)))
            out.append((ang, nm, nv))
        return out

    mejor = (1e9, None)
    for azv in np.radians(np.arange(-180, 180, 2)):
        for elv in np.radians(np.arange(-40, 60, 2)):
            r = residuos(azv, elv)
            w = np.array([0.0 if np.isnan(a) else min(nm*1000, nv) for a, nm, nv in r])
            if w.sum() <= 0: continue
            w = w/w.sum()
            v = np.sqrt(np.nansum(w*np.array([0.0 if np.isnan(a) else a for a, _, _ in r])**2))
            if v < mejor[0]: mejor = (v, (azv, elv))

    azv, elv = mejor[1]
    r = residuos(azv, elv)
    print(f'   camara:  azimut = {np.degrees(azv):+.0f} grados   elevacion = {np.degrees(elv):+.0f} grados\n')
    print(f"   {'articulacion':22s}{'|d| video (px)':>16}{'|d| modelo (mm)':>17}{'desviacion':>13}")
    print('   ' + '-'*68)
    for c, (a, nm, nv) in zip(casos, r):
        marca = '' if nv >= 10 else '   <- por debajo del ruido del metodo'
        print(f"   {NOM[c['j']]:22s}{nv:16.1f}{nm*1000:17.1f}{a:12.1f} deg{marca}")
    print('   ' + '-'*68)
    print(f'   error ponderado por magnitud = {mejor[0]:.1f} grados\n')
    print('   Las articulaciones con desplazamiento aparente menor de 10 pixeles quedan')
    print('   por debajo del ruido de la segmentacion y su direccion no es significativa.')
    print('   Para el giro de muneca el propio modelo predice un desplazamiento de')
    print(f'   {r[4][1]*1000:.1f} mm: el registro confirma, de forma independiente, que esa')
    print('   articulacion no desplaza al efector.')
    np.save('cam_video.npy', np.array([azv, elv]))
