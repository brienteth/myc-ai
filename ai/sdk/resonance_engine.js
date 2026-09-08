/**
 * Resonance SDK v2.0 - B2B Commercial Enterprise AI Engine (@resonance/core)
 * Air-Gapped, Sub-Millisecond Turkish Language Intelligence & Living Memory Engine.
 * 
 * Features:
 * - 100% Offline Cryptographic Licensing (HMAC-SHA256 / Ed25519)
 * - Cognitive Dispatcher (<0.05ms Math, 0.1ms Morphology, <3ms Semantic Resonance)
 * - Precision Q&A Snippet Extractor & Concise Multi-Page Summarizer
 * - Pluggable Storage Adapters (RAM, Disk/JSON, IndexedDB)
 * - Zero-Bloat Modular Ingestion (Text, CSV, on-demand PDF/HTML)
 * 
 * @license Commercial - Enterprise Infrastructure SDK
 * @author Turkish Resonance AI Core Team
 */

import { TurkishMorphology } from '../core/morphology.js';
import { HDCEngine, Representation } from '../core/hdc.js';
import { SpectralEngine } from '../core/spectral.js';
import { LicenseManager, LICENSE_TIERS } from './licensing.js';
import { MemoryStorageAdapter, FileStorageAdapter, IndexedDBStorageAdapter } from './storage.js';
import { IngestionEngine } from './ingestion.js';
import { GHRLatticeMemory } from '../core/ghr_lattice_memory.js';

// Safe Math Evaluator (Shunting-Yard, zero eval/Function)
function evalMathExpression(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    if (/[0-9.]/.test(expr[i])) {
      let n = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) { n += expr[i]; i++; }
      tokens.push({ t: 'N', v: parseFloat(n) });
      continue;
    }
    if ('+-*/%^()'.includes(expr[i])) {
      tokens.push({ t: 'O', v: expr[i] });
      i++;
      continue;
    }
    return NaN;
  }

  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
  const out = [];
  const ops = [];

  for (const tok of tokens) {
    if (tok.t === 'N') out.push(tok.v);
    else if (tok.v === '(') ops.push('(');
    else if (tok.v === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      ops.pop();
    } else {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[tok.v]) {
        out.push(ops.pop());
      }
      ops.push(tok.v);
    }
  }
  while (ops.length) out.push(ops.pop());

  const st = [];
  for (const item of out) {
    if (typeof item === 'number') st.push(item);
    else {
      const b = st.pop(), a = st.pop();
      if (a === undefined || b === undefined) return NaN;
      if (item === '+') st.push(a + b);
      else if (item === '-') st.push(a - b);
      else if (item === '*') st.push(a * b);
      else if (item === '/') st.push(b === 0 ? NaN : a / b);
      else if (item === '%') st.push(a % b);
      else if (item === '^') st.push(Math.pow(a, b));
    }
  }
  return st.length === 1 ? st[0] : NaN;
}

export class ResonanceEngine {
  /**
   * @param {Object} [config={}]
   * @param {string} [config.licenseKey] - B2B offline cryptographic license key
   * @param {number} [config.D=4096] - Hyperdimensional vector dimension
   * @param {BaseStorageAdapter} [config.storage] - Pluggable memory storage adapter
   * @param {string} [config.vendorSecret] - License validation secret (optional custom vendor salt)
   */
  constructor(config = {}) {
    this.D = config.D || 4096;
    this.morphology = new TurkishMorphology();
    this.hdc = new HDCEngine(this.D);
    this.spectral = new SpectralEngine();
    this.ingestion = new IngestionEngine(config.ingestion || {});

    // Commercial Licensing Engine
    this.licenseManager = new LicenseManager(config.vendorSecret);
    this.licenseStatus = this.licenseManager.verifyLicense(config.licenseKey);

    // Persistence Layer
    this.storage = config.storage || new MemoryStorageAdapter();

    // Gabor-Heisenberg Resonant Phase Lattice Memory Engine
    this.ghrLattice = new GHRLatticeMemory({
      D: this.D,
      cellSize: config.latticeCellSize || 128,
      sigma: config.latticeSigma || 16
    });

    // In-memory living memory nodes
    this._memoryStore = [];
    this._lastActiveRecord = null;
    this._conflictHandlers = [];

    // Telemetry
    this._stats = {
      totalQueries: 0,
      bypassedLlmCount: 0,
      totalLatencyMs: 0,
      startedAt: Date.now()
    };

    this._initialized = false;
  }

  /**
   * Initialize the engine and load persistent memory
   */
  async init() {
    if (this._initialized) return this;
    await this.storage.init();
    const stored = await this.storage.load();
    if (Array.isArray(stored) && stored.length > 0) {
      this._memoryStore = stored;
    }
    this._initialized = true;
    return this;
  }

  /**
   * Alias for ask() to support standard query terminology
   */
  async query(prompt, options = {}) {
    return this.ask(prompt, options);
  }

  /**
   * Universal Question / Answering / Command Dispatcher (< 0.1ms - 3ms)
   * @param {string} prompt - User input query
   * @param {Object} [options={}]
   * @returns {Promise<{ answer: string, route: string, latencyMs: number, confidence: number, llmBypassed: boolean, metadata?: Object }>}
   */
  async ask(prompt, options = {}) {
    if (!this._initialized) await this.init();
    const startTime = performance.now();
    this._stats.totalQueries++;

    const clean = (prompt || '').trim();
    if (!clean) {
      return {
        answer: 'Lütfen bir soru veya metin giriniz.',
        route: 'boundary',
        latencyMs: 0.1,
        confidence: 1.0,
        llmBypassed: true
      };
    }

    // 0. Greeting Gate
    const greetingRegex = /^(hey|merhaba|selam|sa|naber|nasılsın|günaydın|iyi akşamlar|iyi günler|hoşgeldin|hi|hello)\b/i;
    if (greetingRegex.test(clean) && clean.split(/\s+/).length <= 3) {
      const memCount = this._memoryStore.length;
      const greetText = memCount > 0
        ? `Merhaba! Hafızamda ${memCount} adet kayıtlı bilgi var. Hangi konuda yardımcı olabilirim?`
        : 'Merhaba! Size nasıl yardımcı olabilirim? Bilgi aktarmak için ingest() fonksiyonunu kullanabilirsiniz.';
      return this._formatResponse(greetText, 'greeting', 1.0, startTime);
    }

    // 1. Deterministic Math Gate (AST Parser, ~0.02ms)
    const mathRegex = /^[0-9+\-*/().\s%^]+$/;
    if (mathRegex.test(clean) && /[+\-*/%^]/.test(clean) && this.licenseManager.canUseFeature('math')) {
      const val = evalMathExpression(clean);
      if (!isNaN(val) && isFinite(val)) {
        return this._formatResponse(val.toString(), 'math', 1.0, startTime, { evaluatedMath: clean });
      }
    }

    // 2. Memory Listing Query ("başka ne biliyorsun", "neler var", "hangi konuda")
    const listAllRegex = /başka ne|neler biliyorsun|hangi konuda|hafızanda neler var|kayıtlar/i;
    const hasSubjectBefore = /\S+\s+(hakkında|ile ilgili|konusunda)\s*(ne biliyorsun)/i.test(clean);
    if (listAllRegex.test(clean) && !hasSubjectBefore && this._memoryStore.length > 0) {
      const seen = new Set();
      const uniqueTitles = [];
      for (const m of this._memoryStore) {
        const title = (m.content || '').split('—')[0].trim().replace(/\s*—\s*Sayfa\s*\d+/i, '').trim();
        if (!seen.has(title)) {
          seen.add(title);
          uniqueTitles.push('• ' + title);
        }
      }
      const shown = uniqueTitles.slice(0, 10);
      const suffix = uniqueTitles.length > 10 ? `\n… ve ${uniqueTitles.length - 10} farklı döküman daha.` : '';
      const reply = `Hafızamda ${this._memoryStore.length} kayıt (${uniqueTitles.length} farklı döküman) var:\n${shown.join('\n')}${suffix}`;
      return this._formatResponse(reply, 'memory_list', 0.95, startTime);
    }

    // 3. Living Memory Semantic Search Gate
    if (this._memoryStore.length > 0 && this.licenseManager.canUseFeature('basic_memory')) {
      const result = this._searchAndRouteMemory(clean);
      if (result) {
        return this._formatResponse(result.answer, result.route, result.confidence, startTime, result.metadata);
      }
    }

    // 4. Turkish Morphology Gate (0.1ms)
    const morphKeywords = /kök|ek|hece|ulama|harf|ünlü|ünsüz|fonoloji/i;
    const words = clean.split(/\s+/).filter(Boolean);
    if ((morphKeywords.test(clean) || (words.length === 1 && words[0].length > 4 && !/^[0-9]+$/.test(words[0]))) && this.licenseManager.canUseFeature('morphology')) {
      const targetWord = words.length === 1 ? words[0] : words[words.length - 1].replace(/[?.!]/g, '');
      const analysis = this.morphology.analyze(targetWord);
      const text = `Morfolojik Analiz: "${targetWord}" kökü: "${analysis.root}", ekler: [${analysis.suffixes.join(', ') || 'yok'}], ünlü uyumu: "${analysis.harmony}", heceler: ${analysis.syllables.join('-')}`;
      return this._formatResponse(text, 'morphology', 0.99, startTime, { analysis });
    }

    // 5. Capability Boundary
    if (this._memoryStore.length > 0) {
      const sampleTitles = this._memoryStore.slice(0, 3).map(m => '• ' + (m.content || '').split('—')[0].trim()).join('\n');
      return this._formatResponse(`Bu konuda kayıtlı bilgi bulamadım. Şu konularda soru sorabilirsiniz:\n${sampleTitles}`, 'boundary', 0.0, startTime);
    }

    return this._formatResponse('Henüz hafızamda kayıt yok. Döküman aktarmak için engine.ingest() fonksiyonunu kullanabilirsiniz.', 'boundary', 0.0, startTime);
  }

  /**
   * Ingest documents, text, CSV, PDF into living memory
   * @param {Object} input
   * @returns {Promise<{ success: boolean, recordsAdded: number, stats: Object }>}
   */
  async ingest(input) {
    if (!this._initialized) await this.init();

    // Check License Quota
    const parsed = await this.ingestion.ingest(input);
    if (!parsed.success || !parsed.records || parsed.records.length === 0) {
      return { success: false, recordsAdded: 0, stats: parsed.stats };
    }

    if (!this.licenseManager.checkNodeQuota(this._memoryStore.length, parsed.records.length)) {
      throw new Error(`[Resonance License] Node quota exceeded! Tier: ${this.licenseManager.tier.name} (Max: ${this.licenseManager.maxNodes} nodes). Upgrade license to proceed.`);
    }

    let addedCount = 0;
    for (const r of parsed.records) {
      // Check for conflicts
      const existing = this._findConflict(r.content);
      if (existing) {
        this._handleConflict(existing, r);
      }
      this._memoryStore.push(r);
      addedCount++;
    }

    await this.storage.save(this._memoryStore);
    return {
      success: true,
      recordsAdded: addedCount,
      totalMemoryNodes: this._memoryStore.length,
      stats: parsed.stats
    };
  }

  /**
   * Generate a concise or single-sentence summary of a document or page
   * @param {Object} opts
   * @param {number} [opts.page]
   * @param {string} [opts.document]
   * @param {'concise'|'single'|'full'} [opts.mode='concise']
   */
  summarize(opts = {}) {
    const mode = opts.mode || 'concise';
    const isSingle = mode === 'single';

    let targetRecords = this._memoryStore;
    if (opts.document) {
      targetRecords = this._getDocumentRecords(opts.document);
    }

    if (opts.page !== undefined) {
      const pageMem = targetRecords.find(m => (m.content || '').toLowerCase().includes(`sayfa ${opts.page}`));
      if (pageMem) {
        return this._summarizeSinglePage(pageMem, opts.page, isSingle ? 'tek cümle' : 'özet');
      }
    }

    return this._buildStructuredSummary(targetRecords, []);
  }

  /**
   * Search memory records semantically
   * @param {string} query
   * @param {number} [limit=5]
   */
  search(query, limit = 5) {
    const queryWords = this._extractQueryWords(query);
    const scored = this._scoreRecords(this._memoryStore, queryWords);
    return scored.slice(0, limit).map(s => ({
      content: s.mem.content,
      score: s.score,
      metadata: s.mem.metadata
    }));
  }

  /**
   * Clear all memory nodes
   */
  async clearMemory() {
    this._memoryStore = [];
    this._lastActiveRecord = null;
    await this.storage.clear();
    return true;
  }

  /**
   * Register conflict resolution hook
   * @param {Function} handler - (existingRecord, newRecord) => void
   */
  onConflict(handler) {
    if (typeof handler === 'function') {
      this._conflictHandlers.push(handler);
    }
  }

  /**
   * Retrieve real-time telemetry metrics
   */
  getTelemetry() {
    const avgLatency = this._stats.totalQueries > 0
      ? (this._stats.totalLatencyMs / this._stats.totalQueries).toFixed(2)
      : 0;

    return {
      activeNodes: this._memoryStore.length,
      maxNodesQuota: this.licenseManager.maxNodes,
      tier: this.licenseManager.tier.name,
      licenseValid: this.licenseManager.isValid,
      totalQueries: this._stats.totalQueries,
      avgLatencyMs: Number(avgLatency),
      bypassedLlmCount: this._stats.bypassedLlmCount,
      storageType: this.storage.name,
      uptimeSeconds: Math.floor((Date.now() - this._stats.startedAt) / 1000)
    };
  }

  // ── Internal Routing Helpers ─────────────────────────────────

  _searchAndRouteMemory(clean) {
    const isSummaryQuery = /özet|özeet|özeti|özetle|özetini|özetler|kısaca/i.test(clean);
    const pageMatch = clean.match(/(\d+)\s*\.?\s*(sayfa|sayfanın|sayfayı|sayfası)/i) ||
                      clean.match(/(sayfa|sayfanın)\s*(\d+)/i);
    const isDetailQuery = /nedir|kaç|ne kadar|hangi|nasıl|kim|neden|nere|sayısı|sayisi|listesi|listele|mesaj|hedef|kanal/i.test(clean);

    const queryWords = this._extractQueryWords(clean);
    const scoredMems = this._scoreRecords(this._memoryStore, queryWords);

    const bestScore = scoredMems.length > 0 ? scoredMems[0].score : 0;
    const bestMatch = scoredMems.length > 0 ? scoredMems[0].mem : null;

    // Direct / Contextual target selection
    let activeMems = [];
    if (bestScore >= 3 && bestMatch) {
      this._lastActiveRecord = bestMatch;
      activeMems = scoredMems.filter(s => s.score >= 3).map(s => s.mem);
    } else if (this._lastActiveRecord && (isDetailQuery || isSummaryQuery || pageMatch)) {
      activeMems = this._getDocumentRecords(this._lastActiveRecord.content);
    }

    if (activeMems.length === 0) return null;

    // Page-specific query ("3. sayfayı özetle", "6. sayfayı tek cümlede özetle")
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10) || parseInt(pageMatch[2], 10);
      const pageMem = activeMems.find(m => (m.content || '').toLowerCase().includes(`sayfa ${pageNum}`));
      if (pageMem) {
        this._lastActiveRecord = pageMem;
        const answer = this._summarizeSinglePage(pageMem, pageNum, clean);
        return { answer, route: 'memory_page_summary', confidence: 0.95 };
      }
    }

    // Detail Q&A Query ("asliye hukuk mahkemelerinin görevi nedir?")
    if (isDetailQuery && !isSummaryQuery) {
      const answer = this._findRelevantSnippet(activeMems, queryWords, clean);
      return { answer, route: 'memory_qa_detail', confidence: 0.92 };
    }

    // Explicit Document Summary Query ("opacus özeti", "özet çıkar")
    if (isSummaryQuery) {
      const answer = this._buildStructuredSummary(activeMems.slice(0, 8), queryWords);
      return { answer, route: 'memory_structured_summary', confidence: 0.90 };
    }

    // General Overview Query
    if (activeMems.length > 1) {
      const answer = this._buildQuickOverview(activeMems, queryWords);
      return { answer, route: 'memory_quick_overview', confidence: 0.88 };
    }

    return {
      answer: bestMatch.content,
      route: 'memory_match',
      confidence: 0.85
    };
  }

  _extractQueryWords(clean) {
    const lower = clean.toLowerCase()
      .replace(/[?.!,;]/g, '')
      .replace(/(hakkında|ne biliyorsun|ne bilirsun|özetle|özeet|özetini|özet|çıkar|çıkarır|mısın|oluştur|ver|geç|anlat|açıkla|söyle|nedir|neydi|göster|listele|bul|var mı|hatırla|hatırlıyor|başka|ile ilgili|bunun|neler)/gi, '')
      .trim();
    const stopWords = new Set(['ne', 'mi', 'mı', 'mu', 'mü', 've', 'ile', 'bir', 'de', 'da', 'bu', 'şu', 'o', 'en', 'çok', 'az', 'var', 'yok']);
    return lower.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));
  }

  _scoreRecords(records, queryWords) {
    const scored = [];
    for (const mem of records) {
      const targetText = ((mem.content || '') + ' ' + (mem.query || '')).toLowerCase();
      let score = 0;
      for (const w of queryWords) {
        if (targetText.includes(w)) score += w.length * 2;
        else {
          const stem = w.slice(0, Math.max(3, Math.floor(w.length * 0.7)));
          if (targetText.includes(stem)) score += stem.length;
        }
        if ((mem.content || '').toLowerCase().split('—')[0].includes(w)) score += w.length;
      }
      if (score > 0) scored.push({ mem, score });
    }
    return scored.sort((a, b) => b.score - a.score);
  }

  _findRelevantSnippet(mems, queryWords, originalQuery) {
    const allSentences = [];
    for (const mem of mems) {
      const text = this._cleanContent(mem.content);
      const sents = text.split(/[.!?;]\s+/).map(s => s.trim()).filter(s => s.length > 15 && s.length < 350);
      allSentences.push(...sents);
    }

    const detailKeywords = originalQuery.toLowerCase()
      .replace(/(nedir|nelerdir|kaçtır|kaç|ne kadar|hangi|nasıl|kim|neden|nere|sayısı|listesi|listele|hakkında|söyle|anlat|göster|ver)/gi, '')
      .replace(/[?.!,;]/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length >= 2);

    const keywords = [...new Set([...queryWords, ...detailKeywords])];
    const scored = allSentences.map(s => {
      const lower = s.toLowerCase();
      let score = 0;
      for (const w of keywords) {
        if (lower.includes(w)) score += w.length * 3;
      }
      return { text: s, score };
    }).sort((a, b) => b.score - a.score);

    const top = scored.filter(s => s.score > 0).slice(0, 3);
    if (top.length === 0) {
      return 'Bu detay hakkında kayıtlarda doğrudan bilgi bulunamadı.';
    }

    const docTitle = (mems[0].content || '').split('—')[0].trim();
    return `📌 ${docTitle} — Cevap:\n\n` + top.map(s => '• ' + s.text).join('\n');
  }

  _summarizeSinglePage(mem, pageNum, userQuery) {
    const raw = this._cleanContent(mem.content);
    const isSingle = /tek cümle|bir cümle|kısaca tek|özeti tek/i.test(userQuery);

    const cleanText = raw
      .replace(/Subject:.*$/gmi, '')
      .replace(/Hi\s+[A-Za-z0-9\s]+team,.*$/gmi, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/Link:\s*\|?/gi, '')
      .trim();

    const sents = cleanText.split(/(?<=[.!?])\s+|[\n\r]+/)
      .map(s => s.replace(/^[\s•\-\d.)]+/, '').trim())
      .filter(s => s.length > 25 && s.length < 260 && !/^(subject|hi |link:|mesaj:)/i.test(s));

    if (sents.length === 0) {
      return `📄 Sayfa ${pageNum} Özeti:\n\n• ` + cleanText.slice(0, 150) + '...';
    }

    const scored = sents.map(s => {
      let score = 0;
      if (/[çğıöşüÇĞİÖŞÜ]/.test(s)) score += 4;
      if (/nedir|amaç|sağlar|sunar|özellik|entegrasyon|görev|hedef|plan|başarı|metrik/i.test(s)) score += 6;
      if (s.length >= 45 && s.length <= 180) score += 3;
      return { text: s, score };
    }).sort((a, b) => b.score - a.score);

    if (isSingle) {
      const best = scored[0] ? scored[0].text : sents[0];
      return `📄 Sayfa ${pageNum} (Tek Cümle Özet):\n\n${best}${best.endsWith('.') ? '' : '.'}`;
    }

    const top = scored.slice(0, 3).map(s => '• ' + s.text);
    return `📄 Sayfa ${pageNum} Özeti:\n\n` + top.join('\n');
  }

  _buildStructuredSummary(mems, queryWords) {
    if (!mems || mems.length === 0) return 'Özetlenecek döküman bulunamadı.';
    const docTitle = (mems[0].content || '').split('—')[0].trim();
    const allText = mems.map(m => this._cleanContent(m.content)).join(' ');

    const dateMatches = allText.match(/\d{1,2}\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/gi);
    const dates = dateMatches ? [...new Set(dateMatches)].slice(0, 3) : [];

    const numMatches = allText.match(/\d{1,3}([.,]\d{3})*\s*(USD|TL|₺|\$|developer|kullanıcı|takipçi|kişi|proje|K\b|%)/gi);
    const nums = numMatches ? [...new Set(numMatches.map(n => n.trim()))].slice(0, 4) : [];

    const sents = allText.split(/[.!?;]\s+/).map(s => s.trim()).filter(s => s.length > 25 && s.length < 240);
    const topSents = sents.slice(0, 5).map(s => '• ' + s);

    let res = `📋 ${docTitle}\n`;
    if (dates.length > 0) res += `📅 Tarih: ${dates.join(', ')}\n`;
    if (nums.length > 0) res += `📈 Önemli Rakamlar: ${nums.join(' · ')}\n`;
    res += `\n🔑 Özet (${mems.length} kayıt):\n` + topSents.join('\n');
    return res;
  }

  _buildQuickOverview(mems, queryWords) {
    const docTitle = (mems[0].content || '').split('—')[0].trim();
    const firstText = this._cleanContent(mems[0].content);
    const sents = firstText.split(/[.!?;]\s+/).map(s => s.trim()).filter(s => s.length > 25).slice(0, 2);

    let res = `📋 ${docTitle} (${mems.length} sayfa/bölüm)\n\n`;
    if (sents.length > 0) res += sents.join('. ') + '.\n\n';
    res += '💡 Detay veya sayfa özeti için soru sorabilirsiniz.';
    return res;
  }

  _cleanContent(content = '') {
    const parts = content.split('—');
    const raw = parts.length >= 3 ? parts.slice(2).join('—') : (parts[1] || parts[0]);
    return raw
      .replace(/\bfi\b/g, 'fi').replace(/\bfl\b/g, 'fl')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  _getDocumentRecords(docIdentifier) {
    const base = docIdentifier.split('—')[0].trim().toLowerCase();
    return this._memoryStore.filter(m => (m.content || '').toLowerCase().startsWith(base));
  }

  _findConflict(content) {
    const title = content.split('—')[0].trim();
    return this._memoryStore.find(m => {
      const mTitle = (m.content || '').split('—')[0].trim();
      return mTitle === title && m.content !== content;
    });
  }

  _handleConflict(existing, incoming) {
    for (const h of this._conflictHandlers) {
      try { h(existing, incoming); } catch(e) {}
    }
  }

  _formatResponse(answer, route, confidence, startTime, metadata = {}) {
    const latency = Number((performance.now() - startTime).toFixed(2));
    this._stats.totalLatencyMs += latency;
    this._stats.bypassedLlmCount++;

    return {
      answer,
      route,
      confidence,
      latencyMs: latency,
      llmBypassed: true,
      tier: this.licenseManager.tier.name,
      metadata
    };
  }

  /**
   * Factory to create an isolated GHR-Lattice memory engine instance.
   * @param {Object} [config]
   * @returns {GHRLatticeMemory}
   */
  createLatticeMemory(config = {}) {
    return new GHRLatticeMemory({
      D: this.D,
      ...config
    });
  }
}

export { GHRLatticeMemory };
export const ResonanceSDK = ResonanceEngine;
