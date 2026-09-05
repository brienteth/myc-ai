/**
 * Weight Spectral Analyzer Module
 * Analyzes deep learning model weights using spectral methods (FFT/IFFT) in a memory-efficient, block-wise manner.
 * Supports compressing weights, reconstructing weights, and measuring error matrices.
 */

import { SpectralEngine } from './spectral.js';
import { Representation } from './hdc.js';

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
        throw new Error(`[OOM GUARD TRIGGERED] Memory safety ceiling reached: ${currentHeapMb.toFixed(2)} MB used. Halting stream ingestion to prevent process crash.`);
      }

      const res = this.analyzeBlock(block);
      totalEnergy += res.metrics.energy;
      cumulativeEntropy += res.metrics.entropy;
      cumulativeSparsity += res.metrics.sparsity;
      blockCount++;

      // Accumulate dominant frequencies
      for (const dom of res.metrics.dominantFrequencies) {
        freqAccumulator[dom.frequency] = (freqAccumulator[dom.frequency] || 0) + dom.magnitude;
      }
    }

    if (blockCount === 0) {
      return {
        totalBlocks: 0,
        averageEnergy: 0,
        averageEntropy: 0,
        averageSparsity: 0,
        globalDominantFrequencies: []
      };
    }

    // Sort global dominant frequencies
    const globalDominant = Object.entries(freqAccumulator)
      .map(([frequency, magnitude]) => ({ frequency: parseInt(frequency), magnitude }))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 10);

    return {
      totalBlocks: blockCount,
      averageEnergy: totalEnergy / blockCount,
      averageEntropy: cumulativeEntropy / blockCount,
      averageSparsity: cumulativeSparsity / blockCount,
      globalDominantFrequencies: globalDominant
    };
  }

  // ── COMPRESSION / RECONSTRUCTION ────────────────────────────


  compressSpectrum(wSpec, threshold = 0.20) {
    const D = wSpec.D || (wSpec.re ? wSpec.re.length : wSpec.length);
    const re = new Float32Array(D);
    const im = new Float32Array(D);
    let maxMag = 0;
    for (let i = 0; i < D; i++) {
      const r = wSpec.re ? wSpec.re[i] : wSpec[i].real;
      const m = wSpec.im ? wSpec.im[i] : wSpec[i].imag;
      const mag = Math.sqrt(r * r + m * m);
      if (mag > maxMag) maxMag = mag;
    }
    const cutoff = maxMag * threshold;
    for (let i = 0; i < D; i++) {
      const r = wSpec.re ? wSpec.re[i] : wSpec[i].real;
      const m = wSpec.im ? wSpec.im[i] : wSpec[i].imag;
      const mag = Math.sqrt(r * r + m * m);
      if (mag >= cutoff) {
        re[i] = r;
        im[i] = m;
      }
    }
    return { type: 'complex', D, re, im };
  }

  compressBlock(weightsBlock, threshold = 0.05) {
    const analysis = this.analyzeBlock(weightsBlock);
    const spectrum = analysis.spectrum;
    const D = spectrum.length;

    // Zero out components with magnitude below threshold ratio of max magnitude
    let maxMag = 0;
    for (let i = 0; i < D; i++) {
      const mag = Math.sqrt(spectrum[i].real ** 2 + spectrum[i].imag ** 2);
      if (mag > maxMag) maxMag = mag;
    }

    const cutoff = maxMag * threshold;
    const sparseSpectrum = new Array(D);
    let retainedCount = 0;

    for (let i = 0; i < D; i++) {
      const mag = Math.sqrt(spectrum[i].real ** 2 + spectrum[i].imag ** 2);
      if (mag >= cutoff) {
        sparseSpectrum[i] = spectrum[i];
        retainedCount++;
      } else {
        sparseSpectrum[i] = { real: 0, imag: 0 };
      }
    }

    return {
      sparseSpectrum,
      compressionRatio: D / (retainedCount || 1),
      retainedFrequencies: retainedCount
    };
  }

  reconstructBlock(sparseSpectrum) {
    return this.spectralEngine.inverseSpectralTransform(sparseSpectrum);
  }

  // ── ERROR CALCULATION ───────────────────────────────────────

  computeReconstructionError(originalBlock, reconstructedBlock) {
    const D = Math.min(originalBlock.length, reconstructedBlock.length);
    let sumSquaredError = 0;
    let sumOrigSquared = 0;

    for (let i = 0; i < D; i++) {
      const diff = originalBlock[i] - reconstructedBlock[i];
      sumSquaredError += diff * diff;
      sumOrigSquared += originalBlock[i] * originalBlock[i];
    }

    const mse = sumSquaredError / D;
    const rmse = Math.sqrt(mse);
    const snr = sumOrigSquared > 0 ? 10 * Math.log10(sumOrigSquared / (sumSquaredError + 1e-12)) : 0;

    return {
      mse,
      rmse,
      snrDb: snr
    };
  }
}
