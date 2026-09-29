// Limitador de saltos para el controlador del SO-ARM100 (PROTECCION_SALTOS).
//
// El controlador de hardware escribe en cada ciclo la posición pedida a cada
// servo, con la velocidad interna del servo (2400 pasos/s, unos 211°/s). Si el
// brazo no está donde se le pide, el servo salta hasta allí a esa velocidad:
//   - al volver la corriente de la fuente con una sesión abierta;
//   - si alguien movió el brazo a mano, o se cayó sin par;
//   - si una orden llega con un salto grande.
// Este limitador se pone entre la orden y el servo:
//   1. la orden enviada nunca cambia más rápido que vel_max (2,5 rad/s);
//   2. si un servo deja de responder (fuente apagada) y vuelve, o si el brazo
//      está lejos de la última orden (más de desvio_max, 1 rad), la orden se reinicia
//      en la posición medida y vuelve a la pedida despacio, a vel_recuperacion
//      (0,3 rad/s, unos 17°/s), como la sincronización de la v14.
// No depende de ROS: se prueba solo con pruebas/proteccion/prueba_limitador.cpp.
#pragma once
#include <algorithm>
#include <cmath>

namespace soarm {

struct Limitador {
  double vel_max = 2.5;            // rad/s en marcha normal
  double vel_recuperacion = 0.3;   // rad/s tras un corte o un desvío grande
  double desvio_max = 1.0;         // rad entre la última orden y la posición medida
  bool vigilar_desvio = true;      // falso en la pinza: al agarrar, el desvío es normal

  bool listo = false;
  bool recuperando = false;
  bool perdido = false;
  double enviado = 0.0;

  // Llamar después de cada lectura. respondio = el servo contestó en este ciclo.
  void lectura(bool respondio) { if (!respondio) perdido = true; }

  // Devuelve la orden que se envía al servo. reinicio queda en true cuando se
  // detectó un corte o un desvío y el brazo pasa a recuperarse despacio.
  double paso(double objetivo, double medido, double dt, bool &reinicio) {
    reinicio = false;
    if (!std::isfinite(objetivo)) objetivo = enviado;
    if (!listo) {
      enviado = medido;
      listo = true;
      recuperando = true;          // el primer movimiento de la sesión, siempre despacio
    } else if (perdido || (vigilar_desvio && std::abs(medido - enviado) > desvio_max)) {
      enviado = medido;
      recuperando = true;
      reinicio = true;
    }
    perdido = false;
    dt = std::min(std::max(dt, 0.0), 0.05);   // un ciclo lento no autoriza un salto
    const double v = recuperando ? vel_recuperacion : vel_max;
    enviado += std::min(std::max(objetivo - enviado, -v * dt), v * dt);
    if (recuperando && std::abs(objetivo - enviado) < 1e-3) recuperando = false;
    return enviado;
  }
};

}  // namespace soarm
