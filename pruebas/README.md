# Pruebas y registros de operación

Esta carpeta conserva los datos con que se midieron los indicadores de desempeño del proyecto y el programa que los reproduce. Los registros originales se recuperaron del equipo con el que se presentó el proyecto y se guardaron **sin modificar**; su SHA-256 figura en [`entrega/manifiesto_origen.json`](../entrega/manifiesto_origen.json).

## Reproducir las cifras

```bash
python3 pruebas/recalcular_resultados.py
```

No requiere ROS ni bibliotecas externas: sólo Python 3. La salida compara lo publicado en el documento con lo que se obtiene de los datos:

```text
Indicador                                   Publicado  Recalculado
Desviación angular, promedio (°)                0.492        0.492  coincide
Desviación angular, máximo (°)                  1.494        1.494  coincide
Procesamiento cámara → ROS 2 (ms)              20.940       20.935  coincide
Procesamiento + escritura serial (ms)          21.870       21.865  coincide
Canalización de visión, promedio (FPS)         34.050       34.048  coincide
Canalización de visión, mínimo (FPS)           22.490       22.490  coincide
Canalización de visión, máximo (FPS)           36.630       36.630  coincide
```

El detalle completo, con todas las sesiones y sus percentiles, queda en [`resultados_recalculados.json`](resultados_recalculados.json).

## Los registros

| Archivo | Contenido | Instrumento |
|---|---|---|
| `datos_originales/angular_error_log_s1.csv` … `s5.csv` | Seis pares *consigna, lectura* en pasos del codificador, uno por articulación del brazo | [`angular_error_test`](../brazo-fisico/utilidades/originales/angular_error_test.cpp) |
| `datos_originales/latency_log.csv` | Marca de tiempo y latencia de procesamiento, en ms, por fotograma | Nodo de teleoperación, versión 13 |
| `datos_originales/fps_log.csv` | Marca de tiempo y tasa de la canalización de visión, cada diez iteraciones | Nodo de teleoperación, versión 13 |
| `evidencia_ros_extracto.txt` | Líneas de inicialización del hardware en las 23 sesiones activadas | Registros de `ros2_control_node` |

## Cómo se obtuvo cada cifra

### Desviación angular — 0,492° de promedio, 1,494° de máximo

Se usaron las 30 mediciones completas: seis consignas por cada una de las cinco articulaciones del brazo, con un asentamiento de 800 ms antes de leer. El error de cada una es la diferencia entre consigna y lectura, convertida a grados con 360/4096. No se descartó ninguna.

La resolución del codificador es de **0,0879° por paso**, y conviene tenerla presente al leer el reparto por articulación: el 0,088° del giro de muñeca equivale a un solo paso, en el límite de lo que el instrumento distingue.

| Articulación | Promedio (°) | Máximo (°) |
|---|---:|---:|
| Giro de hombro | 0,103 | 0,264 |
| Cabeceo de hombro | 1,055 | 1,318 |
| Codo | 1,011 | 1,494 |
| Cabeceo de muñeca | 0,205 | 0,352 |
| Giro de muñeca | 0,088 | 0,176 |

### Latencia — 20,94 ms de procesamiento, 21,87 ms con la escritura serial

El registro `latency_log.csv` acumula **59 526 muestras de varias sesiones**, porque el nodo agrega al final del archivo en cada ejecución. Las cifras publicadas proceden del **primer tramo**: 4541 muestras en 155,3 s de teleoperación continua. De ellas se excluyeron dos valores de 3610,66 y 3612,83 ms, que coinciden con una interrupción del sistema anfitrión observada de forma independiente en `/joint_states`. Las 4539 restantes dan 20,94 ms.

A esa cifra se sumaron los **0,93 ms** que midió `bench_serial` sobre 200 escrituras consecutivas, para 21,87 ms en total.

**Qué mide y qué no.** La primera cifra es el tiempo entre la captura del fotograma y la publicación de la consigna en ROS 2. La segunda es el tiempo que el anfitrión tarda en entregar los bytes al puerto USB. Ninguna incluye la interpolación del controlador ni el movimiento mecánico del servo, de modo que **la suma no es la latencia completa desde el gesto hasta el movimiento del brazo**, sino la de la parte de software y comunicación. Esa latencia completa no se midió: exigiría una referencia externa, como una cámara rápida que vea a la vez al operador y al brazo.

### Canalización de visión — 34,05 FPS

`fps_log.csv` acumula 23 322 muestras de varias sesiones, registradas cada diez iteraciones. Las cifras publicadas proceden del **primer tramo**: 447 muestras, de las que se descartó la primera, de 0,56 FPS, porque corresponde a la carga inicial de los modelos de MediaPipe. Las 446 restantes dan 34,05 FPS de promedio, con un mínimo de 22,49 y un máximo de 36,63.

**Una corrección al documento entregado.** El documento dice que esas muestras se tomaron sobre una sesión de 60 segundos. Las marcas de tiempo del registro muestran que el tramo **duró 147,8 s**. Las cifras no cambian; sólo la duración declarada.

Sobre el conjunto de todas las sesiones del registro el promedio es de 32,70 FPS y la mediana de 33,45, ambos por encima del umbral de 25. El mínimo absoluto del registro es bajo porque cada sesión empieza con la carga de los modelos.

## Evidencia de operación del brazo físico

El respaldo del equipo conserva 29 registros de `ros2_control_node`. En **23** la interfaz de hardware inicializó los seis servos, abrió `/dev/ttyACM0` y se activó, entre el 9 y el 19 de septiembre de 2026. `evidencia_ros_extracto.txt` reúne las líneas de inicialización de todas ellas. Su lectura en detalle está en [docs/09](../docs/09-robot-fisico.md).

## Lo que estas pruebas no cubren

- **Exactitud del efector en el espacio**, medida con una referencia externa. La desviación angular compara la consigna con la lectura del propio codificador del servo.
- **Repetibilidad** en el sentido de la norma ISO 9283: volver al mismo punto muchas veces y medir la dispersión.
- **Carga útil sostenida.** Los 80 g a 0,30 m proceden del balance de par del documento, no de un ensayo con masas patrón.
- **Comportamiento térmico** de los servos en sesiones largas.
- **Efecto pedagógico** de la estación sobre el aprendizaje.

Son la continuación natural del trabajo, y se enumeran para que ninguna cifra de esta carpeta se lea como si cubriera más de lo que mide.
