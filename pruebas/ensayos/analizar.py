#!/usr/bin/env python3
"""Analiza los archivos de los ensayos de docs/17 y escribe un resumen con gráficas.

  python3 pruebas/ensayos/analizar.py pruebas/resultados/2026-09-22
  python3 pruebas/ensayos/analizar.py archivo1.csv archivo2.csv

Reconoce el tipo de cada CSV por su cabecera (# tipo: ...): estatico (A1),
repetibilidad (A2), carga (A3), termico (A4), escalon (A5) y fidelidad (B1).
Escribe resumen.md y las gráficas PNG en la carpeta del primer archivo, o en
--salida. Sólo necesita numpy y matplotlib.
"""
import argparse
import csv
import math
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

import numpy as np

ART = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
REPO = Path(__file__).resolve().parents[2]
DEG = 180.0 / math.pi

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except Exception:          # sin matplotlib se escriben sólo las tablas
    plt = None


def leer(ruta):
    meta, filas = {}, []
    with open(ruta, encoding='utf-8') as f:
        lineas = [l for l in f]
    for l in lineas:
        if l.startswith('# ') and ':' in l:
            k, v = l[2:].split(':', 1)
            meta[k.strip()] = v.strip()
    datos = [l for l in lineas if not l.startswith('#')]
    for fila in csv.DictReader(datos):
        filas.append(fila)
    return meta, filas


def grupos(filas, prefijo):
    """Agrupa filas consecutivas cuya etiqueta empieza por prefijo|, en orden."""
    g = OrderedDict()
    for r in filas:
        et = r['etiqueta']
        if et.startswith(prefijo + '|'):
            g.setdefault(et, []).append(r)
    return g


def arr(filas, campo):
    return np.array([float(r[campo]) for r in filas])


def tabla(cab, filas):
    s = '| ' + ' | '.join(cab) + ' |\n|' + '|'.join(['---'] * len(cab)) + '|\n'
    for f in filas:
        s += '| ' + ' | '.join(str(x) for x in f) + ' |\n'
    return s


def cola(filas, segundos=1.0):
    t = arr(filas, 't')
    return [r for r, ti in zip(filas, t) if ti >= t[-1] - segundos]


# ---------------------------------------------------------------- A1
def estatico(meta, filas, nombre, salida):
    por = defaultdict(list)
    en_init = defaultdict(list)
    for et, g in grupos(filas, 'reposo').items():
        _, junta, rep, k, val = et.split('|')
        c = cola(g)
        err = np.mean(arr(c, f'obj_{junta}') - arr(c, f'pos_{junta}'))
        esf = np.mean(arr(c, f'esf_{junta}'))
        por[junta].append((float(val), err, esf))
        if abs(float(val)) < 1e-6:
            for n in ART:
                en_init[n].append(np.mean(arr(c, f'obj_{n}') - arr(c, f'pos_{n}')))
    out = f'### A1 — Precisión estática (`{nombre}`)\n\nModo {meta.get("modo")}, amplitud {meta.get("amplitud_rad")} rad.\n\n'
    filas_t = []
    for n in ART:
        if n not in por:
            continue
        v = np.array(por[n])
        e = v[:, 1] * DEG
        pos, neg = e[v[:, 0] > 0], e[v[:, 0] < 0]
        filas_t.append([n, len(e), f'{np.mean(e):+.2f}', f'{np.std(e):.2f}', f'{np.max(np.abs(e)):.2f}',
                        f'{np.mean(pos):+.2f}' if len(pos) else '—', f'{np.mean(neg):+.2f}' if len(neg) else '—',
                        f'{np.mean(np.abs(v[:, 2])):.1f}'])
    out += tabla(['Articulación', 'Puntos', 'Error medio (°)', 'Desv. (°)', 'Máx. |error| (°)',
                  'Error en +A (°)', 'Error en −A (°)', '|Esfuerzo| medio (%)'], filas_t)
    if en_init:
        out += '\n**Error de cada articulación con el brazo en init** (qué articulación se queda corta):\n\n'
        out += tabla(['Articulación', 'Error medio en init (°)'],
                     [[n, f'{np.mean(en_init[n]) * DEG:+.2f}'] for n in ART if en_init[n]])
    if plt:
        fig, ax = plt.subplots(figsize=(7, 4))
        for n in por:
            v = np.array(por[n])
            ax.scatter(v[:, 0] * DEG, v[:, 1] * DEG, label=n, s=18)
        ax.axhline(0, color='k', lw=0.5)
        ax.set_xlabel('Orden (°)'); ax.set_ylabel('Error = orden − medido (°)')
        ax.set_title('A1 — Error estático por articulación'); ax.legend(fontsize=7); ax.grid(alpha=0.3)
        png = salida / f'{Path(nombre).stem}.png'; fig.tight_layout(); fig.savefig(png, dpi=130); plt.close(fig)
        out += f'\n![A1]({png.name})\n'
    return out


# ---------------------------------------------------------------- A5
def escalon(meta, filas, nombre, salida):
    res = defaultdict(list)
    curvas = defaultdict(list)
    for et, g in grupos(filas, 'escalon').items():
        _, junta, rep, k, val = et.split('|')
        t = arr(g, 't'); t = t - t[0]
        y = arr(g, f'pos_{junta}')
        y0 = np.mean(y[:3]); yf = np.mean(y[t >= t[-1] - 0.5]); paso = yf - y0
        if abs(paso) < 0.02:
            continue
        rel = (y - y0) / paso
        mov = np.where(np.abs(y - y0) > 0.02)[0]
        retardo = t[mov[0]] if len(mov) else math.nan
        t10 = t[np.argmax(rel >= 0.1)]; t90 = t[np.argmax(rel >= 0.9)]
        sobre = max(0.0, (np.max(rel) - 1.0) * 100)
        banda = max(0.02, 0.05 * abs(paso))
        fuera = np.where(np.abs(y - yf) > banda)[0]
        estab = t[fuera[-1]] if len(fuera) else 0.0
        res[junta].append((retardo, t90 - t10, estab, sobre, (float(val) - yf) * DEG))
        curvas[junta].append((t, rel))
    out = f'### A5 — Respuesta al escalón (`{nombre}`)\n\nAmplitud {meta.get("amplitud_rad")} rad, trayectoria de {meta.get("duracion_escalon_s")} s.\n\n'
    out += tabla(['Articulación', 'Escalones', 'Retardo (ms)', 'Subida 10-90 % (ms)', 'Establecimiento (ms)',
                  'Sobrepaso (%)', 'Error final (°)'],
                 [[n, len(v := np.array(res[n])), f'{np.nanmean(v[:, 0]) * 1000:.0f}', f'{np.mean(v[:, 1]) * 1000:.0f}',
                   f'{np.mean(v[:, 2]) * 1000:.0f}', f'{np.mean(v[:, 3]):.1f}', f'{np.mean(v[:, 4]):+.2f}']
                  for n in ART if res[n]])
    if plt and curvas:
        fig, ax = plt.subplots(figsize=(7, 4))
        for n, cs in curvas.items():
            for i, (t, rel) in enumerate(cs):
                ax.plot(t * 1000, rel, lw=0.9, label=n if i == 0 else None,
                        color=f'C{ART.index(n)}')
        ax.axhline(1, color='k', lw=0.5); ax.set_xlim(0, 1500)
        ax.set_xlabel('Tiempo desde la orden (ms)'); ax.set_ylabel('Respuesta normalizada')
        ax.set_title('A5 — Respuesta al escalón'); ax.legend(fontsize=7); ax.grid(alpha=0.3)
        png = salida / f'{Path(nombre).stem}.png'; fig.tight_layout(); fig.savefig(png, dpi=130); plt.close(fig)
        out += f'\n![A5]({png.name})\n'
    return out


# ---------------------------------------------------------------- A2
def punta(q):
    sys.path.insert(0, str(REPO / 'analisis' / 'cinematica' / 'codigo'))
    import cinematica
    T, _ = cinematica.fk_urdf(np.asarray(q, float))
    return T[:3, 3] * 1000.0


def repetibilidad(meta, filas, nombre, salida):
    llegadas = []
    for et, g in grupos(filas, 'llegada').items():
        c = cola(g)
        llegadas.append([np.mean(arr(c, f'pos_{n}')) for n in ART])
    llegadas = np.array(llegadas)
    out = f'### A2 — Repetibilidad (`{nombre}`)\n\n{len(llegadas)} llegadas.\n\n'
    if len(llegadas) < 3:
        return out + 'Muy pocas llegadas para calcular.\n'
    out += tabla(['Articulación', 'Desviación (°)', 'Rango (°)'],
                 [[n, f'{np.std(llegadas[:, i]) * DEG:.3f}', f'{np.ptp(llegadas[:, i]) * DEG:.3f}']
                  for i, n in enumerate(ART)])
    try:
        P = np.array([punta(q) for q in llegadas])
        centro = P.mean(axis=0)
        l = np.linalg.norm(P - centro, axis=1)
        rp = l.mean() + 3 * l.std(ddof=1)
        out += (f'\nPunta de la pinza, por cinemática directa de las posiciones medidas: '
                f'distancia media al centro {l.mean():.3f} mm, desviación {l.std(ddof=1):.3f} mm, '
                f'**RP = l̄ + 3·S = {rp:.3f} mm**.\n\n'
                'Es la repetibilidad según los encoders del propio servo; la nube de puntos del lápiz '
                'en el papel es la medida externa y puede ser mayor por holguras que el encoder no ve.\n')
        if plt:
            fig, axs = plt.subplots(1, 2, figsize=(8, 3.8))
            for ax, (a, b, na, nb) in zip(axs, ((0, 1, 'x', 'y'), (1, 2, 'y', 'z'))):
                ax.scatter(P[:, a] - centro[a], P[:, b] - centro[b], s=12)
                ax.set_xlabel(f'{na} (mm)'); ax.set_ylabel(f'{nb} (mm)'); ax.axis('equal'); ax.grid(alpha=0.3)
            fig.suptitle(f'A2 — Llegadas de la punta respecto del centro (RP = {rp:.2f} mm)')
            png = salida / f'{Path(nombre).stem}.png'; fig.tight_layout(); fig.savefig(png, dpi=130); plt.close(fig)
            out += f'\n![A2]({png.name})\n'
    except Exception as e:
        out += f'\nNo se pudo calcular la punta: {e}\n'
    return out


# ---------------------------------------------------------------- A3
def carga(archivos, salida):
    out = '### A3 — Carga útil\n\n'
    filas_t, barras = [], defaultdict(dict)
    for nombre, meta, filas in archivos:
        et = meta.get('carga', '?')
        for g_et, g in grupos(filas, 'reposo').items():
            pose = g_et.split('|')[1]
            c = cola(g, 2.0)
            e = [np.mean(arr(c, f'obj_{n}') - arr(c, f'pos_{n}')) * DEG for n in ART]
            f = [np.mean(arr(c, f'esf_{n}')) for n in ART]
            filas_t.append([et, pose, f'{e[1]:+.2f}', f'{e[2]:+.2f}', f'{e[3]:+.2f}',
                            f'{f[1]:+.1f}', f'{f[2]:+.1f}', f'{f[3]:+.1f}'])
            barras[pose][et] = (abs(f[1]), abs(f[2]))
    out += tabla(['Carga', 'Postura', 'Error hombro (°)', 'Error codo (°)', 'Error muñeca (°)',
                  'Esfuerzo hombro (%)', 'Esfuerzo codo (%)', 'Esfuerzo muñeca (%)'], filas_t)
    if plt and barras:
        poses = list(barras); cargas = sorted({c for p in barras.values() for c in p})
        fig, axs = plt.subplots(1, 2, figsize=(9, 3.8))
        for k, (ax, tit) in enumerate(zip(axs, ('Hombro', 'Codo'))):
            ancho = 0.8 / max(len(cargas), 1)
            for i, c in enumerate(cargas):
                ax.bar(np.arange(len(poses)) + i * ancho, [barras[p].get(c, (0, 0))[k] for p in poses],
                       ancho, label=c)
            ax.set_xticks(np.arange(len(poses)) + 0.4 - ancho / 2); ax.set_xticklabels(poses)
            ax.set_ylabel('|Esfuerzo| (% del par máximo)'); ax.set_title(tit); ax.grid(alpha=0.3, axis='y')
        axs[0].legend(fontsize=8); fig.suptitle('A3 — Esfuerzo sostenido con cada carga')
        png = salida / 'a3_carga.png'; fig.tight_layout(); fig.savefig(png, dpi=130); plt.close(fig)
        out += f'\n![A3]({png.name})\n'
    return out


# ---------------------------------------------------------------- A4
def termico(meta, ruta, nombre, salida):
    datos = defaultdict(list)
    with open(ruta, encoding='utf-8') as f:
        for r in csv.DictReader(l for l in f if not l.startswith('#')):
            datos[int(r['id'])].append((float(r['t_s']), float(r['temp_C']), float(r['carga_pm']) / 10))
    fin = meta.get('fin', 'sin marca de fin')
    out = f'### A4 — Temperatura (`{nombre}`)\n\n{meta.get("minutos")} min previstos, amplitud {meta.get("amplitud_grados")}°, límite {meta.get("limite_C")} °C; terminó por: {fin}.\n\n'
    out += tabla(['Servo', 'Inicial (°C)', 'Final (°C)', 'Máxima (°C)', 'Subida (°C)', '|Carga| media (%)'],
                 [[i, f'{v[0][1]:.0f}', f'{v[-1][1]:.0f}', f'{max(x[1] for x in v):.0f}',
                   f'{v[-1][1] - v[0][1]:+.0f}', f'{np.mean([abs(x[2]) for x in v]):.1f}']
                  for i, v in sorted(datos.items())])
    if plt and datos:
        fig, ax = plt.subplots(figsize=(7, 4))
        for i, v in sorted(datos.items()):
            v = np.array(v); ax.plot(v[:, 0] / 60, v[:, 1], label=f'Servo {i}')
        ax.set_xlabel('Tiempo (min)'); ax.set_ylabel('Temperatura (°C)'); ax.grid(alpha=0.3)
        ax.set_title('A4 — Temperatura de los servos'); ax.legend(fontsize=7)
        png = salida / f'{Path(nombre).stem}.png'; fig.tight_layout(); fig.savefig(png, dpi=130); plt.close(fig)
        out += f'\n![A4]({png.name})\n'
    return out


# ---------------------------------------------------------------- B1
def fidelidad(meta, filas, nombre, salida):
    filas_t, errs = [], defaultdict(lambda: ([], []))
    for et, g in grupos(filas, 'marca').items():
        texto = et.split('|', 1)[1]
        partes = texto.split()
        if len(partes) != 2 or partes[0] not in ART:
            continue
        n, ref = partes[0], float(partes[1])
        t = arr(g, 't'); c = [r for r, ti in zip(g, t) if ti >= t[0] + 0.3]
        orden = np.nanmean(arr(c, f'obj_{n}')) * DEG
        real = np.mean(arr(c, f'pos_{n}')) * DEG
        ep, et_ = abs(orden) - abs(ref), abs(real) - abs(ref)
        errs[n][0].append(ep); errs[n][1].append(et_)
        filas_t.append([n, f'{ref:.0f}', f'{orden:+.1f}', f'{real:+.1f}', f'{ep:+.1f}', f'{et_:+.1f}'])
    out = f'### B1 — Fidelidad del espejo, {meta.get("version")} (`{nombre}`)\n\n'
    out += tabla(['Articulación', 'Referencia (°)', 'Orden (°)', 'Brazo (°)', 'Error de percepción (°)',
                  'Error total (°)'], filas_t)
    if errs:
        out += '\nResumen (magnitudes; el signo depende de la convención de cada articulación):\n\n'
        out += tabla(['Articulación', 'Marcas', '|Error de percepción| medio (°)', '|Error total| medio (°)'],
                     [[n, len(v[0]), f'{np.mean(np.abs(v[0])):.1f}', f'{np.mean(np.abs(v[1])):.1f}']
                      for n, v in errs.items()])
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('entradas', nargs='+')
    p.add_argument('--salida', default=None)
    a = p.parse_args()
    rutas = []
    for e in a.entradas:
        e = Path(e)
        rutas += sorted(e.glob('*.csv')) if e.is_dir() else [e]
    if not rutas:
        print('No hay archivos CSV.'); return 1
    salida = Path(a.salida) if a.salida else rutas[0].parent
    salida.mkdir(parents=True, exist_ok=True)
    partes, cargas = [], []
    for r in rutas:
        meta, _ = leer(r)
        tipo = meta.get('tipo')
        if tipo == 'termico':
            partes.append(termico(meta, r, r.name, salida)); continue
        meta, filas = leer(r)
        if tipo == 'estatico':
            partes.append(estatico(meta, filas, r.name, salida))
        elif tipo == 'escalon':
            partes.append(escalon(meta, filas, r.name, salida))
        elif tipo == 'repetibilidad':
            partes.append(repetibilidad(meta, filas, r.name, salida))
        elif tipo == 'carga':
            cargas.append((r.name, meta, filas))
        elif tipo == 'fidelidad':
            partes.append(fidelidad(meta, filas, r.name, salida))
        else:
            print(f'Se omite {r.name}: tipo desconocido.')
    if cargas:
        partes.append(carga(cargas, salida))
    texto = '# Resultados de los ensayos\n\n' + '\n'.join(partes)
    (salida / 'resumen.md').write_text(texto, encoding='utf-8')
    print(texto)
    print(f'\nResumen escrito en {salida / "resumen.md"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
