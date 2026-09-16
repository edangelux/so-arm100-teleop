#
# gz_moveit_real.launch.py
#
# Lanza, de una sola vez, las dos plantas y el puente entre ellas:
#
#   - Gazebo con el robot simulado           (espacio de nombres global)
#   - El brazo fisico por USB                (espacio de nombres /real)
#   - move_group y RViz
#   - Los dos nodos espejo de trajectory_mirror
#
# ESTADO DE VERIFICACION: no verificado de principio a fin.
#   Esta escrito contra la estructura real de hardware.launch.py y gz.launch.py
#   tal como quedan despues de aplicar los parches de brazo-fisico/parches/,
#   pero nadie lo ha ejecutado completo. Ver docs/10.
#
#   Si algo falla, lo primero que hay que mirar es RETARDO_ESPEJOS (abajo):
#   trajectory_mirror_node aborta el goal si un controlador no responde en 3 s,
#   y Gazebo tarda bastante mas que eso en activar los suyos la primera vez.
#
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

# Segundos que se espera antes de arrancar los espejos, para que los
# controladores de ambos lados esten activos. Subelo si ves
# "No se pudo conectar a /arm_controller (Gazebo)".
RETARDO_ESPEJOS = 12.0


def generate_launch_description():
    bringup = get_package_share_directory('so_arm_100_bringup')
    moveit = get_package_share_directory('so_arm_100_moveit_config')

    args = [
        DeclareLaunchArgument(
            'serial_port', default_value='/dev/ttyUSB0',
            description='Puerto serie de la placa controladora de servos'),
        DeclareLaunchArgument(
            'rviz', default_value='true',
            description='Abrir RViz con MoveIt'),
    ]

    gz = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(bringup, 'launch', 'gz.launch.py')),
        launch_arguments={'dof': '5'}.items())

    hardware = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(bringup, 'launch', 'hardware.launch.py')),
        launch_arguments={'serial_port': LaunchConfiguration('serial_port')}.items())

    move_group = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(moveit, 'launch', 'move_group.launch.py')),
        launch_arguments={'use_sim_time': 'true'}.items())

    rviz = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(moveit, 'launch', 'moveit_rviz.launch.py')),
        launch_arguments={'use_sim_time': 'true'}.items())

    topic_mirror = Node(
        package='trajectory_mirror', executable='topic_mirror_node',
        name='topic_mirror', output='screen')

    trajectory_mirror = Node(
        package='trajectory_mirror', executable='trajectory_mirror_node',
        name='trajectory_mirror', output='screen')

    espejos = TimerAction(period=RETARDO_ESPEJOS,
                          actions=[topic_mirror, trajectory_mirror])

    return LaunchDescription(args + [gz, hardware, move_group, rviz, espejos])
