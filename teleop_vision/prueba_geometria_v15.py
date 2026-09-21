#!/usr/bin/env python3
"""Prueba sin cámara ni ROS de la geometría de teleop_v15.py.

Construye posturas sintéticas del brazo y de la mano, con puntos exactos, y
comprueba las dos funciones nuevas de la v15:

  segment_confidence  confianza 1 con el brazo paralelo a la imagen, 0 con el
                      brazo apuntando a la cámara, y reducida con poca
                      visibilidad.
  wrist_roll_3d       mide el giro impuesto a la mano, no cambia cuando el
                      brazo baja o barre con la palma quieta, y se compara
                      con el giro 2D de v13 en el caso que peor le va a éste.

Uso: python3 teleop_vision/prueba_geometria_v15.py
Sólo necesita numpy y opencv; ROS y MediaPipe se sustituyen por módulos vacíos.
"""
import sys, types, math, numpy as np
# stubs for ROS / mediapipe imports
for m in ['rclpy','rclpy.node','rclpy.action','trajectory_msgs','trajectory_msgs.msg','std_msgs','std_msgs.msg',
          'builtin_interfaces','builtin_interfaces.msg','control_msgs','control_msgs.action','sensor_msgs','sensor_msgs.msg','mediapipe']:
    mod = types.ModuleType(m); sys.modules[m] = mod
sys.modules['rclpy.node'].Node = object; sys.modules['rclpy.action'].ActionClient = object
for n in ['JointTrajectory','JointTrajectoryPoint']: setattr(sys.modules['trajectory_msgs.msg'], n, object)
sys.modules['std_msgs.msg'].Header = object
sys.modules['builtin_interfaces.msg'].Duration = object; sys.modules['builtin_interfaces.msg'].Time = object
sys.modules['control_msgs.action'].GripperCommand = object; sys.modules['sensor_msgs.msg'].JointState = object
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import teleop_v15 as T

class L:  # landmark
    def __init__(s, p, vis=0.99): s.x, s.y, s.z = p; s.visibility = vis
IDS = T.LM['right']
S = 0.8  # metros -> imagen normalizada (ortográfica), imagen 640x480 con escala igual en x e y
W, H = 640, 480
def build(sh, el, wr, vis=0.99):
    # world (m): x derecha, y abajo, z hacia la cámara negativo
    pts = {IDS['sh']: sh, IDS['osh']: np.array([-0.2, 0, 0]), IDS['hip']: np.array([0.12, 0.5, 0]),
           IDS['ohip']: np.array([-0.12, 0.5, 0]), IDS['el']: el, IDS['wr']: wr}
    wlm = [L((0,0,0))]*33; plm = [L((0,0,0))]*33
    wlm = list(wlm); plm = list(plm)
    for i, p in pts.items():
        wlm[i] = L(p); plm[i] = L((0.5 + p[0]*S*H/W, 0.5 + p[1]*S, 0), vis)
    return wlm, plm
sh = np.array([0.2, 0, 0])
# 1) brazo colgando en el plano de la imagen
wlm, plm = build(sh, sh+[0,0.28,0], sh+[0,0.53,0])
print('plano imagen      c =', [round(c,2) for c in T.segment_confidence(plm, wlm, IDS, W, H)])
# 2) brazo apuntando a la cámara (z negativo), pequeño componente vertical
wlm, plm = build(sh, sh+[0,0.03,-0.28], sh+[0,0.05,-0.53])
print('hacia la cámara   c =', [round(c,2) for c in T.segment_confidence(plm, wlm, IDS, W, H)])
# 3) 45 grados fuera del plano
wlm, plm = build(sh, sh+[0,0.28*math.cos(math.pi/4),-0.28*math.sin(math.pi/4)], sh+[0,0.53*math.cos(math.pi/4),-0.53*math.sin(math.pi/4)])
print('45 grados         c =', [round(c,2) for c in T.segment_confidence(plm, wlm, IDS, W, H)])
# 4) baja visibilidad
wlm, plm = build(sh, sh+[0,0.28,0], sh+[0,0.53,0], vis=0.5)
print('visibilidad 0.5   c =', [round(c,2) for c in T.segment_confidence(plm, wlm, IDS, W, H)])

# giro 3D: antebrazo hacia adelante (-z), nudillos girados un ángulo a alrededor del antebrazo
def hand(fore, ang, base):
    fore = fore/np.linalg.norm(fore)
    b = base - np.dot(base, fore)*fore; b /= np.linalg.norm(b); c = np.cross(fore, b)
    k = math.cos(ang)*b + math.sin(ang)*c
    hw = [L((0,0,0))]*21; hw = list(hw); hw[5] = L(0.04*k); hw[17] = L(-0.04*k); return hw
print('giro 3D, brazo al frente:')
el = sh+[0,0.28,0]; wr = el+[0,0,-0.25]
wlm, plm = build(sh, el, wr)
for a in (0, 30, 60, 90, -45):
    r = T.wrist_roll_3d(wlm, hand(wr-el, math.radians(a), np.array([1.0,0,0])), IDS, 'right')
    print(f'   nudillos a {a:+4d} -> {math.degrees(r):+7.1f}')
print('continuidad al bajar el brazo (nudillos fijos respecto del lateral):')
for t in (0, 30, 60, 85, 90):
    ang = math.radians(t)
    fore = np.array([0, math.sin(ang), -math.cos(ang)])  # de al frente a colgando
    el = sh + fore*0.28; wr = el + fore*0.25
    wlm, plm = build(sh, el, wr)
    r = T.wrist_roll_3d(wlm, hand(fore, 0.0, np.array([1.0,0,0])), IDS, 'right')
    print(f'   brazo a {t:2d} grados bajo la horizontal -> giro {math.degrees(r):+6.1f}')
print('palma hacia abajo mientras el brazo barre de frente a la derecha (debe quedar constante):')
upv = np.array([0,-1.0,0])
for az in (0, 30, 60, 90):
    a = math.radians(az)
    fore = np.array([math.sin(a), 0, -math.cos(a)])
    el = sh + fore*0.28; wr = el + fore*0.25
    wlm, plm = build(sh, el, wr)
    palm_down_knuckles = np.cross(upv, fore)   # línea de nudillos horizontal
    r = T.wrist_roll_3d(wlm, hand(fore, 0.0, palm_down_knuckles), IDS, 'right')
    print(f'   azimut {az:2d} -> giro {math.degrees(r):+6.1f}')
def hand2d(wr, fore, k):
    fore = fore/np.linalg.norm(fore)
    P = lambda p: L((0.5 + p[0]*S*H/W, 0.5 + p[1]*S, 0))
    hl = [L((0,0,0))]*21; hl = list(hl)
    hl[0] = P(wr); hl[9] = P(wr + 0.09*fore); hl[5] = P(wr+0.08*fore+0.04*k); hl[17] = P(wr+0.08*fore-0.04*k)
    return hl
print('comparación 2D (v13) contra 3D (v15), palma abajo, brazo levantándose hacia la cámara (elevación en grados):')
for t in (0, 20, 40, 60):
    a = math.radians(t)
    # brazo extendido hacia la derecha-adelante a 45 de azimut, con elevación t
    fore = np.array([math.sin(math.radians(45))*math.cos(a), -math.sin(a), -math.cos(math.radians(45))*math.cos(a)])
    el = sh + fore*0.28; wr = el + fore*0.25
    wlm, plm = build(sh, el, wr)
    k = np.cross(upv, fore); k/=np.linalg.norm(k)
    r3 = T.wrist_roll_3d(wlm, hand(fore, 0.0, k), IDS, 'right')
    wa = T.wrist_angles_2d(plm, hand2d(wr, fore, k), IDS)
    r2 = wa[1] if wa else float('nan')
    print(f'   elevación {t:2d}: 2D {math.degrees(r2):+7.1f}   3D {math.degrees(r3):+6.1f}')
