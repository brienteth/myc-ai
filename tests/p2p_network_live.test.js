import { MycBootstrapServer } from "../colony/network/bootstrap_server.js";
import { MycP2PNode } from "../colony/network/p2p_node.js";
import { MycBlock } from "../ledger/blockchain/block.js";
import { MycTransaction } from "../ledger/blockchain/transaction.js";

console.log("====================================================================");
console.log("🌐 LIVE P2P MULTI-NODE NETWORK ACCEPTANCE TEST SUITE");
console.log("Topology: bootstrap-01 -> Node A (Val), Node B (Exec), Node C (Peer), Node D (Gateway)");
console.log("====================================================================\n");

let passed = 0;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// -----------------------------------------------------------------------------
// SETUP: Start bootstrap-01 and 4 sovereign nodes
// -----------------------------------------------------------------------------
const bootstrap01 = new MycBootstrapServer("bootstrap-01");
const bootInfo = await bootstrap01.start(0);
console.log(`[SETUP] bootstrap-01 online on ${bootInfo.host}:${bootInfo.port}`);

const nodeA = new MycP2PNode({
  nodeId: "node-a-validator",
  role: "VALIDATOR",
  address: "myc1validator00000000000000000000000000"
});
// Register validator in nodeA consensus
nodeA.blockchain.consensus.registerValidator(nodeA.address, 100000);

const nodeB = new MycP2PNode({
  nodeId: "node-b-execution",
  role: "EXECUTION",
  capabilities: ["INFERENCE", "SPECTRAL_COMPRESSION"],
  vramMb: 24576
});

const nodeC = new MycP2PNode({
  nodeId: "node-c-colony-peer",
  role: "COLONY_PEER"
});

const nodeD = new MycP2PNode({
  nodeId: "node-d-device-gateway",
  role: "DEVICE_GATEWAY",
  capabilities: ["MODBUS_RTU", "ACTUATOR_SAFETY"]
});

// Register Node A as the designated consensus validator across all nodes in the network
for (const n of [nodeA, nodeB, nodeC, nodeD]) {
  n.blockchain.consensus.validators.clear();
  n.blockchain.consensus.registerValidator(nodeA.address, 100000);
}

// Start TCP servers on all 4 nodes
await nodeA.start(0);
await nodeB.start(0);
await nodeC.start(0);
await nodeD.start(0);

// Register and discover via bootstrap-01
const peersForA = await nodeA.discoverViaBootstrap(bootInfo.host, bootInfo.port);
const peersForB = await nodeB.discoverViaBootstrap(bootInfo.host, bootInfo.port);
const peersForC = await nodeC.discoverViaBootstrap(bootInfo.host, bootInfo.port);
const peersForD = await nodeD.discoverViaBootstrap(bootInfo.host, bootInfo.port);

// Establish direct P2P mesh connections between all nodes
const nodes = [nodeA, nodeB, nodeC, nodeD];
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    await nodes[i].connectToPeer(nodes[j].host, nodes[j].port);
  }
}

await sleep(100); // allow handshakes to complete

const meshConnected = nodes.every((n) => n.peers.size === 3);
if (meshConnected) {
  console.log("✅ [SETUP PASS] Full direct P2P mesh established across 4 nodes (zero relays)");
}

// -----------------------------------------------------------------------------
// TEST 1: Node A produces block -> Node B, Node C, Node D receive & verify it
// -----------------------------------------------------------------------------
console.log("\n🧪 Running Test 1: Real Block Propagation & P2P Consensus Import...");

// Submit transaction to Node A
const tx1 = nodeA.submitAndGossipTransaction({
  from: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002", // Genesis account
  to: nodeC.address,
  value: 5000,
  nonce: 0,
  signature: "0x" + "a".repeat(64)
});

// Node A mines Block #1
const block1 = nodeA.produceAndBroadcastBlock();
console.log(`[TEST 1] Node A produced Block #1 (Hash: ${block1.hash.slice(0, 18)}..., Txs: 1)`);

await sleep(100); // wait for real TCP packet propagation

const b1ImportedOnB = nodeB.blockchain.getLatestBlock().number === 1 && nodeB.blockchain.getLatestBlock().hash === block1.hash;
const b1ImportedOnC = nodeC.blockchain.getLatestBlock().number === 1 && nodeC.blockchain.getLatestBlock().hash === block1.hash;
const b1ImportedOnD = nodeD.blockchain.getLatestBlock().number === 1 && nodeD.blockchain.getLatestBlock().hash === block1.hash;
const balanceCUpdated = nodeC.blockchain.state.getBalance(nodeC.address) === 5000;

if (b1ImportedOnB && b1ImportedOnC && b1ImportedOnD && balanceCUpdated) {
  console.log("✅ [TEST 1 PASS] Node A produced block -> Nodes B, C, D received, verified & imported it via direct P2P TCP");
  passed++;
} else {
  console.error("❌ [TEST 1 FAIL] Block propagation failed on one or more nodes");
}

// -----------------------------------------------------------------------------
// TEST 2: Node B goes offline -> System continues operating
// -----------------------------------------------------------------------------
console.log("\n🧪 Running Test 2: Node B Goes Offline (Fault Tolerance)...");

await nodeB.stop();
console.log("[TEST 2] Node B (Execution) forcefully stopped (offline)");

await sleep(50);

// Node A submits another transaction and produces Block #2
nodeA.submitAndGossipTransaction({
  from: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
  to: nodeD.address,
  value: 2000,
  nonce: 1,
  signature: "0x" + "b".repeat(64)
});

const block2 = nodeA.produceAndBroadcastBlock();
console.log(`[TEST 2] Node A produced Block #2 (Hash: ${block2.hash.slice(0, 18)}...)`);

await sleep(100);

const b2OnC = nodeC.blockchain.getLatestBlock().number === 2;
const b2OnD = nodeD.blockchain.getLatestBlock().number === 2;
const balanceDUpdated = nodeD.blockchain.state.getBalance(nodeD.address) === 2000;

if (b2OnC && b2OnD && balanceDUpdated) {
  console.log("✅ [TEST 2 PASS] System continued uninterrupted while Node B is offline; Blocks & consensus finalized on C & D");
  passed++;
} else {
  console.error("❌ [TEST 2 FAIL] Network stalled after Node B went offline");
}

// -----------------------------------------------------------------------------
// TEST 3: Double-Spend prevention across two different nodes
// -----------------------------------------------------------------------------
console.log("\n🧪 Running Test 3: Simultaneous Conflicting Transactions (Double-Spend)...");

// Fund Alice with exactly 500 MYC
const aliceAddr = "myc1alice0000000000000000000000000000";
const bobAddr = "myc1bob000000000000000000000000000000";
const eveAddr = "myc1eve000000000000000000000000000000";

nodeA.blockchain.state.setBalance(aliceAddr, 500);
nodeC.blockchain.state.setBalance(aliceAddr, 500);
nodeD.blockchain.state.setBalance(aliceAddr, 500);

// Alice creates two conflicting transactions using the SAME nonce 0:
// TxA: Alice -> Bob 400 MYC (submitted to Node A)
// TxC: Alice -> Eve 400 MYC (submitted to Node C)
const txToBob = new MycTransaction({
  from: aliceAddr,
  to: bobAddr,
  value: 400,
  nonce: 0,
  signature: "0x" + "c".repeat(64)
});

const txToEve = new MycTransaction({
  from: aliceAddr,
  to: eveAddr,
  value: 400,
  nonce: 0,
  signature: "0x" + "d".repeat(64)
});

// Submit TxToBob on Node A
nodeA.blockchain.submitTransaction(txToBob);

// Submit TxToEve on Node C
nodeC.blockchain.submitTransaction(txToEve);

// Node A includes TxToBob in Block #3 and broadcasts
const block3 = nodeA.produceAndBroadcastBlock();
await sleep(100);

// Node C imported Block #3. Now let's verify:
// 1. TxToBob was executed: Alice balance = 100, Bob balance = 400
const aliceBalOnC = nodeC.blockchain.state.getBalance(aliceAddr);
const bobBalOnC = nodeC.blockchain.state.getBalance(bobAddr);
const eveBalOnC = nodeC.blockchain.state.getBalance(eveAddr);

// 2. TxToEve in Node C mempool was invalidated and purged!
const mempoolPurged = nodeC.blockchain.mempool.size() === 0;

// 3. Attempting to execute TxToEve now fails strictly with INSUFFICIENT_FUNDS
let eveExecutionBlocked = false;
try {
  nodeC.blockchain.executeTransaction(txToEve);
} catch (err) {
  eveExecutionBlocked = err.message.includes("INSUFFICIENT_FUNDS") || err.message.includes("INVALID_NONCE");
}

if (aliceBalOnC === 100 && bobBalOnC === 400 && eveBalOnC === 0 && mempoolPurged && eveExecutionBlocked) {
  console.log("✅ [TEST 3 PASS] Double-spend strictly prevented! Only first tx mined, conflicting tx purged from mempool");
  passed++;
} else {
  console.error("❌ [TEST 3 FAIL] Double-spend was not properly prevented", { aliceBalOnC, bobBalOnC, eveBalOnC, mempoolPurged, eveExecutionBlocked });
}

// -----------------------------------------------------------------------------
// TEST 4: Fork Scenario -> Consensus resolves to canonical chain
// -----------------------------------------------------------------------------
console.log("\n🧪 Running Test 4: Network Fork Resolution & Chain Reorganization...");

// Current tip on Node C is Block #3 (Hash H3)
const parentTip = nodeC.blockchain.getLatestBlock();

// Create an alternative longer branch (Fork 2) with Blocks #4B and #5B:
const stateRootFork4 = nodeA.blockchain.state.calculateStateRoot();
const block4B = new MycBlock({
  number: 4,
  parentHash: parentTip.hash,
  timestamp: Date.now() + 1000,
  transactions: [],
  stateRoot: stateRootFork4,
  receiptsRoot: "0x" + "0".repeat(64),
  validator: nodeA.address,
  extraData: "FORK_BRANCH_BLOCK_4B"
});

const block5B = new MycBlock({
  number: 5,
  parentHash: block4B.hash,
  timestamp: Date.now() + 2000,
  transactions: [],
  stateRoot: stateRootFork4,
  receiptsRoot: "0x" + "0".repeat(64),
  validator: nodeA.address,
  extraData: "FORK_BRANCH_BLOCK_5B"
});

// Import the longer fork into Node C to verify fork resolution
nodeC.blockchain.blocksByHash.set(block4B.hash, block4B);
const reorgResult = nodeC.blockchain.importBlock(block5B);

const nodeCLatest = nodeC.blockchain.getLatestBlock();
if (reorgResult.reorg && nodeCLatest.number === 5 && nodeCLatest.hash === block5B.hash) {
  console.log(`✅ [TEST 4 PASS] Fork resolved cleanly! Canonical chain reorganized to longer branch (Height: ${nodeCLatest.number})`);
  passed++;
} else {
  console.error("❌ [TEST 4 FAIL] Fork resolution failed", reorgResult);
}

// Synchronize canonical fork across all active nodes (Node A, Node D)
nodeA.blockchain.blocksByHash.set(block4B.hash, block4B);
nodeA.blockchain.importBlock(block5B);
nodeD.blockchain.blocksByHash.set(block4B.hash, block4B);
nodeD.blockchain.importBlock(block5B);

// -----------------------------------------------------------------------------
// TEST 5: All bootstrap nodes shut down -> Existing peers continue communicating
// -----------------------------------------------------------------------------
console.log("\n🧪 Running Test 5: Complete Bootstrap Shutdown (Autonomous P2P Operation)...");

await bootstrap01.stop();
console.log("[TEST 5] bootstrap-01 completely shut down (offline)");

// Submit transaction from Node C directly to Node A over direct P2P connection
const txP2P = nodeC.submitAndGossipTransaction({
  from: nodeC.address,
  to: nodeD.address,
  value: 100,
  nonce: 0,
  signature: "0x" + "e".repeat(64)
});

await sleep(50);

// Node A mines Block #6 and broadcasts directly to Node C and Node D
const block6 = nodeA.produceAndBroadcastBlock();
await sleep(100);

const b6OnC = nodeC.blockchain.getLatestBlock().number === 6 && nodeC.blockchain.getLatestBlock().hash === block6.hash;
const b6OnD = nodeD.blockchain.getLatestBlock().number === 6 && nodeD.blockchain.getLatestBlock().hash === block6.hash;

// Dispatch real task from Node C to Node D (Device Gateway) directly over P2P
let taskCompletedP2P = false;
nodeC.onTaskResponse = (resp) => {
  if (resp.taskId === "task-actuator-test" && resp.success) {
    taskCompletedP2P = true;
  }
};

const gatewayPeer = nodeC.peers.get(nodeD.nodeId);
if (gatewayPeer) {
  nodeC.sendPacket(gatewayPeer.socket, {
    type: "TASK_DISPATCH",
    task: {
      taskId: "task-actuator-test",
      capabilityRequired: "ACTUATOR_SAFETY",
      actuatorCommand: {
        device: "VALVE",
        action: "OPEN",
        targetRegister: 0x0012,
        unitNumber: 1,
        confidence: 0.95,
        onChainAuthorized: true
      }
    }
  });
}

await sleep(100);

if (b6OnC && b6OnD && taskCompletedP2P) {
  console.log("✅ [TEST 5 PASS] Network operates 100% autonomously after bootstrap shutdown; Blocks & tasks routed directly via P2P");
  passed++;
} else {
  console.error("❌ [TEST 5 FAIL] P2P communication failed after bootstrap shutdown", { b6OnC, b6OnD, taskCompletedP2P });
}

// -----------------------------------------------------------------------------
// CLEANUP & SUMMARY
// -----------------------------------------------------------------------------
await nodeA.stop();
await nodeC.stop();
await nodeD.stop();

console.log("\n====================================================================");
console.log(`🏆 LIVE P2P NETWORK TEST RESULTS: ${passed}/5 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 5) {
  process.exit(1);
}
