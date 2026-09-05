import assert from "node:assert/strict";
import { MycColonyAgent } from "./agent.js";

async function runTest() {
  console.log("🧪 Testing Autonomous Colony AI Agent on MYC Network...");
  const agent = new MycColonyAgent({
    agentId: "agent-test-pilot",
    capability: "financial_risk_scoring"
  });

  assert.ok(agent.address.startsWith("myc1"), "Agent must have sovereign myc1 address");
  
  // 1. Capability registration test
  const cap = await agent.registerCapability();
  assert.equal(cap.name, "financial_risk_scoring");

  // 2. Dual-PoR Cognitive Task Execution test
  const taskRes = await agent.executeTask();
  assert.equal(taskRes.success, true);
  assert.ok(taskRes.settlement.porProofHash.startsWith("0x"), "Must generate PoR proof");
  assert.equal(taskRes.settlement.status, "SETTLED");
  assert.ok(agent.tasksCompleted >= 1);
  assert.ok(agent.totalEarned > 0);

  console.log("✅ Project 1 (Colony AI Agent) Test Passed with 100% Success!");
}

runTest().catch(err => {
  console.error("❌ Test Failed:", err.message);
  process.exit(1);
});
