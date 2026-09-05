import { MycBootstrapServer } from "../../colony/network/bootstrap_server.js";
import { MycP2PNode } from "../../colony/network/p2p_node.js";

async function main() {
  const bootstrap = new MycBootstrapServer("bootstrap-01");
  const bootInfo = await bootstrap.start(0);

  const validatorA = new MycP2PNode({
    nodeId: "server1-validator-a",
    role: "VALIDATOR",
    address: "myc1validatora000000000000000000000000"
  });

  // Register Validator A in its own consensus
  validatorA.blockchain.consensus.validators.clear();
  validatorA.blockchain.consensus.registerValidator(validatorA.address, 100000);

  await validatorA.start(0);

  // Register Validator A on local bootstrap
  await validatorA.discoverViaBootstrap(bootInfo.host, bootInfo.port);

  // Notify parent process
  if (process.send) {
    process.send({
      type: "SERVER1_READY",
      pid: process.pid,
      bootstrapHost: bootInfo.host,
      bootstrapPort: bootInfo.port,
      valAHost: validatorA.host,
      valAPort: validatorA.port,
      valAAddress: validatorA.address
    });
  }

  process.on("message", async (msg) => {
    if (msg.type === "REGISTER_VALIDATOR_B") {
      validatorA.blockchain.consensus.registerValidator(msg.address, msg.stake);
      if (process.send) {
        process.send({ type: "VALIDATOR_B_REGISTERED" });
      }
    } else if (msg.type === "SUBMIT_AND_PRODUCE_BLOCK") {
      const startTime = Date.now();
      validatorA.submitAndGossipTransaction(msg.transaction);
      const block = validatorA.produceAndBroadcastBlock();
      const durationMs = Date.now() - startTime;

      if (process.send) {
        process.send({
          type: "BLOCK_PRODUCED",
          blockNumber: block.number,
          blockHash: block.hash,
          durationMs,
          peerCount: validatorA.peers.size
        });
      }
    } else if (msg.type === "GET_CHAIN_STATE") {
      const bValA = validatorA.blockchain.getLatestBlock();
      if (process.send) {
        process.send({
          type: "CHAIN_STATE_S1",
          valAHeight: bValA ? bValA.number : 0,
          valAHash: bValA ? bValA.hash : null,
          recipientBalance: msg.checkBalanceAddress
            ? validatorA.blockchain.state.getBalance(msg.checkBalanceAddress)
            : 0
        });
      }
    } else if (msg.type === "CONNECT_PEER") {
      await validatorA.connectToPeer(msg.host, msg.port);
      if (process.send) {
        process.send({ type: "PEER_CONNECTED", peerCount: validatorA.peers.size });
      }
    } else if (msg.type === "SHUTDOWN") {
      await validatorA.stop();
      await bootstrap.stop();
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error("Error in server1_node:", err);
  process.exit(1);
});
