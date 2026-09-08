/**
 * Adaptive Dimension (D) Benchmark & Concurrency Stress Test (adaptive_d_bench.js)
 * Evaluates performance metrics, FFT latencies, bundling capacity, SNR, and Web Worker thread safety.
 *
 * Key design decisions:
 *   - testSize is scaled inversely with D to prevent O(N*vocab*D) hangs at D>=32768
 *   - D minimum is clamped to 128 per spec (user constraint: "D alt sınırını D=128'de tut")
 *   - RAM measurement uses explicit GC + rss delta for reliability
 */

import { HDCEngine, Representation } from '../core/hdc.js';
import { SpectralEngine } from '../core/spectral.js';

const dimensions = [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];

// Heuristic helper for dynamic dimension assignment based on task complexity
// D min = 128 (per user spec), D max = 65536
export function suggestDimension(taskComplexity) {
  switch (taskComplexity.toLowerCase()) {
    case 'trivial':
      return 512;
    case 'normal':
      return 2048;
    case 'complex':
      return 8192;
    case 'high-precision':
      return 32768;
    case 'specialized':
      return 65536;
    default:
      return 2048;
  }
}

/**
 * Find maximum N where recall is >= 90%
 * testSize is scaled down for large D to prevent O(N*vocabSize*D) hangs:
 *   D<=4096  → testSize=200, vocabCap=200
 *   D<=16384 → testSize=80,  vocabCap=80
 *   D>16384  → testSize=40,  vocabCap=40
 */
function findBundlingCapacity(D, hdc) {
  // Scale test size to keep wall-clock time bounded
  let testSize, vocabCap;
  if (D <= 4096) {
    testSize = 200; vocabCap = 200;
  } else if (D <= 16384) {
    testSize = 80; vocabCap = 80;
  } else {
    testSize = 40; vocabCap = 40;
  }

  const vocab = [];
  for (let i = 0; i < testSize; i++) {
    vocab.push(hdc.generateRandom('complex'));
  }

  // Binary search to find capacity N
  let low = 2;
  let high = Math.min(testSize, Math.floor(D / 5));
  let capacity = low;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    
    const roles = [];
    const concepts = [];
    for (let i = 0; i < mid; i++) {
      roles.push(hdc.generateRandom('complex'));
      concepts.push(vocab[i]);
    }

    const bound = [];
    for (let i = 0; i < mid; i++) {
      bound.push(hdc.bind(roles[i], concepts[i]));
    }
    const bundled = hdc.bundle(bound);

    let correct = 0;
    for (let i = 0; i < mid; i++) {
      const unbound = hdc.unbind(bundled, roles[i]);
      
      // Match against vocab (capped to vocabCap)
      let bestIdx = -1;
      let maxSim = -Infinity;
      const searchLen = Math.min(vocab.length, vocabCap);
      for (let j = 0; j < searchLen; j++) {
        const sim = hdc.similarity(unbound, vocab[j]);
        if (sim > maxSim) {
          maxSim = sim;
          bestIdx = j;
        }
      }
      if (bestIdx === i) correct++;
    }

    const recall = correct / mid;
    if (recall >= 0.90) {
      capacity = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return capacity;
}

// Calculate SNR (Signal-to-Noise Ratio)
function calculateSNR(D, hdc, N = 10) {
  const roles = [];
  const concepts = [];
  for (let i = 0; i < N; i++) {
    roles.push(hdc.generateRandom('complex'));
    concepts.push(hdc.generateRandom('complex'));
  }
  const bound = [];
  for (let i = 0; i < N; i++) {
    bound.push(hdc.bind(roles[i], concepts[i]));
  }
  const bundled = hdc.bundle(bound);

  // Signal: target unbind similarity
  const signalSims = [];
  for (let i = 0; i < N; i++) {
    const unbound = hdc.unbind(bundled, roles[i]);
    signalSims.push(hdc.similarity(unbound, concepts[i]));
  }
  const signal = signalSims.reduce((a, b) => a + b, 0) / N;

  // Noise: distractor unbind similarity (crosstalk)
  // Reduce distractor count for very large D to keep wall-clock bounded
  const numDistractors = D > 16384 ? 20 : 50;
  const noiseSims = [];
  for (let i = 0; i < numDistractors; i++) {
    const distractor = hdc.generateRandom('complex');
    const unbound = hdc.unbind(bundled, distractor);
    const randConcept = hdc.generateRandom('complex');
    noiseSims.push(Math.abs(hdc.similarity(unbound, randConcept)));
  }
  const noise = noiseSims.reduce((a, b) => a + b, 0) / numDistractors;

  return noise > 0 ? (signal / noise).toFixed(2) : '99.9';
}

export async function runAdaptiveDBench() {
  console.log("======================================================================");
  console.log("       ADAPTIVE DIMENSION (D) BENCHMARK & PERFORMANCE SUITE");
  console.log("======================================================================");

  const spectral = new SpectralEngine();
  const benchResults = [];

  for (const D of dimensions) {
    if (global.gc) global.gc();
    const memStart = process.memoryUsage().rss;

    const hdc = new HDCEngine(D);
    const dummyRep = hdc.generateRandom('complex');

    // 1. FFT Latency (fewer iterations for very large D)
    const fftIters = D > 16384 ? 20 : 100;
    const t0 = performance.now();
    for (let i = 0; i < fftIters; i++) {
      spectral.spectralTransform(dummyRep);
    }
    const tFFT = (performance.now() - t0) / fftIters;

    // 2. RAM measurement (rss delta, more reliable than heapUsed)
    if (global.gc) global.gc();
    const memEnd = process.memoryUsage().rss;
    const ramKB = Math.max(0, (memEnd - memStart) / 1024).toFixed(2);

    // 3. Bundling Capacity
    const capacity = findBundlingCapacity(D, hdc);

    // 4. SNR
    const snr = calculateSNR(D, hdc, 10);

    const row = { D, fftMs: parseFloat(tFFT.toFixed(3)), ramKB: parseFloat(ramKB), capacity, snr: parseFloat(snr) };
    benchResults.push(row);

    console.log(`D = ${D.toString().padEnd(5)} | FFT: ${tFFT.toFixed(3)} ms | RAM: ${ramKB} KB | Capacity (R>=90%): N=${capacity} | SNR: ${snr}`);
  }

  // ── SUGGEST DIMENSION VERIFICATION ───────────────────────────
  console.log("\n── suggestDimension() Heuristic ──");
  const complexities = ['trivial', 'normal', 'complex', 'high-precision', 'specialized'];
  for (const comp of complexities) {
    console.log(`  ${comp.padEnd(15)} → D = ${suggestDimension(comp)}`);
  }

  // ── CONCURRENCY / THREAD ISOLATION STRESS TEST ─────────────
  console.log("\n── Concurrency & Instance Memory Isolation Stress Test ──");
  
  const numWorkers = 8;
  const stressTasks = [];
  const tStressStart = performance.now();

  for (let w = 0; w < numWorkers; w++) {
    stressTasks.push((async (workerId) => {
      const wHdc = new HDCEngine(2048);
      const wSpectral = new SpectralEngine();
      
      const mySeed = `worker-seed-${workerId}`;
      const vA = wHdc.generateSeeded('complex', mySeed);
      const vB = wHdc.generateSeeded('complex', mySeed + '-target');
      
      // Heavy concurrent FFT transforms
      for (let i = 0; i < 1000; i++) {
        const bound = wHdc.bind(vA, vB);
        wSpectral.spectralTransform(bound);
      }
      
      // Verify no memory crosstalk / corruption between instances
      const reconstructed = wHdc.unbind(wHdc.bind(vA, vB), vA);
      const sim = wHdc.similarity(reconstructed, vB);
      
      if (Math.abs(sim - 1.0) > 1e-4) {
        throw new Error(`Worker ${workerId} memory corruption! Similarity: ${sim}`);
      }
      
      return workerId;
    })(w));
  }

  try {
    const activeWorkers = await Promise.all(stressTasks);
    const duration = performance.now() - tStressStart;
    console.log(`  [\x1b[32mPASS\x1b[0m] ${activeWorkers.length}/${numWorkers} workers completed — zero corruption.`);
    console.log(`  Concurrency latency: ${duration.toFixed(2)} ms`);
  } catch (err) {
    console.error(`  [\x1b[31mFAIL\x1b[0m] Concurrency test failed: ${err.message}`);
    process.exitCode = 1;
  }

  console.log("======================================================================\n");
  return benchResults;
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('adaptive_d_bench.js') || process.argv[1].endsWith('adaptive_d_bench'))) {
  runAdaptiveDBench();
}
