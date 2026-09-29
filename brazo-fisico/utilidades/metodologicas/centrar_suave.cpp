// Centrado suave de los seis servos del SO-ARM100 en 2048 pasos (postura init).
//
// Reemplaza a originales/center_servos.cpp para el uso diario. Aquella versión
// manda los seis servos a 2048 a 1000 pasos/s con aceleración 50, cada uno por
// su cuenta: desde home el hombro recorre unos 100° en un segundo y el brazo
// se levanta de golpe. Ésta:
//   1. lee dónde está cada servo y el voltaje de la fuente;
//   2. calcula una duración común para que todos lleguen a la vez, con el más
//      lejano a VEL_MAX pasos/s (unos 26°/s);
//   3. arranca los seis juntos (SyncWritePosEx) con aceleración baja;
//   4. espera y muestra dónde quedó cada uno.
// Uso: centrar_suave [/dev/ttyACM0]
#include "SCServo.h"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <thread>

static const int N = 6;
static const int CENTRO = 2048;
static const int VEL_MAX = 300;   // pasos/s del servo más lejano (0,088° por paso)
static const int VEL_MIN = 20;    // pasos/s mínimos, para que ninguno quede sin mover
static const int ACC = 10;        // en unidades de 100 pasos/s²: 1000 pasos/s²

int main(int argc, char **argv) {
    const char *puerto = argc > 1 ? argv[1] : "/dev/ttyACM0";
    SMS_STS sm;
    if (!sm.begin(1000000, puerto)) {
        std::printf("No se pudo abrir %s.\n", puerto);
        return 1;
    }
    u8 ids[N];
    s16 meta[N];
    u16 vel[N];
    u8 acc[N];
    int pos[N];
    int mayor = 0;
    for (int i = 0; i < N; i++) {
        ids[i] = i + 1;
        pos[i] = sm.ReadPos(i + 1);
        if (pos[i] < 0) {
            std::printf("El servo %d no responde. No se mueve nada.\n", i + 1);
            sm.end();
            return 1;
        }
        mayor = std::max(mayor, std::abs(pos[i] - CENTRO));
    }
    int voltaje = sm.ReadVoltage(1);   // en décimas de voltio
    std::printf("Fuente: %.1f V\n", voltaje / 10.0);
    if (voltaje > 0 && voltaje < 68) {
        std::printf("El voltaje es bajo (menos de 6,8 V): los servos no tendrán fuerza para sostener el brazo.\n"
                    "Revise o cargue la fuente. No se mueve nada.\n");
        sm.end();
        return 1;
    }
    double duracion = std::max(1.0, mayor / double(VEL_MAX));
    std::printf("Recorrido mayor: %d pasos (%.0f°). Duración: %.1f s. Sostenga el brazo.\n",
                mayor, mayor * 360.0 / 4096.0, duracion);
    for (int i = 0; i < N; i++) {
        int d = std::abs(pos[i] - CENTRO);
        meta[i] = CENTRO;
        vel[i] = std::max(VEL_MIN, int(d / duracion + 0.5));
        acc[i] = ACC;
        std::printf("  servo %d: %4d -> %d  (%3d pasos/s)\n", i + 1, pos[i], CENTRO, vel[i]);
    }
    sm.SyncWritePosEx(ids, N, meta, vel, acc);
    std::this_thread::sleep_for(std::chrono::milliseconds(int(duracion * 1000) + 1200));
    std::printf("Posición final:\n");
    for (int i = 0; i < N; i++) {
        int p = sm.ReadPos(i + 1);
        std::printf("  servo %d: %4d  (error %+.1f°)\n", i + 1, p, (p - CENTRO) * 360.0 / 4096.0);
    }
    sm.end();
    return 0;
}
