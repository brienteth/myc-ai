/**
 * MYC NeuroYield & DePIN Staking Vault
 * Stake $MYC to earn APY based on strategies (Flexible, 30-Day Boosted, 90-Day NeuroVault).
 * Supports Real-time Claiming, Auto-Compounding, and Zero-Gas Unstaking.
 */
export class MycStakingPool {
  constructor(token) {
    this.token = token;
    this.totalStaked = 0;
    this.stakes = new Map(); // address => { amount, apy, tier, lockDays, lockedUntil, machineQuota, unclaimedRewards, lastRewardCalcAt }

    // Seed default Genesis Dev Stake so stats are lively on start
    this.stakes.set("myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002", {
      amount: 1250,
      apy: 0.145,
      tier: "FLEXIBLE",
      lockDays: 0,
      lockedUntil: 0,
      machineQuota: 15,
      unclaimedRewards: 18.24,
      lastRewardCalcAt: Date.now() - 3600 * 1000 * 48 // 48h ago
    });
    this.totalStaked = 1250;
  }

  getStrategyMeta(tier = "FLEXIBLE") {
    const key = (tier || "FLEXIBLE").toUpperCase();
    const strategies = {
      FLEXIBLE: {
        name: "Flexible Spore Yield",
        apy: 0.145, // 14.5%
        lockDays: 0,
        quota: 15,
        description: "Anında çekilebilir, 0 gün kilit, esnek günlük getiri."
      },
      BOOSTED_30D: {
        name: "30-Day Mycelial Lock",
        apy: 0.210, // 21.0%
        lockDays: 30,
        quota: 65,
        description: "30 gün kilit, 1.45x Rezonans çarpanı, yüksek getiri."
      },
      NEURO_90D: {
        name: "90-Day Consensus NeuroVault",
        apy: 0.285, // 28.5%
        lockDays: 90,
        quota: 500,
        description: "90 gün kilit, maksimum validatör getirisi, en yüksek donanım kotası."
      }
    };
    return strategies[key] || strategies.FLEXIBLE;
  }

  calculatePendingRewards(address) {
    const stake = this.stakes.get(address);
    if (!stake || stake.amount <= 0) return (stake && stake.unclaimedRewards) || 0;

    const now = Date.now();
    const lastCalc = stake.lastRewardCalcAt || now;
    const elapsedSec = Math.max(0, (now - lastCalc) / 1000);

    // Annual Yield = amount * apy
    // Per Second Yield = Annual Yield / (365 * 86400)
    const perSecYield = (stake.amount * (stake.apy || 0.145)) / (365 * 86400);
    const newAccrued = perSecYield * elapsedSec;

    return parseFloat(((stake.unclaimedRewards || 0) + newAccrued).toFixed(4));
  }

  stake(address, amount, tier = "FLEXIBLE") {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_AMOUNT: Stake amount must be greater than 0");

    // Check balance
    const userBal = this.token.balanceOf(address);
    if (userBal < amt) {
      throw new Error(`INSUFFICIENT_BALANCE: Have ${userBal.toFixed(2)} MYC, need ${amt} MYC`);
    }

    // Transfer to vault
    this.token.transfer(address, "myc_staking_vault", amt);

    const strat = this.getStrategyMeta(tier);
    const now = Date.now();

    // Settle existing accrued rewards first
    const pending = this.calculatePendingRewards(address);

    const existing = this.stakes.get(address) || {
      amount: 0,
      machineQuota: 0,
      unclaimedRewards: 0
    };

    existing.amount += amt;
    existing.apy = strat.apy;
    existing.tier = tier.toUpperCase();
    existing.lockDays = strat.lockDays;
    existing.lockedUntil = now + (strat.lockDays * 86400 * 1000);
    existing.machineQuota = (existing.machineQuota || 0) + strat.quota;
    existing.unclaimedRewards = pending;
    existing.lastRewardCalcAt = now;
    existing.lastStakedAt = now;

    this.stakes.set(address, existing);
    this.totalStaked += amt;

    return {
      status: "SUCCESS_STAKED",
      strategy: strat.name,
      stakedAmount: existing.amount,
      newDeposit: amt,
      apyRate: `${(strat.apy * 100).toFixed(1)}% APY`,
      lockDays: strat.lockDays,
      lockedUntil: existing.lockedUntil,
      unclaimedRewards: existing.unclaimedRewards,
      machineQuotaUnlocked: existing.machineQuota,
      gasModel: "0.00 MYC (Zero-Gas Guarantee)"
    };
  }

  claimRewards(address) {
    const stake = this.stakes.get(address);
    if (!stake || stake.amount <= 0) {
      const unclaimed = (stake && stake.unclaimedRewards) || 0;
      if (unclaimed <= 0) throw new Error("NO_REWARDS_AVAILABLE: No yield currently accrued");
    }

    const pending = this.calculatePendingRewards(address);
    if (pending <= 0.0001) {
      throw new Error("MIN_CLAIM_THRESHOLD: Accrued rewards are too small to claim (<0.0001 MYC)");
    }

    // Transfer from vault to user
    try {
      this.token.transfer("myc_staking_vault", address, pending);
    } catch (e) {
      // If vault needs mint/transfer fallback
      this.token.mint(address, pending);
    }

    const now = Date.now();
    stake.unclaimedRewards = 0;
    stake.lastRewardCalcAt = now;
    this.stakes.set(address, stake);

    return {
      status: "SUCCESS_CLAIMED",
      claimedAmount: pending,
      recipient: address,
      remainingStake: stake.amount,
      newWalletBalance: this.token.balanceOf(address),
      timestamp: new Date().toISOString()
    };
  }

  compoundRewards(address) {
    const stake = this.stakes.get(address);
    const pending = this.calculatePendingRewards(address);
    if (pending <= 0.01) {
      throw new Error("MIN_COMPOUND_THRESHOLD: Minimum 0.01 MYC needed to compound");
    }

    const now = Date.now();
    stake.amount += pending;
    stake.unclaimedRewards = 0;
    stake.lastRewardCalcAt = now;
    this.totalStaked += pending;
    this.stakes.set(address, stake);

    return {
      status: "SUCCESS_COMPOUNDED",
      compoundedAmount: pending,
      newTotalStake: stake.amount,
      apyRate: `${(stake.apy * 100).toFixed(1)}% APY`,
      timestamp: new Date().toISOString()
    };
  }

  unstake(address, amount) {
    const stake = this.stakes.get(address);
    if (!stake || stake.amount <= 0) {
      throw new Error("NO_ACTIVE_STAKE: You have no active stake to withdraw");
    }

    const amt = amount ? parseFloat(amount) : stake.amount;
    if (isNaN(amt) || amt <= 0 || amt > stake.amount) {
      throw new Error(`INVALID_UNSTAKE_AMOUNT: Max available is ${stake.amount} MYC`);
    }

    const now = Date.now();
    if (stake.lockedUntil && now < stake.lockedUntil) {
      const remainingHours = Math.ceil((stake.lockedUntil - now) / (3600 * 1000));
      throw new Error(`STAKE_LOCKED: Locked under ${stake.tier} strategy. Remaining lock: ${remainingHours} hours`);
    }

    // Settle rewards before principal removal
    const pending = this.calculatePendingRewards(address);

    // Return principal
    this.token.transfer("myc_staking_vault", address, amt);

    stake.amount -= amt;
    stake.unclaimedRewards = pending;
    stake.lastRewardCalcAt = now;
    this.totalStaked = Math.max(0, this.totalStaked - amt);

    this.stakes.set(address, stake);

    return {
      status: "SUCCESS_UNSTAKED",
      unstakedAmount: amt,
      remainingStake: stake.amount,
      unclaimedRewards: stake.unclaimedRewards,
      newWalletBalance: this.token.balanceOf(address)
    };
  }

  getStakeInfo(address) {
    const stake = this.stakes.get(address);
    if (!stake) {
      return {
        amount: 0,
        apy: 0.145,
        tier: "FLEXIBLE",
        unclaimedRewards: 0,
        machineQuota: 0,
        lockedUntil: 0
      };
    }
    const pending = this.calculatePendingRewards(address);
    return {
      amount: stake.amount,
      apy: stake.apy || 0.145,
      tier: stake.tier || "FLEXIBLE",
      unclaimedRewards: pending,
      machineQuota: stake.machineQuota || 0,
      lockedUntil: stake.lockedUntil || 0
    };
  }
}
