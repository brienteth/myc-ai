# Project 2: DePIN Industrial Hardware Sentinel

An industrial DePIN device monitor for PLCs, inverters, and turbine controllers on MYC Network (Chain ID 108).

## Key Features
- **Silicon PUF Authentication:** Addresses prefixed with `myc1puf...` derived from SRAM jitter entropy.
- **Ultra-Compact Framing:** 48-byte binary framing with CRC-16 checksums for low-bandwidth IoT networks.
- **0-Byte Negation Shield:** Intercepts unsafe Modbus register writes with zero gas burnt.
- **Live Machine Telemetry:** Full integration with `/api/depin/machines` and `/api/depin/actuate`.

## Quickstart

```bash
# Run standalone DePIN hardware monitor
node monitor.js

# Run integration tests
node test_monitor.js
```
