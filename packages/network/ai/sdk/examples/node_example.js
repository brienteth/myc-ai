/**
 * Resonance SDK v1.0 - Node.js Runtime Example
 * Demonstrates basic text generation and morphology analysis in Node.js.
 */

import { ResonanceSDK } from '../resonance_sdk.js';

async function run() {
  console.log('--- Resonance SDK Node.js Example ---');
  
  const sdk = new ResonanceSDK({ temperature: 0.5, maxLength: 8 });
  
  console.log('Initializing SDK...');
  await sdk.init();
  console.log('SDK Metrics:', sdk.getMetrics());

  // Generate text
  console.log('\nGenerating text...');
  const prompt = "yeni bir kitap";
  const result = sdk.generate(prompt);
  console.log(`Prompt: "${prompt}"`);
  console.log(`Generated: "${result.generatedText}"`);
  console.log(`Latency: ${result.totalLatencyMs.toFixed(2)} ms`);

  // Analyze word
  console.log('\nAnalyzing word morphology...');
  const word = "evlerimizden";
  const analysis = sdk.analyze(word);
  console.log(`Word: "${word}"`);
  console.log('Analysis:', analysis);
}

run().catch(console.error);
