#!/usr/bin/env python3
"""Música original del video: dark / slap house a 120 BPM, sintetizada aquí mismo.

No usa muestras ni pistas de nadie: cada sonido (bombo, palmas, platillos, bajo,
acordes, arpegio, subidas e impactos) se calcula con numpy. Así el video no tiene
problemas de derechos y el compás de la música coincide exacto con los cortes:
a 120 BPM un tiempo dura 0,5 s y un compás 2 s, y cada escena dura 8 compases.

Uso:
  python showreel/herramientas/musica.py showreel/salida/musica.wav

Para usar una pista propia en su lugar, basta con que esté a 120 BPM y empiece en
el primer tiempo; montar.py la acepta con --musica.
"""
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
BPM = 120
TIEMPO = 60 / BPM            # 0,5 s
COMPAS = 4 * TIEMPO          # 2 s
PASO = TIEMPO / 4            # semicorchea
COMPASES = 88                # 176 s: 11 escenas de 8 compases
COLA = 4.0
RNG = np.random.default_rng(7)

# Secciones, en compases (deben coincidir con escenas/linea_de_tiempo.js).
INTRO, SUBIDA1, DROP1, GROOVE1, PAUSA, DROP2, GROOVE2, FINAL = 0, 8, 16, 32, 40, 48, 64, 80


def seccion(c):
    for nombre, ini in (('final', FINAL), ('groove2', GROOVE2), ('drop2', DROP2), ('pausa', PAUSA),
                        ('groove1', GROOVE1), ('drop1', DROP1), ('subida1', SUBIDA1)):
        if c >= ini:
            return nombre
    return 'intro'


def nota(n):
    """Número MIDI → Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, fc, orden=2):
    return sosfilt(butter(orden, min(fc, SR / 2 - 100), 'low', fs=SR, output='sos'), x)


def hp(x, fc, orden=2):
    return sosfilt(butter(orden, fc, 'high', fs=SR, output='sos'), x)


def bp(x, f1, f2, orden=2):
    return sosfilt(butter(orden, [f1, f2], 'band', fs=SR, output='sos'), x)


def env(n, ataque, caida, sostenido=0.0):
    t = np.arange(n) / SR
    a = np.clip(t / max(ataque, 1e-4), 0, 1)
    return a * (sostenido + (1 - sostenido) * np.exp(-t / caida))


class Pista:
    def __init__(self, segundos):
        self.n = int(segundos * SR)
        self.buses = {}

    def bus(self, nombre):
        if nombre not in self.buses:
            self.buses[nombre] = np.zeros((self.n, 2))
        return self.buses[nombre]

    def poner(self, nombre, t, x, pan=0.0, ganancia=1.0):
        b = self.bus(nombre)
        i = int(t * SR)
        if i >= self.n:
            return
        x = x[: self.n - i]
        if x.ndim == 1:
            izq, der = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            x = np.stack([x * izq, x * der], axis=1) * np.sqrt(2)
        b[i: i + len(x)] += x * ganancia


# ------------------------------------------------------------------ sonidos
def bombo():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    fase = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(fase) * np.exp(-t / 0.28)
    clic = lp(RNG.standard_normal(n) * np.exp(-t / 0.004), 6000) * 0.35
    return np.tanh(1.6 * (x + clic)) * 0.9


def palmas():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    ruido = RNG.standard_normal(n)
    e = np.zeros(n)
    for k, d in enumerate((0.0, 0.011, 0.022)):
        e += np.where(t >= d, np.exp(-(t - d) / 0.006), 0) * (0.8 + 0.1 * k)
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.09), 0) * 0.6
    return bp(ruido * e, 900, 2600) * 1.4


def platillo(abierto=False):
    n = int((0.32 if abierto else 0.05) * SR)
    t = np.arange(n) / SR
    x = hp(RNG.standard_normal(n), 7000, 4) * np.exp(-t / (0.11 if abierto else 0.012))
    return x * (0.45 if abierto else 0.35)


def sierra(f, n, desafinar=0.0, fase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * (1 + desafinar) * t + fase) % 1) - 1


def bajo_slap(f, dur):
    """Bajo de slap house: sierra aditiva con un filtro que se abre y se cierra muy
    rápido (el «wah» corto) y una caída de tono al empezar."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    tono = f * (1 + 0.5 * np.exp(-t / 0.012))
    fase = 2 * np.pi * np.cumsum(tono) / SR
    corte = 180 + 2600 * np.exp(-t / 0.055)
    x = np.zeros(n)
    for k in range(1, 60):
        fk = k * f
        if fk > 6000:
            break
        g = 1 / (1 + (fk / corte) ** 4)
        reso = 1 + 1.8 * np.exp(-((fk - corte) / (0.25 * corte + 1)) ** 2)
        x += np.sin(k * fase) / k * g * reso
    e = env(n, 0.002, 0.16, 0.25) * np.clip((dur - t) / 0.01, 0, 1)
    sub = np.sin(fase) * env(n, 0.003, 0.25, 0.5) * np.clip((dur - t) / 0.01, 0, 1)
    return np.tanh(1.4 * x * e) * 0.55 + sub * 0.5


def sub_largo(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.1, 0, 1) * 0.7


def acorde_pad(notas, dur, corte=1400):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros((n, 2))
    for m in notas:
        for v, d in enumerate((-0.012, -0.005, 0.0, 0.006, 0.013)):
            s = sierra(nota(m), n, d, RNG.random())
            pan = (v - 2) / 2.5
            x[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
            x[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    x /= len(notas) * 5
    ataque = np.clip(t / 0.6, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    x = np.stack([lp(x[:, 0], corte, 2), lp(x[:, 1], corte, 2)], 1)
    return x * ataque[:, None] * 0.9


def pulsacion(notas, dur=0.28, brillo=3500):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notas:
        for d in (-0.006, 0.006):
            x += sierra(nota(m), n, d, RNG.random())
    x /= len(notas) * 2
    corte = 300 + brillo * np.exp(-t / 0.05)
    # Filtro que se cierra: se aplica por bloques cortos.
    y = np.zeros(n)
    bloque = 256
    for i in range(0, n, bloque):
        y[i:i + bloque] = lp(x[max(0, i - 2048):i + bloque], corte[i])[-len(x[i:i + bloque]):]
    return y * env(n, 0.002, 0.09, 0.0) * 0.8


def subida(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    ruido = RNG.standard_normal(n)
    y = np.zeros(n)
    bloque = 1024
    for i in range(0, n, bloque):
        fc = 400 + 9000 * p[i] ** 2
        y[i:i + bloque] = bp(ruido[max(0, i - 4096):i + bloque], fc * 0.7, min(fc * 1.3, 20000))[-len(ruido[i:i + bloque]):]
    tono = np.sin(2 * np.pi * np.cumsum(200 + 1400 * p ** 2) / SR) * 0.15
    return (y * 0.6 + tono) * p ** 1.6


def impacto():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    choque = hp(RNG.standard_normal(n), 3000) * np.exp(-t / 0.6) * 0.25
    return np.tanh(1.5 * boom) * 0.9 + choque


def platillo_inverso(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (hp(RNG.standard_normal(n), 4000) * np.exp(-(dur - t) / (dur * 0.35)) * 0.35)[::1]


def reverb(x, segundos=2.2, mezcla=1.0):
    n = int(segundos * SR)
    t = np.arange(n) / SR
    ir = np.stack([RNG.standard_normal(n), RNG.standard_normal(n)], 1) * np.exp(-t / (segundos / 6.9))[:, None]
    ir[:, 0] = lp(ir[:, 0], 6000)
    ir[:, 1] = lp(ir[:, 1], 6000)
    ir /= np.sqrt((ir ** 2).sum(0))
    y = np.stack([fftconvolve(x[:, 0], ir[:, 0])[: len(x)], fftconvolve(x[:, 1], ir[:, 1])[: len(x)]], 1)
    return y * mezcla


# ------------------------------------------------------------------ armonía
# La menor oscura: Am – F – G – Em, un acorde cada dos compases.
ACORDES = [
    (45, [57, 60, 64, 67]),   # Am(add9 sin la 9): A2 bajo; A3 C4 E4 G4
    (41, [57, 60, 65, 69]),   # F/A en voces cercanas
    (43, [55, 59, 62, 67]),   # G
    (40, [55, 59, 64, 67]),   # Em7
]


def acorde_en(c):
    return ACORDES[(c // 2) % 4]


def componer(salida):
    p = Pista(COMPASES * COMPAS + COLA)
    k = bombo()
    cl = palmas()
    hc, ho = platillo(False), platillo(True)
    kicks = []

    for c in range(COMPASES):
        s = seccion(c)
        t0 = c * COMPAS
        raiz, voces = acorde_en(c)
        lleno = s in ('drop1', 'drop2')
        ritmo = s in ('subida1', 'drop1', 'groove1', 'drop2', 'groove2') or (s == 'final' and c < FINAL + 4)

        # Bombo y sidechain
        if ritmo or (s == 'intro' and c >= 4):
            for b in range(4):
                g = 0.55 if s == 'intro' else 1.0
                p.poner('bombo', t0 + b * TIEMPO, lp(k, 900) if s == 'intro' else k, ganancia=g)
                kicks.append(t0 + b * TIEMPO)
        # Palmas en 2 y 4
        if ritmo and s != 'subida1' or (s == 'subida1' and c >= SUBIDA1 + 4):
            for b in (1, 3):
                p.poner('palmas', t0 + b * TIEMPO, cl, ganancia=0.55)
        # Platillos
        if ritmo:
            for b in range(4):
                p.poner('platillos', t0 + b * TIEMPO + TIEMPO / 2, ho, pan=0.25, ganancia=0.6)
            if lleno or s.startswith('groove'):
                for st in range(16):
                    if st % 2 == 1:
                        p.poner('platillos', t0 + st * PASO, hc, pan=-0.3, ganancia=0.35 + 0.15 * (st % 4 == 3))
        # Bajo slap en los contratiempos
        if s == 'subida1':
            # Antes del primer drop sólo el sub, largo, para que el bajo slap llegue con el drop.
            p.poner('bajo', t0, sub_largo(nota(raiz), COMPAS * 0.95), ganancia=0.6)
        elif ritmo and s != 'final':
            for st in (2, 6, 10, 14, 15) if lleno else (2, 6, 10, 14):
                f = nota(raiz + (12 if (st == 14 and c % 2 == 1) else 0))
                dur = PASO * (1.6 if st != 15 else 0.9)
                p.poner('bajo', t0 + st * PASO, bajo_slap(f, dur), ganancia=0.9 if lleno else 0.7)
        # Acordes de fondo
        if c % 2 == 0:
            corte = {'intro': 700 + 120 * c, 'pausa': 1800, 'final': 1100}.get(s, 1300)
            g = {'intro': 0.8, 'pausa': 1.3, 'final': 0.8}.get(s, 0.35)
            p.poner('pad', t0, acorde_pad(voces, 2 * COMPAS + 0.6, corte), ganancia=g)
        # Pulsaciones (el «gancho») en los drops
        if lleno:
            for st in (0, 3, 6, 10, 12):
                p.poner('gancho', t0 + st * PASO, pulsacion([v + 12 for v in voces[1:]], brillo=4200), pan=0.15 * (1 if st % 2 else -1), ganancia=0.55)
        # Arpegio en la intro avanzada y en la pausa
        if (s == 'intro' and c >= 4) or s == 'pausa':
            sube = (c - PAUSA) / 8 if s == 'pausa' else 0.3
            orden = voces + [voces[1] + 12, voces[2] + 12, voces[3] + 12, voces[0] + 12]
            for st in range(16):
                m = orden[st % len(orden)] + 12
                p.poner('arpegio', t0 + st * PASO, pulsacion([m], 0.18, 1500 + 3500 * sube),
                        pan=0.4 * np.sin(st), ganancia=0.5 + 0.35 * sube)
        # Redoble antes del segundo drop
        if c == DROP2 - 1:
            for st in range(16):
                p.poner('palmas', t0 + st * PASO, cl, ganancia=0.15 + 0.5 * st / 15)

    # Subidas, impactos y platillos inversos alrededor de los cambios de sección
    for c_drop, compases in ((SUBIDA1, 2), (DROP1, 2), (DROP2, 4), (FINAL, 2)):
        t = c_drop * COMPAS
        p.poner('fx', t - compases * COMPAS, subida(compases * COMPAS), ganancia=0.5)
        p.poner('fx', t - 1.0, platillo_inverso(1.0), ganancia=0.8)
        p.poner('impacto', t, impacto(), ganancia=0.9)
    p.poner('impacto', 0.0, impacto(), ganancia=0.7)
    p.poner('impacto', GROOVE1 * COMPAS, impacto(), ganancia=0.45)
    p.poner('impacto', GROOVE2 * COMPAS, impacto(), ganancia=0.45)

    # Sidechain: el bajo y los acordes se apartan del bombo
    t = np.arange(p.n) / SR
    duck = np.ones(p.n)
    for tk in kicks:
        i = int(tk * SR)
        j = min(p.n, i + int(0.35 * SR))
        duck[i:j] = np.minimum(duck[i:j], 1 - 0.7 * np.exp(-(t[i:j] - tk) / 0.09))
    for b in ('bajo', 'pad', 'arpegio', 'gancho'):
        if b in p.buses:
            p.buses[b] *= duck[:, None] ** (1.0 if b != 'bajo' else 0.6)

    mezcla = (p.bus('bombo') * 1.0 + p.bus('palmas') * 0.8 + p.bus('platillos') * 0.7 + p.bus('bajo') * 0.9
              + p.bus('pad') * 0.7 + p.bus('gancho') * 0.7 + p.bus('arpegio') * 0.6 + p.bus('fx') * 0.7
              + p.bus('impacto') * 0.8)
    envio = p.bus('palmas') * 0.3 + p.bus('pad') * 0.5 + p.bus('gancho') * 0.35 + p.bus('arpegio') * 0.5 + p.bus('fx') * 0.3
    mezcla += reverb(envio, 2.4) * 0.6
    mezcla = hp(mezcla.T, 28).T
    # Final: desvanecer en los últimos compases
    fin = FINAL * COMPAS + 4 * COMPAS
    mezcla *= np.clip(1 - (t - fin) / (COMPASES * COMPAS + COLA - fin), 0, 1)[:, None] ** 1.5
    # Limitador suave
    mezcla = np.tanh(mezcla * 1.1) / np.tanh(1.1)
    mezcla *= 0.89 / np.max(np.abs(mezcla))
    import soundfile as sf
    Path(salida).parent.mkdir(parents=True, exist_ok=True)
    sf.write(salida, mezcla.astype(np.float32), SR, subtype='PCM_24')
    print(f'{salida}: {len(mezcla) / SR:.1f} s, {BPM} BPM, {COMPASES} compases')


if __name__ == '__main__':
    componer(sys.argv[1] if len(sys.argv) > 1 else 'showreel/salida/musica.wav')
