#!/usr/bin/env python3
"""Registrador de la teleoperación (ensayos B1 y B2: fidelidad del espejo).

Graba, en cada mensaje de estados articulares, la última orden que envió la
teleoperación y la posición real del brazo. Mientras graba, en esta terminal
se escriben etiquetas que marcan el instante:

  Elbow 90        el operador tiene el codo a 90° de la postura de calibración
  Shoulder_Pitch 0
  nota: texto libre
  fin             termina y guarda (también Ctrl+C)

La orden de la teleoperación es el ángulo humano estimado por la cámara, ya
convertido con signo y ganancia; la posición es lo que hizo el brazo.
analizar.py compara las dos con la referencia de cada etiqueta, medida con
transportador: el primer error es de percepción y el segundo es el total.

Se abre en otra terminal con el lanzador y la teleoperación en marcha:
  python3 pruebas/ensayos/registrador.py --modo real --version v15
"""
import argparse
import sys
import threading
import time

import rclpy
from trajectory_msgs.msg import JointTrajectory

from comun import ART, NAN, Brazo, carpeta_resultados

ORDEN = {'sim': '/arm_controller/joint_trajectory', 'real': '/real/arm_controller/joint_trajectory',
         'ambos': '/arm_controller/joint_trajectory'}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--modo', choices=['real', 'sim', 'ambos'], default='real')
    p.add_argument('--version', default='v15', help='Sólo se anota en el archivo (v13, v14, v15)')
    p.add_argument('--salida', default=None)
    a = p.parse_args()
    ruta = carpeta_resultados(a.salida) / f'b1_fidelidad_{a.version}_{a.modo}_{time.strftime("%H%M%S")}.csv'
    meta = {'tipo': 'fidelidad', 'modo': a.modo, 'version': a.version,
            'fecha': time.strftime('%Y-%m-%d %H:%M:%S')}

    rclpy.init()
    b = Brazo('sim' if a.modo == 'sim' else 'real')
    ultima = [NAN] * 5

    def orden(msg):
        if msg.points:
            idx = {n: i for i, n in enumerate(msg.joint_names)}
            for k, n in enumerate(ART):
                if n in idx:
                    ultima[k] = float(msg.points[-1].positions[idx[n]])
            b.objetivo = list(ultima)

    b.create_subscription(JointTrajectory, ORDEN[a.modo], orden, 50)
    terminar = threading.Event()

    def teclado():
        print('Grabando. Escriba «Articulación grados» (p. ej. «Elbow 90»), «nota: ...» o «fin».')
        print('Articulaciones: ' + ', '.join(ART))
        while not terminar.is_set():
            try:
                linea = input('> ').strip()
            except EOFError:
                break
            if linea.lower() == 'fin':
                break
            if linea:
                b.etiqueta = 'marca|' + linea
                print(f'  marcado «{linea}»')
                time.sleep(1.5)            # el análisis promedia 1 s tras la marca
                b.etiqueta = 'teleop'
        terminar.set()

    try:
        if not b.esperar(lambda: b.q is not None, 5.0):
            print('No llegan estados articulares; ¿está abierto el lanzador?')
            return 2
        b.etiqueta = 'teleop'
        b.grabando = True
        threading.Thread(target=teclado, daemon=True).start()
        while not terminar.is_set():
            rclpy.spin_once(b, timeout_sec=0.05)
    except KeyboardInterrupt:
        pass
    finally:
        b.grabando = False
        if b.muestras:
            b.guardar(ruta, meta)
        b.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())
