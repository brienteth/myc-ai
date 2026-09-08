#include "myc_core.h"
#include <string.h>
#include <ctype.h>
#include <time.h>

static uint16_t calculate_crc16(const uint8_t *buf, uint16_t len) {
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

static bool has_word(const char *haystack, const char *needle) {
    const char *p = haystack;
    size_t nlen = strlen(needle);
    while ((p = strstr(p, needle)) != NULL) {
        bool left_boundary = (p == haystack || !isalpha((unsigned char)*(p - 1)));
        bool right_boundary = (!isalpha((unsigned char)*(p + nlen)));
        if (left_boundary && right_boundary) return true;
        p += nlen;
    }
    return false;
}

MycIntentResult myc_kernel_evaluate(const char* input) {
    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);

    MycIntentResult res;
    memset(&res, 0, sizeof(MycIntentResult));
    res.ram_consumed_bytes = sizeof(MycIntentResult);

    if (!input || strlen(input) == 0 || strlen(input) > MYC_MAX_INPUT_LEN) {
        res.status = MYC_ERR_BUFFER_OVERFLOW;
        strcpy(res.error_code, "ERR_BUFFER_OVERFLOW (Input Bounds Exceeded)");
        strcpy(res.device, "NONE");
        strcpy(res.action, "REJECT");
        
        clock_gettime(CLOCK_MONOTONIC, &end);
        res.latency_ns = (uint32_t)((end.tv_sec - start.tv_sec) * 1000000000L + (end.tv_nsec - start.tv_nsec));
        return res;
    }

    char low[MYC_MAX_INPUT_LEN + 1];
    size_t len = strlen(input);
    for (size_t i = 0; i < len && i < MYC_MAX_INPUT_LEN; i++) {
        low[i] = (char)tolower((unsigned char)input[i]);
    }
    low[len] = '\0';

    // Lock 1: Negation Guard
    if (has_word(low, "never") || has_word(low, "sakın") || has_word(low, "sakin") ||
        has_word(low, "asla") || has_word(low, "abort") || has_word(low, "cancel") ||
        has_word(low, "dur") || has_word(low, "iptal") || strstr(low, "don't") || strstr(low, "dont")) {
        res.status = MYC_ERR_NEGATION_GUARD;
        strcpy(res.error_code, "ERR_NEGATIVE_GUARD (0-Byte Fail-Safe Lock)");
        strcpy(res.device, "PROTECTED");
        strcpy(res.action, "0-BYTE_NOOP");
        
        clock_gettime(CLOCK_MONOTONIC, &end);
        res.latency_ns = (uint32_t)((end.tv_sec - start.tv_sec) * 1000000000L + (end.tv_nsec - start.tv_nsec));
        return res;
    }

    // Lock 2: Device Identification
    if (strstr(low, "turbine") || strstr(low, "türbin") || strstr(low, "turbin")) {
        strcpy(res.device, "TURBINE");
        res.unit_number = 1;
        if (strstr(low, "#2") || strstr(low, "2")) res.unit_number = 2;
        else if (strstr(low, "#3") || strstr(low, "3")) res.unit_number = 3;

        if (strstr(low, "start") || strstr(low, "başlat") || strstr(low, "calistir") || strstr(low, "çalıştır") || strstr(low, "ac") || strstr(low, "aç")) {
            strcpy(res.action, "START");
            res.target_register = 0x0080 + res.unit_number;
            res.action_value = 0xFF00; // Relay Coil ON
            res.status = MYC_OK;
        } else if (strstr(low, "stop") || strstr(low, "durdur") || strstr(low, "kapat")) {
            strcpy(res.action, "STOP");
            res.target_register = 0x0080 + res.unit_number;
            res.action_value = 0x0000; // Relay Coil OFF
            res.status = MYC_OK;
        } else {
            res.status = MYC_ERR_AMBIGUOUS_OP;
            strcpy(res.error_code, "ERR_AMBIGUOUS_OP (Undefined Operation)");
            strcpy(res.action, "REJECT");
        }
    } else if (strstr(low, "pump") || strstr(low, "pompa")) {
        strcpy(res.device, "PUMP");
        res.unit_number = 1;
        if (strstr(low, "2") || strstr(low, "#2")) res.unit_number = 2;
        res.target_register = 0x0010 + res.unit_number;

        if (strstr(low, "start") || strstr(low, "başlat") || strstr(low, "calistir") || strstr(low, "çalıştır")) {
            strcpy(res.action, "START");
            res.action_value = 0xFF00;
            res.status = MYC_OK;
        } else if (strstr(low, "stop") || strstr(low, "durdur") || strstr(low, "kapat")) {
            strcpy(res.action, "STOP");
            res.action_value = 0x0000;
            res.status = MYC_OK;
        }
    } else if (strstr(low, "valve") || strstr(low, "vana")) {
        strcpy(res.device, "VALVE");
        res.unit_number = 5;
        res.target_register = 0x0020;
        strcpy(res.action, "OPEN");
        res.action_value = 0xFF00;
        res.status = MYC_OK;
    } else if (strstr(low, "motor")) {
        strcpy(res.device, "MOTOR");
        res.unit_number = 1;
        res.status = MYC_ERR_NON_INDUSTRIAL;
        strcpy(res.error_code, "ERR_NON_INDUSTRIAL (Off-Domain Input)");
        strcpy(res.action, "REJECT");
    } else {
        res.status = MYC_ERR_UNKNOWN_DEVICE;
        strcpy(res.error_code, "ERR_UNKNOWN_DEVICE (Unregistered Hardware)");
        strcpy(res.device, "UNKNOWN");
        strcpy(res.action, "REJECT");
    }

    // Build Deterministic Modbus RTU Frame if valid
    if (res.status == MYC_OK) {
        res.modbus_frame[0] = 0x01; // Slave ID
        res.modbus_frame[1] = 0x05; // Write Single Coil
        res.modbus_frame[2] = (uint8_t)(res.target_register >> 8);
        res.modbus_frame[3] = (uint8_t)(res.target_register & 0xFF);
        res.modbus_frame[4] = (uint8_t)(res.action_value >> 8);
        res.modbus_frame[5] = (uint8_t)(res.action_value & 0xFF);
        uint16_t crc = calculate_crc16(res.modbus_frame, 6);
        res.modbus_frame[6] = (uint8_t)(crc & 0xFF);
        res.modbus_frame[7] = (uint8_t)(crc >> 8);
    }

    clock_gettime(CLOCK_MONOTONIC, &end);
    res.latency_ns = (uint32_t)((end.tv_sec - start.tv_sec) * 1000000000L + (end.tv_nsec - start.tv_nsec));
    return res;
}
