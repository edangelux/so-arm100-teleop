// angular_error_test.cpp
//
// Prueba de seguimiento de consigna sobre un servomotor STS3215.
//
// Comanda seis posiciones objetivo alrededor del centro electrico del
// actuador, espera un intervalo de asentamiento y lee la posicion
// efectivamente alcanzada mediante la realimentacion del codificador
// magnetico absoluto. Escribe consigna y lectura en un archivo CSV.
//
// La sexta consigna repite la tercera (2048) para medir la histeresis al
// regresar al centro por el lado opuesto del recorrido.
//
// Conversion a grados:  1 tick = 360 / 4096 = 0.087890625 grados
//
// Uso:  ./angular_error_test <servo_id> [puerto] [directorio_salida]
// Por defecto: /dev/ttyACM0 y el directorio personal del usuario.
//
// Corresponde al Indicador 2 (desviacion angular) del objetivo
// especifico 4 del proyecto.

#include "SCServo.h"
#include <chrono>
#include <thread>
#include <fstream>
#include <iostream>
#include <cstdlib>
#include <string>
#include <cmath>

SMS_STS st;

static const double GRADOS_POR_TICK = 360.0 / 4096.0;

int main(int argc, char** argv)
{
    if (argc < 2) {
        std::cerr << "Uso: ./angular_error_test <servo_id> [puerto] [dir_salida]\n";
        return 1;
    }

    int servo_id     = std::atoi(argv[1]);
    const char* port = (argc > 2) ? argv[2] : "/dev/ttyACM0";

    std::string outdir;
    if (argc > 3) {
        outdir = argv[3];
    } else {
        const char* home = std::getenv("HOME");
        outdir = home ? home : ".";
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

    std::string filename = outdir + "/angular_error_log_s"
                         + std::to_string(servo_id) + ".csv";
    std::ofstream f(filename);
    if (!f) {
        std::cerr << "No se pudo crear " << filename << "\n";
        st.end();
        return 1;
    }
    f << "consigna_ticks,leido_ticks,error_ticks,error_grados\n";

    const int targets[] = {1848, 1948, 2048, 2148, 2248, 2048};
    const int n_targets = sizeof(targets) / sizeof(targets[0]);

    double suma_abs = 0.0;
    int    max_abs  = 0;

    for (int i = 0; i < n_targets; i++) {
        int t = targets[i];

        st.WritePosEx(servo_id, t, 2400, 50);
        std::this_thread::sleep_for(std::chrono::milliseconds(800));

        if (st.FeedBack(servo_id) == -1) {
            std::cerr << "Fallo la lectura tras comandar " << t << "\n";
            continue;
        }
        int pos = st.ReadPos(servo_id);

        int    err_ticks   = pos - t;
        int    abs_ticks   = std::abs(err_ticks);
        double err_grados  = err_ticks * GRADOS_POR_TICK;

        suma_abs += abs_ticks;
        if (abs_ticks > max_abs) max_abs = abs_ticks;

        f << t << "," << pos << "," << err_ticks << "," << err_grados << "\n";
        std::cout << "Consigna: " << t
                  << "  Leido: "  << pos
                  << "  Error: "  << err_ticks << " ticks ("
                  << err_grados << " grados)\n";
    }

    f.close();

    double prom_ticks = suma_abs / n_targets;
    std::cout << "\nError promedio: " << prom_ticks << " ticks ("
              << prom_ticks * GRADOS_POR_TICK << " grados)\n";
    std::cout << "Error maximo:   " << max_abs << " ticks ("
              << max_abs * GRADOS_POR_TICK << " grados)\n";
    std::cout << "Resolucion del codificador: " << GRADOS_POR_TICK
              << " grados por tick\n";
    std::cout << "Guardado en " << filename << "\n";

    st.end();
    return 0;
}
