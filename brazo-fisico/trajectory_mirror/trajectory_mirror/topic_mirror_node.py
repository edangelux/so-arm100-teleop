#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from trajectory_msgs.msg import JointTrajectory


class TopicMirror(Node):
    def __init__(self):
        super().__init__('topic_mirror')
        self.pub = self.create_publisher(JointTrajectory, '/real/arm_controller/joint_trajectory', 10)
        self.sub = self.create_subscription(
            JointTrajectory, '/arm_controller/joint_trajectory', self.callback, 10)
        self.get_logger().info('topic_mirror listo: /arm_controller/joint_trajectory -> /real/arm_controller/joint_trajectory')

    def callback(self, msg):
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = TopicMirror()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
