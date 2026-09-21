#include "SCServo.h"
#include <chrono>
#include <iostream>

SMS_STS st;

int main() {
    if (!st.begin(1000000, "/dev/ttyACM0")) {
        std::cerr << "No se pudo abrir el puerto serial\n";
        return 1;
    }

    const int N = 200;
    auto t0 = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < N; i++) {
        st.WritePosEx(1, 2048, 2400, 50);
    }
    auto t1 = std::chrono::high_resolution_clock::now();

    double total_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    double avg_ms = total_ms / N;

    std::cout << "Escrituras: " << N << "\n";
    std::cout << "Tiempo total: " << total_ms << " ms\n";
    std::cout << "Promedio por escritura: " << avg_ms << " ms\n";

    return 0;
}
