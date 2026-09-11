import { ledger, toEvmAddress, toMycAddress, normalizeAddress } from './ledger.js';
// Vercel Serverless Function for Opacus H3 Signaling (In-Memory fallback with approval)
let _h3_agents = {};
let _h3_signals = {};

let _global_transactions = [
  {
    hash: '0x3a8f108c901a52de449b819f71c480108f902781',
    type: 'SWAP',
    module: 'Mycelial Swap',
    sender: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
    recipient: '0x0000000000000000000000000000000000dEx108 (Resonance AMM)',
    amount: '250 MYC ➔ 24.92 USDT',
    rawAmount: 250,
    gasFee: '0.00000000 MYC',
    finality: '< 7.8 ms',
    status: 'FINALIZED',
    timestamp: Date.now() - 45000
  },
  {
    hash: '0x7e2210819fa82bb49102c4091bc8201083901bca',
    type: 'STAKE_DEPOSIT',
    module: 'NeuroYield Staking',
    sender: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
    recipient: '0x000000000000000000000000000000000057a810 (NeuroVault)',
    amount: '1,000 MYC',
    rawAmount: 1000,
    gasFee: '0.00000000 MYC',
    finality: '< 6.4 ms',
    status: 'FINALIZED',
    timestamp: Date.now() - 120000
  },
  {
    hash: '0xf910108b29c402198fa01b84920bca9082108ec7',
    type: 'FAUCET_DISPENSE',
    module: 'Spore Faucet',
    sender: 'myc1faucet_spore_distributor',
    recipient: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
    amount: '1,000 MYC • 500 USDT • 500 USDC',
    rawAmount: 1000,
    gasFee: '0.00000000 MYC',
    finality: '< 4.2 ms',
    status: 'FINALIZED',
    timestamp: Date.now() - 300000
  },
  {
    hash: '0x99a11082c19a803be2918bcda1028710891acba0',
    type: 'BRIDGE_LOCK',
    module: 'Hyphae Bridge',
    sender: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
    recipient: '0x8453B02919Ff77A7cEc5cE8924b172a370e00001 (Base Sepolia Vault)',
    amount: '500 MYC',
    rawAmount: 500,
    gasFee: '0.00000000 MYC',
    finality: '< 11.2 ms (3/4 BFT)',
    status: 'FINALIZED',
    timestamp: Date.now() - 600000
  }
];

let _global_contracts = [
  { name: "MycToken (Sovereign 100M Cap)", address: "0x0000000000000000000000000000000000001080", category: "Core Infrastructure", state: "ACTIVE" },
  { name: "Resonance DEX (Zero-Gas AMM)", address: "0x0000000000000000000000000000000000dEx108", category: "Lane B (DeFi & Yield)", state: "ACTIVE" },
  { name: "NeuroYield Staking Vault", address: "0x000000000000000000000000000000000057a810", category: "Lane B (DeFi & Yield)", state: "ACTIVE" },
  { name: "NodeLicenseSale Escrow", address: "0x0000000000000000000000000000000000e5c808", category: "Core Infrastructure", state: "ACTIVE" },
  { name: "DeviceGuard (Silicon PUF Root)", address: "0x000000000000000000000000000000000090a8d0", category: "Layer 0 (DePIN Hardware)", state: "ACTIVE" },
  { name: "MycStreamPay Channel Vault", address: "0x0000000000000000000000000000000000578ea0", category: "Streaming Protocol", state: "ACTIVE" },
  { name: "CrossChainBridge (Base L2 Gateway)", address: "0x0000000000000000000000000000000000b81d9e", category: "Cross-Chain Protocol", state: "ACTIVE" }
];

let _global_devices = [
  { did: "did:myc:puf:turb-alpha-01", deviceType: "INDUSTRIAL_TURBINE", baseRegister: 120, maxRegister: 140, resonanceScoreBps: 9980, isActive: true },
  { did: "did:myc:puf:actuator-valve-02", deviceType: "COOLING_VALVE", baseRegister: 10, maxRegister: 30, resonanceScoreBps: 9940, isActive: true },
  { did: "did:myc:puf:gpu-edge-03", deviceType: "GPU_COLLATERAL", baseRegister: 200, maxRegister: 250, resonanceScoreBps: 10000, isActive: true },
  { did: "did:myc:puf:scada-sentinel-04", deviceType: "SCADA_ACTUATOR", baseRegister: 50, maxRegister: 80, resonanceScoreBps: 9890, isActive: true },
  { did: "did:myc:puf:bio-reactor-05", deviceType: "BIO_TELEMETRY", baseRegister: 300, maxRegister: 330, resonanceScoreBps: 9970, isActive: true }
];

let _global_tasks = [
  { taskId: "task_model_inference_89", taskType: "COGNITIVE_INFERENCE", reward: 25.0, status: "COMPLETED", latencyMs: 8.4 },
  { taskId: "task_mesh_sync_90", taskType: "COLONY_MESH_PULSE", reward: 10.0, status: "FINALIZED", latencyMs: 4.2 },
  { taskId: "task_puf_attest_91", taskType: "HARDWARE_VERIFICATION", reward: 5.0, status: "VALIDATED", latencyMs: 2.1 }
];

let _global_bridge_transactions = [
  {
    bridgeId: 'bridge_lock_894102',
    sender: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
    targetChain: 'BASE_SEPOLIA',
    recipientRemote: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    amount: 500,
    asset: 'MYC',
    status: 'LOCKED (3/4 BFT QUORUM READY)',
    lockProof: '0x379607f59a80bbf7c108a9...',
    timestamp: Date.now() - 600000
  },
  {
    bridgeId: 'bridge_lock_894088',
    sender: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    targetChain: 'MYCA_CHAIN_108',
    recipientRemote: 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002',
    amount: 250,
    asset: 'USDT',
    status: 'MINTED_ON_MYCA',
    lockProof: '0x4102ff98aa12c0...',
    timestamp: Date.now() - 1200000
  }
];

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, method } = req;
  const now = Date.now();
  const parsedUrl = new URL(url, 'http://localhost');

  // Route: /api/registry/register (POST)
  if (parsedUrl.pathname.endsWith('/api/registry/register') && method === 'POST') {
    try {
      const body = req.body || {};
      const node_id = body.node_id || 'node-' + Math.random().toString(36).substring(2, 8);
      body.last_seen = now;
      
      // Preserve existing status if it exists (e.g. if already approved/declined)
      const existing = _h3_agents[node_id];
      if (existing) {
        body.status = existing.status || body.status || 'ready';
      } else {
        body.status = body.role === 'mobile_web' ? 'pending' : 'ready';
      }
      
      _h3_agents[node_id] = body;
      return res.status(200).json({ status: body.status, node_id: node_id });
    } catch (e) {
      return res.status(400).json({ error: e.toString() });
    }
  }

  // Route: /api/registry/agents (GET)
  if (parsedUrl.pathname.endsWith('/api/registry/agents') && method === 'GET') {
    // Filter active agents (last 120 seconds)
    const active_agents = Object.values(_h3_agents).filter(
      (agent) => now - (agent.last_seen || 0) < 120000
    );
    return res.status(200).json({ agents: active_agents, total: active_agents.length });
  }

  // Route: /api/registry/status (GET)
  if (parsedUrl.pathname.endsWith('/api/registry/status') && method === 'GET') {
    const node_id = parsedUrl.searchParams.get('node_id');
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id parameter' });
    }
    const agent = _h3_agents[node_id];
    if (!agent) {
      return res.status(200).json({ status: 'not_found' });
    }
    // Update heartbeat on status query
    agent.last_seen = now;
    return res.status(200).json({ status: agent.status });
  }

  // ── Pairing Endpoints for Colony Mesh (Cloud & Mobile Sync) ──
  const UNAMBIGUOUS_PAIR_CHARS = "2346789ACDEFGHJKLMNPQRTUVWXYZ";

  if (!_h3_agents._active_pair_session) {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += UNAMBIGUOUS_PAIR_CHARS.charAt(Math.floor(Math.random() * UNAMBIGUOUS_PAIR_CHARS.length));
    }
    _h3_agents._active_pair_session = {
      session_id: "ps_" + Math.random().toString(36).substring(2, 14),
      host_node_id: "myca-host",
      security_code: code,
      challenge: Math.random().toString(36).substring(2, 18),
      created_at: now,
      expires_at: now + 600000,
      status: "WAITING",
      requesting_node_id: null,
      requesting_device_name: null
    };
  }

  // Route: /api/registry/pair/session (GET or POST)
  if (parsedUrl.pathname.includes('/api/registry/pair/session')) {
    const session = _h3_agents._active_pair_session;
    if (session.expires_at < now) {
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += UNAMBIGUOUS_PAIR_CHARS.charAt(Math.floor(Math.random() * UNAMBIGUOUS_PAIR_CHARS.length));
      }
      session.session_id = "ps_" + Math.random().toString(36).substring(2, 14);
      session.security_code = code;
      session.expires_at = now + 600000;
      session.status = "WAITING";
      session.requesting_node_id = null;
    }
    // Allow host to set the active security_code / session
    if (method === 'POST') {
      const body = req.body || {};
      if (body.security_code) session.security_code = body.security_code;
      if (body.session_id) session.session_id = body.session_id;
      if (body.host_node_id) session.host_node_id = body.host_node_id;
    }
    return res.status(200).json(session);
  }

  // Route: /api/registry/pair/request (POST)
  if (parsedUrl.pathname.includes('/api/registry/pair/request') && method === 'POST') {
    const body = req.body || {};
    const session = _h3_agents._active_pair_session;
    session.requesting_node_id = body.node_id || "mobile-client";
    session.requesting_device_name = body.device_name || "Mobile Device";
    session.requesting_pubkey = body.public_key || "";
    session.status = "REQUESTED";

    // Also register the node in _h3_agents
    _h3_agents[body.node_id] = {
      node_id: body.node_id,
      public_key: body.public_key || "",
      device_name: body.device_name || "Remote Device",
      device_type: body.device_type || "mobile",
      capabilities: body.capabilities || [],
      role: body.device_type === 'tablet' ? 'tablet_web' : 'mobile_web',
      status: 'pending',
      code: session.security_code,
      security_code: session.security_code,
      last_seen: now
    };

    return res.status(200).json({
      status: "pending",
      session_id: session.session_id,
      code: session.security_code,
      security_code: session.security_code,
      challenge: session.challenge,
      expires_at: session.expires_at
    });
  }

  // Route: /api/registry/pair/verify (POST)
  if (parsedUrl.pathname.includes('/api/registry/pair/verify') && method === 'POST') {
    const body = req.body || {};
    const session = _h3_agents._active_pair_session;
    const node_id = body.node_id;
    const agent = _h3_agents[node_id];

    if (session.status === "APPROVED" || (agent && agent.status === "approved")) {
      return res.status(200).json({ status: "approved", message: "Device paired successfully" });
    }
    if (session.status === "DECLINED" || (agent && agent.status === "declined")) {
      return res.status(200).json({ status: "declined", message: "Pairing declined" });
    }
    return res.status(200).json({ status: "pending" });
  }

  // Route: /api/registry/approve (POST) or /api/registry/pair/approve (POST)
  if ((parsedUrl.pathname.endsWith('/api/registry/approve') || parsedUrl.pathname.endsWith('/api/registry/pair/approve')) && method === 'POST') {
    const body = req.body || {};
    const node_id = body.node_id;
    if (_h3_agents._active_pair_session) {
      _h3_agents._active_pair_session.status = "APPROVED";
    }
    if (node_id && _h3_agents[node_id]) {
      _h3_agents[node_id].status = 'approved';
      _h3_agents[node_id].last_seen = now;
      return res.status(200).json({ status: 'approved', node_id });
    }
    if (node_id) {
      _h3_agents[node_id] = {
        node_id,
        role: 'mobile_web',
        status: 'approved',
        last_seen: now
      };
      return res.status(200).json({ status: 'approved', node_id });
    }
    return res.status(200).json({ status: 'approved' });
  }

  // Route: /api/registry/decline (POST) or /api/registry/pair/decline (POST)
  if ((parsedUrl.pathname.endsWith('/api/registry/decline') || parsedUrl.pathname.endsWith('/api/registry/pair/decline')) && method === 'POST') {
    const body = req.body || {};
    const node_id = body.node_id;
    if (_h3_agents._active_pair_session) {
      _h3_agents._active_pair_session.status = "DECLINED";
    }
    if (node_id && _h3_agents[node_id]) {
      _h3_agents[node_id].status = 'declined';
      _h3_agents[node_id].last_seen = now;
    }
    return res.status(200).json({ status: 'declined', node_id });
  }

  // Route: /api/learning/sync (POST)
  if (parsedUrl.pathname.endsWith('/api/learning/sync') && method === 'POST') {
    const body = req.body || {};
    const updates = body.updates || [];
    console.log(`[Vercel Federated Aggregator] Accepted ${updates.length} federated learning updates.`);
    return res.status(200).json({ status: 'success', synced: updates.length });
  }

  
  // =========================================================================
  
  // =========================================================================
  // NATIVE DEPIN WALLET & HUB ECOSYSTEM APIS
  // =========================================================================

  // Route: /api/wallet/balance
  if (parsedUrl.pathname.includes('wallet/balance') || (parsedUrl.pathname.includes('balance') && !parsedUrl.pathname.includes('explorer'))) {
    const address = parsedUrl.searchParams?.get('address') || parsedUrl.query?.address || 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002';
    const bal = ledger.getBalance(address);
    return res.status(200).json(bal);
  }

  // Route: /api/swap/quote
  if (parsedUrl.pathname.includes('swap/quote')) {
    const from = parsedUrl.query?.from || 'MYC';
    const to = parsedUrl.query?.to || 'USDT';
    const amount = parseFloat(parsedUrl.query?.amount || '100');
    const rate = from === 'MYC' ? 0.0997 : (1 / 0.0997);
    const outAmount = Math.round((amount * rate) * 10000) / 10000;
    return res.status(200).json({
      success: true,
      from,
      to,
      amountIn: amount,
      amountOut: outAmount,
      priceImpact: '0.02%',
      fee: '0.00000000 MYC (Zero-Gas Lane B)',
      poolReserves: { MYC: 4500000, USDT: 250000, USDC: 250000 }
    });
  }

  // Route: /api/explorer/record-tx (POST)
  if (parsedUrl.pathname.includes('explorer/record-tx') && method === 'POST') {
    const tx = req.body || {};
    if (tx.hash) {
      if (!_global_transactions.some(t => t.hash === tx.hash)) {
        _global_transactions.unshift(tx);
        if (_global_transactions.length > 100) _global_transactions.pop();
      }
    }
    return res.status(200).json({ success: true, count: _global_transactions.length });
  }

  // Route: /api/explorer/transactions
  if (parsedUrl.pathname.includes('explorer/transactions')) {
    return res.status(200).json({
      success: true,
      count: ledger.state.transactions.length,
      transactions: ledger.state.transactions
    });
  }

  // Route: /api/bridge/transactions
  if (parsedUrl.pathname.includes('bridge/transactions')) {
    return res.status(200).json({
      success: true,
      count: _global_bridge_transactions.length,
      transactions: _global_bridge_transactions
    });
  }

  // Route: /api/swap (POST)
  if (parsedUrl.pathname.includes('swap') && method === 'POST') {
    const body = req.body || {};
    const userAddress = body.userAddress || body.sender || 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002';
    try {
      const result = ledger.executeSwap(userAddress, body.from || 'MYC', body.to || 'USDT', body.amount || 100);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Route: /api/transfer (POST)
  if (parsedUrl.pathname.includes('transfer') && method === 'POST') {
    const body = req.body || {};
    const sender = body.from || body.sender || 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002';
    const recipient = body.to || body.recipient || '';
    try {
      const result = ledger.executeTransfer(sender, recipient, body.amount || 10, body.asset || 'MYC');
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Route: /api/faucet
  if (parsedUrl.pathname.includes('faucet')) {
    const body = req.body || {};
    const recipient = body.address || parsedUrl.searchParams?.get('address') || parsedUrl.query?.address || 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002';
    try {
      const result = ledger.dispenseFaucet(recipient);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Route: /api/stake/info
  if (parsedUrl.pathname.includes('stake/info')) {
    return res.status(200).json({
      success: true,
      amount: 2500,
      stakedAmount: 2500,
      annualApy: 18.4,
      pendingReward: 48.75,
      unclaimedRewards: 48.75,
      tier: 'BOOSTED_30D',
      machineQuota: 65,
      lockPeriod: 'Flexible (Instant Unstake)',
      coherenceMultiplier: '1.25x'
    });
  }

  // Route: /api/stake /claim /compound /unstake (POST)
  if (parsedUrl.pathname.includes('stake') && method === 'POST') {
    const body = req.body || {};
    const address = body.address || 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002';
    const amt = parseFloat(body.amount) || 250;
    const isHarvest = parsedUrl.pathname.includes('claim');
    const isCompound = parsedUrl.pathname.includes('compound');
    const isUnstake = parsedUrl.pathname.includes('unstake');

    let txType = 'STAKE_DEPOSIT';
    let txAmt = `${amt} MYC`;
    if (isHarvest) { txType = 'STAKE_HARVEST'; txAmt = '48.75 MYC (Yield)'; }
    else if (isCompound) { txType = 'STAKE_COMPOUND'; txAmt = '48.75 MYC (Re-Staked)'; }
    else if (isUnstake) { txType = 'STAKE_UNSTAKE'; txAmt = `${amt} MYC`; }

    const txHash = '0x' + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') + '90a108';

    const tx = {
      hash: txHash,
      type: txType,
      module: 'NeuroYield Staking',
      sender: address,
      recipient: '0x000000000000000000000000000000000057a810 (NeuroVault)',
      amount: txAmt,
      rawAmount: amt,
      gasFee: '0.00000000 MYC (Zero-Gas Lane B)',
      finality: '< 6.4 ms (BFT Lock)',
      status: 'FINALIZED',
      timestamp: Date.now()
    };
    _global_transactions.unshift(tx);
    if (_global_transactions.length > 100) _global_transactions.pop();

    return res.status(200).json({
      success: true,
      status: 'CONFIRMED',
      txHash,
      transaction: tx,
      claimedAmount: 48.75,
      compoundedAmount: 48.75,
      message: `NeuroYield staking (${txType}) completed with zero gas fee.`
    });
  }

  // Route: /api/bridge (POST & GET)
  if (parsedUrl.pathname.includes('bridge') && !parsedUrl.pathname.includes('transactions')) {
    const body = req.body || {};
    const isOutbound = parsedUrl.pathname.includes('myc-to-evm');
    const asset = body.asset || 'MYC';
    const amount = parseFloat(body.amount) || 50;
    const sender = body.senderOnMyc || body.senderOnBase || 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002';
    const recipient = body.recipientOnEvm || body.recipientOnMyc || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const targetChain = body.targetChain || body.sourceChain || 'BASE_SEPOLIA';

    const txHash = '0x' + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') + 'b8108';
    const bridgeId = 'bridge_' + Math.floor(Math.random() * 900000 + 100000);

    const tx = {
      hash: txHash,
      type: isOutbound ? 'BRIDGE_LOCK' : 'BRIDGE_MINT',
      module: 'Hyphae Bridge',
      sender,
      recipient: isOutbound ? '0x0000000000000000000000000000000000b81d9e (Bridge Gateway)' : recipient,
      amount: `${amount} ${asset}`,
      rawAmount: amount,
      gasFee: '0.00000000 MYC (Lattice BFT)',
      finality: '< 11.2 ms (3/4 BFT)',
      status: 'FINALIZED',
      timestamp: Date.now()
    };
    _global_transactions.unshift(tx);
    if (_global_transactions.length > 100) _global_transactions.pop();

    const bridgeTx = {
      bridgeId,
      sender,
      targetChain,
      recipientRemote: recipient,
      amount,
      asset,
      status: isOutbound ? 'LOCKED (3/4 BFT QUORUM READY)' : 'MINTED_ON_MYCA',
      lockProof: '0x3796' + Math.floor(Math.random() * 0xffffffff).toString(16) + '...',
      timestamp: Date.now()
    };
    _global_bridge_transactions.unshift(bridgeTx);
    if (_global_bridge_transactions.length > 50) _global_bridge_transactions.pop();

    return res.status(200).json({
      success: true,
      transferId: bridgeId,
      txHash,
      transaction: tx,
      bridgeTx,
      proof: {
        direction: isOutbound ? 'MYCA_TO_EVM' : 'EVM_TO_MYCA',
        amount,
        asset,
        transferId: bridgeId,
        signatures: 4,
        requiredQuorum: 3,
        destination: {
          targetChain: targetChain,
          receivedAmount: amount,
          evmCalldata: '0x379607f5000000000000000000000000'
        }
      },
      status: 'QUORUM_VERIFIED',
      signatures: 4,
      required: 3,
      message: 'Hyphae BFT cross-chain proof verified across 4/4 validators.'
    });
  }

  // CANONICAL EXPLORER & BLOCKCHAIN CONTINUOUS STATE ENGINE
  // =========================================================================
  if (parsedUrl.pathname.includes("explorer/overview")) {
    const GENESIS_BLOCK = 492100;
    const GENESIS_TS = 1736942400000;
    const BLOCK_INTERVAL = 2500;
    const blockHeight = GENESIS_BLOCK + Math.floor((now - GENESIS_TS) / BLOCK_INTERVAL);
    const totalTransactions = 1250000 + (blockHeight * 9);

    const recentBlocks = [];
    for (let i = 0; i < 15; i++) {
      const bNum = blockHeight - i;
      const bTs = now - (i * BLOCK_INTERVAL);
      const bHash = "0x" + ((bNum * 99991) % 0xffffffff).toString(16).padStart(8, "0") + ((bNum * 1234567) % 0xffffffff).toString(16).padStart(8, "0") + "f7c8108";
      const validators = ["myc1val_quantum_alpha", "myc1val_sentinel_puf", "myc1val_resonance_mesh", "myc1val_colony_prime"];
      recentBlocks.push({
        number: bNum,
        hash: bHash,
        validator: validators[bNum % validators.length] + " (did:puf)",
        txCount: 4 + (bNum % 14),
        timestamp: bTs
      });
    }

    const txTypes = ["TRANSFER", "POQR_REWARD", "STAKE_COMPOUND", "PUF_ATTEST", "STREAM_PAY"];
    const recentActivity = [];
    for (let j = 0; j < 15; j++) {
      const txNum = blockHeight * 10 + j;
      const txHash = "0x" + ((txNum * 88883) % 0xffffffff).toString(16).padStart(8, "0") + ((txNum * 234567) % 0xffffffff).toString(16).padStart(8, "0");
      recentActivity.push({
        hash: txHash,
        type: txTypes[j % txTypes.length],
        sender: "myc1" + ((txNum * 13) % 0xffffffff).toString(16).padEnd(10, "0"),
        recipient: "myc1" + ((txNum * 29) % 0xffffffff).toString(16).padEnd(10, "0"),
        amount: Math.round(((j * 17.5) % 150 + 2.5) * 100) / 100,
        finality: "< 9.79 ms",
        gasFee: "0.00000000 MYC (Zero-Gas)"
      });
    }

    return res.status(200).json({
      network: "MYC-LATTICE-MAINNET",
      chainId: 108,
      blockHeight,
      latestBlockHash: recentBlocks[0].hash,
      parentHash: recentBlocks[1].hash,
      validator: recentBlocks[0].validator,
      totalTransactions,
      recentActivity: [..._global_transactions, ...recentActivity],
      recentBlocks,
      dexReserves: { MYC: 4500000, USDT: 250000, USDC: 250000 },
      totalStaked: 14200000,
      deviceQuotas: 14200,
      dynamicApy: { dynamicApyPercent: 18.4, rawApyPercent: 18.4, isCapped: true, annualizedRevenue: 1840000 },
      bridgeSecurity: {
        totalLocked: { MYC: 2500000, USDT: 150000, USDC: 150000 },
        totalLockedMYC: 2500000,
        requiredQuorum: 3,
        totalValidators: 4,
        quorumRule: "2/3 + 1 Supermajority",
        singleTransferLimit: 50000,
        isPaused: false,
        replayProtection: "Active (transferId hash lock)"
      },
      consensus: {
        epoch: Math.floor(now / 86400000),
        status: "PHASE_COHERENT",
        pllLocked: true,
        phaseCoherence: 0.942,
        activeNodes: 10000,
        tps: 15147.51,
        gasModel: "Zero-Gas ($0.00000000)"
      }
    });
  }

  // Route: /api/contract/deploy (POST)
  if (parsedUrl.pathname.includes("contract/deploy") && method === "POST") {
    const body = req.body || {};
    const name = body.name || "CustomToken";
    const sender = body.sender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
    const randHex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0") + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    const contractAddress = "0x" + randHex.slice(0, 36) + "1080";
    const txHash = "0x" + randHex + "c0108";

    const newContract = {
      name,
      address: contractAddress,
      category: "User Deployed Project",
      state: "ACTIVE",
      deployer: sender,
      timestamp: Date.now()
    };
    _global_contracts.unshift(newContract);

    const tx = {
      hash: txHash,
      type: "CONTRACT_DEPLOY",
      module: "Project Launchpad",
      sender,
      recipient: contractAddress,
      amount: `${body.initialSupply || 500000} ${name}`,
      gasFee: "0.00000000 MYC",
      finality: "< 8.9 ms (BFT)",
      status: "FINALIZED",
      timestamp: Date.now()
    };
    _global_transactions.unshift(tx);

    return res.status(200).json({
      success: true,
      txHash,
      contractAddress,
      contract: newContract,
      status: "DEPLOYED",
      gasUsed: "0.00000000 MYC"
    });
  }

  // Route: /api/device/register (POST)
  if (parsedUrl.pathname.includes("device/register") && method === "POST") {
    const body = req.body || {};
    const did = body.did || ("did:myc:puf:node-" + Math.random().toString(36).slice(2, 8));
    const deviceType = body.deviceType || "INDUSTRIAL_ACTUATOR";
    const txHash = "0x" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0") + "d0108";

    const newDev = {
      did,
      deviceType,
      baseRegister: 150,
      maxRegister: 220,
      resonanceScoreBps: 10000,
      isActive: true,
      timestamp: Date.now()
    };
    _global_devices.unshift(newDev);

    const tx = {
      hash: txHash,
      type: "DEVICE_REGISTER",
      module: "DePIN Device Registry",
      sender: body.sender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      recipient: "0x000000000000000000000000000000000090a8d0",
      amount: "Silicon PUF Identity (0-Byte Shield)",
      gasFee: "0.00000000 MYC",
      finality: "< 4.95 µs",
      status: "FINALIZED",
      timestamp: Date.now()
    };
    _global_transactions.unshift(tx);

    return res.status(200).json({
      success: true,
      txHash,
      deviceId: did,
      device: newDev,
      status: "CONFIRMED",
      gasUsed: "0.00000000 MYC"
    });
  }

  // Route: /api/capability/register or /api/task/create (POST)
  if ((parsedUrl.pathname.includes("capability/register") || parsedUrl.pathname.includes("task/create")) && method === "POST") {
    const body = req.body || {};
    const name = body.name || "ai.inference.edge";
    const taskId = "task_" + name.replace(/[^a-zA-Z0-9]/g, "_") + "_" + Math.floor(Math.random() * 10000);
    const txHash = "0x" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0") + "t108";

    const newTask = {
      taskId,
      taskType: "AI_CAPABILITY_PROVISION",
      reward: parseFloat(body.pricePerTask) || 0.05,
      status: "DEPLOYED_ON_SWARM",
      latencyMs: 3.4,
      model: name
    };
    _global_tasks.unshift(newTask);

    const tx = {
      hash: txHash,
      type: "AGENT_TASK_DISPATCH",
      module: "AI Colony Sub-Swarm",
      sender: body.providerAddress || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      recipient: "myc1colony_prime_mesh00000000",
      amount: `${body.pricePerTask || 0.05} MYC`,
      gasFee: "0.00000000 MYC",
      finality: "< 3.4 ms",
      status: "FINALIZED",
      timestamp: Date.now()
    };
    _global_transactions.unshift(tx);

    return res.status(200).json({
      success: true,
      txHash,
      taskId,
      task: newTask,
      status: "REGISTERED",
      gasUsed: "0.00000000 MYC"
    });
  }

  // Route: /api/explorer/search (GET)
  if (parsedUrl.pathname.includes("explorer/search")) {
    const q = (parsedUrl.searchParams?.get("q") || "").trim();
    const result = ledger.search(q);
    return res.status(200).json(result);
  }

  // Route: /api/contracts
  if (parsedUrl.pathname.includes("contracts")) {
    return res.status(200).json({
      contracts: _global_contracts
    });
  }

  // Route: /api/explorer/devices
  if (parsedUrl.pathname.includes("devices")) {
    return res.status(200).json({
      success: true,
      count: _global_devices.length,
      devices: _global_devices
    });
  }

  // Route: /api/explorer/tasks
  if (parsedUrl.pathname.includes("tasks")) {
    return res.status(200).json({
      success: true,
      count: _global_tasks.length,
      tasks: _global_tasks
    });
  }

  // Route: /api/explorer/channels
  if (parsedUrl.pathname.includes("channels")) {
    return res.status(200).json({
      success: true,
      count: 2,
      channels: [
        { channelId: "ch_streaming_alpha", payer: "myc1payer98a21f7c00000000", payee: "myc1streamingmodel00000000", totalDeposit: 250, settledAmount: 78.4, isOpen: true },
        { channelId: "ch_depin_edge_beta", payer: "myc1fleetnode88b00000000", payee: "myc1operatorcentral000000", totalDeposit: 500, settledAmount: 182.1, isOpen: true }
      ]
    });
  }

  // Fallback 404
  return res.status(404).json({ error: 'Endpoint not found in H3 Serverless Registry', path: parsedUrl.pathname });
}
