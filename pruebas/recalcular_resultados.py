"""Recalcula los indicadores del proyecto a partir de los registros originales.

Lee los CSV de pruebas/datos_originales/ sin modificarlos, escribe el detalle
completo en resultados_recalculados.json e imprime una comparación entre las
cifras publicadas en el documento del proyecto y las que se obtienen aquí.

    python3 pruebas/recalcular_resultados.py
"""
from pathlib import Path
import csv
import json
import statistics

ROOT = Path(__file__).resolve().parent


def stats(values):
    ordered = sorted(values)
    def percentile(p):
        pos = (len(ordered) - 1) * p
        lo = int(pos)
        hi = min(lo + 1, len(ordered) - 1)
        return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)
    return dict(n=len(values), media=statistics.mean(values), minimo=min(values),
                maximo=max(values), mediana=statistics.median(values),
                p95=percentile(.95), p99=percentile(.99))


def time_series(name):
    with (ROOT / 'datos_originales' / name).open(newline='') as stream:
        rows = [[float(x) for x in row] for row in csv.reader(stream)]
    if not rows or any(len(row) != 2 for row in rows):
        raise ValueError(f'Formato inválido: {name}')
    segments = []
    start = 0
    for i in range(1, len(rows)):
        delta = rows[i][0] - rows[i-1][0]
        if delta > 10 or delta < 0:
            segments.append((start, i))
            start = i
    segments.append((start, len(rows)))
    report = dict(globales=stats([r[1] for r in rows]),
                  criterio_segmentacion='Se abre un tramo nuevo ante un salto temporal mayor de 10 s o un retroceso del reloj. Es una separación por huecos del registro, no una identificación certificada de sesiones.',
                  tramos=[])
    for a, b in segments:
        report['tramos'].append(dict(fila_inicial=a+1, fila_final=b,
                                    duracion_s=rows[b-1][0]-rows[a][0],
                                    **stats([r[1] for r in rows[a:b]])))
    first = rows[:segments[0][1]]
    return report, first


def main():
    angular = []
    per_servo = {}
    for file in sorted((ROOT / 'datos_originales').glob('angular_error_log_s*.csv')):
        with file.open(newline='') as stream:
            pairs = [[int(x) for x in row] for row in csv.reader(stream)]
        if len(pairs) != 6 or any(len(row) != 2 for row in pairs):
            raise ValueError(f'Se esperan seis pares de pasos del codificador: {file.name}')
        errors = [abs(target - measured) * 360 / 4096 for target, measured in pairs]
        per_servo[file.stem] = stats(errors)
        angular.extend(errors)
    if len(angular) != 30:
        raise ValueError('Se esperan 30 mediciones angulares.')
    fps, first_fps = time_series('fps_log.csv')
    latency, first_latency = time_series('latency_log.csv')
    # Poblaciones con las que se calcularon las cifras publicadas: el primer tramo de cada registro.
    fps['primer_tramo_sin_primera_muestra'] = stats([r[1] for r in first_fps[1:]])
    latency['primer_tramo_sin_valores_mayores_1000_ms'] = stats([r[1] for r in first_latency if r[1] <= 1000])
    latency['valores_excluidos_comparacion_ms'] = [r[1] for r in first_latency if r[1] > 1000]
    result = dict(angular_grados=stats(angular), por_servo=per_servo, fps=fps, procesamiento_ms=latency)
    (ROOT / 'resultados_recalculados.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n', encoding='utf8')
    f = fps['primer_tramo_sin_primera_muestra']
    l = latency['primer_tramo_sin_valores_mayores_1000_ms']
    a = result['angular_grados']
    serial = 0.93  # ms, promedio de bench_serial sobre 200 escrituras (anexo del documento)
    filas = [
        ('Desviación angular, promedio (°)', 0.492, a['media']),
        ('Desviación angular, máximo (°)', 1.494, a['maximo']),
        ('Procesamiento cámara → ROS 2 (ms)', 20.94, l['media']),
        ('Procesamiento + escritura serial (ms)', 21.87, l['media'] + serial),
        ('Canalización de visión, promedio (FPS)', 34.05, f['media']),
        ('Canalización de visión, mínimo (FPS)', 22.49, f['minimo']),
        ('Canalización de visión, máximo (FPS)', 36.63, f['maximo']),
    ]
    print(f"{'Indicador':42s} {'Publicado':>10s} {'Recalculado':>12s}")
    for nombre, pub, rec in filas:
        marca = 'coincide' if round(rec, 2 if pub > 2 else 3) == pub else 'DIFIERE'
        print(f'{nombre:42s} {pub:10.3f} {rec:12.3f}  {marca}')
    print(f"\nMuestras: angular {a['n']}, latencia {l['n']} (excluidos {latency['valores_excluidos_comparacion_ms']} ms), "
          f"visión {f['n']}.")
    print('Detalle completo, incluidas las sesiones posteriores: pruebas/resultados_recalculados.json')


if __name__ == '__main__':
    main()
