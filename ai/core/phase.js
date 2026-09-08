/**
 * Phase Engine Module
 * Analyzes phase components, phase coherence, alignment, and differences in phase-coded HDC vectors.
 */

export class PhaseEngine {
  constructor() {}

  extractPhase(representation) {
    const D = representation.D;
    const phase = new Float32Array(D);
    if (representation.type === 'complex') {
      phase.set(representation.values);
    } else {
      // For real, bipolar, binary, compute phase of complex projection (z = x + 0i)
      for (let i = 0; i < D; i++) {
        phase[i] = representation.values[i] >= 0.0 ? 0.0 : Math.PI;
      }
    }
    return phase;
  }

  phaseDifference(a, b) {
    const D = a.D;
    const diff = new Float32Array(D);
    const pA = this.extractPhase(a);
    const pB = this.extractPhase(b);

    for (let i = 0; i < D; i++) {
      let d = pA[i] - pB[i];
      // Wrap to [-PI, PI)
      while (d < -Math.PI) d += 2 * Math.PI;
      while (d >= Math.PI) d -= 2 * Math.PI;
      diff[i] = d;
    }
    return diff;
  }

  phaseAlignment(a, b) {
    // Calculates circular variance of phase difference.
    // 1 - variance ranges from 0 (no alignment/random) to 1 (perfect alignment).
    const diff = this.phaseDifference(a, b);
    let sumCos = 0;
    let sumSin = 0;
    const D = diff.length;

    for (let i = 0; i < D; i++) {
      sumCos += Math.cos(diff[i]);
      sumSin += Math.sin(diff[i]);
    }
    const R = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / D;
    return R; // Resulting vector length
  }

  phaseCoherence(a, b) {
    // Phase Coherence is the magnitude of the mean phase difference vector:
    // C = | (1/D) * sum( e^{i * (theta_a - theta_b)} ) |
    const pA = this.extractPhase(a);
    const pB = this.extractPhase(b);
    const D = a.D;

    let sumCos = 0;
    let sumSin = 0;

    for (let i = 0; i < D; i++) {
      const diff = pA[i] - pB[i];
      sumCos += Math.cos(diff);
      sumSin += Math.sin(diff);
    }

    // Magnitude of average complex phase difference
    return Math.sqrt(sumCos * sumCos + sumSin * sumSin) / D;
  }

  phaseSimilarity(a, b) {
    // Cosine similarity in phase domain: (1/D) * sum( cos(theta_a - theta_b) )
    const pA = this.extractPhase(a);
    const pB = this.extractPhase(b);
    const D = a.D;

    let sumCos = 0;
    for (let i = 0; i < D; i++) {
      sumCos += Math.cos(pA[i] - pB[i]);
    }
    return sumCos / D;
  }
}
