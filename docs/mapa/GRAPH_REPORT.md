# Graph Report - so-arm100-teleop  (2026-09-30)

## Corpus Check
- Large corpus: 386 files · ~1,008,191 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2148 nodes · 4496 edges · 131 communities (96 shown, 35 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 346 edges (avg confidence: 0.83)
- Token cost: 831,064 input · 0 output

## Community Hubs (Navigation)
- Lanzadores ROS 2 (launch)
- Atajos y cámara (scripts)
- Interfaz hardware SOARM100
- Figuras CAD cinemáticas
- Plugin ros2_control
- Cadena FK/IK en JS
- Nodos ROS: puente y espejo
- Ensayos: clase Brazo
- Utilidades main() hardware
- Cinemática desde URDF
- Cámara por red
- SDK SCServo (SCS)
- Instaladores por pasos
- API web y cámara navegador
- Servidor: modelo y procesos
- Ejecutor RAPID (funciones)
- Escena 3D y lecciones
- Lenguaje RAPID (parser)
- Documentos de análisis cinemático
- Paquete de entrega
- Puente ROS (servidor)
- Taller RAPID ejercicios
- Servo SMSCL
- Servo SMSBL
- Teleop v15
- Servo SCSCL
- Lanzador soarm.sh
- Verificación contra video
- Entorno: cámaras y brazo
- Lecciones: geometría
- Lección control (l12)
- Lección orientación (l04)
- Relay de comandos 5 GDL
- Cinemática inversa (Python)
- Cámara de Windows (camwin)
- Estudio económico y metodológico
- Puerto serie SCSerial
- Limitador de saltos
- JogTool y teleop cartesiana
- Taller: corrector
- Capturas: diagnóstico e ISO
- Teleop por zonas
- Sesión y tareas
- Teleop visión original
- Pruebas del puente ROS
- TopicMirror
- Config hardware y recálculo
- Documento técnico final
- Teleop dos brazos
- Difusor de eventos
- Ejemplos RAPID y pruebas JS
- Análisis de ensayos
- Figuras del capítulo
- brazo-fisico (README)
- Celda de trabajo (clase)
- Pruebas e2e Playwright
- Teleop dos manos
- package.json y ESLint
- Análisis cinemático SO-ARM100
- Cámara del navegador
- Lección trayectorias
- Lección obstáculos
- Teleop v13
- Lección cuaterniones duales
- Capturas: retos y celda
- Intérprete RAPID (Ejecutor)
- Nodo puente ROS
- Manejador HTTP
- Capturas: instalador Ubuntu
- Capturas: config VirtualBox
- Docs 17-19: Estudio y ensayos
- Gráficas de ensayos A1-A5
- Aplicar limitador
- Nodo teleop dos manos
- Celda: planta y colores
- Nodo teleop zonas
- Dependencias de desarrollo
- Nodo teleop v14
- Nodo teleop v15
- Cadena plana 2 eslabones
- Extracción D-H
- Docs 03-05: ROS y ejecución
- Herramienta de calibración
- Nodo teleop cartesiana
- Scripts npm
- Figuras D-H
- Docs 01/02/11: instalación
- Arquitectura espejo /real
- Docs 07-08: funcionamiento
- Docs 09/14/15: robot y lanzador
- Entregables (README)
- Servicios de calibración
- Nodo TrajectoryMirror
- Nodo teleop dos brazos
- Nodo teleop v13
- Nodo teleop visión
- Plan de aprendizaje
- Cierre y CAD
- Visión y calibración operador
- Filtro OneEuro v13
- Configuración knip
- Filtro OneEuro v14
- Manipulabilidad y singularidad
- Calibración articular
- Controladores MoveIt
- Configuración Playwright
- Diálogos de cámara y brazo
- Capturas: webcam en VM
- Figuras: cadena 5 GDL
- Figura: espacio de trabajo
- Figuras MATLAB
- Trabajador de cámara
- Cinemática directa/inversa JS
- DroidCam un cliente
- MoveJ vs MoveL
- Lección PLC
- Instalar atajos
- Pestaña Ensayos
- README de capturas
- Servo y KDL
- Dependencias Python
- Parche de pinza
- Restaurar entrega
- Proteger brazo
- Icono de la app
- Sensores 3D MoveIt

## God Nodes (most connected - your core abstractions)
1. `SOARM100Interface` - 66 edges
2. `el()` - 61 edges
3. `SMS_STS` - 42 edges
4. `SCS` - 37 edges
5. `lectura()` - 30 edges
6. `grados()` - 28 edges
7. `animar()` - 27 edges
8. `linea()` - 26 edges
9. `Host2SCS` - 26 edges
10. `deslizador()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `controladores_sim.yaml (MoveIt to Gazebo controllers)` --semantically_similar_to--> `moveit_controllers.yaml (MoveIt simple controller manager)`  [INFERRED] [semantically similar]
  scripts/moveit/controladores_sim.yaml → overlay/so_arm_100_moveit_config/config/moveit_controllers.yaml
- `test_detener_con_clave_ajena_no_detiene()` --uses--> `CamaraNavegador`  [INFERRED]
  pruebas/py/test_camwin.py → app/estudio/camwin.py
- `test_rechaza_clave_equivocada_y_emisor_viejo()` --uses--> `CamaraNavegador`  [INFERRED]
  pruebas/py/test_camwin.py → app/estudio/camwin.py
- `load_config()` --indirect_call--> `f()`  [INFERRED]
  entrega/teleoperacion/teleop_two_arms.py → app/estudio/nodo_puente.py
- `save_config()` --indirect_call--> `f()`  [INFERRED]
  entrega/teleoperacion/teleop_two_arms.py → app/estudio/nodo_puente.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Automatización de calidad en GitHub** — github_dependabot, github_workflows_calidad, github_workflows_mutacion [INFERRED 0.75]
- **Documentos del análisis cinemático** — analisis_cinematica_analisis_cinematico, analisis_cinematica_capitulo_analisis_cinematico, analisis_cinematica_paso_a_paso, analisis_cinematica_fuentes_modelado_matematico, analisis_cinematica_validacion_en_simuladores [INFERRED 0.85]
- **Rutas de instalacion** — docs_01_instalacion_maquina_virtual, docs_02_instalacion_nativa_iso, docs_11_instalacion_wsl2 [INFERRED 0.85]
- **Protecciones del brazo fisico** — docs_20_protecciones_del_brazo_limitador, docs_20_protecciones_del_brazo_comprobar_brazo, docs_20_protecciones_del_brazo_centrar_suave [EXTRACTED 1.00]
- **Configuracion de MoveIt del SO-100 (controladores, cinematica, limites)** — entrega_src_so_100_arm_so_arm_100_moveit_config_config_moveit_controllers, entrega_src_so_100_arm_so_arm_100_moveit_config_config_kinematics, entrega_src_so_100_arm_so_arm_100_moveit_config_config_joint_limits, entrega_src_so_100_arm_so_arm_100_moveit_config_config_pilz_cartesian_limits, entrega_src_so_100_arm_so_arm_100_moveit_config_config_ros2_controllers [INFERRED 0.85]
- **MoveIt/ros2_control controller configuration set** — overlay_so_arm_100_moveit_config_config_moveit_controllers, overlay_so_arm_100_moveit_config_config_ros2_controllers, scripts_moveit_controladores_real, scripts_moveit_controladores_sim [INFERRED 0.85]
- **Cadena de teleoperacion por vision** — docs_entregables_documento_tecnico_final_mediapipe, docs_entregables_documento_tecnico_final_ros2_humble, docs_entregables_documento_tecnico_final_servos_uart, docs_entregables_documento_tecnico_final_so_arm100 [INFERRED 0.85]
- **Cadena de teleoperacion por vision a servos** — docs_entregables_presentacion_metodologica_pipeline_vision, docs_entregables_presentacion_tecnica_pipeline, docs_entregables_presentacion_tecnica_cadena_cinematica [INFERRED 0.85]
- **Factibilidad economica del proyecto** — docs_entregables_presentacion_metodologica_costos, docs_entregables_presentacion_metodologica_financiamiento, docs_entregables_presentacion_metodologica_capacidad [INFERRED 0.75]
- **Figuras de marcos y dimensiones D-H** — analisis_cinematica_figuras_figa_marcos_dh, analisis_cinematica_figuras_figb_dimensiones, analisis_cinematica_figuras_figc_marcos_por_articulacion, analisis_cinematica_figuras_figd_l [INFERRED 0.85]
- **Analisis de singularidad y manipulabilidad** — analisis_cinematica_figuras_fig3_manipulabilidad, analisis_cinematica_figuras_fig4_singularidad, concept_elbow_singularity [INFERRED 0.85]
- **Figuras de cinematica del SO-ARM100 (MATLAB)** — analisis_cinematica_matlab_figuras_mlab_fig1_marcos_dh, analisis_cinematica_matlab_figuras_mlab_fig2_grados_de_libertad, analisis_cinematica_matlab_figuras_mlab_fig3_espacio_de_trabajo, analisis_cinematica_matlab_figuras_mlab_fig4_manipulabilidad, analisis_cinematica_matlab_figuras_mlab_fig5_corke_cadena_dh, analisis_cinematica_matlab_figuras_mlab_fig6_rst_arbol_cuerpos [INFERRED 0.85]
- **Dialogos del lanzador (brazo y camara)** — docs_img_brazo_no_encontrado, docs_img_camara_1_tipo, docs_img_camara_2_ip [INFERRED 0.75]
- **Flujo del reto: enunciado, celda de trabajo y programa en curso** — docs_img_estudio_10_reto, docs_img_estudio_11_celda, docs_img_estudio_12_reto_en_curso [INFERRED 0.85]
- **Pestañas de SO-ARM100 Estudio: Sesión, Mover, Aprender** — docs_img_estudio_1_sesion, docs_img_estudio_2_mover, docs_img_estudio_3_aprender [INFERRED 0.85]
- **Pasos de descarga para la máquina virtual** — docs_img_vm_01_iso_releases_ubuntu, docs_img_vm_02_iso_descarga, docs_img_vm_03_vbox_web_descarga [INFERRED 0.85]
- **VirtualBox 7.2.16 installation procedure on Windows** — docs_img_vm_04_vbox_instalador_1, docs_img_vm_05_vbox_instalador_2, docs_img_vm_06_vbox_instalador_3, docs_img_vm_07_vbox_aviso_internet, docs_img_vm_08_vbox_aviso_yes_1, docs_img_vm_09_vbox_aviso_yes_2, docs_img_vm_10_vbox_boton_install, docs_img_vm_11_vbox_instalacion_finalizada [EXTRACTED 1.00]
- **Creating the robotcito Ubuntu VM in VirtualBox** — docs_img_vm_12_vbox_nueva_1, docs_img_vm_13_vbox_nueva_2, vm_robotcito, ubuntu_22_04_iso [INFERRED 0.85]
- **VirtualBox VM creation and configuration walkthrough** — docs_img_vm_14_vbox_config_1_hardware, docs_img_vm_15_vbox_config_2_disk, docs_img_vm_19_vbox_pantalla_3d_pantalla, docs_img_vm_20_vbox_red_puente_red, docs_img_vm_21_vbox_usb_servomotores_usb, docs_img_vm_23_ubuntu_instalador_1_grub [INFERRED 0.85]
- **Ubuntu installation wizard steps in VirtualBox** — docs_img_vm_24_ubuntu_instalador_2_welcome_screen, docs_img_vm_25_ubuntu_instalador_3_keyboard_layout, docs_img_vm_26_ubuntu_instalador_4_minimal_installation, docs_img_vm_27_ubuntu_instalador_5_erase_disk, docs_img_vm_28_ubuntu_usuario_password_1_who_are_you [INFERRED 0.85]
- **Post-install upgrade, restart and terminal flow** — docs_img_vm_30_ubuntu_upgrade_1_upgrade_prompt, docs_img_vm_31_ubuntu_upgrade_2_software_updater, docs_img_vm_32_ubuntu_reiniciar_restart_prompt, docs_img_vm_33_ubuntu_terminal_1_open_terminal [INFERRED 0.85]
- **Real-arm tests A1-A5 (static, repeatability, load, thermal, step)** — pruebas_resultados_2026_09_25_a1_estatico_real_100819, pruebas_resultados_2026_09_25_a2_repetibilidad_real_101500, pruebas_resultados_2026_09_25_a3_carga, pruebas_resultados_2026_09_25_a4_termico_103052, pruebas_resultados_2026_09_25_a5_escalon_real_102350 [EXTRACTED 1.00]

## Communities (131 total, 35 thin omitted)

### Community 0 - "Lanzadores ROS 2 (launch)"
Cohesion: 0.05
Nodes (13): generate_bridge_config(), generate_launch_description(), launch_setup(), get_robot_description(), generate_launch_description(), generate_launch_description(), launch_setup(), get_robot_description() (+5 more)

### Community 1 - "Atajos y cámara (scripts)"
Cohesion: 0.07
Nodes (41): abrir.sh script, vivo(), atajos.bash script, centrar(), servos(), soarm-actualizar(), soarm-ayuda(), _soarm_cargar() (+33 more)

### Community 3 - "Interfaz hardware SOARM100"
Cohesion: 0.04
Nodes (47): SOARM100Interface, active_control_mode_, calib_service_, calibrate_servo, calibration_callback, command_publisher_, ConfigureSerialPort, default_control_mode_ (+39 more)

### Community 4 - "Figuras CAD cinemáticas"
Cohesion: 0.08
Nodes (22): arco(), encuadre(), etiqueta(), figura_C(), figura_D(), figura_E(), flecha(), cota2() (+14 more)

### Community 5 - "Plugin ros2_control"
Cohesion: 0.05
Nodes (15): load_calibration, radians_to_ticks, ticks_to_radians, SOARM100Interface::export_command_interfaces(), SOARM100Interface::export_state_interfaces(), SOARM100Interface::feedback_callback(), SOARM100Interface::load_calibration(), SOARM100Interface::normalize_position() (+7 more)

### Community 6 - "Cadena FK/IK en JS"
Cohesion: 0.08
Nodes (4): Cadena, transformacionOrigen(), Escena, Aplicacion

### Community 7 - "Nodos ROS: puente y espejo"
Cohesion: 0.08
Nodes (6): main(), TrajectoryMirror, GoHome, main(), IrAPose, main()

### Community 8 - "Ensayos: clase Brazo"
Cohesion: 0.10
Nodes (10): Brazo, carpeta_resultados(), confirmar(), ejecutar(), recortar(), main(), main(), main() (+2 more)

### Community 9 - "Utilidades main() hardware"
Cohesion: 0.15
Nodes (36): main(), main(), main(), main(), main(), main(), Host2SCS, syncWrite (+28 more)

### Community 10 - "Cinemática desde URDF"
Cohesion: 0.11
Nodes (15): fk_urdf(), marcos_de_eslabon(), rot_axis(), rpy_R(), T_from(), jacobiano(), manipulabilidad(), sigmas() (+7 more)

### Community 11 - "Cámara por red"
Cohesion: 0.08
Nodes (8): CamaraRed, Cv2ConCamaraRed, es_url(), LectorMJPEG, main(), main(), main(), settings()

### Community 12 - "SDK SCServo (SCS)"
Cohesion: 0.11
Nodes (30): SCS, Ack, End, Error, genWrite, Level, Ping, Read (+22 more)

### Community 13 - "Instaladores por pasos"
Cohesion: 0.18
Nodes (25): LANG, 01_ros2_humble.sh script, 02_simulacion.sh script, 03_vision_python.sh script, 04_workspace.sh script, 05_aplicar_overlay.sh script, 06_brazo_fisico.sh script, anadir_a_bashrc() (+17 more)

### Community 14 - "API web y cámara navegador"
Cohesion: 0.15
Nodes (23): enviar(), escuchar(), obtener(), ejercicio(), app, SECCIONES, CAMPOS, seccion (+15 more)

### Community 15 - "Servidor: modelo y procesos"
Cohesion: 0.10
Nodes (8): cargar_modelo(), _vec(), huella(), accion_tarea(), compilar(), exigir_menu(), orden_ros(), ruta_programa()

### Community 16 - "Ejecutor RAPID (funciones)"
Cohesion: 0.09
Nodes (21): FUNCIONES, PINZA, pinzaDesdePorcentaje(), destinoTexto(), exprTexto(), INSTRUCCIONES, instruccionTexto(), circulo() (+13 more)

### Community 17 - "Escena 3D y lecciones"
Cohesion: 0.16
Nodes (23): BRAZO, COLORES, BRAZO, caja(), EJES, etiqueta(), extras(), flecha() (+15 more)

### Community 18 - "Lenguaje RAPID (parser)"
Cohesion: 0.20
Nodes (18): comparacion(), datosMovimiento(), destino(), ErrorPrograma, esc(), expresion(), Fichas, instruccion() (+10 more)

### Community 19 - "Documentos de análisis cinemático"
Cohesion: 0.08
Nodes (27): Análisis cinemático del SO-ARM100 (módulo), Capítulo: Análisis cinemático del manipulador, Fuentes bibliográficas del análisis cinemático, Figura: Marcos de referencia Denavit-Hartenberg (q=0), Figura: Los cinco grados de libertad (q1-q5), Figura: SO-ARM100 con la tabla D-H (Corke), Figura: SO-ARM100 como arbol de cuerpos rigidos, Figuras generadas con MATLAB (+19 more)

### Community 20 - "Paquete de entrega"
Cohesion: 0.09
Nodes (26): calibration.yaml excluido (otro manipulador, nunca cargado), Paquetes apt recuperados (ROS 2, Ignition Gazebo 6, MoveIt), Entorno Python 3.10.12 / ROS 2 Humble / Ubuntu 22.04 WSL2, manifiesto_origen.json (SHA-256), Fuentes de la entrega (README), SO-100-arm README (paquete ROS2 del brazo, brukg), Calibracion del brazo (calibrate_arm.py, calibration_file), ros_gz_bridge.yaml (puente Gazebo-ROS de articulaciones) (+18 more)

### Community 21 - "Puente ROS (servidor)"
Cohesion: 0.11
Nodes (3): iniciar(), Puente, main()

### Community 22 - "Taller RAPID ejercicios"
Cohesion: 0.08
Nodes (21): C, A, Bp, celda, cercaQ(), CUAD, ESQ, OPERADOR (+13 more)

### Community 23 - "Servo SMSCL"
Cohesion: 0.18
Nodes (21): readByte, SMSCL, CalibrationOfs, EnableTorque, FeedBack, LockEprom, Mem, ReadCurrent (+13 more)

### Community 24 - "Servo SMSBL"
Cohesion: 0.18
Nodes (21): writeByte, SMSBL, CalibrationOfs, EnableTorque, FeedBack, LockEprom, Mem, ReadCurrent (+13 more)

### Community 25 - "Teleop v15"
Cohesion: 0.13
Nodes (14): angle_between(), load_config(), main(), manipulability(), OneEuro, _ramp(), save_config(), segment_confidence() (+6 more)

### Community 26 - "Servo SCSCL"
Cohesion: 0.17
Nodes (20): readWord, SCSCL, EnableTorque, FeedBack, LockEprom, Mem, PWMMode, ReadCurrent (+12 more)

### Community 27 - "Lanzador soarm.sh"
Cohesion: 0.16
Nodes (23): alive(), check_aux(), check_camera_url(), die(), go_pose(), help_text(), load_ros(), need_value() (+15 more)

### Community 28 - "Verificación contra video"
Cohesion: 0.10
Nodes (6): centroide3d(), residuos(), build(), hand(), hand2d(), L

### Community 29 - "Entorno: cámaras y brazo"
Cohesion: 0.15
Nodes (17): a_url(), buscar_telefonos(), uno(), camaras_locales(), conectar_brazo(), en_grupo(), entorno(), guardar_conf() (+9 more)

### Community 30 - "Lecciones: geometría"
Cohesion: 0.27
Nodes (18): resolver(), esfera(), figura(), geometriaPlana(), GRADO, lectura(), linea(), marco() (+10 more)

### Community 31 - "Lección control (l12)"
Cohesion: 0.21
Nodes (17): animar(), barras(), botones(), deslizador(), grafica(), A5, metricas(), preparar() (+9 more)

### Community 32 - "Lección orientación (l04)"
Cohesion: 0.15
Nodes (21): filas4(), formula(), matriz(), mini(), vaciar(), APARTE, cuboDemo(), filas3() (+13 more)

### Community 33 - "Relay de comandos 5 GDL"
Cohesion: 0.13
Nodes (11): main(), SOARM1005DofCommandRelay, angle_between(), load_config(), main(), manipulability(), save_config(), shoulder_elbow_angles() (+3 more)

### Community 34 - "Cinemática inversa (Python)"
Cohesion: 0.17
Nodes (13): A_dh(), fk_dh(), dentro(), ik(), jacobiano_numerico(), A_simbolica(), t(), bloque() (+5 more)

### Community 35 - "Cámara de Windows (camwin)"
Cohesion: 0.12
Nodes (5): CamaraNavegador, _flujo(), test_detener_con_clave_ajena_no_detiene(), test_flujo_entrega_la_ultima_imagen_y_cuenta_lectores(), test_rechaza_clave_equivocada_y_emisor_viejo()

### Community 36 - "Estudio económico y metodológico"
Cohesion: 0.12
Nodes (22): Alternativa seleccionada (matriz de decision, 29/30 puntos), Analisis de capacidad y demanda (450 min, 35 estudiantes, 21,4 min por estudiante), Presupuesto y costos operativos (USD 336,66; punto de equilibrio C$14.491,42), Cronograma de 6 semanas, Presentacion metodologica (SO-ARM100, SIPOC, factibilidad), Financiamiento BANPRO (C$31.000, 18% anual, 60 meses), Objetivos: gemelo digital, ROS 2 Humble, arquitectura reproducible, Cadena: OpenCV, MediaPipe Hands, Python, ROS 2, MoveIt 2 RRT-Connect, UART, servos STS3215 (+14 more)

### Community 37 - "Puerto serie SCSerial"
Cohesion: 0.12
Nodes (18): SCSerial, begin, curopt, end, Err, fd, IOTimeOut, orgopt (+10 more)

### Community 38 - "Limitador de saltos"
Cohesion: 0.11
Nodes (13): Limitador, desvio_max, enviado, listo, perdido, recuperando, vel_max, vel_recuperacion (+5 more)

### Community 39 - "JogTool y teleop cartesiana"
Cohesion: 0.12
Nodes (7): f(), JogTool, main(), load_config(), main(), OneEuro, save_config()

### Community 40 - "Taller: corrector"
Cohesion: 0.13
Nodes (12): aLoLargoDeHerramienta(), corregir(), E, probar(), estructura(), guardarIntentos(), hechos(), leerIntentos() (+4 more)

### Community 41 - "Capturas: diagnóstico e ISO"
Cohesion: 0.11
Nodes (21): Estudio: pestaña Revisar (Diagnóstico), Diagnóstico de instalación (Ubuntu 22.04, grupos dialout/video), Rufus configurado (GPT + UEFI), captura pendiente, Particionado de instalación, captura pendiente, Página releases.ubuntu.com/22.04, imagen desktop AMD64, Descarga de ubuntu-22.04.5-desktop-amd64.iso, Descarga de VirtualBox 7.2.16 para Windows hosts, VirtualBox installer welcome screen (7.2.16) (+13 more)

### Community 42 - "Teleop por zonas"
Cohesion: 0.14
Nodes (10): left_hand_roll(), load_config(), main(), OneEuro, pick_hands(), save_config(), signed_angle_2d(), zone_command() (+2 more)

### Community 44 - "Teleop visión original"
Cohesion: 0.16
Nodes (10): angle_between(), load_config(), main(), manipulability(), OneEuro, save_config(), shoulder_elbow_angles(), signed_angle_2d() (+2 more)

### Community 45 - "Pruebas del puente ROS"
Cohesion: 0.11
Nodes (3): esperar_llegada(), puente(), test_punto_lejano_con_tiempo_suficiente_vale()

### Community 46 - "TopicMirror"
Cohesion: 0.12
Nodes (6): main(), TopicMirror, main(), ZeroPoseTest, main(), TopicMirror

### Community 47 - "Config hardware y recálculo"
Cohesion: 0.12
Nodes (14): so_arm_100_hardware CMakeLists.txt, hardware_config.yaml (serial port, baudrate, servo speed/accel), zero.txt (zero pose), SCServo_Linux CMakeLists.txt, so_arm_100_hardware README, SOARM100Interface (ros2_control hardware interface plugin), evidencia_ros_extracto.txt (ros2_control_node init logs), pruebas README (reproducing performance indicators) (+6 more)

### Community 48 - "Documento técnico final"
Cohesion: 0.14
Nodes (19): Modelo cinematico Denavit-Hartenberg y verificacion, Documento tecnico final: manipulador 5 GDL teleoperado por vision, Laboratorio de Mecatronica ULSA Leon, MediaPipe Hands y Pose (teleoperacion por vision), Analisis de par y carga util admisible, Cadena de reproducibilidad del sistema, Arquitectura de nodos y topicos ROS 2 Humble, Bus serial UART en cadena (daisy chain) de servos (+11 more)

### Community 49 - "Teleop dos brazos"
Cohesion: 0.17
Nodes (10): angle_between(), load_config(), main(), OneEuro, pick_hands(), save_config(), shoulder_elbow_angles(), signed_angle_2d() (+2 more)

### Community 50 - "Difusor de eventos"
Cohesion: 0.14
Nodes (3): Difusor, decir(), leer()

### Community 51 - "Ejemplos RAPID y pruebas JS"
Cohesion: 0.18
Nodes (8): EJEMPLOS, NUEVO, analizar(), lexico(), APP, cadena, ejecutar(), modelo

### Community 52 - "Análisis de ensayos"
Cohesion: 0.30
Nodes (14): arr(), carga(), cola(), escalon(), estatico(), fidelidad(), gramos(), grupos() (+6 more)

### Community 53 - "Figuras del capítulo"
Cohesion: 0.17
Nodes (7): _datos(), fig_marcos(), fig_singular(), fk_batch(), jac_batch(), _rot_batch(), w_batch()

### Community 54 - "brazo-fisico (README)"
Cohesion: 0.14
Nodes (14): hardware_controllers.yaml (arm_controller, gripper_controller), Parches de driver a Humble y namespace /real, brazo-fisico/ (brazo real por USB), servo_params.yaml (MoveIt Servo), Paquete trajectory_mirror (espejo sim/real), Utilidades metodológicas (reimplementaciones), CMakeLists.completo.txt (so_arm_100_hardware), Utilidades originales (change_id, list_servos, center_one, angular_error_test, bench_serial) (+6 more)

### Community 56 - "Pruebas e2e Playwright"
Cohesion: 0.21
Nodes (4): abrir(), pestana(), SOLUCIONES, @playwright/test

### Community 57 - "Teleop dos manos"
Cohesion: 0.18
Nodes (7): left_hand_roll(), load_config(), main(), OneEuro, pick_hands(), save_config(), signed_angle_2d()

### Community 58 - "package.json y ESLint"
Cohesion: 0.13
Nodes (14): description, engines, node, name, overrides, qs, private, type (+6 more)

### Community 59 - "Análisis cinemático SO-ARM100"
Cohesion: 0.22
Nodes (7): dhA(), fk(), ik(), jacobiano(), main(), manipulabilidad(), titulo()

### Community 60 - "Cámara del navegador"
Cohesion: 0.23
Nodes (3): camaraNavegador, pausa(), textoError()

### Community 61 - "Lección trayectorias"
Cohesion: 0.26
Nodes (7): curvaS(), preparar(), quintico(), trapecio(), ErrorMovimiento, muestrear(), Planificador

### Community 62 - "Lección obstáculos"
Cohesion: 0.29
Nodes (14): CAJA, choca(), distanciaCaja(), esqueleto(), INICIO, lienzo(), LIM, mapaC() (+6 more)

### Community 63 - "Teleop v13"
Cohesion: 0.22
Nodes (11): requirements-recuperado.txt (mediapipe, opencv, jax, numpy), angle_between(), load_config(), main(), manipulability(), save_config(), shoulder_elbow_angles(), signed_angle_2d() (+3 more)

### Community 64 - "Lección cuaterniones duales"
Cohesion: 0.26
Nodes (13): cuaternionDual(), expTornillo(), hat(), logTornillo(), A, APARTE, B, ejeTornillo() (+5 more)

### Community 65 - "Capturas: retos y celda"
Cohesion: 0.14
Nodes (14): Ventana del reto: El cubo lima a la bandeja, Reto fácil: cubo lima a la bandeja, Tarjeta Celda de trabajo (planta y tabla de objetos), Celda de trabajo (cubos, bandeja, sensores, luces), Señales di1, di2, do1-do3 (WaitDI, SetDO), Pestaña Programa con reto en curso, Pestaña Aprender: Taller 1 paso 3 (ejercicio RAPID), Corrección automática de ejercicios en el robot virtual (+6 more)

### Community 66 - "Intérprete RAPID (Ejecutor)"
Cohesion: 0.38
Nodes (3): correr(), Detenido, Ejecutor

### Community 67 - "Nodo puente ROS"
Cohesion: 0.27
Nodes (3): decir(), main(), Puente

### Community 68 - "Manejador HTTP"
Cohesion: 0.29
Nodes (3): Manejador, programas(), resultados()

### Community 69 - "Capturas: instalador Ubuntu"
Cohesion: 0.22
Nodes (11): Ubuntu VM 'robotcito' in Oracle VirtualBox, Ubuntu installer Welcome screen (Install Ubuntu highlighted), Keyboard layout step (English US), Updates and other software step: Minimal installation with updates download, Installation type step: Erase disk and install Ubuntu (virtual disk), Who are you? step: name, computer name, username, password, Installation progress screen, Ubuntu 24.04.4 LTS upgrade available prompt (+3 more)

### Community 70 - "Capturas: config VirtualBox"
Cohesion: 0.20
Nodes (11): VirtualBox VM robotcito (Ubuntu for ROS 2), VM hardware: 4096 MB RAM, 2 CPUs, EFI, VM virtual hard disk: 50 GB VDI, VirtualBox manager: robotcito VM summary, Close VM dialog: Apagar la maquina, Open Configuracion button in VirtualBox, Display settings: 128 MB video, VMSVGA, 3D acceleration, Network settings: bridged adapter (Intel Wireless-AC 9462) (+3 more)

### Community 71 - "Docs 17-19: Estudio y ensayos"
Cohesion: 0.25
Nodes (11): Doc 17: Ensayos de rendimiento, Ensayos A1-A5 y B1-B2, Doc 18: SO-ARM100 Estudio, Aplicacion SO-ARM100 Estudio, 18 lecciones y taller RAPID, Pruebas C-H del robot, Doc 19: Programar, Celda virtual (+3 more)

### Community 72 - "Gráficas de ensayos A1-A5"
Cohesion: 0.22
Nodes (11): A1 static error per joint chart, Static error (command minus measured) vs command, -30 to 30 deg; Shoulder_Pitch and Elbow worst (about -1 to -3 deg), Shoulder_Rotation, Wrist_Pitch, Wrist_Roll near 0, A2 repeatability chart of tip arrivals, Repeatability RP = 2.30 mm (tip scatter around centre, mostly z spread about -1 to 2.5 mm), A3 sustained effort under load chart, Sustained effort (% of max torque) for shoulder and elbow at no load, 50 g, 227 g in poses medio/init/extendido; elbow peaks about 50% at 227 g extended, effort grows with load, A4 servo temperature chart, Servo temperature over ~18 min: servos 2 and 3 at 49-54 C (2 slowly cooling), others stable 37-39 C; no thermal runaway (+3 more)

### Community 75 - "Celda: planta y colores"
Cohesion: 0.33
Nodes (7): COLORES, DISPOSICION, COLOR, nodo(), planta(), sx(), sy()

### Community 77 - "Dependencias de desarrollo"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, @eslint/js, globals, jscpd, knip, @playwright/test, @stryker-mutator/core (+1 more)

### Community 81 - "Extracción D-H"
Cohesion: 0.39
Nodes (4): ejes_y_puntos(), extraer_dh(), normal_comun(), unit()

### Community 82 - "Docs 03-05: ROS y ejecución"
Cohesion: 0.32
Nodes (8): Doc 03: Instalacion de ROS 2 Humble, Gazebo, ROS 2 Humble, Doc 04: Workspace y compilacion, Overlay de configuracion verificada, Doc 05: Ejecucion y control, Doc 06: Solucion de problemas, Catalogo de errores: apt, colcon, camara, Qt, NumPy, Gazebo

### Community 85 - "Scripts npm"
Cohesion: 0.25
Nodes (8): scripts, calidad, duplicados, e2e, knip, lint, mutacion, test

### Community 86 - "Figuras D-H"
Cohesion: 0.33
Nodes (7): Fig A: Marcos Denavit-Hartenberg sobre el brazo, Fig B: Dimensiones d1, a1, a2, a3 y herramienta, Fig C: Marcos por articulacion, Fig D: Distancias L entre articulaciones consecutivas, Fig F: Validacion contra Robotics Toolbox de Peter Corke, Tabla Denavit-Hartenberg, Robotics Toolbox de Peter Corke

### Community 87 - "Docs 01/02/11: instalación"
Cohesion: 0.29
Nodes (7): Doc 01: Instalacion en maquina virtual, VirtualBox, Doc 02: Instalacion nativa por ISO, Doc 10: Espejo simulacion y robot real, Doc 11: Instalacion en WSL2, Camara y placa de servos en WSL2, WSL2

### Community 88 - "Arquitectura espejo /real"
Cohesion: 0.29
Nodes (7): MoveIt 2, controller_manager, Cinematica inversa (en MoveIt), Arquitectura espejo /real, trajectory_mirror_node, Lanzador scripts/soarm.sh, Comprobacion antes de dar par

### Community 89 - "Docs 07-08: funcionamiento"
Cohesion: 0.33
Nodes (5): Doc 07: Como funciona el sistema, Nodos, topicos y acciones de ROS 2, Doc 08: Analisis cinematico, Manipulador de 5 GDL, Doc 09: Estado del robot fisico

### Community 90 - "Docs 09/14/15: robot y lanzador"
Cohesion: 0.29
Nodes (7): Robot fisico SO-ARM100 y sus seis bloqueos, Controlador so_arm_100_hardware, Doc 14: Lanzador unificado v13, Camara por red (DroidCam), Doc 15: v14 MoveIt y posturas seguras, Posturas seguras init y home, Limitador de saltos (limitador.hpp)

### Community 91 - "Entregables (README)"
Cohesion: 0.29
Nodes (7): documento_tecnico_final.pdf (informe tecnico, 240 pags), formulacion_y_evaluacion.pdf (estudio economico), presentacion_metodologica.pdf (defensa metodologica), presentacion_tecnica.pdf (defensa tecnica), Documentos entregados (README), Latencia de 21,87 ms (procesamiento + escritura serie), Muestra de vision de 447 muestras de FPS (147,8 s reales)

### Community 92 - "Servicios de calibración"
Cohesion: 0.38
Nodes (4): record_current_position, set_torque_enable, SOARM100Interface::calibration_callback(), SOARM100Interface::torque_callback()

### Community 97 - "Plan de aprendizaje"
Cohesion: 0.40
Nodes (5): mate(), hechas(), marcarHecha(), PLAN, seccion

### Community 98 - "Cierre y CAD"
Cohesion: 0.40
Nodes (6): cad/README.md: modelo parametrico SolidWorks, Modelo parametrico SolidWorks 2022, Doc 12: Cierre del proyecto, Servomotores Feetech STS3215, SO-ARM100 de The Robot Studio (Apache 2.0), Problema: un solo manipulador industrial en el laboratorio

### Community 99 - "Visión y calibración operador"
Cohesion: 0.33
Nodes (6): MediaPipe (vision artificial), Calibracion del operador, Teleoperacion por vision, topic_mirror_node, Doc 16: v15 estimacion de angulos, v15: confianza, ganancia de dos posturas, giro de muneca 3D

### Community 101 - "Configuración knip"
Cohesion: 0.33
Nodes (5): entry, ignore, ignoreDependencies, project, $schema

### Community 103 - "Manipulabilidad y singularidad"
Cohesion: 0.50
Nodes (5): Fig 3: Indice de manipulabilidad plano q2-q3, Fig 4: Valores singulares y perdida de rango en singularidad de codo, Singularidad de codo q3=-73.82 grados (rango 5 a 4), Valores singulares del jacobiano, Indice de manipulabilidad w = sqrt(det(J^T J))

### Community 104 - "Calibración articular"
Cohesion: 0.40
Nodes (5): JointCalibration, center_ticks, max_ticks, min_ticks, range_ticks

### Community 105 - "Controladores MoveIt"
Cohesion: 0.40
Nodes (5): controllers_5dof.yaml (ros2_control 5-DOF arm + gripper), moveit_controllers.yaml (MoveIt simple controller manager), ros2_controllers.yaml (position and effort controllers), controladores_real.yaml (MoveIt to /real controllers), controladores_sim.yaml (MoveIt to Gazebo controllers)

### Community 107 - "Diálogos de cámara y brazo"
Cohesion: 0.67
Nodes (4): Camara del telefono por Wi-Fi (DroidCam), Dialogo: brazo no encontrado (USB CH343), Dialogo: elegir tipo de camara, Dialogo: IP del telefono (DroidCam)

### Community 108 - "Capturas: webcam en VM"
Cohesion: 0.50
Nodes (4): Ubuntu VM terminal screenshot (VirtualBox robotcito), Ubuntu 22.04 GNOME VM in Oracle VirtualBox, VirtualBox Devices > Webcams menu screenshot, Webcam passthrough to VM (DroidCam Video, HD User Facing)

### Community 109 - "Figuras: cadena 5 GDL"
Cohesion: 1.00
Nodes (3): Fig 1: Cadena cinematica del SO-ARM100 (cinco grados de libertad), Fig E: Los cinco grados de libertad uno a uno, Cadena cinematica 5 GDL SO-ARM100 (3R plana + giro de herramienta)

### Community 110 - "Figura: espacio de trabajo"
Cohesion: 0.67
Nodes (3): Fig 2: Espacio de trabajo alcanzable (URDF), Espacio de trabajo alcanzable (alcance radial maximo 432 mm, solido de revolucion), Modelo URDF del brazo

### Community 111 - "Figuras MATLAB"
Cohesion: 0.67
Nodes (3): Figura: Espacio de trabajo (seccion meridiana y planta), Figura: Indice de manipulabilidad y singularidad de codo, Singularidad de codo extendido (q3 = -73.825 grados)

### Community 114 - "DroidCam un cliente"
Cohesion: 1.00
Nodes (3): Cuadro de cámara: teléfono ocupado por otro cliente, DroidCam atiende a un solo cliente a la vez, Cuadro de cámara: teléfonos encontrados

### Community 116 - "Lección PLC"
Cohesion: 0.67
Nodes (3): Estudio: lección PLC, ciclo de barrido y lógica de escalera, Gemelo digital de celda, Lógica de escalera (IEC 61131-3)

## Knowledge Gaps
- **283 isolated node(s):** `lienzo`, `ctx`, `EJES`, `POSE`, `POSE` (+278 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 753 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SOARM100Interface::read()` connect `Plugin ros2_control` to `Ensayos: clase Brazo`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `SOARM100Interface::write()` connect `Plugin ros2_control` to `Ensayos: clase Brazo`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `SOARM100Interface` connect `Interfaz hardware SOARM100` to `Pruebas C++ del brazo`, `Puerto serie SCSerial`, `Plugin ros2_control`, `Calibración articular`, `Utilidades main() hardware`, `Servicios de calibración`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `SMS_STS` (e.g. with `main()` and `main()`) actually correct?**
  _`SMS_STS` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `lienzo`, `ctx`, `EJES` to the rest of the system?**
  _283 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Lanzadores ROS 2 (launch)` be split into smaller, more focused modules?**
  _Cohesion score 0.05081585081585081 - nodes in this community are weakly interconnected._
- **Should `Atajos y cámara (scripts)` be split into smaller, more focused modules?**
  _Cohesion score 0.0734006734006734 - nodes in this community are weakly interconnected._
## Aristas agregadas a mano (graphify-out/aristas_manuales.py)

El análisis de código no ve las rutas HTTP, el JSON que pasa por la tubería entre `puente_ros.py` y `nodo_puente.py` ni los tópicos de ROS 2, porque todos son cadenas de texto. Se agregaron 14 nodos (10 tópicos y acciones en la comunidad 131 «Tópicos y acciones ROS 2», 2 rutas HTTP, `.moverRobot()` y `.posturaActual()`) y 52 aristas, cada una con el archivo y la línea donde se verificó. Son EXTRACTED salvo las 7 que unen los tópicos `/real` con los controladores y `SOARM100Interface`: el espacio de nombres `/real` lo pone el lanzamiento del hardware, así que esas son INFERRED 0.95.

Después de un `/graphify --update`, que reescribe graph.json, hay que volver a correr `python graphify-out/aristas_manuales.py && graphify export html`.

Limitaciones que siguen en el grafo: el nodo `Time` junta `rclcpp::Time` (C++) con el módulo `time` (Python), y las llamadas indirectas desde `nodo_puente.f()` son falsas porque `f` es un cierre local. Las rutas que pasan por esos nodos no son dependencias reales.
