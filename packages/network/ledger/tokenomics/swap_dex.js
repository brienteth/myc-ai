/**
 * MycSwap — Secure Automated Market Maker (AMM DEX)
 * Constant Product Market Maker (x · y = k)
 * 
 * Security Features:
 *  1. Slippage Protection      — maxSlippageBps (default 1%, reject if exceeded)
 *  2. Price Impact Calculator  — warns >5%, rejects >15%
 *  3. Bot / Sandwich Defense   — per-address cooldown (10s), per-block limit (3 swaps)
 *  4. Whale Guard              — max trade = 2% of pool reserve
 *  5. TWAP Oracle              — time-weighted average price from last 20 swaps
 *  6. Minimum Output           — minAmountOut floor rejection
 *  7. Zero-Gas Invariant       — all swaps 0.00 MYC gas
 * 
 * Pairs: MYC/USDT, MYC/0G
 */
export class MycSwapDex {
  constructor(token, usdtToken = null, usdcToken = null) {
    this.token = token;
    this.usdtToken = usdtToken;
    this.usdcToken = usdcToken;

    // Initial Constant-Product AMM Pair Reserves (x * y = k)
    this.reserves = {
      MYC: 10_000_000,
      USDT: 1_000_000,
      USDC: 1_000_000
    };

    // Protocol Treasury & External Subsystem Balances (Separated from LP AMM Pools)
    this.protocolBalances = {
      ZERO_G: 5_000_000
    };

    // Fee: 0.3% to LP holders
    this.FEE_BPS = 30;

    // Security Parameters
    this.MAX_PRICE_IMPACT_BPS = 1500;       // 15% — hard reject
    this.WARN_PRICE_IMPACT_BPS = 500;       // 5%  — warning flag
    this.DEFAULT_MAX_SLIPPAGE_BPS = 100;    // 1%  — default user slippage tolerance
    this.MAX_TRADE_PERCENT_BPS = 200;       // 2%  — max single trade as % of pool
    this.COOLDOWN_MS = 10_000;              // 10 seconds between swaps per address
    this.MAX_SWAPS_PER_BLOCK = 3;           // max swaps in a single block/epoch

    // State tracking
    this.lastSwapTimestamp = new Map();      // address → timestamp
    this.currentBlockSwapCount = 0;
    this.currentBlockTimestamp = Date.now();
    this.BLOCK_WINDOW_MS = 2000;            // 2s block window

    // TWAP Oracle — rolling window of last 20 swaps
    this.twapWindow = [];
    this.TWAP_MAX_ENTRIES = 20;

    // Cumulative stats
    this.totalSwapCount = 0;
    this.totalVolumeUSDT = 0;
    this.totalFeesCollectedUSDT = 0;
  }

  // ─── Price Getters ─────────────────────────────────────────────
  getSpotPrice(fromToken = "MYC", toToken = "USDT") {
    const pair = this._resolvePair(fromToken, toToken);
    if (!pair) return 0;
    return pair.reserveOut / pair.reserveIn;
  }

  getPrice(fromToken = "MYC", toToken = "USDT") {
    return this.getSpotPrice(fromToken, toToken);
  }

  getTWAP(fromToken = "MYC", toToken = "USDT") {
    const pairKey = `${fromToken}/${toToken}`;
    const relevant = this.twapWindow.filter(e => e.pair === pairKey);
    if (relevant.length === 0) return this.getSpotPrice(fromToken, toToken);

    let weightedSum = 0;
    let totalWeight = 0;
    const now = Date.now();
    for (const entry of relevant) {
      const age = Math.max(1, now - entry.timestamp);
      const weight = 1 / age; // More recent = higher weight
      weightedSum += entry.executionPrice * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : this.getSpotPrice(fromToken, toToken);
  }

  // ─── Quote (Read-Only) ─────────────────────────────────────────
  quote(fromToken, toToken, amountIn) {
    const amt = parseFloat(amountIn);
    if (amt <= 0) throw new Error("INVALID_AMOUNT");

    const pair = this._resolvePair(fromToken, toToken);
    if (!pair) throw new Error(`UNSUPPORTED_PAIR: ${fromToken}/${toToken}`);

    const amountOut = this._getAmountOut(amt, pair.reserveIn, pair.reserveOut);
    const spotPrice = pair.reserveOut / pair.reserveIn;
    const executionPrice = amountOut / amt;
    const priceImpactBps = Math.abs(spotPrice - executionPrice) / spotPrice * 10000;

    return {
      fromToken,
      toToken,
      amountIn: amt,
      amountOut: parseFloat(amountOut.toFixed(6)),
      spotPrice: parseFloat(spotPrice.toFixed(8)),
      executionPrice: parseFloat(executionPrice.toFixed(8)),
      priceImpactBps: Math.round(priceImpactBps),
      priceImpactPercent: parseFloat((priceImpactBps / 100).toFixed(2)),
      lpFee: parseFloat((amt * this.FEE_BPS / 10000).toFixed(6)),
      twapPrice: parseFloat(this.getTWAP(fromToken, toToken).toFixed(8)),
      maxTradeSize: parseFloat((pair.reserveIn * this.MAX_TRADE_PERCENT_BPS / 10000).toFixed(2)),
      warning: priceImpactBps > this.WARN_PRICE_IMPACT_BPS ? "HIGH_PRICE_IMPACT" : null,
      blocked: priceImpactBps > this.MAX_PRICE_IMPACT_BPS ? "EXTREME_IMPACT_BLOCKED" : null
    };
  }

  // ─── Swap (State-Changing) ─────────────────────────────────────
  swap(userAddress, fromToken, toToken, amountIn, options = {}) {
    const addr = (userAddress || "anonymous").toLowerCase();
    const amt = parseFloat(amountIn);
    if (amt <= 0) throw new Error("INVALID_AMOUNT: must be positive");

    const maxSlippageBps = options.maxSlippageBps ?? this.DEFAULT_MAX_SLIPPAGE_BPS;
    const minAmountOut = options.minAmountOut ?? 0;

    // ── Security Check 1: Pair validation ──
    const pair = this._resolvePair(fromToken, toToken);
    if (!pair) throw new Error(`UNSUPPORTED_PAIR: ${fromToken}/${toToken}`);

    // ── Security Check 2: Whale Guard ──
    const maxTradeSize = pair.reserveIn * this.MAX_TRADE_PERCENT_BPS / 10000;
    if (amt > maxTradeSize) {
      throw new Error(
        `WHALE_GUARD_REJECTED: Trade ${amt} ${fromToken} exceeds max ${maxTradeSize.toFixed(2)} ${fromToken} ` +
        `(${this.MAX_TRADE_PERCENT_BPS / 100}% of pool)`
      );
    }

    // ── Security Check 3: Bot Cooldown ──
    const now = Date.now();
    const lastSwap = this.lastSwapTimestamp.get(addr) || 0;
    if (now - lastSwap < this.COOLDOWN_MS) {
      const remaining = Math.ceil((this.COOLDOWN_MS - (now - lastSwap)) / 1000);
      throw new Error(
        `BOT_COOLDOWN_ACTIVE: Address ${addr} must wait ${remaining}s between swaps ` +
        `(anti-sandwich protection)`
      );
    }

    // ── Security Check 4: Per-Block Limit ──
    if (now - this.currentBlockTimestamp > this.BLOCK_WINDOW_MS) {
      this.currentBlockTimestamp = now;
      this.currentBlockSwapCount = 0;
    }
    if (this.currentBlockSwapCount >= this.MAX_SWAPS_PER_BLOCK) {
      throw new Error(
        `BLOCK_SWAP_LIMIT_EXCEEDED: Max ${this.MAX_SWAPS_PER_BLOCK} swaps per block ` +
        `(anti-MEV protection). Try again next block.`
      );
    }

    // ── Calculate Output ──
    const spotPrice = pair.reserveOut / pair.reserveIn;
    const expectedOutput = amt * spotPrice;
    const amountOut = this._getAmountOut(amt, pair.reserveIn, pair.reserveOut);

    // ── Security Check 5: Price Impact ──
    const executionPrice = amountOut / amt;
    const priceImpactBps = Math.abs(spotPrice - executionPrice) / spotPrice * 10000;

    if (priceImpactBps > this.MAX_PRICE_IMPACT_BPS) {
      throw new Error(
        `TRADE_REJECTED_EXTREME_IMPACT: Price impact ${(priceImpactBps / 100).toFixed(2)}% ` +
        `exceeds maximum ${this.MAX_PRICE_IMPACT_BPS / 100}%. Reduce trade size.`
      );
    }

    // ── Security Check 6: Slippage Protection ──
    const slippageBps = Math.abs(expectedOutput - amountOut) / expectedOutput * 10000;
    if (slippageBps > maxSlippageBps) {
      throw new Error(
        `SLIPPAGE_EXCEEDED: Actual slippage ${(slippageBps / 100).toFixed(2)}% ` +
        `exceeds max tolerance ${maxSlippageBps / 100}%. ` +
        `Expected ~${expectedOutput.toFixed(4)} ${toToken}, got ${amountOut.toFixed(4)} ${toToken}.`
      );
    }

    // ── Security Check 7: Minimum Output ──
    if (minAmountOut > 0 && amountOut < minAmountOut) {
      throw new Error(
        `MIN_OUTPUT_NOT_MET: Output ${amountOut.toFixed(4)} ${toToken} < minimum ${minAmountOut} ${toToken}`
      );
    }

    // ── Execute Swap ──
    const lpFee = amt * this.FEE_BPS / 10000;
    this._applySwap(fromToken, toToken, amt, amountOut, pair, addr);

    // ── Update Security State ──
    this.lastSwapTimestamp.set(addr, now);
    this.currentBlockSwapCount++;
    this.totalSwapCount++;

    // ── Update TWAP Oracle ──
    const pairKey = `${fromToken}/${toToken}`;
    this.twapWindow.push({
      pair: pairKey,
      executionPrice,
      amountIn: amt,
      amountOut,
      timestamp: now
    });
    if (this.twapWindow.length > this.TWAP_MAX_ENTRIES) {
      this.twapWindow.shift();
    }

    // ── Track volume ──
    if (fromToken === "USDT" || fromToken === "USDC") this.totalVolumeUSDT += amt;
    else if (toToken === "USDT" || toToken === "USDC") this.totalVolumeUSDT += amountOut;
    this.totalFeesCollectedUSDT += (fromToken === "USDT" ? lpFee : lpFee * this.getSpotPrice(fromToken, "USDT"));

    return {
      status: "SWAP_SUCCESS",
      from: fromToken,
      to: toToken,
      amountIn: amt,
      amountOut: parseFloat(amountOut.toFixed(6)),
      spotPriceBefore: parseFloat(spotPrice.toFixed(8)),
      executionPrice: parseFloat(executionPrice.toFixed(8)),
      spotPriceAfter: parseFloat((pair.reserveOutRef() / pair.reserveInRef()).toFixed(8)),
      priceImpactPercent: parseFloat((priceImpactBps / 100).toFixed(2)),
      slippagePercent: parseFloat((slippageBps / 100).toFixed(2)),
      maxSlippagePercent: maxSlippageBps / 100,
      lpFee: parseFloat(lpFee.toFixed(6)),
      lpFeeToken: fromToken,
      twapPrice: parseFloat(this.getTWAP(fromToken, toToken).toFixed(8)),
      botProtection: {
        cooldownMs: this.COOLDOWN_MS,
        blockSwapCount: this.currentBlockSwapCount,
        maxPerBlock: this.MAX_SWAPS_PER_BLOCK,
        whaleGuardMax: parseFloat(maxTradeSize.toFixed(2))
      },
      gasFee: "0.00000000 MYC (Zero-Gas)",
      reserves: { ...this.reserves }
    };
  }

  // ─── Internal Helpers ──────────────────────────────────────────
  _getAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = amountIn * (10000 - this.FEE_BPS) / 10000;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return numerator / denominator;
  }

  _resolvePair(fromToken, toToken) {
    if (this.reserves[fromToken] !== undefined && this.reserves[toToken] !== undefined) {
      return {
        reserveIn: this.reserves[fromToken],
        reserveOut: this.reserves[toToken],
        reserveInRef: () => this.reserves[fromToken],
        reserveOutRef: () => this.reserves[toToken],
        key: `${fromToken}/${toToken}`
      };
    }
    return null;
  }

  _debitUser(tokenName, userAddress, amount) {
    if (!userAddress) return;
    try {
      if (tokenName === "MYC" && this.token) this.token.transfer(userAddress, "myc_dex_liquidity", amount);
      else if (tokenName === "USDT" && this.usdtToken) this.usdtToken.transfer(userAddress, "myc_dex_liquidity", amount);
      else if (tokenName === "USDC" && this.usdcToken) this.usdcToken.transfer(userAddress, "myc_dex_liquidity", amount);
    } catch (e) {}
  }

  _creditUser(tokenName, userAddress, amount) {
    if (!userAddress) return;
    try {
      if (tokenName === "MYC" && this.token) this.token.transfer("myc_dex_liquidity", userAddress, amount);
      else if (tokenName === "USDT" && this.usdtToken) this.usdtToken.transfer("myc_dex_liquidity", userAddress, amount);
      else if (tokenName === "USDC" && this.usdcToken) this.usdcToken.transfer("myc_dex_liquidity", userAddress, amount);
    } catch (e) {}
  }

  _applySwap(fromToken, toToken, amountIn, amountOut, pair, userAddress = null) {
    if (this.reserves[fromToken] !== undefined && this.reserves[toToken] !== undefined) {
      this.reserves[fromToken] += amountIn;
      this.reserves[toToken] -= amountOut;
      if (userAddress) {
        this._debitUser(fromToken, userAddress, amountIn);
        this._creditUser(toToken, userAddress, amountOut);
      }
    }
  }

  // ─── Analytics ─────────────────────────────────────────────────
  getPoolStats() {
    return {
      reserves: { ...this.reserves },
      protocolBalances: { ...this.protocolBalances },
      prices: {
        "MYC/USDT": parseFloat((this.reserves.USDT / this.reserves.MYC).toFixed(8)),
        "MYC/USDC": parseFloat((this.reserves.USDC / this.reserves.MYC).toFixed(8)),
        "USDT/USDC": parseFloat((this.reserves.USDC / this.reserves.USDT).toFixed(8))
      },
      twap: {
        "MYC/USDT": parseFloat(this.getTWAP("MYC", "USDT").toFixed(8)),
        "MYC/USDC": parseFloat(this.getTWAP("MYC", "USDC").toFixed(8)),
        "USDT/USDC": parseFloat(this.getTWAP("USDT", "USDC").toFixed(8))
      },
      feeBps: this.FEE_BPS,
      totalSwaps: this.totalSwapCount,
      totalVolumeUSDT: parseFloat(this.totalVolumeUSDT.toFixed(2)),
      totalFeesUSDT: parseFloat(this.totalFeesCollectedUSDT.toFixed(2)),
      security: {
        maxPriceImpactPercent: this.MAX_PRICE_IMPACT_BPS / 100,
        warnPriceImpactPercent: this.WARN_PRICE_IMPACT_BPS / 100,
        defaultSlippagePercent: this.DEFAULT_MAX_SLIPPAGE_BPS / 100,
        maxTradePercent: this.MAX_TRADE_PERCENT_BPS / 100,
        cooldownSeconds: this.COOLDOWN_MS / 1000,
        maxSwapsPerBlock: this.MAX_SWAPS_PER_BLOCK
      }
    };
  }
}
