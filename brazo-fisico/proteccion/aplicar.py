#!/usr/bin/env python3
"""Agrega el limitador de saltos (limitador.hpp) al controlador de hardware del
SO-ARM100 en el workspace, no en entrega/: entrega/ conserva sin cambios lo que
se presentó.

    python3 brazo-fisico/proteccion/aplicar.py ~/ros2_ws_entrega/src/so_arm_100_hardware
    python3 brazo-fisico/proteccion/aplicar.py --comprobar RUTA   # 0 si ya está aplicado

Cada cambio busca un texto exacto del archivo original; si alguno no aparece
(el archivo es de otra versión), no toca nada y termina con error. Guarda una
copia .sin_proteccion de los dos archivos que modifica.
"""
import shutil
import sys
from pathlib import Path

MARCA = 'PROTECCION_SALTOS'
AQUI = Path(__file__).resolve().parent

CAMBIOS_HPP = [
    ('#include <map>\n',
     '#include <map>\n#include "so_arm_100_hardware/limitador.hpp"  // PROTECCION_SALTOS\n'),
    ('  std::vector<double> effort_states_;\n',
     '  std::vector<double> effort_states_;\n'
     '  // PROTECCION_SALTOS: una orden limitada por servo (brazo-fisico/proteccion/limitador.hpp)\n'
     '  std::vector<soarm::Limitador> limitadores_;\n'),
]

CAMBIOS_CPP = [
    # Un limitador por articulación; la pinza no vigila el desvío (al agarrar es normal).
    ('    servo_position_offsets_.resize(num_joints, 0);\n',
     '    servo_position_offsets_.resize(num_joints, 0);\n'
     '    // PROTECCION_SALTOS\n'
     '    limitadores_.assign(num_joints, soarm::Limitador());\n'
     '    for (size_t i = 0; i < num_joints; ++i) {\n'
     '        if (info_.joints[i].name == "Gripper") limitadores_[i].vigilar_desvio = false;\n'
     '    }\n'),
    # Lectura con el par desactivado: si el servo no contesta, se anota.
    ('                int raw_pos = st3215_.ReadPos(servo_id);\n                if (raw_pos != -1) {\n',
     '                int raw_pos = st3215_.ReadPos(servo_id);\n'
     '                limitadores_[i].lectura(raw_pos != -1);  // PROTECCION_SALTOS\n'
     '                if (raw_pos != -1) {\n'),
    # Lectura normal fallida: fuente apagada o cable suelto.
    ('                RCLCPP_WARN(rclcpp::get_logger("SOARM100Interface"), \n'
     '                           "Failed to read feedback from servo %d", servo_id);\n',
     '                limitadores_[i].lectura(false);  // PROTECCION_SALTOS\n'
     '                RCLCPP_WARN(rclcpp::get_logger("SOARM100Interface"), \n'
     '                           "Failed to read feedback from servo %d", servo_id);\n'),
    ('SOARM100Interface::write(const rclcpp::Time & /*time*/, const rclcpp::Duration & /*period*/)\n{\n',
     'SOARM100Interface::write(const rclcpp::Time & /*time*/, const rclcpp::Duration & period)\n{\n'
     '    // PROTECCION_SALTOS: sin par, la próxima orden vuelve a partir de la posición medida.\n'
     '    if (use_serial_ && !torque_enabled_) {\n'
     '        for (auto & l : limitadores_) l.listo = false;\n'
     '    }\n'),
    ('                int joint_pos_cmd = radians_to_ticks(position_commands_[i], i);\n',
     '                // PROTECCION_SALTOS: la orden pasa por el limitador antes de llegar al servo.\n'
     '                bool reinicio = false;\n'
     '                double orden = limitadores_[i].paso(position_commands_[i], position_states_[i],\n'
     '                                                    period.seconds(), reinicio);\n'
     '                if (reinicio) {\n'
     '                    RCLCPP_WARN(rclcpp::get_logger("SOARM100Interface"),\n'
     '                                "Servo %d lejos de su orden (corte de fuente o movido a mano): "\n'
     '                                "vuelve despacio desde %.2f rad.", servo_id, position_states_[i]);\n'
     '                }\n'
     '                int joint_pos_cmd = radians_to_ticks(orden, i);\n'),
]


def aplicar(paquete: Path):
    hpp = paquete / 'include' / 'so_arm_100_hardware' / 'so_arm_100_interface.hpp'
    cpp = paquete / 'src' / 'so_arm_100_interface.cpp'
    textos = {hpp: hpp.read_text(encoding='utf-8'), cpp: cpp.read_text(encoding='utf-8')}
    if all(MARCA in t for t in textos.values()):
        print('La protección ya estaba aplicada.')
        return 0
    if any(MARCA in t for t in textos.values()):
        print('La protección está aplicada a medias; restaure los .sin_proteccion y vuelva a ejecutar.', file=sys.stderr)
        return 1
    nuevos = {}
    for ruta, cambios in ((hpp, CAMBIOS_HPP), (cpp, CAMBIOS_CPP)):
        t = textos[ruta]
        for viejo, nuevo in cambios:
            if t.count(viejo) != 1:
                print(f'No se encontró el punto de cambio en {ruta.name}:\n{viejo}', file=sys.stderr)
                return 1
            t = t.replace(viejo, nuevo)
        nuevos[ruta] = t
    for ruta, t in nuevos.items():
        shutil.copy2(ruta, ruta.with_name(ruta.name + '.sin_proteccion'))
        ruta.write_text(t, encoding='utf-8')
    shutil.copy2(AQUI / 'limitador.hpp', hpp.with_name('limitador.hpp'))
    print('Protección aplicada:', cpp)
    return 0


def aplicada(paquete: Path):
    cpp = paquete / 'src' / 'so_arm_100_interface.cpp'
    return cpp.is_file() and MARCA in cpp.read_text(encoding='utf-8') and \
        (paquete / 'include' / 'so_arm_100_hardware' / 'limitador.hpp').is_file()


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['--comprobar']:
        sys.exit(0 if aplicada(Path(args[1]).expanduser()) else 1)
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    sys.exit(aplicar(Path(args[0]).expanduser()))
