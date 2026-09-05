/**
 * Resonance SDK v1.0 — Example: Banking Chatbot Integration
 * Demonstrates real-world B2B use case: Edge AI for a Turkish banking assistant.
 */

import { ResonanceSDK } from '../resonance_sdk.js';

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🏦 Turkish Banking Assistant — Edge AI Demo');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Initialize SDK (sub-5s cold start, zero cloud)
  const sdk = new ResonanceSDK({
    temperature: 0.3,  // Low temp for banking = more deterministic
    maxLength: 8
  });

  console.log('⏳ Initializing Resonance SDK...');
  const t0 = performance.now();
  await sdk.init();
  const initMs = performance.now() - t0;
  console.log(`✅ Ready in ${initMs.toFixed(0)}ms | Vocab: ${sdk.getMetrics().vocabSize} words\n`);

  // 2. Simulate customer queries
  const queries = [
    "yeni bir hesap açmak istiyorum",
    "bilimsel araştırmalar",
    "evimizden okula gittik",
    "yapay zeka ile",
    "güzel bir gün"
  ];

  for (const query of queries) {
    console.log(`👤 Müşteri: "${query}"`);

    // Streaming output
    process.stdout.write('🤖 Asistan: ');
    const result = sdk.generate(query, {
      maxLength: 6,
      onToken: (word) => process.stdout.write(word + ' ')
    });
    console.log(`\n   ⚡ ${result.totalLatencyMs.toFixed(1)}ms | ${result.newTokens.length} tokens | ${result.finishReason}`);
    console.log('');
  }

  // 3. Morphological analysis demo
  console.log('═══════════════════════════════════════════════');
  console.log('  📝 Morfolojik Analiz Örnekleri');
  console.log('═══════════════════════════════════════════════\n');

  const words = ["evlerimizden", "kitaplarınız", "bilgisayarları"];
  for (const w of words) {
    const analysis = sdk.analyze(w);
    console.log(`  "${w}" → kök: "${analysis.root}", ekler: [${(analysis.suffixes || []).join(', ')}]`);
  }

  console.log('\n✅ Demo tamamlandı.\n');
}

main().catch(console.error);
