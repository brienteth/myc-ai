/**
 * Resonance SDK v1.0 - B2B Commercial Edge AI Engine
 * Unified SDK interface wrapping the Turkish Resonance AI Core (v5.2).
 * Supports both Browser (fetch/streaming) and Node.js environments.
 * 
 * @license Commercial - Per-device licensing
 * @author Turkish Resonance AI Core Team
 */

import { TurkishMorphology } from '../core/morphology.js';
import { HDCEngine, Representation } from '../core/hdc.js';
import { MemoryEngine } from '../core/memory_engine.js';
import { ReasoningRouter } from '../core/reasoning_router.js';
import { SovereignAgent } from '../core/sovereign_agent.js';
import { SpectralEngine } from '../core/spectral.js';


// Suffix derivation generator for expanding vocabulary with Turkish grammatical rules
function generateDerivations(root, morphology) {
  const harmony = morphology.determineVowelHarmony(root);
  const lastChar = root[root.length - 1];
  const isVowel = morphology.allVowels.has(lastChar);
  const derivations = [root];
  const hardConsonants = new Set(['t', 'k', 'ç', 'p', 's', 'ş', 'h', 'f']);
  const isHard = hardConsonants.has(lastChar);

  // Helper to mutate root ending with p, ç, t, k when appending a vowel-starting suffix
  const mutateRoot = (r, suffix) => {
    if (!suffix) return r;
    const startsWithVowel = morphology.allVowels.has(suffix[0]);
    if (startsWithVowel) {
      const last = r[r.length - 1];
      let mutated = r.slice(0, -1);
      if (last === 'p') return mutated + 'b' + suffix;
      if (last === 'ç') return mutated + 'c' + suffix;
      if (last === 't') return mutated + 'd' + suffix;
      if (last === 'k') {
        // e.g., renk -> rengi (g), but bebek -> bebeği (ğ)
        if (r === 'renk') return mutated + 'g' + suffix;
        return mutated + 'ğ' + suffix;
      }
    }
    return r + suffix;
  };

  if (harmony === 'front') {
    derivations.push(root + 'ler');
    derivations.push(isVowel ? root + 'nin' : mutateRoot(root, 'in'));
    derivations.push(isVowel ? root + 'ye' : mutateRoot(root, 'e'));
    derivations.push(isVowel ? root + 'yi' : mutateRoot(root, 'i'));
    derivations.push(root + (isHard ? 'te' : 'de'));
    derivations.push(root + (isHard ? 'ten' : 'den'));
    derivations.push(isVowel ? root + 'm' : mutateRoot(root, 'im'));
  } else {
    derivations.push(root + 'lar');
    derivations.push(isVowel ? root + 'nın' : mutateRoot(root, 'ın'));
    derivations.push(isVowel ? root + 'ya' : mutateRoot(root, 'a'));
    derivations.push(isVowel ? root + 'yı' : mutateRoot(root, 'ı'));
    derivations.push(root + (isHard ? 'ta' : 'da'));
    derivations.push(root + (isHard ? 'tan' : 'dan'));
    derivations.push(isVowel ? root + 'm' : mutateRoot(root, 'ım'));
  }
  return derivations;
}

export class ResonanceSDK {
  /**
   * @param {Object} config - SDK configuration
   * @param {number} [config.D=4096] - Hyperdimensional vector dimension
   * @param {number} [config.temperature=0.7] - Default sampling temperature
   * @param {number} [config.maxLength=10] - Default max generation length
   */
  constructor(config = {}) {
    this.D = config.D || 4096;
    this.hdc = new HDCEngine(this.D);
    this.morphology = new TurkishMorphology();
    this.spectral = new SpectralEngine();
    this.memory = new MemoryEngine(config.memory || {});
    this.router = new ReasoningRouter(this.memory, this);

    this.temperature = config.temperature !== undefined ? config.temperature : 0.7;
    this.maxLength = config.maxLength || 10;

    this.vocab = [];
    this.vocabMap = new Map();
    this.embeddings = new Map();
    this.wordCounts = new Map();
    this.freqIndices = [];
    this.wordDerivationIndices = new Map();
    this.transitionCounts = new Map();
    this.sparseWeightsSpec = null;

    this.wasmInstance = null;
    this.wasmMemory = null;
    this.vocabCosPtr = 0;
    this.vocabSinPtr = 0;
    this.scoresPtr = 0;
    this.candidateIndicesPtr = 0;

    this._initialized = false;
    this._runtime = typeof window !== 'undefined' ? 'browser' : 'node';
  }

  // ── PUBLIC API ──────────────────────────────────────────────

  /**
   * Initialize the SDK. Must be called before generate() or analyze().
   * @param {Object} [options]
   * @param {ArrayBuffer} [options.wasmBinary] - Pre-loaded WASM binary buffer
   * @param {string} [options.wasmUrl] - URL to fetch WASM (browser mode)
   * @param {string} [options.wasmPath] - File path to WASM (Node.js mode)
   * @param {string} [options.corpusUrl] - URL to tr_corpus_embed.js (browser mode)
   * @param {string} [options.corpusPath] - File path to tr_corpus_embed.js (Node.js mode)
   */
  async init(options = {}) {
    if (this._initialized) return;

    // 1. Load WASM core
    await this._loadWasm(options);

    // 2. Build vocabulary, embeddings, and transition model
    await this._buildVocabulary(options);

    this._initialized = true;
  }

  /**
   * Generate text autoregressively from a prompt.
   * @param {string} prompt - Input Turkish text prompt
   * @param {Object} [options]
   * @param {number} [options.maxLength] - Override default max tokens
   * @param {number} [options.temperature] - Override default temperature
   * @param {function} [options.onToken] - Streaming callback: (word, step) => void
   * @returns {Object} { prompt, generatedText, newTokens, steps, totalLatencyMs, finishReason, vocabSize }
   */
  generate(prompt, options = {}) {
    this._assertInit();

    const maxLen = options.maxLength || this.maxLength;
    const temp = options.temperature !== undefined ? options.temperature : this.temperature;
    const onToken = options.onToken || null;

    const cleanPrompt = this.morphology.normalize(prompt);
    const tokens = cleanPrompt.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) tokens.push('ev');

    const promptLength = tokens.length;
    const steps = [];
    let stopReason = 'length';
    const startTime = performance.now();

    for (let step = 0; step < maxLen; step++) {
      const stepStart = performance.now();
      const nextObj = this._predictNext(tokens, temp, promptLength);
      const stepEnd = performance.now();

      tokens.push(nextObj.word);
      const stepInfo = { word: nextObj.word, score: nextObj.score, latencyMs: stepEnd - stepStart };
      steps.push(stepInfo);

      if (onToken) onToken(nextObj.word, stepInfo);

      // Predicate early stopping
      if (this._isTerminal(nextObj.word)) { stopReason = 'stop'; break; }

      // Repetition guard
      if (tokens.length > promptLength + 2 && tokens.slice(-3).every(v => v === tokens[tokens.length - 1])) {
        stopReason = 'stop'; break;
      }
    }

    return {
      prompt,
      generatedText: tokens.join(' '),
      newTokens: tokens.slice(promptLength),
      steps,
      totalLatencyMs: performance.now() - startTime,
      finishReason: stopReason,
      vocabSize: this.vocab.length
    };
  }

  /**
   * Analyze Turkish word morphology.
   * @param {string} word - Turkish word to analyze
   * @returns {Object} { word, root, suffixes, morphemes, harmony, syllables }
   */
  analyze(word) {
    return this.morphology.analyze(word);
  }

  /**
   * Get SDK runtime metrics.
   * @returns {Object} { runtime, vocabSize, dimension, wasmActive, initialized }
   */
  getMetrics() {
    return {
      runtime: this._runtime,
      vocabSize: this.vocab.length,
      dimension: this.D,
      wasmActive: this.wasmInstance !== null,
      initialized: this._initialized
    };
  }

  /**
   * Instantiate an autonomous SovereignAgent.
   * @returns {SovereignAgent}
   */
  createAgent() {
    return new SovereignAgent(this);
  }

  // ── PRIVATE: WASM LOADER ───────────────────────────────────

  async _loadWasm(options) {
    const imports = { env: { cosf: Math.cos, sinf: Math.sin, atan2f: Math.atan2, expf: Math.exp, sqrtf: Math.sqrt } };
    try {
      if (options.wasmBinary) {
        const mod = new WebAssembly.Module(options.wasmBinary);
        this.wasmInstance = new WebAssembly.Instance(mod, imports);
        this.wasmMemory = this.wasmInstance.exports.memory;
      } else if (this._runtime === 'browser') {
        const url = options.wasmUrl || '../wasm/spectral_core.wasm';
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const mod = new WebAssembly.Module(buf);
        this.wasmInstance = new WebAssembly.Instance(mod, imports);
        this.wasmMemory = this.wasmInstance.exports.memory;
      } else {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const wasmPath = options.wasmPath || path.join(__dirname, '..', 'wasm', 'spectral_core.wasm');
        if (fs.existsSync(wasmPath)) {
          const buf = fs.readFileSync(wasmPath);
          const mod = new WebAssembly.Module(buf);
          this.wasmInstance = new WebAssembly.Instance(mod, imports);
          this.wasmMemory = this.wasmInstance.exports.memory;
        }
      }
    } catch (e) {
      console.warn('ResonanceSDK: WASM load failed, Pure JS fallback active.', e.message);
    }
  }

  // ── PRIVATE: VOCABULARY BUILDER ────────────────────────────

  async _buildVocabulary(options) {
    // Training corpus (embedded for zero-dependency deployment)
    const corpus = [
      // ── Orijinal genel corpus ──
      "evimizden yeni çıktık", "yeni bir kitap aldım",
      "bilimsel araştırmalar yapay zeka ile hızlandı", "güzel bir gün başladı",
      "iyi bir insan olmak önemlidir", "türkçe dil yapısı çok zengindir",
      "yapay zeka insan beyni gibi çalışır", "öğrenmek ve düşünmek zihni geliştirir",
      "büyük bir adım attık", "yeni projeler üzerinde çalışıyoruz",
      "okuma alışkanlığı kazanmak önemlidir", "bilim ve teknik dünyayı değiştiriyor",
      "evimizden okula kadar yürüdük", "yapay zeka dil modelleri üzerine kuruludur",
      "yeni bir dünya bizi bekliyor", "kitaplar en iyi arkadaştır",
      "güzel bir gelecek inşa ediyoruz", "iyi bir eğitim almak önemlidir",
      "türkçe konuşmak ve yazmak çok güzel", "bilimsel gerçekler her zaman kazanır",
      "yapay sinir ağları karmaşık modellerdir", "beyin ve zihin araştırmaları sürüyor",
      "evimizden yeni bir yola çıktık", "yeni bir başlangıç yapmak iyidir",
      "bilimsel okuma yapmak zihni açar", "okuma yapmak insanı geliştirir",
      "evimizden çıktık ve okula gittik", "yeni bir güne uyandık",
      "bilim insanları yapay zeka geliştiriyor", "türkçe dil bilgisi kuralları önemlidir",
      "evimizden okula gittik yeni bir kitap aldık",
      "televizyonu açıp haberleri izledik", "arabaya binip okula gittik",
      "bilgisayarı kapatıp uyudum", "bilgisayarı kapatıp yattım",
      "yazılım mühendisleri yapay zeka modelleri üzerine araştırma yapıyor",
      "bilgi teknolojileri ve veri analizi iş süreçlerini kolaylaştırır",
      "sağlıklı beslenme ve spor yapmak yaşam kalitesini artırır",
      "doğal yaşamı ve çevreyi korumak hepimizin sorumluluğundadır",
      "sanat ve edebiyat toplumun kültürel zenginliğini besler ve geliştirir",
      "eğitim sistemi yeni nesillerin geleceğini ve başarısını belirler",
      "bilgisayar ağları veri güvenliği ve hızlı bilgi akışı sağlar",
      // ── Selamlama ve bağlam kurma ──
      "merhaba size nasıl yardımcı olabilirim",
      "günaydın bugün size nasıl yardımcı olayım",
      "iyi günler lütfen sorunuzu belirtin",
      "hoş geldiniz nasıl yardımcı olabilirim",
      "merhaba buyurun nasıl yardımcı olayım",
      "iyi akşamlar size nasıl yardımcı olabilirim",
      // ── Hasta kaydı kalıpları ──
      "hasta kaydı oluşturuldu",
      "kayıt sisteme başarıyla eklendi",
      "hastanın bilgileri güncellendi",
      "bu hasta daha önce kayıt edilmemiş",
      "hastanın adı ve yaşı kaydedildi",
      "hasta bilgileri sisteme girildi",
      "yeni hasta kaydı açıldı",
      "hasta şikayeti sisteme işlendi",
      "kayıt başarıyla güncellendi",
      "hastanın geçmiş kayıtları bulundu",
      "bu hasta için kayıt bulunamadı",
      "hastanın durumu kaydedildi",
      // ── Belirsizlik ve yönlendirme ──
      "bu soruyu yanıtlayacak bilgiye sahip değilim",
      "bu konuda bilgim yok başka bir soru sorabilirsiniz",
      "lütfen daha fazla bilgi verir misiniz",
      "hangi hastayı soruyorsunuz",
      "bu bilgi hafızada bulunamadı",
      "henüz bu konuda kayıt yok",
      "bu işlemi yapabilmem için daha fazla bilgiye ihtiyacım var",
      "maalesef bu konuda yardımcı olamıyorum",
      // ── Sağlık domain kalıpları ──
      "hastanın şikayeti baş ağrısı ve tansiyon yüksekliği",
      "kan basıncı değeri yüz kırk bölü doksan olarak ölçüldü",
      "ilaç dozu hesaplandı ve reçeteye yazıldı",
      "risk durumu yüksek riskli olarak işaretlendi",
      "hastanın kan şekeri yüz seksen olarak ölçüldü",
      "diyabet hastası olarak kayıt edildi",
      "gebelik takibi için kontrol randevusu oluşturuldu",
      "hastanın ateşi otuz sekiz derece ölçüldü",
      "tansiyon ölçümü yapıldı ve kaydedildi",
      "ilaçlardan hangisinin verilmesi gerektiği belirlendi",
      "doktorlarımızdan birini çağırabilir misiniz",
      "hastanın ayaklarından birinde şişlik tespit edildi",
      "kan grubu belirlenmesi için tahlil istendi",
      "hastaya günde üç kez ilaç verilecek",
      "haftalık toplam doz hesaplandı",
      "ameliyat öncesi hazırlıklar tamamlandı",
      "hastanın nabzı ve tansiyonu normal sınırlarda",
      "tedavi planı oluşturuldu ve hastaya bildirildi",
      "aşı takvimi kontrol edildi",
      "acil müdahale gerekli değil hasta stabil",
      // ── Çelişki ve doğrulama ──
      "kayıtlarda çelişen bilgi tespit edildi",
      "lütfen doğru bilgiyi belirtin",
      "iki farklı kayıt bulundu hangisi doğru",
      "bu bilgi önceki kayıtla çelişiyor",
      "çelişen kayıtlar kullanıcıya sunuldu",
      // ── Morfoloji zenginleştirme ──
      "evlerimizden geliyoruz hasta getirdik",
      "hastanın ayaklarından birinde şişlik var",
      "ilaçlardan hangisini vermemiz gerekiyor",
      "doktorlarımızdan birini çağırabilir misiniz",
      "bu hastalıklardan kurtulabilir mi",
      "köylerden gelen hastalar muayene edildi",
      "çocukların aşıları yapıldı",
      "hastaların kayıtları güncellendi"
    ];

    // Load external corpus roots
    let initialVocab = [];
    try {
      if (this._runtime === 'browser') {
        const url = options.corpusUrl || '../tr_corpus_embed.js';
        const res = await fetch(url);
        const txt = await res.text();
        const m = txt.match(/const TR_CORPUS_ROOTS\s*=\s*(\[[\s\S]*?\]);/);
        if (m) initialVocab = JSON.parse(m[1]);
      } else {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const corpusPath = options.corpusPath || path.join(__dirname, '..', 'tr_corpus_embed.js');
        if (fs.existsSync(corpusPath)) {
          const txt = fs.readFileSync(corpusPath, 'utf8');
          const m = txt.match(/const TR_CORPUS_ROOTS\s*=\s*(\[[\s\S]*?\]);/);
          if (m) initialVocab = JSON.parse(m[1]);
        }
      }
    } catch (e) { /* fallback to embedded corpus */ }

    const turkishRe = /^[a-zçgğıoöşuüâîû]+$/;
    const words = new Set(['ev', 'yeni', 'bir', 'kitap', 'okul', 'çıktık', 'aldım', 'güzel',
      'iyi', 'yapay', 'zeka', 'bilimsel', 'okuma', 'öğrenmek', 'dil', 'türkçe', 'insan',
      'olmak', 'önemlidir', 'geliştirir', 'değiştiriyor', 'yürüdük', 'gittik', 'yola',
      'başlangıç', 'güne', 'uyandık', 'kuruludur', 'televizyonu', 'açıp', 'izledik',
      'izledim', 'arabaya', 'binip', 'bilgisayarı', 'kapatıp', 'uyudum', 'yattım']);

    // Build word counts from corpus
    this.wordCounts.clear();
    for (const s of corpus) {
      for (const w of s.split(/\s+/)) {
        const c = w.trim().toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '');
        if (c.length >= 2 && turkishRe.test(c)) {
          this.wordCounts.set(c, (this.wordCounts.get(c) || 0) + 1);
        }
      }
    }
    for (const [w, cnt] of this.wordCounts) { if (cnt >= 2) words.add(w); }

    // Morphological expansion: 5000 roots -> 50.000+ words
    for (const w of initialVocab) {
      const c = w.trim().toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '');
      if (c.length >= 2 && turkishRe.test(c)) {
        for (const d of generateDerivations(c, this.morphology)) words.add(d);
      }
    }

    // Assemble vocabulary with <unk> safety token at index 0
    this.vocab = ['<unk>', ...Array.from(words)];
    this.vocabMap.clear();
    for (let i = 0; i < this.vocab.length; i++) this.vocabMap.set(this.vocab[i], i);

    // Precompute top-15 frequent word indices
    this.freqIndices = this.vocab
      .map((w, idx) => ({ w, idx }))
      .sort((a, b) => (this.wordCounts.get(b.w) || 0) - (this.wordCounts.get(a.w) || 0))
      .slice(0, 15).map(x => x.idx);

    // Precompute derivation index map
    this.wordDerivationIndices.clear();
    for (const root of this.vocab) {
      const indices = [];
      for (const d of generateDerivations(root, this.morphology)) {
        const idx = this.vocabMap.get(d);
        if (idx !== undefined) indices.push(idx);
      }
      this.wordDerivationIndices.set(root, indices);
    }

    // Generate FHRR embeddings
    for (const word of this.vocab) {
      const emb = this.hdc.generateSeeded('complex', word);
      emb.values = new Float32Array(emb.values);
      const cos = new Float32Array(this.D);
      const sin = new Float32Array(this.D);
      for (let i = 0; i < this.D; i++) {
        cos[i] = Math.cos(emb.values[i]);
        sin[i] = Math.sin(emb.values[i]);
      }
      this.embeddings.set(word, { emb, cosVals: cos, sinVals: sin });
    }

    // Write to WASM memory
    if (this.wasmInstance) {
      const V = this.vocab.length, DD = this.D;
      this.vocabCosPtr = this.wasmInstance.exports.malloc(V * DD * 4);
      this.vocabSinPtr = this.wasmInstance.exports.malloc(V * DD * 4);
      this.scoresPtr = this.wasmInstance.exports.malloc(V * 4);
      
      this.transIndicesPtr = this.wasmInstance.exports.malloc(64 * 4);
      this.transMultipliersPtr = this.wasmInstance.exports.malloc(64 * 4);
      this.topIndicesPtr = this.wasmInstance.exports.malloc(5 * 4);
      this.topScoresPtr = this.wasmInstance.exports.malloc(5 * 4);
      this.candidateIndicesPtr = this.wasmInstance.exports.malloc(1024 * 4);

      if (this.vocabCosPtr && this.vocabSinPtr && this.scoresPtr &&
          this.transIndicesPtr && this.transMultipliersPtr &&
          this.topIndicesPtr && this.topScoresPtr && this.candidateIndicesPtr) {
        const mem = this.wasmMemory.buffer;
        const cosView = new Float32Array(mem, this.vocabCosPtr, V * DD);
        const sinView = new Float32Array(mem, this.vocabSinPtr, V * DD);
        for (let v = 0; v < V; v++) {
          const data = this.embeddings.get(this.vocab[v]);
          cosView.set(data.cosVals, v * DD);
          sinView.set(data.sinVals, v * DD);
        }
      } else {
        console.warn('ResonanceSDK: WASM malloc failed, falling back to Pure JS.');
        this.wasmInstance = null;
      }
    }

    // Build bi-gram transition model
    this.transitionCounts = new Map();
    const re = new Float32Array(this.D), im = new Float32Array(this.D);
    let tCount = 0;
    for (const s of corpus) {
      const ws = s.split(/\s+/).map(w => w.trim().toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '')).filter(w => w.length >= 2);
      for (let i = 0; i < ws.length - 1; i++) {
        const w1 = ws[i], w2 = ws[i + 1];
        if (!this.transitionCounts.has(w1)) this.transitionCounts.set(w1, new Map());
        this.transitionCounts.get(w1).set(w2, (this.transitionCounts.get(w1).get(w2) || 0) + 1);

        const d1 = this.embeddings.get(w1), d2 = this.embeddings.get(w2);
        if (d1 && d2) {
          const wt = 1.0 / Math.sqrt(this.wordCounts.get(w2) || 1);
          for (let j = 0; j < this.D; j++) {
            let diff = d2.emb.values[j] - d1.emb.values[j];
            if (diff < 0) diff += 2 * Math.PI;
            re[j] += wt * Math.cos(diff % (2 * Math.PI));
            im[j] += wt * Math.sin(diff % (2 * Math.PI));
          }
          tCount++;
        }
      }
    }

    // Bundle transition phase differences
    if (tCount > 0) {
      const vals = new Float32Array(this.D);
      for (let j = 0; j < this.D; j++) {
        let v = Math.atan2(im[j], re[j]);
        if (v < 0) v += 2 * Math.PI;
        vals[j] = v;
      }
      this.sparseWeightsSpec = new Representation('complex', vals, this.D);
    } else {
      this.sparseWeightsSpec = this.hdc.generateSeeded('complex', 'fallback_transitions');
    }

    // Write transition spectrum to WASM
    if (this.wasmInstance && this.sparseWeightsSpec) {
      const mem = this.wasmMemory.buffer;
      const trRe = new Float32Array(mem, this.wasmInstance.exports.get_transition_spec_re_ptr(), this.D);
      const trIm = new Float32Array(mem, this.wasmInstance.exports.get_transition_spec_im_ptr(), this.D);
      for (let j = 0; j < this.D; j++) {
        trRe[j] = Math.cos(this.sparseWeightsSpec.values[j]);
        trIm[j] = Math.sin(this.sparseWeightsSpec.values[j]);
      }
    }
  }

  _predictNext(tokens, temperature, promptLength) {
    if (this.wasmInstance && this.wasmMemory) {
      return this._predictWasm(tokens, temperature, promptLength);
    }
    return this._predictJS(tokens, temperature, promptLength);
  }

  _predictWasm(tokens, temperature, promptLength) {
    const mem = this.wasmMemory.buffer;
    const ctxPtr = this.wasmInstance.exports.get_context_angles_ptr();
    const ctxView = new Float32Array(mem, ctxPtr, this.D);

    // 1. Context combination zero-copy
    if (promptLength > 0 && tokens.length > promptLength) {
      let pIdx = this.vocabMap.get(tokens[promptLength - 1]) ?? 0;
      let gIdx = this.vocabMap.get(tokens[tokens.length - 1]) ?? 0;
      this.wasmInstance.exports.combine_phases_by_indices(
        pIdx, 0.4, gIdx, 0.6, this.vocabCosPtr, this.vocabSinPtr, ctxPtr
      );
    } else {
      const lastData = this.embeddings.get(tokens[tokens.length - 1]) || this.embeddings.get('<unk>');
      ctxView.set(lastData.emb.values);
    }

    // 2. Forward FFT & Spectral prediction
    this.wasmInstance.exports.spectral_predict();

    // 3. Candidate building
    const candView = new Int32Array(mem, this.candidateIndicesPtr, 1024);
    const freqLen = this.freqIndices.length;
    for (let i = 0; i < freqLen; i++) {
      candView[i] = this.freqIndices[i];
    }
    let numCandidates = freqLen;

    for (let i = 0; i < promptLength; i++) {
      const idx = this.vocabMap.get(tokens[i]);
      if (idx !== undefined && numCandidates < 1024) {
        candView[numCandidates++] = idx;
      }
    }

    const lastToken = tokens[tokens.length - 1];
    let numTransitions = -1;

    if (lastToken) {
      const m = this.transitionCounts.get(lastToken);
      if (!m) {
        numTransitions = 0;
      } else {
        const transIndices = new Int32Array(mem, this.transIndicesPtr, m.size);
        const transMultipliers = new Float32Array(mem, this.transMultipliersPtr, m.size);
        
        let idx = 0;
        for (const [nextWord, count] of m.entries()) {
          const wordIdx = this.vocabMap.get(nextWord);
          if (wordIdx !== undefined) {
            transIndices[idx] = wordIdx;
            transMultipliers[idx] = 1.5 + count * 2.0;
            idx++;
            
            if (numCandidates < 1024) {
              candView[numCandidates++] = wordIdx;
            }
            
            const derivationsIndices = this.wordDerivationIndices.get(nextWord);
            if (derivationsIndices) {
              const derivLen = derivationsIndices.length;
              for (let d = 0; d < derivLen; d++) {
                if (numCandidates < 1024) {
                  candView[numCandidates++] = derivationsIndices[d];
                }
              }
            }
          }
        }
        numTransitions = idx;
      }
    }

    // 4. WASM cosine similarity for candidates
    this.wasmInstance.exports.compute_similarity_for_candidates(
      this.candidateIndicesPtr,
      numCandidates,
      this.vocabCosPtr,
      this.vocabSinPtr,
      this.transIndicesPtr,
      this.transMultipliersPtr,
      numTransitions,
      this.topIndicesPtr,
      this.topScoresPtr
    );

    // 5. Read top-5 and apply penalties
    const topIndicesView = new Int32Array(mem, this.topIndicesPtr, 5);
    const topScoresView = new Float32Array(mem, this.topScoresPtr, 5);
    
    const candidates = [];
    const lastHarmony = lastToken ? this.morphology.determineVowelHarmony(lastToken) : null;
    const recentK = tokens.slice(-4);

    for (let i = 0; i < 5; i++) {
      const wordIdx = topIndicesView[i];
      if (wordIdx === -1) continue;
      
      const word = this.vocab[wordIdx];
      let score = topScoresView[i];
      
      if (tokens.length >= 1) {
        const last1 = tokens[tokens.length - 1];
        for (let idx = 0; idx < tokens.length - 1; idx++) {
          if (tokens[idx] === last1 && tokens[idx + 1] === word) { score = 0.0; break; }
        }
      }
      if (tokens.length >= 2) {
        const last2 = tokens[tokens.length - 2];
        const last1 = tokens[tokens.length - 1];
        for (let idx = 0; idx < tokens.length - 2; idx++) {
          if (tokens[idx] === last2 && tokens[idx + 1] === last1 && tokens[idx + 2] === word) { score = 0.0; break; }
        }
      }
      if (recentK.includes(word)) {
        score *= 0.1;
      }
      if (lastHarmony && this.morphology.suffixFeatures.hasOwnProperty(word)) {
        const suffixHarmony = this.morphology.determineVowelHarmony(word);
        if (suffixHarmony !== lastHarmony) score = 0.0;
      } else if (lastHarmony) {
        const candidateHarmony = this.morphology.determineVowelHarmony(word);
        if (candidateHarmony === lastHarmony) score *= 1.15;
      }
      
      candidates.push({ word, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return this._sample(candidates, temperature);
  }

  _predictJS(tokens, temperature, promptLength) {
    const ctx = new Float32Array(this.D);
    if (promptLength > 0 && tokens.length > promptLength) {
      const pD = this.embeddings.get(tokens[promptLength - 1]) || this.embeddings.get('<unk>');
      const gD = this.embeddings.get(tokens[tokens.length - 1]) || this.embeddings.get('<unk>');
      for (let j = 0; j < this.D; j++) {
        let v = pD.emb.values[j] + gD.emb.values[j];
        if (v < 0) v += 2 * Math.PI;
        ctx[j] = v % (2 * Math.PI);
      }
    } else {
      const ld = this.embeddings.get(tokens[tokens.length - 1]) || this.embeddings.get('<unk>');
      ctx.set(ld.emb.values);
    }

    const query = new Float32Array(this.D);
    for (let j = 0; j < this.D; j++) {
      let v = ctx[j] + (this.sparseWeightsSpec ? this.sparseWeightsSpec.values[j] : 0);
      if (v < 0) v += 2 * Math.PI;
      query[j] = v % (2 * Math.PI);
    }

    // Scan all vocab in JS fallback (matches core behavior)
    const cosY = new Float32Array(this.D);
    const sinY = new Float32Array(this.D);
    for (let i = 0; i < this.D; i++) {
      cosY[i] = Math.cos(query[i]);
      sinY[i] = Math.sin(query[i]);
    }

    const candidates = [];
    const lastToken = tokens[tokens.length - 1];
    const lastHarmony = lastToken ? this.morphology.determineVowelHarmony(lastToken) : null;
    const recentK = tokens.slice(-4);

    for (const [word, data] of this.embeddings.entries()) {
      let sumCos = 0.0;
      const cosEmb = data.cosVals;
      const sinEmb = data.sinVals;
      for (let i = 0; i < this.D; i++) {
        sumCos += cosY[i] * cosEmb[i] + sinY[i] * sinEmb[i];
      }
      let score = sumCos / this.D;
      score = Math.max(0.0001, (score + 1.0) / 2.0);

      if (lastToken) {
        const m = this.transitionCounts.get(lastToken);
        if (m) {
          const count = m.get(word) || 0;
          score *= (count > 0 ? (1.5 + count * 2.0) : 0.1);
        } else {
          score *= 0.5;
        }
      }

      if (tokens.length >= 1) {
        const last1 = tokens[tokens.length - 1];
        for (let i = 0; i < tokens.length - 1; i++) {
          if (tokens[i] === last1 && tokens[i + 1] === word) { score = 0.0; break; }
        }
      }
      if (tokens.length >= 2) {
        const last2 = tokens[tokens.length - 2];
        const last1 = tokens[tokens.length - 1];
        for (let i = 0; i < tokens.length - 2; i++) {
          if (tokens[i] === last2 && tokens[i + 1] === last1 && tokens[i + 2] === word) { score = 0.0; break; }
        }
      }
      if (recentK.includes(word)) {
        score *= 0.1;
      }
      if (lastHarmony && this.morphology.suffixFeatures.hasOwnProperty(word)) {
        const suffixHarmony = this.morphology.determineVowelHarmony(word);
        if (suffixHarmony !== lastHarmony) score = 0.0;
      } else if (lastHarmony) {
        const candidateHarmony = this.morphology.determineVowelHarmony(word);
        if (candidateHarmony === lastHarmony) score *= 1.15;
      }

      candidates.push({ word, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return this._sample(candidates.slice(0, 5), temperature);
  }

  _sample(candidates, temperature) {
    if (!candidates.length) return { word: '<unk>', score: 0 };
    if (temperature <= 0.05) return candidates[0]; // Greedy

    const max = candidates[0].score;
    const exp = candidates.map(c => Math.exp((c.score - max) / temperature));
    const sum = exp.reduce((a, v) => a + v, 0);
    const probs = exp.map(v => v / sum);
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < candidates.length; i++) {
      cum += probs[i];
      if (r <= cum) return candidates[i];
    }
    return candidates[0];
  }
  _isTerminal(word) {
    const terminals = new Set(['.', 'gittik', 'aldım', 'aldık', 'geliştirir', 'uyandık',
      'kuruludur', 'çıktık', 'izledim', 'izledik', 'uyudum', 'yattım', 'gittim', 'yaptım', 'öğrendim']);
    return terminals.has(word) || word.endsWith('.');
  }

  _assertInit() {
    if (!this._initialized) throw new Error('ResonanceSDK: Not initialized. Call await sdk.init() first.');
  }
}
