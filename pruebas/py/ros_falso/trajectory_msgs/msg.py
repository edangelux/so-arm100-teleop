class _Cabecera:
    stamp = None


class JointTrajectory:
    def __init__(self):
        self.header = _Cabecera()
        self.joint_names = []
        self.points = []


class JointTrajectoryPoint:
    def __init__(self):
        self.positions = []
        self.velocities = []
        self.time_from_start = None
