/**
 * $MYC Sovereign Network Token Specification
 * Total Supply: 1,000,000,000 MYC (1 Billion Fixed)
 */
export class MycToken {
  constructor() {
    this.name = "MYC Network Token";
    this.symbol = "MYC";
    this.decimals = 18;
    this.totalSupply = 1_000_000_000n * 10n**18n; // 1 Billion
    this.balances = new Map();

    // Genesis Allocation
    this.genesisAddress = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
    this.balances.set(this.genesisAddress, 490_000_000n * 10n**18n); // 490M to genesis wallet
    this.balances.set("myc_staking_vault", 300_000_000n * 10n**18n);  // 300M reward pool
    this.balances.set("myc_dex_liquidity", 200_000_000n * 10n**18n);  // 200M DEX pool
    this.balances.set("myc_bridge_escrow", 10_000_000n * 10n**18n);   // 10M Bridge Escrow
  }

  balanceOf(address) {
    const raw = this.balances.get(address) || 0n;
    return Number(raw / 10n**18n);
  }

  transfer(from, to, amount) {
    const amountBig = BigInt(Math.floor(amount)) * 10n**18n;
    const senderBal = this.balances.get(from) || 0n;
    if (senderBal < amountBig) throw new Error("Insufficient $MYC balance");

    this.balances.set(from, senderBal - amountBig);
    const receiverBal = this.balances.get(to) || 0n;
    this.balances.set(to, receiverBal + amountBig);
    return true;
  }
}
