import crypto from "crypto";

/**
 * MYCA Protocol Reward Ledger
 * 
 * Strict Invariants §21 & §22:
 * Tracks and settles verifiable rewards.
 * States: PENDING -> VERIFIED -> SETTLED (or REJECTED, SLASHED).
 * Defends against duplicate rewards, fake execution, and replay.
 */
export const REWARD_STATES = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  SETTLED: "SETTLED",
  REJECTED: "REJECTED",
  SLASHED: "SLASHED"
};

export class MycRewardLedger {
  constructor() {
    this.records = new Map(); // recordId -> RewardRecord
    this.taskRewardIndex = new Map(); // taskId -> recordId (Anti-duplicate check)
  }

  createRewardRecord({
    taskId,
    nodeId,
    role,
    contributionType,
    resourceUsage = {},
    proofReference,
    rewardAsset = "USDC",
    rewardAmount,
    epoch = 0
  }) {
    if (!taskId || !nodeId || !proofReference) {
      throw new Error("REWARD_VALIDATION_FAILED: taskId, nodeId, and proofReference required");
    }

    // Anti-duplication check: each task gets at most one settled/pending reward record
    if (this.taskRewardIndex.has(taskId)) {
      throw new Error(`DUPLICATE_REWARD_ATTEMPT: Task '${taskId}' already has reward record`);
    }

    const recordId = "reward_" + crypto.randomBytes(12).toString("hex");
    const record = {
      recordId,
      taskId,
      nodeId,
      role,
      contributionType,
      resourceUsage,
      proofReference,
      rewardAsset,
      rewardAmount: parseFloat(rewardAmount) || 0,
      epoch,
      status: REWARD_STATES.PENDING,
      createdAt: Date.now(),
      settledAt: null
    };

    this.records.set(recordId, record);
    this.taskRewardIndex.set(taskId, recordId);
    return record;
  }

  verifyReward(recordId, verificationProof) {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`REWARD_NOT_FOUND: ${recordId}`);
    if (record.status !== REWARD_STATES.PENDING) {
      throw new Error(`CANNOT_VERIFY: Record in status ${record.status}`);
    }

    if (!verificationProof || !verificationProof.verified) {
      record.status = REWARD_STATES.REJECTED;
      return { verified: false, record };
    }

    record.status = REWARD_STATES.VERIFIED;
    return { verified: true, record };
  }

  settleReward(recordId, stateTrie = null) {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`REWARD_NOT_FOUND: ${recordId}`);
    if (record.status !== REWARD_STATES.VERIFIED) {
      throw new Error(`CANNOT_SETTLE: Record must be in VERIFIED state, got ${record.status}`);
    }

    // If settling in native MYC, credit balance in world state
    if (stateTrie && record.rewardAsset === "MYC" && record.nodeId.startsWith("myc1")) {
      const current = stateTrie.getBalance(record.nodeId);
      stateTrie.setBalance(record.nodeId, current + record.rewardAmount);
    }

    record.status = REWARD_STATES.SETTLED;
    record.settledAt = Date.now();
    return record;
  }

  slashRecord(recordId, reason) {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`REWARD_NOT_FOUND: ${recordId}`);
    record.status = REWARD_STATES.SLASHED;
    record.slashReason = reason;
    return record;
  }

  getRecord(recordId) {
    return this.records.get(recordId) || null;
  }
}
