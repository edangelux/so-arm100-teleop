"""Cámara de Windows: claves, rechazo de emisores viejos y flujo MJPEG."""
import threading
import time

from estudio.camwin import CamaraNavegador


def test_rechaza_clave_equivocada_y_emisor_viejo():
    c = CamaraNavegador()
    viejo = c.nuevo_emisor('A')
    assert c.recibir(viejo, b'\xff\xd8a\xff\xd9') == 204
    nuevo = c.nuevo_emisor('B')
    assert c.recibir(viejo, b'x') == 410
    assert c.recibir('otra', b'x') == 410
    assert c.recibir(nuevo, b'\xff\xd8b\xff\xd9') == 204
    assert c.enviando() and c.estado()['nombre'] == 'B'


def test_flujo_entrega_la_ultima_imagen_y_cuenta_lectores():
    c = CamaraNavegador()
    t = c.nuevo_emisor('A')
    c.recibir(t, b'\xff\xd8uno\xff\xd9')
    recibido = []

    def escribir(b):
        recibido.append(b)
        if len(recibido) >= 2:
            raise OSError('cerrado')

    hilo = threading.Thread(target=lambda: _flujo(c, escribir))
    hilo.start()
    time.sleep(0.2)
    assert c.lectores == 1
    c.recibir(t, b'\xff\xd8dos\xff\xd9')
    hilo.join(3)
    assert b'uno' in recibido[0] and b'dos' in recibido[1]
    assert b'Content-Type: image/jpeg' in recibido[0]
    assert c.lectores == 0


def _flujo(c, escribir):
    try:
        c.flujo(escribir)
    except OSError:
        pass


def test_detener_con_clave_ajena_no_detiene():
    c = CamaraNavegador()
    t = c.nuevo_emisor('A')
    c.detener('otra')
    assert c.token == t
    c.detener(t)
    assert c.token is None
