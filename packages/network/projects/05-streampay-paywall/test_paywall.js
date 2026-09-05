import assert from "node:assert/strict";
import { createPaywallServer } from "./server.js";
import { runInferenceClient } from "./client.js";

const PAYWALL_PORT = 6061;
const MYC_NODE = "http://localhost:4040";

async function runTest() {
  console.log("====================================================================");
  console.log("⚡ PROJECT 5: TESTING MYCSTREAMPAY INFERENCE PAYWALL SUITE");
  console.log("====================================================================");

  // 1. Start ephemeral paywall test server
  const server = createPaywallServer();
  await new Promise(resolve => server.listen(PAYWALL_PORT, resolve));
  console.log(`✅ Ephemeral paywall server running on port ${PAYWALL_PORT}`);

  try {
    // 2. Verify 402 Payment Required when no channel ID header
    console.log("\n1. Verifying 402 Payment Required for unauthenticated requests...");
    const unauthRes = await fetch(`http://localhost:${PAYWALL_PORT}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" })
    });
    assert.equal(unauthRes.status, 402, "Must return HTTP 402 Payment Required");
    const unauthData = await unauthRes.json();
    assert.equal(unauthData.error, "PAYMENT_REQUIRED");
    console.log("✅ 402 Payment Required properly enforced!");

    // 3. Test end-to-end client with on-chain channel opening and streaming
    console.log("\n2. Executing real-time inference streaming with on-chain state channel...");
    process.env.PAYWALL_URL = `http://localhost:${PAYWALL_PORT}`;
    process.env.MYC_NODE = MYC_NODE;

    const result = await runInferenceClient({
      prompt: "Describe zero-gas settlement",
      paywallUrl: `http://localhost:${PAYWALL_PORT}`,
      nodeUrl: MYC_NODE
    });
    assert.ok(result.totalTokens > 0, "Should have received streamed tokens");
    assert.ok(result.channelId.startsWith("ch_"), "Valid channelId created");

    console.log("\n====================================================================");
    console.log("🎉 PROJECT 5 VERIFICATION PASSED WITH 100% SUCCESS!");
    console.log("====================================================================");
  } finally {
    server.close();
  }
}

runTest().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
