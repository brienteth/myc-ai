import { fork } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("====================================================================");
console.log("🖥️ 2-SERVER MULTI-PROCESS CLUSTER INTEGRATION TEST");
console.log("Server 1 (PID A): Bootstrap-01 + Validator A");
console.log("Server 2 (PID B): Validator B + Execution Node");
console.log("Physical Isolation: Separate OS Processes & Distinct TCP Sockets");
console.log("====================================================================\n");

async function runClusterTest() {
  let passed = 0;
  let total = 0;

  const server1Path = path.join(__dirname, "fixtures/server1_node.js");
  const server2Path = path.join(__dirname, "fixtures/server2_node.js");

  // Helper for message response
  function waitForMessage(proc, predicate, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message in process ${proc.pid}`));
      }, timeoutMs);

      const handler = (msg) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          proc.off("message", handler);
          resolve(msg);
        }
      };
      proc.on("message", handler);
    });
  }

  // 1. Spawn Server 1
  console.log("[1] Spawning Server 1 (Bootstrap-01 + Validator A)...");
  const server1 = fork(server1Path, [], { stdio: ["inherit", "inherit", "inherit", "ipc"] });
  const s1Ready = await waitForMessage(server1, m => m.type === "SERVER1_READY");
  console.log(`  Server 1 running at PID ${s1Ready.pid}`);
  console.log(`  Bootstrap TCP: ${s1Ready.bootstrapHost}:${s1Ready.bootstrapPort}`);
  console.log(`  Validator A TCP: ${s1Ready.valAHost}:${s1Ready.valAPort}`);

  // 2. Spawn Server 2
  console.log("\n[2] Spawning Server 2 (Validator B + Execution Node)...");
  const server2 = fork(server2Path, [], { stdio: ["inherit", "inherit", "inherit", "ipc"] });
  const s2Ready = await waitForMessage(server2, m => m.type === "SERVER2_READY");
  console.log(`  Server 2 running at PID ${s2Ready.pid}`);
  console.log(`  Validator B TCP: ${s2Ready.valBHost}:${s2Ready.valBPort}`);
  console.log(`  Execution Node TCP: ${s2Ready.execHost}:${s2Ready.execPort}`);

  // Verify process separation
  total++;
  if (server1.pid !== server2.pid) {
    console.log(`  ✅ Process Isolation Confirmed: Server 1 (PID ${server1.pid}) != Server 2 (PID ${server2.pid})`);
    passed++;
  } else {
    throw new Error("Server 1 and Server 2 must run in distinct OS processes");
  }

  // Configure consensus across servers
  server2.send({
    type: "SETUP_CONSENSUS",
    valAAddress: s1Ready.valAAddress
  });
  await waitForMessage(server2, m => m.type === "CONSENSUS_READY");

  server1.send({
    type: "REGISTER_VALIDATOR_B",
    address: s2Ready.valBAddress,
    stake: 100000
  });
  await waitForMessage(server1, m => m.type === "VALIDATOR_B_REGISTERED");

  // 3. Real Cross-Server Peer Discovery
  total++;
  console.log("\n[3] Testing Real Cross-Server Peer Discovery via TCP...");
  server2.send({
    type: "DISCOVER_AND_CONNECT",
    bootstrapHost: s1Ready.bootstrapHost,
    bootstrapPort: s1Ready.bootstrapPort,
    valAHost: s1Ready.valAHost,
    valAPort: s1Ready.valAPort
  });

  const discoveryResult = await waitForMessage(server2, m => m.type === "DISCOVERY_AND_CONNECT_DONE");
  console.log(`  Discovered ${discoveryResult.peersDiscovered} peers across network in ${discoveryResult.discoveryLatencyUs.toFixed(1)} µs`);
  console.log(`  Validator B Connected Peers: ${discoveryResult.valBPeers}, Exec Node Connected Peers: ${discoveryResult.execPeers}`);

  if (discoveryResult.peersDiscovered >= 1 && discoveryResult.valBPeers >= 2) {
    console.log("  ✅ Real Cross-Server Peer Discovery & Direct P2P Interconnect Successful.");
    passed++;
  } else {
    console.error("  ❌ Peer discovery or connection count below threshold");
  }

  // Connect Validator A (Server 1) back to Validator B and Exec Node (Server 2)
  server1.send({ type: "CONNECT_PEER", host: s2Ready.valBHost, port: s2Ready.valBPort });
  await waitForMessage(server1, m => m.type === "PEER_CONNECTED");
  server1.send({ type: "CONNECT_PEER", host: s2Ready.execHost, port: s2Ready.execPort });
  await waitForMessage(server1, m => m.type === "PEER_CONNECTED");

  await new Promise(r => setTimeout(r, 100)); // allow handshake to settle

  // 4. Real Cross-Server Block Propagation
  total++;
  console.log("\n[4] Testing Real Cross-Server Block Propagation & BFT Leader Rotation...");
  const recipientAddr = s2Ready.execAddress;
  const t0 = process.hrtime.bigint();

  // Block #1: Produced by Server 2 (Validator B is leader for round 1 % 2 = 1)
  server2.send({
    type: "SUBMIT_AND_PRODUCE_BLOCK",
    transaction: {
      from: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      to: recipientAddr,
      value: 7500,
      nonce: 0,
      signature: "0x" + "f".repeat(64)
    }
  });

  const block1Result = await waitForMessage(server2, m => m.type === "BLOCK_PRODUCED");
  console.log(`  Server 2 (Validator B) produced Block #${block1Result.blockNumber} (Hash: ${block1Result.blockHash.slice(0, 18)}...) in ${block1Result.durationMs}ms`);

  // Wait 120ms for TCP packet transmission to Server 1
  await new Promise(r => setTimeout(r, 120));

  server1.send({ type: "GET_CHAIN_STATE", checkBalanceAddress: recipientAddr });
  const s1ChainState = await waitForMessage(server1, m => m.type === "CHAIN_STATE_S1");
  const t1 = process.hrtime.bigint();
  const propagationLatencyUs = Number(t1 - t0) / 1000;

  console.log(`  Server 1 (Validator A) Chain Height: ${s1ChainState.valAHeight}, Hash: ${s1ChainState.valAHash ? s1ChainState.valAHash.slice(0, 18) : 'null'}...`);
  console.log(`  Recipient Balance on Server 1 Ledger: ${s1ChainState.recipientBalance} MYC`);
  console.log(`  Block 1 Propagation Latency: ${(propagationLatencyUs / 1000).toFixed(2)} ms`);

  // Block #2: Produced by Server 1 (Validator A is leader for round 2 % 2 = 0)
  server1.send({
    type: "SUBMIT_AND_PRODUCE_BLOCK",
    transaction: {
      from: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      to: s1Ready.valAAddress,
      value: 1200,
      nonce: 1,
      signature: "0x" + "e".repeat(64)
    }
  });

  const block2Result = await waitForMessage(server1, m => m.type === "BLOCK_PRODUCED");
  console.log(`  Server 1 (Validator A) produced Block #${block2Result.blockNumber} (Hash: ${block2Result.blockHash.slice(0, 18)}...) in ${block2Result.durationMs}ms`);

  await new Promise(r => setTimeout(r, 120));

  server2.send({ type: "GET_CHAIN_STATE", checkBalanceAddress: recipientAddr });
  const s2ChainState = await waitForMessage(server2, m => m.type === "CHAIN_STATE");

  console.log(`  Server 2 (Validator B) Chain Height: ${s2ChainState.valBHeight}, Hash: ${s2ChainState.valBHash ? s2ChainState.valBHash.slice(0, 18) : 'null'}...`);
  console.log(`  Server 2 (Execution Node) Chain Height: ${s2ChainState.execHeight}`);

  if (
    s1ChainState.valAHeight === 1 &&
    s1ChainState.valAHash === block1Result.blockHash &&
    s2ChainState.valBHeight === 2 &&
    s2ChainState.valBHash === block2Result.blockHash &&
    s2ChainState.execHeight === 2
  ) {
    console.log("  ✅ Real Cross-Server Bidirectional Block Propagation & Ledger State Alignment Verified.");
    passed++;
  } else {
    console.error("  ❌ Block propagation or ledger state failed between Server 1 and Server 2");
  }

  // 5. Cross-Server Task Execution & PoR Settlement
  total++;
  console.log("\n[5] Testing Cross-Server Dual Execution Task & PoR Generation...");
  const taskId = "task-cluster-001";
  server2.send({
    type: "EXECUTE_POR_TASK",
    taskId,
    input: { model: "myca-reasoning-v2", prompt: "Evaluate cross-process lattice integrity" }
  });

  const porResult = await waitForMessage(server2, m => m.type === "POR_TASK_COMPLETED");
  console.log(`  Server 2 generated PoR for ${porResult.porProof.taskId} (Executor: ${porResult.porProof.executorNodeId})`);
  console.log(`  PoR Output Hash: ${porResult.porProof.outputHash.slice(0, 20)}...`);

  if (porResult.porProof.outputHash && porResult.output.result === "INFERENCE_SUCCESS") {
    console.log("  ✅ Cross-Server Task Execution & PoR Generation Succeeded.");
    passed++;
  } else {
    console.error("  ❌ Task execution or PoR generation failed on Server 2");
  }

  // Teardown
  console.log("\n[6] Graceful Teardown of Both Server Processes...");
  server1.send({ type: "SHUTDOWN" });
  server2.send({ type: "SHUTDOWN" });

  await new Promise(r => setTimeout(r, 200));

  console.log(`\n=== 2-Server Cluster Test Result: ${passed}/${total} Passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runClusterTest().catch((err) => {
  console.error("Fatal error in cluster test:", err);
  process.exit(1);
});
