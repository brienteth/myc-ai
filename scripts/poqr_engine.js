// SPDX-License-Identifier: MIT
/**
 * @file poqr_engine.js
 * @notice Proof-of-Quantum-Resonance (PoQR) Mathematical Energy Engine for MYC Network
 * 
 * Formula:
 * E_i = h_bar * [1 - exp(-I_acc / Omega_bound)] * cos^2(Delta_Phi_i) * (T_coherence / Tau_epoch) * TierMult * CompoundMult
 */

export const H_BAR_MYC = 1.0;            // Base Planck quantum
export const OMEGA_BOUND = 50.0;         // Bandwidth physical bound (MB/day)
export const MAX_DAILY_EMISSION = 100000; // 100,000 MYC per day hard ceiling
export const PHASE_CUTOFF_RAD = Math.PI / 4; // 45 degrees cutoff (0.7854 rad)

export const TIER_MULTIPLIERS = {
  1: 1.0,  // Tier 1 — Spore
  2: 1.3,  // Tier 2 — Hyphae
  3: 1.8,  // Tier 3 — Mycelial
  4: 2.5   // Tier 4 — Fruiting Body
};

export class PoQREngine {
  /**
   * Evaluates resonant information energy for a single node
   */
  static calculateNodeEnergy(node, networkPhase = 0.0) {
    const dataMB = Math.max(0, node.dataAccessibleMB || 0);
    // 1. Accessibility Saturation [1 - exp(-I_acc / Omega_bound)]
    const saturation = 1.0 - Math.exp(-dataMB / OMEGA_BOUND);

    // 2. Tesla Phase Coherence cos^2(Delta_Phi) with strict 45-deg cutoff
    const deltaPhi = Math.abs((node.phaseAngle || 0.0) - networkPhase);
    let phaseCoherence = 0.0;
    if (deltaPhi <= PHASE_CUTOFF_RAD) {
      phaseCoherence = Math.pow(Math.cos(deltaPhi), 2);
    } // If deltaPhi > 45 deg, phaseCoherence is strictly 0.0 (destructive interference)

    // 3. Heisenberg Coherence Time Ratio (T_coherence / Tau_epoch)
    const epochHours = node.epochHours || 24.0;
    const coherenceHours = Math.max(0, Math.min(epochHours, node.coherenceHours || 0));
    const coherenceRatio = coherenceHours / epochHours;

    // 4. Multipliers
    const tierMult = TIER_MULTIPLIERS[node.tierId] || 1.0;
    const compoundMult = node.autoCompound ? 1.25 : 1.0;

    // Resonant Energy
    const energy = H_BAR_MYC * saturation * phaseCoherence * coherenceRatio * tierMult * compoundMult;

    return {
      energy,
      saturation,
      deltaPhi,
      phaseCoherence,
      coherenceRatio,
      tierMult,
      compoundMult
    };
  }

  /**
   * Distributes fixed epoch emission strictly capped at MAX_DAILY_EMISSION
   * Conserves rounding dust to treasury reserve
   */
  static distributeEpochRewards(nodes, networkPhase = 0.0, epochEmission = MAX_DAILY_EMISSION) {
    const emission = Math.min(MAX_DAILY_EMISSION, epochEmission);
    let totalNetworkEnergy = 0;

    const evaluated = nodes.map(node => {
      const calc = this.calculateNodeEnergy(node, networkPhase);
      totalNetworkEnergy += calc.energy;
      return {
        ...node,
        poqr: calc
      };
    });

    let allocatedSum = 0;
    const allocations = evaluated.map(n => {
      let reward = 0;
      if (totalNetworkEnergy > 0) {
        // Floor to prevent fractional over-minting
        reward = Math.floor((emission * n.poqr.energy) / totalNetworkEnergy * 1e6) / 1e6;
      }
      allocatedSum += reward;
      return {
        nodeId: n.nodeId || n.id,
        owner: n.owner,
        tierId: n.tierId,
        reward,
        amount: reward,
        energy: n.poqr.energy,
        resonantEnergy: n.poqr.energy,
        autoCompound: !!n.autoCompound,
        deltaPhi: n.poqr.deltaPhi,
        phaseCoherence: n.poqr.phaseCoherence
      };
    });

    // Conserve dust: difference goes to Treasury Reward Reserve
    const remainderDust = Math.max(0, Math.round((emission - allocatedSum) * 1e6) / 1e6);

    return {
      allocations,
      totalNetworkEnergy,
      totalAllocated: allocatedSum,
      remainderDust,
      epochEmission: emission,
      hardCeilingEnforced: allocatedSum <= MAX_DAILY_EMISSION
    };
  }
}
