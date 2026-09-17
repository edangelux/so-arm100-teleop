// list_servos.cpp
//
// Recorre el bus serie en un rango de identificadores y reporta el estado de
// cada actuador STS3215 que responda.
//
// Cumple dos funciones. Durante la asignacion de identificadores sirve de
// criterio de verificacion: la AUSENCIA de respuesta en los identificadores
// todavia no configurados confirma que no existe conflicto de direccionamiento
// en el bus. Una vez montada la cadena completa, verifica que los seis
// actuadores respondan y que su temperatura y su tension de alimentacion se
// encuentren dentro del rango esperado.
//
// Uso:  ./list_servos [puerto] [id_min] [id_max]
// Por defecto: /dev/ttyACM0, del 1 al 10.

#include "SCServo.h"
#include <iostream>
#include <iomanip>
#include <cstdlib>

SMS_STS st;

int main(int argc, char** argv)
{
    const char* port = (argc > 1) ? argv[1] : "/dev/ttyACM0";
    int id_min       = (argc > 2) ? std::atoi(argv[2]) : 1;
    int id_max       = (argc > 3) ? std::atoi(argv[3]) : 10;

    if (!st.begin(1000000, port)) {
        std::cerr << "No se pudo abrir el puerto serial " << port << "\n";
        return 1;
    }

    std::cout << "Explorando " << port << " en el rango "
              << id_min << " a " << id_max << "\n\n";
    std::cout << std::left
              << std::setw(5)  << "ID"
              << std::setw(10) << "Estado"
              << std::setw(11) << "Pos(tick)"
              << std::setw(10) << "Vel"
              << std::setw(10) << "Carga"
              << std::setw(10) << "Volt(V)"
              << std::setw(9)  << "Temp(C)"
              << "\n";
    std::cout << std::string(65, '-') << "\n";

    int encontrados = 0;

    for (int id = id_min; id <= id_max; id++) {
        if (st.FeedBack(id) == -1) {
            std::cout << std::left << std::setw(5) << id
                      << std::setw(10) << "---" << "sin respuesta\n";
            continue;
        }
        encontrados++;
        std::cout << std::left
                  << std::setw(5)  << id
                  << std::setw(10) << "OK"
                  << std::setw(11) << st.ReadPos(id)
                  << std::setw(10) << st.ReadSpeed(id)
                  << std::setw(10) << st.ReadLoad(id)
                  << std::setw(10) << st.ReadVoltage(id) / 10.0
                  << std::setw(9)  << st.ReadTemper(id)
                  << "\n";
    }

    std::cout << "\nActuadores detectados: " << encontrados << "\n";

    st.end();
    return 0;
}
