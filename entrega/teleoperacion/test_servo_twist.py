"""
Prueba manual de MoveIt Servo con timestamp correcto en cada mensaje.

A diferencia de `ros2 topic pub` desde la CLI (que deja header.stamp en
sec=0, nanosec=0), este script llena el timestamp con el reloj actual del
nodo (respeta use_sim_time). Si Servo estaba descartando los comandos por
"viejos" (timestamp 0 vs reloj de Gazebo avanzado), esto lo resuelve.

Uso:
    python3 test_servo_twist.py

Mueve el efector en +z (arriba) a velocidad unitless 0.15 durante ~4 segundos,
luego se detiene solo. Ctrl+C para cortar antes.
"""
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TwistStamped
import time


class ServoTwistTest(Node):
    def __init__(self):
        super().__init__('servo_twist_test')
        self.pub = self.create_publisher(TwistStamped, '/servo_node/delta_twist_cmds', 10)
        self.timer = self.create_timer(0.05, self.tick)  # 20 Hz
        self.start_time = self.get_clock().now()
        self.duration_sec = 4.0

    def tick(self):
        elapsed = (self.get_clock().now() - self.start_time).nanoseconds / 1e9
        if elapsed > self.duration_sec:
            print(f"\nListo, {elapsed:.1f}s transcurridos. Ctrl+C para salir.")
            self.timer.cancel()
            return

        msg = TwistStamped()
        msg.header.stamp = self.get_clock().now().to_msg()   # <-- la clave: timestamp real
        msg.header.frame_id = 'base_link'
        msg.twist.linear.z = 0.15
        self.pub.publish(msg)
        print(f"Publicado t={elapsed:.2f}s  z_vel=0.15", end='\r')


def main():
    rclpy.init()
    node = ServoTwistTest()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
