# -*- coding: utf-8 -*-
"""Render del SO-ARM100 a partir de sus propias mallas STL (las que declara el URDF),
   con los sistemas de referencia de Denavit-Hartenberg dibujados encima.

   El render NO es una ilustracion: cada pieza se coloca con la transformada que
   produce la cinematica directa del URDF, y los marcos se dibujan en los origenes
   que devuelve la extraccion automatica de parametros D-H (dh.py)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np, struct, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from matplotlib.patches import FancyArrowPatch, Arc

from cinematica import marcos_de_eslabon, fk_urdf, ejes_y_puntos, CAD
from dh_soarm100 import FILAS, T_BASE, T_TOOL, GEO, fk_dh

DIR = os.path.dirname(os.path.abspath(__file__))
MALLAS = ['Base', 'Shoulder_Rotation_Pitch', 'Upper_Arm', 'Lower_Arm',
          'Wrist_Pitch_Roll', 'Fixed_Gripper', 'Moving_Jaw']

# ------------------------------------------------------------------ mallas
def leer_stl(path):
    with open(path, 'rb') as f:
        cab = f.read(84)
        n = struct.unpack('<I', cab[80:84])[0]
        buf = f.read(n * 50)
    a = np.frombuffer(buf, dtype=np.uint8).reshape(n, 50)
    return a[:, 12:48].copy().view('<f4').reshape(n, 3, 3).astype(np.float64)

_CACHE = {}
def malla(nombre):
    if nombre not in _CACHE:
        _CACHE[nombre] = leer_stl(os.path.join(DIR, 'meshes', nombre + '.STL'))
    return _CACHE[nombre]

def escena(q, q_pinza=0.0):
    """Triangulos de todo el robot en el marco de la base, para la configuracion q."""
    M = marcos_de_eslabon(q)
    tris = []
    for n in MALLAS:
        T = M[n]
        V = malla(n)
        tris.append(V @ T[:3, :3].T + T[:3, 3])
    return np.concatenate(tris, 0)

# ------------------------------------------------------------------ camara
class Camara:
    """Proyeccion ortografica: la usan por igual las mallas y las anotaciones."""
    def __init__(self, direccion, arriba=(0, 0, 1)):
        f = np.asarray(direccion, float); f = f / np.linalg.norm(f)   # escena -> camara
        u = np.asarray(arriba, float)
        r = np.cross(u, f); r /= np.linalg.norm(r)
        u = np.cross(f, r)
        self.f, self.r, self.u = f, r, u
    def __call__(self, P):
        P = np.atleast_2d(np.asarray(P, float))
        return np.column_stack([P @ self.r, P @ self.u])
    def prof(self, P):
        return np.atleast_2d(np.asarray(P, float)) @ self.f

def dibuja_solido(ax, tris, cam, luz=(0.4, -0.7, 0.75), base=0.62, rango=0.36, borde=None):
    """Pintor: culling de caras traseras, orden por profundidad y sombreado plano en gris."""
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ln = np.linalg.norm(n, axis=1); ok = ln > 1e-12
    tris, n, ln = tris[ok], n[ok], ln[ok]
    n = n / ln[:, None]
    visible = (n @ cam.f) > 0
    tris, n = tris[visible], n[visible]
    l = np.asarray(luz, float); l /= np.linalg.norm(l)
    inten = base + rango * np.clip(n @ l, 0, 1)
    z = cam.prof(tris.reshape(-1, 3)).reshape(-1, 3).mean(1)
    orden = np.argsort(z)[::-1]                       # lejano primero
    tris, inten = tris[orden], inten[orden]
    poly = cam(tris.reshape(-1, 3)).reshape(-1, 3, 2)
    col = np.repeat(inten[:, None], 3, axis=1)
    pc = PolyCollection(poly, facecolors=col, edgecolors='none',
                        linewidths=0, antialiased=False, zorder=2)
    if borde is not None:
        pc.set_edgecolors(borde); pc.set_linewidths(0.05)
    ax.add_collection(pc)
    uv = poly.reshape(-1, 2)
    return uv.min(0), uv.max(0)

# ------------------------------------------------------------------ anotaciones
NEGRO = '#111111'
AZUL  = '#0b4f8a'     # eje z  (eje de giro de la articulacion)
ROJO  = '#9e2a2b'     # eje x  (normal comun)
GRIS  = '#5a5a5a'

def flecha(ax, cam, p0, p1, color, lw=2.0, ms=9, ls='-', z=6):
    a, b = cam(p0)[0], cam(p1)[0]
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle='-|>', mutation_scale=ms,
                                 color=color, lw=lw, linestyle=ls,
                                 shrinkA=0, shrinkB=0, zorder=z,
                                 joinstyle='miter', capstyle='butt'))

def rotulo(ax, cam, p, texto, color, dxy=(0, 0), fs=11, peso='bold'):
    a = cam(p)[0]
    ax.text(a[0] + dxy[0], a[1] + dxy[1], texto, color=color, fontsize=fs,
            fontweight=peso, ha='center', va='center', zorder=8,
            bbox=dict(boxstyle='round,pad=0.12', fc='white', ec='none', alpha=0.78))

def arco_giro(ax, cam, centro, eje, radio, color=GRIS, lw=1.6, a0=-50, a1=150, z=7):
    """Arco con punta de flecha que indica el sentido positivo de giro alrededor de 'eje'."""
    eje = np.asarray(eje, float); eje = eje / np.linalg.norm(eje)
    tmp = np.array([1.0, 0, 0]) if abs(eje[0]) < 0.9 else np.array([0, 1.0, 0])
    e1 = np.cross(eje, tmp); e1 /= np.linalg.norm(e1)
    e2 = np.cross(eje, e1)
    t = np.radians(np.linspace(a0, a1, 60))
    P = centro + radio * (np.cos(t)[:, None] * e1 + np.sin(t)[:, None] * e2)
    uv = cam(P)
    ax.plot(uv[:, 0], uv[:, 1], color=color, lw=lw, zorder=z, solid_capstyle='round')
    ax.add_patch(FancyArrowPatch(uv[-2], uv[-1], arrowstyle='-|>', mutation_scale=11,
                                 color=color, lw=lw, shrinkA=0, shrinkB=0, zorder=z))
    return P

def cota(ax, cam, p0, p1, texto, desp, color=NEGRO, lw=1.3, fs=10):
    """Cota de longitud entre dos puntos, desplazada 'desp' (vector 3D)."""
    d = np.asarray(desp, float)
    a, b = np.asarray(p0) + d, np.asarray(p1) + d
    ua, ub = cam(a)[0], cam(b)[0]
    ax.annotate('', ua, ub, arrowprops=dict(arrowstyle='<|-|>', color=color, lw=lw,
                                            mutation_scale=9, shrinkA=0, shrinkB=0), zorder=7)
    for p, q_ in ((p0, a), (p1, b)):
        s = cam(np.array([p, q_]))
        ax.plot(s[:, 0], s[:, 1], color=color, lw=0.7, ls=(0, (3, 3)), zorder=6)
    m = (ua + ub) / 2
    ax.text(m[0], m[1], texto, color=color, fontsize=fs, ha='center', va='center',
            zorder=8, bbox=dict(boxstyle='round,pad=0.18', fc='white', ec=color, lw=0.6))
