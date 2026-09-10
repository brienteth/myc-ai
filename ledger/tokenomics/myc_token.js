import { MycHardwareWallet } from "../../core/crypto/wallet.js";

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

  _norm(addr) {
    if (!addr || typeof addr !== "string") return "";
    return MycHardwareWallet.normalizeAddress(addr);
  }

  balanceOf(address) {
    if (!address) return 0;
    const norm = this._norm(address);
    const raw = this.balances.get(norm) ?? this.balances.get(address) ?? 0n;
    return Number(raw / 10n**18n);
  }

  transfer(from, to, amount) {
    const fromNorm = this._norm(from) || from;
    const toNorm = this._norm(to) || to;
    const amountBig = BigInt(Math.floor(amount)) * 10n**18n;

    let senderBal = this.balances.get(fromNorm);
    let senderKey = fromNorm;
    if (senderBal === undefined || senderBal === null) {
      senderBal = this.balances.get(from) || 0n;
      senderKey = from;
    }

    if (senderBal < amountBig) {
      throw new Error(`Insufficient $MYC balance. Available: ${Number(senderBal / 10n**18n)} MYC, Required: ${amount} MYC`);
    }

    this.balances.set(senderKey, senderBal - amountBig);

    let receiverBal = this.balances.get(toNorm);
    let receiverKey = toNorm;
    if (receiverBal === undefined || receiverBal === null) {
      receiverBal = this.balances.get(to) || 0n;
    }
    this.balances.set(receiverKey, receiverBal + amountBig);
    return true;
  }
}
