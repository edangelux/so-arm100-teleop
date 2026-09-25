"""Rutas del repositorio que usa la aplicación."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / 'app' / 'web'
LECCIONES = REPO / 'app' / 'lecciones'
DESCRIPCION = REPO / 'entrega' / 'src' / 'SO-100-arm' / 'so_arm_100_description'
MALLAS = DESCRIPCION / 'models' / 'so_arm_100_5dof' / 'meshes'
URDF = DESCRIPCION / 'urdf' / 'so_arm_100_5dof_arm.urdf.xacro'
SCRIPTS = REPO / 'scripts'
ENSAYOS = REPO / 'pruebas' / 'ensayos'
RESULTADOS = REPO / 'pruebas' / 'resultados'
POSES = SCRIPTS / 'poses_seguras.json'
CONF = Path.home() / '.soarm.conf'
