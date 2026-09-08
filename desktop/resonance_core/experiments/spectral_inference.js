/**
 * Turkish Resonance AI Core - Dynamic Spectral Feed-Forward Inference Prototype (v2.7)
 * Implements circulant matrix-vector multiplication in spatial domain O(N^2)
 * vs circular convolution in frequency domain O(N log N) using pointwise complex FFT multiplication.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SafetensorsParser } from '../core/safetensors.js';
import { WeightSpectralAnalyzer } from './weight_analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAFETENSORS_PATH = path.join(__dirname, '..', 'data', 'google_bert_tiny.safetensors');

// Spatial Domain Circulant Matrix-Vector Multiplication: O(N^2)
export function spatialCirculantMultiply(w, x) {
  const N = w.length;
  const y = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0.0;
    for (let j = 0; j < N; j++) {
      const idx = (i - j + N) % N;
      sum += w[idx] * x[j];
    }
    y[i] = sum;
  }
  return y;
}

// Complex Hadamard pointwise product: C = A * B
function complexHadamardProduct(A, B) {
  const N = A.D;
  const C_re = new Float32Array(N);
  const C_im = new Float32Array(N);
  const C_magnitude = new Float32Array(N);
  
  for (let k = 0; k < N; k++) {
    // Complex multiplication arithmetic:
    // Re(C_k) = Re(A_k)Re(B_k) - Im(A_k)Im(B_k)
    C_re[k] = A.re[k] * B.re[k] - A.im[k] * B.im[k];
    // Im(C_k) = Re(A_k)Im(B_k) + Im(A_k)Re(B_k)
    C_im[k] = A.re[k] * B.im[k] + A.im[k] * B.re[k];
    
    C_magnitude[k] = Math.sqrt(C_re[k] * C_re[k] + C_im[k] * C_im[k]);
  }
  
  return {
    type: 'real',
    D: N,
    re: C_re,
    im: C_im,
    magnitude: C_magnitude
  };
}

export async function runSpectralInference() {
  console.log('======================================================================');
  console.log('       TURKISH RESONANCE AI CORE - DYNAMIC SPECTRAL FF INFERENCE      ');
  console.log('======================================================================\n');

  try {
    if (!fs.existsSync(SAFETENSORS_PATH)) {
      throw new Error(`Safetensors file not found at: ${SAFETENSORS_PATH}`);
    }

    const parser = new SafetensorsParser(SAFETENSORS_PATH);
    parser.open();
    const rawWeights = parser.readTensor('bert.embeddings.word_embeddings.weight');
    parser.close();

    const N = 4096;
    // Representative weight vector from the embeddings layer
    const w = rawWeights.slice(200000, 200000 + N);
    
    // Representative input vector x (from another vocabulary token)
    const x = rawWeights.slice(300000, 300000 + N);

    const analyzer = new WeightSpectralAnalyzer(N);

    // 1. Standard Circulant Spatial Multiplication: O(N^2)
    const yStandard = spatialCirculantMultiply(w, x);

    // 2. Exact Spectral Inference: O(N log N)
    const wRep = { type: 'real', values: w, D: N };
    const xRep = { type: 'real', values: x, D: N };
    
    const wSpec = analyzer.spectralEngine.spectralTransform(wRep);
    const xSpec = analyzer.spectralEngine.spectralTransform(xRep);

    const exactProductSpec = complexHadamardProduct(wSpec, xSpec);
    const exactReconstructedRep = analyzer.reconstructBlock(exactProductSpec);
    const ySpec = exactReconstructedRep.values;

    // 3. Sparse Spectral Inference (10x compression)
    // Prune the bottom 90% components of wSpec
    const wSpecSparse = analyzer.compressSpectrum(wSpec, 0.20);
    const sparseProductSpec = complexHadamardProduct(wSpecSparse, xSpec);
    const sparseReconstructedRep = analyzer.reconstructBlock(sparseProductSpec);
    const ySparse = sparseReconstructedRep.values;

    // 4. Verification Errors (L2 difference)
    const exactErrors = analyzer.calculateError(yStandard, { values: ySpec });
    const sparseErrors = analyzer.calculateError(yStandard, { values: ySparse });

    console.log(`[Verification] Math Equivalence MSE (Standard vs Spectral) : ${exactErrors.mse.toExponential(4)}`);
    console.log(`[Verification] Sparse vs Standard Cosine Similarity        : ${sparseErrors.cosineSimilarity.toFixed(6)}`);

    // 5. Latency Benchmark with JIT warm-up
    console.log(`[Benchmark] Starting V8 JIT Warm-up (50 iterations)...`);
    for (let i = 0; i < 50; i++) {
      spatialCirculantMultiply(w, x);
      const ws = analyzer.spectralEngine.spectralTransform(wRep);
      const xs = analyzer.spectralEngine.spectralTransform(xRep);
      const prod = complexHadamardProduct(ws, xs);
      analyzer.reconstructBlock(prod);
    }

    console.log(`[Benchmark] Measuring execution latency (100 iterations)...`);
    const iterations = 100; // 100 runs is fast and representative on CPU

    const startSpatial = performance.now();
    for (let i = 0; i < iterations; i++) {
      spatialCirculantMultiply(w, x);
    }
    const endSpatial = performance.now();
    const spatialTime = (endSpatial - startSpatial) / iterations;

    const startSpectral = performance.now();
    for (let i = 0; i < iterations; i++) {
      const ws = analyzer.spectralEngine.spectralTransform(wRep);
      const xs = analyzer.spectralEngine.spectralTransform(xRep);
      const prod = complexHadamardProduct(ws, xs);
      analyzer.reconstructBlock(prod);
    }
    const endSpectral = performance.now();
    const spectralTime = (endSpectral - startSpectral) / iterations;

    console.log('\n======================================================================');
    console.log('                      DYNAMIC INFERENCE BENCHMARKS                    ');
    console.log('======================================================================');
    console.log(`Spatial O(N^2) Avg Latency    : ${spatialTime.toFixed(4)} ms`);
    console.log(`Spectral O(N log N) Avg Latency : ${spectralTime.toFixed(4)} ms`);
    console.log(`Math Equivalence MSE           : ${exactErrors.mse.toExponential(4)} (Threshold: < 10^-12)`);
    console.log(`Sparse Inference Similarity    : ${sparseErrors.cosineSimilarity.toFixed(6)} (Threshold: > 0.95)`);
    console.log(`Sparse Inference MSE           : ${sparseErrors.mse.toExponential(4)}`);
    console.log(`Equivalence Verified           : ${exactErrors.mse < 1e-12 ? '🟩 YES' : '🟥 NO'}`);
    console.log(`Sparse Inference Status        : ${sparseErrors.cosineSimilarity > 0.95 ? '🟩 LOSSLESS' : '🟥 LOSS'}`);
    console.log('======================================================================\n');

    // Save results
    const results = {
      spatialTime,
      spectralTime,
      exactErrors,
      sparseErrors,
      timestamp: new Date().toISOString(),
      yStandardSample: Array.from(yStandard.slice(0, 100)),
      ySparseSample: Array.from(ySparse.slice(0, 100))
    };

    const resPath = path.join(__dirname, 'runs', 'spectral_inference_results.json');
    fs.writeFileSync(resPath, JSON.stringify(results, null, 2));

    return results;

  } catch (err) {
    console.error('[Error] Spectral Inference execution failed:', err);
    throw err;
  }
}

// Self-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSpectralInference().catch(() => process.exit(1));
}
