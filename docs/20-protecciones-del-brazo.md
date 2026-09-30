# 20 — Protecciones del brazo físico

[← Anterior: Programar](19-programar.md) · [Volver al inicio](../README.md) · [Siguiente: Mapa del repositorio →](21-mapa-del-repositorio.md)

---

> **Estado:** escrito el 29 de septiembre de 2026, después de que el brazo saltara de `home` a `init` al encender la fuente con el USB conectado. El limitador pasó sus pruebas fuera de ROS (`pruebas/proteccion/prueba_limitador.cpp`). La compilación dentro del workspace y la prueba con el brazo real las hace `scripts/proteger_brazo.sh` en el equipo del proyecto; si la compilación falla, deja el controlador original.

## Qué pasaba

El controlador de hardware (`so_arm_100_hardware`) escribe en cada ciclo, 100 veces por segundo, la posición pedida a cada servo, con la velocidad interna del servo: 2400 pasos/s, unos 211°/s. Mientras el brazo está donde se le pide, cada escritura mueve una fracción de grado y el movimiento es suave. Pero si el brazo **no** está donde se le pide, el servo salta hasta allí a esa velocidad. Pasaba en tres casos:

| Caso | Qué veía el operador |
|---|---|
| Se apaga y se enciende la fuente con una sesión abierta | Al volver la corriente, el brazo salta de donde quedó a `init` |
| `centrar` desde `home` | Los seis servos iban a 2048 a 1000 pasos/s, cada uno por su cuenta: el hombro recorría 100° en un segundo |
| Se cierra la sesión en `home` | Al quitar el par, el brazo caía unos 19° hasta apoyarse |

Además, con la fuente por debajo de unos 6,8 V los servos no tienen fuerza para sostener `init` y oscilan.

## Qué se cambió

| Protección | Dónde | Qué hace |
|---|---|---|
| **Limitador de saltos** | `brazo-fisico/proteccion/limitador.hpp`, aplicado al controlador por `scripts/proteger_brazo.sh` | La orden que llega al servo nunca cambia más rápido que 2,5 rad/s. Si un servo deja de responder (fuente apagada) y vuelve, o si el brazo está a más de 1 rad de su orden (movido a mano), la orden se reinicia en la posición medida y vuelve a la pedida a 0,3 rad/s. El primer movimiento de cada sesión también es a 0,3 rad/s |
| **Comprobación antes de dar par** | `brazo-fisico/proteccion/comprobar_brazo.cpp`, llamada por `soarm.sh` en `real` y `ambos` | No arranca si falta un servo, si la fuente marca menos de 6,8 V o si un servo pasa de 55 °C. Tampoco arranca si el controlador no tiene el limitador |
| **Centrado suave** | `brazo-fisico/utilidades/metodologicas/centrar_suave.cpp` (atajo `centrar` y botón de la aplicación) | Lee dónde está cada servo, comprueba el voltaje y mueve los seis juntos a unos 26°/s |
| **`home` apoyada** | `scripts/poses_seguras.json` | `home` pasa a ser la postura en que el brazo queda apoyado por su peso (hombro −1,70 rad, codo 1,41, muñeca 1,22), medida con los codificadores. Al quitar el par ya no cae |
| **Trayectorias de la aplicación** | `app/estudio/puente_ros.py` | Rechaza trayectorias que pidan más de 1,6 rad/s en una articulación |
| **Aviso en el menú** | `scripts/soarm.sh` | Recuerda no apagar la fuente con la sesión abierta |

La teleoperación no cambia: el limitador sólo actúa ante saltos. Un gesto rápido pide como mucho unos 2 rad/s, y el propio servo no va más rápido que 1,5 rad/s (ensayo A5).

## Instalación

Una vez, en la terminal de Ubuntu:

```bash
cd ~/so-arm100-teleop
bash scripts/proteger_brazo.sh
```

Debe terminar con «Protección contra saltos instalada». `bash scripts/soarm.sh instalar` la aplica también en una instalación nueva.

## Reglas de uso

1. Encender la fuente **antes** de iniciar la sesión, con el brazo en `home`.
2. Cerrar siempre con **Home y apagar** (`h`) y sólo después apagar la fuente.
3. No usar `centrar` con una sesión abierta (el atajo lo impide).
4. Si la comprobación dice que la fuente está baja, revisarla antes de seguir.

## Archivos

| Archivo | Qué es |
|---|---|
| `brazo-fisico/proteccion/limitador.hpp` | Limitador de saltos, sin dependencias de ROS |
| `brazo-fisico/proteccion/aplicar.py` | Agrega el limitador al controlador del workspace; guarda copias `.sin_proteccion` |
| `brazo-fisico/proteccion/comprobar_brazo.cpp` | Comprobación de servos, voltaje y temperatura |
| `scripts/proteger_brazo.sh` | Aplica, compila y, si falla, restaura |
| `pruebas/proteccion/prueba_limitador.cpp` | Ocho pruebas del limitador: arranque, corte de fuente, saltos, teleoperación rápida, pinza y ciclos lentos |

---

[← Anterior: Programar](19-programar.md) · [Volver al inicio](../README.md) · [Siguiente: Mapa del repositorio →](21-mapa-del-repositorio.md)
