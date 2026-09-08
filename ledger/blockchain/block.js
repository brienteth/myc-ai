import crypto from "crypto";

/**
 * MYC Blockchain Block Specification
 * Deterministic block structure adhering to MYC-LATTICE-MAINNET (Chain ID: 108)
 */
export class MycBlock {
  constructor({
    number,
    parentHash,
    timestamp = Date.now(),
    transactions = [],
    stateRoot = "0x" + "0".repeat(64),
    receiptsRoot = "0x" + "0".repeat(64),
    validator = "myc100000000000000000000000000000000",
    consensusProof = null,
    porRoot = null,
    extraData = ""
  }) {
    this.number = number;
    this.parentHash = parentHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.stateRoot = stateRoot;
    this.receiptsRoot = receiptsRoot;
    this.validator = validator;
    this.consensusProof = consensusProof;
    this.porRoot = porRoot;
    this.extraData = extraData;
    this.gasUsed = 0; // Gas = 0 Invariant
    this.merkleRoot = this.calculateTransactionsMerkleRoot();
    this.hash = this.calculateBlockHash();
  }

  calculateTransactionsMerkleRoot() {
    if (!this.transactions || this.transactions.length === 0) {
      return "0x" + crypto.createHash("sha256").update("EMPTY_TRANSACTIONS_ROOT").digest("hex");
    }
    const hashes = this.transactions.map(tx => tx.hash || this.hashTx(tx));
    return this.buildMerkleTree(hashes);
  }

  hashTx(tx) {
    const raw = `${tx.from}:${tx.to}:${tx.value}:${tx.nonce}:${tx.data || ""}:${tx.timestamp || ""}`;
    return "0x" + crypto.createHash("sha256").update(raw).digest("hex");
  }

  buildMerkleTree(leafHashes) {
    if (leafHashes.length === 0) return "0x" + "0".repeat(64);
    let currentLevel = leafHashes.slice();
    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = crypto.createHash("sha256").update(left + right).digest("hex");
        nextLevel.push("0x" + combined);
      }
      currentLevel = nextLevel;
    }
    return currentLevel[0];
  }

  calculateBlockHash() {
    const payload = [
      this.number,
      this.parentHash,
      this.timestamp,
      this.merkleRoot,
      this.stateRoot,
      this.receiptsRoot,
      this.validator,
      this.gasUsed,
      this.extraData
    ].join(":");
    return "0x" + crypto.createHash("sha256").update(payload).digest("hex");
  }

  toJSON() {
    return {
      number: this.number,
      hash: this.hash,
      parentHash: this.parentHash,
      timestamp: this.timestamp,
      merkleRoot: this.merkleRoot,
      stateRoot: this.stateRoot,
      receiptsRoot: this.receiptsRoot,
      validator: this.validator,
      gasUsed: this.gasUsed,
      transactionCount: this.transactions.length,
      transactions: this.transactions,
      consensusProof: this.consensusProof,
      porRoot: this.porRoot,
      extraData: this.extraData
    };
  }
}
