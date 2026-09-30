"""Aristas que el análisis de código de graphify no ve: rutas HTTP, el protocolo JSON
por la tubería entre puente_ros.py y nodo_puente.py, y los tópicos y acciones de ROS 2.

Cada arista lleva el archivo y la línea donde se verificó. Idempotente: quita las
aristas y nodos manuales anteriores y los vuelve a poner. Volver a correrlo después de
un `/graphify --update`, que reescribe graph.json:

    python docs/mapa/aristas_manuales.py && graphify export html
"""
import json
from pathlib import Path

GRAFO = Path(__file__).resolve().parents[2] / 'graphify-out' / 'graph.json'   # la salida de /graphify, fuera del repo
COM_TOPICOS, NOMBRE_TOPICOS = 131, 'Tópicos y acciones ROS 2'

# id, etiqueta, archivo, línea, comunidad (None = la de los tópicos)
NODOS = [
    ('ros_topico_real_arm_joint_trajectory', '/real/arm_controller/joint_trajectory (tópico)', 'app/estudio/nodo_puente.py', 'L35', None),
    ('ros_topico_sim_arm_joint_trajectory', '/arm_controller/joint_trajectory (tópico)', 'app/estudio/nodo_puente.py', 'L34', None),
    ('ros_topico_real_joint_states', '/real/joint_states (tópico)', 'app/estudio/nodo_puente.py', 'L58', None),
    ('ros_topico_sim_joint_states', '/joint_states (tópico)', 'app/estudio/nodo_puente.py', 'L57', None),
    ('ros_accion_real_gripper_cmd', '/real/gripper_controller/gripper_cmd (acción)', 'app/estudio/nodo_puente.py', 'L40', None),
    ('ros_accion_sim_gripper_cmd', '/gripper_controller/gripper_cmd (acción)', 'app/estudio/nodo_puente.py', 'L39', None),
    ('ros_accion_mirror_gripper_cmd', '/mirror_gripper_controller/gripper_cmd (acción)', 'app/estudio/nodo_puente.py', 'L41', None),
    ('ros_accion_mirror_follow_joint_trajectory', 'mirror_controller/follow_joint_trajectory (acción)',
     'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L16', None),
    ('ros_accion_sim_follow_joint_trajectory', '/arm_controller/follow_joint_trajectory (acción)',
     'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L20', None),
    ('ros_accion_real_follow_joint_trajectory', '/real/arm_controller/follow_joint_trajectory (acción)',
     'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L24', None),
    ('http_post_api_trayectoria', 'POST /api/trayectoria', 'app/servidor.py', 'L419', 68),
    ('http_get_api_eventos', 'GET /api/eventos (SSE)', 'app/servidor.py', 'L296', 68),
    ('app_web_js_secciones_programar_moverrobot', '.moverRobot()', 'app/web/js/secciones/programar.js', 'L918', None),
    ('app_web_js_principal_posturaactual', '.posturaActual()', 'app/web/js/principal.js', 'L122', None),
]

T_RT, T_ST = 'ros_topico_real_arm_joint_trajectory', 'ros_topico_sim_arm_joint_trajectory'
T_RJ, T_SJ = 'ros_topico_real_joint_states', 'ros_topico_sim_joint_states'
G_R, G_S, G_M = 'ros_accion_real_gripper_cmd', 'ros_accion_sim_gripper_cmd', 'ros_accion_mirror_gripper_cmd'
F_M, F_S, F_R = ('ros_accion_mirror_follow_joint_trajectory', 'ros_accion_sim_follow_joint_trajectory',
                 'ros_accion_real_follow_joint_trajectory')
PROG, POSTURA = 'app_web_js_secciones_programar_moverrobot', 'app_web_js_principal_posturaactual'
PR = 'app_estudio_puente_ros_puente_'
NP = 'app_estudio_nodo_puente_'
HW = 'brazo_fisico_hardware_controllers'
WRITE = 'entrega_src_so_arm_100_hardware_src_so_arm_100_interface_soarm100interface_write'
READ = 'entrega_src_so_arm_100_hardware_src_so_arm_100_interface_soarm100interface_read'
TM = 'brazo_fisico_trajectory_mirror_trajectory_mirror_'

# origen, destino, relación, archivo, línea, confianza (1.0 = EXTRACTED)
ARISTAS = [
    # Página → servidor
    ('app_web_js_secciones_programar', PROG, 'contains', 'app/web/js/secciones/programar.js', 'L918', 1.0),
    (PROG, 'app_web_js_api_enviar', 'calls', 'app/web/js/secciones/programar.js', 'L922', 1.0),
    (PROG, 'http_post_api_trayectoria', 'http_request', 'app/web/js/secciones/programar.js', 'L922', 1.0),
    ('http_post_api_trayectoria', 'app_servidor_manejador_do_post', 'routed_to', 'app/servidor.py', 'L419', 1.0),
    ('app_servidor_manejador_do_post', PR + 'trayectoria', 'calls', 'app/servidor.py', 'L421', 1.0),
    (PROG, POSTURA, 'calls', 'app/web/js/secciones/programar.js', 'L936', 1.0),
    ('app_web_js_principal', POSTURA, 'contains', 'app/web/js/principal.js', 'L122', 1.0),
    # Servidor → nodo de ROS (JSON por stdin) y de vuelta (JSON por stdout)
    (PR + 'trayectoria', PR + 'orden', 'calls', 'app/estudio/puente_ros.py', 'L271', 1.0),
    (PR + 'orden', NP + 'main_leer', 'pipes_json_to', 'app/estudio/puente_ros.py', 'L165', 1.0),
    (NP + 'main_leer', NP + 'puente_atender', 'shares_data_with', 'app/estudio/nodo_puente.py', 'L132', 1.0),
    (NP + 'puente_atender', NP + 'puente_trayectoria', 'calls', 'app/estudio/nodo_puente.py', 'L92', 1.0),
    (NP + 'puente_atender', NP + 'puente_pinza', 'calls', 'app/estudio/nodo_puente.py', 'L94', 1.0),
    (NP + 'decir', PR + 'leer', 'pipes_json_to', 'app/estudio/nodo_puente.py', 'L45', 1.0),
    (PR + 'leer', 'app_estudio_eventos_difusor_publicar', 'calls', 'app/estudio/puente_ros.py', 'L113', 1.0),
    ('app_estudio_eventos_difusor_publicar', 'app_servidor_manejador_eventos', 'shares_data_with', 'app/servidor.py', 'L324', 1.0),
    ('app_servidor_manejador_eventos', 'http_get_api_eventos', 'serves', 'app/servidor.py', 'L296', 1.0),
    ('app_web_js_api_escuchar', 'http_get_api_eventos', 'http_request', 'app/web/js/api.js', 'L22', 1.0),
    ('app_web_js_principal', 'app_web_js_api_escuchar', 'calls', 'app/web/js/principal.js', 'L38', 1.0),
    # Nodo de la aplicación ↔ tópicos
    (NP + 'puente_trayectoria', T_RT, 'publishes_to', 'app/estudio/nodo_puente.py', 'L35', 1.0),
    (NP + 'puente_trayectoria', T_ST, 'publishes_to', 'app/estudio/nodo_puente.py', 'L34', 1.0),
    (NP + 'puente_pinza', G_R, 'sends_goal_to', 'app/estudio/nodo_puente.py', 'L40', 1.0),
    (NP + 'puente_pinza', G_S, 'sends_goal_to', 'app/estudio/nodo_puente.py', 'L39', 1.0),
    (NP + 'puente_pinza', G_M, 'sends_goal_to', 'app/estudio/nodo_puente.py', 'L41', 1.0),
    (NP + 'puente_cb', T_RJ, 'subscribes_to', 'app/estudio/nodo_puente.py', 'L58', 1.0),
    (NP + 'puente_cb', T_SJ, 'subscribes_to', 'app/estudio/nodo_puente.py', 'L57', 1.0),
    # Ensayos y utilidades ↔ tópicos
    ('pruebas_ensayos_comun_brazo_enviar', T_RT, 'publishes_to', 'pruebas/ensayos/comun.py', 'L27', 1.0),
    ('pruebas_ensayos_comun_brazo_enviar', T_ST, 'publishes_to', 'pruebas/ensayos/comun.py', 'L28', 1.0),
    ('pruebas_ensayos_comun_brazo_estado', T_RJ, 'subscribes_to', 'pruebas/ensayos/comun.py', 'L27', 1.0),
    ('pruebas_ensayos_comun_brazo_estado', T_SJ, 'subscribes_to', 'pruebas/ensayos/comun.py', 'L28', 1.0),
    ('pruebas_ensayos_registrador_main', T_RT, 'subscribes_to', 'pruebas/ensayos/registrador.py', 'L57', 1.0),
    ('pruebas_ensayos_registrador_main', T_ST, 'subscribes_to', 'pruebas/ensayos/registrador.py', 'L57', 1.0),
    ('scripts_soarm', 'scripts_ir_a_pose_main', 'invokes', 'scripts/soarm.sh', 'L296', 1.0),
    ('scripts_ir_a_pose_main', T_RT, 'publishes_to', 'scripts/soarm.sh', 'L290', 1.0),
    ('scripts_ir_a_pose_main', T_ST, 'publishes_to', 'scripts/soarm.sh', 'L289', 1.0),
    ('scripts_moveit_moveit_soarm_launch_generate_launch_description', T_RJ, 'remaps', 'scripts/moveit/moveit_soarm.launch.py', 'L39', 1.0),
    # Espejo simulación → real (modo «ambos», soarm.sh L274-275)
    (TM + 'topic_mirror_node_topicmirror_callback', T_ST, 'subscribes_to', 'brazo-fisico/trajectory_mirror/trajectory_mirror/topic_mirror_node.py', 'L12', 1.0),
    (TM + 'topic_mirror_node_topicmirror_callback', T_RT, 'publishes_to', 'brazo-fisico/trajectory_mirror/trajectory_mirror/topic_mirror_node.py', 'L10', 1.0),
    ('scripts_soarm', TM + 'topic_mirror_node_topicmirror', 'launches', 'scripts/soarm.sh', 'L275', 1.0),
    ('scripts_soarm', TM + 'trajectory_mirror_node_trajectorymirror', 'launches', 'scripts/soarm.sh', 'L274', 1.0),
    (TM + 'trajectory_mirror_node_trajectorymirror_execute_callback', F_M, 'serves', 'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L16', 1.0),
    (TM + 'trajectory_mirror_node_trajectorymirror_execute_callback', F_S, 'sends_goal_to', 'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L20', 1.0),
    (TM + 'trajectory_mirror_node_trajectorymirror_execute_callback', F_R, 'sends_goal_to', 'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L24', 1.0),
    (TM + 'trajectory_mirror_node_trajectorymirror_execute_gripper_callback', G_M, 'serves', 'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L29', 1.0),
    (TM + 'trajectory_mirror_node_trajectorymirror_execute_gripper_callback', G_S, 'sends_goal_to', 'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L33', 1.0),
    (TM + 'trajectory_mirror_node_trajectorymirror_execute_gripper_callback', G_R, 'sends_goal_to', 'brazo-fisico/trajectory_mirror/trajectory_mirror/trajectory_mirror_node.py', 'L37', 1.0),
    # Controladores ↔ hardware. El espacio /real lo pone el lanzamiento del hardware
    # (parche 02 de brazo-fisico), no el YAML: por eso INFERRED 0.95.
    (T_RT, HW, 'consumed_by', 'brazo-fisico/extras/so_arm_100_moveit_config/config/hardware_controllers.yaml', 'L5', 0.95),
    (F_R, HW, 'served_by', 'brazo-fisico/extras/so_arm_100_moveit_config/config/hardware_controllers.yaml', 'L5', 0.95),
    (G_R, HW, 'served_by', 'brazo-fisico/extras/so_arm_100_moveit_config/config/hardware_controllers.yaml', 'L9', 0.95),
    (HW, WRITE, 'commands', 'entrega/src/so_arm_100_hardware/src/so_arm_100_interface.cpp', 'L278', 0.95),
    (READ, HW, 'feeds', 'entrega/src/so_arm_100_hardware/src/so_arm_100_interface.cpp', 'L353', 0.95),
    (HW, T_RJ, 'publishes_to', 'brazo-fisico/extras/so_arm_100_moveit_config/config/hardware_controllers.yaml', 'L20', 0.95),
    (T_ST, 'overlay_so_arm_100_moveit_config_config_controllers_5dof', 'consumed_by', 'overlay/so_arm_100_moveit_config/config/controllers_5dof.yaml', 'L8', 0.95),
]

HIPERARISTAS = [
    {'id': 'manual_bucle_programar_brazo_real', 'label': 'Bucle cerrado Programar → brazo real → postura medida',
     'nodes': [PROG, 'http_post_api_trayectoria', PR + 'trayectoria', NP + 'puente_trayectoria', T_RT, HW, WRITE, READ,
               T_RJ, NP + 'puente_cb', PR + 'leer', 'http_get_api_eventos', POSTURA],
     'relation': 'form', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': 'app/estudio/puente_ros.py'},
    {'id': 'manual_clientes_real_arm_joint_trajectory', 'label': 'Quién publica en /real/arm_controller/joint_trajectory',
     'nodes': [NP + 'puente_trayectoria', 'pruebas_ensayos_comun_brazo_enviar',
               'scripts_ir_a_pose_main', TM + 'topic_mirror_node_topicmirror_callback', T_RT],
     'relation': 'participate_in', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': 'app/estudio/nodo_puente.py'},
]


def main():
    g = json.loads(GRAFO.read_text(encoding='utf-8'))
    g['nodes'] = [n for n in g['nodes'] if n.get('_origin') != 'manual']
    g['links'] = [e for e in g['links'] if e.get('_origin') != 'manual']
    g['hyperedges'] = [h for h in g.get('hyperedges', []) if not h['id'].startswith('manual_')]
    ids = {n['id']: n for n in g['nodes']}
    nombres = {n['community']: n.get('community_name') for n in g['nodes'] if 'community' in n}
    for nid, etiqueta, archivo, linea, com in NODOS:
        if nid in ids:
            continue
        if com is None:
            com = (ids['app_web_js_secciones_programar']['community'] if nid == PROG else
                   ids['app_web_js_principal']['community'] if nid == POSTURA else COM_TOPICOS)
        g['nodes'].append({'id': nid, 'label': etiqueta, 'file_type': 'code' if nid.startswith('app_') else 'concept',
                           'source_file': archivo, 'source_location': linea, 'community': com,
                           'community_name': NOMBRE_TOPICOS if com == COM_TOPICOS else nombres.get(com),
                           'norm_label': etiqueta.lower(), '_origin': 'manual'})
        ids[nid] = g['nodes'][-1]
    faltan = sorted({x for a, b, *_ in ARISTAS for x in (a, b) if x not in ids})
    if faltan:
        raise SystemExit(f'Nodos que ya no existen en el grafo (¿cambió el código?): {faltan}')
    for a, b, rel, archivo, linea, conf in ARISTAS:
        g['links'].append({'source': a, 'target': b, 'relation': rel, '_origin': 'manual',
                           'confidence': 'EXTRACTED' if conf == 1.0 else 'INFERRED', 'confidence_score': conf,
                           'source_file': archivo, 'source_location': linea, 'weight': 1.0})
    g['hyperedges'] += HIPERARISTAS
    GRAFO.write_text(json.dumps(g, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{len(NODOS)} nodos y {len(ARISTAS)} aristas manuales; grafo: {len(g["nodes"])} nodos, {len(g["links"])} aristas')


if __name__ == '__main__':
    main()
