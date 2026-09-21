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
# TELEOPERACION POR ZONAS via MediaPipe + MoveIt Servo
#
#   MANO DERECHA  -> zonas de posicion (X/Y/Z): fuera del centro en una
#                     direccion = velocidad CONSTANTE en esa direccion.
#                     De vuelta al centro = se detiene.
#   MANO IZQUIERDA-> zonas de rotacion (roll del efector), mismo principio.
#   PINCH derecho -> apertura del gripper.
#
# POR QUE ZONAS Y NO MAPEO CONTINUO
# Las dos versiones anteriores (delta-contra-origen y velocidad-de-mano)
# se sentian sin control: el ruido de tracking (especialmente en el eje de
# profundidad, que MediaPipe solo estima) se traducia directo en temblor o
# deriva del robot. Con zonas, el robot solo tiene 3 estados por eje
# (avanzando, quieto, retrocediendo) -- el ruido dentro de una zona no
# cambia el comando, solo importa cruzar el limite de la zona. Es el mismo
# principio que un joystick de grua industrial de palanca no proporcional.
#
# 5 DOF: seguimos liberando una dimension de rotacion via
# /servo_node/change_drift_dimensions para que el IK quede bien planteado
# (ver DRIFT mas abajo). Confirmado funcionando en la version anterior.
#
# LECCION APRENDIDA: el header.stamp de cada TwistStamped debe llevar el
# reloj actual del nodo (con use_sim_time). Timestamp en cero = descartado.
# ============================================================================

TWIST_TOPIC = '/servo_node/delta_twist_cmds'
GRIPPER_ACTION = '/gripper_controller/gripper_cmd'
START_SERVO_SRV = '/servo_node/start_servo'
DRIFT_SRV = '/servo_node/change_drift_dimensions'
CONFIG_FILE = os.path.expanduser('~/teleop_zones_config.json')

CAMERA_INDEX = 0
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FOURCC = 'MJPG'

# True = Servo IGNORA esa dimension al resolver IK (necesario con 5 DOF).
DRIFT = dict(x_translation=False, y_translation=False, z_translation=False,
             x_rotation=False,   y_rotation=True,     z_rotation=False)

AXES = ['x', 'y', 'z']

# --- Zonas de posicion (mano derecha) ---
ZONE_THRESHOLD = {'x': 0.06, 'y': 0.06, 'z': 0.09}
ZONE_SPEED = {'x': 0.35, 'y': 0.35, 'z': 0.22}

# --- Zonas de rotacion (mano izquierda: roll respecto al antebrazo) ---
ROLL_ZONE_THRESHOLD = 0.30     # radianes (~17 grados)
ROLL_ZONE_SPEED = 0.45

SIGN_XYZ = {'x': 1, 'y': 1, 'z': 1}
SIGN_ROLL = 1
GLOBAL_SPEED_STEP = 0.05

ONE_EURO = {
    'x':    dict(min_cutoff=1.5, beta=0.1),
    'y':    dict(min_cutoff=1.5, beta=0.1),
    'z':    dict(min_cutoff=1.5, beta=0.1),
    'roll': dict(min_cutoff=1.5, beta=0.1),
}

MIN_LEFT_HAND_LEN = 0.03
GRIPPER_LIMITS = (-0.17, 1.56)
GRIPPER_DEADZONE = 0.08
ALPHA_GRIP = 0.35

RIGHT_WRIST = 16
LEFT_WRIST = 15
LEFT_ELBOW = 13
RIGHT_SHOULDER, RIGHT_ELBOW = 12, 14
LEFT_SHOULDER = 11


class OneEuro:
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


def zone_command(delta, threshold, speed):
    if delta > threshold:
        return speed
    elif delta < -threshold:
        return -speed
    return 0.0


def signed_angle_2d(a, b):
    return math.atan2(a[0]*b[1] - a[1]*b[0], a[0]*b[0] + a[1]*b[1])


def left_hand_roll(plm, left_hand_lm):
    if left_hand_lm is None:
        return None
    p = lambda i: np.array([plm[i].x, plm[i].y])
    el2, wr2 = p(LEFT_ELBOW), p(LEFT_WRIST)
    fore2 = wr2 - el2
    hp = lambda i: np.array([left_hand_lm[i].x, left_hand_lm[i].y])
    hand2 = hp(9) - hp(0)
    if (np.linalg.norm(fore2) < MIN_LEFT_HAND_LEN or
            np.linalg.norm(hand2) < MIN_LEFT_HAND_LEN):
        return None
    return signed_angle_2d(fore2, hand2)


def pick_hands(hres):
    right_lm = left_lm = None
    if not hres.multi_hand_landmarks or not hres.multi_handedness:
        return None, None
    for lm, handed in zip(hres.multi_hand_landmarks, hres.multi_handedness):
        label = handed.classification[0].label
        if label == 'Right':
            right_lm = lm.landmark
        else:
            left_lm = lm.landmark
    return right_lm, left_lm


def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({'sign': SIGN_XYZ, 'sign_roll': SIGN_ROLL,
                       'speed': ZONE_SPEED, 'roll_speed': ROLL_ZONE_SPEED},
                      f, indent=2)
        print(f"[OK] guardado en {CONFIG_FILE}")
    except Exception as e:
        print(f"[ERROR] {e}")


def load_config():
    global SIGN_ROLL, ROLL_ZONE_SPEED
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE) as f:
                d = json.load(f)
            SIGN_XYZ.update(d.get('sign', {}))
            ZONE_SPEED.update(d.get('speed', {}))
            SIGN_ROLL = d.get('sign_roll', SIGN_ROLL)
            ROLL_ZONE_SPEED = d.get('roll_speed', ROLL_ZONE_SPEED)
            print("[OK] config cargada")
    except Exception as e:
        print(f"[AVISO] {e}")


class ZoneTeleopNode(Node):
    def __init__(self):
        super().__init__('so_arm100_teleop_zones')
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
            print("[AVISO] servicio start_servo no disponible.")

    def _try_set_drift(self):
        try:
            from moveit_msgs.srv import ChangeDriftDimensions
        except ImportError:
            print("[AVISO] ChangeDriftDimensions no disponible; se omite drift.")
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
        msg.header.stamp = self.get_clock().now().to_msg()
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
        if self.last_grip is not None and abs(pos - self.last_grip) < GRIPPER_DEADZONE:
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
    global SIGN_ROLL, ROLL_ZONE_SPEED
    load_config()
    rclpy.init(args=args)
    node = ZoneTeleopNode()

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
    hands = mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.5,
                           min_tracking_confidence=0.5)

    WIN = "SO-ARM100 Teleop por ZONAS (der=pos, izq=roll)"
    cv2.namedWindow(WIN, cv2.WINDOW_AUTOSIZE)

    filters = {k: OneEuro(**ONE_EURO[k]) for k in ONE_EURO}

    calibrated = False
    origin = None
    origin_px = None      # posicion en pantalla (pixeles, espejada) al calibrar
    roll_origin = None
    paused = True
    right_hand = left_hand = None
    grip_cmd = 0.0
    t_prev = time.time()
    fps = 0.0
    out_lin = {ax: 0.0 for ax in AXES}
    out_roll = 0.0
    zone_state = {ax: '0' for ax in AXES}
    roll_zone_state = '0'
    frame_i = 0
    HANDS_EVERY = 2

    print("\n" + "="*72)
    print("Teleop por ZONAS | DER=posicion  IZQ=roll  PINCH der=gripper")
    print("  [C]calibrar centro (una sola fase, sin captura de rango)")
    print("  [X/Y/Z]signo pos  [R]signo roll  [+/-]velocidad de zona")
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
                right_hand, left_hand = pick_hands(hres)

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
                    ZONE_SPEED[ax] = round(min(ZONE_SPEED[ax] + GLOBAL_SPEED_STEP, 1.0), 2)
                ROLL_ZONE_SPEED = round(min(ROLL_ZONE_SPEED + GLOBAL_SPEED_STEP, 1.0), 2)
                print(f"ZONE_SPEED -> {ZONE_SPEED}  roll={ROLL_ZONE_SPEED:.2f}")
            if key in (ord('-'), ord('_')):
                for ax in AXES:
                    ZONE_SPEED[ax] = round(max(ZONE_SPEED[ax] - GLOBAL_SPEED_STEP, 0.05), 2)
                ROLL_ZONE_SPEED = round(max(ROLL_ZONE_SPEED - GLOBAL_SPEED_STEP, 0.05), 2)
                print(f"ZONE_SPEED -> {ZONE_SPEED}  roll={ROLL_ZONE_SPEED:.2f}")

            wrist_pos = None
            if pres.pose_world_landmarks:
                wlm = pres.pose_world_landmarks.landmark
                wrist_pos = np.array([wlm[RIGHT_WRIST].x,
                                      wlm[RIGHT_WRIST].y,
                                      wlm[RIGHT_WRIST].z])

            roll_raw = None
            if pres.pose_landmarks:
                roll_raw = left_hand_roll(pres.pose_landmarks.landmark, left_hand)
            left_ok = roll_raw is not None

            if want_cal and wrist_pos is not None:
                origin = wrist_pos.copy()
                roll_origin = roll_raw if left_ok else None
                calibrated = True
                for k in filters:
                    filters[k].reset(0.0)
                if not left_ok:
                    print("[AVISO] mano IZQUIERDA no visible al calibrar; "
                          "el roll tomara referencia en cuanto aparezca.")
                print(">>> CENTRO calibrado. Teleoperacion lista. [P] para activar.")

            if calibrated:
                if wrist_pos is not None and origin is not None:
                    d = wrist_pos - origin
                    for i, ax in enumerate(AXES):
                        raw_signed = SIGN_XYZ[ax] * d[i]
                        cmd = zone_command(raw_signed, ZONE_THRESHOLD[ax], ZONE_SPEED[ax])
                        zone_state[ax] = '+' if cmd > 0 else ('-' if cmd < 0 else '0')
                        out_lin[ax] = filters[ax](cmd, dt)
                else:
                    for ax in AXES:
                        zone_state[ax] = '0'
                        out_lin[ax] = filters[ax](0.0, dt)

                if left_ok:
                    if roll_origin is None:
                        roll_origin = roll_raw
                    dr = roll_raw - roll_origin
                    dr = math.atan2(math.sin(dr), math.cos(dr))
                    raw_signed = SIGN_ROLL * dr
                    cmd = zone_command(raw_signed, ROLL_ZONE_THRESHOLD, ROLL_ZONE_SPEED)
                    roll_zone_state = '+' if cmd > 0 else ('-' if cmd < 0 else '0')
                    out_roll = filters['roll'](cmd, dt)
                else:
                    roll_zone_state = '0'
                    out_roll = filters['roll'](0.0, dt)

                if not paused:
                    node.publish_twist(out_lin['x'], out_lin['y'], out_lin['z'],
                                       wx=0.0, wy=0.0, wz=out_roll)

            if right_hand is not None and not paused and calibrated:
                hl = right_hand
                th = np.array([(1.0-hl[4].x)*w, hl[4].y*h])
                ix = np.array([(1.0-hl[8].x)*w, hl[8].y*h])
                wp = np.array([(1.0-hl[0].x)*w, hl[0].y*h])
                pinch = np.linalg.norm(th-ix)/(np.linalg.norm(wp-ix)+1e-5)
                lo, hi = GRIPPER_LIMITS
                tgt = float(np.interp(pinch, [0.20, 0.70], [lo, hi]))
                grip_cmd = ALPHA_GRIP*tgt + (1-ALPHA_GRIP)*grip_cmd
                node.send_gripper(grip_cmd)

            if pres.pose_landmarks:
                plm = pres.pose_landmarks.landmark
                P = lambda i: (int((1.0-plm[i].x)*w), int(plm[i].y*h))
                cv2.line(disp, P(RIGHT_SHOULDER), P(RIGHT_ELBOW), (0,255,0), 4)
                cv2.line(disp, P(RIGHT_ELBOW), P(RIGHT_WRIST), (255,150,0), 4)
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

            cv2.putText(disp, "ZONAS | DER=posicion  IZQ=roll", (12, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,255), 2)

            if not calibrated:
                st, sc = "PULSA [C] PARA CALIBRAR", (0,140,255)
            else:
                st = "PAUSA" if paused else "ACTIVO"
                sc = (0,200,255) if paused else (0,255,0)
            cv2.putText(disp, st, (12, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.55, sc, 2)

            zone_col = {'0': (150,150,150), '+': (0,255,0), '-': (0,140,255)}
            for i, ax in enumerate(AXES):
                y = 84 + i*22
                zs = zone_state[ax]
                cv2.putText(disp, f"{ax}: [{zs}]  v={out_lin[ax]:+.2f}  s={SIGN_XYZ[ax]:+d}  speed={ZONE_SPEED[ax]:.2f}",
                            (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, zone_col[zs], 1)

            ry = 84 + 3*22
            rcol = zone_col[roll_zone_state] if left_ok else (0,140,255)
            rtxt = f"roll: [{roll_zone_state}]  v={out_roll:+.2f}  s={SIGN_ROLL:+d}  speed={ROLL_ZONE_SPEED:.2f}"
            if not left_ok:
                rtxt += "  [IZQ no visible]"
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

            cv2.putText(disp, "[C]calib [X/Y/Z]signo [R]roll [+/-]velocidad [S]guardar [P]pausa [Q]salir",
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
