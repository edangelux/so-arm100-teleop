# Utilidades de puesta en marcha y medición

Cinco programas de línea de comandos que operan directamente sobre el bus
serie de los servomotores STS3215, sin pasar por ROS 2. Tres sirven para la
puesta en marcha del brazo físico y dos para la medición de los indicadores
de desempeño del proyecto.

Se publican aquí porque el documento del proyecto los cita como instrumento
de medición, y un resultado cuyo instrumento no está publicado no es
auditable por un tercero.

## Los cinco programas

| Programa | Para qué sirve | Dónde lo cita el documento |
|---|---|---|
| `change_id` | Asigna el identificador definitivo de un actuador en la EEPROM | Objetivo 3, direccionamiento en el bus |
| `list_servos` | Recorre el bus y reporta estado, tensión y temperatura de cada actuador | Objetivo 3, verificación del direccionamiento |
| `center_one` | Lleva un actuador a su centro eléctrico (2048 ticks) | Objetivo 3, calibración de posiciones centrales |
| `angular_error_test` | Prueba de seguimiento de consigna; mide desviación angular | Objetivo 4, Indicador 2 |
| `bench_serial` | Mide el tiempo de escritura del anfitrión sobre el bus serie | Objetivo 4, Indicador 1 |

## Procedencia — léase antes de citarlos

**`angular_error_test` y `bench_serial`** se corresponden con el código
publicado en los anexos del documento del proyecto. Respecto de aquella
versión, aquí se parametrizaron el puerto serie y la ruta de salida (que
estaban fijos en el código original) y se agregó la conversión de ticks a
grados dentro del propio programa, en lugar de hacerla aparte. **La secuencia
de consignas, el intervalo de asentamiento y el método de lectura son los
mismos**, de modo que los valores publicados en el documento son reproducibles
con esta versión.

**`change_id`, `list_servos` y `center_one`** son implementaciones escritas
para este repositorio a partir del procedimiento descrito en el documento y
de la misma biblioteca `SCServo_Linux`. Producen el mismo efecto y el mismo
tipo de salida que los utilitarios empleados durante la puesta en marcha,
pero **no son una transcripción literal de aquellos**. Conviene ejecutarlos
una vez sobre el brazo antes de darlos por equivalentes.

## Instalación

Estos archivos pertenecen al paquete `so_arm_100_hardware`, que se clona
desde su repositorio de origen durante la instalación. No se distribuyen
dentro de él, sino que se copian sobre él:

```bash
cp brazo-fisico/utilidades/*.cpp  ~/ros2_ws/src/so_arm_100_hardware/test/
```

Después hay que declararlos en el `CMakeLists.txt` de ese paquete. El bloque
exacto, con las instrucciones de dónde pegarlo, está en
`CMakeLists.fragmento.txt`.

Y por último compilar:

```bash
cd ~/ros2_ws
colcon build --packages-select so_arm_100_hardware
source install/setup.bash
```

## Uso

Todos aceptan el puerto serie como argumento y usan `/dev/ttyACM0` por
defecto. Bajo WSL2 el dispositivo debe reenviarse antes con `usbipd`.

```bash
# Asignar identificadores: UN SOLO actuador conectado al bus cada vez
ros2 run so_arm_100_hardware change_id 1 2

# Verificar el bus completo una vez montada la cadena
ros2 run so_arm_100_hardware list_servos

# Centrar un actuador antes de montarlo en su eslabón
ros2 run so_arm_100_hardware center_one 3

# Medir la desviación angular de una articulación
ros2 run so_arm_100_hardware angular_error_test 2

# Medir el tiempo de escritura sobre el bus
ros2 run so_arm_100_hardware bench_serial
```

## Advertencia sobre `change_id`

Los actuadores salen de fábrica compartiendo el identificador 1. Si se
conectan varios sin reasignarlos, todos responden a la vez, las respuestas
colisionan sobre la línea compartida y **el bus deja de responder por
completo sin que ningún mensaje señale la causa**. Por eso `change_id` debe
ejecutarse con un solo actuador conectado, y por eso el programa se niega a
escribir si detecta que el identificador de destino ya está ocupado.

## Advertencia sobre `bench_serial`

`WritePosEx` es una escritura sin espera de respuesta. Lo que este programa
cronometra es el tiempo que tarda el sistema operativo en entregar los bytes
al puerto USB, **no** el tiempo que tarda el actuador en recibirlos ni en
ejecutarlos. A 1 Mbaud una trama de una decena de bytes ocupa del orden de
0,1 ms en el cable; el resto es sobrecarga del anfitrión y del adaptador
USB-serie. El valor medido es correcto para lo que mide, pero no debe
presentarse como la latencia completa del camino hacia el actuador.

## Advertencia sobre la resolución del instrumento

El codificador magnético tiene 12 bits: 4096 pasos por revolución, es decir
**0,0879° por paso**. Ninguna medición angular obtenida con estos programas
puede distinguir diferencias menores que ese valor. Al reportar resultados
conviene dar la cifra en pasos además de en grados, para que el lector pueda
juzgar si el margen declarado supera la resolución del instrumento.
