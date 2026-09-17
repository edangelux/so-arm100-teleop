// bench_serial.cpp
//
// Mide el tiempo que tarda el equipo anfitrion en entregar una consigna de
// posicion al bus serie de los servomotores STS3215.
//
// IMPORTANTE sobre lo que mide y lo que no mide:
//   WritePosEx es una escritura sin espera de respuesta. Lo que este programa
//   cronometra es el tiempo que tarda el sistema operativo en entregar los
//   bytes al puerto USB, NO el tiempo que tarda el actuador en recibirlos ni
//   en ejecutarlos. A 1 Mbaud una trama de una decena de bytes ocupa del orden
//   de 0.1 ms en el cable; el resto es sobrecarga del anfitrion y del
//   adaptador USB-serie.
//
// Uso:  ./bench_serial [puerto] [id] [repeticiones]
// Por defecto: /dev/ttyACM0, id 1, 200 repeticiones.
//
// Corresponde al Indicador 1 (latencia extremo a extremo) del objetivo
// especifico 4 del proyecto.

#include "SCServo.h"
#include <chrono>
#include <iostream>
#include <cstdlib>

SMS_STS st;

int main(int argc, char** argv)
{
    const char* port = (argc > 1) ? argv[1] : "/dev/ttyACM0";
    int id           = (argc > 2) ? std::atoi(argv[2]) : 1;
    int n            = (argc > 3) ? std::atoi(argv[3]) : 200;

    if (n <= 0) {
        std::cerr << "El numero de repeticiones debe ser mayor que cero\n";
        return 1;
    }

    if (!st.begin(1000000, port)) {
        std::cerr << "No se pudo abrir el puerto serial " << port << "\n";
        return 1;
    }

    // Lee la posicion actual y la reescribe, de modo que la medicion no
    // desplace el actuador: se mide el costo de la escritura, no un movimiento.
    int pos = 2048;
    if (st.FeedBack(id) != -1) {
        pos = st.ReadPos(id);
    } else {
        std::cerr << "Aviso: el servo " << id
                  << " no respondio; se usa 2048 como consigna\n";
    }

    auto t0 = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < n; i++) {
        st.WritePosEx(id, pos, 2400, 50);
    }
    auto t1 = std::chrono::high_resolution_clock::now();

    double total_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    double avg_ms   = total_ms / n;

    std::cout << "Puerto: " << port << "   Servo: " << id << "\n";
    std::cout << "Escrituras: " << n << "\n";
    std::cout << "Tiempo total: " << total_ms << " ms\n";
    std::cout << "Promedio por escritura: " << avg_ms << " ms\n";

    st.end();
    return 0;
}
