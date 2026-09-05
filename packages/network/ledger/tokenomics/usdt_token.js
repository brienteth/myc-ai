/**
 * $USDT Testnet Sovereign Token Specification
 * Tether USD on MYC Network (Chain ID 108)
 * 
 * Standard 6 Decimals (matching real-world USDT)
 * Initial Supply: 100,000,000 USDT
 */
export class MycUSDToken {
  constructor() {
    this.name = "Tether USD (MYC Testnet)";
    this.symbol = "USDT";
    this.decimals = 6;
    this.multiplier = 10n ** 6n;
    this.totalSupply = 100_000_000n * this.multiplier;
    this.balances = new Map();

    // Genesis Allocations
    this.genesisAddress = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
    this.dexLiquidityVault = "myc_dex_liquidity";
    this.faucetPoolAddress = "myc_usdt_faucet_vault";

    this.bridgeEscrowVault = "myc_bridge_escrow";

    // 1,000,000 USDT locked in AMM DEX Pool
    this.balances.set(this.dexLiquidityVault, 1_000_000n * this.multiplier);
    // 10,000,000 USDT to Faucet Pool for testnet users
    this.balances.set(this.faucetPoolAddress, 10_000_000n * this.multiplier);
    // 5,000,000 USDT in Bridge Escrow Reserve for inbound releases
    this.balances.set(this.bridgeEscrowVault, 5_000_000n * this.multiplier);
    // 84,000,000 USDT to Genesis Deployer
    this.balances.set(this.genesisAddress, 84_000_000n * this.multiplier);
  }

  balanceOf(address) {
    const addr = (address || "").toLowerCase();
    const raw = this.balances.get(addr) || 0n;
    return Number(raw) / 10**6;
  }

  rawBalanceOf(address) {
    const addr = (address || "").toLowerCase();
    return this.balances.get(addr) || 0n;
  }

  transfer(from, to, amount) {
    const fromAddr = (from || "").toLowerCase();
    const toAddr = (to || "").toLowerCase();
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) throw new Error("INVALID_USDT_AMOUNT");

    const amountRaw = BigInt(Math.round(amtNum * 10**6));
    const senderBal = this.balances.get(fromAddr) || 0n;
    if (senderBal < amountRaw) {
      throw new Error(`INSUFFICIENT_USDT_BALANCE: sender has ${Number(senderBal)/10**6} USDT, required ${amtNum} USDT`);
    }

    this.balances.set(fromAddr, senderBal - amountRaw);
    const receiverBal = this.balances.get(toAddr) || 0n;
    this.balances.set(toAddr, receiverBal + amountRaw);
    return true;
  }

  mint(to, amount) {
    const toAddr = (to || "").toLowerCase();
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) throw new Error("INVALID_MINT_AMOUNT");

    const amountRaw = BigInt(Math.round(amtNum * 10**6));
    const current = this.balances.get(toAddr) || 0n;
    this.balances.set(toAddr, current + amountRaw);
    this.totalSupply += amountRaw;
    return true;
  }
}
