"""Node falso: el brazo sigue la última trayectoria con un perfil cúbico."""
# Los atributos llevan el prefijo _sim_ para no chocar con los del nodo que se prueba.
import rclpy

ARTICULACIONES = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']


class _Publicador:
    def __init__(self, nodo):
        self.nodo = nodo

    def publish(self, msg):
        self.nodo._sim_tray = (self.nodo._sim_t, list(self.nodo._sim_q), msg)

    def get_subscription_count(self):
        return 1


class _Marca:
    def __init__(self, t):
        self.sec = int(t)
        self.nanosec = int((t % 1) * 1e9)


class _Cabecera:
    def __init__(self, t):
        self.stamp = _Marca(t)


class _Estado:
    def __init__(self, t, q):
        self.header = _Cabecera(t)
        self.name = list(ARTICULACIONES)
        self.position = list(q)


class Node:
    def __init__(self, nombre):
        self._sim_t = 100.0
        self._sim_q = [0.0] * 5
        self._sim_tray = None
        self._sim_cb = None

    def create_publisher(self, tipo, topico, qos):
        return _Publicador(self)

    def create_subscription(self, tipo, topico, cb, qos):
        self._sim_cb = cb

    def destroy_node(self):
        pass

    def simular(self, dt_pared):
        self._sim_t += dt_pared * rclpy.RTF
        if self._sim_tray and not rclpy.ATASCADO:
            t0, q0, msg = self._sim_tray
            punto = msg.points[0]
            d = punto.time_from_start.sec + punto.time_from_start.nanosec * 1e-9
            s = min(1.0, (self._sim_t - t0) / d)
            s = 3 * s * s - 2 * s ** 3
            self._sim_q = [a + (b - a) * s for a, b in zip(q0, punto.positions)]
        self._sim_cb(_Estado(self._sim_t, self._sim_q))
