# -*- coding: utf-8 -*-
"""Figura de contraste: el mismo brazo dibujado por el Robotics Toolbox de Peter Corke
   y por el renderizador propio, en la misma configuracion.

   El grafico que sale del toolbox por omision es dificil de leer: ejes enormes, el brazo
   diminuto en el centro y flechas de eje de giro que tapan los eslabones.  Aqui se
   reajusta para que sirva como figura de un documento.

   Salida:  figF_toolbox.png
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import warnings
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# El visualizador del Robotics Toolbox llama a plt.show() aunque se dibuje en un
# fichero.  Con el backend no interactivo eso genera avisos que no significan
# nada: la figura se guarda igualmente.  Se silencian para que la salida del
# programa quede limpia.
warnings.filterwarnings('ignore', message='FigureCanvasAgg is non-interactive')

try:
    from toolbox_python import BRAZO
except (ImportError, SystemExit):
    import sys
    print('Esta figura necesita el Robotics Toolbox de Peter Corke.')
    print('Ejecuta primero  python toolbox_python.py  para ver las instrucciones de instalacion.')
    sys.exit(0)
from dh_soarm100 import T_TOOL, fk_dh
from render_robot import escena, Camara, dibuja_solido

Q = np.radians([35.0, -20.0, 45.0, -30.0, 60.0])
AZUL, ROJO, TINTA = '#1f9bd2', '#d21f1f', '#1a1a1a'


def panel_toolbox(q, salida_tmp='_rtb.png'):
    """Dibuja con el toolbox y limpia el resultado para que se lea."""
    BRAZO.plot(q, backend='pyplot', block=False, jointaxes=False, eeframe=True,
               shadow=False, name=False,
               limits=[-0.30, 0.10, -0.42, 0.06, -0.02, 0.30])
    fig = plt.gcf()
    ax = fig.axes[0]
    ax.view_init(elev=22, azim=-58)
    ax.set_box_aspect((0.40, 0.48, 0.32))
    ax.set_xlabel('x (m)', labelpad=2); ax.set_ylabel('y (m)', labelpad=2)
    ax.set_zlabel('z (m)', labelpad=2)
    ax.tick_params(labelsize=8, pad=1)
    ax.grid(True, alpha=0.25)
    for pane in (ax.xaxis, ax.yaxis, ax.zaxis):
        pane.pane.set_facecolor('white'); pane.pane.set_edgecolor('#dddddd')
    # los eslabones que dibuja el toolbox, un poco mas gruesos
    for ln in ax.lines:
        if ln.get_linewidth() > 1.5:
            ln.set_linewidth(4.0); ln.set_color('#c0504d')
    fig.set_size_inches(7.4, 6.2)
    fig.savefig(salida_tmp, dpi=170, facecolor='white', bbox_inches='tight', pad_inches=0.05)
    plt.close(fig)
    return salida_tmp


def figura_F(salida='figF_toolbox.png'):
    tmp = panel_toolbox(Q)
    img = plt.imread(tmp)

    fig, axs = plt.subplots(1, 2, figsize=(16.0, 6.6),
                            gridspec_kw=dict(width_ratios=[1.0, 1.05]))
    axs[0].imshow(img); axs[0].axis('off')
    axs[0].set_title('Robotics Toolbox de Peter Corke\n(modelo construido con la tabla D-H)',
                     fontsize=13, pad=10, color=TINTA)

    cam = Camara((1.0, -1.15, 0.60))
    mn, mx = dibuja_solido(axs[1], escena(Q), cam, base=0.52, rango=0.42)
    c = (mn+mx)/2; r = (mx-mn).max()*0.62
    axs[1].set_xlim(c[0]-r, c[0]+r); axs[1].set_ylim(c[1]-r*0.86, c[1]+r*0.86)
    axs[1].set_aspect('equal'); axs[1].axis('off')
    axs[1].set_title('Renderizador propio\n(mallas reales del modelo descriptivo)',
                     fontsize=13, pad=10, color=TINTA)

    Tt = BRAZO.fkine(Q).A
    Tp = fk_dh(Q, T_TOOL)
    e = np.abs(Tt - Tp).max()
    fig.suptitle(f'La misma configuración  q = ({", ".join(f"{np.degrees(v):+.0f}°" for v in Q)})  '
                 f'en dos implementaciones independientes',
                 fontsize=14.5, y=0.99, color=TINTA)
    fig.text(0.5, 0.015,
             f'Posición del efector según el toolbox: ({Tt[0,3]*1000:.2f}, {Tt[1,3]*1000:.2f}, {Tt[2,3]*1000:.2f}) mm   ·   '
             f'según la implementación propia: ({Tp[0,3]*1000:.2f}, {Tp[1,3]*1000:.2f}, {Tp[2,3]*1000:.2f}) mm   ·   '
             f'diferencia máxima {e:.3e}',
             ha='center', fontsize=11.5, color='#333333')
    fig.subplots_adjust(left=0.01, right=0.99, top=0.88, bottom=0.07, wspace=0.02)
    fig.savefig(salida, dpi=175, facecolor='white', bbox_inches='tight', pad_inches=0.12)
    plt.close(fig)
    import os
    os.remove(tmp)
    print('->', salida)


if __name__ == '__main__':
    figura_F()
