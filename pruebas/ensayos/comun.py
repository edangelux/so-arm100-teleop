"""Piezas comunes de los ensayos de rendimiento del SO-ARM100 (docs/17).

Los ensayos se ejecutan con el lanzador abierto y la teleoperación cerrada
(Q en la ventana de visión: el brazo queda en init y la terminal muestra el
menú) o en pausa (P). Mandan trayectorias al mismo controlador que usa la
teleoperación y registran, en cada mensaje de estados articulares, la
posición, la velocidad y el esfuerzo de las cinco articulaciones.

El esfuerzo que publica so_arm_100_hardware es la carga del servo STS3215
dividida entre 10: un porcentaje de su par máximo, con signo.
"""
import csv
import datetime
import time
from pathlib import Path

import rclpy
from builtin_interfaces.msg import Duration, Time
from rclpy.node import Node
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

ART = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
# Los límites de teleop_v13.py: ningún ensayo pide lo que la teleoperación no pediría.
LIM = [(-1.91986, 1.91986), (-1.74533, 1.74533), (-1.49, 1.49), (-1.65806, 1.65806), (-2.74, 2.74)]
TOPICOS = {
    'real': ('/real/arm_controller/joint_trajectory', '/real/joint_states'),
    'sim': ('/arm_controller/joint_trajectory', '/joint_states'),
}
REPO = Path(__file__).resolve().parents[2]
NAN = float('nan')


def carpeta_resultados(base=None):
    d = Path(base) if base else REPO / 'pruebas' / 'resultados' / datetime.date.today().isoformat()
    d.mkdir(parents=True, exist_ok=True)
    return d


def recortar(q):
    return [min(max(float(v), lo), hi) for v, (lo, hi) in zip(q, LIM)]


def confirmar(texto, automatico=False):
    print(texto)
    if automatico:
        return True
    try:
        return input('Escriba SI para empezar: ').strip().upper() == 'SI'
    except EOFError:
        return False


class Brazo(Node):
    """Envía trayectorias y registra estados articulares."""

    def __init__(self, modo):
        super().__init__('soarm_ensayo')
        self.modo = modo
        orden, estados = TOPICOS[modo]
        self.pub = self.create_publisher(JointTrajectory, orden, 10)
        self.create_subscription(JointState, estados, self._estado, 50)
        self.q = self.v = self.e = None
        self.objetivo = [NAN] * 5
        self.etiqueta = 'inicio'
        self.grabando = False
        self.muestras = []
        self.t0 = time.monotonic()

    def _estado(self, msg):
        idx = {n: i for i, n in enumerate(msg.name)}
        if not all(n in idx for n in ART):
            return
        leer = lambda arr, n: float(arr[idx[n]]) if len(arr) > idx[n] else NAN
        self.q = [leer(msg.position, n) for n in ART]
        self.v = [leer(msg.velocity, n) for n in ART]
        self.e = [leer(msg.effort, n) for n in ART]
        if self.grabando:
            self.muestras.append((time.monotonic() - self.t0, self.etiqueta,
                                  list(self.objetivo), self.q, self.v, self.e))

    def esperar(self, condicion, limite):
        fin = time.monotonic() + limite
        while time.monotonic() < fin:
            rclpy.spin_once(self, timeout_sec=0.01)
            if condicion():
                return True
        return False

    def pausa(self, segundos):
        self.esperar(lambda: False, segundos)

    def preparar(self):
        if not self.esperar(lambda: self.q is not None, 5.0):
            raise RuntimeError(f'No llegan estados articulares en {TOPICOS[self.modo][1]}. '
                               '¿Está abierto el lanzador en ese modo?')
        if not self.esperar(lambda: self.pub.get_subscription_count() > 0, 3.0):
            raise RuntimeError(f'El controlador no escucha en {TOPICOS[self.modo][0]}.')

    def enviar(self, objetivo, duracion):
        """Envía una trayectoria de un punto. Si el brazo debía moverse y en
        1 s no se movió nada, la reenvía (hasta tres veces), porque un mensaje
        publicado al conectar puede perderse."""
        objetivo = recortar(objetivo)
        inicio = list(self.q)
        msg = JointTrajectory()
        msg.header.stamp = Time(sec=0, nanosec=0)
        msg.joint_names = ART
        p = JointTrajectoryPoint()
        p.positions = objetivo
        p.velocities = [0.0] * 5
        p.time_from_start = Duration(sec=int(duracion), nanosec=int((duracion % 1) * 1e9))
        msg.points = [p]
        self.objetivo = objetivo
        mayor = max(abs(o - q) for o, q in zip(objetivo, inicio))
        for _ in range(3):
            self.pub.publish(msg)
            if mayor < 0.05 or self.esperar(
                    lambda: max(abs(q - q0) for q, q0 in zip(self.q, inicio)) > 0.02,
                    min(1.0, duracion + 0.5)):
                return
        raise RuntimeError('El controlador no respondió a la trayectoria.')

    def ir(self, objetivo, velocidad=0.5, tolerancia=0.10):
        """Movimiento lento: la articulación que más recorre va a `velocidad` rad/s."""
        objetivo = recortar(objetivo)
        duracion = max(1.0, max(abs(o - q) for o, q in zip(objetivo, self.q)) / velocidad)
        self.enviar(objetivo, duracion)
        self.esperar(lambda: max(abs(o - q) for o, q in zip(objetivo, self.q)) <= tolerancia,
                     duracion + 4.0)
        return [o - q for o, q in zip(objetivo, self.q)]

    def sostener(self):
        """Ordena quedarse donde está: se usa al interrumpir un ensayo."""
        if self.q is not None:
            self.enviar(list(self.q), 0.5)

    def guardar(self, ruta, meta):
        with open(ruta, 'w', newline='', encoding='utf-8') as f:
            for k, v in meta.items():
                f.write(f'# {k}: {v}\n')
            w = csv.writer(f)
            w.writerow(['t', 'etiqueta'] + [f'obj_{n}' for n in ART] + [f'pos_{n}' for n in ART]
                       + [f'vel_{n}' for n in ART] + [f'esf_{n}' for n in ART])
            for t, et, o, q, v, e in self.muestras:
                w.writerow([f'{t:.4f}', et] + [f'{x:.5f}' for x in o + q + v]
                           + [f'{x:.2f}' for x in e])
        print(f'Datos guardados en {ruta} ({len(self.muestras)} muestras).')


def ejecutar(modo, cuerpo, ruta, meta):
    """Arranca ROS, ejecuta `cuerpo(brazo)` registrando, y guarda aunque se interrumpa."""
    rclpy.init()
    brazo = Brazo(modo)
    try:
        brazo.preparar()
        brazo.grabando = True
        cuerpo(brazo)
        return 0
    except RuntimeError as error:
        print(f'ERROR: {error}')
        meta['interrumpido'] = str(error)
        return 2
    except KeyboardInterrupt:
        print('\nInterrumpido: el brazo se queda donde está.')
        meta['interrumpido'] = 'sí'
        brazo.sostener()
        return 130
    finally:
        brazo.grabando = False
        if brazo.muestras:
            brazo.guardar(ruta, meta)
        brazo.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()
