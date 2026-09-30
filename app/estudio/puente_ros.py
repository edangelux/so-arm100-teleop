"""Conexión con ROS 2, opcional.

El nodo de ROS no corre dentro del servidor: corre en un proceso aparte
(nodo_puente.py), arrancado con ROS y el workspace cargados, igual que los
ensayos. Así el servidor HTTP y sus hilos no comparten nada con rclpy, y si el
nodo se cae o deja de recibir datos, se reinicia solo sin reiniciar la
aplicación.

Este módulo conserva la misma interfaz de antes (estado, mover, trayectoria,
parar, pinza, cerrar) y hace aquí las comprobaciones de límites y velocidades,
antes de enviar nada al nodo.
"""
import json
import os
import subprocess
import threading
import time
from collections import deque
from pathlib import Path

from .eventos import difusor

ART = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
LIM = [(-1.91986, 1.91986), (-1.74533, 1.74533), (-1.49, 1.49), (-1.65806, 1.65806), (-2.74, 2.74)]
NODO = Path(__file__).resolve().with_name('nodo_puente.py')
CARGA_ROS = ('source /opt/ros/humble/setup.bash >/dev/null 2>&1; '
             '[ -f "$HOME/ros2_ws_entrega/install/setup.bash" ] && source "$HOME/ros2_ws_entrega/install/setup.bash" >/dev/null 2>&1; '
             'exec python3 -u "$0"')
REGISTRO = Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local' / 'state')) / 'soarm' / 'nodo_ros.log'
SIN_DATOS = 8.0          # s sin articulaciones con una sesión abierta antes de reiniciar el nodo
ENTRE_REINICIOS = 20.0   # s mínimos entre dos reinicios


class Puente:
    def __init__(self, arrancar=True):
        self.disponible = False
        self.motivo = 'Arrancando el nodo de ROS…'
        self.q = {'sim': None, 'real': None}
        self.t = {'sim': 0.0, 'real': 0.0}
        self.mensajes = {'sim': 0, 'real': 0}
        self.descartados = {'sim': 0, 'real': 0}
        self._proc = None
        self._id = 0
        self._esperas = {}
        self._cerrojo = threading.Lock()
        self._errores = deque(maxlen=8)
        self._ultimo_arranque = 0.0
        self._fallos_seguidos = 0
        self._cerrado = False
        if arrancar:
            threading.Thread(target=self._vigilar, daemon=True).start()

    @classmethod
    def desactivado(cls, motivo):
        p = cls(arrancar=False)
        p.motivo = motivo
        return p

    # ------------------------------------------------------------ proceso del nodo
    def _arrancar(self):
        self._ultimo_arranque = time.time()
        self._errores.clear()
        self.disponible = False
        self.motivo = 'Arrancando el nodo de ROS…'
        proc = subprocess.Popen(['bash', '-c', CARGA_ROS, str(NODO)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True, errors='replace', bufsize=1, start_new_session=True)
        self._proc = proc
        threading.Thread(target=self._leer, args=(proc,), daemon=True).start()
        threading.Thread(target=self._leer_errores, args=(proc,), daemon=True).start()

    def _detener(self):
        proc, self._proc = self._proc, None
        self.disponible = False
        if proc and proc.poll() is None:
            try:
                proc.stdin.close()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()

    def reiniciar(self, motivo='Reiniciando el nodo de ROS…'):
        self._detener()
        self.motivo = motivo

    def _vigilar(self):
        while not self._cerrado:
            if self._proc is None or self._proc.poll() is not None:
                espera = 3.0 if self._fallos_seguidos < 3 else 30.0
                if time.time() - self._ultimo_arranque >= espera:
                    try:
                        self._arrancar()
                    except OSError as e:
                        self.motivo = f'No se pudo arrancar el nodo de ROS: {e}'
            time.sleep(1.0)

    def _leer(self, proc):
        for linea in proc.stdout:
            try:
                m = json.loads(linea)
            except ValueError:
                continue
            tipo = m.get('t')
            if tipo == 'q':
                ahora = time.time()
                for p in ('sim', 'real'):
                    if m.get(p) is not None:
                        self.q[p], self.t[p] = m[p], ahora
                self.mensajes.update(m.get('n', {}))
                self.descartados.update(m.get('d', {}))
                datos = {p: m.get(p) for p in ('sim', 'real')}
                if any(datos.values()):
                    difusor.publicar('articulaciones', datos)
            elif tipo == 'listo':
                self.disponible, self.motivo = True, ''
                self._fallos_seguidos = 0
            elif tipo == 'r':
                with self._cerrojo:
                    espera = self._esperas.get(m.get('id'))
                if espera:
                    espera['r'] = m
                    espera['ev'].set()
        # El proceso terminó (o se detuvo para reiniciarlo).
        if proc is self._proc:
            self.disponible = False
            if time.time() - self._ultimo_arranque < 10:
                self._fallos_seguidos += 1
            time.sleep(0.2)                 # deja llegar las últimas líneas de error
            detalle = ' '.join(self._errores)
            if 'ModuleNotFoundError' in detalle or 'No module named' in detalle:
                self.motivo = 'ROS 2 no está instalado o no se pudo cargar.'
            else:
                self.motivo = 'El nodo de ROS se cerró' + (f': {detalle[-200:]}' if detalle else '.')

    def _leer_errores(self, proc):
        # Lo que el nodo escribe en stderr queda también en ~/.local/state/soarm/nodo_ros.log.
        try:
            REGISTRO.parent.mkdir(parents=True, exist_ok=True)
            grande = REGISTRO.exists() and REGISTRO.stat().st_size > 1_000_000
            registro = open(REGISTRO, 'w' if grande else 'a', encoding='utf-8')
            registro.write(f'--- nodo arrancado {time.strftime("%Y-%m-%d %H:%M:%S")}\n')
            registro.flush()
        except OSError:
            registro = None
        for linea in proc.stderr:
            linea = linea.strip()
            if linea:
                self._errores.append(linea)
                if registro:
                    registro.write(linea + '\n')
                    registro.flush()
        if registro:
            registro.close()

    def _orden(self, obj, espera=3.0):
        proc = self._proc
        if not self.disponible or not proc:
            raise RuntimeError('ROS no está disponible: ' + (self.motivo or 'el nodo no responde.'))
        with self._cerrojo:
            self._id += 1
            obj['id'] = self._id
            ev = {'ev': threading.Event(), 'r': None}
            self._esperas[self._id] = ev
        try:
            proc.stdin.write(json.dumps(obj) + '\n')
            proc.stdin.flush()
            if not ev['ev'].wait(espera):
                raise RuntimeError('El nodo de ROS no respondió a la orden.')
            if not ev['r'].get('ok'):
                raise RuntimeError(ev['r'].get('error') or 'La orden falló.')
        except (BrokenPipeError, OSError, ValueError):
            raise RuntimeError('El nodo de ROS se cerró; se reinicia solo en unos segundos.')
        finally:
            with self._cerrojo:
                self._esperas.pop(obj['id'], None)

    # ------------------------------------------------------------ estado
    def estado(self):
        ahora = time.time()
        return {'disponible': self.disponible, 'motivo': self.motivo,
                'sim': ahora - self.t['sim'] < 1.0, 'real': ahora - self.t['real'] < 1.0,
                'mensajes': dict(self.mensajes), 'descartados': dict(self.descartados)}

    def vigilar_datos(self, modo):
        """Con una sesión abierta, si no llegan articulaciones de la planta que se
        opera durante SIN_DATOS segundos, reinicia el nodo (como mucho cada 20 s)."""
        if self._cerrado or not self.disponible or modo not in ('sim', 'real', 'ambos'):
            return
        planta = 'sim' if modo == 'sim' else 'real'
        ahora = time.time()
        if ahora - self.t[planta] > SIN_DATOS and ahora - self._ultimo_arranque > ENTRE_REINICIOS:
            self.reiniciar('No llegaban las articulaciones: reiniciando el nodo de ROS…')

    def _referencia(self, modo, reconectar=True):
        """Postura medida de la planta que se opera. Si no llegan datos, reinicia el
        nodo una vez (un nodo de larga vida puede quedar sin enlace de DDS, por
        ejemplo tras suspender el equipo) y espera hasta 10 s a que vuelvan."""
        planta = 'real' if modo in ('real', 'ambos') else 'sim'
        fresco = lambda: self.disponible and self.q[planta] is not None and time.time() - self.t[planta] <= 1.0
        if fresco():
            return self.q[planta]
        if not reconectar:
            raise RuntimeError('No llegan estados articulares de esa planta.')
        if time.time() - self._ultimo_arranque > 5:
            self.reiniciar('No llegaban las articulaciones: reconectando con ROS…')
        limite = time.time() + 10
        while time.time() < limite:
            if fresco():
                return self.q[planta]
            time.sleep(0.2)
        topico = '/joint_states' if planta == 'sim' else '/real/joint_states'
        nombre = 'Gazebo' if planta == 'sim' else 'el brazo'
        n, d = self.mensajes.get(planta, 0), self.descartados.get(planta, 0)
        raise RuntimeError(f'No llegan estados articulares de {nombre} ({topico}). El nodo de la aplicación se reconectó y recibió '
                           f'{n} mensajes ({d} descartados por incompletos). Compruebe en una terminal: ros2 topic hz {topico}. '
                           f'Si ahí llegan, ejecute soarm-app --parar y soarm-app; si no, la sesión no está publicando (vea su registro).')

    # ------------------------------------------------------------ órdenes
    def mover(self, modo, objetivo, velocidad=0.5):
        ref = self._referencia(modo)
        objetivo = [min(max(float(v), lo), hi) for v, (lo, hi) in zip(objetivo, LIM)]
        mayor = max(abs(o - q) for o, q in zip(objetivo, ref[:5]))
        duracion = max(1.0, mayor / max(0.05, min(float(velocidad), 1.5)))
        self._orden({'op': 'trayectoria', 'modo': modo, 'puntos': [{'q': objetivo, 't': duracion}]})
        return round(duracion, 2)

    def trayectoria(self, modo, puntos):
        """Trayectoria de varios puntos [{'q': [5 rad], 't': s desde el inicio}], ya
        planificada por la aplicación (programas con MoveJ, MoveL y MoveC). Se
        comprueban límites, orden de los tiempos y velocidad entre puntos."""
        ref = self._referencia(modo)
        if not puntos or len(puntos) > 5000:
            raise RuntimeError('La trayectoria debe tener entre 1 y 5000 puntos.')
        limpios = []
        previo_q, previo_t = ref[:5], 0.0
        for p in puntos:
            q = [float(v) for v in p['q']][:5]
            t = float(p['t'])
            if len(q) != 5 or t <= previo_t:
                raise RuntimeError('Trayectoria mal formada: cada punto lleva 5 ángulos y un tiempo creciente.')
            for v, (lo, hi) in zip(q, LIM):
                if not lo - 1e-3 <= v <= hi + 1e-3:
                    raise RuntimeError('Un punto de la trayectoria sale de los límites de las articulaciones.')
            salto = max(abs(a - b) for a, b in zip(q, previo_q))
            vel = salto / (t - previo_t)
            # El primer punto se compara con la postura medida, que difiere un poco de la
            # planificada (error de seguimiento del servo o de Gazebo): una corrección de
            # hasta 0,05 rad se acepta aunque el primer punto llegue a los 20 ms.
            if not limpios and salto <= 0.05:
                vel = 0.0
            if vel > 1.6:          # el planificador de Programar usa 1,5 rad/s; margen numérico
                raise RuntimeError(f'La trayectoria pide {vel:.1f} rad/s en una articulación; el máximo es 1,5 rad/s.')
            limpios.append({'q': q, 't': t})
            previo_q, previo_t = q, t
        self._orden({'op': 'trayectoria', 'modo': modo, 'puntos': limpios})
        return round(previo_t, 2)

    def parar(self, modo):
        """Detiene el movimiento en curso: nueva trayectoria que se queda donde está."""
        try:
            ref = self._referencia(modo, reconectar=False)
            self._orden({'op': 'trayectoria', 'modo': modo, 'puntos': [{'q': ref[:5], 't': 0.2}]})
        except RuntimeError:
            pass

    def pinza(self, modo, valor):
        self._orden({'op': 'pinza', 'modo': modo, 'valor': float(valor)})

    def cerrar(self):
        self._cerrado = True
        self._detener()


puente = None


def iniciar():
    global puente
    puente = Puente()
    return puente
