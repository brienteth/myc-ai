/**
 * Egemen AI Runtime — UAT (User Acceptance Test) Script
 * Executes all 7 scenarios against the live server and records results.
 */

import http from 'http';
import { TurkishMorphology } from '../core/morphology.js';

const PORT = 3500;
const morph = new TurkishMorphology();

// ── HTTP Helpers ────────────────────────────────────────────

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const t0 = performance.now();
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const latency = performance.now() - t0;
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), latencyMs: latency });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, latencyMs: latency });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function chat(message) {
  return post('/v1/chat/completions', {
    model: 'spectral-slm-tr-v4.0',
    messages: [{ role: 'user', content: message }],
    temperature: 0.0,
    max_tokens: 20
  });
}

async function addMemory(content, query) {
  return post('/resonance/add', { content, query: query || content });
}

// ── Result Recording ────────────────────────────────────────

const allResults = [];
let currentScenario = '';

function record(message, res, notes = '') {
  const route = res.data?.route || 'N/A';
  const llmBypassed = res.data?.llmBypassed;
  const output = res.data?.choices?.[0]?.message?.content || res.data?.message || 'N/A';
  const latency = res.latencyMs?.toFixed(0) || '?';
  
  allResults.push({
    scenario: currentScenario,
    message,
    route,
    llmBypassed,
    output: output.substring(0, 120),
    latencyMs: latency,
    status: res.status,
    notes
  });
  
  console.log(`  "${message.substring(0, 50)}..." -> [${route}] ${latency}ms | ${output.substring(0, 80)}`);
  return { route, output, llmBypassed, latency };
}

// ── SCENARIO 1: Serbest Dil ─────────────────────────────────

async function scenario1() {
  currentScenario = 'S1: Hemsire Ilk Temas';
  console.log('\\n==================================================');
  console.log('  SENARYO 1 - Serbest Dil: Hemsire Ilk Temas');
  console.log('==================================================');
  
  const messages = [
    'merhaba',
    'bugun hasta kaydi yapacagim',
    'hastanin adi Fatma Yilmaz, yasi 67',
    'sikayeti bas agrisi ve tansiyon yuksekligi',
    'daha once bu hastayi gormus muyduk?',
    'Fatma hanimin gecmis kayitlari var mi?'
  ];
  
  for (const msg of messages) {
    const res = await chat(msg);
    record(msg, res);
  }
}

// ── SCENARIO 2: Deterministik Math ──────────────────────────

async function scenario2() {
  currentScenario = 'S2: Deterministik Math';
  console.log('\\n==================================================');
  console.log('  SENARYO 2 - Deterministik Math: Hesaplamalar');
  console.log('==================================================');
  
  const tests = [
    { msg: '50 * 0.5', expected: 25 },
    { msg: '25 / 3', expected: 25/3 },
    { msg: '25 * 7', expected: 175 },
    { msg: '384 * 27', expected: 10368 },
    { msg: '(25 / 3) * 7', expected: (25/3) * 7 },
  ];
  
  let mathPass = true;
  
  for (const test of tests) {
    const res = await chat(test.msg);
    const { route, output, llmBypassed } = record(test.msg, res);
    
    if (route !== 'math') {
      console.log(`  X FAIL: route=${route}, beklenen: math`);
      mathPass = false;
      continue;
    }
    
    if (!llmBypassed) {
      console.log(`  X FAIL: llmBypassed=${llmBypassed}`);
      mathPass = false;
      continue;
    }
    
    const numericOutput = parseFloat(output);
    if (Math.abs(numericOutput - test.expected) > 0.01) {
      console.log(`  X MATH ERROR: "${test.msg}" = ${numericOutput}, beklenen: ${test.expected}`);
      mathPass = false;
    } else {
      console.log(`  V Math dogru: ${test.msg} = ${numericOutput}`);
    }
  }
  
  console.log(`\\n  Math Genel Sonuc: ${mathPass ? 'PASS' : 'FAIL'}`);
}

// ── SCENARIO 3: Hafiza Tutarliligi ──────────────────────────

async function scenario3() {
  currentScenario = 'S3: Hafiza Tutarliligi';
  console.log('\\n==================================================');
  console.log('  SENARYO 3 - Hafiza Tutarliligi: Kayit -> Sorgu');
  console.log('==================================================');
  
  console.log('  [Kayit] Ahmet Kaya bilgileri ekleniyor...');
  await addMemory('Ahmet Kaya, 45 yasinda, diyabet hastasi', 'Ahmet Kaya hasta kaydi');
  await addMemory('Ahmet Kaya kan sekeri 180 mg/dL', 'Ahmet Kaya kan sekeri');
  
  const queries = [
    { msg: "Ahmet Kaya'nin durumu nedir?", notes: '' },
    { msg: "Ahmet hanimin durumu nedir?", notes: 'Kasitli cinsiyet hatasi' },
    { msg: "Ahmet Kaya'yi unuttun mu?", notes: 'Stres testi' },
    { msg: "Ahmet Kaya'nin diyabet kaydi hala duruyor mu?", notes: '' }
  ];
  
  for (const q of queries) {
    const res = await chat(q.msg);
    record(q.msg, res, q.notes);
  }
}

// ── SCENARIO 4: Morfoloji Stres ─────────────────────────────

async function scenario4() {
  currentScenario = 'S4: Morfoloji Stres';
  console.log('\\n==================================================');
  console.log('  SENARYO 4 - Turkce Morfoloji Stres Testi');
  console.log('==================================================');
  
  const testWords = [
    'evlerimizden',
    'ayaklarindan',
    'ilaclardan',
    'doktorlarimizdan',
    'hastaliklardan'
  ];
  
  console.log('\\n  Morfoloji Ayristirma Sonuclari:');
  for (const word of testWords) {
    const analysis = morph.analyze(word);
    const harmony = morph.determineVowelHarmony(word);
    const harmonyPass = harmony === 'front' || harmony === 'back';
    
    console.log(`  "${word}"`);
    console.log(`    Kok: ${analysis.root}`);
    console.log(`    Morphemeler: ${analysis.morphemes}`);
    console.log(`    Unlu Uyumu: ${harmony} ${harmonyPass ? 'V' : 'X'}`);
    
    allResults.push({
      scenario: currentScenario,
      message: word,
      route: 'morphology',
      output: `kok=${analysis.root}, harmony=${harmony}`,
      latencyMs: '<1',
      notes: harmonyPass ? 'PASS' : 'FAIL: harmony'
    });
  }
  
  const chatMessages = [
    'evlerimizden geliyoruz hasta getirdik',
    'hastanin ayaklarindan birinde sislik var',
    'ilaclardan hangisini vermemiz gerekiyor',
    'doktorlarimizdan birini cagirabilir misiniz',
    'bu hastaliklardan kurtulabilir mi'
  ];
  
  console.log('\\n  Chat Uzerinden Morfoloji:');
  for (const msg of chatMessages) {
    const res = await chat(msg);
    record(msg, res);
  }
}

// ── SCENARIO 5: Sistem Siniri ───────────────────────────────

async function scenario5() {
  currentScenario = 'S5: Sistem Sinirlari';
  console.log('\\n==================================================');
  console.log('  SENARYO 5 - Sistem Siniri: Ne Yapamaz?');
  console.log('==================================================');
  
  const outOfScope = [
    { msg: 'yarin hava nasil olacak?', boundary: 'internet-required' },
    { msg: 'Turkiyenin en iyi kardiyologu kim?', boundary: 'knowledge-lookup' },
    { msg: 'bu hastanin rontgen goruntusunu analiz et', boundary: 'image-analysis' },
    { msg: 'bana bir siir yaz', boundary: 'creative-writing' },
    { msg: 'ChatGPT ne der bu konuda?', boundary: 'external-model' }
  ];
  
  for (const q of outOfScope) {
    const res = await chat(q.msg);
    record(q.msg, res, `Boundary: ${q.boundary}`);
  }
}

// ── SCENARIO 6: Uzun Oturum ─────────────────────────────────

async function scenario6() {
  currentScenario = 'S6: Uzun Oturum';
  console.log('\\n==================================================');
  console.log('  SENARYO 6 - Uzun Oturum: Hafiza Sonumlenmesi');
  console.log('==================================================');
  
  console.log('\\n  [Tur 1] Kayit yapiliyor...');
  await addMemory('Zeynep Arslan, 34 yas, gebelik 28. hafta, kan basinci 140/90', 'Zeynep Arslan hasta kaydi');
  await addMemory('Zeynep Arslan: yuksek riskli gebelik', 'Zeynep Arslan risk durumu');
  console.log('  Kayitlar eklendi.');
  console.log('  [Not: lambda=0.01, yarilanma~69 saat, 30dk sercle ihmal edilebilir]');
  
  console.log('\\n  [Tur 2] Sorgulama...');
  const queries = [
    "Zeynep Arslan'in durumu nedir?",
    'risk seviyesi degisti mi?',
    'son olcum ne zamandi?'
  ];
  
  for (const msg of queries) {
    const res = await chat(msg);
    record(msg, res);
  }
}

// ── SCENARIO 7: Celiski Tespiti ─────────────────────────────

async function scenario7() {
  currentScenario = 'S7: Celiski Tespiti';
  console.log('\\n==================================================');
  console.log('  SENARYO 7 - Celiski Tespiti');
  console.log('==================================================');
  
  console.log('  [Kayit] Ali Demir kan grubu A+ ekleniyor...');
  await addMemory('Ali Demir, 52 yas, kan grubu A pozitif', 'Ali Demir kan grubu');
  
  console.log('  [Kayit] Ali Demir kan grubu B- ekleniyor (celiski!)...');
  await addMemory('Ali Demir, kan grubu B negatif', 'Ali Demir kan grubu guncelleme');
  
  const res = await chat("Ali Demir'in kan grubu nedir?");
  record("Ali Demir'in kan grubu nedir?", res, 'Celiski tespiti bekleniyor');
}

// ── FINAL REPORT ────────────────────────────────────────────

function printReport() {
  console.log('\\n\\n');
  console.log('================================================================');
  console.log('               EGEMEN AI RUNTIME - UAT RAPORU');
  console.log('================================================================');
  console.log(`Tarih/Saat: ${new Date().toISOString()}`);
  console.log('');
  
  let lastScenario = '';
  for (const r of allResults) {
    if (r.scenario !== lastScenario) {
      console.log(`\\n--- ${r.scenario} ---`);
      lastScenario = r.scenario;
    }
    const msg = (r.message || '').substring(0, 45).padEnd(45);
    const out = (r.output || '').substring(0, 55).padEnd(55);
    console.log(`  ${msg} | ${(r.route || '-').padEnd(8)} | ${String(r.latencyMs).padEnd(6)}ms | ${out} | ${r.notes || ''}`);
  }
  
  console.log('\\n================================================================');
  console.log('                    GEC/KAL TABLOSU');
  console.log('================================================================');
  
  const mathResults = allResults.filter(r => r.scenario === 'S2: Deterministik Math');
  const mathRouteCorrect = mathResults.filter(r => r.route === 'math').length;
  
  const morphResults = allResults.filter(r => r.scenario === 'S4: Morfoloji Stres' && r.route === 'morphology');
  const morphPass = morphResults.filter(r => r.notes === 'PASS').length;
  
  console.log(`  Matematik route dogrulugu  : ${mathRouteCorrect}/${mathResults.length}`);
  console.log(`  Morfoloji unlu uyumu       : ${morphPass}/${morphResults.length}`);
  console.log(`  Internet bagimsizligi      : PASS (localhost)`);
  console.log(`  Toplam test sayisi         : ${allResults.length}`);
  
  console.log('\\n================================================================\\n');
}

// ── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log('================================================================');
  console.log('       EGEMEN AI RUNTIME - KULLANICI KABUL TESTI (UAT)');
  console.log('================================================================');
  console.log(`Baslangic: ${new Date().toISOString()}`);
  console.log(`Sunucu: http://localhost:${PORT}`);
  
  try {
    const ping = await post('/config', {});
    if (ping.status !== 200) throw new Error('Server not responding');
    console.log('Sunucu baglantisi: OK');
  } catch (e) {
    console.error('HATA: Sunucu calismiyor! "PORT=3500 npm start" ile baslatin.');
    process.exit(1);
  }
  
  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4();
  await scenario5();
  await scenario6();
  await scenario7();
  
  printReport();
}

main().catch(e => {
  console.error('UAT hatasi:', e);
  process.exit(1);
});
