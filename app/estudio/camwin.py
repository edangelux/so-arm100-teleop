"""Cámara de Windows en WSL2, abierta por el navegador de la aplicación.

WSL2 no ve las cámaras de Windows: ni la integrada del portátil, ni una webcam
USB, ni la OBS Virtual Camera. El navegador de Windows (Edge o Chrome), en
cambio, las abre de forma nativa con getUserMedia, y la página de la
aplicación se sirve desde http://127.0.0.1:8642, que el navegador trata como
origen seguro. La página (js/camara_navegador.js) toma cada imagen, la recorta
a 640×480, la comprime a JPEG y la envía aquí con POST /api/camwin/cuadro.

El servidor guarda la última imagen y la vuelve a publicar como MJPEG en
/camara/video, la dirección que usa la teleoperación, igual que la de un
teléfono con DroidCam. Cada respuesta al navegador lleva cuántos lectores hay
(X-Lectores): sin lectores la página envía una imagen por segundo; con la
teleoperación leyendo, todas las que entrega la cámara, una a la vez y siempre
la más reciente, de modo que el retraso no se acumula.
"""
import secrets
import threading
import time

URL_VIDEO = 'http://127.0.0.1:8642/camara/video'
VIGENCIA = 3.0       # s desde la última imagen para considerar que la cámara está enviando


class CamaraNavegador:
    def __init__(self):
        self.token = None
        self.nombre = ''
        self.cuadro = None
        self.t_cuadro = 0.0
        self.cuadros = 0
        self.lectores = 0
        self._marcas = []            # tiempos de las últimas imágenes, para las imágenes por segundo
        self._cond = threading.Condition()

    def nuevo_emisor(self, nombre=''):
        """Una ventana de la aplicación empieza a enviar. La anterior, si la había,
        recibe 410 en su próximo envío y se detiene."""
        with self._cond:
            self.token = secrets.token_hex(8)
            self.nombre = str(nombre)[:120]
            self.cuadro, self.cuadros, self.t_cuadro = None, 0, 0.0
            self._marcas = []
        return self.token

    def detener(self, token=None):
        with self._cond:
            if token is None or token == self.token:
                self.token = None
                self._cond.notify_all()

    def recibir(self, token, datos):
        """Devuelve el código HTTP para la página que envía."""
        if not token or token != self.token:
            return 410
        ahora = time.time()
        with self._cond:
            self.cuadro, self.t_cuadro = datos, ahora
            self.cuadros += 1
            self._marcas = [t for t in self._marcas if ahora - t < 2.0] + [ahora]
            self._cond.notify_all()
        return 204

    def enviando(self):
        return self.token is not None and self.cuadro is not None and time.time() - self.t_cuadro < VIGENCIA

    def foto(self):
        return self.cuadro if self.enviando() else None

    def flujo(self, escribir):
        """Escribe el MJPEG mientras lleguen imágenes. escribir(bytes) lanza OSError al cerrarse."""
        with self._cond:
            self.lectores += 1
        ultimo = -1
        try:
            while True:
                with self._cond:
                    if self.cuadros == ultimo:
                        self._cond.wait(timeout=2.0)
                    if self.cuadros == ultimo or self.cuadro is None:
                        if time.time() - self.t_cuadro > 10:
                            return            # la ventana de la aplicación dejó de enviar
                        continue
                    ultimo, datos = self.cuadros, self.cuadro
                escribir(b'--cuadro\r\nContent-Type: image/jpeg\r\nContent-Length: '
                         + str(len(datos)).encode() + b'\r\n\r\n' + datos + b'\r\n')
        finally:
            with self._cond:
                self.lectores -= 1

    def estado(self):
        ahora = time.time()
        fps = len([t for t in self._marcas if ahora - t < 2.0]) / 2.0
        return {'activa': self.enviando(), 'nombre': self.nombre, 'lectores': self.lectores,
                'edad': round(ahora - self.t_cuadro, 1) if self.cuadros else None,
                'cuadros': self.cuadros, 'fps': round(fps, 1)}


camara = CamaraNavegador()
