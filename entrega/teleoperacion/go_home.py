"""
Mueve el brazo a la pose "home" definida en el SRDF (doblada, lejos de la
singularidad de codo extendido) usando el planner normal de MoveIt.

Correr UNA VEZ antes de calibrar el teleop cartesiano, con Gazebo y MoveIt
ya activos (no necesita el venv de mediapipe, solo rclpy + moveit).

Uso:
    python3 go_home.py
"""
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from control_msgs.action import FollowJointTrajectory
from trajectory_msgs.msg import JointTrajectoryPoint
from builtin_interfaces.msg import Duration

ARM_JOINTS = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll']
HOME_POSITIONS = [0.0, -0.8, 1.0, 0.5, 0.0]

class GoHome(Node):
    def __init__(self):
        super().__init__('go_home_node')
        self.client = ActionClient(self, FollowJointTrajectory,
                                    '/arm_controller/follow_joint_trajectory')

    def send(self):
        if not self.client.wait_for_server(timeout_sec=5.0):
            print("[ERROR] accion /arm_controller/follow_joint_trajectory no disponible")
            return False

        goal = FollowJointTrajectory.Goal()
        goal.trajectory.joint_names = ARM_JOINTS
        point = JointTrajectoryPoint()
        point.positions = HOME_POSITIONS
        point.time_from_start = Duration(sec=3, nanosec=0)  # 3s, movimiento suave
        goal.trajectory.points = [point]

        print("Enviando brazo a pose 'home' (3s)...")
        future = self.client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, future, timeout_sec=5.0)
        goal_handle = future.result()
        if goal_handle is None or not goal_handle.accepted:
            print("[ERROR] goal rechazado")
            return False

        result_future = goal_handle.get_result_async()
        rclpy.spin_until_future_complete(self, result_future, timeout_sec=6.0)
        print("[OK] brazo en pose home.")
        return True


def main():
    rclpy.init()
    node = GoHome()
    node.send()
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
