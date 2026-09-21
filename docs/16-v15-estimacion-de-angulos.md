# 16 — Versión 15: mejor estimación de los ángulos del operador

[← Anterior: v14, MoveIt y posturas seguras](15-v14-moveit-y-posturas-seguras.md) · [Volver al inicio](../README.md)

---

> **Estado:** implementado el 21 de septiembre de 2026. La geometría nueva se comprobó sin cámara con posturas sintéticas (`teleop_vision/prueba_geometria_v15.py`; resultados en [Comprobación sin cámara](#comprobación-sin-cámara)). **Todavía no se ha probado con una persona frente a la cámara ni con el brazo.** La versión 13 sigue intacta y la v14 también; la v15 se elige con `--v15`.

---

## Dónde se pierde la fidelidad del espejo

La cadena de la teleoperación tiene dos mitades:

```
 persona ──► cámara + MediaPipe ──► ángulos estimados ──► filtros ──► orden ──► servo ──► brazo
            └────────── percepción ──────────┘                        └──── actuación ────┘
```

El proyecto midió bien la **actuación**: el brazo alcanza la orden con un error de 0,49 a 1,49 grados y el software tarda unos 22 ms ([docs/12](12-cierre-del-proyecto.md)). La **percepción** no se midió, y ahí está casi toda la diferencia entre el gesto humano y el movimiento del robot. La v15 trabaja sobre esa mitad.

Hay dos límites que ningún programa elimina:

1. **Un espejo idéntico es geométricamente imposible.** El brazo humano tiene siete grados de libertad (tres en el hombro, uno en el codo, uno de giro del antebrazo y dos en la muñeca) y el robot cinco, con otras proporciones. Lo alcanzable es que cada una de las cinco articulaciones del robot copie su equivalente humana con un error conocido.
2. **Una sola cámara no mide profundidad: la estima.** MediaPipe entrega coordenadas 3D (`pose_world_landmarks`), pero la tercera coordenada la deduce su red neuronal a partir de la forma del cuerpo en la imagen. Cuando un segmento del brazo apunta hacia la cámara, su imagen se acorta (escorzo) y esa deducción se vuelve ruidosa.

## Las seis mejoras evaluadas

| # | Limitación | Decisión | Dónde |
|---|---|---|---|
| 1 | Profundidad estimada | Se atenúa su efecto con la confianza por articulación y con el [protocolo de cámara](#protocolo-de-cámara). Medirla de verdad exige una segunda cámara (fila 6) | `[V15-1]` |
| 2 | Brazo apuntando a la cámara | Se detecta el escorzo en hombro y codo, como v13 ya hacía en la muñeca, y la articulación avanza despacio en vez de temblar | `[V15-1]` |
| 3 | Ganancia fija por articulación | Calibración con una segunda postura de ángulo conocido | `[V15-2]` |
| 4 | Giro de muñeca | Se mide en 3D, alrededor del eje del antebrazo | `[V15-3]` |
| 5 | Latencia por Wi-Fi | No se aborda. DroidCam es una solución temporal; el sistema se validó con la cámara integrada de una laptop y así se usará | — |
| 6 | Profundidad real con dos cámaras | Queda planteada como trabajo futuro: [Dos cámaras](#trabajo-futuro-dos-cámaras) | — |

---

## [V15-1] Confianza por articulación

### Qué mide

Para el brazo (hombro a codo) y el antebrazo (codo a muñeca) se calcula una confianza `c` entre 0 y 1 como producto de dos factores.

**Escorzo.** Se compara la longitud del segmento en la imagen, en píxeles, con la que tendría si estuviera paralelo a la imagen:

```
            longitud en la imagen (px)
   f = ──────────────────────────────────────────
        longitud 3D (m) × escala (px por metro)
```

`f = 1` significa que el segmento está de perfil a la cámara; `f = 0`, que apunta directo a ella. La escala se obtiene de dos referencias del tronco: el ancho de hombros y la altura del tronco (hombros a caderas). Se toma **la mayor** de las dos, porque un segmento girado sólo puede verse más corto que su longitud real, nunca más largo. Así la referencia menos girada es la más fiable. Si ninguna de las dos es visible, no se penaliza nada, igual que en v13.

**Visibilidad.** MediaPipe informa, para cada punto, qué tan visible lo considera (`visibility`, de 0 a 1). Se usa el menor de los dos extremos del segmento.

Cada factor se convierte a una rampa entre dos umbrales:

| Factor | Confianza 0 por debajo de | Confianza 1 por encima de |
|---|---|---|
| Escorzo `f` | 0,25 (unos 75 grados fuera del plano) | 0,60 (unos 53 grados) |
| Visibilidad | 0,40 | 0,70 |

El hombro (rotación y cabeceo) usa la confianza del brazo, y el codo la menor entre brazo y antebrazo. La muñeca conserva su propio criterio de v13 (`[E6]`).

### Cómo se usa

En cada cuadro, el ángulo nuevo no reemplaza al anterior: avanza sólo una fracción hacia él.

```
   k = 0,15 + 0,85 · c
   ángulo ← ángulo_anterior + k · (ángulo_medido − ángulo_anterior)
```

Con confianza plena (`k = 1`) el comportamiento es exactamente el de v13. Con confianza nula (`k = 0,15`) la articulación sigue moviéndose, pero despacio, y el ruido de la profundidad estimada se promedia en lugar de llegar al brazo. No se congela del todo a propósito: alcanzar hacia adelante es un gesto normal, y congelarlo dejaría al operador sin control.

En la pantalla, cada articulación muestra su confianza (`c=`) y se pinta en naranja cuando baja de 0,5.

## [V15-2] Ganancia por calibración de dos posturas

La v13 calibra con una sola postura: al pulsar `C`, la postura del operador pasa a ser el cero. La escala se deja fija (`GAIN = 1`) o se ajusta a ojo con `+` y `-`. Si la cámara estima 70 grados cuando el codo está doblado 90, el robot dobla 70.

La v15 agrega una segunda postura de ángulo conocido:

```
   GAIN = ángulo de referencia / ángulo medido desde la calibración
```

| Articulación | Referencia | Postura sugerida desde la calibración |
|---|---|---|
| Shoulder_Rotation | 90° | Girar el brazo en horizontal de adelante hacia el costado |
| Shoulder_Pitch | 90° | Levantar el brazo de colgado a horizontal |
| Elbow | 90° | Doblar el codo en ángulo recto |
| Wrist_Pitch | 45° | Flexionar la muñeca a medio camino |
| Wrist_Roll | 90° | Girar la palma de abajo a de lado |

### Procedimiento

1. Postura de calibración y `C`.
2. `TAB` hasta seleccionar la articulación (el `>` a su izquierda en la pantalla).
3. Llevar **sólo esa articulación** a su ángulo de referencia. Un transportador o una escuadra ayudan a que sean 90 grados de verdad.
4. `G`. La terminal imprime el ángulo medido y la ganancia calculada, que queda entre 0,3 y 3,0. Si el ángulo medido es menor que unos 11 grados (0,2 rad), no calcula nada y pide repetir.
5. Repetir con las demás articulaciones; `S` guarda signos y ganancias.

Con `--v15`, la configuración se guarda en `~/teleop_config_v15.json`, separada de la de v13, para no alterar la versión presentada.

## [V15-3] Giro de muñeca en 3D

### El problema de v13

La v13 mide el giro de la muñeca en la imagen: el ángulo entre el antebrazo y la línea de nudillos (índice a meñique), ambos proyectados en 2D. Cuando el brazo sale del plano de la imagen, esa proyección deforma los ángulos, y el giro medido cambia aunque la muñeca no gire.

### Qué hace v15

MediaPipe Hands también entrega la mano en 3D (`multi_hand_world_landmarks`). El giro se mide así:

1. **Eje:** el antebrazo en 3D, del codo a la muñeca.
2. **Referencia:** la normal del plano vertical que contiene al brazo, `arriba × (muñeca − hombro)`. Es la dirección de los ejes de cabeceo del robot (Shoulder_Pitch, Elbow y Wrist_Pitch son paralelos), de modo que el giro medido corresponde al Wrist_Roll del robot. Cuando el brazo está a menos de unos 22 grados de la vertical, ese producto tiende a cero, así que se le suma gradualmente el eje lateral del tronco para que la referencia no desaparezca.
3. **Medida:** la línea de nudillos en 3D, proyectada en el plano perpendicular al antebrazo.
4. **Ángulo:** el que forma esa proyección con la referencia, con signo según el sentido de giro alrededor del antebrazo.

Las dos nubes 3D de MediaPipe (cuerpo y mano) tienen los ejes de la cámara, aunque orígenes distintos. Como el cálculo sólo usa direcciones, se pueden combinar. Para el brazo izquierdo se invierte el signo, de modo que los dos brazos tengan el mismo sentido. Si no hay mano en 3D o la geometría es degenerada, se usa el cálculo 2D de v13. La pantalla indica cuál se está usando (`giro 3D` o `giro 2D`).

**Sentido del giro.** El sentido del nuevo cálculo puede no coincidir con el que se ajustó para v13. Si el robot gira la muñeca al revés, se corrige con la tecla `5` y se guarda con `S`.

---

## Comprobación sin cámara

`teleop_vision/prueba_geometria_v15.py` construye posturas sintéticas con puntos exactos y ejecuta las funciones nuevas. No necesita ROS, MediaPipe ni cámara:

```bash
python3 teleop_vision/prueba_geometria_v15.py
```

**Confianza del brazo y del antebrazo:**

| Postura | c brazo | c antebrazo |
|---|---:|---:|
| Paralelo a la imagen | 1,00 | 1,00 |
| 45° fuera del plano | 1,00 | 1,00 |
| Apuntando a la cámara | 0,00 | 0,00 |
| Paralelo, visibilidad 0,5 | 0,33 | 0,33 |

**Giro 3D:**

| Prueba | Resultado |
|---|---|
| Mano girada 0°, 30°, 60°, 90° y −45° con el brazo al frente | Mide exactamente 0°, 30°, 60°, 90° y −45° |
| Palma quieta mientras el brazo baja de horizontal a colgado | 0° en toda la trayectoria |
| Palma abajo mientras el brazo barre de adelante al costado | 0° en toda la trayectoria |

**Giro 2D (v13) contra 3D (v15)**, con la palma quieta hacia abajo y el brazo a 45° de azimut, levantándose hacia la cámara. El giro real es 0° en todos los casos:

| Elevación del brazo | Giro 2D de v13 | Giro 3D de v15 |
|---:|---:|---:|
| 0° | 0,0° | 0,0° |
| 20° | 34,5° | 0,0° |
| 40° | 57,7° | 0,0° |
| 60° | 73,0° | 0,0° |

Es decir: con el brazo levantado 60° hacia la cámara, la v13 le haría girar al robot la muñeca 73° sin que el operador la girara.

**Qué no demuestra esta prueba.** Los puntos sintéticos son exactos; los de MediaPipe tienen ruido, sobre todo en profundidad y en la mano. La prueba demuestra que la geometría es correcta, no cuánto mejora el seguimiento real. Eso se mide en la [secuencia de prueba](#secuencia-de-prueba).

---

## Protocolo de cámara

Es la mejora más barata para la profundidad (fila 1 de la tabla) y vale para todas las versiones:

| Aspecto | Recomendación | Por qué |
|---|---|---|
| Ángulo | Cámara a unos 30–45° hacia el lado del brazo que teleopera, no de frente | Los gestos hacia adelante dejan de apuntar a la cámara y el escorzo baja |
| Distancia | De 1,5 a 2 m, con el tronco y la cadera en cuadro | La escala del tronco y la confianza de `[V15-1]` necesitan hombros y caderas visibles |
| Altura | A la altura de los hombros | Reduce la deformación del ángulo de cabeceo |
| Luz | De frente o lateral, sin contraluz | Aumenta la visibilidad de MediaPipe |
| Fondo | Liso y de color distinto de la ropa | Menos falsos puntos |
| Ropa | Mangas cortas o ajustadas | El codo y la muñeca se localizan mejor |

La cámara no debe moverse entre la calibración (`C`) y el uso.

---

## Secuencia de prueba

```bash
cd ~/so-arm100-teleop && git pull
python3 teleop_vision/prueba_geometria_v15.py        # debe reproducir las tablas de arriba
source ~/.soarm_env
```

| # | Orden | Qué comprobar |
|---|---|---|
| 1 | `bash scripts/soarm.sh sim --v15 --camara "$CAM" --software-gl` | La pantalla dice `giro 3D`. Al acercar el brazo hacia la cámara, la `c` del hombro y del codo baja y se pintan en naranja |
| 2 | En la misma sesión, girar la palma con el brazo quieto y luego levantar el brazo sin girar la palma | El Wrist_Roll de Gazebo sigue al giro y **no** cambia al levantar el brazo. Si gira al revés, `5` y `S` |
| 3 | Calibración de ganancias con `TAB` y `G` en las cinco articulaciones | La terminal imprime cada ganancia; anotar los valores |
| 4 | Comparar con v13: `bash scripts/soarm.sh sim --camara "$CAM" --software-gl` con los mismos gestos | Diferencia visible en el giro de muñeca al levantar el brazo |
| 5 | `~/center_servos` y `bash scripts/soarm.sh real --v15 --camara "$CAM" --velocidad 0.5` | Lo mismo con el brazo físico, despacio |

Para dejar evidencia, conviene grabar en video el paso 2 con v13 y con v15, con el mismo gesto, y guardar las ganancias del paso 3.

---

## Trabajo futuro: dos cámaras

La única forma de **medir** la profundidad, en vez de estimarla, es verla desde dos puntos:

1. Dos cámaras separadas unos 60–90 cm, las dos apuntando al operador.
2. Calibración estéreo con un tablero de ajedrez impreso (`cv2.stereoCalibrate`) para conocer la posición relativa de las cámaras.
3. MediaPipe en cada imagen y **triangulación** de cada punto del brazo (`cv2.triangulatePoints`): la profundidad sale de la geometría, no de la red neuronal.
4. Los ángulos se calculan igual que ahora, con puntos 3D medidos en lugar de estimados.

Requiere dos cámaras sincronizadas y el doble de procesamiento de MediaPipe, y es un proyecto en sí mismo. Con el protocolo de cámara y la v15 conviene medir primero cuánto error queda, para decidir si hace falta.

---

## Archivos

| Archivo | Qué es |
|---|---|
| `teleop_vision/teleop_v15.py` | La versión 15; cambios marcados `[V15-n]` respecto de v14 |
| `teleop_vision/ejecutar_v15.py` | Envoltorio con las conexiones del modo |
| `teleop_vision/prueba_geometria_v15.py` | Comprobación sin cámara de la geometría nueva |
| `scripts/soarm.sh` | Opción `--v15` y configuración separada `~/teleop_config_v15.json` |
