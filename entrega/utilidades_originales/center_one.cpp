#include "SMS_STS.h"
#include <cstdio>
#include <cstdlib>

int main(int argc, char **argv) {
    if (argc < 2) {
        printf("Uso: %s <id_servo>\n", argv[0]);
        return 1;
    }
    int id = atoi(argv[1]);

    SMS_STS sm;
    if (!sm.begin(1000000, "/dev/ttyACM0")) {
        printf("Error al abrir el puerto\n");
        return 1;
    }

    if (sm.WritePosEx(id, 2048, 1000, 50)) {
        printf("Servo %d -> posicion 2048 OK\n", id);
    } else {
        printf("Servo %d -> FALLO al escribir\n", id);
    }

    sm.end();
    return 0;
}
