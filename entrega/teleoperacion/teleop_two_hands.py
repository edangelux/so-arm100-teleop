import json
import math
import os
import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from geometry_msgs.msg import TwistStamped
from control_msgs.action import GripperCommand
from std_srvs.srv import Trigger

import cv2
import mediapipe as mp
import numpy as np

# ============================================================================
# TELEOPERACION CARTESIANA A DOS MANOS via MediaPipe + MoveIt Servo
#
#   MANO DERECHA  -> posicion del efector (twist.linear.x/y/z)
#   MANO IZQUIERDA-> roll del efector      (twist.angular)
#   PINCH derecho -> apertura del gripper
#
# ---------------------------------------------------------------------------
# NOTA SOBRE LOS 5 DOF (importante)
#
# Una pose cartesiana completa son 6 DOF (3 posicion + 3 orientacion). Este
# brazo tiene 5 articulaciones. Si le pides a Servo posicion + orientacion
# completa, el problema queda SOBRE-RESTRINGIDO (6 restricciones, 5
# variables) y el IK degrada: tipicamente la orientacion del efector "se
# cae" hacia donde la geometria lo permite.
#
# La solucion es liberar explicitamente una dimension via el servicio
# /servo_node/change_drift_dimensions. Con un eje de rotacion liberado
# quedan 5 restricciones para 5 articulaciones y el IK esta bien planteado.
# Cual liberar depende de tu cinematica: este brazo tiene Wrist_Pitch y
# Wrist_Roll pero NO un yaw de muneca dedicado (el yaw del efector queda
# acoplado a Shoulder_Rotation), asi que el candidato natural a liberar es
# una de las rotaciones. Arranca con DRIFT_ROTATION y ajusta si se siente mal.
# ---------------------------------------------------------------------------
#
# LECCION APRENDIDA: el header.stamp de cada TwistStamped DEBE llevar el
# reloj actual del nodo (con use_sim_time). Timestamp en cero = descartado
# en silencio por Servo.
# ============================================================================

TWIST_TOPIC = '/servo_node/delta_twist_cmds'
GRIPPER_ACTION = '/gripper_controller/gripper_cmd'
START_SERVO_SRV = '/servo_node/start_servo'
DRIFT_SRV = '/servo_node/change_drift_dimensions'
CONFIG_FILE = os.path.expanduser('~/teleop_two_hands_config.json')

# --- Camara (fix WSL2 confirmado) ---
CAMERA_INDEX = 0
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FOURCC = 'MJPG'

# --- Dimensiones a liberar (drift) para resolver el deficit de 1 DOF ---
# True = Servo IGNORA esa dimension al resolver IK.
# Si la orientacion sigue sintiendose mal, prueba mover el True a otro eje.
DRIFT = dict(x_translation=False, y_translation=False, z_translation=False,
             x_rotation=False,   y_rotation=True,     z_rotation=False)

AXES = ['x', 'y', 'z']

SIGN_XYZ = {'x': 1, 'y': 1, 'z': 1}
SIGN_ROLL = 1

AXIS_GAIN = {'x': 3.0, 'y': 3.0, 'z': 2.0}
ROLL_GAIN = 1.2
GLOBAL_GAIN_STEP = 0.25

ONE_EURO = {
    'x':    dict(min_cutoff=1.0, beta=0.05),
    'y':    dict(min_cutoff=1.0, beta=0.05),
    'z':    dict(min_cutoff=0.5, beta=0.03),
    'roll': dict(min_cutoff=0.7, beta=0.04),
}

DEADZONE_M = {'x': 0.004, 'y': 0.004, 'z': 0.006}
DEADZONE_VEL = {'x': 0.03, 'y': 0.03, 'z': 0.05}   # m/s de la mano (nuevo mapeo por velocidad)
DEADZONE_ROLL = 0.05          # radianes

MAX_UNITLESS = 1.0
RANGE_CAPTURE_SECONDS = 5.0

# Longitud minima del vector mano-izquierda en 2D para confiar en el angulo.
# Por debajo de esto hay escorzo severo y el roll no es fiable.
MIN_LEFT_HAND_LEN = 0.03

GRIPPER_LIMITS = (-0.17, 1.56)
ALPHA_GRIP = 0.35

# Indices de pose_landmarks / pose_world_landmarks
RIGHT_WRIST = 16
LEFT_WRIST = 15
LEFT_ELBOW = 13
RIGHT_SHOULDER, RIGHT_ELBOW = 12, 14
LEFT_SHOULDER = 11


class OneEuro:
    """Filtro One Euro: suavizado adaptativo a la velocidad."""

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


def signed_angle_2d(a, b):
    """Angulo con signo de a hacia b en 2D (cruz escalar)."""
    return math.atan2(a[0]*b[1] - a[1]*b[0], a[0]*b[0] + a[1]*b[1])


def left_hand_roll(plm, left_hand_lm):
    """Roll comandado por la mano izquierda: angulo de la mano respecto al
    antebrazo izquierdo, en el plano de imagen. Devuelve None si no hay mano
    o si esta en escorzo severo (vector casi nulo -> angulo no fiable)."""
    if left_hand_lm is None:
        return None

    p = lambda i: np.array([plm[i].x, plm[i].y])
    el2, wr2 = p(LEFT_ELBOW), p(LEFT_WRIST)
    fore2 = wr2 - el2

    hp = lambda i: np.array([left_hand_lm[i].x, left_hand_lm[i].y])
    hand2 = hp(9) - hp(0)          # muneca -> nudillo medio

    if (np.linalg.norm(fore2) < MIN_LEFT_HAND_LEN or
            np.linalg.norm(hand2) < MIN_LEFT_HAND_LEN):
        return None

    return signed_angle_2d(fore2, hand2)


def pick_hands(hres, image_w):
    """Separa las manos detectadas en (derecha_usuario, izquierda_usuario).

    mp_hands devuelve handedness en el marco de la IMAGEN SIN ESPEJAR, asi que
    su etiqueta 'Left'/'Right' ya corresponde a la mano real del usuario
    cuando la camara lo ve de frente. Aun asi nos apoyamos en la etiqueta en
    vez de la posicion en x, porque cruzar las manos frente al cuerpo es
    normal en teleoperacion y romperia cualquier heuristica posicional."""
    right_lm = left_lm = None
    if not hres.multi_hand_landmarks or not hres.multi_handedness:
        return None, None

    for lm, handed in zip(hres.multi_hand_landmarks, hres.multi_handedness):
        label = handed.classification[0].label  # 'Left' o 'Right'
        if label == 'Right':
            right_lm = lm.landmark
        else:
            left_lm = lm.landmark
    return right_lm, left_lm


def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({'sign': SIGN_XYZ, 'sign_roll': SIGN_ROLL,
                       'gain': AXIS_GAIN, 'roll_gain': ROLL_GAIN}, f, indent=2)
        print(f"[OK] guardado en {CONFIG_FILE}")
    except Exception as e:
        print(f"[ERROR] {e}")


def load_config():
    global SIGN_ROLL, ROLL_GAIN
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE) as f:
                d = json.load(f)
            SIGN_XYZ.update(d.get('sign', {}))
            AXIS_GAIN.update(d.get('gain', {}))
            SIGN_ROLL = d.get('sign_roll', SIGN_ROLL)
            ROLL_GAIN = d.get('roll_gain', ROLL_GAIN)
            print("[OK] config cargada")
    except Exception as e:
        print(f"[AVISO] {e}")


class TwoHandTeleopNode(Node):
    def __init__(self):
        super().__init__('so_arm100_teleop_two_hands')
        self.twist_pub = self.create_publisher(TwistStamped, TWIST_TOPIC, 10)
        self.grip_client = ActionClient(self, GripperCommand, GRIPPER_ACTION)
        self.grip_ready = False
        self.grip_busy = False
        self.last_grip = None

        self.start_servo_client = self.create_client(Trigger, START_SERVO_SRV)
        self._try_start_servo()
        self._try_set_drift()

    def _try_start_servo(self):
        if self.start_servo_client.wait_for_service(timeout_sec=2.0):
            future = self.start_servo_client.call_async(Trigger.Request())
            rclpy.spin_until_future_complete(self, future, timeout_sec=2.0)
            if future.done() and future.result() is not None:
                print(f"[OK] start_servo -> success={future.result().success}")
            else:
                print("[AVISO] start_servo no respondio a tiempo.")
        else:
            print("[AVISO] servicio start_servo no disponible. "
                  "Verifica que servo.launch.py este corriendo.")

    def _try_set_drift(self):
        """Libera una dimension cartesiana para que el IK de 5 DOF quede
        bien planteado. Si el tipo de servicio no esta disponible en esta
        instalacion, avisa y sigue (el script funciona igual, pero la
        orientacion puede degradarse)."""
        try:
            from moveit_msgs.srv import ChangeDriftDimensions
        except ImportError:
            print("[AVISO] moveit_msgs.srv.ChangeDriftDimensions no disponible; "
                  "se omite la configuracion de drift.")
            return

        client = self.create_client(ChangeDriftDimensions, DRIFT_SRV)
        if not client.wait_for_service(timeout_sec=2.0):
            print(f"[AVISO] {DRIFT_SRV} no disponible; se omite drift.")
            return

        req = ChangeDriftDimensions.Request()
        req.drift_x_translation = DRIFT['x_translation']
        req.drift_y_translation = DRIFT['y_translation']
        req.drift_z_translation = DRIFT['z_translation']
        req.drift_x_rotation = DRIFT['x_rotation']
        req.drift_y_rotation = DRIFT['y_rotation']
        req.drift_z_rotation = DRIFT['z_rotation']

        future = client.call_async(req)
        rclpy.spin_until_future_complete(self, future, timeout_sec=2.0)
        if future.done() and future.result() is not None:
            libres = [k for k, v in DRIFT.items() if v]
            print(f"[OK] drift dimensions -> liberadas: {libres or 'ninguna'}")
        else:
            print("[AVISO] change_drift_dimensions no respondio a tiempo.")

    def check_gripper(self):
        if not self.grip_ready:
            self.grip_ready = self.grip_client.wait_for_server(timeout_sec=0.0)
        return self.grip_ready

    def publish_twist(self, vx, vy, vz, wx=0.0, wy=0.0, wz=0.0,
                      frame_id='base_link'):
        msg = TwistStamped()
        msg.header.stamp = self.get_clock().now().to_msg()   # timestamp real
        msg.header.frame_id = frame_id
        msg.twist.linear.x = float(vx)
        msg.twist.linear.y = float(vy)
        msg.twist.linear.z = float(vz)
        msg.twist.angular.x = float(wx)
        msg.twist.angular.y = float(wy)
        msg.twist.angular.z = float(wz)
        self.twist_pub.publish(msg)

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
    global SIGN_ROLL, ROLL_GAIN
    load_config()
    rclpy.init(args=args)
    node = TwoHandTeleopNode()

    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*CAMERA_FOURCC))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
    if not cap.isOpened():
        print("Error: no se pudo abrir la camara.")
        return

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(model_complexity=1, smooth_landmarks=True,
                        min_detection_confidence=0.6, min_tracking_confidence=0.6)
    mp_hands = mp.solutions.hands
    # max_num_hands=2: necesitamos AMBAS manos simultaneamente
    hands = mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.5,
                           min_tracking_confidence=0.5)

    WIN = "SO-ARM100 Teleop 2 manos (der=posicion, izq=roll)"
    cv2.namedWindow(WIN, cv2.WINDOW_AUTOSIZE)

    filters = {k: OneEuro(**ONE_EURO[k]) for k in ONE_EURO}

    STATE_IDLE, STATE_CAPTURING, STATE_ACTIVE = 0, 1, 2
    cal_state = STATE_IDLE

    origin = None
    prev_wrist = None
    roll_origin = None
    range_min = range_max = None
    scale = {ax: 1.0 for ax in AXES}
    capture_start_t = None

    paused = True
    right_hand = left_hand = None
    grip_cmd = 0.0
    t_prev = time.time()
    fps = 0.0
    out_lin = {ax: 0.0 for ax in AXES}
    out_roll = 0.0
    frame_i = 0
    HANDS_EVERY = 2

    print("\n" + "="*72)
    print("Teleop 2 MANOS | DER=posicion  IZQ=roll  PINCH der=gripper")
    print("  [C]calibrar -> captura de rango (5s)")
    print("  [X/Y/Z]signo pos  [R]signo roll  [+/-]ganancia")
    print("  [S]guardar  [P]pausa/activar  [Q]salir")
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
                right_hand, left_hand = pick_hands(hres, w)

            disp = cv2.flip(frame, 1)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('q'), ord('Q'), 27):
                break
            want_cal = key in (ord('c'), ord('C'), 32)
            if key in (ord('p'), ord('P')):
                paused = not paused
                print(f"--- {'PAUSADO' if paused else 'ACTIVO'} ---")
            if key in (ord('s'), ord('S')):
                save_config()
            if key in (ord('x'), ord('X')):
                SIGN_XYZ['x'] *= -1
                print(f"SIGN x -> {SIGN_XYZ['x']:+d}")
            if key in (ord('y'), ord('Y')):
                SIGN_XYZ['y'] *= -1
                print(f"SIGN y -> {SIGN_XYZ['y']:+d}")
            if key in (ord('z'), ord('Z')):
                SIGN_XYZ['z'] *= -1
                print(f"SIGN z -> {SIGN_XYZ['z']:+d}")
            if key in (ord('r'), ord('R')):
                SIGN_ROLL *= -1
                print(f"SIGN roll -> {SIGN_ROLL:+d}")
            if key in (ord('+'), ord('=')):
                for ax in AXES:
                    AXIS_GAIN[ax] = round(min(AXIS_GAIN[ax] + GLOBAL_GAIN_STEP, 6.0), 2)
                print(f"AXIS_GAIN -> {AXIS_GAIN}")
            if key in (ord('-'), ord('_')):
                for ax in AXES:
                    AXIS_GAIN[ax] = round(max(AXIS_GAIN[ax] - GLOBAL_GAIN_STEP, 0.1), 2)
                print(f"AXIS_GAIN -> {AXIS_GAIN}")

            # --- Lectura de la mano derecha (posicion 3D) ---
            wrist_pos = None
            if pres.pose_world_landmarks:
                wlm = pres.pose_world_landmarks.landmark
                wrist_pos = np.array([wlm[RIGHT_WRIST].x,
                                      wlm[RIGHT_WRIST].y,
                                      wlm[RIGHT_WRIST].z])

            # --- Lectura de la mano izquierda (roll) ---
            roll_raw = None
            if pres.pose_landmarks:
                roll_raw = left_hand_roll(pres.pose_landmarks.landmark, left_hand)
            left_ok = roll_raw is not None

            # --- Calibracion ---
            if want_cal and wrist_pos is not None:
                origin = wrist_pos.copy()
                roll_origin = roll_raw if left_ok else None
                range_min = {ax: 0.0 for ax in AXES}
                range_max = {ax: 0.0 for ax in AXES}
                cal_state = STATE_CAPTURING
                capture_start_t = now
                for k in filters:
                    filters[k].reset(0.0)
                if not left_ok:
                    print("[AVISO] mano IZQUIERDA no visible al calibrar; "
                          "el roll quedara sin referencia hasta que la muestres.")
                print(">>> CENTRO calibrado. Mueve la mano DERECHA por todo el "
                      f"volumen que quieras usar durante {RANGE_CAPTURE_SECONDS:.0f}s...")

            if cal_state == STATE_CAPTURING:
                if wrist_pos is not None and origin is not None:
                    d = wrist_pos - origin
                    for i, ax in enumerate(AXES):
                        range_min[ax] = min(range_min[ax], d[i])
                        range_max[ax] = max(range_max[ax], d[i])
                # si la izquierda aparece durante la captura, toma referencia
                if roll_origin is None and left_ok:
                    roll_origin = roll_raw
                if now - capture_start_t >= RANGE_CAPTURE_SECONDS:
                    for ax in AXES:
                        span = max(range_max[ax] - range_min[ax], 0.02)
                        scale[ax] = 1.0 / span
                    cal_state = STATE_ACTIVE
                    spans = [f"{ax}:{range_max[ax]-range_min[ax]:.3f}m" for ax in AXES]
                    print(f">>> RANGO capturado: {spans}")
                    print(">>> Teleoperacion ACTIVA. [P] para publicar.")

            # --- Calculo de comandos ---
            if cal_state == STATE_ACTIVE:
                # Posicion: mano derecha, mapeada por VELOCIDAD, no por
                # delta contra un origen fijo. Con delta-contra-origen el
                # robot recibe "muevete en esa direccion" mientras la mano
                # este desplazada del centro, sin importar si la mano esta
                # quieta -- se siente sin control, el robot no para hasta
                # chocar con un limite. Con velocidad de la mano: mano
                # quieta = robot quieto, la mano se mueve rapido = el
                # robot se mueve rapido, se detiene solo al detener la mano.
                if wrist_pos is not None and prev_wrist is not None:
                    d = (wrist_pos - prev_wrist) / dt      # velocidad, m/s
                    for i, ax in enumerate(AXES):
                        val = d[i]
                        if abs(val) < DEADZONE_VEL[ax]:
                            val = 0.0
                        u = SIGN_XYZ[ax] * AXIS_GAIN[ax] * val
                        u = float(np.clip(u, -MAX_UNITLESS, MAX_UNITLESS))
                        out_lin[ax] = filters[ax](u, dt)
                else:
                    for ax in AXES:
                        out_lin[ax] = filters[ax](0.0, dt)
                prev_wrist = wrist_pos if wrist_pos is not None else prev_wrist

                # Roll: mano izquierda. Si NO esta detectada o esta en escorzo,
                # comandamos roll CERO (no el ultimo valor): mantener un valor
                # viejo haria que el efector siguiera girando solo.
                if left_ok and roll_origin is not None:
                    dr = roll_raw - roll_origin
                    dr = math.atan2(math.sin(dr), math.cos(dr))  # normaliza a [-pi,pi]
                    if abs(dr) < DEADZONE_ROLL:
                        dr = 0.0
                    u = SIGN_ROLL * ROLL_GAIN * dr
                    u = float(np.clip(u, -MAX_UNITLESS, MAX_UNITLESS))
                    out_roll = filters['roll'](u, dt)
                else:
                    if roll_origin is None and left_ok:
                        roll_origin = roll_raw
                    out_roll = filters['roll'](0.0, dt)

                if not paused:
                    # El roll del efector de este brazo es Wrist_Roll, cuyo eje
                    # coincide con el eje longitudinal de la herramienta. En el
                    # frame base_link eso corresponde a angular.z; si al probar
                    # gira sobre el eje equivocado, mueve out_roll a angular.x
                    # o angular.y (y revisa que el eje liberado en DRIFT no sea
                    # justo el que estas comandando).
                    node.publish_twist(out_lin['x'], out_lin['y'], out_lin['z'],
                                       wx=0.0, wy=0.0, wz=out_roll)

            # --- Gripper: pinch de la mano DERECHA ---
            if right_hand is not None and not paused and cal_state == STATE_ACTIVE:
                hl = right_hand
                th = np.array([(1.0-hl[4].x)*w, hl[4].y*h])
                ix = np.array([(1.0-hl[8].x)*w, hl[8].y*h])
                wp = np.array([(1.0-hl[0].x)*w, hl[0].y*h])
                pinch = np.linalg.norm(th-ix)/(np.linalg.norm(wp-ix)+1e-5)
                lo, hi = GRIPPER_LIMITS
                tgt = float(np.interp(pinch, [0.20, 0.70], [lo, hi]))
                grip_cmd = ALPHA_GRIP*tgt + (1-ALPHA_GRIP)*grip_cmd
                node.send_gripper(grip_cmd)

            # --- Dibujo ---
            if pres.pose_landmarks:
                plm = pres.pose_landmarks.landmark
                P = lambda i: (int((1.0-plm[i].x)*w), int(plm[i].y*h))
                # brazo derecho (posicion) en verde/naranja
                cv2.line(disp, P(RIGHT_SHOULDER), P(RIGHT_ELBOW), (0,255,0), 4)
                cv2.line(disp, P(RIGHT_ELBOW), P(RIGHT_WRIST), (255,150,0), 4)
                # brazo izquierdo (roll) en morado
                cv2.line(disp, P(LEFT_SHOULDER), P(LEFT_ELBOW), (220,0,220), 3)
                cv2.line(disp, P(LEFT_ELBOW), P(LEFT_WRIST), (255,80,255), 3)
                for i, c in ((RIGHT_WRIST,(255,0,255)), (LEFT_WRIST,(255,120,255))):
                    cv2.circle(disp, P(i), 7, c, -1)

            for hl, col in ((right_hand, (0,220,255)), (left_hand, (255,0,220))):
                if hl is None:
                    continue
                HP = lambda i: (int((1.0-hl[i].x)*w), int(hl[i].y*h))
                cv2.line(disp, HP(0), HP(9), col, 3)
                for i in (0, 5, 9, 17):
                    cv2.circle(disp, HP(i), 5, (255,255,255), -1)

            # --- HUD ---
            cv2.putText(disp, "2 MANOS | DER=posicion  IZQ=roll", (12, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,255), 2)

            if cal_state == STATE_IDLE:
                st, sc = "PULSA [C] PARA CALIBRAR", (0,140,255)
            elif cal_state == STATE_CAPTURING:
                rem = RANGE_CAPTURE_SECONDS - (now - capture_start_t)
                st, sc = f"CAPTURANDO RANGO... ({rem:.1f}s)", (255,255,0)
            else:
                st = "PAUSA" if paused else "ACTIVO"
                sc = (0,200,255) if paused else (0,255,0)
            cv2.putText(disp, st, (12, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.55, sc, 2)

            for i, ax in enumerate(AXES):
                y = 84 + i*22
                cv2.putText(disp, f"{ax}: {out_lin[ax]:+.3f}  s={SIGN_XYZ[ax]:+d}  g={AXIS_GAIN[ax]:.2f}",
                            (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0,255,0), 1)

            ry = 84 + 3*22
            rcol = (0,255,0) if left_ok else (0,140,255)
            rtxt = f"roll: {out_roll:+.3f}  s={SIGN_ROLL:+d}  g={ROLL_GAIN:.2f}"
            if not left_ok:
                rtxt += "  [IZQ no visible -> roll=0]"
            cv2.putText(disp, rtxt, (12, ry), cv2.FONT_HERSHEY_SIMPLEX, 0.42, rcol, 1)

            gy = ry + 26
            gcol = (0,255,0) if node.grip_ready else (0,120,255)
            cv2.putText(disp, f"Gripper {grip_cmd:+.2f} " +
                        ("[OK]" if node.grip_ready else "[accion NO disp.]"),
                        (12, gy), cv2.FONT_HERSHEY_SIMPLEX, 0.42, gcol, 1)

            dtxt = f"DER:{'OK' if right_hand is not None else '--'}  IZQ:{'OK' if left_hand is not None else '--'}"
            dcol = (0,255,0) if (right_hand is not None and left_hand is not None) else (0,140,255)
            cv2.putText(disp, dtxt, (12, gy+21), cv2.FONT_HERSHEY_SIMPLEX, 0.42, dcol, 1)

            wl = "WORLD LM: OK" if wrist_pos is not None else "WORLD LM: NONE"
            wlc = (0,255,0) if wrist_pos is not None else (0,0,255)
            cv2.putText(disp, f"{wl}   {fps:4.1f} FPS", (12, gy+42),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, wlc, 1)

            cv2.putText(disp, "[C]calib [X/Y/Z]signo [R]roll [+/-]gan [S]guardar [P]pausa [Q]salir",
                        (12, h-12), cv2.FONT_HERSHEY_SIMPLEX, 0.34, (200,200,200), 1)

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
