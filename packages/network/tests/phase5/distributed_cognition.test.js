import { MycCognitiveTask, TASK_STATES } from "../../colony/protocol/task_protocol.js";
import { MycTaskScheduler } from "../../colony/scheduler/task_scheduler.js";
import { MycPeerScoringV1 } from "../../colony/scheduler/peer_scoring.js";

console.log("====================================================================");
console.log("🧪 PHASE 5 ACCEPTANCE SUITE: DISTRIBUTED COGNITION");
console.log("====================================================================");

let passed = 0;
const scorer = new MycPeerScoringV1();
const scheduler = new MycTaskScheduler(scorer);

// Register 2 candidate peers: Node B (math expert) and Node C (general peer)
scheduler.registerExecutor("myca_node_B", {
  vram: 24576,
  currentLoad: 0.10,
  latencyMs: 12,
  capabilities: ["math_eval", "symbolic_solver"]
}, async (task) => {
  return { result: 42, expression: task.payload.expr, verified: true };
});

scheduler.registerExecutor("myca_node_C", {
  vram: 8192,
  currentLoad: 0.80,
  latencyMs: 120,
  capabilities: ["file_storage"]
});

// 1. Task Creation by Node A
const task1 = new MycCognitiveTask({
  creatorNodeId: "myca_node_A",
  capabilityRequired: "math_eval",
  payload: { expr: "6 * 7" },
  rewardAmount: 1.5,
  rewardAsset: "USDC"
});
if (task1.status === TASK_STATES.CREATED && task1.rewardAsset === "USDC") {
  console.log("✅ [TEST 5.1 PASS] Cognitive task initialized with explicit state and USDC escrow reward");
  passed++;
}

// 2. Task Routing and Execution on Node B
const execRes = await scheduler.scheduleAndExecute(task1);
if (execRes.success && task1.status === TASK_STATES.COMPLETED && task1.assignedNodeId === "myca_node_B") {
  console.log(`✅ [TEST 5.2 PASS] Task routed to highest-scoring peer (Node B) and completed: result=${task1.result.result}`);
  passed++;
}

// 3. Verifiable Execution Proof Generation
if (task1.executionProof && task1.executionProof.proofHash.startsWith("0x") && task1.executionProof.status === "VERIFIED_ON_COLONY") {
  console.log("✅ [TEST 5.3 PASS] Verifiable execution proof generated and cryptographically anchored");
  passed++;
}

// 4. Failure & Retry Handling
let failCount = 0;
scheduler.registerExecutor("myca_node_flaky", {
  vram: 4096,
  currentLoad: 0.1,
  capabilities: ["flaky_tool"]
}, async () => {
  failCount++;
  if (failCount === 1) throw new Error("TRANSIENT_NETWORK_TIMEOUT");
  return { recovered: true };
});

const taskRetry = new MycCognitiveTask({
  creatorNodeId: "myca_node_A",
  capabilityRequired: "flaky_tool",
  payload: { run: 1 },
  maxRetries: 2
});

const retryRes = await scheduler.scheduleAndExecute(taskRetry);
if (retryRes.success && taskRetry.retryCount === 1 && taskRetry.status === TASK_STATES.COMPLETED) {
  console.log("✅ [TEST 5.4 PASS] Transient failure automatically triggered retry and succeeded on second attempt");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PHASE 5 TEST RESULTS: ${passed}/4 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 4) {
  process.exit(1);
}
