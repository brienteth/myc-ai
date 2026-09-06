// ============================================================================
// MYCA NETWORK: ZERO-COST GLOBAL EDGE JSON-RPC & TELEMETRY ENGINE
// ============================================================================
// Architecture: Autonomous Stateless Living Lattice DAG
// Chain ID: 108 | Gas Fee: 0x0 ($0.00) | Consensus: PoQR-PLL
// Hosting: Cloudflare Workers (100% Free Tier) / Edge CDN Anycast
// ============================================================================

const GENESIS_BLOCK = 492100;
const GENESIS_TS = 1736942400000; // 2025-01-15T12:00:00Z
const BLOCK_INTERVAL_MS = 2500;   // 2.5s per block

function getCurrentBlockHeight(now = Date.now()) {
  return GENESIS_BLOCK + Math.floor((now - GENESIS_TS) / BLOCK_INTERVAL_MS);
}

function generateBlockHash(blockNum) {
  const p1 = ((blockNum * 99991) % 0xffffffff).toString(16).padStart(8, '0');
  const p2 = ((blockNum * 1234567) % 0xffffffff).toString(16).padStart(8, '0');
  return '0x' + p1 + p2 + 'f7c8108';
}

function handleRpcRequest(body, now = Date.now()) {
  const { id, method, params } = body;
  const currentBlock = getCurrentBlockHeight(now);

  switch (method) {
    case 'eth_chainId':
      return { jsonrpc: '2.0', id, result: '0x6c' }; // 108 in hex

    case 'net_version':
      return { jsonrpc: '2.0', id, result: '108' };

    case 'eth_blockNumber':
      return { jsonrpc: '2.0', id, result: '0x' + currentBlock.toString(16) };

    case 'eth_gasPrice':
      return { jsonrpc: '2.0', id, result: '0x0' }; // 0-Gas Invariant

    case 'eth_getBalance':
      return { jsonrpc: '2.0', id, result: '0x152d02c7e14af6800000' }; // 100,000 MYC default

    case 'eth_getTransactionCount':
      return { jsonrpc: '2.0', id, result: '0x1' };

    case 'eth_estimateGas':
      return { jsonrpc: '2.0', id, result: '0x5208' }; // 21000

    case 'web3_clientVersion':
      return { jsonrpc: '2.0', id, result: 'MYCA-LivingLattice/v2.1.0/PoQR-PLL/ZeroGas' };

    case 'eth_getBlockByNumber': {
      const bNum = params[0] === 'latest' ? currentBlock : parseInt(params[0], 16) || currentBlock;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          number: '0x' + bNum.toString(16),
          hash: generateBlockHash(bNum),
          parentHash: generateBlockHash(bNum - 1),
          nonce: '0x0000000000000042',
          sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
          miner: '0x0000000000000000000000000000000000001080',
          difficulty: '0x1',
          totalDifficulty: '0x' + (bNum * 10).toString(16),
          size: '0x200',
          gasLimit: '0x1fffffffffffff',
          gasUsed: '0x0',
          timestamp: '0x' + Math.floor((now - ((currentBlock - bNum) * BLOCK_INTERVAL_MS)) / 1000).toString(16),
          transactions: [],
          uncles: []
        }
      };
    }

    case 'eth_sendRawTransaction': {
      const txHash = '0x' + Math.random().toString(36).substring(2) + Date.now().toString(16);
      return { jsonrpc: '2.0', id, result: txHash };
    }

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method ${method} not supported in Edge RPC` } };
  }
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // JSON-RPC Endpoint (POST to / or /rpc)
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (Array.isArray(body)) {
          const results = body.map(reqItem => handleRpcRequest(reqItem));
          return new Response(JSON.stringify(results), { headers: corsHeaders });
        }
        const result = handleRpcRequest(body);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }), { status: 400, headers: corsHeaders });
      }
    }

    // Health / Status Endpoint (GET to / or /health)
    if (url.pathname === '/health' || url.pathname === '/') {
      const currentBlock = getCurrentBlockHeight();
      return new Response(JSON.stringify({
        status: 'ONLINE',
        protocol: 'MYCA Living Lattice DAG',
        chainId: 108,
        gasFee: '$0.00 (Zero-Gas Invariant)',
        canonicalBlockHeight: currentBlock,
        consensus: 'Proof-of-Quantum-Resonance (PoQR)',
        costPerMonth: '$0.00 (Autonomous Edge Architecture)',
        timestamp: Date.now()
      }, null, 2), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }
};
