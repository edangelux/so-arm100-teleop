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
import threading
import time

import cv2

ESQUEMAS = ('http://', 'https://', 'rtsp://')


def es_url(fuente):
    return isinstance(fuente, str) and fuente.lower().startswith(ESQUEMAS)


class CamaraRed:
    """Imita la parte de cv2.VideoCapture que usa teleop_v13.py."""

    def __init__(self, url, ancho=640, alto=480, espera=5.0):
        self.url, self.ancho, self.alto, self.espera = url, ancho, alto, espera
        self._cond = threading.Condition()
        self._frame, self._n, self._entregado = None, 0, 0
        self._activo = True
        self._ultimo = time.time()
        self._cap = self._abrir()
        self._hilo = threading.Thread(target=self._leer, daemon=True)
        self._hilo.start()
        # Se espera el primer fotograma para que isOpened() diga la verdad.
        with self._cond:
            self._cond.wait_for(lambda: self._n > 0 or not self._activo, timeout=self.espera)

    def _abrir(self):
        cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap = cv2.VideoCapture(self.url)
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        return cap

    def _leer(self):
        while self._activo:
            ok, frame = self._cap.read() if self._cap is not None else (False, None)
            if ok and frame is not None:
                if frame.shape[1] != self.ancho or frame.shape[0] != self.alto:
                    frame = cv2.resize(frame, (self.ancho, self.alto))
                with self._cond:
                    self._frame, self._n, self._ultimo = frame, self._n + 1, time.time()
                    self._cond.notify_all()
                continue
            # Flujo interrumpido: se reintenta hasta agotar la espera.
            if time.time() - self._ultimo > self.espera:
                with self._cond:
                    self._activo = False
                    self._cond.notify_all()
                break
            time.sleep(0.5)
            try:
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
        return self._cap.get(prop) if self._cap is not None else 0.0

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
