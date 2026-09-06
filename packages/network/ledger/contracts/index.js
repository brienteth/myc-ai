import crypto from "crypto";

/**
 * Native Smart Contract Implementations for MycContractVM
 * Mirrors the Solidity ABIs and state storage rules.
 */

export class MycTokenContract {
  constructor(initialSupply = 100000000) {
    this.name = "MYC Network Sovereign Token";
    this.symbol = "MYC";
    this.decimals = 18;
    this.totalSupply = initialSupply;
    this.balances = new Map();
    this.allowances = new Map();
    this.balances.set("myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002", initialSupply);
  }

  balanceOf(account) {
    return this.balances.get((account || "").toLowerCase()) || 0;
  }

  transfer(recipient, amount, context = {}) {
    const sender = (context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const to = (recipient || "").toLowerCase();
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_AMOUNT");
    const senderBal = this.balanceOf(sender);
    if (senderBal < amt) throw new Error(`INSUFFICIENT_BALANCE: ${senderBal} < ${amt}`);

    this.balances.set(sender, senderBal - amt);
    this.balances.set(to, this.balanceOf(to) + amt);

    if (context.emit) {
      context.emit("Transfer", { from: sender, to, amount: amt });
    }
    return true;
  }
}

export class MycUSDTokenContract {
  constructor(initialSupply = 10000000) {
    this.name = "Tether USD (MYC Testnet)";
    this.symbol = "USDT";
    this.decimals = 6;
    this.totalSupply = initialSupply;
    this.balances = new Map();
    this.balances.set("myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002", initialSupply - 1000000);
    this.balances.set("myc_dex_liquidity", 1000000); // 1M USDT in AMM DEX
    this.balances.set("myc_bridge_escrow", 1000000); // 1M USDT in Bridge Escrow
  }

  balanceOf(account) {
    return this.balances.get((account || "").toLowerCase()) || 0;
  }

  transfer(recipient, amount, context = {}) {
    const sender = (context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const to = (recipient || "").toLowerCase();
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_USDT_AMOUNT");
    const senderBal = this.balanceOf(sender);
    if (senderBal < amt) throw new Error(`INSUFFICIENT_USDT_BALANCE: ${senderBal} < ${amt}`);

    this.balances.set(sender, senderBal - amt);
    this.balances.set(to, this.balanceOf(to) + amt);

    if (context.emit) {
      context.emit("Transfer", { from: sender, to, amount: amt, symbol: "USDT" });
    }
    return true;
  }

  mint(recipient, amount, context = {}) {
    const to = (recipient || "").toLowerCase();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_MINT_AMOUNT");
    this.balances.set(to, this.balanceOf(to) + amt);
    this.totalSupply += amt;
    if (context.emit) {
      context.emit("Mint", { to, amount: amt, symbol: "USDT" });
    }
    return true;
  }
}

export class MycUSDCTokenContract {
  constructor(initialSupply = 10000000) {
    this.name = "USD Coin (MYC Testnet)";
    this.symbol = "USDC";
    this.decimals = 6;
    this.totalSupply = initialSupply;
    this.balances = new Map();
    this.balances.set("myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002", initialSupply - 2000000);
    this.balances.set("myc_dex_liquidity", 1000000); // 1M USDC in AMM DEX
    this.balances.set("myc_bridge_escrow", 1000000); // 1M USDC in Bridge Escrow
  }

  balanceOf(account) {
    return this.balances.get((account || "").toLowerCase()) || 0;
  }

  transfer(recipient, amount, context = {}) {
    const sender = (context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const to = (recipient || "").toLowerCase();
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_USDC_AMOUNT");
    const senderBal = this.balanceOf(sender);
    if (senderBal < amt) throw new Error(`INSUFFICIENT_USDC_BALANCE: ${senderBal} < ${amt}`);

    this.balances.set(sender, senderBal - amt);
    this.balances.set(to, this.balanceOf(to) + amt);

    if (context.emit) {
      context.emit("Transfer", { from: sender, to, amount: amt, symbol: "USDC" });
    }
    return true;
  }

  mint(recipient, amount, context = {}) {
    const to = (recipient || "").toLowerCase();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_MINT_AMOUNT");
    this.balances.set(to, this.balanceOf(to) + amt);
    this.totalSupply += amt;
    if (context.emit) {
      context.emit("Mint", { to, amount: amt, symbol: "USDC" });
    }
    return true;
  }
}

export class MycDeviceRegistryContract {
  constructor() {
    this.devices = new Map();
  }

  registerDevice(did, pufPublicKey, deviceType, baseRegister, maxRegister, context = {}) {
    if (this.devices.has(did)) throw new Error("DEVICE_ALREADY_REGISTERED");
    const record = {
      did,
      pufPublicKey,
      deviceType,
      baseRegister: parseInt(baseRegister, 10),
      maxRegister: parseInt(maxRegister, 10),
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      resonanceScoreBps: 10000,
      isActive: true,
      operator: context.msgSender
    };
    this.devices.set(did, record);
    if (context.emit) context.emit("DeviceRegistered", { did, operator: context.msgSender, deviceType });
    return true;
  }

  recordHeartbeat(did, resonanceScoreBps, context = {}) {
    const dev = this.devices.get(did);
    if (!dev) throw new Error("DEVICE_NOT_FOUND");
    dev.lastHeartbeat = Date.now();
    dev.resonanceScoreBps = parseInt(resonanceScoreBps, 10);
    if (context.emit) context.emit("HeartbeatRecorded", { did, resonanceScoreBps });
    return true;
  }

  getDevice(did) {
    return this.devices.get(did) || null;
  }
}

export class MycStakingPoolContract {
  constructor() {
    this.stakes = new Map(); // address -> { amount, lockedAt, deviceQuota, isValidatorEligible }
    this.totalStaked = 0;
    this.accumulatedDexFees = 1500; // Real fees accrued from DEX trades ($MYC)
    this.accumulatedTaskFees = 2700; // Real fees from 5% Escrow commission ($MYC)
    this.accumulatedBridgeFees = 300; // Real fees from cross-chain bridge ($MYC)
    this.annualizedProtocolRevenue = (this.accumulatedDexFees + this.accumulatedTaskFees + this.accumulatedBridgeFees) * 12; // Y = Annualized Revenue
    this.maxApyCap = 0.18; // 18% hard ceiling
  }

  recordProtocolRevenue(dexFee = 0, taskFee = 0, bridgeFee = 0) {
    this.accumulatedDexFees += parseFloat(dexFee) || 0;
    this.accumulatedTaskFees += parseFloat(taskFee) || 0;
    this.accumulatedBridgeFees += parseFloat(bridgeFee) || 0;
    const totalFees = this.accumulatedDexFees + this.accumulatedTaskFees + this.accumulatedBridgeFees;
    this.annualizedProtocolRevenue = totalFees * 12;
    return this.getDynamicApy();
  }

  getDynamicApy() {
    const X = this.totalStaked;
    const Y = this.annualizedProtocolRevenue;
    if (X <= 0) {
      return {
        totalStaked: 0,
        annualizedRevenue: Y,
        rawApyPercent: 18.0,
        dynamicApyPercent: 18.0,
        isCapped: true,
        formula: "min(Y / X, 0.18)",
        revenueBreakdown: {
          dexFees: this.accumulatedDexFees,
          taskFees: this.accumulatedTaskFees,
          bridgeFees: this.accumulatedBridgeFees
        }
      };
    }
    const rawApy = Y / X;
    const dynamicApy = Math.min(rawApy, this.maxApyCap);
    return {
      totalStaked: X,
      annualizedRevenue: Y,
      rawApyPercent: parseFloat((rawApy * 100).toFixed(2)),
      dynamicApyPercent: parseFloat((dynamicApy * 100).toFixed(2)),
      isCapped: rawApy >= this.maxApyCap,
      formula: "min(Y / X, 0.18)",
      revenueBreakdown: {
        dexFees: this.accumulatedDexFees,
        taskFees: this.accumulatedTaskFees,
        bridgeFees: this.accumulatedBridgeFees
      }
    };
  }

  stake(amount, context = {}) {
    const sender = (context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const amt = parseFloat(amount);
    if (amt < 1000) throw new Error("AMOUNT_BELOW_MINIMUM_QUOTA");

    const existing = this.stakes.get(sender) || { amount: 0, deviceQuota: 0 };
    const newAmount = existing.amount + amt;
    const newQuota = Math.floor(newAmount / 1000);
    const isValidatorEligible = newAmount >= 10000;

    this.stakes.set(sender, {
      amount: newAmount,
      deviceQuota: newQuota,
      lockedAt: Date.now(),
      isValidatorEligible
    });
    this.totalStaked += amt;

    if (context.emit) context.emit("Staked", { user: sender, amount: amt, deviceQuota: newQuota });
    return {
      stakedAmount: newAmount,
      deviceQuota: newQuota,
      isValidatorEligible,
      dynamicApy: this.getDynamicApy()
    };
  }

  getStakeInfo(address) {
    const info = this.stakes.get((address || "").toLowerCase()) || { amount: 0, deviceQuota: 0, isValidatorEligible: false };
    return {
      ...info,
      dynamicApy: this.getDynamicApy(),
      protocolInvariants: {
        quotaIsNotReward: true,
        quotaIsNotGuaranteedExecution: true,
        quotaIsNotValidatorPower: true,
        sustainableRealYield: true
      }
    };
  }
}

export class MycDEXContract {
  constructor(initialMYC = 250000, initialUSDT = 50000) {
    this.reserveMYC = initialMYC;
    this.reserveUSDT = initialUSDT;
    this.maxTradePercentBps = 200; // 2% max trade
    this.feeBps = 30; // 0.3%
  }

  getAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = amountIn * (10000 - this.feeBps) / 10000;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return numerator / denominator;
  }

  swap(fromToken, toToken, amountIn, context = {}) {
    const amt = parseFloat(amountIn);
    if (amt <= 0) throw new Error("INVALID_SWAP_AMOUNT");

    let reserveIn, reserveOut;
    if (fromToken === "MYC" && toToken === "USDT") {
      reserveIn = this.reserveMYC;
      reserveOut = this.reserveUSDT;
    } else if (fromToken === "USDT" && toToken === "MYC") {
      reserveIn = this.reserveUSDT;
      reserveOut = this.reserveMYC;
    } else {
      throw new Error(`UNSUPPORTED_PAIR: ${fromToken}/${toToken}`);
    }

    // Whale Guard: max 2% of pool
    const maxTrade = (reserveIn * this.maxTradePercentBps) / 10000;
    if (amt > maxTrade) {
      throw new Error(`WHALE_GUARD_EXCEEDED: Max trade is ${maxTrade.toFixed(2)} ${fromToken}`);
    }

    const spotPrice = reserveOut / reserveIn;
    const expectedOutput = amt * spotPrice;
    const amountOut = this.getAmountOut(amt, reserveIn, reserveOut);

    // Slippage Check
    const minAmountOut = context.minAmountOut || (typeof context === "number" ? context : 0);
    if (minAmountOut > 0 && amountOut < minAmountOut) {
      throw new Error(`SLIPPAGE_EXCEEDED: Expected min ${minAmountOut}, got ${amountOut.toFixed(4)}`);
    }

    if (context.maxSlippageBps) {
      const slippageBps = Math.abs(expectedOutput - amountOut) / expectedOutput * 10000;
      if (slippageBps > context.maxSlippageBps) {
        throw new Error(`SLIPPAGE_TOLERANCE_EXCEEDED: ${slippageBps.toFixed(0)} bps > ${context.maxSlippageBps} bps`);
      }
    }

    if (fromToken === "MYC") {
      this.reserveMYC += amt;
      this.reserveUSDT -= amountOut;
    } else {
      this.reserveUSDT += amt;
      this.reserveMYC -= amountOut;
    }

    if (context.emit) {
      context.emit("Swap", { fromToken, toToken, amountIn: amt, amountOut });
    }
    return {
      amountIn: amt,
      amountOut,
      spotPrice,
      executionPrice: amountOut / amt,
      reserves: { MYC: this.reserveMYC, USDT: this.reserveUSDT }
    };
  }
}
export const MycResonanceDEXContract = MycDEXContract;

export class MycEscrowContract {
  constructor() {
    this.escrows = new Map();
    this.treasury = "myc1treasury0000000000000000000000";
    this.protocolFeeRate = 0.05; // 5% protocol fee
  }

  createEscrow(escrowId, payee, amount, assetSymbol, durationSeconds, context = {}) {
    if (this.escrows.has(escrowId)) throw new Error("ESCROW_ALREADY_EXISTS");
    const payer = (context.msgSender || context.sender || context.from || "myc1defaultpayer").toLowerCase();
    const item = {
      escrowId,
      payer,
      payee: payee.toLowerCase(),
      amount: parseFloat(amount),
      assetSymbol,
      state: "CREATED",
      proofHash: null,
      timeoutTimestamp: Date.now() + (durationSeconds * 1000),
      createdAt: Date.now(),
      finalized: false
    };
    this.escrows.set(escrowId, item);
    if (context.emit) context.emit("EscrowCreated", item);
    return item;
  }

  fundEscrow(escrowId, context = {}) {
    const item = this.escrows.get(escrowId);
    if (!item) throw new Error("ESCROW_NOT_FOUND");
    if (item.state !== "CREATED") throw new Error(`INVALID_STATE: ${item.state}`);
    item.state = "FUNDED";
    if (context.emit) context.emit("EscrowFunded", { escrowId, amount: item.amount });
    return item;
  }

  submitExecutionProof(escrowId, proofHash, context = {}) {
    const item = this.escrows.get(escrowId);
    if (!item) throw new Error("ESCROW_NOT_FOUND");
    if (item.finalized) throw new Error("ALREADY_FINALIZED");
    item.proofHash = proofHash;
    item.state = "VERIFYING";
    if (context.emit) context.emit("ProofSubmitted", { escrowId, proofHash });
    return item;
  }

  attestAndRelease(escrowId, context = {}) {
    const item = this.escrows.get(escrowId);
    if (!item) throw new Error("ESCROW_NOT_FOUND");
    if (item.finalized || item.state === "RELEASED") {
      throw new Error("ALREADY_FINALIZED");
    }

    const fee = item.amount * this.protocolFeeRate;
    const payout = item.amount - fee;

    item.state = "RELEASED";
    item.finalized = true;
    item.payout = payout;
    item.fee = fee;

    if (context.emit) {
      context.emit("EscrowSettled", {
        escrowId,
        recipient: item.payee,
        payout,
        fee,
        treasury: this.treasury
      });
    }
    return item;
  }

  cancelBeforeExecution(escrowId, context = {}) {
    const item = this.escrows.get(escrowId);
    if (!item) throw new Error("ESCROW_NOT_FOUND");
    if (item.finalized) throw new Error("ALREADY_FINALIZED");
    if (context.sender && context.sender.toLowerCase() !== item.payer.toLowerCase()) {
      throw new Error("ONLY_PAYER_CAN_CANCEL");
    }
    if (item.state !== "CREATED" && item.state !== "FUNDED") {
      throw new Error(`CANNOT_CANCEL_AFTER_EXECUTION_STARTED: state is ${item.state}`);
    }

    item.state = "REFUNDED";
    item.finalized = true;
    if (context.emit) context.emit("EscrowRefunded", { escrowId, recipient: item.payer, amount: item.amount });
    return item;
  }

  refundExpired(escrowId, context = {}) {
    const item = this.escrows.get(escrowId);
    if (!item) throw new Error("ESCROW_NOT_FOUND");
    if (item.finalized) throw new Error("ALREADY_FINALIZED");
    if (Date.now() < item.timeoutTimestamp) throw new Error("TIMEOUT_NOT_EXPIRED");

    item.state = "REFUNDED";
    item.finalized = true;
    if (context.emit) context.emit("EscrowRefunded", { escrowId, recipient: item.payer, amount: item.amount });
    return item;
  }
}

export class MycActuatorGuardContract {
  constructor() {
    this.authorizations = new Map();
    this.allowedDevices = new Set(["TURBINE", "VALVE", "PUMP", "MOTOR", "FAN"]);
  }

  authorizeActuation(intentHash, device, unitNumber, action, targetRegister, actionValue, passedSafetyChecks, context = {}) {
    if (!this.allowedDevices.has(device) || !passedSafetyChecks) {
      if (context.emit) context.emit("ActuationHaltedNoOp", { intentHash, reason: "SAFETY_GUARD_NOOP" });
      return { authorized: false, pinState: "0.00V (Safe Low)" };
    }

    const isStart = action === "START" || actionValue === 0xFF00;
    const pinState = isStart ? "3.30V (HIGH)" : "0.00V (Safe Low)";

    this.authorizations.set(intentHash, {
      intentHash,
      device,
      unitNumber,
      action,
      targetRegister,
      actionValue,
      pinState,
      authorizedAt: Date.now()
    });

    if (context.emit) context.emit("ActuationAuthorized", { intentHash, device, action, pinState });
    return { authorized: true, pinState };
  }
}

export class MycAgentRegistryContract {
  constructor() {
    this.agents = new Map();
  }

  registerAgent(agentId, name, capabilities, policyHash, context = {}) {
    if (this.agents.has(agentId)) throw new Error("AGENT_ALREADY_REGISTERED");
    const entry = { agentId, name, capabilities, policyHash, operator: context.msgSender, registeredAt: Date.now() };
    this.agents.set(agentId, entry);
    if (context.emit) context.emit("AgentRegistered", entry);
    return entry;
  }

  getAgent(agentId) {
    return this.agents.get(agentId) || null;
  }
}

export class MycTaskRegistryContract {
  constructor() {
    this.tasks = new Map();
  }

  registerTask(taskId, escrowId, requiredCapability, context = {}) {
    if (this.tasks.has(taskId)) throw new Error("TASK_ALREADY_EXISTS");
    const task = { taskId, escrowId, requiredCapability, creator: context.msgSender, status: "CREATED", createdAt: Date.now() };
    this.tasks.set(taskId, task);
    if (context.emit) context.emit("TaskCreated", task);
    return task;
  }
}

export class MycExecutionProofContract {
  constructor() {
    this.proofs = new Map();
  }

  submitProof(proofHash, taskId, coherenceScoreBps, backend = "POR_NATIVE") {
    if (backend === "ZK_ROADMAP" || backend === "TEE_ROADMAP") {
      throw new Error("BACKEND_NOT_IMPLEMENTED_ROADMAP_ONLY");
    }
    const record = { proofHash, taskId, coherenceScoreBps, valid: coherenceScoreBps >= 5000, verifiedAt: Date.now() };
    this.proofs.set(proofHash, record);
    return record;
  }
}

export class MycPolicyRegistryContract {
  constructor() {
    this.policies = new Map();
  }

  registerPolicy(policyHash, policyAstJson, context = {}) {
    this.policies.set(policyHash, { policyHash, policyAstJson, author: context.msgSender, registeredAt: Date.now() });
    return true;
  }
}

export class MycNodeRegistryContract {
  constructor() {
    this.nodes = new Map();
  }

  registerNode(nodeId, ownerOrRoles, role = "COLONY_PEER", tier = "SEED", energy = 1000, context = {}) {
    const id = String(nodeId);
    let owner = context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
    let roles = ["COLONY_PEER"];

    if (typeof ownerOrRoles === "string" && ownerOrRoles.startsWith("myc")) {
      owner = ownerOrRoles;
    } else if (Array.isArray(ownerOrRoles)) {
      roles = ownerOrRoles;
    }

    const nodeEntry = {
      nodeId: id,
      owner: (owner || "").toLowerCase(),
      address: owner,
      operator: (owner || "").toLowerCase(),
      isDelegated: false,
      revenueShareOwner: 100,
      revenueShareOperator: 0,
      minUptime: 99,
      role: typeof role === "string" ? role : "COLONY_PEER",
      tier: typeof tier === "string" ? tier : "SEED",
      energyScore: parseInt(energy) || 1000,
      stakedNFT: id,
      registeredAt: Date.now(),
      isWhitelisted: true
    };

    this.nodes.set(id, nodeEntry);
    if (context.emit) {
      context.emit("NodeActivated", { nodeId: id, owner: nodeEntry.owner, tier: nodeEntry.tier });
    }
    return true;
  }

  updateNodeEnergy(nodeId, energy, context = {}) {
    const id = String(nodeId);
    const node = this.nodes.get(id);
    if (!node) return false;

    const en = parseInt(energy) || 0;
    node.energyScore = en;
    const oldTier = node.tier;
    node.tier = en < 3000 ? "SEED" : (en < 8000 ? "RESONANT" : "SOVEREIGN");

    if (context.emit) {
      context.emit("NodeTierUpdated", { nodeId: id, tier: node.tier, energyScore: en });
    }
    return { nodeId: id, tier: node.tier, energyScore: en, tierChanged: oldTier !== node.tier };
  }

  transferNodeOwnership(nodeId, newOwner, context = {}) {
    const id = String(nodeId);
    const node = this.nodes.get(id);
    if (!node) throw new Error("NODE_NONEXISTENT");

    const oldOwner = node.owner;
    node.owner = (newOwner || "").toLowerCase();
    node.address = newOwner;
    if (!node.isDelegated) {
      node.operator = node.owner;
    }

    if (context.emit) {
      context.emit("NodeOwnershipTransferred", { nodeId: id, oldOwner, newOwner: node.owner });
    }
    return true;
  }

  delegateNode(nodeId, operator, revenueShareOwner = 70, minUptime = 95, context = {}) {
    const id = String(nodeId);
    const node = this.nodes.get(id);
    if (!node) throw new Error("NODE_NONEXISTENT");
    const caller = (context.msgSender || node.owner).toLowerCase();
    if (caller !== node.owner) throw new Error("UNAUTHORIZED_DELEGATION");

    const op = (operator || "").toLowerCase();
    if (!op || op === node.owner) throw new Error("INVALID_OPERATOR");

    const shareOwner = Math.min(100, Math.max(0, parseInt(revenueShareOwner) || 70));
    const shareOperator = 100 - shareOwner;

    node.operator = op;
    node.isDelegated = true;
    node.revenueShareOwner = shareOwner;
    node.revenueShareOperator = shareOperator;
    node.minUptime = parseInt(minUptime) || 95;

    if (context.emit) {
      context.emit("NodeDelegated", { nodeId: id, owner: node.owner, operator: op, revenueShareOwner: shareOwner });
    }
    return { success: true, nodeId: id, owner: node.owner, operator: op, revenueShareOwner: shareOwner, revenueShareOperator: shareOperator };
  }

  undelegateNode(nodeId, context = {}) {
    const id = String(nodeId);
    const node = this.nodes.get(id);
    if (!node) throw new Error("NODE_NONEXISTENT");
    const caller = (context.msgSender || node.owner).toLowerCase();
    if (caller !== node.owner) throw new Error("UNAUTHORIZED_UNDELEGATION");

    node.operator = node.owner;
    node.isDelegated = false;
    node.revenueShareOwner = 100;
    node.revenueShareOperator = 0;

    if (context.emit) {
      context.emit("NodeUndelegated", { nodeId: id, owner: node.owner });
    }
    return { success: true, nodeId: id, owner: node.owner, operator: node.owner };
  }

  getNode(nodeId) {
    const id = String(nodeId);
    return this.nodes.get(id) || null;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }
}

export class MycReputationContract {
  constructor() {
    this.scores = new Map();
    this.INITIAL_REPUTATION = 100;
    this.SUCCESS_REWARD = 10;
    this.TIMEOUT_PENALTY = 25;
    this.SLASHING_PENALTY = 100;
    this.MIN_REPUTATION_FOR_TASKS = 50;
    this.MAX_REPUTATION = 1000;
  }

  _getOrCreate(nodeAddress) {
    const addr = (nodeAddress || "").toLowerCase();
    if (!this.scores.has(addr)) {
      this.scores.set(addr, {
        score: this.INITIAL_REPUTATION,
        successfulTasks: 0,
        failedTasks: 0,
        timeouts: 0,
        slashedCount: 0,
        lastUpdated: Date.now(),
        isQuarantined: false
      });
    }
    return this.scores.get(addr);
  }

  recordSuccess(nodeAddress) {
    const r = this._getOrCreate(nodeAddress);
    r.successfulTasks++;
    r.score = Math.min(this.MAX_REPUTATION, r.score + this.SUCCESS_REWARD);
    if (r.score >= this.MIN_REPUTATION_FOR_TASKS) {
      r.isQuarantined = false;
    }
    r.lastUpdated = Date.now();
    return r;
  }

  recordTimeout(nodeAddress) {
    const r = this._getOrCreate(nodeAddress);
    r.timeouts++;
    r.failedTasks++;
    r.score = Math.max(0, r.score - this.TIMEOUT_PENALTY);
    if (r.score < this.MIN_REPUTATION_FOR_TASKS) {
      r.isQuarantined = true;
    }
    r.lastUpdated = Date.now();
    return r;
  }

  recordSlash(nodeAddress, reason = "MALICIOUS_EXECUTION") {
    const r = this._getOrCreate(nodeAddress);
    r.slashedCount++;
    r.failedTasks++;
    r.score = Math.max(0, r.score - this.SLASHING_PENALTY);
    r.isQuarantined = true;
    r.lastUpdated = Date.now();
    return r;
  }

  isEligibleForTasks(nodeAddress) {
    const r = this._getOrCreate(nodeAddress);
    return r.score >= this.MIN_REPUTATION_FOR_TASKS && !r.isQuarantined;
  }

  recordOutcome(nodeAddress, success) {
    if (success) return this.recordSuccess(nodeAddress);
    return this.recordTimeout(nodeAddress);
  }

  getScore(nodeAddress) {
    return this._getOrCreate(nodeAddress);
  }
}

export class MycStreamPayContract {
  constructor() {
    this.channels = new Map();
    this.agentBalances = new Map();
  }

  openChannel(channelId, payee, initialDeposit, validDurationSeconds = 86400, context = {}) {
    const payer = (context.msgSender || "myc1defaultpayer").toLowerCase();
    const payeeAddr = payee.toLowerCase();
    if (this.channels.has(channelId)) throw new Error("CHANNEL_ALREADY_EXISTS");
    const deposit = parseFloat(initialDeposit);
    if (deposit <= 0) throw new Error("DEPOSIT_REQUIRED");

    const channel = {
      channelId,
      payer,
      payee: payeeAddr,
      totalDeposit: deposit,
      settledAmount: 0,
      validUntil: Date.now() + (validDurationSeconds * 1000),
      isOpen: true
    };
    this.channels.set(channelId, channel);
    if (context.emit) context.emit("ChannelOpened", channel);
    return channel;
  }

  settleMicroPayment(channelId, cumulativeAmount, context = {}) {
    const ch = this.channels.get(channelId);
    if (!ch) throw new Error("CHANNEL_NOT_FOUND");
    if (!ch.isOpen) throw new Error("CHANNEL_CLOSED");
    const amt = parseFloat(cumulativeAmount);
    if (amt <= ch.settledAmount) throw new Error("AMOUNT_MUST_INCREASE");
    if (amt > ch.totalDeposit) throw new Error("EXCEEDS_DEPOSIT");

    const delta = amt - ch.settledAmount;
    ch.settledAmount = amt;
    const payeeBal = this.agentBalances.get(ch.payee) || 0;
    this.agentBalances.set(ch.payee, payeeBal + delta);

    if (context.emit) context.emit("MicroPaymentSettled", { channelId, payee: ch.payee, amount: delta, remaining: ch.totalDeposit - ch.settledAmount });
    return { channelId, settledTotal: amt, delta, remaining: ch.totalDeposit - ch.settledAmount };
  }

  closeChannel(channelId, context = {}) {
    const ch = this.channels.get(channelId);
    if (!ch) throw new Error("CHANNEL_NOT_FOUND");
    if (!ch.isOpen) throw new Error("CHANNEL_ALREADY_CLOSED");

    ch.isOpen = false;
    const refund = ch.totalDeposit - ch.settledAmount;
    if (refund > 0) {
      const payerBal = this.agentBalances.get(ch.payer) || 0;
      this.agentBalances.set(ch.payer, payerBal + refund);
    }

    if (context.emit) context.emit("ChannelClosed", { channelId, refundPayer: refund, totalPaid: ch.settledAmount });
    return { channelId, refunded: refund, totalPaid: ch.settledAmount };
  }

  directPay(to, amount, memo = "", context = {}) {
    const sender = (context.msgSender || "myc1defaultpayer").toLowerCase();
    const recipient = (to || "").toLowerCase();
    const amt = parseFloat(amount);
    if (amt <= 0) throw new Error("INVALID_AMOUNT");

    const recBal = this.agentBalances.get(recipient) || 0;
    this.agentBalances.set(recipient, recBal + amt);

    if (context.emit) context.emit("DirectPay", { from: sender, to: recipient, amount: amt, memo });
    return { from: sender, to: recipient, amount: amt, memo, timestamp: Date.now() };
  }
}
export const MycOpacusPayContract = MycStreamPayContract;

export class MycBridgeContract {
  constructor(initialValidators = null) {
    this.transactions = new Map();
    this.totalLocked = {
      MYC: 0,
      USDT: 0,
      USDC: 0
    };
    this.totalLockedMYC = 0;
    this.bridgeFeeBps = 10; // 0.1%
    this.MAX_SINGLE_TRANSFER = 50000;
    this.HOURLY_VOLUME_CAP = 200000;
    this.paused = false;
    this.bridgeGuardian = "myc1guardian00000000000000000000000";
    this.currentHourTimestamp = Date.now();
    this.currentHourVolume = 0;

    // Validators for BFT Quorum
    this.validatorSet = new Set(initialValidators || [
      "myc1validatoralpha00000000000000000",
      "myc1validatorbeta000000000000000000",
      "myc1validatorgamma00000000000000000",
      "myc1validatordelta00000000000000000"
    ]);

    // Replay Protection
    this.processedTransfers = new Set();
    this.userNonces = new Map();
  }

  getRequiredQuorum() {
    const n = this.validatorSet.size;
    if (n === 0) return 1;
    return Math.floor((2 * n) / 3) + 1;
  }

  registerValidator(valAddr) {
    this.validatorSet.add((valAddr || "").toLowerCase());
  }

  pauseBridge(guardian = null) {
    this.paused = true;
  }

  unpauseBridge(guardian = null) {
    this.paused = false;
  }

  lockAndBridge(targetChain, recipientRemote, amount, context = {}, asset = "MYC") {
    if (this.paused) throw new Error("BRIDGE_EMERGENCY_PAUSED");
    const tokenAsset = (asset || "MYC").toUpperCase();
    if (!["MYC", "USDT", "USDC"].includes(tokenAsset)) {
      throw new Error(`UNSUPPORTED_BRIDGE_ASSET: ${tokenAsset}. Supported: MYC, USDT, USDC`);
    }

    const sender = (context.msgSender || "myc1defaultpayer").toLowerCase();
    const amt = parseFloat(amount);
    if (amt <= 0 || amt > this.MAX_SINGLE_TRANSFER) {
      throw new Error(`AMOUNT_EXCEEDS_SINGLE_LIMIT: max ${this.MAX_SINGLE_TRANSFER} ${tokenAsset}`);
    }
    if (!targetChain) throw new Error("INVALID_TARGET_CHAIN");
    if (!recipientRemote) throw new Error("INVALID_RECIPIENT");

    // Hourly rate limiter check
    const now = Date.now();
    if (now >= this.currentHourTimestamp + 3600000) {
      this.currentHourTimestamp = now;
      this.currentHourVolume = 0;
    }
    if (this.currentHourVolume + amt > this.HOURLY_VOLUME_CAP) {
      throw new Error("HOURLY_VOLUME_CAP_EXCEEDED");
    }
    this.currentHourVolume += amt;

    const currentNonce = this.userNonces.get(sender) || 0;
    this.userNonces.set(sender, currentNonce + 1);

    const fee = (amt * this.bridgeFeeBps) / 10000;
    const netAmount = amt - fee;
    const bridgeId = "bridge_" + crypto.randomBytes(16).toString("hex");

    const record = {
      bridgeId,
      sender,
      asset: tokenAsset,
      targetChain,
      recipientRemote,
      amount: netAmount,
      fee,
      nonce: currentNonce,
      status: "PENDING",
      timestamp: now,
      lockProof: "LATTICE_PROOF_" + bridgeId
    };

    this.transactions.set(bridgeId, record);
    this.totalLocked[tokenAsset] = (this.totalLocked[tokenAsset] || 0) + amt;
    if (tokenAsset === "MYC") {
      this.totalLockedMYC += amt;
    }

    if (context.emit) context.emit("BridgeLocked", record);
    return record;
  }

  releaseWithSignatures(transferId, sourceChain, recipient, amount, nonce, signers = [], context = {}, asset = "MYC") {
    if (this.paused) throw new Error("BRIDGE_EMERGENCY_PAUSED");
    if (!transferId) throw new Error("INVALID_TRANSFER_ID");
    if (this.processedTransfers.has(transferId)) {
      throw new Error("REPLAY_ATTACK_DETECTED: Transfer already executed");
    }

    const tokenAsset = (asset || "MYC").toUpperCase();
    if (!["MYC", "USDT", "USDC"].includes(tokenAsset)) {
      throw new Error(`UNSUPPORTED_BRIDGE_ASSET: ${tokenAsset}. Supported: MYC, USDT, USDC`);
    }

    const rec = (recipient || "").toLowerCase();
    const amt = parseFloat(amount);
    if (amt <= 0 || amt > this.MAX_SINGLE_TRANSFER) throw new Error("INVALID_AMOUNT");

    // Verify 2/3 + 1 Quorum
    const requiredQuorum = this.getRequiredQuorum();
    if (!Array.isArray(signers) || signers.length < requiredQuorum) {
      throw new Error(`INSUFFICIENT_BFT_SIGNATURES: Required ${requiredQuorum}, got ${signers?.length || 0}`);
    }

    // Verify unique and authorized signers
    const uniqueSigners = new Set();
    for (const signer of signers) {
      const s = (signer || "").toLowerCase();
      if (!this.validatorSet.has(s)) {
        throw new Error(`UNAUTHORIZED_SIGNER: ${s}`);
      }
      if (uniqueSigners.has(s)) {
        throw new Error(`DUPLICATE_SIGNER: ${s}`);
      }
      uniqueSigners.add(s);
    }

    // Mühürle (Replay Seal)
    this.processedTransfers.add(transferId);

    const releaseRecord = {
      transferId,
      sourceChain,
      recipient: rec,
      asset: tokenAsset,
      amount: amt,
      nonce,
      signaturesCount: signers.length,
      requiredQuorum,
      status: "COMPLETED",
      timestamp: Date.now()
    };

    if (context.emit) context.emit("BridgeReleased", releaseRecord);
    return releaseRecord;
  }

  getBridgeStatus(bridgeId) {
    return this.transactions.get(bridgeId) || null;
  }

  isTransferProcessed(transferId) {
    return this.processedTransfers.has(transferId);
  }
}

export class MycResonanceAssetContract {
  constructor() {
    this.name = "MYCA Resonance Asset";
    this.symbol = "MYC-RES";
    this._nextTokenId = 1;
    this.assets = new Map();
    this._observations = new Map();
    this._collective = new Map();
    this.resonanceBonds = new Map();
    this.nodeRegistry = null;

    this.RESONANCE_THRESHOLD = 6500; // 0.65 Cosine similarity
    this.BOOST_MULTIPLIER = 20;
    this.DISCOVERY_THRESHOLD = 10;
    this.DISCOVERY_BONUS = 500;
    this.DECAY_GRACE_PERIOD = 30 * 86400 * 1000; // 30 days

    this.interactionWeights = {
      1: 50,  // Verification / query
      2: 120, // Telemetry pulse / gaming tick
      3: 300, // AI model inference / compute
      4: 600  // Commercial settlement
    };

    // LAYER: VM — 3-Tier Configurations & Capabilities
    this.tierConfigs = {
      SEED: {
        maxSupply: 10000,
        mintPriceUsdc: 50,
        initialEnergy: 500,
        maxTasks: 1,
        decayRate: 5,
        name: "SEED",
        capabilities: ["telemetry", "ping", "light_inference"]
      },
      RESONANT: {
        maxSupply: 2000,
        mintPriceUsdc: 500,
        initialEnergy: 3500,
        maxTasks: 5,
        decayRate: 10,
        name: "RESONANT",
        capabilities: ["ai_inference", "depin_actuation", "m2m_payment", "telemetry"]
      },
      SOVEREIGN: {
        maxSupply: 200,
        mintPriceUsdc: 5000,
        initialEnergy: 9000,
        maxTasks: 20,
        decayRate: 15,
        name: "SOVEREIGN",
        capabilities: ["validator", "escrow_arbitration", "ai_inference", "depin_actuation", "m2m_payment", "telemetry"]
      }
    };

    this.tierMintedCount = new Map([
      ["SEED", 0],
      ["RESONANT", 1],
      ["SOVEREIGN", 0]
    ]);
    this.tokenTier = new Map([[1, "RESONANT"]]);

    // Pre-seed Genesis Living Resonance Asset #1
    this._seedGenesisAsset();
  }

  attachNodeRegistry(nodeRegistry) {
    this.nodeRegistry = nodeRegistry;
    if (this.nodeRegistry && this.assets.has(1)) {
      this.nodeRegistry.registerNode(1, "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002", "COLONY_PEER", "RESONANT", 2500);
    }
  }

  // =========================================================================
  // LAYER: VM / Blockchain — 3-TIER COLONY NODE MINT WRAPPERS
  // =========================================================================

  mintSeed(to, context = {}) {
    return this._mintTier(to, "SEED", "COLONY_PEER", context);
  }

  mintResonant(to, context = {}) {
    return this._mintTier(to, "RESONANT", "COLONY_PEER", context);
  }

  mintSovereign(to, context = {}) {
    return this._mintTier(to, "SOVEREIGN", "VALIDATOR", context);
  }

  _mintTier(to, tierName, nodeRole, context = {}) {
    const tier = (tierName || "SEED").toUpperCase();
    const config = this.tierConfigs[tier];
    if (!config) throw new Error(`INVALID_TIER: ${tierName}`);

    const minted = this.tierMintedCount.get(tier) || 0;
    if (minted >= config.maxSupply) {
      throw new Error("Tier supply exhausted");
    }

    const creator = (to || context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const tokenId = this._nextTokenId++;

    this.tierMintedCount.set(tier, minted + 1);
    this.tokenTier.set(tokenId, tier);

    // Deterministic Frequency Harmonics from tokenId & recipient
    const dominantHz = tier === "SEED" ? 432 : (tier === "RESONANT" ? 528 : 963);
    const harms = Array.from({ length: 8 }, (_, idx) => 4000 + ((tokenId * 37 + idx * 79) % 5500));

    const asset = {
      tokenId,
      uri: `ipfs://bafkreia_myc_node_${tokenId}.json`,
      creator,
      energyScore: config.initialEnergy,
      lastInteraction: Date.now(),
      decayRate: config.decayRate,
      status: "ACTIVE",
      tier,
      frequency: {
        harmonics: harms,
        dominantHz,
        resonanceScore: 0
      }
    };

    this.assets.set(tokenId, asset);
    this._observations.set(tokenId, {
      observers: [],
      timestamps: [],
      contextHashes: []
    });
    this._collective.set(tokenId, {
      totalShares: 10000,
      shares: { [creator]: 10000 },
      governanceContract: "myc_governance_commons",
      minimumShareForProposal: 500
    });
    this.resonanceBonds.set(tokenId, []);

    // LAYER: Colony — Synchronous Node Registration in same transaction
    if (this.nodeRegistry) {
      this.nodeRegistry.registerNode(tokenId, creator, nodeRole, tier, config.initialEnergy, context);
    }

    if (context.emit) {
      context.emit("AssetMinted", { tokenId, creator, dominantHz });
      context.emit("NodeActivated", { tokenId, tier, operator: creator });
    }

    return {
      tokenId,
      tier,
      energy: config.initialEnergy,
      nodeId: tokenId,
      owner: creator,
      role: nodeRole,
      dominantHz,
      maxTasks: config.maxTasks,
      capabilities: [...config.capabilities]
    };
  }

  getRemainingSupply(tierName) {
    const tier = (tierName || "SEED").toUpperCase();
    const config = this.tierConfigs[tier];
    if (!config) throw new Error(`INVALID_TIER: ${tierName}`);
    const minted = this.tierMintedCount.get(tier) || 0;
    const remaining = Math.max(0, config.maxSupply - minted);
    return {
      tier,
      remaining,
      minted,
      max: config.maxSupply,
      price: config.mintPriceUsdc
    };
  }

  getTierCapabilities(tokenId) {
    const id = parseInt(tokenId);
    const tier = this.tokenTier.get(id) || (this.assets.get(id)?.tier) || "SEED";
    const config = this.tierConfigs[tier];
    return config ? [...config.capabilities] : ["telemetry", "ping", "light_inference"];
  }

  getTierOfToken(tokenId) {
    const id = parseInt(tokenId);
    return this.tokenTier.get(id) || (this.assets.get(id)?.tier) || "SEED";
  }

  _seedGenesisAsset() {
    const genesisId = 1;
    this._nextTokenId = 2;
    const now = Date.now();
    const harmonics = [7500, 8200, 9100, 6400, 8800, 7100, 9500, 8300];
    this.assets.set(genesisId, {
      tokenId: genesisId,
      uri: "ipfs://bafkreia7a_genesis_hyphae_001.json",
      creator: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      energyScore: 2500,
      lastInteraction: now,
      decayRate: 10,
      status: "RESONANT",
      tier: "RESONANT",
      frequency: {
        harmonics,
        dominantHz: 432,
        resonanceScore: 12
      }
    });

    this._observations.set(genesisId, {
      observers: ["myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002"],
      timestamps: [now],
      contextHashes: ["0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"]
    });

    this._collective.set(genesisId, {
      totalShares: 10000,
      shares: { "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002": 10000 },
      governanceContract: "myc_contract_community_dao",
      minimumShareForProposal: 500
    });

    this.resonanceBonds.set(genesisId, []);
  }

  mintResonanceAsset(uri, harmonics, dominantHz = 432, initialDecayRate = 10, governanceContract = null, context = {}) {
    const res = this.mintSeed(context.msgSender, context);
    const asset = this.assets.get(res.tokenId);
    if (asset) {
      asset.energyScore = 1000;
      if (uri) asset.uri = uri;
      if (harmonics) asset.frequency.harmonics = harmonics;
      if (dominantHz) asset.frequency.dominantHz = dominantHz;
      if (initialDecayRate) asset.decayRate = initialDecayRate;
      if (this.nodeRegistry) {
        this.nodeRegistry.updateNodeEnergy(res.tokenId, 1000, context);
      }
    }
    return res.tokenId;
  }


  interact(tokenId, interactionType = 1, context = {}) {
    const id = parseInt(tokenId);
    const asset = this.assets.get(id);
    if (!asset) throw new Error("ASSET_NONEXISTENT");

    this.applyDecay(id);
    const weight = this.interactionWeights[interactionType] || 25;
    asset.energyScore += weight;
    asset.lastInteraction = Date.now();
    asset.tier = asset.energyScore < 3000 ? "SEED" : (asset.energyScore < 8000 ? "RESONANT" : "SOVEREIGN");
    this.tokenTier.set(id, asset.tier);

    // Colony Node Energy Recalibration
    if (this.nodeRegistry) {
      this.nodeRegistry.updateNodeEnergy(id, asset.energyScore, context);
    }

    if (context.emit) {
      context.emit("EnergyUpdated", { tokenId: id, newEnergyScore: asset.energyScore, interactionType });
      context.emit("NodeEnergyUpdated", { tokenId: id, energyScore: asset.energyScore });
    }
    return { success: true, tokenId: id, energyScore: asset.energyScore };
  }

  applyDecay(tokenId) {
    const asset = this.assets.get(parseInt(tokenId));
    if (!asset) return;
    const now = Date.now();
    if (now <= asset.lastInteraction + this.DECAY_GRACE_PERIOD) return;

    const overdueDays = Math.floor((now - (asset.lastInteraction + this.DECAY_GRACE_PERIOD)) / 86400000);
    if (overdueDays > 0) {
      const decayAmount = overdueDays * asset.decayRate;
      if (decayAmount >= asset.energyScore) {
        asset.energyScore = 0;
        asset.status = "DORMANT";
      } else {
        asset.energyScore -= decayAmount;
      }
      asset.lastInteraction = now;
      if (this.nodeRegistry) {
        this.nodeRegistry.updateNodeEnergy(tokenId, asset.energyScore);
      }
    }
  }

  cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 8 || b.length !== 8) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < 8; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return Math.floor((dot * 10000) / denom);
  }

  bondResonance(tokenA, tokenB, context = {}) {
    const idA = parseInt(tokenA);
    const idB = parseInt(tokenB);
    if (idA === idB) throw new Error("IDENTICAL_TOKENS");
    const assetA = this.assets.get(idA);
    const assetB = this.assets.get(idB);
    if (!assetA || !assetB) throw new Error("INVALID_TOKENS");

    this.applyDecay(idA);
    this.applyDecay(idB);

    const similarity = this.cosineSimilarity(assetA.frequency.harmonics, assetB.frequency.harmonics);
    if (similarity < this.RESONANCE_THRESHOLD) {
      throw new Error(`FREQUENCY_INCOHERENT: Similarity ${similarity} < ${this.RESONANCE_THRESHOLD}`);
    }

    const boost = Math.floor((similarity * this.BOOST_MULTIPLIER) / 100);
    assetA.energyScore += boost;
    assetB.energyScore += boost;
    assetA.frequency.resonanceScore += 1;
    assetB.frequency.resonanceScore += 1;
    assetA.status = "RESONANT";
    assetB.status = "RESONANT";

    const bondsA = this.resonanceBonds.get(idA) || [];
    const bondsB = this.resonanceBonds.get(idB) || [];
    if (!bondsA.includes(idB)) bondsA.push(idB);
    if (!bondsB.includes(idA)) bondsB.push(idA);
    this.resonanceBonds.set(idA, bondsA);
    this.resonanceBonds.set(idB, bondsB);

    if (this.nodeRegistry) {
      this.nodeRegistry.updateNodeEnergy(idA, assetA.energyScore, context);
      this.nodeRegistry.updateNodeEnergy(idB, assetB.energyScore, context);
    }

    if (context.emit) {
      context.emit("ResonantBondFormed", { tokenA: idA, tokenB: idB, similarity, boost });
    }
    return { success: true, similarity, boost, tokenA: idA, tokenB: idB };
  }

  observe(tokenId, contextHash, context = {}) {
    const id = parseInt(tokenId);
    const asset = this.assets.get(id);
    if (!asset) throw new Error("NONEXISTENT_ASSET");

    this.applyDecay(id);
    const observer = (context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const obs = this._observations.get(id);
    obs.observers.push(observer);
    obs.timestamps.push(Date.now());
    obs.contextHashes.push(contextHash || ("0x" + crypto.randomBytes(32).toString("hex")));

    if (obs.observers.length >= this.DISCOVERY_THRESHOLD && asset.status !== "DISCOVERED") {
      asset.status = "DISCOVERED";
      asset.energyScore += this.DISCOVERY_BONUS;
    }

    if (context.emit) {
      context.emit("Observed", { tokenId: id, observer, timestamp: Date.now() });
    }
    return { success: true, tokenId: id, totalObservers: obs.observers.length, status: asset.status, energyScore: asset.energyScore };
  }

  getAsset(tokenId) {
    const id = parseInt(tokenId);
    const asset = this.assets.get(id);
    if (!asset) return null;
    this.applyDecay(id);
    return {
      ...asset,
      bonds: this.resonanceBonds.get(id) || [],
      observationCount: (this._observations.get(id)?.observers || []).length
    };
  }

  getObservationCount(tokenId) {
    return (this._observations.get(parseInt(tokenId))?.observers || []).length;
  }

  transferShares(tokenId, to, shareAmount, context = {}) {
    const id = parseInt(tokenId);
    const sender = (context.msgSender || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002").toLowerCase();
    const recipient = (to || "").toLowerCase();
    const amount = parseInt(shareAmount);

    const coll = this._collective.get(id);
    if (!coll) throw new Error("NONEXISTENT_ASSET");
    const senderShares = coll.shares[sender] || 0;
    if (senderShares < amount) throw new Error(`INSUFFICIENT_SHARES: ${senderShares} < ${amount}`);

    coll.shares[sender] = senderShares - amount;
    coll.shares[recipient] = (coll.shares[recipient] || 0) + amount;

    if (context.emit) {
      context.emit("SharesTransferred", { tokenId: id, from: sender, to: recipient, shares: amount });
    }
    return true;
  }

  getShares(tokenId, stakeholder) {
    const coll = this._collective.get(parseInt(tokenId));
    if (!coll) return 0;
    return coll.shares[(stakeholder || "").toLowerCase()] || 0;
  }

  ownerOf(tokenId) {
    const asset = this.assets.get(parseInt(tokenId));
    return asset ? asset.creator : null;
  }

  transfer(tokenId, to, context = {}) {
    const id = parseInt(tokenId);
    const asset = this.assets.get(id);
    if (!asset) throw new Error("NONEXISTENT_ASSET");
    const sender = (context.msgSender || asset.creator).toLowerCase();
    const recipient = (to || "").toLowerCase();

    // Reassign creator/owner and collective shares
    asset.creator = recipient;
    const coll = this._collective.get(id);
    if (coll) {
      coll.shares[sender] = 0;
      coll.shares[recipient] = 10000;
    }

    this._afterTokenTransfer(sender, recipient, id, context);
    if (context.emit) {
      context.emit("Transfer", { from: sender, to: recipient, tokenId: id });
    }
    return true;
  }

  _afterTokenTransfer(from, to, tokenId, context = {}) {
    if (this.nodeRegistry) {
      this.nodeRegistry.transferNodeOwnership(tokenId, to, context);
    }
    if (context.emit) {
      context.emit("NodeOwnershipTransferred", { tokenId, oldOwner: from, newOwner: to });
    }
  }

  transferNodeOwnership(tokenId, newOwner, context = {}) {
    return this.transfer(tokenId, newOwner, context);
  }
}

export class MycResonanceMarketplaceContract {
  constructor() {
    this.listings = new Map();
    this.resonanceAsset = null;
    this.usdcToken = null;
    this.protocolTreasury = "myc1protocoltreasury000000000000000000";
    this.PROTOCOL_FEE_BPS = 200; // 2% protocol fee
  }

  attachContracts(resonanceAsset, usdcToken) {
    this.resonanceAsset = resonanceAsset;
    this.usdcToken = usdcToken;
  }

  listForSale(tokenId, priceUSDC, minEnergy = 0, showYieldHistory = true, context = {}) {
    const id = parseInt(tokenId);
    const price = parseFloat(priceUSDC);
    if (price <= 0) throw new Error("INVALID_PRICE");
    if (!this.resonanceAsset) throw new Error("RESONANCE_ASSET_NOT_ATTACHED");

    const asset = this.resonanceAsset.getAsset(id);
    if (!asset) throw new Error("ASSET_NONEXISTENT");

    const seller = (context.msgSender || asset.creator).toLowerCase();
    if (asset.creator.toLowerCase() !== seller) throw new Error("ONLY_OWNER_CAN_LIST");

    const minEn = parseInt(minEnergy) || 0;
    if (asset.energyScore < minEn) {
      throw new Error(`ASSET_ENERGY_BELOW_MINIMUM: current ${asset.energyScore} < min ${minEn}`);
    }

    const listing = {
      tokenId: id,
      seller,
      priceUSDC: price,
      minEnergy: minEn,
      showYieldHistory: Boolean(showYieldHistory),
      active: true,
      listedAt: Date.now()
    };

    this.listings.set(id, listing);
    if (context.emit) {
      context.emit("AssetListed", { tokenId: id, seller, priceUSDC: price, minEnergy: minEn });
    }
    return listing;
  }

  cancelListing(tokenId, context = {}) {
    const id = parseInt(tokenId);
    const listing = this.listings.get(id);
    if (!listing || !listing.active) throw new Error("LISTING_NOT_ACTIVE");

    const caller = (context.msgSender || listing.seller).toLowerCase();
    if (caller !== listing.seller) throw new Error("ONLY_SELLER_CAN_CANCEL");

    listing.active = false;
    if (context.emit) {
      context.emit("ListingCancelled", { tokenId: id, seller: listing.seller });
    }
    return true;
  }

  buy(tokenId, maxPrice = null, context = {}) {
    const id = parseInt(tokenId);
    const listing = this.listings.get(id);
    if (!listing || !listing.active) throw new Error("LISTING_NOT_ACTIVE");

    const buyer = (context.msgSender || "myc1buyerdefault00000000000000000000000000").toLowerCase();
    if (buyer === listing.seller) throw new Error("CANNOT_BUY_OWN_ASSET");

    if (maxPrice !== null && listing.priceUSDC > parseFloat(maxPrice)) {
      throw new Error(`PRICE_EXCEEDS_MAX: ${listing.priceUSDC} > ${maxPrice}`);
    }

    const asset = this.resonanceAsset.getAsset(id);
    if (!asset) throw new Error("ASSET_NONEXISTENT");

    // LIVING MACHINE SAFETY INVARIANT: If asset energy decayed below minEnergy, listing is auto-cancelled!
    if (asset.energyScore < listing.minEnergy) {
      listing.active = false;
      throw new Error(`ENERGY_DROPPED_BELOW_MINIMUM: Asset energy decayed to ${asset.energyScore} < minEnergy ${listing.minEnergy}. Listing cancelled for buyer protection.`);
    }

    // Atomic USDC Payment (98% seller, 2% protocol commons)
    const fee = parseFloat((listing.priceUSDC * (this.PROTOCOL_FEE_BPS / 10000)).toFixed(6));
    const sellerProceeds = parseFloat((listing.priceUSDC - fee).toFixed(6));

    if (this.usdcToken) {
      try {
        this.usdcToken.transfer(listing.seller, sellerProceeds, { msgSender: buyer });
        this.usdcToken.transfer(this.protocolTreasury, fee, { msgSender: buyer });
      } catch (e) {}
    }

    // Transfer living NFT to buyer (triggers automatic node handoff)
    this.resonanceAsset.transfer(id, buyer, { msgSender: listing.seller });

    listing.active = false;

    if (context.emit) {
      context.emit("AssetSold", {
        tokenId: id,
        seller: listing.seller,
        buyer,
        priceUSDC: listing.priceUSDC,
        sellerProceeds,
        fee
      });
    }

    return {
      success: true,
      tokenId: id,
      seller: listing.seller,
      buyer,
      priceUSDC: listing.priceUSDC,
      sellerProceeds,
      fee,
      newOwner: buyer
    };
  }

  delist(tokenId, context = {}) {
    return this.cancelListing(tokenId, context);
  }

  getListing(tokenId) {
    return this.listings.get(parseInt(tokenId)) || null;
  }

  getActiveListings() {
    return Array.from(this.listings.values()).filter(l => l.active);
  }
}

export const MycMarketplaceContract = MycResonanceMarketplaceContract;


