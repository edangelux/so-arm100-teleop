"""Modelo del robot para la vista 3D, leído del mismo URDF que usan Gazebo y MoveIt.

El archivo es un xacro, pero la parte del brazo sólo usa dos sustituciones
(${prefix} y ${meshes_file_directory}); basta con reemplazarlas para leerlo
como URDF. Así la aplicación no necesita ROS para dibujar el robot, y lo que
se ve es exactamente la geometría con la que trabajan la simulación y la
cinemática del proyecto.
"""
import re
import xml.etree.ElementTree as ET

from .rutas import POSES, URDF

# Articulaciones que mueve el usuario, en el orden de todo el proyecto.
ARTICULACIONES = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll', 'Gripper']
# Límites de teleop_v13.py (más conservadores que los del URDF): la aplicación
# nunca pide lo que la teleoperación tampoco pediría.
LIMITES_SEGUROS = {
    'Shoulder_Rotation': (-1.91986, 1.91986), 'Shoulder_Pitch': (-1.74533, 1.74533),
    'Elbow': (-1.49, 1.49), 'Wrist_Pitch': (-1.65806, 1.65806), 'Wrist_Roll': (-2.74, 2.74),
    'Gripper': (-0.17, 1.56),
}
NOMBRES = {
    'Shoulder_Rotation': 'Giro de la base', 'Shoulder_Pitch': 'Hombro', 'Elbow': 'Codo',
    'Wrist_Pitch': 'Flexión de muñeca', 'Wrist_Roll': 'Giro de muñeca', 'Gripper': 'Pinza',
}


def _vec(texto, defecto='0 0 0'):
    return [float(v) for v in (texto or defecto).split()]


def cargar_modelo():
    s = URDF.read_text(encoding='utf-8')
    s = s.replace('${prefix}', '').replace('${meshes_file_directory}', 'mallas')
    s = re.sub(r'xmlns:xacro="[^"]*"', '', s)
    s = re.sub(r'</?xacro:[^>]*>', '', s)
    raiz = ET.fromstring(s)
    eslabones = {}
    for l in raiz.iter('link'):
        visual = l.find('visual')
        malla = None
        if visual is not None:
            g = visual.find('geometry/mesh')
            o = visual.find('origin')
            c = visual.find('material/color')
            if g is not None:
                malla = {
                    'archivo': g.get('filename').split('/')[-1],
                    'xyz': _vec(o.get('xyz') if o is not None else None),
                    'rpy': _vec(o.get('rpy') if o is not None else None),
                    'color': _vec(c.get('rgba'), '1 1 1 1') if c is not None else [1, 1, 1, 1],
                }
        masa = l.find('inertial/mass')
        eslabones[l.get('name')] = {'malla': malla, 'masa': float(masa.get('value')) if masa is not None else 0.0}
    juntas = []
    for j in raiz.iter('joint'):
        o, a, lim = j.find('origin'), j.find('axis'), j.find('limit')
        nombre = j.get('name')
        juntas.append({
            'nombre': nombre,
            'tipo': j.get('type'),
            'padre': j.find('parent').get('link'),
            'hijo': j.find('child').get('link'),
            'xyz': _vec(o.get('xyz') if o is not None else None),
            'rpy': _vec(o.get('rpy') if o is not None else None),
            'eje': _vec(a.get('xyz')) if a is not None else None,
            'limite_urdf': [float(lim.get('lower')), float(lim.get('upper'))] if lim is not None else None,
            'limite': list(LIMITES_SEGUROS[nombre]) if nombre in LIMITES_SEGUROS else None,
            'etiqueta': NOMBRES.get(nombre, nombre),
        })
    import json
    poses = {k: v for k, v in json.loads(POSES.read_text(encoding='utf-8')).items() if not k.startswith('_')}
    return {'raiz': 'base_link', 'eslabones': eslabones, 'juntas': juntas,
            'articulaciones': ARTICULACIONES, 'poses': poses}
