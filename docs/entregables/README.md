# Documentos entregados

Los cuatro documentos con que se presentó el proyecto, archivados tal como se entregaron: con sus portadas, sus autores y su contenido original. Se almacenan mediante Git LFS.

| Archivo | Qué es | Páginas |
|---|---|---:|
| [documento_tecnico_final.pdf](documento_tecnico_final.pdf) | Informe técnico del proyecto, asignatura Análisis y Diseño de Sistemas Mecatrónicos | 240 |
| [presentacion_tecnica.pdf](presentacion_tecnica.pdf) | Presentación de la defensa técnica | 18 |
| [formulacion_y_evaluacion.pdf](formulacion_y_evaluacion.pdf) | Documento de la asignatura Formulación y Evaluación de Proyectos, con el estudio económico | 73 |
| [presentacion_metodologica.pdf](presentacion_metodologica.pdf) | Presentación de la defensa metodológica | 21 |

Las presentaciones se diseñaron en Canva: [versión técnica](https://canva.link/dz4q9prlxcuafhi) y [versión metodológica](https://canva.link/apqcceiqf6xyz0i).

## Cómo leer estos documentos junto al repositorio

Los PDF son el registro de lo que se entregó y no se corrigen. Donde el repositorio precisa o corrige algo, lo dice aquí:

- **Duración de la muestra de visión.** El documento técnico indica que las 447 muestras de FPS se tomaron en 60 segundos. Las marcas de tiempo del registro original muestran **147,8 s**. Las cifras de 34,05, 22,49 y 36,63 FPS no cambian. Véase [pruebas/](../../pruebas/README.md).
- **Qué mide la latencia de 21,87 ms.** Es la suma del procesamiento, de la captura a la publicación en ROS 2, y de la escritura en el puerto serie. No incluye la interpolación del controlador ni el movimiento mecánico, de modo que no es la latencia completa del gesto al movimiento.
- **Minutos por estudiante.** 450 minutos entre 35 estudiantes dan 12,86 minutos. La presentación metodológica atribuye 21,4 minutos a esa misma división en su página 9; 21,4 corresponde a repartir los 450 minutos entre subgrupos de 21.
- **MoveIt y RRT-Connect.** La teleoperación por gestos no pasa por MoveIt: es articular directa. MoveIt y su planificador quedan disponibles para trayectorias cartesianas fuera del lazo de teleoperación.
- **Escenarios económicos.** El préstamo, las ventas y los indicadores de rentabilidad del documento de Formulación evalúan la viabilidad de reproducir la estación; no describen operaciones realizadas. La inversión física directa, la inversión inicial global y el presupuesto de ejecución son tres magnitudes distintas, resumidas en [docs/12](../12-cierre-del-proyecto.md).
