#ifndef MYC_CORE_H
#define MYC_CORE_H

#include <stdint.h>
#include <stdbool.h>

#define MYC_MAX_INPUT_LEN    128
#define MYC_STATIC_RAM_BYTES 384

/* Return Status Codes */
#define MYC_OK                  0x00
#define MYC_ERR_BUFFER_OVERFLOW 0xE1
#define MYC_ERR_UNKNOWN_DEVICE  0xE2
#define MYC_ERR_AMBIGUOUS_OP    0xE4
#define MYC_ERR_NEGATION_GUARD  0xE5
#define MYC_ERR_RANGE_EXCEEDED  0xE6
#define MYC_ERR_NON_INDUSTRIAL  0xE8

typedef struct {
    uint8_t  status;
    char     error_code[48];
    char     device[24];
    char     action[16];
    uint16_t unit_number;
    uint16_t target_register;
    uint16_t action_value;
    uint16_t ram_consumed_bytes;
    uint32_t latency_ns;
    uint8_t  modbus_frame[8];
} MycIntentResult;

/* Core Execution API */
MycIntentResult myc_kernel_evaluate(const char* input);

#endif /* MYC_CORE_H */
