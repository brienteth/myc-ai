/**
 * End-to-End Integration Test: Agent Bridge Gateway
 * 
 * Tests all three core scenarios:
 *  1. Opacus Cross-Chain Intent (Bridge Lock → Colony Execute → Settle → Bridge Release)
 *  2. IoT M2M Data Marketplace (Turbine → Pump, PoR + Escrow)
 *  3. Agent Economy Substrate (Orchestrator → Registry → Colony → Settlement)
 */

import { MycAgentBridgeGateway } from "../agent-core/agent_bridge_gateway.js";
import {
  MycBridgeContract,
  MycEscrowContract,
  MycTaskRegistryContract,
  MycAgentRegistryContract,
  MycReputationContract,
  MycTokenContract,
  MycOpacusPayContract
} from "../ledger/contracts/index.js";
import { MycTaskScheduler } from "../colony/scheduler/task_scheduler.js";
import { MycPeerScoringV1 } from "../colony/scheduler/peer_scoring.js";
import { MycMachineWalletManager } from "../depin/machine_wallet_manager.js";
import { MycLocalSafetyVerifier } from "../core/kernel/local_safety_verifier.js";

console.log("====================================================================");
console.log("🌉 RUNNING SUITE: AGENT BRIDGE GATEWAY — 3 SCENARIO E2E TEST");
console.log("====================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [TEST ${total} PASS] ${testName}`);
  } else {
    console.error(`  ❌ [TEST ${total} FAIL] ${testName}`);
  }
}

// ─── Setup ───────────────────────────────────────────────────────────
const bridgeContract = new MycBridgeContract();
const escrowContract = new MycEscrowContract();
const taskRegistryContract = new MycTaskRegistryContract();
const agentRegistryContract = new MycAgentRegistryContract();
const reputationContract = new MycReputationContract();
const tokenContract = new MycTokenContract();
const opacusPayContract = new MycOpacusPayContract();
const safetyVerifier = new MycLocalSafetyVerifier();
const machineManager = new MycMachineWalletManager({ safetyVerifier });

// Colony scheduler with 2 workers for dual-verification
const peerScorer = new MycPeerScoringV1();
const colonyScheduler = new MycTaskScheduler(peerScorer);

function computeRisk(payload = {}) {
  const asset = payload.asset || "USDC_ESCROW";
  const ratio = payload.collateralRatio || 1.65;
  const vol = payload.volatilityIndex || 0.22;
  const baseRisk = Math.max(0.01, (1.0 / ratio) * (vol * 1.5));
  return {
    asset,
    riskScore: parseFloat(baseRisk.toFixed(4)),
    rating: baseRisk < 0.25 ? "AAA" : (baseRisk < 0.50 ? "BBB" : "CCC"),
    certified: true,
    timestamp: Date.now()
  };
}

colonyScheduler.registerExecutor("colony_worker_alpha", {
  vram: 24576,
  currentLoad: 0.10,
  latencyMs: 8,
  capabilities: ["financial_risk_scoring", "reasoning", "spectral_inference", "DATA_FEED_TEMPERATURE_READINGS"]
}, async (task) => computeRisk(task.payload));

colonyScheduler.registerExecutor("colony_worker_beta", {
  vram: 16384,
  currentLoad: 0.15,
  latencyMs: 12,
  capabilities: ["financial_risk_scoring", "reasoning", "DATA_FEED_TEMPERATURE_READINGS"]
}, async (task) => computeRisk(task.payload));

// Create gateway
const gateway = new MycAgentBridgeGateway({
  bridgeContract,
  escrowContract,
  taskRegistryContract,
  agentRegistryContract,
  reputationContract,
  tokenContract,
  colonyScheduler,
  machineManager,
  opacusPayContract
});

// ═══════════════════════════════════════════════════════════════════
// SENARYO 1: Opacus Cross-Chain Intent
// ═══════════════════════════════════════════════════════════════════
console.log("\n📡 SENARYO 1: Opacus Cross-Chain Intent");
console.log("   Flow: Opacus intent → MycBridge lock → Colony execute → Settle → Bridge release\n");

const s1Result = await gateway.executeOpacusCrossChainIntent({
  agentId: "opacus-risk-agent-v2",
  targetChain: "BASE",
  recipientRemote: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  bridgeAmount: 500,
  taskCapability: "financial_risk_scoring",
  taskPayload: { asset: "USDC_BRIDGE_COLLATERAL", collateralRatio: 2.0, volatilityIndex: 0.18 },
  taskBudget: 75
});

assert(s1Result.success === true, "Senaryo 1: Flow completed successfully");
assert(s1Result.steps.length >= 7, `Senaryo 1: All steps executed (${s1Result.steps.length} steps)`);

const bridgeLockStep = s1Result.steps.find(s => s.step === "BRIDGE_LOCKED");
assert(bridgeLockStep && bridgeLockStep.amount > 0, `Senaryo 1: Bridge locked ${bridgeLockStep?.amount} MYC`);

const escrowSettleStep = s1Result.steps.find(s => s.step === "ESCROW_SETTLED");
assert(escrowSettleStep && escrowSettleStep.payout > 0, `Senaryo 1: Escrow settled with payout ${escrowSettleStep?.payout}`);

const colonyVerifyStep = s1Result.steps.find(s => s.step === "COLONY_DUAL_VERIFIED");
assert(colonyVerifyStep && colonyVerifyStep.proofHash, "Senaryo 1: Colony dual-verification PoR proof generated");

const bridgeReleaseStep = s1Result.steps.find(s => s.step === "BRIDGE_RELEASED");
assert(bridgeReleaseStep && bridgeReleaseStep.signaturesCount >= bridgeReleaseStep.requiredQuorum,
  `Senaryo 1: Bridge released with BFT quorum (${bridgeReleaseStep?.signaturesCount}/${bridgeReleaseStep?.requiredQuorum} sigs)`);

assert(s1Result.summary.gasUsed === "0.00000000 MYC", "Senaryo 1: Zero-gas invariant maintained");

// Verify replay protection
try {
  const replayResult = gateway.releaseBridgeTransfer({
    bridgeId: bridgeLockStep.bridgeId,
    recipient: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: 100
  });
  assert(false, "Senaryo 1: Replay attack should have been rejected");
} catch (replayErr) {
  assert(replayErr.message.includes("REPLAY_ATTACK_DETECTED"),
    `Senaryo 1: Replay attack correctly blocked (${replayErr.message})`);
}

// ═══════════════════════════════════════════════════════════════════
// SENARYO 2: IoT / DePIN M2M Data Marketplace
// ═══════════════════════════════════════════════════════════════════
console.log("\n🏭 SENARYO 2: IoT M2M Data Marketplace");
console.log("   Flow: Turbine sensor data → Pump agent buys → PoR verify → Actuator → Settle\n");

const s2Result = await gateway.executeM2MDataTrade({
  sellerDid: "TURBINE_01",
  buyerDid: "PUMP_01",
  dataType: "TEMPERATURE_READINGS",
  pricePerUnit: 3,
  units: 8,
  actuateOnPurchase: { action: "START", register: 0, value: 0xFF00 }
});

assert(s2Result.success === true, "Senaryo 2: M2M data trade completed successfully");
assert(s2Result.steps.length >= 7, `Senaryo 2: All steps executed (${s2Result.steps.length} steps)`);

const sellerStep = s2Result.steps.find(s => s.step === "SELLER_VERIFIED");
assert(sellerStep && sellerStep.did === "TURBINE_01", "Senaryo 2: Turbine seller verified with telemetry");

const buyerStep = s2Result.steps.find(s => s.step === "BUYER_VERIFIED");
assert(buyerStep && buyerStep.did === "PUMP_01", "Senaryo 2: Pump buyer verified with sufficient balance");

const dataStep = s2Result.steps.find(s => s.step === "DATA_DELIVERED");
assert(dataStep && dataStep.readings === 8 && dataStep.proofHash, "Senaryo 2: 8 sensor readings delivered with PoR hash");

const m2mSettleStep = s2Result.steps.find(s => s.step === "M2M_ESCROW_SETTLED");
assert(m2mSettleStep && m2mSettleStep.payoutToSeller > 0, `Senaryo 2: Escrow settled, payout ${m2mSettleStep?.payoutToSeller} MYC`);

const paymentStep = s2Result.steps.find(s => s.step === "M2M_PAYMENT_SETTLED");
assert(paymentStep && paymentStep.gasUsed === "0.00000000 MYC", "Senaryo 2: M2M payment with zero-gas");

const actuatorStep = s2Result.steps.find(s => s.step === "ACTUATOR_EXECUTED");
assert(actuatorStep && actuatorStep.device === "PUMP_01", "Senaryo 2: Pump actuator triggered after data purchase");

assert(s2Result.summary.gasUsed === "0.00000000 MYC", "Senaryo 2: Zero-gas invariant across entire M2M flow");

// ═══════════════════════════════════════════════════════════════════
// SENARYO 3: Agent Economy Substrate
// ═══════════════════════════════════════════════════════════════════
console.log("\n🧠 SENARYO 3: Agent Economy Substrate");
console.log("   Flow: Opacus orchestrator → Agent Registry → Colony → Settlement → Reputation\n");

const s3Result = await gateway.executeAgentEconomyWorkflow({
  orchestratorId: "opacus-master-orchestrator",
  agentIds: ["opacus-risk-analyst", "opacus-compliance-checker"],
  taskCapability: "financial_risk_scoring",
  taskPayload: { asset: "MYC_NATIVE", collateralRatio: 1.8, volatilityIndex: 0.25 },
  totalBudget: 200
});

assert(s3Result.success === true, "Senaryo 3: Agent economy workflow completed");

const orchStep = s3Result.steps.find(s => s.step === "ORCHESTRATOR_REGISTERED" || s.step === "ORCHESTRATOR_ALREADY_REGISTERED");
assert(orchStep, "Senaryo 3: Orchestrator registered in AgentRegistry");

const subAgentsStep = s3Result.steps.find(s => s.step === "SUB_AGENTS_REGISTERED");
assert(subAgentsStep && subAgentsStep.agents.length === 2, "Senaryo 3: 2 sub-agents registered");

const channelStep = s3Result.steps.find(s => s.step === "PAYMENT_CHANNEL_OPENED");
assert(channelStep && channelStep.deposit === 200, "Senaryo 3: OpacusPay channel opened with 200 MYC");

const tasksStep = s3Result.steps.find(s => s.step === "TASKS_EXECUTED_AND_SETTLED");
assert(tasksStep && tasksStep.results.length === 2, "Senaryo 3: Both agent tasks executed");

const settledTasks = tasksStep.results.filter(t => t.status === "SETTLED");
assert(settledTasks.length === 2, "Senaryo 3: Both tasks settled with PoR proofs");
assert(settledTasks.every(t => t.proofHash), "Senaryo 3: All tasks have valid proof hashes");

assert(s3Result.summary.gasUsed === "0.00000000 MYC", "Senaryo 3: Zero-gas invariant maintained");
assert(s3Result.summary.totalPayout > 0, `Senaryo 3: Total payout ${s3Result.summary.totalPayout} MYC`);

// ═══════════════════════════════════════════════════════════════════
// Bridge Security Checks
// ═══════════════════════════════════════════════════════════════════
console.log("\n🔐 BRIDGE SECURITY VERIFICATION\n");

// Test: Exceed single transfer limit
try {
  bridgeContract.lockAndBridge("ETH", "0xdead", 60000, { msgSender: "myc1test" });
  assert(false, "Bridge: Single transfer limit should block >50K MYC");
} catch (e) {
  assert(e.message.includes("AMOUNT_EXCEEDS_SINGLE_LIMIT"), "Bridge: Single transfer circuit breaker (50K MYC max)");
}

// Test: Bridge pause
bridgeContract.pauseBridge();
try {
  bridgeContract.lockAndBridge("ETH", "0xdead", 100, { msgSender: "myc1test" });
  assert(false, "Bridge: Paused bridge should reject new locks");
} catch (e) {
  assert(e.message.includes("BRIDGE_EMERGENCY_PAUSED"), "Bridge: Emergency pause correctly blocks operations");
}
bridgeContract.unpauseBridge();

// Test: Insufficient BFT quorum
try {
  bridgeContract.releaseWithSignatures(
    "fake_transfer_id",
    "MYC",
    "0xrecipient",
    100,
    0,
    ["myc1validatoralpha00000000000000000"], // Only 1 signer, need 3+
    {}
  );
  assert(false, "Bridge: Insufficient quorum should be rejected");
} catch (e) {
  assert(e.message.includes("INSUFFICIENT_BFT_SIGNATURES"),
    `Bridge: BFT quorum enforcement (need ${bridgeContract.getRequiredQuorum()} sigs)`);
}

// ═══════════════════════════════════════════════════════════════════
// Multi-Asset Bridge Verification (USDT & USDC)
// ═══════════════════════════════════════════════════════════════════
console.log("\n💵 MULTI-ASSET BRIDGE VERIFICATION (USDT & USDC)\n");

// Test: Lock USDT on bridge
const usdtLock = bridgeContract.lockAndBridge("ARBITRUM", "0xRemoteUsdtReceiver", 250, { msgSender: "myc1test" }, "USDT");
assert(usdtLock.asset === "USDT", "Bridge: Successfully locked 250 USDT on bridge");
assert(usdtLock.amount === 250 - (250 * 10 / 10000), "Bridge: USDT fee correctly deducted");
assert(bridgeContract.totalLocked.USDT === 250, "Bridge: USDT totalLocked tracked correctly (250 USDT)");

// Test: Release USDT with BFT quorum
const quorumSigners = Array.from(bridgeContract.validatorSet).slice(0, 3);
const usdtRelease = bridgeContract.releaseWithSignatures(
  "xchain_usdt_tx_001",
  "ETHEREUM",
  "myc1usdtlocalreceiver",
  150,
  0,
  quorumSigners,
  {},
  "USDT"
);
assert(usdtRelease.asset === "USDT", "Bridge: Successfully released 150 USDT via BFT quorum");
assert(usdtRelease.status === "COMPLETED", "Bridge: USDT release status is COMPLETED");

// Test: Lock USDC on bridge
const usdcLock = bridgeContract.lockAndBridge("SOLANA", "SolanaUsdcReceiver1111111111111111111", 500, { msgSender: "myc1test" }, "USDC");
assert(usdcLock.asset === "USDC", "Bridge: Successfully locked 500 USDC on bridge");
assert(bridgeContract.totalLocked.USDC === 500, "Bridge: USDC totalLocked tracked correctly (500 USDC)");

// Test: Release USDC with BFT quorum
const usdcRelease = bridgeContract.releaseWithSignatures(
  "xchain_usdc_tx_001",
  "BASE",
  "myc1usdclocalreceiver",
  300,
  0,
  quorumSigners,
  {},
  "USDC"
);
assert(usdcRelease.asset === "USDC", "Bridge: Successfully released 300 USDC via BFT quorum");

// Test: Reject unsupported bridge asset
try {
  bridgeContract.lockAndBridge("BASE", "0xreceiver", 100, {}, "DOGE");
  assert(false, "Unsupported bridge asset should fail");
} catch (e) {
  assert(e.message.includes("UNSUPPORTED_BRIDGE_ASSET"), "Bridge: Correctly rejected unsupported asset (DOGE)");
}

// ═══════════════════════════════════════════════════════════════════
// Flow Stats & Introspection
// ═══════════════════════════════════════════════════════════════════
console.log("\n📊 FLOW STATISTICS\n");

const stats = gateway.getFlowStats();
assert(stats.totalFlows === 3, `Gateway: ${stats.totalFlows} complete flows recorded`);
assert(stats.bridgeStats.totalLocked > 0, `Bridge: ${stats.bridgeStats.totalLocked} MYC total locked`);
assert(stats.bridgeStats.processedTransfers > 0, `Bridge: ${stats.bridgeStats.processedTransfers} transfers processed`);
assert(stats.bridgeStats.validatorCount === 4, `Bridge: ${stats.bridgeStats.validatorCount} validators in set`);
assert(stats.bridgeStats.requiredQuorum === 3, `Bridge: BFT quorum = ${stats.bridgeStats.requiredQuorum} (2/3+1 of 4)`);

// ═══════════════════════════════════════════════════════════════════
console.log("\n====================================================================");
console.log(`🏆 AGENT BRIDGE GATEWAY: ${passed}/${total} TESTS PASSED`);
if (passed === total) {
  console.log("   🎉 ALL THREE SCENARIOS FULLY OPERATIONAL!");
} else {
  console.error(`   ⚠️  ${total - passed} test(s) failed`);
  process.exit(1);
}
console.log("====================================================================\n");
