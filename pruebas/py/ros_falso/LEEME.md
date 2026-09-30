Imitación mínima de rclpy y de los mensajes de ROS 2 para probar `scripts/ir_a_pose.py`
sin ROS. El «robot» sigue la trayectoria con un perfil cúbico y publica estados con
marca de tiempo. `RTF` fija el factor de tiempo real (0,3 = Gazebo lento) y
`ATASCADO=1` hace que no se mueva.
