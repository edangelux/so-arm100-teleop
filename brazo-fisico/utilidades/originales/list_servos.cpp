#include "SMS_STS.h"
#include <cstdio>
#include <unistd.h>

int main() {
    SMS_STS sm;
    if (!sm.begin(1000000, "/dev/ttyACM0")) {
        printf("Error al abrir el puerto /dev/ttyACM0\n");
        return 1;
    }

    printf("Escaneando servos IDs 1-10...\n");
    printf("%-4s %-8s %-10s %-8s %-8s %-8s %-8s\n",
           "ID", "Estado", "Pos(ticks)", "Pos(deg)", "Speed", "Load", "Temp/V");

    int found = 0;
    for (int id = 1; id <= 10; id++) {
        if (sm.Ping(id) != -1) {
            found++;
            if (sm.FeedBack(id) != -1) {
                int pos = sm.ReadPos(-1);
                int speed = sm.ReadSpeed(-1);
                int load = sm.ReadLoad(-1);
                int temp = sm.ReadTemper(-1);
                int volt = sm.ReadVoltage(-1);
                double deg = (pos - 2048) * 360.0 / 4096.0;

                printf("%-4d %-8s %-10d %-8.1f %-8d %-8d %dC/%.1fV\n",
                       id, "OK", pos, deg, speed, load, temp, volt / 10.0);
            } else {
                printf("%-4d %-8s (ping OK pero feedback fallo)\n", id, "PARCIAL");
            }
        }
        usleep(20000); // 20ms entre pings
    }

    printf("\nTotal de servos encontrados: %d\n", found);

    sm.end();
    return 0;
}
