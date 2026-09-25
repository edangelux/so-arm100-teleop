"""Procesos que la aplicación arranca: la sesión del lanzador y las tareas cortas.

La sesión ejecuta scripts/soarm.sh exactamente como en la terminal y lee su
salida para saber en qué estado está. El menú de cierre del lanzador (Enter,
h, x) se contesta escribiendo en su entrada estándar, de modo que la
aplicación y la terminal siguen un único camino de código.
"""
import collections
import os
import re
import signal
import subprocess
import threading
import time

from .eventos import difusor
from .rutas import REPO


class Sesion:
    ESTADOS = ('detenida', 'arrancando', 'teleop', 'menu', 'moviendo', 'cerrando')

    def __init__(self):
        self.proc = None
        self.estado = 'detenida'
        self.modo = None
        self.version = None
        self.registros = None
        self.log = collections.deque(maxlen=800)
        self._cerrojo = threading.Lock()

    def resumen(self):
        return {'estado': self.estado, 'modo': self.modo, 'version': self.version,
                'registros': self.registros, 'log': list(self.log)[-200:]}

    def _estado(self, nuevo):
        if nuevo != self.estado:
            self.estado = nuevo
            difusor.publicar('sesion', self.resumen() | {'log': []})

    def _linea(self, linea):
        self.log.append(linea)
        difusor.publicar('log', {'fuente': 'sesion', 'linea': linea})
        m = re.search(r'Registros: (\S+)', linea)
        if m:
            self.registros = m.group(1)
        if re.search(r'Teleoperación v\d+ iniciada', linea):
            self._estado('teleop')
        elif 'Llevando el brazo a init' in linea:
            self._estado('moviendo')
        elif '[Enter] reabrir' in linea:
            self._estado('menu')
        elif 'Procesos de esta sesión cerrados' in linea:
            self._estado('cerrando')

    def iniciar(self, modo, opciones):
        with self._cerrojo:
            if self.proc and self.proc.poll() is None:
                raise RuntimeError('Ya hay una sesión abierta.')
            orden = ['bash', str(REPO / 'scripts' / 'soarm.sh'), modo] + opciones
            self.log.clear()
            self.modo = modo
            v = [o for o in opciones if re.fullmatch(r'--v1[45]', o)]
            self.version = v[0][3:] if v else '13'
            self.registros = None
            self._linea('→ ' + ' '.join(orden[1:]))
            entorno = dict(os.environ, PYTHONUNBUFFERED='1')
            self.proc = subprocess.Popen(orden, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.STDOUT, text=True, bufsize=1,
                                         start_new_session=True, env=entorno, cwd=str(REPO))
            self._estado('arrancando')
            threading.Thread(target=self._leer, args=(self.proc,), daemon=True).start()

    def _leer(self, proc):
        for linea in proc.stdout:
            self._linea(linea.rstrip('\n'))
        codigo = proc.wait()
        self._linea(f'[sesión terminada con código {codigo}]')
        self._estado('detenida')

    def menu(self, accion):
        teclas = {'reabrir': '\n', 'home': 'h\n', 'apagar': 'x\n'}
        if self.estado != 'menu' or not self.proc:
            raise RuntimeError('El lanzador no está esperando en su menú.')
        self.proc.stdin.write(teclas[accion])
        self.proc.stdin.flush()
        self._estado('arrancando' if accion == 'reabrir' else 'cerrando')

    def cerrar_teleop(self):
        """Equivale a pulsar Q en la ventana de la cámara: SIGINT al programa de visión."""
        r = subprocess.run(['pkill', '-INT', '-f', 'teleop_vision/ejecutar_v1'], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError('No hay una teleoperación abierta.')

    def detener(self):
        """Equivale a Ctrl+C: apaga en el acto, sin mover el brazo."""
        if self.proc and self.proc.poll() is None:
            os.killpg(self.proc.pid, signal.SIGINT)
            self._estado('cerrando')


class Tarea:
    """Orden corta (diagnóstico, centrar, ensayos) con su salida retransmitida."""

    def __init__(self):
        self.proc = None
        self.nombre = None
        self.log = collections.deque(maxlen=2000)
        self.codigo = None

    def ocupada(self):
        return self.proc is not None and self.proc.poll() is None

    def resumen(self):
        return {'nombre': self.nombre, 'activa': self.ocupada(), 'codigo': self.codigo, 'log': list(self.log)}

    def iniciar(self, nombre, orden, entrada=None):
        if self.ocupada():
            raise RuntimeError(f'Ya se está ejecutando «{self.nombre}».')
        self.nombre, self.codigo = nombre, None
        self.log.clear()
        self.proc = subprocess.Popen(orden, stdin=subprocess.PIPE if entrada else subprocess.DEVNULL,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
                                     start_new_session=True, cwd=str(REPO),
                                     env=dict(os.environ, PYTHONUNBUFFERED='1', SOARM_UI='terminal'))
        if entrada:
            self.proc.stdin.write(entrada)
            self.proc.stdin.close()
        difusor.publicar('tarea', {'nombre': nombre, 'activa': True})
        threading.Thread(target=self._leer, args=(self.proc,), daemon=True).start()

    def _leer(self, proc):
        for linea in proc.stdout:
            linea = linea.rstrip('\n')
            self.log.append(linea)
            difusor.publicar('log', {'fuente': 'tarea', 'nombre': self.nombre, 'linea': linea})
        self.codigo = proc.wait()
        difusor.publicar('tarea', {'nombre': self.nombre, 'activa': False, 'codigo': self.codigo})

    def detener(self):
        if self.ocupada():
            os.killpg(self.proc.pid, signal.SIGINT)
            time.sleep(0.2)


sesion = Sesion()
tarea = Tarea()
