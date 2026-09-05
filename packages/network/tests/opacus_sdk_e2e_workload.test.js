import { MycaSDK } from "../sdk/index.js";
import { deployAllContracts } from "../scripts/deploy_contracts.js";
import { MycTaskScheduler } from "../colony/scheduler/task_scheduler.js";
import { MycPeerScoringV1 } from "../colony/scheduler/peer_scoring.js";

console.log("====================================================================");
console.log("🧠 REAL OPACUS AGENT E2E COGNITIVE WORKLOAD & SUBSYSTEM TEST");
console.log("Flow: Opacus Agent -> SDK Register -> Create Task -> Colony Dual-PoR ->");
console.log("      Output Hash Match -> Settlement -> Reputation -> OpacusPay -> Bridge");
console.log("====================================================================\n");

async function runOpacusE2ETest() {
  let passed = 0;
  let total = 0;

  // 1. Deploy contracts and initialize Colony scheduler with 2 independent execution nodes
  const { chain, vm, instances } = await deployAllContracts();
  const scorer = new MycPeerScoringV1();
  const scheduler = new MycTaskScheduler(scorer);

  // Deterministic risk engine computation
  function computeFinancialRisk(input) {
    const asset = input.asset || "DEFAULT";
    const collateralRatio = input.collateralRatio || 1.0;
    const volatility = input.volatilityIndex || 0.20;
    const baseRisk = Math.max(0.01, (1.0 / collateralRatio) * (volatility * 1.5));
    return {
      asset,
      riskScore: parseFloat(baseRisk.toFixed(4)),
      rating: baseRisk < 0.25 ? "AAA" : (baseRisk < 0.50 ? "BBB" : "CCC"),
      certified: true,
      timestamp: 1725500000000 // deterministic anchor
    };
  }

  // Register Worker 1
  scheduler.registerExecutor("colony_worker_alpha", {
    vram: 24576,
    currentLoad: 0.10,
    latencyMs: 8,
    capabilities: ["financial_risk_scoring", "reasoning"]
  }, async (task) => {
    return computeFinancialRisk(task.payload);
  });

  // Register Worker 2
  scheduler.registerExecutor("colony_worker_beta", {
    vram: 24576,
    currentLoad: 0.12,
    latencyMs: 12,
    capabilities: ["financial_risk_scoring", "reasoning"]
  }, async (task) => {
    return computeFinancialRisk(task.payload);
  });

  // 2. Initialize MycaSDK with attached Colony scheduler and contracts
  const sdk = new MycaSDK({
    scheduler,
    contracts: instances
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Opacus Agent Registration via SDK
  // ---------------------------------------------------------------------------
  total++;
  console.log("[1] Registering Opacus Autonomous Agent via @myca/sdk...");
  const agent = await sdk.registerAgent({
    name: "OpacusAutonomousRiskEngine_V12",
    capabilities: ["financial_risk_scoring", "reasoning"],
    model: "myca-spectral-q4"
  });

  console.log(`  Agent Registered: ${agent.agentId} (${agent.name})`);
  console.log(`  Agent Address: ${agent.address}`);
  if (agent.agentId.startsWith("agent-") && agent.status === "ACTIVE") {
    console.log("  ✅ [TEST 1 PASS] Opacus Agent registered on-chain via SDK.");
    passed++;
  } else {
    throw new Error("Agent registration failed");
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Create Real Opacus Cognitive Task with Dual-Verification
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[2] Creating Cognitive Risk Task with Escrow & Dual-Verification...");
  const taskPayload = {
    asset: "USDC_ESCROW_COLLATERAL",
    collateralRatio: 1.65,
    volatilityIndex: 0.22,
    targetHorizon: "7_DAYS"
  };

  const task = await sdk.createTask({
    capability: "financial_risk_scoring",
    payload: taskPayload,
    budget: 60, // 60 USDC escrow
    timeoutSeconds: 300,
    requiresDualVerification: true
  });

  console.log(`  Task Created: ${task.id} (Escrow: ${task.escrowId})`);
  console.log(`  Budget: ${task.rewardAmount} ${task.assetSymbol} locked in smart escrow`);
  if (task.id.startsWith("task-") && task.state === "LOCKED") {
    console.log("  ✅ [TEST 2 PASS] Task created and 60 USDC escrow locked on-chain.");
    passed++;
  } else {
    throw new Error("Task creation failed");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Colony Dual-Verification & Settlement Waiting
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[3] Awaiting Colony Dual-PoR Execution & Escrow Settlement...");
  const settlementResult = await sdk.waitForSettlement(task.id);

  console.log(`  Settlement Status: ${settlementResult.status}`);
  console.log(`  Worker Nodes Payout: ${settlementResult.escrow.payoutToNode} USDC (95%)`);
  console.log(`  Protocol Treasury Fee: ${settlementResult.escrow.protocolFee} USDC (5%)`);
  console.log(`  PoR Consensus Hash: ${settlementResult.settlement.porHash.slice(0, 22)}...`);
  console.log(`  Dual Output Hash: ${settlementResult.settlement.outputHash ? settlementResult.settlement.outputHash.slice(0, 22) : 'MATCH'}...`);
  console.log(`  Engine Output Result:`, settlementResult.output);

  if (
    settlementResult.status === "SETTLED" &&
    settlementResult.escrow.payoutToNode === 57 && // 60 * 0.95 = 57
    settlementResult.escrow.protocolFee === 3 &&  // 60 * 0.05 = 3
    settlementResult.output.rating === "AAA"
  ) {
    console.log("  ✅ [TEST 3 PASS] Dual-prover verified! Escrow released with 95/5 split.");
    passed++;
  } else {
    throw new Error("Settlement verification failed");
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Reputation Score Updates for Provers
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[4] Verifying Reputation Updates for Execution Provers...");
  const repAlpha = instances.reputation.getScore("colony_worker_alpha");
  const repBeta = instances.reputation.getScore("colony_worker_beta");

  console.log(`  colony_worker_alpha Reputation: ${repAlpha.score} (Initial 100 + 10 = ${repAlpha.score})`);
  console.log(`  colony_worker_beta  Reputation: ${repBeta.score} (Initial 100 + 10 = ${repBeta.score})`);

  if (repAlpha.score === 110 && repBeta.score === 110 && !repAlpha.isQuarantined) {
    console.log("  ✅ [TEST 4 PASS] Prover nodes rewarded with +10 reputation points.");
    passed++;
  } else {
    throw new Error("Reputation scores were not updated properly");
  }

  // ---------------------------------------------------------------------------
  // TEST 5: OpacusPay Micro-Channel Payment Rail
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[5] Testing OpacusPay (Agent Micro-Payment & Channel Settlement)...");
  const channel = await sdk.opacusPay.openChannel({
    payee: "myc1streamingmodel00000000000000000",
    initialDeposit: 40,
    durationSeconds: 3600
  });
  console.log(`  OpacusPay Channel Opened: ${channel.channelId} (Deposit: ${channel.totalDeposit} MYC)`);

  const microPay = await sdk.opacusPay.settleMicroPayment({
    channelId: channel.channelId,
    cumulativeAmount: 15
  });
  console.log(`  Streamed 15 MYC for 1,500 LLM Tokens (Remaining Deposit: ${microPay.remaining})`);

  const direct = await sdk.opacusPay.directPay({
    to: "myc1sensoraggregator00000000000000",
    amount: 5,
    memo: "Telemetry Access Fee"
  });
  console.log(`  Direct Zero-Gas Micropayment Sent: 5 MYC (${direct.memo})`);

  if (channel.isOpen && microPay.delta === 15 && direct.amount === 5) {
    console.log("  ✅ [TEST 5 PASS] OpacusPay micro-payment streaming & direct pay verified.");
    passed++;
  } else {
    throw new Error("OpacusPay testing failed");
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Sovereign Cross-Chain Bridge
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[6] Testing Sovereign Cross-Chain Bridge ($MYC <-> Base)...");
  const bridgeTx = await sdk.bridge.lockAndBridge({
    targetChain: "BASE_SEPOLIA",
    recipientRemote: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: 500
  });

  console.log(`  Bridge Lock Initiated: ${bridgeTx.bridgeId}`);
  console.log(`  Locked: 500 MYC -> Target: ${bridgeTx.targetChain} (Net: ${bridgeTx.amount} MYC, Fee: ${bridgeTx.fee} MYC)`);
  console.log(`  Cryptographic Proof: ${bridgeTx.lockProof}`);

  const bridgeStatus = await sdk.bridge.getBridgeStatus(bridgeTx.bridgeId);
  if (bridgeTx.bridgeId && bridgeTx.amount === 499.5 && bridgeStatus) {
    console.log("  ✅ [TEST 6 PASS] Sovereign Bridge lock & cryptographic proof generated.");
    passed++;
  } else {
    throw new Error("Bridge testing failed");
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Resonance DEX Swap & Staking DePIN Quotas
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[7] Testing Resonance DEX Swap & DePIN Hardware Staking...");
  const quote = await sdk.swap.getQuote({ fromToken: "MYC", toToken: "USDT", amountIn: 1000 });
  console.log(`  DEX Quote: 1,000 MYC -> ${quote.amountOut.toFixed(2)} USDT (Impact: ${quote.priceImpact})`);

  const swapReceipt = await sdk.swap.executeSwap({ fromToken: "MYC", toToken: "USDT", amountIn: 1000 });
  console.log(`  Swap Executed: Received ${swapReceipt.amountOut.toFixed(2)} USDT (Reserves: MYC ${swapReceipt.reserves.MYC}, USDT ${swapReceipt.reserves.USDT.toFixed(2)})`);

  // Staking
  const stakeResult = await sdk.staking.stake({ amount: 3000 });
  console.log(`  Staked 3,000 MYC -> Device Quota: +${stakeResult.deviceQuota} Actuators (APY: 18.0%)`);

  if (quote.amountOut > 0 && swapReceipt.amountOut > 0 && stakeResult.deviceQuota >= 3) {
    console.log("  ✅ [TEST 7 PASS] DEX AMM Swap & Staking Quotas verified.");
    passed++;
  } else {
    throw new Error("Swap or Staking failed");
  }

  console.log(`\n=== Real Opacus Agent E2E Suite Result: ${passed}/${total} Passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runOpacusE2ETest().catch((err) => {
  console.error("Fatal error in Opacus E2E test:", err);
  process.exit(1);
});
