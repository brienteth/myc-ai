# 🤖 MYC Network — System & Execution Specification

Lead Systems Architect and Core Embedded/Chain Engineer Specification.
Zero-gas, bare-metal blockchain runtime designed for industrial DePIN edge computing.

---

## 1. Layer 0 & Layer 1: Silicon PUF & C99 Micro-Kernel

1. **Zero-Heap Memory Boundary:**
   - Strict `malloc() = 0`, `free() = 0`, `realloc() = 0`.
   - Exact static SRAM boundary: **384 bytes**.
   - Stack-only and compile-time fixed arrays.

2. **Deterministic Execution (WCET):**
   - WCET limit: **38.4 µs** for intent parsing, Kilit 1-6 evaluation, and state resolution.

3. **Hardware Actuation & Pin Logic:**
   - `START` resolves to standard Modbus RTU frames (e.g. Coil `0x0082`, `3.30V HIGH`).
   - Negations, contradictions, and invalid intents default pin to **0.00V (Safe Low)** within **< 3.1 µs**.

4. **Silicon PUF Key Derivation:**
   - Deterministic hardware unclonable function derivation (`pufKey()`).

---

## 2. Layer 2: Proof-of-Resonance (PoR) Consensus Engine

1. **64-Dimensional Phase-Lock Math:**
   $$C = \frac{V_{intent} \cdot V_{machine}}{\Vert V_{intent}\Vert \Vert V_{machine}\Vert}$$

2. **Validation Rules:**
   - **$C \ge 0.50$:** `verified: true`, execute actuation, commit vertex to Lattice DAG.
   - **$C < 0.50$:** Contradiction detected. Pin forced to `0.00V`, `verified: false`, 0 bytes written on-chain, 0.00 MYC gas fee.

---

## 3. Layer 3 & Layer 4: Lattice DAG Ledger, DEX & Staking

1. **Lattice DAG Ledger:**
   - Merkle-linked vertex to previous root hashes.
   - 38.4 µs instant finality. 32-Byte Merkle Commitment.

2. **DEX Swap & Staking:**
   - AMM constant product: $k = x \cdot y$.
   - 1 device slot per 1,000 $MYC staked.

---

## 4. Layer 5: Safe-Sign Wallet & API Specifications

- `POST /api/intent`
- `POST /api/swap`
- `POST /api/stake`
- `GET /api/status`

---

## 5. SDK Enforcements (`@myc-network/sdk`)
- Exposes `sendIntent()`, `getPUFKey()`, and Safe-Sign decoding.
- Eliminates raw blind-hex execution.
