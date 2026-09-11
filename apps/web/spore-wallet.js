// ═══════════════════════════════════════════════════════════════════
// SPORE WALLET & MULTI-WALLET CORE ENGINE (SHARED)
// ═══════════════════════════════════════════════════════════════════
const API_BASE = window.location.origin;
const DEFAULT_WALLET = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";

let activeWallet = {
  type: 'none', // 'metamask' | 'native' | 'none'
  evmAddress: null,
  mycAddress: DEFAULT_WALLET
};

let currentBalances = { MYC: 8637, USDT: 1250, USDC: 1250 };

function toMycAddress(evmAddr) {
  if (!evmAddr) return DEFAULT_WALLET;
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
    return activeWallet.mycAddress || toMycAddress(activeWallet.evmAddress) || DEFAULT_WALLET;
  }
  return activeWallet.mycAddress || DEFAULT_WALLET;
}

function getActiveEvmAddress() {
  if (activeWallet.evmAddress) return activeWallet.evmAddress;
  return toEvmAddress(activeWallet.mycAddress);
}

async function onConnectWalletButtonClick() {
  let savedMyc = null;
  try { savedMyc = localStorage.getItem('myca_native_address'); } catch(e) {}
  if (!savedMyc) {
    savedMyc = DEFAULT_WALLET;
    try {
      localStorage.setItem('myca_native_address', savedMyc);
      localStorage.setItem('myca_wallet_type', 'native');
    } catch(e) {}
  }
  activeWallet = {
    type: 'native',
    evmAddress: toEvmAddress(savedMyc),
    mycAddress: savedMyc
  };
  updateWalletUI();
  openWalletModal();
}

function openWalletModal() {
  const overlay = document.getElementById('wallet-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  openWalletSelectView();
  updateSporeWalletPanel();
}

function closeWalletModal() {
  const overlay = document.getElementById('wallet-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

function onWalletModalOverlayClick(e) {
  if (e.target.id === 'wallet-modal-overlay') closeWalletModal();
}

function hideAllWalletViews() {
  const views = ['wallet-view-select', 'wallet-view-connected', 'wallet-view-create', 'wallet-view-import'];
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
  hideAllWalletViews();
  const det = document.getElementById('wallet-view-connected');
  if (det) det.style.display = 'block';

  const icon = document.getElementById('connected-wallet-icon');
  const title = document.getElementById('connected-wallet-title');
  const bal = document.getElementById('connected-wallet-balance');
  const evmEl = document.getElementById('connected-address-evm');
  const mycEl = document.getElementById('connected-address-myc');

  if (activeWallet.type === 'metamask') {
    if (icon) icon.innerText = '🦊';
    if (title) title.innerText = 'MetaMask (Chain 108)';
  } else {
    if (icon) icon.innerText = '🍄';
    if (title) title.innerText = 'Spore Wallet';
  }

  if (bal) bal.innerText = Math.floor(currentBalances.MYC).toLocaleString() + ' MYC';
  if (evmEl) evmEl.innerText = getActiveEvmAddress();
  if (mycEl) mycEl.innerText = getActiveWalletAddress();
}

function updateWalletUI() {
  const btn = document.getElementById('btn-connect-wallet');
  const label = document.getElementById('wallet-btn-label');
  const icon = document.getElementById('wallet-btn-icon');
  if (!btn || !label || !icon) return;

  if (activeWallet.type === 'metamask') {
    btn.classList.add('connected');
    icon.innerText = '🦊';
    const addr = activeWallet.evmAddress;
    label.innerText = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'MetaMask';
  } else if (activeWallet.type === 'native') {
    btn.classList.add('connected');
    icon.innerText = '🍄';
    const addr = activeWallet.mycAddress;
    label.innerText = addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : 'Spore Wallet';
  } else {
    btn.classList.remove('connected');
    icon.innerText = '⚡';
    label.innerText = 'Connect';
  }

  const navBal = document.getElementById('nav-wallet-balance');
  if (navBal) {
    var bal = currentBalances.MYC || 8637;
    navBal.innerText = parseFloat(bal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' MYC';
  }
}

function updateSporeWalletPanel() {
  var addr = getActiveWalletAddress() || DEFAULT_WALLET;
  var pufEl = document.getElementById('spore-puf-address');
  var balEl = document.getElementById('spore-balance-display');
  var navBalEl = document.getElementById('nav-wallet-balance');
  if (pufEl) pufEl.innerText = addr ? (addr.slice(0,12) + '...' + addr.slice(-6)) : 'myc14d29b6...d7c002';
  var bal = (currentBalances && currentBalances.MYC !== undefined) ? currentBalances.MYC : 8637;
  var formatted = parseFloat(bal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  if (balEl) {
    balEl.innerHTML = formatted + ' <span class="currency">$MYC</span>';
  }
  if (navBalEl) {
    navBalEl.innerText = formatted + ' MYC';
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
  if (!sender) { showToast('No wallet', 'Connect a wallet first', 'error'); return; }
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
  activeWallet = { type: 'none', evmAddress: null, mycAddress: DEFAULT_WALLET };
  try {
    localStorage.removeItem('myca_wallet_type');
  } catch (e) {}
  updateWalletUI();
  closeWalletModal();
  showToast('Bağlantı Kesildi', 'Cüzdan bağlantısı sonlandırıldı.', 'info');
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
  if (!savedMyc) {
    savedMyc = DEFAULT_WALLET;
    try {
      localStorage.setItem('myca_native_address', savedMyc);
      if (!savedType) localStorage.setItem('myca_wallet_type', 'native');
    } catch(e) {}
  }
  if (savedType !== 'metamask') {
    activeWallet = {
      type: 'native',
      evmAddress: toEvmAddress(savedMyc),
      mycAddress: savedMyc
    };
  }
  updateWalletUI();
  updateSporeWalletPanel();
}

document.addEventListener('DOMContentLoaded', initSporeWallet);
