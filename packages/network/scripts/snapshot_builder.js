// SPDX-License-Identifier: MIT
import crypto from "crypto";

export class CanonicalSnapshotBuilder {
  /**
   * Generates a deterministic, versioned canonical epoch snapshot
   */
  static buildSnapshot(epochId, allocations, networkPhase = 0.0) {
    // Sort nodes deterministically by nodeId to ensure reproducible JSON output
    const sorted = [...allocations].sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)));

    const snapshot = {
      snapshotVersion: "2.1.0",
      schemaVersion: "1.0",
      epochId,
      networkPhase,
      timestamp: 1788700000 + epochId * 86400, // deterministic timestamp
      recordsCount: sorted.length,
      records: sorted.map(r => ({
        nodeId: String(r.nodeId),
        owner: String(r.owner).toLowerCase(),
        tierId: r.tierId,
        energy: parseFloat(r.energy.toFixed(6)),
        phaseDeltaRad: parseFloat(r.deltaPhi.toFixed(6)),
        coherencePercent: parseFloat((r.phaseCoherence * 100).toFixed(2)),
        allocatedMYC: parseFloat(r.reward.toFixed(6))
      }))
    };

    const canonicalJson = JSON.stringify(snapshot);
    // Content-addressed dataCommitment hash (SHA-256 / IPFS CID hash)
    const dataCommitment = crypto.createHash("sha256").update(canonicalJson).digest("hex");

    return {
      snapshot,
      canonicalJson,
      dataCommitment: "0x" + dataCommitment
    };
  }
}
