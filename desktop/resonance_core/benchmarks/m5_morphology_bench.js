/**
 * M5 Turkish Morphology Benchmark Suite (m5_morphology_bench.js)
 * Validates complex suffix chains, Liaison (Ulama) phonological syllabification,
 * and semantic word-order scrambling robustness.
 */

import { TurkishMorphology } from '../core/morphology.js';
import { HDCEngine } from '../core/hdc.js';

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

export async function runM5MorphologyBenchmark() {
  console.log("======================================================================");
  console.log("       M5 TURKISH MORPHOLOGY & PHONOLOGY BENCHMARKS");
  console.log("======================================================================");

  const morphology = new TurkishMorphology();

  // 1. Nadir Ek Zincirleri Testi (Rare Suffix Chains)
  console.log("\n[Test 1] Rare Suffix Chains Analysis...");
  
  // Example 1: evlerimizdenkilercesinedir (Root: ev)
  // Suffixes: -ler, -imiz, -den, -ki, -ler, -cesine, -dir
  const word1 = "evlerimizdenkilercesinedir";
  const analysis1 = morphology.analyze(word1);
  
  assert(analysis1.root === "ev", `Root of '${word1}' should be 'ev' (got '${analysis1.root}')`);
  assert(analysis1.suffixes.includes("ler"), `Should split plural '-ler'`);
  assert(analysis1.suffixes.includes("imiz"), `Should split 1pl possessive '-imiz'`);
  assert(analysis1.suffixes.includes("den"), `Should split ablative case '-den'`);
  assert(analysis1.suffixes.includes("ki") || analysis1.suffixes.includes("kiler"), `Should split relative pronoun '-ki' or '-kiler'`);
  assert(analysis1.suffixes.includes("cesine"), `Should split adverbial manner '-cesine'`);
  assert(analysis1.suffixes.includes("dir"), `Should split assertive copula '-dir'`);
  
  assert(analysis1.features.number === 'plural', `Plural number identified`);
  assert(analysis1.features.case === 'ablative', `Ablative case identified`);
  assert(analysis1.features.pronoun === 'relative' || analysis1.features.pronoun === 'relative_plural', `Relative pronoun identified`);
  assert(analysis1.features.aspect === 'manner', `Manner aspect identified`);
  assert(analysis1.features.copula === 'assertive', `Assertive copula identified`);

  // Example 2: gideceklerken (Root: git -> consonant mutated stem)
  const word2 = "gideceklerken";
  const analysis2 = morphology.analyze(word2);
  assert(analysis2.root === "git", `Root of '${word2}' should be 'git' (got '${analysis2.root}')`);
  assert(analysis2.suffixes.includes("ecek"), `Should split future tense '-ecek'`);
  assert(analysis2.suffixes.includes("ler"), `Should split plural '-ler'`);
  assert(analysis2.suffixes.includes("ken"), `Should split temporal adverbial '-ken'`);
  assert(analysis2.features.tense === 'future', `Future tense identified`);
  assert(analysis2.features.adverb === 'temporal', `Temporal adverb identified`);


  // 2. Liaison (Ulama) Fonolojisi Testi
  console.log("\n[Test 2] Phonological Liaison (Ulama) Syllabification...");
  
  // "ekmek al" -> ends in consonant 'k', starts with vowel 'a'. Liaison should shift 'k' to next syllable: ['ek', 'me', 'kal']
  const phrase1 = "ekmek al";
  const syllables1 = morphology.syllabifyPhrase(phrase1);
  const expectedSyllables1 = ["ek", "me", "kal"];
  assert(JSON.stringify(syllables1) === JSON.stringify(expectedSyllables1), 
    `Liaison of '${phrase1}' should be '${expectedSyllables1.join("-")}' (got '${syllables1.join("-")}')`);

  // "milli egemenlik" -> ends in vowel 'i', starts with vowel 'e' (no liaison, standard syllabification)
  const phrase2 = "milli egemenlik";
  const syllables2 = morphology.syllabifyPhrase(phrase2);
  const expectedSyllables2 = ["mil", "li", "e", "ge", "men", "lik"];
  assert(JSON.stringify(syllables2) === JSON.stringify(expectedSyllables2), 
    `Liaison of '${phrase2}' should be '${expectedSyllables2.join("-")}' (got '${syllables2.join("-")}')`);


  // 3. Serbest Söz Dizimi (Scrambling) Sağlamlığı
  console.log("\n[Test 3] Free Word Order Scrambling Robustness...");
  const hdc = new HDCEngine(1024);
  
  // Sentences representing permutations of "Ali elmayı yedi" (Ali ate the apple)
  const sentences = [
    "ali elmayı yedi",
    "elmayı ali yedi",
    "yedi ali elmayı",
    "elmayı yedi ali"
  ];

  // Helper to generate sentence vector using holographic superposition (bundle)
  const vectorizeSentence = (sentence) => {
    const words = sentence.split(" ");
    const reps = words.map(w => hdc.generateSeeded('complex', w));
    return hdc.bundle(reps);
  };

  const vec0 = vectorizeSentence(sentences[0]);
  
  for (let i = 1; i < sentences.length; i++) {
    const vecI = vectorizeSentence(sentences[i]);
    const sim = hdc.similarity(vec0, vecI);
    // Permutative scrambling similarity should be extremely high (near 1.0) because FHRR bundle order is symmetric
    assert(sim > 0.95, `Scrambled sentence similarity to base '${sentences[i]}' is extremely robust (Similarity: ${sim.toFixed(4)})`);
  }

  console.log("======================================================================");
  console.log(`M5 BENCHMARK COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("======================================================================\n");
}

if (process.argv[1] && (process.argv[1].endsWith('m5_morphology_bench.js') || process.argv[1].endsWith('m5_morphology_bench'))) {
  runM5MorphologyBenchmark();
}
