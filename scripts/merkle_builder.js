// SPDX-License-Identifier: MIT
import crypto from "crypto";

/**
 * Standard keccak256 hash using Node crypto
 */
export function keccak256(buffer) {
  return crypto.createHash("sha3-256").update(buffer).digest();
}

/**
 * Encodes leaf data matching Solidity: keccak256(abi.encodePacked(owner, cumulativeAmount, rewardStream))
 */
export function encodeLeaf(owner, cumulativeAmount, rewardStream = "MYC_RESONANCE_REWARDS") {
  const cleanOwner = owner.toLowerCase().replace("0x", "").padStart(40, "0");
  const ownerBuf = Buffer.from(cleanOwner, "hex");
  
  // 32-byte big-endian cumulative amount (in standard units or wei)
  const amountBigInt = BigInt(Math.floor(cumulativeAmount * 1e6)); // 6 decimals representation
  const amountBuf = Buffer.alloc(32);
  amountBuf.writeBigUInt64BE(amountBigInt, 24);

  const streamBuf = crypto.createHash("sha256").update(rewardStream).digest();
  
  return crypto.createHash("sha256").update(Buffer.concat([ownerBuf, amountBuf, streamBuf])).digest();
}

/**
 * Builds a deterministic Merkle Tree with sorted pairs
 */
export class MerkleTree {
  constructor(leaves) {
    this.leaves = leaves.map(l => (Buffer.isBuffer(l) ? l : Buffer.from(l, "hex")));
    this.layers = [this.leaves];
    this._buildTree();
  }

  _buildTree() {
    let currentLayer = this.layers[0];
    while (currentLayer.length > 1) {
      const nextLayer = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          const left = currentLayer[i];
          const right = currentLayer[i + 1];
          // Pair sort to avoid front-running / positioning issues
          const combined = Buffer.compare(left, right) <= 0 
            ? Buffer.concat([left, right]) 
            : Buffer.concat([right, left]);
          nextLayer.push(crypto.createHash("sha256").update(combined).digest());
        } else {
          // Odd leaf carries over
          nextLayer.push(currentLayer[i]);
        }
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  getRoot() {
    if (this.layers.length === 0 || this.layers[0].length === 0) {
      return Buffer.alloc(32);
    }
    return this.layers[this.layers.length - 1][0];
  }

  getProof(leafIndex) {
    const proof = [];
    let index = leafIndex;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRight = index % 2 === 1;
      const pairIndex = isRight ? index - 1 : index + 1;

      if (pairIndex < layer.length) {
        proof.push(layer[pairIndex]);
      }
      index = Math.floor(index / 2);
    }

    return proof;
  }

  static verifyProof(leaf, proof, root) {
    let computed = leaf;
    for (const p of proof) {
      const combined = Buffer.compare(computed, p) <= 0 
        ? Buffer.concat([computed, p]) 
        : Buffer.concat([p, computed]);
      computed = crypto.createHash("sha256").update(combined).digest();
    }
    return Buffer.compare(computed, root) === 0;
  }
}
