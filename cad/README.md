# Modelo paramétrico del manipulador

Modelo tridimensional completo del manipulador, elaborado por el equipo del
proyecto en SolidWorks 2022.

## Por qué existe este modelo, si el proyecto de origen ya publica geometría

El proyecto de origen, `TheRobotStudio/SO-ARM100`, publica la geometría de
las piezas estructurales en formatos de malla e intercambio, y esos archivos
bastan para fabricar el brazo. No bastaron, sin embargo, para el trabajo que
este proyecto tenía que hacer, por tres razones concretas:

**El modelo de origen se distribuye en la postura de reposo, y no es
editable.** Este proyecto necesitaba el mecanismo en la postura de
inicialización, que es la que adopta el brazo al energizarse y la que sirve
de referencia angular para todo el modelo cinemático. Sobre un archivo de
malla esa postura no puede cambiarse.

**El modelo de origen no incluye los servomotores.** Sin ellos no es posible
estimar masas, centros de gravedad ni el momento gravitatorio sobre cada
articulación, que son los datos sobre los que descansa el balance de par del
objetivo específico 1. El conjunto `Servo ST3215.SLDASM` de esta carpeta es
un modelo del actuador levantado por el equipo precisamente para eso.

**El ensamblaje permite interpretar visualmente el mecanismo.** Buena parte
del análisis cinemático —la identificación de qué ejes son paralelos, dónde
se cortan, qué postura corresponde al cero mecánico— se resolvió observando
el ensamblaje. Sin él, el desarrollo matemático del objetivo específico 5 no
habría podido plantearse.

Por ese camino, cada pieza se importó a SolidWorks desde los formatos de
malla e intercambio del proyecto de origen y se reconstruyó como sólido
paramétrico. **La importación no es una operación sin pérdida**: al convertir
una malla en un sólido se pierden el árbol de operaciones, las relaciones
paramétricas y parte del detalle de las superficies. Las piezas de esta
carpeta son, por tanto, un modelo derivado destinado al análisis y a la
visualización, y no deben considerarse equivalentes a los archivos de
fabricación del proyecto de origen. **Para fabricar, use las mallas STL.**

## Atribución

El diseño mecánico del manipulador es obra de **The Robot Studio**
(`TheRobotStudio/SO-ARM100`) y se distribuye bajo licencia Apache 2.0, que
autoriza la obra derivada con atribución.

El material de esta carpeta **no reclama la autoría del diseño del robot**.
Lo que el equipo de este proyecto aportó es el trabajo de reconstrucción
paramétrica, el modelo del actuador, el ensamblaje en la postura de
inicialización y la extracción de las propiedades inerciales. El diseño
mecánico sigue siendo de sus autores originales.

## Contenido

| Carpeta | Qué contiene | Formato | Para qué sirve |
|---|---|---|---|
| `stl/` | Las doce piezas estructurales | STL | **Fabricación.** Son los archivos que se enviaron a manufactura aditiva |
| `step/` | Las doce piezas estructurales | STEP (ISO 10303) | Intercambio con cualquier programa de diseño. Formato abierto |
| `piezas/` | Las doce piezas estructurales | SLDPRT | Edición paramétrica. Requiere SolidWorks |
| `ensamblajes/` | Ensamblaje completo, ensamblaje final y modelo del actuador | SLDASM | Visualización e interpretación del mecanismo |

La numeración de las piezas de `1` a `12` corresponde a la empleada en el
pedido de manufactura y en el procedimiento de ensamble documentado en el
objetivo específico 3.

`ensamblajes/Ensamble Brazo Robótico.mp4` es una grabación del ensamblaje en
el entorno de diseño, útil para seguir el orden de montaje antes de armar el
brazo físico.

## Git LFS

Los archivos `.SLDPRT`, `.SLDASM`, `.step` y `.mp4` de esta carpeta se
almacenan mediante **Git LFS**, porque suman alrededor de 365 MB y cargarlos
en el historial ordinario volvería lento el repositorio de forma permanente.
Las mallas `.STL`, que son las de fabricación y suman apenas 5 MB, se
versionan de manera ordinaria y están disponibles sin LFS.

Para obtener esta carpeta completa hace falta tener Git LFS instalado:

```bash
git lfs install
git clone https://github.com/Edangelux/so-arm100-teleop.git
```

Si clona sin LFS instalado, el repositorio se descarga igual y los archivos
de esta carpeta aparecen como punteros de texto. Para obtener el contenido
real basta instalar LFS y ejecutar `git lfs pull`. **Nada de lo necesario
para ejecutar el sistema depende de esta carpeta**: quien sólo quiera poner
en marcha la estación puede prescindir de ella por completo.

## Formatos y programas

| Formato | Programa necesario | Es abierto |
|---|---|---|
| STL | Cualquier laminador o visor de mallas | Sí |
| STEP | FreeCAD, Fusion, Onshape, SolidWorks, Inventor | Sí, norma ISO 10303 |
| SLDPRT / SLDASM | SolidWorks 2022 o posterior | No, formato propietario |

Quien no disponga de SolidWorks puede abrir los archivos STEP en FreeCAD,
que es de código abierto, y obtener la misma geometría.
