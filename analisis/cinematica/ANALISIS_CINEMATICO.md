# Análisis cinemático del manipulador SO-ARM100

> Este archivo documenta el módulo de análisis cinemático del proyecto. Se nombró
> `ANALISIS_CINEMATICO.md` y no `README.md` para no sustituir al archivo de presentación del
> repositorio.

## Resumen

Se desarrolló el modelo cinemático completo del manipulador SO-ARM100 de cinco grados de libertad:
parámetros de Denavit-Hartenberg, cinemática directa, cinemática inversa en forma cerrada, jacobiano
geométrico, singularidades, índice de manipulabilidad y espacio de trabajo. Cada resultado se
contrastó contra implementaciones ajenas al proyecto, con errores del orden del redondeo de punto
flotante.

## Procedencia de los datos geométricos

Todos los valores se extrajeron del modelo descriptivo del manipulador, el archivo
`so_arm_100_5dof_arm.urdf.xacro` del paquete `so_arm_100_description`, publicado en el repositorio de
acceso abierto `brukg/SO-100-arm`. Ese archivo es el mismo que cargan el simulador y el planificador
de movimiento del proyecto.

Se hace constar que **el repositorio oficial del manipulador no publica parámetros de
Denavit-Hartenberg**; existe una solicitud abierta en ese repositorio pidiendo precisamente esos
datos. La tabla empleada en este trabajo no se tomó de ninguna fuente secundaria: se derivó de los
ejes de giro y los puntos de anclaje declarados en el modelo descriptivo, aplicando el procedimiento
de la normal común, y se validó después contra tres implementaciones independientes.

---

## Requisitos

### Python

```bash
pip install numpy matplotlib scipy roboticstoolbox-python
```

| Paquete | Se requiere para | ¿Imprescindible? |
| :-- | :-- | :-- |
| `numpy` | todos los cálculos | sí |
| `matplotlib` | todas las figuras | solo para las figuras |
| `scipy` | verificación contra el registro del simulador | no |
| `roboticstoolbox-python` | contraste contra el Robotics Toolbox de Peter Corke | no |

El programa `analisis_cinematico_soarm100.py` reproduce todas las cifras del análisis y **requiere
únicamente `numpy`**.

#### Nota sobre la instalación del Robotics Toolbox en Windows

La instalación de `roboticstoolbox-python` falla con frecuencia en Windows al compilar su dependencia
`spatialgeometry`, que está escrita en C++ y no siempre dispone de rueda precompilada. El error
característico es:

```
CMake Error: CMAKE_CXX_COMPILER not set, after EnableLanguage
ERROR: Failed building wheel for spatialgeometry
```

Se comprobaron tres soluciones, ordenadas de menor a mayor esfuerzo:

1. **Usar Python 3.11 o 3.12.** En las versiones más recientes del intérprete todavía no existen
   ruedas precompiladas para esa dependencia, y el instalador se ve obligado a compilar.
   ```
   py -3.11 -m venv .venv
   .venv\Scripts\activate
   pip install roboticstoolbox-python
   ```
2. **Forzar la instalación de la dependencia ya compilada**, antes del paquete principal:
   ```
   pip install --only-binary :all: spatialgeometry
   pip install roboticstoolbox-python
   ```
3. **Instalar un compilador de C++**: *Build Tools for Visual Studio*, con la carga de trabajo
   «Desarrollo para escritorio con C++», y repetir la instalación.

Este contraste es opcional. Si no se dispone del paquete, el programa `toolbox_python.py` lo detecta,
muestra estas mismas instrucciones y termina sin error. El mismo contraste está disponible en MATLAB
sin necesidad de compilar nada.

### MATLAB

| Componente | Se requiere para | ¿Imprescindible? |
| :-- | :-- | :-- |
| MATLAB base | `SOARM100_verificacion`, `SOARM100_graficas` | sí |
| Robotics System Toolbox | la parte `rigidBodyTree` de `SOARM100_toolbox` | no |
| Robotics Toolbox de Peter Corke | la parte `SerialLink` de `SOARM100_toolbox` | no |

Los programas detectan lo que falta y omiten esa parte con un aviso, en lugar de interrumpirse.

---

## Ejecución e interpretación de las salidas

### Verificación completa, sin dependencias opcionales

```bash
python analisis_cinematico_soarm100.py
```

Imprime ocho apartados numerados. La tabla siguiente indica qué debe aparecer en cada uno y qué
significaría un resultado distinto.

| Apartado | Resultado esperado | Significado de un resultado distinto |
| :-- | :-- | :-- |
| Tabla de Denavit-Hartenberg | los cinco renglones del análisis | — |
| Cinemática directa contra el modelo descriptivo | error del orden de 10⁻¹⁵ | algún parámetro mal transcrito |
| Paralelismo de ejes | z₂×z₃ y z₃×z₄ exactamente cero | la cadena no sería plana, y todo el análisis cambiaría |
| Independencia respecto de q₅ | columna lineal del jacobiano nula | el punto del efector no estaría sobre el eje de giro |
| Manipulabilidad | det(J·Jᵀ) ≈ 0 y √det(JᵀJ) = 0.015903 | véase la nota sobre manipulabilidad |
| Singularidad | mínimo en q₃ = −73.825°, rango 5 → 4 | la singularidad estaría en otra configuración |
| Cinemática inversa | 3000 de 3000, error del orden de 10⁻¹⁶ m | la solución cerrada no sería válida |
| Poses SE(3) arbitrarias | **0 de 1000** | no es un fallo: demuestra que cinco grados de libertad no alcanzan una pose de seis |
| Espacio de trabajo | alcance radial 431.70 mm | — |

Un error del orden de **10⁻¹⁵ corresponde al redondeo de punto flotante**, no a un error de modelado.
Un error del orden de 10⁻³ o mayor indica un parámetro incorrecto.

### Verificación cruzada completa

```bash
cd codigo
python verificacion_total.py
```

Ejecuta las doce comprobaciones de la tabla de resultados y termina imprimiendo si todas pasaron.
Requiere `scipy`, y aprovecha `roboticstoolbox-python` si está disponible.

### Contraste contra el Robotics Toolbox de Peter Corke

```bash
python toolbox_python.py
```

Construye el manipulador **dos veces dentro del toolbox** —una con la tabla de Denavit-Hartenberg y
otra con la cadena de transformadas elementales del modelo descriptivo— y las compara contra la
implementación propia. Las tres deben coincidir en el orden de 10⁻¹⁵.

Este programa es también donde se observa el punto delicado de la manipulabilidad: el propio toolbox,
aplicando la fórmula que aparece en la literatura, devuelve **exactamente cero**. No se trata de un
defecto de la biblioteca. Con un jacobiano de seis filas y cinco columnas, J·Jᵀ es una matriz de seis
por seis cuyo rango no puede superar cinco, de modo que su determinante es nulo siempre. La
formulación válida es √(det(JᵀJ)). La versión de tres por cinco, que considera únicamente la parte
lineal, sí es válida y arroja 0.012545: es la que calcula el nodo de teleoperación del proyecto, y
por esa razón su resultado es correcto.

### Figuras

```bash
python figuras.py           # espacio de trabajo, manipulabilidad, singularidad, cadena plana
python figuras_cad.py       # marcos y cotas en escala de grises
python figuras_cad2.py      # marcos por articulación, cotas L y los cinco grados de libertad
python toolbox_graficas.py  # contraste visual con el Robotics Toolbox
```

`figuras.py` genera por sí mismo los muestreos que necesita la primera vez que se ejecuta, de modo
que funciona en una carpeta recién descomprimida.

Las figuras del modelo tridimensional no son ilustraciones: cada pieza se dibuja con la malla que
declara el modelo descriptivo, colocada con la transformada que produce la cinemática directa. Dibujo
y cálculo proceden de la misma fuente, de modo que no pueden contradecirse.

### Desarrollo paso a paso

```bash
python paso_a_paso.py       # genera Paso_a_paso.md
```

Escribe el desarrollo completo, articulación por articulación: origen de cada parámetro, la matriz Aᵢ
en forma simbólica, la misma evaluada en números, la posición acumulada del origen, la composición
completa, el jacobiano columna por columna y un ejemplo numérico de cinemática inversa. **Ninguna
cifra del documento está escrita a mano**: se genera a partir de los mismos módulos de cálculo.

### MATLAB

```matlab
SOARM100_verificacion   % nueve comprobaciones numeradas, con su interpretación en la cabecera
SOARM100_graficas       % cuatro figuras, únicamente con MATLAB base
SOARM100_toolbox        % contraste contra SerialLink y rigidBodyTree; se autoverifica
```

Las funciones `SOARM100_fk`, `SOARM100_jacobiano` y `SOARM100_ik` reciben argumentos. Invocadas sin
ellos emplean una configuración de demostración e informan de que lo están haciendo, de modo que
pueden ejecutarse directamente desde el editor para comprobar que todo está en orden.

`SOARM100_parametros.m` **se genera automáticamente** con `python codigo/gen_matlab.py` a partir de los
mismos módulos que producen los resultados publicados. No debe editarse a mano: escribir los
parámetros por separado en dos lenguajes es una fuente segura de discrepancias.

---

## Resultados

| Magnitud | Valor |
| :-- | :-- |
| Longitud del brazo, a₂ | 116.00 mm |
| Longitud del antebrazo, a₃ | 135.00 mm |
| Extensión de la herramienta | 150.10 mm |
| Alcance radial máximo desde el eje de la base | 431.70 mm |
| Distancia máxima del efector al origen del modelo | 542.19 mm |
| Altura máxima sobre el plano de montaje | 520.10 mm |
| Altura mínima | −213.19 mm |
| Recorrido angular de la base | ±112.3° |
| Índice de manipulabilidad en q = 0 | 0.015903 |
| Singularidad interna | q₃ = −73.825°, rango 5 → 4 |

### Verificación cruzada

| Qué se comparó | Contra qué | Muestras | Error máximo |
| :-- | :-- | :-: | :-- |
| Cinemática directa por Denavit-Hartenberg | cinemática del modelo descriptivo | 20 000 | 1.485 × 10⁻¹⁵ m |
| Configuración de origen y topes mecánicos | cinemática del modelo descriptivo | 3 | 1.305 × 10⁻¹⁵ m |
| Cinemática directa | Robotics Toolbox, modelo D-H | 5 000 | 1.665 × 10⁻¹⁶ m |
| Orientación del efector | Robotics Toolbox | 5 000 | 4.441 × 10⁻¹⁶ |
| Cinemática directa | Robotics Toolbox, transformadas elementales | 5 000 | 1.360 × 10⁻¹⁵ m |
| Jacobiano geométrico | Robotics Toolbox | 5 000 | 1.277 × 10⁻¹⁵ |
| Jacobiano geométrico | diferencias finitas centradas | 3 000 | 3.023 × 10⁻⁹ |
| Cinemática inversa cerrada | ida y vuelta por cinemática directa | 3 000 | 3.886 × 10⁻¹⁶ m |
| Paralelismo de los tres cabeceos | ejes del modelo descriptivo | 3 | 0 exacto |
| Independencia de la posición respecto de q₅ | barrido directo | 2 000 | 1.110 × 10⁻¹⁶ m |
| Sentido de giro de las articulaciones | registro del simulador con el planificador | 5 | 1.2°, 2.1° y 11.9° |

### Validación en la configuración de origen

El modelo cinemático no describe una postura, sino una función: a cada quíntupla de ángulos
articulares le corresponde una pose del efector. La configuración de origen, aquella en la que las
cinco articulaciones valen cero, es por tanto un punto particular de esa función y no un supuesto
sobre el que descanse el resto del desarrollo. Las comprobaciones de la tabla anterior se ejecutaron
sobre decenas de miles de configuraciones repartidas por todo el recorrido articular, de modo que
cubren la configuración de origen junto con cualquier otra.

Aun así, y por ser la única postura que un revisor puede contrastar a simple vista contra el
simulador, se comprobó de forma explícita. Se añadieron también los dos extremos del recorrido
mecánico, que el muestreo aleatorio no visita con certeza:

| Configuración | Error máximo entre la tabla D-H y el modelo descriptivo |
| :-- | :-- |
| Origen, q = (0, 0, 0, 0, 0) | 8.47 × 10⁻²² m |
| Todos los topes inferiores | 1.305 × 10⁻¹⁵ m |
| Todos los topes superiores | 8.049 × 10⁻¹⁶ m |

En la configuración de origen la discrepancia resultó inferior al redondeo de la aritmética de
sesenta y cuatro bits, lo que indica que ambas implementaciones ejecutan la misma secuencia de
operaciones. Los orígenes de las articulaciones en esa configuración quedaron en:

| | x (mm) | y (mm) | z (mm) |
| :-- | --: | --: | --: |
| Giro de hombro | 0.00 | −45.20 | 16.50 |
| Cabeceo de hombro | 0.00 | −75.80 | 119.00 |
| Codo | 0.00 | −103.80 | 231.60 |
| Cabeceo de muñeca | 0.00 | −238.70 | 236.80 |
| Giro de muñeca | 0.00 | −298.80 | 236.80 |
| Efector | 0.00 | −388.80 | 236.77 |

Esa disposición —una columna vertical que asciende desde la base y un antebrazo horizontal— es la
que muestran las figuras A, B, C y D de este análisis, generadas todas con la configuración q = 0, y
es la misma que adopta el manipulador al cargar el modelo descriptivo en CoppeliaSim y en MuJoCo.
Las dos únicas figuras que no corresponden a la configuración de origen son la que ilustra los cinco
grados de libertad, que mueve una articulación a la vez, y la de contraste con el Robotics Toolbox,
que emplea q = (35°, −20°, 45°, −30°, 60°) para que los eslabones se distingan entre sí; ambas lo
declaran en su pie.

Conviene señalar que el cero mecánico de este manipulador **no corresponde al brazo extendido en
línea recta**, sino a la postura tabulada arriba. El cero de cada articulación lo fija el montaje del
servomotor y no la geometría de la cadena, y es precisamente esa diferencia la que recogen los
desplazamientos angulares constantes de la tabla de Denavit-Hartenberg: −76.032°, +73.825°, −87.792°
y +180°. Un modelo que careciera de ellos reproduciría la configuración de origen con un error
apreciable, y las comprobaciones de la tabla lo habrían delatado.

Queda fuera del alcance de esta verificación una cuestión distinta, de naturaleza mecánica y no
matemática: que el cero de los servomotores del manipulador físico coincida con el cero del modelo
descriptivo. Un servomotor montado con el brazo de salida desplazado introduce un desfase constante
en esa articulación, indetectable por cálculo y corregible únicamente en la calibración del
controlador. El procedimiento de comprobación consiste en enviar el manipulador a la configuración de
origen y contrastar visualmente su postura contra la figura A.

---

## Hallazgos que conviene conocer

**La fórmula habitual de manipulabilidad no es aplicable a este manipulador.** Con un jacobiano de
seis por cinco, det(J·Jᵀ) es idénticamente cero. Debe emplearse √(det(JᵀJ)). El Robotics Toolbox de
Peter Corke, aplicando la fórmula habitual, devuelve exactamente cero para este mecanismo.

**Existe una singularidad alcanzable durante el uso normal**: q₃ = −73.825°, que corresponde al codo
extendido. El límite mecánico de esa articulación alcanza ±85.9°, de modo que el operador la
atraviesa al estirar el brazo. El rango del jacobiano desciende de 5 a 4 y se pierde la dirección
articular (0, 0.439, −0.816, 0.377, 0).

**La posición del efector no depende de q₅.** El punto de trabajo se encuentra sobre el eje de giro
de la muñeca, de modo que la quinta columna de la parte lineal del jacobiano es exactamente nula. La
posición depende únicamente de q₁ a q₄.

**Sobre la cinemática inversa**, la formulación correcta y más defendible que «no existe solución
cerrada» es la siguiente:

- Poses SE(3) arbitrarias: **0 de 1000**. No es una limitación del método, sino del mecanismo: cinco
  grados de libertad no alcanzan una pose de seis. El eje de la herramienta está obligado a
  permanecer en el plano vertical del brazo, con una desviación máxima de 1.2 × 10⁻⁴ fuera de una
  vecindad de diez milímetros alrededor del eje de la base, donde ese plano no está definido.
- La tarea de cinco dimensiones que sí puede ejecutar: **3000 de 3000**, error de posición
  3.9 × 10⁻¹⁶ m, 3.38 soluciones exactas por pose, de las que 1.16 quedan dentro de los límites
  articulares. En forma cerrada, sin iteración ni valores iniciales.

### Defectos detectados durante la verificación

El procedimiento de verificación detectó dos defectos reales en el propio desarrollo, ambos
corregidos, y un tercero en la integración con una biblioteca externa. Se consignan porque ilustran
la utilidad de contrastar cada resultado contra fuentes independientes.

1. **El programa de cinemática inversa no validaba su propia salida.** Devolvía candidatas sin
   comprobar que reprodujeran la pose solicitada: sobre poses de orientación arbitraria devolvía una
   candidata en el 18 % de los casos, y ninguna alcanzaba realmente la pose pedida, con un error de
   orientación de hasta 1.055. La versión corregida sustituye cada candidata en la cinemática directa
   y descarta la que no reproduce el objetivo.
2. **El refinamiento de los extremos del espacio de trabajo abandonaba los límites articulares.**
   Empleaba un optimizador sin restricciones y devolvía una altura mínima de −282.10 mm, imposible
   para el mecanismo. El valor correcto, confirmado sobre una malla de 4.17 millones de
   configuraciones dentro de los límites, es −213.19 mm.
3. **La construcción del árbol de cuerpos rígidos en MATLAB perdía los desplazamientos de montaje.**
   La forma abreviada `setFixedTransform(j, [a alpha d theta], 'dh')` ignora la componente θ en
   articulaciones de revolución, porque la considera la variable articular. Como cuatro de las cinco
   filas de la tabla llevan un desplazamiento angular de montaje, la geometría resultante era
   distinta y la comprobación devolvía un error de 2.0. La versión corregida fija las dos
   transformadas de cada articulación de forma explícita, lo que además resulta independiente de la
   versión de MATLAB.

---

## Estructura del módulo

```
ANALISIS_CINEMATICO.md            este archivo
Paso_a_paso.md                    desarrollo articulación por articulación
Capitulo_analisis_cinematico.md   redacción para el documento del proyecto
Validacion_en_simuladores.md      comprobación visual en CoppeliaSim, MuJoCo y RoboDK
Fuentes_modelado_matematico.md    bibliografía, con las del modelado señaladas
analisis_cinematico_soarm100.py   programa autónomo, únicamente numpy

codigo/
  cinematica.py       lectura del modelo descriptivo y cinemática directa
  dh_soarm100.py      extracción de los parámetros por el procedimiento de la normal común
  jacobiano.py        jacobiano geométrico, manipulabilidad, valores singulares
  inversa.py          cinemática inversa en forma cerrada, con validación de la salida
  vec.py              versión vectorizada, para los barridos grandes
  singularidades.py   barrido y caracterización de la singularidad
  render_robot.py     lector de mallas y renderizador
  figuras.py          figuras vectoriales
  figuras_cad.py      marcos y cotas en escala de grises
  figuras_cad2.py     marcos por articulación, cotas L y los cinco grados de libertad
  paso_a_paso.py      generador del desarrollo paso a paso
  toolbox_python.py   contraste contra el Robotics Toolbox
  toolbox_graficas.py figura de contraste
  verif_video.py      verificación contra el registro del simulador
  verificacion_total.py  las doce comprobaciones en una sola tabla
  gen_matlab.py       genera los parámetros de MATLAB desde Python
  meshes/             mallas del modelo descriptivo
  so_arm_100_5dof_arm.urdf.xacro   modelo descriptivo original
  so_arm_100_5dof.urdf             el mismo, ya expandido

matlab/
  SOARM100_parametros.m    tabla y transformaciones constantes (generado)
  SOARM100_fk.m            cinemática directa
  SOARM100_jacobiano.m     jacobiano geométrico
  SOARM100_ik.m            cinemática inversa cerrada, con validación de la salida
  SOARM100_verificacion.m  las nueve comprobaciones
  SOARM100_graficas.m      cuatro figuras, sin necesidad de toolbox
  SOARM100_toolbox.m       contraste contra SerialLink y rigidBodyTree

figuras/                   las figuras ya generadas
```

---

## Nota sobre el sentido del eje z₀

En la figura de asignación de sistemas de referencia elaborada previamente para el proyecto, el eje
z₀ se dibujó apuntando hacia arriba. En el modelo descriptivo, el eje de giro declarado para la
primera articulación apunta **hacia abajo**, y las figuras de este módulo lo representan así.

La diferencia no es estética. Conservar el sentido del modelo es lo que hace que el signo de q₁ en la
documentación coincida con el signo que el programa de control envía al servomotor. Invertirlo para
que el dibujo resulte más cómodo obliga a una conversión de signo en cada paso posterior, que es
precisamente la clase de error que este desarrollo procura hacer imposible.
