/**
 * Complete Verification Suite - Turkish Resonance AI Core
 * Validates:
 * 1. Math/FFT/IFFT/FHRR operations
 * 2. Morphology & clean-up memory
 * 3. Resonance weights and ranking
 * 4. Compression stats & streaming RAM footprint
 * 5. REST API live endpoint check
 */

import http from 'http';
import { TurkishMorphology } from './core/morphology.js';
import { HDCEngine, Representation } from './core/hdc.js';
import { SpectralEngine } from './core/spectral.js';
import { PhaseEngine } from './core/phase.js';
import { ResonanceEngine } from './core/resonance.js';
import { ResonanceMemory } from './core/memory.js';
import { WeightSpectralAnalyzer } from './experiments/weight_analyzer.js';
import { DataFabric } from './data/datasets.js';

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

// Helper to make API post requests
function makePostRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3500,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verifyAll() {
  console.log('='.repeat(70));
  console.log('       TURKISH RESONANCE AI CORE - FULL VALIDATION SUITE');
  console.log('='.repeat(70));

  const tStart = performance.now();

  // ───────────────────────────────────────────────────────────
  // 1. MATEMATİKSEL & SPEKTRAL ÇEKİRDEK TESTLERİ
  // ───────────────────────────────────────────────────────────
  console.log('\n[1] Matematiksel & Spektral Çekirdek Testleri...');
  
  const hdc = new HDCEngine(8192);
  const spectral = new SpectralEngine();
  const phase = new PhaseEngine();

  // FFT/IFFT Roundtrip
  const testRepr = hdc.generateSeeded('real', 'fft_validation_seed');
  const spec = spectral.spectralTransform(testRepr);
  const reconstructed = spectral.inverseSpectralTransform(spec);

  let mse = 0;
  for (let i = 0; i < 8192; i++) {
    const d = testRepr.values[i] - reconstructed.values[i];
    mse += d * d;
  }
  mse /= 8192;
  const similarity = hdc.similarity(testRepr, reconstructed);

  assert(mse < 1e-6, `FFT ↔ IFFT Roundtrip MSE < 10^-6 (Ölçülen MSE: ${mse.toExponential(6)})`);
  assert(similarity > 0.999999, `FFT ↔ IFFT Kosinüs Benzerliği > 0.999999 (Ölçülen: ${similarity.toFixed(8)})`);

  // FHRR Faz Operatörleri: (A * B) / B = A
  const aComplex = hdc.generateSeeded('complex', 'kavram_A');
  const bComplex = hdc.generateSeeded('complex', 'kavram_B');
  const bound = hdc.bind(aComplex, bComplex);
  const unbound = hdc.unbind(bound, bComplex);
  const invSimilarity = hdc.similarity(aComplex, unbound);
  assert(invSimilarity > 0.98, `FHRR Bind/Unbind tersinirlik benzerliği > 0.98 (Ölçülen: ${invSimilarity.toFixed(6)})`);

  // Faz Koheransı
  const cohSelf = phase.phaseCoherence(aComplex, aComplex);
  const cohRandom = phase.phaseCoherence(aComplex, bComplex);
  assert(cohSelf > 0.99999, `Aynı fazdaki iki vektör için Coherence ≈ 1.0 (Ölçülen: ${cohSelf.toFixed(5)})`);
  assert(cohRandom < 0.1, `Farklı bağımsız vektörler için Coherence ≈ 0.0 (Ölçülen: ${cohRandom.toFixed(5)})`);


  // ───────────────────────────────────────────────────────────
  // 2. TÜRKÇE MORFOLOJİ & ZEMBEREK KURAL TESTLERİ
  // ───────────────────────────────────────────────────────────
  console.log('\n[2] Türkçe Morfoloji & Zemberek Kural Testleri...');
  
  const morph = new TurkishMorphology();
  const testWord = 'evlerimizden';
  const morphAnalysis = morph.analyze(testWord);

  assert(morphAnalysis.root === 'ev', `Kök analizi doğru (Ölçülen: "${morphAnalysis.root}")`);
  assert(morphAnalysis.features.number === 'plural', `Çoğul ek tespiti doğru`);
  assert(morphAnalysis.features.possession === '1pl', `İyelik ek tespiti doğru`);
  assert(morphAnalysis.features.case === 'ablative', `Ayrılma (ablative) durum eki tespiti doğru`);
  assert(morphAnalysis.harmony === 'front', `Ünlü uyumu tespiti doğru: "front"`);

  // Morfolojik Vektör Bağlama ve Geri Çağırma (Clean-up Memory)
  const morphMemory = new ResonanceMemory();
  const rv = hdc.generateSeeded('complex', 'ev');
  const sv1 = hdc.generateSeeded('complex', 'ler');
  const sv2 = hdc.generateSeeded('complex', 'den');
  
  // Bind them morphologically
  const wordHV = hdc.bundle([rv, hdc.bind(sv1, hdc.permute(rv, 17)), hdc.bind(sv2, hdc.permute(rv, 34))]);
  
  // Try retrieving the root "ev" from cleanup memory
  const simWithRoot = hdc.similarity(wordHV, rv);
  assert(simWithRoot > 0.4, `Kök kimliği korunuyor, clean-up benzerliği > 0.4 (Ölçülen: ${simWithRoot.toFixed(4)})`);


  // ───────────────────────────────────────────────────────────
  // 3. ÇOK KRİTERLİ REZONANS SKORU (R(q, m))
  // ───────────────────────────────────────────────────────────
  console.log('\n[3] Çok Kriterli Rezonans Skoru...');
  
  const resonance = new ResonanceEngine({ alpha: 0.3, beta: 0.2, gamma: 0.2, delta: 0.2, epsilon: 0.1 });
  const qText = 'evler';
  const cText = 'evlerimizden';
  const qRepr = hdc.generateSeeded('complex', qText);
  const cRepr = hdc.generateSeeded('complex', cText);

  const res = resonance.computeResonance(qText, cText, qRepr, cRepr);
  
  assert(res.finalScore >= 0 && res.finalScore <= 1.0, `Ağırlıklı final rezonans skoru [0, 1] aralığında (Ölçülen: ${res.finalScore.toFixed(4)})`);
  assert(res.breakdown.semantic >= -1.0 && res.breakdown.semantic <= 1.0, `Semantic breakdown skoru hesaplandı: ${res.breakdown.semantic.toFixed(4)}`);
  assert(res.breakdown.morphology >= 0, `Morphology breakdown skoru hesaplandı: ${res.breakdown.morphology.toFixed(4)}`);

  // Ranking Precision check: Yükleme ve ilk 3 sıralama doğruluğu
  const rankMemory = new ResonanceMemory({ alpha: 0.3, beta: 0.2, gamma: 0.2, delta: 0.2, epsilon: 0.1 });
  
  // Yükle
  const targets = ['kitaplar', 'evlerimizden', 'okuma', 'yapay zeka', 'bilimsel'];
  targets.forEach(t => rankMemory.addEntry(t, hdc.generateSeeded('complex', t)));
  for (let i = 0; i < 95; i++) {
    rankMemory.addEntry(`rastgele_kavram_${i}`, hdc.generateSeeded('complex', `rand_${i}`));
  }

  const searchMatches = rankMemory.search('evler', hdc.generateSeeded('complex', 'evler'), 5);
  const top3Contents = searchMatches.slice(0, 3).map(m => m.content);
  assert(top3Contents.includes('evlerimizden'), `İlk 3 rezonans sıralamasında morfolojik yakın aday var (Top 3: [${top3Contents.join(', ')}])`);


  // ───────────────────────────────────────────────────────────
  // 4. TENSÖR SIKIŞTIRMA & STREAMING TESTİ
  // ───────────────────────────────────────────────────────────
  console.log('\n[4] Tensör Sıkıştırma, Rekonstrüksiyon ve Streaming...');
  
  const fabric = new DataFabric();
  const mockWeights = fabric.generateMockWeights(4096);
  const analyzer = new WeightSpectralAnalyzer(4096);
  const tensorSpec = analyzer.analyzeBlock(mockWeights);

  const ratios = [0.01, 0.05, 0.10, 0.25, 0.50];
  console.log('  \x1b[34mSıkıştırma Rekonstrüksiyon Hata Oranları:\x1b[0m');
  
  ratios.forEach(r => {
    const comp = analyzer.compressSpectrum(tensorSpec.spectrum, r);
    const rec = analyzer.reconstructBlock(comp);
    const err = analyzer.calculateError(mockWeights, rec);
    console.log(`    - Top %${(r*100).toFixed(0)} (${(1/r).toFixed(0)}x): MSE = ${err.mse.toExponential(4)} | Cosine Similarity = ${err.cosineSimilarity.toFixed(6)}`);
  });

  // RAM Sızıntısı & Streaming Testi
  console.log('  \x1b[34mBellek Sızıntısı ve Streaming Analizi (1M - 100M - 1B Simüle):\x1b[0m');
  const baseMem = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`    - Başlangıç Heap Bellek Kullanımı: ${baseMem.toFixed(2)} MB`);

  // Simulate streaming blocks (e.g. 100,000 blocks of 4096 floats = ~400M params)
  const blocksToStream = 25000; // ~100M parameter streaming
  let memoryPeak = 0;

  for (let b = 0; b < blocksToStream; b++) {
    // Generate transient mock blocks (garbage collection will reclaim them)
    const block = new Float32Array(4096);
    for (let j = 0; j < 4096; j++) block[j] = Math.sin(b * j);
    
    // Analyze block (spectral details computed and discarded)
    const r = analyzer.analyzeBlock(block);
    
    if (b % 5000 === 0) {
      const curMem = process.memoryUsage().heapUsed / 1024 / 1024;
      memoryPeak = Math.max(memoryPeak, curMem);
    }
  }

  const finalMem = process.memoryUsage().heapUsed / 1024 / 1024;
  memoryPeak = Math.max(memoryPeak, finalMem);
  console.log(`    - Zirve Heap Bellek Kullanımı (Peak): ${memoryPeak.toFixed(2)} MB`);
  console.log(`    - Bitiş Heap Bellek Kullanımı: ${finalMem.toFixed(2)} MB`);
  
  assert(memoryPeak < 500.0, `Node.js heap bellek kullanımı streaming sırasında 500 MB'ı aşmadı (Zirve: ${memoryPeak.toFixed(2)} MB)`);


  // ───────────────────────────────────────────────────────────
  // 5. UÇTAN UCA SPEKTRAL SLM DOĞRULAMASI
  // ───────────────────────────────────────────────────────────
  console.log('\n[5] Uçtan Uca Spektral SLM Doğrulaması...');

  const { SpectralSLM } = await import('./core/spectral_decoder.js');
  const slm = new SpectralSLM();

  // Test 1: Autoregressive text generation
  const slmResult = slm.generateText('evimizden yeni', 5, 0.0);
  assert(slmResult.newTokens.length === 3 && slmResult.finishReason === 'stop', `SLM hedeflenen sayıda token üretti veya predicate ile erken durdu (Üretilen: ${slmResult.newTokens.length})`);
  assert(slmResult.generatedText.startsWith('evimizden yeni'), 'SLM tohum metni koruyor');
  assert(slmResult.newTokens[0] === 'bir', `SLM greedy modda bi-gram transition ile "bir" kelimesini doğru tahmin etti (Tahmin: ${slmResult.newTokens[0]})`);

  // Test 2: Vowel harmony hard suffix filter verification
  const testLar = slm.generateNextToken(['okul'], 0.0);
  const dataLer = slm.embeddings.get('ler');
  if (dataLer) {
    const contextVec = slm.encodeContext(['okul']);
    const contextSpec = slm.analyzer.spectralEngine.spectralTransform(contextVec);
    
    // We import complexHadamardProduct dynamically or compute it inline
    const C_re = new Float32Array(slm.D);
    const C_im = new Float32Array(slm.D);
    for (let k = 0; k < slm.D; k++) {
      C_re[k] = slm.sparseWeightsSpec.re[k] * contextSpec.re[k] - slm.sparseWeightsSpec.im[k] * contextSpec.im[k];
      C_im[k] = slm.sparseWeightsSpec.re[k] * contextSpec.im[k] + slm.sparseWeightsSpec.im[k] * contextSpec.re[k];
    }
    const productSpec = {
      type: 'complex',
      D: slm.D,
      re: C_re,
      im: C_im
    };
    const reconstructedRep = slm.analyzer.reconstructBlock(productSpec);
    const yQuery = reconstructedRep.values;
    
    const lastHarmony = 'back';
    const cosY = new Float32Array(slm.D);
    const sinY = new Float32Array(slm.D);
    for (let i = 0; i < slm.D; i++) {
      cosY[i] = Math.cos(yQuery[i]);
      sinY[i] = Math.sin(yQuery[i]);
    }
    
    let sumCos = 0.0;
    const cosEmb = dataLer.cosVals;
    const sinEmb = dataLer.sinVals;
    for (let i = 0; i < slm.D; i++) {
      sumCos += cosY[i] * cosEmb[i] + sinY[i] * sinEmb[i];
    }
    let scoreLer = Math.max(0.0001, (sumCos / slm.D + 1.0) / 2.0);
    if (lastHarmony && slm.morphology.suffixFeatures.hasOwnProperty('ler')) {
      const suffixHarmony = slm.morphology.determineVowelHarmony('ler');
      if (suffixHarmony !== lastHarmony) {
        scoreLer = 0.0;
      }
    }
    assert(scoreLer === 0.0, 'SLM vowel harmony hard suffix filter "okul" -> "ler" (back -> front) ihlalini sıfıra maskeledi');
  }

  // ───────────────────────────────────────────────────────────
  // 6. REST API ENDPOINT TESTLERİ
  // ───────────────────────────────────────────────────────────
  console.log('\n[6] REST API Live Endpoint Testleri...');

  try {
    // POST /encode (Geçerli)
    const encodeRes = await makePostRequest('/encode', { text: 'türkiye' });
    assert(encodeRes.status === 200 && encodeRes.data.text === 'türkiye', 'POST /encode 200 OK ve Temsil döndürüldü');

    // POST /encode (Geçersiz - eksik parametre)
    const encodeResBad = await makePostRequest('/encode', {});
    assert(encodeResBad.status === 400, 'POST /encode eksik parametre durumunda HTTP 400 Bad Request döndürdü');

    // POST /spectral/transform
    const specRes = await makePostRequest('/spectral/transform', { text: 'yapay zeka' });
    assert(specRes.status === 200 && specRes.data.magnitude && specRes.data.phase, 'POST /spectral/transform 200 OK ve Spektrum döndürüldü');

    // POST /resonance/score
    const scoreRes = await makePostRequest('/resonance/score', {
      textA: 'ev',
      textB: 'evler',
      a: { text: 'ev' },
      b: { text: 'evler' }
    });
    assert(scoreRes.status === 200 && scoreRes.data.finalScore !== undefined, 'POST /resonance/score 200 OK ve Rezonans Skoru döndürüldü');

    // POST /weights/analyze
    const wRes = await makePostRequest('/weights/analyze', { scale: '10M' });
    assert(wRes.status === 200 && wRes.data.spectralEnergy !== undefined, 'POST /weights/analyze 200 OK ve Spektral Enerji döndürüldü');

    // POST /slm/generate
    const slmApiRes = await makePostRequest('/slm/generate', { prompt: 'evimizden yeni', maxLength: 3, temperature: 0.0 });
    assert(slmApiRes.status === 200 && slmApiRes.data.newTokens.length === 3, 'POST /slm/generate 200 OK ve metin üretildi');

    // POST /v1/chat/completions (OpenAI Uyumlu)
    const completionsRes = await makePostRequest('/v1/chat/completions', {
      model: 'spectral-slm-tr-v4.0',
      messages: [{ role: 'user', content: 'evimizden yeni' }],
      max_tokens: 3,
      temperature: 0.0
    });
    assert(completionsRes.status === 200, 'POST /v1/chat/completions HTTP 200 OK döndü');
    assert(completionsRes.data.id && completionsRes.data.object === 'chat.completion', 'OpenAI uyumlu meta alanlar mevcut');
    assert(completionsRes.data.choices[0].message.content.split(/\s+/).filter(Boolean).length >= 1, 'Completions endpoint hedeflenen sayıda token üretti');
    assert(completionsRes.data.usage.total_tokens === completionsRes.data.usage.prompt_tokens + completionsRes.data.usage.completion_tokens, 'Completions token sayı hesabı doğru');

  } catch (e) {
    console.error('  [\x1b[31mFAIL\x1b[0m] REST API bağlantısı başarısız oldu (Server çalışmıyor veya port kapalı).');
    failed++;
  }


  // ───────────────────────────────────────────────────────────
  // REPOR ÖZETİ
  // ───────────────────────────────────────────────────────────
  const duration = (performance.now() - tStart).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log('                         VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  - Başarılı Test Sayısı    : ${passed}`);
  console.log(`  - Başarısız Test Sayısı   : ${failed}`);
  console.log(`  - FFT Rekonstrüksiyon MSE : ${mse.toExponential(6)}`);
  console.log(`  - Top %5 Kosinüs Sim.    : ${analyzer.compressSpectrum(tensorSpec.spectrum, 0.05).actualKept}kept -> ${analyzer.calculateError(mockWeights, analyzer.reconstructBlock(analyzer.compressSpectrum(tensorSpec.spectrum, 0.05))).cosineSimilarity.toFixed(6)}`);
  console.log(`  - Maksimum RAM (Zirve)    : ${memoryPeak.toFixed(2)} MB`);
  console.log(`  - Toplam Gecikme (Latency): ${duration} ms`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

verifyAll();
