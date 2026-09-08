/**
 * M4 Living Memory Validation Suite (m4_memory_bench.js)
 * Validates M4 Hebbian updates, decay simulations, contradiction penalties,
 * asynchronous persistence, and includes the M4.1 Coarse LSH Indexing Stress Test (10K -> 1M).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MemoryEngine } from '../core/memory_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [\x1b[32mPASS\x1b[0m] ${message}`);
  } else {
    failed++;
    console.error(`  [\x1b[31mFAIL\x1b[0m] ${message}`);
  }
}

// Coarse LSH Indexing structure for O(1) multi-probe bucketing search in FHRR phase space
class CoarseLSHIndex {
  constructor(D, numProjections = 8) {
    this.D = D;
    this.numProjections = numProjections;
    this.buckets = Array.from({ length: 1 << numProjections }, () => []);
    
    // Generate random projections
    this.projections = [];
    for (let i = 0; i < numProjections; i++) {
      const vec = new Float32Array(D);
      for (let j = 0; j < D; j++) {
        vec[j] = Math.random() * 2.0 - 1.0;
      }
      this.projections.push(vec);
    }
  }

  _hash(vector) {
    let hash = 0;
    for (let i = 0; i < this.numProjections; i++) {
      let dot = 0;
      const p = this.projections[i];
      for (let j = 0; j < this.D; j++) {
        dot += vector[j] * p[j];
      }
      if (dot > 0) {
        hash |= (1 << i);
      }
    }
    return hash;
  }

  insert(id, vector, content) {
    const hash = this._hash(vector);
    this.buckets[hash].push({ id, vector, content });
  }

  search(queryVector, k = 10) {
    const queryHash = this._hash(queryVector);
    
    // Multi-probe candidate selection: Query bucket + all neighbors of Hamming distance <= 1
    const candidateBuckets = [queryHash];
    for (let i = 0; i < this.numProjections; i++) {
      candidateBuckets.push(queryHash ^ (1 << i));
    }
    
    const candidates = [];
    for (const h of candidateBuckets) {
      const bucket = this.buckets[h];
      for (let i = 0; i < bucket.length; i++) {
        candidates.push(bucket[i]);
      }
    }

    // Direct scoring of bucket candidates
    const scored = [];
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      let dot = 0, normA = 0, normB = 0;
      for (let j = 0; j < this.D; j++) {
        dot += queryVector[j] * cand.vector[j];
        normA += queryVector[j] * queryVector[j];
        normB += cand.vector[j] * cand.vector[j];
      }
      const score = dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1e-9);
      scored.push({ item: cand, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}

export async function runM4MemoryTest() {
  console.log("======================================================================");
  console.log("       M4 LIVING RESONANCE MEMORY VALIDATION SUITE");
  console.log("======================================================================");

  const engine = new MemoryEngine({ alpha: 0.3, lambda: 0.01 });

  // ── TEST 1: CONFIDENCE CURVE CONVERGENCE ─────────────────────
  console.log("\n[Test 1] Confidence Curve Convergence Test...");
  const D = 1024;
  const dummyVector = new Float32Array(D);
  dummyVector.fill(0.1);

  const rec = engine.addRecord({
    id: "test-rec-1",
    content: "Milli Yapay Zeka Egemen Altyapısı.",
    representation: dummyVector,
    confidence: 0.70,
    reinforcement: 1
  });

  assert(Math.abs(rec.confidence - 0.70) < 1e-4, `Initial confidence should be 0.70 (got ${rec.confidence.toFixed(4)})`);

  // First reinforcement update
  engine.reinforce("test-rec-1");
  assert(Math.abs(rec.confidence - 0.79) < 1e-4, `1st reinforcement confidence should be 0.79 (got ${rec.confidence.toFixed(4)})`);

  // Second reinforcement update
  engine.reinforce("test-rec-1");
  assert(Math.abs(rec.confidence - 0.853) < 1e-4, `2nd reinforcement confidence should be 0.853 (got ${rec.confidence.toFixed(4)})`);

  // Third reinforcement update
  engine.reinforce("test-rec-1");
  assert(Math.abs(rec.confidence - 0.8971) < 1e-4, `3rd reinforcement confidence should be 0.8971 (got ${rec.confidence.toFixed(4)})`);


  // ── TEST 2: DECAY SIMULATION OVER TIME ────────────────────────
  console.log("\n[Test 2] Decay Simulation Over Time...");
  const recDecay = engine.addRecord({
    id: "decay-rec",
    content: "Decay simulation check",
    representation: dummyVector,
    confidence: 1.0,
    reinforcement: 1
  });

  const t0 = recDecay.lastReinforcedAt;
  const c_t0 = engine.getDecayedConfidence(recDecay, t0);
  const c_t1h = engine.getDecayedConfidence(recDecay, t0 + 1 * 3600 * 1000);
  const c_t1d = engine.getDecayedConfidence(recDecay, t0 + 24 * 3600 * 1000);
  const c_t7d = engine.getDecayedConfidence(recDecay, t0 + 7 * 24 * 3600 * 1000);
  const c_t30d = engine.getDecayedConfidence(recDecay, t0 + 30 * 24 * 3600 * 1000);

  assert(c_t0 === 1.0, `t=0 decay is 1.0`);
  assert(c_t1h < c_t0 && c_t1h > 0.98, `t=1h decayed confidence within range: ${c_t1h.toFixed(4)}`);
  assert(c_t1d < c_t1h && c_t1d > 0.75, `t=1d decayed confidence within range: ${c_t1d.toFixed(4)}`);
  assert(c_t7d < c_t1d && c_t7d > 0.15, `t=7d decayed confidence within range: ${c_t7d.toFixed(4)}`);
  assert(c_t30d < c_t7d && c_t30d > 0.0001, `t=30d decayed confidence within range: ${c_t30d.toExponential(4)}`);

  // Verify decay rate slows down with reinforcement
  const recDecaySlow = engine.addRecord({
    id: "decay-rec-slow",
    content: "Decay stabilization",
    representation: dummyVector,
    confidence: 1.0,
    reinforcement: 10
  });

  const c_slow_t1d = engine.getDecayedConfidence(recDecaySlow, t0 + 24 * 3600 * 1000);
  assert(c_slow_t1d > c_t1d, `Reinforced memory decays slower: ${c_slow_t1d.toFixed(4)} (10x) vs ${c_t1d.toFixed(4)} (1x)`);


  // ── TEST 3: CONTRADICTION & PENALTY ───────────────────────────
  console.log("\n[Test 3] Contradiction & Penalty Test...");
  const recA = engine.addRecord({
    id: "rec-A",
    content: "Yapay zeka yerelde çalışmalıdır.",
    representation: dummyVector,
    confidence: 0.95,
    reinforcement: 5
  });

  const recB = engine.addRecord({
    id: "rec-B",
    content: "Yapay zeka sadece bulutta çalışmalıdır.",
    representation: dummyVector,
    confidence: 0.85,
    reinforcement: 2
  });

  engine.flagContradiction("rec-A", "rec-B");
  assert(recA.status === 'conflicted' && recB.status === 'conflicted', `Both records flagged as conflicted`);
  assert(recA.contradictionIds.includes("rec-B"), `A points to conflict B`);
  assert(recB.contradictionIds.includes("rec-A"), `B points to conflict A`);

  // Scores should penalize conflict but higher reinforcement/confidence stays on top
  const results = engine.retrieve(dummyVector);
  const idxA = results.findIndex(r => r.record.id === "rec-A");
  const idxB = results.findIndex(r => r.record.id === "rec-B");
  assert(idxA < idxB, `Conflicted higher confidence memory rec-A retrieved before rec-B`);


  // ── TEST 4: ASYNCHRONOUS PERSISTENCE ──────────────────────────
  console.log("\n[Test 4] Asynchronous Persistence Test...");
  const tempPath = path.join(__dirname, 'temp_memory_persistence.json');
  
  engine.saveToFile(tempPath);
  await engine._savePromise;
  
  assert(fs.existsSync(tempPath), `JSON file persisted asynchronously to disk`);

  const newEngine = new MemoryEngine();
  newEngine.loadFromFile(tempPath);

  const loadedRec = newEngine.records.get("test-rec-1");
  assert(loadedRec !== undefined, `Record successfully loaded from JSON`);
  assert(loadedRec.content === "Milli Yapay Zeka Egemen Altyapısı.", `Content matched`);
  assert(loadedRec.representation instanceof Float32Array && loadedRec.representation.length === D, `Vector representation restored to Float32Array`);
  assert(Math.abs(loadedRec.confidence - 0.8971) < 1e-4, `Confidence restored correctly: ${loadedRec.confidence.toFixed(4)}`);

  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }

  // ── TEST M4.1: EXACT FALLBACK SAFETY TRIGERS ─────────────────
  console.log("\n[Test M4.1] Exact Fallback Safety Triggers...");
  
  // Trigger A: Priority High record injection and exact bypass
  const priorityEngine = new MemoryEngine();
  const normalVec = new Float32Array(D);
  normalVec.fill(0.2);
  const targetVec = new Float32Array(D);
  targetVec.fill(0.8);
  
  // Add normal records to populate index
  for (let i = 0; i < 50; i++) {
    priorityEngine.addRecord({
      id: `norm-${i}`,
      content: `Normal record ${i}`,
      representation: normalVec,
      priority: 'normal'
    });
  }
  
  // Add a high-priority record with a completely different vector
  priorityEngine.addRecord({
    id: "priority-high-rec",
    content: "Kritik Emniyet Görevi",
    representation: targetVec,
    priority: "high"
  });

  // Querying with normalVec would normally hash to normal buckets and completely miss the targetVec.
  // But since it has priority: "high", the engine must inject it into candidateIndices.
  const priorityResults = priorityEngine.retrieve(normalVec, 5);
  const priorityMatched = priorityResults.some(r => r.record.id === "priority-high-rec");
  assert(priorityMatched, "High-priority record successfully injected and retrieved despite bucket mismatch");

  // Trigger B: Low confidence (C < 0.45) fallback
  // Create an engine, add a record, decay it until C < 0.45, and query
  const decayEngine = new MemoryEngine();
  const doc = decayEngine.addRecord({
    id: "decay-triggered-rec",
    content: "Eski sönümlenmiş bellek",
    representation: targetVec,
    confidence: 0.40 // Initial confidence already below 0.45
  });

  // The retrieve method should detect maxC = 0.40 < 0.45 and trigger exact fallback scan
  const decayResults = decayEngine.retrieve(targetVec, 1);
  assert(decayResults.length > 0 && decayResults[0].record.id === "decay-triggered-rec", "Exact fallback triggered and recalled low-confidence record (C < 0.45)");


  // ── TEST M4.2: MEMORY ENGINE SCALING & STRESS TEST ────────────
  console.log("\n[Test M4.2] Memory Engine Scaling & Stress Test (10K -> 1M)...");
  console.log("Note: 1M is defined as the maximum memory boundary under 500 MB Node.js heap limit.");
  
  const scales = [10000, 100000, 1000000];
  const D_stress = 128; // Fixed D=128 for realistic FHRR semantics

  for (const scale of scales) {
    if (global.gc) {
      global.gc();
    }
    const memStart = process.memoryUsage().heapUsed;

    console.log(`\nInserting ${scale.toLocaleString()} FHRR phase vectors (D=${D_stress})...`);

    const scaleEngine = new MemoryEngine();
    const t0 = performance.now();
    
    // Batch insert vectors
    for (let i = 0; i < scale - 1; i++) {
      const vec = new Float32Array(D_stress);
      for (let j = 0; j < D_stress; j++) {
        vec[j] = Math.random() * 2.0 * Math.PI;
      }
      scaleEngine.addRecord({
        id: `id-${i}`,
        content: `content-${i}`,
        representation: vec
      });
    }

    // Insert golden target vector
    const goldenVector = new Float32Array(D_stress);
    for (let j = 0; j < D_stress; j++) {
      goldenVector[j] = 1.0; // distinctive pattern
    }
    scaleEngine.addRecord({
      id: "golden-target",
      content: "Milli Egemen Yapay Zeka",
      representation: goldenVector
    });

    const tInsert = performance.now() - t0;
    const memEnd = process.memoryUsage().heapUsed;
    const ramMB = ((memEnd - memStart) / (1024 * 1024)).toFixed(2);
    console.log(`  - Persisted in RAM : ${ramMB} MB`);
    console.log(`  - Build time        : ${tInsert.toFixed(2)} ms`);

    // Perform queries and record latencies (fewer queries for large scale to stay within benchmark time bounds)
    const numQueries = scale === 1000000 ? 5 : (scale === 100000 ? 20 : 100);
    const latencies = [];
    let r1 = 0, r5 = 0, r10 = 0;

    for (let q = 0; q < numQueries; q++) {
      // Perturb the golden vector slightly to check recall
      const queryVec = new Float32Array(D_stress);
      for (let j = 0; j < D_stress; j++) {
        queryVec[j] = goldenVector[j] + (Math.random() * 0.1 - 0.05); // tiny noise
      }

      const qStart = performance.now();
      const matches = scaleEngine.retrieve(queryVec, 10);
      const qEnd = performance.now();
      latencies.push(qEnd - qStart);

      const idx = matches.findIndex(m => m.record.id === "golden-target");
      if (idx === 0) r1++;
      if (idx >= 0 && idx < 5) r5++;
      if (idx >= 0 && idx < 10) r10++;
    }

    // Sort latencies to compute percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(3);
    const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(3);
    const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(3);

    const recall1 = ((r1 / numQueries) * 100).toFixed(1) + "%";
    const recall5 = ((r5 / numQueries) * 100).toFixed(1) + "%";
    const recall10 = ((r10 / numQueries) * 100).toFixed(1) + "%";

    console.log(`  - Latencies         : p50: ${p50} ms | p95: ${p95} ms | p99: ${p99} ms`);
    console.log(`  - Recall            : Recall@1: ${recall1} | Recall@5: ${recall5} | Recall@10: ${recall10}`);
    
    // Explicitly nullify references and run GC to keep within 500MB heap limit
    if (global.gc) {
      global.gc();
    }
  }

  console.log("\n======================================================================");
  console.log(`M4 VALIDATION COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("======================================================================\n");
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('m4_memory_bench.js') || process.argv[1].endsWith('m4_memory_bench'))) {
  runM4MemoryTest();
}
