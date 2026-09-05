export async function runInferenceClient({
  prompt = "Tell me about MYC Network",
  paywallUrl = process.env.PAYWALL_URL || "http://localhost:6060",
  nodeUrl = process.env.MYC_NODE || "http://localhost:4040"
} = {}) {
  console.log("====================================================================");
  console.log("⚡ MYCSTREAMPAY LLM INFERENCE CLIENT");
  console.log("====================================================================");

  const senderAddress = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
  const agentPayee = "agent-myc-01"; // Verified colony agent in network

  // 1. Open StreamPay State Channel on Chain ID 108
  console.log(`\n1. Opening MycStreamPay state channel with ${agentPayee}...`);
  const openRes = await fetch(`${nodeUrl}/api/pay/channel/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: agentPayee,
      deposit: 15.0,
      sender: senderAddress,
      durationSeconds: 3600
    })
  });

  const openData = await openRes.json();
  if (!openData.success) {
    throw new Error(`Failed to open state channel: ${openData.error}`);
  }

  const channelId = openData.channelId;
  console.log(`✅ State channel opened! Channel ID: ${channelId}`);
  console.log(`   On-chain TxHash: ${openData.txHash}`);
  console.log(`   Escrow Deposit: 15.00 MYC (Gas: 0.00 MYC)`);

  // 2. Request Streaming AI Inference through Paywall
  console.log(`\n2. Streaming AI inference tokens from paywall (${paywallUrl})...\n`);
  process.stdout.write("🤖 [LLM Response Stream]: ");

  const inferenceRes = await fetch(`${paywallUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MYC-Channel-ID": channelId,
      "X-MYC-Sender": senderAddress
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 25
    })
  });

  if (inferenceRes.status === 402) {
    throw new Error("Paywall rejected request: Payment Required.");
  }

  let totalTokens = 0;
  let lastConsumed = "0.0000 MYC";

  // Read response stream
  const reader = inferenceRes.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;

        try {
          const chunk = JSON.parse(raw);
          if (chunk.token) {
            process.stdout.write(chunk.token);
            totalTokens++;
            lastConsumed = chunk.totalConsumed;
          }
        } catch (e) {}
      }
    }
  }

  console.log("\n\n====================================================================");
  console.log(`📊 Inference Complete!`);
  console.log(`   Tokens Generated : ${totalTokens}`);
  console.log(`   Micropayment Fee : ${lastConsumed}`);
  console.log(`   Gas Consumed     : 0.00 MYC (Zero-Gas PoR Invariant)`);
  console.log("====================================================================");

  return { totalTokens, lastConsumed, channelId };
}

// Standalone execution
if (process.argv[1]?.endsWith("client.js")) {
  runInferenceClient().catch(err => {
    console.error("\n❌ Client Error:", err.message);
    process.exit(1);
  });
}
