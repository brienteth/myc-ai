/**
 * Automated Test Suite for @resonance/core Commercial SDK
 * Run with: node sdk/tests/test_commercial_sdk.js
 */

import assert from 'assert';
import fs from 'fs';
import {
  ResonanceEngine,
  LicenseManager,
  LICENSE_TIERS,
  MemoryStorageAdapter,
  FileStorageAdapter
} from '../index.js';

async function runTests() {
  console.log('🧪 Starting Commercial B2B SDK Automated Verification...\n');

  // ── 1. Cryptographic Offline Licensing Tests ─────────────────
  console.log('Test 1: Cryptographic Offline Licensing...');
  const secret = 'TEST_VENDOR_SECRET_KEY_12345';
  const validKey = LicenseManager.generateLicenseKey({
    tier: 'BUSINESS',
    expiresAt: Date.now() + 100000,
    clientId: 'test-bank'
  }, secret);

  const licMgr = new LicenseManager(secret);
  const verifyRes = licMgr.verifyLicense(validKey);
  assert.strictEqual(verifyRes.valid, true, 'License should be cryptographically valid');
  assert.strictEqual(verifyRes.tier.name, 'Business', 'Tier should be Business');
  assert.strictEqual(verifyRes.maxNodes, 50000, 'Max nodes should be 50,000');

  // Test Tampered License
  const tamperedKey = validKey.slice(0, -4) + 'ffff';
  const tamperedRes = licMgr.verifyLicense(tamperedKey);
  assert.strictEqual(tamperedRes.valid, false, 'Tampered license signature must fail');

  // Test Expired License
  const expiredKey = LicenseManager.generateLicenseKey({
    tier: 'STARTER',
    expiresAt: Date.now() - 1000,
    clientId: 'test-expired'
  }, secret);
  const expiredRes = licMgr.verifyLicense(expiredKey);
  assert.strictEqual(expiredRes.valid, false, 'Expired license must fail');
  console.log('✅ License verification and tamper resistance passed.');

  // ── 2. Storage Adapter Persistence Tests ─────────────────────
  console.log('\nTest 2: Storage Adapters (Memory & File)...');
  const tempPath = './scratch/test_memory_storage.json';
  const fileStorage = new FileStorageAdapter(tempPath);
  await fileStorage.init();
  await fileStorage.save([{ id: 1, content: 'Test Memory' }]);
  const loaded = await fileStorage.load();
  assert.strictEqual(loaded.length, 1, 'File storage should persist and reload records');
  assert.strictEqual(loaded[0].content, 'Test Memory');
  await fileStorage.clear();
  assert.strictEqual((await fileStorage.load()).length, 0, 'Clear should empty file storage');
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  console.log('✅ Storage adapters passed.');

  // ── 3. Engine Initialization & Ingestion Tests ───────────────
  console.log('\nTest 3: Engine Ingestion (Text & CSV)...');
  const engine = new ResonanceEngine({
    licenseKey: validKey,
    vendorSecret: secret,
    storage: new MemoryStorageAdapter()
  });
  await engine.init();

  // Ingest Text
  const textIngest = await engine.ingest({
    type: 'text',
    title: 'Ticaret Kanunu',
    data: `
Madde 1: Türk Ticaret Kanunu, 6102 sayılı kanundur.
Madde 2: Tacir, bir ticari işletmeyi kısmen de olsa kendi adına işleten kişidir.
Madde 3: Ticaret şirketleri; kollektif, komandit, anonim, limited ve kooperatif şirketlerden ibarettir.
    `
  });
  assert.strictEqual(textIngest.success, true);
  assert.strictEqual(textIngest.recordsAdded, 3);

  // Ingest CSV
  const csvIngest = await engine.ingest({
    type: 'csv',
    title: 'Şirket Verileri',
    data: `
Proje,Açıklama,Durum
Resonance AI,Yerel Türkçe Bilişsel Çekirdek,Aktif
MYC Agent,Otonom Ajan Güvenlik Katmanı,Aktif
    `
  });
  assert.strictEqual(csvIngest.success, true);
  assert.strictEqual(csvIngest.recordsAdded, 2);
  console.log('✅ Document and tabular ingestion passed.');

  // ── 4. Precision Q&A and Routing Tests ───────────────────────
  console.log('\nTest 4: Precision Q&A Dispatcher...');

  // Direct fact question
  const q1 = await engine.ask('Tacir kimdir?');
  console.log('Q1 Answer:', q1.answer);
  assert.strictEqual(q1.route, 'memory_qa_detail');
  assert.ok(q1.answer.includes('kendi adına işleten'), 'Should extract definition of tacir');
  assert.ok(q1.latencyMs < 50, 'Latency must be sub-50ms in testing');

  // Math Gate
  const q2 = await engine.ask('150 * 3 + 50');
  console.log('Q2 Math:', q2.answer);
  assert.strictEqual(q2.route, 'math');
  assert.strictEqual(q2.answer, '500');

  // Morphology Gate
  const q3 = await engine.ask('bilgisayarlarımızdan');
  console.log('Q3 Morphology:', q3.answer);
  assert.strictEqual(q3.route, 'morphology');
  assert.ok(q3.answer.includes('bilgisayar'));

  // ── 5. Telemetry & Quota Enforcement ─────────────────────────
  console.log('\nTest 5: Telemetry and Quota...');
  const telemetry = engine.getTelemetry();
  console.log('Telemetry Output:', telemetry);
  assert.strictEqual(telemetry.tier, 'Business');
  assert.strictEqual(telemetry.licenseValid, true);
  assert.ok(telemetry.totalQueries >= 3);
  assert.strictEqual(telemetry.activeNodes, 5);

  console.log('\n🎉 ALL COMMERCIAL SDK TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
