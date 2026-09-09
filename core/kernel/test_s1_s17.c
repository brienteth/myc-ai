#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "myc_core.h"

// Independent CRC-16 Modbus implementation to verify
static uint16_t ref_crc16(const uint8_t *buf, uint16_t len) {
    uint16_t crc = 0xFFFF;
    for (uint16_t pos = 0; pos < len; pos++) {
        crc ^= (uint16_t)buf[pos];
        for (int i = 8; i != 0; i--) {
            if ((crc & 0x0001) != 0) {
                crc >>= 1;
                crc ^= 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}

int main(void) {
    printf("=================================================================\n");
    printf("  MYCA C99 S1-S17 MANDATORY SECURITY TEST SUITE (INDEPENDENT)    \n");
    printf("=================================================================\n\n");

    int pass = 0;
    int total = 0;

    #define TEST_ASSERT(cond, id, msg) do { \
        total++; \
        if (cond) { \
            pass++; \
            printf("  [PASS] %-4s: %s\n", id, msg); \
        } else { \
            printf("  [FAIL] %-4s: %s\n", id, msg); \
        } \
    } while(0)

    // S1: close the valve -> NOT OPEN; STOP/CLOSE; coil 0x0000
    MycIntentResult r1 = myc_kernel_evaluate("close the valve");
    TEST_ASSERT(r1.status == MYC_OK && strcmp(r1.action, "CLOSE") == 0 && r1.action_value == 0x0000,
                "S1", "close the valve -> VALVE CLOSE (0x0000)");

    // S2: vana kapat -> STOP/CLOSE, value=0x0000
    MycIntentResult r2 = myc_kernel_evaluate("vana kapat");
    TEST_ASSERT(r2.status == MYC_OK && strcmp(r2.action, "CLOSE") == 0 && r2.action_value == 0x0000,
                "S2", "vana kapat -> VALVE CLOSE (0x0000)");

    // S3: pompa nedir acaba -> REJECT, framesiz
    MycIntentResult r3 = myc_kernel_evaluate("pompa nedir acaba");
    TEST_ASSERT(r3.status != MYC_OK && strcmp(r3.action, "REJECT") == 0,
                "S3", "pompa nedir acaba -> REJECT (No action frame)");

    // S4: pompa 2 dur -> PUMP STOP unit=2, value=0x0000
    MycIntentResult r4 = myc_kernel_evaluate("pompa 2 dur");
    TEST_ASSERT(r4.status == MYC_OK && strcmp(r4.device, "PUMP") == 0 && strcmp(r4.action, "STOP") == 0 && r4.unit_number == 2 && r4.action_value == 0x0000,
                "S4", "pompa 2 dur -> PUMP STOP unit=2 (0x0000)");

    // S5: sakın 2. pompayı durdurma / sakın vanayı açma -> NEGATION, framesiz
    MycIntentResult r5a = myc_kernel_evaluate("sakın 2. pompayı durdurma");
    MycIntentResult r5b = myc_kernel_evaluate("sakın vanayı açma");
    TEST_ASSERT(r5a.status == MYC_ERR_NEGATION_GUARD && r5b.status == MYC_ERR_NEGATION_GUARD,
                "S5", "sakın ... durdurma/açma -> NEGATION_GUARD (0-Byte Fail-Safe)");

    // S6: Start Turbine #12 -> unit=12, asla 2
    MycIntentResult r6 = myc_kernel_evaluate("Start Turbine #12");
    TEST_ASSERT(r6.status == MYC_OK && r6.unit_number == 12,
                "S6", "Start Turbine #12 -> unit=12 (Exact number)");

    // S7: Start Turbine #3 -> TURBINE START unit=3
    MycIntentResult r7 = myc_kernel_evaluate("Start Turbine #3");
    TEST_ASSERT(r7.status == MYC_OK && strcmp(r7.device, "TURBINE") == 0 && strcmp(r7.action, "START") == 0 && r7.unit_number == 3,
                "S7", "Start Turbine #3 -> TURBINE START unit=3");

    // S8: Start Turbine #2 -> TURBINE START unit=2, CRC bağımsız doğrulama
    MycIntentResult r8 = myc_kernel_evaluate("Start Turbine #2");
    uint16_t expected_crc = ref_crc16(r8.modbus_frame, 6);
    uint16_t actual_crc = (uint16_t)r8.modbus_frame[6] | ((uint16_t)r8.modbus_frame[7] << 8);
    TEST_ASSERT(r8.status == MYC_OK && r8.unit_number == 2 && expected_crc == actual_crc &&
                r8.modbus_frame[0] == 0x01 && r8.modbus_frame[1] == 0x05 && r8.modbus_frame[2] == 0x00 && r8.modbus_frame[3] == 0x82 &&
                r8.modbus_frame[4] == 0xFF && r8.modbus_frame[5] == 0x00 && r8.modbus_frame[6] == 0x2C && r8.modbus_frame[7] == 0x12,
                "S8", "Start Turbine #2 -> CRC matches 01 05 00 82 FF 00 -> 2C 12");

    // S9: 2. pompayı durdur / 2. pompayi durdur -> PUMP STOP unit=2
    MycIntentResult r9a = myc_kernel_evaluate("2. pompayı durdur");
    MycIntentResult r9b = myc_kernel_evaluate("2. pompayi durdur");
    TEST_ASSERT(r9a.status == MYC_OK && r9a.unit_number == 2 && r9b.status == MYC_OK && r9b.unit_number == 2,
                "S9", "2. pompayı / pompayi durdur -> PUMP STOP unit=2");

    // S10: turbin 2 baslat -> TURBINE START unit=2
    MycIntentResult r10 = myc_kernel_evaluate("turbin 2 baslat");
    TEST_ASSERT(r10.status == MYC_OK && strcmp(r10.device, "TURBINE") == 0 && r10.unit_number == 2 && strcmp(r10.action, "START") == 0,
                "S10", "turbin 2 baslat (ASCII folding) -> TURBINE START unit=2");

    // S11: motoru baslat / motoru çalıştır -> MOTOR START, NON_INDUSTRIAL değil
    MycIntentResult r11a = myc_kernel_evaluate("motoru baslat");
    MycIntentResult r11b = myc_kernel_evaluate("motoru çalıştır");
    TEST_ASSERT(r11a.status == MYC_OK && strcmp(r11a.device, "MOTOR") == 0 && r11b.status == MYC_OK && strcmp(r11b.device, "MOTOR") == 0,
                "S11", "motoru baslat / calistir -> MOTOR START (Industrial Allowlist)");

    // S12: Never open valve 5 -> NEGATION, framesiz
    MycIntentResult r12 = myc_kernel_evaluate("Never open valve 5");
    TEST_ASSERT(r12.status == MYC_ERR_NEGATION_GUARD,
                "S12", "Never open valve 5 -> NEGATION_GUARD");

    // S13: 2. pompayı durdur ve tahliye vanasını aç -> MULTI_TARGET / CONTRADICTORY (Policy A: Reject compound)
    MycIntentResult r13 = myc_kernel_evaluate("2. pompayı durdur ve tahliye vanasını aç");
    TEST_ASSERT(r13.status == MYC_ERR_AMBIGUOUS_OP && strcmp(r13.action, "REJECT") == 0,
                "S13", "2. pompayı durdur ve tahliye vanasını aç -> REJECT MULTI_TARGET");

    // S14: "" ve NULL -> hata, crash yok
    MycIntentResult r14a = myc_kernel_evaluate("");
    MycIntentResult r14b = myc_kernel_evaluate(NULL);
    TEST_ASSERT(r14a.status != MYC_OK && r14b.status != MYC_OK,
                "S14", "Empty string & NULL -> Safe Error, Zero Crash");

    // S15: 199 char A -> OVERFLOW
    char long_a[200];
    memset(long_a, 'A', 199);
    long_a[199] = '\0';
    MycIntentResult r15 = myc_kernel_evaluate(long_a);
    TEST_ASSERT(r15.status == MYC_ERR_BUFFER_OVERFLOW,
                "S15", "199 char string -> OVERFLOW");

    // S16: tam 128 char -> tanımlı davranış
    char exact_128[129];
    memset(exact_128, 'A', 128);
    exact_128[128] = '\0';
    MycIntentResult r16 = myc_kernel_evaluate(exact_128);
    TEST_ASSERT(r16.status != MYC_OK,
                "S16", "Exact 128 char string -> Defined Safe Error");

    // S17: abort turbine start -> NEGATION
    MycIntentResult r17 = myc_kernel_evaluate("abort turbine start");
    TEST_ASSERT(r17.status == MYC_ERR_NEGATION_GUARD,
                "S17", "abort turbine start -> NEGATION_GUARD");

    printf("\n-----------------------------------------------------------------\n");
    printf("  SECURITY MATRIX RESULT: %d / %d PASSED\n", pass, total);
    printf("=================================================================\n");

    return (pass == total) ? 0 : 1;
}
