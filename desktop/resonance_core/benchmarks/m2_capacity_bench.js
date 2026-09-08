/**
 * M2 Capacity Limit Benchmark (m2_capacity_bench.js)
 * Validates the N_max ≈ D/20 capacity equation of phase-based FHRR bundling.
 * Evaluates Random, Correlated, and Adversarial vector sets at D=4096.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HDCEngine, Representation } from '../core/hdc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const D = 4096;
const hdc = new HDCEngine(D);

// Helper to generate correlated complex vectors
function generateCorrelatedVector(baseVec, correlationFactor = 0.7) {
  const vals = new Float32Array(D);
  for (let i = 0; i < D; i++) {
    // Mix base vector phase angle with random noise
    const noise = Math.random() * 2 * Math.PI;
    vals[i] = (baseVec.values[i] * correlationFactor + noise * (1 - correlationFactor)) % (2 * Math.PI);
  }
  return new Representation('complex', vals, D);
}

// Helper to generate adversarial complex vectors (180 degrees phase shifts)
function generateAdversarialVector(baseVec) {
  const vals = new Float32Array(D);
  for (let i = 0; i < D; i++) {
    // Add exactly PI (180 degrees) phase shift to cause destructive interference
    vals[i] = (baseVec.values[i] + Math.PI) % (2 * Math.PI);
  }
  return new Representation('complex', vals, D);
}

function evaluateCapacity(N, type = 'random') {
  const roles = [];
  const concepts = [];
  
  // 1. Generate base vectors
  for (let i = 0; i < N; i++) {
    roles.push(hdc.generateRandom('complex'));
    if (type === 'random') {
      concepts.push(hdc.generateRandom('complex'));
    } else if (type === 'correlated') {
      // Create a base semantic vector to perturb concepts around
      if (i === 0) {
        concepts.push(hdc.generateRandom('complex'));
      } else {
        concepts.push(generateCorrelatedVector(concepts[0], 0.75));
      }
    } else if (type === 'adversarial') {
      // Create adversarial pairs that cancel each other
      if (i % 2 === 0) {
        concepts.push(hdc.generateRandom('complex'));
      } else {
        concepts.push(generateAdversarialVector(concepts[i - 1]));
      }
    }
  }

  // Vocabulary for lookup (contains target concepts + distractor concepts)
  const vocabSize = Math.max(1000, N * 2);
  const vocab = [...concepts];
  while (vocab.length < vocabSize) {
    vocab.push(hdc.generateRandom('complex'));
  }

  // 2. Bind and Bundle
  const boundReps = [];
  for (let i = 0; i < N; i++) {
    boundReps.push(hdc.bind(roles[i], concepts[i]));
  }
  const bundled = hdc.bundle(boundReps);

  // 3. Retrieve and Score
  let r1 = 0, r5 = 0, r10 = 0;
  const similarities = [];
  let fp = 0, fn = 0, tp = 0, tn = 0;
  const threshold = 0.15; // Detection threshold

  for (let i = 0; i < N; i++) {
    const unbound = hdc.unbind(bundled, roles[i]);
    const targetSim = hdc.similarity(unbound, concepts[i]);
    similarities.push(targetSim);

    // Score against vocabulary
    const scoredVocab = vocab.map((concept, idx) => {
      return { idx, score: hdc.similarity(unbound, concept) };
    });
    scoredVocab.sort((a, b) => b.score - a.score);

    const rankIdx = scoredVocab.findIndex(sv => sv.idx === i);
    if (rankIdx === 0) r1++;
    if (rankIdx >= 0 && rankIdx < 5) r5++;
    if (rankIdx >= 0 && rankIdx < 10) r10++;

    // Decision metrics (TP, FP, TN, FN)
    if (targetSim >= threshold) {
      tp++; // Correctly detected
    } else {
      fn++; // Missed
    }

    // Distractor test (check a random non-bound role to test False Positive rates)
    const distractorRole = hdc.generateRandom('complex');
    const distractorUnbound = hdc.unbind(bundled, distractorRole);
    const distractorSim = hdc.similarity(distractorUnbound, concepts[i]);
    if (distractorSim >= threshold) {
      fp++;
    } else {
      tn++;
    }
  }

  // Calculate stats
  const meanSim = similarities.reduce((a, b) => a + b, 0) / N;
  const stdSim = Math.sqrt(similarities.reduce((sum, s) => sum + Math.pow(s - meanSim, 2), 0) / N);
  
  // Calculate crosstalk noise floor
  const crosstalkFloor = N > 1 ? (1 / Math.sqrt(D)) * Math.sqrt(N - 1) : 0;

  return {
    N,
    recall1: r1 / N,
    recall5: r5 / N,
    recall10: r10 / N,
    meanSim,
    stdSim,
    crosstalkFloor,
    fpRate: fp / (fp + tn || 1),
    fnRate: fn / (tp + fn || 1)
  };
}

export function runM2CapacityBench() {
  console.log("======================================================================");
  console.log("       M2 CAPACITY LIMIT VALIDATION SUITE (D = 4096)");
  console.log("======================================================================");

  const scales = [10, 25, 50, 100, 200, 500, 1000];
  const types = ['random', 'correlated', 'adversarial'];
  const results = {};

  for (const type of types) {
    results[type] = [];
    console.log(`\nEvaluating Capacity Curve: ${type.toUpperCase()} concept set...`);
    for (const N of scales) {
      const metrics = evaluateCapacity(N, type);
      results[type].push(metrics);
      console.log(`  N = ${N.toString().padEnd(4)} | R@1: ${(metrics.recall1*100).toFixed(1)}% | R@10: ${(metrics.recall10*100).toFixed(1)}% | Mean Sim: ${metrics.meanSim.toFixed(4)} | Noise Floor: ${metrics.crosstalkFloor.toFixed(4)}`);
    }
  }

  // Write capacity curve file to disk
  const outputPath = path.join(__dirname, 'capacity_curve.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nSaved capacity curves JSON output to: benchmarks/capacity_curve.json`);
  console.log("======================================================================\n");
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('m2_capacity_bench.js') || process.argv[1].endsWith('m2_capacity_bench'))) {
  runM2CapacityBench();
}
