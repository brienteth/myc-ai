#include "myc_core.h"
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

#ifdef HOST_BENCH
#include <time.h>
#endif

// Modbus CRC-16 Calculation (Poly 0xA001, Init 0xFFFF, Little-Endian)
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

// Check word boundary matching
static bool match_word(const char *haystack, const char *needle) {
    const char *p = haystack;
    size_t nlen = strlen(needle);
    while ((p = strstr(p, needle)) != NULL) {
        bool left_ok = (p == haystack || !isalnum((unsigned char)*(p - 1)));
        bool right_ok = (!isalnum((unsigned char)*(p + nlen)));
        if (left_ok && right_ok) return true;
        p += nlen;
    }
    return false;
}

// Fold Turkish letters to ASCII lowercase
static void normalize_ascii_turkish(const char *src, char *dst, size_t max_len) {
    size_t j = 0;
    for (size_t i = 0; src[i] != '\0' && j < max_len - 1; i++) {
        unsigned char c = (unsigned char)src[i];
        if (c == 0xC3) { // UTF-8 2-byte sequence
            unsigned char next = (unsigned char)src[++i];
            if (next == 0x87 || next == 0xA7) dst[j++] = 'c'; // Ç, ç
            else if (next == 0x96 || next == 0xB6) dst[j++] = 'o'; // Ö, ö
            else if (next == 0x9C || next == 0xBC) dst[j++] = 'u'; // Ü, ü
            else dst[j++] = ' ';
        } else if (c == 0xC4) {
            unsigned char next = (unsigned char)src[++i];
            if (next == 0x9E || next == 0x9F) dst[j++] = 'g'; // Ğ, ğ
            else if (next == 0xB0 || next == 0xB1) dst[j++] = 'i'; // İ, ı
            else dst[j++] = ' ';
        } else if (c == 0xC5) {
            unsigned char next = (unsigned char)src[++i];
            if (next == 0x9E || next == 0x9F) dst[j++] = 's'; // Ş, ş
            else dst[j++] = ' ';
        } else {
            dst[j++] = (char)tolower(c);
        }
    }
    dst[j] = '\0';
}

// Extract exact unit number (supports #12, 12., numara 12, etc.)
static int16_t extract_unit_number(const char *str) {
    // 1. Look for # followed by digits: e.g. #12, #3
    const char *hash_pos = strchr(str, '#');
    if (hash_pos && isdigit((unsigned char)*(hash_pos + 1))) {
        char *end_ptr;
        long val = strtol(hash_pos + 1, &end_ptr, 10);
        if (val >= 1 && val <= 255) return (int16_t)val;
        return -1; // Out of range
    }

    // 2. Look for standalone numbers with word boundaries
    const char *p = str;
    while (*p) {
        if (isdigit((unsigned char)*p)) {
            bool left_ok = (p == str || !isalnum((unsigned char)*(p - 1)));
            char *end_ptr;
            long val = strtol(p, &end_ptr, 10);
            bool right_ok = (*end_ptr == '\0' || *end_ptr == '.' || !isalnum((unsigned char)*end_ptr));
            if (left_ok && right_ok) {
                if (val >= 1 && val <= 255) return (int16_t)val;
                return -1; // Out of range
            }
            p = end_ptr;
        } else {
            p++;
        }
    }
    return 1; // Default unit if none specified
}

static void safe_strcpy(char *dst, size_t dst_size, const char *src) {
    if (!dst || dst_size == 0) return;
    strncpy(dst, src, dst_size - 1);
    dst[dst_size - 1] = '\0';
}

MycIntentResult myc_kernel_evaluate(const char* input) {
#ifdef HOST_BENCH
    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);
#endif

    MycIntentResult res;
    memset(&res, 0, sizeof(MycIntentResult));
    res.status = MYC_ERR_AMBIGUOUS_OP; // FAIL-SAFE DEFAULT: Not OK!
    safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_NO_ACTION");
    safe_strcpy(res.device, sizeof(res.device), "NONE");
    safe_strcpy(res.action, sizeof(res.action), "REJECT");
    res.ram_consumed_bytes = sizeof(MycIntentResult);

    if (!input || strlen(input) == 0) {
        res.status = MYC_ERR_BUFFER_OVERFLOW;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_EMPTY_INPUT");
        return res;
    }

    if (strlen(input) > MYC_MAX_INPUT_LEN) {
        res.status = MYC_ERR_BUFFER_OVERFLOW;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_BUFFER_OVERFLOW");
        return res;
    }

    char low[MYC_MAX_INPUT_LEN * 2 + 1];
    normalize_ascii_turkish(input, low, sizeof(low));

    // P0-3: Pure Negation Guard (sakın, asla, never, abort, cancel, iptal, don't, dont, durdurma, kapatma)
    // NOTE: 'dur' is an ACTION, not a negation!
    if (match_word(low, "never") || match_word(low, "sakin") || match_word(low, "asla") ||
        match_word(low, "abort") || match_word(low, "cancel") || match_word(low, "iptal") ||
        match_word(low, "dont") || strstr(low, "don't") || match_word(low, "durdurma") ||
        match_word(low, "kapatma") || match_word(low, "acma") || match_word(low, "yapma")) {
        res.status = MYC_ERR_NEGATION_GUARD;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_NEGATIVE_GUARD");
        safe_strcpy(res.device, sizeof(res.device), "PROTECTED");
        safe_strcpy(res.action, sizeof(res.action), "0-BYTE_NOOP");
        return res;
    }

    // P0-7: Multi-target / Contradictory Detection (Policy A: Reject compound commands without silent drop)
    int device_count = 0;
    if (strstr(low, "turbin") || strstr(low, "turbine")) device_count++;
    if (strstr(low, "pomp") || strstr(low, "pump")) device_count++;
    if (strstr(low, "vana") || strstr(low, "valve")) device_count++;
    if (strstr(low, "motor")) device_count++;

    if (device_count > 1 || (strstr(low, " ve ") && (strstr(low, "ac") || strstr(low, "durdur")))) {
        res.status = MYC_ERR_AMBIGUOUS_OP;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_MULTI_TARGET");
        safe_strcpy(res.device, sizeof(res.device), "MULTI");
        safe_strcpy(res.action, sizeof(res.action), "REJECT");
        return res;
    }

    // P0-4: Unit number extraction
    int16_t unit = extract_unit_number(low);
    if (unit < 0 || unit > 255) {
        res.status = MYC_ERR_RANGE_EXCEEDED;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_RANGE_EXCEEDED");
        safe_strcpy(res.device, sizeof(res.device), "OUT_OF_RANGE");
        safe_strcpy(res.action, sizeof(res.action), "REJECT");
        return res;
    }
    res.unit_number = (uint16_t)unit;

    // Detect Action: START / OPEN vs STOP / CLOSE
    bool is_start = false;
    bool is_stop = false;

    if (match_word(low, "start") || match_word(low, "baslat") || match_word(low, "calistir") ||
        match_word(low, "open") || match_word(low, "ac") || match_word(low, "acik")) {
        is_start = true;
    }
    if (match_word(low, "stop") || match_word(low, "durdur") || match_word(low, "dur") ||
        match_word(low, "close") || match_word(low, "kapat") || match_word(low, "kapali") ||
        match_word(low, "kes")) {
        is_stop = true;
    }

    if (is_start && is_stop) {
        res.status = MYC_ERR_AMBIGUOUS_OP;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_CONTRADICTORY");
        return res;
    }

    // Device Matching
    if (strstr(low, "turbin") || strstr(low, "turbine")) {
        safe_strcpy(res.device, sizeof(res.device), "TURBINE");
        res.target_register = 0x0080 + res.unit_number;
    } else if (strstr(low, "pomp") || strstr(low, "pump")) {
        safe_strcpy(res.device, sizeof(res.device), "PUMP");
        res.target_register = 0x0010 + res.unit_number;
    } else if (strstr(low, "vana") || strstr(low, "valve")) {
        safe_strcpy(res.device, sizeof(res.device), "VALVE");
        res.target_register = 0x0020 + (res.unit_number == 1 ? 5 : res.unit_number);
    } else if (strstr(low, "motor")) { // P0-5: Motor supported in allowlist
        safe_strcpy(res.device, sizeof(res.device), "MOTOR");
        res.target_register = 0x0030 + res.unit_number;
    } else {
        res.status = MYC_ERR_UNKNOWN_DEVICE;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_UNKNOWN_DEVICE");
        return res;
    }

    // P0-2: Explicit Action Validation (Eylemsiz cumle ASLA OK olamaz)
    if (!is_start && !is_stop) {
        res.status = MYC_ERR_AMBIGUOUS_OP;
        safe_strcpy(res.error_code, sizeof(res.error_code), "ERR_NO_ACTION");
        safe_strcpy(res.action, sizeof(res.action), "REJECT");
        return res;
    }

    // P0-1: Valve / Vana Correct Direction
    if (is_start) {
        safe_strcpy(res.action, sizeof(res.action), strcmp(res.device, "VALVE") == 0 ? "OPEN" : "START");
        res.action_value = 0xFF00; // Coil ON
    } else {
        safe_strcpy(res.action, sizeof(res.action), strcmp(res.device, "VALVE") == 0 ? "CLOSE" : "STOP");
        res.action_value = 0x0000; // Coil OFF (P0-1 Fix!)
    }

    res.status = MYC_OK;
    safe_strcpy(res.error_code, sizeof(res.error_code), "NONE");

    // Modbus RTU Frame Build: [SlaveID, FC05, RegHi, RegLo, ValHi, ValLo, CRCLo, CRCHi]
    res.modbus_frame[0] = 0x01; // Slave ID
    res.modbus_frame[1] = 0x05; // Write Single Coil
    res.modbus_frame[2] = (uint8_t)(res.target_register >> 8);
    res.modbus_frame[3] = (uint8_t)(res.target_register & 0xFF);
    res.modbus_frame[4] = (uint8_t)(res.action_value >> 8);
    res.modbus_frame[5] = (uint8_t)(res.action_value & 0xFF);
    uint16_t crc = calculate_crc16(res.modbus_frame, 6);
    res.modbus_frame[6] = (uint8_t)(crc & 0xFF);
    res.modbus_frame[7] = (uint8_t)(crc >> 8);

#ifdef HOST_BENCH
    clock_gettime(CLOCK_MONOTONIC, &end);
    res.latency_ns = (uint32_t)((end.tv_sec - start.tv_sec) * 1000000000L + (end.tv_nsec - start.tv_nsec));
#endif

    return res;
}
