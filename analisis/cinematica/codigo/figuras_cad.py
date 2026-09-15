# -*- coding: utf-8 -*-
"""Figuras del capitulo de analisis cinematico dibujadas sobre el modelo real del
   SO-ARM100: las mallas que declara el URDF, colocadas con la cinematica directa,
   y encima los sistemas de referencia D-H obtenidos en dh.py.

   Salidas:  figA_marcos_dh.png    isometrica: marcos de referencia y grados de libertad
             figB_dimensiones.png  lateral: parametros geometricos acotados
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import FancyArrowPatch

from render_robot import (escena, Camara, dibuja_solido, flecha, rotulo,
                          arco_giro, NEGRO, GRIS)
from dh_soarm100 import GEO, T_TOOL, fk_dh

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10})

Z_COL = '#0b3a5c'      # eje z : eje de giro de la articulacion
X_COL = '#8c2f28'      # eje x : normal comun
Q_COL = '#3f3f3f'      # arcos de giro

O, X, Z = GEO
PUNTA = fk_dh(np.zeros(5), T_TOOL)[:3, 3]
TRIS = escena(np.zeros(5))


# ------------------------------------------------------------------ utilidades 2D
def cota2(ax, a, b, texto, txy=None, fs=10, color=NEGRO, lw=1.25, ext=None):
    """Cota entre dos puntos YA proyectados (coordenadas del eje)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle='<|-|>', mutation_scale=9,
                                 color=color, lw=lw, shrinkA=0, shrinkB=0, zorder=7))
    if ext is not None:
        for p, q_ in ext:
            ax.plot([p[0], q_[0]], [p[1], q_[1]], color=color, lw=0.7,
                    ls=(0, (2.5, 2.5)), zorder=6)
    m = (a + b) / 2 if txy is None else np.asarray(txy, float)
    ax.text(m[0], m[1], texto, color=color, fontsize=fs, ha='center', va='center',
            zorder=9, bbox=dict(boxstyle='round,pad=0.20', fc='white', ec=color, lw=0.7))


def marca_eje_saliente(ax, p, r=0.0062, color=Z_COL, z=9):
    """Simbolo de eje perpendicular al papel."""
    ax.plot([p[0]], [p[1]], 'o', ms=9.5, mfc='white', mec=color, mew=1.9, zorder=z)
    ax.plot([p[0]], [p[1]], 'o', ms=3.0, color=color, zorder=z + 1)


# =====================================================================
# FIGURA A — marcos de referencia D-H sobre el modelo isometrico
# =====================================================================
def figura_A(salida='figA_marcos_dh.png'):
    cam = Camara((1.0, -1.15, 0.60))
    fig, ax = plt.subplots(figsize=(11.2, 8.2))
    mn, mx = dibuja_solido(ax, TRIS, cam, base=0.44, rango=0.47)

    cfg = [
        # i, largo z, largo x, rot Z, rot X, radio arco, (a0,a1), rot theta
        (0, 0.062, 0.052, (0.000, -0.019), (-0.015, -0.007), 0.056, (-95,  25), (0.013, -0.050)),
        (1, 0.058, 0.052, (0.013, -0.011), (-0.014,  0.009), 0.050, (200, 350), (-0.041, 0.018)),
        (2, 0.058, 0.052, (0.015, -0.013), (-0.004,  0.015), 0.048, (200, 350), (-0.022, 0.036)),
        (3, 0.050, 0.044, (0.015, -0.012), (-0.016,  0.006), 0.038, (215, 330), (-0.014, 0.032)),
        (4, 0.066, 0.028, (-0.008, 0.017), (0.016,  -0.012), 0.030, (-75, 105), (-0.036, -0.030)),
    ]
    for i, lz, lx, dz, dx, rad, (a0, a1), dth in cfg:
        o = O[i]
        flecha(ax, cam, o, o + lz * Z[i], Z_COL, lw=2.4, ms=13)
        flecha(ax, cam, o, o + lx * X[i], X_COL, lw=2.0, ms=12)
        p = cam(o)[0]
        ax.plot([p[0]], [p[1]], 'o', ms=6.5, mfc='white', mec=NEGRO, mew=1.4, zorder=9)
        rotulo(ax, cam, o + lz * Z[i], f'Z{i}', Z_COL, dxy=dz, fs=12)
        rotulo(ax, cam, o + lx * X[i], f'X{i}', X_COL, dxy=dx, fs=12)
        arco_giro(ax, cam, o, Z[i], rad, color=Q_COL, lw=1.7, a0=a0, a1=a1)
        rotulo(ax, cam, o, f'$\\theta_{i+1}$', Q_COL, dxy=dth, fs=13)

    flecha(ax, cam, O[4], PUNTA, GRIS, lw=1.4, ms=10, ls=(0, (4, 3)))
    p = cam(PUNTA)[0]
    ax.plot([p[0]], [p[1]], 'X', ms=9, color=NEGRO, zorder=9)
    rotulo(ax, cam, PUNTA, 'punto del efector', NEGRO, dxy=(0.004, -0.030), fs=10, peso='normal')

    c = (mn + mx) / 2
    r = (mx - mn).max() * 0.64
    ax.set_xlim(c[0] - r, c[0] + r); ax.set_ylim(c[1] - r * 0.80, c[1] + r * 0.80)
    ax.set_aspect('equal'); ax.axis('off')

    leyenda = [
        Line2D([], [], color=Z_COL, lw=2.4, label='$z_i$ — eje de giro de la articulación $i+1$'),
        Line2D([], [], color=X_COL, lw=2.0, label='$x_i$ — normal común entre $z_{i-1}$ y $z_i$'),
        Line2D([], [], color=Q_COL, lw=1.7, label='$\\theta_i$ — variable articular, sentido positivo'),
        Line2D([], [], color=GRIS, lw=1.4, ls=(0, (4, 3)), label='herramienta, 150.1 mm sobre $z_4$'),
    ]
    ax.legend(handles=leyenda, loc='lower left', frameon=True, fontsize=9.5,
              framealpha=0.95, edgecolor='#cfcfcf', borderpad=0.7,
              bbox_to_anchor=(-0.01, -0.01))
    fig.savefig(salida, dpi=220, bbox_inches='tight', facecolor='white', pad_inches=0.08)
    plt.close(fig)
    print('->', salida)


# =====================================================================
# FIGURA B — parametros geometricos acotados sobre la vista lateral
# =====================================================================
def figura_B(salida='figB_dimensiones.png'):
    cam = Camara((1.0, 0.0, 0.0))                  # mirada a lo largo de +x: plano del brazo
    fig, ax = plt.subplots(figsize=(11.4, 7.0))
    dibuja_solido(ax, TRIS, cam, base=0.60, rango=0.36)

    P = {k: cam(v)[0] for k, v in
         dict(O0=O[0], O1=O[1], O2=O[2], O3=O[3], punta=PUNTA).items()}
    O1d = cam(O[0] - 0.1025 * Z[0])[0]              # origen del marco 1 sobre el eje z0

    # ---- esqueleto cinematico sobre el render
    cad = np.array([P['O0'], O1d, P['O1'], P['O2'], P['O3'], P['punta']])
    ax.plot(cad[:, 0], cad[:, 1], color=NEGRO, lw=1.7, zorder=7, solid_capstyle='round')

    # ---- eje vertical de la base (theta 1)
    ax.plot([P['O0'][0]] * 2, [-0.035, 0.300], color=Z_COL, lw=1.4,
            ls=(0, (8, 3, 1.5, 3)), zorder=5)
    ax.text(P['O0'][0], -0.052, 'eje $z_0$  —  $\\theta_1$', color=Z_COL, fontsize=10.5,
            ha='center', va='center', zorder=9)
    # ---- eje de giro de la herramienta (theta 5)
    ax.plot([-0.455, -0.205], [P['O3'][1]] * 2, color=Z_COL, lw=1.4,
            ls=(0, (8, 3, 1.5, 3)), zorder=5)
    ax.text(-0.462, P['O3'][1], 'eje $z_4$\n$\\theta_5$', color=Z_COL, fontsize=10.5,
            ha='right', va='center', zorder=9)

    # ---- los tres cabeceos: ejes perpendiculares al papel
    for k in ('O1', 'O2', 'O3'):
        marca_eje_saliente(ax, P[k])
    marca_eje_saliente(ax, P['O0'], color=NEGRO)
    ax.plot([P['punta'][0]], [P['punta'][1]], 'X', ms=10, color=NEGRO, zorder=10)

    # ---- cotas
    cota2(ax, [-0.035, P['O1'][1]], [-0.035, P['O2'][1]], '$a_2$ = 116.0 mm',
          ext=[(P['O1'], [-0.035, P['O1'][1]]), (P['O2'], [-0.035, P['O2'][1]])])
    cota2(ax, [P['O2'][0], 0.288], [P['O3'][0], 0.288], '$a_3$ = 135.0 mm',
          ext=[(P['O2'], [P['O2'][0], 0.288]), (P['O3'], [P['O3'][0], 0.288])])
    cota2(ax, [P['O3'][0], 0.183], [P['punta'][0], 0.183], 'herramienta = 150.1 mm',
          ext=[(P['O3'], [P['O3'][0], 0.183]), (P['punta'], [P['punta'][0], 0.183])])
    cota2(ax, [0.082, P['O0'][1]], [0.082, O1d[1]], '$d_1$ = 102.5 mm',
          ext=[(P['O0'], [0.082, P['O0'][1]]), (O1d, [0.082, O1d[1]])])
    cota2(ax, O1d, P['O1'], '$a_1$ = 30.6 mm', txy=(-0.010, O1d[1] - 0.021))

    for k, txt, d in (('O0', '$O_0$', (0.026, -0.016)), ('O1', '$O_1$', (-0.030, 0.021)),
                      ('O2', '$O_2$', (0.020, -0.020)), ('O3', '$O_3\\equiv O_4$', (0.004, -0.028))):
        ax.text(P[k][0] + d[0], P[k][1] + d[1], txt, color=NEGRO, fontsize=11.5,
                ha='center', va='center', zorder=10,
                bbox=dict(boxstyle='round,pad=0.12', fc='white', ec='none', alpha=0.8))

    ax.set_xlim(-0.520, 0.140); ax.set_ylim(-0.085, 0.330)
    ax.set_aspect('equal'); ax.axis('off')
    leyenda = [
        Line2D([], [], color=NEGRO, lw=1.7, label='cadena cinemática $O_0\\!-\\!O_1\\!-\\!O_2\\!-\\!O_3$ — efector'),
        Line2D([], [], color=Z_COL, lw=0, marker='o', ms=9.5, mfc='white', mew=1.9,
               label='eje de cabeceo, perpendicular al plano del dibujo'),
        Line2D([], [], color=Z_COL, lw=1.4, ls=(0, (8, 3, 1.5, 3)), label='eje de giro contenido en el plano'),
    ]
    ax.legend(handles=leyenda, loc='lower left', frameon=True, fontsize=9.5,
              framealpha=0.95, edgecolor='#cfcfcf', borderpad=0.7)
    fig.savefig(salida, dpi=220, bbox_inches='tight', facecolor='white', pad_inches=0.08)
    plt.close(fig)
    print('->', salida)


if __name__ == '__main__':
    figura_A()
    figura_B()
