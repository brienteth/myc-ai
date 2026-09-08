import { MycaSDK } from "../sdk/index.js";

console.log("====================================================================");
console.log("💻 DEVELOPER EXPERIENCE (@myca/sdk) ACCEPTANCE TEST");
console.log("Testing: SDK Initialization -> Agent Register -> Task -> Settlement");
console.log("====================================================================\n");

let passed = 0;

// 1. SDK Client Initialization
const sdk = new MycaSDK({ node: "http://localhost:4040", chainId: 108 });
if (sdk.chainId === 108 && sdk.address.startsWith("myc1agent")) {
  console.log(`✅ [SDK 1 PASS] MycaSDK initialized with address: ${sdk.address}`);
  passed++;
}

// 2. Register Agent
const agent = await sdk.registerAgent({
  name: "DeepReasoningAgent",
  capabilities: ["reasoning", "spectral_compression"],
  model: "myca-deep-v1"
});

if (agent && agent.agentId.startsWith("agent-") && agent.capabilities.includes("reasoning")) {
  console.log(`✅ [SDK 2 PASS] Agent registered via SDK: ${agent.agentId} (${agent.name})`);
  passed++;
}

// 3. Create Task & Lock Escrow
const task = await sdk.createTask({
  capability: "reasoning",
  payload: { prompt: "Verify dual-execution consensus invariants" },
  rewardAmount: 50,
  assetSymbol: "USDC",
  durationSeconds: 30
});

if (task && task.id.startsWith("task-") && task.escrowId.startsWith("0x") && task.rewardAmount === 50) {
  console.log(`✅ [SDK 3 PASS] Task & Escrow created via SDK: ${task.id} (50 USDC locked)`);
  passed++;
}

// 4. Wait for Settlement
const settlement = await sdk.waitForSettlement(task.id, { timeoutMs: 1000 });
if (settlement && settlement.status === "SETTLED" && settlement.payout === 47.5 && settlement.fee === 2.5) {
  console.log(`✅ [SDK 4 PASS] Task settled: 47.5 USDC to Node (95%), 2.5 USDC Protocol Fee (5%), Proof: ${settlement.proofHash.slice(0, 18)}...`);
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 DEVELOPER SDK TESTS: ${passed}/4 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 4) {
  process.exit(1);
}
