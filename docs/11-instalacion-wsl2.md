# 11 — Instalación en WSL2

[← Anterior: espejo simulación ↔ robot real](10-espejo-simulacion-y-robot-real.md) · [Volver al inicio](../README.md) · [Siguiente: cierre del proyecto →](12-cierre-del-proyecto.md)

---

> ## Alcance de este documento
>
> **Lo verificado:** que el sistema corre bajo WSL2 y que la cámara funciona pasándola por `usbipd`. Concretamente, la teleoperación por visión se ejecutó en esta configuración el **10/09/2026**, y el paquete del brazo físico se compiló allí.
>
> **Lo no verificado:** el procedimiento paso a paso de abajo. Está escrito a partir de la configuración que funcionó, pero **nadie lo ha seguido desde cero sobre una máquina limpia**. Si lo sigues y encuentras una diferencia, corrígela aquí.
>
> La ruta probada desde cero es la de [docs/01 — máquina virtual](01-instalacion-maquina-virtual.md).

---

## Por qué WSL2 y no VirtualBox

WSL2 tiene dos ventajas prácticas sobre la máquina virtual para este proyecto:

- **Gazebo va notablemente mejor.** WSL2 usa aceleración gráfica del anfitrión a través de WSLg, mientras que VirtualBox depende del controlador virtual y, en la práctica, obliga a `LIBGL_ALWAYS_SOFTWARE=1` para que la ventana 3D no salga en blanco. Con software rendering, Gazebo va a pocos cuadros por segundo.
- **No hay que reservar RAM ni disco por adelantado.**

Y una desventaja que domina todo lo demás:

- **El acceso a dispositivos USB no es directo.** Ni la cámara ni la placa de servos aparecen solas. Hay que pasarlas explícitamente desde Windows con `usbipd`, y ese es el grueso de este documento.

---

## Requisitos

| Componente | Requisito |
|---|---|
| Windows | 11, o Windows 10 versión 21H2 o superior |
| WSL | WSL2 con WSLg (viene de serie en Windows 11) |
| Distribución | **Ubuntu 22.04 LTS** — obligatorio, igual que en las demás rutas |
| `usbipd-win` | Instalado en **Windows**, no dentro de WSL |

---

## 1. Ubuntu 22.04 bajo WSL2

Desde PowerShell **como administrador**, en Windows:

```powershell
wsl --install -d Ubuntu-22.04
wsl --set-default-version 2
```

Se comprueba que quedó en versión 2, porque WSL1 no sirve:

```powershell
wsl -l -v
```

Debe decir `VERSION  2` junto a `Ubuntu-22.04`.

---

## 2. El resto de la instalación es idéntico

Una vez dentro de Ubuntu, el procedimiento es el mismo que en cualquier otra ruta:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Edangelux/so-arm100-teleop.git ~/so-arm100-teleop
cd ~/so-arm100-teleop && bash scripts/install.sh
```

**Bajo WSL2 no se usa `LIBGL_ALWAYS_SOFTWARE=1`.** Ese ajuste es para VirtualBox; bajo WSLg la aceleración funciona y forzar software rendering solo lo haría lento.

---

## 3. Pasar la cámara a WSL

Esta es la parte que no tiene equivalente en las otras rutas.

**En Windows**, instala `usbipd-win` una sola vez:

```powershell
winget install --interactive --exact dorssel.usbipd-win
```

Se cierra y se vuelve a abrir PowerShell. Luego, **como administrador**, se listan los dispositivos:

```powershell
usbipd list
```

Se identifica la cámara por su nombre y se anota su `BUSID` (algo como `1-6`). Después:

```powershell
usbipd bind   --busid 1-6
usbipd attach --wsl --busid 1-6
```

`bind` se hace una vez. `attach` hay que repetirlo **cada vez que se reinicia Windows o WSL**.

Comprobación dentro de Ubuntu:

```bash
ls -l /dev/video*
```

Si no aparece nada, el `attach` no surtió efecto.

---

## 4. El arreglo de la cámara: obligatorio bajo WSL2

**Este es el punto que hace fallar la teleoperación bajo WSL2 aunque `/dev/video0` exista.**

Muchas cámaras integradas exponen MJPG como único formato nativo, a resolución alta. Abrir la cámara sin especificar nada hace que OpenCV intente negociar un formato crudo (YUYV), y sobre el bus USB/IP virtual eso **se queda colgado en `select()`**: el script no da error, simplemente no arranca.

El síntoma es un bloqueo silencioso al abrir la cámara, no un mensaje de error.

`teleop_vision.py` ya trae el arreglo. Se activa con una variable de entorno:

```bash
export SOARM_CAMERA_MJPG=1
python3 ~/so-arm100-teleop/teleop_vision/teleop_vision.py
```

Lo que hace es forzar el backend V4L2, el fourcc MJPG y una resolución de 640×480, que es además la resolución de trabajo del proyecto.

> **Fuera de WSL2 esa variable no se define.** En máquina virtual y en instalación nativa la apertura simple funciona, y forzar MJPG podría fallar con cámaras que no lo expongan.

Para no tener que escribirlo cada vez:

```bash
echo 'export SOARM_CAMERA_MJPG=1' >> ~/.bashrc
```

> **La versión 13, la presentada, ya fuerza V4L2, MJPG y 640×480 en su propio código**, así que con `bash scripts/soarm.sh` esta variable no hace falta. Sólo la necesita el nodo anterior, `teleop_vision/teleop_vision.py`.

---

## 5. Pasar la placa de servos (sólo con el brazo físico)

Mismo procedimiento que la cámara. Con la placa conectada, en PowerShell como administrador:

```powershell
usbipd list
usbipd bind   --busid <BUSID de la placa>
usbipd attach --wsl --busid <BUSID de la placa>
```

Y dentro de Ubuntu:

```bash
ls -l /dev/ttyUSB* /dev/ttyACM*
```

Si la placa aparece como `ttyACM0` en lugar de `ttyUSB0`, conviene leer el bloqueo 3 de [docs/09](09-robot-fisico.md) antes de seguir. Con el xacro del overlay de la fase 5 el argumento `serial_port` se ignora en silencio; con el workspace de la entrega, que es el que se operó bajo WSL2 con `/dev/ttyACM0`, el argumento llega al driver. El lanzador `scripts/soarm.sh` usa ese workspace.

El grupo `dialout` se aplica igual que en las demás rutas; lo hace `scripts/06_brazo_fisico.sh`. Bajo WSL, «cerrar sesión y volver a entrar» significa:

```powershell
wsl --shutdown
```

y volver a abrir Ubuntu.

---

## Diagnóstico

| Síntoma | Causa |
|---|---|
| El script se queda colgado al abrir la cámara, sin mensaje | Falta `export SOARM_CAMERA_MJPG=1` |
| `/dev/video0` no existe | Falta `usbipd attach`, o se perdió al reiniciar |
| `/dev/video0` desaparece tras reiniciar Windows | Normal: `attach` no es persistente, hay que repetirlo |
| Gazebo va muy lento | Comprobar que **no** esté definida `LIBGL_ALWAYS_SOFTWARE=1` |
| `wsl -l -v` dice `VERSION 1` | `wsl --set-version Ubuntu-22.04 2` |
| `usbipd: command not found` | Se instala en Windows, no dentro de WSL |

El resto de errores son comunes a todas las rutas y están en [docs/06](06-solucion-de-problemas.md).

---

## Créditos

La configuración bajo WSL2 y el diagnóstico del bloqueo de la cámara sobre el bus USB/IP son trabajo de **Cristhian E. Guido Meléndez**.
