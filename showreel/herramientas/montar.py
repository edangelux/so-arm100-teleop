#!/usr/bin/env python3
"""Arma los entregables a partir de lo grabado:

  salida/so-arm100_video.mp4       video completo, 1920×1080, 30 fps, 2:56, con música
  salida/so-arm100_teaser.mp4      versión corta de 36 s, 16:9
  salida/so-arm100_teaser_9x16.mp4 la misma, vertical 1080×1920 (Instagram, TikTok, estados)
  salida/so-arm100_miniatura.jpg   miniatura 1280×720

Uso, desde la raíz del repositorio:
  python showreel/herramientas/montar.py [--musica otra_pista.wav]

Necesita salida/trozos/*.mp4 (capturar.mjs, en orden alfabético) y
salida/musica.wav (musica.py). La pista propia debe ir a 120 BPM y empezar en el
primer tiempo, para que los cortes caigan sobre el compás.
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
SAL = RAIZ / 'showreel' / 'salida'
FUENTES = RAIZ / 'app' / 'web' / 'vendor' / 'fuentes'
DURACION = 176.0

# Teaser: tramos de 2 compases (4 s) del video; la música es el final de la intro
# (12–16 s, la subida) y el primer drop (32–64 s).
TEASER = [12, 32, 74, 66, 52, 96, 129, 145, 172]
MUSICA_TEASER = [(12, 16), (32, 64)]


def ff(*args):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *map(str, args)], check=True)


def fuente(nombre, tam, peso=None):
    ttf = Path(tempfile.gettempdir()) / f'{nombre}.ttf'
    if not ttf.exists():
        f = TTFont(FUENTES / f'{nombre}.woff2')
        f.flavor = None
        f.save(ttf)
    letra = ImageFont.truetype(str(ttf), tam)
    if peso:
        letra.set_variation_by_axes([peso])
    return letra


def video_completo(musica):
    trozos = sorted((SAL / 'trozos').glob('*.mp4'))
    lista = SAL / 'trozos' / 'lista.txt'
    lista.write_text(''.join(f"file '{t.name}'\n" for t in trozos))
    # Parches: tramos que se volvieron a grabar después de un arreglo (por ejemplo
    # la transición entre escenas). p_<desde>_<hasta>.mp4 reemplaza esos cuadros.
    parches = sorted((SAL / 'parches').glob('p_*.mp4'), key=lambda p: int(p.stem.split('_')[1]))
    entradas = []
    filtros = []
    if parches:
        n = len(parches)
        filtros.append(f'[0:v]split={n + 1}' + ''.join(f'[s{i}]' for i in range(n + 1)))
        partes = []
        desde = 0
        for i, p in enumerate(parches):
            a, b = (int(x) for x in p.stem.split('_')[1:3])
            filtros.append(f'[s{i}]trim=start_frame={desde}:end_frame={a},setpts=PTS-STARTPTS[x{i}]')
            filtros.append(f'[{i + 2}:v]setpts=PTS-STARTPTS[p{i}]')
            partes += [f'[x{i}]', f'[p{i}]']
            entradas += ['-i', p]
            desde = b
        filtros.append(f'[s{n}]trim=start_frame={desde},setpts=PTS-STARTPTS[x{n}]')
        partes.append(f'[x{n}]')
        filtros.append(''.join(partes) + f'concat=n={len(partes)}:v=1:a=0[v]')
    else:
        filtros.append('[0:v]null[v]')
    salida = SAL / 'so-arm100_video.mp4'
    ff('-f', 'concat', '-safe', '0', '-i', lista, '-i', musica, *entradas,
       '-filter_complex', ';'.join(filtros), '-map', '[v]', '-map', '1:a',
       '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k',
       '-af', f'atrim=0:{DURACION},afade=t=out:st={DURACION - 2.5}:d=2.5', '-t', DURACION, '-movflags', '+faststart', salida)
    print(salida)
    return salida


def teaser(video, musica):
    # Cada tramo se lee con su propio -ss: recortar el mismo video nueve veces
    # dentro de un solo filtro obliga a ffmpeg a guardar en memoria todo lo anterior.
    entradas = []
    filtros = []
    for k, t in enumerate(TEASER):
        entradas += ['-ss', t, '-t', 4, '-i', video]
        filtros.append(f'[{k}:v]setpts=PTS-STARTPTS[v{k}]')
    filtros.append(''.join(f'[v{k}]' for k in range(len(TEASER))) + f'concat=n={len(TEASER)}:v=1:a=0[v]')
    m = len(TEASER)
    for k, (a, b) in enumerate(MUSICA_TEASER):
        filtros.append(f'[{m}:a]atrim={a}:{b},asetpts=PTS-STARTPTS[a{k}]')
    total = 4 * len(TEASER)
    filtros.append(''.join(f'[a{k}]' for k in range(len(MUSICA_TEASER))) + f'concat=n={len(MUSICA_TEASER)}:v=0:a=1,afade=t=out:st={total - 2}:d=2[a]')
    salida = SAL / 'so-arm100_teaser.mp4'
    ff(*entradas, '-i', musica, '-filter_complex', ';'.join(filtros), '-map', '[v]', '-map', '[a]',
       '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', salida)
    print(salida)
    return salida


def vertical(teaser16):
    # Rótulos de arriba y de abajo, dibujados con las mismas letras del video.
    capa = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    # Bandas oscuras detrás de los rótulos: el fondo desenfocado puede ser claro.
    for y in range(1920):
        borde = min(abs(y - 700), abs(y - 1340))
        if y < 700 or y > 1340:
            d.line([(0, y), (1080, y)], fill=(11, 8, 20, int(225 * min(1, 0.55 + borde / 160))))
    titulo = fuente('rubik-latin-wght-normal', 118, 900)
    sub = fuente('rubik-latin-wght-normal', 46, 500)
    mono = fuente('ibm-plex-mono-latin-500-normal', 30)
    d.rectangle([90, 330, 104, 344], fill='#c2ef4e')
    d.text((124, 322), 'ULSA · LEÓN · 2026', font=mono, fill='#c2ef4e')
    d.text((86, 380), 'SO-ARM100', font=titulo, fill='#f4f1ff')
    d.text((90, 520), 'Un brazo robótico que', font=sub, fill='#f4f1ff')
    d.text((90, 576), 'copia tu brazo con una cámara', font=sub, fill='#c2ef4e')
    d.rounded_rectangle([90, 1440, 990, 1520], radius=40, outline='#c2ef4e', width=3)
    d.text((540, 1480), 'github.com/Edangelux/so-arm100-teleop', font=mono, fill='#f4f1ff', anchor='mm')
    d.text((540, 1580), 'Código abierto · ROS 2 · MediaPipe', font=mono, fill='#a39cbd', anchor='mm')
    rot = SAL / 'rotulos_9x16.png'
    capa.save(rot)
    salida = SAL / 'so-arm100_teaser_9x16.mp4'
    ff('-i', teaser16, '-i', rot, '-filter_complex',
       '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.32:saturation=0.8[fondo];'
       '[0:v]scale=1080:-2[frente];[fondo][frente]overlay=0:(H-h)/2+40[v1];[v1][1:v]overlay=0:0[v]',
       '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', salida)
    print(salida)


def miniatura(video):
    salida = SAL / 'so-arm100_miniatura.jpg'
    ff('-ss', '15.2', '-i', video, '-frames:v', '1', '-vf', 'scale=1280:720', '-q:v', '2', salida)
    print(salida)


if __name__ == '__main__':
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--musica', default=str(SAL / 'musica.wav'))
    a.add_argument('--sin-video', action='store_true', help='No rehacer el video completo; sólo teaser, vertical y miniatura')
    args = a.parse_args()
    v = SAL / 'so-arm100_video.mp4' if args.sin_video else video_completo(args.musica)
    t = teaser(v, args.musica)
    vertical(t)
    miniatura(v)
