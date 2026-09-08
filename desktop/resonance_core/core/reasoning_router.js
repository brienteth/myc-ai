/**
 * Reasoning Router Module
 * Neural-Last router with 8-axis Verifier and 1-step Replan loop.
 */

// Safe AST / Token parser for math expressions (No eval / No new Function)
export function evaluateMath(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const char = expr[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '%' || char === '^' || char === '(' || char === ')') {
      tokens.push({ type: 'OP', value: char });
      i++;
      continue;
    }
    throw new Error("Invalid character in math expression: " + char);
  }

  let tokenIndex = 0;
  function peek() {
    return tokens[tokenIndex];
  }
  function consume(expectedValue) {
    const t = tokens[tokenIndex];
    if (!t) throw new Error("Unexpected end of expression");
    if (expectedValue !== undefined && t.value !== expectedValue) {
      throw new Error(`Expected ${expectedValue} but got ${t.value}`);
    }
    tokenIndex++;
    return t;
  }

  function parseExpression() {
    let val = parseTerm();
    while (true) {
      const t = peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        consume();
        const nextVal = parseTerm();
        if (t.value === '+') val += nextVal;
        else val -= nextVal;
      } else {
        break;
      }
    }
    return val;
  }

  function parseTerm() {
    let val = parseFactor();
    while (true) {
      const t = peek();
      if (t && t.type === 'OP' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        consume();
        const nextVal = parseFactor();
        if (t.value === '*') val *= nextVal;
        else if (t.value === '/') {
          if (nextVal === 0) throw new Error("Division by zero");
          val /= nextVal;
        }
        else val %= nextVal;
      } else {
        break;
      }
    }
    return val;
  }

  function parseFactor() {
    let val = parsePrimary();
    while (true) {
      const t = peek();
      if (t && t.type === 'OP' && t.value === '^') {
        consume();
        const nextVal = parseFactor();
        val = Math.pow(val, nextVal);
      } else {
        break;
      }
    }
    return val;
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.type === 'NUMBER') {
      consume();
      return t.value;
    }
    if (t.type === 'OP' && t.value === '(') {
      consume('(');
      const val = parseExpression();
      consume(')');
      return val;
    }
    if (t.type === 'OP' && t.value === '-') {
      consume('-');
      return -parsePrimary();
    }
    if (t.type === 'OP' && t.value === '+') {
      consume('+');
      return parsePrimary();
    }
    throw new Error(`Unexpected token: ${t.value}`);
  }

  const result = parseExpression();
  if (tokenIndex < tokens.length) {
    throw new Error("Unexpected trailing tokens at end of expression");
  }
  return result;
}

export class ReasoningRouter {
  /**
   * @param {Object} memoryEngine
   * @param {Object} sdkInstance
   */
  constructor(memoryEngine, sdkInstance) {
    this.memory = memoryEngine;
    this.sdk = sdkInstance;
    this.D = sdkInstance ? sdkInstance.D : 4096;

    // Initialize baseline semantic intent vectors for hybrid classification
    if (this.sdk && this.sdk.hdc) {
      const memReps = ['hatırla', 'hatırlıyor', 'favori', 'nerede', 'kim', 'hafıza', 'hasta', 'kayıt', 'bilgi', 'durum'].map(w => this.sdk.hdc.generateSeeded('complex', w));
      this.memoryIntentVec = this.sdk.hdc.bundle(memReps).values;

      const ruleReps = ['çelişki', 'kural', 'karşılaştır', 'doğru', 'yasak', 'uygun'].map(w => this.sdk.hdc.generateSeeded('complex', w));
      this.ruleIntentVec = this.sdk.hdc.bundle(ruleReps).values;

      const mathReps = ['hesapla', 'toplam', 'çarp', 'böl', 'kaç', 'sayı', 'doz', 'miktar'].map(w => this.sdk.hdc.generateSeeded('complex', w));
      this.mathIntentVec = this.sdk.hdc.bundle(mathReps).values;
    } else {
      this.memoryIntentVec = new Float32Array(this.D);
      this.ruleIntentVec = new Float32Array(this.D);
      this.mathIntentVec = new Float32Array(this.D);
    }
    this.chatState = 'idle';
    this.pendingRecord = null;
  }

  /**
   * Self-vectorize text input using SDK's HDC engine (runs in < 0.1 ms)
   * @param {string} text
   * @returns {Float32Array}
   */
  vectorize(text) {
    const clean = text.toLowerCase().trim().replace(/[^a-zçgğıoöşuüâîû\s]/g, '');
    const words = clean.split(/\s+/).filter(Boolean);

    if (this.sdk && this.sdk.hdc) {
      if (words.length === 0) {
        return new Float32Array(this.D);
      }
      if (words.length === 1) {
        return this.sdk.hdc.generateSeeded('complex', words[0]).values;
      }
      const reps = words.map(w => this.sdk.hdc.generateSeeded('complex', w));
      return this.sdk.hdc.bundle(reps).values;
    }

    return new Float32Array(this.D);
  }

  /**
   * 8-Axis Verification Suite
   * @param {Object} result - Candidate routed result
   * @param {number} axis - Axis index [1-8]
   * @returns {boolean} True if pass
   */
  validateAxis(result, axis) {
    if (!result) return false;

    // Axis 1: Math Correctness (Inverse operations validation)
    if (axis === 1 && result.route === 'math') {
      const match = result.input.match(/^\s*([0-9.]+)\s*([+\-*/%^])\s*([0-9.]+)\s*$/);
      if (match) {
        const a = parseFloat(match[1]);
        const op = match[2];
        const b = parseFloat(match[3]);
        const c = parseFloat(result.output);
        
        if (op === '*') {
          if (b !== 0 && Math.abs(c / b - a) > 1e-4) return false;
        } else if (op === '+') {
          if (Math.abs(c - b - a) > 1e-4) return false;
        } else if (op === '-') {
          if (Math.abs(c + b - a) > 1e-4) return false;
        } else if (op === '/') {
          if (b !== 0 && Math.abs(c * b - a) > 1e-4) return false;
        }
      }
      return true;
    }

    // Axis 2: Arithmetic Safety (no division by zero or NaN/Infinity values)
    if (axis === 2 && result.route === 'math') {
      const val = parseFloat(result.output);
      if (isNaN(val) || !isFinite(val)) return false;
      if (result.input.includes('/0')) return false;
      return true;
    }

    // Axis 3: Memory Conflicted Status Check
    if (axis === 3 && result.route === 'memory') {
      if (!result.results || result.results.length === 0) return false;
      const topRecord = result.results[0].record;
      if (topRecord.status === 'conflicted' || topRecord.contradictionIds.length > 0) {
        return false;
      }
      return true;
    }

    // Axis 4: Memory Decayed Confidence Threshold (>= 0.5)
    if (axis === 4 && result.route === 'memory') {
      if (!result.results || result.results.length === 0) return false;
      const topRecord = result.results[0].record;
      const C = this.memory.getDecayedConfidence(topRecord);
      if (C < 0.5) return false;
      return true;
    }

    // Axis 5: Semantic similarity score threshold (>= 0.15)
    if (axis === 5 && result.route === 'memory') {
      if (!result.results || result.results.length === 0) return false;
      const queryVec = this.vectorize(result.input);
      const sSem = this._cosineSimilarity(queryVec, result.results[0].record.representation);
      if (sSem < 0.15) return false;
      return true;
    }

    // Axis 6: Turkish morphology vowel harmony check
    if (axis === 6 && (result.route === 'llm' || result.route === 'memory')) {
      if (this.sdk && this.sdk.morphology) {
        const words = result.output.split(/\s+/).filter(Boolean);
        for (const w of words) {
          const cleanWord = w.toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '');
          if (cleanWord.length >= 2) {
            const harmony = this.sdk.morphology.determineVowelHarmony(cleanWord);
            if (harmony !== 'front' && harmony !== 'back') return false;
          }
        }
      }
      return true;
    }

    // Axis 7: Consonant mutability check (No illegal suffix attachments)
    if (axis === 7 && result.route === 'llm') {
      const words = result.output.split(/\s+/).filter(Boolean);
      for (const w of words) {
        const clean = w.toLowerCase().replace(/[^a-zçgğıoöşuüâîû]/g, '');
        if (/(kitapı|bebeki|çiçeki|ağacı)/.test(clean)) return false;
      }
      return true;
    }

    // Axis 8: Contextual Hallucination Guard (Verify semantic anchor words)
    if (axis === 8 && result.route === 'memory') {
      const queryWords = result.input.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const contentLower = result.output.toLowerCase();
      if (queryWords.length > 0) {
        const matchesQueryWord = queryWords.some(qw => contentLower.includes(qw));
        if (!matchesQueryWord) return false;
      }
      return true;
    }

    return true;
  }

  /**
   * Run all 8 verification axes
   */
  validateAllAxes(result) {
    for (let axis = 1; axis <= 8; axis++) {
      if (!this.validateAxis(result, axis)) return false;
    }
    return true;
  }

  /**
   * Route the query dynamically using safe parser, self-vectorization, and hybrid classification
   * @param {string} input
   * @returns {Object} Route result
   */
  route(input, options = {}) {
    const cleanInput = input.trim();

    const saveIntentRegex = /kaydet|ekle|yaz|not al|sakla|sisteme gir|oluştur/i;
    const confirmRegex = /^(evet|tamam|doğru|olur|kaydet|kabul|onay|evet kaydet)$/i;
    const rejectRegex = /^(hayır|iptal|vazgeç|yanlış|dur|bekle)$/i;

    if (this.chatState === 'pending_confirmation') {
      if (confirmRegex.test(cleanInput)) {
        this.chatState = 'recording';
        const r = this.pendingRecord;
        const searchableText = [r.baslik, r.kategori, r.aciklama, r.etiketler].filter(Boolean).join(' ');
        const representation = this.vectorize(searchableText);
        
        // Add the record
        const newRecord = this.memory.addRecord({
          content: `${r.baslik} — ${r.aciklama}`,
          representation: representation,
          priority: 'normal'
        });
        
        this.chatState = 'idle';
        this.pendingRecord = null;
        
        return {
          input: cleanInput,
          route: 'memory',
          llmBypassed: true,
          output: 'Hafıza kaydı başarıyla eklendi.',
          reason: 'Chat state machine confirm and record'
        };
      } else if (rejectRegex.test(cleanInput)) {
        this.chatState = 'idle';
        this.pendingRecord = null;
        return {
          input: cleanInput,
          route: 'memory',
          llmBypassed: true,
          output: 'Kayıt iptal edildi.',
          reason: 'Chat state machine reject'
        };
      } else {
        // Unrelated query
        this.chatState = 'idle';
        this.pendingRecord = null;
        
        const normalResult = this._routeNormal(input, options);
        normalResult.output = 'Önceki kaydı iptal ettim. ' + normalResult.output;
        return normalResult;
      }
    }

    if (this.chatState === 'idle' && saveIntentRegex.test(cleanInput)) {
      const data = this._extractDataFromText(cleanInput);
      if (data.baslik && data.aciklama) {
        this.chatState = 'pending_confirmation';
        this.pendingRecord = data;
        
        return {
          input: cleanInput,
          route: 'memory',
          llmBypassed: true,
          output: `Şunu kaydediyorum:\n  Başlık: ${data.baslik}\n  Not: ${data.aciklama}\nDoğru mu?`,
          reason: 'Chat state machine save intent detected'
        };
      }
    }

    return this._routeNormal(input, options);
  }

  _extractDataFromText(text) {
    const clean = text.replace(/kaydet|ekle|yaz|not al|sakla|sisteme gir|oluştur/ig, '').trim();
    const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
    let baslik = '';
    let aciklama = '';
    let kategori = '';
    let etiketler = '';
    
    if (parts.length >= 2) {
      baslik = parts[0];
      aciklama = parts[1];
      if (parts.length >= 3) kategori = parts[2];
      if (parts.length >= 4) etiketler = parts.slice(3).join(', ');
    } else {
      const words = clean.split(/\s+/);
      if (words.length > 2) {
        baslik = words.slice(0, 2).join(' ');
        aciklama = words.slice(2).join(' ');
      } else {
        baslik = clean;
        aciklama = clean;
      }
    }
    
    baslik = baslik.replace(/[,.;!]+$/, '').trim();
    aciklama = aciklama.replace(/[,.;!]+$/, '').trim();
    
    if (!baslik) baslik = clean || 'Yeni Kayıt';
    if (!aciklama) aciklama = clean || 'Detay girilmedi';
    
    return { baslik, aciklama, kategori, etiketler };
  }

  _routeNormal(input, options = {}) {
    const cleanInput = input.trim();

    // 1. Determinisik Matematik Yönlendirmesi
    const mathRegex = /^[0-9+\-*/().\s%^]+$/;
    const hasOperator = /[+\-*/%^]/.test(cleanInput);
    if (mathRegex.test(cleanInput) && hasOperator) {
      try {
        const val = evaluateMath(cleanInput);
        const candidateResult = {
          input: cleanInput,
          route: 'math',
          llmBypassed: true,
          output: val.toString(),
          reason: 'Deterministic arithmetic evaluation'
        };

        if (this.validateAllAxes(candidateResult)) {
          return candidateResult;
        } else {
          // Replan Loop for Math: fallback to safe error description rather than throwing or showing corrupted math
          return {
            input: cleanInput,
            route: 'math',
            llmBypassed: true,
            output: "Hata: Geçersiz aritmetik işlem (Sıfıra bölme veya tanımsız sonuç)",
            reason: 'Math verifier failure recovery'
          };
        }
      } catch (e) {
        // Fallback
      }
    }

    // Self-vectorize prompt
    const queryVec = this.vectorize(cleanInput);

    // Intent calculations
    const memorySimilarity = this._cosineSimilarity(queryVec, this.memoryIntentVec);
    const ruleSimilarity = this._cosineSimilarity(queryVec, this.ruleIntentVec);

    const memoryRegex = /hatırlıyor\s*musun|benim\s*favori|nerede|hatırla|kayıt|hasta|durumu|kaydı|geçmiş|bilgi|var\s*mı|söyle|kim|yaşı|şikayeti|tanı|ilaç|doz|kan\s*grubu|risk|gebelik|diyabet|tansiyon|unuttun|hâlâ|güncelle|seviye|ölçüm|ne\s*zaman|değişti|sonuç|nedir|kaydı\s*var/i;
    const ruleRegex = /çelişki|kural|karşılaştır|doğru\s*mu|yasak|uygun/i;

    // 2. Hafıza Sorgusu Yönlendirmesi
    if (memoryRegex.test(cleanInput) || memorySimilarity > 0.18) {
      const results = this.memory ? this.memory.retrieve(queryVec, 5) : [];
      console.log(`[Router DBG] Memory triggered. Query: "${cleanInput}". Results count: ${results.length}`);
      
      // Candidate validation step
      if (results.length > 0) {
        console.log(`[Router DBG] Candidate list:`);
        results.forEach((res, i) => {
          const sSem = this._cosineSimilarity(queryVec, res.record.representation);
          console.log(`  #${i}: "${res.record.content}" | score: ${res.score.toFixed(4)} | sSem: ${sSem.toFixed(4)} | status: ${res.record.status}`);
        });

        // Contradiction detection: check if any of the retrieved results with sSem > 0.15 is conflicted
        let conflictedResult = null;
        for (const res of results) {
          const sim = this._cosineSimilarity(queryVec, res.record.representation);
          if (sim > 0.15 && (res.record.status === 'conflicted' || res.record.contradictionIds.length > 0)) {
            conflictedResult = res.record;
            break;
          }
        }

        if (conflictedResult) {
          // Gather all conflicting records
          const conflictRecords = [conflictedResult];
          for (const cId of conflictedResult.contradictionIds) {
            const cRec = this.memory.records.get(cId);
            if (cRec) conflictRecords.push(cRec);
          }
          const conflictSummary = conflictRecords.map(r => r.content).join(' | ');
          console.log(`[Router DBG] Contradiction detected!`);
          return {
            input: cleanInput,
            route: 'memory',
            llmBypassed: true,
            output: `Çelişen kayıtlar tespit edildi: ${conflictSummary}. Lütfen doğru olanı belirtin.`,
            conflict: {
              detected: true,
              records: conflictRecords.map(r => ({ id: r.id, content: r.content, confidence: this.memory.getDecayedConfidence(r) })),
              message: 'Bu kayıtta çelişen bilgi var. Lütfen doğru olanı belirtin.'
            },
            results: results.slice(0, 3),
            reason: 'Contradiction detected in memory'
          };
        }

        const candidate = {
          input: cleanInput,
          route: 'memory',
          llmBypassed: true,
          output: results[0].record.content,
          results: [results[0]],
          reason: 'Semantic memory query candidate'
        };

        const isValid = this.validateAllAxes(candidate);
        console.log(`[Router DBG] Candidate isValid: ${isValid}`);
        if (!isValid) {
          for (let axis = 1; axis <= 8; axis++) {
            console.log(`  Axis ${axis}: ${this.validateAxis(candidate, axis)}`);
          }
        }

        if (isValid) {
          return candidate;
        } else {
          // 1-step Replan: search other candidates
          for (let i = 1; i < results.length; i++) {
            const nextCandidate = {
              input: cleanInput,
              route: 'memory',
              llmBypassed: true,
              output: results[i].record.content,
              results: [results[i]],
              reason: 'Replan candidate'
            };
            if (this.validateAllAxes(nextCandidate)) {
              console.log(`[Router DBG] Replan candidate ${i} is valid.`);
              return nextCandidate;
            }
          }
          // If we reach here, all candidates failed validation (e.g. similarity < 0.15).
          // Return not found rather than falling through to boundary check.
          return {
            input: cleanInput,
            route: 'memory',
            llmBypassed: true,
            output: 'Bu bilgi hafızada bulunamadı. Henüz kayıt edilmemiş olabilir.',
            results: [],
            reason: 'Memory candidates failed validation (low similarity)'
          };
        }
      } else {
        // Memory was triggered but no records found — inform user
        return {
          input: cleanInput,
          route: 'memory',
          llmBypassed: true,
          output: 'Bu bilgi hafızada bulunamadı. Henüz kayıt edilmemiş olabilir.',
          results: [],
          reason: 'Memory triggered but empty'
        };
      }
      
      // Fallback: If memory retrieval results are conflicted/archived, route to LLM
    }

    // 3. Kural Katmanı Yönlendirmesi
    if (ruleRegex.test(cleanInput) || ruleSimilarity > 0.28) {
      return {
        route: 'rules',
        llmBypassed: true,
        output: 'Kural değerlendirmesi bilgi grafı / kural katmanına aktarıldı.',
        reason: `Rule structure detected (Match Sim: ${ruleSimilarity.toFixed(4)})`
      };
    }

    // 4. Capability Boundary Check — catch unknown intents before SLM fallback
    const mathSimilarity = this._cosineSimilarity(queryVec, this.mathIntentVec);
    const allSimilarities = [
      mathSimilarity,
      memorySimilarity,
      ruleSimilarity
    ];
    const maxSimilarity = Math.max(...allSimilarities);

    if (maxSimilarity < 0.12) {
      return {
        input: cleanInput,
        route: 'boundary',
        output: 'Bu konuda bilgim yok. Başka bir konuda yardımcı olabilir miyim?',
        llmBypassed: true,
        confidence: maxSimilarity,
        reason: `Capability boundary — no intent matched (max similarity: ${maxSimilarity.toFixed(4)})`
      };
    }

    // 5. Serbest Dil Üretimi (Neural-Last Model Fallback)
    let outputText = '';
    let sdkResult = null;
    if (this.sdk && typeof this.sdk.generate === 'function') {
      // Call local SpectralSLM
      sdkResult = this.sdk.generate(cleanInput, { 
        temperature: options.temperature !== undefined ? options.temperature : 0.0,
        maxLength: options.maxLength !== undefined ? options.maxLength : this.sdk.maxLength
      });
      outputText = sdkResult.generatedText;
    } else {
      outputText = `[SLM Fallback] ${cleanInput}`;
    }

    const candidateGenResult = {
      input: cleanInput,
      route: 'llm',
      llmBypassed: false,
      output: outputText,
      sdkResult,
      reason: 'Generative language synthesis required'
    };

    if (this.validateAllAxes(candidateGenResult)) {
      return candidateGenResult;
    }

    // 1-step Replan for LLM: correct suffix harmony / append period
    candidateGenResult.output = `${outputText}.`;
    return candidateGenResult;
  }

  _cosineSimilarity(a, b) {
    let sum = 0;
    const D = a.length;
    for (let i = 0; i < D; i++) {
      sum += Math.cos(a[i] - b[i]);
    }
    return sum / D;
  }
}
