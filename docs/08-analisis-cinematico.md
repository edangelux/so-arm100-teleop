# 08 — Análisis cinemático: por qué mapeo articular directo y no cinemática inversa

[← Anterior: cómo funciona el sistema](07-como-funciona.md) · [Volver al inicio](../README.md) · [Siguiente: estado del robot físico →](09-robot-fisico.md)

---

Este documento responde a una pregunta concreta: **el proyecto usa cinemática, ¿por qué no usa cinemática inversa para mover el brazo?**

La respuesta corta es que sí usa cinemática inversa — pero en MoveIt, para planificación cartesiana, no dentro del lazo de teleoperación. Dentro del lazo se copian ángulos. La respuesta larga, con los números que lo justifican, es el resto del documento.

Todas las cifras de aquí son reproducibles. El script que las genera está en [`analisis/analisis_cinematico.py`](../analisis/analisis_cinematico.py) y solo necesita `numpy`:

```bash
python3 ~/so-arm100-teleop/analisis/analisis_cinematico.py
```

---

## 1. De dónde venía la confusión

La primera versión del nodo de teleoperación —generada con asistencia de IA antes de las pruebas— **sí tenía cinemática inversa**: una función `solve_3d_ik()` que tomaba la posición cartesiana de la mano del operador y la resolvía con la geometría de dos eslabones (`L1`, `L2`) para obtener los ángulos articulares.

Esa versión nunca llegó a funcionar de forma estable. La versión que corre hoy (**v13**) la reemplazó por completo por mapeo articular directo. El README, sin embargo, se quedó describiendo la versión vieja durante varias iteraciones.

**El encabezado del README decía "Cinemática Inversa 3D" por herencia, no porque el código lo hiciera.** Está corregido.

---

## 2. Qué cinemática usa realmente el proyecto

Conviene aclararlo antes de justificar nada, porque la lista es más larga de lo que sugiere la frase "no hay cinemática inversa":

| Tema | Dónde está, concretamente | ¿En el lazo de teleoperación? |
|---|---|---|
| **Cinemática directa** | `robot_state_publisher` recorre el URDF y calcula la FK de toda la cadena en cada ciclo para publicar TF | Sí (para visualización y para MoveIt) |
| **Cinemática de cuerpos rígidos** | El árbol TF completo: cada eslabón es una transformación homogénea respecto a su padre. En `teleop_vision.py`, `shoulder_elbow_angles()` construye una **base ortonormal** (derecha / arriba / adelante) a partir de hombros y caderas para medir en el marco del torso en vez del de la cámara | Sí |
| **Cuaterniones** | TF representa **toda** rotación como cuaternión. Cada transformada que intercambian Gazebo, RViz y MoveIt lleva un cuaternión dentro | Sí, pero de forma indirecta |
| **Jacobiano / cinemática diferencial** | `manipulability()` arma la matriz `J` 3×3 de la cadena de posición y devuelve `√det(J·Jᵀ)` | Se calcula y se muestra en pantalla (`w=`), **no interviene en el control** |
| **Análisis de singularidades** | El mismo índice `w`. Ver la tabla de la sección 6 | Solo informativo |
| **Cinemática inversa** | El solver **KDL** de MoveIt, configurado en `kinematics.yaml`. Es lo que corre al usar *Plan & Execute* en RViz | **No.** Disponible, pero fuera del lazo |
| **Planeación de trayectorias** | OMPL dentro de `move_group`, y el `joint_trajectory_controller` interpolando cada comando con `time_from_start = 40 ms` | La interpolación sí; la planeación completa no |

Es decir: **la cinemática inversa está instalada, configurada y es demostrable en vivo desde RViz.** Lo que no hace es traducir la posición de tu mano a ángulos del robot.

---

## 3. La razón estructural: 5 GDL no son 6

Una pose completa en el espacio —posición **y** orientación— tiene 6 grados de libertad. El SO-ARM100 tiene 5 en el brazo (más la pinza). Con 5 articulaciones **no existe** solución general para una pose arbitraria. No es cuestión de programar mejor el solver: el problema está mal planteado.

Y hay un detalle específico de este brazo. Estos son los ejes reales, leídos del URDF (`so_arm_100_5dof_arm.urdf.xacro`):

| Articulación | Eje (`<axis>`) | `rpy` del origen | Efecto |
|---|---|---|---|
| `Shoulder_Rotation` | `0 -1 0` | `1.5708 0 0` | Giro alrededor del eje **vertical** de la base |
| `Shoulder_Pitch` | `1 0 0` | `0 0 0` | Cabeceo, eje **x** |
| `Elbow` | `1 0 0` | `0 0 0` | Cabeceo, eje **x** — **paralelo al anterior** |
| `Wrist_Pitch` | `1 0 0` | `-1.57079 0 0` | Cabeceo, eje **x** — el `rpy` gira *sobre* x, así que el eje **no cambia**: sigue paralelo |
| `Wrist_Roll` | `0 1 0` | `0 1.57079 0` | Giro **sobre el propio eje** de la herramienta |

La estructura es entonces: **1 giro vertical + 3 cabeceos paralelos + 1 giro de herramienta.**

Las consecuencias son duras y no se pueden programar para que desaparezcan:

- Los tres cabeceos son coplanares. **El efector solo se puede mover dentro del plano vertical que fija `Shoulder_Rotation`.** La dirección de aproximación de la pinza está obligada a vivir en ese plano.
- **No hay muñeca esférica** (no existen tres ejes que se corten en un punto), así que no aplica la descomposición de Pieper y **no hay solución en forma cerrada**. Cualquier CI tendría que ser numérica e iterativa, cada fotograma.
- Para una posición dada del efector, la orientación **no es libre**: forma una familia de 2 parámetros, no los 3 de SO(3).

> **Aquí es exactamente donde entrarían los cuaterniones**, y también donde se ve por qué no ayudarían tanto como parece. Un cuaternión te deja *especificar* la orientación deseada con precisión y sin bloqueo de cardán. Pero si el objetivo no cumple la restricción del plano, el brazo **no puede alcanzarlo**: el solver devolvería la proyección más cercana, no lo que pediste. El cuaternión describiría bien un objetivo imposible.

---

## 4. La razón de escala

| | Alcance hombro → muñeca |
|---|---|
| Robot (`L1 + L2`) | **0.251 m** |
| Operador (adulto medio) | **0.570 m** |
| Relación | **1 : 2.3** |

`L1 = 0.1160 m` y `L2 = 0.1350 m` no son estimaciones: son la norma de los `origin xyz` de los joints `Elbow` y `Wrist_Pitch` en el URDF.

La cinemática inversa consume **posiciones métricas**. Tu mano se mueve en un volumen 2.3 veces más grande que el del robot, así que la posición no se le puede pasar tal cual: hace falta un factor de escalado, que es **un parámetro más que calibrar** y que cambia según tu estatura y tu distancia a la cámara.

El mapeo articular directo consume **ángulos**, que son adimensionales. Un codo doblado 90° es 90° midas lo que midas.

---

## 5. La razón medida: alcanzabilidad y modo de fallo

Muestreando 200 000 posturas del operador uniformemente en su rango articular, y preguntando cuántas puede ejecutar el robot:

| Ruta | Ejecutable |
|---|---|
| CI **sin escalado** (lo que hacía `solve_3d_ik`) | **5.5 %** |
| CI con escalado 0.44 (relación de alcance) | 40.3 % |
| CI con escalado 0.35 | 25.1 % |
| Mapeo articular directo, sin saturar | 39.6 % |

Los porcentajes de las dos últimas filas se parecen. **La diferencia que importa no es el porcentaje, es qué pasa con el resto:**

- **CI fuera de alcance:** no existe solución. El robot se queda quieto, o el solver devuelve la postura del borde y el brazo **salta**. Se siente como que el sistema se traba.
- **Mapeo directo saturado:** el ángulo se recorta contra el `<limit>` del joint. El robot **sigue moviéndose en la dirección correcta** hasta donde puede, y se queda ahí. Se siente como un tope físico, que es exactamente lo que es.

El primero es un fallo. El segundo es una limitación honesta.

---

## 6. La razón decisiva: amplificación del error

Esta es la más importante, y es la que justifica la decisión por sí sola.

La pregunta: **¿cuánto error articular produce 1 mm de error en la posición medida?** El experimento inyecta ruido de 1 mm sobre la posición del efector y mide el error angular resultante, según dónde esté el brazo dentro de su espacio de trabajo (`d/R` = distancia relativa al alcance máximo):

| `d / R` | Error articular por 1 mm | p99 | Fuera de alcance |
|---|---|---|---|
| 0.05 – 0.50 (plegado) | **1.22°** | 11.21° | 5.7 % |
| 0.50 – 0.80 (cómodo) | **0.79°** | 2.59° | 0 % |
| 0.80 – 0.90 | 1.10° | 3.66° | 0 % |
| 0.90 – 0.95 | 1.51° | 4.92° | 0 % |
| 0.95 – 0.98 | 2.16° | 7.30° | 0 % |
| 0.98 – 0.999 (extendido) | **4.58°** | 18.06° | 6.1 % |
| **Mapeo articular directo** | **0.21°** | — | **0 %** |

Dos lecturas:

1. **El mapeo directo es entre 4 y 22 veces menos sensible al ruido de medición**, y su error es el mismo en todo el espacio de trabajo.
2. **La sensibilidad de la CI depende de la postura**, y es peor precisamente en los dos extremos: brazo totalmente plegado y brazo totalmente extendido. Esas son las dos singularidades de la cadena de dos eslabones, donde `det(J) → 0`.

Y esos extremos no son casos raros: **son justo donde un operador va de forma natural** cuando estira el brazo para alcanzar algo o lo recoge contra el cuerpo.

El índice de manipulabilidad lo confirma numéricamente:

| Postura | `w = √det(J·Jᵀ)` |
|---|---|
| Brazo plegado (`q3 = 0`) | **0.000000** |
| Codo a ~45° (`q3 = 0.8`) | 0.002360 |
| Codo a ~90° (`q3 = 1.5`) | 0.001961 |
| Brazo extendido (`q3 = 0`) | **0.000000** |

Es el mismo `w=` que aparece en la esquina de la ventana de video.

---

## 7. Un argumento que **no** se sostuvo

Por honestidad metodológica, porque en la defensa puede salir: se probó también la hipótesis de que **la CI amplifica el ruido de profundidad de MediaPipe** (que estima `z` con una sola cámara y es su dato menos fiable) más que el mapeo articular.

**No se confirmó.** Al inyectar el mismo ruido de profundidad sobre los mismos puntos, las dos rutas dieron errores comparables — y con escalado la CI salió incluso ligeramente mejor, porque el escalado atenúa el ruido junto con la señal.

Ese argumento se descarta. Los de las secciones 3 a 6 se sostienen con números; este no, y no se usa.

---

## 8. Qué cambiaría si se implementara cinemática inversa

Tres niveles, de menor a mayor riesgo.

### Nivel 1 — Capítulo analítico (riesgo nulo)

No toca el código que funciona. Consiste en formalizar lo que ya está implícito:

- Tabla de parámetros **Denavit-Hartenberg** de la cadena de 5 GDL.
- **Cinemática directa simbólica** con `sympy`, verificada contra TF.
- **Jacobiano completo 6×5** (el del código es 3×3, solo posición).
- **Análisis de singularidades** y mapa del espacio de trabajo alcanzable.
- La comparación cuantitativa de este documento.

**Beneficio:** demuestra el dominio completo de la materia y convierte "no usamos CI" en "no usamos CI, y aquí está la medición que lo justifica". **Costo:** tiempo de escritura. **Riesgo para la demostración: cero.**

### Nivel 2 — Modo cartesiano seleccionable (riesgo medio)

Una tecla que alterna entre el modo actual y un modo cartesiano. La forma correcta de hacerlo **no** es CI analítica, sino **cinemática diferencial con mínimos cuadrados amortiguados**:

```
q̇ = Jᵀ (J·Jᵀ + λ²I)⁻¹ ẋ
```

Ventajas sobre la CI analítica en este caso concreto:

- Es **incremental**: nunca salta entre la rama "codo arriba" y "codo abajo".
- El término `λ²I` **degrada suavemente** la respuesta cerca de una singularidad en vez de explotar — ataca directamente el problema de la sección 6.
- Trabaja con **velocidad** en lugar de posición absoluta, así que el problema de escala 1:2.3 se reduce a una ganancia.
- Reutiliza el jacobiano que ya está en `teleop_vision.py`, ampliado a 6×5.

**Beneficio:** permite comandar "pon la pinza aquí" y demuestra CI en vivo dentro del lazo. **Costo:** hay que elegir `λ`, manejar los límites articulares dentro de la integración, y añade modos de fallo nuevos en una demostración en vivo.

### Nivel 3 — Bloqueo de orientación con cuaterniones (riesgo medio)

Este es el único caso en que los cuaterniones aportan algo **funcional** y no decorativo: un modo *"mantener la pinza horizontal"* mientras la mano se mueve — útil de verdad para tomar un objeto de una mesa. El error de orientación se expresa como cuaternión y se alimenta a la cinemática diferencial del nivel 2.

**Limitación honesta, por la sección 3:** con 5 GDL se pueden fijar dos de los tres grados de orientación, no los tres. El modo tendría que documentar cuál se sacrifica.

---

## 9. Recomendación

**No reemplazar el lazo actual.** Funciona, está calibrado y es lo que se demuestra en vivo.

- **Nivel 1: hacerlo.** Es lo que cierra la pregunta "¿por qué no usaron cinemática inversa?" con una medición en lugar de una excusa.
- **Nivel 2: solo si sobra tiempo**, y siempre como modo **adicional**, nunca sustituyendo al actual.
- **Nivel 3: trabajo futuro.** Es el paso natural una vez que el nivel 2 esté probado.

---

## 10. Cómo reproducir los números

```bash
cd ~/so-arm100-teleop
python3 analisis/analisis_cinematico.py
```

Solo necesita `numpy` (ya instalado por el script de la fase 3). No necesita ROS, ni Gazebo, ni el robot. El script trae todas las constantes comentadas con su origen en el URDF, y la semilla del generador aleatorio está fijada, así que los números salen idénticos en cualquier máquina.

---

## 11. Preguntas de defensa

**«¿Usaron cinemática inversa?»**
Sí, pero no en el lazo de teleoperación. MoveIt tiene el solver KDL configurado y se usa para planificación cartesiana; se puede demostrar en RViz con *Plan & Execute*. El lazo de teleoperación usa mapeo articular directo, por las razones medidas en este documento.

**«¿Por qué no en el lazo?»**
Por tres razones, en orden de peso: el brazo tiene 5 GDL y una pose completa necesita 6, con los tres cabeceos coplanares, así que la orientación no es libre; la CI es entre 4 y 22 veces más sensible al ruido de medición, y peor justo en los extremos del espacio de trabajo donde el operador va de forma natural; y cuando no hay solución la CI falla, mientras que el mapeo directo satura y sigue siendo utilizable.

**«¿Y los cuaterniones?»**
Están en el sistema: TF representa toda rotación como cuaternión. No se usan como objetivo de control porque con 5 GDL la orientación alcanzable es una familia de 2 parámetros, no los 3 de SO(3): un cuaternión describiría con precisión un objetivo que el brazo no puede alcanzar.

**«¿No es un atajo?»**
El mapeo articular directo es la técnica estándar en teleoperación antropomórfica precisamente cuando el manipulador tiene una topología parecida a la del brazo humano, que es el caso. La correspondencia es directa: doblas el codo y el codo se dobla. Con CI el operador comanda la mano y el robot decide qué hace el codo, que para un brazo con esta cinemática produce cambios de configuración visibles.

**«¿Qué haría falta para agregarla?»**
Está desglosado en la sección 8, en tres niveles con su costo y su riesgo.

---

## Siguiente

**[→ 09 — Estado del robot físico](09-robot-fisico.md)**
