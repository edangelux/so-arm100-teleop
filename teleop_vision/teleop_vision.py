#!/usr/bin/env python3
"""
Teleoperación por visión del manipulador SO-ARM100.

Captura la postura del brazo derecho del operador con MediaPipe Pose, la
convierte a una posición cartesiana objetivo del efector final y resuelve la
cinemática inversa en espacio de tarea para publicar los ángulos articulares
al controlador de trayectorias de ROS 2. La apertura de la pinza se controla
con el gesto de pellizco detectado por MediaPipe Hands.

Uso básico:
    python3 teleop_vision.py

Con parámetros:
    python3 teleop_vision.py --ros-args -p camera_index:=1 -p smoothing:=0.25

Controles:
    C o ESPACIO   calibrar el cero (fija tu postura actual como referencia)
    Q o ESC       salir

Proyecto de tesis — Ingeniería Mecatrónica, ULSA Nicaragua.
Licencia MIT.
"""

import sys

import numpy as np
import rclpy
from builtin_interfaces.msg import Duration, Time
from rclpy.node import Node
from std_msgs.msg import Header
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

try:
    import cv2
    import mediapipe as mp
except ImportError as exc:  # pragma: no cover
    print(f"\nFalta una dependencia de visión: {exc}")
    print("Instálala con:  ~/so-arm100-teleop/scripts/03_vision_python.sh")
    print("Detalles en:    docs/06-solucion-de-problemas.md\n")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuración del robot
# ---------------------------------------------------------------------------

# Nombres de las articulaciones tal como aparecen en el URDF del SO-ARM100
# (so_arm_100_description/urdf/so_arm_100_5dof.urdf.xacro). El orden importa:
# debe coincidir con el que espera el controlador de trayectorias.
ARM_JOINTS = [
    "Shoulder_Rotation",
    "Shoulder_Pitch",
    "Elbow",
    "Wrist_Pitch",
    "Wrist_Roll",
]

# Longitudes cinemáticas reales del SO-ARM100, en metros.
L1 = 0.1160   # hombro → codo
L2 = 0.1350   # codo → muñeca

# Alcance máximo del brazo: L1 + L2 = 0.251 m. Todo lo que se comande más
# lejos que eso es físicamente imposible y la IK lo recorta al borde.
ALCANCE_MAX = L1 + L2

# Posición Home del efector en el espacio cartesiano de la base, en metros.
X_HOME = 0.14
Y_HOME = 0.00
Z_HOME = 0.06

# Límites del espacio de trabajo, en metros.
#
# Estos valores están ajustados al alcance real del brazo: el 97 % de los
# puntos de esta caja son alcanzables. Con la caja original más amplia
# (X hasta 0.28, Y ±0.20, Z hasta 0.25) más de la mitad de los puntos caían
# fuera de la esfera de alcance, la IK los recortaba al borde y el aviso de
# singularidad quedaba encendido casi todo el tiempo: el brazo se sentía
# "pegado" al límite en lugar de seguir la mano.
#
# Si prefieres el comportamiento anterior, pásalos como parámetros:
#   --ros-args -p x_min:=0.08 -p x_max:=0.28 -p y_abs:=0.20 -p z_min:=-0.10 -p z_max:=0.25
X_LIMITES = (0.07, 0.20)
Y_LIMITES = (-0.13, 0.13)
Z_LIMITES = (-0.05, 0.16)

# Margen (fracción del alcance) dentro del cual se avisa de singularidad.
MARGEN_SINGULARIDAD = 0.05

# Postura inicial del brazo antes de calibrar, en radianes.
POSTURA_INICIAL = [0.0, -0.70, 0.70, 0.0, 0.0]

# Índices de los landmarks de MediaPipe Pose que se usan.
LM_HOMBRO_DER = 12
LM_CODO_DER = 14
LM_MUNECA_DER = 16

VENTANA = "Teleoperacion SO-ARM100 (IK 3D)"


# ---------------------------------------------------------------------------
# Cinemática inversa
# ---------------------------------------------------------------------------

def resolver_ik_3d(x, y, z):
    """Resuelve la cinemática inversa de los tres primeros grados de libertad.

    Devuelve (q_base, q_hombro, q_codo, cerca_de_singularidad).

    El objetivo se recorta automáticamente al alcance válido del brazo: si el
    punto pedido queda fuera de la esfera alcanzable, se proyecta al borde en
    lugar de devolver un resultado inválido.
    """
    q_base = np.arctan2(y, x)

    r = np.sqrt(x ** 2 + y ** 2)
    d = np.sqrt(r ** 2 + z ** 2)

    d_max = (L1 + L2) * 0.98          # nunca extender del todo: evita la singularidad
    d_min = abs(L1 - L2) * 1.05       # ni plegar del todo sobre la base

    cerca_singularidad = (
        d > d_max * (1 - MARGEN_SINGULARIDAD)
        or d < d_min * (1 + MARGEN_SINGULARIDAD)
    )

    if d > d_max:
        r = r * (d_max / d)
        z = z * (d_max / d)
    elif d < d_min:
        if d > 1e-6:
            r = r * (d_min / d)
            z = z * (d_min / d)
        else:
            r = d_min
            z = 0.0

    d_sq = r ** 2 + z ** 2

    cos_codo = np.clip((d_sq - L1 ** 2 - L2 ** 2) / (2 * L1 * L2), -1.0, 1.0)
    q_codo_geom = np.arccos(cos_codo)
    q_codo = -(np.pi - q_codo_geom)

    alpha = np.arctan2(z, r)
    beta = np.arctan2(L2 * np.sin(q_codo_geom), L1 + L2 * np.cos(q_codo_geom))
    q_hombro_geom = alpha + beta
    q_hombro = -(q_hombro_geom - (np.pi / 2))

    return float(q_base), float(q_hombro), float(q_codo), bool(cerca_singularidad)


# ---------------------------------------------------------------------------
# Nodo de ROS 2
# ---------------------------------------------------------------------------

class NodoTeleoperacion(Node):
    """Publica trayectorias articulares al brazo y a la pinza."""

    def __init__(self):
        super().__init__("teleop_vision_node")

        # Parámetros ajustables sin editar el archivo:
        #   python3 teleop_vision.py --ros-args -p smoothing:=0.25
        self.declare_parameter("camera_index", 0)
        self.declare_parameter("camera_width", 640)
        self.declare_parameter("camera_height", 480)
        self.declare_parameter("smoothing", 0.35)
        self.declare_parameter("max_joint_step", 0.08)
        self.declare_parameter("scale", 0.40)
        self.declare_parameter("arm_topic", "/arm_controller/joint_trajectory")
        self.declare_parameter("gripper_topic", "/gripper_controller/joint_trajectory")
        self.declare_parameter("gripper_joint", "Gripper")
        self.declare_parameter("gripper_open", 0.0)
        self.declare_parameter("gripper_closed", 0.8)

        # Límites del espacio de trabajo (ver la nota junto a X_LIMITES arriba).
        self.declare_parameter("x_min", X_LIMITES[0])
        self.declare_parameter("x_max", X_LIMITES[1])
        self.declare_parameter("y_abs", Y_LIMITES[1])
        self.declare_parameter("z_min", Z_LIMITES[0])
        self.declare_parameter("z_max", Z_LIMITES[1])

        p = self.get_parameter
        self.camera_index = p("camera_index").value
        self.camera_width = p("camera_width").value
        self.camera_height = p("camera_height").value
        self.smoothing = float(p("smoothing").value)
        self.max_joint_step = float(p("max_joint_step").value)
        self.scale = float(p("scale").value)
        self.arm_topic = p("arm_topic").value
        self.gripper_topic = p("gripper_topic").value
        self.gripper_joint = p("gripper_joint").value
        self.gripper_open = float(p("gripper_open").value)
        self.gripper_closed = float(p("gripper_closed").value)

        self.x_limites = (float(p("x_min").value), float(p("x_max").value))
        y_abs = abs(float(p("y_abs").value))
        self.y_limites = (-y_abs, y_abs)
        self.z_limites = (float(p("z_min").value), float(p("z_max").value))

        self.arm_pub = self.create_publisher(JointTrajectory, self.arm_topic, 10)
        self.gripper_pub = self.create_publisher(JointTrajectory, self.gripper_topic, 10)

        # Se imprime al arrancar para detectar de inmediato un tópico mal
        # apuntado: si el nombre no coincide con el del controlador, los
        # mensajes se pierden en silencio y el robot no se mueve sin dar error.
        self.get_logger().info(f"Publicando brazo  → {self.arm_topic}")
        self.get_logger().info(f"Publicando pinza  → {self.gripper_topic}  (joint '{self.gripper_joint}')")
        self.get_logger().info(
            "Si el robot no se mueve, comprueba que esos tópicos existan:  "
            "ros2 topic list | grep joint_trajectory"
        )

    def _mensaje(self, nombres, posiciones):
        msg = JointTrajectory()
        msg.header = Header()
        # stamp en cero = "ejecutar desde ahora mismo"
        msg.header.stamp = Time(sec=0, nanosec=0)
        msg.joint_names = nombres

        punto = JointTrajectoryPoint()
        punto.positions = [float(v) for v in posiciones]
        punto.time_from_start = Duration(sec=0, nanosec=40_000_000)  # 40 ms ≈ 25 Hz
        msg.points = [punto]
        return msg

    def publicar_brazo(self, posiciones):
        self.arm_pub.publish(self._mensaje(ARM_JOINTS, posiciones))

    def publicar_pinza(self, posicion):
        self.gripper_pub.publish(self._mensaje([self.gripper_joint], [posicion]))


# ---------------------------------------------------------------------------
# Bucle principal
# ---------------------------------------------------------------------------

def main(args=None):
    rclpy.init(args=args)
    nodo = NodoTeleoperacion()

    cap = cv2.VideoCapture(nodo.camera_index)
    if not cap.isOpened():
        nodo.get_logger().error(
            f"No se pudo abrir la cámara (índice {nodo.camera_index}).\n"
            "  · En VirtualBox: menú Dispositivos → Webcams → selecciona tu cámara\n"
            "  · Comprueba que exista:  ls -l /dev/video*\n"
            "  · Prueba otro índice:  --ros-args -p camera_index:=1\n"
            "  · Ver docs/06-solucion-de-problemas.md"
        )
        nodo.destroy_node()
        rclpy.shutdown()
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, nodo.camera_width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, nodo.camera_height)

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        model_complexity=0,
        smooth_landmarks=True,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        max_num_hands=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    )

    cv2.namedWindow(VENTANA, cv2.WINDOW_AUTOSIZE)

    brazo_filtrado = list(POSTURA_INICIAL)
    pinza_filtrada = 0.0

    ref_x = ref_y = ref_z = None
    calibrado = False
    singularidad = False

    nodo.get_logger().info("Listo. Presiona 'C' o ESPACIO en la ventana de video para calibrar el cero.")

    try:
        while rclpy.ok() and cap.isOpened():
            leido, frame = cap.read()
            if not leido:
                nodo.get_logger().warn("No se pudo leer un fotograma de la cámara.")
                break

            alto, ancho, _ = frame.shape
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res_pose = pose.process(rgb)
            res_hands = hands.process(rgb)

            display = cv2.flip(frame, 1)   # efecto espejo: más intuitivo para el operador

            brazo_crudo = list(brazo_filtrado)
            pinza_cruda = pinza_filtrada
            siguiendo = False

            tecla = cv2.waitKey(1) & 0xFF
            quiere_calibrar = tecla in (ord("c"), ord("C"), 32)
            if tecla in (ord("q"), ord("Q"), 27):
                break

            objetivo_x, objetivo_y, objetivo_z = X_HOME, Y_HOME, Z_HOME

            # ---- Pose corporal → posición cartesiana del efector -----------
            if res_pose.pose_landmarks:
                lm = res_pose.pose_landmarks.landmark

                # Coordenadas normalizadas, con el eje X ya invertido para que
                # coincidan con la imagen en espejo que ve el operador.
                hombro_x = 1.0 - lm[LM_HOMBRO_DER].x
                hombro_y = 1.0 - lm[LM_HOMBRO_DER].y
                hombro_z = lm[LM_HOMBRO_DER].z
                muneca_x = 1.0 - lm[LM_MUNECA_DER].x
                muneca_y = 1.0 - lm[LM_MUNECA_DER].y
                muneca_z = lm[LM_MUNECA_DER].z

                # Vector hombro → muñeca: independiente de dónde esté sentado
                # el operador dentro del encuadre.
                usuario_dx = muneca_x - hombro_x
                usuario_dy = muneca_y - hombro_y
                usuario_dz = hombro_z - muneca_z

                if not calibrado or quiere_calibrar:
                    ref_x, ref_y, ref_z = usuario_dx, usuario_dy, usuario_dz
                    calibrado = True
                    nodo.get_logger().info("Cero calibrado.")

                if calibrado:
                    delta_x = (usuario_dz - ref_z) * nodo.scale
                    delta_y = (usuario_dx - ref_x) * nodo.scale
                    delta_z = (ref_y - usuario_dy) * nodo.scale

                    objetivo_x = float(np.clip(X_HOME + delta_x, *nodo.x_limites))
                    objetivo_y = float(np.clip(Y_HOME + delta_y, *nodo.y_limites))
                    objetivo_z = float(np.clip(Z_HOME + delta_z, *nodo.z_limites))

                    q_base, q_hombro, q_codo, singularidad = resolver_ik_3d(
                        objetivo_x, objetivo_y, objetivo_z
                    )

                    # La muñeca compensa el hombro y el codo para mantener la
                    # pinza aproximadamente horizontal.
                    q_muneca_pitch = float(np.clip(-q_hombro - q_codo, -1.5, 1.5))
                    q_muneca_roll = 0.0

                    brazo_crudo = [q_base, q_hombro, q_codo, q_muneca_pitch, q_muneca_roll]
                    siguiendo = True

                # Esqueleto sobre el video
                p_hombro = (int((1.0 - lm[LM_HOMBRO_DER].x) * ancho), int(lm[LM_HOMBRO_DER].y * alto))
                p_codo = (int((1.0 - lm[LM_CODO_DER].x) * ancho), int(lm[LM_CODO_DER].y * alto))
                p_muneca = (int((1.0 - lm[LM_MUNECA_DER].x) * ancho), int(lm[LM_MUNECA_DER].y * alto))
                cv2.line(display, p_hombro, p_codo, (0, 255, 0), 4)
                cv2.line(display, p_codo, p_muneca, (255, 150, 0), 4)

            # ---- Gesto de pellizco → apertura de la pinza -------------------
            if res_hands.multi_hand_landmarks:
                hlm = res_hands.multi_hand_landmarks[0].landmark
                pulgar = np.array([(1.0 - hlm[4].x) * ancho, hlm[4].y * alto])
                indice = np.array([(1.0 - hlm[8].x) * ancho, hlm[8].y * alto])
                base_mano = np.array([(1.0 - hlm[0].x) * ancho, hlm[0].y * alto])

                # Se normaliza por el tamaño de la palma para que la distancia
                # a la cámara no afecte la lectura del gesto.
                tam_palma = np.linalg.norm(base_mano - indice) + 1e-5
                dist_pellizco = np.linalg.norm(pulgar - indice) / tam_palma

                pinza_cruda = float(
                    np.interp(dist_pellizco, [0.25, 0.65], [nodo.gripper_closed, nodo.gripper_open])
                )

            # ---- Filtrado y limitación de velocidad ------------------------
            if siguiendo and calibrado:
                a = nodo.smoothing
                for i in range(len(ARM_JOINTS)):
                    suavizado = (a * brazo_crudo[i]) + ((1.0 - a) * brazo_filtrado[i])
                    paso = np.clip(
                        suavizado - brazo_filtrado[i],
                        -nodo.max_joint_step,
                        nodo.max_joint_step,
                    )
                    brazo_filtrado[i] += paso
                pinza_filtrada = (a * pinza_cruda) + ((1.0 - a) * pinza_filtrada)

            nodo.publicar_brazo(brazo_filtrado)
            nodo.publicar_pinza(pinza_filtrada)

            # ---- Superposición informativa ---------------------------------
            cv2.putText(
                display,
                f"Target: X={objetivo_x:.2f} Y={objetivo_y:.2f} Z={objetivo_z:.2f}",
                (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
            )
            cv2.putText(
                display,
                f"Q: [{brazo_filtrado[0]:.2f}, {brazo_filtrado[1]:.2f}, {brazo_filtrado[2]:.2f}]",
                (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1,
            )
            cv2.putText(
                display, "[C] Calibrar Cero | [Q] Salir",
                (20, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1,
            )
            if not calibrado:
                cv2.putText(
                    display, "SIN CALIBRAR - presiona C",
                    (20, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2,
                )
            if singularidad:
                cv2.putText(
                    display, "Cerca del limite de alcance",
                    (20, 135), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 255), 1,
                )

            cv2.imshow(VENTANA, display)
            rclpy.spin_once(nodo, timeout_sec=0)

    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        hands.close()
        nodo.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
