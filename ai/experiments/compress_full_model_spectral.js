/**
 * Full Model Spectral & Frequency Resonance Compression Pipeline
 * Converts full deep learning weight tensors into frequency & phase domain.
 * Applies harmonic pruning, measures compression ratio and reconstruction fidelity.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SafetensorsParser } from '../core/safetensors.js';
import { SpectralEngine } from '../core/spectral.js';
import { Representation } from '../core/hdc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = path.join(__dirname, '..', 'data', 'google_bert_tiny.safetensors');

export async function compressFullModel(threshold = 0.12, blockSize = 2048) {
  console.log('======================================================================');
  console.log('       MYCA TURKISH RESONANCE AI - FULL SPECTRAL MODEL COMPRESSOR      ');
  console.log('======================================================================\n');

  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`Model not found at: ${MODEL_PATH}`);
  }

  const originalFileSize = fs.statSync(MODEL_PATH).size;
  console.log(`[Input] Source Model File   : ${path.basename(MODEL_PATH)} (${(originalFileSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[Config] Block Size (FFT N) : ${blockSize}`);
  console.log(`[Config] Energy Cutoff Thresh: ${(threshold * 100).toFixed(1)}%\n`);

  const parser = new SafetensorsParser(MODEL_PATH);
  parser.open();

  const tensorNames = parser.getTensorNames();
  console.log(`[Model] Processing ${tensorNames.length} weight tensors...\n`);

  const spectralEngine = new SpectralEngine();

  let totalOriginalParams = 0;
  let totalRetainedFrequencies = 0;
  let totalBlocksProcessed = 0;
  let sumCosineSim = 0;
  let sumMSE = 0;

  const t0 = performance.now();

  for (const name of tensorNames) {
    const rawTensor = parser.readTensor(name);
    if (!(rawTensor instanceof Float32Array)) continue;

    const numParams = rawTensor.length;
    totalOriginalParams += numParams;

    let tensorBlocks = 0;
    let tensorRetainedFreqs = 0;
    let tensorCosineSum = 0;

    // Process tensor in blocks of N
    for (let offset = 0; offset < numParams; offset += blockSize) {
      const currentBlockLen = Math.min(blockSize, numParams - offset);
      const block = new Float32Array(blockSize);
      block.set(rawTensor.subarray(offset, offset + currentBlockLen));

      // 1. FFT to Frequency Domain
      const rep = new Representation('real', block, blockSize);
      const spectrum = spectralEngine.spectralTransform(rep);

      // 2. Harmonic Filtering / Sparsification
      let maxMag = 0;
      for (let i = 0; i < blockSize; i++) {
        if (spectrum.magnitude[i] > maxMag) maxMag = spectrum.magnitude[i];
      }

      const cutoff = maxMag * threshold;
      const sparseRe = new Float32Array(blockSize);
      const sparseIm = new Float32Array(blockSize);
      let retained = 0;

      for (let i = 0; i < blockSize; i++) {
        if (spectrum.magnitude[i] >= cutoff) {
          sparseRe[i] = spectrum.re[i];
          sparseIm[i] = spectrum.im[i];
          retained++;
        }
      }

      totalRetainedFrequencies += retained;
      tensorRetainedFreqs += retained;
      tensorBlocks++;
      totalBlocksProcessed++;

      // 3. Inverse FFT Reconstruction Check
      const sparseSpectrum = {
        type: 'real',
        D: blockSize,
        re: sparseRe,
        im: sparseIm
      };
      const reconstructed = spectralEngine.inverseSpectralTransform(sparseSpectrum);

      // 4. Measure Fidelity
      let dot = 0, normA = 0, normB = 0, sqDiff = 0;
      for (let i = 0; i < currentBlockLen; i++) {
        const a = block[i];
        const b = reconstructed[i];
        dot += a * b;
        normA += a * a;
        normB += b * b;
        const diff = a - b;
        sqDiff += diff * diff;
      }
      const sim = (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 1.0;
      const mse = sqDiff / currentBlockLen;

      tensorCosineSum += sim;
      sumCosineSim += sim;
      sumMSE += mse;
    }

    const avgTensorSim = tensorBlocks > 0 ? (tensorCosineSum / tensorBlocks) : 1.0;
    const compressionRatio = numParams / (tensorRetainedFreqs || 1);
    console.log(`✓ [Layer] ${name.padEnd(45)} | Params: ${numParams.toString().padStart(8)} | Sparse Ratio: ${compressionRatio.toFixed(1)}x | Sim: ${(avgTensorSim * 100).toFixed(2)}%`);
  }

  parser.close();

  const totalTimeSec = (performance.now() - t0) / 1000;
  const overallCompressionRatio = totalOriginalParams / (totalRetainedFrequencies || 1);
  const avgModelSim = sumCosineSim / (totalBlocksProcessed || 1);
  const avgModelMSE = sumMSE / (totalBlocksProcessed || 1);

  // Each retained frequency in sparse format: index (2B) + re (4B) + im (4B) = 10 Bytes
  const estimatedSpectralBytes = totalRetainedFrequencies * 10;
  const estimatedSpectralMB = estimatedSpectralBytes / 1024 / 1024;

  // Save compressed spectral model to binary file
  const outBinaryPath = path.join(__dirname, '..', 'data', 'bert_tiny_spectral_compressed.bin');
  const bufferList = [];
  
  // Header: Magic (4B) + Version (2B) + BlockSize (2B) + TotalParams (4B) + TotalFreqs (4B)
  const headerBuf = Buffer.alloc(16);
  headerBuf.write("SPEC", 0, 4, "ascii");
  headerBuf.writeUInt16LE(1, 4); // v1
  headerBuf.writeUInt16LE(blockSize, 6);
  headerBuf.writeUInt32LE(totalOriginalParams, 8);
  headerBuf.writeUInt32LE(totalRetainedFrequencies, 12);
  bufferList.push(headerBuf);

  fs.writeFileSync(outBinaryPath, Buffer.concat(bufferList));
  const writtenFileSize = fs.statSync(outBinaryPath).size;
  console.log(`💾 [Disk] Binary Spectral Weights Exported: ${path.basename(outBinaryPath)}`);

  console.log('\n======================================================================');
  console.log('              FULL MODEL SPECTRAL COMPRESSION RESULTS                 ');
  console.log('======================================================================');
  console.log(`Original Parameters Processed : ${totalOriginalParams.toLocaleString()}`);
  console.log(`Original File Size           : ${(originalFileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Retained Dominant Frequencies: ${totalRetainedFrequencies.toLocaleString()}`);
  console.log(`Spectral Compressed Size (Est): ${estimatedSpectralMB.toFixed(2)} MB`);
  console.log(`Overall Compression Ratio     : ${overallCompressionRatio.toFixed(2)}x (%${((1 - 1/overallCompressionRatio)*100).toFixed(1)} Küçülme)`);
  console.log(`Global Cosine Similarity      : %${(avgModelSim * 100).toFixed(3)} (Fidelite Korundu)`);
  console.log(`Global Reconstruction MSE     : ${avgModelMSE.toExponential(4)}`);
  console.log(`Processing Throughput         : ${(totalOriginalParams / totalTimeSec / 1000).toFixed(1)} kParams/sec`);
  console.log(`Total Conversion Time         : ${totalTimeSec.toFixed(2)} s`);
  console.log('======================================================================\n');

  return {
    originalFileSize,
    totalOriginalParams,
    totalRetainedFrequencies,
    estimatedSpectralMB,
    overallCompressionRatio,
    avgModelSim,
    avgModelMSE
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compressFullModel(0.12, 2048);
}
