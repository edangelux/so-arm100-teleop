# 17 — Ensayos de rendimiento del brazo y de la teleoperación

[← Anterior: v15, estimación de ángulos](16-v15-estimacion-de-angulos.md) · [Volver al inicio](../README.md)

---

> **Estado:** herramientas escritas el 21 de septiembre de 2026. El análisis (`analizar.py`) se comprobó con datos sintéticos de los seis tipos de ensayo, y el ensayo térmico compila. **Ningún ensayo se ha ejecutado todavía sobre el brazo.** Los resultados se guardan en `pruebas/resultados/AAAA-MM-DD/` y se agregan a este capítulo cuando existan.

El proyecto midió dos indicadores del brazo: la desviación angular (0,49° y 1,49°) y el tiempo de software (unos 22 ms). Otras cifras del documento, como la carga útil o el factor de servicio térmico, **salen de cálculos, no de ensayos**. Este capítulo reúne los ensayos que convierten esas cifras en mediciones.

| Ensayo | Qué responde | Herramienta | Necesita |
|---|---|---|---|
| **A1** Precisión estática | Error de cada articulación al sostener una postura y si depende del sentido (gravedad) | `ensayo_precision.py --tipo estatico` | Brazo |
| **A2** Repetibilidad | Dispersión al volver 30 veces a la misma postura | `ensayo_repetibilidad.py` | Brazo; lápiz y hoja para la medida externa |
| **A3** Carga útil | Si sostiene 50 y 80 g, y con qué esfuerzo y error | `ensayo_carga.py` | Brazo y dos masas pesadas |
| **A4** Temperatura | Calentamiento de los servos en uso continuo | `ensayo_termico` (C++, sin ROS) | Brazo, de 30 a 90 min |
| **A5** Respuesta al escalón | Retardo, subida, establecimiento y sobrepaso de cada servo | `ensayo_precision.py --tipo escalon` | Brazo |
| **B1** Fidelidad del espejo | Error entre el gesto humano, la orden y el brazo | `registrador.py` | Brazo, cámara y transportador |
| **B2** v13 contra v15 | Cuánto mejora la v15 con personas reales | `registrador.py` con cada versión | Igual que B1 |

Todos los ensayos que mueven el brazo por ROS se ejecutan **con el lanzador abierto y la teleoperación cerrada**: se pulsa `Q` en la ventana de la cámara, el brazo queda en `init` y la terminal del lanzador espera en su menú. Así el controlador sigue activo y nadie más le manda órdenes. Los ensayos se abren en **otra terminal**. El térmico es la excepción: habla directo con los servos y exige el lanzador cerrado.

Cada ensayo muestra lo que va a hacer y pide escribir `SI` antes de mover nada. `Ctrl+C` lo detiene: el brazo se queda donde está y se guardan los datos registrados hasta ese momento.

## Qué se registra

En cada mensaje de estados articulares, a unos 100–200 por segundo, se guarda: tiempo, etiqueta de la fase, orden, posición, velocidad y **esfuerzo** de las cinco articulaciones. El esfuerzo es la carga que informa el servo STS3215 dividida entre 10, es decir, el **porcentaje de su par máximo**, con signo. Un esfuerzo sostenido cercano a 100 % significa que el servo está en su límite.

## A1 — Precisión estática

```bash
soarm-ensayo a1                      # o: python3 pruebas/ensayos/ensayo_precision.py --tipo estatico --modo real
```

Cada articulación, sola y con las demás en `init`, visita la serie 0, +A, 0, −A, 0, +A/2, 0, −A/2, 0 (A = 0,5 rad por omisión) a 0,5 rad/s y se sostiene 2 s en cada punto. Se hacen dos repeticiones.

**Qué calcula `analizar.py`:**

- Error medio, desviación y error máximo por articulación.
- **Error en +A contra error en −A.** Si difieren, la gravedad empuja en un sentido.
- **Error de cada articulación cuando el brazo está en `init`.** Responde qué articulación causó los 0,08 rad de la primera prueba física ([docs/15](15-v14-moveit-y-posturas-seguras.md#resultados)).

En `init` el brazo no está relajado: el brazo superior queda casi vertical, pero el antebrazo y la pinza quedan **horizontales**, a unos 389 mm del eje de la base (cinemática del proyecto). Hombro y codo sostienen ese voladizo.

## A5 — Respuesta al escalón

```bash
soarm-ensayo a5                      # amplitud 0,3 rad, trayectoria de 0,10 s
```

Cada articulación recibe escalones de ±0,3 rad con una trayectoria de 0,10 s, casi un salto, y se registran 2,5 s de respuesta. Entre escalones vuelve despacio a 0.

**Qué calcula:** el **retardo** (tiempo hasta moverse 0,02 rad), la **subida** del 10 % al 90 % del escalón, el **establecimiento** (último instante fuera de una banda del 5 %, o 0,02 rad si es mayor) y el **sobrepaso** en porcentaje. Complementa los 22 ms medidos en el proyecto, que cubrían el software y la escritura serial pero no el movimiento mecánico.

## A2 — Repetibilidad

```bash
soarm-ensayo a2 --pose actual        # la postura en que está el brazo al empezar
```

1. Con el lanzador en `real --moveit` y la teleoperación en pausa (`P`), llevar el brazo con MoveIt a una postura donde un lápiz sujeto en la pinza apenas toque una hoja fija.
2. Ejecutar el ensayo. El brazo se retira (hombro 0,2 rad hacia atrás y arriba) y vuelve 30 veces, siempre por el mismo camino, y se sostiene 2 s en cada llegada. Cada llegada deja un punto en el papel.

**Qué calcula:** la desviación de cada articulación y, con la cinemática directa del proyecto, dónde quedó la punta en cada llegada. Con eso obtiene la repetibilidad al estilo de ISO 9283:

```
   RP = l̄ + 3·S_l
```

donde `l` es la distancia de cada llegada al centro de la nube, `l̄` su media y `S_l` su desviación. Es la repetibilidad **según los encoders del servo**. La nube de puntos del papel, medida con regla o escaneada, es la medida **externa**, y suele ser mayor porque incluye holguras de engranajes y piezas que el encoder no ve. La diferencia entre las dos es en sí un dato.

## A3 — Carga útil

```bash
soarm-ensayo a3 sin_carga
soarm-ensayo a3 50g                  # con 50 g colgados de la pinza
soarm-ensayo a3 80g
soarm-ensayo analizar                # compara las tres corridas
```

Las masas se pesan en una balanza de cocina (tornillos o monedas en una bolsa) y se anota el peso real. El brazo visita tres posturas y sostiene cada una 5 s:

| Postura | Articulaciones (rad) | Alcance desde el eje de la base |
|---|---|---|
| `medio` | 0, −0,9, 0,9, 0, 0 | ~290 mm |
| `init` | 0, 0, 0, 0, 0 | ~389 mm |
| `extendido` | 0, 0,5, −0,5, 0, 0 | ~439 mm |

**Qué calcula:** el error y el esfuerzo de hombro, codo y muñeca en cada postura con cada masa, más una gráfica de barras del esfuerzo. Si el brazo sostiene la masa con un esfuerzo claramente por debajo del 100 % y un error acotado, la cifra calculada queda confirmada. Si el brazo cede o vibra, `Ctrl+C` y se apaga la fuente.

## A4 — Temperatura

```bash
soarm-ensayo a4 30                   # 30 minutos; también: a4 60 20 55 = minutos, amplitud, límite
```

**Con el lanzador cerrado** (`x` en su menú). El programa lleva los seis servos a 2048 pasos (`init`) y mueve en vaivén hombro, codo y muñeca ±20° alrededor de esa postura, cambiando de sentido cada 3 s. Cada 10 s registra posición, temperatura, carga, tensión y corriente de los seis servos. Se detiene al cumplir el tiempo, con `Ctrl+C` o si algún servo llega a 55 °C; en los tres casos vuelve a 2048 despacio y deja el par activado.

**Qué calcula:** temperatura inicial, final y máxima de cada servo, cuánto subió y su carga media, más la gráfica temperatura contra tiempo. Convierte en dato el factor de servicio de 0,6 que se estimó en el balance de par.

## B1 y B2 — Fidelidad del espejo

En una terminal, la teleoperación normal (por ejemplo `teleop real --v15`). En otra:

```bash
soarm-ensayo b1 real
```

El registrador graba la orden de la teleoperación y la posición del brazo. Mientras graba, se escriben **marcas** en su terminal:

1. Calibrar con `C` en una postura de referencia (brazo colgando, codo recto, palma hacia el cuerpo).
2. Llevar una articulación a un ángulo medido con **transportador**, por ejemplo el codo a 90°, y quedarse quieto.
3. Escribir `Elbow 90` y Enter. El registrador promedia el segundo siguiente.
4. Repetir con 0°, 45° y 90° en cada articulación. Una segunda persona con el transportador lo hace mucho más fácil.
5. `fin` para guardar.

**Qué calcula**, para cada marca:

- **Error de percepción** = |orden| − |referencia|: lo que se equivocó la cámara, ya con signo y ganancia aplicados.
- **Error total** = |brazo| − |referencia|: lo que se equivocó el sistema completo.

La diferencia entre los dos es el error del brazo, que A1 mide por separado.

**B2** es el mismo procedimiento con `--v13` y con `--v15` (`teleop real --v13` y `teleop real --v15`), con las mismas posturas y la misma persona. Compara las dos versiones con datos, no a ojo.

## Analizar

```bash
soarm-ensayo analizar                            # los resultados de hoy
soarm-ensayo analizar pruebas/resultados/2026-09-22
```

Escribe `resumen.md` con todas las tablas y una gráfica PNG por ensayo, en la misma carpeta. Esa carpeta completa es la evidencia que se sube al repositorio.

## Orden recomendado

| Día | Ensayos | Tiempo |
|---|---|---|
| 1 | A1, A5 y analizar | 45 min |
| 1 | A3 sin carga, 50 g y 80 g | 30 min |
| 2 | A2 con lápiz | 40 min |
| 2 | A4, 30 a 60 min, mientras se prepara lo demás | 1 h |
| 3 | B1 con v15; B2 con v13 | 1 h |

## Archivos

| Archivo | Qué es |
|---|---|
| `pruebas/ensayos/comun.py` | Envío de trayectorias, registro y guardado comunes |
| `pruebas/ensayos/ensayo_precision.py` | A1 y A5 |
| `pruebas/ensayos/ensayo_repetibilidad.py` | A2 |
| `pruebas/ensayos/ensayo_carga.py` | A3 |
| `brazo-fisico/utilidades/ensayos/ensayo_termico.cpp` | A4, directo sobre el bus |
| `pruebas/ensayos/registrador.py` | B1 y B2 |
| `pruebas/ensayos/analizar.py` | Tablas y gráficas de todos |
