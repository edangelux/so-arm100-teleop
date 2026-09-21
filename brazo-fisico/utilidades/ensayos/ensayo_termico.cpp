// Ensayo A4: comportamiento térmico de los servos STS3215 en uso continuo.
//
// Trabaja directamente sobre el bus serie, sin ROS: ROS no publica la
// temperatura de los servos y, mientras el lanzador está abierto, el puerto
// tiene dueño. Por eso se ejecuta con el lanzador CERRADO.
//
// Lleva los seis servos a 2048 pasos (la postura init: brazo vertical y
// antebrazo horizontal, que ya carga al hombro y al codo) y mueve en vaivén
// el hombro (ID 2), el codo (ID 3) y la flexión de muñeca (ID 4) ±AMPLITUD
// grados alrededor de esa postura, cambiando de sentido cada 3 s. Cada 10 s
// registra en CSV la posición, temperatura, carga, tensión y corriente de los
// seis servos. Se detiene al cumplir el tiempo, al pulsar Ctrl+C o cuando
// algún servo alcanza el LÍMITE de temperatura; en los tres casos vuelve a
// 2048 despacio y deja el par activado.
//
// Compilación:
//   SCS=~/ros2_ws_entrega/src/so_arm_100_hardware/include/SCServo_Linux
//   g++ -std=c++14 -O2 -I $SCS ensayo_termico.cpp $SCS/*.cpp -o ~/ensayo_termico
// Uso:
//   ~/ensayo_termico [minutos=30] [amplitud_grados=20] [limite_C=55] [archivo.csv] [puerto=/dev/ttyACM0]
#include "SCServo.h"
#include <chrono>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <thread>

static volatile std::sig_atomic_t parar = 0;
static void al_interrumpir(int) { parar = 1; }

int main(int argc, char **argv) {
    const double minutos = argc > 1 ? std::atof(argv[1]) : 30.0;
    const double amplitud = argc > 2 ? std::atof(argv[2]) : 20.0;
    const int limite = argc > 3 ? std::atoi(argv[3]) : 55;
    const std::string archivo = argc > 4 ? argv[4] : "a4_termico.csv";
    const std::string puerto = argc > 5 ? argv[5] : "/dev/ttyACM0";
    if (minutos <= 0 || minutos > 180 || amplitud <= 0 || amplitud > 30 || limite < 40 || limite > 65) {
        std::fprintf(stderr, "Valores fuera de rango: minutos 0-180, amplitud 0-30 grados, limite 40-65 C.\n");
        return 2;
    }
    SMS_STS sm;
    if (!sm.begin(1000000, puerto.c_str())) {
        std::fprintf(stderr, "No se pudo abrir %s. ¿Está el lanzador abierto? Ciérrelo antes.\n", puerto.c_str());
        return 1;
    }
    for (int id = 1; id <= 6; id++) {
        if (sm.Ping(id) == -1) {
            std::fprintf(stderr, "El servo %d no responde; no se inicia el ensayo.\n", id);
            sm.end();
            return 1;
        }
    }
    FILE *f = std::fopen(archivo.c_str(), "w");
    if (!f) { std::fprintf(stderr, "No se pudo crear %s\n", archivo.c_str()); sm.end(); return 1; }
    std::fprintf(f, "# tipo: termico\n# minutos: %.1f\n# amplitud_grados: %.1f\n# limite_C: %d\n",
                 minutos, amplitud, limite);
    std::fprintf(f, "t_s,id,pos_ticks,temp_C,carga_pm,tension_V,corriente_A\n");
    std::signal(SIGINT, al_interrumpir);

    std::printf("Llevando los seis servos a 2048 (init)...\n");
    for (int id = 1; id <= 6; id++) sm.WritePosEx(id, 2048, 600, 20);
    std::this_thread::sleep_for(std::chrono::seconds(4));

    const int d = static_cast<int>(amplitud * 4096.0 / 360.0);
    const auto t0 = std::chrono::steady_clock::now();
    auto seg = [&]() {
        return std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    };
    double proximo_registro = 0.0, proximo_cambio = 0.0;
    int sentido = 1, maxima = 0;
    std::string motivo = "tiempo cumplido";
    std::printf("Ensayo: %.0f min, vaivén de ±%.0f grados en hombro, codo y muñeca. Ctrl+C para terminar.\n",
                minutos, amplitud);
    while (!parar && seg() < minutos * 60.0) {
        if (seg() >= proximo_cambio) {
            sm.WritePosEx(2, 2048 + sentido * d, 600, 30);
            sm.WritePosEx(3, 2048 - sentido * d, 600, 30);
            sm.WritePosEx(4, 2048 + sentido * d, 600, 30);
            sentido = -sentido;
            proximo_cambio += 3.0;
        }
        if (seg() >= proximo_registro) {
            maxima = 0;
            std::printf("t=%6.0f s ", seg());
            for (int id = 1; id <= 6; id++) {
                if (sm.FeedBack(id) == -1) { std::printf(" %d:--", id); continue; }
                const int pos = sm.ReadPos(-1), temp = sm.ReadTemper(-1), carga = sm.ReadLoad(-1);
                const double v = sm.ReadVoltage(-1) / 10.0, i = sm.ReadCurrent(-1) * 6.5 / 1000.0;
                std::fprintf(f, "%.1f,%d,%d,%d,%d,%.1f,%.3f\n", seg(), id, pos, temp, carga, v, i);
                std::printf(" %d:%dC", id, temp);
                if (temp > maxima) maxima = temp;
            }
            std::printf("\n");
            std::fflush(f);
            proximo_registro += 10.0;
            if (maxima >= limite) { motivo = "límite de temperatura"; break; }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    if (parar) motivo = "interrumpido";
    std::printf("Fin (%s). Volviendo a 2048 despacio; el par queda activado.\n", motivo.c_str());
    for (int id = 1; id <= 6; id++) sm.WritePosEx(id, 2048, 400, 20);
    std::this_thread::sleep_for(std::chrono::seconds(3));
    std::fprintf(f, "# fin: %s\n", motivo.c_str());
    std::fclose(f);
    sm.end();
    std::printf("Datos en %s\n", archivo.c_str());
    return 0;
}
