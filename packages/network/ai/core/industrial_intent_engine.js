/**
 * Industrial Natural Language to Modbus RTU Intent Engine
 * Fully Air-Gapped, Zero-Dependency, Sub-millisecond Execution
 * Solves: Entity separation, exact equipment numbering, negation, fail-safe no-op.
 */

export class IndustrialIntentEngine {
  constructor(morphology) {
    this.morphology = morphology;

    this.UNITS = {
      'sıfır': 0, 'bir': 1, 'birinci': 1, 'ilk': 1,
      'iki': 2, 'ikinci': 2,
      'üç': 3, 'üçüncü': 3,
      'dört': 4, 'dördüncü': 4,
      'beş': 5, 'beşinci': 5,
      'altı': 6, 'altıncı': 6,
      'yedi': 7, 'yedinci': 7,
      'sekiz': 8, 'sekizinci': 8,
      'dokuz': 9, 'dokuzuncu': 9
    };

    this.TENS = {
      'on': 10, 'onuncu': 10,
      'yirmi': 20, 'yirminci': 20,
      'otuz': 30, 'otuzuncu': 30,
      'kırk': 40, 'kırkıncı': 40,
      'elli': 50, 'ellinci': 50,
      'altmış': 60, 'altmışıncı': 60,
      'yetmiş': 70, 'yetmişinci': 70,
      'seksen': 80, 'sekseninci': 80,
      'doksan': 90, 'doksanıncı': 90
    };

    this.ROMAN = {
      'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
      'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
      'xi': 11, 'xii': 12
    };

    this.FALSE_NEGATIONS = new Set([
      'soğutma', 'sogutma', 'basma', 'kurutma', 'yağlama', 'yaglama',
      'besleme', 'bağlama', 'baglama', 'tahliye', 'havalandırma'
    ]);

    // Equipment coil offsets
    this.equipmentMap = {
      'pompa': { type: 'PUMP', baseCoil: 0x0000 },
      'vana': { type: 'VALVE', baseCoil: 0x0010 },
      'valf': { type: 'VALVE', baseCoil: 0x0010 },
      'konveyör': { type: 'CONVEYOR', baseCoil: 0x0020 },
      'konveyor': { type: 'CONVEYOR', baseCoil: 0x0020 },
      'bant': { type: 'CONVEYOR', baseCoil: 0x0020 },
      'band': { type: 'CONVEYOR', baseCoil: 0x0020 },
      'bandı': { type: 'CONVEYOR', baseCoil: 0x0020 },
      'fan': { type: 'FAN', baseCoil: 0x0030 },
      'soğutucu': { type: 'FAN', baseCoil: 0x0030 },
      'ısıtıcı': { type: 'HEATER', baseCoil: 0x0040 },
      'ısıt': { type: 'HEATER', baseCoil: 0x0040 },
      'motor': { type: 'MOTOR', baseCoil: 0x0060 },
      'şalter': { type: 'SWITCH', baseCoil: 0x0050 },
      'dalgıç': { type: 'PUMP', baseCoil: 0x0000 },
      'hidrofor': { type: 'PUMP', baseCoil: 0x0000 },
      'selenoid': { type: 'VALVE', baseCoil: 0x0010 },
      'klepe': { type: 'VALVE', baseCoil: 0x0010 },
      'damper': { type: 'VALVE', baseCoil: 0x0010 },
      'aspiratör': { type: 'FAN', baseCoil: 0x0030 },
      'blower': { type: 'FAN', baseCoil: 0x0030 },
      'rezistans': { type: 'HEATER', baseCoil: 0x0040 },
      'brülör': { type: 'HEATER', baseCoil: 0x0040 },
      'redüktör': { type: 'MOTOR', baseCoil: 0x0060 },
      'kontaktör': { type: 'SWITCH', baseCoil: 0x0050 },
      'kesici': { type: 'SWITCH', baseCoil: 0x0050 },
      'kompresör': { type: 'COMPRESSOR', baseCoil: 0x0070 },
      'kompresor': { type: 'COMPRESSOR', baseCoil: 0x0070 },
    };
  }

  // Modbus CRC-16 Calculation (Poly: 0xA001, Init: 0xFFFF)
  static calcModbusCRC(buffer) {
    let crc = 0xFFFF;
    for (let pos = 0; pos < buffer.length; pos++) {
      crc ^= buffer[pos];
      for (let i = 8; i !== 0; i--) {
        if ((crc & 0x0001) !== 0) {
          crc >>= 1;
          crc ^= 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }

  // Build binary Modbus RTU frame (8 bytes)
  static buildModbusRTU(slaveId, fc, addr, val) {
    const buf = Buffer.alloc(6);
    buf.writeUInt8(slaveId, 0);
    buf.writeUInt8(fc, 1);
    buf.writeUInt16BE(addr, 2);
    buf.writeUInt16BE(val, 4);
    const crc = IndustrialIntentEngine.calcModbusCRC(buf);
    const frame = Buffer.alloc(8);
    buf.copy(frame, 0);
    frame.writeUInt16LE(crc, 6);
    return frame;
  }

  extractNumberAndPrefix(norm) {
    const words = norm.split(/\s+/).filter(Boolean);
    let detectedType = null;
    let eqIdx = -1;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.startsWith('pompa')) { detectedType = 'PUMP'; eqIdx = i; break; }
      if (w.startsWith('vana') || w.startsWith('valf')) { detectedType = 'VALVE'; eqIdx = i; break; }
      if (w.startsWith('konvey') || w.startsWith('bant')) { detectedType = 'CONVEYOR'; eqIdx = i; break; }
      if (w.startsWith('fan') || w.startsWith('soğut')) { detectedType = 'FAN'; eqIdx = i; break; }
      if (w.startsWith('ısıt')) { detectedType = 'HEATER'; eqIdx = i; break; }
      if (w.startsWith('motor')) { detectedType = 'MOTOR'; eqIdx = i; break; }
      if (w.startsWith('şalter')) { detectedType = 'SWITCH'; eqIdx = i; break; }
    }

    const candidates = [];

    // 1. Shortcodes e.g. p-05, p2, v-3, m12, k-4, f1
    const shortMatch = norm.match(/\b([pvmkfh])[-_#:]*0*(\d+)\b/);
    if (shortMatch) {
      const code = shortMatch[1];
      const val = parseInt(shortMatch[2], 10);
      if (code === 'p') detectedType = 'PUMP';
      if (code === 'v') detectedType = 'VALVE';
      if (code === 'm') detectedType = 'MOTOR';
      if (code === 'k') detectedType = 'CONVEYOR';
      if (code === 'f') detectedType = 'FAN';
      if (code === 'h') detectedType = 'HEATER';
      candidates.push({ num: val, score: 100 });
    }

    // 2. Equipment with attached digits e.g. pompa-5, pompa2, vana3
    const equipMatch = norm.match(/\b(pompa|vana|motor|konvey[oö]r|fan|ısıtıcı)[-_#:]*0*(\d+)\b/);
    if (equipMatch) {
      const val = parseInt(equipMatch[2], 10);
      const eq = equipMatch[1];
      if (eq === 'pompa') detectedType = 'PUMP';
      if (eq === 'vana') detectedType = 'VALVE';
      if (eq === 'motor') detectedType = 'MOTOR';
      if (eq.startsWith('konvey')) detectedType = 'CONVEYOR';
      if (eq === 'fan') detectedType = 'FAN';
      if (eq === 'ısıtıcı') detectedType = 'HEATER';
      candidates.push({ num: val, score: 95 });
    }

    // 3. Roman numerals after equipment e.g. "pompa iv", "vana ii"
    const romanMatch = norm.match(/\b(pompa|vana|motor|konvey[oö]r|fan|şalter)\s+([ivx]+)\b/);
    if (romanMatch && this.ROMAN[romanMatch[2]]) {
      candidates.push({ num: this.ROMAN[romanMatch[2]], score: 90 });
    }

    // 4. Compound spoken numbers e.g. "on beş", "yirmi üç"
    for (let i = 0; i < words.length - 1; i++) {
      if (this.TENS[words[i]] && this.UNITS[words[i + 1]]) {
        const val = this.TENS[words[i]] + this.UNITS[words[i + 1]];
        let score = 90;
        if (i + 2 < words.length && (words[i + 2].startsWith("nolu") || words[i + 2].startsWith("numara"))) {
          score += 40;
        }
        if (eqIdx !== -1) score -= Math.abs(eqIdx - i) * 3;
        candidates.push({ num: val, score });
      }
    }

    // 5. Explicit "nolu" or "numaralı" or digits
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      let val = null;

      if ((w === 'no' || w === 'no.' || w === 'nolu') && i + 1 < words.length) {
        const nextMatch = words[i + 1].match(/^0*(\d+)/);
        if (nextMatch) val = parseInt(nextMatch[1], 10);
      } else {
        const m = w.match(/^#?0*(\d+)[\.\-]?/);
        if (m && m[1]) val = parseInt(m[1], 10);
      }

      if (val !== null) {
        let score = 60;
        if (i + 1 < words.length && (words[i + 1].startsWith('nolu') || words[i + 1].startsWith('numara'))) {
          score += 35; // Explicit modifier
        }
        if (eqIdx !== -1) {
          score -= Math.abs(eqIdx - i) * 3; // Proximity to equipment
        }
        candidates.push({ num: val, score });
      }

      // Single word numbers e.g. "beşinci", "ikinci"
      if (this.UNITS[w] !== undefined || this.TENS[w] !== undefined) {
        const wordVal = this.UNITS[w] !== undefined ? this.UNITS[w] : this.TENS[w];
        let score = 50;
        if (i + 1 < words.length && (words[i + 1].startsWith('nolu') || words[i + 1].startsWith('numara'))) {
          score += 30;
        }
        if (eqIdx !== -1) {
          score -= Math.abs(eqIdx - i) * 3;
        }
        candidates.push({ num: wordVal, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const num = candidates.length > 0 ? candidates[0].num : null;
    return { num, detectedType };
  }

  parseCommand(rawSentence) {
    const norm = this.morphology.normalize(rawSentence);
    if (!norm) {
      return { success: false, error: 'EMPTY_INPUT', intent: 'UNKNOWN_INTENT', message: 'Boş komut girildi' };
    }

    const words = norm.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return { success: false, error: 'EMPTY_INPUT', intent: 'UNKNOWN_INTENT', message: 'Boş komut girildi' };
    }

    // 1. Emergency Stop Detection
    if (norm.includes('acil') || norm.includes('imdat') || norm.includes('trip')) {
      const frame = IndustrialIntentEngine.buildModbusRTU(1, 0x05, 0x0000, 0xFF00);
      return {
        success: true,
        intent: 'EMERGENCY_STOP',
        entity: 'EMERGENCY',
        equipmentNumber: 0,
        action: 'STOP_ALL',
        coil: 0x0000,
        value: 0xFF00,
        frame,
        desc: 'Tüm sistemi acil durdurma ve şalter kesme'
      };
    }

    // 2. Extract Equipment Number and Shortcode Type
    const { num: equipmentIndex, detectedType } = this.extractNumberAndPrefix(norm);

    // 3. Morphological token analysis
    const analyses = words.map(w => this.morphology.analyze(w));

    // 4. Equipment Detection
    let equipment = null;
    if (detectedType) {
      for (const k in this.equipmentMap) {
        if (this.equipmentMap[k].type === detectedType) {
          equipment = this.equipmentMap[k];
          break;
        }
      }
    }

    if (!equipment) {
      for (const a of analyses) {
        const r = a.root;
        const w = a.word;
        if (this.equipmentMap[r]) {
          equipment = this.equipmentMap[r];
          break;
        }
        if (this.equipmentMap[w]) {
          equipment = this.equipmentMap[w];
          break;
        }
      }
    }

    // Fallback checks
    if (!equipment) {
      for (const w of words) {
        if (w.startsWith('pompa')) equipment = this.equipmentMap['pompa'];
        else if (w.startsWith('vana') || w.startsWith('valf')) equipment = this.equipmentMap['vana'];
        else if (w.startsWith('konvey') || w.startsWith('bant') || w.startsWith('band')) equipment = this.equipmentMap['konveyör'];
        else if (w.startsWith('fan') || w.startsWith('soğut')) equipment = this.equipmentMap['fan'];
        else if (w.startsWith('ısıt') || w.startsWith('isit')) equipment = this.equipmentMap['ısıtıcı'];
        else if (w.startsWith('motor')) equipment = this.equipmentMap['motor'];
        else if (w.startsWith('şalter')) equipment = this.equipmentMap['şalter'];
      }
    }

    // 5. Action & Negation Extraction
    let action = null;
    let hasStart = false;
    let hasStop = false;
    let isNegative = false;

    // Negation word markers
    const negKeywords = ['sakın', 'yapma', 'etme', 'olmasın', 'istemiyorum', 'asla', 'yok', 'iptal', 'değil', 'gerek', 'yasak'];
    for (const w of words) {
      if (negKeywords.includes(w)) isNegative = true;
    }

    for (let i = 0; i < analyses.length; i++) {
      const a = analyses[i];
      const r = a.root;
      const w = a.word;

      // Filter false negations (e.g. "soğutma", "basma", "yağlama")
      const isFalseNegation = this.FALSE_NEGATIONS.has(w) || (this.FALSE_NEGATIONS.has(r) && !['durdur', 'kapat', 'başla'].includes(r));

      if (!isFalseNegation) {
        if (a.features && a.features.polarity === 'negative') isNegative = true;
        if (a.suffixes && (a.suffixes.includes('ma') || a.suffixes.includes('me') || a.suffixes.includes('mıyor') || a.suffixes.includes('miyor') || a.suffixes.includes('maz') || a.suffixes.includes('mez'))) {
          isNegative = true;
        }
        // Truly driven by morphological analysis
        if (a.suffixes && (a.suffixes.includes('ma') || a.suffixes.includes('me') || a.suffixes.includes('mayın') || a.suffixes.includes('meyin'))) {
          isNegative = true;
        }
      }

      // START verbs
      if (['başla', 'çalış', 'aç', 'devre', 'start', 'sür', 'yol'].includes(r) || w.startsWith('başla') || w.startsWith('çalış') || w.startsWith('aç') || w.startsWith('start') || w.startsWith('devre')) {
        hasStart = true;
      }

      // STOP verbs
      if (['dur', 'kapat', 'kes', 'indir'].includes(r) || w.startsWith('durdur') || w.startsWith('kapat') || w.startsWith('kes')) {
        hasStop = true;
      }
    }

    if (hasStart && hasStop) {
      return {
        success: false,
        error: 'CONTRADICTORY_COMMAND',
        intent: 'UNKNOWN_INTENT',
        message: 'Çelişkili komut: Aynı cümlede hem başlatma hem durdurma verilemez. Güvenlik gereği röle sürülmedi.'
      };
    }
    if (hasStart) action = 'START';
    else if (hasStop) action = 'STOP';

    // 6. FAIL-SAFE VALIDATION CHECKS (Industrial Standard)
    if (!equipment) {
      return {
        success: false,
        error: 'UNKNOWN_EQUIPMENT',
        intent: 'UNKNOWN_INTENT',
        message: 'Komutta tanımlı bir endüstriyel ekipman bulunamadı.'
      };
    }

    if (!action) {
      return {
        success: false,
        error: 'UNKNOWN_ACTION',
        intent: 'UNKNOWN_INTENT',
        message: 'Ekipman için geçerli bir eylem (başlat/durdur/aç vb.) bulunamadı.'
      };
    }

    if (isNegative) {
      return {
        success: false,
        error: 'COMMAND_REJECTED_NEGATION',
        intent: 'NEGATION_CANCELLED',
        message: `Olumsuzluk tespit edildi ("${action}" eylemi iptal edildi). Güvenlik gereği röle sürülmedi.`,
        equipment: equipment.type,
        actionCancelled: action
      };
    }

    // 7. Coil Offset Calculation
    const finalCoil = equipment.baseCoil + (equipmentIndex !== null ? equipmentIndex : 1);
    const coilValue = (action === 'START') ? 0xFF00 : 0x0000;
    const frame = IndustrialIntentEngine.buildModbusRTU(1, 0x05, finalCoil, coilValue);

    return {
      success: true,
      intent: `${equipment.type}_${action}`,
      entity: equipment.type,
      equipmentNumber: equipmentIndex !== null ? equipmentIndex : 1,
      action: action,
      coil: finalCoil,
      value: coilValue,
      frame: frame,
      desc: `${equipmentIndex !== null ? equipmentIndex + ' numaralı' : ''} ${equipment.type} ${action}`
    };
  }
}
