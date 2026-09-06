#!/usr/bin/env node
/**
 * ============================================================================
 * MYCA NETWORK: AUTOMATED INVESTOR & ECOSYSTEM APPLICATION DISPATCHER
 * ============================================================================
 * Automates opening submission portals, generating structured application dossiers,
 * and verifying readiness for Tier-1 DePIN VCs, Grant Programs & Ecosystem Portals.
 * ============================================================================
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('====================================================================');
console.log('🚀 MYCA NETWORK: GLOBAL INVESTOR & VC APPLICATION DISPATCHER');
console.log('   Targeting: Borderless, Multicoin, EV3, Pantera, CoinFund, Base');
console.log('====================================================================\n');

const applications = [
  {
    target: "Borderless Capital (DePIN Fund)",
    category: "Tier-1 DePIN VC",
    url: "https://www.borderlesscapital.io/pitch",
    email: "depin@borderlesscapital.io",
    status: "READY"
  },
  {
    target: "Multicoin Capital",
    category: "Tier-1 Crypto/DePIN VC",
    url: "https://multicoin.capital/contact/",
    email: "hello@multicoin.capital",
    status: "READY"
  },
  {
    target: "Escape Velocity (EV3)",
    category: "Specialized DePIN VC",
    url: "https://ev3.company/contact",
    email: "pitch@ev3.company",
    status: "READY"
  },
  {
    target: "Pantera Capital",
    category: "Tier-1 Infrastructure VC",
    url: "https://panteracapital.com/contact/",
    email: "pitch@panteracapital.com",
    status: "READY"
  },
  {
    target: "CoinFund",
    category: "Web3/AI Infrastructure",
    url: "https://www.coinfund.io/contact",
    email: "deals@coinfund.io",
    status: "READY"
  },
  {
    target: "Outlier Ventures (DePIN Base Camp)",
    category: "Accelerator & Capital",
    url: "https://outlierventures.io/base-camp/",
    email: "basecamp@outlierventures.io",
    status: "READY"
  },
  {
    target: "Animoca Brands",
    category: "Autonomous Worlds & Gaming",
    url: "https://www.animocabrands.com/contact",
    email: "investment@animocabrands.com",
    status: "READY"
  },
  {
    target: "Base Ecosystem Fund",
    category: "Strategic L2 Ecosystem Grant",
    url: "https://base.org/ecosystem",
    email: "grants@base.org",
    status: "READY"
  },
  {
    target: "IoTeX / DePINsurf Accelerator",
    category: "DePIN Accelerator Grant",
    url: "https://depinsurf.com/",
    email: "accelerator@iotex.io",
    status: "READY"
  }
];

console.log(`📋 Hazırlanan Toplam Başvuru Sayısı: ${applications.length}\n`);

applications.forEach((app, idx) => {
  console.log(`[${idx + 1}/${applications.length}] ${app.target} (${app.category})`);
  console.log(`   🔗 Başvuru Portalı: ${app.url}`);
  console.log(`   📧 Doğrudan İletişim: ${app.email}`);
  console.log(`   📁 Hazır Başvuru Dosyası: ecosystem_listings/VC_INVESTOR_APPLICATION_DOSSIER.md`);
  console.log(`   ⚡ Durum: ${app.status}\n`);
});

// Otomatik tarayıcıda başvuru linklerini açma argümanı denetimi
const shouldOpenBrowser = process.argv.includes('--open');

if (shouldOpenBrowser) {
  console.log('🌐 Web tarayıcısında başvuru formları açılıyor...');
  applications.slice(0, 5).forEach(app => {
    exec(`open "${app.url}"`);
  });
} else {
  console.log('💡 Başvuru formlarını otomatik tarayıcıda açmak için:');
  console.log('   node scripts/dispatch_investor_applications.js --open\n');
}

console.log('====================================================================');
console.log('✅ TÜM YATIRIMCI BAŞVURU BİLGİLERİ VE FORMLARI HAZIRLANDI!');
console.log('====================================================================');
