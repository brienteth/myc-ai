# Project 04: Web3 dApp Portal (Sovereign Wallet & OpacusPay Integration)

A modern, responsive decentralized application (dApp) built on **MYCA Network (Chain ID 108)** demonstrating seamless Sovereign Wallet connectivity, zero-gas token transfers, testnet faucet claiming, autonomous AI task escrow, and Opacus multi-chain settlement rails.

---

## 🌟 Key Features
- **Sovereign Wallet Inpage Provider (`window.myc`)**: Integrates with the official MYCA Chrome Extension, offering automatic detection and standalone browser fallback.
- **Strict Zero-Gas Transfers**: Transfer native $MYC tokens with deterministic `0.00 MYC` gas invariant guaranteed by Proof-of-Resonance (PoR).
- **Opacus Kernel Compute Balance**: Displays multi-chain USDC compute balance bridged across fiat (MoonPay/Transak), 42+ crypto chains (Base/Arbitrum/Polygon), and native 0G rails.
- **Autonomous AI Task Escrow**: Locks USDC compute deposits into on-chain escrow to orchestrate autonomous Colony AI agent executions.
- **Real-Time Protocol Event Stream**: Subscribes to Server-Sent Events (`/api/events`) to stream live block proposals, contract state transitions, and transfer confirmations.

---

## 📁 File Structure
- `index.html`: Cyber-dark glassmorphism user interface with responsive metrics grid.
- `style.css`: Custom Vanilla CSS design system with glowing cyber accents and animations.
- `app.js`: Complete client logic interfacing with `window.myc` and MYCA node REST/JSON-RPC APIs.
- `server.js`: Lightweight HTTP static web server on port 5050.
- `test_dapp.js`: Node.js automated verification test suite.
- `package.json`: NPM scripts and metadata.

---

## 🚀 How to Run

### 1. Start the dApp Web Server
```bash
cd projects/04-web3-dapp-portal
npm start
# Server listens at http://localhost:5050
```

### 2. Run Automated Verification Test
```bash
node test_dapp.js
```

### Expected Test Output
```text
⚡ PROJECT 4: TESTING WEB3 DAPP PORTAL & SOVEREIGN WALLET RAILS
1. Testing balance query endpoint /api/balance/:account...
✅ Balance retrieved: 489995000 MYC

2. Testing zero-gas transfer via POST /api/transfer...
✅ Transfer confirmed! TxHash: 0x...
   Gas Consumed: 0.00 MYC (Zero-Gas Invariant)

3. Testing testnet faucet request via POST /api/faucet...
✅ Faucet response: Limit status

4. Testing Opacus Escrow creation via POST /api/escrow/create...
✅ Opacus AI Task Escrow created successfully! Escrow ID: 0x...

5. Testing SSE event stream connectivity GET /api/events...
✅ SSE live event stream reachable with text/event-stream header!
🎉 PROJECT 4 VERIFICATION PASSED WITH 100% SUCCESS!
```
