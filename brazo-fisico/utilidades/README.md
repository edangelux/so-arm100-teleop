# Utilidades de puesta en marcha y medición

Programas de línea de comandos que operan directamente sobre el bus serie de
los servomotores STS3215, sin pasar por ROS 2. Unos sirvieron para la puesta
en marcha del brazo físico y otros para medir los indicadores de desempeño
del proyecto. Se publican porque el documento los cita como instrumento de
medición, y un resultado cuyo instrumento no está publicado no puede ser
auditado por un tercero.

La carpeta contiene **dos juegos**, y conviene distinguirlos antes de citar
cualquiera de ellos.

| Carpeta | Qué contiene | Se usó en el brazo presentado |
|---|---|:---:|
| [`originales/`](originales/) | Los programas que el equipo ejecutó sobre el manipulador para ponerlo en marcha y para medir los indicadores | **Sí** |
| [`metodologicas/`](metodologicas/) | Reimplementaciones redactadas a partir del procedimiento documentado, antes de disponer del respaldo del equipo | No |

## `originales/` — los instrumentos que se usaron

Se recuperaron del respaldo del equipo con el que se presentó el proyecto,
el mismo que ejecutó la versión 13 de la teleoperación. Son **copias byte a
byte**; su SHA-256 figura en [`entrega/manifiesto_origen.json`](../../entrega/manifiesto_origen.json).

| Programa | Función | Dónde lo cita el documento |
|---|---|---|
| `change_id` | Asignó el identificador definitivo de cada actuador en la EEPROM | Objetivo 3, direccionamiento en el bus |
| `list_servos` | Recorrió los identificadores 1 a 10 y reportó los que respondían | Objetivo 3, verificación del direccionamiento |
| `center_one` | Llevó un actuador a su centro eléctrico, 2048 pasos | Objetivo 3, calibración de posiciones centrales |
| `center_servos` | Centró los seis actuadores en una sola orden | Objetivo 3, puesta a punto de la cadena montada |
| `angular_error_test` | Prueba de seguimiento de consigna con la que se midió la desviación angular | Objetivo 4, Indicador 2 |
| `bench_serial` | Midió el tiempo de escritura del anfitrión sobre el bus | Objetivo 4, Indicador 1 |

El historial de órdenes del equipo registra su uso: `center_one` se ejecutó
actuador por actuador, del 1 al 6, y `list_servos` se repitió entre cada
centrado para comprobar el bus. Los datos de las seis consignas de
`angular_error_test` están en [`pruebas/datos_originales/`](../../pruebas/datos_originales/).

### Compilación

`angular_error_test` y `bench_serial` se compilaron dentro del paquete
`so_arm_100_hardware`, cuyo `CMakeLists.txt` recuperado ya los declara
(véase [`entrega/src/so_arm_100_hardware/`](../../entrega/src/so_arm_100_hardware/)).
Los otros cuatro se compilaron de forma directa contra la biblioteca
`SCServo_Linux`, con la misma orden que registró el historial:

```bash
SCS=~/ros2_ws/src/so_arm_100_hardware/include/SCServo_Linux
g++ -std=c++14 -I $SCS change_id.cpp $SCS/*.cpp -o change_id
```

### Uso

El puerto `/dev/ttyACM0` está fijo en el código de todos, salvo en
`change_id`, que lo recibe como primer argumento.

```bash
./change_id /dev/ttyACM0 1 2      # un solo actuador conectado al bus
./list_servos
./center_one 3
./center_servos
ros2 run so_arm_100_hardware angular_error_test 2
ros2 run so_arm_100_hardware bench_serial
```

## `metodologicas/` — la versión escrita sin el robot

Se redactaron cuando el brazo todavía no estaba disponible para quien
documentaba el repositorio, a partir del procedimiento descrito en el
documento y del código de los anexos. Cumplen la misma función que los
originales y conservan la secuencia de consignas, el intervalo de
asentamiento de 800 ms y el método de lectura de `angular_error_test`, pero
**no son las que se ejecutaron sobre el manipulador presentado**, y ninguna
cifra del documento procede de ellas.

Se conservan porque añaden tres protecciones que los originales no tienen,
útiles para quien reproduzca el sistema desde cero:

- `change_id` se niega a escribir si el identificador de destino ya responde
  en el bus.
- Todos reciben el puerto serie como argumento, con `/dev/ttyACM0` por defecto.
- `angular_error_test` convierte los pasos del codificador a grados dentro
  del propio programa y escribe ambas columnas.

Se instalan copiando los archivos sobre la carpeta `test/` del paquete y
reemplazando su `CMakeLists.txt` por
[`metodologicas/CMakeLists.completo.txt`](metodologicas/CMakeLists.completo.txt),
que ya declara los cinco. Después se ejecutan con `ros2 run so_arm_100_hardware <programa>`.

## Advertencia sobre `change_id`

Los actuadores salen de fábrica compartiendo el identificador 1. Si se
conectan varios sin reasignarlos, todos responden a la vez, las respuestas
colisionan sobre la línea compartida y **el bus deja de responder por
completo sin que ningún mensaje señale la causa**. Por eso `change_id` se
ejecuta con un solo actuador conectado. El original no comprueba si el
identificador de destino está libre; la versión metodológica sí.

## Advertencia sobre `bench_serial`

`WritePosEx` es una escritura sin espera de respuesta. Lo que este programa
cronometra es el tiempo que tarda el sistema operativo en entregar los bytes
al puerto USB, **no** el tiempo que tarda el actuador en recibirlos ni en
ejecutarlos. A 1 Mbaud una trama de una decena de bytes ocupa del orden de
0,1 ms en el cable; el resto es sobrecarga del anfitrión y del adaptador
USB-serie. Los 0,93 ms medidos son correctos para lo que miden, pero no
representan el recorrido completo hasta el movimiento del actuador.

## Advertencia sobre la resolución del instrumento

El codificador magnético tiene 12 bits: 4096 pasos por revolución, es decir
**0,0879° por paso**. Ninguna medición angular obtenida con estos programas
puede distinguir diferencias menores que ese valor. Los 0,088° medidos en el
giro de muñeca corresponden a un solo paso del codificador y deben leerse
como situados en el límite de resolución del instrumento.
