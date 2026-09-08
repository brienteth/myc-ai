/**
 * mycai — Meta-Selector & Adaptive Stationarity Gating Module
 * 
 * Dynamically arbitrates between Spectral Resonance (for stationary/chaotic regimes)
 * and Linear Adaptive Tracking (for abrupt non-stationary regime shifts).
 * 
 * @author mycai Core Team (https://mycai.pro)
 * @license Apache-2.0
 */

/**
 * Computes a lightweight, zero-allocation stationarity metric S in [0, 1].
 * S ~ 1.0 => Stationary / Harmonic / Chaotic Attractor (use Spectral/GHR-Lattice)
 * S ~ 0.0 => Non-stationary / Abrupt Frequency Jump / Step change (use Linear/Adaptive)
 * 
 * @param {Float64Array|number[]} signal - Time-series or sensor window
 * @param {number} lag - Window length
 * @returns {number} Stationarity score between 0.0 and 1.0
 */
export function computeStationarityMetric(signal, lag = signal.length) {
  const half = Math.floor(lag / 2);
  if (half < 4) return 0.5;

  const x1 = signal.subarray ? signal.subarray(0, half) : signal.slice(0, half);
  const x2 = signal.subarray ? signal.subarray(half, lag) : signal.slice(half, lag);

  // 1. Zero-crossing rate flux (instantaneous frequency hopping)
  let zc1 = 0;
  let zc2 = 0;
  for (let j = 1; j < half; j++) {
    if ((x1[j] >= 0) !== (x1[j - 1] >= 0)) zc1++;
    if ((x2[j] >= 0) !== (x2[j - 1] >= 0)) zc2++;
  }
  const zcrDiff = Math.abs(zc1 - zc2);

  // 2. Sub-window energy ratio flux
  let e1 = 0;
  let e2 = 0;
  for (let j = 0; j < half; j++) {
    e1 += x1[j] * x1[j];
    e2 += x2[j] * x2[j];
  }
  const energyDiff = Math.abs(e1 - e2) / (e1 + e2 + 1e-6);

  // 3. Curvature / difference variance shift
  let diffVar1 = 0;
  let diffVar2 = 0;
  for (let j = 1; j < half; j++) {
    const d1 = x1[j] - x1[j - 1];
    diffVar1 += d1 * d1;
    const d2 = x2[j] - x2[j - 1];
    diffVar2 += d2 * d2;
  }
  const varDiff = Math.abs(diffVar1 - diffVar2) / (diffVar1 + diffVar2 + 1e-6);

  const flux = zcrDiff * 0.7 + energyDiff * 0.5 + varDiff * 0.8;
  const stationarity = 1.0 / (1.0 + Math.exp(1.8 * (flux - 1.2)));
  return Math.max(0, Math.min(1, stationarity));
}

/**
 * MetaSelector: Hybrid Engine for Physical Telemetry & Chaos Forecasting
 */
export class MetaSelector {
  constructor(options = {}) {
    this.threshold = options.threshold ?? 0.55;
    this.smoothingAlpha = options.smoothingAlpha ?? 0.3;
    this.lastStationarity = 1.0;
  }

  /**
   * Evaluates input window and selects optimal execution branch
   * @param {Float64Array|number[]} window
   * @returns {{ regime: 'SPECTRAL_RESONANT'|'ADAPTIVE_LINEAR', score: number, confidence: number }}
   */
  evaluateRegime(window) {
    const rawScore = computeStationarityMetric(window);
    this.lastStationarity = this.smoothingAlpha * rawScore + (1 - this.smoothingAlpha) * this.lastStationarity;
    
    const regime = this.lastStationarity >= this.threshold 
      ? 'SPECTRAL_RESONANT' 
      : 'ADAPTIVE_LINEAR';

    return {
      regime,
      score: Number(this.lastStationarity.toFixed(4)),
      confidence: Math.abs(this.lastStationarity - 0.5) * 2
    };
  }
}
