#include "SMS_STS.h"
#include <cstdio>
#include <cstdlib>
#include <unistd.h>

int main(int argc, char **argv)
{
    if (argc < 4) {
        printf("Uso: %s <puerto> <id_actual> <id_nuevo>\n", argv[0]);
        printf("Ejemplo: %s /dev/ttyACM0 1 2\n", argv[0]);
        return 1;
    }

    const char *port = argv[1];
    int old_id = atoi(argv[2]);
    int new_id = atoi(argv[3]);

    SMS_STS sm;
    if (!sm.begin(1000000, port)) {
        printf("Error al abrir el puerto %s\n", port);
        return 1;
    }

    printf("Buscando servo con ID %d...\n", old_id);
    if (sm.Ping(old_id) != old_id) {
        printf("No se encontro respuesta del servo con ID %d\n", old_id);
        sm.end();
        return 1;
    }
    printf("Servo encontrado. Cambiando ID %d -> %d\n", old_id, new_id);

    sm.unLockEprom(old_id);
    usleep(50000);
    sm.writeByte(old_id, SMS_STS_ID, (u8)new_id);
    usleep(50000);
    sm.LockEprom(new_id);
    usleep(50000);

    printf("Verificando nuevo ID...\n");
    if (sm.Ping(new_id) == new_id) {
        printf("Exito: el servo ahora responde en ID %d\n", new_id);
    } else {
        printf("Advertencia: no se pudo confirmar el nuevo ID, verifica manualmente\n");
    }

    sm.end();
    return 0;
}
