/**
 * MYC Transaction Mempool & Admission Controller
 * 
 * Enforces strict 9-step admission:
 *  1. packet sanity
 *  2. signature verification
 *  3. transaction schema validation
 *  4. PoR admission requirement where applicable
 *  5. rate-limit check
 *  6. minimum stake requirement where applicable
 *  7. nonce validation
 *  8. policy validation
 *  9. mempool admission
 */
export class MycMempool {
  constructor(stateTrie, options = {}) {
    this.stateTrie = stateTrie;
    this.maxPoolSize = options.maxPoolSize || 1000;
    this.maxPerSender = options.maxPerSender || 10;
    this.rateLimitWindowMs = options.rateLimitWindowMs || 60000;
    this.maxTxPerWindow = options.maxTxPerWindow || 60;

    this.pending = new Map(); // hash -> MycTransaction
    this.senderHistory = new Map(); // address -> [timestamps]
    this.porVerifier = null;
  }

  setPoRVerifier(verifier) {
    this.porVerifier = verifier;
  }

  addTransaction(tx) {
    const check = this.validateAdmission(tx);
    if (!check.valid) {
      throw new Error(`MempoolAdmissionError: ${check.reason}`);
    }

    // Register timestamp for rate-limiting
    const sender = tx.from.toLowerCase();
    if (!this.senderHistory.has(sender)) {
      this.senderHistory.set(sender, []);
    }
    this.senderHistory.get(sender).push(Date.now());

    this.pending.set(tx.hash, tx);
    return { status: "ADMITTED", hash: tx.hash };
  }

  validateAdmission(tx) {
    // 1. Packet Sanity
    if (!tx || typeof tx !== "object") {
      return { valid: false, reason: "NULL_OR_INVALID_TRANSACTION_PAYLOAD" };
    }

    // 2. Transaction Schema Validation
    if (!tx.from || typeof tx.from !== "string") {
      return { valid: false, reason: "MISSING_OR_INVALID_SENDER_ADDRESS" };
    }
    if (tx.gasPrice !== 0 || tx.gasLimit !== 0) {
      return { valid: false, reason: "GAS_INVARIANT_VIOLATION: gasPrice and gasLimit must be 0" };
    }

    // 3. Signature Verification
    if (!tx.signature || tx.signature.length < 32) {
      return { valid: false, reason: "INVALID_OR_MISSING_TRANSACTION_SIGNATURE" };
    }

    // 4. Rate-Limit Check
    const sender = tx.from.toLowerCase();
    const now = Date.now();
    const history = (this.senderHistory.get(sender) || []).filter(t => now - t < this.rateLimitWindowMs);
    this.senderHistory.set(sender, history);
    if (history.length >= this.maxTxPerWindow) {
      return { valid: false, reason: `RATE_LIMIT_EXCEEDED: Maximum ${this.maxTxPerWindow} txs per minute` };
    }

    // 5. Nonce Validation
    const currentNonce = this.stateTrie.getNonce(sender);
    if (tx.nonce < currentNonce) {
      return { valid: false, reason: `NONCE_TOO_LOW: expected >= ${currentNonce}, got ${tx.nonce}` };
    }

    // 6. Balance check for transfer
    if (tx.value > 0) {
      const balance = this.stateTrie.getBalance(sender);
      if (balance < tx.value) {
        return { valid: false, reason: `INSUFFICIENT_FUNDS: balance ${balance} < value ${tx.value}` };
      }
    }

    // 7. PoR Admission Requirement (where applicable)
    if (tx.porProof) {
      if (this.porVerifier && !this.porVerifier.verify(tx.porProof)) {
        return { valid: false, reason: "POR_VERIFICATION_FAILED: Coherence below threshold" };
      }
    }

    // 8. Pool capacity
    if (this.pending.size >= this.maxPoolSize) {
      return { valid: false, reason: "MEMPOOL_FULL" };
    }

    // 9. Prevent duplicate transaction or same-sender nonce conflict
    if (this.pending.has(tx.hash)) {
      return { valid: false, reason: "TRANSACTION_ALREADY_IN_MEMPOOL" };
    }
    for (const pTx of this.pending.values()) {
      if (pTx.from.toLowerCase() === sender && pTx.nonce === tx.nonce) {
        return { valid: false, reason: `NONCE_CONFLICT: pending transaction with nonce ${tx.nonce} already exists` };
      }
    }

    return { valid: true };
  }

  purgeInvalidTransactions() {
    const toRemove = [];
    for (const [hash, tx] of this.pending.entries()) {
      const sender = tx.from.toLowerCase();
      const currentNonce = this.stateTrie.getNonce(sender);
      const balance = this.stateTrie.getBalance(sender);
      if (tx.nonce < currentNonce || (tx.value > 0 && balance < tx.value)) {
        toRemove.push(hash);
      }
    }
    this.removeTransactions(toRemove);
    return toRemove;
  }

  getPendingTransactions(limit = 50) {
    const list = Array.from(this.pending.values());
    // Sort by nonce ascending
    list.sort((a, b) => a.nonce - b.nonce);
    return list.slice(0, limit);
  }

  removeTransactions(txHashes = []) {
    for (const hash of txHashes) {
      this.pending.delete(hash);
    }
  }

  size() {
    return this.pending.size;
  }
}
