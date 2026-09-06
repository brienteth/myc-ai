import fs from 'fs';
import path from 'path';

const SRC_DIR = '/Users/bl10buer/Desktop/myc-network/dashboard';
const DEST_DIR = '/Users/bl10buer/Desktop/myca-private-main/depin';
const MYCA_PRIVATE_ROOT = '/Users/bl10buer/Desktop/myca-private-main';

console.log('🚀 Starting synchronization to myca-private-main for /depin sub-routes...');

// 1. Ensure target directory exists
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  console.log(`📁 Created target directory: ${DEST_DIR}`);
}

// 2. Mapping of dashboard source files to destination filenames
const fileMap = {
  'landing.html': 'index.html', // Landing page at mycai.pro/depin
  'docs.html': 'docs.html',     // mycai.pro/depin/docs
  'dev-docs.html': 'dev-docs.html', // mycai.pro/depin/dev-docs
  'hub.html': 'hub.html',       // mycai.pro/depin/hub
  'mint.html': 'mint.html',     // mycai.pro/depin/mint
  'marketplace.html': 'marketplace.html', // mycai.pro/depin/marketplace
  'x-card.html': 'x-card.html', // mycai.pro/depin/x-card
  'arcade.html': 'arcade.html', // mycai.pro/depin/arcade
  'contracts.html': 'contracts.html', // mycai.pro/depin/contracts
  'explorer.html': 'explorer.html', // mycai.pro/depin/explorer
  'build.html': 'build.html',   // mycai.pro/depin/build
  'brand.css': 'brand.css'
};

// 3. Static asset files to copy verbatim
const assetFiles = [
  'myca_resonance_asset_x.png',
  'myca_resonance_asset_x.jpg',
  'mycai_logo.png'
];

// Helper to replace links accurately
function rewriteLinks(content) {
  let updated = content;

  // Replace brand logo link: href="/" -> href="/depin"
  updated = updated.replace(/href=["']\/["'](\s+class=["'][^"']*brand)/g, 'href="/depin"$1');
  updated = updated.replace(/<a\s+href=["']\/["']\s+class=["']myca-brand["']/g, '<a href="/depin" class="myca-brand"');
  updated = updated.replace(/<a\s+href=["']\/["']\s+class=["']brand["']/g, '<a href="/depin" class="brand"');

  // Replace route links
  const routeReplacements = [
    [/href=["']\/hub(\.html)?(["'#])/g, 'href="/depin/hub$2'],
    [/href=["']\/discover(\.html)?(["'#])/g, 'href="/depin/hub$2'],
    [/href=["']\/docs(\.html)?(["'#])/g, 'href="/depin/docs$2'],
    [/href=["']\/dev-docs(\.html)?(["'#])/g, 'href="/depin/dev-docs$2'],
    [/href=["']\/mint(\.html)?(["'#])/g, 'href="/depin/mint$2'],
    [/href=["']\/marketplace(\.html)?(["'#])/g, 'href="/depin/marketplace$2'],
    [/href=["']\/market(\.html)?(["'#])/g, 'href="/depin/marketplace$2'],
    [/href=["']\/x-card(\.html)?(["'#])/g, 'href="/depin/x-card$2'],
    [/href=["']\/arcade(\.html)?(["'#])/g, 'href="/depin/arcade$2'],
    [/href=["']\/game(\.html)?(["'#])/g, 'href="/depin/arcade$2'],
    [/href=["']\/contracts(\.html)?(["'#])/g, 'href="/depin/contracts$2'],
    [/href=["']\/explorer(\.html)?(["'#])/g, 'href="/depin/explorer$2'],
    [/href=["']\/build(\.html)?(["'#])/g, 'href="/depin/build$2'],
    [/href=["']\/swap(\.html)?(["'#])/g, 'href="/depin/swap$2'],
    [/href=["']\/bridge(\.html)?(["'#])/g, 'href="/depin/bridge$2'],
    [/href=["']\/faucet(\.html)?(["'#])/g, 'href="/depin/faucet$2'],
    [/href=["']\/staking(\.html)?(["'#])/g, 'href="/depin/staking$2'],
    [/href=["']\/streampay(\.html)?(["'#])/g, 'href="/depin/streampay$2'],
    [/href=["']\/opacuspay(\.html)?(["'#])/g, 'href="/depin/streampay$2']
  ];

  for (const [regex, replacement] of routeReplacements) {
    updated = updated.replace(regex, replacement);
  }

  // Replace asset paths
  updated = updated.replace(/href=["']\/brand\.css["']/g, 'href="/depin/brand.css"');
  updated = updated.replace(/src=["']\/mycai_logo\.png["']/g, 'src="/depin/mycai_logo.png"');
  updated = updated.replace(/href=["']\/mycai_logo\.png["']/g, 'href="/depin/mycai_logo.png"');
  updated = updated.replace(/src=["']\/myca_resonance_asset_x\.png["']/g, 'src="/depin/myca_resonance_asset_x.png"');
  updated = updated.replace(/src=["']\/myca_resonance_asset_x\.jpg["']/g, 'src="/depin/myca_resonance_asset_x.jpg"');
  updated = updated.replace(/href=["']\/myca_resonance_asset_x\.png["']/g, 'href="/depin/myca_resonance_asset_x.png"');

  // Breadcrumbs in GitBook docs
  updated = updated.replace(/<a href=["']\/docs["']>Docs<\/a>/g, '<a href="/depin/docs">Docs</a>');
  updated = updated.replace(/<a href=["']\/dev-docs["']>Dev Docs<\/a>/g, '<a href="/depin/dev-docs">Dev Docs</a>');

  return updated;
}

// 4. Process all HTML / CSS files
for (const [srcName, destName] of Object.entries(fileMap)) {
  const srcPath = path.join(SRC_DIR, srcName);
  const destPath = path.join(DEST_DIR, destName);

  if (fs.existsSync(srcPath)) {
    const rawContent = fs.readFileSync(srcPath, 'utf8');
    const processedContent = srcName.endsWith('.html') ? rewriteLinks(rawContent) : rawContent;
    fs.writeFileSync(destPath, processedContent, 'utf8');
    console.log(`✅ Synced & link-rewritten: ${srcName} -> depin/${destName}`);
  } else {
    console.warn(`⚠️ Source file not found: ${srcPath}`);
  }
}

// 5. Copy image assets
for (const asset of assetFiles) {
  const srcPath = path.join(SRC_DIR, asset);
  const destPath = path.join(DEST_DIR, asset);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`🖼️ Copied asset to depin/${asset}`);
    // Also copy to root just in case
    fs.copyFileSync(srcPath, path.join(MYCA_PRIVATE_ROOT, asset));
  }
}

// 5b. Copy config
const CONFIG_DEST = path.join(DEST_DIR, 'config');
if (!fs.existsSync(CONFIG_DEST)) fs.mkdirSync(CONFIG_DEST, { recursive: true });
const cfgSrc = path.join('/Users/bl10buer/Desktop/myc-network/dashboard/config', 'base.js');
if (fs.existsSync(cfgSrc)) {
  fs.copyFileSync(cfgSrc, path.join(CONFIG_DEST, 'base.js'));
  console.log('⚙️ Synced config: depin/config/base.js');
}

// 5c. Copy contracts/base
const CONTRACTS_BASE_SRC = '/Users/bl10buer/Desktop/myc-network/contracts/base';
const CONTRACTS_BASE_DEST = path.join(MYCA_PRIVATE_ROOT, 'contracts/base');
if (!fs.existsSync(CONTRACTS_BASE_DEST)) fs.mkdirSync(CONTRACTS_BASE_DEST, { recursive: true });
if (!fs.existsSync(path.join(CONTRACTS_BASE_DEST, 'interfaces'))) fs.mkdirSync(path.join(CONTRACTS_BASE_DEST, 'interfaces'), { recursive: true });

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyDirRecursive(CONTRACTS_BASE_SRC, CONTRACTS_BASE_DEST);
console.log('📜 Synced contracts/base/ Solidity files to myca-private-main');

// 5d. Copy PoQR & Adversarial scripts
const SCRIPTS_DEST = path.join(MYCA_PRIVATE_ROOT, 'scripts');
if (!fs.existsSync(SCRIPTS_DEST)) fs.mkdirSync(SCRIPTS_DEST, { recursive: true });
const scriptFiles = [
  'poqr_engine.js',
  'merkle_builder.js',
  'snapshot_builder.js',
  'watcher_verifier.js',
  'simulate_node_sale_and_rewards.js'
];
for (const sf of scriptFiles) {
  const sfSrc = path.join('/Users/bl10buer/Desktop/myc-network/scripts', sf);
  if (fs.existsSync(sfSrc)) {
    fs.copyFileSync(sfSrc, path.join(SCRIPTS_DEST, sf));
  }
}
console.log('🛡️ Synced PoQR scripts to myca-private-main/scripts');

// 6. Copy documentation files
const docFiles = ['WHITEPAPER_COMPREHENSIVE.md', 'PITCH_DECK.md'];
const DOCS_DEST = path.join(MYCA_PRIVATE_ROOT, 'docs');
if (!fs.existsSync(DOCS_DEST)) fs.mkdirSync(DOCS_DEST, { recursive: true });

for (const doc of docFiles) {
  const srcDoc = path.join('/Users/bl10buer/Desktop/myc-network/docs', doc);
  const destDoc = path.join(DOCS_DEST, doc);
  if (fs.existsSync(srcDoc)) {
    fs.copyFileSync(srcDoc, destDoc);
    console.log(`📄 Synced documentation: docs/${doc}`);
  }
}

// 7. Update vercel.json in myca-private-main
const vercelConfigPath = path.join(MYCA_PRIVATE_ROOT, 'vercel.json');
let vercelConfig = {};
if (fs.existsSync(vercelConfigPath)) {
  try {
    vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
  } catch (e) {
    vercelConfig = { cleanUrls: true, trailingSlash: false, rewrites: [] };
  }
}

vercelConfig.cleanUrls = true;
vercelConfig.trailingSlash = false;
if (!vercelConfig.rewrites) vercelConfig.rewrites = [];

// Define all /depin sub-routes
const depinRewrites = [
  { source: "/depin", destination: "/depin/index.html" },
  { source: "/depin/", destination: "/depin/index.html" },
  { source: "/depin/docs", destination: "/depin/docs.html" },
  { source: "/depin/dev-docs", destination: "/depin/dev-docs.html" },
  { source: "/depin/hub", destination: "/depin/hub.html" },
  { source: "/depin/discover", destination: "/depin/hub.html" },
  { source: "/depin/mint", destination: "/depin/mint.html" },
  { source: "/depin/marketplace", destination: "/depin/marketplace.html" },
  { source: "/depin/market", destination: "/depin/marketplace.html" },
  { source: "/depin/x-card", destination: "/depin/x-card.html" },
  { source: "/depin/arcade", destination: "/depin/arcade.html" },
  { source: "/depin/game", destination: "/depin/arcade.html" },
  { source: "/depin/contracts", destination: "/depin/contracts.html" },
  { source: "/depin/explorer", destination: "/depin/explorer.html" },
  { source: "/depin/build", destination: "/depin/build.html" },
  { source: "/depin/swap", destination: "/depin/hub.html" },
  { source: "/depin/bridge", destination: "/depin/hub.html" },
  { source: "/depin/faucet", destination: "/depin/hub.html" },
  { source: "/depin/staking", destination: "/depin/hub.html" },
  { source: "/depin/streampay", destination: "/depin/hub.html" }
];

// Remove any existing /depin rewrite to prevent collisions
vercelConfig.rewrites = vercelConfig.rewrites.filter(r => !r.source.startsWith('/depin'));

// Prepend the new depin rewrites at the top of the rewrites array
vercelConfig.rewrites.unshift(...depinRewrites);

fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2), 'utf8');
console.log('⚙️ Updated myca-private-main/vercel.json with all /depin rewrites!');
console.log('✨ Sync complete! Ready for Vercel deployment.');
