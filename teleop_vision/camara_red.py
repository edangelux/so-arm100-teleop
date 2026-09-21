"""Cámara por red para teleop_v13.py: DroidCam, IP Webcam o cualquier flujo MJPEG/RTSP.

teleop_v13.py abre la cámara con cv2.VideoCapture(indice, cv2.CAP_V4L2), que
sólo admite dispositivos /dev/videoN. Este módulo permite usar en su lugar una
dirección de red, como la que publica DroidCam (http://IP:4747/video), sin
modificar el archivo de la versión presentada: ejecutar_v13.py sustituye el
módulo cv2 que ve teleop_v13.py por un intermediario que sólo cambia
VideoCapture y deja pasar todo lo demás.

La lectura se hace en un hilo aparte que conserva únicamente el fotograma más
reciente. Sin eso, OpenCV acumula fotogramas en su búfer y la imagen se va
retrasando respecto del operador, que es lo peor que le puede pasar a una
teleoperación: el brazo seguiría gestos de hace varios segundos.
"""
import sys
import threading
import time
import urllib.request

import cv2
import numpy as np

ESQUEMAS = ('http://', 'https://', 'rtsp://')


class LectorMJPEG:
    """Lee un flujo MJPEG por HTTP sin pasar por FFmpeg.

    DroidCam e IP Webcam publican el video como multipart/x-mixed-replace: una
    sucesión de imágenes JPEG. Cada imagen empieza con los bytes FF D8 y termina
    con FF D9, así que basta con cortar el flujo por esas marcas y decodificar
    cada trozo con cv2.imdecode. Se evita así el lector FFmpeg de las ruedas de
    OpenCV, que en algunos equipos rechaza estas direcciones sin dar el motivo.
    """

    def __init__(self, url, espera=5.0):
        # Sin proxy: la cámara siempre está en la red local.
        abridor = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self._resp = abridor.open(url, timeout=espera)
        tipo = self._resp.headers.get('Content-Type', '') or ''
        if not tipo.lower().startswith(('multipart/', 'image/')):
            inicio = self._resp.read(200).decode('utf-8', 'replace').strip()
            self._resp.close()
            raise IOError(f'la dirección respondió «{tipo or "sin tipo"}» en lugar de video '
                          f'(¿la cámara atiende ya a otro cliente?): {inicio[:120]!r}')
        self._buf = b''

    def isOpened(self):
        return True

    def read(self):
        while True:
            a = self._buf.find(b'\xff\xd8')
            if a >= 0:
                b = self._buf.find(b'\xff\xd9', a + 2)
                if b >= 0:
                    jpg, self._buf = self._buf[a:b + 2], self._buf[b + 2:]
                    frame = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
                    if frame is not None:
                        return True, frame
                    continue
                self._buf = self._buf[a:]
            else:
                self._buf = self._buf[-1:]
            if len(self._buf) > 8_000_000:
                self._buf = b''
            trozo = self._resp.read1(65536)
            if not trozo:
                return False, None
            self._buf += trozo

    def set(self, prop, valor):
        return True

    def get(self, prop):
        return 0.0

    def release(self):
        try:
            self._resp.close()
        except Exception:
            pass


def es_url(fuente):
    return isinstance(fuente, str) and fuente.lower().startswith(ESQUEMAS)


class CamaraRed:
    """Imita la parte de cv2.VideoCapture que usa teleop_v13.py."""

    def __init__(self, url, ancho=640, alto=480, espera=5.0, espera_inicial=15.0):
        self.url, self.ancho, self.alto, self.espera = url, ancho, alto, espera
        # La primera conexión recibe más margen: el teléfono puede tardar en
        # liberar una conexión anterior, como la comprobación del lanzador.
        self._conectado = False
        self._espera_inicial = espera_inicial
        self._cond = threading.Condition()
        self._frame, self._n, self._entregado = None, 0, 0
        self._activo = True
        self._ultimo = time.time()
        self._cap = self._abrir()
        self._hilo = threading.Thread(target=self._leer, daemon=True)
        self._hilo.start()
        # Se espera el primer fotograma para que isOpened() diga la verdad.
        with self._cond:
            self._cond.wait_for(lambda: self._n > 0 or not self._activo,
                                timeout=self._espera_inicial + 1.0)

    def _abrir(self):
        if self.url.lower().startswith(('http://', 'https://')):
            try:
                return LectorMJPEG(self.url, self.espera)
            except Exception as error:
                self._avisar(f'no se pudo abrir {self.url}: {error}')
                return None
        cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap = cv2.VideoCapture(self.url)
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        return cap

    def _avisar(self, mensaje):
        # Cada motivo distinto se escribe una vez, para que quede en vision.log.
        if mensaje != getattr(self, '_ultimo_aviso', None):
            self._ultimo_aviso = mensaje
            print('Cámara por red:', mensaje, file=sys.stderr, flush=True)

    def _leer(self):
        while self._activo:
            try:
                ok, frame = self._cap.read() if self._cap is not None else (False, None)
            except Exception as error:
                self._avisar(f'lectura interrumpida: {error}')
                ok, frame = False, None
            if ok and frame is not None:
                if frame.shape[1] != self.ancho or frame.shape[0] != self.alto:
                    frame = cv2.resize(frame, (self.ancho, self.alto))
                with self._cond:
                    self._conectado = True
                    self._frame, self._n, self._ultimo = frame, self._n + 1, time.time()
                    self._cond.notify_all()
                continue
            # Flujo interrumpido: se reintenta hasta agotar la espera.
            limite = self.espera if self._conectado else self._espera_inicial
            if time.time() - self._ultimo > limite:
                with self._cond:
                    self._activo = False
                    self._cond.notify_all()
                break
            time.sleep(0.5)
            try:
                if self._cap is not None:
                    self._cap.release()
            except Exception:
                pass
            self._cap = self._abrir()

    def isOpened(self):
        return self._activo and self._n > 0

    def read(self):
        """Devuelve el fotograma más reciente que todavía no se haya entregado."""
        with self._cond:
            self._cond.wait_for(lambda: self._n > self._entregado or not self._activo,
                                timeout=self.espera)
            if self._n > self._entregado and self._frame is not None:
                self._entregado = self._n
                return True, self._frame.copy()
            return False, None

    def set(self, prop, valor):
        # Formato, ancho y alto los fija la aplicación del teléfono; aquí se
        # redimensiona al tamaño de trabajo. Se acepta la orden sin efecto.
        return True

    def get(self, prop):
        if prop == cv2.CAP_PROP_FRAME_WIDTH:
            return float(self.ancho)
        if prop == cv2.CAP_PROP_FRAME_HEIGHT:
            return float(self.alto)
        try:
            return self._cap.get(prop) if self._cap is not None else 0.0
        except Exception:
            return 0.0

    def release(self):
        self._activo = False
        with self._cond:
            self._cond.notify_all()
        try:
            self._cap.release()
        except Exception:
            pass


class Cv2ConCamaraRed:
    """Módulo cv2 que sólo cambia VideoCapture cuando la fuente es una URL."""

    def __init__(self, url, ancho, alto):
        self._url, self._ancho, self._alto = url, ancho, alto

    def VideoCapture(self, fuente=None, *args, **kwargs):
        if es_url(fuente):
            return CamaraRed(fuente, self._ancho, self._alto)
        return cv2.VideoCapture(fuente, *args, **kwargs)

    def __getattr__(self, nombre):
        return getattr(cv2, nombre)
