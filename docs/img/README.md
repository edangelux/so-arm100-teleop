# Capturas de pantalla

Esta carpeta contiene las imágenes que ilustran las guías de instalación.

Los archivos que hay aquí son **marcadores** que dicen "CAPTURA PENDIENTE". Los documentos ya los referencian, así que basta con reemplazar cada archivo por la captura real —**con el mismo nombre**— y los `![...]` se enlazan solos, sin tocar ningún `.md`.

## Cómo exportar las imágenes del documento de Google

**Opción rápida (recomendada):** Google Docs → **Archivo → Descargar → Página web (.html, comprimido)**.

Se descarga un `.zip` con una carpeta `images/` que ya contiene **todas** las imágenes del documento en su resolución original, y —esto es lo importante— **en el mismo orden en que aparecen en el documento**: `image1.png`, `image2.png`, `image3.png`… Así que solo tienes que renombrarlas en orden según la tabla de abajo.

**Opción manual:** clic derecho sobre cada imagen → *Guardar imagen como*. Sirve, pero es lento y a veces guarda una versión reescalada.

## Tabla de capturas

El orden de esta tabla es **exactamente** el orden en que las imágenes aparecen en el documento de Google, así que `image1` → primera fila, `image2` → segunda fila, y así sucesivamente.

| Archivo | Guía | Qué muestra |
|---|---|---|
| `vm-01-iso-releases-ubuntu.png` | 01 (VM) | Página releases.ubuntu.com/22.04 |
| `vm-02-iso-descarga.png` | 01 (VM) | Descargando el archivo .iso |
| `vm-03-vbox-web-descarga.png` | 01 (VM) | virtualbox.org/wiki/Downloads |
| `vm-04-vbox-instalador-1.png` | 01 (VM) | Primera pantalla del instalador |
| `vm-05-vbox-instalador-2.png` | 01 (VM) | Segunda pantalla del instalador |
| `vm-06-vbox-instalador-3.png` | 01 (VM) | Tercera pantalla del instalador |
| `vm-07-vbox-aviso-internet.png` | 01 (VM) | Se desconectará el internet mientras se instala |
| `vm-08-vbox-aviso-yes-1.png` | 01 (VM) | Dale a "Yes" y ya |
| `vm-09-vbox-aviso-yes-2.png` | 01 (VM) | Dale a "Yes" y ya |
| `vm-10-vbox-boton-install.png` | 01 (VM) | Le das a Install |
| `vm-11-vbox-instalacion-finalizada.png` | 01 (VM) | VirtualBox listo |
| `vm-12-vbox-nueva-1.png` | 01 (VM) | Nombre, tipo, versión e imagen ISO |
| `vm-13-vbox-nueva-2.png` | 01 (VM) | Casilla «Omitir instalación desatendida» |
| `vm-14-vbox-config-1.png` | 01 (VM) | Sistema → Placa Base (RAM) |
| `vm-15-vbox-config-2.png` | 01 (VM) | Sistema → Procesador (núcleos) |
| `vm-16-vbox-config-3.png` | 01 (VM) | Pantalla / USB |
| `vm-17-vbox-apagar-maquina.png` | 01 (VM) | Dale a la X → Apagar → Aceptar |
| `vm-18-vbox-abrir-configuracion.png` | 01 (VM) | Para cámara y puertos USB |
| `vm-19-vbox-pantalla-3d.png` | 01 (VM) | 128 MB, VMSVGA, aceleración 3D |
| `vm-20-vbox-red-puente.png` | 01 (VM) | NAT cambiado a Adaptador puente |
| `vm-21-vbox-usb-servomotores.png` | 01 (VM) | Controlador USB 3.0 (xHCI) |
| `vm-22-vbox-encender-maquina.png` | 01 (VM) | Doble clic encima de ella |
| `vm-23-ubuntu-instalador-1.png` | 01 (VM) | Try or Install Ubuntu |
| `vm-24-ubuntu-instalador-2.png` | 01 (VM) | Idioma |
| `vm-25-ubuntu-instalador-3.png` | 01 (VM) | Disposición del teclado |
| `vm-26-ubuntu-instalador-4.png` | 01 (VM) | Tipo de instalación |
| `vm-27-ubuntu-instalador-5.png` | 01 (VM) | Particionado del disco virtual |
| `vm-28-ubuntu-usuario-password-1.png` | 01 (VM) | Usuario y contraseña — RECUERDA LA CONTRASEÑA |
| `vm-29-ubuntu-usuario-password-2.png` | 01 (VM) | Usuario y contraseña — RECUERDA LA CONTRASEÑA |
| `vm-30-ubuntu-upgrade-1.png` | 01 (VM) | Denle a Upgrade |
| `vm-31-ubuntu-upgrade-2.png` | 01 (VM) | Denle a Upgrade |
| `vm-32-ubuntu-reiniciar.png` | 01 (VM) | Y reiniciar |
| `vm-33-ubuntu-terminal-1.png` | 01 (VM) | Desde el menú de aplicaciones |
| `vm-34-ubuntu-terminal-2.png` | 01 (VM) | O con Ctrl + Alt + T |
| `vm-35-vbox-webcam.png` | 01 (VM) | Dispositivos → Webcams → selecciona la tuya |
| `iso-01-rufus.png` | 02 (ISO) | GPT + UEFI (no CSM) |
| `iso-02-particionado.png` | 02 (ISO) | Tipo de instalación / particionado |

## Convenciones

- Formato **PNG** para capturas de interfaz (texto nítido), **JPG** solo para fotos.
- Ancho máximo **1600 px**: por encima de eso GitHub las reescala igual y solo pesan más.
- Si una captura muestra tu nombre de usuario, correo o cualquier dato personal, recórtalo o difumínalo antes de subirla — el repositorio es público.
