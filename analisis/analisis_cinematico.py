#!/usr/bin/env python3
"""
=============================================================================
ANALISIS CINEMATICO — SO-ARM100
Mapeo articular directo frente a cinematica inversa en espacio de tarea
=============================================================================

Este script produce los numeros que se citan en docs/08-analisis-cinematico.md.
No necesita ROS ni el robot: solo numpy. Se ejecuta con

    python3 analisis/analisis_cinematico.py

Todas las constantes del robot salen del URDF real
(so_arm_100_description/urdf/so_arm_100_5dof_arm.urdf.xacro). Las del operador
son antropometria adulta media (Winter, "Biomechanics and Motor Control of
Human Movement").
=============================================================================
"""
import numpy as np

rng = np.random.default_rng(0)

# --- Robot: valores tomados del URDF ---------------------------------------
# L1 = norma del origin xyz del joint Elbow        -> (0, 0.11257, 0.028)
# L2 = norma del origin xyz del joint Wrist_Pitch  -> (0, 0.0052, 0.1349)
L1, L2 = 0.1160, 0.1350
R = L1 + L2
LIM_Q2 = (-1.745, 1.745)     # Shoulder_Pitch  <limit>
LIM_Q3 = (-1.500, 1.500)     # Elbow           <limit>

# --- Operador --------------------------------------------------------------
H1, H2 = 0.300, 0.270        # brazo y antebrazo, adulto medio
RANGO_HOMBRO = (-1.05, 3.14)  # -60 deg .. 180 deg
RANGO_CODO   = (0.00, 2.53)   #   0 deg .. 145 deg

N = 200_000


def fk2(l1, l2, q2, q3):
    """Cinematica directa de la cadena plana de 2 eslabones."""
    return (l1 * np.cos(q2) + l2 * np.cos(q2 + q3),
            l1 * np.sin(q2) + l2 * np.sin(q2 + q3))


def ik2(r, z):
    """Cinematica inversa, rama codo-abajo. Devuelve tambien si esta fuera."""
    d2 = r * r + z * z
    c3 = (d2 - L1 * L1 - L2 * L2) / (2 * L1 * L2)
    fuera = np.abs(c3) > 1.0
    q3 = np.arccos(np.clip(c3, -1.0, 1.0))
    q2 = np.arctan2(z, r) - np.arctan2(L2 * np.sin(q3), L1 + L2 * np.cos(q3))
    return q2, q3, fuera


def titulo(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)


# Posturas del operador, uniformes en su rango articular
hq2 = rng.uniform(*RANGO_HOMBRO, N)
hq3 = rng.uniform(*RANGO_CODO, N)
hr, hz = fk2(H1, H2, hq2, hq3)


# =============================================================================
titulo("1. ESCALA")
# =============================================================================
print(f"  Alcance hombro-muneca del robot     {R:.3f} m")
print(f"  Alcance hombro-muneca del operador  {H1 + H2:.3f} m")
print(f"  Relacion                            1 : {(H1 + H2) / R:.1f}")
print()
print("  Consecuencia: la CI en espacio de tarea NO puede recibir la posicion")
print("  metrica de tu mano tal cual. Necesita un factor de escalado, y ese")
print("  factor es un parametro mas que hay que calibrar.")


# =============================================================================
titulo("2. ALCANZABILIDAD — que fraccion de tus posturas puede ejecutar el robot")
# =============================================================================
for s, etiqueta in [(1.00, "sin escalado"),
                    (R / (H1 + H2), f"escalado {R / (H1 + H2):.2f} (relacion de alcance)"),
                    (0.35, "escalado 0.35")]:
    q2, q3, fuera = ik2(hr * s, hz * s)
    ok = (~fuera
          & (q2 >= LIM_Q2[0]) & (q2 <= LIM_Q2[1])
          & (q3 >= LIM_Q3[0]) & (q3 <= LIM_Q3[1]))
    print(f"  CI, {etiqueta:38} {100 * ok.mean():5.1f} % ejecutable")

saturado = ((hq2 < LIM_Q2[0]) | (hq2 > LIM_Q2[1])
            | (hq3 < LIM_Q3[0]) | (hq3 > LIM_Q3[1]))
print(f"  Mapeo articular directo{'':<35}{100 * (~saturado).mean():5.1f} % sin saturar")
print()
print("  La diferencia importante no es el porcentaje, es el MODO DE FALLO:")
print("  - CI fuera de alcance   -> no hay solucion; el robot se queda o salta.")
print("  - Mapeo directo saturado-> el angulo se recorta al limite del joint y")
print("                             el robot sigue moviendose en tu direccion.")


# =============================================================================
titulo("3. AMPLIFICACION DEL ERROR — el argumento decisivo")
# =============================================================================
print("  Cuanto error articular produce 1 mm de error en la posicion medida,")
print("  segun donde este el brazo dentro de su espacio de trabajo.\n")
print("   d / R          error articular por 1 mm      fuera de alcance")
print("   ------------   ---------------------------   ----------------")

M = 200_000
frac = rng.uniform(0.05, 0.999, M)
ang = rng.uniform(-1.2, 1.2, M)
r0, z0 = frac * R * np.cos(ang), frac * R * np.sin(ang)
SIGMA = 0.001  # 1 mm

for lo, hi in [(0.05, 0.50), (0.50, 0.80), (0.80, 0.90),
               (0.90, 0.95), (0.95, 0.98), (0.98, 0.999)]:
    m = (frac >= lo) & (frac < hi)
    q2a, q3a, _ = ik2(r0[m], z0[m])
    n = rng.normal(0, SIGMA, m.sum())
    q2b, q3b, f = ik2(r0[m] + n * np.cos(ang[m]), z0[m] + n * np.sin(ang[m]))
    e = np.degrees(np.abs(q2b - q2a) + np.abs(q3b - q3a))
    print(f"   {lo:.2f} - {hi:.3f}   {np.mean(e):6.2f} deg"
          f"  (p99 {np.percentile(e, 99):6.2f} deg)      {100 * f.mean():5.1f} %")

e_dir = np.degrees(np.arctan(SIGMA / H2))
print()
print(f"   Mapeo directo   {e_dir:6.2f} deg  (constante)              0.0 %")
print()
print("  Los dos extremos de la tabla son las singularidades de la cadena de")
print("  dos eslabones: brazo totalmente plegado (d/R bajo) y totalmente")
print("  extendido (d/R -> 1). Ahi det(J) -> 0 y la CI amplifica el ruido.")
print("  El mapeo directo no invierte nada, asi que su error no depende de la")
print("  postura: es el mismo en todo el espacio de trabajo.")


# =============================================================================
titulo("4. MANIPULABILIDAD — lo que muestra el HUD como 'w='")
# =============================================================================
print("  w = sqrt(det(J @ J.T)) para la cadena de 3 GDL de posicion.")
print("  Es la misma funcion manipulability() de teleop_vision.py.\n")


def manipulabilidad(q1, q2, q3):
    r = L1 * np.cos(q2) + L2 * np.cos(q2 + q3)
    dr2 = -L1 * np.sin(q2) - L2 * np.sin(q2 + q3)
    dr3 = -L2 * np.sin(q2 + q3)
    dz2 = L1 * np.cos(q2) + L2 * np.cos(q2 + q3)
    dz3 = L2 * np.cos(q2 + q3)
    c1, s1 = np.cos(q1), np.sin(q1)
    J = np.array([[-r * s1, c1 * dr2, c1 * dr3],
                  [r * c1, s1 * dr2, s1 * dr3],
                  [0.0, dz2, dz3]])
    return np.sqrt(max(np.linalg.det(J @ J.T), 0.0))


for nombre, q in [("brazo plegado    (q3 = 0.0)", (0.0, 0.0, 0.00)),
                  ("codo a 45 deg    (q3 = 0.8)", (0.0, 0.0, 0.80)),
                  ("codo a 90 deg    (q3 = 1.5)", (0.0, 0.0, 1.50)),
                  ("brazo extendido  (q3 = 0.0)", (0.0, 1.2, 0.00))]:
    print(f"   {nombre:32} w = {manipulabilidad(*q):.6f}")
print()
print("  Cerca de cero = cerca de una singularidad. En el lazo de control esto")
print("  NO se usa: solo se muestra en pantalla para que el operador sepa que")
print("  esta llegando a una postura degenerada.")

print()
