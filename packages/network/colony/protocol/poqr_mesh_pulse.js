// SPDX-License-Identifier: MIT
/**
 * @file poqr_mesh_pulse.js
 * @notice Colony Mesh Peer-to-Peer Micro-Pulse & Phase-Locked Loop (PLL) Engine
 * Implements Einstein-Tesla-Heisenberg Proof-of-Quantum-Resonance on the P2P layer.
 */

import crypto from "crypto";

export class PoQRMeshPulseEngine {
  constructor(nodeId, machineDid, privateKey) {
    this.nodeId = nodeId;
    this.machineDid = machineDid;
    this.privateKey = privateKey;

    this.localPhaseAngle = 0.0; // in radians [-pi, pi]
    this.phaseHistory = [];
    this.coherenceStartTime = Date.now();
    this.lastDisruptionTime = 0;
    this.peerStates = new Map(); // peerId => { lastPulse, rtt, phaseAngle }
    this.kNeighbors = 8; // K=8 nearest neighbors
  }

  /**
   * Generates a lightweight 48-byte micro-pulse packet to broadcast to 8 neighbors
   */
  createMicroPulse(sequenceNumber) {
    const timestamp = Date.now();
    const payload = Buffer.alloc(32);
    payload.writeBigUInt64BE(BigInt(this.nodeId), 0);
    payload.writeBigUInt64BE(BigInt(timestamp), 8);
    payload.writeFloatBE(this.localPhaseAngle, 16);
    payload.writeUInt32BE(sequenceNumber, 20);

    const signature = crypto.createHmac("sha256", this.privateKey).update(payload).digest();

    return {
      nodeId: this.nodeId,
      timestamp,
      phaseAngle: this.localPhaseAngle,
      signature: signature.subarray(0, 16).toString("hex"), // compact 16-byte signature
      raw: payload
    };
  }

  /**
   * Processes an incoming micro-pulse from a neighboring peer in the Colony Mesh
   * Updates Phase-Locked Loop (PLL) alignment
   */
  processNeighborPulse(peerId, pulse) {
    const now = Date.now();
    const rtt = Math.max(1, now - pulse.timestamp);

    // Calculate phase drift based on RTT latency and reported neighbor phase
    const latencyPhaseOffset = (rtt % 1000) / 1000 * 2 * Math.PI;
    const observedPeerPhase = pulse.phaseAngle + latencyPhaseOffset;

    this.peerStates.set(peerId, {
      lastSeen: now,
      rtt,
      peerPhase: observedPeerPhase
    });

    // Run Phase-Locked Loop (PLL) adjustment
    this._adjustLocalPhase();
  }

  /**
   * Phase-Locked Loop: Adjusts local phase towards collective median of K=8 neighbors
   */
  _adjustLocalPhase() {
    if (this.peerStates.size === 0) return;

    // Get phases of active neighbors (seen in last 5000ms)
    const now = Date.now();
    const activePhases = [];
    for (const [_, state] of this.peerStates.entries()) {
      if (now - state.lastSeen < 5000) {
        activePhases.push(state.peerPhase);
      }
    }

    if (activePhases.length === 0) {
      // Disruption: loss of coherent neighbors
      this.lastDisruptionTime = now;
      return;
    }

    // Sort to find median phase (resistant to Byzantine outlier attackers)
    activePhases.sort((a, b) => a - b);
    const medianPhase = activePhases[Math.floor(activePhases.length / 2)];

    // Damping factor alpha = 0.15 for smooth phase convergence
    const phaseError = medianPhase - this.localPhaseAngle;
    this.localPhaseAngle += phaseError * 0.15;

    // Keep within [-pi, pi]
    if (this.localPhaseAngle > Math.PI) this.localPhaseAngle -= 2 * Math.PI;
    if (this.localPhaseAngle < -Math.PI) this.localPhaseAngle += 2 * Math.PI;

    // Record history
    this.phaseHistory.push({ time: now, phase: this.localPhaseAngle });
    if (this.phaseHistory.length > 50) this.phaseHistory.shift();
  }

  /**
   * Returns current node coherence status for epoch reward calculation
   */
  getCoherenceMetrics(epochDurationMs = 86400000) {
    const now = Date.now();
    const currentCoherenceMs = this.lastDisruptionTime > 0 
      ? now - this.lastDisruptionTime 
      : now - this.coherenceStartTime;

    const coherenceHours = Math.min(24.0, currentCoherenceMs / 3600000);

    return {
      nodeId: this.nodeId,
      phaseAngle: this.localPhaseAngle,
      activePeersCount: this.peerStates.size,
      coherenceHours,
      epochHours: epochDurationMs / 3600000,
      phaseLockCoherence: Math.pow(Math.cos(this.localPhaseAngle), 2)
    };
  }
}
