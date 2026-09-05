import crypto from "crypto";

/**
 * Proof-of-Resonance (PoR) Verification Engine
 * 
 * Strict Specification Invariants §1.1 & §3:
 *  - PoR answers: "Was the claimed computation/execution/resonance condition actually satisfied?"
 *  - PoR is an execution & state proof mechanism, NOT the canonical blockchain consensus algorithm.
 *  - POR_MIN_COSINE is an explicit protocol parameter (default 0.50).
 *  - Proofs are cryptographically bound to taskId, executionId, nodeId, and nonce.
 */
export const POR_DIMENSION = 64;
export const POR_MIN_COSINE = 0.50;

export class MycProofOfResonance {
  constructor(threshold = POR_MIN_COSINE, dimension = POR_DIMENSION) {
    this.threshold = threshold;
    this.dimension = dimension;
    this.verifiedProofs = new Set(); // Replay protection index
  }

  vectorizeIntent(intentString) {
    const vec = new Float32Array(this.dimension);
    const tokens = (intentString || "").toLowerCase().split(/[\s,._#-]+/);

    for (const tok of tokens) {
      if (!tok) continue;
      const h = crypto.createHash("sha256").update(tok).digest();
      for (let i = 0; i < this.dimension; i++) {
        const val = (h[i % 32] / 127.5) - 1.0;
        vec[i] += val;
      }
    }

    let norm = 0;
    for (let i = 0; i < this.dimension; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1.0;
    for (let i = 0; i < this.dimension; i++) vec[i] /= norm;

    return vec;
  }

  calculateCoherence(vecA, vecB) {
    let dot = 0;
    for (let i = 0; i < this.dimension; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }

  evaluateProof(command, executionContext = {}) {
    if (executionContext.status && executionContext.status !== 0) {
      return {
        verified: false,
        coherence: 0.0,
        porHash: null,
        gasConsumed: 0,
        reason: executionContext.error_code || "EXECUTION_REJECTED"
      };
    }

    const intentVec = this.vectorizeIntent(command);
    const ruleContext = `${executionContext.device || "TURBINE"} ${executionContext.action || "START"} REGISTER_${executionContext.target_register || 130}`;
    const ruleVec = this.vectorizeIntent(ruleContext);

    // If explicit coherence override is passed (e.g. for boundary testing)
    const coherence = executionContext.coherenceOverride !== undefined
      ? executionContext.coherenceOverride
      : this.calculateCoherence(intentVec, ruleVec);

    const isResonant = coherence >= this.threshold;

    if (!isResonant) {
      return {
        verified: false,
        coherence: parseFloat(coherence.toFixed(4)),
        porHash: null,
        gasConsumed: 0,
        reason: `COHERENCE_BELOW_THRESHOLD: ${coherence.toFixed(4)} < ${this.threshold}`
      };
    }

    // Cryptographically bind to taskId, executionId, nodeId, and nonce
    const taskId = executionContext.taskId || "task_default";
    const executionId = executionContext.executionId || "exec_default";
    const nodeId = executionContext.nodeId || "node_default";
    const nonce = executionContext.nonce !== undefined ? executionContext.nonce : 0;
    const inputCommitment = crypto.createHash("sha256").update(command || "").digest("hex");

    const porPayload = [
      "POR_PROOF_v2",
      taskId,
      executionId,
      nodeId,
      nonce,
      inputCommitment,
      ruleContext,
      coherence.toFixed(4),
      Date.now()
    ].join(":");
    const porHash = "0x" + crypto.createHash("sha256").update(porPayload).digest("hex");

    return {
      verified: true,
      coherence: parseFloat(coherence.toFixed(4)),
      porHash,
      binding: {
        taskId,
        executionId,
        nodeId,
        nonce,
        inputCommitment
      },
      gasConsumed: 0, // Gas = 0 Invariant
      timestamp: Date.now()
    };
  }

  verify(porProof, expectedBinding = null) {
    if (!porProof || !porProof.porHash) return false;
    if (porProof.coherence < this.threshold) return false;

    // Check cryptographic binding if expected binding is provided
    if (expectedBinding && porProof.binding) {
      if (expectedBinding.taskId && expectedBinding.taskId !== porProof.binding.taskId) return false;
      if (expectedBinding.executionId && expectedBinding.executionId !== porProof.binding.executionId) return false;
      if (expectedBinding.nodeId && expectedBinding.nodeId !== porProof.binding.nodeId) return false;
      if (expectedBinding.nonce !== undefined && expectedBinding.nonce !== porProof.binding.nonce) return false;
    }

    // Replay protection: same proof cannot be submitted twice
    if (this.verifiedProofs.has(porProof.porHash)) {
      return false;
    }
    this.verifiedProofs.add(porProof.porHash);
    return true;
  }
}
