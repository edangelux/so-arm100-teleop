# -*- coding: utf-8 -*-
"""Figuras rediseñadas: un sistema de referencia por panel, para que no se encimen.

   Usa el mismo codigo de color que la figura de asignacion de marcos del equipo:
   X en rojo, Z en azul, la variable articular en morado y las cotas en rojo oscuro.

   Salidas:
     figC_marcos_por_articulacion.png   los cinco marcos, uno por panel
     figD_L.png                          las cotas L1..L5 sobre el modelo
     figE_cadena.png                     de donde sale cada grado de libertad
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch
from matplotlib.lines import Line2D

from render_robot import escena, Camara, dibuja_solido
from dh_soarm100 import GEO, T_TOOL, fk_dh
from cinematica import ejes_y_puntos, fk_urdf

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11})

ROJO  = '#d21f1f'      # eje x
AZUL  = '#1f9bd2'      # eje z
MORA  = '#8e5bd0'      # variable articular
VINO  = '#8c1c24'      # cotas
TINTA = '#1a1a1a'
PUNTO = '#2b4c8c'

O, X, Z = GEO
PUNTA = fk_dh(np.zeros(5), T_TOOL)[:3, 3]
TRIS = escena(np.zeros(5))
ESP = ['Rotación de hombro', 'Cabeceo de hombro', 'Codo', 'Cabeceo de muñeca', 'Giro de muñeca']
ING = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']


def flecha(ax, cam, p0, p1, color, lw=3.0, ms=17, ls='-', z=6):
    a, b = cam(p0)[0], cam(p1)[0]
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle='-|>', mutation_scale=ms, color=color,
                                 lw=lw, linestyle=ls, shrinkA=0, shrinkB=0, zorder=z,
                                 joinstyle='miter', capstyle='butt'))


def etiqueta(ax, cam, p, texto, color, dxy=(0, 0), fs=15, peso='bold', caja=True):
    a = cam(p)[0]
    bb = dict(boxstyle='round,pad=0.22', fc='white', ec=color, lw=1.1, alpha=0.95) if caja else None
    ax.text(a[0]+dxy[0], a[1]+dxy[1], texto, color=color, fontsize=fs, fontweight=peso,
            ha='center', va='center', zorder=12, bbox=bb)


def arco(ax, cam, centro, eje, radio, color=MORA, lw=2.6, a0=-40, a1=150, z=8):
    eje = np.asarray(eje, float); eje = eje/np.linalg.norm(eje)
    tmp = np.array([1.0, 0, 0]) if abs(eje[0]) < 0.9 else np.array([0, 1.0, 0])
    e1 = np.cross(eje, tmp); e1 /= np.linalg.norm(e1); e2 = np.cross(eje, e1)
    t = np.radians(np.linspace(a0, a1, 70))
    P = centro + radio*(np.cos(t)[:, None]*e1 + np.sin(t)[:, None]*e2)
    uv = cam(P)
    ax.plot(uv[:, 0], uv[:, 1], color=color, lw=lw, zorder=z, solid_capstyle='round')
    ax.add_patch(FancyArrowPatch(uv[-2], uv[-1], arrowstyle='-|>', mutation_scale=16,
                                 color=color, lw=lw, shrinkA=0, shrinkB=0, zorder=z))
    return P.mean(0)


CAM_ISO = (1.0, -1.15, 0.60)


def encuadre(ax, mn, mx, m=0.16, dy=0.0, dx=0.0):
    c = (mn+mx)/2; r = (mx-mn).max()*(0.5+m)
    ax.set_xlim(c[0]-r+dx, c[0]+r+dx); ax.set_ylim(c[1]-r*0.92+dy, c[1]+r*0.92+dy)
    ax.set_aspect('equal'); ax.axis('off')


# =====================================================================
def figura_C(salida='figC_marcos_por_articulacion.png'):
    """Un panel por articulacion: solo su marco, sin nada mas encima."""
    cfg = [  # i, largo z, largo x, radio, (a0,a1), desp Z, desp X, desp theta
        (0, 0.070, 0.066, 0.064, (-95,  30), (0.000, -0.028), (-0.024, -0.010), ( 0.022, -0.062)),
        (1, 0.082, 0.070, 0.066, (195, 350), ( 0.022, -0.016), (-0.022,  0.014), (-0.060,  0.026)),
        (2, 0.082, 0.070, 0.064, (195, 350), ( 0.024, -0.018), (-0.006,  0.024), (-0.034,  0.052)),
        (3, 0.082, 0.070, 0.060, (200, 345), ( 0.024, -0.018), (-0.024,  0.012), (-0.026,  0.048)),
        (4, 0.095, 0.052, 0.046, (-80, 110), (-0.012,  0.026), ( 0.024, -0.018), (-0.052, -0.040)),
    ]
    fig, axs = plt.subplots(2, 3, figsize=(17.4, 11.0))
    cam = Camara(CAM_ISO)
    for k, (i, lz, lx, rad, (a0, a1), dz, dx, dth) in enumerate(cfg):
        ax = axs[k//3, k % 3]
        mn, mx = dibuja_solido(ax, TRIS, cam, base=0.68, rango=0.30)   # robot claro, de fondo
        o = O[i]
        flecha(ax, cam, o, o + lz*Z[i], AZUL)
        flecha(ax, cam, o, o + lx*X[i], ROJO)
        p = cam(o)[0]
        ax.plot([p[0]], [p[1]], 'o', ms=13, color=PUNTO, zorder=11)
        ax.plot([p[0]], [p[1]], 'o', ms=5, color='white', zorder=12)
        etiqueta(ax, cam, o + lz*Z[i], f'Z{i}', AZUL, dz)
        etiqueta(ax, cam, o + lx*X[i], f'X{i}', ROJO, dx)
        arco(ax, cam, o, Z[i], rad, a0=a0, a1=a1)
        etiqueta(ax, cam, o, f'$\\theta_{i+1}$', MORA, dth, fs=17)
        encuadre(ax, mn, mx, m=0.12, dy=(-0.055 if i == 0 else 0.0))
        ax.set_title(f'Articulación {i+1} — {ESP[i]}\n$\\theta_{i+1}$ gira alrededor de $Z{i}$',
                     fontsize=13.5, pad=10, color=TINTA)

    # panel 6: resumen
    ax = axs[1, 2]
    mn, mx = dibuja_solido(ax, TRIS, cam, base=0.60, rango=0.36)
    for i in range(5):
        o = O[i]
        flecha(ax, cam, o, o + 0.050*Z[i], AZUL, lw=2.2, ms=12)
        flecha(ax, cam, o, o + 0.042*X[i], ROJO, lw=1.9, ms=11)
        p = cam(o)[0]
        ax.plot([p[0]], [p[1]], 'o', ms=9, color=PUNTO, zorder=11)
    flecha(ax, cam, O[4], PUNTA, '#555555', lw=1.6, ms=11, ls=(0, (4, 3)))
    p = cam(PUNTA)[0]
    ax.plot([p[0]], [p[1]], 'X', ms=13, color=TINTA, zorder=12)
    etiqueta(ax, cam, PUNTA, 'efector', TINTA, (0.006, -0.040), fs=12, peso='normal')
    encuadre(ax, mn, mx)
    ax.set_title('Los cinco sistemas juntos', fontsize=13.5, pad=10, color=TINTA)

    leyenda = [Line2D([], [], color=AZUL, lw=3.0, label='$Z_i$ — eje de giro de la articulación $i+1$'),
               Line2D([], [], color=ROJO, lw=3.0, label='$X_i$ — normal común entre $Z_{i-1}$ y $Z_i$'),
               Line2D([], [], color=MORA, lw=2.6, label='$\\theta_i$ — variable articular, sentido positivo'),
               Line2D([], [], color=PUNTO, lw=0, marker='o', ms=10, label='origen del sistema $O_i$')]
    fig.legend(handles=leyenda, loc='lower center', ncol=4, frameon=False, fontsize=13,
               bbox_to_anchor=(0.5, -0.005))
    fig.subplots_adjust(left=0.01, right=0.99, top=0.94, bottom=0.07, wspace=0.02, hspace=0.12)
    fig.savefig(salida, dpi=190, facecolor='white', bbox_inches='tight', pad_inches=0.12)
    plt.close(fig)
    print('->', salida)


# =====================================================================
def figura_D(salida='figD_L.png'):
    """Las cotas L1..L5 entre articulaciones, como en la figura del equipo."""
    cam = Camara(CAM_ISO)
    fig, ax = plt.subplots(figsize=(13.0, 9.6))
    mn, mx = dibuja_solido(ax, TRIS, cam, base=0.62, rango=0.34)
    z, p = ejes_y_puntos(np.zeros(5))
    P = np.vstack([[0, 0, 0], p, fk_urdf(np.zeros(5))[0][:3, 3]])
    etq = ['$L_1$', '$L_2$', '$L_3$', '$L_4$', '$L_5$', 'herramienta']
    val = [48.12, 106.97, 116.00, 135.00, 60.10, 90.00]
    desp = [(0.046, -0.044), (0.062, -0.004), (0.058, 0.014), (0.006, 0.062), (-0.030, 0.052), (-0.034, -0.052)]
    # la cadena, marcada sobre el modelo
    uv = cam(P)
    ax.plot(uv[:, 0], uv[:, 1], color=VINO, lw=2.6, zorder=7, solid_capstyle='round')
    for i in range(6):
        med = (P[i] + P[i+1])/2
        m2 = cam(med)[0]
        ax.plot([m2[0], m2[0]+desp[i][0]], [m2[1], m2[1]+desp[i][1]], color=VINO, lw=0.9,
                ls=(0, (2.5, 2.5)), zorder=9)
        ax.plot([m2[0]], [m2[1]], 'o', ms=4, color=VINO, zorder=10)
        etiqueta(ax, cam, med, f'{etq[i]} = {val[i]:.2f} mm', VINO, desp[i], fs=12.5, peso='normal')
    for i in range(1, 6):
        q = cam(P[i])[0]
        ax.plot([q[0]], [q[1]], 'o', ms=19, color=PUNTO, zorder=11)
        ax.text(q[0], q[1], f'{i}', color='white', fontsize=11, fontweight='bold',
                ha='center', va='center', zorder=13)
    q = cam(P[0])[0]; ax.plot([q[0]], [q[1]], 's', ms=11, color=TINTA, zorder=11)
    q = cam(P[6])[0]; ax.plot([q[0]], [q[1]], 'X', ms=14, color=TINTA, zorder=11)
    encuadre(ax, mn, mx, m=0.20)
    ax.set_title('Distancias entre articulaciones consecutivas (configuración $q=0$)',
                 fontsize=14, pad=12, color=TINTA)
    ax.text(0.5, -0.02,
            'Las cotas $L$ son distancias entre articulaciones. Los parámetros $a$ de la tabla D-H son distancias '
            'sobre la normal común:\ncoinciden con $L_3$ y $L_4$, pero $L_2$ se reparte en $d_1$ y $a_1$, y $L_5$ '
            'queda absorbida en la extensión de la herramienta.',
            transform=ax.transAxes, ha='center', va='top', fontsize=11.5, color='#444444')
    fig.savefig(salida, dpi=190, facecolor='white', bbox_inches='tight', pad_inches=0.12)
    plt.close(fig)
    print('->', salida)


# =====================================================================
def figura_E(salida='figE_cadena.png'):
    """De donde sale cada grado de libertad: el brazo movido articulacion por articulacion."""
    cam = Camara(CAM_ISO)
    movs = [(0, np.radians(55)), (1, np.radians(-45)), (2, np.radians(60)),
            (3, np.radians(-70)), (4, np.radians(90))]
    fig, axs = plt.subplots(1, 5, figsize=(21.0, 5.2))
    for k, (j, ang) in enumerate(movs):
        ax = axs[k]
        q = np.zeros(5)
        mn, mx = dibuja_solido(ax, escena(q), cam, base=0.84, rango=0.12)   # posicion de partida, palida
        q[j] = ang
        m2, x2 = dibuja_solido(ax, escena(q), cam, base=0.50, rango=0.42)   # posicion girada
        o = O[j]
        flecha(ax, cam, o, o + 0.075*Z[j], AZUL, lw=2.6, ms=14)
        arco(ax, cam, o, Z[j], 0.058, a0=-25, a1=int(np.degrees(abs(ang))) - 25 if ang > 0 else -140)
        pt = cam(o)[0]
        ax.plot([pt[0]], [pt[1]], 'o', ms=11, color=PUNTO, zorder=11)
        encuadre(ax, np.minimum(mn, m2), np.maximum(mx, x2), m=0.10)
        ax.set_title(f'$q_{j+1}$ = {np.degrees(ang):+.0f}°\n{ESP[j]}', fontsize=13, pad=8, color=TINTA)
    fig.suptitle('Los cinco grados de libertad, uno a la vez (en gris claro, la configuración de partida $q=0$)',
                 fontsize=14.5, y=1.02, color=TINTA)
    fig.subplots_adjust(left=0.005, right=0.995, wspace=0.02)
    fig.savefig(salida, dpi=185, facecolor='white', bbox_inches='tight', pad_inches=0.14)
    plt.close(fig)
    print('->', salida)


if __name__ == '__main__':
    figura_C()
    figura_D()
    figura_E()
