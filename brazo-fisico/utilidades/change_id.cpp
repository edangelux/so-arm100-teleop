// change_id.cpp
//
// Cambia el identificador de un servomotor STS3215 en el bus serie.
//
// Los actuadores salen de fabrica compartiendo el identificador 1. Si se
// conectan varios sin reasignarlos, todos responden a la vez, las respuestas
// colisionan sobre la linea compartida y el bus deja de responder por
// completo sin que ningun mensaje senale la causa.
//
// Por esa razon este programa debe ejecutarse con UN SOLO actuador conectado
// al bus. El procedimiento correcto es asignar los identificadores uno a uno,
// de forma aislada, antes de montar la cadena completa.
//
// El identificador vive en la EEPROM del actuador (registro SMS_STS_ID), de
// modo que el cambio es persistente y no debe repetirse en cada arranque. La
// EEPROM debe desbloquearse antes de escribirla y volver a bloquearse despues.
//
// Uso:  ./change_id <id_actual> <id_nuevo> [puerto]
// Por defecto el puerto es /dev/ttyACM0.

#include "SCServo.h"
#include <chrono>
#include <thread>
#include <iostream>
#include <cstdlib>

SMS_STS st;

int main(int argc, char** argv)
{
    if (argc < 3) {
        std::cerr << "Uso: ./change_id <id_actual> <id_nuevo> [puerto]\n";
        return 1;
    }

    int id_viejo     = std::atoi(argv[1]);
    int id_nuevo     = std::atoi(argv[2]);
    const char* port = (argc > 3) ? argv[3] : "/dev/ttyACM0";

    if (id_viejo < 0 || id_viejo > 253 || id_nuevo < 0 || id_nuevo > 253) {
        std::cerr << "Los identificadores validos van de 0 a 253\n";
        return 1;
    }
    if (id_viejo == id_nuevo) {
        std::cerr << "El identificador de origen y el de destino son el mismo\n";
        return 1;
    }

    if (!st.begin(1000000, port)) {
        std::cerr << "No se pudo abrir el puerto serial " << port << "\n";
        return 1;
    }

    if (st.Ping(id_viejo) == -1) {
        std::cerr << "No hay respuesta en el identificador " << id_viejo << ".\n"
                  << "Compruebe que el actuador este conectado y alimentado.\n";
        st.end();
        return 1;
    }

    if (st.Ping(id_nuevo) != -1) {
        std::cerr << "El identificador " << id_nuevo
                  << " ya esta ocupado en el bus.\n"
                  << "Ejecute este programa con un solo actuador conectado.\n";
        st.end();
        return 1;
    }

    std::cout << "Cambiando " << id_viejo << " -> " << id_nuevo << "\n";

    st.unLockEprom(id_viejo);
    st.writeByte(id_viejo, SMS_STS_ID, id_nuevo);
    st.LockEprom(id_nuevo);

    std::this_thread::sleep_for(std::chrono::milliseconds(200));

    if (st.Ping(id_nuevo) == -1) {
        std::cerr << "El cambio no se confirmo: el identificador " << id_nuevo
                  << " no responde\n";
        st.end();
        return 1;
    }

    std::cout << "Confirmado: el actuador responde en el identificador "
              << id_nuevo << "\n";

    if (st.FeedBack(id_nuevo) != -1) {
        std::cout << "  Posicion: "    << st.ReadPos(id_nuevo)     << " ticks\n";
        std::cout << "  Voltaje: "     << st.ReadVoltage(id_nuevo) / 10.0 << " V\n";
        std::cout << "  Temperatura: " << st.ReadTemper(id_nuevo)  << " C\n";
    }

    st.end();
    return 0;
}
