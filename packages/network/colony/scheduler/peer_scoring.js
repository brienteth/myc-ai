/**
 * MYCA Peer Scoring V1
 * 
 * Strict Invariant §12:
 * V1 score uses ONLY:
 *  - VRAM
 *  - load
 *  - latency
 *  - capability
 * 
 * Configurable weights formula:
 *  score = w_vram * vram_score + w_load * load_score + w_latency * latency_score + w_capability * capability_score
 * 
 * DO NOT add reputation, geographic locality, or historical trust to V1 (Reserved for V2).
 */
export class MycPeerScoringV1 {
  constructor(weights = {}) {
    this.w_vram = weights.w_vram !== undefined ? weights.w_vram : 0.25;
    this.w_load = weights.w_load !== undefined ? weights.w_load : 0.25;
    this.w_latency = weights.w_latency !== undefined ? weights.w_latency : 0.25;
    this.w_capability = weights.w_capability !== undefined ? weights.w_capability : 0.25;

    // Normalize weights to sum to 1.0
    const sum = this.w_vram + this.w_load + this.w_latency + this.w_capability;
    if (sum > 0) {
      this.w_vram /= sum;
      this.w_load /= sum;
      this.w_latency /= sum;
      this.w_capability /= sum;
    }
  }

  scorePeer({ vramMb = 0, currentLoad = 0.5, latencyMs = 50, capabilities = [], requiredCapability = null }) {
    // 1. VRAM Score: 0 to 24GB normalized [0, 1]
    const vram_score = Math.min(1.0, Math.max(0.0, vramMb / 24576.0));

    // 2. Load Score: lower load = higher score [0, 1]
    const load_score = Math.min(1.0, Math.max(0.0, 1.0 - currentLoad));

    // 3. Latency Score: <10ms is 1.0, >200ms is 0.0 [0, 1]
    const latency_score = Math.min(1.0, Math.max(0.0, (200.0 - latencyMs) / 190.0));

    // 4. Capability Score: 1.0 if matches required capability or has core capabilities, else 0.5
    let capability_score = 0.5;
    if (requiredCapability) {
      capability_score = capabilities.includes(requiredCapability) ? 1.0 : 0.0;
    } else if (capabilities.length > 0) {
      capability_score = Math.min(1.0, capabilities.length / 5.0);
    }

    const compositeScore = (
      this.w_vram * vram_score +
      this.w_load * load_score +
      this.w_latency * latency_score +
      this.w_capability * capability_score
    );

    return {
      score: parseFloat(compositeScore.toFixed(4)),
      metrics: {
        vram_score: parseFloat(vram_score.toFixed(4)),
        load_score: parseFloat(load_score.toFixed(4)),
        latency_score: parseFloat(latency_score.toFixed(4)),
        capability_score: parseFloat(capability_score.toFixed(4))
      },
      weights: {
        w_vram: this.w_vram,
        w_load: this.w_load,
        w_latency: this.w_latency,
        w_capability: this.w_capability
      },
      version: "V1_STRICT"
    };
  }
}
