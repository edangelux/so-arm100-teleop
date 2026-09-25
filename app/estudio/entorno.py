"""Lo que la aplicación necesita saber del equipo: entorno, configuración, brazo y cámaras.

Reproduce en Python la lógica de scripts/atajos.bash y scripts/elegir_camara.sh
para que la aplicación y la terminal se comporten igual y compartan la misma
configuración (~/.soarm.conf).
"""
import concurrent.futures as cf
import glob
import os
import re
import shutil
import subprocess
import urllib.request
from pathlib import Path

from .rutas import CONF

DEFECTOS = {
    'SOARM_CAM': '0', 'SOARM_PUERTO': '/dev/ttyACM0', 'SOARM_MODO': 'auto', 'SOARM_VERSION': '14',
    'SOARM_MOVEIT': '1', 'SOARM_VELOCIDAD': '', 'SOARM_BUSID': '', 'SOARM_SOFTWARE_GL': 'auto',
    'SOARM_CAM_TIPO': '', 'SOARM_CAM_IP': '', 'SOARM_CAM_DEV': '',
}


# ------------------------------------------------------------ entorno
def entorno():
    """wsl, vm o nativo."""
    if os.environ.get('WSL_DISTRO_NAME'):
        return 'wsl'
    try:
        if re.search(r'microsoft.*wsl|wsl2', Path('/proc/version').read_text().lower()):
            return 'wsl'
    except OSError:
        pass
    if shutil.which('systemd-detect-virt'):
        r = subprocess.run(['systemd-detect-virt'], capture_output=True, text=True)
        if r.stdout.strip() not in ('', 'none', 'wsl'):
            return 'vm'
    return 'nativo'


def software_gl(conf=None):
    conf = conf or leer_conf()
    v = conf.get('SOARM_SOFTWARE_GL', 'auto')
    if v in ('0', '1'):
        return v == '1'
    return entorno() != 'nativo'


# ------------------------------------------------------------ configuración
def leer_conf():
    conf = dict(DEFECTOS)
    if CONF.exists():
        for linea in CONF.read_text(encoding='utf-8').splitlines():
            m = re.match(r'^\s*(SOARM_[A-Z_]+)="?(.*?)"?\s*$', linea)
            if m:
                conf[m.group(1)] = m.group(2)
    return conf


def guardar_conf(cambios):
    texto = CONF.read_text(encoding='utf-8') if CONF.exists() else \
        '# Configuración de los atajos del SO-ARM100. La comparten la terminal y la aplicación.\n'
    for k, v in cambios.items():
        if not re.fullmatch(r'SOARM_[A-Z_]+', k):
            continue
        v = str(v).replace('"', '')
        if re.search(rf'^{k}=', texto, flags=re.M):
            texto = re.sub(rf'^{k}=.*$', f'{k}="{v}"', texto, flags=re.M)
        else:
            texto += f'{k}="{v}"\n'
    CONF.write_text(texto, encoding='utf-8')


# ------------------------------------------------------------ brazo
def puertos():
    return sorted(glob.glob('/dev/ttyACM*') + glob.glob('/dev/ttyUSB*'))


def en_grupo(nombre):
    try:
        import grp
        return any(grp.getgrgid(g).gr_name == nombre for g in os.getgroups())
    except Exception:
        return False


def conectar_brazo(conf=None):
    """Devuelve (puerto o None, mensaje). En WSL2 intenta pasar la placa con usbipd."""
    conf = conf or leer_conf()
    if os.path.exists(conf['SOARM_PUERTO']):
        return conf['SOARM_PUERTO'], 'Brazo conectado.'
    lista = puertos()
    if len(lista) == 1:
        return lista[0], f'Brazo encontrado en {lista[0]}.'
    ent = entorno()
    if ent == 'wsl' and shutil.which('usbipd.exe'):
        busid = conf.get('SOARM_BUSID')
        if not busid:
            r = subprocess.run(['usbipd.exe', 'list'], capture_output=True, text=True)
            for linea in r.stdout.replace('\r', '').splitlines():
                if re.search(r'CH34|USB-SERIAL|USB Serial', linea, re.I):
                    busid = linea.split()[0]
                    break
        if busid:
            r = subprocess.run(['usbipd.exe', 'attach', '--wsl', '--busid', busid], capture_output=True, text=True)
            if r.returncode != 0:
                return None, ('Windows no dejó pasar la placa a WSL. Ejecute una sola vez en PowerShell como '
                              f'administrador: usbipd bind --busid {busid}')
            import time
            for _ in range(20):
                lista = puertos()
                if lista:
                    return lista[0], f'Placa conectada desde Windows ({busid}) en {lista[0]}.'
                time.sleep(0.5)
    if len(lista) > 1:
        return None, f'Hay varios puertos serie ({", ".join(lista)}); elija el del brazo en la configuración.'
    ayuda = {
        'wsl': 'Conecte el cable USB de la placa de los servos. En WSL2 también hace falta usbipd en Windows (winget install usbipd).',
        'vm': 'Conecte el cable USB de la placa y páselo a la máquina virtual: en VirtualBox, menú Dispositivos → USB; en VMware, VM → Dispositivos extraíbles.',
        'nativo': 'Conecte el cable USB de la placa de los servos y encienda su fuente.',
    }[ent]
    return None, 'No se encontró el brazo. ' + ayuda


# ------------------------------------------------------------ cámaras
def camaras_locales():
    """Cámaras con su nodo de captura, marcadas como física o virtual."""
    res = []
    for d in sorted(glob.glob('/sys/class/video4linux/video*')):
        try:
            if Path(d, 'index').read_text().strip() != '0':
                continue            # nodos de metadatos de la misma cámara
            nombre = Path(d, 'name').read_text().strip()
        except OSError:
            continue
        driver = os.path.basename(os.path.realpath(os.path.join(d, 'device', 'driver')))
        virtual = 'loopback' in driver or re.search(r'dummy|loopback|obs|droidcam|virtual', nombre, re.I)
        dev = '/dev/' + os.path.basename(d)
        res.append({'dev': dev, 'indice': int(dev.replace('/dev/video', '')), 'nombre': nombre,
                    'clase': 'virtual' if virtual else 'fisica'})
    return res


def probar_local(dev):
    if not os.path.exists(dev):
        return False, f'{dev} no existe.'
    if not (os.access(dev, os.R_OK) and os.access(dev, os.W_OK)):
        return False, f'Sin permiso sobre {dev}: el usuario debe estar en el grupo video.'
    if not shutil.which('v4l2-ctl'):
        return True, 'Disponible.'
    try:
        r = subprocess.run(['v4l2-ctl', '-d', dev, '--stream-mmap', '--stream-count=1', '--stream-to=/dev/null'],
                           capture_output=True, text=True, timeout=8)
    except subprocess.TimeoutExpired:
        return False, f'{dev} no entregó ninguna imagen en 8 s.'
    if r.returncode == 0:
        return True, 'Entrega imagen.'
    if 'busy' in (r.stderr + r.stdout).lower():
        return False, f'{dev} está ocupada por otra aplicación (videollamada, navegador, OBS).'
    return False, f'{dev} no entregó imagen.'


_sin_proxy = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def a_url(entrada):
    e = entrada.strip().replace(' ', '')
    if re.match(r'^(https?|rtsp)://', e):
        return e
    if re.fullmatch(r'[0-9.]+:[0-9]+', e):
        return f'http://{e}/video'
    return f'http://{e}:4747/video'


def probar_url(url, espera=3.0):
    """libre, ocupado, sin_respuesta u otro."""
    try:
        with _sin_proxy.open(url, timeout=espera) as r:
            tipo = (r.headers.get('Content-Type') or '').lower()
    except Exception:
        return 'sin_respuesta'
    if tipo.startswith(('multipart/', 'image/', 'video/')):
        return 'libre'
    if tipo.startswith('text/html'):
        return 'ocupado'
    return 'otro'


def subredes():
    pref = []
    try:
        r = subprocess.run(['ip', '-4', '-o', 'addr', 'show', 'scope', 'global'], capture_output=True, text=True)
        pref += re.findall(r'inet (\d+\.\d+\.\d+)\.\d+', r.stdout)
    except FileNotFoundError:
        pass
    if entorno() == 'wsl' and shutil.which('ipconfig.exe'):
        r = subprocess.run(['ipconfig.exe'], capture_output=True, text=True)
        for linea in r.stdout.replace('\r', '').splitlines():
            if 'ipv4' in linea.lower():
                pref += re.findall(r'(\d+\.\d+\.\d+)\.\d+', linea)
    vistos = []
    for p in pref:
        if p.startswith('127.') or re.match(r'172\.(1[6-9]|2\d|3[01])\.', p):
            continue
        if p not in vistos:
            vistos.append(p)
    return vistos[:3]


def buscar_telefonos(prefijos=None):
    prefijos = prefijos or subredes()
    candidatos = [(f'{p}.{h}', pto) for p in prefijos for h in range(1, 255) for pto in (4747, 8080)]

    def uno(c):
        ip, pto = c
        estado = probar_url(f'http://{ip}:{pto}/video', 0.8)
        return {'ip': ip, 'puerto': pto, 'app': 'DroidCam' if pto == 4747 else 'IP Webcam', 'estado': estado} \
            if estado in ('libre', 'ocupado') else None

    with cf.ThreadPoolExecutor(96) as ex:
        return {'subredes': prefijos, 'encontrados': [r for r in ex.map(uno, candidatos) if r]}
