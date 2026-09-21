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
# TELEOPERACION CARTESIANA via MediaPipe + MoveIt Servo
#
# A diferencia del script joint-space (v13), este NO copia angulos
# articulares. En vez de eso: trackea la posicion 3D de tu muneca, calcula
# un delta respecto a tu pose calibrada, lo escala/filtra, y lo publica
# como velocidad cartesiana (TwistStamped) a MoveIt Servo, que resuelve
# la cinematica inversa en tiempo real. El efector del robot sigue tu
# mano en el espacio, sin importar las proporciones de tu brazo.
#
# LECCION APRENDIDA (confirmada en pruebas): el header.stamp de cada
# mensaje TwistStamped DEBE llevar el reloj actual del nodo (respetando
# use_sim_time). Un timestamp en cero es descartado en silencio por Servo
# al compararlo contra el reloj de Gazebo, que ya va adelantado.
# ============================================================================

TWIST_TOPIC = '/servo_node/delta_twist_cmds'
GRIPPER_ACTION = '/gripper_controller/gripper_cmd'
START_SERVO_SRV = '/servo_node/start_servo'
CONFIG_FILE = os.path.expanduser('~/teleop_cartesian_config.json')

# --- Fix de camara para WSL2 (confirmado funcionando) ---
CAMERA_INDEX = 0
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FOURCC = 'MJPG'

# --- Ejes cartesianos: nombres logicos del robot ---
AXES = ['x', 'y', 'z']

# Signo por eje (invertible en vivo con teclas X/Y/Z). Si al mover la mano
# el efector va al reves de lo esperado en algun eje, invierte aqui.
SIGN_XYZ = {'x': 1, 'y': 1, 'z': 1}

# Rango objetivo del robot por eje, en metros (la mitad hacia cada lado).
# z mas conservador porque depende de la profundidad estimada de MediaPipe,
# que es menos confiable que x/y.
TARGET_RANGE = {'x': 0.10, 'y': 0.10, 'z': 0.05}

# Ganancia relativa adicional por eje (multiplica el resultado ya escalado).
# z queda mas amortiguado a proposito. Valores mas altos que 1.0 son
# intencionales: la normalizacion por rango capturado solo llega a
# unitless=1.0 en el EXTREMO del volumen que moviste durante la captura,
# y en uso normal mueves la mano con desplazamientos mas moderados desde
# el centro -- esta ganancia compensa eso. Ajustable en vivo con [+]/[-].
AXIS_GAIN = {'x': 2.5, 'y': 2.5, 'z': 1.5}
GLOBAL_GAIN_STEP = 0.25

# Filtro One Euro por eje cartesiano. z con min_cutoff mas bajo = mas
# suavizado en reposo (menos temblor por ruido de profundidad).
ONE_EURO = {
    'x': dict(min_cutoff=1.0, beta=0.05),
    'y': dict(min_cutoff=1.0, beta=0.05),
    'z': dict(min_cutoff=0.5, beta=0.03),
}

DEADZONE_M = {'x': 0.004, 'y': 0.004, 'z': 0.006}  # metros, antes de considerar movimiento real

MAX_LINEAR_UNITLESS = 1.0   # Servo espera [-1, 1] en modo "unitless"
RANGE_CAPTURE_SECONDS = 5.0

GRIPPER_LIMITS = (-0.17, 1.56)
ALPHA_GRIP = 0.35

LM = {
    'right': dict(sh=12, el=14, wr=16, osh=11, hip=24, ohip=23),
    'left':  dict(sh=11, el=13, wr=15, osh=12, hip=23, ohip=24),
}


# ------------------------------------------------------------ One Euro filter
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


def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({'sign': SIGN_XYZ}, f, indent=2)
        print(f"[OK] guardado en {CONFIG_FILE}")
    except Exception as e:
        print(f"[ERROR] {e}")


def load_config():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE) as f:
                d = json.load(f)
            SIGN_XYZ.update(d.get('sign', {}))
            print("[OK] config cargada")
    except Exception as e:
        print(f"[AVISO] {e}")


class CartesianTeleopNode(Node):
    def __init__(self):
        super().__init__('so_arm100_teleop_cartesian')
        self.twist_pub = self.create_publisher(TwistStamped, TWIST_TOPIC, 10)
        self.grip_client = ActionClient(self, GripperCommand, GRIPPER_ACTION)
        self.grip_ready = False
        self.grip_busy = False
        self.last_grip = None

        # Activa Servo automaticamente al arrancar (equivalente a llamar
        # start_servo a mano, como hicimos en la prueba manual).
        self.start_servo_client = self.create_client(Trigger, START_SERVO_SRV)
        self._try_start_servo()

    def _try_start_servo(self):
        if self.start_servo_client.wait_for_service(timeout_sec=2.0):
            future = self.start_servo_client.call_async(Trigger.Request())
            rclpy.spin_until_future_complete(self, future, timeout_sec=2.0)
            if future.done() and future.result() is not None:
                print(f"[OK] start_servo -> success={future.result().success}")
            else:
                print("[AVISO] start_servo no respondio a tiempo, "
                      "llamalo manualmente: ros2 service call /servo_node/start_servo std_srvs/srv/Trigger {}")
        else:
            print("[AVISO] servicio start_servo no disponible. "
                  "Verifica que servo.launch.py este corriendo.")

    def check_gripper(self):
        if not self.grip_ready:
            self.grip_ready = self.grip_client.wait_for_server(timeout_sec=0.0)
        return self.grip_ready

    def publish_twist(self, vx, vy, vz, frame_id='base_link'):
        msg = TwistStamped()
        msg.header.stamp = self.get_clock().now().to_msg()  # timestamp real, ver nota arriba
        msg.header.frame_id = frame_id
        msg.twist.linear.x = float(vx)
        msg.twist.linear.y = float(vy)
        msg.twist.linear.z = float(vz)
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
    load_config()
    rclpy.init(args=args)
    node = CartesianTeleopNode()

    # --- Camara (fix WSL2 confirmado) ---
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
    hands = mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.5,
                            min_tracking_confidence=0.5)

    WIN = "SO-ARM100 Teleop Cartesiano (MoveIt Servo)"
    cv2.namedWindow(WIN, cv2.WINDOW_AUTOSIZE)

    filters = {ax: OneEuro(**ONE_EURO[ax]) for ax in AXES}

    # --- Estado de calibracion ---
    STATE_IDLE = 0
    STATE_CAPTURING_RANGE = 1
    STATE_ACTIVE = 2
    cal_state = STATE_IDLE

    origin = None            # posicion de muneca en el momento de calibrar (centro neutro)
    range_min = None         # dict eje -> minimo visto durante captura
    range_max = None         # dict eje -> maximo visto durante captura
    scale = {ax: 1.0 for ax in AXES}   # factor: unidad_mano -> unitless [-1,1]
    capture_start_t = None

    arm_side = 'right'
    paused = True   # arranca en pausa por seguridad; el usuario activa con P
    hand_cache = None
    hand_seen = False
    grip_cmd = 0.0
    t_prev = time.time()
    fps = 0.0
    delta_filtered = {ax: 0.0 for ax in AXES}
    frame_i = 0
    HANDS_EVERY = 2

    print("\n" + "="*72)
    print("Teleop CARTESIANO | [C]calibrar centro -> captura de rango (5s)")
    print("  [X/Y/Z] invertir signo de eje   [+/-] ganancia global   [B]brazo")
    print("  [S]guardar   [P]pausa/activar   [Q]salir")
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
                print(f"--- {'PAUSADO' if paused else 'ACTIVO'} ---")
            if key in (ord('b'), ord('B')):
                arm_side = 'left' if arm_side == 'right' else 'right'
                cal_state = STATE_IDLE
                origin = None
                print(f"--- BRAZO {arm_side.upper()} (recalibra con [C]) ---")
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
            if key in (ord('+'), ord('=')):
                for ax in AXES:
                    AXIS_GAIN[ax] = round(min(AXIS_GAIN[ax] + GLOBAL_GAIN_STEP, 6.0), 2)
                print(f"AXIS_GAIN -> {AXIS_GAIN}")
            if key in (ord('-'), ord('_')):
                for ax in AXES:
                    AXIS_GAIN[ax] = round(max(AXIS_GAIN[ax] - GLOBAL_GAIN_STEP, 0.1), 2)
                print(f"AXIS_GAIN -> {AXIS_GAIN}")

            ids = LM[arm_side]

            wrist_pos = None
            if pres.pose_world_landmarks:
                wlm = pres.pose_world_landmarks.landmark
                wi = ids['wr']
                wrist_pos = np.array([wlm[wi].x, wlm[wi].y, wlm[wi].z])

            # --- Maquina de calibracion ---
            if want_cal and wrist_pos is not None:
                origin = wrist_pos.copy()
                range_min = {ax: 0.0 for ax in AXES}
                range_max = {ax: 0.0 for ax in AXES}
                cal_state = STATE_CAPTURING_RANGE
                capture_start_t = now
                for ax in AXES:
                    filters[ax].reset(0.0)
                print(">>> CENTRO calibrado. Mueve la mano por todo el volumen "
                      f"que quieras usar durante {RANGE_CAPTURE_SECONDS:.0f}s...")

            if cal_state == STATE_CAPTURING_RANGE:
                if wrist_pos is not None and origin is not None:
                    d = wrist_pos - origin  # [dx_cam, dy_cam, dz_cam]
                    for i, ax in enumerate(AXES):
                        range_min[ax] = min(range_min[ax], d[i])
                        range_max[ax] = max(range_max[ax], d[i])
                if now - capture_start_t >= RANGE_CAPTURE_SECONDS:
                    for ax in AXES:
                        span = max(range_max[ax] - range_min[ax], 0.02)  # evita div/0
                        scale[ax] = 1.0 / span   # normaliza el rango capturado a [-1,1] aprox
                    cal_state = STATE_ACTIVE
                    print(f">>> RANGO capturado: {[f'{ax}:{range_max[ax]-range_min[ax]:.3f}m' for ax in AXES]}")
                    print(">>> Teleoperacion cartesiana ACTIVA. [P] para pausar.")

            # --- Calculo del delta y publicacion ---
            vx = vy = vz = 0.0
            if cal_state == STATE_ACTIVE and wrist_pos is not None and origin is not None:
                d = wrist_pos - origin
                out = {}
                for i, ax in enumerate(AXES):
                    val = d[i]
                    if abs(val) < DEADZONE_M[ax]:
                        val = 0.0
                    # normaliza a [-1,1] segun el rango capturado, aplica signo y ganancia
                    unitless = SIGN_XYZ[ax] * AXIS_GAIN[ax] * scale[ax] * val
                    unitless = float(np.clip(unitless, -MAX_LINEAR_UNITLESS, MAX_LINEAR_UNITLESS))
                    smoothed = filters[ax](unitless, dt)
                    out[ax] = smoothed
                delta_filtered = out
                vx, vy, vz = out['x'], out['y'], out['z']

                if not paused:
                    node.publish_twist(vx, vy, vz)

            # --- Gripper (igual que el script original) ---
            if hand_cache is not None:
                hl = hand_cache
                if not paused and cal_state == STATE_ACTIVE:
                    th = np.array([(1.0-hl[4].x)*w, hl[4].y*h])
                    ix = np.array([(1.0-hl[8].x)*w, hl[8].y*h])
                    wp = np.array([(1.0-hl[0].x)*w, hl[0].y*h])
                    pinch = np.linalg.norm(th-ix)/(np.linalg.norm(wp-ix)+1e-5)
                    lo, hi = GRIPPER_LIMITS
                    tgt = float(np.interp(pinch, [0.20, 0.70], [lo, hi]))
                    grip_cmd = ALPHA_GRIP*tgt + (1-ALPHA_GRIP)*grip_cmd
                    node.send_gripper(grip_cmd)

            # --- Dibujo (esqueleto simplificado) ---
            if pres.pose_landmarks:
                plm = pres.pose_landmarks.landmark
                P = lambda i: (int((1.0-plm[i].x)*w), int(plm[i].y*h))
                cv2.line(disp, P(ids['sh']), P(ids['el']), (0,255,0), 4)
                cv2.line(disp, P(ids['el']), P(ids['wr']), (255,150,0), 4)
                for i, c in ((ids['sh'],(0,0,255)), (ids['el'],(0,255,255)),
                             (ids['wr'],(255,0,255))):
                    cv2.circle(disp, P(i), 7, c, -1)

            if hand_cache is not None:
                hl = hand_cache
                HP = lambda i: (int((1.0-hl[i].x)*w), int(hl[i].y*h))
                cv2.line(disp, HP(0), HP(9), (0,220,255), 3)
                for i in (0, 5, 9, 17):
                    cv2.circle(disp, HP(i), 5, (255,255,255), -1)

            # --- HUD ---
            cv2.putText(disp, f"CARTESIANO | {arm_side.upper()}", (12, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,255), 2)

            if cal_state == STATE_IDLE:
                state_txt = "PULSA [C] PARA CALIBRAR"
                state_col = (0, 140, 255)
            elif cal_state == STATE_CAPTURING_RANGE:
                remaining = RANGE_CAPTURE_SECONDS - (now - capture_start_t)
                state_txt = f"CAPTURANDO RANGO... mueve la mano ({remaining:.1f}s)"
                state_col = (255, 255, 0)
            else:  # STATE_ACTIVE
                state_txt = "PAUSA" if paused else "ACTIVO"
                state_col = (0, 200, 255) if paused else (0, 255, 0)
            cv2.putText(disp, state_txt, (12, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.55, state_col, 2)

            for i, ax in enumerate(AXES):
                y = 84 + i*24
                cv2.putText(disp, f"{ax}: {delta_filtered[ax]:+.3f}  sign={SIGN_XYZ[ax]:+d}  gain={AXIS_GAIN[ax]:.2f}",
                            (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0,255,0), 1)

            gy = 84 + 3*24 + 10
            gcol = (0,255,0) if node.grip_ready else (0,120,255)
            cv2.putText(disp, f"Gripper {grip_cmd:+.2f} " +
                        ("[OK]" if node.grip_ready else "[accion NO disp.]"),
                        (12, gy), cv2.FONT_HERSHEY_SIMPLEX, 0.42, gcol, 1)
            hand_txt = "MANO DETECTADA" if hand_seen else "MANO NO DETECTADA"
            hcol = (0,255,0) if hand_seen else (0,0,255)
            cv2.putText(disp, hand_txt, (12, gy+21), cv2.FONT_HERSHEY_SIMPLEX, 0.42, hcol, 1)
            wl_txt = "WORLD LANDMARKS: OK" if wrist_pos is not None else "WORLD LANDMARKS: NONE (por eso no se mueve)"
            wl_col = (0,255,0) if wrist_pos is not None else (0,0,255)
            cv2.putText(disp, wl_txt, (12, gy+42), cv2.FONT_HERSHEY_SIMPLEX, 0.42, wl_col, 1)
            cv2.putText(disp, f"{fps:4.1f} FPS", (12, gy+63),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (190,190,190), 1)

            cv2.putText(disp, "[C]calib [X/Y/Z]signo [+/-]gan [B]brazo [S]guardar [P]pausa [Q]salir",
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
