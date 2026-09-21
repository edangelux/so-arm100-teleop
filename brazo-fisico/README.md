# brazo-fisico/

Todo lo que hace falta para mover el **SO-ARM100 real por USB**, además de la
simulación. Lo instala `scripts/06_brazo_fisico.sh`.

Esta carpeta **no** está bajo `overlay/` a propósito: la fase 5 copia el
contenido íntegro de `overlay/` dentro de `~/ros2_ws/src/SO-100-arm/`, y nada
de lo que hay aquí pertenece a ese paquete.

| Ruta | Qué es |
|---|---|
| `parches/01-so_arm_100_hardware-humble.patch` | Adapta el driver de los servos de la API de Jazzy a la de Humble, y corrige el enlazado de `yaml-cpp`. Sin esto no compila. Tres archivos |
| `parches/02-SO-100-arm-humble-y-namespace-real.patch` | Espacio de nombres `/real` para el lado físico, controladores de Humble en la configuración de hardware, ganancia de posición de Gazebo y pose de reposo con margen. Nueve archivos |
| `extras/` | Archivos **nuevos** de MoveIt Servo. Van aparte porque `git diff` no incluye archivos sin seguimiento y el parche no puede llevarlos |
| `trajectory_mirror/` | Paquete ROS 2 con los dos nodos espejo. Ver [docs/10](../docs/10-espejo-simulacion-y-robot-real.md) |
| `launch/gz_moveit_real.launch.py` | Lanza las dos plantas y los dos espejos de una vez |

## Sobre los commits anclados

`scripts/06_brazo_fisico.sh` clona los repositorios originales y hace
`checkout` a un commit **fijo** antes de parchear:

```
brukg/so_arm_100_hardware   088e355e49443bb802e090152e3fb25114d2f2fb
brukg/SO-100-arm            35a59dbc6e48b1308c14d4d239048570e935f810
```

Son los commits sobre los que se generaron los parches. Anclarlos es lo que
impide que esta fase se rompa sola cuando el repositorio original avance. Si
alguna vez hay que actualizar, se regeneran los parches contra el commit nuevo
y se cambian estas dos líneas en el script.

## Estado de verificación

El estado de cada pieza, con su evidencia, está en la tabla de
[docs/09](../docs/09-robot-fisico.md). El brazo físico se operó con éxito en 23
sesiones y en la defensa del proyecto. De los seis bloqueos identificados antes
de tenerlo, el 6 se conserva como limitación conocida del nodo de teleoperación,
y conviene leerlo antes de conectar el brazo.

Los instrumentos de medición y puesta en marcha que se usaron están en
[`utilidades/originales/`](utilidades/originales/).

## Créditos

La arquitectura de doble planta, el retro-porte del driver a Humble y el
paquete `trajectory_mirror` son trabajo de **Cristhian E. Guido Meléndez**,
integrante del equipo del proyecto.
