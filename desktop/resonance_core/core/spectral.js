/**
 * Spectral Computing Engine
 * Implements Radix-2 Cooley-Tukey FFT / IFFT and spectral feature analysis.
 */

import { Representation } from './hdc.js';

export class SpectralEngine {
  constructor() {}

  // ── FFT CORE ALGORITHMS ────────────────────────────────────

  _bitReverse(re, im) {
    const n = re.length;
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        let temp = re[i]; re[i] = re[j]; re[j] = temp;
        temp = im[i]; im[i] = im[j]; im[j] = temp;
      }
      let m = n >> 1;
      while (m >= 2 && j >= m) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }
  }

  _fftCore(re, im, inverse = false) {
    const n = re.length;
    this._bitReverse(re, im);

    for (let len = 2; len <= n; len <<= 1) {
      const angle = (2 * Math.PI / len) * (inverse ? 1 : -1);
      const wlen_re = Math.cos(angle);
      const wlen_im = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let w_re = 1.0;
        let w_im = 0.0;
        const half = len >> 1;

        for (let j = 0; j < half; j++) {
          const u_re = re[i + j];
          const u_im = im[i + j];
          
          const t_re = re[i + j + half];
          const t_im = im[i + j + half];
          
          const v_re = t_re * w_re - t_im * w_im;
          const v_im = t_re * w_im + t_im * w_re;

          re[i + j] = u_re + v_re;
          im[i + j] = u_im + v_im;
          
          re[i + j + half] = u_re - v_re;
          im[i + j + half] = u_im - v_im;

          const next_w_re = w_re * wlen_re - w_im * wlen_im;
          const next_w_im = w_re * wlen_im + w_im * wlen_re;
          w_re = next_w_re;
          w_im = next_w_im;
        }
      }
    }

    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  }

  // ── EXTERNAL API ───────────────────────────────────────────

  spectralTransform(representation) {
    const D = representation.D;
    const re = new Float32Array(D);
    const im = new Float32Array(D);

    // Map different representation formats into complex domain
    if (representation.type === 'complex') {
      // Phase-coded: z = e^{i * theta}
      for (let i = 0; i < D; i++) {
        re[i] = Math.cos(representation.values[i]);
        im[i] = Math.sin(representation.values[i]);
      }
    } else if (representation.type === 'bipolar' || representation.type === 'real') {
      // Real-valued: z = x + 0i
      for (let i = 0; i < D; i++) {
        re[i] = representation.values[i];
        im[i] = 0.0;
      }
    } else if (representation.type === 'binary') {
      // Map 0 -> -1, 1 -> 1
      for (let i = 0; i < D; i++) {
        re[i] = representation.values[i] === 1 ? 1.0 : -1.0;
        im[i] = 0.0;
      }
    }

    // Run FFT in-place
    this._fftCore(re, im, false);

    // Calculate magnitude and phase spectrum
    const magnitude = new Float32Array(D);
    const phase = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      magnitude[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      phase[i] = Math.atan2(im[i], re[i]);
    }

    return {
      type: representation.type,
      D,
      re,
      im,
      magnitude,
      phase
    };
  }

  inverseSpectralTransform(spectrum) {
    const D = spectrum.D;
    const re = new Float32Array(spectrum.re);
    const im = new Float32Array(spectrum.im);

    // Run IFFT in-place
    this._fftCore(re, im, true);

    // Reconstruct the original representation type
    if (spectrum.type === 'complex') {
      const vals = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        let v = Math.atan2(im[i], re[i]);
        if (v < 0) v += 2 * Math.PI;
        vals[i] = v;
      }
      return new Representation('complex', vals, D);
    }

    if (spectrum.type === 'binary') {
      const vals = new Uint8Array(D);
      for (let i = 0; i < D; i++) {
        vals[i] = re[i] >= 0.0 ? 1 : 0;
      }
      return new Representation('binary', vals, D);
    }

    if (spectrum.type === 'bipolar') {
      const vals = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        vals[i] = re[i] >= 0.0 ? 1.0 : -1.0;
      }
      return new Representation('bipolar', vals, D);
    }

    // Real representation fallback
    const vals = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      vals[i] = re[i];
    }
    return new Representation('real', vals, D);
  }

  extractDominantFrequencies(spectrum, k = 10) {
    const n = spectrum.D;
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({ freq: i, mag: spectrum.magnitude[i] });
    }
    // Sort descending by magnitude
    items.sort((a, b) => b.mag - a.mag);
    return items.slice(0, k);
  }

  spectralEnergy(spectrum) {
    let energy = 0;
    const n = spectrum.D;
    for (let i = 0; i < n; i++) {
      energy += spectrum.magnitude[i] * spectrum.magnitude[i];
    }
    return energy;
  }

  spectralEntropy(spectrum) {
    const n = spectrum.D;
    const power = new Float32Array(n);
    let totalPower = 0;
    for (let i = 0; i < n; i++) {
      power[i] = spectrum.magnitude[i] * spectrum.magnitude[i];
      totalPower += power[i];
    }
    if (totalPower === 0) return 0.0;

    let entropy = 0.0;
    for (let i = 0; i < n; i++) {
      const p = power[i] / totalPower;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    // Normalized by log2(n)
    return entropy / Math.log2(n);
  }

  spectralSparsity(spectrum) {
    // Hoyer sparsity measure: (sqrt(n) - L1/L2) / (sqrt(n) - 1)
    const n = spectrum.D;
    let l1 = 0;
    let l2Sq = 0;
    for (let i = 0; i < n; i++) {
      l1 += spectrum.magnitude[i];
      l2Sq += spectrum.magnitude[i] * spectrum.magnitude[i];
    }
    const l2 = Math.sqrt(l2Sq);
    if (l2 === 0) return 0.0;

    const sqrtN = Math.sqrt(n);
    return (sqrtN - l1 / l2) / (sqrtN - 1.0);
  }

  lowFrequencyEnergy(spectrum) {
    // Energy in the lower half of spectrum frequencies
    let energy = 0;
    const half = Math.floor(spectrum.D / 2);
    const quarter = Math.floor(half / 2);
    for (let i = 0; i < quarter; i++) {
      energy += spectrum.magnitude[i] * spectrum.magnitude[i];
    }
    return energy;
  }

  highFrequencyEnergy(spectrum) {
    let energy = 0;
    const half = Math.floor(spectrum.D / 2);
    const quarter = Math.floor(half / 2);
    for (let i = quarter; i < half; i++) {
      energy += spectrum.magnitude[i] * spectrum.magnitude[i];
    }
    return energy;
  }

  spectralSimilarity(a, b) {
    if (a.D !== b.D) return 0.0;
    // Cosine similarity of magnitude spectra
    let dot = 0, normA = 0, normB = 0;
    const n = a.D;
    for (let i = 0; i < n; i++) {
      dot += a.magnitude[i] * b.magnitude[i];
      normA += a.magnitude[i] * a.magnitude[i];
      normB += b.magnitude[i] * b.magnitude[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0.0;
  }
}
