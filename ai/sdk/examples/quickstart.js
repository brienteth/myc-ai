/**
 * Resonance SDK - 60 Second B2B Quickstart
 * Run with: node sdk/examples/quickstart.js
 */

import { ResonanceEngine, LicenseManager, FileStorageAdapter } from '../index.js';

async function main() {
  console.log('🚀 Initializing Resonance Engine (B2B Infrastructure SDK)...');

  // 1. Generate a test Business Tier License
  const licenseKey = LicenseManager.generateLicenseKey({
    tier: 'BUSINESS',
    expiresAt: Date.now() + 30 * 24 * 3600 * 1000, // 30 days
    clientId: 'acme-defense-corp'
  });

  // 2. Instantiate Engine with File Persistence
  const engine = new ResonanceEngine({
    licenseKey,
    storage: new FileStorageAdapter('./scratch/quickstart_memory.json')
  });

  await engine.init();
  console.log('✅ License Verified:', engine.getTelemetry().tier, '| Quota:', engine.getTelemetry().maxNodesQuota);

  // 3. Ingest Law / Enterprise Knowledge
  console.log('\n📥 Ingesting Document...');
  await engine.ingest({
    type: 'text',
    title: '6100 Sayılı Hukuk Muhakemeleri Kanunu',
    data: `
Madde 1: Göreve ilişkin kurallar, kamu düzenindendir.
Madde 2: Asliye hukuk mahkemelerinin görevi, dava konusunun değer ve miktarına bakılmaksızın, malvarlığı haklarına ilişkin davalarla şahıs varlığına ilişkin davaları görmektir.
Madde 3: İflas ve konkordato davaları asliye ticaret mahkemesinde görülür.
    `
  });

  // 4. Ask Direct Fact Question (< 1ms reaction)
  console.log('\n❓ Query: "Asliye hukuk mahkemelerinin görevi nedir?"');
  const response = await engine.ask("Asliye hukuk mahkemelerinin görevi nedir?");
  console.log('⚡ Route:', response.route, '| Latency:', response.latencyMs, 'ms');
  console.log('💬 Answer:\n', response.answer);

  // 5. Ask Math AST Gate
  console.log('\n❓ Math Gate Query: "250 * 4 + (1500 / 3)"');
  const mathRes = await engine.ask("250 * 4 + (1500 / 3)");
  console.log('⚡ Math Answer:', mathRes.answer, '| Latency:', mathRes.latencyMs, 'ms (Bypassed LLM:', mathRes.llmBypassed, ')');

  // 6. Inspect Telemetry
  console.log('\n📊 Real-Time Telemetry:');
  console.log(engine.getTelemetry());
}

main().catch(console.error);
