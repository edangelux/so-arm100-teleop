from setuptools import setup

package_name = 'trajectory_mirror'

setup(
    name=package_name,
    version='0.0.1',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Eddy Torrez',
    maintainer_email='eddytorrez34@gmail.com',
    description='Mirror de trayectorias Gazebo <-> brazo real',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'trajectory_mirror_node = trajectory_mirror.trajectory_mirror_node:main',
            'topic_mirror_node = trajectory_mirror.topic_mirror_node:main',
        ],
    },
)
