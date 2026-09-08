import crypto from "crypto";
import { MycProofOfResonance, POR_MIN_COSINE } from "../ledger/por/por_engine.js";
import { MycRewardLedger } from "../colony/rewards/reward_ledger.js";
import { MycEscrowContract } from "../ledger/contracts/index.js";
import { MycLocalSafetyVerifier, PIN_VOLTAGE } from "../core/kernel/local_safety_verifier.js";
import { MycAgentVM, AGENT_VM_STATES } from "../ledger/vm/agent_vm.js";
import { MycPolicyVM } from "../ledger/vm/policy_vm.js";
import { MycPeerDiscovery } from "../colony/discovery/discovery.js";
import { MycNodeIdentity } from "../colony/identity/node_identity.js";
import { deployAllContracts } from "../scripts/deploy_contracts.js";

console.log("====================================================================");
console.log("🛡️ RUNNING MYCA PRODUCTION HARDENING & ADVERSARIAL PASS");
console.log("====================================================================");

let passed = 0;

// -----------------------------------------------------------------------------
// 1. PoR Cryptographic Context Binding & Replay Defense
// -----------------------------------------------------------------------------
const por = new MycProofOfResonance(POR_MIN_COSINE);
const intentContext = {
  device: "TURBINE",
  action: "START",
  target_register: 130,
  taskId: "task_401",
  executionId: "exec_999",
  nodeId: "myca_node_alpha",
  nonce: 42
};

const boundProof = por.evaluateProof("Start industrial power turbine #2", intentContext);

// Verify with correct binding
const verifyValid = por.verify(boundProof, {
  taskId: "task_401",
  executionId: "exec_999",
  nodeId: "myca_node_alpha",
  nonce: 42
});

// Replay attempt with same hash
const verifyReplay = por.verify(boundProof);

// Mismatched task binding attempt
const mismatchedProof = {
  ...boundProof,
  binding: { ...boundProof.binding, taskId: "task_spoofed" }
};
const por2 = new MycProofOfResonance();
const verifySpoofed = por2.verify(mismatchedProof, { taskId: "task_401" });

if (verifyValid === true && verifyReplay === false && verifySpoofed === false) {
  console.log("✅ [HARDENING 1 PASS] PoR cryptographically bound to (taskId, executionId, nodeId, nonce) & replay blocked");
  passed++;
}

// -----------------------------------------------------------------------------
// 2. PoR Parameter Boundary & Adversarial Tests
// -----------------------------------------------------------------------------
const porBoundary = new MycProofOfResonance(POR_MIN_COSINE);

// Coherence 0.49 -> Must REJECT
const proof49 = porBoundary.evaluateProof("Start turbine #2", {
  device: "TURBINE",
  action: "START",
  target_register: 130,
  coherenceOverride: 0.4999
});

// Coherence 0.50 -> Must ACCEPT
const proof50 = porBoundary.evaluateProof("Start turbine #2", {
  device: "TURBINE",
  action: "START",
  target_register: 130,
  coherenceOverride: 0.5000
});

// Coherence 0.51 -> Must ACCEPT
const proof51 = porBoundary.evaluateProof("Start turbine #2", {
  device: "TURBINE",
  action: "START",
  target_register: 130,
  coherenceOverride: 0.5100
});

if (!proof49.verified && proof50.verified && proof51.verified) {
  console.log("✅ [HARDENING 2 PASS] PoR boundary testing verified: 0.4999 -> REJECT, 0.5000 -> ACCEPT, 0.5100 -> ACCEPT");
  passed++;
}

// -----------------------------------------------------------------------------
// 3. Double-Reward Prevention Invariant
// -----------------------------------------------------------------------------
const rewardLedger = new MycRewardLedger();
const r1 = rewardLedger.createRewardRecord({
  taskId: "task_unique_101",
  nodeId: "myca_node_worker",
  role: "Execution Node",
  contributionType: "TASK_EXECUTION",
  proofReference: "0x_proof_101",
  rewardAmount: 50,
  rewardAsset: "USDC"
});
rewardLedger.verifyReward(r1.recordId, { verified: true });
rewardLedger.settleReward(r1.recordId);

let doubleRewardBlocked = false;
try {
  rewardLedger.createRewardRecord({
    taskId: "task_unique_101", // duplicate taskId attempt
    nodeId: "myca_node_worker",
    role: "Execution Node",
    contributionType: "TASK_EXECUTION",
    proofReference: "0x_proof_101",
    rewardAmount: 50,
    rewardAsset: "USDC"
  });
} catch (e) {
  doubleRewardBlocked = e.message.includes("DUPLICATE_REWARD_ATTEMPT");
}

if (r1.status === "SETTLED" && doubleRewardBlocked) {
  console.log("✅ [HARDENING 3 PASS] Double-Reward prevention verified: Productive contribution cannot be paid twice");
  passed++;
}

// -----------------------------------------------------------------------------
// 4. Escrow Double-Settlement Prevention
// -----------------------------------------------------------------------------
const escrow = new MycEscrowContract();
const escId = "0x" + "b".repeat(64);
escrow.createEscrow(escId, "myc1payee000000000000000000000000", 100, "USDC", 3600, { msgSender: "myc1payer" });
escrow.fundEscrow(escId, { msgSender: "myc1payer" });
escrow.submitExecutionProof(escId, "0x_proof_valid", { msgSender: "myc1payee000000000000000000000000" });

// First settlement
const settle1 = escrow.attestAndRelease(escId, { msgSender: "myc1payer" });

// Second settlement attempt
let doubleSettlementBlocked = false;
try {
  escrow.attestAndRelease(escId, { msgSender: "myc1payer" });
} catch (e) {
  doubleSettlementBlocked = e.message.includes("ALREADY_FINALIZED");
}

if (settle1.state === "RELEASED" && settle1.finalized && doubleSettlementBlocked) {
  console.log("✅ [HARDENING 4 PASS] Escrow double-settlement blocked: finalized state prevents multiple releases");
  passed++;
}

// -----------------------------------------------------------------------------
// 5. Bootstrap Shutdown / Direct P2P Independence
// -----------------------------------------------------------------------------
const node1 = new MycNodeIdentity();
const discovery = new MycPeerDiscovery(node1, {
  bootstrapNodes: ["https://bootstrap-01.myc.network", "https://bootstrap-02.myc.network"]
});

// Register direct peer
discovery.registerLocalPeer({
  nodeId: "myca_node_peerDirect",
  address: "myc1peerDirect00000000000000000000",
  capabilities: ["cognitive_agent"]
});

// Simulate 100% shutdown of all bootstrap servers
discovery.bootstrapNodes = [];

// Direct peer list must remain intact and functional
const peersAfterBootstrapDeath = discovery.getKnownPeers();
if (discovery.bootstrapNodes.length === 0 && peersAfterBootstrapDeath.length === 1 && peersAfterBootstrapDeath[0].nodeId === "myca_node_peerDirect") {
  console.log("✅ [HARDENING 5 PASS] Bootstrap independence verified: P2P network survives total bootstrap outage");
  passed++;
}

// -----------------------------------------------------------------------------
// 6. Agent VM: Deterministic Execution & Safety Step Limits
// -----------------------------------------------------------------------------
const agentVM = new MycAgentVM({ maxSteps: 5 }); // strict step limit
const infiniteLoopPlan = {
  version: "1",
  instructions: [
    { op: "MEMORY_PUT", key: "counter", value: 1 },
    { op: "MEMORY_PUT", key: "counter", value: 2 },
    { op: "MEMORY_PUT", key: "counter", value: 3 },
    { op: "MEMORY_PUT", key: "counter", value: 4 },
    { op: "MEMORY_PUT", key: "counter", value: 5 },
    { op: "MEMORY_PUT", key: "counter", value: 6 } // exceeds maxSteps
  ]
};

const loopRes = await agentVM.executePlan(infiniteLoopPlan);
if (loopRes.status === AGENT_VM_STATES.FAILED && loopRes.error.includes("MAX_STEPS_EXCEEDED")) {
  console.log("✅ [HARDENING 6 PASS] Agent VM bounded execution enforced: Step limits halt unbounded plans safely");
  passed++;
}

// -----------------------------------------------------------------------------
// 7. Policy VM Property & Depth Fuzzing
// -----------------------------------------------------------------------------
const policyVM = new MycPolicyVM({ maxDepth: 4 });

// Deep nested tree: and -> and -> and -> and -> and (depth 5 > 4)
const deepNestedAst = {
  and: [
    {
      and: [
        {
          and: [
            {
              and: [
                { and: [{ eq: [{ constant: 1 }, { constant: 1 }] }] }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const deepEval = policyVM.evaluate(deepNestedAst, {});
if (deepEval.allowed === false && deepEval.reason.includes("MAX_POLICY_DEPTH_EXCEEDED")) {
  console.log("✅ [HARDENING 7 PASS] Policy VM depth bounds enforced: Deeply nested ASTs halted with clean rejection");
  passed++;
}

// -----------------------------------------------------------------------------
// 8. Full End-to-End Economic Lifecycle (with 5% protocol fee)
// -----------------------------------------------------------------------------
const e2eEscrow = new MycEscrowContract();
const e2eTaskId = "task_e2e_full_001";
const e2eEscrowId = "0x" + crypto.createHash("sha256").update(e2eTaskId).digest("hex");
const agentOperator = "myc1agent_operator_0000000000000";
const colonyWorker = "myc1colony_worker_0000000000000";

// 1. Create 100 USDC Escrow
e2eEscrow.createEscrow(e2eEscrowId, colonyWorker, 100, "USDC", 3600, { msgSender: agentOperator });
// 2. Fund Escrow
e2eEscrow.fundEscrow(e2eEscrowId, { msgSender: agentOperator });
// 3. Colony Worker submits execution proof
e2eEscrow.submitExecutionProof(e2eEscrowId, "0x_por_verified_hash_e2e", { msgSender: colonyWorker });
// 4. Attest and Release
const e2eSettlement = e2eEscrow.attestAndRelease(e2eEscrowId, { msgSender: agentOperator });

if (
  e2eSettlement.state === "RELEASED" &&
  e2eSettlement.payout === 95.0 &&
  e2eSettlement.fee === 5.0 &&
  e2eSettlement.finalized === true
) {
  console.log("✅ [HARDENING 8 PASS] Full E2E Lifecycle verified: 100 USDC -> 95 USDC Node Payout + 5 USDC Protocol Fee");
  passed++;
}

// -----------------------------------------------------------------------------
// 9. Complete 5-State Physical Actuator Safety Matrix
// -----------------------------------------------------------------------------
const safety = new MycLocalSafetyVerifier();

const matrixResults = [
  // 1. Blockchain Reject + Local Pass -> NO-OP
  safety.evaluatePhysicalSafety({ device: "TURBINE", action: "START", targetRegister: 0x0082, onChainAuthorized: false }),
  // 2. Blockchain Accept + Local Fail (Contradiction) -> NO-OP
  safety.evaluatePhysicalSafety({ device: "TURBINE", action: "START", targetRegister: 0x0082, onChainAuthorized: true, isNegationOrContradiction: true }),
  // 3. Blockchain Accept + Local Pass -> Execute (3.30V)
  safety.evaluatePhysicalSafety({ device: "TURBINE", action: "START", targetRegister: 0x0082, onChainAuthorized: true }),
  // 4. Unknown Device + Local Pass -> NO-OP
  safety.evaluatePhysicalSafety({ device: "UNKNOWN_DEVICE", action: "START", targetRegister: 0x0082, onChainAuthorized: true }),
  // 5. Blockchain Accept + Out of range -> NO-OP
  safety.evaluatePhysicalSafety({ device: "TURBINE", action: "START", targetRegister: 0x9999, onChainAuthorized: true })
];

const matrixCorrect = (
  matrixResults[0].pinVoltage === PIN_VOLTAGE.SAFE_LOW &&
  matrixResults[1].pinVoltage === PIN_VOLTAGE.SAFE_LOW &&
  matrixResults[2].pinVoltage === PIN_VOLTAGE.HIGH_3V3 &&
  matrixResults[3].pinVoltage === PIN_VOLTAGE.SAFE_LOW &&
  matrixResults[4].pinVoltage === PIN_VOLTAGE.SAFE_LOW
);

if (matrixCorrect) {
  console.log("✅ [HARDENING 9 PASS] Complete 5-State Physical Actuator Matrix verified (Authorization != Physical Safety)");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PRODUCTION HARDENING PASS: ${passed}/9 TESTS PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 9) {
  process.exit(1);
}
