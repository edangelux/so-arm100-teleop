"""Conexión con ROS 2, opcional.

Si rclpy está disponible (la aplicación se abrió con ROS cargado), el puente
lee la postura de la simulación y del brazo físico y puede enviarles
trayectorias y órdenes de pinza. Si no lo está, la aplicación funciona en
modo aprendizaje con su propio modelo del robot.
"""
import threading
import time

from .eventos import difusor

ART = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
LIM = [(-1.91986, 1.91986), (-1.74533, 1.74533), (-1.49, 1.49), (-1.65806, 1.65806), (-2.74, 2.74)]
TOPICOS = {
    'sim': (['/arm_controller/joint_trajectory'], '/gripper_controller/gripper_cmd'),
    'real': (['/real/arm_controller/joint_trajectory'], '/real/gripper_controller/gripper_cmd'),
    'ambos': (['/arm_controller/joint_trajectory', '/real/arm_controller/joint_trajectory'],
              '/mirror_gripper_controller/gripper_cmd'),
}


class Puente:
    def __init__(self):
        self.disponible = False
        self.motivo = ''
        self.q = {'sim': None, 'real': None}
        self.t = {'sim': 0.0, 'real': 0.0}
        try:
            import rclpy  # noqa: F401  (sólo comprueba que exista)
        except Exception as e:           # sin ROS: modo aprendizaje
            self.motivo = f'ROS 2 no está cargado ({e.__class__.__name__}).'
            return
        try:
            self._arrancar()
            self.disponible = True
        except Exception as e:
            self.motivo = f'No se pudo iniciar el nodo de ROS: {e}'

    def _arrancar(self):
        import rclpy
        from rclpy.node import Node
        from sensor_msgs.msg import JointState
        from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
        from builtin_interfaces.msg import Duration, Time
        from control_msgs.action import GripperCommand
        from rclpy.action import ActionClient
        self._tipos = (JointTrajectory, JointTrajectoryPoint, Duration, Time, GripperCommand)
        rclpy.init()
        self.nodo = Node('soarm_estudio')
        self._pubs = {}
        self._pinzas = {}
        self._ActionClient = ActionClient

        def cb(planta):
            def f(msg):
                idx = {n: i for i, n in enumerate(msg.name)}
                if all(n in idx for n in ART):
                    q = [float(msg.position[idx[n]]) for n in ART]
                    q.append(float(msg.position[idx['Gripper']]) if 'Gripper' in idx else 0.0)
                    self.q[planta], self.t[planta] = q, time.time()
            return f

        self.nodo.create_subscription(JointState, '/joint_states', cb('sim'), 20)
        self.nodo.create_subscription(JointState, '/real/joint_states', cb('real'), 20)
        threading.Thread(target=rclpy.spin, args=(self.nodo,), daemon=True).start()
        threading.Thread(target=self._difundir, daemon=True).start()

    def _difundir(self):
        while True:
            ahora = time.time()
            datos = {p: (self.q[p] if ahora - self.t[p] < 1.0 else None) for p in ('sim', 'real')}
            if any(datos.values()):
                difusor.publicar('articulaciones', datos)
            time.sleep(0.05)

    def estado(self):
        ahora = time.time()
        return {'disponible': self.disponible, 'motivo': self.motivo,
                'sim': ahora - self.t['sim'] < 1.0, 'real': ahora - self.t['real'] < 1.0}

    def mover(self, modo, objetivo, velocidad=0.5):
        if not self.disponible:
            raise RuntimeError('ROS no está disponible.')
        JointTrajectory, JointTrajectoryPoint, Duration, Time, _ = self._tipos
        objetivo = [min(max(float(v), lo), hi) for v, (lo, hi) in zip(objetivo, LIM)]
        ref = self.q['real'] if modo in ('real', 'ambos') else self.q['sim']
        if ref is None:
            raise RuntimeError('No llegan estados articulares de esa planta.')
        mayor = max(abs(o - q) for o, q in zip(objetivo, ref[:5]))
        duracion = max(1.0, mayor / max(0.05, min(float(velocidad), 1.5)))
        msg = JointTrajectory()
        msg.header.stamp = Time(sec=0, nanosec=0)
        msg.joint_names = ART
        p = JointTrajectoryPoint()
        p.positions = objetivo
        p.velocities = [0.0] * 5
        p.time_from_start = Duration(sec=int(duracion), nanosec=int((duracion % 1) * 1e9))
        msg.points = [p]
        for topico in TOPICOS[modo][0]:
            if topico not in self._pubs:
                self._pubs[topico] = self.nodo.create_publisher(JointTrajectory, topico, 10)
                time.sleep(0.3)          # deja que DDS enlace antes del primer mensaje
            self._pubs[topico].publish(msg)
        return round(duracion, 2)

    def pinza(self, modo, valor):
        if not self.disponible:
            raise RuntimeError('ROS no está disponible.')
        GripperCommand = self._tipos[4]
        nombre = TOPICOS[modo][1]
        if nombre not in self._pinzas:
            self._pinzas[nombre] = self._ActionClient(self.nodo, GripperCommand, nombre)
        cliente = self._pinzas[nombre]
        if not cliente.wait_for_server(timeout_sec=2.0):
            raise RuntimeError(f'La acción {nombre} no responde.')
        meta = GripperCommand.Goal()
        meta.command.position = float(min(max(valor, -0.17), 1.56))
        meta.command.max_effort = 10.0
        cliente.send_goal_async(meta)


puente = None


def iniciar():
    global puente
    puente = Puente()
    return puente
