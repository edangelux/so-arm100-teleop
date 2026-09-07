# 01 — Instalación en Máquina Virtual (VirtualBox)

[← Volver al inicio](../README.md) · [Siguiente: instalación local por ISO →](02-instalacion-nativa-iso.md)

---

# Guía paso a paso para el robot SO-ARM100 — Teleoperación

Existen en este caso **2 opciones probadas** para poder realizar todo mediante Linux Ubuntu 22.04 LTS:

**1) Máquina virtual** · **2) Instalación local por ISO**

Existen otras formas y maneras de tener Linux, pero estas son las habituales y las que yo he probado que funcionan.

Elige qué opción tomarás:

1. **[Máquina virtual](01-instalacion-maquina-virtual.md)** ← esta guía
   Está más vista para computadoras que tienen buen procesador, gráfica y RAM de sobra.

2. **[Instalación ISO](02-instalacion-nativa-iso.md)**
   Está más vista para computadoras que tienen *stats* básicos o generales. Se necesita tener una USB y un disco duro aparte, o un espacio de almacenamiento de 50 GB: en una USB, en el mismo disco duro que tienes para Windows, o en uno externo.

---

ROS 2 Humble requiere de forma estricta **Ubuntu 22.04 LTS**. Versiones más recientes (como 24.04) o anteriores (20.04) generan incompatibilidades directas con las dependencias binarias de ROS y Gazebo.

Descarga la imagen ISO oficial:

- **Archivo ISO:** [Ubuntu 22.04.5 LTS Desktop (64-bit)](https://releases.ubuntu.com/22.04/)

![Página de descargas de Ubuntu 22.04](img/vm-01-iso-releases-ubuntu.png)

![Descarga de la ISO](img/vm-02-iso-descarga.png)

---

## Opción 1: Instalación en Máquina Virtual (VirtualBox)

Esta opción permite trabajar dentro de Windows sin modificar particiones de disco.

### 1. Requisitos de asignación en VirtualBox

| Recurso | Mínimo requerido | Recomendado |
| :- | :- | :- |
| **Memoria RAM** | 4096 MB (4 GB) | 6144 MB – 8192 MB (6–8 GB) |
| **Procesadores (Cores)** | 2 CPUs | 4 CPUs |
| **Disco Virtual** | 40 GB (VDI Dinámico) | 60 GB – 80 GB |
| **Memoria de Video** | 128 MB | 128 MB + Aceleración 3D habilitada |

---

### 2. Instalación de VirtualBox y Extension Pack

Instala **VirtualBox** y el **VirtualBox Extension Pack** correspondiente a la misma versión desde la web oficial de Oracle. El Extension Pack es obligatorio para habilitar el controlador USB 3.0, que es el que permite transferir la webcam del host a la máquina virtual.

Bueno, no es necesario que sea VirtualBox, sino que cualquier máquina virtual sirve: puede ser **VMware**, **QEMU/KVM**, **Xen Project** o **VirtualBox**.

Yo elegí VirtualBox por practicidad, pero es mejor VMware.

Link de descarga de VirtualBox:

<https://www.virtualbox.org/wiki/Downloads>

![Web de descargas de VirtualBox](img/vm-03-vbox-web-descarga.png)

![Instalador de VirtualBox](img/vm-04-vbox-instalador-1.png)

![Instalador de VirtualBox](img/vm-05-vbox-instalador-2.png)

![Instalador de VirtualBox](img/vm-06-vbox-instalador-3.png)

**Se desconectará el internet mientras se instala.**

![Aviso de desconexión de red](img/vm-07-vbox-aviso-internet.png)

No entraré en profundidad en esto, solo dale a **Yes** y ya.

![Aviso de dependencias](img/vm-08-vbox-aviso-yes-1.png)

![Aviso de dependencias](img/vm-09-vbox-aviso-yes-2.png)

Le das a **Install**.

![Botón Install](img/vm-10-vbox-boton-install.png)

Finalizamos con la instalación de VirtualBox, listo.

![Instalación finalizada](img/vm-11-vbox-instalacion-finalizada.png)

---

### 3. Crear la máquina virtual

Abre VirtualBox y haz clic en **Nueva**:

- **Nombre:** `Robotcito`
- **Tipo:** Linux
- **Versión:** Ubuntu (64-bit)
- **Imagen ISO:** selecciona el archivo `.iso` descargado
- Marca la casilla **Omitir instalación desatendida** (*Unattended Installation*) para configurar usuario y contraseñas manualmente

> Marcar **Omitir instalación desatendida** es lo que hace que después el instalador de Ubuntu te pregunte idioma, teclado, usuario y contraseña pantalla por pantalla. Si la dejas sin marcar, VirtualBox te pide esos datos en el asistente y luego instala solo, sin preguntarte nada.

![Diálogo Nueva máquina virtual](img/vm-12-vbox-nueva-1.png)

![Casilla Omitir instalación desatendida](img/vm-13-vbox-nueva-2.png)

---

### 4. Ajustes críticos de la máquina virtual (antes de iniciar)

Haz clic derecho en la máquina virtual → **Configuración**:

- **Sistema → Placa Base:** asigna mínimo 4096 MB de RAM.
- **Sistema → Procesador:** asigna 2 o 4 núcleos.
- **Pantalla → Pantalla:**
  - Memoria de video: **128 MB**
  - Controlador gráfico: **VMSVGA**
  - Marca la casilla **Habilitar aceleración 3D** (indispensable para la interfaz gráfica de Gazebo y RViz)
- **USB:** selecciona **Controlador USB 3.0 (xHCI)**

![Configuración de la máquina virtual](img/vm-14-vbox-config-1.png)

![Configuración de la máquina virtual](img/vm-15-vbox-config-2.png)

![Configuración de la máquina virtual](img/vm-16-vbox-config-3.png)

Si en el caso que arranque la máquina virtual, apágala dándole a la **X** en la pantalla minimizada que corre. Le das a **Apagar** y **Aceptar**.

![Apagar la máquina virtual](img/vm-17-vbox-apagar-maquina.png)

Le darás a **Configuración** para asignar el uso de cámara, y para que más adelante puedas conectar el robot y funcionen los puertos USB con la máquina virtual.

![Abrir Configuración](img/vm-18-vbox-abrir-configuracion.png)

Configuramos la pantalla, la disposición de video y la aceleración 3D.

![Pantalla, memoria de video y aceleración 3D](img/vm-19-vbox-pantalla-3d.png)

Ve a **Red** y configura el **NAT** a **Adaptador puente**, así usa la misma tarjeta de red tanto tu PC como la máquina virtual.

![Red en modo Adaptador puente](img/vm-20-vbox-red-puente.png)

Ve a **USB**, para la entrada de los servomotores. Si no los tienes, *chill*: esto es por si en el dado caso tienes el robot en físico y quieras accionarlo.

![USB para los servomotores](img/vm-21-vbox-usb-servomotores.png)

---

### 5. Instalar Ubuntu

Enciende la máquina virtual con **doble clic** encima de ella.

![Encender la máquina virtual](img/vm-22-vbox-encender-maquina.png)

Ahora sí empieza la instalación de Ubuntu. Como marcaste **Omitir instalación desatendida**, el instalador te va a ir preguntando todo pantalla por pantalla. Vas dándole siguiente con las opciones por defecto; espera a que termine.

![Instalador de Ubuntu](img/vm-23-ubuntu-instalador-1.png)

![Instalador de Ubuntu](img/vm-24-ubuntu-instalador-2.png)

![Instalador de Ubuntu](img/vm-25-ubuntu-instalador-3.png)

![Instalador de Ubuntu](img/vm-26-ubuntu-instalador-4.png)

![Instalador de Ubuntu](img/vm-27-ubuntu-instalador-5.png)

Recuerda la contraseña que colocas y el usuario.

> ## ⚠️ PERO EN SERIO RECUERDA BIEN LA CONTRASEÑA
> **POR LO MÁS SAGRADO DEL MUNDO. NO ES BROMA, ES ADVERTENCIA, COMPLETAMENTE EN SERIO.**
>
> La vas a escribir decenas de veces con `sudo` durante toda la instalación de ROS. Si la pierdes, la única salida práctica es reinstalar todo desde cero.

![Usuario y contraseña](img/vm-28-ubuntu-usuario-password-1.png)

![Usuario y contraseña](img/vm-29-ubuntu-usuario-password-2.png)

Denle a **Upgrade**.

![Upgrade](img/vm-30-ubuntu-upgrade-1.png)

![Upgrade](img/vm-31-ubuntu-upgrade-2.png)

Y reiniciar.

![Reiniciar](img/vm-32-ubuntu-reiniciar.png)

---

### 6. Abrir la terminal

Abres terminal como en la imagen, o por comando **Ctrl + Alt + T**.

![Abrir la terminal](img/vm-33-ubuntu-terminal-1.png)

![Terminal abierta](img/vm-34-ubuntu-terminal-2.png)

---

### 7. Conectar la webcam

Antes que sigamos, porque vamos a ocupar la webcam, haz esta configuración: ve a **Dispositivos → Webcams** y selecciónala.

![Dispositivos → Webcams](img/vm-35-vbox-webcam.png)

Comprueba que Ubuntu la ve:

```bash
ls -l /dev/video*
```

Debe aparecer al menos `/dev/video0`. Si no aparece nada, revisa que el **Extension Pack** esté instalado y que la cámara no esté siendo usada por otra aplicación en Windows (Zoom, Teams, la app Cámara).

---

### 8. Antes de los comandos

Ahora sí vamos con comandos. **Ten cuidado con cómo colocas los comandos**: si le colocas un espacio o algo de más, no van a funcionar o puedes dañar algo.

Si es posible, configura tu VirtualBox para que sea **copiar y pegar bidireccional** (no voy a enseñar eso porque no es totalmente necesario).

> Está en **Dispositivos → Portapapeles compartido → Bidireccional**, con la máquina encendida.

Y si quieres pantalla completa de verdad y que la ventana se redimensione sola, instala las **Guest Additions**: menú superior de VirtualBox → **Dispositivos → Insertar imagen de CD de las «Guest Additions»**, y luego en la terminal:

```bash
sudo apt update && sudo apt install -y build-essential dkms linux-headers-$(uname -r)
sudo /media/$USER/VBox_GAs_*/VBoxLinuxAdditions.run
sudo reboot
```

---

## Listo

Ya tienes Ubuntu 22.04 funcionando. Continúa con:

**[→ 03 — Instalación de ROS 2 Humble](03-instalacion-ros2.md)**

O, si prefieres que un script haga todos los comandos de terminal por ti:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Edangelux/so-arm100-teleop.git ~/so-arm100-teleop
cd ~/so-arm100-teleop && ./scripts/install.sh
```
