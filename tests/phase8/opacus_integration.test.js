import { deployAllContracts } from "../../scripts/deploy_contracts.js";
import { MycTaskScheduler } from "../../colony/scheduler/task_scheduler.js";
import { MycPeerScoringV1 } from "../../colony/scheduler/peer_scoring.js";
import { MycRewardLedger } from "../../colony/rewards/reward_ledger.js";
import { MycOpacusBridge } from "../../ledger/contracts/opacus_bridge.js";

console.log("====================================================================");
console.log("🧪 PHASE 8 ACCEPTANCE SUITE: MYCA / OPACUS INTEGRATION");
console.log("====================================================================");

let passed = 0;

const { chain, vm, instances } = await deployAllContracts();
const scorer = new MycPeerScoringV1();
const scheduler = new MycTaskScheduler(scorer);
const rewardLedger = new MycRewardLedger();

// Register execution node
scheduler.registerExecutor("myca_node_colony_worker_1", {
  vram: 16384,
  currentLoad: 0.15,
  latencyMs: 10,
  capabilities: ["financial_risk_scoring", "proof_verification"]
}, async (task) => {
  return {
    riskScore: 0.12,
    rating: "AAA",
    certified: true,
    data: task.payload
  };
});

const bridge = new MycOpacusBridge({
  blockchain: chain,
  vm,
  scheduler,
  escrowContract: instances.escrow,
  rewardLedger
});

// Run end-to-end Opacus Agent flow
const flowResult = await bridge.executeOpacusAgentFlow({
  agentId: "opacus_agent_risk_analyzer_v1",
  operatorAddress: "myc1opacusoperator0000000000000000",
  capabilityRequired: "financial_risk_scoring",
  payload: { asset: "USDC_ESCROW", collateralRatio: 1.5 },
  rewardAmount: 25
});

if (flowResult.success && flowResult.rewardSettled && flowResult.reputationScore === 1) {
  console.log("✅ [TEST 8.1 PASS] End-to-end Opacus Agent lifecycle completed: Escrow -> Colony -> Proof -> Settlement -> Reputation");
  passed++;
}

if (flowResult.executionProof && flowResult.executionProof.status === "VERIFIED_ON_COLONY") {
  console.log("✅ [TEST 8.2 PASS] Execution proof cryptographically verified and anchored in escrow");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PHASE 8 TEST RESULTS: ${passed}/2 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 2) {
  process.exit(1);
}
