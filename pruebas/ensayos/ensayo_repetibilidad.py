#!/usr/bin/env python3
"""Ensayo A2: repetibilidad de postura (inspirado en ISO 9283).

El brazo vuelve CICLOS veces a la misma postura objetivo, siempre desde la
misma postura de retiro y en el mismo sentido, y en cada llegada se sostiene
REPOSO s. Se registra la posición medida de cada articulación en cada
llegada; analizar.py calcula con la cinemática directa del proyecto dónde
quedó la punta de la pinza en cada ciclo y la repetibilidad
RP = l̄ + 3·S_l, donde l es la distancia de cada llegada al centro de la nube.

Con un lápiz sujeto en la pinza y una hoja fija debajo, cada llegada deja un
punto: la nube de puntos en el papel es la medida física, independiente de
los encoders del propio servo.

Objetivo:
  --pose actual   la postura en que está el brazo al empezar (por ejemplo,
                  colocado con MoveIt con el lápiz tocando el papel)
  --pose init     o cualquier postura de scripts/poses_seguras.json
  --objetivo "q1,q2,q3,q4,q5"   radianes

Uso:
  python3 pruebas/ensayos/ensayo_repetibilidad.py --modo real --pose actual
"""
import argparse
import json
import sys
import time

from comun import REPO, carpeta_resultados, confirmar, ejecutar, recortar


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--modo', choices=['real', 'sim'], default='real')
    g = p.add_mutually_exclusive_group()
    g.add_argument('--pose', default='actual')
    g.add_argument('--objetivo', default=None)
    p.add_argument('--retiro', default='0,-0.2,0,0,0',
                   help='Desplazamiento de la postura de retiro, en rad (0,-0.2,0,0,0: hombro hacia atrás y arriba)')
    p.add_argument('--ciclos', type=int, default=30)
    p.add_argument('--reposo', type=float, default=2.0)
    p.add_argument('--velocidad', type=float, default=0.4, help='rad/s de aproximación (0.4)')
    p.add_argument('--salida', default=None)
    p.add_argument('--si', action='store_true')
    a = p.parse_args()
    retiro = [float(x) for x in a.retiro.split(',')]
    if len(retiro) != 5 or max(abs(x) for x in retiro) > 0.5:
        print('--retiro: cinco valores de no más de 0,5 rad.')
        return 2
    if not 5 <= a.ciclos <= 100:
        print('--ciclos: entre 5 y 100.')
        return 2

    fijo = None
    if a.objetivo:
        fijo = recortar([float(x) for x in a.objetivo.split(',')])
    elif a.pose != 'actual':
        poses = json.loads((REPO / 'scripts' / 'poses_seguras.json').read_text(encoding='utf-8'))
        if a.pose not in poses or a.pose.startswith('_'):
            print(f'Postura desconocida: {a.pose}')
            return 2
        fijo = recortar(poses[a.pose])
    if not confirmar(f'Repetibilidad en modo {a.modo}: {a.ciclos} ciclos hacia '
                     f'{"la postura actual" if fijo is None else fijo}, retiro {retiro}.\n'
                     'Si usa lápiz, compruebe que en el retiro se levanta del papel.', a.si):
        print('Cancelado.')
        return 1

    ruta = carpeta_resultados(a.salida) / f'a2_repetibilidad_{a.modo}_{time.strftime("%H%M%S")}.csv'
    meta = {'tipo': 'repetibilidad', 'modo': a.modo, 'ciclos': a.ciclos, 'retiro_rad': retiro,
            'reposo_s': a.reposo, 'velocidad_rad_s': a.velocidad, 'fecha': time.strftime('%Y-%m-%d %H:%M:%S')}

    def cuerpo(b):
        objetivo = fijo if fijo is not None else recortar(b.q)
        meta['objetivo_rad'] = [round(x, 4) for x in objetivo]
        print('Objetivo:', ' '.join(f'{x:+.3f}' for x in objetivo))
        salida = recortar([o + r for o, r in zip(objetivo, retiro)])
        for c in range(1, a.ciclos + 1):
            b.etiqueta = 'retiro'
            b.ir(salida, a.velocidad)
            b.etiqueta = 'aproximacion'
            b.ir(objetivo, a.velocidad)
            b.etiqueta = f'llegada|{c}'
            b.pausa(a.reposo)
            err = max(abs(o - q) for o, q in zip(objetivo, b.q))
            print(f'  ciclo {c:2d}: error máximo {err:.4f} rad')
        b.etiqueta = 'retiro'
        b.ir(salida, a.velocidad)
        print('Ensayo terminado; el brazo queda en la postura de retiro.')

    return ejecutar(a.modo, cuerpo, ruta, meta)


if __name__ == '__main__':
    sys.exit(main())
