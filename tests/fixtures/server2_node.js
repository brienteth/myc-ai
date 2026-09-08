import { MycP2PNode } from "../../colony/network/p2p_node.js";

async function main() {
  const validatorB = new MycP2PNode({
    nodeId: "server2-validator-b",
    role: "VALIDATOR",
    address: "myc1validatorb000000000000000000000000"
  });

  const executionNode = new MycP2PNode({
    nodeId: "server2-execution-node",
    role: "EXECUTION",
    capabilities: ["INFERENCE", "SPECTRAL_COMPRESSION"],
    vramMb: 24576
  });

  // Start both nodes on dynamic ports
  await validatorB.start(0);
  await executionNode.start(0);

  // Notify parent process
  if (process.send) {
    process.send({
      type: "SERVER2_READY",
      pid: process.pid,
      valBHost: validatorB.host,
      valBPort: validatorB.port,
      valBAddress: validatorB.address,
      execHost: executionNode.host,
      execPort: executionNode.port,
      execAddress: executionNode.address
    });
  }

  process.on("message", async (msg) => {
    if (msg.type === "SETUP_CONSENSUS") {
      // Configure consensus validators on Server 2
      validatorB.blockchain.consensus.validators.clear();
      executionNode.blockchain.consensus.validators.clear();

      validatorB.blockchain.consensus.registerValidator(msg.valAAddress, 100000);
      validatorB.blockchain.consensus.registerValidator(validatorB.address, 100000);

      executionNode.blockchain.consensus.registerValidator(msg.valAAddress, 100000);
      executionNode.blockchain.consensus.registerValidator(validatorB.address, 100000);

      if (process.send) {
        process.send({ type: "CONSENSUS_READY" });
      }
    } else if (msg.type === "DISCOVER_AND_CONNECT") {
      const discoveryStart = process.hrtime.bigint();
      // Server 2 queries Server 1's Bootstrap server via TCP
      const peersValB = await validatorB.discoverViaBootstrap(msg.bootstrapHost, msg.bootstrapPort);
      const peersExec = await executionNode.discoverViaBootstrap(msg.bootstrapHost, msg.bootstrapPort);
      const discoveryEnd = process.hrtime.bigint();
      const discoveryLatencyUs = Number(discoveryEnd - discoveryStart) / 1000;

      // Connect locally between Validator B and Execution Node
      await validatorB.connectToPeer(executionNode.host, executionNode.port);

      // Connect to Validator A on Server 1
      await validatorB.connectToPeer(msg.valAHost, msg.valAPort);
      await executionNode.connectToPeer(msg.valAHost, msg.valAPort);

      // Allow TCP handshake messages to settle
      await new Promise(r => setTimeout(r, 60));

      if (process.send) {
        process.send({
          type: "DISCOVERY_AND_CONNECT_DONE",
          peersDiscovered: peersValB.length,
          discoveryLatencyUs,
          valBPeers: validatorB.peers.size,
          execPeers: executionNode.peers.size
        });
      }
    } else if (msg.type === "SUBMIT_AND_PRODUCE_BLOCK") {
      const startTime = Date.now();
      validatorB.submitAndGossipTransaction(msg.transaction);
      const block = validatorB.produceAndBroadcastBlock();
      const durationMs = Date.now() - startTime;

      if (process.send) {
        process.send({
          type: "BLOCK_PRODUCED",
          blockNumber: block.number,
          blockHash: block.hash,
          durationMs,
          peerCount: validatorB.peers.size
        });
      }
    } else if (msg.type === "GET_CHAIN_STATE") {
      const bValB = validatorB.blockchain.getLatestBlock();
      const bExec = executionNode.blockchain.getLatestBlock();

      if (process.send) {
        process.send({
          type: "CHAIN_STATE",
          valBHeight: bValB ? bValB.number : 0,
          valBHash: bValB ? bValB.hash : null,
          execHeight: bExec ? bExec.number : 0,
          execHash: bExec ? bExec.hash : null,
          recipientBalance: msg.checkBalanceAddress
            ? validatorB.blockchain.state.getBalance(msg.checkBalanceAddress)
            : 0
        });
      }
    } else if (msg.type === "EXECUTE_POR_TASK") {
      // Simulate execution node processing task and returning deterministic PoR
      const crypto = await import("crypto");
      const taskId = msg.taskId;
      const inputHash = crypto.createHash("sha256").update(JSON.stringify(msg.input)).digest("hex");
      const output = { result: "INFERENCE_SUCCESS", tokenLength: 42, score: 0.998 };
      const outputHash = crypto.createHash("sha256").update(JSON.stringify(output)).digest("hex");
      
      const porProof = {
        taskId,
        executorNodeId: executionNode.nodeId,
        inputHash,
        outputHash,
        timestamp: Date.now()
      };

      if (process.send) {
        process.send({
          type: "POR_TASK_COMPLETED",
          porProof,
          output
        });
      }
    } else if (msg.type === "SHUTDOWN") {
      await validatorB.stop();
      await executionNode.stop();
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error("Error in server2_node:", err);
  process.exit(1);
});
