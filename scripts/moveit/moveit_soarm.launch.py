"""MoveIt 2 y RViz para el lanzador scripts/soarm.sh --moveit.

Reutiliza la configuración de so_arm_100_moveit_config (SRDF, cinemática,
límites y la vista moveit.rviz). Sólo cambia, según el modo, a qué
controladores manda MoveIt y de dónde lee la postura del brazo:

  sim    controladores de Gazebo; /joint_states con tiempo simulado.
  real   controladores de /real; /real/joint_states con tiempo de reloj.
  ambos  el controlador espejo de trajectory_mirror_node, que reenvía cada
         plan a Gazebo y al brazo físico a la vez (moveit_controllers.yaml del
         propio paquete); /joint_states de Gazebo con tiempo simulado.

Uso directo:
  ros2 launch scripts/moveit/moveit_soarm.launch.py modo:=sim
"""
import os
from pathlib import Path

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory
from moveit_configs_utils import MoveItConfigsBuilder

AQUI = Path(__file__).resolve().parent


def preparar(context):
    modo = LaunchConfiguration('modo').perform(context)
    if modo not in ('sim', 'real', 'ambos'):
        raise RuntimeError('modo debe ser sim, real o ambos')
    controladores = {
        'sim': str(AQUI / 'controladores_sim.yaml'),
        'real': str(AQUI / 'controladores_real.yaml'),
        'ambos': 'config/moveit_controllers.yaml',
    }[modo]
    tiempo_sim = modo != 'real'
    remapeo = [('/joint_states', '/real/joint_states')] if modo == 'real' else []

    cfg = (
        MoveItConfigsBuilder(robot_name='so_arm_100', package_name='so_arm_100_moveit_config')
        .robot_description_semantic(str(Path('config') / 'so_arm_100.srdf'))
        .joint_limits(str(Path('config') / 'joint_limits.yaml'))
        .trajectory_execution(controladores)
        .robot_description_kinematics(str(Path('config') / 'kinematics.yaml'))
        .to_moveit_configs()
    )
    move_group = Node(
        package='moveit_ros_move_group', executable='move_group', output='screen',
        parameters=[cfg.to_dict(), {'use_sim_time': tiempo_sim,
                                    'publish_robot_description_semantic': True}],
        remappings=remapeo,
    )
    rviz = Node(
        package='rviz2', executable='rviz2', name='rviz2_moveit', output='log',
        arguments=['-d', os.path.join(get_package_share_directory('so_arm_100_moveit_config'),
                                      'config', 'moveit.rviz')],
        parameters=[cfg.robot_description, cfg.robot_description_semantic,
                    cfg.robot_description_kinematics, cfg.planning_pipelines,
                    cfg.joint_limits, {'use_sim_time': tiempo_sim}],
        remappings=remapeo,
    )
    return [move_group, rviz]


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('modo', default_value='sim', description='sim, real o ambos'),
        OpaqueFunction(function=preparar),
    ])
