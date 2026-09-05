/**
 * NeuroYieldPool — Zero-Gas DeFi Staking Contract for MYC Contract VM
 * Deployed on Chain ID 108 with zero gas fees.
 */
export class NeuroYieldPool {
  constructor() {
    this.name = "NeuroYieldPool";
    this.symbol = "NYP";
    this.apyBasisPoints = 1450; // 14.5% Annual Zero-Gas Yield
    this.stakers = new Map(); // address => { amount, lastClaimTime, totalClaimed }
    this.totalStaked = 0;
  }

  /**
   * Stake MYC tokens into the pool (Zero-Gas)
   */
  stake(amount, context = {}) {
    const sender = context.msgSender || "myc1anonymous000000000000000000000000";
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_STAKE_AMOUNT");

    let record = this.stakers.get(sender);
    if (!record) {
      record = { amount: 0, lastClaimTime: Date.now(), totalClaimed: 0 };
    } else {
      // Auto compound previous pending yield
      const pending = this._calculateYield(record);
      record.totalClaimed += pending;
    }

    record.amount += amt;
    record.lastClaimTime = Date.now();
    this.stakers.set(sender, record);
    this.totalStaked += amt;

    return {
      status: "STAKED_SUCCESS",
      staker: sender,
      amount: amt,
      totalStakedByUser: record.amount,
      poolTotal: this.totalStaked,
      gasFee: "0.00 MYC"
    };
  }

  /**
   * Claim accrued zero-gas yield
   */
  claimYield(context = {}) {
    const sender = context.msgSender || "myc1anonymous000000000000000000000000";
    const record = this.stakers.get(sender);
    if (!record || record.amount <= 0) throw new Error("NO_ACTIVE_STAKE");

    const reward = this._calculateYield(record);
    record.totalClaimed += reward;
    record.lastClaimTime = Date.now();
    this.stakers.set(sender, record);

    return {
      status: "YIELD_CLAIMED",
      staker: sender,
      rewardClaimed: reward,
      totalClaimedLifetime: record.totalClaimed,
      gasFee: "0.00 MYC"
    };
  }

  /**
   * Unstake tokens from pool
   */
  unstake(amount, context = {}) {
    const sender = context.msgSender || "myc1anonymous000000000000000000000000";
    const record = this.stakers.get(sender);
    const amt = parseFloat(amount);

    if (!record || record.amount < amt) throw new Error("INSUFFICIENT_STAKE_BALANCE");

    record.amount -= amt;
    record.lastClaimTime = Date.now();
    this.stakers.set(sender, record);
    this.totalStaked -= amt;

    return {
      status: "UNSTAKED_SUCCESS",
      staker: sender,
      unstakedAmount: amt,
      remainingStake: record.amount,
      gasFee: "0.00 MYC"
    };
  }

  /**
   * Read-only: Query staker position
   */
  getStakeInfo(account) {
    const record = this.stakers.get(account);
    if (!record) return { amount: 0, pendingYield: 0, totalClaimed: 0, apy: "14.5%" };
    return {
      amount: record.amount,
      pendingYield: this._calculateYield(record),
      totalClaimed: record.totalClaimed,
      apy: "14.5%"
    };
  }

  _calculateYield(record) {
    // 14.5% annual yield calculated with simulated duration
    const annualRate = this.apyBasisPoints / 10000;
    return Number((record.amount * annualRate * 0.01).toFixed(4));
  }
}
