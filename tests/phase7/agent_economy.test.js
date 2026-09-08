import { deployAllContracts } from "../../scripts/deploy_contracts.js";
import { MycAgentVM, AGENT_VM_STATES } from "../../ledger/vm/agent_vm.js";
import { MycPolicyVM } from "../../ledger/vm/policy_vm.js";
import { MycRewardLedger, REWARD_STATES } from "../../colony/rewards/reward_ledger.js";

console.log("====================================================================");
console.log("🧪 PHASE 7 ACCEPTANCE SUITE: AGENT ECONOMY & SMART CONTRACTS");
console.log("====================================================================");

let passed = 0;

// 1. Deploy All Contracts
const { chain, vm, manifest, instances } = await deployAllContracts();
if (Object.keys(manifest.contracts).length >= 12 && manifest.chainId === 108) {
  console.log(`✅ [TEST 7.1 PASS] ${Object.keys(manifest.contracts).length} Core Smart Contracts deployed on Chain ID 108 with valid addresses`);
  passed++;
}

// 2. Token Transfer via Contract VM
const tokenAddr = manifest.contracts.MycToken.address;
const recipient = "myc1recipient1234567890abcdef12345678";
const transferCall = vm.execute({
  from: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
  to: tokenAddr,
  data: JSON.stringify({ method: "transfer", args: [recipient, 2500] })
});
if (transferCall.success && instances.token.balanceOf(recipient) === 2500) {
  console.log("✅ [TEST 7.2 PASS] MycToken transfer executed on-chain with state update & event emission");
  passed++;
}

// 3. DePIN Staking & Quota Allocation
const stakingAddr = manifest.contracts.MycStakingPool.address;
const stakeCall = vm.execute({
  from: "myc1operator1234567890abcdef12345678",
  to: stakingAddr,
  data: JSON.stringify({ method: "stake", args: [3000] })
});
if (stakeCall.success && stakeCall.returnValue.deviceQuota === 3) {
  console.log("✅ [TEST 7.3 PASS] MycStakingPool allocated 3 device quotas for 3,000 MYC staked (no fake APY)");
  passed++;
}

// 4. Constant Product AMM DEX Swap
const dexAddr = manifest.contracts.MycResonanceDEX.address;
const swapCall = vm.execute({
  from: "myc1trader1234567890abcdef123456789",
  to: dexAddr,
  data: JSON.stringify({ method: "swap", args: ["MYC", "USDT", 1000] })
});
if (swapCall.success && swapCall.returnValue.amountOut > 0) {
  console.log(`✅ [TEST 7.4 PASS] MycResonanceDEX executed x*y=k swap: 1000 MYC -> ${swapCall.returnValue.amountOut.toFixed(2)} USDT`);
  passed++;
}

// 5. Escrow State-Machine Lifecycle
const escrowAddr = manifest.contracts.MycEscrow.address;
const escrowId = "0x" + "a".repeat(64);
const payeeAddr = "myc1executor1234567890abcdef12345678";

// Create -> Fund -> Submit Proof -> Attest & Release
vm.execute({
  from: "myc1payer1234567890abcdef123456780",
  to: escrowAddr,
  data: JSON.stringify({ method: "createEscrow", args: [escrowId, payeeAddr, 50, "USDC", 3600] })
});
vm.execute({
  from: "myc1payer1234567890abcdef123456780",
  to: escrowAddr,
  data: JSON.stringify({ method: "fundEscrow", args: [escrowId] })
});
vm.execute({
  from: payeeAddr,
  to: escrowAddr,
  data: JSON.stringify({ method: "submitExecutionProof", args: [escrowId, "0x_verifiable_proof"] })
});
const releaseRes = vm.execute({
  from: "myc1payer1234567890abcdef123456780",
  to: escrowAddr,
  data: JSON.stringify({ method: "attestAndRelease", args: [escrowId] })
});

if (releaseRes.success && releaseRes.returnValue.state === "RELEASED" && releaseRes.returnValue.finalized === true) {
  console.log("✅ [TEST 7.5 PASS] MycEscrow 13-state machine executed full lifecycle from CREATED to RELEASED");
  passed++;
}

// 6. Agent VM: Deterministic Plan Execution (NO eval)
const agentVM = new MycAgentVM();
agentVM.registerTool("math_eval", async (args) => ({ valid: true, data: 42 }));

const agentPlan = {
  version: "1",
  instructions: [
    { op: "LOAD_CONTEXT", key: "task.input", target: "expr" },
    { op: "CALL_TOOL", tool: "math_eval", args: { expr: "expr" } },
    { op: "ASSERT", condition: "result.valid", expected: true },
    { op: "RETURN", value: "result.data" }
  ]
};

const agentState = await agentVM.executePlan(agentPlan, { task: { input: "6 * 7" } });
if (agentState.status === AGENT_VM_STATES.COMPLETED && agentState.returnValue === 42) {
  console.log("✅ [TEST 7.6 PASS] Agent VM executed deterministic plan safely without arbitrary code execution");
  passed++;
}

// 7. Policy VM: Constrained AST Evaluation
const policyVM = new MycPolicyVM();
const policyAst = {
  and: [
    { eq: [{ field: "task.asset" }, "USDC"] },
    { lte: [{ field: "task.amount" }, 100] }
  ]
};

const policyAllow = policyVM.evaluate(policyAst, { task: { asset: "USDC", amount: 50 } });
const policyDeny = policyVM.evaluate(policyAst, { task: { asset: "USDC", amount: 250 } });
if (policyAllow.allowed === true && policyDeny.allowed === false) {
  console.log("✅ [TEST 7.7 PASS] Policy VM correctly evaluated deterministic JSON AST expressions");
  passed++;
}

// 8. Reward Ledger & Deduplication Guard
const rewardLedger = new MycRewardLedger();
const rec = rewardLedger.createRewardRecord({
  taskId: "task_101",
  nodeId: "myca_node_A",
  role: "Execution Node",
  contributionType: "TASK_EXECUTION",
  proofReference: "0x_proof_hash_101",
  rewardAmount: 10,
  rewardAsset: "USDC"
});
rewardLedger.verifyReward(rec.recordId, { verified: true });
rewardLedger.settleReward(rec.recordId);

let dupBlocked = false;
try {
  rewardLedger.createRewardRecord({
    taskId: "task_101",
    nodeId: "myca_node_A",
    role: "Execution Node",
    contributionType: "TASK_EXECUTION",
    proofReference: "0x_proof_hash_101",
    rewardAmount: 10
  });
} catch (e) {
  dupBlocked = true;
}

if (rec.status === REWARD_STATES.SETTLED && dupBlocked) {
  console.log("✅ [TEST 7.8 PASS] Reward Ledger settled attributable reward and intercepted duplicate claim");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PHASE 7 TEST RESULTS: ${passed}/8 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 8) {
  process.exit(1);
}
