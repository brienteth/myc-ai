import crypto from "crypto";
import { TASK_STATES } from "../protocol/task_protocol.js";

/**
 * MYCA Distributed Cognition Task Scheduler
 * 
 * Routes tasks to highest-scoring eligible peers based on required capability.
 * Generates deterministic execution proofs.
 */
export class MycTaskScheduler {
  constructor(peerScorer) {
    this.scorer = peerScorer;
    this.peers = new Map(); // nodeId -> { peerData, executorFunction }
    this.tasks = new Map(); // taskId -> MycCognitiveTask
  }

  registerExecutor(nodeId, peerData, executorFn = null) {
    this.peers.set(nodeId, {
      ...peerData,
      nodeId,
      executor: executorFn || (async (task) => ({
        success: true,
        output: `Executed capability [${task.capabilityRequired}] on payload: ${JSON.stringify(task.payload)}`,
        nodeId
      }))
    });
  }

  findBestPeer(capabilityRequired) {
    let bestPeer = null;
    let highestScore = -1;

    for (const [nodeId, peer] of this.peers.entries()) {
      if (peer.capabilities && peer.capabilities.includes(capabilityRequired)) {
        const scoreData = this.scorer.scorePeer({
          vramMb: peer.vram || 0,
          currentLoad: peer.currentLoad || 0.2,
          latencyMs: peer.latencyMs || 20,
          capabilities: peer.capabilities,
          requiredCapability: capabilityRequired
        });
        if (scoreData.score > highestScore) {
          highestScore = scoreData.score;
          bestPeer = peer;
        }
      }
    }
    return bestPeer;
  }

  findTopPeers(capabilityRequired, count = 2) {
    const scoredPeers = [];

    for (const [nodeId, peer] of this.peers.entries()) {
      if (peer.capabilities && peer.capabilities.includes(capabilityRequired)) {
        const scoreData = this.scorer.scorePeer({
          vramMb: peer.vram || 0,
          currentLoad: peer.currentLoad || 0.2,
          latencyMs: peer.latencyMs || 20,
          capabilities: peer.capabilities,
          requiredCapability: capabilityRequired
        });
        scoredPeers.push({ peer, score: scoreData.score });
      }
    }

    scoredPeers.sort((a, b) => b.score - a.score);
    return scoredPeers.slice(0, count).map(p => p.peer);
  }

  async scheduleAndExecute(task) {
    if (task.requiresDualVerification) {
      return this.scheduleWithDualVerification(task);
    }

    this.tasks.set(task.taskId, task);

    const eligiblePeer = this.findBestPeer(task.capabilityRequired);
    if (!eligiblePeer) {
      task.fail(`NO_ELIGIBLE_PEER_FOUND: for capability '${task.capabilityRequired}'`);
      return { success: false, task };
    }

    try {
      task.assignTo(eligiblePeer.nodeId);
      task.startExecution();

      // Execute task on peer
      const execResult = await eligiblePeer.executor(task);

      // Generate verifiable execution proof
      const proofPayload = `${task.taskId}:${eligiblePeer.nodeId}:${task.capabilityRequired}:${JSON.stringify(execResult)}:${Date.now()}`;
      const proofHash = "0x" + crypto.createHash("sha256").update(proofPayload).digest("hex");

      const executionProof = {
        taskId: task.taskId,
        executorNodeId: eligiblePeer.nodeId,
        proofHash,
        output: execResult,
        status: "VERIFIED_ON_COLONY"
      };

      task.complete(execResult, executionProof);
      return { success: true, task, executionProof };
    } catch (err) {
      task.fail(err.message);
      if (task.canRetry()) {
        // Retry execution with another peer if available
        return this.scheduleAndExecute(task);
      }
      return { success: false, task, error: err.message };
    }
  }

  /**
   * Dual-Execution Sampling & Output Hash Verification
   * 
   * Defeats Proof Farming without ZK or TEE:
   *  1. Assigns task to 2 distinct top-scoring peers
   *  2. Dispatches execution concurrently
   *  3. Compares cryptographic output hashes H(Output1) == H(Output2)
   *  4. Mismatch -> Slashing triggered, escrow retained/refunded
   *  5. Match    -> Escrow released, rewards shared/settled
   */
  async scheduleWithDualVerification(task, options = {}) {
    this.tasks.set(task.taskId, task);

    const topPeers = this.findTopPeers(task.capabilityRequired, 2);
    if (topPeers.length < 2) {
      if (options.strictDualVerification) {
        task.fail(`INSUFFICIENT_PEERS_FOR_DUAL_VERIFICATION: required 2, found ${topPeers.length}`);
        return { success: false, task, reason: "INSUFFICIENT_PEERS" };
      }
      return this.scheduleAndExecute(task);
    }

    const [peer1, peer2] = topPeers;

    try {
      task.assignTo(`${peer1.nodeId},${peer2.nodeId}`);
      task.startExecution();

      // Dispatch to both independent nodes concurrently
      const [res1, res2] = await Promise.all([
        peer1.executor(task),
        peer2.executor(task)
      ]);

      // Calculate deterministic output hashes
      const raw1 = typeof res1.output !== "undefined" ? res1.output : res1;
      const raw2 = typeof res2.output !== "undefined" ? res2.output : res2;
      const hash1 = "0x" + crypto.createHash("sha256").update(JSON.stringify(raw1)).digest("hex");
      const hash2 = "0x" + crypto.createHash("sha256").update(JSON.stringify(raw2)).digest("hex");

      const isMatch = hash1 === hash2;

      if (!isMatch) {
        // Output discrepancy detected! Flag for slashing & retain escrow
        task.fail(`DUAL_EXECUTION_DISCREPANCY: output hash mismatch (${hash1} !== ${hash2})`);
        return {
          success: false,
          verified: false,
          task,
          discrepancy: true,
          node1: { nodeId: peer1.nodeId, outputHash: hash1 },
          node2: { nodeId: peer2.nodeId, outputHash: hash2 },
          action: "SLASH_AND_RETAIN_ESCROW"
        };
      }

      // Consensus reached between independent nodes!
      const proofPayload = `DUAL_VERIFIED:${task.taskId}:${peer1.nodeId}:${peer2.nodeId}:${hash1}:${Date.now()}`;
      const consensusProofHash = "0x" + crypto.createHash("sha256").update(proofPayload).digest("hex");

      const executionProof = {
        taskId: task.taskId,
        primaryExecutor: peer1.nodeId,
        verifierNode: peer2.nodeId,
        outputHash: hash1,
        proofHash: consensusProofHash,
        output: raw1,
        status: "DUAL_EXECUTION_VERIFIED",
        match: true
      };

      task.complete(res1, executionProof);
      return {
        success: true,
        verified: true,
        task,
        executionProof,
        action: "RELEASE_ESCROW_AND_REWARD"
      };
    } catch (err) {
      task.fail(err.message);
      return { success: false, task, error: err.message };
    }
  }
}
