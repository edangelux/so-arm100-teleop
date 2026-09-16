# Registro de operación del brazo físico

Esta carpeta está vacía a propósito. Aquí van los cuatro archivos que acreditan
que el brazo físico responde por el bus serie:

| Archivo | Qué acredita |
|---|---|
| `01_interfaces.txt` | El sistema reconoce el hardware físico |
| `02_controladores.txt` | Los controladores del lado físico están activos |
| `03_telemetria.txt` | Los codificadores reportan posición real |
| `04_consignas.txt` | La consigna del script llega al brazo físico |

Los comandos que los generan están en
[docs/09 — Generar el registro de operación](../docs/09-robot-fisico.md#generar-el-registro-de-operación).

Mientras esta carpeta siga sin esos archivos, la fila correspondiente de la
tabla de estado de [docs/09](../docs/09-robot-fisico.md) dice **no existe**, y
así debe quedarse.
