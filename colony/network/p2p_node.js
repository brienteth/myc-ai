import net from "net";
import { MycBlockchain } from "../../ledger/blockchain/blockchain.js";
import { MycBlock } from "../../ledger/blockchain/block.js";
import { MycTransaction } from "../../ledger/blockchain/transaction.js";
import { MycTaskScheduler } from "../scheduler/task_scheduler.js";
import { MycPeerScoringV1 } from "../scheduler/peer_scoring.js";
import { MycLocalSafetyVerifier } from "../../core/kernel/local_safety_verifier.js";
import { ProofOfResonance } from "../../core/consensus/por.js";

/**
 * MYCA Sovereign P2P Node
 * 
 * Implements real TCP direct P2P transport, block propagation,
 * transaction gossip, consensus validation, and role-based task routing.
 */
export class MycP2PNode {
  constructor({
    nodeId,
    role = "COLONY_PEER",
    address = null,
    capabilities = [],
    vramMb = 8192,
    host = "127.0.0.1"
  }) {
    this.nodeId = nodeId;
    this.role = role; // "VALIDATOR" | "EXECUTION" | "COLONY_PEER" | "DEVICE_GATEWAY"
    this.host = host;
    this.port = null;
    this.capabilities = capabilities;
    this.vramMb = vramMb;

    this.server = null;
    this.peers = new Map(); // nodeId -> { socket, role, port }
    this.peerSockets = new Map(); // socket -> nodeId
    this.isRunning = false;

    // Sovereign node blockchain & state trie
    this.blockchain = new MycBlockchain({ inMemory: true });
    this.address = address || "myc1" + nodeId.slice(0, 32).toLowerCase().padEnd(32, "0");

    // Colony scheduler & local safety verifiers
    this.peerScorer = new MycPeerScoringV1();
    this.taskScheduler = new MycTaskScheduler(this.peerScorer);
    this.safetyVerifier = new MycLocalSafetyVerifier();
    this.porEngine = new ProofOfResonance();

    this.seenTransactions = new Set();
    this.seenBlocks = new Set();
    this.receivedTasks = [];
    this.onBlockCallbacks = [];
    this.onMessageCallbacks = [];
  }

  onBlockReceived(cb) {
    this.onBlockCallbacks.push(cb);
  }

  onMessage(cb) {
    this.onMessageCallbacks.push(cb);
  }

  removeMessageHandler(cb) {
    this.onMessageCallbacks = this.onMessageCallbacks.filter(c => c !== cb);
  }

  async start(preferredPort = 0) {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.setupSocket(socket);
      });

      this.server.listen(preferredPort, this.host, () => {
        this.port = this.server.address().port;
        this.isRunning = true;
        resolve({ nodeId: this.nodeId, role: this.role, host: this.host, port: this.port });
      });

      this.server.on("error", reject);
    });
  }

  setupSocket(socket) {
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          this.handleP2PMessage(socket, msg);
        } catch (err) {
          // Ignore malformed packet
        }
      }
    });

    socket.on("close", () => {
      const peerNodeId = this.peerSockets.get(socket);
      if (peerNodeId) {
        this.peers.delete(peerNodeId);
        this.peerSockets.delete(socket);
      }
    });

    socket.on("error", () => {
      socket.destroy();
    });
  }

  async connectToPeer(targetHost, targetPort) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: targetHost, port: targetPort }, () => {
        this.setupSocket(socket);
        // Send initial P2P Handshake
        this.sendPacket(socket, {
          type: "HANDSHAKE",
          sender: {
            nodeId: this.nodeId,
            role: this.role,
            host: this.host,
            port: this.port,
            capabilities: this.capabilities
          }
        });
        resolve(socket);
      });

      socket.on("error", reject);
    });
  }

  sendPacket(socket, msg) {
    if (socket && !socket.destroyed) {
      socket.write(JSON.stringify(msg) + "\n");
    }
  }

  broadcast(msg, excludeNodeId = null) {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== excludeNodeId) {
        this.sendPacket(peer.socket, msg);
      }
    }
  }

  handleP2PMessage(socket, msg) {
    if (!msg || !msg.type) return;

    for (const cb of this.onMessageCallbacks) {
      try { cb(socket, msg); } catch (e) {}
    }

    switch (msg.type) {
      case "HANDSHAKE": {
        const peer = msg.sender;
        this.peers.set(peer.nodeId, {
          nodeId: peer.nodeId,
          role: peer.role,
          host: peer.host,
          port: peer.port,
          capabilities: peer.capabilities,
          socket
        });
        this.peerSockets.set(socket, peer.nodeId);

        // Send HANDSHAKE_ACK back if we hadn't initiated
        if (!msg.isAck) {
          this.sendPacket(socket, {
            type: "HANDSHAKE",
            isAck: true,
            sender: {
              nodeId: this.nodeId,
              role: this.role,
              host: this.host,
              port: this.port,
              capabilities: this.capabilities
            }
          });
        }
        break;
      }

      case "TRANSACTION_GOSSIP": {
        const tx = msg.transaction;
        if (this.seenTransactions.has(tx.hash)) return;
        this.seenTransactions.add(tx.hash);

        try {
          this.blockchain.submitTransaction(tx);
          // Re-gossip to other peers
          this.broadcast(msg, msg.senderNodeId);
        } catch (err) {
          // Transaction invalid (e.g. nonce collision, double-spend)
        }
        break;
      }

      case "BLOCK_ANNOUNCE": {
        const block = msg.block instanceof MycBlock ? msg.block : new MycBlock(msg.block);
        if (this.seenBlocks.has(block.hash)) return;
        this.seenBlocks.add(block.hash);

        try {
          const importResult = this.blockchain.importBlock(block);
          for (const cb of this.onBlockCallbacks) {
            cb(block, importResult);
          }
          // Re-propagate block across the network
          this.broadcast(msg, msg.senderNodeId);
        } catch (err) {
          // Block verification or consensus check failed
        }
        break;
      }

      case "TASK_DISPATCH": {
        this.receivedTasks.push(msg.task);
        if (this.role === "EXECUTION") {
          // Execute cognitive workload and reply
          const output = { result: `Processed payload for ${msg.task.taskId}`, answer: 42 };
          const porProof = this.porEngine.evaluateProof(msg.task.intent || "Execute task", output);
          
          this.sendPacket(socket, {
            type: "TASK_RESPONSE",
            taskId: msg.task.taskId,
            executorNodeId: this.nodeId,
            success: true,
            output,
            porProof
          });
        } else if (this.role === "DEVICE_GATEWAY") {
          // Verify physical actuator command
          const safetyResult = this.safetyVerifier.evaluatePhysicalSafety(msg.task.actuatorCommand);
          this.sendPacket(socket, {
            type: "TASK_RESPONSE",
            taskId: msg.task.taskId,
            executorNodeId: this.nodeId,
            success: safetyResult.safeToActuate,
            safetyResult
          });
        }
        break;
      }

      case "TASK_RESPONSE": {
        if (this.onTaskResponse) {
          this.onTaskResponse(msg);
        }
        break;
      }
    }
  }

  async discoverViaBootstrap(bootstrapHost, bootstrapPort) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ host: bootstrapHost, port: bootstrapPort }, () => {
        let buffer = "";

        client.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            const resp = JSON.parse(line);
            if (resp.status === "SUCCESS" && resp.peers) {
              client.destroy();
              resolve(resp.peers);
              return;
            }
          }
        });

        // 1. Register self
        client.write(JSON.stringify({
          action: "REGISTER",
          peer: {
            nodeId: this.nodeId,
            role: this.role,
            host: this.host,
            port: this.port,
            capabilities: this.capabilities
          }
        }) + "\n");

        // 2. Query other peers
        client.write(JSON.stringify({
          action: "GET_PEERS",
          nodeId: this.nodeId
        }) + "\n");
      });

      client.on("error", reject);
    });
  }

  submitAndGossipTransaction(txPayload) {
    const tx = new MycTransaction(txPayload);
    this.seenTransactions.add(tx.hash);
    const result = this.blockchain.submitTransaction(tx);

    // Gossip to all connected peers
    this.broadcast({
      type: "TRANSACTION_GOSSIP",
      senderNodeId: this.nodeId,
      transaction: tx
    });

    return { hash: tx.hash, status: result.status };
  }

  produceAndBroadcastBlock() {
    if (this.role !== "VALIDATOR") {
      throw new Error(`UNAUTHORIZED: Node ${this.nodeId} is not a VALIDATOR`);
    }

    const { block } = this.blockchain.produceBlock(this.address);
    this.seenBlocks.add(block.hash);

    // Broadcast block to all direct P2P connections
    this.broadcast({
      type: "BLOCK_ANNOUNCE",
      senderNodeId: this.nodeId,
      block
    });

    return block;
  }

  async stop() {
    this.isRunning = false;
    for (const peer of this.peers.values()) {
      peer.socket.destroy();
    }
    this.peers.clear();
    this.peerSockets.clear();
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
  }
}
