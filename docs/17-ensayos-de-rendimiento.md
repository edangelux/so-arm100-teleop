# 17 — Ensayos de rendimiento del brazo y de la teleoperación

[← Anterior: v15, estimación de ángulos](16-v15-estimacion-de-angulos.md) · [Volver al inicio](../README.md) · [Siguiente: SO-ARM100 Estudio →](18-aplicacion-estudio.md)

---

> **Estado:** herramientas escritas el 21 de septiembre de 2026. **A1, A2, A3, A4 y A5 se ejecutaron sobre el brazo real el 25 de septiembre de 2026**; los resultados están en [Resultados del 25 de septiembre](#resultados-del-25-de-septiembre-de-2026) y los datos completos en [`pruebas/resultados/2026-09-25/`](../pruebas/resultados/2026-09-25/resumen.md). A4 se interrumpió a los 18 min de los 30 previstos. B1 y B2 siguen pendientes.

El proyecto midió dos indicadores del brazo: la desviación angular (0,49° y 1,49°) y el tiempo de software (unos 22 ms). Otras cifras del documento, como la carga útil o el factor de servicio térmico, **salen de cálculos, no de ensayos**. Este capítulo reúne los ensayos que convierten esas cifras en mediciones.

| Ensayo | Qué responde | Herramienta | Necesita |
|---|---|---|---|
| **A1** Precisión estática | Error de cada articulación al sostener una postura y si depende del sentido (gravedad) | `ensayo_precision.py --tipo estatico` | Brazo |
| **A2** Repetibilidad | Dispersión al volver 30 veces a la misma postura | `ensayo_repetibilidad.py` | Brazo; lápiz y hoja para la medida externa |
| **A3** Carga útil | Si sostiene una masa en la pinza, y con qué esfuerzo y error | `ensayo_carga.py` | Brazo y dos masas pesadas (se usaron 50 g y 227 g) |
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
soarm-ensayo a3 227g                 # la etiqueta es libre: se escribe la masa real
soarm-ensayo analizar                # compara las tres corridas
```

La etiqueta de la carga es sólo un nombre: `analizar.py` extrae los gramos del texto (`227g`) y ordena las corridas de menor a mayor. En los ensayos del 25 de septiembre se usó una masa de **227 g** en lugar de los 80 g previstos, porque era la que había disponible.

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

## Resultados del 25 de septiembre de 2026

Todos los ensayos se hicieron el mismo día, seguidos, con el brazo real, la fuente de 7,4 V y la teleoperación cerrada: A1 a las 10:08, A2 a las 10:15, A3 entre las 10:19 y las 10:22, A5 a las 10:23 y A4 a las 10:30. El orden importa para A4: los servos del hombro y del codo llegaron ya calientes. El resumen automático, con todas las tablas, está en [`resumen.md`](../pruebas/resultados/2026-09-25/resumen.md).

### Resumen

| Ensayo | Resultado principal | Lectura |
|---|---|---|
| A1 Precisión estática | Error medio: hombro −1,53°, codo −1,26°; las demás, menos de 0,25° | Hombro y codo se quedan cortos por la gravedad; en `init` el error llega a −2,38° y −1,82° |
| A2 Repetibilidad | **RP = 2,30 mm** (l̄ = 0,54 mm, S = 0,59 mm, 30 llegadas) | Según los codificadores; hombro y codo varían un paso o dos (0,09°) entre llegadas |
| A3 Carga útil | Con **227 g**: esfuerzo máximo del codo **50 %** (extendido), error del codo −5,5° | Sostiene la carga con margen de par, pero el error crece al doble |
| A4 Temperatura | Máxima **54 °C** (hombro, al empezar); bajó a 50 °C en 18 min | Nunca llegó al límite de 55 °C; interrumpido a los 1100 s |
| A5 Escalón | Retardo 139–317 ms, subida 161–192 ms, establecimiento 333–501 ms, sobrepaso ≤ 1,1 % | Respuesta sobreamortiguada, sin oscilación |

### A1 — Precisión estática

| Articulación | Error medio (°) | Desviación (°) | Máximo (°) | Error en +A (°) | Error en −A (°) | Esfuerzo medio (%) |
|---|---|---|---|---|---|---|
| Giro de la base | +0,10 | 0,14 | 0,35 | +0,22 | −0,07 | 1,4 |
| Hombro | **−1,53** | 0,76 | 2,99 | −0,93 | −1,53 | 14,7 |
| Codo | **−1,26** | 0,71 | 2,11 | −0,44 | −1,82 | 12,3 |
| Flexión de muñeca | −0,23 | 0,26 | 0,61 | +0,04 | −0,57 | 2,3 |
| Giro de muñeca | −0,03 | 0,11 | 0,17 | +0,08 | −0,17 | 0,0 |

![A1: error por articulación](../pruebas/resultados/2026-09-25/a1_estatico_real_100819.png)

*Figura 17.1. Error de cada articulación en la serie de posturas del ensayo A1.*

Las tres articulaciones que no cargan peso (base, flexión y giro de muñeca) quedan dentro de ±0,35°, es decir, a unos cuatro pasos del codificador (0,088° por paso). **Hombro y codo se quedan cortos siempre en el mismo sentido**, y más cuando la postura aleja la carga del eje: es la firma de la gravedad. El controlador de posición del STS3215 es proporcional, así que necesita un error para producir par; cuanto más par pide la postura, mayor el error.

Esto responde la pregunta del capítulo 15: los 0,08 rad (4,6°) de la primera prueba física en `init` venían sobre todo del **hombro (−2,38°)** y del **codo (−1,82°)**, que se suman a lo largo del brazo. El modelo dinámico del proyecto da, en `init` y sin carga, pares de gravedad de 0,57 N·m en el hombro y 0,47 N·m en el codo, el 31 % y el 26 % del par de bloqueo (1,86 N·m). Los servos informan menos (en A3, sin carga y en `init`: 7 % el hombro y 19 % el codo), porque su «esfuerzo» es una lectura de carga derivada de la corriente del motor, no un sensor de par, y la fricción de la reductora ayuda a sostener cargas estáticas. La tendencia coincide en el codo; la lección 11 de la aplicación compara las dos cifras postura por postura.

### A2 — Repetibilidad

![A2: nube de llegadas](../pruebas/resultados/2026-09-25/a2_repetibilidad_real_101500.png)

*Figura 17.2. Posición de la punta en las 30 llegadas, calculada con la cinemática directa de las posiciones medidas.*

Base y muñeca llegaron las 30 veces al **mismo paso** del codificador (desviación 0,000°). Hombro y codo variaron como máximo 0,88° de rango (10 pasos) con desviaciones de 0,12° y 0,19°. Llevado a la punta con la cinemática directa: distancia media al centro de la nube **0,543 mm**, desviación **0,587 mm** y

```
   RP = l̄ + 3·S_l = 0,543 + 3 · 0,587 = 2,30 mm
```

Es la repetibilidad que ven los codificadores. La medida con lápiz y papel, si se hace, incluye además las holguras de los engranajes, que el codificador no ve.

### A3 — Carga útil

La masa mayor fue de **227 g**, no de 80 g como preveía el plan.

| Carga | Postura | Error hombro (°) | Error codo (°) | Error muñeca (°) | Esfuerzo hombro (%) | Esfuerzo codo (%) | Esfuerzo muñeca (%) |
|---|---|---|---|---|---|---|---|
| Sin carga | medio | −1,12 | −0,38 | −0,62 | 10,4 | 4,8 | 6,4 |
| Sin carga | init | −0,70 | −2,02 | −0,62 | 7,2 | 19,2 | 6,4 |
| Sin carga | extendido | −0,97 | −2,03 | −0,44 | 10,4 | 18,5 | 4,8 |
| 50 g | medio | −1,38 | −0,64 | −0,53 | 12,8 | 7,2 | 5,6 |
| 50 g | init | −0,88 | −2,72 | −0,62 | 8,8 | 25,6 | 6,4 |
| 50 g | extendido | −1,15 | −2,90 | −0,79 | 12,0 | 26,4 | 8,0 |
| **227 g** | medio | −2,70 | −1,08 | −1,23 | **24,8** | 11,2 | 12,0 |
| **227 g** | init | −1,49 | −4,22 | −1,76 | 14,4 | **39,2** | 16,8 |
| **227 g** | extendido | −1,94 | **−5,53** | −1,67 | 19,2 | **50,4** | 16,0 |

![A3: esfuerzo por carga y postura](../pruebas/resultados/2026-09-25/a3_carga.png)

*Figura 17.3. Esfuerzo de hombro, codo y muñeca con cada carga en las tres posturas.*

Tres observaciones:

1. **El brazo sostuvo 227 g en las tres posturas**, sin ceder ni vibrar. El esfuerzo más alto fue el del codo en `extendido`, **50 %** del par máximo. Queda la mitad de margen, pero es un margen para sostener, no para acelerar: en movimiento el par necesario sube.
2. **El error crece con la carga casi en proporción al esfuerzo.** El codo pasa de −2,0° sin carga a −5,5° con 227 g. Con una carga así conviene compensar la gravedad en la orden (lección 11 de la aplicación) o aceptar ese error.
3. **En `init` y `extendido` el antebrazo está casi horizontal**, por eso el codo es quien más trabaja. En `medio` el brazo está recogido y el que más trabaja es el hombro (24,8 %).

Con estos datos, 227 g es una carga que el brazo **sostiene**, con un error de posición de hasta 5,5° en el codo. Para trabajar con precisión, la carga útil práctica es del orden de 50 a 100 g, donde el error sigue cerca del de vacío.

### A4 — Temperatura

| Servo | Inicial (°C) | Final (°C) | Máxima (°C) | Carga media (%) |
|---|---|---|---|---|
| 1 Base | 38 | 38 | 38 | 2,3 |
| 2 Hombro | **54** | 50 | 54 | 13,1 |
| 3 Codo | 49 | 49 | 50 | 12,0 |
| 4 Flexión de muñeca | 38 | 38 | 39 | 2,7 |
| 5 Giro de muñeca | 37 | 38 | 38 | 0,8 |
| 6 Pinza | 37 | 38 | 38 | 2,4 |

![A4: temperatura contra tiempo](../pruebas/resultados/2026-09-25/a4_termico_103052.png)

*Figura 17.4. Temperatura de los seis servos durante el vaivén de ±20° alrededor de `init`.*

El ensayo se previó de 30 min y **se interrumpió a los 1100 s (18,3 min)**. La tensión se mantuvo entre 7,0 y 7,4 V.

El dato más importante no es la subida sino el punto de partida: **el hombro empezó a 54 °C**, a un grado del límite del ensayo (55 °C), porque venía de A1, A2, A3 y A5 sin descanso, sosteniendo el brazo en voladizo. Durante el vaivén **se enfrió** hasta 50 °C y el codo se quedó en 49 °C. Eso indica que el calor viene de **sostener par** (A3 con 227 g, posturas extendidas) más que de moverse: el vaivén alrededor de `init` pide menos par medio que los ensayos anteriores.

Consecuencias prácticas:

- En una sesión larga de ensayos o de uso, **hombro y codo son los servos críticos**; los otros cuatro no pasan de 39 °C.
- Conviene **dejar descansar el brazo** en `home` (par de gravedad del hombro 0,03 N·m, casi nulo) entre ensayos con carga.
- Para medir la subida real de temperatura, A4 debe repetirse **empezando en frío** (tras una hora sin par) y completando los 30 min.

### A5 — Respuesta al escalón

| Articulación | Retardo (ms) | Subida 10–90 % (ms) | Establecimiento (ms) | Sobrepaso (%) | Error final (°) |
|---|---|---|---|---|---|
| Giro de la base | 317 | 174 | 501 | 1,1 | +0,09 |
| Hombro | 184 | 162 | 336 | 0,5 | −1,14 |
| Codo | 162 | 161 | 340 | 0,0 | −1,10 |
| Flexión de muñeca | 148 | 192 | 342 | 0,0 | −0,24 |
| Giro de muñeca | 139 | 180 | 333 | 0,1 | −0,02 |

![A5: respuesta al escalón](../pruebas/resultados/2026-09-25/a5_escalon_real_102350.png)

*Figura 17.5. Respuesta de cada articulación a escalones de ±0,3 rad.*

La respuesta es **sobreamortiguada**: el sobrepaso no pasa de 1,1 % y no hay oscilación. La subida del 10 al 90 % (0,24 rad) en 160–190 ms equivale a 1,3–1,5 rad/s de velocidad media en ese tramo, por debajo de la velocidad sin carga del servo: la rampa de aceleración del propio STS3215 y el controlador de trayectorias suavizan el salto. El **retardo** de 140–320 ms mide todo el camino de la orden (ROS 2, controlador, bus serie y arranque del motor); el de la base está inflado por un escalón de unos 700 ms, así que su valor típico es cercano al de las demás. Los errores finales repiten los de A1: hombro y codo se quedan cortos alrededor de 1,1°.

Para la teleoperación, esto significa que el brazo sigue a la persona con unos 0,15–0,3 s de atraso mecánico, que se suman a los 22 ms de software medidos en el proyecto.

### Qué queda pendiente

| Ensayo | Qué falta |
|---|---|
| A2 | La medida externa con lápiz y papel, para compararla con los 2,30 mm de los codificadores |
| A4 | Repetirlo en frío y completo (30 min) |
| B1, B2 | Ejecutarlos con transportador y dos personas |

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
| 1 | A3 sin carga, 50 g y una masa mayor (se usaron 227 g) | 30 min |
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

---

Las pruebas C a H, que completan estas, están en [el capítulo 18](18-aplicacion-estudio.md#pruebas-que-debe-superar-el-robot).
