#include "SCServo.h"
#include <iostream>

SMS_STS sm_st;

int main() {
    if (!sm_st.begin(1000000, "/dev/ttyACM0")) {
        std::cout << "Failed to init servo motor!" << std::endl;
        return -1;
    }

    for (int id = 1; id <= 6; id++) {
        sm_st.WritePosEx(id, 2048, 1000, 50);
        std::cout << "Servo " << id << " -> posicion 2048" << std::endl;
    }

    sm_st.end();
    return 0;
}
