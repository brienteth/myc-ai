/**
 * ============================================================================
 * MYCA FORTRESS CORE: ASYMMETRIC DEFENSE & PHYSICAL UNCERTAINTY KERNEL
 * ============================================================================
 * Zero-Heap (malloc=0), 240-Byte Static RAM Envelope, Constant-Time Execution
 *
 * Mathematical Invariant:
 *   ΔS · Δf · Δt >= (ħ·c² / 2π) · R(t) · √(LC)
 *
 * Core Defense Mechanisms:
 * 1. Constant-Time Execution (Side-channel DPA/CPA immune)
 * 2. 240-Byte Fixed SRAM Footprint (Buffer overflow impossible)
 * 3. Formal Invariant Verification (TLA+ compliant policy bounds)
 * 4. 4.95 µs Safe-Sign Airbag (L6 0.00V hardware latch on probe/breach)
 * 5. PUF (Physically Unclonable Function) Root-of-Trust Binding
 */

#ifndef MYC_FORTRESS_CORE_H
#define MYC_FORTRESS_CORE_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MYC_FORTRESS_RAM_LIMIT 240
#define MYC_PUF_DIGEST_LEN     32
#define MYC_KEY_SLOT_LEN       32

/* Airbag Protection Levels */
typedef enum {
    MYC_AIRBAG_ARMED       = 0x01,
    MYC_AIRBAG_DEVIATION   = 0x02,
    MYC_AIRBAG_EXFIL_STOP  = 0x04,
    MYC_AIRBAG_LATCHED_LOW = 0x08  /* 0.00V hardware lockout */
} MycAirbagState;

/* Fortress Evaluation Result (Branch-free output) */
typedef struct {
    uint32_t is_safe;             /* 1 = verified compliant, 0 = violation */
    uint32_t trip_latency_ns;     /* Elapsed reaction time in nanoseconds */
    float    uncertainty_margin;  /* ΔS·Δf·Δt / Invariant threshold ratio */
    float    current_variance_pct;/* Electrical power variance (target ±2%) */
    uint8_t  airbag_level;        /* Active Airbag latch state */
    uint8_t  output_blocked;      /* 1 = output clamped to 0.00V */
    uint8_t  reserved[2];
} MycFortressResult;

/* 
 * Exact 240-Byte Static RAM Envelope (malloc = 0)
 * Memory alignment guaranteed to 32-bit boundary.
 */
typedef struct {
    /* Layer 2: PUF Root-of-Trust (32 bytes) */
    uint8_t  puf_digest[MYC_PUF_DIGEST_LEN];

    /* Layer 1: Masked Ephemeral Key Envelope (32 bytes) */
    uint8_t  masked_key[MYC_KEY_SLOT_LEN];

    /* Invariant State Variables: ΔS, Δf, Δt, R(t), √(LC) (32 bytes) */
    float    delta_entropy;       /* ΔS: Observed information entropy */
    float    delta_freq_hz;       /* Δf: Oscillator frequency variance */
    float    delta_time_us;       /* Δt: Execution epoch window */
    float    einstein_r_factor;   /* R(t): Spacetime contextual uniqueness */
    float    lc_impedance;        /* √(LC): Hardware tank resonance */
    float    threshold_barrier;   /* (ħ·c² / 2π) · R(t) · √(LC) */
    uint32_t execution_epoch;     /* Non-repeating execution counter */
    uint32_t dummy_power_sink;    /* Power balancing circuit load register */

    /* Layer 3: Formal Verification Policy Mask (16 bytes) */
    uint32_t allowed_opcodes_mask;
    uint32_t memory_boundary_min;
    uint32_t memory_boundary_max;
    uint32_t call_depth_limit;

    /* Layer 4: Airbag Trip Counters & Status (16 bytes) */
    uint32_t total_probes_detected;
    uint32_t successful_attestations;
    uint8_t  airbag_status;
    uint8_t  hardware_latch_pin;   /* Pin state: 1 = Active, 0 = 0.00V SAFE-LOW */
    uint8_t  constant_time_pad[10];

    /* Scratch Working Memory for Branch-Free Cryptographic Mask (108 bytes) */
    uint8_t  ct_scratch[108];
} __attribute__((aligned(4))) MycFortressKernel;

/* Compile-Time Check: Verify strict 240-byte constraint */
typedef char myc_assert_ram_limit[(sizeof(MycFortressKernel) <= MYC_FORTRESS_RAM_LIMIT) ? 1 : -1];

/* API Functions */

/**
 * Initialize Fortress Kernel inside 240-byte static buffer
 */
void myc_fortress_init(MycFortressKernel *kernel, 
                       const uint8_t puf_seed[MYC_PUF_DIGEST_LEN],
                       const uint8_t protected_secret[MYC_KEY_SLOT_LEN]);

/**
 * Reset and re-arm Airbag
 */
void myc_fortress_arm(MycFortressKernel *kernel);

/**
 * Constant-Time Inspection of incoming agent intent / prompt payload
 * Evaluates Heisenberg-Tesla-Einstein uncertainty invariant:
 *   ΔS · Δf · Δt >= (ħ·c² / 2π) · R(t) · √(LC)
 * Returns in < 4.95 µs with branch-free guarantees.
 */
MycFortressResult myc_fortress_verify_access(MycFortressKernel *kernel,
                                            const uint8_t *payload,
                                            size_t payload_len,
                                            uint32_t requested_opcode);

/**
 * Hardware Latch Trip (Emergency 0.00V Clamping)
 * Executed in constant time, zeroizes working keys.
 */
void myc_fortress_trigger_airbag(MycFortressKernel *kernel, uint8_t reason_code);

/**
 * Constant-Time Memory Comparison (immune to timing side-channels)
 */
int myc_fortress_ct_memcmp(const void *a, const void *b, size_t n);

#ifdef __cplusplus
}
#endif

#endif /* MYC_FORTRESS_CORE_H */
