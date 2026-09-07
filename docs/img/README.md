# Capturas de pantalla

Esta carpeta contiene las imágenes que ilustran las guías de instalación.

## Capturas pendientes de subir

Los documentos ya referencian estos archivos. Exporta cada captura desde el
documento de Google y súbela aquí **con el nombre exacto** de la tabla; los
`![...]` de los `.md` se enlazan solos, sin tocar nada más.

| Archivo | Aparece en | Qué debe mostrar |
|---|---|---|
| `01-vbox-instalador.png` | [01](../01-instalacion-maquina-virtual.md) | Advertencia de desconexión de red del instalador de VirtualBox |
| `02-vbox-instalado.png` | 01 | Pantalla final del instalador de VirtualBox |
| `03-vbox-nueva-maquina.png` | 01 | Diálogo "Nueva": nombre, tipo, versión, ISO, casilla de omitir instalación desatendida |
| `04-vbox-sistema-ram.png` | 01 | Pestaña Sistema → Placa Base con la RAM asignada |
| `05-vbox-procesador.png` | 01 | Pestaña Sistema → Procesador con los núcleos asignados |
| `06-vbox-pantalla-3d.png` | 01 | Pestaña Pantalla: 128 MB, VMSVGA, aceleración 3D marcada |
| `07-vbox-red-puente.png` | 01 | Pestaña Red con Adaptador puente |
| `08-vbox-usb-xhci.png` | 01 | Pestaña USB con Controlador USB 3.0 (xHCI) |
| `09-ubuntu-instalacion.png` | 01 | Instalador de Ubuntu en marcha |
| `10-ubuntu-terminal.png` | 01 | Terminal de Ubuntu recién abierta |
| `11-vbox-webcam.png` | 01 | Menú Dispositivos → Webcams con la cámara seleccionada |
| `12-rufus.png` | [02](../02-instalacion-nativa-iso.md) | Rufus configurado con GPT + UEFI |
| `13-ubuntu-particionado.png` | 02 | Pantalla de tipo de instalación / particionado |

## Cómo exportar las imágenes del documento de Google

**Opción rápida (recomendada):** Google Docs → **Archivo → Descargar → Página web (.html, comprimido)**. Se descarga un `.zip` con una carpeta `images/` que ya contiene todas las imágenes del documento en su resolución original. Renómbralas según la tabla de arriba.

**Opción manual:** clic derecho sobre cada imagen → *Guardar imagen como*. Sirve, pero es lento y a veces guarda una versión reescalada.

## Convenciones

- Formato **PNG** para capturas de interfaz (texto nítido), **JPG** solo para fotos.
- Ancho máximo **1600 px**: por encima de eso GitHub las reescala igual y solo pesan más.
- Si una captura muestra tu nombre de usuario, correo o cualquier dato personal, recórtalo o difumínalo antes de subirla — el repositorio es público.
