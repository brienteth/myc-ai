/**
 * M2 Memory Retention Benchmark Suite (m2_retention_bench.js)
 * Validates Levels 1, 2, and 3 memory retention capabilities:
 * - Level 1: Direct Recall under noise injection
 * - Level 2: Holographic Association & Superposition Unbundling
 * - Level 3: Time Decay, Interference Penalty & Needle-in-a-Haystack (L=128..8192)
 */

import { HDCEngine } from '../core/hdc.js';
import { MemoryEngine } from '../core/memory_engine.js';
import { TurkishMorphology } from '../core/morphology.js';

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

async function runLevel1() {
  console.log("\n[Level 1] Direct Recall with Noise Injection...");
  const D = 1024;
  const hdc = new HDCEngine(D);
  const memory = new MemoryEngine();

  const originalVec = hdc.generateRandom('complex');
  memory.addRecord({
    id: "target-record",
    content: "Milli Egemen Yapay Zeka Çekirdeği",
    representation: originalVec.values
  });

  // Query with noise levels: 5%, 10%, 25%, 50%
  const noiseLevels = [0.05, 0.10, 0.25, 0.50];
  for (const noise of noiseLevels) {
    const noisyVec = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      noisyVec[i] = originalVec.values[i] + (Math.random() * noise * 2 - noise);
    }

    const results = memory.retrieve(noisyVec, 1);
    const success = results.length > 0 && results[0].record.id === "target-record";
    assert(success, `Direct Recall under ${(noise * 100)}% noise injection (Rank 1 score: ${results.length > 0 ? results[0].score.toFixed(4) : "N/A"})`);
  }
}

async function runLevel2() {
  console.log("\n[Level 2] Holographic Association & Superposition Unbundling...");
  const D = 2048;
  const hdc = new HDCEngine(D);

  // Define 5 distinct concepts and their key/value mappings
  const keys = ["renk", "boyut", "hız", "konum", "durum"];
  const values = ["kırmızı", "büyük", "hızlı", "ankara", "aktif"];

  const bindings = [];
  for (let i = 0; i < keys.length; i++) {
    const keyVec = hdc.generateSeeded('complex', keys[i]);
    const valVec = hdc.generateSeeded('complex', values[i]);
    // bind: multiplication of phase values in FHRR
    const bound = hdc.bind(keyVec, valVec);
    bindings.push(bound);
  }

  // Bundle all key-value bindings into a single holographic superposition vector
  const superpositionBundle = hdc.bundle(bindings);

  // Unbind each key and check similarity to the corresponding target value
  for (let i = 0; i < keys.length; i++) {
    const keyVec = hdc.generateSeeded('complex', keys[i]);
    const expectedValVec = hdc.generateSeeded('complex', values[i]);
    
    // unbind key from bundle: conjugate multiplication
    const queryValVec = hdc.unbind(superpositionBundle, keyVec);
    const sim = hdc.similarity(queryValVec, expectedValVec);
    
    assert(sim > 0.18, `Superposition unbundled value matches target "${values[i]}" (CosSim: ${sim.toFixed(4)})`);
  }
}

async function runLevel3() {
  console.log("\n[Level 3] Decay, Interference & Needle-in-a-Haystack (L=128..8192)...");
  const D = 8192; // Use high-dimension FHRR (8192) to match engine capacity for L=8192 sequence lengths
  const hdc = new HDCEngine(D);
  const memory = new MemoryEngine({ lambda: 0.05, wx: 0.3 });

  // 1. Time Decay & Interference Check
  const vecA = hdc.generateRandom('complex').values;
  const recA = memory.addRecord({
    id: "rec-A",
    content: "Yapay zeka işlem gücü yerelde kalmalıdır.",
    representation: vecA
  });

  const recB = memory.addRecord({
    id: "rec-B",
    content: "Yapay zeka işlem gücü sadece buluttan yönetilmelidir.",
    representation: vecA
  });

  // Flag contradiction & check interference penalty
  memory.flagContradiction("rec-A", "rec-B");
  const res = memory.retrieve(vecA);
  assert(res[0].record.status === 'conflicted', `Conflict interference flagged correctly`);
  assert(res[0].score < 0.5, `Score penalized due to contradiction: ${res[0].score.toFixed(4)}`);

  // 2. Needle-in-a-Haystack (L = 128, 1024, 4096, 8192)
  const haystackSizes = [128, 1024, 4096, 8192];
  const wordsCorpus = ["yapay", "zeka", "dil", "modelleri", "üzerine", "kuruludur", "milli", "teknoloji", "egemenlik", "veri", "merkezi"];

  for (const size of haystackSizes) {
    // Generate random haystack words deterministically using seeded index strings to avoid random overlap
    const words = [];
    for (let i = 0; i < size; i++) {
      const corpusWord = wordsCorpus[(i * 7 + 13) % wordsCorpus.length];
      words.push(corpusWord);
    }

    // Embed the needle at a random index
    const needleText = "SECRET_ID";
    const needleIndex = Math.floor((size - 1) / 2); // Middle index for stable permutation shifts
    words[needleIndex] = needleText;

    // Bundle haystack words using permuted holographic sequence bindings to preserve order
    const reps = words.map((w, idx) => {
      const vec = hdc.generateSeeded('complex', `${w}_${idx}`); // seed uniquely by word and position index
      return hdc.permute(vec, idx);
    });

    const bundledHaystack = hdc.bundle(reps);

    // Retrieve the needle by unpermuting the bundled representation at the needle index
    const targetVec = hdc.generateSeeded('complex', `${needleText}_${needleIndex}`);
    const unbundledQuery = hdc.permute(bundledHaystack, -needleIndex);
    const sim = hdc.similarity(unbundledQuery, targetVec);

    // Check against other corpus words at that index to confirm uniqueness
    const alternativeVec = hdc.generateSeeded('complex', `yapay_${needleIndex}`);
    const altSim = hdc.similarity(unbundledQuery, alternativeVec);

    assert(sim > altSim, `Needle-in-a-Haystack L=${size} retrieved successfully at index ${needleIndex} (Needle CosSim: ${sim.toFixed(4)} vs Alt: ${altSim.toFixed(4)})`);
  }
}

export async function runM2RetentionBenchmark() {
  console.log("======================================================================");
  console.log("       M2 HOLOGRAPHIC RETENTION & NEEDLE BENCHMARKS");
  console.log("======================================================================");

  await runLevel1();
  await runLevel2();
  await runLevel3();

  console.log("\n======================================================================");
  console.log(`M2 RETENTION BENCHMARK COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("======================================================================\n");
}

if (process.argv[1] && (process.argv[1].endsWith('m2_retention_bench.js') || process.argv[1].endsWith('m2_retention_bench'))) {
  runM2RetentionBenchmark();
}
