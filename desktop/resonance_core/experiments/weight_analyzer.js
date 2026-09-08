/**
 * Weight Spectral Analyzer Module
 * Analyzes deep learning model weights using spectral methods (FFT/IFFT) in a memory-efficient, block-wise manner.
 * Supports compressing weights, reconstructing weights, and measuring error matrices.
 */

import { SpectralEngine } from '../core/spectral.js';
import { Representation } from '../core/hdc.js';

export class WeightSpectralAnalyzer {
  constructor(blockSize = 4096) {
    this.blockSize = blockSize;
    this.spectralEngine = new SpectralEngine();
  }

  // ── ANALYSIS OPERATIONS ────────────────────────────────────

  analyzeBlock(weightsBlock) {
    // Ensure size fits block size by padding with zeros if necessary
    const padded = new Float32Array(this.blockSize);
    padded.set(weightsBlock.slice(0, this.blockSize));

    // Construct a representation object to feed the spectral engine
    const representation = new Representation('real', padded, this.blockSize);
    const spectrum = this.spectralEngine.spectralTransform(representation);

    const energy = this.spectralEngine.spectralEnergy(spectrum);
    const entropy = this.spectralEngine.spectralEntropy(spectrum);
    const sparsity = this.spectralEngine.spectralSparsity(spectrum);
    const dominant = this.spectralEngine.extractDominantFrequencies(spectrum, 10);

    return {
      spectrum,
      metrics: {
        energy,
        entropy,
        sparsity,
        dominantFrequencies: dominant
      }
    };
  }

  // Stream-based model weight analyzer to support 1T parameters
  // Executes block-wise computation on a generator or array of weights
  // Includes strict pre-emptive OOM protection guards
  async analyzeStream(weightGenerator) {
    let totalEnergy = 0;
    let blockCount = 0;
    let cumulativeEntropy = 0;
    let cumulativeSparsity = 0;
    
    // Track dominant frequencies globally
    const freqAccumulator = {};

    // Get current engine configuration limits
    const maxAllowedHeapMb = 1000; // Keep node process memory low (1 GB safety threshold)

    for await (const block of weightGenerator) {
      // ── OOM SAFETY GUARD ──
      const currentHeapMb = process.memoryUsage().heapUsed / 1024 / 1024;
      if (currentHeapMb > maxAllowedHeapMb) {
        throw new Error(
          `OOM_PREVENTED: Memory heap limit exceeded (${currentHeapMb.toFixed(2)} MB > ${maxAllowedHeapMb} MB). ` +
          `Aborting 1.1T parameter execution loop to prevent system freeze.`
        );
      }

      const result = this.analyzeBlock(block);
      totalEnergy += result.metrics.energy;
      cumulativeEntropy += result.metrics.entropy;
      cumulativeSparsity += result.metrics.sparsity;
      
      result.metrics.dominantFrequencies.forEach(f => {
        freqAccumulator[f.freq] = (freqAccumulator[f.freq] || 0) + f.mag;
      });

      blockCount++;
    }

    const sortedFreqs = Object.entries(freqAccumulator)
      .map(([freq, mag]) => ({ freq: parseInt(freq), mag: mag / blockCount }))
      .sort((a, b) => b.mag - a.mag);

    return {
      blockCount,
      totalParameters: blockCount * this.blockSize,
      spectralEnergy: totalEnergy,
      spectralEntropy: blockCount > 0 ? cumulativeEntropy / blockCount : 0,
      spectralSparsity: blockCount > 0 ? cumulativeSparsity / blockCount : 0,
      dominantModes: sortedFreqs.slice(0, 15)
    };
  }

  // ── COMPRESSION & RECONSTRUCTION ──────────────────────────

  compressSpectrum(spectrum, keepRatio = 0.05) {
    const magnitude = spectrum.magnitude;
    const thresholdCount = Math.max(1, Math.floor(this.blockSize * keepRatio));
    
    // Find magnitude threshold
    const sorted = [...magnitude].sort((a, b) => b - a);
    const thresholdVal = sorted[thresholdCount - 1];

    const compressedRe = new Float32Array(this.blockSize);
    const compressedIm = new Float32Array(this.blockSize);
    const compressedMag = new Float32Array(this.blockSize);

    let activeCount = 0;

    for (let i = 0; i < this.blockSize; i++) {
      if (spectrum.magnitude[i] >= thresholdVal && activeCount < thresholdCount) {
        compressedRe[i] = spectrum.re[i];
        compressedIm[i] = spectrum.im[i];
        compressedMag[i] = spectrum.magnitude[i];
        activeCount++;
      } else {
        compressedRe[i] = 0.0;
        compressedIm[i] = 0.0;
        compressedMag[i] = 0.0;
      }
    }

    return {
      type: spectrum.type,
      D: spectrum.D,
      re: compressedRe,
      im: compressedIm,
      magnitude: compressedMag,
      phase: spectrum.phase, // keep original phase array
      keepRatio,
      actualKept: activeCount
    };
  }

  reconstructBlock(compressedSpectrum) {
    return this.spectralEngine.inverseSpectralTransform(compressedSpectrum);
  }

  calculateError(originalBlock, reconstructedBlock) {
    let mse = 0.0;
    let dot = 0.0;
    let normOrig = 0.0;
    let normRec = 0.0;

    const len = Math.min(originalBlock.length, reconstructedBlock.values.length);

    for (let i = 0; i < len; i++) {
      const diff = originalBlock[i] - reconstructedBlock.values[i];
      mse += diff * diff;
      dot += originalBlock[i] * reconstructedBlock.values[i];
      normOrig += originalBlock[i] * originalBlock[i];
      normRec += reconstructedBlock.values[i] * reconstructedBlock.values[i];
    }

    mse /= len;

    const denom = Math.sqrt(normOrig) * Math.sqrt(normRec);
    const cosineSimilarity = denom > 0 ? dot / denom : 0.0;

    return {
      mse,
      rmse: Math.sqrt(mse),
      cosineSimilarity,
      reconstructionError: 1.0 - cosineSimilarity
    };
  }
}
