"""Difusión de eventos al navegador por Server-Sent Events (sin dependencias)."""
import json
import queue
import threading


class Difusor:
    def __init__(self):
        self._clientes = []
        self._cerrojo = threading.Lock()

    def suscribir(self):
        q = queue.Queue(maxsize=500)
        with self._cerrojo:
            self._clientes.append(q)
        return q

    def retirar(self, q):
        with self._cerrojo:
            if q in self._clientes:
                self._clientes.remove(q)

    def publicar(self, evento, datos):
        texto = f'event: {evento}\ndata: {json.dumps(datos, ensure_ascii=False)}\n\n'
        with self._cerrojo:
            for q in list(self._clientes):
                try:
                    q.put_nowait(texto)
                except queue.Full:       # cliente lento: se descarta el evento, no se bloquea el servidor
                    pass


difusor = Difusor()
