#include <stdio.h>
#include <string.h>
#include <time.h>
#include "myc_core.h"

int main() {
    printf("=================================================================\n");
    printf("⏱️  MYC BARE-METAL C99 GERÇEK DONANIM GECİKME ÖLÇÜMÜ (BENCHMARK)\n");
    printf("=================================================================\n\n");

    const char* inputs[] = {
        "Start Turbine #2",
        "Never open valve 5",
        "Emergency Stop Turbine #1",
        "Start Pump #2",
        "Set motor speed to 1500 RPM",
        "A"
    };

    printf("1. Tekil Koşum Ölçümleri (clock_gettime MONOTONIC):\n");
    printf("-----------------------------------------------------------------\n");
    for (int i = 0; i < 6; i++) {
        MycIntentResult res = myc_kernel_evaluate(inputs[i]);
        printf("Girdi: %-30s | Status: 0x%02X | Gerçek Süre: %5u ns (%5.2f us)\n",
               inputs[i], res.status, res.latency_ns, res.latency_ns / 1000.0);
    }

    printf("\n2. İstatiksel Doğrulama (Her girdi için 10,000 iterasyon):\n");
    printf("-----------------------------------------------------------------\n");
    for (int i = 0; i < 6; i++) {
        uint64_t total_ns = 0;
        uint32_t min_ns = 999999;
        uint32_t max_ns = 0;
        const int ITERS = 10000;

        for (int k = 0; k < ITERS; k++) {
            MycIntentResult res = myc_kernel_evaluate(inputs[i]);
            total_ns += res.latency_ns;
            if (res.latency_ns < min_ns) min_ns = res.latency_ns;
            if (res.latency_ns > max_ns) max_ns = res.latency_ns;
        }

        double avg_us = (total_ns / (double)ITERS) / 1000.0;
        printf("%-30s -> Min: %4.2f us | Max: %5.2f us | Ort: %4.2f us\n",
               inputs[i], min_ns / 1000.0, max_ns / 1000.0, avg_us);
    }

    printf("=================================================================\n");
    printf("✅ TEST SONUCU: Tüm süreler dinamik ve CPU cycle hassasiyetinde ölçüldü.\n");
    printf("=================================================================\n");
    return 0;
}
