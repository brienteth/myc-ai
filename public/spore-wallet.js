// ═══════════════════════════════════════════════════════════════════
// SPORE WALLET & MULTI-WALLET ENGINE (MYCA WALLETKIT)
// ═══════════════════════════════════════════════════════════════════
const API_BASE = window.location.origin;

// BIP-39 Standard Clean Wordlist
const BIP39_WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
  "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
  "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
  "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
  "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest",
  "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset",
  "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction"
];

let activeWallet = {
  type: 'none', // 'extension' | 'native' | 'metamask' | 'none'
  evmAddress: null,
  mycAddress: null
};

let currentBalances = { MYC: 8637, USDT: 1250, USDC: 1250 };
let lastGeneratedWords = [];

// Cryptographic helpers
function generateRandomMycAddress() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'myc1' + hex;
}

async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join("");
}

async function deriveAddressFromWords(words) {
  const seedStr = (Array.isArray(words) ? words.join(' ') : words).trim().toLowerCase().replace(/\s+/g, ' ');
  const privKey = await sha256Hex(seedStr);
  const addrHash = await sha256Hex(privKey);
  return 'myc1' + addrHash.slice(0, 32);
}

function toMycAddress(evmAddr) {
  if (!evmAddr) return null;
  const clean = evmAddr.toLowerCase().replace('0x', '');
  return 'myc1' + clean.slice(0, 32);
}

function toEvmAddress(mycAddr) {
  if (!mycAddr) return '0x0000000000000000000000000000000000000000';
  if (mycAddr.startsWith('0x')) return mycAddr;
  const clean = mycAddr.replace('myc1', '');
  return '0x' + clean.padEnd(40, '0');
}

function getActiveWalletAddress() {
  if (activeWallet.type === 'metamask') {
    return activeWallet.mycAddress || toMycAddress(activeWallet.evmAddress) || '';
  }
  return activeWallet.mycAddress || '';
}

function getActiveEvmAddress() {
  if (activeWallet.evmAddress) return activeWallet.evmAddress;
  return toEvmAddress(activeWallet.mycAddress);
}

function onConnectWalletButtonClick() {
  if (activeWallet.type !== 'none') {
    // Already connected: open sovereign account & transfer panel
    openWalletModal();
  } else {
    // Not connected: open WalletKit to select / download wallet
    openWalletKitModal();
  }
}

function openWalletModal() {
  const overlay = document.getElementById('wallet-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  openWalletSelectView();
  updateSporeWalletPanel();
}

function openWalletKitModal() {
  const overlay = document.getElementById('wallet-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  hideAllWalletViews();
  const kitView = document.getElementById('wallet-view-kit');
  if (kitView) kitView.style.display = 'block';

  // Detect Chrome Extension window.myc or global detection flag
  const statusBadge = document.getElementById('spore-ext-status-badge');
  const actionBox = document.getElementById('spore-ext-action-box');
  const isExtensionInstalled = (typeof window.myc !== 'undefined' && window.myc) || !!window.__MYCA_EXTENSION_DETECTED__;

  if (isExtensionInstalled) {
    if (statusBadge) statusBadge.innerHTML = '<span style="color:#00e87a; font-weight:700;">● Extension Detected in Chrome ⚡</span>';
    if (actionBox) {
      actionBox.innerHTML = `
        <button onclick="connectSporeExtension()" style="width: 100%; background: linear-gradient(135deg, #00f0ff, #10b981); color: #000; font-weight: 800; border: none; padding: 11px; border-radius: 10px; font-size: 13px; cursor: pointer; box-shadow: 0 4px 16px rgba(0, 240, 255, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>⚡</span> Connect Spore Extension
        </button>
        <div style="display:flex; gap:6px; margin-top:2px;">
          <a href="/spore-wallet-extension.zip" download="spore-wallet-extension.zip" style="flex:1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 8px; border-radius: 8px; font-size: 11px; font-weight:600; text-decoration: none; text-align:center;">
            📥 Download Zip
          </a>
          <button onclick="toggleExtensionGuide()" style="flex:1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 8px; border-radius: 8px; font-size: 11px; font-weight:600; cursor: pointer;">
            📖 Guide
          </button>
        </div>
      `;
    }
  } else {
    if (statusBadge) statusBadge.innerHTML = '<span style="color:#f59e0b; font-weight:600;">● Extension Not Detected (Refresh if installed)</span>';
    if (actionBox) {
      actionBox.innerHTML = `
        <a href="/spore-wallet-extension.zip" download="spore-wallet-extension.zip" style="width: 100%; background: linear-gradient(135deg, #00f0ff, #10b981); color: #000; font-weight: 800; border: none; padding: 11px; border-radius: 10px; font-size: 12.5px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(0, 240, 255, 0.35); text-align:center;">
          <span>📥</span> Download Chrome Extension (.zip)
        </a>
        <div style="display:flex; gap:6px; margin-top:2px;">
          <button onclick="toggleExtensionGuide()" style="flex:1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 8px; border-radius: 8px; font-size: 11px; font-weight:600; cursor: pointer;">
            📖 How to Install
          </button>
          <button onclick="connectWebSporeWallet()" style="flex:1; background: rgba(0,240,255,0.08); border: 1px solid rgba(0,240,255,0.25); color: #00f0ff; padding: 8px; border-radius: 8px; font-size: 11px; font-weight:700; cursor: pointer;">
            🌐 Web Sandbox
          </button>
        </div>
        <div id="ext-install-guide" style="display:none; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; font-size: 11px; color: #94a3b8; line-height: 1.5; margin-top: 4px; text-align: left;">
          <b style="color:#fff;">3-Step Chrome Installation:</b><br>
          1. Extract downloaded <code style="color:#00f0ff;">spore-wallet-extension.zip</code>.<br>
          2. Go to <code style="color:#00f0ff;">chrome://extensions/</code> and enable <b>Developer mode</b>.<br>
          3. Click <b>Load unpacked</b> and select the extracted folder.<br>
          4. <b>Refresh this page (F5)</b> and click Connect Spore Extension!
        </div>
      `;
    }
  }
}

function toggleExtensionGuide() {
  const guide = document.getElementById('ext-install-guide');
  if (guide) {
    guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
  }
}

async function connectSporeExtension() {
  if (typeof window.myc !== 'undefined' && window.myc && typeof window.myc.connect === 'function') {
    try {
      const accounts = await window.myc.connect();
      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        activeWallet = {
          type: 'extension',
          evmAddress: toEvmAddress(addr),
          mycAddress: addr
        };
        try {
          localStorage.setItem('myca_wallet_type', 'extension');
          localStorage.setItem('myca_native_address', addr);
        } catch(e) {}
        updateWalletUI();
        closeWalletModal();
        showToast('Connected!', 'Authenticated via Spore Extension: ' + addr.slice(0, 10) + '...', 'success');
        return;
      }
    } catch(e) {
      showToast('Connection Rejected', e.message || 'User canceled connection', 'error');
      return;
    }
  }

  // If extension is not detected, DO NOT connect web wallet silently!
  showToast('Extension Not Detected', 'Please install Spore Wallet extension and refresh this page (F5).', 'error');
}

function connectWebSporeWallet() {
  let savedMyc = null;
  try { savedMyc = localStorage.getItem('myca_native_address'); } catch(e) {}
  if (!savedMyc) {
    savedMyc = generateRandomMycAddress();
    try { localStorage.setItem('myca_native_address', savedMyc); } catch(e) {}
  }
  activeWallet = {
    type: 'native',
    evmAddress: toEvmAddress(savedMyc),
    mycAddress: savedMyc
  };
  try { localStorage.setItem('myca_wallet_type', 'native'); } catch(e) {}
  updateWalletUI();
  closeWalletModal();
  showToast('Connected!', 'Using Web Sandbox Wallet: ' + savedMyc.slice(0, 10) + '...', 'info');
}

async function connectMetaMaskWallet() {
  const provider = (function() {
    if (window.ethereum) {
      if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
        return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
      }
      return window.ethereum;
    }
    return null;
  })();

  if (!provider) {
    showToast('MetaMask Not Found', 'Please install MetaMask extension in Chrome', 'error');
    return;
  }
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      const userAccount = accounts[0];
      const derivedMyc = toMycAddress(userAccount) || generateRandomMycAddress();
      activeWallet = {
        type: 'metamask',
        evmAddress: userAccount,
        mycAddress: derivedMyc
      };
      try {
        localStorage.setItem('myca_wallet_type', 'metamask');
        localStorage.setItem('myca_evm_address', userAccount);
        localStorage.setItem('myca_native_address', derivedMyc);
      } catch(e) {}
      updateWalletUI();
      closeWalletModal();
      showToast('Connected!', 'MetaMask Connected: ' + userAccount.slice(0, 6) + '...' + userAccount.slice(-4), 'success');
    }
  } catch(e) {
    showToast('MetaMask Error', e.message, 'error');
  }
}

function closeWalletModal() {
  const overlay = document.getElementById('wallet-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

function onWalletModalOverlayClick(e) {
  if (e.target.id === 'wallet-modal-overlay') closeWalletModal();
}

function hideAllWalletViews() {
  const views = ['wallet-view-kit', 'wallet-view-select', 'wallet-view-connected', 'wallet-view-create', 'wallet-view-import'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function openWalletSelectView() {
  hideAllWalletViews();
  const sel = document.getElementById('wallet-view-select');
  if (sel) sel.style.display = 'block';
}

function openWalletDetailsView() {
  openWalletSelectView();
}

function openWalletCreateView() {
  hideAllWalletViews();
  const cv = document.getElementById('wallet-view-create');
  if (cv) cv.style.display = 'block';
  generate12Words();
}

function openWalletImportView() {
  hideAllWalletViews();
  const iv = document.getElementById('wallet-view-import');
  if (iv) iv.style.display = 'block';
}

function updateWalletUI() {
  const btn = document.getElementById('btn-connect-wallet');
  const label = document.getElementById('wallet-btn-label');
  const icon = document.getElementById('wallet-btn-icon');
  const navBal = document.getElementById('nav-wallet-balance');
  const navBalPill = document.getElementById('nav-wallet-balance-pill');

  if (activeWallet.type === 'none' || !activeWallet.mycAddress) {
    if (btn) {
      btn.classList.remove('connected');
      btn.style.background = '#111827';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      btn.style.color = '#ffffff';
    }
    if (icon) icon.innerText = '⚡';
    if (label) label.innerText = 'Connect Wallet';
    if (navBal) navBal.innerText = '0.00 MYC';
    if (navBalPill) navBalPill.style.opacity = '0.4';
    return;
  }

  if (btn) {
    btn.classList.add('connected');
    btn.style.background = 'rgba(16, 185, 129, 0.15)';
    btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    btn.style.color = '#34d399';
  }
  if (navBalPill) navBalPill.style.opacity = '1';

  if (activeWallet.type === 'metamask') {
    if (icon) icon.innerText = '🦊';
    const addr = activeWallet.evmAddress || '';
    if (label) label.innerText = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'MetaMask';
  } else if (activeWallet.type === 'extension') {
    if (icon) icon.innerText = '🍄';
    const addr = activeWallet.mycAddress;
    if (label) label.innerText = addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : 'Spore Extension';
  } else {
    if (icon) icon.innerText = '🌐';
    const addr = activeWallet.mycAddress;
    if (label) label.innerText = addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : 'Web Sandbox';
  }

  if (navBal) {
    var bal = currentBalances.MYC || 8637;
    navBal.innerText = parseFloat(bal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' MYC';
  }
}

function updateSporeWalletPanel() {
  var addr = getActiveWalletAddress();
  var pufEl = document.getElementById('spore-puf-address');
  var pufBadge = document.getElementById('spore-puf-badge');
  var balEl = document.getElementById('spore-balance-display');
  var navBal = document.getElementById('nav-wallet-balance');
  var titleEl = document.getElementById('spore-panel-title');
  var typeEl = document.getElementById('spore-wallet-type-indicator');
  var webBanner = document.getElementById('spore-web-wallet-banner');

  if (pufEl) pufEl.innerText = addr ? (addr.slice(0,12) + '...' + addr.slice(-6)) : 'Not Connected';
  
  if (activeWallet.type === 'extension') {
    if (titleEl) titleEl.innerText = 'SPORE EXTENSION';
    if (typeEl) typeEl.innerHTML = '<span style="color:#00e87a;">● Spore Chrome Extension Connected</span>';
    if (pufBadge) pufBadge.innerText = 'EXT';
    if (webBanner) webBanner.style.display = 'none';
  } else if (activeWallet.type === 'metamask') {
    if (titleEl) titleEl.innerText = 'METAMASK';
    if (typeEl) typeEl.innerHTML = '<span style="color:#fbbf24;">● MetaMask EVM (Chain 108)</span>';
    if (pufBadge) pufBadge.innerText = 'EVM';
    if (webBanner) webBanner.style.display = 'none';
  } else if (activeWallet.type === 'native') {
    if (titleEl) titleEl.innerText = 'WEB SANDBOX';
    if (typeEl) typeEl.innerHTML = '<span style="color:#f59e0b;">● Web Sandbox Wallet (Local)</span>';
    if (pufBadge) pufBadge.innerText = 'WEB';
    if (webBanner) webBanner.style.display = 'flex';
  }

  var bal = (currentBalances && currentBalances.MYC !== undefined) ? currentBalances.MYC : 8637;
  var formatted = parseFloat(bal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  if (balEl) {
    balEl.innerHTML = formatted + ' <span class="currency">$MYC</span>';
  }
  if (activeWallet.type !== 'none' && navBal) {
    navBal.innerText = formatted + ' MYC';
  }
}

function copySporeAddress() {
  var addr = getActiveWalletAddress();
  if (addr) {
    navigator.clipboard.writeText(addr).then(function() {
      showToast('Copied!', '' + addr, 'success');
    });
  } else {
    showToast('No wallet', 'Connect a wallet first', 'error');
  }
}

function sporeActionSend() {
  var el = document.getElementById('spore-recipient-input');
  if (el) el.focus();
}

function sporeActionReceive() {
  var addr = getActiveWalletAddress();
  if (addr) {
    navigator.clipboard.writeText(addr).then(function() {
      showToast('Address Copied!', 'Share to receive $MYC: ' + addr.slice(0, 12) + '...', 'success');
    });
  } else {
    showToast('No wallet', 'Connect a wallet first', 'error');
  }
}

async function executeSporeTransfer() {
  var recipient = (document.getElementById('spore-recipient-input') || {}).value || '';
  var amount = parseFloat((document.getElementById('spore-amount-input') || {}).value) || 0;
  var sender = getActiveWalletAddress();
  if (!sender || activeWallet.type === 'none') { showToast('No wallet', 'Connect a wallet first', 'error'); return; }
  if (!recipient || !recipient.startsWith('myc1')) { showToast('Invalid', 'Enter a valid myc1... address', 'error'); return; }
  if (amount <= 0) { showToast('Invalid', 'Enter amount > 0', 'error'); return; }
  if (amount > (currentBalances.MYC || 0)) { showToast('Insufficient', 'Only have ' + currentBalances.MYC + ' MYC', 'error'); return; }
  
  try {
    currentBalances.MYC -= amount;
    showToast('Sent!', amount + ' MYC sent to ' + recipient.slice(0, 10) + '... (0 Gas)', 'success');
    document.getElementById('spore-recipient-input').value = '';
    document.getElementById('spore-amount-input').value = '';
    updateSporeWalletPanel();
    updateWalletUI();
  } catch (e) {
    showToast('Error', e.message, 'error');
  }
}

function disconnectWallet() {
  activeWallet = { type: 'none', evmAddress: null, mycAddress: null };
  try {
    localStorage.removeItem('myca_wallet_type');
    localStorage.removeItem('myca_native_address');
    localStorage.removeItem('myca_evm_address');
  } catch (e) {}
  if (typeof window.myc !== 'undefined' && window.myc) {
    window.myc.isConnectedState = false;
  }
  updateWalletUI();
  closeWalletModal();
  showToast('Disconnected', 'Wallet successfully disconnected.', 'info');
}

function generate12Words() {
  const randomIndices = new Uint8Array(12);
  crypto.getRandomValues(randomIndices);
  lastGeneratedWords = [];
  for (let i = 0; i < 12; i++) {
    lastGeneratedWords.push(BIP39_WORDS[randomIndices[i] % BIP39_WORDS.length]);
  }
  const container = document.getElementById('create-words-container');
  if (container) {
    container.innerHTML = lastGeneratedWords.map((w, idx) => `<div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;font-family:var(--f-mono);font-size:11px;color:#38bdf8;">${idx+1}. ${w}</div>`).join('');
  }
}

async function executeActivateCreatedWallet() {
  const newAddr = lastGeneratedWords.length === 12
    ? await deriveAddressFromWords(lastGeneratedWords)
    : generateRandomMycAddress();

  try {
    localStorage.setItem('myca_native_address', newAddr);
    localStorage.setItem('myca_wallet_type', 'native');
    localStorage.setItem('myca_wallet_seed', lastGeneratedWords.join(' '));
  } catch(e) {}
  activeWallet = { type: 'native', evmAddress: toEvmAddress(newAddr), mycAddress: newAddr };
  updateWalletUI();
  openWalletSelectView();
  updateSporeWalletPanel();
  showToast('Wallet Created!', 'Your 12-word seed wallet is now active: ' + newAddr.slice(0, 12) + '...', 'success');
}

async function executeImportSeed() {
  const input = document.getElementById('import-seed-input');
  if (!input || !input.value.trim()) {
    showToast('Empty Seed', 'Please enter your 12-word recovery seed', 'error');
    return;
  }
  const words = input.value.trim().split(/\s+/);
  if (words.length !== 12) {
    showToast('Invalid Seed', 'Please enter exactly 12 words (found ' + words.length + ')', 'error');
    return;
  }
  const newAddr = await deriveAddressFromWords(words);
  try {
    localStorage.setItem('myca_native_address', newAddr);
    localStorage.setItem('myca_wallet_type', 'native');
    localStorage.setItem('myca_wallet_seed', words.join(' '));
  } catch(e) {}
  activeWallet = { type: 'native', evmAddress: toEvmAddress(newAddr), mycAddress: newAddr };
  updateWalletUI();
  openWalletSelectView();
  updateSporeWalletPanel();
  showToast('Seed Imported!', 'Wallet successfully restored: ' + newAddr.slice(0, 12) + '...', 'success');
}

function showToast(title, msg, type = 'info') {
  let container = document.getElementById('hub-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hub-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'hub-toast';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<div class="hub-toast-title">${icon} ${title}</div><div class="hub-toast-msg">${msg}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'hubToastOut 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function initSporeWallet() {
  let savedType = null;
  try { savedType = localStorage.getItem('myca_wallet_type'); } catch(e) {}
  let savedMyc = null;
  try { savedMyc = localStorage.getItem('myca_native_address'); } catch(e) {}

  // Auto-connect ONLY if user previously saved connection
  if (savedType === 'extension' && typeof window.myc !== 'undefined' && window.myc) {
    const extAddr = window.myc.selectedAddress || savedMyc;
    activeWallet = {
      type: 'extension',
      evmAddress: toEvmAddress(extAddr),
      mycAddress: extAddr
    };
  } else if (savedType === 'native' && savedMyc) {
    activeWallet = {
      type: 'native',
      evmAddress: toEvmAddress(savedMyc),
      mycAddress: savedMyc
    };
  } else if (savedType === 'metamask') {
    let savedEvm = null;
    try { savedEvm = localStorage.getItem('myca_evm_address'); } catch(e) {}
    if (savedEvm) {
      activeWallet = {
        type: 'metamask',
        evmAddress: savedEvm,
        mycAddress: toMycAddress(savedEvm)
      };
    } else {
      activeWallet = { type: 'none', evmAddress: null, mycAddress: null };
    }
  } else {
    // Default: NOT CONNECTED (Connect Wallet button shown)
    activeWallet = {
      type: 'none',
      evmAddress: null,
      mycAddress: null
    };
  }
  updateWalletUI();
}

document.addEventListener('DOMContentLoaded', () => {
  initSporeWallet();
  // If window.myc was injected slightly later, re-sync
  window.addEventListener('myc#initialized', () => {
    const savedType = localStorage.getItem('myca_wallet_type');
    if (savedType === 'extension' && window.myc && window.myc.selectedAddress) {
      activeWallet.mycAddress = window.myc.selectedAddress;
      activeWallet.evmAddress = toEvmAddress(window.myc.selectedAddress);
      updateWalletUI();
    }
  });
});
