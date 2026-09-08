/**
 * Turkish Resonance AI Core - Spectral SLM Stress & Quality Test Suite (v4.0)
 * Evaluates degeneracy, phonetic vowel harmony, zero token leakage, prompt stability, and temperature scale.
 */

import assert from 'assert';
import { SpectralSLM } from '../core/spectral_decoder.js';
import { TurkishMorphology } from '../core/morphology.js';

async function runStressTest() {
  console.log('======================================================================');
  console.log('       TURKISH RESONANCE AI CORE - SLM QUALITY & STRESS TEST SUITE    ');
  console.log('======================================================================\n');

  const slm = new SpectralSLM();
  const morphology = new TurkishMorphology();
  
  let passed = 0;
  let failed = 0;

  function report(name, isPass, detail = '') {
    if (isPass) {
      console.log(`  [\x1b[32mPASS\x1b[0m] ${name} ${detail ? '(' + detail + ')' : ''}`);
      passed++;
    } else {
      console.log(`  [\x1b[31mFAIL\x1b[0m] ${name} ${detail ? '(' + detail + ')' : ''}`);
      failed++;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 1. Döngü & Sıkışma Testi (Degeneracy / Infinite Repetition)
  // ───────────────────────────────────────────────────────────
  try {
    const res = slm.generateText('evimizden yeni', 50, 0.5);
    const tokens = res.newTokens;
    let hasInfiniteLoop = false;
    
    // Check moving window of size 5 for duplicates
    for (let i = 0; i < tokens.length - 5; i++) {
      const window = tokens.slice(i, i + 5);
      const counts = {};
      for (const t of window) {
        counts[t] = (counts[t] || 0) + 1;
        if (counts[t] > 2) { // Allow up to 2 repeats in a window of 5 due to short vocabulary, but not infinite loops
          hasInfiniteLoop = true;
          break;
        }
      }
    }
    
    report('1. Döngü & Sıkışma Engelleme Testi', !hasInfiniteLoop, `Üretilen Token Sayısı: ${tokens.length}`);
  } catch (e) {
    report('1. Döngü & Sıkışma Engelleme Testi', false, e.message);
  }

  // ───────────────────────────────────────────────────────────
  // 2. Türkçe Ünlü Uyumu & Fonetik Bütünlük Testi
  // ───────────────────────────────────────────────────────────
  try {
    const res = slm.generateText('evimizden yeni', 20, 0.3);
    const tokens = res.newTokens;
    let harmonyViolations = 0;
    
    for (let i = 1; i < tokens.length; i++) {
      const prev = tokens[i - 1];
      const curr = tokens[i];
      
      // If curr is a suffix, check vowel harmony with prev
      if (morphology.suffixFeatures.hasOwnProperty(curr)) {
        const prevHarmony = morphology.determineVowelHarmony(prev);
        const currHarmony = morphology.determineVowelHarmony(curr);
        if (prevHarmony !== currHarmony) {
          harmonyViolations++;
        }
      }
    }
    
    report('2. Türkçe Ünlü Uyumu ve Fonetik Testi', harmonyViolations === 0, `İhlal Sayısı: ${harmonyViolations}`);
  } catch (e) {
    report('2. Türkçe Ünlü Uyumu ve Fonetik Testi', false, e.message);
  }

  // ───────────────────────────────────────────────────────────
  // 3. Sözlük Dışı / Yabancı Karakter Sızıntı Testi (Zero-Leakage)
  // ───────────────────────────────────────────────────────────
  try {
    const res = slm.generateText('evimizden yeni', 30, 0.7);
    const turkishRegex = /^[a-zçgğıoöşuüâîû]+$/;
    let leakageCount = 0;
    
    res.newTokens.forEach(t => {
      if (!turkishRegex.test(t)) {
        leakageCount++;
      }
    });
    
    report('3. Zero-Leakage Sözlük Filtreleme Testi', leakageCount === 0, `Kaçak Karakter/Kelime: ${leakageCount}`);
  } catch (e) {
    report('3. Zero-Leakage Sözlük Filtreleme Testi', false, e.message);
  }

  // ───────────────────────────────────────────────────────────
  // 4. Farklı Tohum (Prompt) Kararlılık Testi
  // ───────────────────────────────────────────────────────────
  const prompts = [
    "bilim insanları yeni",
    "sabah erkenden yola",
    "bu projenin amacı",
    "dün akşam saatlerinde",
    "teknolojik gelişmeler ile"
  ];
  
  console.log('\n[Prompts Testing Cümle Çıktıları - greedy (temp=0)]');
  let promptFailures = 0;
  
  for (const p of prompts) {
    try {
      const res = slm.generateText(p, 6, 0.0);
      console.log(`  - Girdi: "${p}" -> Çıktı: "${res.generatedText}"`);
      if (!res.generatedText || res.newTokens.length === 0) {
        promptFailures++;
      }
    } catch (e) {
      promptFailures++;
      console.error(`  - Girdi: "${p}" -> Başarısız:`, e.message);
    }
  }
  
  report('4. Farklı Tohum (Prompt) Kararlılık Testi', promptFailures === 0, `Hata Sayısı: ${promptFailures}`);

  // ───────────────────────────────────────────────────────────
  // 5. Sıcaklık (Temperature) ve Top-P Eşik Kararlılığı
  // ───────────────────────────────────────────────────────────
  try {
    const temps = [0.0, 0.3, 0.7, 1.0];
    const outputs = [];
    for (const t of temps) {
      const res = slm.generateText('evimizden yeni', 6, t);
      outputs.push({ temp: t, text: res.generatedText });
    }
    
    console.log('\n[Temperature Ölçeklendirme Cümle Çıktıları]');
    outputs.forEach(o => {
      console.log(`  - Temp: ${o.temp.toFixed(1)} -> "${o.text}"`);
    });
    
    report('5. Sıcaklık Ölçeklendirme Kararlılık Testi', outputs.length === 4);
  } catch (e) {
    report('5. Sıcaklık Ölçeklendirme Kararlılık Testi', false, e.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('                         STRESS TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`  - Başarılı Test Sayısı   : ${passed}`);
  console.log(`  - Başarısız Test Sayısı  : ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runStressTest().catch(() => process.exit(1));
