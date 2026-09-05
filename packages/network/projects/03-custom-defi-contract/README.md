# Project 03: Custom DeFi Smart Contract (Zero-Gas Yield Vault)

A production-ready example of deploying and interacting with custom smart contracts on **MYC Network (Chain ID 108)** using the zero-gas Contract VM.

---

## 🌟 Features
- **Deterministic Deployment**: Deploy custom smart contracts via REST (`POST /api/contract/deploy`) or JSON-RPC (`myc_deployUserContract`).
- **Zero-Gas Invariant**: Stake, unstake, and claim yields without consuming ETH, gas, or transaction fees.
- **Autonomous Yield Calculation**: In-contract APY compounding (14.5% base yield) computed deterministically on-chain.
- **Event Bus Integration**: Emits real-time pub/sub contract events (`contract:<address>:<event>`).

---

## 📁 Files
- `NeuroYieldPool.js`: Contract class definition with state isolation and reentrancy protection.
- `deploy_and_interact.js`: Automated deployment, read call (`myc_callContract`), and state mutation (`myc_sendTransaction`).
- `package.json`: NPM package metadata with run script.

---

## 🚀 How to Run

Ensure the MYC testnet node is running on `http://localhost:4040`:

```bash
# Run automated deployment & live interaction script
node deploy_and_interact.js
```

### Expected Output
```text
⚡ PROJECT 3: DEPLOYING & INTERACTING WITH CUSTOM DEFI CONTRACT
1. Deploying NeuroYieldPool contract via POST /api/contract/deploy...
✅ Contract deployed at address: myc1c...
   Gas Consumed: 0.00 MYC (Zero-Gas Invariant)

2. Querying getStakeInfo before stake (Read-Only JSON-RPC myc_callContract)...
   Current Position: { amount: 0, reward: 0 }

3. Executing stake(250) transaction via JSON-RPC myc_sendTransaction...
✅ Stake transaction confirmed on chain!
   TxHash: 0x...
   Output: { status: 'STAKED', amount: 250, totalStaked: 250, gasFee: '0.00 MYC' }

4. Executing claimYield() transaction with Zero Gas...
✅ Yield claimed with zero gas!
   Reward Output: { status: 'YIELD_CLAIMED', reward: 36.25, totalReward: 36.25 }
🎉 PROJECT 3 VERIFICATION PASSED WITH 100% SUCCESS!
```
