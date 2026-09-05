# Project 05: MycStreamPay LLM Inference Paywall

A high-performance, sub-millisecond AI streaming inference paywall powered by **MycStreamPay state channels** on **MYCA Network (Chain ID 108)**.

---

## 🌟 Key Features
- **Sub-Millisecond Per-Token Micropayments**: Deducts fractional micro-payments (0.001 $MYC per generated token) directly via off-chain signed state channels.
- **HTTP 402 Payment Required Enforcement**: Rejects unauthenticated requests or depleted channels cleanly.
- **Zero-Gas Invariant**: Opening, top-up, and settlement of stream channels incur strictly `0.00 MYC` gas fees via Proof-of-Resonance (PoR).
- **OpenAI-Compatible Streaming**: Standard SSE stream format (`text/event-stream`) allowing drop-in compatibility with LLM frontends and agentic pipelines.

---

## 📁 File Structure
- `server.js`: Paywall server protecting AI inference endpoints with `MycStreamPay` state channels.
- `client.js`: Autonomous AI inference client opening state channels on-chain and streaming responses.
- `test_paywall.js`: Automated unit and integration test suite.
- `package.json`: NPM package metadata and runner scripts.

---

## 🚀 How to Run

Ensure the MYC testnet node is running on `http://localhost:4040`:

### 1. Start the StreamPay Paywall Server
```bash
cd projects/05-streampay-paywall
npm start
# Server listens on http://localhost:6060
```

### 2. Run the Streaming Inference Client
```bash
npm run client
```

### 3. Run Automated Verification Test Suite
```bash
npm test
```

### Expected Output
```text
⚡ PROJECT 5: TESTING MYCSTREAMPAY INFERENCE PAYWALL SUITE
1. Verifying 402 Payment Required for unauthenticated requests...
✅ 402 Payment Required properly enforced!

2. Executing real-time inference streaming with on-chain state channel...
1. Opening MycStreamPay state channel with agent-myc-01...
✅ State channel opened! Channel ID: ch_...
   On-chain TxHash: 0x...
   Escrow Deposit: 15.00 MYC (Gas: 0.00 MYC)

2. Streaming AI inference tokens from paywall...
🤖 [LLM Response Stream]: [MYCA-LLM]: Proof-of-Resonance (PoR) lattice delivers sub-millisecond deterministic finality...

📊 Inference Complete!
   Tokens Generated : 23
   Micropayment Fee : 0.0230 MYC
   Gas Consumed     : 0.00 MYC (Zero-Gas PoR Invariant)
🎉 PROJECT 5 VERIFICATION PASSED WITH 100% SUCCESS!
```
