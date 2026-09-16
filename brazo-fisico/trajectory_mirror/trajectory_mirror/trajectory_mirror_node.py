#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from rclpy.action import ActionServer, ActionClient
from rclpy.action.server import ServerGoalHandle
from rclpy.callback_groups import ReentrantCallbackGroup
from control_msgs.action import FollowJointTrajectory, GripperCommand


class TrajectoryMirror(Node):
    def __init__(self):
        super().__init__('trajectory_mirror')
        cb_group = ReentrantCallbackGroup()

        self._server = ActionServer(
            self, FollowJointTrajectory, 'mirror_controller/follow_joint_trajectory',
            execute_callback=self.execute_callback, callback_group=cb_group,
        )
        self._gz_client = ActionClient(
            self, FollowJointTrajectory, '/arm_controller/follow_joint_trajectory',
            callback_group=cb_group,
        )
        self._real_client = ActionClient(
            self, FollowJointTrajectory, '/real/arm_controller/follow_joint_trajectory',
            callback_group=cb_group,
        )

        self._gripper_server = ActionServer(
            self, GripperCommand, 'mirror_gripper_controller/gripper_cmd',
            execute_callback=self.execute_gripper_callback, callback_group=cb_group,
        )
        self._gz_gripper_client = ActionClient(
            self, GripperCommand, '/gripper_controller/gripper_cmd',
            callback_group=cb_group,
        )
        self._real_gripper_client = ActionClient(
            self, GripperCommand, '/real/gripper_controller/gripper_cmd',
            callback_group=cb_group,
        )

        self.get_logger().info('trajectory_mirror listo: esperando goals de MoveIt2 (brazo + gripper)...')

    async def execute_callback(self, goal_handle: ServerGoalHandle):
        traj = goal_handle.request.trajectory
        n_points = len(traj.points)
        self.get_logger().info(f'Goal recibido con {n_points} waypoints. Reenviando a Gazebo + brazo real...')

        if not self._gz_client.wait_for_server(timeout_sec=3.0):
            self.get_logger().error('No se pudo conectar a /arm_controller (Gazebo)')
            goal_handle.abort()
            return FollowJointTrajectory.Result()
        if not self._real_client.wait_for_server(timeout_sec=3.0):
            self.get_logger().error('No se pudo conectar a /real/arm_controller (brazo real)')
            goal_handle.abort()
            return FollowJointTrajectory.Result()

        gz_goal = FollowJointTrajectory.Goal()
        gz_goal.trajectory = traj
        real_goal = FollowJointTrajectory.Goal()
        real_goal.trajectory = traj

        gz_future = self._gz_client.send_goal_async(gz_goal)
        real_future = self._real_client.send_goal_async(real_goal)
        gz_goal_handle = await gz_future
        real_goal_handle = await real_future

        if not gz_goal_handle.accepted:
            self.get_logger().error('Gazebo rechazo el goal')
            goal_handle.abort()
            return FollowJointTrajectory.Result()
        if not real_goal_handle.accepted:
            self.get_logger().error('El brazo real rechazo el goal')
            goal_handle.abort()
            return FollowJointTrajectory.Result()

        gz_result = await gz_goal_handle.get_result_async()
        real_result = await real_goal_handle.get_result_async()

        self.get_logger().info(
            f'Ejecucion terminada. Gazebo error_code={gz_result.result.error_code}, '
            f'Real error_code={real_result.result.error_code}'
        )

        goal_handle.succeed()
        result = FollowJointTrajectory.Result()
        result.error_code = real_result.result.error_code
        return result

    async def execute_gripper_callback(self, goal_handle: ServerGoalHandle):
        cmd = goal_handle.request.command
        self.get_logger().info(f'Goal de gripper recibido: position={cmd.position}. Reenviando...')

        if not self._gz_gripper_client.wait_for_server(timeout_sec=3.0):
            self.get_logger().error('No se pudo conectar a /gripper_controller (Gazebo)')
            goal_handle.abort()
            return GripperCommand.Result()
        if not self._real_gripper_client.wait_for_server(timeout_sec=3.0):
            self.get_logger().error('No se pudo conectar a /real/gripper_controller (brazo real)')
            goal_handle.abort()
            return GripperCommand.Result()

        gz_goal = GripperCommand.Goal()
        gz_goal.command = cmd
        real_goal = GripperCommand.Goal()
        real_goal.command = cmd

        gz_future = self._gz_gripper_client.send_goal_async(gz_goal)
        real_future = self._real_gripper_client.send_goal_async(real_goal)
        gz_goal_handle = await gz_future
        real_goal_handle = await real_future

        if not gz_goal_handle.accepted:
            self.get_logger().error('Gazebo rechazo el goal de gripper')
            goal_handle.abort()
            return GripperCommand.Result()
        if not real_goal_handle.accepted:
            self.get_logger().error('El brazo real rechazo el goal de gripper')
            goal_handle.abort()
            return GripperCommand.Result()

        gz_result = await gz_goal_handle.get_result_async()
        real_result = await real_goal_handle.get_result_async()

        self.get_logger().info('Gripper: ejecucion terminada en Gazebo y brazo real')

        goal_handle.succeed()
        result = GripperCommand.Result()
        result.position = real_result.result.position
        result.reached_goal = real_result.result.reached_goal
        return result


def main(args=None):
    rclpy.init(args=args)
    node = TrajectoryMirror()
    from rclpy.executors import MultiThreadedExecutor
    executor = MultiThreadedExecutor()
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
