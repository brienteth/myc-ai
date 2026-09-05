/**
 * Gabor-Heisenberg Resonant Lattice (GHR-Lattice) Memory Engine
 * 
 * Mathematical Formulation:
 * 1. Heisenberg Minimum Uncertainty Gabor Packets (Gabor Tiles):
 *    g_k(m) = exp(-(dist(m, mu_k)^2) / (2 * sigma^2)) * exp(j * (omega_k * m + theta_{k,m}))
 *    with mu_k = (k * D) / cellSize, omega_k = (2 * PI * k) / cellSize.
 * 2. Exponential cross-talk damping exp(-Delta_omega^2 / 2*sigma^2) between frequency-shifted channels.
 * 3. Distributed cellular resonance (C cells of max cellSize=128 items) with multi-table LSH indexing.
 * 
 * Pure JavaScript, zero external dependencies, high-performance typed arrays.
 */

class DeterministicPRNG {
  constructor(seed = 42) {
    this.s = Math.abs(seed) || 42;
  }
  next() {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return (this.s >>> 8) / 16777216;
  }
}

export class GHRLatticeMemory {
  constructor(config = {}) {
    this.D = config.D || 4096;
    this.cellSize = config.cellSize || 128; // Max facts per cell (within D/20 safe limit)
    this.sigma = config.sigma || 16;        // Optimal Gabor window width for D/cellSize=32
    this.seed = config.seed || 42;
    this.cells = [];                        // Distributed resonator cells
    this.cellCounter = 0;

    // LSH Configuration: 8 tables, 16-bit projections
    this.numTables = config.numTables || 8;
    this.numProjections = config.numProjections || 16;
    this.lshTables = this.initLSH(this.numTables, this.numProjections);

    // Precompute Gabor envelope windows and active support bounds for all channels
    this.windowCache = this._precomputeWindowCache();
  }

  _precomputeWindowCache() {
    const cache = [];
    const twoSigmaSq = 2 * this.sigma * this.sigma;
    const spacing = this.D / this.cellSize; // e.g. 4096 / 128 = 32

    for (let c = 0; c < this.cellSize; c++) {
      const center = Math.round(c * spacing);
      const win = new Float64Array(this.D);
      let normSq = 0;

      for (let m = 0; m < this.D; m++) {
        const d = Math.abs(m - center);
        const dist = Math.min(d, this.D - d);
        const val = Math.exp(-(dist * dist) / twoSigmaSq);
        win[m] = val;
        normSq += val * val;
      }

      const invNorm = 1.0 / (Math.sqrt(normSq) || 1.0);
      for (let m = 0; m < this.D; m++) {
        win[m] *= invNorm;
      }

      // Precompute non-zero support window indices (cutoff at 4 * sigma)
      const supportCutoff = Math.ceil(4 * this.sigma);
      const activeIndices = [];
      for (let m = 0; m < this.D; m++) {
        const d = Math.abs(m - center);
        const dist = Math.min(d, this.D - d);
        if (dist <= supportCutoff) {
          activeIndices.push(m);
        }
      }

      cache.push({
        center,
        window: win,
        activeIndices: new Int32Array(activeIndices)
      });
    }
    return cache;
  }

  // 1. Heisenberg-Gabor Phase Packet Transform
  encodePacket(phases, channelIndex) {
    const packetReal = new Float64Array(this.D);
    const packetImag = new Float64Array(this.D);

    const safeChannel = channelIndex % this.cellSize;
    const { window: win, activeIndices } = this.windowCache[safeChannel];
    const omega = (2 * Math.PI * safeChannel) / this.cellSize;

    for (let idx = 0; idx < activeIndices.length; idx++) {
      const m = activeIndices[idx];
      const totalPhase = omega * m + phases[m];
      const w = win[m];
      packetReal[m] = w * Math.cos(totalPhase);
      packetImag[m] = w * Math.sin(totalPhase);
    }

    return { real: packetReal, imag: packetImag, channel: safeChannel };
  }

  // LSH Initialization
  initLSH(numTables, numProjections) {
    const prng = new DeterministicPRNG(this.seed + 1337);
    const tables = [];

    for (let t = 0; t < numTables; t++) {
      const projections = [];
      for (let p = 0; p < numProjections; p++) {
        const proj = new Float64Array(this.D);
        for (let i = 0; i < this.D; i++) {
          proj[i] = prng.next() * 2 - 1;
        }
        projections.push(proj);
      }
      tables.push({
        projections,
        buckets: new Map() // bucketHash -> array of { cellId, itemId }
      });
    }
    return tables;
  }

  hashVector(phases, tableIndex) {
    const table = this.lshTables[tableIndex];
    let hash = 0;
    for (let p = 0; p < this.numProjections; p++) {
      const proj = table.projections[p];
      let sum = 0;
      for (let i = 0; i < this.D; i += 8) { // 8-stride projection
        sum += Math.cos(phases[i]) * proj[i] + Math.cos(phases[i + 2]) * proj[i + 2];
      }
      if (sum > 0) {
        hash |= (1 << p);
      }
    }
    return hash >>> 0;
  }

  indexLSH(factVector, cellId) {
    for (let t = 0; t < this.numTables; t++) {
      const h = this.hashVector(factVector.phases, t);
      const buckets = this.lshTables[t].buckets;
      let bucket = buckets.get(h);
      if (!bucket) {
        bucket = [];
        buckets.set(h, bucket);
      }
      bucket.push({ cellId, itemId: factVector.id });
    }
  }

  createCell() {
    const cellId = `cell_${this.cellCounter++}`;
    return {
      id: cellId,
      items: [],
      latticeReal: new Float64Array(this.D),
      latticeImag: new Float64Array(this.D),
      centroidReal: new Float64Array(this.D),
      centroidImag: new Float64Array(this.D)
    };
  }

  findOptimalCell(factVector) {
    if (this.cells.length === 0) return null;

    // Search available cell with space and highest centroid affinity
    let bestCell = null;
    let bestAffinity = -Infinity;

    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      if (cell.items.length < this.cellSize) {
        if (cell.items.length === 0) {
          if (!bestCell) bestCell = cell;
        } else {
          let dot = 0;
          const phases = factVector.phases;
          for (let k = 0; k < this.D; k += 16) { // Fast 16-stride centroid preview
            dot += Math.cos(phases[k]) * cell.centroidReal[k] + Math.sin(phases[k]) * cell.centroidImag[k];
          }
          if (dot > bestAffinity) {
            bestAffinity = dot;
            bestCell = cell;
          }
        }
      }
    }

    return bestCell;
  }

  updateCentroid(cell) {
    const n = cell.items.length;
    if (n === 0) return;

    cell.centroidReal.fill(0);
    cell.centroidImag.fill(0);

    for (const it of cell.items) {
      const phases = it.vector.phases;
      for (let k = 0; k < this.D; k++) {
        cell.centroidReal[k] += Math.cos(phases[k]);
        cell.centroidImag[k] += Math.sin(phases[k]);
      }
    }

    let normSq = 0;
    for (let k = 0; k < this.D; k++) {
      cell.centroidReal[k] /= n;
      cell.centroidImag[k] /= n;
      normSq += cell.centroidReal[k] * cell.centroidReal[k] + cell.centroidImag[k] * cell.centroidImag[k];
    }
    const invNorm = 1.0 / (Math.sqrt(normSq) || 1.0);
    for (let k = 0; k < this.D; k++) {
      cell.centroidReal[k] *= invNorm;
      cell.centroidImag[k] *= invNorm;
    }
  }

  // 2. Olgu Ekleme (Dağıtık Hücre Yönetimi)
  insert(factVector, metadata = {}) {
    if (!factVector || !factVector.phases) {
      throw new Error('GHRLatticeMemory.insert requires a vector with .phases');
    }

    let targetCell = this.findOptimalCell(factVector);
    if (!targetCell || targetCell.items.length >= this.cellSize) {
      targetCell = this.createCell();
      this.cells.push(targetCell);
    }

    const channel = targetCell.items.length;
    const packet = this.encodePacket(factVector.phases, channel);

    // Hücre Kafesine Süperpozisyon (Yapıcı Girişim)
    const { activeIndices } = this.windowCache[channel];
    for (let idx = 0; idx < activeIndices.length; idx++) {
      const i = activeIndices[idx];
      targetCell.latticeReal[i] += packet.real[i];
      targetCell.latticeImag[i] += packet.imag[i];
    }

    const item = {
      id: factVector.id,
      vector: factVector,
      metadata,
      channel,
      cellId: targetCell.id,
      weight: 1.0
    };
    targetCell.items.push(item);

    this.updateCentroid(targetCell);
    this.indexLSH(factVector, targetCell.id);

    return item;
  }

  // Candidate cell discovery via LSH + Centroid fallback (Optimized O(1))
  getCandidateCells(queryVector) {
    const cellVotes = new Map();

    for (let t = 0; t < this.numTables; t++) {
      const h = this.hashVector(queryVector.phases, t);
      const bucket = this.lshTables[t].buckets.get(h);
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          cellVotes.set(entry.cellId, (cellVotes.get(entry.cellId) || 0) + 1);
        }
      }
    }

    let candidates = [];
    if (cellVotes.size > 0) {
      const sorted = Array.from(cellVotes.entries()).sort((a, b) => b[1] - a[1]);
      const maxVotes = Math.min(2, sorted.length);
      for (let i = 0; i < maxVotes; i++) {
        const c = this.cells.find(cell => cell.id === sorted[i][0]);
        if (c) candidates.push(c);
      }
    }

    // Centroid affinity fallback only if LSH yielded nothing
    if (candidates.length === 0) {
      const qPhases = queryVector.phases;
      let bestCell = this.cells[0];
      let bestDot = -Infinity;
      for (let c = 0; c < this.cells.length; c++) {
        const cell = this.cells[c];
        let dot = 0;
        for (let k = 0; k < this.D; k += 16) {
          dot += Math.cos(qPhases[k]) * cell.centroidReal[k] + Math.sin(qPhases[k]) * cell.centroidImag[k];
        }
        if (dot > bestDot) {
          bestDot = dot;
          bestCell = cell;
        }
      }
      if (bestCell) candidates.push(bestCell);
    }

    return candidates;
  }

  // 3. Rezonans ile Geri Çağırma (Demodulation & Filter)
  query(queryVector, topK = 1) {
    if (this.cells.length === 0) return [];

    const tStart = performance.now();

    // Adım A: LSH ile en yakın aday hücreleri filtrele (O(1))
    const candidateCells = this.getCandidateCells(queryVector);
    const cellsToScan = candidateCells.slice(0, Math.min(2, candidateCells.length));

    // Adım B: Seçilen hücreler üzerinde Gabor Rezonans Taraması
    const allScores = [];

    for (const cell of cellsToScan) {
      for (const item of cell.items) {
        const { window: win, activeIndices } = this.windowCache[item.channel];
        const omega = (2 * Math.PI * item.channel) / this.cellSize;
        const qPhases = queryVector.phases;

        let dot = 0;
        for (let idx = 0; idx < activeIndices.length; idx++) {
          const m = activeIndices[idx];
          const totalPhase = omega * m + qPhases[m];
          const pReal = win[m] * Math.cos(totalPhase);
          const pImag = win[m] * Math.sin(totalPhase);
          dot += pReal * cell.latticeReal[m] + pImag * cell.latticeImag[m];
        }
        allScores.push({ item, score: dot });
      }
    }

    allScores.sort((a, b) => b.score - a.score);
    const latencyMs = performance.now() - tStart;

    return allScores.slice(0, topK).map((s, rank) => ({
      item: s.item,
      score: s.score,
      rank: rank + 1,
      latencyMs
    }));
  }

  // Compute Cosine Signal to Interference Ratio (SIR in dB)
  calculateSIR(queryVector, targetId) {
    const targetCell = this.cells.find(c => c.items.some(it => it.id === targetId));
    if (!targetCell) return 0;

    let targetScore = 0;
    const interferenceScores = [];

    for (const item of targetCell.items) {
      const { window: win, activeIndices } = this.windowCache[item.channel];
      const omega = (2 * Math.PI * item.channel) / this.cellSize;
      const qPhases = queryVector.phases;

      let dot = 0;
      for (let idx = 0; idx < activeIndices.length; idx++) {
        const m = activeIndices[idx];
        const totalPhase = omega * m + qPhases[m];
        const pReal = win[m] * Math.cos(totalPhase);
        const pImag = win[m] * Math.sin(totalPhase);
        dot += pReal * targetCell.latticeReal[m] + pImag * targetCell.latticeImag[m];
      }

      if (item.id === targetId) {
        targetScore = Math.abs(dot);
      } else {
        interferenceScores.push(Math.abs(dot));
      }
    }

    if (interferenceScores.length === 0) return 40.0;
    const maxInterference = Math.max(...interferenceScores, 1e-9);
    return Number((20 * Math.log10(targetScore / maxInterference)).toFixed(2));
  }

  get stats() {
    return {
      D: this.D,
      totalCells: this.cells.length,
      totalItems: this.cells.reduce((sum, c) => sum + c.items.length, 0),
      cellSizeLimit: this.cellSize,
      sigma: this.sigma
    };
  }
}

// Dual module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GHRLatticeMemory };
}
