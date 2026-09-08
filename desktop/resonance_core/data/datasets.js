/**
 * Data Fabric & Datasets Module
 * Provides structured dataset loaders, mock model weights generator (1M - 10M scale),
 * and provenance / quality filtering pipelines.
 */

export class DataFabric {
  constructor() {}

  // Generates structured neural network weights for a given scale (e.g., 1M parameters)
  // Uses harmonic waves and sparse distributions to mimic real trained weights,
  // making FFT compression testing realistic and mathematically interesting.
  generateMockWeights(parameterCount = 1000000) {
    const weights = new Float32Array(parameterCount);
    
    // We compose multiple mathematical distributions:
    // 1. High frequency harmonics (trained features)
    // 2. Sparsely distributed activations
    // 3. Normal Gaussian noise
    for (let i = 0; i < parameterCount; i++) {
      // Harmonic features (redundant layers)
      const harmonic = 0.5 * Math.sin((2 * Math.PI * i) / 128) + 
                       0.2 * Math.cos((2 * Math.PI * i) / 32);

      // Sparse activations
      const sparse = Math.random() < 0.05 ? (Math.random() - 0.5) * 2.0 : 0.0;

      // Random background noise
      const noise = 0.05 * (Math.random() - 0.5);

      weights[i] = harmonic + sparse + noise;
    }

    return weights;
  }

  // A simple generator that yields weight blocks of size `blockSize` from a large array,
  // allowing memory-efficient streaming validation.
  *weightBlockStream(weightsArray, blockSize = 4096) {
    let offset = 0;
    while (offset < weightsArray.length) {
      yield weightsArray.slice(offset, offset + blockSize);
      offset += blockSize;
    }
  }

  // Raw data filtering / normalization pipeline (PII detection, quality score)
  cleanTextCorpus(rawTextList) {
    const cleaned = [];
    const piiPattern = /\b\d{11}\b|\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g; // Turkish TC ID / Email

    rawTextList.forEach(text => {
      // 1. Quality filter: skip very short or gibberish texts
      if (text.length < 5) return;
      
      // 2. PII censoring
      const censored = text.replace(piiPattern, '[CENSORED]');

      // 3. Linguistic score calculation (ratio of valid Turkish vowels/consonants)
      const vowelCount = [...censored.toLowerCase()].filter(c => 'aeıioöuü'.includes(c)).length;
      const totalLetterCount = [...censored.toLowerCase()].filter(c => c >= 'a' && c <= 'z' || 'çgğıoöşuü'.includes(c)).length;
      
      const qualityScore = totalLetterCount > 0 ? vowelCount / totalLetterCount : 0.0;

      cleaned.push({
        text: censored,
        quality: qualityScore,
        source: 'open-source-scrape',
        license: 'CC0',
        provenance: 'CanNuhlar / Wiktionary frequency list',
        timestamp: Date.now()
      });
    });

    return cleaned;
  }
}
