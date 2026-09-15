# Fuentes bibliográficas del análisis cinemático

Se reúnen aquí las fuentes consultadas para el manipulador SO-ARM100 / SO-100, conservadas de forma
completa como referencia del proyecto. Las que sustentan directamente el **modelado matemático** se
señalan con ★ y son las citadas en el capítulo de análisis cinemático.

---

## 1. Justificación de la derivación propia del modelo

El repositorio oficial del robot **no publica una tabla de Denavit-Hartenberg**, ni el espacio de
trabajo, ni velocidades, aceleraciones, precisión o repetibilidad. Existe una solicitud pública
abierta pidiendo exactamente esos datos:

- TheRobotStudio/SO-ARM100, issue 99 — <https://github.com/TheRobotStudio/SO-ARM100/issues/99>

**Consecuencia metodológica, aplicada en todo el capítulo.** No se afirmó en ningún momento que los
parámetros de Denavit-Hartenberg procedan de la documentación del fabricante. La formulación empleada
fue que los parámetros **se obtuvieron del modelo descriptivo oficial y se transformaron a una
representación de Denavit-Hartenberg**, y que el resultado se validó contra implementaciones
independientes.

---

## 2. Fuente primaria del robot

- **The Robot Studio. (2024–2025).** *Standard Open SO-100 & SO-101 Arms*. GitHub.
  <https://github.com/TheRobotStudio/SO-ARM100> — documentación del SO-100 en
  <https://github.com/TheRobotStudio/SO-ARM100/blob/main/SO100.md>
  Se empleó para: arquitectura, piezas, modelos tridimensionales, servomotores, montaje, calibración y
  modelo descriptivo. **No** se empleó como fuente de la tabla de Denavit-Hartenberg, por la razón
  expuesta en el apartado anterior.

- **Hugging Face.** *SO-100*. Documentación de LeRobot. <https://huggingface.co/docs/lerobot/so100>
  Se empleó para: ensamblaje, configuración de motores y calibración líder-seguidor.

- ★ **brukg. SO-100-arm (versión 1.3).** <https://github.com/brukg/SO-100-arm>
  **Es el paquete de descripción del que provienen el archivo descriptivo y las mallas que usa este
  trabajo**: `so_arm_100_description/models/so_arm_100_5dof/`. También trae la configuración de
  ROS 2 Control, MoveIt 2 y Gazebo con la que se puede contrastar la implementación del proyecto.

**Nomenclatura.** En la literatura el mismo robot aparece como SO-100, SO100, SO-ARM100 y *Standard
Open Arm 100*. El **SO-101 / SO-ARM101 es la generación siguiente**, no el mismo hardware: cualquier
dato tomado de una fuente sobre SO-101 debe señalarse como tal.

---

## 3. ★ Fuentes del modelado matemático

Estas son las fuentes que sustentaron el capítulo de análisis cinemático.

- ★ **Haviland, J., & Corke, P. (2022).** *Manipulator differential kinematics. Part 1: Kinematics,
  velocity, and applications*. arXiv:2207.01796. <https://arxiv.org/abs/2207.01796>
  **Se empleó para:** la construcción del jacobiano geométrico y la cinemática diferencial.

- ★ **Corke, P. (2017).** *Robotics, vision and control: Fundamental algorithms in MATLAB* (2ª ed.).
  Springer. <https://doi.org/10.1007/978-3-319-54413-7>
  **Se empleó para:** la convención de Denavit-Hartenberg, la manipulabilidad y el marco teórico general.

- ★ **Robotics Toolbox for Python / MATLAB (Peter Corke).**
  <https://petercorke.github.io/robotics-toolbox-python/>
  **Se empleó para:** contrastar la cinemática directa (1.665 × 10⁻¹⁶ m) y el jacobiano
  (1.277 × 10⁻¹⁵) contra una implementación ajena al proyecto. Es además la que evidencia, aplicando
  la fórmula habitual, que √(det(J·Jᵀ)) devuelve exactamente cero para un jacobiano de seis por cinco.

- ★ **Chiaverini, S., Siciliano, B., & Egeland, O. (1994).** Review of the damped least-squares
  inverse kinematics with experiments on an industrial robot manipulator. *IEEE Transactions on
  Control Systems Technology, 2*(2), 123–134. <https://doi.org/10.1109/87.294335>
  **Se empleó para:** justificar el tratamiento de las singularidades y la pseudoinversa amortiguada,
  que es el método al que debe recurrirse cuando no se dispone de solución cerrada.

- ★ **box2ai Robotics.** *LeRobot-Kinematics*. <https://github.com/box2ai-robotics/lerobot-kinematics>
  **Se empleó para:** disponer de una segunda formulación independiente del mecanismo, por
  transformadas elementales en lugar de Denavit-Hartenberg. El capítulo reprodujo esa vía y la
  contrastó con la propia (1.360 × 10⁻¹⁵).

- ★ **tempest-sky.** *SO-ARM100 URDF analysis and simulation*.
  <https://github.com/tempest-sky/so100-urdf-analysis>
  **Se empleó para:** comparar límites articulares, espacio de trabajo por muestreo y cinemática
  inversa por jacobiano amortiguado. Se trata de documentación técnica de repositorio y no de una
  publicación revisada por pares, circunstancia que se hizo explícita al citarla.

- ★ **MIT OpenCourseWare.** *Introduction to Robotics*, capítulo 5 — jacobiano, movimiento
  diferencial, singularidades y redundancia.
  <https://ocw.mit.edu/courses/2-12-introduction-to-robotics-fall-2005/resources/chapter5/>

---

## 4. Antecedentes científicos con el robot real

- **Chiche, H., Jamme, A., Martinez, T. R., & Gomes, G. (2026).** Vision-based hand shadowing for
  robotic manipulation via inverse kinematics. *IEEE Access, 14*, 78319–78330.
  <https://doi.org/10.1109/ACCESS.2026.3693196>
  Constituye el antecedente más cercano al proyecto: SO-ARM101, MediaPipe Hands, veintiún puntos,
  transformación a coordenadas tridimensionales, cinemática inversa por mínimos cuadrados amortiguados,
  simulación previa y manipulador físico. **Advertencia al citar:** el error medio de 36.4 mm y la tasa
  de éxito de 86.7 % ± 4.2 % son resultados de ese experimento, no especificaciones del SO-ARM100.

- **Karalus, J., & Schwenker, F. (2026).** ConceptACT: Episode-level concepts for sample-efficient
  robotic imitation learning. *Frontiers in Robotics and AI, 13*.
  <https://doi.org/10.3389/frobt.2026.1865290> — dos SO-100 en configuración líder-seguidor.

- **Spencer, T. R. (2025).** *Tactile-aided generalisation in low-cost AI robotics: Pick-and-place
  performance on the SO-100-ARM across vision-only and magnetic-sensing configurations* (tesis de
  licenciatura, Eindhoven University of Technology).

- **Dong, Z., Liu, Y., Li, Y., Zhao, H., & Hao, J. (2025).** Conditioning matters: Training diffusion
  policies is faster than you think. *NeurIPS 38*. <https://doi.org/10.52202/085713-3995>

- **Mao, Y., Fu, J., Zhang, R., Xie, H., & Yao, M. (2026).** Beyond success: Refining elegant robot
  manipulation from mixed-quality data via just-in-time intervention. *CVPR*, 13508–13518.

- **Smith, C. O., Van Hoorick, B., Guizilini, V., & Wang, Y. (2026).** *Fiducial exoskeletons:
  Image-centric robot state estimation*. arXiv:2601.08034.

- **Zou, Y., y otros. (2025).** *U-ARM: Ultra low-cost general teleoperation interface for robot
  manipulation*. arXiv:2509.02437.

---

## 5. Software y middleware

- **Macenski, S., Foote, T., Gerkey, B., Lalancette, C., & Woodall, W. (2022).** Robot Operating
  System 2: Design, architecture, and uses in the wild. *Science Robotics, 7*(66), eabm6074.
  <https://doi.org/10.1126/scirobotics.abm6074>
- **ROS 2 in a nutshell: A survey.** *ACM Computing Surveys*, 2026. <https://doi.org/10.1145/3815113>
- **Lugaresi, C., y otros. (2019).** *MediaPipe: A framework for building perception pipelines*.
  arXiv:1906.08172.
- **Todorov, E., Erez, T., & Tassa, Y. (2012).** MuJoCo: A physics engine for model-based control.
  *IEEE/RSJ IROS*, 5026–5033. <https://doi.org/10.1109/IROS.2012.6386109>
- **Mittal, M., y otros. (2025).** *Isaac Lab: A GPU-accelerated simulation framework for multi-modal
  robot learning*. arXiv:2511.04831.
- **Cadene, R., y otros. (2026).** *LeRobot: An open-source library for end-to-end robot learning*.
  arXiv:2602.22818.

---

## 6. Correspondencia entre afirmaciones y fuentes

| Afirmación del capítulo | Fuente que la sustentó |
| :-- | :-- |
| No existe tabla de Denavit-Hartenberg oficial publicada, por lo que hubo de derivarse | Solicitud abierta en el repositorio oficial |
| Geometría, ejes y límites articulares | Modelo descriptivo de `brukg/SO-100-arm` |
| Convención de Denavit-Hartenberg clásica y reglas de asignación | Corke (2017) |
| Construcción del jacobiano geométrico | Haviland y Corke (2022) |
| Índice de manipulabilidad de Yoshikawa y su condición de validez | Corke (2017); Robotics Toolbox |
| Tratamiento de singularidades y mínimos cuadrados amortiguados | Chiaverini y otros (1994) |
| Formulación alternativa por transformadas elementales | LeRobot-Kinematics |
| Contraste numérico de cinemática directa y jacobiano | Robotics Toolbox (Python y MATLAB) |
| Antecedente de visión + cinemática inversa sobre la misma familia de robot | Chiche y otros (2026) |
| Arquitectura de ROS 2 | Macenski y otros (2022) |
