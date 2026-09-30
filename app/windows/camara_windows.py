"""Cámara de Windows para SO-ARM100 Estudio en WSL2.

WSL2 no ve las cámaras de Windows: ni la integrada del portátil, ni una webcam
USB (salvo pasándola con usbipd), ni la cámara virtual de OBS. Este programa
corre en el Python de Windows, abre la cámara con DirectShow (como cualquier
programa de Windows) y envía cada imagen JPEG al servidor de la aplicación en
http://127.0.0.1:8642, que Windows alcanza dentro de WSL. El servidor la vuelve
a publicar como flujo MJPEG en /camara/video, igual que un teléfono con
DroidCam, y la teleoperación la lee desde ahí. No abre ningún puerto en Windows.

    py -3 camara_windows.py --listar
    py -3 camara_windows.py --indice 0 --token XYZ [--servidor http://127.0.0.1:8642]

Necesita opencv-python en el Python de Windows, y pygrabber para los nombres
de las cámaras (la aplicación instala los dos con «Preparar Windows»).
"""
import argparse
import base64
import http.client
import json
import sys
import time
import urllib.parse


def nombres_directshow():
    """Nombres de las cámaras en el mismo orden en que OpenCV (DirectShow) las
    numera. Se obtienen con pygrabber, que usa la misma enumeración de DirectShow;
    sin pygrabber se devuelve [] y las cámaras se muestran como «Cámara N»,
    con su miniatura para reconocerlas."""
    try:
        from pygrabber.dshow_graph import FilterGraph
        return list(FilterGraph().get_input_devices())
    except Exception:
        return []


def miniatura(cv2, img):
    """JPEG pequeño en base64 para reconocer la cámara en la lista."""
    alto, ancho = img.shape[:2]
    img = cv2.resize(img, (160, max(1, int(alto * 160 / ancho))))
    ok, jpg = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return base64.b64encode(jpg.tobytes()).decode('ascii') if ok else ''


def listar(maximo=8):
    import cv2
    nombres = nombres_directshow()
    res = []
    for i in range(len(nombres) if nombres else maximo):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            if not nombres:
                continue
            ok, img = False, None           # existe pero no abre: la usa otro programa
        else:
            ok, img = False, None
            for _ in range(5):               # las primeras imágenes pueden venir vacías
                ok, img = cap.read()
                if ok and img is not None:
                    break
                time.sleep(0.1)
            cap.release()
        entrega = bool(ok and img is not None)
        alto, ancho = (img.shape[:2] if entrega else (0, 0))
        nombre = nombres[i] if i < len(nombres) else f'Cámara {i}'
        virtual = any(p in nombre.lower() for p in ('obs', 'virtual', 'droidcam', 'snap', 'manycam', 'xsplit'))
        res.append({'indice': i, 'nombre': nombre, 'entrega': entrega, 'ancho': ancho, 'alto': alto,
                    'clase': 'virtual' if virtual else 'fisica', 'miniatura': miniatura(cv2, img) if entrega else '',
                    'con_nombres': bool(nombres)})
    # ASCII puro: WSL lee esta salida como UTF-8 y Windows escribiría en cp1252.
    print(json.dumps(res))


def enviar(indice, token, servidor, ancho=640, alto=480, fps=30):
    import cv2
    u = urllib.parse.urlparse(servidor)
    cap = cv2.VideoCapture(indice, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, ancho)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, alto)
    cap.set(cv2.CAP_PROP_FPS, fps)
    if not cap.isOpened():
        print(f'No se pudo abrir la cámara {indice}.', file=sys.stderr)
        return 1
    ruta = f'/api/camwin/cuadro?token={urllib.parse.quote(token)}'
    fallos = 0
    sin_servidor = 0
    try:
        while True:
            ok, img = cap.read()
            if not ok:
                fallos += 1
                if fallos > 60:
                    print('La cámara dejó de entregar imágenes.', file=sys.stderr)
                    return 1
                time.sleep(0.05)
                continue
            fallos = 0
            if img.shape[1] != ancho:
                img = cv2.resize(img, (ancho, int(img.shape[0] * ancho / img.shape[1])))
            ok, jpg = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                continue
            # Una conexión por imagen: el servidor de la aplicación habla HTTP/1.0.
            con = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=5)
            try:
                con.request('POST', ruta, body=jpg.tobytes(), headers={'Content-Type': 'image/jpeg'})
                r = con.getresponse()
                r.read()
                estado = r.status
            except (OSError, http.client.HTTPException) as e:
                # El servidor se reinició o se cerró: se reintenta un minuto y luego se termina.
                if sin_servidor == 0:
                    print(f'SIN_CONEXION: Windows no alcanza {servidor}: {e}', file=sys.stderr, flush=True)
                sin_servidor += 1
                if sin_servidor > 60:
                    return 0
                time.sleep(1.0)
                continue
            finally:
                con.close()
            sin_servidor = 0
            if estado == 410:              # la aplicación eligió otra cámara o ya no la usa: termina
                return 0
    finally:
        cap.release()


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--listar', action='store_true')
    a.add_argument('--indice', type=int, default=0)
    a.add_argument('--token', default='')
    a.add_argument('--servidor', default='http://127.0.0.1:8642')
    args = a.parse_args()
    for flujo in (sys.stdout, sys.stderr):      # mensajes con tildes legibles desde WSL
        try:
            flujo.reconfigure(encoding='utf-8', errors='replace')
        except AttributeError:
            pass
    try:
        import cv2  # noqa: F401
    except ImportError:
        print('FALTA_OPENCV', file=sys.stderr)
        return 3
    if args.listar:
        listar()
        return 0
    return enviar(args.indice, args.token, args.servidor)


if __name__ == '__main__':
    sys.exit(main())
