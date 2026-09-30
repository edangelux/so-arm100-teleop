#!/usr/bin/env python3
"""Nodo de ROS 2 de SO-ARM100 Estudio, en un proceso aparte del servidor.

El servidor lo arranca con ROS y el workspace cargados, igual que a los ensayos
(que siempre leyeron bien las articulaciones), y conversa con él por texto:

  salida (una línea JSON por mensaje)
    {"t": "listo"}                                   al arrancar
    {"t": "q", "sim": [...]|null, "real": [...]|null, "n": {...}, "d": {...}}   20 veces por segundo
    {"t": "r", "id": N, "ok": true|false, "error": "..."}                      respuesta a una orden
  entrada (una línea JSON por orden, con "id")
    {"op": "trayectoria", "modo": "sim|real|ambos", "puntos": [{"q": [5], "t": s}, ...]}
    {"op": "pinza", "modo": ..., "valor": rad}

Las órdenes llegan por un hilo que sólo las encola; se publican desde un
temporizador del propio nodo, así todo lo de ROS ocurre en un solo hilo.
"""
import json
import queue
import sys
import threading
import time

import rclpy
from builtin_interfaces.msg import Duration, Time
from control_msgs.action import GripperCommand
from rclpy.action import ActionClient
from rclpy.node import Node
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

ART = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
TRAYECTORIAS = {
    'sim': ['/arm_controller/joint_trajectory'],
    'real': ['/real/arm_controller/joint_trajectory'],
    'ambos': ['/arm_controller/joint_trajectory', '/real/arm_controller/joint_trajectory'],
}
PINZAS = {
    'sim': '/gripper_controller/gripper_cmd',
    'real': '/real/gripper_controller/gripper_cmd',
    'ambos': '/mirror_gripper_controller/gripper_cmd',
}


def decir(obj):
    sys.stdout.write(json.dumps(obj) + '\n')
    sys.stdout.flush()


class Puente(Node):
    def __init__(self):
        super().__init__('soarm_estudio')
        self.q = {'sim': None, 'real': None}
        self.t = {'sim': 0.0, 'real': 0.0}
        self.n = {'sim': 0, 'real': 0}
        self.d = {'sim': 0, 'real': 0}
        self.create_subscription(JointState, '/joint_states', self._cb('sim'), 20)
        self.create_subscription(JointState, '/real/joint_states', self._cb('real'), 20)
        # Publicadores y clientes desde el principio: DDS tiene tiempo de enlazarlos.
        self.pubs = {t: self.create_publisher(JointTrajectory, t, 10)
                     for ts in TRAYECTORIAS.values() for t in ts}
        self.pinzas = {n: ActionClient(self, GripperCommand, n) for n in set(PINZAS.values())}
        self.ordenes = queue.Queue()
        self.create_timer(0.05, self._difundir)
        self.create_timer(0.02, self._atender)

    def _cb(self, planta):
        def f(msg):
            self.n[planta] += 1
            idx = {nombre: i for i, nombre in enumerate(msg.name)}
            if not all(a in idx for a in ART) or len(msg.position) < len(msg.name):
                self.d[planta] += 1
                return
            q = [float(msg.position[idx[a]]) for a in ART]
            q.append(float(msg.position[idx['Gripper']]) if 'Gripper' in idx else 0.0)
            self.q[planta], self.t[planta] = q, time.time()
        return f

    def _difundir(self):
        ahora = time.time()
        decir({'t': 'q', 'sim': self.q['sim'] if ahora - self.t['sim'] < 1.0 else None,
               'real': self.q['real'] if ahora - self.t['real'] < 1.0 else None,
               'n': self.n, 'd': self.d})

    def _atender(self):
        while True:
            try:
                o = self.ordenes.get_nowait()
            except queue.Empty:
                return
            try:
                if o['op'] == 'trayectoria':
                    self._trayectoria(o['modo'], o['puntos'])
                elif o['op'] == 'pinza':
                    self._pinza(o['modo'], float(o['valor']))
                else:
                    raise ValueError(f'orden desconocida: {o["op"]}')
                decir({'t': 'r', 'id': o.get('id'), 'ok': True})
            except Exception as e:          # la respuesta lleva el motivo; el nodo sigue vivo
                decir({'t': 'r', 'id': o.get('id'), 'ok': False, 'error': str(e)})

    def _trayectoria(self, modo, puntos):
        msg = JointTrajectory()
        msg.header.stamp = Time(sec=0, nanosec=0)
        msg.joint_names = ART
        for p in puntos:
            jp = JointTrajectoryPoint()
            jp.positions = [float(v) for v in p['q']][:5]
            t = float(p['t'])
            jp.time_from_start = Duration(sec=int(t), nanosec=int((t % 1) * 1e9))
            msg.points.append(jp)
        for topico in TRAYECTORIAS[modo]:
            self.pubs[topico].publish(msg)

    def _pinza(self, modo, valor):
        cliente = self.pinzas[PINZAS[modo]]
        if not cliente.server_is_ready():
            raise RuntimeError(f'La acción {PINZAS[modo]} no responde.')
        meta = GripperCommand.Goal()
        meta.command.position = float(min(max(valor, -0.17), 1.56))
        meta.command.max_effort = 10.0
        cliente.send_goal_async(meta)


def main():
    rclpy.init()
    nodo = Puente()

    def leer():
        for linea in sys.stdin:
            try:
                nodo.ordenes.put(json.loads(linea))
            except ValueError:
                pass
        rclpy.shutdown()                     # el servidor se cerró: este proceso también

    threading.Thread(target=leer, daemon=True).start()
    decir({'t': 'listo'})
    try:
        rclpy.spin(nodo)
    except Exception:
        pass
    finally:
        try:
            nodo.destroy_node()
            if rclpy.ok():
                rclpy.shutdown()
        except Exception:
            pass


if __name__ == '__main__':
    main()
