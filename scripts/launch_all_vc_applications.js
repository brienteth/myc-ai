#!/usr/bin/env node
/**
 * ============================================================================
 * MYCA NETWORK: ONE-CLICK APPLICATION LAUNCHER & SUBMISSION ASSISTANT
 * ============================================================================
 * Copies formatted pitch text to clipboard (macOS pbcopy) and opens each
 * investment portal so submission can be executed with zero friction.
 * ============================================================================
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('====================================================================');
console.log('🏛️  MYCA NETWORK: TEK TIKLA BAŞVURU YÜRÜTÜCÜSÜ (ONE-CLICK LAUNCHER)');
console.log('====================================================================\n');

const emailDraftPath = path.resolve('ecosystem_listings/OFFICIAL_VC_PITCH_EMAIL_DRAFT.txt');
const emailContent = fs.readFileSync(emailDraftPath, 'utf8');

// macOS panosuna (Clipboard) başvuru metnini kopyala
try {
  execSync('pbcopy', { input: emailContent });
  console.log('📋 [PANOYA KOPYALANDI] Resmi Başvuru & Pitch Metni macOS panonuza kopyalandı!');
  console.log('   (Herhangi bir forma veya e-postaya Command + V (Yapıştır) yapabilirsiniz)\n');
} catch (e) {
  console.log('⚠️  Panoya otomatik kopyalama atlandı.');
}

const portals = [
  { name: 'Borderless Capital (100M$ DePIN Fund)', url: 'https://www.borderlesscapital.io/pitch' },
  { name: 'Multicoin Capital Pitch Portal', url: 'https://multicoin.capital/contact/' },
  { name: 'Escape Velocity (EV3) DePIN Fund', url: 'https://ev3.company/contact' },
  { name: 'Pantera Capital Deal Form', url: 'https://panteracapital.com/contact/' },
  { name: 'CoinFund Web3 Infrastructure', url: 'https://www.coinfund.io/contact' },
  { name: 'Outlier Ventures DePIN Base Camp', url: 'https://outlierventures.io/base-camp/' },
  { name: 'Animoca Brands Investment Portal', url: 'https://www.animocabrands.com/contact' },
  { name: 'Base Ecosystem Grants Portal', url: 'https://base.org/ecosystem' },
  { name: 'IoTeX DePINsurf Accelerator', url: 'https://depinsurf.com/' }
];

console.log('🌐 Web Tarayıcınızda (Chrome/Safari) Başvuru Sayfaları Açılıyor...\n');

portals.forEach((p, idx) => {
  console.log(` [${idx + 1}/${portals.length}] Açılıyor: ${p.name}`);
  try {
    execSync(`open "${p.url}"`);
  } catch (err) {
    console.error(`  Hata: ${p.url} açılamadı.`);
  }
});

console.log('\n====================================================================');
console.log('🚀 TÜM PORTALLAR AÇILDI & METİN PANONUZDA HAZIR!');
console.log('====================================================================');
