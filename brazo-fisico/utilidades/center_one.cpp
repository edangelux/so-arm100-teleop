// center_one.cpp
//
// Lleva un servomotor STS3215 a su posicion central electrica, 2048 ticks,
// equivalente al punto medio del recorrido de 0 a 4095 que abarca una vuelta
// completa. Ese valor se adopta como referencia de cero radianes para la
// articulacion correspondiente.
//
// El procedimiento debe ejecutarse ANTES de montar el actuador en su eslabon,
// de modo que la bocina pueda orientarse y fijarse ya alineada con la posicion
// central establecida por via electrica. La manipulacion mecanica durante el
// ensamble puede desplazar ligeramente el centro, por lo que conviene repetir
// la comprobacion tras fijar la bocina y el eslabon.
//
// Uso:  ./center_one <servo_id> [puerto] [ticks]
// Por defecto: /dev/ttyACM0 y 2048 ticks.

#include "SCServo.h"
#include <chrono>
#include <thread>
#include <iostream>
#include <cstdlib>
#include <cmath>

SMS_STS st;

static const double GRADOS_POR_TICK = 360.0 / 4096.0;

int main(int argc, char** argv)
{
    if (argc < 2) {
        std::cerr << "Uso: ./center_one <servo_id> [puerto] [ticks]\n";
        return 1;
    }

    int servo_id     = std::atoi(argv[1]);
    const char* port = (argc > 2) ? argv[2] : "/dev/ttyACM0";
    int objetivo     = (argc > 3) ? std::atoi(argv[3]) : 2048;

    if (objetivo < 0 || objetivo > 4095) {
        std::cerr << "La posicion debe estar entre 0 y 4095 ticks\n";
        return 1;
    }

    if (!st.begin(1000000, port)) {
        std::cerr << "No se pudo abrir el puerto serial " << port << "\n";
        return 1;
    }

    if (st.FeedBack(servo_id) == -1) {
        std::cerr << "El servo " << servo_id << " no responde en el bus\n";
        st.end();
        return 1;
    }

    int antes = st.ReadPos(servo_id);
    std::cout << "Servo " << servo_id << "  posicion actual: "
              << antes << " ticks\n";
    std::cout << "Comandando " << objetivo << " ticks...\n";

    st.WritePosEx(servo_id, objetivo, 2400, 50);
    std::this_thread::sleep_for(std::chrono::milliseconds(1500));

    if (st.FeedBack(servo_id) == -1) {
        std::cerr << "Fallo la lectura de confirmacion\n";
        st.end();
        return 1;
    }

    int    despues   = st.ReadPos(servo_id);
    int    err       = despues - objetivo;
    double err_grad  = err * GRADOS_POR_TICK;

    std::cout << "Posicion alcanzada: " << despues << " ticks\n";
    std::cout << "Desviacion: " << err << " ticks ("
              << err_grad << " grados)\n";

    if (std::abs(err) > 5) {
        std::cout << "Aviso: la desviacion supera los 5 ticks. "
                  << "Compruebe que el eje gire libre y sin carga.\n";
    }

    st.end();
    return 0;
}
