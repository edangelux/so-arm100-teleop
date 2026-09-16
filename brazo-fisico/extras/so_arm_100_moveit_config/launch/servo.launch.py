"""
Lanza MoveIt Servo como nodo standalone para el SO-ARM100.

Uso (con Gazebo y MoveIt ya corriendo, como en tu flujo habitual):

    ros2 launch so_arm_100_moveit_config servo.launch.py use_sim_time:=true

Este archivo debe copiarse a:
    ~/ros2_ws/src/SO-100-arm/so_arm_100_moveit_config/launch/servo.launch.py

Y servo_params.yaml debe copiarse a:
    ~/ros2_ws/src/SO-100-arm/so_arm_100_moveit_config/config/servo_params.yaml

Luego reconstruir:
    cd ~/ros2_ws && colcon build --packages-select so_arm_100_moveit_config
"""
import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    use_sim_time = LaunchConfiguration('use_sim_time')

    declare_use_sim_time = DeclareLaunchArgument(
        'use_sim_time',
        default_value='true',
        description='Usar el reloj de Gazebo (debe coincidir con el resto de tu stack)'
    )

    # Construye la config de MoveIt igual que tu moveit.launch.py existente,
    # reutilizando el mismo SRDF/URDF/kinematics que ya tienes.
    moveit_config = (
        MoveItConfigsBuilder("so_arm_100", package_name="so_arm_100_moveit_config")
        .robot_description(file_path="config/so_arm_100.urdf.xacro")
        .robot_description_semantic(file_path="config/so_arm_100.srdf")
        .robot_description_kinematics(file_path="config/kinematics.yaml")
        .to_moveit_configs()
    )

    servo_yaml_path = os.path.join(
        get_package_share_directory("so_arm_100_moveit_config"),
        "config",
        "servo_params.yaml",
    )

    servo_node = Node(
        package="moveit_servo",
        executable="servo_node_main",
        name="servo_node",
        parameters=[
            servo_yaml_path,
            moveit_config.robot_description,
            moveit_config.robot_description_semantic,
            moveit_config.robot_description_kinematics,
            moveit_config.joint_limits,
            {"use_sim_time": use_sim_time},
        ],
        output="screen",
    )

    return LaunchDescription([
        declare_use_sim_time,
        servo_node,
    ])
