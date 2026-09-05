/**
 * M4 Living Resonance Memory Engine
 * Core holographic memory system with Hebbian reinforcement, dynamic decay, 
 * multi-factor scoring, contradiction engine, and non-blocking asynchronous persistence.
 * Uses 4-Table Multi-Probe LSH indexing with Uint32Array-like index pointers for RAM optimization.
 */

import fs from 'fs';
import { SpectralEngine } from './spectral.js';

export class MemoryEngine {
  /**
   * @param {Object} config
   * @param {number} [config.alpha=0.3] - Reinforcement saturating factor
   * @param {number} [config.lambda=0.01] - Base decay rate per hour
   * @param {number} [config.ws=0.4] - Semantic similarity weight
   * @param {number} [config.wr=0.2] - Spectral resonance weight
   * @param {number} [config.wc=0.1] - Confidence weight
   * @param {number} [config.wf=0.1] - Reinforcement frequency weight
   * @param {number} [config.wd=0.1] - Decay penalty weight
   * @param {number} [config.wx=0.1] - Contradiction penalty weight
   */
  constructor(config = {}) {
    this.records = new Map();
    this.recordsList = [];
    this.spectral = new SpectralEngine();

    this.alpha = config.alpha !== undefined ? config.alpha : 0.3;
    this.lambda = config.lambda !== undefined ? config.lambda : 0.01;

    // Multi-factor weights
    this.ws = config.ws !== undefined ? config.ws : 0.4;
    this.wr = config.wr !== undefined ? config.wr : 0.2;
    this.wc = config.wc !== undefined ? config.wc : 0.1;
    this.wf = config.wf !== undefined ? config.wf : 0.1;
    this.wd = config.wd !== undefined ? config.wd : 0.1;
    this.wx = config.wx !== undefined ? config.wx : 0.1;

    // LSH Settings
    this.numTables = 4;
    this.numProjections = 8;
    this.tablesProjections = null;
    this.tablesBuckets = null;
    
    // Dedicated registry for high-priority records to ensure exact recall without O(N) scanning
    this.highPriorityRecords = new Map();

    this._saveTimeout = null;
    this._savePromise = Promise.resolve();
  }

  _initLSH(D) {
    this.D = D;
    this.tablesProjections = [];
    this.tablesBuckets = [];
    for (let t = 0; t < this.numTables; t++) {
      const projections = [];
      for (let i = 0; i < this.numProjections; i++) {
        const vec = new Float32Array(D);
        for (let j = 0; j < D; j++) {
          vec[j] = Math.random() * 2.0 - 1.0;
        }
        projections.push(vec);
      }
      this.tablesProjections.push(projections);
      // Initialize 256 buckets for the 8-bit hash keys
      this.tablesBuckets.push(Array.from({ length: 256 }, () => []));
    }
  }

  _hash(vector, tableIndex) {
    let hash = 0;
    const projections = this.tablesProjections[tableIndex];
    for (let i = 0; i < this.numProjections; i++) {
      let dot = 0.0;
      const p = projections[i];
      for (let j = 0; j < this.D; j++) {
        dot += vector[j] * p[j];
      }
      if (dot > 0.0) {
        hash |= (1 << i);
      }
    }
    return hash;
  }

  /**
   * Add a new MemoryRecord and index it in the LSH tables
   * @param {Object} item
   * @returns {Object} Added memory record
   */
  addRecord(item) {
    const t = Date.now();
    const id = item.id || Math.random().toString(36).substring(2, 11);
    
    let repr = item.representation;
    if (!repr || repr.length === 0) {
      repr = new Float32Array(this.D || 8192);
    } else if (!(repr instanceof Float32Array)) {
      repr = new Float32Array(repr);
    }

    const record = {
      id,
      representation: repr,
      content: item.content,
      confidence: item.confidence !== undefined ? item.confidence : 1.0,
      reinforcement: item.reinforcement !== undefined ? item.reinforcement : 1,
      createdAt: item.createdAt || t,
      lastAccessedAt: item.lastAccessedAt || t,
      lastReinforcedAt: item.lastReinforcedAt || t,
      source: item.source || 'user',
      sourceType: item.sourceType || 'user',
      status: item.status || 'active',
      contradictionIds: item.contradictionIds || [],
      priority: item.priority || 'normal' // Support priority field
    };
    
    const recordIndex = this.recordsList.length;
    this.recordsList.push(record);
    this.records.set(id, record);

    if (record.priority === 'high') {
      this.highPriorityRecords.set(id, recordIndex);
    }

    if (!this.tablesProjections) {
      this._initLSH(record.representation.length);
    }

    // Index using numerical pointers in all 4 LSH tables to minimize RAM overhead
    for (let t = 0; t < this.numTables; t++) {
      const hash = this._hash(record.representation, t);
      this.tablesBuckets[t][hash].push(recordIndex);
    }

    // Auto-check for contradiction
    this._checkAndFlagContradictions(record);

    return record;
  }

  /**
   * Reinforce a memory record using saturating Hebbian confidence updates
   * @param {string} id - Record ID
   * @param {number} [alpha=this.alpha] - Custom alpha
   */
  reinforce(id, alpha = this.alpha) {
    const record = this.records.get(id);
    if (!record) return;

    const t = Date.now();
    const currentC = this.getDecayedConfidence(record, t);
    
    record.confidence = currentC + alpha * (1.0 - currentC);
    record.reinforcement += 1;
    record.lastReinforcedAt = t;
  }

  /**
   * Get dynamically decayed confidence at a specific timestamp
   * @param {Object} record
   * @param {number} [currentTime=Date.now()]
   * @returns {number} Decayed confidence in [0.0, 1.0]
   */
  getDecayedConfidence(record, currentTime = Date.now()) {
    const dtMs = currentTime - record.lastReinforcedAt;
    const dtHours = dtMs / (1000 * 3600);
    
    const logReinforce = Math.log2(record.reinforcement + 1);
    const effLambda = this.lambda / (logReinforce || 1.0);
    
    return record.confidence * Math.exp(-effLambda * dtHours);
  }

  /**
   * Set dynamic contradiction status on two conflicting memory records
   * @param {string} idA
   * @param {string} idB
   */
  flagContradiction(idA, idB) {
    const recA = this.records.get(idA);
    const recB = this.records.get(idB);
    if (recA && recB) {
      if (!recA.contradictionIds.includes(idB)) recA.contradictionIds.push(idB);
      if (!recB.contradictionIds.includes(idA)) recB.contradictionIds.push(idA);
      recA.status = 'conflicted';
      recB.status = 'conflicted';
    }
  }

  /**
   * Retrieve matched memory candidates using Multi-Table LSH and Multi-Probe Hamming search
   * @param {Float32Array} queryRepr - Query FHRR vector
   * @param {number} [limit=5]
   * @param {number} [currentTime=Date.now()]
   * @returns {Array} List of matched candidates and scores
   */
  retrieve(queryRepr, limit = 5, currentTime = Date.now()) {
    const D = queryRepr.length;
    if (!this.tablesProjections) {
      this._initLSH(D);
    }

    // Gather candidate index pointers from all 4 tables + 8 Hamming neighbors (Multi-probe)
    const candidateIndices = new Set();
    
    // 1. High-Priority Injection: Always search high-priority records directly (exact search on small subset)
    for (const [id, recordIndex] of this.highPriorityRecords.entries()) {
      candidateIndices.add(recordIndex);
    }

    let lshFoundCount = 0;
    for (let t = 0; t < this.numTables; t++) {
      const queryHash = this._hash(queryRepr, t);
      
      // Query bucket
      const bucket = this.tablesBuckets[t][queryHash];
      for (let i = 0; i < bucket.length; i++) {
        candidateIndices.add(bucket[i]);
        lshFoundCount++;
      }
      
      // Multi-probe neighbors (Hamming distance <= 1)
      for (let bit = 0; bit < this.numProjections; bit++) {
        const neighborHash = queryHash ^ (1 << bit);
        const neighborBucket = this.tablesBuckets[t][neighborHash];
        for (let i = 0; i < neighborBucket.length; i++) {
          candidateIndices.add(neighborBucket[i]);
          lshFoundCount++;
        }
      }
    }

    // 2. Exact Fallback Conditions (triggered via OR condition):
    // Trigger A: LSH yielded no general candidates (excluding high-priority injection)
    // Trigger B: Highest decayed confidence C among current candidates is < 0.45
    let fallbackTriggered = false;
    if (lshFoundCount === 0) {
      fallbackTriggered = true;
    } else {
      let maxC = -1;
      let maxSim = -1;
      for (const idx of candidateIndices) {
        const record = this.recordsList[idx];
        const C = this.getDecayedConfidence(record, currentTime);
        if (C > maxC) maxC = C;
        const sim = this._cosineSimilarity(queryRepr, record.representation);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxC < 0.45 || maxSim < 0.35) {
        fallbackTriggered = true;
      }
    }

    let indicesToSearch = candidateIndices;
    if (fallbackTriggered) {
      indicesToSearch = new Set(Array.from({ length: this.recordsList.length }, (_, i) => i));
    }

    const results = [];
    const specQuery = this.spectral.spectralTransform({ type: 'real', values: queryRepr, D });

    for (const idx of indicesToSearch) {
      const record = this.recordsList[idx];
      
      const sSem = this._cosineSimilarity(queryRepr, record.representation);
      const specRecord = record.spectralTransform || (record.spectralTransform = this.spectral.spectralTransform({ type: 'real', values: record.representation, D }));
      const sRes = this.spectral.spectralSimilarity(specQuery, specRecord);
      const C = this.getDecayedConfidence(record, currentTime);
      const F = Math.min(1.0, Math.log10(record.reinforcement + 1));
      const D_penalty = record.confidence - C;
      const X = (record.status === 'conflicted' || record.contradictionIds.length > 0) ? 1.0 : 0.0;

      const score = this.ws * sSem + this.wr * sRes + this.wc * C + this.wf * F - this.wd * D_penalty - this.wx * X;

      results.push({ record, score });
    }

    results.sort((a, b) => b.score - a.score);
    const sliced = results.slice(0, limit);
    for (const item of sliced) {
      item.record.lastAccessedAt = currentTime;
    }

    return sliced.map(item => ({
      record: item.record,
      score: item.score
    }));
  }

  /**
   * Non-blocking debounced save to file system
   * @param {string} filePath
   */
  saveToFile(filePath) {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    
    const data = [];
    for (const record of this.recordsList) {
      data.push({
        id: record.id,
        representation: Array.from(record.representation),
        content: record.content,
        confidence: record.confidence,
        reinforcement: record.reinforcement,
        createdAt: record.createdAt,
        lastAccessedAt: record.lastAccessedAt,
        lastReinforcedAt: record.lastReinforcedAt,
        source: record.source,
        sourceType: record.sourceType,
        status: record.status,
        contradictionIds: record.contradictionIds
      });
    }

    this._savePromise = new Promise((resolve) => {
      this._saveTimeout = setTimeout(async () => {
        try {
          await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
          console.error("MemoryEngine: Asynchronous write failed:", e.message);
        }
        resolve();
      }, 50);
    });
  }

  /**
   * Load memory records synchronously and rebuild LSH tables
   * @param {string} filePath
   */
  loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      this.records.clear();
      this.recordsList = [];
      this.tablesProjections = null;
      this.tablesBuckets = null;
      
      for (const item of data) {
        this.addRecord({
          id: item.id,
          representation: new Float32Array(item.representation),
          content: item.content,
          confidence: item.confidence,
          reinforcement: item.reinforcement,
          createdAt: item.createdAt,
          lastAccessedAt: item.lastAccessedAt,
          lastReinforcedAt: item.lastReinforcedAt,
          source: item.source,
          sourceType: item.sourceType,
          status: item.status,
          contradictionIds: item.contradictionIds
        });
      }
    } catch (e) {
      console.error("MemoryEngine: Failed to load from file:", e.message);
    }
  }

  _cosineSimilarity(a, b) {
    let sum = 0;
    const D = a.length;
    for (let i = 0; i < D; i++) {
      sum += Math.cos(a[i] - b[i]);
    }
    return sum / D;
  }

  _checkAndFlagContradictions(record) {
    if (this.recordsList.length <= 1) return;
    const existingResults = this.retrieve(record.representation, 3);
    for (const existing of existingResults) {
      const sim = this._cosineSimilarity(record.representation, existing.record.representation);
      const isContra = this._isContradictory(record.content, existing.record.content);
      if (sim > 0.35 && existing.record.id !== record.id && existing.record.content !== record.content) {
        if (isContra) {
          this.flagContradiction(record.id, existing.record.id);
        }
      }
    }
  }

  _isContradictory(t1, t2) {
    const getBloodType = (t) => {
      if (t.includes('a pozitif') || t.includes('a+') || t.includes('a poz')) return 'A+';
      if (t.includes('b negatif') || t.includes('b-') || t.includes('b neg')) return 'B-';
      if (t.includes('0') || t.includes('sıfır')) return '0';
      if (t.includes('ab')) return 'AB';
      return null;
    };
    const getRisk = (t) => {
      if (t.includes('yüksek') || t.includes('riskli')) return 'high';
      if (t.includes('normal') || t.includes('düşük') || t.includes('risk yok')) return 'normal';
      return null;
    };
    
    const l1 = t1.toLowerCase();
    const l2 = t2.toLowerCase();
    
    if ((l1.includes('kan grubu') || l1.includes('grubu')) && (l2.includes('kan grubu') || l2.includes('grubu'))) {
      const b1 = getBloodType(l1);
      const b2 = getBloodType(l2);
      if (b1 && b2 && b1 !== b2) return true;
    }
    
    if (l1.includes('risk') && l2.includes('risk')) {
      const r1 = getRisk(l1);
      const r2 = getRisk(l2);
      if (r1 && r2 && r1 !== r2) return true;
    }
    
    if ((l1.includes('tansiyon') || l1.includes('basıncı')) && (l2.includes('tansiyon') || l2.includes('basıncı'))) {
      const nums1 = l1.match(/\d+/g);
      const nums2 = l2.match(/\d+/g);
      if (nums1 && nums2 && nums1[0] !== nums2[0]) return true;
    }
    
    return false;
  }

  resolveConflict(winnerId, loserId) {
    const winner = this.records.get(winnerId);
    const loser = this.records.get(loserId);
    
    if (winner) {
      const t = Date.now();
      const currentC = this.getDecayedConfidence(winner, t);
      winner.confidence = Math.min(1.0, currentC + 0.3 * (1.0 - currentC));
      winner.status = 'active';
      winner.contradictionIds = [];
      winner.lastReinforcedAt = t;
    }
    
    if (loser) {
      loser.confidence = 0.0;
      loser.status = 'rejected';
      loser.contradictionIds = [];
    }
  }
}
