#!/usr/bin/env python3
"""Lleva el brazo a una postura con nombre (init o home) a velocidad baja.

Lo usa scripts/soarm.sh al cerrar la teleoperación (init) y al apagar (home).
Lee la postura actual en el tópico de estados articulares, calcula una
duración que respete la velocidad pedida en la articulación que más debe
moverse, envía una sola trayectoria al controlador y espera a que el brazo
llegue. Si no recibe estados articulares, no mueve nada: sin saber dónde está
el brazo no se puede calcular una duración segura.

Uso:
  python3 scripts/ir_a_pose.py init --topico /arm_controller/joint_trajectory \
      --estados /joint_states [--velocidad 0.5] [--tolerancia 0.08]

Códigos de salida: 0 llegó; 1 se movió pero no llegó dentro del tiempo;
2 no se recibieron estados articulares o el controlador no está escuchando.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import rclpy
from builtin_interfaces.msg import Duration, Time
from rclpy.node import Node
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

ARTICULACIONES = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
# Los mismos límites que usa teleop_v13.py, para no pedir nunca algo que la
# teleoperación tampoco pediría.
LIMITES = [(-1.91986, 1.91986), (-1.74533, 1.74533), (-1.49, 1.49),
           (-1.65806, 1.65806), (-2.74, 2.74)]
POSES = Path(__file__).resolve().with_name('poses_seguras.json')


class IrAPose(Node):
    def __init__(self, topicos, estados):
        super().__init__('soarm_ir_a_pose')
        self.pubs = [self.create_publisher(JointTrajectory, t, 10) for t in topicos]
        self.q = {}
        self.create_subscription(JointState, estados, self._estado, 10)

    def _estado(self, msg):
        for nombre, valor in zip(msg.name, msg.position):
            self.q[nombre] = valor

    def actual(self):
        if all(n in self.q for n in ARTICULACIONES):
            return [self.q[n] for n in ARTICULACIONES]
        return None

    def esperar(self, condicion, limite):
        fin = time.time() + limite
        while time.time() < fin:
            rclpy.spin_once(self, timeout_sec=0.05)
            if condicion():
                return True
        return False


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('pose', help='init, home u otra postura de poses_seguras.json')
    p.add_argument('--topico', action='append', required=True,
                   help='Tópico JointTrajectory del controlador; puede repetirse')
    p.add_argument('--estados', required=True, help='Tópico sensor_msgs/JointState de referencia')
    p.add_argument('--velocidad', type=float, default=0.5, help='rad/s en la articulación más lenta (0.5)')
    p.add_argument('--tolerancia', type=float, default=0.08, help='rad de error aceptado al llegar (0.08)')
    a = p.parse_args()

    poses = json.loads(POSES.read_text(encoding='utf-8'))
    if a.pose not in poses or a.pose.startswith('_'):
        print(f'Postura desconocida: {a.pose}. Disponibles: '
              + ', '.join(k for k in poses if not k.startswith('_')), file=sys.stderr)
        return 2
    objetivo = [min(max(float(v), lo), hi) for v, (lo, hi) in zip(poses[a.pose], LIMITES)]
    if not 0.05 <= a.velocidad <= 2.0:
        print('La velocidad debe estar entre 0.05 y 2.0 rad/s.', file=sys.stderr)
        return 2

    rclpy.init()
    nodo = IrAPose(a.topico, a.estados)
    try:
        if not nodo.esperar(lambda: nodo.actual() is not None, 5.0):
            print(f'No llegaron estados articulares en {a.estados}; no se mueve el brazo.', file=sys.stderr)
            return 2
        if not nodo.esperar(lambda: all(pub.get_subscription_count() > 0 for pub in nodo.pubs), 3.0):
            print('El controlador no escucha en ' + ', '.join(a.topico) + '; no se mueve el brazo.', file=sys.stderr)
            return 2
        inicio = nodo.actual()
        mayor = max(abs(o - q) for o, q in zip(objetivo, inicio))
        duracion = max(1.0, mayor / a.velocidad)
        print(f'Hacia {a.pose}: desplazamiento máximo {mayor:.2f} rad, duración {duracion:.1f} s.', flush=True)

        msg = JointTrajectory()
        msg.header.stamp = Time(sec=0, nanosec=0)   # empezar ya
        msg.joint_names = ARTICULACIONES
        punto = JointTrajectoryPoint()
        punto.positions = objetivo
        punto.velocities = [0.0] * 5
        punto.time_from_start = Duration(sec=int(duracion), nanosec=int((duracion % 1) * 1e9))
        msg.points = [punto]
        for pub in nodo.pubs:
            pub.publish(msg)

        llego = nodo.esperar(
            lambda: max(abs(o - q) for o, q in zip(objetivo, nodo.actual())) <= a.tolerancia,
            duracion + 4.0)
        final = nodo.actual()
        error = max(abs(o - q) for o, q in zip(objetivo, final))
        print(('En ' if llego else 'No se alcanzó ') + f'{a.pose}: error máximo {error:.3f} rad.', flush=True)
        return 0 if llego else 1
    finally:
        nodo.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    sys.exit(main())
