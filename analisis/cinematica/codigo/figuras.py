# -*- coding: utf-8 -*-
"""Figuras del analisis cinematico del SO-ARM100.
   Pensadas para imprimirse en blanco y negro (GMCE-24): toda serie lleva
   codificacion secundaria por trazo/marcador, y los mapas usan rampa de un solo tono."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from vec import fk_batch, jac_batch, w_batch, LIMS
from dh_soarm100 import FILAS, T_BASE, T_TOOL, A_dh
from cinematica import CAD

plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.linewidth':0.8,
    'axes.edgecolor':'#5a5f66','axes.labelcolor':'#22262b','text.color':'#22262b',
    'xtick.color':'#5a5f66','ytick.color':'#5a5f66','xtick.labelsize':8,'ytick.labelsize':8,
    'axes.grid':True,'grid.color':'#dfe3e8','grid.linewidth':0.6,'axes.axisbelow':True,
    'figure.facecolor':'white','axes.facecolor':'white','legend.frameon':False,
    'legend.fontsize':8,'axes.titlesize':10,'axes.titleweight':'bold','savefig.dpi':200})

# rampa secuencial de un solo tono (segura en escala de grises)
AZUL = LinearSegmentedColormap.from_list('azul',['#f3f6fa','#c3d3e6','#7fa2c9','#40699e','#1c3f6e','#0d2340'])
SERIE = ['#1c3f6e','#2f7d4f','#8a5a1c','#7a3b6e','#8a3d3d']
TRAZO = ['-','--','-.',(0,(4,1.4,1,1.4)),(0,(1.2,1.2))]
MARCA = ['o','s','^','D','v']
OFF = np.array([f['theta_off'] for f in FILAS])

# ---------------------------------------------------------------- figura 1
def fig_marcos():
    """Panel A: el plano del brazo (cadena 3R). Panel B: q1 elige el plano."""
    A2, A3 = FILAS[1]['a'], FILAS[2]['a']; L3 = -T_TOOL[2,3]
    q = np.array([0.0,-0.35,0.75,-0.55,0.0])
    T,Z,O = fk_batch(q[None,:]); T=T[0]; Z=Z[0]; O=O[0]
    base = np.array([0,-0.0452,0.0165])
    pts = np.vstack([base, O, T[:3,3]])
    fig = plt.figure(figsize=(11,4.8))
    gs = fig.add_gridspec(1,2,width_ratios=[1.25,1])

    # ---------------- panel A: plano del brazo (Y-Z) ----------------
    ax = fig.add_subplot(gs[0,0])
    ax.plot(pts[:,1],pts[:,2],'-',color='#c8d0d9',lw=7,solid_capstyle='round',zorder=1)
    ax.plot(pts[:,1],pts[:,2],'-',color='#22262b',lw=1.5,zorder=2)
    # ejes de los tres cabeceos: perpendiculares al plano -> simbolo de salida
    for k in (1,2,3):
        ax.plot(O[k,1],O[k,2],'o',color='white',ms=13,mec=SERIE[k],mew=1.6,zorder=4)
        ax.plot(O[k,1],O[k,2],'.',color=SERIE[k],ms=4,zorder=5)
    # eje 1: vertical, dentro del plano
    ax.plot(O[0,1],O[0,2],MARCA[0],color=SERIE[0],ms=9,mec='white',mew=1.2,zorder=4)
    ax.annotate('',xy=(O[0,1],O[0,2]-0.07),xytext=(O[0,1],O[0,2]),
                arrowprops=dict(arrowstyle='-|>',color=SERIE[0],lw=1.6),zorder=3)
    # eje 5: sobre la herramienta, dentro del plano
    a = T[:3,1]*0.075
    ax.plot(O[4,1],O[4,2],MARCA[4],color=SERIE[4],ms=9,mec='white',mew=1.2,zorder=4)
    ax.annotate('',xy=(T[:3,3][1]+a[1],T[:3,3][2]+a[2]),xytext=(T[:3,3][1],T[:3,3][2]),
                arrowprops=dict(arrowstyle='-|>',color=SERIE[4],lw=1.8),zorder=5)
    ax.plot(T[:3,3][1],T[:3,3][2],'*',color='#22262b',ms=14,zorder=6)
    et = [('$q_1$ base',0,(-0.052,0.006)),('$q_2$ hombro',1,(-0.060,0.010)),
          ('$q_3$ codo',2,(-0.030,-0.030)),('$q_4$ muñeca',3,(0.008,-0.030)),('$q_5$ giro',4,(-0.030,0.020))]
    for txt,k,(dx,dy) in et:
        ax.annotate(txt,xy=(O[k,1],O[k,2]),xytext=(O[k,1]+dx,O[k,2]+dy),fontsize=8.5,
                    color=SERIE[k],fontweight='bold')
    def cota(p,q_,txt,off):
        m=(p+q_)/2
        ax.annotate('',xy=(q_[0],q_[1]),xytext=(p[0],p[1]),
                    arrowprops=dict(arrowstyle='<|-|>',color='#5a5f66',lw=0.9,shrinkA=0,shrinkB=0))
        ax.text(m[0]+off[0],m[1]+off[1],txt,fontsize=8,color='#5a5f66',ha='center')
    cota(O[1,[1,2]],O[2,[1,2]],f'$a_2$ = {A2*1000:.1f} mm',(-0.03,0.0))
    cota(O[2,[1,2]],O[3,[1,2]],f'$a_3$ = {A3*1000:.1f} mm',(0.0,0.022))
    cota(O[4,[1,2]],T[:3,3][[1,2]],f'{L3*1000:.1f} mm',(0.028,0.0))
    ax.set_xlabel('Y (m)'); ax.set_ylabel('Z (m)'); ax.set_aspect('equal')
    ax.margins(0.22)
    ax.set_title('A. Plano del brazo: cadena 3R plana más giro de herramienta',loc='left',pad=10)
    ax.text(0.02,0.03,'o con punto = eje perpendicular al plano\n(los tres cabeceos son paralelos entre si)',
            transform=ax.transAxes,fontsize=7.5,color='#5a5f66')

    # ---------------- panel B: vista superior, q1 elige el plano ----------------
    ax = fig.add_subplot(gs[0,1])
    for i,q1v in enumerate((-1.2,-0.6,0.0,0.6,1.2)):
        qq=q.copy(); qq[0]=q1v
        Tb,_,Ob = fk_batch(qq[None,:]); Tb=Tb[0]; Ob=Ob[0]
        P=np.vstack([base,Ob,Tb[:3,3]])
        gris = '#22262b' if abs(q1v)<1e-9 else '#aab3bd'
        lw = 1.7 if abs(q1v)<1e-9 else 1.0
        ax.plot(P[:,0],P[:,1],'-',color=gris,lw=lw,zorder=3 if abs(q1v)<1e-9 else 2)
        ax.plot(Tb[0,3] if False else Tb[:3,3][0],Tb[:3,3][1],'*' if abs(q1v)<1e-9 else 'o',
                color=gris,ms=13 if abs(q1v)<1e-9 else 4,zorder=4)
    th=np.linspace(0,2*np.pi,400)
    ax.plot(base[0]+0.4316*np.cos(th),base[1]+0.4316*np.sin(th),'--',color='#8a3d3d',lw=1.1)
    ax.text(base[0],base[1]-0.4316-0.03,'alcance radial máximo 431.6 mm',
            color='#8a3d3d',fontsize=8,ha='center')
    ax.plot(base[0],base[1],MARCA[0],color=SERIE[0],ms=9,mec='white',mew=1.2,zorder=5)
    ax.set_xlabel('X (m)'); ax.set_ylabel('Y (m)'); ax.set_aspect('equal')
    ax.margins(0.10)
    ax.set_title('B. $q_1$ gira el plano completo alrededor del eje de la base',loc='left',pad=10)
    fig.suptitle('Cadena cinemática del SO-ARM100: de dónde salen los cinco grados de libertad',
                 fontsize=11.5,fontweight='bold',x=0.008,ha='left')
    fig.tight_layout(rect=[0,0,1,0.93]); fig.savefig('fig1_marcos.png',bbox_inches='tight'); plt.close(fig)


# ---------------------------------------------------------------- datos
def _datos():
    """Genera los muestreos que necesitan las figuras si aun no existen en disco.
    De este modo el programa corre en una carpeta recien descomprimida, sin
    depender de archivos intermedios que no viajan en el paquete."""
    import os
    from cinematica import LIMS
    from vec import fk_batch, jac_batch, w_batch
    if not os.path.exists('workspace.npz'):
        print('generando workspace.npz (unos segundos)...', flush=True)
        rng = np.random.default_rng(23)
        Q = rng.uniform(LIMS[:, 0], LIMS[:, 1], size=(300000, 5))
        P = fk_batch(Q)[0][:, :3, 3]
        EJE = np.array([0.0, -0.0452, 0.0165])
        np.savez_compressed('workspace.npz',
                            r=np.hypot(P[:, 0] - EJE[0], P[:, 1] - EJE[1]),
                            h=P[:, 2], p=P)
    if not os.path.exists('mapas.npz'):
        print('generando mapas.npz (unos segundos)...', flush=True)
        n = 241
        q2 = np.linspace(LIMS[1, 0], LIMS[1, 1], n)
        q3 = np.linspace(LIMS[2, 0], LIMS[2, 1], n)
        G2, G3 = np.meshgrid(q2, q3, indexing='ij')
        Q = np.zeros((G2.size, 5)); Q[:, 1] = G2.ravel(); Q[:, 2] = G3.ravel()
        W2 = w_batch(jac_batch(Q))[0].reshape(n, n)
        np.savez_compressed('mapas.npz', q2=q2, q3=q3, W2=W2)

# ---------------------------------------------------------------- figura 2
def fig_workspace():
    d=np.load('workspace.npz'); r,h,p = d['r'],d['h'],d['p']
    fig,axs=plt.subplots(1,2,figsize=(10.5,4.4))
    ax=axs[0]
    hb=ax.hexbin(r*1000,h*1000,gridsize=64,cmap=AZUL,mincnt=1,linewidths=0)
    ax.set_xlabel('radio desde el eje de la base (mm)'); ax.set_ylabel('altura (mm)')
    ax.set_title('Sección meridiana del espacio alcanzable',loc='left'); ax.set_aspect('equal')
    cb=fig.colorbar(hb,ax=ax,pad=0.02); cb.set_label('densidad de muestras',fontsize=8); cb.outline.set_visible(False)
    ax.annotate(f'alcance radial máximo\n{r.max()*1000:.0f} mm',xy=(r.max()*1000,h[np.argmax(r)]*1000),
                xytext=(r.max()*1000-150,h.min()*1000+70),fontsize=8,color='#22262b',
                arrowprops=dict(arrowstyle='-',color='#5a5f66',lw=0.8))
    ax=axs[1]
    ax.scatter(p[:,0]*1000,p[:,1]*1000,s=0.6,c='#40699e',alpha=0.10,linewidths=0)
    ax.set_xlabel('X (mm)'); ax.set_ylabel('Y (mm)'); ax.set_aspect('equal')
    ax.set_title('Proyección horizontal: sólido de revolución',loc='left')
    fig.suptitle('Espacio de trabajo alcanzable, obtenido del modelo URDF real',
                 fontsize=11,fontweight='bold',x=0.008,ha='left')
    fig.tight_layout(rect=[0,0,1,0.94]); fig.savefig('fig2_workspace.png',bbox_inches='tight'); plt.close(fig)

# ---------------------------------------------------------------- figura 3
def fig_mapa():
    m=np.load('mapas.npz'); q2,q3,W2 = m['q2'],m['q3'],m['W2']
    fig,ax=plt.subplots(figsize=(7.2,4.8))
    im=ax.pcolormesh(np.degrees(q3),np.degrees(q2),W2,cmap=AZUL,shading='auto')
    cs=ax.contour(np.degrees(q3),np.degrees(q2),W2,levels=[1e-4,5e-4,1.5e-3,3e-3],
                  colors='#22262b',linewidths=0.7,alpha=0.55)
    ax.clabel(cs,fmt='%.0e',fontsize=7)
    ax.axvline(np.degrees(-OFF[2]),color='#8a3d3d',lw=1.6,ls='--')
    ax.text(np.degrees(-OFF[2])+1.5,ax.get_ylim()[1]-8,
            f'singularidad de codo\n$q_3 = {np.degrees(-OFF[2]):.2f}°$',color='#8a3d3d',fontsize=8,va='top')
    ax.set_xlabel('$q_3$  codo (grados)'); ax.set_ylabel('$q_2$  cabeceo de hombro (grados)')
    cb=fig.colorbar(im,ax=ax,pad=0.02); cb.set_label('$w=\\sqrt{\\det(J^{T}J)}$',fontsize=9); cb.outline.set_visible(False)
    ax.set_title('Índice de manipulabilidad en el plano $q_2$–$q_3$',loc='left')
    fig.tight_layout(); fig.savefig('fig3_manipulabilidad.png',bbox_inches='tight'); plt.close(fig)

# ---------------------------------------------------------------- figura 4
def fig_singular():
    q3=np.linspace(LIMS[2,0],LIMS[2,1],1200); Q=np.zeros((len(q3),5)); Q[:,2]=q3
    w,s=w_batch(jac_batch(Q))
    fig,axs=plt.subplots(1,2,figsize=(10.5,4.0))
    ax=axs[0]
    for k in range(5):
        ax.plot(np.degrees(q3),s[:,k],linestyle=TRAZO[k],color=SERIE[k],lw=1.6,label=f'$\\sigma_{k+1}$')
    ax.set_yscale('log'); ax.set_xlabel('$q_3$ (grados)'); ax.set_ylabel('valor singular')
    ax.set_title('Valores singulares del jacobiano',loc='left'); ax.legend(ncol=5,loc='lower left')
    ax.axvline(np.degrees(-OFF[2]),color='#8a3d3d',lw=1.2,ls='--')
    ax=axs[1]
    ax.plot(np.degrees(q3),w,'-',color='#1c3f6e',lw=1.8)
    ax.set_yscale('log'); ax.set_xlabel('$q_3$ (grados)'); ax.set_ylabel('$w=\\sqrt{\\det(J^{T}J)}$')
    ax.axvline(np.degrees(-OFF[2]),color='#8a3d3d',lw=1.2,ls='--')
    ax.annotate(f'brazo extendido\n$q_3={np.degrees(-OFF[2]):.2f}°$\nrango 5 → 4',
                xy=(np.degrees(-OFF[2]),w.min()*3),xytext=(-40,w.max()*0.02),fontsize=8,color='#8a3d3d',
                arrowprops=dict(arrowstyle='-|>',color='#8a3d3d',lw=1))
    ax.set_title('Pérdida de rango en la única singularidad interna',loc='left')
    fig.suptitle('La cadena pierde un grado de libertad cuando los eslabones $a_2$ y $a_3$ se alinean',
                 fontsize=11,fontweight='bold',x=0.008,ha='left')
    fig.tight_layout(rect=[0,0,1,0.93]); fig.savefig('fig4_singularidad.png',bbox_inches='tight'); plt.close(fig)

if __name__=='__main__':
    _datos()
    fig_marcos(); fig_workspace(); fig_mapa(); fig_singular()
    print('figuras 1 a 4 generadas')
