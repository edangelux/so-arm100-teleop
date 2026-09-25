#!/usr/bin/env python3
"""SO-ARM100 Estudio — servidor local de la aplicación.

Sirve la interfaz web (app/web) y una API en /api que hace, desde botones, lo
mismo que las órdenes de la terminal: arrancar la teleoperación, elegir la
cámara, mover el brazo, centrar servos, ejecutar ensayos y el diagnóstico.
Sólo usa la biblioteca estándar de Python; ROS 2 es opcional.

Escucha sólo en 127.0.0.1: el brazo se controla desde el propio equipo.
Uso: python3 app/servidor.py [--puerto 8642] [--red]
"""
import argparse
import json
import mimetypes
import os
import re
import shlex
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estudio import entorno as ent               # noqa: E402
from estudio import puente_ros                    # noqa: E402
from estudio.eventos import difusor               # noqa: E402
from estudio.modelo import cargar_modelo          # noqa: E402
from estudio.procesos import sesion, tarea        # noqa: E402
from estudio.version import huella                # noqa: E402
from estudio.rutas import (ENSAYOS, LECCIONES, MALLAS, PROGRAMAS, REPO,  # noqa: E402
                           RESULTADOS, SCRIPTS, WEB)

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('model/stl', '.stl')
MODELO = cargar_modelo()
VERSION = huella()          # código con el que arrancó este proceso
PUENTE = None


def estado_general():
    conf = ent.leer_conf()
    return {
        'version': VERSION,
        'entorno': ent.entorno(),
        'software_gl': ent.software_gl(conf),
        'ros': PUENTE.estado() if PUENTE else {'disponible': False, 'motivo': 'sin iniciar'},
        'sesion': sesion.resumen(),
        'tarea': tarea.resumen() | {'log': list(tarea.log)[-300:]},
        'brazo': {'puertos': ent.puertos(), 'configurado': conf['SOARM_PUERTO'],
                  'dialout': ent.en_grupo('dialout')},
        'conf': {k: v for k, v in conf.items()},
    }


# ------------------------------------------------------------ acciones
def accion_iniciar(d):
    conf = ent.leer_conf()
    modo = d.get('modo', 'auto')
    if modo == 'auto':
        puerto, _ = ent.conectar_brazo(conf)
        modo = 'ambos' if puerto else 'sim'
    opciones = []
    if modo != 'sim':
        puerto, msg = ent.conectar_brazo(conf)
        if not puerto:
            raise RuntimeError(msg)
        if not ent.en_grupo('dialout'):
            raise RuntimeError('Su usuario no está en el grupo dialout: cierre la sesión (en WSL2, wsl --shutdown) y vuelva a entrar.')
        opciones += ['--puerto', puerto]
    version = str(d.get('version', conf['SOARM_VERSION']))
    if version in ('14', '15'):
        opciones.append(f'--v{version}')
    if d.get('moveit', conf['SOARM_MOVEIT'] == '1'):
        opciones.append('--moveit')
    camara = str(d.get('camara') or conf['SOARM_CAM'])
    opciones += ['--camara', camara]
    vel = d.get('velocidad') or conf['SOARM_VELOCIDAD']
    if vel:
        opciones += ['--velocidad', str(vel)]
    if modo != 'real' and ent.software_gl(conf):
        opciones.append('--software-gl')
    ent.guardar_conf({'SOARM_VERSION': version, 'SOARM_MOVEIT': '1' if '--moveit' in opciones else '0',
                      'SOARM_CAM': camara})
    sesion.iniciar(modo, opciones)
    return {'modo': modo, 'orden': 'bash scripts/soarm.sh ' + ' '.join(shlex.quote(o) for o in [modo] + opciones)}


def accion_camara_probar(d):
    if d.get('dev') is not None:
        dev = str(d['dev'])
        ok, msg = ent.probar_local(dev)
        if ok:
            ent.guardar_conf({'SOARM_CAM': dev.replace('/dev/video', ''), 'SOARM_CAM_DEV': dev,
                              'SOARM_CAM_TIPO': d.get('tipo', '')})
        return {'ok': ok, 'mensaje': msg, 'camara': dev.replace('/dev/video', '')}
    entrada = str(d.get('ip', '')).strip()
    if not entrada:
        raise RuntimeError('Escriba la IP que muestra la aplicación del teléfono.')
    url = ent.a_url(entrada)
    estado = ent.probar_url(url)
    mensajes = {
        'libre': 'El teléfono entrega video.',
        'ocupado': 'El teléfono ya está enviando el video a otro programa (cliente de DroidCam de Windows, una pestaña del navegador u otra sesión). Ciérrelo y reintente.',
        'sin_respuesta': 'No hubo respuesta: compruebe que la aplicación esté abierta, que el teléfono esté en la misma red Wi-Fi y que la IP sea la que muestra ahora.',
        'otro': 'La dirección respondió, pero no con video.',
    }
    if estado == 'libre':
        host = re.sub(r'^[a-z]+://|/.*$|:4747$', '', entrada)
        ent.guardar_conf({'SOARM_CAM': url, 'SOARM_CAM_IP': host, 'SOARM_CAM_TIPO': 'Teléfono por Wi-Fi (DroidCam o IP Webcam)'})
    return {'ok': estado == 'libre', 'estado': estado, 'mensaje': mensajes[estado], 'camara': url}


def orden_ros(*args):
    """Ejecuta con ROS y el workspace cargados, como hace el lanzador."""
    carga = 'source /opt/ros/humble/setup.bash >/dev/null 2>&1; ' \
            '[ -f "$HOME/ros2_ws_entrega/install/setup.bash" ] && source "$HOME/ros2_ws_entrega/install/setup.bash"; '
    return ['bash', '-c', carga + 'exec "$@"', 'soarm'] + list(args)


def compilar(nombre, fuente):
    scs = Path.home() / 'ros2_ws_entrega' / 'src' / 'so_arm_100_hardware' / 'include' / 'SCServo_Linux'
    binario = Path.home() / '.local' / 'bin' / f'soarm_{nombre}'
    if not scs.is_dir():
        raise RuntimeError('Falta el workspace compilado: ejecute la instalación.')
    if not binario.exists() or fuente.stat().st_mtime > binario.stat().st_mtime:
        binario.parent.mkdir(parents=True, exist_ok=True)
        cpp = [str(p) for p in scs.glob('*.cpp')]
        import subprocess
        r = subprocess.run(['g++', '-std=c++14', '-O2', '-I', str(scs), str(fuente)] + cpp + ['-o', str(binario)],
                           capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(f'No compiló {nombre}: {r.stderr[-300:]}')
    return str(binario)


ENSAYOS_DEF = {
    'a1': ['ensayo_precision.py', '--tipo', 'estatico'],
    'a5': ['ensayo_precision.py', '--tipo', 'escalon'],
    'a2': ['ensayo_repetibilidad.py'],
    'a3': ['ensayo_carga.py'],
}


def accion_tarea(d):
    nombre = d.get('nombre')
    if nombre == 'diagnostico':
        tarea.iniciar('Diagnóstico', ['bash', str(SCRIPTS / 'diagnostico.sh')])
    elif nombre in ('centrar', 'servos'):
        if sesion.estado != 'detenida':
            raise RuntimeError('Cierre antes la sesión: el lanzador tiene el puerto del brazo.')
        conf = ent.leer_conf()
        puerto, msg = ent.conectar_brazo(conf)
        if not puerto:
            raise RuntimeError(msg)
        fuente = REPO / 'brazo-fisico' / 'utilidades' / 'originales' / ('center_servos.cpp' if nombre == 'centrar' else 'list_servos.cpp')
        tarea.iniciar('Centrar servos' if nombre == 'centrar' else 'Listar servos', [compilar(nombre, fuente)])
    elif nombre in ENSAYOS_DEF:
        if sesion.estado != 'menu':
            raise RuntimeError('Los ensayos se ejecutan con la sesión abierta y la teleoperación cerrada (el lanzador en su menú).')
        modo = 'sim' if sesion.modo == 'sim' else 'real'
        extra = ENSAYOS_DEF[nombre][1:] + ['--modo', modo, '--si']
        if nombre == 'a3':
            extra += ['--etiqueta', re.sub(r'[^\w-]', '', str(d.get('etiqueta', 'sin_carga'))) or 'sin_carga']
        if nombre == 'a2':
            extra += ['--pose', 'actual']
        tarea.iniciar(f'Ensayo {nombre.upper()}', orden_ros('python3', str(ENSAYOS / ENSAYOS_DEF[nombre][0]), *extra))
    elif nombre == 'a4':
        if sesion.estado != 'detenida':
            raise RuntimeError('El ensayo térmico habla directo con los servos: cierre antes la sesión.')
        conf = ent.leer_conf()
        puerto, msg = ent.conectar_brazo(conf)
        if not puerto:
            raise RuntimeError(msg)
        carpeta = RESULTADOS / time.strftime('%Y-%m-%d')
        carpeta.mkdir(parents=True, exist_ok=True)
        minutos = str(int(d.get('minutos', 30)))
        binario = compilar('termico', REPO / 'brazo-fisico' / 'utilidades' / 'ensayos' / 'ensayo_termico.cpp')
        tarea.iniciar('Ensayo A4', [binario, minutos, '20', '55', str(carpeta / f'a4_termico_{time.strftime("%H%M%S")}.csv'), puerto])
    elif nombre == 'analizar':
        carpeta = RESULTADOS / str(d.get('fecha') or time.strftime('%Y-%m-%d'))
        tarea.iniciar('Análisis', ['python3', str(ENSAYOS / 'analizar.py'), str(carpeta)])
    else:
        raise RuntimeError('Tarea desconocida.')
    return {'ok': True}


def resultados():
    lista = []
    if RESULTADOS.is_dir():
        for d in sorted(RESULTADOS.iterdir(), reverse=True):
            if d.is_dir():
                lista.append({'fecha': d.name, 'archivos': sorted(p.name for p in d.iterdir()),
                              'resumen': (d / 'resumen.md').exists()})
    return lista


# ------------------------------------------------------------ programas del robot
NOMBRE_VALIDO = re.compile(r'^[\w\- ]{1,60}$')


def ruta_programa(nombre):
    nombre = str(nombre).strip()
    if nombre.endswith('.mod'):
        nombre = nombre[:-4]
    if not NOMBRE_VALIDO.match(nombre):
        raise RuntimeError('El nombre sólo puede tener letras, números, espacios, guiones y guiones bajos (hasta 60).')
    return PROGRAMAS / f'{nombre}.mod'


def programas():
    if not PROGRAMAS.is_dir():
        return []
    return [{'nombre': p.stem, 'fecha': time.strftime('%Y-%m-%d %H:%M', time.localtime(p.stat().st_mtime)),
             'bytes': p.stat().st_size} for p in sorted(PROGRAMAS.glob('*.mod'), key=lambda p: -p.stat().st_mtime)]


def exigir_menu():
    if sesion.estado != 'menu':
        raise RuntimeError('Para mover el brazo, arranque una sesión y cierre la teleoperación (el lanzador debe estar en su menú).')


# ------------------------------------------------------------ HTTP
class Manejador(BaseHTTPRequestHandler):
    server_version = 'SOARM-Estudio/1'

    def log_message(self, *a):
        pass

    def _json(self, datos, codigo=200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(cuerpo)

    def _archivo(self, ruta, base):
        try:
            ruta = ruta.resolve()
            ruta.relative_to(base.resolve())
        except (ValueError, OSError):
            return self._json({'error': 'No encontrado'}, 404)
        if not ruta.is_file():
            return self._json({'error': 'No encontrado'}, 404)
        tipo = mimetypes.guess_type(ruta.name)[0] or 'application/octet-stream'
        datos = ruta.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', tipo + ('; charset=utf-8' if tipo.startswith('text/') else ''))
        self.send_header('Content-Length', str(len(datos)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(datos)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        p = urllib.parse.unquote(u.path)
        if p == '/api/estado':
            return self._json(estado_general())
        if p == '/api/modelo':
            return self._json(MODELO)
        if p == '/api/camaras':
            return self._json({'locales': ent.camaras_locales(), 'conf': ent.leer_conf()})
        if p == '/api/resultados':
            return self._json(resultados())
        if p == '/api/eventos':
            return self._eventos()
        if p == '/api/programas':
            return self._json(programas())
        if p.startswith('/api/programas/'):
            try:
                ruta = ruta_programa(p[len('/api/programas/'):])
            except RuntimeError as e:
                return self._json({'error': str(e)}, 400)
            if not ruta.is_file():
                return self._json({'error': 'No existe ese programa.'}, 404)
            return self._json({'nombre': ruta.stem, 'texto': ruta.read_text(encoding='utf-8')})
        if p.startswith('/mallas/'):
            return self._archivo(MALLAS / p[len('/mallas/'):], MALLAS)
        if p.startswith('/resultados/'):
            return self._archivo(RESULTADOS / p[len('/resultados/'):], RESULTADOS)
        if p.startswith('/lecciones/'):
            return self._archivo(LECCIONES / p[len('/lecciones/'):], LECCIONES)
        if p in ('', '/'):
            p = '/index.html'
        return self._archivo(WEB / p.lstrip('/'), WEB)

    def _eventos(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()
        cola = difusor.suscribir()
        try:
            self.wfile.write(b'event: hola\ndata: {}\n\n')
            self.wfile.flush()
            while True:
                try:
                    texto = cola.get(timeout=15)
                except Exception:
                    texto = ': latido\n\n'
                self.wfile.write(texto.encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            difusor.retirar(cola)

    def do_POST(self):
        # Una página de otro sitio abierta en el navegador no debe poder mover el brazo.
        origen = self.headers.get('Origin')
        # Se exige el mismo host y puerto que sirvió la página, no sólo el mismo equipo.
        if origen and urllib.parse.urlparse(origen).netloc != self.headers.get('Host', ''):
            return self._json({'error': 'Origen no permitido.'}, 403)
        largo = int(self.headers.get('Content-Length') or 0)
        try:
            d = json.loads(self.rfile.read(largo) or b'{}')
        except json.JSONDecodeError:
            return self._json({'error': 'JSON inválido.'}, 400)
        p = urllib.parse.urlparse(self.path).path
        try:
            if p == '/api/sesion/iniciar':
                return self._json(accion_iniciar(d))
            if p == '/api/sesion/menu':
                sesion.menu(d.get('accion'))
                return self._json({'ok': True})
            if p == '/api/sesion/cerrar-teleop':
                sesion.cerrar_teleop()
                return self._json({'ok': True})
            if p == '/api/sesion/detener':
                sesion.detener()
                return self._json({'ok': True})
            if p == '/api/camaras/probar':
                return self._json(accion_camara_probar(d))
            if p == '/api/camaras/buscar':
                return self._json(ent.buscar_telefonos())
            if p == '/api/brazo/conectar':
                puerto, msg = ent.conectar_brazo()
                return self._json({'ok': bool(puerto), 'puerto': puerto, 'mensaje': msg})
            if p == '/api/mover':
                exigir_menu()
                return self._json({'duracion': PUENTE.mover(sesion.modo, d['q'], d.get('velocidad', 0.5))})
            if p == '/api/pinza':
                exigir_menu()
                PUENTE.pinza(sesion.modo, float(d['valor']))
                return self._json({'ok': True})
            if p == '/api/trayectoria':
                exigir_menu()
                return self._json({'duracion': PUENTE.trayectoria(sesion.modo, d['puntos'])})
            if p == '/api/parar':
                if sesion.modo:
                    PUENTE.parar(sesion.modo)
                return self._json({'ok': True})
            if p == '/api/programas/guardar':
                ruta = ruta_programa(d.get('nombre', ''))
                texto = str(d.get('texto', ''))
                if len(texto) > 200_000:
                    raise RuntimeError('El programa es demasiado largo.')
                PROGRAMAS.mkdir(parents=True, exist_ok=True)
                ruta.write_text(texto, encoding='utf-8')
                return self._json({'ok': True, 'nombre': ruta.stem, 'ruta': str(ruta)})
            if p == '/api/programas/borrar':
                ruta = ruta_programa(d.get('nombre', ''))
                if ruta.is_file():
                    ruta.unlink()
                return self._json({'ok': True})
            if p == '/api/tarea':
                return self._json(accion_tarea(d))
            if p == '/api/tarea/detener':
                tarea.detener()
                return self._json({'ok': True})
            if p == '/api/conf':
                ent.guardar_conf({k: v for k, v in d.items() if k.startswith('SOARM_')})
                return self._json({'ok': True})
            if huella() != VERSION:
                return self._json({'error': 'El servidor de la aplicación sigue con una versión anterior del código: '
                                   'el repositorio se actualizó con el servidor encendido. Cierre la sesión, '
                                   'ejecute «soarm-app --parar» y abra otra vez con «soarm-app».',
                                   'desactualizado': True}, 409)
            return self._json({'error': 'Ruta desconocida.'}, 404)
        except (RuntimeError, KeyError, ValueError) as e:
            return self._json({'error': str(e)}, 409)


def main():
    global PUENTE
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--puerto', type=int, default=int(os.environ.get('SOARM_APP_PUERTO', 8642)))
    a.add_argument('--red', action='store_true', help='Aceptar conexiones de otros equipos de la red (con cuidado)')
    a.add_argument('--sin-ros', action='store_true', help='No conectar con ROS aunque esté disponible')
    args = a.parse_args()
    PUENTE = puente_ros.Puente.__new__(puente_ros.Puente)
    if args.sin_ros:
        PUENTE.disponible, PUENTE.motivo = False, 'Desactivado con --sin-ros.'
        PUENTE.q, PUENTE.t = {'sim': None, 'real': None}, {'sim': 0.0, 'real': 0.0}
    else:
        PUENTE = puente_ros.iniciar()
    anfitrion = '0.0.0.0' if args.red else '127.0.0.1'
    servidor = ThreadingHTTPServer((anfitrion, args.puerto), Manejador)
    servidor.daemon_threads = True
    servidor.nombre = 'localhost'
    print(f'SO-ARM100 Estudio en http://127.0.0.1:{args.puerto}  (ROS: {"sí" if PUENTE.disponible else "no — " + PUENTE.motivo})', flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        sesion.detener()


if __name__ == '__main__':
    main()
