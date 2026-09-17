# Figuras generadas con MATLAB

Esta carpeta recoge las figuras del análisis cinemático producidas con MATLAB.
Están separadas de `analisis/cinematica/figuras/`, que contiene las figuras
equivalentes generadas con Python, porque proceden de dos implementaciones
independientes del mismo modelo y esa independencia es precisamente lo que les
da valor: cada figura de una carpeta puede contrastarse contra su homóloga de
la otra.

## Cómo se regeneran

Desde MATLAB, situado en esta carpeta o con ella en la ruta de búsqueda:

```matlab
SOARM100_graficas    % produce las figuras 1 a 4
SOARM100_toolbox     % produce las figuras 5 y 6
```

Ambos guiones escriben los archivos en este directorio además de mostrarlos en
pantalla, y crean el directorio si no existe. La resolución de salida es de
220 puntos por pulgada. No hace falta ninguna preparación previa: los guiones
resuelven su propia ruta y no dependen del directorio de trabajo desde el que
se invoquen.

## Qué contiene cada archivo

| Archivo | Contenido | Requiere |
| :---- | :---- | :---- |
| `mlab_fig1_marcos_dh.png` | Los cinco sistemas de referencia de Denavit-Hartenberg sobre la cadena, en la configuración q = 0 | MATLAB base |
| `mlab_fig2_grados_de_libertad.png` | Los cinco grados de libertad, uno por panel, contra la postura de partida | MATLAB base |
| `mlab_fig3_espacio_de_trabajo.png` | Sección meridiana y planta del espacio de trabajo | MATLAB base |
| `mlab_fig4_manipulabilidad.png` | Mapa del índice de manipulabilidad en el plano q₂–q₃, con la franja de singularidad de codo extendido | MATLAB base |
| `mlab_fig5_corke_cadena_dh.png` | La cadena reconstruida con el Robotics Toolbox de Peter Corke a partir de la misma tabla D-H | Robotics Toolbox (Corke) |
| `mlab_fig6_rst_arbol_cuerpos.png` | El manipulador como árbol de cuerpos rígidos en el Robotics System Toolbox de MathWorks | Robotics System Toolbox |

Las figuras 1 a 4 se dibujan únicamente con funciones de MATLAB base, sin
ningún toolbox, de modo que se obtienen en cualquier instalación. Las figuras
5 y 6 exigen cada una su toolbox; si no está instalado, el guion lo advierte
por consola y omite esa parte sin interrumpirse.

## Advertencia sobre el eje radial de la figura 3

El eje radial de la sección meridiana mide la distancia al **origen del modelo
descriptivo**, que no coincide con el eje de giro de la base: hay 48,12 mm de
separación entre ambos. Las distancias que este proyecto consigna en el
documento —el alcance radial máximo de 431,70 mm, entre ellas— están medidas
desde el eje de la base. Al comparar una cifra de la figura contra una del
documento debe tenerse presente esa diferencia de origen.

## Índice de manipulabilidad

La figura 4 emplea la formulación `w = sqrt(det(Jᵀ·J))`. Para este mecanismo,
cuyo jacobiano es de seis filas y cinco columnas, la formulación convencional
`sqrt(det(J·Jᵀ))` devuelve exactamente cero en toda configuración, porque el
producto resulta en una matriz de seis por seis con rango cinco como máximo.
`SOARM100_toolbox.m` deja constancia de esa comprobación por consola sobre una
biblioteca externa de uso extendido.
