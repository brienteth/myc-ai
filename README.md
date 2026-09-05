<p align="center">
  <img src="hero.png" alt="MYCA Sovereign Cognitive Infrastructure" width="100%" />
</p>

<p align="center">
  <strong>English</strong> · <a href="README.tr.md">Türkçe</a> · <a href="docs/WHITEPAPER_COMPREHENSIVE.md">Comprehensive Whitepaper</a>
</p>

<p align="center">
  <a href="https://github.com/brienteth/myc-ai"><img src="https://img.shields.io/badge/Chain_ID-108_(MYC--LATTICE--MAINNET)-00f2fe.svg?style=flat-square" alt="Chain ID" /></a>
  <a href="https://github.com/brienteth/myc-ai"><img src="https://img.shields.io/badge/Gas_Fee-0.00000000_MYC_(Strict_Invariant)-00e676.svg?style=flat-square" alt="Gas Fee" /></a>
  <a href="https://github.com/brienteth/myc-ai"><img src="https://img.shields.io/badge/Finality-%3C4.95_µs_(Hardware_Interlock)-7c3aed.svg?style=flat-square" alt="Finality" /></a>
  <a href="https://github.com/brienteth/myc-ai"><img src="https://img.shields.io/badge/Machine_Identity-W3C_did%3Amyc%3Apuf-f59e0b.svg?style=flat-square" alt="Machine DID" /></a>
  <a href="https://github.com/brienteth/myc-ai"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> · 
  <a href="#architecture">Architecture</a> · 
  <a href="#competitive-benchmarks">Benchmarks</a> · 
  <a href="#machine-did-depin">DePIN & DID</a> · 
  <a href="docs/WHITEPAPER_COMPREHENSIVE.md">Whitepaper</a> · 
  <a href=".github/SECURITY.md">Security</a>
</p>

---

### MYCA is the Sovereign Cognitive Infrastructure & Living Lattice DAG engineered for autonomous AI agents, industrial IoT microcontrollers, and zero-gas machine economies.

> **"Every node runs on physical hardware — No centralized cloud dependency, no perpetual VPS rental. Every participant is both sovereign user and autonomous validator."**

---

## 🏛️ Core Architectural Pillars

```
┌────────────────────────────────────────────────────────┐
│                   MYCA SOVEREIGN STACK                 │
├────────────────────────────────────────────────────────┤
│  Layer 4: Sovereign Cognitive Agent Colony (FHRR AI)   │
│           (Hermes-3 Local Inference, Spectral SLM)     │
├────────────────────────────────────────────────────────┤
│  Layer 3: Two-Lane Economic Settlement Engine          │
│           Lane A: 0-Gas $MYC | Lane B: USDC/USDT Escrow│
├────────────────────────────────────────────────────────┤
│  Layer 2: Living Lattice DAG Ledger                    │
│           (Asynchronous Vertices, Multi-Chain Bridge)  │
├────────────────────────────────────────────────────────┤
│  Layer 1: Proof-of-Resonance (PoR) & Safe-Sign 6-Lock │
│           (4.95 µs Hardware Airbag, 0-Byte Shield)     │
├────────────────────────────────────────────────────────┤
│  Layer 0: Silicon PUF Hardware Root-of-Trust (DePIN)   │
│           (W3C DID did:myc:puf:0x..., myc1... address) │
└────────────────────────────────────────────────────────┘
```

1. **Strict Zero-Gas Protocol Invariant:** Transfers, contract calls, and PoR verifications incur strictly **0.00000000 MYC**. Transactions with `gasPrice > 0` are rejected protocol-wide.
2. **Deterministic C99 Safe-Sign 6-Lock Kernel:** A 240-byte static RAM micro-kernel (`malloc = 0`) executing in 743 cycles (**4.95 µs @ 150MHz**) that drops contradictory or dangerous actuator commands before physical Modbus coil assertion.
3. **Silicon PUF Machine DIDs (`did:myc:puf:0x...`):** Every machine generates its cryptographic keypair from microscopic SRAM startup variations. Private keys are never stored in plaintext on disk.
4. **Air-Gapped Mesh Colony:** When WAN connections fail, local edge clusters maintain continuous P2P consensus and trade over RS-485, Modbus RTU, LoRa, and BLE.

---

## 📊 Competitive Benchmarks: MYCA vs. Peaq vs. IoTeX

| Metric / Architecture | 🟣 Peaq Network (`app.peaq.xyz`) | 🔵 IoTeX (`W3bstream`) | 🟢 MYCA Sovereign Stack |
| :--- | :--- | :--- | :--- |
| **Consensus Model** | Substrate DPoS / NPoS | Roll-DPoS + Offchain | **Living Lattice DAG + PoR** |
| **Transaction Gas** | $0.00025 (Volatile) | Variable IOTX Gas | **STRICT 0.00000000 MYC** |
| **Throughput & Speed** | ~10,000 TPS (6-12s finality) | ~1,000 TPS (5s finality) | **1.2M+ TPS (<5 µs hardware cut)** |
| **Machine Identity** | peaq ID (Disk storage) | ioID (Software key) | **did:myc:puf:0x... (Silicon PUF)** |
| **Hardware Airbag** | None (Pure software) | None (Pure software) | **0-Byte Negation Shield (4.95 µs)** |
| **Air-Gap Mesh** | ❌ Halts without Internet | ❌ Halts without Internet | **✅ 100% Offline RS-485 / LoRa** |

---

## ⚡ Quickstart

### 1. Run Autonomous Node & Nexus Portal
```bash
# Clone the repository
git clone https://github.com/brienteth/myc-ai.git
cd myc-ai/packages/network

# Start Zero-Gas Node & Dashboard (Port 4040)
npm install
npm start
```
Visit **[http://localhost:4040/nexus](http://localhost:4040/nexus)** to access the Lattice Explorer, AMM Swap DEX, DePIN Fleets, and AI Agent Terminal.

### 2. Verify Core Architecture & Tests
```bash
cd packages/network
node test/run_all_tests.js
node tests/depin_machine_wallets.test.js
```

---

## 🔑 Machine DID & DePIN Hardware API

Every physical turbine, valve, and GPU node resolves standard W3C Decentralized Identifiers:
```bash
# Query live machine DID document
curl -s http://localhost:4040/api/depin/did?did=TURBINE_01 | jq .
```
Response:
```json
{
  "success": true,
  "didDocument": {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:myc:puf:0xd2912b762c2deead2b436da11dfa5b4e",
    "alias": "TURBINE_01",
    "verificationMethod": [{
      "type": "SiliconPufVerificationKey2026",
      "hardwareAttestation": {
        "standard": "MYCA-RHIZOME-PUF-V1",
        "zeroByteShield": true
      }
    }],
    "service": [{
      "type": "MyceliumM2MWalletService",
      "gasPolicy": "ZERO_GAS_GUARANTEED"
    }]
  }
}
```

---

## 📄 Documentation & Whitepaper

* **[Comprehensive Whitepaper (EN / TR)](docs/WHITEPAPER_COMPREHENSIVE.md)**: Full mathematical proofs, TAM analysis, and sequence diagrams.
* **[Two-Lane Economic Model](docs/ECONOMIC_MODEL.md)**: Provable Real-Yield formula $\text{APY} = \min(Y/X, 0.18)$.
* **[Security Policy](.github/SECURITY.md)**: Disclosure guidelines and scope.

---

## 🛡️ License
MYCA Core and Sovereign Substrates are licensed under the [MIT License](LICENSE).
