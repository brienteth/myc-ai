/**
 * Turkish Resonance AI Core - Resonance vs. Attention Ablation Benchmark (v3.5)
 * Compares standard quadratic Transformer Self-Attention O(L^2 D)
 * vs HDC Spectral Resonance O(L D) + O(D log D) in latency, memory, and FLOPs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { HDCEngine } from '../core/hdc.js';
import { WeightSpectralAnalyzer } from './weight_analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard Self-Attention simulation: computes QK^T V quadratic complexity
function runAttentionSimulation(L, D) {
  const Q = new Float32Array(L * D);
  const K = new Float32Array(L * D);
  const V = new Float32Array(L * D);
  
  // Fill with dummy values
  Q.fill(0.1); K.fill(0.2); V.fill(0.3);

  const start = performance.now();

  // 1. Compute attention matrix S = Q K^T: size L x L
  const S = new Float32Array(L * L);
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < L; j++) {
      let sum = 0.0;
      for (let k = 0; k < D; k++) {
        sum += Q[i * D + k] * K[j * D + k];
      }
      S[i * L + j] = sum / Math.sqrt(D);
    }
  }

  // 2. Softmax row-wise
  for (let i = 0; i < L; i++) {
    let max = -Infinity;
    for (let j = 0; j < L; j++) {
      if (S[i * L + j] > max) max = S[i * L + j];
    }
    
    let sum = 0.0;
    for (let j = 0; j < L; j++) {
      S[i * L + j] = Math.exp(S[i * L + j] - max);
      sum += S[i * L + j];
    }
    
    for (let j = 0; j < L; j++) {
      S[i * L + j] /= sum;
    }
  }

  // 3. Output Y = S V: size L x D
  const Y = new Float32Array(L * D);
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < D; j++) {
      let sum = 0.0;
      for (let k = 0; k < L; k++) {
        sum += S[i * L + k] * V[k * D + j];
      }
      Y[i * D + j] = sum;
    }
  }

  const duration = performance.now() - start;
  
  // Theoretical FLOPs: 2*L^2*D (QK^T) + 5*L^2 (Softmax) + 2*L^2*D (SV)
  const flops = 4 * L * L * D + 5 * L * L;
  
  // Intermediate memory footprint in bytes: Q, K, V, S, Y (Float32 = 4 bytes)
  const memoryBytes = (3 * L * D + L * L + L * D) * 4;

  return { durationMs: duration, flops, memoryBytes };
}

// Spectral Resonance simulation: encodes L tokens and performs circular convolution
function runResonanceSimulation(L, D, hdc, analyzer, wSpec) {
  const reps = [];
  for (let i = 0; i < L; i++) {
    reps.push(hdc.generateRandom('complex'));
  }

  const start = performance.now();

  // 1. HDC position permute and bundle: O(L D)
  const bundled = [];
  for (let i = 0; i < L; i++) {
    bundled.push(hdc.permute(reps[i], i * 13));
  }
  const contextVec = hdc.bundle(bundled);

  // 2. FFT to spectral domain: O(D log D)
  const contextSpec = analyzer.spectralEngine.spectralTransform(contextVec);

  // 3. Pointwise Hadamard Complex Product
  const C_re = new Float32Array(D);
  const C_im = new Float32Array(D);
  const C_magnitude = new Float32Array(D);
  
  for (let k = 0; k < D; k++) {
    C_re[k] = wSpec.re[k] * contextSpec.re[k] - wSpec.im[k] * contextSpec.im[k];
    C_im[k] = wSpec.re[k] * contextSpec.im[k] + wSpec.im[k] * contextSpec.re[k];
    C_magnitude[k] = Math.sqrt(C_re[k] * C_re[k] + C_im[k] * C_im[k]);
  }
  
  const productSpec = {
    type: 'complex',
    D,
    re: C_re,
    im: C_im,
    magnitude: C_magnitude
  };

  // 4. IFFT to reconstruct predicted phases
  const reconstructedRep = analyzer.reconstructBlock(productSpec);
  const yQuery = reconstructedRep.values;

  const duration = performance.now() - start;

  // Theoretical FLOPs: 
  // HDC Permute/Bundle: L * D * 3
  // 2 * FFT/IFFT: 2 * 5 * D * log2(D)
  // Hadamard: 6 * D
  const log2D = Math.log2(D);
  const flops = L * D * 3 + 10 * D * log2D + 6 * D;

  // Memory footprint: L vectors (Float32 = 4 bytes) + contextVec + productSpec
  const memoryBytes = (L * D + D * 4) * 4;

  return { durationMs: duration, flops, memoryBytes };
}

export async function runAttentionBenchmark() {
  console.log('======================================================================');
  console.log('       TURKISH RESONANCE AI CORE - RESONANCE VS ATTENTION BENCHMARK   ');
  console.log('======================================================================\n');

  const D = 4096;
  const seqLengths = [32, 64, 128, 256, 512];
  
  const hdc = new HDCEngine(D);
  const analyzer = new WeightSpectralAnalyzer(D);
  const wCarrier = hdc.generateRandom('complex');
  const wSpec = analyzer.spectralEngine.spectralTransform(wCarrier);

  // Warm-up V8 JIT
  console.log('[Warm-up] Starting V8 JIT Warm-up...');
  for (let i = 0; i < 10; i++) {
    runAttentionSimulation(32, D);
    runResonanceSimulation(32, D, hdc, analyzer, wSpec);
  }

  const results = [];

  for (const L of seqLengths) {
    console.log(`[Benchmark] Evaluating Sequence Length L = ${L}...`);
    
    // Standard Attention average over 20 runs
    let attTimeSum = 0.0;
    let attMetrics = null;
    for (let i = 0; i < 20; i++) {
      attMetrics = runAttentionSimulation(L, D);
      attTimeSum += attMetrics.durationMs;
    }
    const attAvgTime = attTimeSum / 20;

    // Spectral Resonance average over 20 runs
    let resTimeSum = 0.0;
    let resMetrics = null;
    for (let i = 0; i < 20; i++) {
      resMetrics = runResonanceSimulation(L, D, hdc, analyzer, wSpec);
      resTimeSum += resMetrics.durationMs;
    }
    const resAvgTime = resTimeSum / 20;

    const speedup = attAvgTime / resAvgTime;
    const flopSavings = attMetrics.flops / resMetrics.flops;
    const memorySavings = attMetrics.memoryBytes / resMetrics.memoryBytes;

    results.push({
      sequenceLength: L,
      attention: {
        latencyMs: attAvgTime,
        flops: attMetrics.flops,
        memoryBytes: attMetrics.memoryBytes
      },
      resonance: {
        latencyMs: resAvgTime,
        flops: resMetrics.flops,
        memoryBytes: resMetrics.memoryBytes
      },
      speedup,
      flopSavings,
      memorySavings
    });

    console.log(`  - Attention Latency: ${attAvgTime.toFixed(4)} ms | FLOPs: ${attMetrics.flops.toExponential(2)}`);
    console.log(`  - Resonance Latency: ${resAvgTime.toFixed(4)} ms | FLOPs: ${resMetrics.flops.toExponential(2)}`);
    console.log(`  - Speedup Ratio    : ${speedup.toFixed(2)}x | FLOP Savings: ${flopSavings.toFixed(1)}x\n`);
  }

  const runFile = path.join(__dirname, 'runs', 'attention_benchmark_results.json');
  fs.writeFileSync(runFile, JSON.stringify(results, null, 2));

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAttentionBenchmark().catch(() => process.exit(1));
}
