// Pruebas del limitador de saltos. g++ -std=c++17 -I brazo-fisico/proteccion prueba_limitador.cpp
#include "limitador.hpp"
#include <cassert>
#include <cstdio>
#include <cmath>

using soarm::Limitador;
static const double DT = 0.01;   // 100 Hz, como el controlador del brazo real

// Simula un servo ideal que sigue la orden con un retardo de primer orden (tau).
struct Servo { double q; double tau = 0.08; void paso(double orden) { q += (orden - q) * DT / tau; } };

int main() {
  bool r;
  int fallos = 0;
  auto comprobar = [&](bool c, const char *m) { std::printf("%s  %s\n", c ? "OK   " : "FALLA", m); if (!c) fallos++; };

  { // 1. Al arrancar, parte de la posición medida y se mueve despacio.
    Limitador l; double o = l.paso(0.0, -1.7, DT, r);
    comprobar(std::abs(o - (-1.7 + 0.3 * DT)) < 1e-9, "arranque: parte de lo medido a 0,3 rad/s");
  }
  { // 2. Corte de la fuente con la orden en init y el brazo caído en home: vuelve a 0,3 rad/s.
    Limitador l; Servo s{0.0}; double o = 0;
    for (int k = 0; k < 300; k++) { o = l.paso(0.0, s.q, DT, r); s.paso(o); }
    l.lectura(false);                  // fuente apagada
    s.q = -1.7;                        // el brazo cae
    o = l.paso(0.0, s.q, DT, r);
    comprobar(r && std::abs(o - (-1.7 + 0.003)) < 1e-6, "corte de fuente: reinicia en lo medido");
    double max_v = 0; double prev = o;
    for (int k = 0; k < 800; k++) { o = l.paso(0.0, s.q, DT, r); max_v = std::max(max_v, std::abs(o - prev) / DT); prev = o; s.paso(o); }
    comprobar(max_v <= 0.3 + 1e-9, "corte de fuente: la vuelta nunca pasa de 0,3 rad/s");
    comprobar(std::abs(s.q) < 0.05, "corte de fuente: llega a la orden al final");
  }
  { // 3. Salto de orden en marcha normal: limitado a 2,5 rad/s.
    Limitador l; Servo s{0.0}; double o = 0;
    for (int k = 0; k < 10; k++) { o = l.paso(0.0, s.q, DT, r); s.paso(o); }
    double prev = o, max_v = 0;
    for (int k = 0; k < 200; k++) { o = l.paso(1.5, s.q, DT, r); max_v = std::max(max_v, std::abs(o - prev) / DT); prev = o; s.paso(o); }
    comprobar(max_v <= 2.5 + 1e-9, "salto de orden: nunca más de 2,5 rad/s");
  }
  { // 4. Teleoperación rápida (1,5 rad/s sostenidos): no dispara la recuperación.
    Limitador l; Servo s{0.0}; double o = 0; bool alguno = false;
    for (int k = 0; k < 20; k++) { o = l.paso(0.0, s.q, DT, r); s.paso(o); }
    for (int k = 0; k < 200; k++) { double obj = std::sin(k * DT * 1.5) * 1.0; o = l.paso(obj, s.q, DT, r); alguno |= r; s.paso(o); }
    comprobar(!alguno, "teleoperación rápida: sin falsos reinicios");
  }
  { // 4b. Servo realista (retardo 0,32 s como el peor del ensayo A5 y tope de 1,5 rad/s):
    //     teleoperación con picos de 2 rad/s y 1 rad de amplitud, sin falsos reinicios.
    Limitador l; double q = 0; double cola[64] = {0}; int n = 32; double o = 0; bool alguno = false; double peor = 0;
    for (int k = 0; k < 20; k++) { o = l.paso(0.0, q, DT, r); }
    for (int k = 0; k < 1000; k++) {
      double obj = std::sin(k * DT * 2.0) * 1.0;
      o = l.paso(obj, q, DT, r); alguno |= r;
      for (int j = n - 1; j > 0; j--) cola[j] = cola[j - 1];
      cola[0] = o;
      double meta = cola[n - 1]; q += std::min(std::max(meta - q, -1.5 * DT), 1.5 * DT);
      peor = std::max(peor, std::abs(o - q));
    }
    std::printf("      (desvío máximo entre orden y brazo: %.2f rad)\n", peor);
    comprobar(!alguno, "servo lento y con retardo: sin falsos reinicios");
  }
  { // 5. Pinza agarrando: el desvío grande no reinicia.
    Limitador l; l.vigilar_desvio = false; bool alguno = false;
    for (int k = 0; k < 200; k++) { l.paso(-0.1, 1.0, DT, r); alguno |= r; }
    comprobar(!alguno, "pinza bloqueada por una pieza: sin reinicios");
  }
  { // 6. Un ciclo que tarda 2 s no autoriza un salto grande.
    Limitador l; double o = l.paso(0.0, 0.0, DT, r); for (int k = 0; k < 10; k++) o = l.paso(0.0, 0.0, DT, r);
    o = l.paso(1.0, 0.0, 2.0, r);
    comprobar(o <= 2.5 * 0.05 + 1e-9, "ciclo lento: el paso se limita a 0,05 s");
  }
  std::printf(fallos ? "\n%d pruebas fallaron\n" : "\nTodas las pruebas pasaron\n", fallos);
  return fallos ? 1 : 0;
}
