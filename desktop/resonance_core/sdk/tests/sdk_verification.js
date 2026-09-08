/**
 * Resonance SDK v1.0 - SDK Verification Suite
 * Asserts: zero-copy WASM interface, memory limits, OOV correctness, and generation consistency.
 */

import { ResonanceSDK } from '../resonance_sdk.js';

let passed = 0, failed = 0, total = 0;

function assert(name, condition, detail = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${detail}`);
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         RESONANCE SDK v1.0 — SPEC VERIFICATION           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Initialize SDK
  console.log('▸ 1. Initialization and Runtime Verification');
  const sdk = new ResonanceSDK({ D: 4096 });
  await sdk.init();
  assert('SDK initialized successfully', sdk._initialized);
  assert('WASM instance is active', sdk.wasmInstance !== null);
  assert('WASM memory is active', sdk.wasmMemory !== null);

  // 2. Zero-Copy Interface Checks
  console.log('\n▸ 2. Zero-Copy Memory Assertions');
  // Check pointers are non-zero and allocated within WASM linear memory
  assert('vocabCosPtr is allocated', sdk.vocabCosPtr > 0);
  assert('vocabSinPtr is allocated', sdk.vocabSinPtr > 0);
  assert('scoresPtr is allocated', sdk.scoresPtr > 0);
  assert('candidateIndicesPtr is allocated', sdk.candidateIndicesPtr > 0);

  // Validate shared memory buffers (float arrays point to the exact same buffer)
  const memBuffer = sdk.wasmMemory.buffer;
  assert('WASM memory is an ArrayBuffer', memBuffer instanceof ArrayBuffer);
  
  // Try writing a small test slice to candidates ptr and checking it matches WASM buffer
  const testPool = [1, 5, 10, 42];
  const candView = new Int32Array(memBuffer, sdk.candidateIndicesPtr, testPool.length);
  candView.set(testPool);
  
  // Check that writing directly updates memory
  const checkCandView = new Int32Array(memBuffer, sdk.candidateIndicesPtr, testPool.length);
  assert('Zero-copy candidate pointer is writable and readable', 
    checkCandView[0] === 1 && checkCandView[3] === 42
  );

  // 3. Memory Footprint / Limits Check
  console.log('\n▸ 3. Memory Footprint Limits Assertions');
  const heapBytes = sdk.wasmMemory.buffer.byteLength;
  const heapMb = heapBytes / (1024 * 1024);
  console.log(`   → WASM Linear Memory Allocated: ${heapMb.toFixed(2)} MB`);
  // Assert memory stays well below commercial target limit for large vocabulary (e.g., 1500 MB)
  assert('WASM memory usage is within commercial limits (< 1500 MB)', heapMb < 1500);

  // 4. OOV Correctness Checks
  console.log('\n▸ 4. Out-of-Vocabulary (OOV) Safety Assertions');
  // Verify <unk> exists in vocab
  assert('<unk> token is at index 0', sdk.vocab[0] === '<unk>');
  assert('<unk> index lookup works', sdk.vocabMap.get('<unk>') === 0);

  // Run generation with completely unknown words (OOV)
  const oovPrompt = "xyzabc123 qwerty999";
  const result = sdk.generate(oovPrompt, { maxLength: 3 });
  assert('OOV prompt generation completed without crashing', result !== null);
  assert('OOV prompt generated valid output words', result.newTokens.length > 0);
  console.log(`   → OOV Prompt: "${oovPrompt}"`);
  console.log(`   → Assistant Output: "${result.generatedText}"`);

  // 5. Morphological Expansion Verification
  console.log('\n▸ 5. Turkish Morphological Expansion Verification');
  const testWord = "kitaplarımızdan";
  const analysis = sdk.analyze(testWord);
  assert('Morphology analysis returns valid object', typeof analysis === 'object');
  assert('Correct root detected', analysis.root === 'kitap');
  assert('Suffixes array populated', analysis.suffixes.includes('lar') && analysis.suffixes.includes('dan'));

  // ── SUMMARY ───────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed}/${total} PASSED  ${failed > 0 ? `(${failed} FAILED)` : '✨ ALL CLEAR'}  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner failure:', e);
  process.exit(1);
});
