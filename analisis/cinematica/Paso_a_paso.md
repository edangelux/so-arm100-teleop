# Desarrollo cinemático del SO-ARM100, articulación por articulación

## Alcance y procedencia de los datos

El presente desarrollo documenta, paso a paso, la obtención del modelo cinemático del manipulador SO-ARM100 de cinco grados de libertad. Se expone el origen de cada parámetro, la matriz de transformación de cada articulación en forma simbólica y numérica, la composición completa de la cadena, la construcción del jacobiano y la resolución del problema inverso.

Todos los valores geométricos se extrajeron del modelo descriptivo del manipulador, el archivo `so_arm_100_5dof_arm.urdf.xacro` del paquete `so_arm_100_description`, publicado en el repositorio `brukg/SO-100-arm`. Ese archivo es el mismo que cargan el simulador y el planificador de movimiento empleados en el proyecto, de modo que el modelo matemático y el modelo que ejecuta el programa describen exactamente el mismo mecanismo.

Se hace notar que el repositorio oficial del manipulador **no publica una tabla de parámetros de Denavit-Hartenberg**. Existe una solicitud abierta en ese repositorio pidiendo precisamente esos parámetros, junto con el espacio de trabajo, las velocidades y la repetibilidad. Por esa razón la tabla que aquí se presenta no se tomó de ninguna fuente: se derivó de los ejes de giro y de los puntos de anclaje declarados en el modelo descriptivo, y se validó después contra tres implementaciones ajenas al proyecto.

El texto de este desarrollo se generó de forma automática a partir de los mismos módulos de cálculo que produjeron los resultados publicados. Ninguna cifra fue transcrita a mano, de modo que no existe posibilidad de que el documento y el programa discrepen.

La configuración de prueba empleada en todos los pasos numéricos fue

    q = ( +35°, -20°, +45°, -30°, +60° )

elegida de forma arbitraria para que ningún ángulo resultara particular y no quedara oculto ningún error de signo. Un desarrollo evaluado únicamente en la configuración cero puede ocultar errores que se cancelan cuando los senos valen cero y los cosenos valen uno.


---

## Paso 0. Origen de los ejes de giro

La convención de Denavit-Hartenberg parte de conocer, para cada articulación, la recta sobre la que gira. El modelo descriptivo no proporciona esas rectas de forma directa: declara, para cada articulación, un punto de anclaje y una dirección de giro expresados respecto del eslabón anterior. Encadenando esos anclajes desde la base se obtuvieron los ejes en un sistema común. El resultado, con el brazo en su configuración cero, fue el siguiente.

**Tabla 1**

*Ejes de giro de las cinco articulaciones, referidos al sistema de la base*

| Articulación | Nombre en el modelo | Punto sobre el eje (mm) | Dirección del eje | Recorrido |
| :-: | :-- | :-- | :-: | :-: |
| 1 | `Shoulder_Rotation` | (0.0, -45.2, 16.5) | (+0, +0, -1) | -112.3° a +112.3° |
| 2 | `Shoulder_Pitch` | (0.0, -75.8, 119.0) | (+1, +0, +0) | -100.0° a +100.0° |
| 3 | `Elbow` | (0.0, -103.8, 231.6) | (+1, +0, +0) | -85.9° a +85.9° |
| 4 | `Wrist_Pitch` | (0.0, -238.7, 236.8) | (+1, +0, +0) | -95.0° a +95.0° |
| 5 | `Wrist_Roll` | (0.0, -298.8, 236.8) | (+0, +1, +0) | -157.6° a +157.6° |

*Nota.* Elaboración propia a partir del modelo descriptivo del manipulador.

De esta tabla se desprendieron dos hechos que gobernaron todo el desarrollo posterior.

**El eje de la primera articulación apunta hacia abajo.** Su dirección es (0, 0, −1), no (0, 0, +1). No se trata de un error de dibujo ni de una elección de este trabajo: es el sentido de giro que declara el modelo, y por lo tanto el que interpreta el controlador del manipulador. Se conservó tal cual, de modo que el signo de q₁ en este documento coincide con el signo que el programa envía al servomotor. Invertirlo para que las figuras resultaran más cómodas habría obligado a una conversión de signo en cada paso posterior, que es exactamente la clase de error que este desarrollo busca hacer imposible.

**Las articulaciones dos, tres y cuatro comparten exactamente la dirección (1, 0, 0).** Son tres cabeceos paralelos entre sí. De ese hecho se deduce que la porción central de la cadena se mueve dentro de un plano, y de ahí se derivan después la estructura de la cinemática inversa, la ubicación de la singularidad y la forma del espacio de trabajo.

La figura siguiente muestra los cinco ejes sobre el modelo tridimensional del manipulador. Cada panel aísla una articulación para que los sistemas de referencia no se superpongan.

![Sistemas de referencia de Denavit-Hartenberg, un panel por articulación](figuras/figC_marcos_por_articulacion.png)

**Figura 1.** *Sistemas de referencia de Denavit-Hartenberg sobre el modelo tridimensional del manipulador.* El modelo no es una ilustración: cada pieza se dibujó con la malla que declara el modelo descriptivo, colocada en el lugar que le asigna la cinemática directa. Los ejes se trazaron en los orígenes obtenidos por el procedimiento de la normal común. Elaboración propia.

El efecto de cada grado de libertad sobre la postura del brazo se muestra a continuación, moviendo una articulación a la vez desde la configuración cero.

![Los cinco grados de libertad, uno a la vez](figuras/figE_cadena.png)

**Figura 2.** *Efecto individual de cada grado de libertad.* En gris claro, la configuración de partida; en color, el resultado de mover únicamente esa articulación. Obsérvese que en el último panel el brazo apenas cambia: la quinta articulación gira la herramienta sobre su propio eje sin desplazar el punto de trabajo, propiedad que se demuestra numéricamente en el paso 7. Elaboración propia.


---

## Paso 1. Distancias entre articulaciones

Antes de construir la tabla se midieron las distancias entre articulaciones consecutivas, porque son las magnitudes que un lector reconoce a simple vista sobre el manipulador y porque permiten explicar, por contraste, qué representan realmente los parámetros de la convención.

**Tabla 2**

*Distancias entre articulaciones consecutivas en la configuración cero*

| Tramo | Cota | Vector (mm) | Longitud (mm) |
| :-- | :-: | :-- | :-: |
| base → articulación 1 | L₁ | (0.0, -45.2, 16.5) | **48.12** |
| articulación 1 → articulación 2 | L₂ | (0.0, -30.6, 102.5) | **106.97** |
| articulación 2 → articulación 3 | L₃ | (0.0, -28.0, 112.6) | **116.00** |
| articulación 3 → articulación 4 | L₄ | (0.0, -134.9, 5.2) | **135.00** |
| articulación 4 → articulación 5 | L₅ | (0.0, -60.1, -0.0) | **60.10** |
| articulación 5 → efector | — | (0.0, -90.0, -0.0) | **90.00** |

*Nota.* Elaboración propia. Las cotas L corresponden a la figura de asignación de sistemas de referencia elaborada para el proyecto.

![Distancias entre articulaciones consecutivas](figuras/figD_L.png)

**Figura 3.** *Distancias entre articulaciones consecutivas.* Los círculos numerados marcan las cinco articulaciones; el cuadrado, el origen del modelo; el aspa, el punto de trabajo del efector. Elaboración propia.

Este es el punto en que con mayor frecuencia se confunde la convención, de modo que conviene detenerse. **Las cotas L son distancias entre articulaciones. Los parámetros *a* de Denavit-Hartenberg son distancias medidas sobre la normal común entre dos ejes de giro.** Las dos coinciden únicamente cuando el segmento que une las articulaciones ya resulta perpendicular a ambos ejes. En este manipulador el reparto fue el siguiente.

- **L₃ = 116.00 mm y L₄ = 135.00 mm coinciden con a₂ y a₃.** Los ejes que unen son paralelos, de modo que el segmento que los separa ya es la normal común.
- **L₂ = 106.97 mm no coincide con ningún parámetro: se reparte en dos.** Una parte, d₁ = −102.5 mm, se mide sobre el eje z₀; la otra, a₁ = 30.6 mm, sobre la normal común. La comprobación es inmediata, puesto que ambos son perpendiculares: √(102.5² + 30.6²) = 106.97 mm.
- **L₅ = 60.10 mm no aparece en la tabla.** Los ejes de las articulaciones cuatro y cinco se cortan en un punto, y la convención obliga entonces a situar el origen del sistema en ese punto de corte, con a₄ = 0. Esos 60.1 mm no se pierden: quedaron incorporados a la extensión constante de la herramienta, que resultó de 60.1 + 90.0 = 150.1 mm.
- **L₁ = 48.12 mm** corresponde a la posición del eje de la base respecto del origen del modelo. Entra en la transformación constante de base, no en la tabla.

La figura siguiente muestra las mismas magnitudes acotadas sobre una vista lateral, donde el plano del dibujo coincide con el plano en que se mueve la cadena central.

![Parámetros geométricos acotados sobre la vista lateral](figuras/figB_dimensiones.png)

**Figura 4.** *Parámetros de la tabla de Denavit-Hartenberg acotados sobre el manipulador.* Las circunferencias con punto marcan ejes perpendiculares al plano del dibujo; las líneas de eje y trazo, los dos ejes contenidos en él. Elaboración propia.


---

## Paso 2. Asignación de sistemas y tabla de parámetros

Los sistemas de referencia se asignaron aplicando las reglas de la convención clásica: el eje **z** de cada sistema se alineó con el eje de giro de la articulación siguiente; el eje **x** se situó sobre la normal común entre dos ejes z consecutivos, apuntando del primero al segundo; el eje **y** completó la terna por la regla de la mano derecha.

Dos casos particulares requieren una regla adicional, y ambos se presentaron en este manipulador. Cuando dos ejes consecutivos son paralelos la normal común no es única, y se adoptó la elección habitual de tomar la que pasa por el origen del sistema anterior, lo que hace que el desplazamiento *d* de esa fila resulte nulo. Cuando dos ejes se cortan, la longitud *a* de esa fila es nula por construcción.

La aplicación de estas reglas sobre los ejes reales del modelo descriptivo produjo la tabla siguiente. Los tres primeros parámetros de cada fila son constantes geométricas del mecanismo; el ángulo es la única variable.

**Tabla 3**

*Parámetros de Denavit-Hartenberg del manipulador SO-ARM100*

| i | Articulación | θᵢ | dᵢ (m) | aᵢ (m) | αᵢ | Caso geométrico |
| :-: | :-- | :-- | :-: | :-: | :-: | :-- |
| 1 | Shoulder_Rotation | q1 | -0.1025 | 0.0306 | +90° | ejes oblicuos |
| 2 | Shoulder_Pitch | q2 − 76.032° | 0.0000 | 0.1160 | 0° | ejes paralelos → *d* = 0 |
| 3 | Elbow | q3 + 73.825° | 0.0000 | 0.1350 | 0° | ejes paralelos → *d* = 0 |
| 4 | Wrist_Pitch | q4 − 87.792° | 0.0000 | 0.0000 | +90° | ejes que se cortan → *a* = 0 |
| 5 | Wrist_Roll | q5 + 180.000° | 0.0000 | 0.0000 | 0° | ejes paralelos → *d* = 0 |

*Nota.* Elaboración propia. Los desplazamientos angulares constantes que acompañan a cada variable expresan la diferencia entre el cero mecánico declarado en el modelo y el cero que impone la convención. No son ajustes arbitrarios: son la consecuencia de que el fabricante eligió una postura de referencia distinta de la que la convención exige.


---

## Paso 3. La matriz de transformación homogénea

La relación entre dos sistemas de referencia consecutivos se expresa mediante una matriz de transformación homogénea de cuatro por cuatro, que reúne en una sola entidad la rotación y la traslación entre ambos. Su bloque superior izquierdo de tres por tres es una matriz de rotación, ortogonal y de determinante unitario; su última columna es el vector que va del origen de un sistema al del otro; su última fila es fija e igual a (0, 0, 0, 1).

Con los cuatro parámetros de la convención, esa matriz se construyó como la composición de cuatro movimientos elementales, aplicados en este orden:

    Aᵢ = Rot(z, θᵢ) · Tras(z, dᵢ) · Tras(x, aᵢ) · Rot(x, αᵢ)

es decir, una rotación de θᵢ alrededor del eje z, una traslación de dᵢ sobre ese mismo eje, una traslación de aᵢ sobre el nuevo eje x y una rotación de αᵢ alrededor de él. Desarrollado, el producto da la forma general

```
| cos θᵢ   −sin θᵢ · cos αᵢ    sin θᵢ · sin αᵢ   aᵢ · cos θᵢ |
| sin θᵢ    cos θᵢ · cos αᵢ   −cos θᵢ · sin αᵢ   aᵢ · sin θᵢ |
|      0             sin αᵢ             cos αᵢ            dᵢ |
|      0                  0                  0             1 |
```

En los cinco casos de este manipulador el ángulo αᵢ resultó valer 0° o +90°, de modo que su coseno y su seno valen 1 y 0, o bien 0 y 1. Esa circunstancia simplifica considerablemente cada matriz, como se aprecia en el paso siguiente. Para abreviar la escritura se emplea cᵢ = cos θᵢ y sᵢ = sin θᵢ, donde θᵢ es la columna correspondiente de la tabla 3.


---

## Paso 4. Las dos transformaciones constantes

Antes de la cadena de articulaciones interviene una transformación fija que lleva del sistema de la base del manipulador al sistema cero de la convención, y después de la cadena otra que lleva del último sistema hasta el punto de trabajo del efector. Ninguna de las dos depende de las articulaciones, y ambas son necesarias para que las coordenadas calculadas coincidan con las que reporta el programa de control.

Transformación de base, del sistema `base_link` al sistema 0:

```
|  0.000000   -1.000000    0.000000    0.000000 |
| -1.000000    0.000000    0.000004   -0.045200 |
| -0.000004    0.000000   -1.000000    0.016500 |
|  0.000000    0.000000    0.000000    1.000000 |
```

Transformación de herramienta, del sistema 5 al punto del efector:

```
|  1.000000    0.000000   -0.000006    0.000000 |
| -0.000006    0.000000   -1.000000    0.000000 |
|  0.000000    1.000000    0.000000   -0.150100 |
|  0.000000    0.000000    0.000000    1.000000 |
```

Los términos del orden de 10⁻⁶ que aparecen fuera de la diagonal no son ruido de cálculo: provienen de que el modelo descriptivo declara los ángulos rectos como 1.5708 y 1.57079 radianes en lugar del valor exacto. Se conservaron para que la cinemática aquí desarrollada reproduzca la del modelo hasta la precisión de la máquina.

La herramienta se extiende 150.1 mm sobre el eje z₅, que es precisamente el eje de giro de la muñeca. Esa sola observación explica por qué la posición del efector no depende de la quinta articulación, resultado que se comprueba numéricamente en el paso 7.


---

## Paso 5. Desarrollo articulación por articulación

Para cada articulación se presenta el origen de sus cuatro parámetros, su matriz en forma simbólica con las constantes ya sustituidas, y esa misma matriz evaluada en la configuración de prueba. Al final de cada apartado se acumula el producto desde la base y se reporta la posición que ocupa el origen del sistema correspondiente.


### Articulación 1 — rotación de hombro (`Shoulder_Rotation`)

| Parámetro | Valor | Origen del valor |
| :-: | :-: | :-- |
| θ1 | q1 | El eje x₀ se eligió alineado con la normal común, de modo que no fue necesario ningún desplazamiento constante. |
| d1 | -0.1025 m | Desplazamiento a lo largo de z_0 entre las dos normales comunes. |
| a1 | 0.0306 m | Longitud de la normal común entre z_0 y z_1. |
| α1 | +90° | Ángulo entre z_0 y z_1, medido alrededor de x_1. |

Sustituyendo esos valores en la forma general del paso 3, y escribiendo c1 = cos θ1 y s1 = sin θ1, la matriz de esta articulación resultó:

```
A1 =
| c1   0    s1   0.0306·c1 |
| s1   0   -c1   0.0306·s1 |
|  0   1     0     -0.1025 |
|  0   0     0           1 |
```

Evaluada en q1 = +35°, de donde θ1 = +35.000°, c1 = +0.819152 y s1 = +0.573576:

```
|  0.8192    0.0000    0.5736    0.0251 |
|  0.5736    0.0000   -0.8192    0.0176 |
|  0.0000    1.0000    0.0000   -0.1025 |
|  0.0000    0.0000    0.0000    1.0000 |
```

Acumulando el producto desde la base, el origen del sistema 1 quedó situado en **(-17.55, -70.27, 119.00) mm**.


### Articulación 2 — cabeceo de hombro (`Shoulder_Pitch`)

| Parámetro | Valor | Origen del valor |
| :-: | :-: | :-- |
| θ2 | q2 − 76.032° | Ángulo medido entre x_1 y x_2 con todas las articulaciones en cero. Expresa la diferencia entre la postura de referencia del fabricante y la que impone la convención. |
| d2 | 0.0000 m | Desplazamiento a lo largo de z_1 entre las dos normales comunes. |
| a2 | 0.1160 m | Longitud de la normal común entre z_1 y z_2. |
| α2 | 0° | Ángulo entre z_1 y z_2, medido alrededor de x_2. |

Sustituyendo esos valores en la forma general del paso 3, y escribiendo c2 = cos θ2 y s2 = sin θ2, la matriz de esta articulación resultó:

```
A2 =
| c2   -s2   0   0.116·c2 |
| s2    c2   0   0.116·s2 |
|  0     0   1          0 |
|  0     0   0          1 |
```

Evaluada en q2 = -20°, de donde θ2 = -96.032°, c2 = -0.105085 y s2 = -0.994463:

```
| -0.1051    0.9945    0.0000   -0.0122 |
| -0.9945   -0.1051    0.0000   -0.1154 |
|  0.0000    0.0000    1.0000    0.0000 |
|  0.0000    0.0000    0.0000    1.0000 |
```

Acumulando el producto desde la base, el origen del sistema 2 quedó situado en **(-10.56, -60.28, 234.36) mm**.


### Articulación 3 — codo (`Elbow`)

| Parámetro | Valor | Origen del valor |
| :-: | :-: | :-- |
| θ3 | q3 + 73.825° | Ángulo medido entre x_2 y x_3 con todas las articulaciones en cero. Expresa la diferencia entre la postura de referencia del fabricante y la que impone la convención. |
| d3 | 0.0000 m | Desplazamiento a lo largo de z_2 entre las dos normales comunes. |
| a3 | 0.1350 m | Longitud de la normal común entre z_2 y z_3. |
| α3 | 0° | Ángulo entre z_2 y z_3, medido alrededor de x_3. |

Sustituyendo esos valores en la forma general del paso 3, y escribiendo c3 = cos θ3 y s3 = sin θ3, la matriz de esta articulación resultó:

```
A3 =
| c3   -s3   0   0.135·c3 |
| s3    c3   0   0.135·s3 |
|  0     0   1          0 |
|  0     0   0          1 |
```

Evaluada en q3 = +45°, de donde θ3 = +118.825°, c3 = -0.482129 y s3 = +0.876100:

```
| -0.4821   -0.8761    0.0000   -0.0651 |
|  0.8761   -0.4821    0.0000    0.1183 |
|  0.0000    0.0000    1.0000    0.0000 |
|  0.0000    0.0000    0.0000    1.0000 |
```

Acumulando el producto desde la base, el origen del sistema 3 quedó situado en **(-81.95, -162.23, 182.06) mm**.


### Articulación 4 — cabeceo de muñeca (`Wrist_Pitch`)

| Parámetro | Valor | Origen del valor |
| :-: | :-: | :-- |
| θ4 | q4 − 87.792° | Ángulo medido entre x_3 y x_4 con todas las articulaciones en cero. Expresa la diferencia entre la postura de referencia del fabricante y la que impone la convención. |
| d4 | 0.0000 m | Desplazamiento a lo largo de z_3 entre las dos normales comunes. |
| a4 | 0.0000 m | Longitud de la normal común entre z_3 y z_4. |
| α4 | +90° | Ángulo entre z_3 y z_4, medido alrededor de x_4. |

Sustituyendo esos valores en la forma general del paso 3, y escribiendo c4 = cos θ4 y s4 = sin θ4, la matriz de esta articulación resultó:

```
A4 =
| c4   0    s4   0 |
| s4   0   -c4   0 |
|  0   1     0   0 |
|  0   0     0   1 |
```

Evaluada en q4 = -30°, de donde θ4 = -117.792°, c4 = -0.466265 y s4 = -0.884645:

```
| -0.4663    0.0000   -0.8846    0.0000 |
| -0.8846    0.0000    0.4663    0.0000 |
|  0.0000    1.0000    0.0000    0.0000 |
|  0.0000    0.0000    0.0000    1.0000 |
```

Acumulando el producto desde la base, el origen del sistema 4 quedó situado en **(-81.95, -162.23, 182.06) mm**.


### Articulación 5 — giro de muñeca (`Wrist_Roll`)

| Parámetro | Valor | Origen del valor |
| :-: | :-: | :-- |
| θ5 | q5 + 180.000° | Ángulo medido entre x_4 y x_5 con todas las articulaciones en cero. Expresa la diferencia entre la postura de referencia del fabricante y la que impone la convención. |
| d5 | 0.0000 m | Desplazamiento a lo largo de z_4 entre las dos normales comunes. |
| a5 | 0.0000 m | Longitud de la normal común entre z_4 y z_5. |
| α5 | 0° | Ángulo entre z_4 y z_5, medido alrededor de x_5. |

Sustituyendo esos valores en la forma general del paso 3, y escribiendo c5 = cos θ5 y s5 = sin θ5, la matriz de esta articulación resultó:

```
A5 =
| c5   -s5   0   0 |
| s5    c5   0   0 |
|  0     0   1   0 |
|  0     0   0   1 |
```

Evaluada en q5 = +60°, de donde θ5 = +240.000°, c5 = -0.500000 y s5 = -0.866025:

```
| -0.5000    0.8660    0.0000    0.0000 |
| -0.8660   -0.5000    0.0000    0.0000 |
|  0.0000    0.0000    1.0000    0.0000 |
|  0.0000    0.0000    0.0000    1.0000 |
```

Acumulando el producto desde la base, el origen del sistema 5 quedó situado en **(-81.95, -162.23, 182.06) mm**.


> **Comprobación de este paso.** Las cinco matrices escritas en forma simbólica se contrastaron contra la implementación general de la transformación homogénea, con una diferencia máxima de 0.0e+00. Es decir, la forma simbólica y la forma general son la misma matriz, y la simplificación no introdujo ningún error.


---

## Paso 6. Cinemática directa completa

La cinemática directa se obtuvo encadenando las cinco matrices, con las dos transformaciones constantes en los extremos:

    T_efector = T_base · A₁ · A₂ · A₃ · A₄ · A₅ · T_herramienta

En la configuración de prueba el resultado fue

```
| -0.734398    0.571394    0.366291   -0.167712 |
|  0.461037    0.816036   -0.348612   -0.284719 |
| -0.498101   -0.087146   -0.862729    0.195140 |
|  0.000000    0.000000    0.000000    1.000000 |
```

de donde se leyeron directamente las dos magnitudes físicas de interés:

- la **posición del efector**, en las tres primeras filas de la última columna: x = -167.71 mm, y = -284.72 mm, z = 195.14 mm;
- la **orientación del efector**, en el bloque de rotación de tres por tres. En particular el eje de la herramienta, que corresponde a la segunda columna, apuntó en la dirección (+0.5714, +0.8160, -0.0871).

En la configuración cero, que es la que reproducen las figuras de este documento, el resultado fue

```
|  0.000006    0.000000    1.000000    0.000000 |
|  0.000010    1.000000    0.000000   -0.388801 |
| -1.000000    0.000010    0.000006    0.236768 |
|  0.000000    0.000000    0.000000    1.000000 |
```

> **Comprobación de este paso.** La misma configuración evaluada con la cinemática del modelo descriptivo, sin pasar por la convención de Denavit-Hartenberg, difirió en 4.441e-16. Sobre veinte mil configuraciones generadas al azar dentro de los límites articulares el error máximo fue de 1.485 × 10⁻¹⁵, que corresponde al redondeo de la aritmética de punto flotante de sesenta y cuatro bits y no a una diferencia de modelado.


---

## Paso 7. Jacobiano geométrico, columna por columna

El jacobiano relaciona las velocidades de las articulaciones con la velocidad del efector final. Para un mecanismo de cinco articulaciones cuyo efector se describe con seis componentes de velocidad —tres lineales y tres angulares— el jacobiano es una matriz de **seis filas por cinco columnas**. Esa forma rectangular, y no cuadrada, es la causa de varias particularidades que se tratan en los pasos siguientes.

Como las cinco articulaciones son de revolución, cada columna se construyó geométricamente mediante

    Jᵢ = [ zᵢ × (o_n − oᵢ) ;  zᵢ ]

donde zᵢ es el eje de giro de la articulación expresado en el sistema de la base, oᵢ el origen de su sistema y o_n el punto del efector. La interpretación física del producto vectorial es directa: un giro alrededor de un eje produce sobre un punto una velocidad lineal proporcional al brazo de palanca que los separa y perpendicular a ambos.

En la configuración de prueba los ingredientes de cada columna resultaron:

**Tabla 4**

*Elementos geométricos de cada columna del jacobiano en la configuración de prueba*

| i | zᵢ (eje de giro) | oᵢ (mm) | o_n − oᵢ (mm) |
| :-: | :-- | :-- | :-- |
| 1 | (+0.0000, +0.0000, -1.0000) | (0.0, -45.2, 16.5) | (-167.7, -239.5, 178.6) |
| 2 | (+0.8192, -0.5736, -0.0000) | (-17.6, -70.3, 119.0) | (-150.2, -214.5, 76.1) |
| 3 | (+0.8192, -0.5736, -0.0000) | (-10.6, -60.3, 234.4) | (-157.2, -224.4, -39.2) |
| 4 | (+0.8192, -0.5736, -0.0000) | (-81.9, -162.2, 182.1) | (-85.8, -122.5, 13.1) |
| 5 | (+0.5714, +0.8160, -0.0871) | (-116.3, -211.3, 187.3) | (-51.4, -73.4, 7.8) |

*Nota.* Elaboración propia.

El jacobiano resultante, con las tres primeras filas en metros por radián y las tres últimas adimensionales, fue

```
| -0.239518   -0.043672    0.022494   -0.007503    0.000000 |
|  0.167712   -0.062370    0.032126   -0.010715    0.000000 |
|  0.000001   -0.261798   -0.273987   -0.149529    0.000000 |
|  0.000000    0.819152    0.819152    0.819152    0.571394 |
|  0.000004   -0.573576   -0.573576   -0.573576    0.816036 |
| -1.000000   -0.000002   -0.000002   -0.000002   -0.087146 |
```

> **Comprobación de este paso.** El jacobiano se contrastó contra una aproximación por diferencias finitas centradas de la cinemática directa. En esta configuración la diferencia máxima fue de 6.524e-10; sobre tres mil configuraciones, 3.023 × 10⁻⁹. Ese residuo corresponde al error de truncamiento propio del método de diferencias, no a una discrepancia de formulación.

Merece atención la **quinta columna**. Su parte lineal resultó (+4.3e-18, -4.3e-18, -1.4e-17), es decir, el vector nulo. Girar la muñeca no desplaza el efector, porque su punto de trabajo se encuentra sobre el propio eje de giro. En consecuencia, **la posición del efector depende únicamente de las cuatro primeras articulaciones**. Es el mismo hecho que se observa en el último panel de la figura 2.


---

## Paso 8. Índice de manipulabilidad

El índice de manipulabilidad de Yoshikawa cuantifica mediante un solo número la facilidad con que el mecanismo puede moverse desde una configuración dada. Geométricamente expresa el volumen del elipsoide de velocidades que el efector puede alcanzar: un valor elevado indica holgura de movimiento en todas las direcciones, y un valor que tiende a cero indica proximidad a una configuración singular.

Aquí fue necesaria una precisión que la formulación habitual omite. La expresión que aparece con mayor frecuencia en la literatura es

    w = √( det( J · Jᵀ ) )

y es correcta **únicamente cuando el jacobiano tiene al menos tantas columnas como filas**. En el manipulador estudiado el jacobiano tiene seis filas y cinco columnas, de modo que el producto J·Jᵀ es una matriz de seis por seis cuyo rango no puede superar cinco: su determinante es idénticamente nulo en toda configuración, y la expresión devuelve cero siempre, sin aportar información alguna.

La formulación válida en este caso invierte el orden del producto:

    w = √( det( Jᵀ · J ) )

que equivale al producto de los cinco valores singulares del jacobiano.

**Tabla 5**

*Índice de manipulabilidad en la configuración cero, según cada formulación*

| Expresión | Valor | Interpretación |
| :-- | :-: | :-- |
| det(J·Jᵀ) | 0.000e+00 | Numéricamente cero, como exige el rango. |
| √(det(J·Jᵀ)) | 0.000000 | La fórmula habitual, sin contenido aquí. |
| **√(det(Jᵀ·J))** | **0.015903** | La formulación válida en este caso. |
| Producto de los valores singulares | 0.015903 | Coincide con la anterior, como debe. |

*Nota.* Elaboración propia.

Los cinco valores singulares en la configuración cero resultaron 1.7868, 1.0574, 1.0000, 0.1389, 0.0606.

> **Observación.** Esta no es una sutileza de notación. El Robotics Toolbox de Peter Corke, empleado en este trabajo como implementación independiente, aplica la fórmula habitual y devuelve exactamente cero para este manipulador. No se trata de un defecto de esa biblioteca: la fórmula exige una condición dimensional que este mecanismo no cumple. La versión de tres por cinco, que considera únicamente la parte lineal del jacobiano, sí es válida y arrojó 0.012545. Es la que calcula el nodo de teleoperación del proyecto, y por esa razón su resultado es correcto.


---

## Paso 9. Singularidad

Una configuración es singular cuando el jacobiano pierde rango. En su vecindad el manipulador deja instantáneamente de poder moverse en al menos una dirección del espacio, y las velocidades articulares necesarias para producir un movimiento pequeño del efector crecen sin cota. Identificarlas no es un ejercicio teórico: son las configuraciones en las que un controlador basado en el jacobiano se vuelve inestable.

El barrido de doscientas mil configuraciones distribuidas dentro de los límites articulares reveló que la cadena posee **una sola familia de configuraciones singulares interna a su rango de trabajo**, y que todas comparten el mismo valor de la tercera articulación: **q₃ = -73.825°**.

Ese valor no resultó arbitrario. Es exactamente el opuesto del desplazamiento constante de la tercera fila de la tabla, de modo que θ₃ = 0 y los eslabones a₂ y a₃ quedan alineados: se trata de la singularidad de codo extendido, la más conocida de los manipuladores articulados.

**Tabla 6**

*Caracterización de la singularidad interna*

| Magnitud | Valor |
| :-- | :-- |
| Configuración | q₃ = -73.825°, con independencia de las demás articulaciones |
| Valores singulares | 1.798706, 1.403316, 0.219983, 0.171073, 0.000000 |
| Rango del jacobiano | 4 (fuera de la singularidad, 5) |
| Índice de manipulabilidad | 0.000e+00 frente a una mediana de 8.6 × 10⁻³ |
| Dirección articular que se pierde | (-0.0000, +0.4387, -0.8157, +0.3770, +0.0000) |

*Nota.* Elaboración propia. La dirección perdida es el vector singular derecho asociado al valor singular nulo. Expresa el movimiento coordinado de las tres articulaciones de cabeceo que no produce ningún movimiento del efector: el brazo se mueve, pero la herramienta no.

El límite mecánico de esa articulación alcanza ±85.9°, de modo que **la singularidad se encuentra dentro del recorrido admisible** y el operador la atraviesa durante el uso normal del manipulador, precisamente cuando estira el brazo para alcanzar un objeto lejano. La configuración simétrica, con el codo completamente plegado, correspondería a θ₃ = 180°, es decir q₃ = +106.2°, valor que queda fuera del límite y por tanto no es alcanzable.

![Mapa del índice de manipulabilidad](figuras/fig3_manipulabilidad.png)

**Figura 5.** *Índice de manipulabilidad sobre el plano de las articulaciones dos y tres.* La franja oscura vertical corresponde a la singularidad de codo extendido. Elaboración propia.

![Valores singulares al atravesar la singularidad](figuras/fig4_singularidad.png)

**Figura 6.** *Valores singulares del jacobiano y pérdida de rango al atravesar la configuración singular.* Elaboración propia.


---

## Paso 10. Cinemática inversa

El planteamiento del problema inverso exige separar dos preguntas que con frecuencia se confunden, y de cuya distinción depende que la respuesta resulte defendible.

### ¿Puede el manipulador alcanzar una pose arbitraria del espacio?

No, y la razón es estructural, no algorítmica: una pose completa en el espacio tridimensional —posición y orientación— tiene seis grados de libertad, y el mecanismo dispone de cinco. Ningún método de resolución puede recuperar un grado de libertad que el mecanismo no posee.

La restricción concreta se dedujo de la estructura establecida en el paso 0 y se verificó numéricamente sobre doscientas mil configuraciones: **el eje de la herramienta está obligado a permanecer dentro del plano vertical que definen el eje de la base y el punto del efector**, con una desviación máxima de 1.2 × 10⁻⁴ fuera de una vecindad de diez milímetros alrededor del eje de la base, donde ese plano no está definido. El motivo es que dicho eje resulta de la cadena plana, y el plano lo elige la primera articulación; la quinta gira la herramienta sobre ese eje, pero no lo saca del plano.

La comprobación fue concluyente: al tomar posiciones alcanzables y solicitar sobre ellas orientaciones generadas al azar de forma uniforme, **ninguna de las mil poses planteadas resultó alcanzable**.

### ¿Existe solución cerrada para la tarea que el manipulador sí puede ejecutar?

Sí, y esa es la formulación útil del problema. El espacio de tareas alcanzable tiene cinco dimensiones y se descompone en la posición del efector, que aporta tres; la dirección del eje de la herramienta, que aporta una porque su componente fuera del plano está fijada; y el giro de la herramienta sobre su propio eje, que aporta la quinta.

El procedimiento se ilustra a continuación sobre la pose que produce la configuración de prueba, de modo que el resultado puede contrastarse con el valor de partida.

**Objetivo.** Llevar el efector a (-167.71, -284.72, 195.14) mm con el eje de la herramienta en la dirección (-0.8160, -0.5714, +0.0871), expresada en el sistema cero.

1. **Ángulo de la base.** Se despejó del azimut del punto objetivo respecto del eje de la base: θ₁ = atan2(0.167712, 0.239518) = +35.0000°, que descontando el desplazamiento constante de la primera fila dio q₁ = +35.0000°. Existe una segunda rama, separada ciento ochenta grados, que alcanza el mismo punto con el brazo al otro lado del eje.
2. **Proyección al plano.** Aplicando la inversa de A₁, el problema quedó reducido a una cadena plana de tres eslabones con longitudes a₂, a₃ y la extensión de la herramienta. Que el objetivo caiga efectivamente en ese plano constituye la condición de alcanzabilidad: si no cae, la pose es inalcanzable y el procedimiento lo detecta en este punto, sin necesidad de iterar.
3. **Punto de la muñeca.** Se retrocedió desde el objetivo una distancia igual a la extensión de la herramienta, 150.1 mm, en dirección contraria a su eje.
4. **Ángulo del codo.** Se despejó de la ley del coseno sobre el triángulo que forman a₂, a₃ y la distancia al punto de la muñeca. Existen dos ramas, codo arriba y codo abajo.
5. **Ángulo del hombro.** Se obtuvo por diferencia de argumentos entre la dirección al punto de la muñeca y el ángulo interno del triángulo anterior.
6. **Cabeceo de muñeca.** Se obtuvo por diferencia entre la orientación deseada de la herramienta dentro del plano y la suma de los dos ángulos anteriores.
7. **Giro de muñeca.** Se extrajo de la rotación residual entre la orientación que alcanzan las cuatro primeras articulaciones y la solicitada.

Aplicado a este objetivo, el procedimiento devolvió **4 soluciones exactas**, de las cuales **1 quedó dentro de los límites articulares**. La solución admisible fue:

**Tabla 7**

*Solución del problema inverso contrastada con la configuración de partida*

| Articulación | Solución (°) | Valor de partida (°) | Diferencia |
| :-: | :-: | :-: | :-: |
| q1 | +35.0000 | +35 | 1.4e-14 |
| q2 | -20.0000 | -20 | 3.6e-15 |
| q3 | +45.0000 | +45 | 0.0e+00 |
| q4 | -30.0000 | -30 | 2.1e-14 |
| q5 | +60.0000 | +60 | 7.1e-15 |

*Nota.* Elaboración propia. Al sustituir la solución en la cinemática directa se recuperó la pose objetivo con un error máximo de 4.163e-16.

La solución no requiere iteración ni valores iniciales. Se validó generando tres mil poses con la cinemática directa y resolviéndolas con este procedimiento: **3000 de 3000 resueltas**, error máximo de posición 3.9 × 10⁻¹⁶ m, 3.38 soluciones exactas por pose en promedio, de las que 1.16 quedaron dentro de los límites articulares.

> **Defecto detectado y corregido.** La primera versión del procedimiento devolvía candidatas sin comprobar que reprodujeran la pose solicitada. Sobre poses de orientación arbitraria devolvía una candidata en el dieciocho por ciento de los casos, y ninguna de ellas alcanzaba realmente la pose pedida: el peor error de orientación fue de 1.055. Un programa de control que hubiera confiado en esa versión habría enviado el manipulador a una postura equivocada sin ningún aviso. La versión corregida sustituye cada candidata en la cinemática directa y descarta la que no reproduce el objetivo. Se deja constancia del defecto porque ilustra por qué un procedimiento de resolución debe validar su propia salida.


---

## Paso 11. Espacio de trabajo

El conjunto de puntos alcanzables por el efector se caracterizó aprovechando que su posición depende únicamente de las articulaciones dos, tres y cuatro, resultado establecido en el paso 7. Los extremos se obtuvieron mediante mallas sucesivas que se estrechan alrededor del mejor punto, siempre dentro de los límites articulares, de modo que las cifras no dependen del muestreo y se reproducen de forma idéntica en cualquier ejecución.

**Tabla 8**

*Dimensiones del espacio de trabajo alcanzable*

| Magnitud | Valor |
| :-- | :-: |
| Alcance radial máximo desde el eje de la base | 431.70 mm |
| Distancia máxima del efector al origen del modelo | 542.19 mm |
| Altura máxima sobre el plano de montaje | 520.10 mm |
| Altura mínima | −213.19 mm |
| Recorrido angular de la base | ±112.3° |

*Nota.* Elaboración propia. Como la primera articulación gira el plano completo del brazo, el conjunto resultante es un sólido de revolución alrededor del eje vertical de la base.

> **Defecto detectado y corregido.** Una primera versión del refinamiento empleaba un optimizador sin restricciones, que abandonaba el recorrido mecánico de las articulaciones y devolvía una altura mínima de −282.10 mm, imposible para el manipulador. El valor correcto, obtenido con el refinamiento acotado y confirmado sobre una malla de 4.17 millones de configuraciones, es −213.19 mm.

![Espacio de trabajo alcanzable](figuras/fig2_workspace.png)

**Figura 7.** *Espacio de trabajo alcanzable: sección meridiana y proyección horizontal.* Elaboración propia.


---

## Paso 12. Verificación

Cada resultado del desarrollo se contrastó contra implementaciones ajenas al proyecto. La tabla siguiente reúne todas las comprobaciones realizadas.

**Tabla 9**

*Verificación cruzada del modelo cinemático*

| Qué se comparó | Contra qué | Muestras | Error máximo |
| :-- | :-- | :-: | :-- |
| Cinemática directa por Denavit-Hartenberg | Cinemática del modelo descriptivo | 20 000 | 1.485 × 10⁻¹⁵ m |
| Cinemática directa | Robotics Toolbox, modelo de Denavit-Hartenberg | 5 000 | 1.665 × 10⁻¹⁶ m |
| Orientación del efector | Robotics Toolbox | 5 000 | 4.441 × 10⁻¹⁶ |
| Cinemática directa | Robotics Toolbox, transformadas elementales del modelo descriptivo | 5 000 | 1.360 × 10⁻¹⁵ m |
| Jacobiano geométrico | Robotics Toolbox | 5 000 | 1.277 × 10⁻¹⁵ |
| Jacobiano geométrico | Diferencias finitas centradas | 3 000 | 3.023 × 10⁻⁹ |
| Cinemática inversa cerrada | Ida y vuelta por cinemática directa | 3 000 | 3.886 × 10⁻¹⁶ m |
| Paralelismo de los tres cabeceos | Ejes del modelo descriptivo | 3 | 0 exacto |
| Independencia de la posición respecto de q₅ | Barrido directo | 2 000 | 1.110 × 10⁻¹⁶ m |
| Sentido de giro de las cinco articulaciones | Registro del simulador con el planificador de movimiento | 5 | 1.2°, 2.1° y 11.9° |

*Nota.* Elaboración propia. Un error del orden de 10⁻¹⁵ corresponde al redondeo de la aritmética de punto flotante de sesenta y cuatro bits, no a una diferencia de modelado.

La figura siguiente contrasta visualmente la implementación propia con la del Robotics Toolbox en la misma configuración.

![Contraste con el Robotics Toolbox](figuras/figF_toolbox.png)

**Figura 8.** *El mismo manipulador en dos implementaciones independientes.* A la izquierda, el modelo construido dentro del Robotics Toolbox a partir de la tabla de Denavit-Hartenberg; a la derecha, el modelo dibujado con las mallas del modelo descriptivo y colocado con la cinemática directa propia. La posición del efector coincide en ambos. Elaboración propia.

La última fila de la tabla 9 requiere explicación. Se dispuso de un registro del manipulador en el visualizador del middleware, movido articulación por articulación desde el panel de planificación de movimiento. Del registro se extrajeron la posición de cada corredera y el desplazamiento aparente del brazo, y se buscó **una sola dirección de cámara capaz de explicar simultáneamente las cinco**. Si algún signo de la tabla estuviera invertido, no existiría ninguna cámara capaz de hacerlo. Las tres articulaciones que desplazan el brazo de forma apreciable se reprodujeron con desviaciones de 1.2°, 2.1° y 11.9°. Para el cabeceo de muñeca el desplazamiento aparente quedó por debajo del ruido del método, y para el giro de muñeca el propio modelo predice un desplazamiento de 0.2 mm: el registro confirmó así, de forma independiente, que la quinta articulación no desplaza el efector.
