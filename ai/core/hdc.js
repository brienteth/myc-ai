/**
 * Hyperdimensional Computing (HDC) & Vector Symbolic Architecture (VSA) Module
 * Supports Binary, Bipolar, Real, Complex/FHRR representations with unified operations.
 */

export class Representation {
  constructor(type, values, D) {
    this.type = type; // 'binary' | 'bipolar' | 'real' | 'complex'
    this.values = values; // Float32Array or Uint8Array
    this.D = D;
  }

  // Calculate memory footprint in bytes
  memorySize() {
    return this.values.byteLength;
  }
}

export class HDCEngine {
  constructor(D = 8192) {
    this.D = D;
  }

  // ── GENERATION / RANDOM RANDOM VECTORS ─────────────────────

  generateRandom(type) {
    if (type === 'binary') {
      const vals = new Uint8Array(this.D);
      for (let i = 0; i < this.D; i++) {
        vals[i] = Math.random() < 0.5 ? 0 : 1;
      }
      return new Representation('binary', vals, this.D);
    }

    if (type === 'bipolar') {
      const vals = new Float32Array(this.D);
      for (let i = 0; i < this.D; i++) {
        vals[i] = Math.random() < 0.5 ? -1.0 : 1.0;
      }
      return new Representation('bipolar', vals, this.D);
    }

    if (type === 'real') {
      const vals = new Float32Array(this.D);
      // Gaussian distribution approx
      for (let i = 0; i < this.D; i++) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        vals[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }
      return new Representation('real', vals, this.D);
    }

    // Default to Complex/FHRR (angles in [0, 2*PI])
    const vals = new Float32Array(this.D);
    for (let i = 0; i < this.D; i++) {
      vals[i] = Math.random() * 2 * Math.PI;
    }
    return new Representation('complex', vals, this.D);
  }

  generateSeeded(type, key) {
    // Generate deterministic seed from string key
    let seed = 0;
    for (let i = 0; i < key.length; i++) {
      seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    }

    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed >>> 8) / 16777216;
    };

    if (type === 'binary') {
      const vals = new Uint8Array(this.D);
      for (let i = 0; i < this.D; i++) {
        vals[i] = nextRand() < 0.5 ? 0 : 1;
      }
      return new Representation('binary', vals, this.D);
    }

    if (type === 'bipolar') {
      const vals = new Float32Array(this.D);
      for (let i = 0; i < this.D; i++) {
        vals[i] = nextRand() < 0.5 ? -1.0 : 1.0;
      }
      return new Representation('bipolar', vals, this.D);
    }

    if (type === 'real') {
      const vals = new Float32Array(this.D);
      for (let i = 0; i < this.D; i++) {
        let u = 0, v = 0;
        while (u === 0) u = nextRand();
        while (v === 0) v = nextRand();
        vals[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }
      return new Representation('real', vals, this.D);
    }

    // Default to Complex/FHRR (angles in [0, 2*PI])
    const vals = new Float32Array(this.D);
    for (let i = 0; i < this.D; i++) {
      vals[i] = nextRand() * 2 * Math.PI;
    }
    return new Representation('complex', vals, this.D);
  }

  // ── BINDING (Morfem Binding / Variable-Value Association) ──

  bind(a, b) {
    if (a.type !== b.type || a.D !== b.D) {
      throw new Error('Representation mismatch for bind operation.');
    }
    const D = a.D;

    if (a.type === 'binary') {
      const o = new Uint8Array(D);
      for (let i = 0; i < D; i++) {
        o[i] = a.values[i] ^ b.values[i];
      }
      return new Representation('binary', o, D);
    }

    if (a.type === 'bipolar') {
      const o = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        o[i] = a.values[i] * b.values[i];
      }
      return new Representation('bipolar', o, D);
    }

    if (a.type === 'real') {
      // Circular convolution approximation via element-wise multiplication
      const o = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        o[i] = a.values[i] * b.values[i];
      }
      return new Representation('real', o, D);
    }

    // Complex/FHRR: adding phases modulo 2*PI
    const o = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      o[i] = (a.values[i] + b.values[i]) % (2 * Math.PI);
    }
    return new Representation('complex', o, D);
  }

  unbind(a, b) {
    if (a.type !== b.type || a.D !== b.D) {
      throw new Error('Representation mismatch for unbind operation.');
    }
    const D = a.D;

    if (a.type === 'binary') {
      return this.bind(a, b); // XOR is self-inverse
    }

    if (a.type === 'bipolar') {
      return this.bind(a, b); // Multiplication of -1/1 is self-inverse
    }

    if (a.type === 'real') {
      const o = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        // Safe division
        o[i] = Math.abs(b.values[i]) > 1e-6 ? a.values[i] / b.values[i] : a.values[i];
      }
      return new Representation('real', o, D);
    }

    // Complex/FHRR: subtract phases modulo 2*PI
    const o = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      let v = a.values[i] - b.values[i];
      if (v < 0) v += 2 * Math.PI;
      o[i] = v % (2 * Math.PI);
    }
    return new Representation('complex', o, D);
  }

  // ── BUNDLING (Superposition / Memory Accumulation) ──────────

  bundle(reps) {
    if (!reps || reps.length === 0) {
      throw new Error('No representations to bundle.');
    }
    const type = reps[0].type;
    const D = reps[0].D;

    if (type === 'binary') {
      // Majority vote
      const o = new Uint8Array(D);
      const counts = new Int32Array(D);
      for (const r of reps) {
        for (let i = 0; i < D; i++) {
          counts[i] += r.values[i] === 1 ? 1 : -1;
        }
      }
      for (let i = 0; i < D; i++) {
        o[i] = counts[i] >= 0 ? 1 : 0;
      }
      return new Representation('binary', o, D);
    }

    if (type === 'bipolar') {
      // Bipolar bundling: sign of the sum
      const o = new Float32Array(D);
      for (const r of reps) {
        for (let i = 0; i < D; i++) {
          o[i] += r.values[i];
        }
      }
      for (let i = 0; i < D; i++) {
        o[i] = o[i] >= 0 ? 1.0 : -1.0;
      }
      return new Representation('bipolar', o, D);
    }

    if (type === 'real') {
      // Average normalization
      const o = new Float32Array(D);
      for (const r of reps) {
        for (let i = 0; i < D; i++) {
          o[i] += r.values[i];
        }
      }
      const n = reps.length;
      for (let i = 0; i < D; i++) {
        o[i] /= n;
      }
      return new Representation('real', o, D);
    }

    // Complex/FHRR: Vector summation of complex exponentials
    const re = new Float32Array(D);
    const im = new Float32Array(D);
    for (const r of reps) {
      for (let i = 0; i < D; i++) {
        re[i] += Math.cos(r.values[i]);
        im[i] += Math.sin(r.values[i]);
      }
    }
    const o = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      let v = Math.atan2(im[i], re[i]);
      if (v < 0) v += 2 * Math.PI;
      o[i] = v;
    }
    return new Representation('complex', o, D);
  }

  // ── PERMUTATION (Shift operation / Order / Position binding) ─

  permute(a, sh) {
    const D = a.D;
    const shift = ((sh % D) + D) % D;
    const vals = new a.values.constructor(D);
    for (let i = 0; i < D; i++) {
      vals[(i + shift) % D] = a.values[i];
    }
    return new Representation(a.type, vals, D);
  }

  // ── SIMILARITY (Measured closeness) ──────────────────────────

  similarity(a, b) {
    if (a.type !== b.type || a.D !== b.D) {
      return 0.0;
    }
    const D = a.D;

    if (a.type === 'binary') {
      // Normalized Hamming distance similarity (1 - HD/D)
      let hamming = 0;
      for (let i = 0; i < D; i++) {
        if (a.values[i] !== b.values[i]) hamming++;
      }
      return 1.0 - (hamming / D);
    }

    if (a.type === 'bipolar') {
      // Cosine similarity for -1/1 values (Dot product / D)
      let dot = 0;
      for (let i = 0; i < D; i++) {
        dot += a.values[i] * b.values[i];
      }
      return dot / D;
    }

    if (a.type === 'real') {
      // Standard cosine similarity
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < D; i++) {
        dot += a.values[i] * b.values[i];
        normA += a.values[i] * a.values[i];
        normB += b.values[i] * b.values[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      return denom > 0 ? dot / denom : 0.0;
    }

    // Complex/FHRR: Cosine similarity of phase differences
    let sum = 0;
    for (let i = 0; i < D; i++) {
      sum += Math.cos(a.values[i] - b.values[i]);
    }
    return sum / D;
  }
}
