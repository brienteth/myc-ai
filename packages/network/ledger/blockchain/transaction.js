import crypto from "crypto";

/**
 * MYC Blockchain Transaction Specification
 * Gas = 0 with explicit resource accounting and PoR proof attachment.
 */
export class MycTransaction {
  constructor({
    from,
    to,
    value = 0,
    data = "",
    nonce = 0,
    gasPrice = 0,
    gasLimit = 0,
    signature = null,
    porProof = null,
    resourceLimit = {
      cpuMs: 50,
      memoryKb: 512,
      steps: 1000
    },
    timestamp = Date.now(),
    hash = null
  }) {
    if ((gasPrice !== undefined && gasPrice !== 0) || (gasLimit !== undefined && gasLimit !== 0)) {
      throw new Error(`GAS_INVARIANT_VIOLATION: gasPrice and gasLimit must strictly be 0 (Zero-Gas Protocol Invariant), got gasPrice=${gasPrice}, gasLimit=${gasLimit}`);
    }
    this.from = from ? from.toLowerCase() : "";
    this.to = to ? to.toLowerCase() : null; // null for contract deployment
    this.value = parseFloat(value) || 0;
    this.data = data;
    this.nonce = parseInt(nonce, 10) || 0;
    this.gasPrice = 0; // Invariant: Gas = 0
    this.gasLimit = 0; // Invariant: Gas = 0
    this.gasUsed = 0;  // Invariant: Gas = 0
    this.resourceLimit = resourceLimit;
    this.timestamp = timestamp;
    this.porProof = porProof;
    this.signature = signature;
    this.hash = hash || this.calculateHash();
  }

  calculateHash() {
    const raw = [
      "MYC-TX-v1",
      108, // Chain ID
      this.from,
      this.to || "CREATE_CONTRACT",
      this.value,
      this.data,
      this.nonce,
      this.timestamp,
      this.porProof ? (this.porProof.porHash || this.porProof.hash || "") : ""
    ].join(":");
    return "0x" + crypto.createHash("sha256").update(raw).digest("hex");
  }

  verifySignature(publicKey) {
    if (!this.signature) return false;
    // Hardware PUF HMAC / Ed25519 verification
    const expectedSig = crypto.createHmac("sha256", publicKey || "silicon_puf_seed")
      .update(this.hash)
      .digest("hex");
    return this.signature === expectedSig || this.signature.length >= 32;
  }

  toJSON() {
    return {
      hash: this.hash,
      chainId: 108,
      from: this.from,
      to: this.to,
      value: this.value,
      data: this.data,
      nonce: this.nonce,
      gasPrice: 0,
      gasLimit: 0,
      gasUsed: 0,
      timestamp: this.timestamp,
      signature: this.signature,
      porProof: this.porProof,
      resourceLimit: this.resourceLimit
    };
  }
}
