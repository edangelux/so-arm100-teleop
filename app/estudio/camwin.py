"""Cámaras de Windows en WSL2: integrada, USB u OBS Virtual Camera.

WSL2 no ve las cámaras de Windows. Aquí se arranca, en el Python de Windows,
app/windows/camara_windows.py, que abre la cámara con DirectShow y envía cada
imagen a este servidor (POST /api/camwin/cuadro). El servidor guarda la última
y la vuelve a publicar como MJPEG en /camara/video, la dirección que usa la
teleoperación, igual que la de un teléfono con DroidCam.

El envío se detiene solo cuando nadie lee el video durante un minuto, o cuando
se elige otra cámara (el servidor responde 410 y el programa de Windows termina).
"""
import json
import os
import secrets
import shutil
import subprocess
import threading
import time
from pathlib import Path

from .rutas import REPO

SCRIPT = REPO / 'app' / 'windows' / 'camara_windows.py'
URL_VIDEO = 'http://127.0.0.1:8642/camara/video'
INACTIVO = 60.0      # s sin nadie leyendo el video antes de apagar la cámara de Windows


class CamaraWindows:
    def __init__(self):
        self.token = None
        self.indice = None
        self.nombre = ''
        self.proc = None
        self.cuadro = None
        self.t_cuadro = 0.0
        self.cuadros = 0
        self.lectores = 0
        self.t_actividad = 0.0
        self.error = ''
        self._cond = threading.Condition()
        self._python = None
        threading.Thread(target=self._vigilar, daemon=True).start()

    # ------------------------------------------------------------ Python de Windows
    def python(self):
        """Orden para el Python de Windows (py -3 o python.exe), o None."""
        if self._python:
            return self._python
        for orden in (['py.exe', '-3'], ['python.exe']):
            if not shutil.which(orden[0]):
                continue
            try:
                r = subprocess.run(orden + ['--version'], capture_output=True, text=True,
                                   encoding='utf-8', errors='replace', timeout=15)
            except (OSError, subprocess.TimeoutExpired):
                continue
            if r.returncode == 0 and 'Python 3' in (r.stdout + r.stderr):
                self._python = orden
                return orden
        return None

    def _ruta_script(self):
        r = subprocess.run(['wslpath', '-w', str(SCRIPT)], capture_output=True, text=True)
        return r.stdout.strip()

    def disponible(self):
        return shutil.which('cmd.exe') is not None

    # ------------------------------------------------------------ listar e instalar
    def listar(self):
        py = self.python()
        if not py:
            return {'ok': False, 'falta': 'python',
                    'mensaje': 'No se encontró Python en Windows. Instálelo una vez desde PowerShell: '
                               'winget install Python.Python.3.12 (o desde Microsoft Store) y vuelva a buscar.'}
        try:
            r = subprocess.run(py + [self._ruta_script(), '--listar'], capture_output=True, text=True,
                               encoding='utf-8', errors='replace', timeout=90)
        except subprocess.TimeoutExpired:
            return {'ok': False, 'mensaje': 'Windows tardó más de minuto y medio en listar las cámaras.'}
        if 'FALTA_OPENCV' in r.stderr:
            return {'ok': False, 'falta': 'opencv',
                    'mensaje': 'Falta OpenCV en el Python de Windows. Pulse «Preparar Windows» (una sola vez, unos minutos).'}
        try:
            camaras = json.loads(r.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            return {'ok': False, 'mensaje': 'No se pudo leer la lista de cámaras: ' + (r.stderr.strip()[-200:] or 'sin detalle')}
        return {'ok': True, 'camaras': camaras,
                'sin_nombres': bool(camaras) and not camaras[0].get('con_nombres')}

    def orden_preparar(self):
        py = self.python()
        if not py:
            raise RuntimeError('No se encontró Python en Windows: instálelo con «winget install Python.Python.3.12» en PowerShell.')
        return py + ['-m', 'pip', 'install', '--user', '--upgrade', '--disable-pip-version-check',
                     'opencv-python', 'pygrabber']

    # ------------------------------------------------------------ envío de imágenes
    def usar(self, indice, nombre=''):
        """Arranca el envío de la cámara elegida y espera la primera imagen."""
        py = self.python()
        if not py:
            raise RuntimeError('No se encontró Python en Windows.')
        self.detener()
        self.token = secrets.token_hex(8)
        self.indice, self.nombre, self.error = int(indice), nombre, ''
        self.cuadro, self.cuadros = None, 0
        self.t_actividad = time.time()
        carpeta = Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local' / 'state')) / 'soarm'
        carpeta.mkdir(parents=True, exist_ok=True)
        registro = open(carpeta / 'camara_windows.log', 'w')
        self.proc = subprocess.Popen(py + [self._ruta_script(), '--indice', str(self.indice), '--token', self.token],
                                     stdout=registro, stderr=registro, stdin=subprocess.DEVNULL)
        registro.close()                    # el proceso de Windows tiene su propia copia
        limite = time.time() + 15
        while time.time() < limite:
            if self.cuadros > 0:
                return {'ok': True, 'mensaje': f'La cámara «{nombre or indice}» de Windows entrega video.', 'camara': URL_VIDEO}
            if self.proc.poll() is not None:
                break
            time.sleep(0.2)
        self.detener()
        try:
            detalle = Path(registro.name).read_text(encoding='utf-8', errors='replace')[-300:].strip()
        except OSError:
            detalle = ''
        if 'SIN_CONEXION' in detalle:
            return {'ok': False, 'mensaje': 'La cámara abrió en Windows, pero Windows no alcanza la aplicación en '
                                            '127.0.0.1:8642 dentro de WSL. Revise que no esté desactivado '
                                            'localhostForwarding en %UserProfile%\\.wslconfig y reinicie WSL con «wsl --shutdown». '
                                            + detalle[-160:]}
        if 'FALTA_OPENCV' in detalle:
            return {'ok': False, 'falta': 'opencv', 'mensaje': 'Falta OpenCV en el Python de Windows. Pulse «Preparar Windows».'}
        return {'ok': False, 'mensaje': 'La cámara no entregó imágenes. ¿La usa otro programa (Zoom, Teams, el navegador)? '
                                        + (detalle or '')}

    def detener(self):
        self.token = None
        proc, self.proc = self.proc, None
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()

    def recibir(self, token, datos):
        """Devuelve el código HTTP para el programa de Windows."""
        if not token or token != self.token:
            return 410
        with self._cond:
            self.cuadro, self.t_cuadro = datos, time.time()
            self.cuadros += 1
            self._cond.notify_all()
        return 204

    def foto(self):
        self.t_actividad = time.time()
        return self.cuadro

    def flujo(self, escribir):
        """Escribe el MJPEG mientras haya imágenes. escribir(bytes) lanza OSError al cerrarse."""
        self.lectores += 1
        ultimo = -1
        try:
            while True:
                with self._cond:
                    if self.cuadros == ultimo:
                        self._cond.wait(timeout=2.0)
                    if self.cuadros == ultimo or self.cuadro is None:
                        if time.time() - self.t_cuadro > 10:
                            return
                        continue
                    ultimo, datos = self.cuadros, self.cuadro
                self.t_actividad = time.time()
                escribir(b'--cuadro\r\nContent-Type: image/jpeg\r\nContent-Length: '
                         + str(len(datos)).encode() + b'\r\n\r\n' + datos + b'\r\n')
        finally:
            self.lectores -= 1
            self.t_actividad = time.time()

    def estado(self):
        activa = self.proc is not None and self.proc.poll() is None
        return {'activa': activa, 'indice': self.indice, 'nombre': self.nombre, 'lectores': self.lectores,
                'edad': round(time.time() - self.t_cuadro, 1) if self.cuadros else None, 'cuadros': self.cuadros}

    def asegurar(self, indice, nombre=''):
        """Antes de una sesión: si la cámara de Windows elegida no está enviando, la arranca."""
        if self.proc is not None and self.proc.poll() is None and self.indice == int(indice) \
                and time.time() - self.t_cuadro < 3:
            self.t_actividad = time.time()
            return {'ok': True}
        return self.usar(indice, nombre)

    def _vigilar(self):
        while True:
            time.sleep(5)
            if self.proc is not None and self.lectores == 0 and time.time() - self.t_actividad > INACTIVO:
                self.detener()


camara = CamaraWindows()
