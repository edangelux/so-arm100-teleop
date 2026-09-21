"""Selecciona las conexiones de teleop_v13.py según el modo: sim, real o ambos."""
import math
import os
from pathlib import Path


def settings(env=None):
    env = os.environ if env is None else env
    mode = env.get('SOARM_MODE', 'sim')
    if mode not in ('sim', 'real', 'ambos'):
        raise ValueError('SOARM_MODE debe ser sim, real o ambos.')
    defaults = {
        'sim': ('/arm_controller/joint_trajectory', '/gripper_controller/gripper_cmd'),
        'real': ('/real/arm_controller/joint_trajectory', '/real/gripper_controller/gripper_cmd'),
        'ambos': ('/arm_controller/joint_trajectory', '/mirror_gripper_controller/gripper_cmd'),
    }
    arm, gripper = defaults[mode]
    velocity = float(env.get('SOARM_MAX_VEL', '8.0'))
    camera = int(env.get('SOARM_CAMERA', '0'))
    width = int(env.get('SOARM_WIDTH', '640'))
    height = int(env.get('SOARM_HEIGHT', '480'))
    if not math.isfinite(velocity) or not 0 < velocity <= 8:
        raise ValueError('SOARM_MAX_VEL debe estar en (0, 8] rad/s.')
    if camera < 0 or width <= 0 or height <= 0:
        raise ValueError('Cámara o resolución inválida.')
    return dict(ARM_TOPIC=arm, GRIPPER_ACTION=gripper, CAMERA_INDEX=camera,
                CAMERA_WIDTH=width, CAMERA_HEIGHT=height, MAX_JOINT_VEL=velocity,
                CONFIG_FILE=str(Path(env.get('SOARM_CONFIG', '~/teleop_config.json')).expanduser()))
