# 12 — Cierre del proyecto

[← Anterior: instalación en WSL2](11-instalacion-wsl2.md) · [Volver al inicio](../README.md) · [Siguiente: lanzador unificado →](14-lanzador-v13.md)

---

Este documento resume, desde el final, qué se hizo en el proyecto, qué se midió y qué quedó fuera de su alcance. Es el punto de entrada para quien llegue al repositorio sin haber seguido el desarrollo.

## El problema

El laboratorio de la carrera contaba con un solo manipulador industrial. Con 450 minutos de práctica efectiva por ciclo repartidos entre un grupo de 35 estudiantes, a cada uno le correspondían **12,86 minutos de operación directa por semestre**, y la práctica individual se sustituía por demostraciones guiadas. La cifra expresa una capacidad nominal del equipo, no una medición del aprendizaje.

El proyecto se planteó construir una estación adicional de bajo costo, basada en una arquitectura abierta, que permitiera a cada estudiante operar un manipulador real y comprender la relación entre su modelo matemático y su comportamiento físico.

## Lo que se hizo

**Se partió de una plataforma existente.** El diseño mecánico del SO-ARM100 es obra de The Robot Studio y se distribuye bajo licencia Apache 2.0; el proyecto no se atribuye su invención. Sobre esa base se trabajó una cadena de cinco grados de libertad más una pinza independiente, accionadas por seis servomotores Feetech STS3215 de 7,4 V en un bus serie semidúplex a 1 Mbaud.

A partir de ahí, el trabajo se organizó en cinco etapas:

1. **Requerimientos.** Se fijaron el tamaño, la carga y el movimiento de la estación mediante un balance de par sobre la articulación de cabeceo de hombro, que mostró que el mecanismo consume el 83,3 % del par disponible en sostenerse a sí mismo. De ahí salieron las especificaciones de 80 g a 0,30 m y de 50 g en el alcance máximo de 431,70 mm.
2. **Modelo descriptivo.** Se estructuró el modelo URDF del manipulador, del que se leyeron también las masas y los centros de gravedad para el balance de par. Aparte se levantó un ensamblaje completo en SolidWorks, con un modelo del servomotor, para visualizar el montaje; está en [`cad/`](../cad/README.md).
3. **Integración.** Se integraron la percepción con MediaPipe Pose y MediaPipe Hands, el control articular con `ros2_control` sobre ROS 2 Humble y la comunicación serie con los servos, con una arquitectura de réplica que gobierna a la vez el gemelo digital y el brazo físico.
4. **Evaluación.** Se midieron la latencia de procesamiento, la desviación angular y la tasa de la canalización de visión sobre el sistema en funcionamiento.
5. **Documentación.** Se derivó, verificó y publicó el modelo cinemático completo, junto con la arquitectura de control y el procedimiento de reproducción que ocupa este repositorio.

El brazo se ensambló, se puso en marcha en 23 sesiones registradas entre el 9 y el 19 de septiembre de 2026 y **se presentó en funcionamiento en la defensa**, ejecutando la versión 13 del nodo de teleoperación.

## Lo que se midió

| Indicador | Resultado | Umbral |
|---|---|---|
| Latencia de procesamiento más escritura serial | 21,87 ms | ≤ 150 ms |
| Desviación angular articular | 0,492° de promedio · 1,494° de máximo | ≤ 1,5° |
| Tasa de la canalización de visión | 34,05 FPS de promedio | ≥ 25 FPS |
| Verificación del modelo cinemático | Errores del orden de 10⁻¹⁵ m sobre más de 43 000 configuraciones | — |

Los tres indicadores se cumplieron y **se reproducen exactamente** a partir de los registros originales; el procedimiento y el detalle de cada población de datos están en [pruebas/](../pruebas/README.md). La verificación del modelo cinemático está en [analisis/cinematica/](../analisis/cinematica/ANALISIS_CINEMATICO.md).

## Lo que quedó fuera del alcance

Se delimita con la misma precisión con que se consignaron los resultados:

- **La latencia completa del gesto al movimiento** no se midió. Los 21,87 ms cubren el procesamiento y la escritura serial; no la interpolación del controlador ni el desplazamiento mecánico.
- **La exactitud en el espacio del efector** no se midió con una referencia externa. La desviación angular compara la consigna con el codificador del propio servo.
- **La carga útil** procede del balance de par; no se hizo un ensayo sostenido con masas patrón.
- **El comportamiento térmico** de los servos en sesiones largas no se caracterizó.
- **La seguridad del arranque** quedó como limitación conocida: la versión 13 supone que el brazo parte de la postura cero y no lee `/joint_states` (bloqueo 6 de [docs/09](09-robot-fisico.md)).
- **El efecto pedagógico** de la estación no se evaluó con una comparación de aprendizaje.

## La dimensión económica

El documento de Formulación y Evaluación de Proyectos distingue tres magnitudes que conviene no mezclar:

| Magnitud | Importe |
|---|---|
| Inversión física directa en componentes y manufactura | C$ 12 456,42 (USD 336,66) |
| Inversión inicial global | C$ 31 079,24 (USD 839,98) |
| Presupuesto de ejecución, con horas de trabajo y viáticos | C$ 34 777,22 (USD 939,92) |

El préstamo, las ventas, el punto de equilibrio y los indicadores de rentabilidad de ese documento son **escenarios de formulación** que evalúan la viabilidad de reproducir la estación; no describen operaciones que se hayan realizado. Los documentos entregados están en [docs/entregables/](entregables/README.md).

## Líneas de continuación

1. Leer `/joint_states` al arrancar y al recalibrar, y bajar el tope de velocidad del nodo, que es la corrección del bloqueo 6.
2. Medir la latencia completa y la exactitud del efector con una referencia externa.
3. Ensayar la carga útil con masas patrón y registrar la temperatura de los servos en una sesión de 90 minutos.
4. Llevar la estación a una práctica de la asignatura y evaluar su efecto sobre el aprendizaje.

## Autores

Cristhian Eduardo Guido Meléndez, Eddy Elías Torrez Escobar, Rodrigo José Tinoco Aguirre y Orlando René Cisneros García. Tutor: MSc. Kevin Josué Flores Carvajal. Universidad Tecnológica La Salle, León, Nicaragua, 2026.
