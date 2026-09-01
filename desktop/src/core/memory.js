/**
 * Resonance Memory Module
 * Manages holographic/vector data storage, query pipeline, candidate retrieval, and resonance-based ranking.
 */

import { ResonanceEngine } from './resonance.js';

export class ResonanceMemory {
  constructor(config = {}) {
    this.entries = [];
    this.resonanceEngine = new ResonanceEngine(config);
  }

  addEntry(content, hdcVector, metadata = {}) {
    const signature = this.resonanceEngine.generateSignature(content, hdcVector, content);
    
    this.entries.push({
      content,
      hdc_vector: hdcVector,
      resonance_signature: signature,
      metadata,
      timestamp: Date.now()
    });
  }

  search(queryText, queryRepr, k = 10) {
    if (this.entries.length === 0) {
      return [];
    }

    const results = [];

    // Score all candidates using the Resonance Engine
    for (const entry of this.entries) {
      const resonanceResult = this.resonanceEngine.computeResonance(
        queryText,
        entry.content,
        queryRepr,
        entry.hdc_vector
      );

      results.push({
        content: entry.content,
        score: resonanceResult.finalScore,
        breakdown: resonanceResult.breakdown,
        metadata: entry.metadata,
        signature: entry.resonance_signature
      });
    }

    // Sort descending by resonance score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, k);
  }

  clear() {
    this.entries = [];
  }
}
