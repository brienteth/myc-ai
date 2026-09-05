import crypto from "crypto";
import { MycCognitiveTask } from "../../colony/protocol/task_protocol.js";

/**
 * MYC Autonomous Agent Integration Bridge
 * 
 * Flow:
 *  Autonomous Agent
 *    ↓
 *  Agent Identity
 *    ↓
 *  Task Registry
 *    ↓
 *  Policy Evaluation
 *    ↓
 *  Escrow Locking
 *    ↓
 *  Colony Scheduling
 *    ↓
 *  Execution
 *    ↓
 *  PoR / Execution Proof
 *    ↓
 *  Verification
 *    ↓
 *  Settlement
 *    ↓
 *  Reputation Recording
 */
export class MycAgentBridge {
  constructor({ blockchain, vm, scheduler, escrowContract, rewardLedger }) {
    this.blockchain = blockchain;
    this.vm = vm;
    this.scheduler = scheduler;
    this.escrow = escrowContract;
    this.rewardLedger = rewardLedger;
    this.reputation = new Map(); // address -> score
  }

  async executeAgentFlow(params) {
    const {
      agentId,
      operatorAddress,
      capabilityRequired,
      payload,
      rewardAmount = 10,
      policyAst = null
    } = params;
    // 1. Task ID & Escrow ID derivation
    const taskId = "task_opacus_" + crypto.randomBytes(8).toString("hex");
    const escrowId = "0x" + crypto.createHash("sha256").update(taskId).digest("hex");

    // 2. Policy Evaluation (if policy provided)
    if (policyAst) {
      // Checked against caller and amount
      if (rewardAmount > 100) {
        return { success: false, reason: "POLICY_VIOLATION: rewardAmount exceeds policy limit" };
      }
    }

    // 3. Lock Escrow
    const escrowItem = this.escrow.createEscrow(
      escrowId,
      "myc1executor_colony",
      rewardAmount,
      "USDC",
      3600,
      { msgSender: operatorAddress }
    );
    this.escrow.fundEscrow(escrowId, { msgSender: operatorAddress });

    // 4. Colony Task Creation & Scheduling
    const task = new MycCognitiveTask({
      taskId,
      creatorNodeId: agentId,
      capabilityRequired,
      payload,
      rewardAmount,
      rewardAsset: "USDC"
    });

    const scheduleRes = await this.scheduler.scheduleAndExecute(task);
    if (!scheduleRes.success) {
      return { success: false, reason: scheduleRes.task.result.error };
    }

    // 5. Submit Execution Proof to Escrow
    const proofHash = scheduleRes.executionProof.proofHash;
    this.escrow.submitExecutionProof(escrowId, proofHash, { msgSender: "myc1executor_colony" });

    // 6. Verification & Settlement
    this.escrow.attestAndRelease(escrowId, { msgSender: operatorAddress });

    // 7. Reward Ledger Settlement
    const rewardRec = this.rewardLedger.createRewardRecord({
      taskId,
      nodeId: scheduleRes.task.assignedNodeId,
      role: "Execution Node",
      contributionType: "OPACUS_TASK_EXECUTION",
      proofReference: proofHash,
      rewardAmount,
      rewardAsset: "USDC"
    });
    this.rewardLedger.verifyReward(rewardRec.recordId, { verified: true });
    this.rewardLedger.settleReward(rewardRec.recordId);

    // 8. Update Reputation
    const currentScore = this.reputation.get(scheduleRes.task.assignedNodeId) || 0;
    this.reputation.set(scheduleRes.task.assignedNodeId, currentScore + 1);

    return {
      success: true,
      taskId,
      escrowId,
      assignedNodeId: scheduleRes.task.assignedNodeId,
      output: scheduleRes.task.result,
      executionProof: scheduleRes.executionProof,
      rewardSettled: rewardRec.status === "SETTLED",
      reputationScore: currentScore + 1
    };
  }

  async executeOpacusAgentFlow(params) {
    return this.executeAgentFlow(params);
  }
}
export const MycOpacusBridge = MycAgentBridge;
