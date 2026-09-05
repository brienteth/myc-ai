/**
 * Turkish Resonance AI Core - BERTurk vs. English BERT Spectral & Morphological Analysis
 * Executes comparative spectral analysis of model weights using HTTP Range Requests.
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';

import { WeightSpectralAnalyzer } from './weight_analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure runs directory exists
const runsDir = path.join(__dirname, 'runs');
if (!fs.existsSync(runsDir)) {
  fs.mkdirSync(runsDir, { recursive: true });
}

const BERTURK_URL = 'https://huggingface.co/dbmdz/bert-base-turkish-cased/resolve/main/model.safetensors';
const ENGLISH_BERT_URL = 'https://huggingface.co/google-bert/bert-base-uncased/resolve/main/model.safetensors';

// Helper: HTTP Range request with redirect support
function downloadRange(urlStr, startByte, endByte) {
  return new Promise((resolve, reject) => {
    const options = new URL(urlStr);
    const headers = {
      'Range': `bytes=${startByte}-${endByte}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };

    const client = options.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const redirectUrl = res.headers.location;
        downloadRange(redirectUrl, startByte, endByte).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        reject(new Error(`Range request failed: HTTP ${res.statusCode} for url: ${urlStr}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', (err) => reject(err));
  });
}

// Fetch Safetensors header (first 256KB contains the JSON header)
async function fetchSafetensorsHeader(urlStr) {
  console.log(`[HTTP] Fetching safetensors header from: ${urlStr.split('/').slice(3,5).join('/')}`);
  const buf = await downloadRange(urlStr, 0, 262144);
  const headerLen = Number(buf.readBigUInt64LE(0));
  if (headerLen > buf.length - 8) {
    throw new Error(`Header length ${headerLen} exceeds pre-fetched buffer size. Try a larger initial fetch.`);
  }
  const headerJson = buf.slice(8, 8 + headerLen).toString('utf8');
  return {
    header: JSON.parse(headerJson),
    headerOffset: 8 + headerLen
  };
}

// Compute spectral metrics for a Float32 weight array
function calculateDetailedSpectralMetrics(weights, blockSize = 4096) {
  const analyzer = new WeightSpectralAnalyzer(blockSize);
  const blockCount = Math.floor(weights.length / blockSize);
  
  let totalEnergy = 0;
  let totalEntropy = 0;
  let totalSparsity = 0;
  
  // High vs Low frequency energy counters
  let lowFreqEnergy = 0;
  let totalSpectrumEnergy = 0;

  // Compression metrics
  let totalMse = 0;
  let totalCosSim = 0;

  // Average magnitude spectrum
  const avgSpectrum = new Float32Array(blockSize).fill(0);

  for (let b = 0; b < blockCount; b++) {
    const block = weights.slice(b * blockSize, (b + 1) * blockSize);
    const result = analyzer.analyzeBlock(block);
    
    totalEnergy += result.metrics.energy;
    totalEntropy += result.metrics.entropy;
    totalSparsity += result.metrics.sparsity;

    // Accumulate spectrum
    for (let f = 0; f < blockSize; f++) {
      avgSpectrum[f] += result.spectrum.magnitude[f];
      const energy = result.spectrum.magnitude[f] * result.spectrum.magnitude[f];
      totalSpectrumEnergy += energy;
      if (f < blockSize * 0.1) {
        lowFreqEnergy += energy;
      }
    }

    // Sparsity pruning check (Top 10% keep)
    const compressed = analyzer.compressSpectrum(result.spectrum, 0.10);
    const reconstructed = analyzer.reconstructBlock(compressed);
    const errors = analyzer.calculateError(block, reconstructed);
    totalMse += errors.mse;
    totalCosSim += errors.cosineSimilarity;
  }

  // Normalize accumulated spectrum
  for (let f = 0; f < blockSize; f++) {
    avgSpectrum[f] /= blockCount;
  }

  // Calculate dominant modes energy ratios
  const sortedMagnitudes = [...avgSpectrum].sort((a, b) => b - a);
  const totalMagSq = sortedMagnitudes.reduce((acc, m) => acc + m * m, 0);

  const getRatio = (pct) => {
    const count = Math.max(1, Math.floor(blockSize * pct));
    const subSum = sortedMagnitudes.slice(0, count).reduce((acc, m) => acc + m * m, 0);
    return subSum / (totalMagSq || 1);
  };

  return {
    energy: totalEnergy / blockCount,
    entropy: totalEntropy / blockCount,
    sparsity: totalSparsity / blockCount,
    lowFreqEnergyRatio: lowFreqEnergy / (totalSpectrumEnergy || 1),
    dominantRatio1: getRatio(0.01),
    dominantRatio5: getRatio(0.05),
    dominantRatio10: getRatio(0.10),
    prunedMse: totalMse / blockCount,
    prunedCosineSimilarity: totalCosSim / blockCount,
    spectrumSample: Array.from(avgSpectrum.slice(0, 100)) // return first 100 frequency bins
  };
}

// Download tensor data based on parsed offsets
async function downloadTensor(urlStr, headerOffset, tensorMeta) {
  const [start, end] = tensorMeta.data_offsets;
  const startByte = headerOffset + start;
  const endByte = headerOffset + end - 1;
  const byteLength = end - start;

  console.log(`[HTTP] Downloading tensor bytes: ${startByte}-${endByte} (${(byteLength/1024/1024).toFixed(2)} MB)`);
  const buf = await downloadRange(urlStr, startByte, endByte);
  return new Float32Array(buf.buffer, buf.byteOffset, byteLength / 4);
}

// Main runner function
export async function runComparison() {
  console.log('======================================================================');
  console.log('       TURKISH RESONANCE AI CORE - SPECTRAL COMPARATIVE ENGINE        ');
  console.log('======================================================================\n');

  try {
    // 1. Fetch headers
    const turkMeta = await fetchSafetensorsHeader(BERTURK_URL);
    const engMeta = await fetchSafetensorsHeader(ENGLISH_BERT_URL);

    // 2. Locate target layers
    const targetLayers = {
      embeddings: 'bert.embeddings.word_embeddings.weight',
      layer0_query: 'bert.encoder.layer.0.attention.self.query.weight',
      layer11_query: 'bert.encoder.layer.11.attention.self.query.weight'
    };

    const results = {
      berturk: {},
      english: {},
      comparison: {},
      timestamp: new Date().toISOString()
    };

    for (const [key, tensorName] of Object.entries(targetLayers)) {
      console.log(`\n--- Analysing Layer: ${key} (${tensorName}) ---`);

      // Verify layers exist in headers
      const tMetaTurk = turkMeta.header[tensorName];
      const tMetaEng = engMeta.header[tensorName];

      if (!tMetaTurk || !tMetaEng) {
        throw new Error(`Missing tensor ${tensorName} in one of the safetensors headers.`);
      }

      // Download specific layer tensor
      // Note: for word_embeddings, download only first 5MB to save bandwidth/RAM
      let weightsTurk, weightsEng;
      if (key === 'embeddings') {
        const partialEndTurk = Math.min(tMetaTurk.data_offsets[1], 10 * 1024 * 1024); // 10MB limit
        const partialEndEng = Math.min(tMetaEng.data_offsets[1], 10 * 1024 * 1024);
        
        weightsTurk = await downloadTensor(BERTURK_URL, turkMeta.headerOffset, {
          data_offsets: [tMetaTurk.data_offsets[0], tMetaTurk.data_offsets[0] + partialEndTurk]
        });
        weightsEng = await downloadTensor(ENGLISH_BERT_URL, engMeta.headerOffset, {
          data_offsets: [tMetaEng.data_offsets[0], tMetaEng.data_offsets[0] + partialEndEng]
        });
      } else {
        weightsTurk = await downloadTensor(BERTURK_URL, turkMeta.headerOffset, tMetaTurk);
        weightsEng = await downloadTensor(ENGLISH_BERT_URL, engMeta.headerOffset, tMetaEng);
      }

      // Calculate spectral metrics
      console.log(`[Compute] Calculating spectral profiles for BERTurk...`);
      results.berturk[key] = calculateDetailedSpectralMetrics(weightsTurk);
      console.log(`[Compute] Calculating spectral profiles for English BERT...`);
      results.english[key] = calculateDetailedSpectralMetrics(weightsEng);

      // Compare
      results.comparison[key] = {
        entropyDiff: results.berturk[key].entropy - results.english[key].entropy,
        sparsityDiff: results.berturk[key].sparsity - results.english[key].sparsity,
        lowFreqDiff: results.berturk[key].lowFreqEnergyRatio - results.english[key].lowFreqEnergyRatio,
        reconstructionStabilityDiff: results.berturk[key].prunedCosineSimilarity - results.english[key].prunedCosineSimilarity
      };

      console.log(`[Results] BERTurk vs English BERT (${key}):`);
      console.log(`  - Entropy: ${results.berturk[key].entropy.toFixed(4)} vs ${results.english[key].entropy.toFixed(4)}`);
      console.log(`  - Low-Freq Ratio: ${(results.berturk[key].lowFreqEnergyRatio*100).toFixed(2)}% vs ${(results.english[key].lowFreqEnergyRatio*100).toFixed(2)}%`);
      console.log(`  - Top-5% Dominant Mode Energy: ${(results.berturk[key].dominantRatio5*100).toFixed(2)}% vs ${(results.english[key].dominantRatio5*100).toFixed(2)}%`);
      console.log(`  - 10% Pruning Cosine Similarity: ${results.berturk[key].prunedCosineSimilarity.toFixed(6)} vs ${results.english[key].prunedCosineSimilarity.toFixed(6)}`);
    }

    // 3. Hypothesis testing formulation
    // Agglutinative clustering check in embeddings low frequency
    const berturkLowFreq = results.berturk.embeddings.lowFreqEnergyRatio;
    const englishLowFreq = results.english.embeddings.lowFreqEnergyRatio;
    
    results.hypothesisTest = {
      description: "Agglutinative morphological structures generate higher low-frequency energy clustering in the word embeddings layer.",
      berturkLowFreqRatio: berturkLowFreq,
      englishLowFreqRatio: englishLowFreq,
      ratioDifference: berturkLowFreq - englishLowFreq,
      hypothesisSupported: berturkLowFreq > englishLowFreq
    };

    console.log('\n======================================================================');
    console.log('                        HYPOTHESIS TEST RESULTS                       ');
    console.log('======================================================================');
    console.log(`Hypothesis: ${results.hypothesisTest.description}`);
    console.log(`BERTurk Low Freq Energy Ratio    : ${(berturkLowFreq*100).toFixed(4)}%`);
    console.log(`English BERT Low Freq Energy Ratio : ${(englishLowFreq*100).toFixed(4)}%`);
    console.log(`Difference                       : ${((berturkLowFreq - englishLowFreq)*100).toFixed(4)}%`);
    console.log(`Hypothesis Supported             : ${results.hypothesisTest.hypothesisSupported ? '🟩 YES' : '🟥 NO'}`);
    console.log('======================================================================\n');

    // Save results file
    const resPath = path.join(runsDir, 'bert_comparison_results.json');
    fs.writeFileSync(resPath, JSON.stringify(results, null, 2));
    console.log(`[Success] Saved results to ${resPath}`);

    return results;

  } catch (err) {
    console.error('[Error] Comparison execution failed:', err);
    throw err;
  }
}

// Self-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runComparison().catch(() => process.exit(1));
}
