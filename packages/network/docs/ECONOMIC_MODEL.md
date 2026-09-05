# MYCA Economic Model — Sovereign Two-Lane Protocol Economics

**Version:** 2.0.0-PROD  
**Invariant §14 & §15:** The network separates protocol security from task execution into two distinct economic lanes. Zero gas does **NOT** mean zero economic activity.

---

## 1. Two Economic Lanes

```
┌─────────────────────────────────────────────────────────────┐
│                       MYCA ECONOMY                          │
├──────────────────────────────┬──────────────────────────────┤
│  LANE A: PROTOCOL SECURITY   │   LANE B: TASK EXECUTION     │
├──────────────────────────────┼──────────────────────────────┤
│  Primary Asset: $MYC         │   Primary Asset: USDC/Escrow │
│  Participants:               │   Participants:              │
│   • Validators               │    • Execution Nodes         │
│   • Staking Nodes            │    • Colony Peers            │
│   • Infrastructure Security  │    • Agent Operators         │
│  Funding Source:             │    • Device Gateways         │
│   • Protocol Epoch Pool      │  Funding Source:             │
│   • Misbehavior Slashing     │    • User Task Escrows       │
│   • DePIN Device Quotas      │    • Milestone Releases      │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 2. Staking Model & Purpose

Staking serves 4 concrete protocol security functions:
1. **Sybil Resistance:** Minimum stake required to register as Validator or Device Gateway.
2. **Validator Eligibility:** Stake determines voting power and block proposer round-robin weights.
3. **Execution Authorization:** Guarantees execution nodes have collateral at risk.
4. **Misbehavior Collateral (Slashing):** Contradiction attacks, double-proposals, or safety-guard violations trigger deterministic slashing.

> **Economic Invariant §16:** APY is **NOT** a blind 18% permanent marketing promise. Staking yields originate strictly from protocol reward emissions and task settlement fees. If revenue is 0, yield is 0.

---

## 3. Reward Ledger (`RewardRecord`) Schema

Every reward distribution creates a reproducible on-chain `RewardRecord`:

```text
RewardRecord {
    taskId:           String (Unique task identifier)
    nodeId:           String (Beneficiary node identity)
    role:             String (Validator | Execution Node | Colony Peer)
    contributionType: String (BLOCK_PROPOSAL | TASK_EXECUTION | TOOL_ROUTING)
    resourceUsage:    Object (cpuTimeMs, memoryKb, steps)
    proofReference:   String (PoR hash or Execution Proof hash)
    rewardAsset:      String (MYC | USDC)
    rewardAmount:     Number (Deterministic payment amount)
    epoch:            Number (Blockchain epoch index)
    status:           Enum (PENDING | VERIFIED | SETTLED | REJECTED | SLASHED)
}
```
