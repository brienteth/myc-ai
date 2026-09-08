/**
 * Unified Test Runner for Turkish Resonance AI Core
 * Runs unit tests for all core modules and verifies mathematical/numerical tolerance.
 */

import { TurkishMorphology } from './core/morphology.js';
import { HDCEngine, Representation } from './core/hdc.js';
import { SpectralEngine } from './core/spectral.js';
import { PhaseEngine } from './core/phase.js';
import { ResonanceEngine } from './core/resonance.js';
import { ResonanceMemory } from './core/memory.js';
import { WeightSpectralAnalyzer } from './experiments/weight_analyzer.js';
import { DataFabric } from './data/datasets.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`[\x1b[32mOK\x1b[0m] ${message}`);
  } else {
    failedTests++;
    console.error(`[\x1b[31mFAIL\x1b[0m] ${message}`);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('RUNNING UNIT TESTS — TURKISH RESONANCE AI CORE');
  console.log('='.repeat(60));

  // ── 1. MORPHOLOGY TESTS ─────────────────────────────────────
  console.log('\n[1] Testing Morphology...');
  const morph = new TurkishMorphology();
  const testWord = 'evlerimizden';
  const analysis = morph.analyze(testWord);

  assert(analysis.root === 'ev', `Root should be "ev" (got "${analysis.root}")`);
  assert(analysis.morphemes.join('+') === 'ev+ler+imiz+den', `Morphemes should split correctly (got "${analysis.morphemes.join('+')}")`);
  assert(analysis.features.number === 'plural', `Should detect plural number (got "${analysis.features.number}")`);
  assert(analysis.features.case === 'ablative', `Should detect ablative case (got "${analysis.features.case}")`);
  assert(analysis.features.possession === '1pl', `Should detect 1pl possession (got "${analysis.features.possession}")`);
  assert(analysis.harmony === 'front', `Vowel harmony of "ev" should be "front"`);

  // ── 2. HDC VECTOR ALGEBRA TESTS ─────────────────────────────
  console.log('\n[2] Testing HDC Vector Algebra...');
  const hdc = new HDCEngine(1024); // smaller D for fast tests
  
  // Test Complex / FHRR representation
  const aComplex = hdc.generateSeeded('complex', 'kavram_A');
  const bComplex = hdc.generateSeeded('complex', 'kavram_B');
  assert(aComplex.type === 'complex' && aComplex.values.length === 1024, 'Generate complex vector');

  const boundComplex = hdc.bind(aComplex, bComplex);
  const unboundComplex = hdc.unbind(boundComplex, aComplex);
  const simComplex = hdc.similarity(bComplex, unboundComplex);
  assert(simComplex > 0.99, `FHRR Bind/Unbind reconstruction similarity should be near 1.0 (got ${simComplex.toFixed(4)})`);

  // Test Bipolar representation
  const aBipolar = hdc.generateSeeded('bipolar', 'kavram_A');
  const bBipolar = hdc.generateSeeded('bipolar', 'kavram_B');
  const boundBipolar = hdc.bind(aBipolar, bBipolar);
  const unboundBipolar = hdc.unbind(boundBipolar, aBipolar);
  const simBipolar = hdc.similarity(bBipolar, unboundBipolar);
  assert(simBipolar > 0.99, `Bipolar Bind/Unbind reconstruction similarity should be 1.0 (got ${simBipolar.toFixed(4)})`);

  // Test Binary representation
  const aBinary = hdc.generateSeeded('binary', 'kavram_A');
  const bBinary = hdc.generateSeeded('binary', 'kavram_B');
  const boundBinary = hdc.bind(aBinary, bBinary);
  const unboundBinary = hdc.unbind(boundBinary, aBinary);
  const simBinary = hdc.similarity(bBinary, unboundBinary);
  assert(simBinary > 0.99, `Binary Bind/Unbind reconstruction similarity should be 1.0 (got ${simBinary.toFixed(4)})`);

  // ── 3. SPECTRAL ENGINE TESTS ────────────────────────────────
  console.log('\n[3] Testing Spectral Engine (FFT/IFFT)...');
  const spectral = new SpectralEngine();
  const testVector = hdc.generateSeeded('real', 'spectral_test');
  
  const spectrum = spectral.spectralTransform(testVector);
  assert(spectrum.magnitude.length === 1024, 'Spectral transform returns correct magnitude spectrum size');

  const reconstructed = spectral.inverseSpectralTransform(spectrum);
  
  // Calculate Mean Squared Error (MSE) between original and reconstructed
  let mse = 0;
  for (let i = 0; i < 1024; i++) {
    const diff = testVector.values[i] - reconstructed.values[i];
    mse += diff * diff;
  }
  mse /= 1024;
  assert(mse < 1e-6, `FFT -> IFFT reconstruction MSE should be under 1e-6 (got ${mse.toExponential(4)})`);

  const energy = spectral.spectralEnergy(spectrum);
  assert(energy > 0, `Spectral energy should be positive (got ${energy.toFixed(2)})`);

  const entropy = spectral.spectralEntropy(spectrum);
  assert(entropy >= 0 && entropy <= 1.0, `Spectral entropy should be normalized [0, 1] (got ${entropy.toFixed(4)})`);

  // ── 4. PHASE ENGINE TESTS ───────────────────────────────────
  console.log('\n[4] Testing Phase Engine...');
  const phase = new PhaseEngine();
  const coh = phase.phaseCoherence(aComplex, aComplex);
  assert(coh > 0.99, `Phase coherence with self should be 1.0 (got ${coh.toFixed(4)})`);

  const cohDiff = phase.phaseCoherence(aComplex, bComplex);
  assert(cohDiff < 0.2, `Phase coherence between random vectors should be low (got ${cohDiff.toFixed(4)})`);

  // ── 5. RESONANCE ENGINE & SIGNATURE TESTS ───────────────────
  console.log('\n[5] Testing Resonance Engine...');
  const resonance = new ResonanceEngine();
  const qText = 'evler';
  const cText = 'evlerimizden';
  const qRepr = hdc.generateSeeded('complex', qText);
  const cRepr = hdc.generateSeeded('complex', cText);

  const resVal = resonance.computeResonance(qText, cText, qRepr, cRepr);
  assert(resVal.finalScore > 0, `Compound resonance score should be calculated (got ${resVal.finalScore.toFixed(4)})`);
  assert(resVal.breakdown.morphology > 0, `Morphology similarity should contribute (got ${resVal.breakdown.morphology.toFixed(4)})`);

  const sig = resonance.generateSignature('res_test', qRepr, qText);
  assert(sig.id === 'res_test', 'Generates valid Resonance Signature object');

  // ── 6. RESONANCE MEMORY TESTS ───────────────────────────────
  console.log('\n[6] Testing Resonance Memory...');
  const memory = new ResonanceMemory({ alpha: 0.40, beta: 0.30, gamma: 0.30 });
  memory.addEntry('evlerimizden', cRepr);
  memory.addEntry('yapay zeka', hdc.generateSeeded('complex', 'yapay zeka'));

  const matches = memory.search('evler', qRepr, 5);
  assert(matches.length === 2, 'Memory returns candidates');
  assert(matches[0].content === 'evlerimizden', `Best match should be "evlerimizden" due to morphology overlap (got "${matches[0].content}")`);

  // ── 7. WEIGHT SPECTRAL ANALYZER TESTS ───────────────────────
  console.log('\n[7] Testing Weight Spectral Analyzer...');
  const fabric = new DataFabric();
  const mockWeights = fabric.generateMockWeights(4096);
  const analyzer = new WeightSpectralAnalyzer(4096);

  const analysisResult = analyzer.analyzeBlock(mockWeights);
  assert(analysisResult.metrics.energy > 0, 'Computes weight tensor energy');

  // Test compression & reconstruction error
  const compressed = analyzer.compressSpectrum(analysisResult.spectrum, 0.05); // top 5%
  const reconstructedWeights = analyzer.reconstructBlock(compressed);
  const error = analyzer.calculateError(mockWeights, reconstructedWeights);

  assert(error.cosineSimilarity > 0, `Compression returns valid cosine similarity (got ${error.cosineSimilarity.toFixed(4)})`);
  assert(error.mse > 0, `Compression returns reconstruction MSE (got ${error.mse.toExponential(4)})`);

  // ── 8. DATA FABRIC TESTS ────────────────────────────────────
  console.log('\n[8] Testing Data Fabric...');
  const rawTexts = ['Evlerimizden geliyoruz 12345678901', 'bilgi@turkce-ai.org mail adresi'];
  const cleaned = fabric.cleanTextCorpus(rawTexts);

  assert(cleaned[0].text.includes('[CENSORED]'), 'Censors TC ID PII numbers');
  assert(cleaned[1].text.includes('[CENSORED]'), 'Censors Email PII addresses');
  assert(cleaned[0].quality > 0.3, `Calculates quality score (got ${cleaned[0].quality.toFixed(4)})`);

  // ── SUMMARY ────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`TEST RUN COMPLETE: ${passedTests} passed, ${failedTests} failed.`);
  console.log('='.repeat(60));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
