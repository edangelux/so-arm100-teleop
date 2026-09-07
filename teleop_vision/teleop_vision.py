#!/usr/bin/env python3
"""
=============================================================================
TELEOPERACION SO-ARM100 (5 GDL) -- v13
=============================================================================
QUE CAMBIA Y POR QUE (heredado de v8-v12, ver [E1]-[E6] mas abajo)

[E1] ERROR DE v7 (reconocido): mover la muneca a pose_world_landmarks arreglo
     la mezcla de marcos, pero MediaPipe *Pose* solo tiene 3 puntos de mano
     (menique 18, indice 20, pulgar 22) y son aproximaciones burdas: vectores
     cortos (~10 cm) y ruidosos -> angulos inestables. Se cambio un bug por
     otro.
     SOLUCION v8: la muneca se resuelve ENTERAMENTE EN 2D, en el espacio de
     imagen, donde SI conviven sin mezcla:
        - pose_landmarks (2D normalizado) -> codo y muneca
        - mp_hands       (2D normalizado) -> nudillos (21 puntos precisos)
     Mismo marco, alta resolucion. Hombro y codo siguen en 3D metrico
     (world landmarks), donde los segmentos son largos y el tracking es bueno.

[E2] MOVIMIENTO "TOSCO": el EMA tiene un compromiso rigido -> o suaviza y
     retrasa, o responde y tiembla. Se reemplaza por FILTRO ONE EURO, que
     adapta su frecuencia de corte a la velocidad del movimiento:
        - movimiento lento -> filtra fuerte  (elimina temblor)
        - movimiento rapido -> filtra poco   (sin retraso perceptible)
     Es el estandar para tracking de movimiento humano y ataca exactamente
     el compromiso naturalidad-vs-estabilidad.

[E3] Se elimina el clamp duro de velocidad como filtro principal (producia
     el efecto escalonado); queda solo como tope de seguridad muy alto.

[E4] BUG DE v8 (Wrist_Roll nunca funciono bien -- ahora identificado):
     roll se calculaba como atan2(knuckle2.y, knuckle2.x), es decir el
     angulo de la linea de nudillos contra los EJES FIJOS DE LA IMAGEN.
     pitch, en cambio, ya se calculaba bien: relativo al antebrazo
     (signed_angle_2d(fore2, hand2)). Al no ser relativo, roll quedaba
     ACOPLADO a cualquier rotacion del antebrazo en la imagen (mover el
     codo/hombro) aunque la muneca no pronara/supinara nada.
     SOLUCION v9: roll = signed_angle_2d(fore2, knuckle2) -- mismo patron
     que pitch, resta la orientacion propia del antebrazo antes de medir
     la linea de nudillos. El offset de calibracion absorbe el desfase
     angular constante que esto introduce; solo importa el cambio relativo.

[E5] BUG DE v8/v9 (limites articulares NO coincidian con el URDF real):
     al conectar ~/ros2_ws/src/SO-100-arm y comparar contra
     so_arm_100_description/urdf/so_arm_100_5dof_arm.urdf.xacro (fuente de
     verdad: es el archivo que Gazebo/MoveIt realmente cargan), JOINT_LIMITS
     y GRIPPER_LIMITS tenian valores mas permisivos que el <limit> real de
     cada joint. Efecto: el script podia seguir subiendo el numero en el
     HUD mucho despues de que la fisica de Gazebo ya habia topado el joint
     contra su limite real -- se siente como que el brazo "no termina de
     estirarse/contraerse" aunque en pantalla el numero sigue cambiando.
        Elbow:      URDF ±1.5      rad (±85.9°)  vs script ±1.69     rad (±96.9°)  -> ~10.9° de sobrante en CADA lado
        Wrist_Roll: URDF ±2.75     rad (±157.6°) vs script -2.74385/+2.84121       -> ~5.2° de sobrante en el lado positivo
        Gripper:    URDF -0.1792/+1.5708 (90°)   vs script -0.174533/+1.74533      -> ~10.0° de sobrante al abrir
     SOLUCION v10: JOINT_LIMITS y GRIPPER_LIMITS ahora copian exactamente
     los <limit lower/upper> del urdf.xacro real (con un pequeno margen de
     seguridad hacia ADENTRO, nunca hacia afuera). Shoulder_Rotation ya era
     mas conservador que el URDF (±1.91986 vs ±1.96 real, sobra margen) y
     Shoulder_Pitch/Wrist_Pitch ya coincidian practicamente exacto (<0.001
     rad de diferencia) -- esos tres NO se tocaron.
     NOTA: L1=0.1160 y L2=0.1350 (usados en manipulability()) SI se
     verificaron contra el mismo urdf.xacro real -- norma de los origin xyz
     de los joints Elbow y Wrist_Pitch, dan exactamente 0.1160 m y 0.1350 m.
     Quedan confirmados, no se tocan.

[E6] HIPOTESIS SOBRE INESTABILIDAD DE Wrist_Pitch/Wrist_Roll (analisis de
     video, AUN NO CONFIRMADA -- probar y reportar):
     revisando frame a frame un video de ~60s con el brazo extendido de
     forma sostenida hacia el costado, Wrist_Pitch salto entre -38° y +48°
     (con cambios de signo) y Wrist_Roll entre -43° y +81°, para lo que en
     camara se ve como una postura de muneca bastante estable. Sospecha:
     wrist_angles_2d() calcula angulos a partir de fore2 (codo->muneca,
     de *pose_landmarks*) y hand2/knuckle2 (de *mp_hands*), ambos vectores
     2D. Cuando el antebrazo/mano apuntan hacia la camara (escorzo), su
     proyeccion 2D se acorta hacia cero, y signed_angle_2d() sobre un
     vector casi nulo amplifica cualquier ruido de deteccion en un angulo
     grande e inestable -- exactamente la postura de "brazo extendido hacia
     un lado" que se uso en la prueba.
     MITIGACION v11 (heuristica, no una solucion definitiva): si la
     longitud 2D de fore2, hand2 o knuckle2 cae debajo de un umbral minimo
     (antebrazo/mano en escorzo severo -> medicion no confiable), wrist_
     angles_2d() devuelve None y se reutiliza el mismo mecanismo que ya
     existe para "mano no detectada": se congela el ultimo valor valido en
     vez de comandar un angulo calculado sobre un vector casi nulo. El HUD
     ahora distingue "MANO NO DETECTADA" de "MUNECA EN ESCORZO" para que
     quede claro CUAL de las dos causas esta congelando la muneca.
     COMO VALIDAR: si al mantener el antebrazo mas perpendicular a la
     camara (en vez de apuntando hacia/desde ella) Wrist_Pitch/Roll se ven
     mas estables, la hipotesis queda confirmada y el umbral se puede
     afinar. Si sigue inestable incluso de frente a la camara, la causa es
     otra (probablemente ruido del propio detector de mano) y hay que
     seguir investigando con ese dato.

[E7] BUG CONFIRMADO: SIGN de Elbow y Shoulder_Pitch estaban invertidos
     (al estirar el brazo humano, el robot se contraia, y viceversa).
     Verificado con el urdf.xacro REAL (no una suposicion):
        Elbow: joint axis="1 0 0", origin Upper_Arm->Lower_Arm=(0,0.11257,
        0.028) rpy=0 -> a Elbow=0 el brazo esta RECTO (Upper_Arm y
        Lower_Arm alineados). Cruzado contra tus dos capturas de RViz
        donde TU pusiste el brazo a mano en las poses extendida/contraida:
            extendido:  Shoulder_Pitch=+41°  Elbow=-46°
            contraido:  Shoulder_Pitch=-33°  Elbow=+86°
        Conclusion (verdad de terreno del robot real): Elbow POSITIVO =
        brazo plegado/contraido. Elbow NEGATIVO = brazo extendido.
        Shoulder_Pitch POSITIVO = extendido. Shoulder_Pitch NEGATIVO =
        contraido.
     Del lado humano, el codo crudo (angle_between, sin signo) CRECE al
     doblar mas el brazo (contraer) y BAJA al estirarlo; el hombro crudo
     (elevacion) SUBE al extender (postura de la captura RViz, brazo
     hacia arriba/afuera) y BAJA al contraer. Con SIGN=-1 (default
     original de v1-v11) el resultado matematico es EXACTAMENTE al reves
     de lo que necesita el robot real -- estirar el brazo humano manda un
     Elbow positivo (pliegue) y un Shoulder_Pitch negativo (contraccion).
     SOLUCION v12: SIGN['Elbow'] y SIGN['Shoulder_Pitch'] pasan de -1 a
     +1. Shoulder_Rotation y las munecas no se tocan (no forman parte de
     "estirar/contraer", ese es un eje de direccion horizontal, no de
     alcance).
     IMPORTANTE: si tienes ~/teleop_config.json de una sesion anterior,
     load_config() lo lee y SOBRESCRIBE estos defaults nuevos con lo que
     haya guardado ahi (posiblemente los signos viejos invertidos). Borra
     ese archivo (`rm ~/teleop_config.json`) antes de correr v12, o abrelo
     y confirma a mano que "Elbow" y "Shoulder_Pitch" digan 1, no -1.

[E8] [E7] ERA INCORRECTO -- REVERTIDO. La "verdad de terreno" de [E7] se
     baso en interpretar VISUALMENTE una captura de RViz (una vista 3D en
     un angulo de camara que no se conocia con certeza) para decidir que
     pose era "extendida" vs "contraida". Esa inferencia no era suficiente
     evidencia -- resulto estar al reves. Probado en vivo por el usuario:
     con v12 (Shoulder_Pitch=+1, Elbow=+1) subir el brazo BAJA el robot y
     viceversa -- exactamente invertido.
     ADEMAS: la instruccion de borrar ~/teleop_config.json (dada junto con
     v12) borro tambien el signo de Wrist_Pitch que el usuario YA habia
     afinado en vivo y que funcionaba bien (se veia "s=-1" en HUD de
     sesiones previas) -- al borrar el archivo, Wrist_Pitch volvio al
     default del codigo (+1), que resulto estar invertido para su
     configuracion real (camara/espejo/lateralidad).
     SOLUCION v13 (revierte y restaura, no vuelve a adivinar):
        Shoulder_Pitch: +1 -> -1  (vuelve al default original v1-v11)
        Elbow:          +1 -> -1  (vuelve al default original v1-v11,
                                    mismo cambio que Shoulder_Pitch y
                                    basado en la misma evidencia debil,
                                    se revierte junto con el)
        Wrist_Pitch:    +1 -> -1  (NUEVO default -- reconstruye el valor
                                    que el usuario ya tenia afinado y
                                    funcionando en las 2 sesiones previas
                                    a que este archivo se perdiera)
     Shoulder_Rotation y Wrist_Roll no se tocan: en todo el material de
     video disponible siempre se vieron en su default (+1) sin indicios
     de estar invertidos.
     LECCION: no se vuelve a pedir borrar ~/teleop_config.json a ciegas.
     Si en el futuro hay que resetear ese archivo, primero se pide su
     contenido (o se hace un respaldo) antes de tocarlo -- perder una
     configuracion ya afinada en vivo es mas caro que cualquier bug de
     signo en el codigo fuente.
=============================================================================
"""
import json
import math
import os
import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from std_msgs.msg import Header
from builtin_interfaces.msg import Duration, Time
from control_msgs.action import GripperCommand

import cv2
import mediapipe as mp
import numpy as np

ARM_JOINTS = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
ARM_TOPIC = '/arm_controller/joint_trajectory'
GRIPPER_ACTION = '/gripper_controller/gripper_cmd'
CONFIG_FILE = os.path.expanduser('~/teleop_config.json')

SIGN = {'Shoulder_Rotation': 1, 'Shoulder_Pitch': -1, 'Elbow': -1,     # [E8] revierte [E7]
        'Wrist_Pitch': -1, 'Wrist_Roll': 1}                            # [E8] restaura tu ajuste
GAIN = {n: 1.0 for n in ARM_JOINTS}

# [E2] Parametros del filtro One Euro, por articulacion.
#   min_cutoff bajo  -> mas suave en reposo (menos temblor)
#   beta alto        -> reacciona mas rapido al movimiento (menos retraso)
ONE_EURO = {
    'Shoulder_Rotation': dict(min_cutoff=1.2, beta=0.05),
    'Shoulder_Pitch':    dict(min_cutoff=1.2, beta=0.05),
    'Elbow':             dict(min_cutoff=1.0, beta=0.05),
    'Wrist_Pitch':       dict(min_cutoff=0.7, beta=0.04),
    'Wrist_Roll':        dict(min_cutoff=0.5, beta=0.03),
}

DEADZONE = {'Shoulder_Rotation': 0.012, 'Shoulder_Pitch': 0.012, 'Elbow': 0.012,
            'Wrist_Pitch': 0.020, 'Wrist_Roll': 0.030}

JOINT_LIMITS = {
    'Shoulder_Rotation': (-1.91986, 1.91986),   # URDF real: ±1.96 (ya conservador, sin cambio)
    'Shoulder_Pitch':    (-1.74533, 1.74533),   # URDF real: ±1.745 (sin cambio)
    'Elbow':             (-1.49,    1.49),      # [E5] URDF real: ±1.5  (antes ±1.69, sobraba ~11°/lado)
    'Wrist_Pitch':       (-1.65806, 1.65806),   # URDF real: ±1.658 (sin cambio)
    'Wrist_Roll':        (-2.74,    2.74),      # [E5] URDF real: ±2.75 (antes -2.74385/+2.84121, asimetrico)
}
GRIPPER_LIMITS = (-0.17, 1.56)                  # [E5] URDF real: -0.1792/+1.5708 (antes hasta 1.74533, sobraban ~10°)

# [E6] Longitud minima (en coordenadas normalizadas de imagen, 0-1) que deben
# tener fore2/hand2/knuckle2 para confiar en el angulo 2D que producen. Por
# debajo de esto se asume escorzo severo (vector casi nulo) y se congela.
MIN_FORE_LEN = 0.04
MIN_HAND_LEN = 0.03
MIN_KNUCKLE_LEN = 0.02

L1, L2 = 0.1160, 0.1350
MAX_JOINT_VEL = 8.0        # [E3] solo tope de seguridad, ya no filtra
HANDS_EVERY = 2
ALPHA_GRIP = 0.35

LM = {
    'right': dict(sh=12, el=14, wr=16, osh=11, hip=24, ohip=23),
    'left':  dict(sh=11, el=13, wr=15, osh=12, hip=23, ohip=24),
}


# ------------------------------------------------------------ One Euro filter
class OneEuro:
    """Filtro One Euro: suavizado adaptativo a la velocidad.
    Casiraghi & Fels. Estandar para tracking de movimiento humano."""

    def __init__(self, min_cutoff=1.0, beta=0.05, d_cutoff=1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_prev = None
        self.dx_prev = 0.0

    @staticmethod
    def _alpha(cutoff, dt):
        tau = 1.0 / (2.0 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, dt):
        if self.x_prev is None:
            self.x_prev = x
            return x
        dx = (x - self.x_prev) / dt
        a_d = self._alpha(self.d_cutoff, dt)
        dx_hat = a_d * dx + (1 - a_d) * self.dx_prev
        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self._alpha(cutoff, dt)
        x_hat = a * x + (1 - a) * self.x_prev
        self.x_prev = x_hat
        self.dx_prev = dx_hat
        return x_hat

    def reset(self, x=None):
        self.x_prev = x
        self.dx_prev = 0.0


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros(3)


def angle_between(a, b):
    return math.acos(np.clip(np.dot(unit(a), unit(b)), -1.0, 1.0))


def signed_angle_2d(a, b):
    """Angulo con signo de a hacia b en 2D (cruz escalar)."""
    return math.atan2(a[0]*b[1] - a[1]*b[0], a[0]*b[0] + a[1]*b[1])


def shoulder_elbow_angles(wlm, ids):
    """Hombro y codo: 3D metrico (segmentos largos, tracking confiable)."""
    g = lambda i: np.array([wlm[i].x, wlm[i].y, wlm[i].z])
    sh, el, wr = g(ids['sh']), g(ids['el']), g(ids['wr'])
    osh, hip, ohip = g(ids['osh']), g(ids['hip']), g(ids['ohip'])

    mid_sh, mid_hip = (sh + osh) / 2, (hip + ohip) / 2
    right = unit(sh - osh)
    up = unit(mid_sh - mid_hip)
    forward = unit(np.cross(right, up))
    up = unit(np.cross(forward, right))

    upper, fore = el - sh, wr - el
    u_r, u_u, u_f = np.dot(upper, right), np.dot(upper, up), np.dot(upper, forward)
    return (math.atan2(u_r, u_f),
            math.atan2(u_u, math.hypot(u_r, u_f)),
            angle_between(upper, fore))


def wrist_angles_2d(plm, hand_lm, ids):
    """[E1] Muneca ENTERAMENTE en 2D de imagen: pose_landmarks (codo, muneca)
    + mp_hands (nudillos). Mismo marco, alta precision. Devuelve (pitch, roll)
    o None si no hay mano detectada."""
    if hand_lm is None:
        return None

    p = lambda i: np.array([plm[i].x, plm[i].y])
    el2, wr2 = p(ids['el']), p(ids['wr'])
    fore2 = wr2 - el2                      # antebrazo en 2D de imagen

    hp = lambda i: np.array([hand_lm[i].x, hand_lm[i].y])
    h_wr, mcp_idx, mcp_mid, mcp_pky = hp(0), hp(5), hp(9), hp(17)

    hand2 = mcp_mid - h_wr                 # direccion de la mano en 2D
    knuckle2 = mcp_idx - mcp_pky           # linea de nudillos en 2D

    # [E6] Escorzo severo: alguno de los vectores 2D es casi nulo (antebrazo
    # o mano apuntando hacia/desde la camara) -> el angulo que saldria de
    # signed_angle_2d() no es confiable, no lo calculamos.
    if (np.linalg.norm(fore2) < MIN_FORE_LEN or
            np.linalg.norm(hand2) < MIN_HAND_LEN or
            np.linalg.norm(knuckle2) < MIN_KNUCKLE_LEN):
        return None

    # Pitch: angulo CON SIGNO entre antebrazo y mano, en el plano de imagen
    pitch = signed_angle_2d(fore2, hand2)
    # [E4] Roll: orientacion de la linea de nudillos RELATIVA AL ANTEBRAZO
    # (antes era atan2(knuckle2.y, knuckle2.x) contra los ejes fijos de la
    # imagen, lo que acoplaba el roll a cualquier giro del antebrazo/codo/
    # hombro en pantalla, aunque la muneca no pronara/supinara nada).
    roll = signed_angle_2d(fore2, knuckle2)
    return pitch, roll


def manipulability(q):
    q1, q2, q3 = q[0], q[1], q[2]
    r = L1*math.cos(q2) + L2*math.cos(q2+q3)
    dr2 = -L1*math.sin(q2) - L2*math.sin(q2+q3)
    dr3 = -L2*math.sin(q2+q3)
    dz2 = L1*math.cos(q2) + L2*math.cos(q2+q3)
    dz3 = L2*math.cos(q2+q3)
    c1, s1 = math.cos(q1), math.sin(q1)
    J = np.array([[-r*s1, c1*dr2, c1*dr3], [r*c1, s1*dr2, s1*dr3], [0.0, dz2, dz3]])
    return math.sqrt(max(np.linalg.det(J @ J.T), 0.0))


def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({'sign': SIGN, 'gain': GAIN}, f, indent=2)
        print(f"[OK] guardado en {CONFIG_FILE}")
    except Exception as e:
        print(f"[ERROR] {e}")


def load_config():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE) as f:
                d = json.load(f)
            SIGN.update(d.get('sign', {}))
            GAIN.update(d.get('gain', {}))
            print(f"[OK] config cargada")
    except Exception as e:
        print(f"[AVISO] {e}")


class TeleopNode(Node):
    def __init__(self):
        super().__init__('so_arm100_teleop_v13')
        self.arm_pub = self.create_publisher(JointTrajectory, ARM_TOPIC, 10)
        self.grip_client = ActionClient(self, GripperCommand, GRIPPER_ACTION)
        self.grip_ready = False
        self.grip_busy = False
        self.last_grip = None

    def check_gripper(self):
        if not self.grip_ready:
            self.grip_ready = self.grip_client.wait_for_server(timeout_sec=0.0)
        return self.grip_ready

    def publish_arm(self, q):
        m = JointTrajectory()
        m.header = Header()
        m.header.stamp = Time(sec=0, nanosec=0)
        m.joint_names = ARM_JOINTS
        p = JointTrajectoryPoint()
        p.positions = list(q)
        p.time_from_start = Duration(sec=0, nanosec=40000000)
        m.points = [p]
        self.arm_pub.publish(m)

    def send_gripper(self, pos, effort=10.0):
        if not self.check_gripper() or self.grip_busy:
            return
        if self.last_grip is not None and abs(pos - self.last_grip) < 0.02:
            return
        goal = GripperCommand.Goal()
        goal.command.position = float(pos)
        goal.command.max_effort = float(effort)
        self.grip_busy = True
        self.last_grip = pos
        self.grip_client.send_goal_async(goal).add_done_callback(self._done)

    def _done(self, _):
        self.grip_busy = False


def main(args=None):
    load_config()
    rclpy.init(args=args)
    node = TeleopNode()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: no se pudo abrir la camara.")
        return

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(model_complexity=1, smooth_landmarks=True,
                        min_detection_confidence=0.6, min_tracking_confidence=0.6)
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.5,
                           min_tracking_confidence=0.5)

    WIN = "SO-ARM100 v13 | signos restaurados (revierte v12)"
    cv2.namedWindow(WIN, cv2.WINDOW_AUTOSIZE)

    filters = {n: OneEuro(**ONE_EURO[n]) for n in ARM_JOINTS}
    q_cmd = [0.0]*5
    grip_cmd = 0.0
    offsets = None
    paused = False
    sel = 0
    arm_side = 'right'
    frame_i = 0
    hand_cache = None
    hand_seen = False
    wrist_ok = True         # [E6] False cuando fore2/hand2/knuckle2 estan en escorzo
    t_prev = time.time()
    w_idx = 0.0
    fps = 0.0

    print("\n" + "="*72)
    print("v13 | [C]calibrar [1-5]invertir [TAB]sel [+/-]ganancia")
    print("     [B]brazo [S]guardar [P]pausa [Q]salir")
    print("="*72 + "\n")

    try:
        while rclpy.ok() and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            now = time.time()
            dt = max(now - t_prev, 1e-3)
            t_prev = now
            fps = 0.9*fps + 0.1*(1.0/dt)
            frame_i += 1

            h, w, _ = frame.shape
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pres = pose.process(rgb)
            if frame_i % HANDS_EVERY == 0:
                hres = hands.process(rgb)
                hand_cache = (hres.multi_hand_landmarks[0].landmark
                              if hres.multi_hand_landmarks else None)
                hand_seen = hand_cache is not None

            disp = cv2.flip(frame, 1)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('q'), ord('Q'), 27):
                break
            want_cal = key in (ord('c'), ord('C'), 32)
            if key in (ord('p'), ord('P')):
                paused = not paused
                print(f"--- {'PAUSADO' if paused else 'REANUDADO'} ---")
            if key in (ord('b'), ord('B')):
                arm_side = 'left' if arm_side == 'right' else 'right'
                offsets = None
                print(f"--- BRAZO {arm_side.upper()} (recalibra con [C]) ---")
            if key in (ord('s'), ord('S')):
                save_config()
            if key == 9:
                sel = (sel + 1) % 5
            if key in (ord('+'), ord('=')):
                GAIN[ARM_JOINTS[sel]] = round(min(GAIN[ARM_JOINTS[sel]]+0.1, 3.0), 2)
                print(f"GAIN {ARM_JOINTS[sel]} = {GAIN[ARM_JOINTS[sel]]}")
            if key in (ord('-'), ord('_')):
                GAIN[ARM_JOINTS[sel]] = round(max(GAIN[ARM_JOINTS[sel]]-0.1, 0.1), 2)
                print(f"GAIN {ARM_JOINTS[sel]} = {GAIN[ARM_JOINTS[sel]]}")
            for k in range(5):
                if key == ord(str(k+1)):
                    n = ARM_JOINTS[k]
                    SIGN[n] *= -1
                    print(f"SIGN {n} -> {SIGN[n]:+d}")

            ids = LM[arm_side]
            tracking = False
            raw = None

            if pres.pose_world_landmarks and pres.pose_landmarks:
                wlm = pres.pose_world_landmarks.landmark
                plm = pres.pose_landmarks.landmark
                a_rot, a_pit, a_elb = shoulder_elbow_angles(wlm, ids)

                wa = wrist_angles_2d(plm, hand_cache, ids)      # [E1]
                wrist_ok = wa is not None                       # [E6]
                if wa is not None:
                    a_wp, a_wr = wa
                else:
                    # sin mano detectada O en escorzo: mantener el ultimo valor conocido
                    a_wp = offsets['Wrist_Pitch'] if offsets else 0.0
                    a_wr = offsets['Wrist_Roll'] if offsets else 0.0

                raw = {'Shoulder_Rotation': a_rot, 'Shoulder_Pitch': a_pit,
                       'Elbow': a_elb, 'Wrist_Pitch': a_wp, 'Wrist_Roll': a_wr}
                tracking = True

                if offsets is None or want_cal:
                    if hand_cache is None:
                        print("[AVISO] calibra con la MANO VISIBLE para la muneca")
                    offsets = dict(raw)
                    q_cmd = [0.0]*5
                    for n in ARM_JOINTS:
                        filters[n].reset(0.0)
                    print(f">>> CALIBRADO ({arm_side}): esta postura = q [0,0,0,0,0]")

                if offsets is not None and not paused:
                    max_step = MAX_JOINT_VEL * dt
                    for i, n in enumerate(ARM_JOINTS):
                        d = raw[n] - offsets[n]
                        if n in ('Wrist_Roll', 'Wrist_Pitch', 'Shoulder_Rotation'):
                            d = math.atan2(math.sin(d), math.cos(d))
                        if abs(d) < DEADZONE[n]:
                            d = 0.0
                        lo, hi = JOINT_LIMITS[n]
                        target = float(np.clip(SIGN[n]*GAIN[n]*d, lo, hi))
                        smoothed = filters[n](target, dt)        # [E2] One Euro
                        q_cmd[i] += float(np.clip(smoothed - q_cmd[i],
                                                  -max_step, max_step))
                    w_idx = manipulability(q_cmd)

            if pres.pose_landmarks:
                plm = pres.pose_landmarks.landmark
                P = lambda i: (int((1.0-plm[i].x)*w), int(plm[i].y*h))
                cv2.line(disp, P(ids['sh']), P(ids['el']), (0,255,0), 4)
                cv2.line(disp, P(ids['el']), P(ids['wr']), (255,150,0), 4)
                cv2.line(disp, P(ids['sh']), P(ids['osh']), (255,0,255), 2)
                cv2.line(disp, P(ids['sh']), P(ids['hip']), (140,140,255), 2)
                for i, c in ((ids['sh'],(0,0,255)), (ids['el'],(0,255,255)),
                             (ids['wr'],(255,0,255))):
                    cv2.circle(disp, P(i), 7, c, -1)

            if hand_cache is not None:
                hl = hand_cache
                HP = lambda i: (int((1.0-hl[i].x)*w), int(hl[i].y*h))
                cv2.line(disp, HP(0), HP(9), (0,220,255), 3)     # mano
                cv2.line(disp, HP(5), HP(17), (255,255,0), 3)    # nudillos
                for i in (0, 5, 9, 17):
                    cv2.circle(disp, HP(i), 5, (255,255,255), -1)
                if not paused:
                    th = np.array([(1.0-hl[4].x)*w, hl[4].y*h])
                    ix = np.array([(1.0-hl[8].x)*w, hl[8].y*h])
                    wp = np.array([(1.0-hl[0].x)*w, hl[0].y*h])
                    pinch = np.linalg.norm(th-ix)/(np.linalg.norm(wp-ix)+1e-5)
                    lo, hi = GRIPPER_LIMITS
                    tgt = float(np.interp(pinch, [0.20, 0.70], [lo, hi]))
                    grip_cmd = ALPHA_GRIP*tgt + (1-ALPHA_GRIP)*grip_cmd
                    cv2.line(disp, tuple(th.astype(int)), tuple(ix.astype(int)),
                             (0,255,255), 2)

            if not paused:
                node.publish_arm(q_cmd)
                node.send_gripper(grip_cmd)

            # HUD
            cv2.putText(disp, f"v13 SIGNOS RESTAURADOS | {arm_side.upper()}",
                        (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,255), 2)
            for i, n in enumerate(ARM_JOINTS):
                y = 48 + i*23
                mk = ">" if i == sel else " "
                col = (0,255,0) if offsets else (120,120,120)
                if n.startswith('Wrist') and not (hand_seen and wrist_ok):  # [E6]
                    col = (0,120,255)
                cv2.putText(disp, f"{mk}{i+1} {n:<17} {q_cmd[i]:+.3f} s={SIGN[n]:+d} g={GAIN[n]:.1f}",
                            (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, col, 1)
                lo, hi = JOINT_LIMITS[n]
                frac = np.clip((q_cmd[i]-lo)/(hi-lo+1e-9), 0, 1)
                x0, x1 = 380, 470
                cv2.rectangle(disp, (x0, y-9), (x1, y+1), (60,60,60), -1)
                cv2.circle(disp, (int(x0+frac*(x1-x0)), y-4), 4, (0,220,255), -1)
                cx = int(x0 + ((0-lo)/(hi-lo+1e-9))*(x1-x0))
                cv2.line(disp, (cx, y-9), (cx, y+1), (255,255,255), 1)

            gy = 48 + 5*23
            gcol = (0,255,0) if node.grip_ready else (0,120,255)
            cv2.putText(disp, f"Gripper {grip_cmd:+.2f} " +
                        ("[OK]" if node.grip_ready else "[accion NO disp.]"),
                        (12, gy), cv2.FONT_HERSHEY_SIMPLEX, 0.42, gcol, 1)
            # [E6] Tres estados distintos: sin mano / mano en escorzo / mano ok
            if not hand_seen:
                hand_txt, hcol = "MANO NO DETECTADA (muneca congelada)", (0,0,255)
            elif not wrist_ok:
                hand_txt, hcol = "MANO DETECTADA, MUNECA EN ESCORZO (congelada)", (0,140,255)
            else:
                hand_txt, hcol = "MANO DETECTADA", (0,255,0)
            cv2.putText(disp, hand_txt,
                        (12, gy+21), cv2.FONT_HERSHEY_SIMPLEX, 0.42, hcol, 1)
            cv2.putText(disp, f"w={w_idx:.5f}   {fps:4.1f} FPS", (12, gy+42),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (190,190,190), 1)
            est = "PAUSA" if paused else ("COPIANDO POSTURA" if offsets else "PULSA [C]")
            ecol = (0,200,255) if paused else ((0,255,255) if offsets else (0,140,255))
            cv2.putText(disp, est, (12, gy+68), cv2.FONT_HERSHEY_SIMPLEX, 0.55, ecol, 2)

            cv2.putText(disp, "[C]calib [1-5]invertir [TAB]sel [+/-]gan [B]brazo [S]guardar [P]pausa [Q]salir",
                        (12, h-12), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (200,200,200), 1)

            cv2.imshow(WIN, disp)
            rclpy.spin_once(node, timeout_sec=0)

    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
