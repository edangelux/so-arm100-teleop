#!/usr/bin/env python3
"""Ensayo A3: carga útil.

El brazo va a una serie de posturas de prueba y sostiene cada una REPOSO s.
Se registran el error de posición y el esfuerzo (carga del servo, en % de su
par máximo) de cada articulación. Se ejecuta una vez sin carga y otra con
cada masa colgada de la pinza, con la etiqueta correspondiente:

  python3 pruebas/ensayos/ensayo_carga.py --modo real --etiqueta sin_carga
  python3 pruebas/ensayos/ensayo_carga.py --modo real --etiqueta 50g
  python3 pruebas/ensayos/ensayo_carga.py --modo real --etiqueta 80g

analizar.py compara las corridas: cuánto crece el esfuerzo y el error en
hombro y codo con cada masa. Un esfuerzo que se acerca al 100 % o un error
que crece mucho indican que la masa está en el límite del servo.

Posturas por omisión (alcance horizontal desde el eje de la base, calculado
con la cinemática del proyecto):
  init         0, 0, 0, 0, 0          ~389 mm   antebrazo horizontal
  extendido    0, 0.5, -0.5, 0, 0     ~439 mm   brazo inclinado hacia adelante
  medio        0, -0.9, 0.9, 0, 0     ~290 mm
"""
import argparse
import sys
import time

from comun import carpeta_resultados, confirmar, ejecutar

POSES = {
    'init': [0.0, 0.0, 0.0, 0.0, 0.0],
    'extendido': [0.0, 0.5, -0.5, 0.0, 0.0],
    'medio': [0.0, -0.9, 0.9, 0.0, 0.0],
}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--modo', choices=['real', 'sim'], default='real')
    p.add_argument('--etiqueta', required=True, help='sin_carga, 50g, 80g...')
    p.add_argument('--poses', default='medio,init,extendido')
    p.add_argument('--reposo', type=float, default=5.0)
    p.add_argument('--salida', default=None)
    p.add_argument('--si', action='store_true')
    a = p.parse_args()
    nombres = a.poses.split(',')
    if any(n not in POSES for n in nombres):
        print('Posturas disponibles: ' + ', '.join(POSES))
        return 2
    if not confirmar(f'Carga útil «{a.etiqueta}» en modo {a.modo}: posturas {", ".join(nombres)}, '
                     f'{a.reposo:.0f} s cada una.\nCuelgue la masa de la pinza antes de empezar. '
                     'Si el brazo cede o vibra, Ctrl+C y apague la fuente.', a.si):
        print('Cancelado.')
        return 1
    ruta = carpeta_resultados(a.salida) / f'a3_carga_{a.etiqueta}_{a.modo}_{time.strftime("%H%M%S")}.csv'
    meta = {'tipo': 'carga', 'modo': a.modo, 'carga': a.etiqueta, 'poses': nombres,
            'reposo_s': a.reposo, 'fecha': time.strftime('%Y-%m-%d %H:%M:%S')}

    def cuerpo(b):
        for n in nombres:
            b.etiqueta = 'mover'
            b.ir(POSES[n], 0.4)
            b.etiqueta = f'reposo|{n}'
            b.pausa(a.reposo)
            err = [o - q for o, q in zip(POSES[n], b.q)]
            print(f'  {n:<10} error hombro {err[1]:+.4f}  codo {err[2]:+.4f} rad   '
                  f'esfuerzo hombro {b.e[1]:+.1f} %  codo {b.e[2]:+.1f} %')
        b.etiqueta = 'mover'
        b.ir(POSES['init'], 0.4)
        print('Ensayo terminado; el brazo está en init.')

    return ejecutar(a.modo, cuerpo, ruta, meta)


if __name__ == '__main__':
    sys.exit(main())
