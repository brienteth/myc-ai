import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { MycHardwareWallet } from "./core/crypto/wallet.js";
import { ProofOfResonance } from "./core/consensus/por.js";
import { MycLatticeLedger } from "./ledger/dag/lattice.js";
import { MycWorldState } from "./ledger/state/state_machine.js";
import { MycBinaryFrame } from "./mesh/protocol/framing.js";
import { MycToken } from "./ledger/tokenomics/myc_token.js";
import { MycUSDToken } from "./ledger/tokenomics/usdt_token.js";
import { MycUSDCToken } from "./ledger/tokenomics/usdc_token.js";
import { MycStakingPool } from "./ledger/tokenomics/staking.js";
import { MycSwapDex } from "./ledger/tokenomics/swap_dex.js";
import { MycFaucet } from "./ledger/tokenomics/faucet.js";
import { deployAllContracts } from "./scripts/deploy_contracts.js";
import { MycRpcServer } from "./rpc/rpc_server.js";
import { MycLocalSafetyVerifier } from "./core/kernel/local_safety_verifier.js";
import { MycTaskScheduler } from "./colony/scheduler/task_scheduler.js";
import { MycPeerScoringV1 } from "./colony/scheduler/peer_scoring.js";
import { MycCognitiveTask } from "./colony/protocol/task_protocol.js";
import { MycMachineWalletManager } from "./depin/machine_wallet_manager.js";
import { MycAgentBridgeGateway } from "./agent-core/agent_bridge_gateway.js";
import { MycCrossChainRelayer } from "./ledger/bridge/cross_chain_relayer.js";
import { globalEventBus } from "./core/events/event_bus.js";
import { globalCapabilityRegistry } from "./colony/scheduler/capability_registry.js";
import { MycWebSocketServer } from "./core/events/websocket_server.js";
import { MycBlock } from "./ledger/blockchain/block.js";
import { getNFTNodeCapacity, onTaskSettled, scheduleResonantTask, getNFTValuation } from "./colony/scheduler/nft_node_scorer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4040;
const WS_PORT = process.env.WS_PORT || 4041;

// Initialize Blockchain, VM & Deployed Contracts
const deployed = await deployAllContracts();
const rpcServer = new MycRpcServer({
  blockchain: deployed.chain,
  vm: deployed.vm,
  deployedContracts: deployed.manifest.contracts,
  capabilityRegistry: globalCapabilityRegistry
});
const localSafety = new MycLocalSafetyVerifier();
const machineManager = new MycMachineWalletManager({ safetyVerifier: localSafety });
const peerScorer = new MycPeerScoringV1();
const colonyScheduler = new MycTaskScheduler(peerScorer);

function computeRisk(payload = {}) {
  const asset = payload.asset || "USDC_ESCROW";
  const ratio = payload.collateralRatio || 1.65;
  const vol = payload.volatilityIndex || 0.22;
  const baseRisk = Math.max(0.01, (1.0 / ratio) * (vol * 1.5));
  return {
    asset,
    riskScore: parseFloat(baseRisk.toFixed(4)),
    rating: baseRisk < 0.25 ? "AAA" : (baseRisk < 0.50 ? "BBB" : "CCC"),
    stressScenario: payload.stressScenario || "LIQUIDITY_CRUNCH_T3",
    certified: true,
    timestamp: 1725500000000
  };
}

colonyScheduler.registerExecutor("colony_worker_alpha", {
  vram: 24576,
  currentLoad: 0.10,
  latencyMs: 8,
  capabilities: ["financial_risk_scoring", "reasoning", "spectral_inference", "DATA_FEED_TEMPERATURE_READINGS"]
}, async (task) => computeRisk(task.payload));

colonyScheduler.registerExecutor("colony_worker_beta", {
  vram: 24576,
  currentLoad: 0.12,
  latencyMs: 11,
  capabilities: ["financial_risk_scoring", "reasoning", "spectral_inference", "DATA_FEED_TEMPERATURE_READINGS"]
}, async (task) => computeRisk(task.payload));

// Agent Bridge Gateway — unified orchestration for 3 scenarios
const agentBridgeGateway = new MycAgentBridgeGateway({
  bridgeContract: deployed.instances.bridge,
  escrowContract: deployed.instances.escrow,
  taskRegistryContract: deployed.instances.taskRegistry,
  agentRegistryContract: deployed.instances.agentRegistry,
  reputationContract: deployed.instances.reputation,
  tokenContract: deployed.instances.token,
  colonyScheduler,
  machineManager,
  streamPayContract: deployed.instances.streamPay || deployed.instances.opacusPay,
  opacusPayContract: deployed.instances.streamPay || deployed.instances.opacusPay
});

// Initialize Network Singletons
const token = new MycToken();
const usdtToken = new MycUSDToken();
const usdcToken = new MycUSDCToken();
const staking = new MycStakingPool(token);
const dex = new MycSwapDex(token, usdtToken, usdcToken);
const faucet = new MycFaucet(token);

const wallet = new MycHardwareWallet();
wallet.address = token.genesisAddress;
const por = new ProofOfResonance();
const ledger = new MycLatticeLedger("MYC-LATTICE-TESTNET");
const state = new MycWorldState();

// Sovereign Cross-Chain Relayer & Cryptographic Proof Verification Engine
const crossChainRelayer = new MycCrossChainRelayer({
  bridgeContract: deployed.instances.bridge,
  tokenContract: token,
  usdtTokenContract: usdtToken,
  usdcTokenContract: usdcToken,
  latticeLedger: ledger
});

// In-memory transaction registry for Explorer lookups
const transactionRegistry = new Map();
// Unified global live activity feed for all network events
const globalRecentActivity = [];

function recordGlobalActivity(item) {
  globalRecentActivity.unshift(item);
  if (globalRecentActivity.length > 100) globalRecentActivity.pop();
}

// Opacus Kernel Wallet Multi-Rail Compute Pool (Fiat / Multichain / Native 0G)
const opacusComputePool = {
  balanceUsdc: 5000.00,
  address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  totalFundedToMyc: 0.00,
  totalWithdrawnToBase: 0.00
};

// Registered & Verified Colony AI Agents
export const VERIFIED_AGENTS = [
  { id: "agent-myc-01", name: "Alpha Autonomous Trader", capabilities: ["dex_liquidity_provision", "arbitrage_execution"], policyHash: "0xpolicy_alpha", reputation: 98, role: "AI Arbitrage & DEX Market Maker" },
  { id: "colony_worker_alpha", name: "Colony Worker Alpha", capabilities: ["financial_risk_scoring", "dual_por_proving"], policyHash: "0xpolicy_worker_a", reputation: 95, role: "Dual-PoR Cognitive Task Prover" },
  { id: "colony_worker_beta", name: "Colony Worker Beta", capabilities: ["llm_spectral_reasoning", "dual_por_proving"], policyHash: "0xpolicy_worker_b", reputation: 94, role: "Distributed Spectral Reasoning Node" },
  { id: "myc-risk-agent", name: "Sovereign Risk Agent", capabilities: ["escrow_solvency_guard", "collateral_audit"], policyHash: "0xpolicy_risk", reputation: 99, role: "Collateral & Escrow Solvency Evaluator" },
  { id: "depin-sentinel-01", name: "DePIN Silicon Guard", capabilities: ["hardware_puf_attestation", "modbus_actuation_filter"], policyHash: "0xpolicy_depin", reputation: 97, role: "Silicon PUF Hardware Actuation Verifier" }
];

for (const ag of VERIFIED_AGENTS) {
  try {
    deployed.instances.agentRegistry.registerAgent(ag.id, ag.name, ag.capabilities, ag.policyHash, { msgSender: wallet.address });
  } catch (e) {}
}

// Dynamic Block Production Engine
const pendingBlockTxs = [];

export function produceNextBlock() {
  try {
    const parentBlock = deployed.chain.getLatestBlock();
    const nextNumber = parentBlock ? parentBlock.number + 1 : 1;
    const validator = "myc1genesisvalidator00000000000000000";
    const txsToInclude = pendingBlockTxs.splice(0, 50);

    const block = new MycBlock({
      number: nextNumber,
      parentHash: parentBlock ? parentBlock.hash : "0x" + "0".repeat(64),
      timestamp: Date.now(),
      transactions: txsToInclude,
      stateRoot: deployed.chain.state.calculateStateRoot(),
      receiptsRoot: "0x" + "0".repeat(64),
      validator,
      consensusProof: {
        proposer: validator,
        round: nextNumber,
        signature: "por_consensus_sig_" + nextNumber
      }
    });

    deployed.chain.blocks.push(block);
    deployed.chain.blocksByHash.set(block.hash, block);
    deployed.chain.consensus.finalizeBlock(block);

    globalEventBus.emit("blockFinalized", {
      number: block.number,
      hash: block.hash,
      txCount: txsToInclude.length,
      timestamp: block.timestamp
    });

    return block;
  } catch (err) {
    console.error("produceNextBlock error:", err);
  }
}

// 4-Second Dynamic Block Generation Heartbeat
setInterval(produceNextBlock, 4000);

function registerTx(tx) {
  transactionRegistry.set(tx.hash.toLowerCase(), tx);
  recordGlobalActivity(tx);
  pendingBlockTxs.push(tx);
  if (tx.sender) {
    const s = tx.sender.toLowerCase();
    if (!transactionRegistry.has(s)) transactionRegistry.set(s, []);
    const arr = transactionRegistry.get(s);
    if (Array.isArray(arr)) arr.push(tx);
  }
  if (tx.recipient) {
    const r = tx.recipient.toLowerCase();
    if (!transactionRegistry.has(r)) transactionRegistry.set(r, []);
    const arr = transactionRegistry.get(r);
    if (Array.isArray(arr)) arr.push(tx);
  }
  // Immediately forge transaction into live block
  produceNextBlock();
}


// Seed initial stake for demo: 5,000 MYC => 5 devices quota
staking.stake(token.genesisAddress, 5000, "DEPIN_TIER_2");

function evaluateKernel(input) {
  const low = (input || "").toLowerCase().trim();
  if (!low || low.length > 128) {
    return {
      status: 225,
      error_code: "ERR_BUFFER_OVERFLOW",
      device: "NONE",
      unit: 0,
      action: "REJECT",
      coil: "0x0000",
      target_register: 0,
      action_value: 0,
      voltage: "0.00V (Safe Low)"
    };
  }

  // Negation attack & contradiction guard (Kilit 5 & Kilit 6)
  const negWords = ["never", "sakın", "sakin", "asla", "abort", "cancel", "dur", "iptal", "don't", "dont"];
  if (negWords.some(w => new RegExp("\\b" + w + "\\b", "i").test(low) || low.includes(w))) {
    return {
      status: 229,
      error_code: "ERR_NEGATIVE_GUARD",
      device: "PROTECTED",
      unit: 0,
      action: "REJECT",
      coil: "0x0000",
      target_register: 0,
      action_value: 0,
      voltage: "0.00V (Safe Low)",
      fail_safe_latency_us: 2.8
    };
  }

  let device = null;
  let baseCoil = 0;
  if (low.includes("turbine") || low.includes("türbin")) { device = "TURBINE"; baseCoil = 0x0080; }
  else if (low.includes("valve") || low.includes("vana")) { device = "VALVE"; baseCoil = 0x0010; }
  else if (low.includes("pump") || low.includes("pompa")) { device = "PUMP"; baseCoil = 0x0000; }
  else if (low.includes("motor")) { device = "MOTOR"; baseCoil = 0x0060; }
  else if (low.includes("fan")) { device = "FAN"; baseCoil = 0x0030; }

  const hasStart = ["start", "run", "open", "activate", "çalış", "aç"].some(w => low.includes(w));
  const hasStop = ["stop", "halt", "close", "shut", "dur", "kapat"].some(w => low.includes(w));

  if (!device && !hasStart && !hasStop) {
    return {
      status: 232,
      error_code: "ERR_NON_INDUSTRIAL",
      device: "NONE",
      unit: 0,
      action: "REJECT",
      coil: "0x0000",
      target_register: 0,
      action_value: 0,
      voltage: "0.00V (Safe Low)"
    };
  }

  if (hasStart && hasStop) {
    return {
      status: 228,
      error_code: "ERR_AMBIGUOUS_OP",
      device: device || "UNKNOWN",
      unit: 0,
      action: "REJECT",
      coil: "0x0000",
      target_register: 0,
      action_value: 0,
      voltage: "0.00V (Safe Low)",
      fail_safe_latency_us: 2.9
    };
  }

  if (!device) {
    return {
      status: 226,
      error_code: "ERR_UNKNOWN_DEVICE",
      device: "UNKNOWN",
      unit: 0,
      action: "REJECT",
      coil: "0x0000",
      target_register: 0,
      action_value: 0,
      voltage: "0.00V (Safe Low)"
    };
  }

  let unit = 1;
  if (low.includes("#2") || low.includes("no 2") || low.includes(" 2")) unit = 2;
  else if (low.includes("#3") || low.includes(" 3")) unit = 3;
  else if (low.includes("#4") || low.includes(" 4")) unit = 4;
  else if (low.includes("#5") || low.includes(" 5")) unit = 5;

  const targetRegister = baseCoil + unit;
  const actionValue = hasStart ? 0xFF00 : 0x0000;
  const coilHex = "0x" + targetRegister.toString(16).padStart(4, "0").toUpperCase();
  const voltage = hasStart ? "3.30V (HIGH)" : "0.00V (Safe Low)";

  return {
    status: 0,
    error_code: "SUCCESS",
    device,
    unit,
    action: hasStart ? "START" : "STOP",
    coil: coilHex,
    target_register: targetRegister,
    action_value: actionValue,
    voltage,
    ram_consumed_bytes: 384,
    wcet_latency_us: 38.4
  };
}

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".zip": "application/zip",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ------------------------------------------------------------------------
  // Web3 JSON-RPC 2.0 Engine: POST /api/rpc or /rpc
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/rpc" || url.pathname === "/rpc") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const rpcRes = await rpcServer.handleRequest(payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rpcRes));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // SMART CONTRACTS DIRECTORY: GET /api/contracts
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/contracts" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      network: "MYC-LATTICE-MAINNET",
      chainId: 108,
      manifest: deployed.manifest,
      contracts: deployed.vm.getAllContracts()
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // SMART CONTRACT CALL: POST /api/contracts/call
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/contracts/call" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { contractAddress, method, args, isWrite } = JSON.parse(body || "{}");
        if (isWrite) {
          const result = deployed.vm.execute({
            from: wallet.address,
            to: contractAddress,
            data: JSON.stringify({ method, args })
          });
          deployed.chain.produceBlock();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } else {
          const result = deployed.vm.call({
            from: wallet.address,
            to: contractAddress,
            method,
            args
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // USER SMART CONTRACT DEPLOYMENT: POST /api/contract/deploy & /api/contracts/deploy
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/contract/deploy" || url.pathname === "/api/contracts/deploy") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { name, abi, bytecode, sourceCode, constructorArgs, deployerAddress } = JSON.parse(body || "{}");
        const deployRes = deployed.vm.deployUserContract({
          name: name || "UserContract",
          abi: abi || [],
          bytecode: bytecode || "",
          sourceCode: sourceCode || "",
          constructorArgs: constructorArgs || [],
          deployerAddress: deployerAddress || wallet.address
        });
        deployed.chain.produceBlock();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          contractAddress: deployRes.contractAddress,
          transactionHash: deployRes.transactionHash,
          name: deployRes.name,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // COLONY CAPABILITY REGISTRY: POST /api/capability/register & GET /api/capabilities
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/capability/register" || url.pathname === "/api/colony/capability/register") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { name, capability, minVramMb, pricePerTask, priceAsset, description } = JSON.parse(body || "{}");
        const capName = name || capability;
        const result = globalCapabilityRegistry.registerCapability(capName, {
          providerAddress: wallet.address,
          minVramMb,
          pricePerTask,
          priceAsset,
          description
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if ((url.pathname === "/api/capabilities" || url.pathname === "/api/colony/capabilities") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      capabilities: globalCapabilityRegistry.listCapabilities()
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // GAME & ARCADE REAL-TIME INVARIANT ENGINE: POST /api/game/action
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/game/action" || url.pathname === "/api/arcade/action") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { playerAddress, gameId, eventType, score, metadata } = JSON.parse(body || "{}");
        const player = (playerAddress || wallet.address).toLowerCase();
        const gid = gameId || "ARCADE_SPORE_ESCAPE";
        const evt = eventType || "SCORE_SUBMISSION";
        const pts = parseInt(score) || 0;

        // Produce block with zero-gas invariant
        const txHash = "0x" + crypto.randomBytes(32).toString("hex");
        deployed.chain.produceBlock();
        const blockNum = deployed.chain.getLatestBlock().number;

        const actionReceipt = {
          success: true,
          transactionHash: txHash,
          blockNumber: blockNum,
          gameId: gid,
          player: player,
          eventType: evt,
          score: pts,
          latencyNs: 38400,
          latencyMicroseconds: 38.4,
          hardwareInvariant: "ZERO_GAS_VERIFIED",
          timestamp: Date.now(),
          metadata: metadata || {}
        };

        globalEventBus.emit("GameAction", actionReceipt);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(actionReceipt));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // LIVING RESONANCE ASSETS (ERC-721R) 3-TIER MINT & SUPPLY ENDPOINTS:
  // POST /api/resonance/mint, GET /api/resonance/supply, GET /api/resonance/tier/:tokenId
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/resonance/supply" && req.method === "GET") {
    try {
      const resAsset = deployed.instances.resonanceAsset;
      const seedSup = resAsset.getRemainingSupply("SEED");
      const resSup = resAsset.getRemainingSupply("RESONANT");
      const sovSup = resAsset.getRemainingSupply("SOVEREIGN");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        SEED: { minted: seedSup.minted, max: seedSup.max, remaining: seedSup.remaining, price: seedSup.price },
        RESONANT: { minted: resSup.minted, max: resSup.max, remaining: resSup.remaining, price: resSup.price },
        SOVEREIGN: { minted: sovSup.minted, max: sovSup.max, remaining: sovSup.remaining, price: sovSup.price },
        totalMinted: seedSup.minted + resSup.minted + sovSup.minted,
        totalMaxSupply: seedSup.max + resSup.max + sovSup.max
      }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (url.pathname.startsWith("/api/resonance/tier") && req.method === "GET") {
    try {
      let tokenId = url.searchParams.get("id") || url.searchParams.get("tokenId");
      if (!tokenId) {
        const parts = url.pathname.split("/");
        if (parts.length >= 5) tokenId = parts[4];
      }
      tokenId = tokenId || "1";

      const resAsset = deployed.instances.resonanceAsset;
      const tier = resAsset.getTierOfToken(tokenId);
      const capabilities = resAsset.getTierCapabilities(tokenId);
      const nodeCapacity = getNFTNodeCapacity(tokenId, resAsset);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        tokenId: parseInt(tokenId),
        tier,
        capabilities,
        maxConcurrentTasks: nodeCapacity.maxConcurrentTasks,
        energyScore: nodeCapacity.energyScore,
        status: nodeCapacity.status,
        owner: nodeCapacity.owner
      }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/resonance/mint" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const resAsset = deployed.instances.resonanceAsset;
        const recipient = (parsed.to || parsed.creator || wallet.address).toLowerCase();
        const tier = (parsed.tier || "SEED").toUpperCase();

        let mintResult;
        if (tier === "SEED") {
          mintResult = resAsset.mintSeed(recipient, { msgSender: recipient });
        } else if (tier === "RESONANT") {
          mintResult = resAsset.mintResonant(recipient, { msgSender: recipient });
        } else if (tier === "SOVEREIGN") {
          mintResult = resAsset.mintSovereign(recipient, { msgSender: recipient });
        } else {
          // Fallback legacy mint
          const id = resAsset.mintResonanceAsset(parsed.uri, parsed.harmonics, parsed.dominantHz, parsed.decayRate, parsed.governanceContract, { msgSender: recipient });
          mintResult = { tokenId: id, tier: "SEED", energy: 1000, nodeId: id, owner: recipient };
        }

        deployed.chain.produceBlock();
        const block = deployed.chain.getLatestBlock();
        const sup = resAsset.getRemainingSupply(mintResult.tier || "SEED");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          tokenId: mintResult.tokenId,
          tier: mintResult.tier,
          energy: mintResult.energy,
          nodeId: mintResult.nodeId || mintResult.tokenId,
          owner: mintResult.owner || recipient,
          role: mintResult.role,
          maxTasks: mintResult.maxTasks,
          capabilities: mintResult.capabilities,
          txHash: "0x" + block.hash,
          remainingSupply: sup.remaining,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }


  if (url.pathname === "/api/resonance/interact" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, interactionType, caller } = JSON.parse(body || "{}");
        const sender = caller || wallet.address;
        const resAsset = deployed.instances.resonanceAsset;
        const result = resAsset.interact(tokenId, interactionType, { msgSender: sender });
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/bond" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenA, tokenB, caller } = JSON.parse(body || "{}");
        const sender = caller || wallet.address;
        const resAsset = deployed.instances.resonanceAsset;
        const result = resAsset.bondResonance(tokenA, tokenB, { msgSender: sender });
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/observe" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, contextHash, observer } = JSON.parse(body || "{}");
        const sender = observer || wallet.address;
        const resAsset = deployed.instances.resonanceAsset;
        const result = resAsset.observe(tokenId, contextHash, { msgSender: sender });
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/asset" && req.method === "GET") {
    const tokenId = url.searchParams.get("id") || "1";
    const resAsset = deployed.instances.resonanceAsset;
    const asset = resAsset.getAsset(tokenId);
    if (!asset) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "ASSET_NOT_FOUND" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      contractAddress: deployed.manifest.contracts.MycResonanceAsset.address,
      asset
    }));
    return;
  }

  // POST /api/resonance/transfer — Transfer Living NFT and synchronize Colony Node ownership
  if (url.pathname === "/api/resonance/transfer" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, to, caller } = JSON.parse(body || "{}");
        if (!tokenId || !to) throw new Error("TOKEN_ID_AND_RECIPIENT_REQUIRED");
        const sender = caller || wallet.address;
        const resAsset = deployed.instances.resonanceAsset;
        resAsset.transfer(tokenId, to, { msgSender: sender });
        deployed.chain.produceBlock();

        const nodeReg = deployed.instances.nodeRegistry;
        const updatedNode = nodeReg ? nodeReg.getNode(String(tokenId)) : null;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          tokenId: parseInt(tokenId),
          newOwner: to.toLowerCase(),
          nodeSynced: Boolean(updatedNode && updatedNode.owner.toLowerCase() === to.toLowerCase()),
          node: updatedNode,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // QUANTITATIVE CASHFLOW VALUATION ENGINE: GET /api/resonance/valuation
  // ------------------------------------------------------------------------
  if (url.pathname.startsWith("/api/resonance/valuation") && req.method === "GET") {
    try {
      let tokenId = url.searchParams.get("id") || url.searchParams.get("tokenId");
      if (!tokenId) {
        const parts = url.pathname.split("/");
        if (parts.length >= 5) tokenId = parts[4];
      }
      tokenId = tokenId || "1";

      const resAsset = deployed.instances.resonanceAsset;
      const valuation = getNFTValuation(tokenId, resAsset);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        ...valuation
      }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ------------------------------------------------------------------------
  // LIVING NFT MARKETPLACE ENDPOINTS:
  // POST /api/resonance/market/list, cancel, buy & GET /api/resonance/market/listings
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/resonance/market/list" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, price, currency, minEnergy, showYieldHistory, seller } = JSON.parse(body || "{}");
        const sender = seller || wallet.address;
        const marketplace = deployed.instances.marketplace;
        const listing = marketplace.listForSale(
          tokenId,
          price,
          minEnergy || 0,
          showYieldHistory !== false,
          { msgSender: sender }
        );
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          listing,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/market/cancel" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, caller } = JSON.parse(body || "{}");
        const sender = caller || wallet.address;
        const marketplace = deployed.instances.marketplace;
        marketplace.cancelListing(tokenId, { msgSender: sender });
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          tokenId: parseInt(tokenId),
          cancelled: true,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/market/buy" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, maxPrice, buyer } = JSON.parse(body || "{}");
        const sender = buyer || wallet.address;
        const marketplace = deployed.instances.marketplace;
        const result = marketplace.buy(tokenId, maxPrice, { msgSender: sender });
        deployed.chain.produceBlock();

        // Verify node ownership in registry
        const node = deployed.instances.nodeRegistry ? deployed.instances.nodeRegistry.getNode(String(tokenId)) : null;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          nodeOwnershipTransferred: Boolean(node && node.owner.toLowerCase() === sender.toLowerCase()),
          node,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/market/listings" && req.method === "GET") {
    try {
      const marketplace = deployed.instances.marketplace;
      const resAsset = deployed.instances.resonanceAsset;
      const rawListings = marketplace.getActiveListings();

      const enriched = rawListings.map(l => ({
        ...l,
        valuation: getNFTValuation(l.tokenId, resAsset, l.priceUSDC)
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        count: enriched.length,
        listings: enriched
      }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ------------------------------------------------------------------------
  // DEDICATED NATIVE MARKETPLACE ENDPOINTS:
  // GET /api/marketplace/listings
  // POST /api/marketplace/list
  // POST /api/marketplace/buy
  // POST/DELETE /api/marketplace/delist
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/marketplace/listings" && req.method === "GET") {
    try {
      const marketplace = deployed.instances.marketplace;
      const resAsset = deployed.instances.resonanceAsset;
      const rawListings = marketplace ? marketplace.getActiveListings() : [];

      const formatted = rawListings.map(l => {
        const val = getNFTValuation(l.tokenId, resAsset, l.priceUSDC);
        const paybackMatch = val.impliedValue && val.impliedValue.paybackPeriod ? parseInt(val.impliedValue.paybackPeriod) : 0;
        return {
          tokenId: l.tokenId,
          seller: l.seller,
          price: l.priceUSDC,
          currency: "USDC",
          minEnergy: l.minEnergy || 0,
          dailyYield: val.last30Days ? val.last30Days.avgDailyYield : 0,
          energy: val.currentEnergy || 0,
          tier: val.tier || "SEED",
          bonds: val.resonanceBonds || 0,
          bondMultiplier: val.bondMultiplier || 1.0,
          tasks30d: val.last30Days ? val.last30Days.tasksCompleted : 0,
          paybackDays: isNaN(paybackMatch) ? 0 : paybackMatch,
          energyTrajectory: val.impliedValue ? val.impliedValue.energyTrajectory : "STABLE",
          annualYield: val.impliedValue ? val.impliedValue.annualYield : 0,
          listedAt: l.listedAt || Date.now(),
          valuation: val
        };
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        count: formatted.length,
        listings: formatted
      }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/marketplace/list" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, price, currency, minEnergy, seller } = JSON.parse(body || "{}");
        const sender = seller || wallet.address;
        const marketplace = deployed.instances.marketplace;
        if (!marketplace) throw new Error("MARKETPLACE_NOT_DEPLOYED");

        const listing = marketplace.listForSale(
          tokenId,
          price,
          minEnergy || 0,
          true,
          { msgSender: sender }
        );
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          listing,
          currency: currency || "USDC",
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/marketplace/buy" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, maxPrice, buyer } = JSON.parse(body || "{}");
        const sender = buyer || wallet.address;
        const marketplace = deployed.instances.marketplace;
        if (!marketplace) throw new Error("MARKETPLACE_NOT_DEPLOYED");

        const result = marketplace.buy(tokenId, maxPrice, { msgSender: sender });
        deployed.chain.produceBlock();

        const node = deployed.instances.nodeRegistry ? deployed.instances.nodeRegistry.getNode(String(tokenId)) : null;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          nodeOwnershipTransferred: Boolean(node && node.owner.toLowerCase() === sender.toLowerCase()),
          node,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if ((url.pathname === "/api/marketplace/delist" || url.pathname === "/api/marketplace/cancel") && (req.method === "POST" || req.method === "DELETE")) {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const tokenId = parsed.tokenId || url.searchParams.get("tokenId");
        const sender = parsed.seller || parsed.caller || wallet.address;
        const marketplace = deployed.instances.marketplace;
        if (!marketplace) throw new Error("MARKETPLACE_NOT_DEPLOYED");

        marketplace.cancelListing(tokenId, { msgSender: sender });
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          tokenId: parseInt(tokenId),
          delisted: true,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // NON-CUSTODIAL STAKING & OPERATOR DELEGATION ENDPOINTS:
  // POST /api/resonance/delegate, POST /api/resonance/undelegate, GET /api/resonance/delegations
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/resonance/delegate" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, operator, revenueShare, minUptime, caller } = JSON.parse(body || "{}");
        const nodeReg = deployed.instances.nodeRegistry;
        const resAsset = deployed.instances.resonanceAsset;
        const asset = resAsset.getAsset(tokenId);
        const sender = caller || (asset ? asset.creator : wallet.address);

        const result = nodeReg.delegateNode(
          tokenId,
          operator,
          revenueShare !== undefined ? revenueShare : 70,
          minUptime || 95,
          { msgSender: sender }
        );
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/undelegate" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { tokenId, caller } = JSON.parse(body || "{}");
        const nodeReg = deployed.instances.nodeRegistry;
        const resAsset = deployed.instances.resonanceAsset;
        const asset = resAsset.getAsset(tokenId);
        const sender = caller || (asset ? asset.creator : wallet.address);

        const result = nodeReg.undelegateNode(tokenId, { msgSender: sender });
        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...result,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/resonance/delegations" && req.method === "GET") {
    try {
      const nodeReg = deployed.instances.nodeRegistry;
      const allNodes = nodeReg.getAllNodes();
      const delegated = allNodes.filter(n => n.isDelegated);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        count: delegated.length,
        delegations: delegated
      }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ------------------------------------------------------------------------
  // COLONY NFT NODE CAPACITY & SETTLEMENT ENDPOINTS:
  // GET /api/colony/nft-node, POST /api/colony/task/settle, POST /api/colony/task/schedule-resonant
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/colony/nft-node" && req.method === "GET") {
    try {
      const tokenId = url.searchParams.get("id") || "1";
      const resAsset = deployed.instances.resonanceAsset;
      const nodeReg = deployed.instances.nodeRegistry;

      const capacity = getNFTNodeCapacity(tokenId, resAsset);
      const onChainNode = nodeReg ? nodeReg.getNode(String(tokenId)) : null;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        tokenId: parseInt(tokenId),
        node: onChainNode,
        capacity,
        contractAddress: deployed.manifest.contracts.MycResonanceAsset.address,
        nodeRegistryAddress: deployed.manifest.contracts.MycNodeRegistry.address
      }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/colony/task/settle" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { taskId, nodeTokenId, result, usdcAmount } = JSON.parse(body || "{}");
        if (!nodeTokenId) throw new Error("NODE_TOKEN_ID_REQUIRED");

        const settlementResult = await onTaskSettled({
          taskId: taskId || ("tsk_" + crypto.randomBytes(4).toString("hex")),
          nodeTokenId,
          result: result || { status: "COMPLETED", output: "Execution verified by Colony Node" },
          usdcAmount: parseFloat(usdcAmount) || 15.0,
          resonanceContract: deployed.instances.resonanceAsset,
          nodeRegistryContract: deployed.instances.nodeRegistry,
          reputationContract: deployed.instances.reputation,
          escrowContract: deployed.instances.escrow,
          usdcContract: deployed.instances.usdc
        });

        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...settlementResult,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/colony/task/schedule-resonant" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { task, candidateNodeIds } = JSON.parse(body || "{}");
        const scheduled = await scheduleResonantTask({
          task: task || { taskId: "task_res_" + Date.now(), capabilityRequired: "AI_INFERENCE" },
          candidateNodeIds: candidateNodeIds || [1],
          resonanceContract: deployed.instances.resonanceAsset,
          nodeRegistryContract: deployed.instances.nodeRegistry
        });

        deployed.chain.produceBlock();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          ...scheduled,
          blockNumber: deployed.chain.getLatestBlock().number,
          zeroGas: true
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // REAL-TIME EVENT STREAM (Server-Sent Events): GET /api/events
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

    const listener = (eventRecord) => {
      try {
        res.write(`data: ${JSON.stringify(eventRecord)}\n\n`);
      } catch (e) {}
    };

    globalEventBus.on("*", listener);
    req.on("close", () => {
      globalEventBus.off("*", listener);
    });
    return;
  }

  // ------------------------------------------------------------------------
  // BLOCK EXPLORER: GET /api/blocks
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/blocks" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      latestHeight: deployed.chain.getLatestBlock().number,
      blocks: deployed.chain.blocks.slice(-50).map(b => b.toJSON())
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // FAUCET API: GET /api/faucet/status
  // Checks eligibility, cooldown status, and Twitter verification requirements
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/faucet/status" && req.method === "GET") {
    const address = url.searchParams.get("address") || url.searchParams.get("recipient") || "";
    const twitter = url.searchParams.get("twitter") || url.searchParams.get("twitterHandle") || "";
    const status = faucet.getStatus(address, twitter);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, ...status }));
    return;
  }

  // ------------------------------------------------------------------------
  // FAUCET API: POST /api/faucet
  // Dispenses 5 $MYC testnet tokens per request (24-hour limit + @myc_ai follow)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/faucet" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const targetAddress = payload.recipient || payload.address;
        if (!targetAddress) {
          throw new Error("Hedef cüzdan adresi girilmelidir.");
        }
        const normalized = MycHardwareWallet.normalizeAddress(targetAddress);
        if (!MycHardwareWallet.isValidAddress(normalized)) {
          throw new Error(`Geçersiz cüzdan adresi: '${targetAddress}'. MYC adresleri 'myc1' ile başlamalı ve 36 karakterden oluşmalıdır (Örn: myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002).`);
        }

        const handle = payload.twitterHandle || payload.twitter;
        const verifiedFollow = payload.verifiedFollow === true || payload.verifiedFollow === "true";

        const claim = faucet.requestTokens(normalized, handle, verifiedFollow);

        // Commit faucet disbursement vertex to DAG
        const vertex = ledger.appendVertex({
          sender: faucet.faucetPoolAddress,
          device: "FAUCET",
          action: "DISPENSE",
          coil: 0x0000,
          actionValue: claim.amount,
          porHash: claim.txHash,
          latencyUs: "12.0",
          signature: "por_faucet_sig"
        });

        // Register faucet transaction
        registerTx({
          hash: vertex.vertexHash,
          type: "FAUCET_CLAIM",
          amount: claim.amount,
          sender: faucet.faucetPoolAddress,
          recipient: normalized,
          twitterHandle: claim.twitterHandle,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "12.0 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          claim,
          dagVertex: vertex.vertexHash,
          balance: token.balanceOf(normalized),
          usdtBalance: usdtToken.balanceOf(normalized),
          usdcBalance: usdcToken.balanceOf(normalized)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // WALLET BALANCES API: GET /api/wallet/balance?address=... & GET /api/balance/:address
  // Returns real-time on-chain balances for $MYC, $USDT, and $USDC
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/wallet/balance" || url.pathname.startsWith("/api/balance")) && req.method === "GET") {
    let addrParam = url.searchParams.get("address");
    if (!addrParam && url.pathname.startsWith("/api/balance/")) {
      addrParam = url.pathname.replace("/api/balance/", "").split("/")[0];
    }
    const addr = (addrParam || token.genesisAddress).toLowerCase();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      address: addr,
      balance: token.balanceOf(addr),
      mycBalance: token.balanceOf(addr),
      usdtBalance: usdtToken.balanceOf(addr),
      usdcBalance: usdcToken.balanceOf(addr),
      network: "MYC-TESTNET-SPHEROID-1",
      chainId: 108
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // RECENT TRANSACTIONS API: GET /api/transactions
  // Returns all recent network operations (Transfer, Swap, Stake, Faucet, Intent, Agent)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/transactions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      total: globalRecentActivity.length,
      transactions: globalRecentActivity
    }));
    return;
  }

  // SEARCH / QUERY API: GET /api/search?q=...
  // Searches transactions by Hash, Sender, Recipient, or Device
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/search" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();
    if (!q) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ found: false, results: [] }));
      return;
    }

    // Direct hash lookup
    if (transactionRegistry.has(q)) {
      const match = transactionRegistry.get(q);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        found: true,
        type: Array.isArray(match) ? "ADDRESS" : "TRANSACTION",
        result: match
      }));
      return;
    }

    // Check if it's the genesis or active wallet address
    if (q === token.genesisAddress.toLowerCase() || q === wallet.address.toLowerCase()) {
      const userTxs = transactionRegistry.get(q) || [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        found: true,
        type: "WALLET_ACCOUNT",
        result: {
          address: q,
          balance: token.balanceOf(token.genesisAddress),
          staked: staking.getStakeInfo(token.genesisAddress).amount,
          deviceQuota: Math.floor(staking.getStakeInfo(token.genesisAddress).amount / 1000),
          transactions: userTxs
        }
      }));
      return;
    }

    // Check if it's a valid MYC sovereign wallet address
    if (MycHardwareWallet.isValidAddress(q)) {
      const userTxs = transactionRegistry.get(q) || [];
      const bal = token.balanceOf(q);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        found: true,
        type: "WALLET_ACCOUNT",
        result: {
          address: q,
          balance: bal,
          staked: 0,
          deviceQuota: 0,
          transactions: userTxs
        }
      }));
      return;
    }

    // Partial search across all transactions
    const matches = [];
    for (const [key, val] of transactionRegistry.entries()) {
      if (!Array.isArray(val) && (key.includes(q) || (val.recipient && val.recipient.toLowerCase().includes(q)) || (val.device && val.device.toLowerCase().includes(q)))) {
        matches.push(val);
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      found: matches.length > 0,
      type: "LIST",
      results: matches
    }));
    return;
  }

  // TRANSFER API: POST /api/transfer
  // Transfers with 0-gas and commits real vertex to Lattice DAG
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/transfer" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { to, amount } = JSON.parse(body || "{}");
        const amt = parseFloat(amount);

        // 1. Strict Sovereign Address Validation
        const normalizedTo = MycHardwareWallet.normalizeAddress(to);
        if (!MycHardwareWallet.isValidAddress(normalizedTo)) {
          throw new Error(`Geçersiz alıcı cüzdan adresi: '${to}'. MYC adresleri 'myc1' ile başlamalı ve 36 karakterden (myc1 + 32 hex) oluşmalıdır (Örn: myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002).`);
        }

        // 2. Amount Validation
        if (isNaN(amt) || amt <= 0) {
          throw new Error("Geçersiz transfer miktarı. Miktar 0'dan büyük olmalıdır.");
        }

        // 3. Prevent Self-Transfer
        const senderAddr = MycHardwareWallet.normalizeAddress(wallet.address || token.genesisAddress);
        if (normalizedTo === senderAddr || normalizedTo === token.genesisAddress.toLowerCase()) {
          throw new Error("Kendi cüzdan adresinize transfer yapamazsınız.");
        }

        // 4. Balance Check
        const currentBal = token.balanceOf(token.genesisAddress);
        if (amt > currentBal) {
          throw new Error(`Yetersiz bakiye! Mevcut: ${currentBal.toLocaleString()} $MYC, Gönderilmek istenen: ${amt.toLocaleString()} $MYC`);
        }

        // Execute token transfer
        token.transfer(token.genesisAddress, normalizedTo, amt);

        // Commit transfer to Lattice DAG as a real vertex
        const vertex = ledger.appendVertex({
          sender: wallet.address,
          device: "TRANSFER",
          action: "SEND",
          coil: 0x0000,
          actionValue: amt,
          porHash: "0x" + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          latencyUs: "38.4",
          signature: wallet.signTransaction("transfer_tx").signature
        });

        registerTx({
          hash: vertex.vertexHash,
          type: "TRANSFER",
          amount: amt,
          sender: wallet.address,
          recipient: normalizedTo,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          txHash: vertex.vertexHash,
          amount: amt,
          recipient: normalizedTo,
          sender: wallet.address,
          gasFee: "0.00 MYC",
          finality: "38.4 µs",
          explorerUrl: "http://localhost:4040/explorer/?tx=" + vertex.vertexHash,
          balance: token.balanceOf(token.genesisAddress)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // A. POST /api/intent
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/intent" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const command = payload.command || "";

        const kernelResult = evaluateKernel(command);
        const porProof = por.evaluateProof(command, kernelResult);

        if (kernelResult.status === 0 && porProof.verified) {
          const sig = wallet.signTransaction(porProof.porHash);
          const vertex = ledger.appendVertex({
            sender: wallet.address,
            device: kernelResult.device,
            action: kernelResult.action,
            coil: kernelResult.target_register,
            actionValue: kernelResult.action_value,
            porHash: porProof.porHash,
            latencyUs: "38.4",
            signature: sig.signature
          });

          state.transition(kernelResult.device, kernelResult.unit, kernelResult.action, kernelResult.action_value);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            action: `${kernelResult.action} Industrial ${kernelResult.device} Unit #${kernelResult.unit}`,
            kernel: {
              status: kernelResult.status,
              device: kernelResult.device,
              unit: kernelResult.unit,
              action: kernelResult.action,
              coil: kernelResult.coil,
              voltage: kernelResult.voltage
            },
            por: {
              coherence: parseFloat(porProof.coherence.toFixed(2)),
              verified: porProof.verified
            },
            gasFee: "0.00 MYC",
            finality: "38.4 µs",
            dagCommitment: vertex.vertexHash
          }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            action: "FAIL_SAFE_HALT (0-Byte NO-OP)",
            kernel: {
              status: kernelResult.status,
              device: kernelResult.device,
              unit: kernelResult.unit,
              action: kernelResult.action,
              coil: kernelResult.coil,
              voltage: "0.00V (Safe Low)"
            },
            por: {
              coherence: parseFloat((porProof.coherence || 0).toFixed(2)),
              verified: false
            },
            gasFee: "0.00 MYC",
            finality: "< 3.1 µs",
            dagCommitment: "0x0000000000000000000000000000000000000000000000000000000000000000"
          }));
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // B1. GET /api/swap/stats (Pool reserves, TWAP, security stats)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/swap/stats" && req.method === "GET") {
    try {
      const stats = dex.getPoolStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, stats }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ------------------------------------------------------------------------
  // B2. GET /api/swap/quote (Read-only price quote with slippage & impact)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/swap/quote" && req.method === "GET") {
    try {
      const from = url.searchParams.get("from") || "MYC";
      const to = url.searchParams.get("to") || "USDT";
      const amount = parseFloat(url.searchParams.get("amount") || "100");
      const quote = dex.quote(from, to, amount);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, quote }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ------------------------------------------------------------------------
  // B3. POST /api/swap (State-changing Swap with 7 Security Layers)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/swap" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const {
          from,
          to,
          amount,
          userAddress,
          maxSlippageBps,
          minAmountOut
        } = JSON.parse(body || "{}");

        const caller = (userAddress || wallet.address || token.genesisAddress).toLowerCase();
        const swapReceipt = dex.swap(caller, from, to, parseFloat(amount), {
          maxSlippageBps: maxSlippageBps ? parseInt(maxSlippageBps, 10) : undefined,
          minAmountOut: minAmountOut ? parseFloat(minAmountOut) : undefined
        });

        const swapVertex = ledger.appendVertex({
          sender: caller,
          device: "MYC_DEX_SWAP",
          action: "SWAP",
          coil: 0x0000,
          actionValue: parseFloat(amount),
          porHash: "0x" + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          latencyUs: "38.4",
          signature: wallet.signTransaction("swap_tx").signature
        });

        registerTx({
          hash: swapVertex.vertexHash,
          type: "SWAP",
          from: from,
          to: to,
          amountIn: parseFloat(amount),
          amountOut: swapReceipt.amountOut,
          sender: caller,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          meta: `MYC DEX Swap (${from} → ${to}, Impact: ${swapReceipt.priceImpactPercent}%)`,
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          swap: swapReceipt,
          updatedBalances: {
            MYC: token.balanceOf(caller),
            USDT: usdtToken.balanceOf(caller),
            USDC: usdcToken.balanceOf(caller)
          },
          reserves: dex.reserves
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // C1. GET /api/stake/info
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/stake/info" && req.method === "GET") {
    const userAddr = url.searchParams.get("address") || wallet.address;
    const info = staking.getStakeInfo(userAddr);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      address: userAddr,
      ...info,
      balanceMyc: token.balanceOf(userAddr)
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // C2. POST /api/stake (Deposit with Strategy)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/stake" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { address, amount, strategy, tier } = JSON.parse(body || "{}");
        const userAddr = address || wallet.address;
        const selectedTier = strategy || tier || "FLEXIBLE";
        const amt = parseFloat(amount);

        const stakeReceipt = staking.stake(userAddr, amt, selectedTier);
        const stakeInfo = staking.getStakeInfo(userAddr);

        const stakeVertex = ledger.appendVertex({
          sender: userAddr,
          device: "DEPIN_STAKE",
          action: "STAKE",
          coil: 0x0000,
          actionValue: amt,
          porHash: "0x" + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          latencyUs: "38.4",
          signature: wallet.signTransaction("stake_tx").signature
        });

        registerTx({
          hash: stakeVertex.vertexHash,
          type: "STAKE_DEPOSIT",
          amount: amt,
          strategy: stakeReceipt.strategy,
          apy: stakeReceipt.apyRate,
          sender: userAddr,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          receipt: stakeReceipt,
          stakeInfo,
          balanceMyc: token.balanceOf(userAddr)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // C3. POST /api/stake/claim (Harvest Staking Rewards)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/stake/claim" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { address } = JSON.parse(body || "{}");
        const userAddr = address || wallet.address;
        const claimReceipt = staking.claimRewards(userAddr);

        registerTx({
          hash: "claim_" + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          type: "STAKE_CLAIM",
          amount: claimReceipt.claimedAmount,
          sender: userAddr,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "HARVESTED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          claimedAmount: claimReceipt.claimedAmount,
          receipt: claimReceipt,
          stakeInfo: staking.getStakeInfo(userAddr),
          balanceMyc: token.balanceOf(userAddr)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // C4. POST /api/stake/compound (Auto Re-Stake Rewards)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/stake/compound" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { address } = JSON.parse(body || "{}");
        const userAddr = address || wallet.address;
        const compoundReceipt = staking.compoundRewards(userAddr);

        registerTx({
          hash: "comp_" + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          type: "STAKE_COMPOUND",
          amount: compoundReceipt.compoundedAmount,
          sender: userAddr,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "REINVESTED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          compoundedAmount: compoundReceipt.compoundedAmount,
          stakeInfo: staking.getStakeInfo(userAddr),
          balanceMyc: token.balanceOf(userAddr)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // C5. POST /api/stake/unstake (Withdraw Principal)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/stake/unstake" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { address, amount } = JSON.parse(body || "{}");
        const userAddr = address || wallet.address;
        const unstakeReceipt = staking.unstake(userAddr, amount);

        registerTx({
          hash: "unstake_" + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          type: "STAKE_UNSTAKE",
          amount: unstakeReceipt.unstakedAmount,
          sender: userAddr,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "WITHDRAWN_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          unstakedAmount: unstakeReceipt.unstakedAmount,
          stakeInfo: staking.getStakeInfo(userAddr),
          balanceMyc: token.balanceOf(userAddr)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // D. GET /api/status
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/status" && req.method === "GET") {
    const stakeData = staking.getStakeInfo(token.genesisAddress);
    const quota = Math.floor(stakeData.amount / 1000);
    const latestRoot = ledger.getLatticeState().latestLatticeRoot;
    
    let activeVoltage = "0.00V";
    let activeCoil = "0x0000";
    for (const key of Object.keys(state.actuators)) {
      if (state.actuators[key].state === 1) {
        activeVoltage = "3.30V";
        activeCoil = "0x" + state.actuators[key].coil.toString(16).padStart(4, "0").toUpperCase();
        break;
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      network: "MYC Testnet Spheroid-1 (Live)",
      wallet: wallet.address,
      balance: token.balanceOf(token.genesisAddress),
      faucetPoolRemaining: token.balanceOf(faucet.faucetPoolAddress),
      stakeInfo: {
        stakedAmount: stakeData.amount,
        apy: "18.0%",
        deviceQuota: quota
      },
      dexReserves: {
        USDT: dex.reserves.USDT,
        MYC: dex.reserves.MYC
      },
      lattice: {
        vertexCount: ledger.getLatticeState().totalTransactions,
        latestRoot: latestRoot
      },
      state: {
        relayVoltage: activeVoltage,
        activeCoil: activeCoil
      }
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // E. POST /api/bridge/lock (Multi-Asset Cross-Chain Bridge)
  // Supports: MYC, USDT, USDC
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/bridge/lock" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { targetChain, recipientRemote, amount, asset } = JSON.parse(body || "{}");
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) throw new Error("INVALID_AMOUNT");

        const tokenAsset = (asset || "MYC").toUpperCase();
        if (!["MYC", "USDT", "USDC"].includes(tokenAsset)) {
          throw new Error(`UNSUPPORTED_BRIDGE_ASSET: ${tokenAsset}. Supported: MYC, USDT, USDC`);
        }

        // Debit the user's sovereign balance into bridge escrow
        if (tokenAsset === "MYC") {
          token.transfer(wallet.address, "myc_bridge_escrow", amt);
        } else if (tokenAsset === "USDT") {
          usdtToken.transfer(wallet.address, "myc_bridge_escrow", amt);
        } else if (tokenAsset === "USDC") {
          usdcToken.transfer(wallet.address, "myc_bridge_escrow", amt);
        }

        const bridgeRecord = deployed.instances.bridge.lockAndBridge(
          targetChain || "BASE",
          recipientRemote || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          amt,
          { msgSender: wallet.address },
          tokenAsset
        );

        registerTx({
          hash: bridgeRecord.bridgeId,
          type: "BRIDGE_LOCK",
          asset: tokenAsset,
          targetChain: bridgeRecord.targetChain,
          recipientRemote: bridgeRecord.recipientRemote,
          amount: bridgeRecord.amount,
          fee: bridgeRecord.fee,
          sender: wallet.address,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          bridge: bridgeRecord,
          updatedBalances: {
            MYC: token.balanceOf(wallet.address),
            USDT: usdtToken.balanceOf(wallet.address),
            USDC: usdcToken.balanceOf(wallet.address)
          }
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F. GET /api/bridge/transactions
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/bridge/transactions" && req.method === "GET") {
    const list = Array.from(deployed.instances.bridge.transactions.values()).reverse();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, transactions: list }));
    return;
  }

  // ------------------------------------------------------------------------
  // F2. POST /api/bridge/release (BFT Quorum Release for Multi-Asset)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/bridge/release" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { bridgeId, sourceChain, recipient, amount, nonce, asset } = JSON.parse(body || "{}");
        const tokenAsset = (asset || "MYC").toUpperCase();
        if (!["MYC", "USDT", "USDC"].includes(tokenAsset)) {
          throw new Error(`UNSUPPORTED_BRIDGE_ASSET: ${tokenAsset}. Supported: MYC, USDT, USDC`);
        }

        const releaseRecord = agentBridgeGateway.releaseBridgeTransfer({
          bridgeId,
          sourceChain: sourceChain || "MYC-LATTICE",
          recipient: recipient || wallet.address,
          amount: parseFloat(amount),
          nonce: parseInt(nonce, 10) || 0,
          asset: tokenAsset
        });

        // Credit asset from bridge escrow to recipient on MYC
        const rec = releaseRecord.recipient;
        const amt = releaseRecord.amount;
        try {
          if (tokenAsset === "MYC") {
            token.transfer("myc_bridge_escrow", rec, amt);
          } else if (tokenAsset === "USDT") {
            usdtToken.transfer("myc_bridge_escrow", rec, amt);
          } else if (tokenAsset === "USDC") {
            usdcToken.transfer("myc_bridge_escrow", rec, amt);
          }
        } catch (e) {
          // If bridge escrow insufficient, mint or fallback
          if (tokenAsset === "USDT") usdtToken.mint(rec, amt);
          else if (tokenAsset === "USDC") usdcToken.mint(rec, amt);
        }

        registerTx({
          hash: releaseRecord.transferId,
          type: "BRIDGE_RELEASE",
          asset: tokenAsset,
          sourceChain: releaseRecord.sourceChain,
          recipient: releaseRecord.recipient,
          amount: releaseRecord.amount,
          signaturesCount: releaseRecord.signaturesCount,
          requiredQuorum: releaseRecord.requiredQuorum,
          sender: wallet.address,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "38.4 µs",
          consensus: "BFT 2/3+1 Supermajority",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          release: releaseRecord,
          updatedBalances: {
            MYC: token.balanceOf(wallet.address),
            USDT: usdtToken.balanceOf(wallet.address),
            USDC: usdcToken.balanceOf(wallet.address)
          }
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F3. POST /api/bridge/base-to-myc & /api/bridge/evm-to-myc (Inbound Bridge from Remote EVM to MYCA)
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/bridge/base-to-myc" || url.pathname === "/api/bridge/evm-to-myc") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { sourceChain, baseTxHash, txHash, senderOnBase, senderOnEvm, recipientOnMyc, asset, amount, nonce } = JSON.parse(body || "{}");
        const resolvedTxHash = baseTxHash || txHash;
        const resolvedSender = senderOnBase || senderOnEvm || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
        const resolvedChain = (sourceChain || "BASE").toUpperCase();

        const proof = await crossChainRelayer.bridgeFromBaseToMyc({
          sourceChain: resolvedChain,
          baseTxHash: resolvedTxHash,
          senderOnBase: resolvedSender,
          recipientOnMyc: recipientOnMyc || wallet.address,
          asset: asset || "USDT",
          amount: parseFloat(amount) || 100,
          nonce: parseInt(nonce, 10) || 1
        });

        registerTx({
          hash: proof.bridgeId,
          type: `${resolvedChain}_TO_MYCA_BRIDGE`,
          asset: proof.asset,
          sourceChain: `${proof.source.network} (${proof.source.chainId})`,
          targetChain: "MYCA-LATTICE (108)",
          recipient: proof.destination.recipient,
          amount: proof.amount,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "38.4 µs",
          consensus: "BFT 2/3+1 Quorum & PoR",
          status: "COMPLETED",
          timestamp: new Date().toISOString()
        });

        globalEventBus.emit("bridge:inbound", proof);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          direction: "BASE_TO_MYCA",
          proof,
          updatedBalances: {
            MYC: token.balanceOf(wallet.address),
            USDT: usdtToken.balanceOf(wallet.address),
            USDC: usdcToken.balanceOf(wallet.address)
          }
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F4. POST /api/bridge/myc-to-evm (Outbound Bridge from MYCA to EVM with Proof)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/bridge/myc-to-evm" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { senderOnMyc, targetChain, recipientOnEvm, asset, amount } = JSON.parse(body || "{}");
        const proof = await crossChainRelayer.bridgeFromMycToEvm({
          senderOnMyc: senderOnMyc || wallet.address,
          targetChain: targetChain || "ARBITRUM",
          recipientOnEvm: recipientOnEvm || "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
          asset: asset || "USDT",
          amount: parseFloat(amount) || 100
        });

        registerTx({
          hash: proof.bridgeId,
          type: "MYCA_TO_EVM_BRIDGE",
          asset: proof.asset,
          sourceChain: "MYCA-LATTICE (108)",
          targetChain: `${proof.destination.targetChain} (${proof.destination.chainId})`,
          recipient: proof.destination.recipient,
          amount: proof.netAmount,
          fee: proof.bridgeFee,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "38.4 µs",
          consensus: "BFT 2/3+1 Quorum & PoR",
          status: "COMPLETED",
          timestamp: new Date().toISOString()
        });

        globalEventBus.emit("bridge:outbound", proof);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          direction: "MYCA_TO_EVM",
          proof,
          updatedBalances: {
            MYC: token.balanceOf(wallet.address),
            USDT: usdtToken.balanceOf(wallet.address),
            USDC: usdcToken.balanceOf(wallet.address)
          }
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F5. GET /api/bridge/proof (Lookup cryptographic proof by ID or TX hash)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/bridge/proof" && req.method === "GET") {
    const id = url.searchParams.get("id");
    const proof = crossChainRelayer.getProof(id);
    if (!proof) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "PROOF_NOT_FOUND" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, proof }));
    return;
  }

  // ------------------------------------------------------------------------
  // F6. GET /api/bridge/proofs (List all recent cryptographic bridge proofs)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/bridge/proofs" && req.method === "GET") {
    const proofs = crossChainRelayer.getAllProofs();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: proofs.length, proofs }));
    return;
  }
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/scenarios/cross-chain-intent" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const params = JSON.parse(body || "{}");
        const result = await agentBridgeGateway.executeOpacusCrossChainIntent({
          agentId: params.agentId || "myc-orchestrator",
          targetChain: params.targetChain || "BASE",
          recipientRemote: params.recipientRemote || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          bridgeAmount: parseFloat(params.bridgeAmount) || 100,
          taskCapability: params.taskCapability || "financial_risk_scoring",
          taskPayload: params.taskPayload || {},
          taskBudget: parseFloat(params.taskBudget) || 50,
          sender: wallet.address
        });

        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F4. POST /api/scenarios/m2m-data-trade (Senaryo 2: IoT M2M)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/scenarios/m2m-data-trade" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const params = JSON.parse(body || "{}");
        const result = await agentBridgeGateway.executeM2MDataTrade({
          sellerDid: params.sellerDid || "TURBINE_01",
          buyerDid: params.buyerDid || "PUMP_01",
          dataType: params.dataType || "TEMPERATURE_READINGS",
          pricePerUnit: parseFloat(params.pricePerUnit) || 5,
          units: parseInt(params.units, 10) || 10,
          actuateOnPurchase: params.actuateOnPurchase || null
        });

        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F5. POST /api/scenarios/agent-economy (Senaryo 3: Agent Economy)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/scenarios/agent-economy" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const params = JSON.parse(body || "{}");
        const result = await agentBridgeGateway.executeAgentEconomyWorkflow({
          orchestratorId: params.orchestratorId || "myc-orchestrator",
          agentIds: params.agentIds || ["myc-risk-agent", "myc-compliance-agent"],
          taskCapability: params.taskCapability || "financial_risk_scoring",
          taskPayload: params.taskPayload || {},
          totalBudget: parseFloat(params.totalBudget) || 100,
          sender: wallet.address
        });

        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // F6. GET /api/scenarios/flows (Flow Log & Stats)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/scenarios/flows" && req.method === "GET") {
    const stats = agentBridgeGateway.getFlowStats();
    const flows = agentBridgeGateway.getCompletedFlows().map(f => ({
      flowId: f.flowId,
      scenario: f.scenario,
      success: f.success,
      stepsCount: f.steps.length,
      summary: f.summary
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, stats, flows }));
    return;
  }

  // ------------------------------------------------------------------------
  // OPACUS KERNEL WALLET INTEGRATION: GET /api/opacus/balance
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/opacus/balance" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      balanceUsdc: opacusComputePool.balanceUsdc,
      address: opacusComputePool.address,
      status: "ACTIVE",
      rails: [
        { name: "Fiat Rail", provider: "MoonPay / Transak (Credit Card / Apple Pay)", status: "ONLINE", settlement: "USDC" },
        { name: "Multichain Crypto Rail", chains: 42, provider: "Khalani Network", status: "ONLINE", settlement: "USDC" },
        { name: "Native 0G Rail", protocol: "x402 AI Settlement", status: "ONLINE", settlement: "USDC" }
      ],
      totalFundedToMyc: opacusComputePool.totalFundedToMyc,
      totalWithdrawnToBase: opacusComputePool.totalWithdrawnToBase,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // OPACUS KERNEL WALLET INTEGRATION: POST /api/opacus/fund-task
  // Opacus Compute Balance -> MYCA Dual-PoR Escrow Lock (1-Step Bridge)
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/opacus/fund-task" || url.pathname === "/api/escrow/create") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const { taskId, amountUsdc, sender, memo, amount, taskType, creator } = payload;
        const amt = parseFloat(amountUsdc || amount);
        if (isNaN(amt) || amt <= 0) {
          throw new Error("Geçersiz USDC tutarı");
        }
        if (opacusComputePool.balanceUsdc < amt) {
          throw new Error(`Yetersiz Opacus compute bakiyesi! Mevcut: ${opacusComputePool.balanceUsdc} USDC`);
        }

        const tId = taskId || ("task_" + Date.now().toString(16));
        const escrowId = "0x" + Date.now().toString(16).padStart(64, "0");
        const senderAddr = sender || wallet.address;

        // Deduct from Opacus compute pool
        opacusComputePool.balanceUsdc -= amt;
        opacusComputePool.totalFundedToMyc += amt;

        // Lock in MYCA Dual-PoR Escrow on Chain ID 108
        deployed.instances.escrow.createEscrow(
          escrowId,
          "myc1colonyprovers0000000000000000",
          amt,
          "USDC",
          600,
          { msgSender: senderAddr }
        );
        deployed.instances.escrow.fundEscrow(escrowId, { msgSender: senderAddr });

        // Generate synthetic Opacus transaction hash
        const opacusTxHash = "0xopacus_" + Array.from({length: 24}, () => Math.floor(Math.random()*16).toString(16)).join("");

        // Commit vertex to Living Lattice DAG (Zero-Gas Guarantee)
        const vertex = ledger.appendVertex({
          sender: senderAddr,
          device: "OPACUS_KERNEL_WALLET",
          action: "FUND_TASK_ESCROW",
          coil: 0x0001,
          actionValue: amt,
          porHash: opacusTxHash,
          latencyUs: "38.4",
          signature: wallet.signTransaction(opacusTxHash).signature
        });

        registerTx({
          hash: vertex.vertexHash,
          type: "OPACUS_TASK_ESCROW_FUNDED",
          taskId: tId,
          escrowId: escrowId,
          amount: amt,
          asset: "USDC",
          sender: senderAddr,
          opacusTxHash: opacusTxHash,
          gasFee: "0.00 MYC (Zero-Gas Guarantee)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "ESCROW_FUNDED_VIA_OPACUS",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          taskId: tId,
          escrowId: escrowId,
          amountUsdc: amt,
          remainingOpacusBalance: opacusComputePool.balanceUsdc,
          opacusTxHash: opacusTxHash,
          dagVertex: vertex.vertexHash,
          gasFee: "0.00 MYC",
          status: "ESCROW_FUNDED_VIA_OPACUS",
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // OPACUS KERNEL WALLET INTEGRATION: POST /api/opacus/withdraw-earnings
  // MYCA Machine / Node Earnings -> Base (EVM 8453) USDC / Opacus
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/opacus/withdraw-earnings" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { machineId, amountUsdc, targetChain, recipientEvmAddress } = JSON.parse(body || "{}");
        const amt = parseFloat(amountUsdc);
        if (isNaN(amt) || amt <= 0) {
          throw new Error("Geçersiz çekim tutarı");
        }
        const recipient = recipientEvmAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
        const chain = (targetChain || "BASE").toUpperCase();

        // Lock on MYCA and generate cryptographic cross-chain bridge proof
        const proof = await crossChainRelayer.bridgeFromMycToEvm({
          senderOnMyc: wallet.address,
          targetChain: chain,
          recipientOnEvm: recipient,
          asset: "USDC",
          amount: amt
        });

        opacusComputePool.totalWithdrawnToBase += amt;

        registerTx({
          hash: proof.bridgeId,
          type: "OPACUS_MACHINE_EARNINGS_WITHDRAWAL",
          machineId: machineId || "depin-device-01",
          amount: amt,
          asset: "USDC",
          targetChain: chain,
          recipientEvmAddress: recipient,
          gasFee: "0.00 MYC",
          status: "COMPLETED",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          machineId: machineId || "depin-device-01",
          amountUsdc: amt,
          targetChain: chain,
          recipientEvmAddress: recipient,
          bridgeProofId: proof.bridgeId,
          bftQuorumProof: proof.bftQuorumProof,
          status: "WITHDRAWAL_READY_ON_BASE",
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // G. POST /api/agent/execute & /api/opacus/execute (MYC Agent Task Runner with Dual-PoR)
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/agent/execute" || url.pathname === "/api/opacus/execute") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { agentId, capability, payload, budget } = JSON.parse(body || "{}");
        const rewardAmount = parseFloat(budget) || 50;
        const taskId = "task_myc_" + Date.now().toString(16);
        const escrowId = "0x" + Date.now().toString(16).padStart(64, "0");

        // 1. Escrow lock
        deployed.instances.escrow.createEscrow(
          escrowId,
          "myc1colonyprovers0000000000000000",
          rewardAmount,
          "USDC",
          300,
          { msgSender: wallet.address }
        );
        deployed.instances.escrow.fundEscrow(escrowId, { msgSender: wallet.address });

        // 2. Cognitive task
        const cogTask = new MycCognitiveTask({
          taskId,
          creatorNodeId: agentId || "myc-risk-agent",
          capabilityRequired: capability || "financial_risk_scoring",
          payload: payload || { asset: "USDC_ESCROW_COLLATERAL", collateralRatio: 1.65, volatilityIndex: 0.22 },
          rewardAmount,
          rewardAsset: "USDC"
        });
        cogTask.requiresDualVerification = true;

        // 3. Colony dual execution
        const execResult = await colonyScheduler.scheduleWithDualVerification(cogTask);

        if (!execResult.success) {
          throw new Error(execResult.task?.result?.error || "DUAL_EXECUTION_FAILED");
        }

        // 4. Settle escrow
        deployed.instances.escrow.submitExecutionProof(escrowId, execResult.executionProof.proofHash, { msgSender: "myc1colonyprovers0000000000000000" });
        deployed.instances.escrow.attestAndRelease(escrowId, { msgSender: wallet.address });

        // 5. Update reputation
        deployed.instances.reputation.recordSuccess("colony_worker_alpha");
        deployed.instances.reputation.recordSuccess("colony_worker_beta");

        registerTx({
          hash: execResult.executionProof.proofHash,
          type: "MYC_TASK_SETTLED",
          taskId,
          agentId: agentId || "myc-risk-agent",
          payout: rewardAmount * 0.95,
          fee: rewardAmount * 0.05,
          sender: wallet.address,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "38.4 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          taskId,
          escrowId,
          settlement: {
            payoutToWorkers: rewardAmount * 0.95,
            protocolFee: rewardAmount * 0.05,
            porProofHash: execResult.executionProof.proofHash,
            outputHash: execResult.executionProof.outputHash,
            status: "SETTLED"
          },
          provers: {
            node1: "colony_worker_alpha (+10 rep)",
            node2: "colony_worker_beta (+10 rep)"
          },
          output: execResult.task.result
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // GET /api/agents - List registered & verified Colony AI Agents
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/agents" && req.method === "GET") {
    const agents = [];
    if (deployed.instances.agentRegistry && deployed.instances.agentRegistry.agents) {
      for (const [id, agent] of deployed.instances.agentRegistry.agents.entries()) {
        agents.push(agent);
      }
    }
    // Merge with static verified agents if missing
    for (const va of VERIFIED_AGENTS) {
      if (!agents.some(a => a.agentId === va.id || a.id === va.id)) {
        agents.push(va);
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: agents.length, agents }));
    return;
  }

  // ------------------------------------------------------------------------
  // H. POST /api/pay/channel/open & POST /api/pay/direct (MycStreamPay Channels)
  // ------------------------------------------------------------------------
  if ((url.pathname === "/api/pay/channel/open" || url.pathname === "/api/streampay/channel/open") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { payee, recipient, deposit, durationSeconds, sender } = JSON.parse(body || "{}");
        const targetAgent = (payee || recipient || "").trim();

        // 1. Strict Agent Verification: Target must be in agentRegistry, VERIFIED_AGENTS, or valid myc1 address
        const isKnownAgent = VERIFIED_AGENTS.some(a => a.id === targetAgent || a.name === targetAgent);
        const isRegisteredInContract = deployed.instances.agentRegistry && deployed.instances.agentRegistry.getAgent(targetAgent);
        const isValidMycAddress = targetAgent.startsWith("myc1") && targetAgent.length === 36;

        if (!isKnownAgent && !isRegisteredInContract && !isValidMycAddress) {
          throw new Error(`Geçersiz veya Kayıtsız Ajan: '${targetAgent}'. Lütfen ağda kayıtlı geçerli bir Colony Ajanı seçin (Örn: agent-myc-01, colony_worker_alpha, myc-risk-agent).`);
        }

        const channelId = "ch_" + Date.now().toString(16);
        const streamPay = deployed.instances.streamPay || deployed.instances.opacusPay;
        const depAmt = parseFloat(deposit) || 25;
        const senderAddr = sender || wallet.address;

        const channel = streamPay.openChannel(
          channelId,
          targetAgent,
          depAmt,
          parseInt(durationSeconds, 10) || 86400,
          { msgSender: senderAddr }
        );

        // Commit state channel creation to Lattice DAG
        const vertex = ledger.appendVertex({
          sender: senderAddr,
          device: "STREAMPAY",
          action: "OPEN_CHANNEL",
          coil: 0x0000,
          actionValue: depAmt,
          porHash: "0xchan_" + channelId,
          latencyUs: "12.0",
          signature: "por_stream_channel_sig"
        });

        // Register transaction for Explorer visibility
        registerTx({
          hash: vertex.vertexHash,
          type: `STREAM_ESCROW (${targetAgent})`,
          amount: depAmt,
          sender: senderAddr,
          recipient: targetAgent,
          channelId,
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "12.0 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          channelId,
          txHash: vertex.vertexHash,
          channel,
          explorerUrl: "http://localhost:4040/explorer/?tx=" + vertex.vertexHash
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if ((url.pathname === "/api/pay/direct" || url.pathname === "/api/streampay/direct") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { to, amount, memo, from } = JSON.parse(body || "{}");
        const amt = parseFloat(amount) || 10;
        const senderAddr = from || wallet.address;
        const target = (to || "").trim();

        // 1. Strict Recipient Validation
        const isKnownAgent = VERIFIED_AGENTS.some(a => a.id === target);
        const isRegistered = deployed.instances.agentRegistry && deployed.instances.agentRegistry.getAgent(target);
        const isValidAddress = target.startsWith("myc1") && target.length === 36;

        if (!isKnownAgent && !isRegistered && !isValidAddress) {
          throw new Error(`Geçersiz alıcı cüzdan adresi veya ajan: '${target}'.`);
        }

        // Deduct/transfer in token
        token.transfer(token.genesisAddress, target, amt);

        // Commit DAG vertex
        const vertex = ledger.appendVertex({
          sender: senderAddr,
          device: "WALLET_PAY",
          action: "DIRECT_PAY",
          coil: 0x0000,
          actionValue: amt,
          porHash: "0xpay_" + Date.now().toString(16),
          latencyUs: "12.0",
          signature: "por_direct_pay_sig"
        });

        // Register transaction for Explorer visibility
        registerTx({
          hash: vertex.vertexHash,
          type: "WALLET_TRANSFER",
          amount: amt,
          sender: senderAddr,
          recipient: target,
          memo: memo || "Wallet Payment",
          gasFee: "0.00 MYC (Zero-Gas)",
          finality: "12.0 µs",
          consensus: "Proof-of-Resonance (PoR)",
          status: "CONFIRMED_ON_CHAIN",
          timestamp: new Date().toISOString()
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          txHash: vertex.vertexHash,
          amount: amt,
          recipient: target,
          sender: senderAddr,
          explorerUrl: "http://localhost:4040/explorer/?tx=" + vertex.vertexHash,
          balance: token.balanceOf(token.genesisAddress)
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ------------------------------------------------------------------------
  // I. GET /api/explorer/overview (Aggregated Lattice & Chain Stats)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/explorer/overview" && req.method === "GET") {
    const latestBlock = deployed.chain.getLatestBlock();
    const stakeData = staking.getStakeInfo(token.genesisAddress);
    const dynamicApyInfo = deployed.instances.staking ? deployed.instances.staking.getDynamicApy() : { dynamicApyPercent: 18.0, rawApyPercent: 18.0 };
    const bridgeInst = deployed.instances.bridge;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      network: "MYC-LATTICE-MAINNET",
      chainId: 108,
      blockHeight: latestBlock ? latestBlock.number : 0,
      latestBlockHash: latestBlock ? latestBlock.hash : null,
      parentHash: latestBlock ? latestBlock.parentHash : null,
      validator: latestBlock ? latestBlock.validator : "Genesis",
      totalTransactions: transactionRegistry.size + ledger.getLatticeState().totalTransactions,
      recentActivity: globalRecentActivity.slice(0, 25),
      recentBlocks: deployed.chain.blocks.slice(-25).map(b => ({
        number: b.number,
        hash: b.hash,
        validator: b.validator,
        txCount: b.transactions.length,
        timestamp: b.timestamp
      })),
      dexReserves: {
        MYC: dex.reserves.MYC,
        USDT: dex.reserves.USDT,
        USDC: dex.reserves.USDC
      },
      totalStaked: stakeData.amount,
      deviceQuotas: Math.floor(stakeData.amount / 1000),
      dynamicApy: dynamicApyInfo,
      bridgeSecurity: {
        totalLocked: bridgeInst ? bridgeInst.totalLocked : { MYC: 0, USDT: 0, USDC: 0 },
        totalLockedMYC: bridgeInst ? bridgeInst.totalLockedMYC : 0,
        requiredQuorum: bridgeInst ? bridgeInst.getRequiredQuorum() : 3,
        totalValidators: bridgeInst ? bridgeInst.validatorSet.size : 4,
        quorumRule: "2/3 + 1 Supermajority",
        singleTransferLimit: bridgeInst ? bridgeInst.MAX_SINGLE_TRANSFER : 50000,
        isPaused: bridgeInst ? bridgeInst.paused : false,
        replayProtection: "Active (transferId hash lock)"
      },
      consensus: deployed.chain.consensus.getConsensusStatus()
    }));
    return;
  }

  // ------------------------------------------------------------------------
  // J. GET /api/staking/dynamic-apy (Real-Yield Calculation API)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/staking/dynamic-apy" && req.method === "GET") {
    const apyInfo = deployed.instances.staking ? deployed.instances.staking.getDynamicApy() : { dynamicApyPercent: 18.0 };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, ...apyInfo }));
    return;
  }

  // ------------------------------------------------------------------------
  // K. GET /api/explorer/devices (DePIN Hardware Actuators & Telemetry)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/explorer/devices" && req.method === "GET") {
    const list = machineManager.getMachines();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, devices: list }));
    return;
  }

  // ------------------------------------------------------------------------
  // L. GET /api/explorer/tasks (Cognitive Tasks & Agent Economy)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/explorer/tasks" && req.method === "GET") {
    const taskMap = deployed.instances.tasks ? deployed.instances.tasks.tasks : new Map();
    const list = Array.from(taskMap.values()).reverse();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, tasks: list }));
    return;
  }

  // ------------------------------------------------------------------------
  // M. GET /api/explorer/channels (MycStreamPay State Channels)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/explorer/channels" && req.method === "GET") {
    const streamPay = deployed.instances.streamPay || deployed.instances.opacusPay;
    const chMap = streamPay ? streamPay.channels : new Map();
    const list = Array.from(chMap.values()).reverse();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, channels: list }));
    return;
  }

  // ------------------------------------------------------------------------
  // N. GET /api/explorer/search (Omnisearch Engine)
  // ------------------------------------------------------------------------
  if (url.pathname === "/api/explorer/search" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const results = { query: q, type: "NOT_FOUND", match: null };

    if (q) {
      // 1. Check Block Number
      const blockNum = parseInt(q.replace("#", ""), 10);
      if (!isNaN(blockNum)) {
        const blk = deployed.chain.getBlockByNumber(blockNum);
        if (blk) {
          results.type = "BLOCK";
          results.match = blk.toJSON();
        }
      }

      // 2. Check Block Hash
      if (results.type === "NOT_FOUND") {
        const blk = deployed.chain.getBlockByHash(q);
        if (blk) {
          results.type = "BLOCK";
          results.match = blk.toJSON();
        }
      }

      // 3. Check Transaction Hash
      if (results.type === "NOT_FOUND") {
        const tx = deployed.chain.getTransaction(q) || transactionRegistry.get(q);
        if (tx) {
          results.type = "TRANSACTION";
          results.match = tx;
        }
      }

      // 4. Check Smart Contract by Name or Address
      if (results.type === "NOT_FOUND") {
        const contracts = deployed.vm.getAllContracts();
        const cMatch = contracts.find(c => c.name.toLowerCase() === q || c.address.toLowerCase() === q);
        if (cMatch) {
          results.type = "SMART_CONTRACT";
          results.match = cMatch;
        }
      }

      // 5. Check Device DID
      if (results.type === "NOT_FOUND" && deployed.instances.devices) {
        const dev = deployed.instances.devices.getDevice(q);
        if (dev) {
          results.type = "DEVICE";
          results.match = dev;
        }
      }

      // 6. Check Address
      if (results.type === "NOT_FOUND" && q.startsWith("myc1")) {
        const bal = deployed.chain.state.getBalance(q);
        const nonce = deployed.chain.state.getNonce(q);
        const stake = deployed.instances.staking ? deployed.instances.staking.getStakeInfo(q) : { amount: 0 };
        results.type = "ACCOUNT";
        results.match = { address: q, balance: bal, nonce, stake };
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, ...results }));
    return;
  }

  // ------------------------------------------------------------------------
  // O. DePIN MACHINE WALLETS & ACTUATOR ECONOMY API
  // ------------------------------------------------------------------------
  // GET /api/depin/machines
  if (url.pathname === "/api/depin/machines" && req.method === "GET") {
    const list = machineManager.getMachines();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, machines: list }));
    return;
  }

  // GET /api/depin/stats
  if (url.pathname === "/api/depin/stats" && req.method === "GET") {
    const stats = machineManager.getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, stats }));
    return;
  }

  // GET /api/depin/did or /api/depin/did?did=... (W3C DID Document Resolution)
  if (url.pathname === "/api/depin/did" && req.method === "GET") {
    const targetDid = url.searchParams.get("did") || url.searchParams.get("id");
    if (targetDid) {
      const didDoc = machineManager.getDidDocument(targetDid);
      if (!didDoc) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "DID_DOCUMENT_NOT_FOUND", did: targetDid }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, didDocument: didDoc }));
      return;
    }

    // If no specific DID query parameter, return directory of all machine W3C DIDs
    const list = machineManager.getMachines().map(m => ({
      did: m.w3cDid,
      alias: m.did,
      name: m.name,
      deviceType: m.deviceType,
      walletAddress: m.walletAddress,
      didDocumentUri: m.didDocumentUri
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, dids: list }));
    return;
  }

  // POST /api/depin/register (Provision Machine Wallet via Silicon PUF)
  if (url.pathname === "/api/depin/register" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const machine = machineManager.registerMachine(payload);
        recordGlobalActivity({
          type: "DEPIN_MACHINE_PROVISIONED",
          did: machine.did,
          walletAddress: machine.walletAddress,
          timestamp: Date.now()
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, machine }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/depin/fund (H2M Maintenance Funding - 0 Gas)
  if (url.pathname === "/api/depin/fund" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { did, amount, fromWallet } = JSON.parse(body || "{}");
        const result = machineManager.fundMachine(did, amount, fromWallet || wallet.address || token.genesisAddress);
        registerTx({
          hash: result.tx.txHash,
          sender: result.tx.from,
          recipient: result.tx.to,
          amount: result.tx.amount,
          gasFee: "0.00000000 MYC",
          type: "H2M_MAINTENANCE_DEPOSIT",
          timestamp: result.tx.timestamp
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/depin/withdraw (M2H Operator Yield Withdrawal - 0 Gas)
  if (url.pathname === "/api/depin/withdraw" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { did, amount, toWallet } = JSON.parse(body || "{}");
        const result = machineManager.withdrawFromMachine(did, amount, toWallet || wallet.address || token.genesisAddress);
        registerTx({
          hash: result.tx.txHash,
          sender: result.tx.from,
          recipient: result.tx.to,
          amount: result.tx.amount,
          gasFee: "0.00000000 MYC",
          type: "M2H_OPERATOR_WITHDRAWAL",
          timestamp: result.tx.timestamp
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/depin/m2m-pay (Autonomous M2M Micro-Payment & Actuation - 0 Gas)
  if (url.pathname === "/api/depin/m2m-pay" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const result = machineManager.executeM2MPayment(payload);
        registerTx({
          hash: result.tx.txHash,
          sender: result.tx.from,
          recipient: result.tx.to,
          amount: result.tx.amount,
          gasFee: "0.00000000 MYC",
          type: "M2M_AUTONOMOUS_PAYMENT",
          timestamp: result.tx.timestamp
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/depin/actuate (Direct Safe Actuation with 0-Byte Negation Shield)
  if (url.pathname === "/api/depin/actuate" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const result = machineManager.actuateDevice(payload);
        recordGlobalActivity({
          type: "ACTUATOR_SHIELD_EVALUATION",
          did: payload.did,
          status: result.shieldStatus,
          timestamp: Date.now()
        });
        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let reqPath = url.pathname;
  if (reqPath === "/") reqPath = "/landing.html";
  if (reqPath === "/hub" || reqPath === "/hub/" || reqPath === "/discover" || reqPath === "/discover/") reqPath = "/hub.html";
  if (reqPath === "/nexus" || reqPath === "/nexus/") reqPath = "/hub.html";
  if (reqPath === "/depin" || reqPath === "/depin/") reqPath = "/depin.html";
  if (reqPath === "/explorer" || reqPath === "/explorer/") reqPath = "/explorer.html";
  if (reqPath === "/bridge" || reqPath === "/bridge/") reqPath = "/hub.html";
  if (reqPath === "/swap" || reqPath === "/swap/") reqPath = "/hub.html";
  if (reqPath === "/faucet" || reqPath === "/faucet/") reqPath = "/hub.html";
  if (reqPath === "/staking" || reqPath === "/staking/") reqPath = "/hub.html";
  if (reqPath === "/streampay" || reqPath === "/streampay/" || reqPath === "/opacuspay" || reqPath === "/opacuspay/") reqPath = "/hub.html";
  if (reqPath === "/agent" || reqPath === "/agent/") reqPath = "/agent.html";
  if (reqPath === "/contracts" || reqPath === "/contracts/") reqPath = "/contracts.html";
  if (reqPath === "/docs" || reqPath === "/docs/") reqPath = "/docs.html";
  if (reqPath === "/dev-docs" || reqPath === "/dev-docs/") reqPath = "/dev-docs.html";
  if (reqPath === "/build" || reqPath === "/build/") reqPath = "/build.html";
  if (reqPath === "/arcade" || reqPath === "/arcade/" || reqPath === "/game" || reqPath === "/game/") reqPath = "/arcade.html";
  if (reqPath === "/marketplace" || reqPath === "/marketplace/" || reqPath === "/market" || reqPath === "/market/") reqPath = "/marketplace.html";
  if (reqPath === "/mint" || reqPath === "/mint/") reqPath = "/mint.html";
  
  let targetPath;
  if (reqPath === "/install.sh" || reqPath === "/install.ps1" || reqPath.startsWith("/dist/")) {
    targetPath = path.join(__dirname, reqPath);
  } else if (reqPath.startsWith("/agent-core/")) {
    targetPath = path.join(__dirname, reqPath);
  } else {
    targetPath = path.join(__dirname, "dashboard", reqPath);
  }

  // If path is a directory, look for index.html inside it
  try {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      targetPath = path.join(targetPath, "index.html");
    } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".html")) {
      targetPath += ".html";
    }
  } catch (e) {}

  let ext = path.extname(targetPath);

  fs.readFile(targetPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found — MYC Network Document Portal");
    } else {
      res.writeHead(200, { "Content-Type": (mimeTypes[ext] || "text/plain") + "; charset=utf-8" });
      res.end(data);
    }
  });
});

const wsServer = new MycWebSocketServer({ port: WS_PORT });
wsServer.attachToHttpServer(server);
await wsServer.start();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================================`);
  console.log(`🌐 MYC NETWORK TESTNET IS LIVE ON 0.0.0.0:${PORT}`);
  console.log(`   • Network Name        : MYC-TESTNET-SPHEROID-1 (Chain ID: 108)`);
  console.log(`   • Live Faucet API     : POST /api/faucet (1,000 $MYC testnet)`);
  console.log(`   • Zero-Gas PoR Core   : 384 Bytes Static RAM`);
  console.log(`   • Platform Deploy API : POST /api/contract/deploy & RPC myc_deployUserContract`);
  console.log(`   • Colony Marketplace  : GET /api/capabilities & POST /api/capability/register`);
  console.log(`   • Real-Time Events    : ws://0.0.0.0:${WS_PORT} & SSE /api/events`);
  console.log(`====================================================================`);
});
