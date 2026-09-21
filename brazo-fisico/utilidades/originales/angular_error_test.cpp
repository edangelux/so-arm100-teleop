#include "SCServo.h"
#include <chrono>
#include <thread>
#include <fstream>
#include <iostream>
#include <cstdlib>

SMS_STS st;

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Uso: ./angular_error_test <servo_id>\n";
        return 1;
    }
    int servo_id = std::atoi(argv[1]);

    if (!st.begin(1000000, "/dev/ttyACM0")) {
        std::cerr << "No se pudo abrir el puerto serial\n";
        return 1;
    }

    std::string filename = "/home/crist/angular_error_log_s" + std::to_string(servo_id) + ".csv";
    std::ofstream f(filename);

    int targets[] = {1848, 1948, 2048, 2148, 2248, 2048};

    for (int t : targets) {
        st.WritePosEx(servo_id, t, 2400, 50);
        std::this_thread::sleep_for(std::chrono::milliseconds(800));
        st.FeedBack(servo_id);
        int pos = st.ReadPos(servo_id);
        f << t << "," << pos << "\n";
        std::cout << "Consigna: " << t << "  Leido: " << pos << "\n";
    }

    std::cout << "Guardado en " << filename << "\n";
    return 0;
}
