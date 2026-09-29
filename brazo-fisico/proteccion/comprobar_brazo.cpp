// Comprobación del brazo antes de darle par (la ejecuta soarm.sh en real y ambos).
// Falla (código 1) si falta algún servo, si la fuente está por debajo de 6,8 V o si
// algún servo pasa de 55 °C. No mueve nada: sólo lee.
// Uso: comprobar_brazo [/dev/ttyACM0]
#include "SCServo.h"
#include <cstdio>

int main(int argc, char **argv) {
    const char *puerto = argc > 1 ? argv[1] : "/dev/ttyACM0";
    SMS_STS sm;
    if (!sm.begin(1000000, puerto)) { std::printf("No se pudo abrir %s.\n", puerto); return 1; }
    int fallos = 0, vmin = 1000, tmax = 0;
    for (int id = 1; id <= 6; id++) {
        if (sm.FeedBack(id) == -1) { std::printf("  servo %d: NO RESPONDE\n", id); fallos++; continue; }
        int v = sm.ReadVoltage(-1), t = sm.ReadTemper(-1), p = sm.ReadPos(-1);
        std::printf("  servo %d: posición %4d  %.1f V  %d °C\n", id, p, v / 10.0, t);
        if (v < vmin) vmin = v;
        if (t > tmax) tmax = t;
    }
    sm.end();
    if (fallos) { std::printf("Faltan %d servos: revise que la fuente esté encendida y los cables.\n", fallos); return 1; }
    if (vmin < 68) { std::printf("Fuente en %.1f V (mínimo 6,8 V): los servos no tendrían fuerza para sostener el brazo.\n", vmin / 10.0); return 1; }
    if (tmax > 55) { std::printf("Un servo está a %d °C (máximo 55 °C): deje enfriar el brazo.\n", tmax); return 1; }
    std::printf("Brazo en orden: 6 servos, fuente %.1f V, temperatura máxima %d °C.\n", vmin / 10.0, tmax);
    return 0;
}
