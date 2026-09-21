import os
import xacro

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.actions import OpaqueFunction
from launch.actions import RegisterEventHandler
from launch.event_handlers import OnProcessExit
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch.conditions import IfCondition

NS = 'real'

def generate_launch_description():
    so_arm_100_description_path = os.path.join(
        get_package_share_directory('so_arm_100_description')
    )

    so_arm_100_moveit_config_path = os.path.join(
        get_package_share_directory('so_arm_100_moveit_config')
    )

    arguments = LaunchDescription([
        DeclareLaunchArgument(
            'serial_port',
            default_value='/dev/ttyUSB0',
            description='Servo controller board serial port'
        ),
        DeclareLaunchArgument(
            'serial_baudrate',
            default_value='1000000',
            description='Servo controller board serial baudrate'
        ),
        DeclareLaunchArgument(
            'servo_speed',
            default_value='2400',
            description='Servo move speed in ticks/s'
        ),
        DeclareLaunchArgument(
            'servo_acceleration',
            default_value='50',
            description='Servo move acceleration in ticks/s^2'
        ),
        DeclareLaunchArgument(
            'rviz',
            default_value='false',
            description='Visualize the robot in RViz'
        ),
        DeclareLaunchArgument(
            'use_fake_hardware',
            default_value='false',
            description='Use fake hardware'
        ),
        DeclareLaunchArgument(
            'zero_pose',
            default_value='false',
            description='Test zero pose after startup'
        ),
    ])

    def launch_setup(context, *args, **kwargs):
        xacro_file = os.path.join(
            so_arm_100_moveit_config_path,
            'config',
            'so_arm_100.urdf.xacro',
        )

        use_fake_hardware = LaunchConfiguration('use_fake_hardware').perform(context)
        serial_port = LaunchConfiguration('serial_port').perform(context)
        serial_baudrate = LaunchConfiguration('serial_baudrate').perform(context)
        servo_speed = LaunchConfiguration('servo_speed').perform(context)
        servo_acceleration = LaunchConfiguration('servo_acceleration').perform(context)

        doc = xacro.process_file(xacro_file, mappings={
            'use_fake_hardware': use_fake_hardware,
            'serial_port': serial_port,
            'serial_baudrate': serial_baudrate,
            'servo_speed': servo_speed,
            'servo_acceleration': servo_acceleration,
        })

        robot_desc = doc.toprettyxml(indent='  ')

        robot_description = {'robot_description': ParameterValue(robot_desc, value_type=str)}

        robot_state_publisher = Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            namespace=NS,
            output='screen',
            parameters=[robot_description],
            remappings=[
                ('/tf', 'tf'),
                ('/tf_static', 'tf_static'),
            ],
        )

        ros2_control_file = os.path.join(
            so_arm_100_moveit_config_path,
            'config',
            'hardware_controllers.yaml',
        )

        controller_manager = Node(
            package="controller_manager",
            executable="ros2_control_node",
            namespace=NS,
            parameters=[
                robot_description,
                ros2_control_file,
            ],
            output="screen",
        )

        joint_state_broadcaster_spawner = Node(
            package="controller_manager",
            executable="spawner",
            namespace=NS,
            arguments=["joint_state_broadcaster", "--controller-manager", f"/{NS}/controller_manager"],
        )

        arm_controller_spawner = Node(
            package="controller_manager",
            executable="spawner",
            namespace=NS,
            arguments=["arm_controller", "-c", f"/{NS}/controller_manager"],
            output="screen",
        )

        gripper_controller_spawner = Node(
            package="controller_manager",
            executable="spawner",
            namespace=NS,
            arguments=["gripper_controller", "-c", f"/{NS}/controller_manager"],
            output="screen",
        )

        arm_effort_controller_spawner = Node(
            package="controller_manager",
            executable="spawner",
            namespace=NS,
            arguments=["arm_effort_controller", "-c", f"/{NS}/controller_manager", "--inactive"],
            output="screen",
        )

        gripper_effort_controller_spawner = Node(
            package="controller_manager",
            executable="spawner",
            namespace=NS,
            arguments=["gripper_effort_controller", "-c", f"/{NS}/controller_manager", "--inactive"],
            output="screen",
        )

        effort_controller_spawner = Node(
            package="controller_manager",
            executable="spawner",
            namespace=NS,
            arguments=["effort_controller", "-c", f"/{NS}/controller_manager", "--inactive"],
            output="screen",
        )

        delayed_arm_controller_spawner = RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=joint_state_broadcaster_spawner,
                on_exit=[arm_controller_spawner],
            )
        )

        delayed_gripper_controller_spawner = RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=joint_state_broadcaster_spawner,
                on_exit=[gripper_controller_spawner],
            )
        )

        delayed_arm_effort_controller_spawner = RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=joint_state_broadcaster_spawner,
                on_exit=[arm_effort_controller_spawner],
            )
        )

        delayed_gripper_effort_controller_spawner = RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=joint_state_broadcaster_spawner,
                on_exit=[gripper_effort_controller_spawner],
            )
        )

        delayed_effort_controller_spawner = RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=joint_state_broadcaster_spawner,
                on_exit=[effort_controller_spawner],
            )
        )

        rviz_config_file = os.path.join(
            so_arm_100_description_path,
            'rviz',
            'so_arm_100.rviz'
        )

        rviz_node = Node(
            condition=IfCondition(LaunchConfiguration('rviz')),
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            namespace=NS,
            arguments=['-d', rviz_config_file]
        )

        zero_pose_node = Node(
            condition=IfCondition(LaunchConfiguration('zero_pose')),
            package='so_arm_100_hardware',
            executable='zero_pose.py',
            name='zero_pose_test',
            namespace=NS,
        )

        nodes = [
            robot_state_publisher,
            controller_manager,
            joint_state_broadcaster_spawner,
            delayed_arm_controller_spawner,
            delayed_gripper_controller_spawner,
            delayed_arm_effort_controller_spawner,
            delayed_gripper_effort_controller_spawner,
            delayed_effort_controller_spawner,
            rviz_node,
            zero_pose_node,
        ]
        return nodes

    return LaunchDescription([
        arguments,
        OpaqueFunction(function=launch_setup),
    ])
