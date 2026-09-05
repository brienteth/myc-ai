/**
 * Resonance SDK - Commercial Offline Licensing Engine (B2B Infrastructure)
 * 100% Air-Gapped cryptographic license validation and quota enforcement.
 * 
 * License format: RES-{TIER}-{EXPIRY_TIMESTAMP}-{MAX_NODES}-{HMAC_SIGNATURE}
 * Example: RES-BUSINESS-1798761600000-50000-a1b2c3d4e5f6...
 * 
 * @license Commercial
 * @author Turkish Resonance AI Core Team
 */

import crypto from 'crypto';

export const LICENSE_TIERS = {
  STARTER: {
    name: 'Starter / Community',
    code: 'STARTER',
    price: '$0 (Ücretsiz / Open-Source)',
    target: 'Bireysel Yazılımcılar, Akademik Araştırmacılar, Prototip',
    maxNodes: 1000,
    allowedRuntimes: ['node', 'browser'],
    features: ['math', 'text', 'basic_memory', 'telemetry'],
    wasmRequired: false
  },
  BUSINESS: {
    name: 'Business / Professional',
    code: 'BUSINESS',
    price: '$499 / Ay veya $4.990 / Yıl',
    target: 'KOBİ’ler, SaaS Şirketleri, Hukuk Büroları, Finans Girişimleri',
    maxNodes: 50000,
    allowedRuntimes: ['node', 'browser', 'electron', 'edge'],
    features: ['math', 'morphology', 'text', 'basic_memory', 'pdf', 'csv', 'living_memory', 'smart_summarizer', 'conflict_resolution', 'edge_rag', 'telemetry'],
    wasmRequired: false
  },
  SOVEREIGN: {
    name: 'Sovereign / Enterprise',
    code: 'SOVEREIGN',
    price: '$15.000 - $25.000 / Yıl',
    target: 'Bankalar, Sigorta, Savunma ve Kritik Altyapılar (TEİAŞ/BOTAŞ)',
    maxNodes: Infinity,
    allowedRuntimes: ['node', 'browser', 'electron', 'edge', 'tactical_hardware'],
    features: ['math', 'morphology', 'text', 'basic_memory', 'pdf', 'csv', 'living_memory', 'smart_summarizer', 'conflict_resolution', 'wasm_simd', 'custom_rules', 'multi_graph', 'edge_rag', 'tactical_hardware', 'telemetry'],
    wasmRequired: true
  },
  OEM_INDUSTRIAL: {
    name: 'Industrial OEM / Device Royalty',
    code: 'OEM_INDUSTRIAL',
    price: '1.50$ - 3.50$ / Cihaz Başı (veya 12.000$ Yıllık Sınırsız Fabrika Lisansı)',
    target: 'Mikrodev gibi PLC, HMI, RTU, Robotik ve Donanım Üreticileri',
    maxNodes: Infinity,
    allowedRuntimes: ['node', 'browser', 'electron', 'edge', 'freertos', 'cortex_m4', 'esp32_s3', 'linux_arm', 'tactical_hardware'],
    features: ['math', 'morphology', 'text', 'basic_memory', 'pdf', 'csv', 'living_memory', 'smart_summarizer', 'conflict_resolution', 'wasm_simd', 'custom_rules', 'multi_graph', 'industrial_modbus', 'edge_rag', 'tactical_hardware', 'white_label', 'telemetry'],
    wasmRequired: false
  }
};

export class LicenseManager {
  /**
   * @param {string} [vendorSecret] - Master secret for signing/verifying licenses.
   */
  constructor(vendorSecret = (typeof process !== 'undefined' && process.env ? process.env.MYCAI_LICENSE_KEY_SECRET : null)) {
    this._secret = vendorSecret;
    this.currentLicense = null;
    this.tier = LICENSE_TIERS.STARTER;
    this.expiryDate = null;
    this.maxNodes = 1000;
    this.isValid = false;
    this.nodeCount = 0;
  }

  /**
   * Generate an offline commercial license key (Vendor use)
   * @param {Object} opts
   * @param {'STARTER'|'BUSINESS'|'SOVEREIGN'} opts.tier
   * @param {number|Date} opts.expiresAt
   * @param {number} [opts.maxNodes]
   * @param {string} [opts.clientId]
   * @returns {string}
   */
  static generateLicenseKey(opts, secret) {
    if (!secret) throw new Error("Security Error: generateLicenseKey requires an explicit master vendor signing authority key.");
    const tierKey = (opts.tier || 'STARTER').toUpperCase();
    if (!LICENSE_TIERS[tierKey]) throw new Error(`Invalid tier: ${tierKey}`);

    const tierDef = LICENSE_TIERS[tierKey];
    const expiry = opts.expiresAt instanceof Date ? opts.expiresAt.getTime() : (opts.expiresAt || (Date.now() + 365 * 24 * 3600 * 1000));
    const maxNodes = opts.maxNodes || (tierDef.maxNodes === Infinity ? 0 : tierDef.maxNodes);
    const clientId = (opts.clientId || 'b2b-customer').replace(/[^a-zA-Z0-9]/g, '');

    const payload = `${tierKey}:${expiry}:${maxNodes}:${clientId}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const signature = hmac.digest('hex').slice(0, 32);

    return `RES-${tierKey}-${expiry}-${maxNodes}-${clientId}-${signature}`;
  }

  /**
   * Cryptographically verify an offline license key without cloud ping
   * @param {string} key
   * @returns {{ valid: boolean, tier: Object, expiresAt: Date, maxNodes: number, reason?: string }}
   */
  verifyLicense(key) {
    if (!key || typeof key !== 'string') {
      return this._fallbackCommunityLicense('No license key provided');
    }

    const parts = key.trim().split('-');
    if (parts.length !== 6 || parts[0] !== 'RES') {
      return this._fallbackCommunityLicense('Invalid license key format');
    }

    const [_, tierKey, expiryStr, maxNodesStr, clientId, signature] = parts;
    const tierDef = LICENSE_TIERS[tierKey];
    if (!tierDef) {
      return this._fallbackCommunityLicense(`Unrecognized tier: ${tierKey}`);
    }

    const expiryTime = parseInt(expiryStr, 10);
    const maxNodes = parseInt(maxNodesStr, 10);

    // Verify cryptographic signature
    if (!this._secret) {
      return this._fallbackCommunityLicense('No license verification secret configured in environment');
    }
    const payload = `${tierKey}:${expiryTime}:${maxNodes}:${clientId}`;
    const hmac = crypto.createHmac('sha256', this._secret);
    hmac.update(payload);
    const expectedSig = hmac.digest('hex').slice(0, 32);

    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return this._fallbackCommunityLicense('Cryptographic signature verification failed');
    }

    // Check expiration
    if (Date.now() > expiryTime) {
      return this._fallbackCommunityLicense(`License expired on ${new Date(expiryTime).toISOString()}`);
    }

    // Valid license
    this.currentLicense = key;
    this.tier = tierDef;
    this.expiryDate = new Date(expiryTime);
    this.maxNodes = maxNodes === 0 ? Infinity : maxNodes;
    this.isValid = true;

    return {
      valid: true,
      tier: tierDef,
      expiresAt: this.expiryDate,
      maxNodes: this.maxNodes,
      clientId
    };
  }

  /**
   * Check if a feature is authorized by the current license
   * @param {string} featureName
   * @returns {boolean}
   */
  canUseFeature(featureName) {
    return this.tier.features.includes(featureName);
  }

  /**
   * Check if adding N nodes exceeds quota
   * @param {number} currentTotal
   * @param {number} addingCount
   * @returns {boolean}
   */
  checkNodeQuota(currentTotal, addingCount = 1) {
    if (this.maxNodes === Infinity) return true;
    return (currentTotal + addingCount) <= this.maxNodes;
  }

  _fallbackCommunityLicense(reason) {
    this.currentLicense = null;
    this.tier = LICENSE_TIERS.STARTER;
    this.expiryDate = null;
    this.maxNodes = LICENSE_TIERS.STARTER.maxNodes;
    this.isValid = false;
    return {
      valid: false,
      tier: this.tier,
      expiresAt: null,
      maxNodes: this.maxNodes,
      reason
    };
  }
}
