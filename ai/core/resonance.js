/**
 * Resonance Engine Module
 * Computes multi-dimensional resonance metrics combining Semantic, Morphology, Spectral, Phase, and Context.
 */

import { TurkishMorphology } from './morphology.js';
import { HDCEngine } from './hdc.js';
import { SpectralEngine } from './spectral.js';
import { PhaseEngine } from './phase.js';

export class ResonanceEngine {
  constructor(config = {}) {
    // Configurable weights (default values as requested)
    this.alpha = config.alpha !== undefined ? config.alpha : 0.30; // Semantic
    this.beta = config.beta !== undefined ? config.beta : 0.20;   // Morphology
    this.gamma = config.gamma !== undefined ? config.gamma : 0.20; // Spectral
    this.delta = config.delta !== undefined ? config.delta : 0.20; // Phase
    this.epsilon = config.epsilon !== undefined ? config.epsilon : 0.10; // Context

    this.morphology = new TurkishMorphology();
    this.hdc = new HDCEngine();
    this.spectral = new SpectralEngine();
    this.phase = new PhaseEngine();
  }

  updateWeights(config) {
    if (config.alpha !== undefined) this.alpha = config.alpha;
    if (config.beta !== undefined) this.beta = config.beta;
    if (config.gamma !== undefined) this.gamma = config.gamma;
    if (config.delta !== undefined) this.delta = config.delta;
    if (config.epsilon !== undefined) this.epsilon = config.epsilon;
  }

  computeResonance(query, candidate, queryRepr, candidateRepr) {
    // 1. Semantic Score (cosine similarity in HDC domain)
    const semanticScore = this.hdc.similarity(queryRepr, candidateRepr);

    // 2. Morphology Score (root matches + suffix overlaps)
    const morphQ = this.morphology.analyze(query);
    const morphC = this.morphology.analyze(candidate);
    let morphologyScore = 0.0;

    if (morphQ.root === morphC.root) {
      morphologyScore += 0.6; // heavy weighting for sharing the same root
    }
    // Calculate overlap of suffixes
    const setQ = new Set(morphQ.suffixes);
    const setC = new Set(morphC.suffixes);
    let intersections = 0;
    setQ.forEach(s => {
      if (setC.has(s)) intersections++;
    });
    const unionSize = new Set([...setQ, ...setC]).size;
    if (unionSize > 0) {
      morphologyScore += 0.4 * (intersections / unionSize);
    }

    // 3. Spectral Score (similarity of FFT magnitude spectra)
    const specQ = this.spectral.spectralTransform(queryRepr);
    const specC = this.spectral.spectralTransform(candidateRepr);
    const spectralScore = this.spectral.spectralSimilarity(specQ, specC);

    // 4. Phase Score (phase coherence between vectors)
    const phaseScore = this.phase.phaseCoherence(queryRepr, candidateRepr);

    // 5. Context Score (simple character-length ratio/exact overlaps)
    let contextScore = 0.0;
    if (morphQ.harmony === morphC.harmony) {
      contextScore += 0.5; // same vowel harmony category
    }
    const lenDiff = Math.abs(query.length - candidate.length);
    contextScore += 0.5 * Math.max(0, 1 - lenDiff / Math.max(query.length, candidate.length, 1));

    // Calculate final weighted compound resonance
    const finalScore = 
      this.alpha * semanticScore +
      this.beta * morphologyScore +
      this.gamma * spectralScore +
      this.delta * phaseScore +
      this.epsilon * contextScore;

    return {
      finalScore,
      breakdown: {
        semantic: semanticScore,
        morphology: morphologyScore,
        spectral: spectralScore,
        phase: phaseScore,
        context: contextScore
      }
    };
  }

  generateSignature(id, representation, text = '') {
    const spec = this.spectral.spectralTransform(representation);
    const energy = this.spectral.spectralEnergy(spec);
    const entropy = this.spectral.spectralEntropy(spec);
    const dominantFreq = this.spectral.extractDominantFrequencies(spec, 5);

    const morph = this.morphology.analyze(text || id);

    return {
      id,
      dimension: representation.D,
      amplitude: spec.magnitude,
      phase: spec.phase,
      dominant_frequencies: dominantFreq,
      spectral_energy: energy,
      spectral_entropy: entropy,
      morphology_signature: {
        root: morph.root,
        morphemes: morph.morphemes,
        features: morph.features
      },
      timestamp: Date.now()
    };
  }
}
