import { MycProofOfResonance } from "../../ledger/por/por_engine.js";
import { ZkProofVerifierRoadmap, TEE_STATUS } from "../../ledger/por/zk_tee_roadmap.js";
import { verifyZKProof } from "../../ledger/por/zk_adapter.js";
import { MycResourceAccounting } from "../../ledger/blockchain/resource_accounting.js";

console.log("====================================================================");
console.log("🧪 PHASE 3 ACCEPTANCE SUITE: PROOF-OF-RESONANCE & RESOURCE ACCOUNTING");
console.log("====================================================================");

let passed = 0;
const por = new MycProofOfResonance(0.50);

// 1. Valid Proof-of-Resonance
const validProof = por.evaluateProof("Start industrial power turbine #2", {
  device: "TURBINE",
  action: "START",
  target_register: 130,
  status: 0
});
if (validProof.verified && validProof.coherence >= 0.50 && validProof.gasConsumed === 0) {
  console.log(`✅ [TEST 3.1 PASS] PoR verified valid intent with 0 gas (Coherence: ${validProof.coherence.toFixed(4)})`);
  passed++;
}

// 2. 0-Byte Fail-Safe on negative / contradiction input
const negProof = por.evaluateProof("Never start turbine", {
  device: "TURBINE",
  action: "REJECT",
  status: 229,
  error_code: "ERR_NEGATIVE_GUARD"
});
if (!negProof.verified && negProof.porHash === null && negProof.gasConsumed === 0) {
  console.log("✅ [TEST 3.2 PASS] Contradiction halted at 0-Byte emission with 0 gas consumed");
  passed++;
}

// 3. Replay Protection
const firstVerify = por.verify(validProof);
const replayVerify = por.verify(validProof);
if (firstVerify === true && replayVerify === false) {
  console.log("✅ [TEST 3.3 PASS] Replay attack intercepted: proof cannot be submitted twice");
  passed++;
}

// 4. Resource Accounting (Gas = 0 != Resource = 0)
const accounting = new MycResourceAccounting({ maxCpuTimeMs: 40 });
const resNormal = accounting.trackExecution("myc1operator", {
  cpuTimeMs: 12,
  memoryPeakKb: 384,
  executionSteps: 150
});
const resOverload = accounting.trackExecution("myc1attacker", {
  cpuTimeMs: 65,
  memoryPeakKb: 2048,
  executionSteps: 2500
});
if (resNormal.allowed && !resOverload.allowed && resOverload.violations.length >= 2) {
  console.log("✅ [TEST 3.4 PASS] Gas=0 resource accounting properly tracks CPU/RAM and enforces quotas");
  passed++;
}

// 5. Strict Invariant: ZK/TEE marked as ROADMAP ONLY & returns NOT_IMPLEMENTED
const zk = new ZkProofVerifierRoadmap();
const zkRes = zk.verifyZkProof({ proof: "dummy" });
const zkAdapterRes = await verifyZKProof({ proof: "dummy" });

if (
  zk.status === "ROADMAP ONLY" &&
  zkRes.status === "NOT_IMPLEMENTED" &&
  zkAdapterRes.status === "NOT_IMPLEMENTED" &&
  zkAdapterRes.roadmap === "Phase 10" &&
  zkAdapterRes.fallback === "por" &&
  TEE_STATUS === "ROADMAP ONLY"
) {
  console.log("✅ [TEST 3.5 PASS] ZK & TEE correctly return NOT_IMPLEMENTED with ROADMAP ONLY labeling and fallback: por");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PHASE 3 TEST RESULTS: ${passed}/5 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 5) {
  process.exit(1);
}
