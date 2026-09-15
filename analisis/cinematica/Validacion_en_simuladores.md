# Validación visual del modelo cinemático en simuladores

## Propósito

Un modelo matemático verificado únicamente contra otro programa resulta difícil de evaluar para
quien no lee código. Por esa razón, cada afirmación del análisis cinemático se acompañó de una
comprobación que puede observarse directamente sobre el manipulador simulado: si el modelo afirma que
existe una configuración singular, esa configuración debe poder alcanzarse en el simulador y el brazo
debe comportarse allí como el modelo predice.

Este documento reúne el procedimiento seguido en cada entorno y los valores numéricos que deben
coincidir. El modelo descriptivo empleado fue `so_arm_100_5dof_arm.urdf.xacro`, tomado del paquete
`so_arm_100_description` del proyecto público `brukg/SO-100-arm`, que es el mismo archivo que cargan
el simulador y el planificador de movimiento del proyecto.

---

## Qué se comprobó, y en qué entorno

| Afirmación del análisis | Cómo se observa | Entorno |
| :-- | :-- | :-- |
| La cadena central es plana: las articulaciones 2, 3 y 4 comparten dirección de eje | Al mover solo esas tres, el efector permanece en un plano vertical que no cambia | CoppeliaSim, MuJoCo |
| La articulación 1 gira ese plano completo | Al mover solo la primera, la figura del brazo no se deforma: rota en bloque | CoppeliaSim, MuJoCo |
| La posición del efector no depende de q₅ | Al recorrer la quinta articulación en todo su rango, la pinza gira sobre sí misma y su punto de trabajo no se desplaza | CoppeliaSim, MuJoCo |
| Existe una singularidad alcanzable en q₃ = −73.825° | En esa configuración los eslabones a₂ y a₃ quedan alineados; el brazo pierde una dirección de movimiento | CoppeliaSim, MuJoCo |
| El alcance radial máximo es 431.70 mm | Se extiende el brazo y se mide la distancia del efector al eje de la base | CoppeliaSim |
| Los límites articulares son los declarados | Se lleva cada articulación a su tope y se lee el valor | CoppeliaSim, MuJoCo |
| La tabla de Denavit-Hartenberg reproduce la geometría | Se compara la pose del efector con la calculada | los tres |

**Valores de contraste.** En la configuración cero el punto del efector se sitúa en
(0.00, −388.80, 236.77) mm respecto del origen del modelo. En la configuración de prueba
q = (+35°, −20°, +45°, −30°, +60°) se sitúa en (−167.71, −284.72, 195.14) mm. Cualquier entorno que
haya cargado correctamente el modelo debe reproducir esas dos cifras.

---

## CoppeliaSim

CoppeliaSim admite el modelo descriptivo de forma directa y construye la cadena de articulaciones, de
modo que fue el entorno empleado para las comprobaciones que requieren mover las articulaciones una
por una.

### Importación

1. Se expandió previamente el archivo `.xacro` a un modelo descriptivo plano. El paquete incluye ese
   archivo ya expandido, `so_arm_100_5dof.urdf`, cuyo contenido se comprobó idéntico al original.
2. En CoppeliaSim se empleó **Complementos → Importador de URDF** (*Plugins → URDF import*). La
   opción de importación del menú `Archivo` carga geometría, no cadenas cinemáticas.
3. Se marcaron las opciones de **crear articulaciones** y **conservar la jerarquía**, y se indicó la
   carpeta `meshes/` cuando el importador solicitó las mallas.

### Comprobación de que la importación fue correcta

La jerarquía de la escena debe mostrar una cadena de siete cuerpos enlazados por articulaciones de
revolución, no un único objeto. Si en la jerarquía aparece un solo elemento —por ejemplo un objeto
llamado `base_link_visual` de tipo forma— entonces se importó únicamente la geometría y las
articulaciones no existen: el modelo se ve correcto pero no se puede mover, y ninguna de las
comprobaciones de este documento es posible. En ese caso debe repetirse la importación con el
complemento de URDF.

### Comprobaciones realizadas

Con el modelo cargado y la simulación detenida, se accedió a las propiedades de cada articulación y
se fijaron posiciones concretas:

- **Cadena plana.** Se recorrieron las articulaciones 2, 3 y 4 dejando la primera en cero. El efector
  describió trayectorias contenidas en un mismo plano vertical.
- **Giro del plano.** Se recorrió únicamente la primera articulación. El brazo giró en bloque,
  conservando su forma.
- **Independencia de q₅.** Se recorrió la quinta articulación de un extremo al otro de su rango. La
  pinza giró sobre su propio eje y el punto de trabajo permaneció fijo. Esta es la comprobación
  visual de que la quinta columna de la parte lineal del jacobiano es nula.
- **Singularidad de codo.** Se llevó la tercera articulación a −73.825°. En esa posición los dos
  eslabones del brazo quedaron alineados. Es la configuración en la que el jacobiano pierde rango.
- **Alcance máximo.** Se buscó la configuración de máxima extensión y se midió la distancia
  horizontal del efector al eje de la base, contrastándola con los 431.70 mm que declara el análisis.

---

## MuJoCo

MuJoCo compila el modelo descriptivo y ofrece un visor con deslizadores por articulación, lo que
permite recorrer los rangos de forma continua y observar el comportamiento del mecanismo.

### Carga del modelo

El modelo se abrió con el visor `simulate` que acompaña a la distribución, arrastrando sobre él el
archivo del modelo descriptivo. La barra de título muestra entonces el nombre del modelo cargado.

Existe además una versión del SO-ARM100 en la colección oficial de modelos de MuJoCo, derivada del
mismo modelo descriptivo, que puede emplearse como contraste adicional.

### Uso del visor para las comprobaciones

El panel izquierdo controla la representación y el derecho los grados de libertad:

- En el panel derecho, la sección **Joint** despliega un deslizador por articulación. Recorriendo uno
  solo a la vez se reproducen las comprobaciones de la sección anterior.
- En el panel izquierdo, dentro de **Model Elements**, la opción **Joint** dibuja los ejes de giro
  sobre el modelo. Activándola se observa directamente que los ejes de las articulaciones 2, 3 y 4
  son paralelos entre sí y perpendiculares al eje de la base.
- La opción **Transparent** permite ver los ejes que quedan ocultos dentro de las piezas.
- La opción **Center of Mass** muestra los centros de masa que declara el modelo, útiles si más
  adelante se extiende el análisis a la dinámica.

MuJoCo aporta además lo que los demás entornos no: masas, inercias y contactos. Para el análisis
cinemático de este trabajo esa información no se utilizó, pero queda disponible como continuación
natural hacia el modelo dinámico.

---

## RoboDK

Conviene dejar constancia de una limitación que se comprobó en la práctica, porque afecta a quien
intente reproducir el trabajo por esta vía.

**RoboDK no abre modelos descriptivos de robot de forma nativa.** El menú `Archivo → Abrir` reconoce
estaciones propias (`.rdk`), robots (`.robot`), herramientas (`.tool`) y geometría CAD o mallada
(STEP, IGES, STL). El formato descriptivo empleado por el resto de este trabajo no figura en esa
lista. Existe un complemento oficial de importación publicado en el catálogo de complementos de
RoboDK, que debe instalarse aparte; sin él, la importación no es posible.

Por esa razón, para RoboDK se documenta la vía que no depende de ningún complemento: construir el
mecanismo a partir de la tabla de Denavit-Hartenberg obtenida en este trabajo, mediante
**Utilidades → Modelar mecanismo o robot**, seleccionando un robot articulado de cinco ejes.

| Eje | θ desplazamiento (°) | d (mm) | a (mm) | α (°) | Mínimo (°) | Máximo (°) |
| :-: | --: | --: | --: | --: | --: | --: |
| 1 | 0.000 | −102.5 | 30.6 | +90 | −112.3 | +112.3 |
| 2 | −76.032 | 0.0 | 116.0 | 0 | −100.0 | +100.0 |
| 3 | +73.825 | 0.0 | 135.0 | 0 | −85.9 | +85.9 |
| 4 | −87.792 | 0.0 | 0.0 | +90 | −95.0 | +95.0 |
| 5 | +180.000 | 0.0 | 0.0 | 0 | −157.6 | +157.6 |

Deben declararse además las dos transformaciones constantes de los extremos: la de base, que sitúa el
sistema cero respecto del origen del modelo, y la de herramienta, que extiende 150.1 mm sobre el eje
de giro de la muñeca. Sin ellas el mecanismo se mueve correctamente pero sus coordenadas no coinciden
con las del análisis.

La comprobación consiste en llevar el mecanismo a q = (+35°, −20°, +45°, −30°, +60°) y verificar que
la posición del efector coincide con (−167.71, −284.72, 195.14) mm.

---

## Resumen

| Entorno | Carga el modelo descriptivo | Permite mover cada articulación | Dinámica | Requiere licencia |
| :-- | :-: | :-: | :-: | :-: |
| CoppeliaSim | sí, con el complemento de URDF | sí | sí | no, en su edición educativa |
| MuJoCo | sí | sí | sí | no |
| RoboDK | solo con complemento externo | sí | no | sí |
| Robotics Toolbox (Python y MATLAB) | sí | sí, por programa | no | no |

Las comprobaciones numéricas del análisis se realizaron con las dos últimas filas, por ser las que
permiten automatizar miles de configuraciones. Los simuladores de las dos primeras filas se emplearon
para la verificación visual, que es la que permite a un lector no programador comprobar por sí mismo
lo que el análisis afirma.
