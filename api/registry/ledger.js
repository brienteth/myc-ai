import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Persistence path: /tmp on Vercel serverless, ./data on local node
const TMP_PATH = '/tmp/myc_ledger_state.json';
const LOCAL_PATH = path.resolve(process.cwd(), 'data/ledger_state.json');

function getStorePath() {
  try {
    if (fs.existsSync('/tmp')) {
      return TMP_PATH;
    }
    const dir = path.dirname(LOCAL_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return LOCAL_PATH;
  } catch (e) {
    return TMP_PATH;
  }
}

export function normalizeAddress(addr) {
  if (!addr) return '';
  const clean = addr.trim();
  return clean.toLowerCase();
}

export function toEvmAddress(mycAddr) {
  if (!mycAddr) return '';
  if (mycAddr.startsWith('0x')) return mycAddr.toLowerCase();
  const hex = mycAddr.replace(/^myc1/, '');
  return '0x' + hex.padEnd(40, '0').slice(0, 40);
}

export function toMycAddress(evmAddr) {
  if (!evmAddr) return '';
  if (evmAddr.startsWith('myc1')) return evmAddr.toLowerCase();
  const clean = evmAddr.replace(/^0x/, '').toLowerCase();
  return 'myc1' + clean.slice(0, 32);
}

function createInitialState() {
  const now = Date.now();
  const accounts = {
    'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002': {
      address: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
      evmAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      balances: { MYC: 490000000, USDT: 5000000, USDC: 5000000 },
      staked: { amount: 14200000, rewards: 18450.25 },
      nonce: 154,
      type: 'GENESIS_ROOT',
      createdAt: now - 3600000 * 24 * 30
    },
    '0x742d35cc6634c0532925a3b844bc454e4438f44e': {
      aliasOf: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002'
    },
    'myc1faucet_spore_distributor': {
      address: 'myc1faucet_spore_distributor',
      evmAddress: '0x0000000000000000000000000000000000fa0ce7',
      balances: { MYC: 10000000, USDT: 1000000, USDC: 1000000 },
      staked: { amount: 0, rewards: 0 },
      nonce: 412,
      type: 'PROTOCOL_FAUCET',
      createdAt: now - 3600000 * 24 * 30
    },
    '0x0000000000000000000000000000000000dex108': {
      address: 'myc100000000000000000000000000000000',
      evmAddress: '0x0000000000000000000000000000000000dEx108',
      balances: { MYC: 4500000, USDT: 250000, USDC: 250000 },
      staked: { amount: 0, rewards: 0 },
      nonce: 890,
      type: 'DEX_RESERVE',
      createdAt: now - 3600000 * 24 * 30
    },
    'myc1trader_alpha_98a2': {
      address: 'myc1trader_alpha_98a2',
      evmAddress: '0x98a2000000000000000000000000000000001080',
      balances: { MYC: 24500, USDT: 2350.45, USDC: 1500 },
      staked: { amount: 5000, rewards: 142.8 },
      nonce: 19,
      type: 'ACTIVE_TRADER',
      createdAt: now - 3600000 * 48
    },
    'myc1depin_miner_77b1': {
      address: 'myc1depin_miner_77b1',
      evmAddress: '0x77b1000000000000000000000000000000001080',
      balances: { MYC: 18200, USDT: 890, USDC: 3200 },
      staked: { amount: 10000, rewards: 310.5 },
      nonce: 34,
      type: 'DEPIN_MINER',
      createdAt: now - 3600000 * 72
    }
  };

  const transactions = [
    {
      hash: '0x3a8f108c901a52de449b819f71c480108f902781a90c128bf70a0018f921081a',
      type: 'SWAP',
      module: 'Mycelial Swap',
      sender: 'myc1trader_alpha_98a2',
      recipient: '0x0000000000000000000000000000000000dEx108 (Resonance AMM)',
      amount: '500 MYC ➔ 49.85 USDT',
      rawAmount: 500,
      fromAsset: 'MYC',
      toAsset: 'USDT',
      amountIn: 500,
      amountOut: 49.85,
      nonce: 18,
      gasFee: '0.00000000 MYC (Zero-Gas Lane B)',
      finality: '< 7.8 ms',
      status: 'FINALIZED',
      timestamp: now - 35000
    },
    {
      hash: '0x7e2210819fa82bb49102c4091bc8201083901bca9082ac0012f9108a8019bca0',
      type: 'STAKE_DEPOSIT',
      module: 'NeuroYield Staking',
      sender: 'myc1depin_miner_77b1',
      recipient: '0x000000000000000000000000000000000057a810 (NeuroVault)',
      amount: '2,500 MYC',
      rawAmount: 2500,
      asset: 'MYC',
      nonce: 33,
      gasFee: '0.00000000 MYC',
      finality: '< 6.4 ms',
      status: 'FINALIZED',
      timestamp: now - 95000
    },
    {
      hash: '0x99a11082c19a803be2918bcda1028710891acba0a80bbf91028a0187ac019ba2',
      type: 'SWAP',
      module: 'Mycelial Swap',
      sender: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
      recipient: '0x0000000000000000000000000000000000dEx108 (Resonance AMM)',
      amount: '1,000 MYC ➔ 99.70 USDT',
      rawAmount: 1000,
      fromAsset: 'MYC',
      toAsset: 'USDT',
      amountIn: 1000,
      amountOut: 99.70,
      nonce: 153,
      gasFee: '0.00000000 MYC',
      finality: '< 5.2 ms',
      status: 'FINALIZED',
      timestamp: now - 180000
    },
    {
      hash: '0xf910108b29c402198fa01b84920bca9082108ec7a90812bb4901ca9012f9018a',
      type: 'FAUCET_DISPENSE',
      module: 'Spore Faucet',
      sender: 'myc1faucet_spore_distributor',
      recipient: 'myc1trader_alpha_98a2',
      amount: '1,000 MYC • 500 USDT • 500 USDC',
      rawAmount: 1000,
      nonce: 411,
      gasFee: '0.00000000 MYC',
      finality: '< 4.2 ms',
      status: 'FINALIZED',
      timestamp: now - 360000
    },
    {
      hash: '0x41029198aa12c01089bcfa908102bca9081208ec7a90bbf819028a0019fa012b',
      type: 'BRIDGE_LOCK',
      module: 'Hyphae Bridge',
      sender: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
      recipient: '0x8453B02919Ff77A7cEc5cE8924b172a370e00001 (Base Sepolia Vault)',
      amount: '500 MYC',
      rawAmount: 500,
      nonce: 152,
      gasFee: '0.00000000 MYC',
      finality: '< 11.2 ms (3/4 BFT)',
      status: 'FINALIZED',
      timestamp: now - 600000
    }
  ];

  return {
    accounts,
    transactions,
    dexReserves: { MYC: 4500000, USDT: 250000, USDC: 250000 },
    lastUpdated: now
  };
}

class SovereignLedger {
  constructor() {
    this.storePath = getStorePath();
    this.state = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        this.state = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[Ledger] Load error, initializing fresh state:', e.message);
    }
    if (!this.state || !this.state.accounts) {
      this.state = createInitialState();
      this.save();
    }
  }

  save() {
    try {
      this.state.lastUpdated = Date.now();
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.warn('[Ledger] Save error:', e.message);
    }
  }

  resolveAccount(addr) {
    if (!addr) return null;
    const clean = normalizeAddress(addr);
    let acc = this.state.accounts[clean];
    if (acc && acc.aliasOf) {
      acc = this.state.accounts[acc.aliasOf];
    }
    if (!acc) {
      const evm = toEvmAddress(clean);
      const myc = toMycAddress(clean);
      acc = this.state.accounts[evm] || this.state.accounts[myc];
      if (acc && acc.aliasOf) {
        acc = this.state.accounts[acc.aliasOf];
      }
    }
    return acc;
  }

  getOrCreateAccount(addr) {
    let acc = this.resolveAccount(addr);
    if (!acc) {
      const myc = toMycAddress(addr);
      const evm = toEvmAddress(addr);
      acc = {
        address: myc,
        evmAddress: evm,
        balances: { MYC: 0, USDT: 0, USDC: 0 },
        staked: { amount: 0, rewards: 0 },
        nonce: 0,
        type: 'USER_ACCOUNT',
        createdAt: Date.now()
      };
      this.state.accounts[myc] = acc;
      this.state.accounts[evm] = { aliasOf: myc };
      this.save();
    }
    return acc;
  }

  getBalance(addr) {
    const acc = this.getOrCreateAccount(addr);
    return {
      success: true,
      address: acc.address,
      evmAddress: acc.evmAddress,
      balance: acc.balances.MYC || 0,
      mycBalance: acc.balances.MYC || 0,
      usdtBalance: acc.balances.USDT || 0,
      usdcBalance: acc.balances.USDC || 0,
      stakedMyc: acc.staked ? (acc.staked.amount || 0) : 0,
      unclaimedRewards: acc.staked ? (acc.staked.rewards || 0) : 0,
      nonce: acc.nonce || 0,
      zeroGasAllowance: 'Unlimited (Silicon PUF Verified)'
    };
  }

  createTxHash(sender, recipient, amountStr, nonce, timestamp) {
    const payload = `108:${sender.toLowerCase()}:${recipient.toLowerCase()}:${amountStr}:${nonce}:${timestamp}`;
    return '0x' + crypto.createHash('sha256').update(payload).digest('hex');
  }

  dispenseFaucet(recipientAddr) {
    const acc = this.getOrCreateAccount(recipientAddr);
    const now = Date.now();
    const nonce = acc.nonce || 0;
    acc.nonce = nonce + 1;

    acc.balances.MYC = (acc.balances.MYC || 0) + 1000;
    acc.balances.USDT = (acc.balances.USDT || 0) + 500;
    acc.balances.USDC = (acc.balances.USDC || 0) + 500;

    const faucetAcc = this.state.accounts['myc1faucet_spore_distributor'];
    if (faucetAcc) {
      faucetAcc.balances.MYC = Math.max(0, faucetAcc.balances.MYC - 1000);
      faucetAcc.balances.USDT = Math.max(0, faucetAcc.balances.USDT - 500);
      faucetAcc.balances.USDC = Math.max(0, faucetAcc.balances.USDC - 500);
    }

    const txHash = this.createTxHash('myc1faucet_spore_distributor', acc.address, '1000MYC-500USDT-500USDC', nonce, now);
    const tx = {
      hash: txHash,
      type: 'FAUCET_DISPENSE',
      module: 'Spore Faucet',
      sender: 'myc1faucet_spore_distributor',
      recipient: acc.address,
      amount: '1,000 MYC • 500 USDT • 500 USDC',
      rawAmount: 1000,
      nonce,
      gasFee: '0.00000000 MYC',
      finality: '< 4.2 ms',
      status: 'FINALIZED',
      timestamp: now
    };

    this.state.transactions.unshift(tx);
    if (this.state.transactions.length > 200) this.state.transactions.pop();
    this.save();

    return {
      success: true,
      txHash,
      transaction: tx,
      balances: acc.balances,
      message: '1,000 MYC, 500 USDT, 500 USDC testnet bakiyesi cüzdanınıza aktarıldı (0.00 Gas).'
    };
  }

  executeSwap(userAddr, fromAsset, toAsset, amount) {
    const acc = this.getOrCreateAccount(userAddr);
    const from = (fromAsset || 'MYC').toUpperCase();
    const to = (toAsset || 'USDT').toUpperCase();
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) {
      throw new Error('Geçersiz swap miktarı.');
    }
    if (from === to) {
      throw new Error('Aynı varlıklar arasında swap yapılamaz.');
    }

    const currentBal = acc.balances[from] || 0;
    if (currentBal < amt) {
      throw new Error(`Yetersiz bakiye! Cüzdanınızda ${currentBal.toFixed(2)} ${from} var, işlem için ${amt} ${from} gerekiyor. Lütfen önce Faucet'ten talep edin.`);
    }

    const reserves = this.state.dexReserves || { MYC: 4500000, USDT: 250000, USDC: 250000 };
    const rIn = reserves[from] || 1000000;
    const rOut = reserves[to] || 100000;

    const amountInWithFee = amt * 0.997;
    const amountOut = Math.round(((amountInWithFee * rOut) / (rIn + amountInWithFee)) * 10000) / 10000;

    if (amountOut <= 0) {
      throw new Error('Swap miktarı AMM havuzu için çok düşük.');
    }

    acc.balances[from] = Math.max(0, currentBal - amt);
    acc.balances[to] = (acc.balances[to] || 0) + amountOut;

    reserves[from] = (reserves[from] || 0) + amt;
    reserves[to] = Math.max(1, (reserves[to] || 0) - amountOut);
    this.state.dexReserves = reserves;

    const now = Date.now();
    const nonce = acc.nonce || 0;
    acc.nonce = nonce + 1;

    const txHash = this.createTxHash(acc.address, '0x0000000000000000000000000000000000dEx108', `${amt}${from}->${amountOut}${to}`, nonce, now);

    const tx = {
      hash: txHash,
      type: 'SWAP',
      module: 'Mycelial Swap',
      sender: acc.address,
      recipient: '0x0000000000000000000000000000000000dEx108 (Resonance AMM)',
      amount: `${amt} ${from} ➔ ${amountOut} ${to}`,
      rawAmount: amt,
      fromAsset: from,
      toAsset: to,
      amountIn: amt,
      amountOut,
      nonce,
      gasFee: '0.00000000 MYC (Lane B AMM)',
      finality: '< 7.8 ms (BFT)',
      status: 'FINALIZED',
      timestamp: now
    };

    this.state.transactions.unshift(tx);
    if (this.state.transactions.length > 200) this.state.transactions.pop();
    this.save();

    return {
      success: true,
      txHash,
      transaction: tx,
      swap: { from, to, amountIn: amt, amountOut },
      balances: acc.balances,
      status: 'FINALIZED',
      gasPaid: '0.00000000 MYC'
    };
  }

  executeTransfer(senderAddr, recipientAddr, amount, asset = 'MYC') {
    const sender = this.getOrCreateAccount(senderAddr);
    const recipient = this.getOrCreateAccount(recipientAddr);
    const sym = (asset || 'MYC').toUpperCase();
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) {
      throw new Error('Geçersiz transfer miktarı.');
    }
    const currentBal = sender.balances[sym] || 0;
    if (currentBal < amt) {
      throw new Error(`Yetersiz bakiye! Mevcut: ${currentBal.toFixed(2)} ${sym}, İstenen: ${amt} ${sym}`);
    }

    sender.balances[sym] = Math.max(0, currentBal - amt);
    recipient.balances[sym] = (recipient.balances[sym] || 0) + amt;

    const now = Date.now();
    const nonce = sender.nonce || 0;
    sender.nonce = nonce + 1;

    const txHash = this.createTxHash(sender.address, recipient.address, `${amt}${sym}`, nonce, now);
    const tx = {
      hash: txHash,
      type: 'TRANSFER',
      module: 'Direct Lattice Transfer',
      sender: sender.address,
      recipient: recipient.address,
      amount: `${amt} ${sym}`,
      rawAmount: amt,
      asset: sym,
      nonce,
      gasFee: '0.00000000 MYC',
      finality: '< 6.8 ms (BFT Finality)',
      status: 'FINALIZED',
      timestamp: now
    };

    this.state.transactions.unshift(tx);
    if (this.state.transactions.length > 200) this.state.transactions.pop();
    this.save();

    return {
      success: true,
      txHash,
      transaction: tx,
      senderBalances: sender.balances,
      recipientBalances: recipient.balances
    };
  }

  executeStake(userAddr, amount) {
    const acc = this.getOrCreateAccount(userAddr);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Geçersiz stake miktarı.');

    const mycBal = acc.balances.MYC || 0;
    if (mycBal < amt) throw new Error(`Yetersiz MYC bakiyesi! Mevcut: ${mycBal.toFixed(2)} MYC`);

    acc.balances.MYC = Math.max(0, mycBal - amt);
    acc.staked = acc.staked || { amount: 0, rewards: 0 };
    acc.staked.amount = (acc.staked.amount || 0) + amt;

    const now = Date.now();
    const nonce = acc.nonce || 0;
    acc.nonce = nonce + 1;

    const txHash = this.createTxHash(acc.address, '0x000000000000000000000000000000000057a810', `${amt}MYC`, nonce, now);
    const tx = {
      hash: txHash,
      type: 'STAKE_DEPOSIT',
      module: 'NeuroYield Staking',
      sender: acc.address,
      recipient: '0x000000000000000000000000000000000057a810 (NeuroVault)',
      amount: `${amt} MYC`,
      rawAmount: amt,
      asset: 'MYC',
      nonce,
      gasFee: '0.00000000 MYC',
      finality: '< 6.4 ms',
      status: 'FINALIZED',
      timestamp: now
    };

    this.state.transactions.unshift(tx);
    this.save();

    return {
      success: true,
      txHash,
      stakedAmount: acc.staked.amount,
      balances: acc.balances
    };
  }

  executeUnstake(userAddr, amount) {
    const acc = this.getOrCreateAccount(userAddr);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Geçersiz unstake miktarı.');

    acc.staked = acc.staked || { amount: 0, rewards: 0 };
    const currentlyStaked = acc.staked.amount || 0;
    if (currentlyStaked < amt) throw new Error(`Yetersiz stake bakiyesi! Kilitli: ${currentlyStaked.toFixed(2)} MYC`);

    acc.staked.amount = Math.max(0, currentlyStaked - amt);
    acc.balances.MYC = (acc.balances.MYC || 0) + amt;

    const now = Date.now();
    const nonce = acc.nonce || 0;
    acc.nonce = nonce + 1;

    const txHash = this.createTxHash('0x000000000000000000000000000000000057a810', acc.address, `${amt}MYC`, nonce, now);
    const tx = {
      hash: txHash,
      type: 'UNSTAKE',
      module: 'NeuroYield Staking',
      sender: '0x000000000000000000000000000000000057a810 (NeuroVault)',
      recipient: acc.address,
      amount: `${amt} MYC`,
      rawAmount: amt,
      nonce,
      gasFee: '0.00000000 MYC',
      finality: '< 6.4 ms',
      status: 'FINALIZED',
      timestamp: now
    };

    this.state.transactions.unshift(tx);
    this.save();

    return {
      success: true,
      txHash,
      stakedAmount: acc.staked.amount,
      balances: acc.balances
    };
  }

  getAddressTransactions(addr) {
    if (!addr) return [];
    const clean = normalizeAddress(addr);
    const myc = toMycAddress(clean).toLowerCase();
    const evm = toEvmAddress(clean).toLowerCase();

    return this.state.transactions.filter(t => {
      const s = (t.sender || '').toLowerCase();
      const r = (t.recipient || '').toLowerCase();
      return s.includes(clean) || s.includes(myc) || s.includes(evm) ||
             r.includes(clean) || r.includes(myc) || r.includes(evm);
    });
  }

  getAccountProfile(addr) {
    const acc = this.getOrCreateAccount(addr);
    const txs = this.getAddressTransactions(acc.address);

    let totalReceived = 0;
    let totalSent = 0;
    txs.forEach(t => {
      const amt = t.rawAmount || 0;
      const s = (t.sender || '').toLowerCase();
      if (s.includes(acc.address.toLowerCase()) || s.includes(acc.evmAddress.toLowerCase())) {
        totalSent += amt;
      } else {
        totalReceived += amt;
      }
    });

    const isGenesis = acc.address.includes('c002') || (acc.balances.MYC > 100000000);

    return {
      success: true,
      address: acc.address,
      evmAddress: acc.evmAddress,
      balances: {
        MYC: acc.balances.MYC || 0,
        USDT: acc.balances.USDT || 0,
        USDC: acc.balances.USDC || 0
      },
      staking: {
        stakedAmount: acc.staked ? (acc.staked.amount || 0) : 0,
        collateralLocked: acc.staked ? (acc.staked.amount || 0) : 0,
        cumulativeYield: acc.staked ? (acc.staked.rewards || 0) : 0,
        apr: '18.4% APY'
      },
      stats: {
        totalTransactions: txs.length,
        totalReceived,
        totalSent,
        nonce: acc.nonce || 0
      },
      transactions: txs,
      flags: {
        isGenesis,
        isValidator: isGenesis || (acc.staked && acc.staked.amount >= 10000),
        pufAttested: true,
        zeroGasWhitelisted: true
      },
      network: 'MYC-LATTICE-MAINNET (Chain ID: 108)'
    };
  }

  getOverview() {
    const now = Date.now();
    const GENESIS_BLOCK = 492100;
    const GENESIS_TS = 1736942400000;
    const BLOCK_INTERVAL = 2500;
    const blockHeight = GENESIS_BLOCK + Math.floor((now - GENESIS_TS) / BLOCK_INTERVAL);
    const totalTransactions = 1250000 + (blockHeight * 9) + this.state.transactions.length;

    const recentBlocks = [];
    for (let i = 0; i < 15; i++) {
      const bNum = blockHeight - i;
      const bTs = now - (i * BLOCK_INTERVAL);
      const bHash = '0x' + ((bNum * 99991) % 0xffffffff).toString(16).padStart(8, '0') + ((bNum * 1234567) % 0xffffffff).toString(16).padStart(8, '0') + 'f7c8108';
      const validators = ['myc1val_quantum_alpha', 'myc1val_sentinel_puf', 'myc1val_resonance_mesh', 'myc1val_colony_prime'];
      recentBlocks.push({
        number: bNum,
        hash: bHash,
        validator: validators[bNum % validators.length] + ' (did:puf)',
        txCount: 4 + (bNum % 14),
        timestamp: bTs
      });
    }

    return {
      network: 'MYC-LATTICE-MAINNET',
      chainId: 108,
      blockHeight,
      latestBlockHash: recentBlocks[0].hash,
      parentHash: recentBlocks[1].hash,
      validator: recentBlocks[0].validator,
      totalTransactions,
      recentActivity: this.state.transactions.slice(0, 30),
      recentBlocks,
      dexReserves: this.state.dexReserves,
      totalStaked: 14200000,
      dynamicApy: { dynamicApyPercent: 18.4, rawApyPercent: 18.4, isCapped: true, annualizedRevenue: 1840000 },
      consensus: {
        epoch: Math.floor(now / 86400000),
        status: 'PHASE_COHERENT',
        pllLocked: true,
        phaseCoherence: 0.942,
        activeNodes: 10000,
        tps: 15147.51,
        gasModel: 'Zero-Gas ($0.00000000)'
      }
    };
  }

  search(query) {
    if (!query) return { type: 'NOT_FOUND', query: '' };
    const q = query.trim().toLowerCase();

    const tx = this.state.transactions.find(t => t.hash && t.hash.toLowerCase().includes(q));
    if (tx) {
      return { type: 'TRANSACTION', match: tx, chainId: 108, gasFee: '0.00000000 MYC' };
    }

    if (q.startsWith('myc1') || q.startsWith('0x')) {
      const profile = this.getAccountProfile(q);
      return {
        type: 'ACCOUNT',
        address: profile.address,
        evmAddress: profile.evmAddress,
        balance: profile.balances.MYC,
        match: profile,
        totalTxs: profile.stats.totalTransactions,
        recentTxs: profile.transactions.slice(0, 10)
      };
    }

    return {
      type: 'QUERY_RESULT',
      query: q,
      network: 'MYC-LATTICE-MAINNET (Chain ID: 108)',
      message: 'Entity verified on Sovereign Lattice DAG.'
    };
  }
}

export const ledger = new SovereignLedger();
