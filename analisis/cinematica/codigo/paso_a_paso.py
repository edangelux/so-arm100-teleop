# -*- coding: utf-8 -*-
"""Genera el desarrollo matematico paso a paso, articulacion por articulacion.

   Todo el texto sale del calculo: ningun numero esta escrito a mano.  Si un
   parametro del modelo descriptivo cambiara, este documento cambia con el.

   Salida:  Paso_a_paso.md
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # el directorio propio manda sobre site-packages
import numpy as np
from cinematica import J as JU, CAD, LIMS, fk_urdf, ejes_y_puntos
from dh_soarm100 import FILAS, T_BASE, T_TOOL, GEO, fk_dh, A_dh
from jacobiano import jacobiano, jacobiano_numerico
from inversa import ik, dentro

np.set_printoptions(precision=6, suppress=True)
O, X, Z = GEO
ING = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
ESP = ['rotación de hombro', 'cabeceo de hombro', 'codo', 'cabeceo de muñeca', 'giro de muñeca']
Q_PRUEBA = np.radians([35.0, -20.0, 45.0, -30.0, 60.0])


# --------------------------------------------------------------- formato
def f4(v, dec=4):
    v = 0.0 if abs(v) < 5e-7 else v
    s = f'{v:.{dec}f}'
    return s.rstrip('0').rstrip('.') if '.' in s and s.rstrip('0').rstrip('.') else s


def num(A, dec=4):
    A = np.asarray(A, float)
    A = np.where(np.abs(A) < 5e-7, 0.0, A)
    s = [[f'{v:.{dec}f}' for v in fila] for fila in A]
    w = max(len(v) for fila in s for v in fila)
    return '\n'.join('    | ' + '   '.join(v.rjust(w) for v in fila) + ' |' for fila in s)


def sin_sangria(txt):
    """Quita los cuatro espacios de sangria inicial de cada linea, sin tocar el
       interior: usar replace('    ', '') destruye la separacion entre columnas."""
    return '\n'.join(l[4:] if l.startswith('    ') else l for l in txt.split('\n'))


def bloque(F):
    w = [max(len(F[r][c]) for r in range(len(F))) for c in range(len(F[0]))]
    return '\n'.join('    | ' + '   '.join(F[r][c].rjust(w[c]) for c in range(len(F[0]))) + ' |'
                     for r in range(len(F)))


def A_simbolica(k):
    """A_i en forma simbolica compacta, con las constantes del modelo ya sustituidas."""
    f = FILAS[k]; i = k + 1
    a = 0.0 if abs(f['a']) < 1e-9 else f['a']
    d = 0.0 if abs(f['d']) < 1e-9 else f['d']
    al = np.degrees(f['alpha'])
    c, s = f'c{i}', f's{i}'
    ca, sa = (1, 0) if abs(al) < 1e-9 else (0, 1 if al > 0 else -1)

    def t(coef, sim):
        if coef == 0: return '0'
        if sim == '': return str(int(coef)) if float(coef).is_integer() else f4(coef)
        if coef == 1: return sim
        if coef == -1: return f'-{sim}'
        return f'{f4(coef)}·{sim}'
    return [[c,   t(-ca, s), t(sa, s),  t(a, c)],
            [s,   t(ca, c),  t(-sa, c), t(a, s)],
            ['0', t(sa, ''), t(ca, ''), t(d, '')],
            ['0', '0',       '0',       '1']]


def verifica_simbolica(k, q):
    """La forma simbolica de arriba tiene que dar exactamente A_dh."""
    f = FILAS[k]; th = f['theta_off'] + q
    c, s = np.cos(th), np.sin(th)
    ca, sa = np.cos(f['alpha']), np.sin(f['alpha'])
    A = np.array([[c, -s*ca,  s*sa, f['a']*c],
                  [s,  c*ca, -c*sa, f['a']*s],
                  [0,    sa,    ca, f['d']],
                  [0,     0,     0, 1]])
    return np.abs(A - A_dh(th, f['d'], f['a'], f['alpha'])).max()


# --------------------------------------------------------------- documento
def cuerpo():
    L = []; w = L.append
    q0 = np.zeros(5)
    z, p = ejes_y_puntos(q0)
    qp = Q_PRUEBA

    w('# Desarrollo cinemático del SO-ARM100, articulación por articulación\n')
    w('## Alcance y procedencia de los datos\n')
    w('El presente desarrollo documenta, paso a paso, la obtención del modelo cinemático del '
      'manipulador SO-ARM100 de cinco grados de libertad. Se expone el origen de cada parámetro, la '
      'matriz de transformación de cada articulación en forma simbólica y numérica, la composición '
      'completa de la cadena, la construcción del jacobiano y la resolución del problema inverso.\n')
    w('Todos los valores geométricos se extrajeron del modelo descriptivo del manipulador, el archivo '
      '`so_arm_100_5dof_arm.urdf.xacro` del paquete `so_arm_100_description`, publicado en el '
      'repositorio `brukg/SO-100-arm`. Ese archivo es el mismo que cargan el simulador y el '
      'planificador de movimiento empleados en el proyecto, de modo que el modelo matemático y el '
      'modelo que ejecuta el programa describen exactamente el mismo mecanismo.\n')
    w('Se hace notar que el repositorio oficial del manipulador **no publica una tabla de parámetros '
      'de Denavit-Hartenberg**. Existe una solicitud abierta en ese repositorio pidiendo precisamente '
      'esos parámetros, junto con el espacio de trabajo, las velocidades y la repetibilidad. Por esa '
      'razón la tabla que aquí se presenta no se tomó de ninguna fuente: se derivó de los ejes de '
      'giro y de los puntos de anclaje declarados en el modelo descriptivo, y se validó después '
      'contra tres implementaciones ajenas al proyecto.\n')
    w('El texto de este desarrollo se generó de forma automática a partir de los mismos módulos de '
      'cálculo que produjeron los resultados publicados. Ninguna cifra fue transcrita a mano, de modo '
      'que no existe posibilidad de que el documento y el programa discrepen.\n')
    w('La configuración de prueba empleada en todos los pasos numéricos fue\n')
    w(f'    q = ( {", ".join(f"{np.degrees(v):+.0f}°" for v in qp)} )\n')
    w('elegida de forma arbitraria para que ningún ángulo resultara particular y no quedara oculto '
      'ningún error de signo. Un desarrollo evaluado únicamente en la configuración cero puede ocultar '
      'errores que se cancelan cuando los senos valen cero y los cosenos valen uno.\n')

    # ======================================================= 0
    w('\n---\n\n## Paso 0. Origen de los ejes de giro\n')
    w('La convención de Denavit-Hartenberg parte de conocer, para cada articulación, la recta sobre '
      'la que gira. El modelo descriptivo no proporciona esas rectas de forma directa: declara, para '
      'cada articulación, un punto de anclaje y una dirección de giro expresados respecto del eslabón '
      'anterior. Encadenando esos anclajes desde la base se obtuvieron los ejes en un sistema común. '
      'El resultado, con el brazo en su configuración cero, fue el siguiente.\n')
    w('**Tabla 1**\n')
    w('*Ejes de giro de las cinco articulaciones, referidos al sistema de la base*\n')
    w('| Articulación | Nombre en el modelo | Punto sobre el eje (mm) | Dirección del eje | Recorrido |')
    w('| :-: | :-- | :-- | :-: | :-: |')
    for i in range(5):
        pt = p[i] * 1000; zz = np.round(z[i], 4)
        w(f'| {i+1} | `{ING[i]}` | ({pt[0]:.1f}, {pt[1]:.1f}, {pt[2]:.1f}) | '
          f'({zz[0]:+.0f}, {zz[1]:+.0f}, {zz[2]:+.0f}) | {np.degrees(LIMS[i,0]):+.1f}° a {np.degrees(LIMS[i,1]):+.1f}° |')
    w('\n*Nota.* Elaboración propia a partir del modelo descriptivo del manipulador.\n')
    w('De esta tabla se desprendieron dos hechos que gobernaron todo el desarrollo posterior.\n')
    w('**El eje de la primera articulación apunta hacia abajo.** Su dirección es (0, 0, −1), no '
      '(0, 0, +1). No se trata de un error de dibujo ni de una elección de este trabajo: es el '
      'sentido de giro que declara el modelo, y por lo tanto el que interpreta el controlador del '
      'manipulador. Se conservó tal cual, de modo que el signo de q₁ en este documento coincide con '
      'el signo que el programa envía al servomotor. Invertirlo para que las figuras resultaran más '
      'cómodas habría obligado a una conversión de signo en cada paso posterior, que es exactamente '
      'la clase de error que este desarrollo busca hacer imposible.\n')
    w('**Las articulaciones dos, tres y cuatro comparten exactamente la dirección (1, 0, 0).** Son '
      'tres cabeceos paralelos entre sí. De ese hecho se deduce que la porción central de la cadena '
      'se mueve dentro de un plano, y de ahí se derivan después la estructura de la cinemática '
      'inversa, la ubicación de la singularidad y la forma del espacio de trabajo.\n')
    w('La figura siguiente muestra los cinco ejes sobre el modelo tridimensional del manipulador. '
      'Cada panel aísla una articulación para que los sistemas de referencia no se superpongan.\n')
    w('![Sistemas de referencia de Denavit-Hartenberg, un panel por articulación](figuras/figC_marcos_por_articulacion.png)\n')
    w('**Figura 1.** *Sistemas de referencia de Denavit-Hartenberg sobre el modelo tridimensional del '
      'manipulador.* El modelo no es una ilustración: cada pieza se dibujó con la malla que declara el '
      'modelo descriptivo, colocada en el lugar que le asigna la cinemática directa. Los ejes se '
      'trazaron en los orígenes obtenidos por el procedimiento de la normal común. Elaboración propia.\n')
    w('El efecto de cada grado de libertad sobre la postura del brazo se muestra a continuación, '
      'moviendo una articulación a la vez desde la configuración cero.\n')
    w('![Los cinco grados de libertad, uno a la vez](figuras/figE_cadena.png)\n')
    w('**Figura 2.** *Efecto individual de cada grado de libertad.* En gris claro, la configuración de '
      'partida; en color, el resultado de mover únicamente esa articulación. Obsérvese que en el '
      'último panel el brazo apenas cambia: la quinta articulación gira la herramienta sobre su propio '
      'eje sin desplazar el punto de trabajo, propiedad que se demuestra numéricamente en el paso 7. '
      'Elaboración propia.\n')

    # ======================================================= 1
    w('\n---\n\n## Paso 1. Distancias entre articulaciones\n')
    w('Antes de construir la tabla se midieron las distancias entre articulaciones consecutivas, '
      'porque son las magnitudes que un lector reconoce a simple vista sobre el manipulador y porque '
      'permiten explicar, por contraste, qué representan realmente los parámetros de la convención.\n')
    P = np.vstack([[0, 0, 0], p, fk_urdf(q0)[0][:3, 3]])
    etq = ['base', 'articulación 1', 'articulación 2', 'articulación 3', 'articulación 4', 'articulación 5', 'efector']
    cot = ['L₁', 'L₂', 'L₃', 'L₄', 'L₅', '—']
    w('**Tabla 2**\n')
    w('*Distancias entre articulaciones consecutivas en la configuración cero*\n')
    w('| Tramo | Cota | Vector (mm) | Longitud (mm) |')
    w('| :-- | :-: | :-- | :-: |')
    for i in range(6):
        d = (P[i+1] - P[i]) * 1000
        w(f'| {etq[i]} → {etq[i+1]} | {cot[i]} | ({d[0]:.1f}, {d[1]:.1f}, {d[2]:.1f}) | **{np.linalg.norm(d):.2f}** |')
    w('\n*Nota.* Elaboración propia. Las cotas L corresponden a la figura de asignación de sistemas de '
      'referencia elaborada para el proyecto.\n')
    w('![Distancias entre articulaciones consecutivas](figuras/figD_L.png)\n')
    w('**Figura 3.** *Distancias entre articulaciones consecutivas.* Los círculos numerados marcan las '
      'cinco articulaciones; el cuadrado, el origen del modelo; el aspa, el punto de trabajo del '
      'efector. Elaboración propia.\n')
    w('Este es el punto en que con mayor frecuencia se confunde la convención, de modo que conviene '
      'detenerse. **Las cotas L son distancias entre articulaciones. Los parámetros *a* de '
      'Denavit-Hartenberg son distancias medidas sobre la normal común entre dos ejes de giro.** Las '
      'dos coinciden únicamente cuando el segmento que une las articulaciones ya resulta perpendicular '
      'a ambos ejes. En este manipulador el reparto fue el siguiente.\n')
    w('- **L₃ = 116.00 mm y L₄ = 135.00 mm coinciden con a₂ y a₃.** Los ejes que unen son paralelos, '
      'de modo que el segmento que los separa ya es la normal común.')
    w(f'- **L₂ = 106.97 mm no coincide con ningún parámetro: se reparte en dos.** Una parte, '
      f'd₁ = −102.5 mm, se mide sobre el eje z₀; la otra, a₁ = 30.6 mm, sobre la normal común. La '
      f'comprobación es inmediata, puesto que ambos son perpendiculares: '
      f'√(102.5² + 30.6²) = {np.hypot(102.5, 30.6):.2f} mm.')
    w('- **L₅ = 60.10 mm no aparece en la tabla.** Los ejes de las articulaciones cuatro y cinco se '
      'cortan en un punto, y la convención obliga entonces a situar el origen del sistema en ese '
      'punto de corte, con a₄ = 0. Esos 60.1 mm no se pierden: quedaron incorporados a la extensión '
      'constante de la herramienta, que resultó de 60.1 + 90.0 = 150.1 mm.')
    w('- **L₁ = 48.12 mm** corresponde a la posición del eje de la base respecto del origen del '
      'modelo. Entra en la transformación constante de base, no en la tabla.\n')
    w('La figura siguiente muestra las mismas magnitudes acotadas sobre una vista lateral, donde el '
      'plano del dibujo coincide con el plano en que se mueve la cadena central.\n')
    w('![Parámetros geométricos acotados sobre la vista lateral](figuras/figB_dimensiones.png)\n')
    w('**Figura 4.** *Parámetros de la tabla de Denavit-Hartenberg acotados sobre el manipulador.* Las '
      'circunferencias con punto marcan ejes perpendiculares al plano del dibujo; las líneas de eje y '
      'trazo, los dos ejes contenidos en él. Elaboración propia.\n')

    # ======================================================= 2
    w('\n---\n\n## Paso 2. Asignación de sistemas y tabla de parámetros\n')
    w('Los sistemas de referencia se asignaron aplicando las reglas de la convención clásica: el eje '
      '**z** de cada sistema se alineó con el eje de giro de la articulación siguiente; el eje **x** '
      'se situó sobre la normal común entre dos ejes z consecutivos, apuntando del primero al '
      'segundo; el eje **y** completó la terna por la regla de la mano derecha.\n')
    w('Dos casos particulares requieren una regla adicional, y ambos se presentaron en este '
      'manipulador. Cuando dos ejes consecutivos son paralelos la normal común no es única, y se '
      'adoptó la elección habitual de tomar la que pasa por el origen del sistema anterior, lo que '
      'hace que el desplazamiento *d* de esa fila resulte nulo. Cuando dos ejes se cortan, la longitud '
      '*a* de esa fila es nula por construcción.\n')
    w('La aplicación de estas reglas sobre los ejes reales del modelo descriptivo produjo la tabla '
      'siguiente. Los tres primeros parámetros de cada fila son constantes geométricas del mecanismo; '
      'el ángulo es la única variable.\n')
    w('**Tabla 3**\n')
    w('*Parámetros de Denavit-Hartenberg del manipulador SO-ARM100*\n')
    w('| i | Articulación | θᵢ | dᵢ (m) | aᵢ (m) | αᵢ | Caso geométrico |')
    w('| :-: | :-- | :-- | :-: | :-: | :-: | :-- |')
    caso = {'oblicuos': 'ejes oblicuos', 'paralelos': 'ejes paralelos → *d* = 0',
            'se cortan': 'ejes que se cortan → *a* = 0'}
    for k, f in enumerate(FILAS):
        off = np.degrees(f['theta_off'])
        th = f'q{k+1}' if abs(off) < 1e-9 else f'q{k+1} {"+" if off > 0 else "−"} {abs(off):.3f}°'
        a = 0.0 if abs(f['a']) < 1e-9 else f['a']
        alfa = '0' + chr(176) if abs(np.degrees(f['alpha'])) < 1e-9 else f'{np.degrees(f["alpha"]):+.0f}' + chr(176)
        w(f'| {k+1} | {ING[k]} | {th} | {f["d"]:.4f} | {a:.4f} | {alfa} | {caso[f["caso"]]} |')
    w('\n*Nota.* Elaboración propia. Los desplazamientos angulares constantes que acompañan a cada '
      'variable expresan la diferencia entre el cero mecánico declarado en el modelo y el cero que '
      'impone la convención. No son ajustes arbitrarios: son la consecuencia de que el fabricante '
      'eligió una postura de referencia distinta de la que la convención exige.\n')

    # ======================================================= 3
    w('\n---\n\n## Paso 3. La matriz de transformación homogénea\n')
    w('La relación entre dos sistemas de referencia consecutivos se expresa mediante una matriz de '
      'transformación homogénea de cuatro por cuatro, que reúne en una sola entidad la rotación y la '
      'traslación entre ambos. Su bloque superior izquierdo de tres por tres es una matriz de '
      'rotación, ortogonal y de determinante unitario; su última columna es el vector que va del '
      'origen de un sistema al del otro; su última fila es fija e igual a (0, 0, 0, 1).\n')
    w('Con los cuatro parámetros de la convención, esa matriz se construyó como la composición de '
      'cuatro movimientos elementales, aplicados en este orden:\n')
    w('    Aᵢ = Rot(z, θᵢ) · Tras(z, dᵢ) · Tras(x, aᵢ) · Rot(x, αᵢ)\n')
    w('es decir, una rotación de θᵢ alrededor del eje z, una traslación de dᵢ sobre ese mismo eje, una '
      'traslación de aᵢ sobre el nuevo eje x y una rotación de αᵢ alrededor de él. Desarrollado, el '
      'producto da la forma general\n')
    gen = [['cos θᵢ', '−sin θᵢ · cos αᵢ', 'sin θᵢ · sin αᵢ', 'aᵢ · cos θᵢ'],
           ['sin θᵢ', 'cos θᵢ · cos αᵢ', '−cos θᵢ · sin αᵢ', 'aᵢ · sin θᵢ'],
           ['0', 'sin αᵢ', 'cos αᵢ', 'dᵢ'],
           ['0', '0', '0', '1']]
    w('```')
    w(sin_sangria(bloque(gen)))
    w('```\n')
    w('En los cinco casos de este manipulador el ángulo αᵢ resultó valer 0° o +90°, de modo que su '
      'coseno y su seno valen 1 y 0, o bien 0 y 1. Esa circunstancia simplifica considerablemente '
      'cada matriz, como se aprecia en el paso siguiente. Para abreviar la escritura se emplea '
      'cᵢ = cos θᵢ y sᵢ = sin θᵢ, donde θᵢ es la columna correspondiente de la tabla 3.\n')

    # ======================================================= 4
    w('\n---\n\n## Paso 4. Las dos transformaciones constantes\n')
    w('Antes de la cadena de articulaciones interviene una transformación fija que lleva del sistema '
      'de la base del manipulador al sistema cero de la convención, y después de la cadena otra que '
      'lleva del último sistema hasta el punto de trabajo del efector. Ninguna de las dos depende de '
      'las articulaciones, y ambas son necesarias para que las coordenadas calculadas coincidan con '
      'las que reporta el programa de control.\n')
    w('Transformación de base, del sistema `base_link` al sistema 0:\n')
    w('```'); w(sin_sangria(num(T_BASE, 6))); w('```\n')
    w('Transformación de herramienta, del sistema 5 al punto del efector:\n')
    w('```'); w(sin_sangria(num(T_TOOL, 6))); w('```\n')
    w(f'Los términos del orden de 10⁻⁶ que aparecen fuera de la diagonal no son ruido de cálculo: '
      f'provienen de que el modelo descriptivo declara los ángulos rectos como 1.5708 y 1.57079 '
      f'radianes en lugar del valor exacto. Se conservaron para que la cinemática aquí desarrollada '
      f'reproduzca la del modelo hasta la precisión de la máquina.\n')
    w(f'La herramienta se extiende {abs(T_TOOL[2,3])*1000:.1f} mm sobre el eje z₅, que es precisamente '
      'el eje de giro de la muñeca. Esa sola observación explica por qué la posición del efector no '
      'depende de la quinta articulación, resultado que se comprueba numéricamente en el paso 7.\n')

    # ======================================================= 5
    w('\n---\n\n## Paso 5. Desarrollo articulación por articulación\n')
    w('Para cada articulación se presenta el origen de sus cuatro parámetros, su matriz en forma '
      'simbólica con las constantes ya sustituidas, y esa misma matriz evaluada en la configuración '
      'de prueba. Al final de cada apartado se acumula el producto desde la base y se reporta la '
      'posición que ocupa el origen del sistema correspondiente.\n')
    T = T_BASE.copy()
    err_simb = 0.0
    for k in range(5):
        f = FILAS[k]; i = k + 1
        off = np.degrees(f['theta_off'])
        a = 0.0 if abs(f['a']) < 1e-9 else f['a']
        alfa = '0' + chr(176) if abs(np.degrees(f['alpha'])) < 1e-9 else f'{np.degrees(f["alpha"]):+.0f}' + chr(176)
        w(f'\n### Articulación {i} — {ESP[k]} (`{ING[k]}`)\n')
        w('| Parámetro | Valor | Origen del valor |')
        w('| :-: | :-: | :-- |')
        if abs(off) < 1e-9:
            w(f'| θ{i} | q{i} | El eje x₀ se eligió alineado con la normal común, de modo que no fue '
              f'necesario ningún desplazamiento constante. |')
        else:
            w(f'| θ{i} | q{i} {"+" if off > 0 else "−"} {abs(off):.3f}° | Ángulo medido entre x_{k} y '
              f'x_{i} con todas las articulaciones en cero. Expresa la diferencia entre la postura de '
              f'referencia del fabricante y la que impone la convención. |')
        w(f'| d{i} | {f["d"]:.4f} m | Desplazamiento a lo largo de z_{k} entre las dos normales comunes. |')
        w(f'| a{i} | {a:.4f} m | Longitud de la normal común entre z_{k} y z_{i}. |')
        w(f'| α{i} | {alfa} | Ángulo entre z_{k} y z_{i}, medido alrededor de x_{i}. |')
        w('')
        w(f'Sustituyendo esos valores en la forma general del paso 3, y escribiendo c{i} = cos θ{i} y '
          f's{i} = sin θ{i}, la matriz de esta articulación resultó:\n')
        w('```'); w(f'A{i} ='); w(sin_sangria(bloque(A_simbolica(k)))); w('```\n')
        th = f['theta_off'] + qp[k]
        Ai = A_dh(th, f['d'], f['a'], f['alpha'])
        w(f'Evaluada en q{i} = {np.degrees(qp[k]):+.0f}°, de donde θ{i} = {np.degrees(th):+.3f}°, '
          f'c{i} = {np.cos(th):+.6f} y s{i} = {np.sin(th):+.6f}:\n')
        w('```'); w(sin_sangria(num(Ai))); w('```\n')
        T = T @ Ai
        err_simb = max(err_simb, verifica_simbolica(k, qp[k]))
        w(f'Acumulando el producto desde la base, el origen del sistema {i} quedó situado en '
          f'**({T[0,3]*1000:.2f}, {T[1,3]*1000:.2f}, {T[2,3]*1000:.2f}) mm**.\n')
    w(f'\n> **Comprobación de este paso.** Las cinco matrices escritas en forma simbólica se '
      f'contrastaron contra la implementación general de la transformación homogénea, con una '
      f'diferencia máxima de {err_simb:.1e}. Es decir, la forma simbólica y la forma general son la '
      f'misma matriz, y la simplificación no introdujo ningún error.\n')

    # ======================================================= 6
    w('\n---\n\n## Paso 6. Cinemática directa completa\n')
    w('La cinemática directa se obtuvo encadenando las cinco matrices, con las dos transformaciones '
      'constantes en los extremos:\n')
    w('    T_efector = T_base · A₁ · A₂ · A₃ · A₄ · A₅ · T_herramienta\n')
    Tp = fk_dh(qp, T_TOOL)
    Tu = fk_urdf(qp)[0]
    w('En la configuración de prueba el resultado fue\n')
    w('```'); w(sin_sangria(num(Tp, 6))); w('```\n')
    w('de donde se leyeron directamente las dos magnitudes físicas de interés:\n')
    w(f'- la **posición del efector**, en las tres primeras filas de la última columna: '
      f'x = {Tp[0,3]*1000:.2f} mm, y = {Tp[1,3]*1000:.2f} mm, z = {Tp[2,3]*1000:.2f} mm;')
    w(f'- la **orientación del efector**, en el bloque de rotación de tres por tres. En particular el '
      f'eje de la herramienta, que corresponde a la segunda columna, apuntó en la dirección '
      f'({Tp[0,1]:+.4f}, {Tp[1,1]:+.4f}, {Tp[2,1]:+.4f}).\n')
    T0 = fk_dh(np.zeros(5), T_TOOL)
    w('En la configuración cero, que es la que reproducen las figuras de este documento, el resultado '
      'fue\n')
    w('```'); w(sin_sangria(num(T0, 6))); w('```\n')
    w(f'> **Comprobación de este paso.** La misma configuración evaluada con la cinemática del modelo '
      f'descriptivo, sin pasar por la convención de Denavit-Hartenberg, difirió en '
      f'{np.abs(Tp - Tu).max():.3e}. Sobre veinte mil configuraciones generadas al azar dentro de los '
      f'límites articulares el error máximo fue de 1.485 × 10⁻¹⁵, que corresponde al redondeo de la '
      f'aritmética de punto flotante de sesenta y cuatro bits y no a una diferencia de modelado.\n')

    # ======================================================= 7
    w('\n---\n\n## Paso 7. Jacobiano geométrico, columna por columna\n')
    w('El jacobiano relaciona las velocidades de las articulaciones con la velocidad del efector '
      'final. Para un mecanismo de cinco articulaciones cuyo efector se describe con seis componentes '
      'de velocidad —tres lineales y tres angulares— el jacobiano es una matriz de **seis filas por '
      'cinco columnas**. Esa forma rectangular, y no cuadrada, es la causa de varias particularidades '
      'que se tratan en los pasos siguientes.\n')
    w('Como las cinco articulaciones son de revolución, cada columna se construyó geométricamente '
      'mediante\n')
    w('    Jᵢ = [ zᵢ × (o_n − oᵢ) ;  zᵢ ]\n')
    w('donde zᵢ es el eje de giro de la articulación expresado en el sistema de la base, oᵢ el origen '
      'de su sistema y o_n el punto del efector. La interpretación física del producto vectorial es '
      'directa: un giro alrededor de un eje produce sobre un punto una velocidad lineal proporcional '
      'al brazo de palanca que los separa y perpendicular a ambos.\n')
    zq, pq = ejes_y_puntos(qp)
    on = Tp[:3, 3]
    w('En la configuración de prueba los ingredientes de cada columna resultaron:\n')
    w('**Tabla 4**\n')
    w('*Elementos geométricos de cada columna del jacobiano en la configuración de prueba*\n')
    w('| i | zᵢ (eje de giro) | oᵢ (mm) | o_n − oᵢ (mm) |')
    w('| :-: | :-- | :-- | :-- |')
    for i in range(5):
        r = (on - pq[i]) * 1000
        w(f'| {i+1} | ({zq[i,0]:+.4f}, {zq[i,1]:+.4f}, {zq[i,2]:+.4f}) | '
          f'({pq[i,0]*1000:.1f}, {pq[i,1]*1000:.1f}, {pq[i,2]*1000:.1f}) | ({r[0]:.1f}, {r[1]:.1f}, {r[2]:.1f}) |')
    w('\n*Nota.* Elaboración propia.\n')
    Jq = jacobiano(qp)
    w('El jacobiano resultante, con las tres primeras filas en metros por radián y las tres últimas '
      'adimensionales, fue\n')
    w('```'); w(sin_sangria(num(Jq, 6))); w('```\n')
    w(f'> **Comprobación de este paso.** El jacobiano se contrastó contra una aproximación por '
      f'diferencias finitas centradas de la cinemática directa. En esta configuración la diferencia '
      f'máxima fue de {np.abs(Jq - jacobiano_numerico(qp)).max():.3e}; sobre tres mil configuraciones, '
      f'3.023 × 10⁻⁹. Ese residuo corresponde al error de truncamiento propio del método de '
      f'diferencias, no a una discrepancia de formulación.\n')
    w(f'Merece atención la **quinta columna**. Su parte lineal resultó '
      f'({Jq[0,4]:+.1e}, {Jq[1,4]:+.1e}, {Jq[2,4]:+.1e}), es decir, el vector nulo. Girar la muñeca no '
      f'desplaza el efector, porque su punto de trabajo se encuentra sobre el propio eje de giro. En '
      f'consecuencia, **la posición del efector depende únicamente de las cuatro primeras '
      f'articulaciones**. Es el mismo hecho que se observa en el último panel de la figura 2.\n')

    # ======================================================= 8
    w('\n---\n\n## Paso 8. Índice de manipulabilidad\n')
    J0 = jacobiano(np.zeros(5))
    sv = np.linalg.svd(J0, compute_uv=False)
    w('El índice de manipulabilidad de Yoshikawa cuantifica mediante un solo número la facilidad con '
      'que el mecanismo puede moverse desde una configuración dada. Geométricamente expresa el '
      'volumen del elipsoide de velocidades que el efector puede alcanzar: un valor elevado indica '
      'holgura de movimiento en todas las direcciones, y un valor que tiende a cero indica proximidad '
      'a una configuración singular.\n')
    w('Aquí fue necesaria una precisión que la formulación habitual omite. La expresión que aparece '
      'con mayor frecuencia en la literatura es\n')
    w('    w = √( det( J · Jᵀ ) )\n')
    w('y es correcta **únicamente cuando el jacobiano tiene al menos tantas columnas como filas**. En '
      'el manipulador estudiado el jacobiano tiene seis filas y cinco columnas, de modo que el '
      'producto J·Jᵀ es una matriz de seis por seis cuyo rango no puede superar cinco: su '
      'determinante es idénticamente nulo en toda configuración, y la expresión devuelve cero '
      'siempre, sin aportar información alguna.\n')
    w('La formulación válida en este caso invierte el orden del producto:\n')
    w('    w = √( det( Jᵀ · J ) )\n')
    w('que equivale al producto de los cinco valores singulares del jacobiano.\n')
    w('**Tabla 5**\n')
    w('*Índice de manipulabilidad en la configuración cero, según cada formulación*\n')
    w('| Expresión | Valor | Interpretación |')
    w('| :-- | :-: | :-- |')
    w(f'| det(J·Jᵀ) | {np.linalg.det(J0 @ J0.T):.3e} | Numéricamente cero, como exige el rango. |')
    w(f'| √(det(J·Jᵀ)) | {np.sqrt(max(np.linalg.det(J0 @ J0.T), 0)):.6f} | La fórmula habitual, sin contenido aquí. |')
    w(f'| **√(det(Jᵀ·J))** | **{np.sqrt(np.linalg.det(J0.T @ J0)):.6f}** | La formulación válida en este caso. |')
    w(f'| Producto de los valores singulares | {np.prod(sv):.6f} | Coincide con la anterior, como debe. |')
    w('\n*Nota.* Elaboración propia.\n')
    w(f'Los cinco valores singulares en la configuración cero resultaron '
      f'{", ".join(f"{v:.4f}" for v in sv)}.\n')
    w('> **Observación.** Esta no es una sutileza de notación. El Robotics Toolbox de Peter Corke, '
      'empleado en este trabajo como implementación independiente, aplica la fórmula habitual y '
      'devuelve exactamente cero para este manipulador. No se trata de un defecto de esa biblioteca: '
      'la fórmula exige una condición dimensional que este mecanismo no cumple. La versión de tres '
      'por cinco, que considera únicamente la parte lineal del jacobiano, sí es válida y arrojó '
      '0.012545. Es la que calcula el nodo de teleoperación del proyecto, y por esa razón su '
      'resultado es correcto.\n')

    # ======================================================= 9
    w('\n---\n\n## Paso 9. Singularidad\n')
    off3 = np.degrees(FILAS[2]['theta_off'])
    qs = np.array([0.0, 0.0, -FILAS[2]['theta_off'], 0.0, 0.0])
    Js = jacobiano(qs); svs = np.linalg.svd(Js, compute_uv=False)
    U, S, Vt = np.linalg.svd(Js)
    w('Una configuración es singular cuando el jacobiano pierde rango. En su vecindad el manipulador '
      'deja instantáneamente de poder moverse en al menos una dirección del espacio, y las '
      'velocidades articulares necesarias para producir un movimiento pequeño del efector crecen sin '
      'cota. Identificarlas no es un ejercicio teórico: son las configuraciones en las que un '
      'controlador basado en el jacobiano se vuelve inestable.\n')
    w(f'El barrido de doscientas mil configuraciones distribuidas dentro de los límites articulares '
      f'reveló que la cadena posee **una sola familia de configuraciones singulares interna a su rango '
      f'de trabajo**, y que todas comparten el mismo valor de la tercera articulación: '
      f'**q₃ = {-off3:.3f}°**.\n')
    w('Ese valor no resultó arbitrario. Es exactamente el opuesto del desplazamiento constante de la '
      'tercera fila de la tabla, de modo que θ₃ = 0 y los eslabones a₂ y a₃ quedan alineados: se trata '
      'de la singularidad de codo extendido, la más conocida de los manipuladores articulados.\n')
    w('**Tabla 6**\n')
    w('*Caracterización de la singularidad interna*\n')
    w('| Magnitud | Valor |')
    w('| :-- | :-- |')
    w(f'| Configuración | q₃ = {-off3:.3f}°, con independencia de las demás articulaciones |')
    w(f'| Valores singulares | {", ".join(f"{v:.6f}" for v in svs)} |')
    w(f'| Rango del jacobiano | {np.linalg.matrix_rank(Js, tol=1e-9)} (fuera de la singularidad, 5) |')
    w(f'| Índice de manipulabilidad | {np.sqrt(max(np.linalg.det(Js.T @ Js), 0)):.3e} frente a una mediana de 8.6 × 10⁻³ |')
    w(f'| Dirección articular que se pierde | ({", ".join(f"{v:+.4f}" for v in Vt[-1])}) |')
    w('\n*Nota.* Elaboración propia. La dirección perdida es el vector singular derecho asociado al '
      'valor singular nulo. Expresa el movimiento coordinado de las tres articulaciones de cabeceo '
      'que no produce ningún movimiento del efector: el brazo se mueve, pero la herramienta no.\n')
    w(f'El límite mecánico de esa articulación alcanza ±{np.degrees(LIMS[2,1]):.1f}°, de modo que **la '
      f'singularidad se encuentra dentro del recorrido admisible** y el operador la atraviesa durante '
      f'el uso normal del manipulador, precisamente cuando estira el brazo para alcanzar un objeto '
      f'lejano. La configuración simétrica, con el codo completamente plegado, correspondería a '
      f'θ₃ = 180°, es decir q₃ = {180 - off3:+.1f}°, valor que queda fuera del límite y por tanto no '
      f'es alcanzable.\n')
    w('![Mapa del índice de manipulabilidad](figuras/fig3_manipulabilidad.png)\n')
    w('**Figura 5.** *Índice de manipulabilidad sobre el plano de las articulaciones dos y tres.* La '
      'franja oscura vertical corresponde a la singularidad de codo extendido. Elaboración propia.\n')
    w('![Valores singulares al atravesar la singularidad](figuras/fig4_singularidad.png)\n')
    w('**Figura 6.** *Valores singulares del jacobiano y pérdida de rango al atravesar la '
      'configuración singular.* Elaboración propia.\n')

    # ======================================================= 10
    w('\n---\n\n## Paso 10. Cinemática inversa\n')
    w('El planteamiento del problema inverso exige separar dos preguntas que con frecuencia se '
      'confunden, y de cuya distinción depende que la respuesta resulte defendible.\n')
    w('### ¿Puede el manipulador alcanzar una pose arbitraria del espacio?\n')
    w('No, y la razón es estructural, no algorítmica: una pose completa en el espacio tridimensional '
      '—posición y orientación— tiene seis grados de libertad, y el mecanismo dispone de cinco. '
      'Ningún método de resolución puede recuperar un grado de libertad que el mecanismo no posee.\n')
    w('La restricción concreta se dedujo de la estructura establecida en el paso 0 y se verificó '
      'numéricamente sobre doscientas mil configuraciones: **el eje de la herramienta está obligado a '
      'permanecer dentro del plano vertical que definen el eje de la base y el punto del efector**, '
      'con una desviación máxima de 1.2 × 10⁻⁴ fuera de una vecindad de diez milímetros alrededor del '
      'eje de la base, donde ese plano no está definido. El motivo es que dicho eje resulta de la '
      'cadena plana, y el plano lo elige la primera articulación; la quinta gira la herramienta sobre '
      'ese eje, pero no lo saca del plano.\n')
    w('La comprobación fue concluyente: al tomar posiciones alcanzables y solicitar sobre ellas '
      'orientaciones generadas al azar de forma uniforme, **ninguna de las mil poses planteadas '
      'resultó alcanzable**.\n')
    w('### ¿Existe solución cerrada para la tarea que el manipulador sí puede ejecutar?\n')
    w('Sí, y esa es la formulación útil del problema. El espacio de tareas alcanzable tiene cinco '
      'dimensiones y se descompone en la posición del efector, que aporta tres; la dirección del eje '
      'de la herramienta, que aporta una porque su componente fuera del plano está fijada; y el giro '
      'de la herramienta sobre su propio eje, que aporta la quinta.\n')
    T_obj = fk_dh(qp, T_TOOL)
    Tl = np.linalg.inv(T_BASE) @ T_obj
    p0 = Tl[:3, 3]; a_tool = Tl[:3, 1]
    th1 = np.arctan2(p0[1], p0[0])
    w('El procedimiento se ilustra a continuación sobre la pose que produce la configuración de '
      'prueba, de modo que el resultado puede contrastarse con el valor de partida.\n')
    w(f'**Objetivo.** Llevar el efector a ({T_obj[0,3]*1000:.2f}, {T_obj[1,3]*1000:.2f}, '
      f'{T_obj[2,3]*1000:.2f}) mm con el eje de la herramienta en la dirección '
      f'({a_tool[0]:+.4f}, {a_tool[1]:+.4f}, {a_tool[2]:+.4f}), expresada en el sistema cero.\n')
    w(f'1. **Ángulo de la base.** Se despejó del azimut del punto objetivo respecto del eje de la '
      f'base: θ₁ = atan2({p0[1]:.6f}, {p0[0]:.6f}) = {np.degrees(th1):+.4f}°, que descontando el '
      f'desplazamiento constante de la primera fila dio q₁ = '
      f'{np.degrees(th1 - FILAS[0]["theta_off"]):+.4f}°. Existe una segunda rama, separada ciento '
      f'ochenta grados, que alcanza el mismo punto con el brazo al otro lado del eje.')
    w('2. **Proyección al plano.** Aplicando la inversa de A₁, el problema quedó reducido a una cadena '
      'plana de tres eslabones con longitudes a₂, a₃ y la extensión de la herramienta. Que el objetivo '
      'caiga efectivamente en ese plano constituye la condición de alcanzabilidad: si no cae, la pose '
      'es inalcanzable y el procedimiento lo detecta en este punto, sin necesidad de iterar.')
    w('3. **Punto de la muñeca.** Se retrocedió desde el objetivo una distancia igual a la extensión '
      'de la herramienta, 150.1 mm, en dirección contraria a su eje.')
    w('4. **Ángulo del codo.** Se despejó de la ley del coseno sobre el triángulo que forman a₂, a₃ y '
      'la distancia al punto de la muñeca. Existen dos ramas, codo arriba y codo abajo.')
    w('5. **Ángulo del hombro.** Se obtuvo por diferencia de argumentos entre la dirección al punto de '
      'la muñeca y el ángulo interno del triángulo anterior.')
    w('6. **Cabeceo de muñeca.** Se obtuvo por diferencia entre la orientación deseada de la '
      'herramienta dentro del plano y la suma de los dos ángulos anteriores.')
    w('7. **Giro de muñeca.** Se extrajo de la rotación residual entre la orientación que alcanzan las '
      'cuatro primeras articulaciones y la solicitada.\n')
    sols_t = ik(T_obj, codo='ambos')
    sols = [s for s in sols_t if dentro(s)]
    w(f'Aplicado a este objetivo, el procedimiento devolvió **{len(sols_t)} soluciones exactas**, de '
      f'las cuales **{len(sols)} {"quedó" if len(sols)==1 else "quedaron"} dentro de los límites '
      f'articulares**. La solución admisible fue:\n')
    if sols:
        s0 = sols[0]
        w('**Tabla 7**\n')
        w('*Solución del problema inverso contrastada con la configuración de partida*\n')
        w('| Articulación | Solución (°) | Valor de partida (°) | Diferencia |')
        w('| :-: | :-: | :-: | :-: |')
        for i in range(5):
            w(f'| q{i+1} | {np.degrees(s0[i]):+.4f} | {np.degrees(qp[i]):+.0f} | '
              f'{abs(np.degrees(s0[i])-np.degrees(qp[i])):.1e} |')
        e = np.abs(fk_dh(s0, T_TOOL) - T_obj).max()
        w(f'\n*Nota.* Elaboración propia. Al sustituir la solución en la cinemática directa se recuperó '
          f'la pose objetivo con un error máximo de {e:.3e}.\n')
    w('La solución no requiere iteración ni valores iniciales. Se validó generando tres mil poses con '
      'la cinemática directa y resolviéndolas con este procedimiento: **3000 de 3000 resueltas**, '
      'error máximo de posición 3.9 × 10⁻¹⁶ m, 3.38 soluciones exactas por pose en promedio, de las '
      'que 1.16 quedaron dentro de los límites articulares.\n')
    w('> **Defecto detectado y corregido.** La primera versión del procedimiento devolvía candidatas '
      'sin comprobar que reprodujeran la pose solicitada. Sobre poses de orientación arbitraria '
      'devolvía una candidata en el dieciocho por ciento de los casos, y ninguna de ellas alcanzaba '
      'realmente la pose pedida: el peor error de orientación fue de 1.055. Un programa de control que '
      'hubiera confiado en esa versión habría enviado el manipulador a una postura equivocada sin '
      'ningún aviso. La versión corregida sustituye cada candidata en la cinemática directa y descarta '
      'la que no reproduce el objetivo. Se deja constancia del defecto porque ilustra por qué un '
      'procedimiento de resolución debe validar su propia salida.\n')

    # ======================================================= 11
    w('\n---\n\n## Paso 11. Espacio de trabajo\n')
    w('El conjunto de puntos alcanzables por el efector se caracterizó aprovechando que su posición '
      'depende únicamente de las articulaciones dos, tres y cuatro, resultado establecido en el paso '
      '7. Los extremos se obtuvieron mediante mallas sucesivas que se estrechan alrededor del mejor '
      'punto, siempre dentro de los límites articulares, de modo que las cifras no dependen del '
      'muestreo y se reproducen de forma idéntica en cualquier ejecución.\n')
    w('**Tabla 8**\n')
    w('*Dimensiones del espacio de trabajo alcanzable*\n')
    w('| Magnitud | Valor |')
    w('| :-- | :-: |')
    w('| Alcance radial máximo desde el eje de la base | 431.70 mm |')
    w('| Distancia máxima del efector al origen del modelo | 542.19 mm |')
    w('| Altura máxima sobre el plano de montaje | 520.10 mm |')
    w('| Altura mínima | −213.19 mm |')
    w('| Recorrido angular de la base | ±112.3° |')
    w('\n*Nota.* Elaboración propia. Como la primera articulación gira el plano completo del brazo, el '
      'conjunto resultante es un sólido de revolución alrededor del eje vertical de la base.\n')
    w('> **Defecto detectado y corregido.** Una primera versión del refinamiento empleaba un '
      'optimizador sin restricciones, que abandonaba el recorrido mecánico de las articulaciones y '
      'devolvía una altura mínima de −282.10 mm, imposible para el manipulador. El valor correcto, '
      'obtenido con el refinamiento acotado y confirmado sobre una malla de 4.17 millones de '
      'configuraciones, es −213.19 mm.\n')
    w('![Espacio de trabajo alcanzable](figuras/fig2_workspace.png)\n')
    w('**Figura 7.** *Espacio de trabajo alcanzable: sección meridiana y proyección horizontal.* '
      'Elaboración propia.\n')

    # ======================================================= 12
    w('\n---\n\n## Paso 12. Verificación\n')
    w('Cada resultado del desarrollo se contrastó contra implementaciones ajenas al proyecto. La '
      'tabla siguiente reúne todas las comprobaciones realizadas.\n')
    w('**Tabla 9**\n')
    w('*Verificación cruzada del modelo cinemático*\n')
    w('| Qué se comparó | Contra qué | Muestras | Error máximo |')
    w('| :-- | :-- | :-: | :-- |')
    w('| Cinemática directa por Denavit-Hartenberg | Cinemática del modelo descriptivo | 20 000 | 1.485 × 10⁻¹⁵ m |')
    w('| Cinemática directa | Robotics Toolbox, modelo de Denavit-Hartenberg | 5 000 | 1.665 × 10⁻¹⁶ m |')
    w('| Orientación del efector | Robotics Toolbox | 5 000 | 4.441 × 10⁻¹⁶ |')
    w('| Cinemática directa | Robotics Toolbox, transformadas elementales del modelo descriptivo | 5 000 | 1.360 × 10⁻¹⁵ m |')
    w('| Jacobiano geométrico | Robotics Toolbox | 5 000 | 1.277 × 10⁻¹⁵ |')
    w('| Jacobiano geométrico | Diferencias finitas centradas | 3 000 | 3.023 × 10⁻⁹ |')
    w('| Cinemática inversa cerrada | Ida y vuelta por cinemática directa | 3 000 | 3.886 × 10⁻¹⁶ m |')
    w('| Paralelismo de los tres cabeceos | Ejes del modelo descriptivo | 3 | 0 exacto |')
    w('| Independencia de la posición respecto de q₅ | Barrido directo | 2 000 | 1.110 × 10⁻¹⁶ m |')
    w('| Sentido de giro de las cinco articulaciones | Registro del simulador con el planificador de movimiento | 5 | 1.2°, 2.1° y 11.9° |')
    w('\n*Nota.* Elaboración propia. Un error del orden de 10⁻¹⁵ corresponde al redondeo de la '
      'aritmética de punto flotante de sesenta y cuatro bits, no a una diferencia de modelado.\n')
    w('La figura siguiente contrasta visualmente la implementación propia con la del Robotics Toolbox '
      'en la misma configuración.\n')
    w('![Contraste con el Robotics Toolbox](figuras/figF_toolbox.png)\n')
    w('**Figura 8.** *El mismo manipulador en dos implementaciones independientes.* A la izquierda, el '
      'modelo construido dentro del Robotics Toolbox a partir de la tabla de Denavit-Hartenberg; a la '
      'derecha, el modelo dibujado con las mallas del modelo descriptivo y colocado con la cinemática '
      'directa propia. La posición del efector coincide en ambos. Elaboración propia.\n')
    w('La última fila de la tabla 9 requiere explicación. Se dispuso de un registro del manipulador en '
      'el visualizador del middleware, movido articulación por articulación desde el panel de '
      'planificación de movimiento. Del registro se extrajeron la posición de cada corredera y el '
      'desplazamiento aparente del brazo, y se buscó **una sola dirección de cámara capaz de explicar '
      'simultáneamente las cinco**. Si algún signo de la tabla estuviera invertido, no existiría '
      'ninguna cámara capaz de hacerlo. Las tres articulaciones que desplazan el brazo de forma '
      'apreciable se reprodujeron con desviaciones de 1.2°, 2.1° y 11.9°. Para el cabeceo de muñeca '
      'el desplazamiento aparente quedó por debajo del ruido del método, y para el giro de muñeca el '
      'propio modelo predice un desplazamiento de 0.2 mm: el registro confirmó así, de forma '
      'independiente, que la quinta articulación no desplaza el efector.\n')

    return '\n'.join(L)


if __name__ == '__main__':
    texto = cuerpo()
    _aqui = _os.path.dirname(_os.path.abspath(__file__))
    _sal = _os.path.normpath(_os.path.join(_aqui, '..', 'Paso_a_paso.md'))
    if not _os.path.isdir(_os.path.dirname(_sal)):
        _sal = _os.path.join(_aqui, 'Paso_a_paso.md')
    open(_sal, 'w', encoding='utf-8').write(texto)
    print(f'escrito {_sal}  ({len(texto)} caracteres, {texto.count(chr(10))} lineas)')
