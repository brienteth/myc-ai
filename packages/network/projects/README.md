# 🌐 MYCA Network Showcase Projects (Chain ID: 108)

This directory contains **5 distinct, production-ready showcase projects** demonstrating the full capabilities of the **MYCA Network Platform**:
Zero-Gas Invariant, Proof-of-Resonance (PoR), Autonomous AI Colony, Silicon PUF DePIN, Custom Smart Contracts, Web3 Sovereign Wallet, and Sub-Millisecond StreamPay.

---

## 📂 Project Overview

| Project | Name | Category | Core MYCA Capabilities |
|---|---|---|---|
| **01** | [`01-ai-agent-colony`](./01-ai-agent-colony/) | Autonomous AI | Sovereign Wallet derivation, Colony Marketplace capability registration, Dual-PoR cognitive tasks, Zero-Gas USDC escrow payout |
| **02** | [`02-depin-hardware-monitor`](./02-depin-hardware-monitor/) | DePIN & IoT | Silicon PUF hardware DID (`myc1puf...`), 48-byte binary frame with CRC-16, Modbus PLC actuation, 0-Byte Negation Shield |
| **03** | [`03-custom-defi-contract`](./03-custom-defi-contract/) | Smart Contracts / DeFi | ContractVM deployment (`POST /api/contract/deploy`), read-only calls (`myc_callContract`), zero-gas mutations (`myc_sendTransaction`), APY compounding |
| **04** | [`04-web3-dapp-portal`](./04-web3-dapp-portal/) | Frontend Web3 | `window.myc` Sovereign Wallet, zero-gas token transfers, testnet faucet claiming, Opacus USDC task escrow, live SSE event streaming |
| **05** | [`05-streampay-paywall`](./05-streampay-paywall/) | Micro-Payments / AI | `MycStreamPay` state channels, sub-millisecond per-token micropayments (0.001 MYC), HTTP 402 paywall, zero gas |

---

## ⚡ Prerequisites

Ensure the MYCA Testnet node is running on your machine:
```bash
# In the myc-network repository root:
node server.js
# Confirmed running on http://localhost:4040
```

---

## 🚀 Running the Entire Suite

You can verify all 5 projects at once with:

```bash
# In this directory:
node 01-ai-agent-colony/test_agent.js && \
node 02-depin-hardware-monitor/test_monitor.js && \
node 03-custom-defi-contract/deploy_and_interact.js && \
node 04-web3-dapp-portal/test_dapp.js && \
node 05-streampay-paywall/test_paywall.js
```

Or explore individual project folders and check their local `README.md` for specific instructions.
