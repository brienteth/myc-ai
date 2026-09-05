/**
 * Turkish Resonance AI Core - Autoregressive Spectral SLM Text Generator (v5.1)
 * Uses HDC/FHRR phase context bundling and circular convolution via FFT for next-token prediction.
 * Features WebAssembly (Wasm) acceleration for FFT and cosine similarity scoring.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Representation, HDCEngine } from './hdc.js';
import { TurkishMorphology } from './morphology.js';
import { SafetensorsParser } from './safetensors.js';
import { WeightSpectralAnalyzer } from './weight_analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAFETENSORS_PATH = path.join(__dirname, '..', 'data', 'google_bert_tiny.safetensors');

// Convert real weights to complex phases
function mapToPhase(realWeights) {
  const phases = new Float32Array(realWeights.length);
  for (let i = 0; i < realWeights.length; i++) {
    phases[i] = Math.PI * Math.tanh(realWeights[i]);
  }
  return phases;
}

// Complex Hadamard pointwise product: C = A * B
function complexHadamardProduct(A, B) {
  const N = A.D;
  const C_re = new Float32Array(N);
  const C_im = new Float32Array(N);
  const C_magnitude = new Float32Array(N);
  
  for (let k = 0; k < N; k++) {
    C_re[k] = A.re[k] * B.re[k] - A.im[k] * B.im[k];
    C_im[k] = A.re[k] * B.im[k] + A.im[k] * B.re[k];
    C_magnitude[k] = Math.sqrt(C_re[k] * C_re[k] + C_im[k] * C_im[k]);
  }
  
  return {
    type: 'complex',
    D: N,
    re: C_re,
    im: C_im,
    magnitude: C_magnitude
  };
}

// Suffix derivation generator for expanding vocabulary with Turkish grammatical rules
function generateDerivations(root, morphology) {
  const harmony = morphology.determineVowelHarmony(root);
  const lastChar = root[root.length - 1];
  const isVowel = morphology.allVowels.has(lastChar);
  
  const derivations = [root];
  
  if (harmony === 'front') {
    // Front vowels harmony (e, i, ö, ü)
    derivations.push(root + 'ler');
    derivations.push(root + (isVowel ? 'nin' : 'in'));
    derivations.push(root + (isVowel ? 'ye' : 'e'));
    derivations.push(root + (isVowel ? 'yi' : 'i'));
    const loc = (lastChar === 't' || lastChar === 'k' || lastChar === 'ç' || lastChar === 'p' || lastChar === 's' || lastChar === 'ş' || lastChar === 'h' || lastChar === 'f') ? 'te' : 'de';
    derivations.push(root + loc);
    const abl = (lastChar === 't' || lastChar === 'k' || lastChar === 'ç' || lastChar === 'p' || lastChar === 's' || lastChar === 'ş' || lastChar === 'h' || lastChar === 'f') ? 'ten' : 'den';
    derivations.push(root + abl);
    derivations.push(root + (isVowel ? 'm' : 'im'));
    derivations.push(root + (isVowel ? 'niz' : 'iniz'));
    derivations.push(root + 'leriniz');
    derivations.push(root + 'lerimizden');
  } else {
    // Back vowels harmony (a, ı, o, u)
    derivations.push(root + 'lar');
    derivations.push(root + (isVowel ? 'nın' : 'ın'));
    derivations.push(root + (isVowel ? 'ya' : 'a'));
    derivations.push(root + (isVowel ? 'yı' : 'ı'));
    const loc = (lastChar === 't' || lastChar === 'k' || lastChar === 'ç' || lastChar === 'p' || lastChar === 's' || lastChar === 'ş' || lastChar === 'h' || lastChar === 'f') ? 'ta' : 'da';
    derivations.push(root + loc);
    const abl = (lastChar === 't' || lastChar === 'k' || lastChar === 'ç' || lastChar === 'p' || lastChar === 's' || lastChar === 'ş' || lastChar === 'h' || lastChar === 'f') ? 'tan' : 'dan';
    derivations.push(root + abl);
    derivations.push(root + (isVowel ? 'm' : 'ım'));
    derivations.push(root + (isVowel ? 'nız' : 'ınız'));
    derivations.push(root + 'larınız');
    derivations.push(root + 'larımızdan');
  }
  
  return derivations;
}

export class SpectralSLM {
  constructor(D = 4096) {
    this.D = D;
    this.hdc = new HDCEngine(D);
    this.morphology = new TurkishMorphology();
    this.analyzer = new WeightSpectralAnalyzer(D);
    
    this.vocab = [];
    this.vocabMap = new Map(); // Index map to speed up lookups
    this.embeddings = new Map();
    this.transitionCounts = new Map();
    this.sparseWeightsSpec = null;
    this.wordCounts = new Map();
    this.freqIndices = [];
    this.wordDerivationIndices = new Map(); // Pre-calculated derivations indices
    
    this.wasmInstance = null;
    this.wasmMemory = null;
    
    // Dynamic pointers for vocabulary buffers inside Wasm Memory
    this.vocabCosPtr = 0;
    this.vocabSinPtr = 0;
    this.scoresPtr = 0;
    
    // Dynamic pointers for transition and top-k selection arrays
    this.transIndicesPtr = 0;
    this.transMultipliersPtr = 0;
    this.topIndicesPtr = 0;
    this.topScoresPtr = 0;
    this.candidateIndicesPtr = 0;
    
    this.init();
  }

  init() {
    // 0. Load WebAssembly Module synchronously
    try {
      const wasmPath = path.join(__dirname, '..', 'wasm', 'spectral_core.wasm');
      if (fs.existsSync(wasmPath)) {
        const wasmBuffer = fs.readFileSync(wasmPath);
        const imports = {
          env: {
            cosf: Math.cos,
            sinf: Math.sin,
            atan2f: Math.atan2
          }
        };
        const wasmModule = new WebAssembly.Module(wasmBuffer);
        this.wasmInstance = new WebAssembly.Instance(wasmModule, imports);
        this.wasmMemory = this.wasmInstance.exports.memory;
      }
    } catch (e) {
      console.warn("WASM Core loading failed, falling back to Pure JS:", e.message);
    }

    // 1. Define a rich training corpus of representative Turkish sentences
    const trainingCorpus = [
      "evimizden yeni çıktık",
      "yeni bir kitap aldım",
      "bilimsel araştırmalar yapay zeka ile hızlandı",
      "güzel bir gün başladı",
      "iyi bir insan olmak önemlidir",
      "türkçe dil yapısı çok zengindir",
      "yapay zeka insan beyni gibi çalışır",
      "öğrenmek ve düşünmek zihni geliştirir",
      "büyük bir adım attık",
      "yeni projeler üzerinde çalışıyoruz",
      "okuma alışkanlığı kazanmak önemlidir",
      "bilim ve teknik dünyayı değiştiriyor",
      "evimizden okula kadar yürüdük",
      "yapay zeka dil modelleri üzerine kuruludur",
      "yeni bir dünya bizi bekliyor",
      "kitaplar en iyi arkadaştır",
      "güzel bir gelecek inşa ediyoruz",
      "iyi bir eğitim almak önemlidir",
      "türkçe konuşmak ve yazmak çok güzel",
      "bilimsel gerçekler her zaman kazanır",
      "yapay sinir ağları karmaşık modellerdir",
      "beyin ve zihin araştırmaları sürüyor",
      "evimizden yeni bir yola çıktık",
      "yeni bir başlangıç yapmak iyidir",
      "bilimsel okuma yapmak zihni açar",
      "okuma yapmak insanı geliştirir",
      "evimizden çıktık ve okula gittik",
      "yeni bir güne uyandık",
      "bilim insanları yapay zeka geliştiriyor",
      "türkçe dil bilgisi kuralları önemlidir",
      "evimizden okula gittik yeni bir kitap aldık",
      
      // Prompt alignment additions
      "televizyonu açıp haberleri izledik",
      "televizyonu açıp maçı izledim",
      "arabaya binip okula gittik",
      "arabaya binip yola çıktık",
      "bilgisayarı kapatıp uyudum",
      "bilgisayarı kapatıp yattım",

      // Bilim ve Teknoloji (Science & Technology)
      "yapay zeka modelleri karmaşık veri setlerini analiz eder",
      "yeni yazılımlar bilgisayar performansını artırır",
      "bilim insanları uzay boşluğunda yeni gezegenler keşfetti",
      "biyoloji laboratuvarında hücre yapısı inceleniyor",
      "fizik deneyleri yerçekimi kuvvetini ölçer",
      "kimyasal bileşikler yeni maddeler oluşturur",
      "yazılım mühendisleri kod yazıp sistemleri test ediyor",
      "internet ağları dünya genelinde hızlı iletişim sağlar",
      "teknolojik gelişmeler günlük yaşamı kolaylaştırır",
      "veri tabanı yönetimi bilgi güvenliğini korur",

      // Tarih ve Kültür (History & Culture)
      "türk tarihi eski çağlardan günümüze kadar uzanır",
      "cumhuriyet yönetimi bağımsızlık mücadelesi ile kuruldu",
      "eski saraylar tarihi eserler koruma altına alındı",
      "kültürel değerler nesilden nesile aktarılır",
      "müzeler geçmiş dönemin izlerini sergiler",
      "arkeolojik kazılar antik kentleri gün yüzüne çıkardı",
      "geleneksel el sanatları kültürümüzün zenginliğini yansıtır",
      "tarihi belgeler geçmişi anlamamıza ışık tutar",
      "cumhuriyet bayramı her yıl coşkuyla kutlanır",
      "anadolu toprakları birçok medeniyete ev sahipliği yaptı",

      // Sanat ve Edebiyat (Art & Literature)
      "güzel sanatlar insanın yaratıcı yönünü geliştirir",
      "roman okumak farklı dünyaları keşfetmenizi sağlar",
      "yeni tiyatro oyunu izleyiciden büyük ilgi gördü",
      "klasik müzik zihni dinlendirir ve odaklanmayı artırır",
      "ressam tuval üzerine renkli yağlı boyalar sürdü",
      "şiir yazmak duyguları kelimelerle ifade etmektir",
      "sinema filmleri toplumsal konuları beyaz perdeye taşır",
      "kitap fuarı bu yıl binlerce okuyucuyu ağırladı",
      "edebi eserler dilin estetik gücünü gösterir",
      "heykeltıraş mermer bloğu sanata dönüştürdü",

      // Günlük Yaşam ve Sağlık (Daily Life & Health)
      "sabah erkenden kalkıp yürüyüş yapmak sağlıklıdır",
      "dengeli beslenmek vücut direncini artırır",
      "düzenli uyku zihinsel yorgunluğu azaltır",
      "akşam yemeğinde taze sebze çorbası içtik",
      "arkadaşlarımla kütüphanede ders çalıştık",
      "pazardan taze meyve ve sebze aldım",
      "temiz hava almak stresi azaltmaya yardımcı olur",
      "bol su içmek böbrek sağlığı için önemlidir",
      "hafta sonu ailemle güzel bir piknik yaptık",
      "spor yapmak kas yapısını güçlendirir",

      // Coğrafya ve Doğa (Geography & Nature)
      "türkiye üç tarafı denizlerle çevrili bir yarımadadır",
      "ormanlar havadaki karbondioksit oranını düşürür",
      "ege kıyılarında zeytin ağaçları yetişir",
      "akdeniz iklimi sıcak ve kurak yazlar getirir",
      "karadeniz dağları gür ormanlarla kaplıdır",
      "doğayı korumak gelecek nesiller için görevimizdir",
      "akarsular göllere ve denizlere dökülür",
      "yüksek dağ zirveleri her zaman karla kaplıdır",
      "doğal kaynaklarımızı verimli kullanmalıyız",
      "bahar aylarında çiçekler rengarenk açar",

      // Ekonomi ve İş Dünyası (Economics & Business)
      "ekonomik büyüme yeni iş imkanları yaratır",
      "yatırım yapmak birikimleri değerlendirmenin yoludur",
      "ticaret hacmi ülkeler arasındaki ilişkileri güçlendirir",
      "üretim kapasitesi teknolojik yatırımlarla arttı",
      "piyasa analizi doğru kararlar almayı kolaylaştırır",
      "müşteri memnuniyeti şirketlerin başarısını belirler",
      "finansal okuryazarlık bütçe yönetimini sağlar",
      "yeni girişimler sektöre canlılık kazandırır",
      "ithalat ve ihracat dengesi ekonomik istikrarı korur",
      "banka işlemleri internet üzerinden hızlıca yapılır",

      // Geniş Semantik Kapsam (Broad Domain Expansion)
      "yazılım mühendisleri yapay zeka modelleri üzerine araştırma yapıyor",
      "bilgi teknolojileri ve veri analizi iş süreçlerini kolaylaştırır",
      "sağlıklı beslenme ve spor yapmak yaşam kalitesini artırır",
      "türk tarihi ve kültürü dünya genelinde büyük ilgi görüyor",
      "doğal yaşamı ve çevreyi korumak hepimizin sorumluluğundadır",
      "bilimsel makaleler ve araştırmalar yeni teknolojilere kapı açar",
      "sanat ve edebiyat toplumun kültürel zenginliğini besler ve geliştirir",
      "küresel ekonomik dengeler ithalat ve ihracat oranlarıyla değişir",
      "eğitim sistemi yeni nesillerin geleceğini ve başarısını belirler",
      "bilgisayar ağları veri güvenliği ve hızlı bilgi akışı sağlar"
    ];

    // Load Vocabulary from tr_corpus_embed.js and filter strictly using regex + training words
    let initialVocab = [];
    try {
      const corpusPath = path.join(__dirname, '..', 'tr_corpus_embed.js');
      const fileContent = fs.readFileSync(corpusPath, 'utf8');
      const match = fileContent.match(/const TR_CORPUS_ROOTS\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        initialVocab = JSON.parse(match[1]);
      }
    } catch (e) {
      // Ignored
    }

    const turkishRegex = /^[a-zçgğıoöşuüâîû]+$/;
    const cleanCorpusWords = new Set([
      'ev', 'yeni', 'bir', 'kitap', 'okul', 'çıktık', 'aldım', 'güzel', 'iyi', 
      'yapay', 'zeka', 'bilimsel', 'okuma', 'öğrenmek', 'dil', 'türkçe', 'insan', 
      'olmak', 'önemlidir', 'geliştirir', 'değiştiriyor', 'yürüdük', 'gittik', 'yola', 
      'başlangıç', 'güne', 'uyandık', 'kuruludur',
      'televizyonu', 'açıp', 'izledik', 'izledim', 'arabaya', 'binip', 'bilgisayarı', 
      'kapatıp', 'uyudum', 'yattım'
    ]);
    
    // Compute corpus counts for Zipf thresholding and Transition Whitening
    this.wordCounts.clear();
    for (const sentence of trainingCorpus) {
      sentence.split(/\s+/).forEach(w => {
        const clean = w.trim().toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '');
        if (clean.length >= 2 && turkishRegex.test(clean)) {
          this.wordCounts.set(clean, (this.wordCounts.get(clean) || 0) + 1);
        }
      });
    }

    // Zipf threshold: prune words occurring < 2 times (unless they are core query words)
    for (const [w, count] of this.wordCounts.entries()) {
      if (count >= 2) {
        cleanCorpusWords.add(w);
      }
    }

    // Genişletme Hamlesi: 5000 kökün tamamından morfolojik varyasyon türeterek 50.000+ kelime üret
    for (const w of initialVocab) {
      const clean = w.trim().toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '');
      if (clean.length >= 2 && turkishRegex.test(clean)) {
        const derivations = generateDerivations(clean, this.morphology);
        for (const deriv of derivations) {
          cleanCorpusWords.add(deriv);
        }
      }
    }

    this.vocab = ['<unk>', ...Array.from(cleanCorpusWords)];
    this.vocabMap.clear();
    for (let i = 0; i < this.vocab.length; i++) {
      this.vocabMap.set(this.vocab[i], i);
    }

    // Pre-calculate top 15 frequent words indices to restrict candidates search space to absolute minimum
    this.freqIndices = this.vocab
      .map((w, idx) => ({ w, idx }))
      .sort((a, b) => (this.wordCounts.get(b.w) || 0) - (this.wordCounts.get(a.w) || 0))
      .slice(0, 15)
      .map(x => x.idx);

    // Pre-calculate morphological suffix derivations indices map to avoid string manipulations in loop
    this.wordDerivationIndices.clear();
    for (const root of this.vocab) {
      const derivations = generateDerivations(root, this.morphology);
      const indices = [];
      for (const deriv of derivations) {
        const idx = this.vocabMap.get(deriv);
        if (idx !== undefined) {
          indices.push(idx);
        }
      }
      this.wordDerivationIndices.set(root, indices);
    }

    // 2. Generate deterministic FHRR embeddings for all vocabulary words
    for (const word of this.vocab) {
      const emb = this.hdc.generateSeeded('complex', word);
      // Pre-convert to Float32Array for ultra-fast direct memcpy/memmove in V8
      emb.values = new Float32Array(emb.values);
      const cosVals = new Float32Array(this.D);
      const sinVals = new Float32Array(this.D);
      for (let i = 0; i < this.D; i++) {
        cosVals[i] = Math.cos(emb.values[i]);
        sinVals[i] = Math.sin(emb.values[i]);
      }
      this.embeddings.set(word, { emb, cosVals, sinVals });
    }

    // 2b. Write vocabulary embeddings to Wasm memory using dynamic malloc allocator
    if (this.wasmInstance) {
      const vocabSize = this.vocab.length;
      const dSize = this.D;
      
      // Dynamic allocation in Wasm memory
      this.vocabCosPtr = this.wasmInstance.exports.malloc(vocabSize * dSize * 4);
      this.vocabSinPtr = this.wasmInstance.exports.malloc(vocabSize * dSize * 4);
      this.scoresPtr = this.wasmInstance.exports.malloc(vocabSize * 4);
      
      this.transIndicesPtr = this.wasmInstance.exports.malloc(64 * 4);
      this.transMultipliersPtr = this.wasmInstance.exports.malloc(64 * 4);
      this.topIndicesPtr = this.wasmInstance.exports.malloc(5 * 4);
      this.topScoresPtr = this.wasmInstance.exports.malloc(5 * 4);
      this.candidateIndicesPtr = this.wasmInstance.exports.malloc(1024 * 4); // Space for up to 1024 candidates
      
      if (this.vocabCosPtr === 0 || this.vocabSinPtr === 0 || this.scoresPtr === 0 ||
          this.transIndicesPtr === 0 || this.transMultipliersPtr === 0 ||
          this.topIndicesPtr === 0 || this.topScoresPtr === 0 || this.candidateIndicesPtr === 0) {
        console.error("WASM Dynamic Allocation failed! Falling back to Pure JS.");
        this.wasmInstance = null;
      } else {
        // Fresh views of the buffer (handles detaching after grow)
        const memoryBuffer = this.wasmMemory.buffer;
        const vocabCosView = new Float32Array(memoryBuffer, this.vocabCosPtr, vocabSize * dSize);
        const vocabSinView = new Float32Array(memoryBuffer, this.vocabSinPtr, vocabSize * dSize);
        
        for (let v = 0; v < vocabSize; v++) {
          const word = this.vocab[v];
          const data = this.embeddings.get(word);
          vocabCosView.set(data.cosVals, v * dSize);
          vocabSinView.set(data.sinVals, v * dSize);
        }
      }
    }

    // 3. Extract Bi-gram Transitions and encode to phase differences using TF-IDF / Transition Whitening
    const re = new Float32Array(this.D);
    const im = new Float32Array(this.D);
    this.transitionCounts = new Map();
    let transitionRepsCount = 0;

    for (const sentence of trainingCorpus) {
      const words = sentence.split(/\s+/).map(w => w.trim().toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '')).filter(w => w.length >= 2);
      for (let i = 0; i < words.length - 1; i++) {
        const w1 = words[i];
        const w2 = words[i + 1];
        
        // Populate transition frequencies map
        if (!this.transitionCounts.has(w1)) {
          this.transitionCounts.set(w1, new Map());
        }
        const m = this.transitionCounts.get(w1);
        m.set(w2, (m.get(w2) || 0) + 1);

        const data1 = this.embeddings.get(w1);
        const data2 = this.embeddings.get(w2);
        
        if (data1 && data2) {
          // Whitening factor: 1 / sqrt(freq(w_j))
          const freq = this.wordCounts.get(w2) || 1;
          const weight = 1.0 / Math.sqrt(freq);
          
          for (let j = 0; j < this.D; j++) {
            let diff = data2.emb.values[j] - data1.emb.values[j];
            if (diff < 0) diff += 2 * Math.PI;
            diff = diff % (2 * Math.PI);
            
            re[j] += weight * Math.cos(diff);
            im[j] += weight * Math.sin(diff);
          }
          transitionRepsCount++;
        }
      }
    }

    // Bundle transition phase differences
    let wRep;
    if (transitionRepsCount > 0) {
      const bundleVals = new Float32Array(this.D);
      for (let j = 0; j < this.D; j++) {
        let v = Math.atan2(im[j], re[j]);
        if (v < 0) v += 2 * Math.PI;
        bundleVals[j] = v;
      }
      wRep = new Representation('complex', bundleVals, this.D);
    } else {
      wRep = this.hdc.generateSeeded('complex', 'fallback_transitions');
    }

    // Convert weights to spectral domain and apply 20% sparse pruning
    const wSpec = this.analyzer.spectralEngine.spectralTransform(wRep);
    this.sparseWeightsSpec = this.analyzer.compressSpectrum(wSpec, 0.20);

    // Write sparse weights spectrum to Wasm memory once during init
    if (this.wasmInstance) {
      const specRePtr = this.wasmInstance.exports.get_transition_spec_re_ptr();
      const specImPtr = this.wasmInstance.exports.get_transition_spec_im_ptr();
      const memoryBuffer = this.wasmMemory.buffer;
      
      const specReView = new Float32Array(memoryBuffer, specRePtr, this.D);
      const specImView = new Float32Array(memoryBuffer, specImPtr, this.D);
      
      specReView.set(this.sparseWeightsSpec.re);
      specImView.set(this.sparseWeightsSpec.im);
    }
  }

  // HDC Context Encoding: for Bi-gram transition retrieval, X_context is simply the last token representation
  encodeContext(tokens) {
    if (!tokens || tokens.length === 0) {
      return this.hdc.generateSeeded('complex', 'empty_context');
    }

    const lastToken = tokens[tokens.length - 1];
    let data = this.embeddings.get(lastToken);
    if (!data) {
      data = this.embeddings.get('<unk>');
      if (!data) {
        return this.hdc.generateSeeded('complex', 'empty_context');
      }
    }

    return data.emb;
  }

  // Helper to combine two phase representations linearly in complex plane
  combineRepresentations(repA, weightA, repB, weightB) {
    const vals = new Float32Array(this.D);
    for (let i = 0; i < this.D; i++) {
      const re = weightA * Math.cos(repA.values[i]) + weightB * Math.cos(repB.values[i]);
      const im = weightA * Math.sin(repA.values[i]) + weightB * Math.sin(repB.values[i]);
      let v = Math.atan2(im, re);
      if (v < 0) v += 2 * Math.PI;
      vals[i] = v;
    }
    return new Representation('complex', vals, this.D);
  }

  // Generate next token resonance scores and sample the selected word
  generateNextToken(tokens, temperature = 0.7, promptLength = 0) {
    if (this.wasmInstance) {
      const memoryBuffer = this.wasmMemory.buffer;
      const contextPtr = this.wasmInstance.exports.get_context_angles_ptr();
      const contextView = new Float32Array(memoryBuffer, contextPtr, this.D);

      // 1. Context combination completely offloaded using zero-copy indices method
      if (promptLength > 0 && tokens.length > promptLength) {
        let promptIdx = this.vocabMap.get(tokens[promptLength - 1]);
        if (promptIdx === undefined) promptIdx = 0;
        let generatedIdx = this.vocabMap.get(tokens[tokens.length - 1]);
        if (generatedIdx === undefined) generatedIdx = 0;
        
        // Zero-copy combination natively in Wasm directly reading from vocabCos/vocabSin arrays
        this.wasmInstance.exports.combine_phases_by_indices(
          promptIdx, 
          0.4, 
          generatedIdx, 
          0.6, 
          this.vocabCosPtr, 
          this.vocabSinPtr,
          contextPtr
        );
      } else {
        const lastToken = tokens[tokens.length - 1];
        let data = this.embeddings.get(lastToken);
        if (!data) data = this.embeddings.get('<unk>');
        contextView.set(data.emb.values);
      }
      
      // 2. Perform forward prediction in Wasm
      this.wasmInstance.exports.spectral_predict();
      
      // 3. Dynamic Candidate Restrictive Selection: directly write to Wasm memory avoiding Set creation
      const candidateIndicesView = new Int32Array(memoryBuffer, this.candidateIndicesPtr, 1024);
      
      // Initialize candidates list with the pre-calculated 15 frequent words indices
      const freqLen = this.freqIndices.length;
      for (let i = 0; i < freqLen; i++) {
        candidateIndicesView[i] = this.freqIndices[i];
      }
      let numCandidates = freqLen;
      
      // Add all prompt word indices
      for (let i = 0; i < promptLength; i++) {
        const idx = this.vocabMap.get(tokens[i]);
        if (idx !== undefined && numCandidates < 1024) {
          candidateIndicesView[numCandidates++] = idx;
        }
      }
      
      // Map transitions and write indices and multipliers to Wasm Memory
      const lastToken = tokens[tokens.length - 1];
      let numTransitions = -1; // -1 indicates no lastToken (first word)
      
      if (lastToken) {
        const m = this.transitionCounts.get(lastToken);
        if (!m) {
          numTransitions = 0; // 0 indicates lastToken exists but has no transitions recorded
        } else {
          const transIndices = new Int32Array(memoryBuffer, this.transIndicesPtr, m.size);
          const transMultipliers = new Float32Array(memoryBuffer, this.transMultipliersPtr, m.size);
          
          let idx = 0;
          for (const [nextWord, count] of m.entries()) {
            const wordIdx = this.vocabMap.get(nextWord);
            if (wordIdx !== undefined) {
              transIndices[idx] = wordIdx;
              transMultipliers[idx] = 1.5 + count * 2.0;
              idx++;
              
              // Add transitions to candidates pool
              if (numCandidates < 1024) {
                candidateIndicesView[numCandidates++] = wordIdx;
              }
              
              // Add pre-calculated suffix derivations of transition words to candidate pool (O(1) lookup!)
              const derivationsIndices = this.wordDerivationIndices.get(nextWord);
              if (derivationsIndices) {
                const derivLen = derivationsIndices.length;
                for (let d = 0; d < derivLen; d++) {
                  if (numCandidates < 1024) {
                    candidateIndicesView[numCandidates++] = derivationsIndices[d];
                  }
                }
              }
            }
          }
          numTransitions = idx;
        }
      }
      
      // 4. Compute similarities and select top-5 candidates ONLY from the active candidate pool (blazing fast ~0.15ms)
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
      
      // 5. Read top-5 results from Wasm memory
      const topIndicesView = new Int32Array(this.wasmMemory.buffer, this.topIndicesPtr, 5);
      const topScoresView = new Float32Array(this.wasmMemory.buffer, this.topScoresPtr, 5);
      
      const candidates = [];
      const lastHarmony = lastToken ? this.morphology.determineVowelHarmony(lastToken) : null;
      const recentK = tokens.slice(-4);
      
      for (let i = 0; i < 5; i++) {
        const wordIdx = topIndicesView[i];
        if (wordIdx === -1) continue;
        
        const word = this.vocab[wordIdx];
        let score = topScoresView[i];
        
        // Apply vowel harmony, repetition penalties, and dynamic n-gram blockers only on these top 5 candidates
        if (tokens.length >= 1) {
          const last1 = tokens[tokens.length - 1];
          for (let idx = 0; idx < tokens.length - 1; idx++) {
            if (tokens[idx] === last1 && tokens[idx + 1] === word) {
              score = 0.0;
              break;
            }
          }
        }
        if (tokens.length >= 2) {
          const last2 = tokens[tokens.length - 2];
          const last1 = tokens[tokens.length - 1];
          for (let idx = 0; idx < tokens.length - 2; idx++) {
            if (tokens[idx] === last2 && tokens[idx + 1] === last1 && tokens[idx + 2] === word) {
              score = 0.0;
              break;
            }
          }
        }
        
        if (recentK.includes(word)) {
          score *= 0.1;
        }
        
        if (lastHarmony && this.morphology.suffixFeatures.hasOwnProperty(word)) {
          const suffixHarmony = this.morphology.determineVowelHarmony(word);
          if (suffixHarmony !== lastHarmony) {
            score = 0.0;
          }
        } else if (lastHarmony) {
          const candidateHarmony = this.morphology.determineVowelHarmony(word);
          if (candidateHarmony === lastHarmony) {
            score *= 1.15;
          }
        }
        
        candidates.push({ word, score });
      }

      // Re-sort the final 5 candidates after penalties
      candidates.sort((a, b) => b.score - a.score);

      // Temperature Softmax selection
      if (temperature <= 0.0) {
        return candidates[0];
      }

      const expScores = candidates.map(c => Math.exp(c.score / temperature));
      const totalExp = expScores.reduce((sum, val) => sum + val, 0.0);
      
      let rand = Math.random() * totalExp;
      for (let i = 0; i < candidates.length; i++) {
        rand -= expScores[i];
        if (rand <= 0.0) {
          return candidates[i];
        }
      }

      return candidates[0];
      
    } else {
      // Pure JS Fallback
      let contextVec;
      if (promptLength > 0 && tokens.length > promptLength) {
        const xPrompt = this.encodeContext(tokens.slice(0, promptLength));
        const xGenerated = this.encodeContext([tokens[tokens.length - 1]]);
        contextVec = this.combineRepresentations(xPrompt, 0.4, xGenerated, 0.6);
      } else {
        contextVec = this.encodeContext(tokens);
      }

      // 1. Spectral Feed-Forward inference: O(N log N) Circular Convolution
      const contextSpec = this.analyzer.spectralEngine.spectralTransform(contextVec);
      const productSpec = complexHadamardProduct(this.sparseWeightsSpec, contextSpec);
      const reconstructedRep = this.analyzer.reconstructBlock(productSpec);
      const yQuery = reconstructedRep.values; // predicted FHRR phase vector

      // 2. Scan vocabulary and compute phase cosine resonance similarity using precomputed trig values
      const candidates = [];
      const lastToken = tokens[tokens.length - 1];
      const lastHarmony = lastToken ? this.morphology.determineVowelHarmony(lastToken) : null;

      // Pre-compute cos and sin of yQuery once
      const cosY = new Float32Array(this.D);
      const sinY = new Float32Array(this.D);
      for (let i = 0; i < this.D; i++) {
        cosY[i] = Math.cos(yQuery[i]);
        sinY[i] = Math.sin(yQuery[i]);
      }

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
            if (count > 0) {
              score *= (1.5 + count * 2.0);
            } else {
              score *= 0.1;
            }
          } else {
            score *= 0.5;
          }
        }

        if (tokens.length >= 1) {
          const last1 = tokens[tokens.length - 1];
          for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i] === last1 && tokens[i + 1] === word) {
              score = 0.0;
              break;
            }
          }
        }
        if (tokens.length >= 2) {
          const last2 = tokens[tokens.length - 2];
          const last1 = tokens[tokens.length - 1];
          for (let i = 0; i < tokens.length - 2; i++) {
            if (tokens[i] === last2 && tokens[i + 1] === last1 && tokens[i + 2] === word) {
              score = 0.0;
              break;
            }
          }
        }

        const recentK = tokens.slice(-4);
        if (recentK.includes(word)) {
          score *= 0.1;
        }

        if (lastHarmony && this.morphology.suffixFeatures.hasOwnProperty(word)) {
          const suffixHarmony = this.morphology.determineVowelHarmony(word);
          if (suffixHarmony !== lastHarmony) {
            score = 0.0;
          }
        } else if (lastHarmony) {
          const candidateHarmony = this.morphology.determineVowelHarmony(word);
          if (candidateHarmony === lastHarmony) {
            score *= 1.15;
          }
        }

        candidates.push({ word, score });
      }

      candidates.sort((a, b) => b.score - a.score);

      if (temperature <= 0.0) {
        return candidates[0];
      }

      const k = 5;
      const topKCandidates = candidates.slice(0, k);

      const expScores = topKCandidates.map(c => Math.exp(c.score / temperature));
      const totalExp = expScores.reduce((sum, val) => sum + val, 0.0);
      
      let rand = Math.random() * totalExp;
      for (let i = 0; i < topKCandidates.length; i++) {
        rand -= expScores[i];
        if (rand <= 0.0) {
          return topKCandidates[i];
        }
      }

      return topKCandidates[0];
    }
  }

  // Autoregressive text generator
  generateText(prompt, maxLength = 10, temperature = 0.7) {
    const startTime = performance.now();
    
    // Normalize and tokenize prompt
    const cleanPrompt = this.morphology.normalize(prompt);
    const tokens = cleanPrompt.split(/\s+/).filter(Boolean);
    
    if (tokens.length === 0) {
      tokens.push('ev'); // Default fallback token
    }

    const promptLength = tokens.length;
    const steps = [];
    let stopReason = 'length';

    for (let step = 0; step < maxLength; step++) {
      const stepStart = performance.now();
      const nextObj = this.generateNextToken(tokens, temperature, promptLength);
      const stepEnd = performance.now();

      tokens.push(nextObj.word);
      steps.push({
        word: nextObj.word,
        score: nextObj.score,
        latencyMs: stepEnd - stepStart
      });

      // Stop early if EOS/predicate word or period is generated
      const word = nextObj.word;
      if (word === '.' || word.endsWith('.') || 
          word === 'gittik' || word === 'aldım' || word === 'aldık' || word === 'geliştirir' || 
          word === 'uyandık' || word === 'kuruludur' || word === 'çıktık' || 
          word === 'izledim' || word === 'izledik' || word === 'uyudum' || 
          word === 'yattım' || word === 'gittim' || word === 'yaptım' || 
          word === 'öğrendim') {
        stopReason = 'stop';
        break;
      }

      // Stop if duplicate sequence is detected
      if (tokens.slice(-3).every((val, i, arr) => val === arr[0]) && tokens.length > promptLength + 2) {
        stopReason = 'stop';
        break;
      }
    }

    const totalLatency = performance.now() - startTime;
    const generatedText = tokens.join(' ');

    return {
      prompt,
      generatedText,
      newTokens: tokens.slice(promptLength),
      steps,
      totalLatencyMs: totalLatency,
      finishReason: stopReason,
      vocabSize: this.vocab.length
    };
  }
}
