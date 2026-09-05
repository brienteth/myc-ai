import crypto from "crypto";

/**
 * MYCA Distributed Cognition Task Protocol
 * 
 * Invariant §8: Distributed cognition first (task decomposition, peer discovery, memory sharing, tool execution).
 * Explicit Task States:
 *  - CREATED
 *  - ASSIGNED
 *  - EXECUTING
 *  - COMPLETED
 *  - FAILED
 *  - CANCELLED
 */
export const TASK_STATES = {
  CREATED: "CREATED",
  ASSIGNED: "ASSIGNED",
  EXECUTING: "EXECUTING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};

export class MycCognitiveTask {
  constructor({
    taskId = null,
    creatorNodeId,
    capabilityRequired,
    payload,
    rewardAmount = 0,
    rewardAsset = "USDC",
    maxRetries = 2
  }) {
    this.taskId = taskId || "task_" + crypto.randomBytes(16).toString("hex");
    this.creatorNodeId = creatorNodeId;
    this.capabilityRequired = capabilityRequired;
    this.payload = payload;
    this.rewardAmount = rewardAmount;
    this.rewardAsset = rewardAsset;
    this.maxRetries = maxRetries;
    this.retryCount = 0;
    this.status = TASK_STATES.CREATED;
    this.assignedNodeId = null;
    this.result = null;
    this.executionProof = null;
    this.createdAt = Date.now();
    this.completedAt = null;
  }

  assignTo(nodeId) {
    if (this.status !== TASK_STATES.CREATED && this.status !== TASK_STATES.FAILED) {
      throw new Error(`Cannot assign task in state ${this.status}`);
    }
    this.assignedNodeId = nodeId;
    this.status = TASK_STATES.ASSIGNED;
  }

  startExecution() {
    if (this.status !== TASK_STATES.ASSIGNED) {
      throw new Error(`Cannot start task in state ${this.status}`);
    }
    this.status = TASK_STATES.EXECUTING;
  }

  complete(result, proof) {
    this.result = result;
    this.executionProof = proof;
    this.status = TASK_STATES.COMPLETED;
    this.completedAt = Date.now();
  }

  fail(reason) {
    this.retryCount += 1;
    this.status = TASK_STATES.FAILED;
    this.result = { error: reason, retryCount: this.retryCount };
  }

  canRetry() {
    return this.status === TASK_STATES.FAILED && this.retryCount <= this.maxRetries;
  }
}
