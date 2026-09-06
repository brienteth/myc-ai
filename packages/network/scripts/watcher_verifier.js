// SPDX-License-Identifier: MIT
import crypto from "crypto";
import { MerkleTree, encodeLeaf } from "./merkle_builder.js";
import { PoQREngine } from "./poqr_engine.js";

export class WatcherVerifier {
  constructor(watcherAddress, privateKey) {
    this.address = watcherAddress;
    this.privateKey = privateKey;
  }

  /**
   * Independently verifies the proposed root against canonical snapshot data
   */
  verifyAndAttest(epochId, declaredMerkleRoot, declaredDataCommitment, rawSnapshotJson) {
    if (!rawSnapshotJson) {
      return {
        verified: false,
        reason: "SNAPSHOT_DATA_UNAVAILABLE"
      };
    }

    // 1. Verify dataCommitment
    const calculatedDataCommitment = "0x" + crypto.createHash("sha256").update(rawSnapshotJson).digest("hex");
    if (calculatedDataCommitment.toLowerCase() !== declaredDataCommitment.toLowerCase()) {
      return {
        verified: false,
        reason: "DATA_COMMITMENT_MISMATCH"
      };
    }

    const snapshot = JSON.parse(rawSnapshotJson);
    if (snapshot.epochId !== epochId) {
      return {
        verified: false,
        reason: "EPOCH_ID_MISMATCH"
      };
    }

    // 2. Reconstruct Merkle Tree from snapshot records
    const leaves = snapshot.records.map(r => encodeLeaf(r.owner, r.allocatedMYC));
    const tree = new MerkleTree(leaves);
    const reconstructedRoot = "0x" + tree.getRoot().toString("hex");

    if (reconstructedRoot.toLowerCase() !== declaredMerkleRoot.toLowerCase()) {
      return {
        verified: false,
        reason: "MERKLE_ROOT_RECONSTRUCTION_MISMATCH",
        reconstructedRoot
      };
    }

    // 3. Generate cryptographic attestation signature
    const attestationDigest = crypto.createHash("sha256").update(
      Buffer.concat([
        Buffer.from(String(epochId)),
        Buffer.from(declaredMerkleRoot.replace("0x", ""), "hex"),
        Buffer.from(declaredDataCommitment.replace("0x", ""), "hex"),
        Buffer.from(this.address.replace("0x", ""), "hex")
      ])
    ).digest();

    // Standard simulated 65-byte signature
    const sig = "0x" + crypto.createHmac("sha256", this.privateKey).update(attestationDigest).digest("hex").padEnd(130, "0");

    return {
      verified: true,
      watcher: this.address,
      attestationDigest: "0x" + attestationDigest.toString("hex"),
      signature: sig
    };
  }
}
