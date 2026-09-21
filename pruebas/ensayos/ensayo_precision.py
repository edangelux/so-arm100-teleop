#!/usr/bin/env python3
"""Ensayos A1 (precisión estática) y A5 (respuesta al escalón) por articulación.

A1, --tipo estatico
    Cada articulación, por separado y con las demás en init, visita la serie
    0, +A, 0, −A, 0, +A/2, 0, −A/2, 0 a 0,5 rad/s y se sostiene REPOSO s en
    cada punto. El error estático es la orden menos la posición medida al
    final del reposo; el esfuerzo registrado muestra cuánto trabaja el servo
    para sostener esa postura. Responde qué articulación se queda corta y si
    el error depende del sentido (gravedad) o de la amplitud.

A5, --tipo escalon
    Cada articulación recibe escalones de ±A con una duración de trayectoria
    muy corta (0,10 s por omisión): el controlador pide casi un salto y se
    registra cómo responde el servo real. De ahí salen el retardo, el tiempo
    de subida (10-90 %), el tiempo de establecimiento y el sobrepaso.
    Entre escalones vuelve despacio a 0.

Uso (con el lanzador abierto y la teleoperación cerrada con Q):
  python3 pruebas/ensayos/ensayo_precision.py --tipo estatico --modo real
  python3 pruebas/ensayos/ensayo_precision.py --tipo escalon  --modo real --amplitud 0.3
"""
import argparse
import sys
import time

from comun import ART, carpeta_resultados, confirmar, ejecutar


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--tipo', choices=['estatico', 'escalon'], required=True)
    p.add_argument('--modo', choices=['real', 'sim'], default='real')
    p.add_argument('--amplitud', type=float, default=None,
                   help='rad; 0.5 en estatico y 0.3 en escalon por omisión')
    p.add_argument('--articulaciones', default='1,2,3,4,5',
                   help='Números 1-5 en el orden Shoulder_Rotation..Wrist_Roll (1,2,3,4,5)')
    p.add_argument('--repeticiones', type=int, default=2)
    p.add_argument('--reposo', type=float, default=2.0, help='s de registro en cada punto (2.0)')
    p.add_argument('--duracion-escalon', type=float, default=0.10, help='s de la trayectoria del escalón (0.10)')
    p.add_argument('--salida', default=None, help='Carpeta de resultados')
    p.add_argument('--si', action='store_true', help='No pedir confirmación')
    a = p.parse_args()

    amp = a.amplitud if a.amplitud is not None else (0.5 if a.tipo == 'estatico' else 0.3)
    if not 0.05 <= amp <= (0.8 if a.tipo == 'estatico' else 0.5):
        print('Amplitud fuera de rango: estatico 0,05-0,8 rad; escalon 0,05-0,5 rad.')
        return 2
    juntas = [int(x) - 1 for x in a.articulaciones.split(',')]
    if any(j not in range(5) for j in juntas):
        print('Articulaciones: números del 1 al 5.')
        return 2
    if a.tipo == 'estatico':
        serie = [0, amp, 0, -amp, 0, amp / 2, 0, -amp / 2, 0]
    else:
        serie = [amp, -amp]
    nombres = ', '.join(ART[j] for j in juntas)
    aviso = (f'Ensayo {a.tipo} en modo {a.modo}: {nombres}; amplitud {amp:.2f} rad '
             f'({amp * 57.2958:.0f} grados), {a.repeticiones} repeticiones.\n'
             'El brazo parte de init y vuelve a init. Pinza vacía, espacio libre, mano en el interruptor.')
    if a.tipo == 'escalon':
        aviso += (f'\nCada escalón pide recorrer {amp:.2f} rad en {a.duracion_escalon:.2f} s: el brazo '
                  'se moverá tan rápido como el servo permita.')
    if not confirmar(aviso, a.si):
        print('Cancelado.')
        return 1

    ruta = carpeta_resultados(a.salida) / f'{"a1_estatico" if a.tipo == "estatico" else "a5_escalon"}_{a.modo}_{time.strftime("%H%M%S")}.csv'
    meta = {'tipo': a.tipo, 'modo': a.modo, 'amplitud_rad': amp, 'articulaciones': nombres,
            'repeticiones': a.repeticiones, 'reposo_s': a.reposo,
            'duracion_escalon_s': a.duracion_escalon, 'fecha': time.strftime('%Y-%m-%d %H:%M:%S')}

    def cuerpo(b):
        b.etiqueta = 'mover'
        b.ir([0.0] * 5)
        for rep in range(1, a.repeticiones + 1):
            for j in juntas:
                for k, valor in enumerate(serie):
                    q = [0.0] * 5
                    q[j] = valor
                    if a.tipo == 'estatico':
                        b.etiqueta = 'mover'
                        b.ir(q)
                        b.etiqueta = f'reposo|{ART[j]}|{rep}|{k}|{valor:+.3f}'
                        b.pausa(a.reposo)
                        print(f'  {ART[j]:<17} rep {rep} punto {k}: orden {valor:+.3f}  '
                              f'medido {b.q[j]:+.3f}  error {valor - b.q[j]:+.4f} rad  esfuerzo {b.e[j]:+.1f} %')
                    else:
                        b.etiqueta = 'mover'
                        b.ir([0.0] * 5)
                        b.pausa(0.5)
                        b.etiqueta = f'escalon|{ART[j]}|{rep}|{k}|{valor:+.3f}'
                        b.enviar(q, a.duracion_escalon)
                        b.pausa(2.5)
                        print(f'  {ART[j]:<17} rep {rep} escalón {valor:+.3f}: medido al final {b.q[j]:+.3f}')
        b.etiqueta = 'mover'
        b.ir([0.0] * 5)
        print('Ensayo terminado; el brazo está en init.')

    return ejecutar(a.modo, cuerpo, ruta, meta)


if __name__ == '__main__':
    sys.exit(main())
