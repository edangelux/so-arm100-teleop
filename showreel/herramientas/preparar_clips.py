#!/usr/bin/env python3
"""Corta los videos reales del proyecto y los deja como secuencias de cuadros JPEG.

La página de escenas no reproduce video: en cada cuadro del montaje muestra la
imagen que toca, así el resultado es exacto cuadro por cuadro.

Los videos originales no se suben al repositorio (pesan y tienen personas); se
ponen a mano en showreel/originales/ con los nombres de la tabla CLIPS.

Uso:
  python showreel/herramientas/preparar_clips.py
"""
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIG = RAIZ / 'showreel' / 'originales'
SALIDA = RAIZ / 'showreel' / 'salida' / 'clips'

# nombre: (archivo, inicio s, duración s, filtro de ffmpeg)
CLIPS = {
    # Grabación de pantalla del 2 de septiembre: la cámara con MediaPipe y Gazebo copiando.
    'teleop_gazebo': ('teleop_gazebo_2026-09-02.mp4', 28.0, 16.0, 'crop=760:372:905:54,scale=1480:-2:flags=lanczos'),
    # Defensa del proyecto (video del 30 de septiembre): el operador mueve el brazo y el robot físico lo copia.
    'defensa': ('defensa_2026-09-30.mp4', 12.0, 22.0, 'transpose=2,scale=1280:-2:flags=lanczos'),
    # El brazo físico en la estación de trabajo, 15 de septiembre.
    'brazo_estacion': ('brazo_estacion_2026-09-15.mp4', 4.0, 14.0, 'scale=720:-2:flags=lanczos'),
    # El brazo físico subiendo de home a init, 28 de septiembre.
    'brazo_init': ('brazo_init_2026-09-28.mp4', 0.5, 12.0, 'scale=720:-2:flags=lanczos'),
    # Ensamble en SolidWorks.
    'ensamble_cad': ('ensamble_cad.mp4', 0.0, 8.4, 'scale=1600:-2:flags=lanczos'),
}


def main():
    for nombre, (archivo, ini, dur, filtro) in CLIPS.items():
        fuente = ORIG / archivo
        if not fuente.exists():
            print(f'falta {fuente}')
            continue
        destino = SALIDA / nombre
        destino.mkdir(parents=True, exist_ok=True)
        for viejo in destino.glob('*.jpg'):
            viejo.unlink()
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(ini), '-t', str(dur), '-i', str(fuente),
                        '-vf', f'{filtro},fps=30', '-q:v', '3', str(destino / '%04d.jpg')], check=True)
        print(nombre, len(list(destino.glob('*.jpg'))), 'cuadros')


if __name__ == '__main__':
    main()
