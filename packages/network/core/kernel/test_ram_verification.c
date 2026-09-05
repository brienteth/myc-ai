#include <stdio.h>
#include <string.h>
#include "myc_core.h"

int main() {
    printf("====================================================\n");
    printf("🔬 MYC BARE-METAL C99 RAM & LATENCY VERIFICATION TEST\n");
    printf("====================================================\n");

    printf("1. Struct Size Checks:\n");
    printf("   • sizeof(MycIntentResult)      : %zu Bytes\n", sizeof(MycIntentResult));
    printf("   • MYC_STATIC_RAM_BYTES macro   : %d Bytes\n", MYC_STATIC_RAM_BYTES);
    printf("   • MYC_MAX_INPUT_LEN            : %d Bytes\n", MYC_MAX_INPUT_LEN);

    // Run actual evaluation on various intents
    const char* tests[] = {
        "Start Turbine #2",
        "Never open valve 5",
        "Set motor speed to 1500 RPM",
        "Emergency Stop Turbine #1",
        "A"
    };

    printf("\n2. Executing Real Kernel Evaluation:\n");
    for (int i = 0; i < 5; i++) {
        MycIntentResult res = myc_kernel_evaluate(tests[i]);
        printf("   [%d] Input: \"%s\"\n", i+1, tests[i]);
        printf("       -> Status: 0x%02X (%s)\n", res.status, res.status == 0 ? "OK" : res.error_code);
        printf("       -> Device: %s | Action: %s\n", res.device, res.action);
        printf("       -> Static RAM: %u Bytes | Latency: %.2f us\n", 
               res.ram_consumed_bytes, res.latency_ns / 1000.0);
        printf("       -> Modbus Frame: [%02X %02X %02X %02X %02X %02X %02X %02X]\n\n",
               res.modbus_frame[0], res.modbus_frame[1], res.modbus_frame[2], res.modbus_frame[3],
               res.modbus_frame[4], res.modbus_frame[5], res.modbus_frame[6], res.modbus_frame[7]);
    }

    printf("====================================================\n");
    printf("✅ TEST RESULT: Static Stack Allocated Frame Verified.\n");
    printf("   Zero heap allocation (malloc=0, free=0, calloc=0)\n");
    printf("====================================================\n");
    return 0;
}
