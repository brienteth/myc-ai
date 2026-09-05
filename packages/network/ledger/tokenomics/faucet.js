import { MycHardwareWallet } from "../../core/crypto/wallet.js";

/**
 * MYC Network Testnet Faucet
 * Dispenses 5 $MYC testnet tokens per request.
 * Enforces:
 * 1. 24-Hour (1 day) cooldown per wallet address.
 * 2. 24-Hour cooldown per Twitter/X handle.
 * 3. Mandatory @myc_ai Twitter/X follow verification.
 * 4. Custom recipient wallet address support.
 */
export class MycFaucet {
  constructor(token) {
    this.token = token;
    this.dispenseAmount = 5; // 5 $MYC per claim
    this.cooldownMs = 24 * 60 * 60 * 1000; // 24 hours (1 gün)
    this.claimHistory = new Map(); // normalizedAddress => timestamp
    this.twitterHistory = new Map(); // normalizedTwitterHandle => timestamp
    this.faucetPoolAddress = "myc_testnet_faucet_vault";
    
    // Allocate 50,000,000 MYC for testnet faucet
    this.token.balances.set(this.faucetPoolAddress, 50_000_000n * 10n**18n);
  }

  /**
   * Normalize Twitter/X handle: trim, strip leading '@', lowercase.
   */
  normalizeTwitter(handle) {
    if (!handle || typeof handle !== "string") return "";
    return handle.trim().replace(/^@+/, "").toLowerCase();
  }

  /**
   * Checks eligibility for an address and optional twitter handle.
   */
  getStatus(address, twitterHandle = "") {
    const now = Date.now();
    let addressEligible = true;
    let addressRemainingSec = 0;
    let twitterEligible = true;
    let twitterRemainingSec = 0;

    if (address) {
      const normalized = MycHardwareWallet.normalizeAddress(address);
      const last = this.claimHistory.get(normalized);
      if (last && now - last < this.cooldownMs) {
        addressEligible = false;
        addressRemainingSec = Math.ceil((this.cooldownMs - (now - last)) / 1000);
      }
    }

    const cleanTwitter = this.normalizeTwitter(twitterHandle);
    if (cleanTwitter) {
      const lastTw = this.twitterHistory.get(cleanTwitter);
      if (lastTw && now - lastTw < this.cooldownMs) {
        twitterEligible = false;
        twitterRemainingSec = Math.ceil((this.cooldownMs - (now - lastTw)) / 1000);
      }
    }

    const eligible = addressEligible && twitterEligible;
    const maxRemainingSec = Math.max(addressRemainingSec, twitterRemainingSec);

    return {
      eligible,
      dispenseAmount: this.dispenseAmount,
      cooldownHours: 24,
      addressEligible,
      addressRemainingSec,
      twitterEligible,
      twitterRemainingSec,
      maxRemainingSec,
      requiredTwitterFollow: "@myc_ai"
    };
  }

  /**
   * Dispense 5 $MYC to recipient address.
   * Requires Twitter handle and follow confirmation.
   */
  requestTokens(recipientAddress, twitterHandle, verifiedFollow = false) {
    if (!recipientAddress) {
      throw new Error("Hedef cüzdan adresi girilmelidir.");
    }

    const normalized = MycHardwareWallet.normalizeAddress(recipientAddress);
    if (!MycHardwareWallet.isValidAddress(normalized)) {
      throw new Error(`Geçersiz cüzdan adresi: '${recipientAddress}'. Adres 'myc1' ile başlamalı ve 36 karakterden oluşmalıdır (Örn: myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002).`);
    }

    // Twitter verification
    const cleanTwitter = this.normalizeTwitter(twitterHandle);
    if (!cleanTwitter || cleanTwitter.length < 2 || cleanTwitter.length > 30) {
      throw new Error("Geçerli bir Twitter / X kullanıcı adı girilmelidir (Örn: @kullaniciadi).");
    }

    if (!verifiedFollow) {
      throw new Error("Musluktan yararlanmak için Twitter / X üzerinden @myc_ai hesabını takip etmeniz gerekmektedir.");
    }

    const now = Date.now();

    // Check address 24-hour cooldown
    const lastAddressClaim = this.claimHistory.get(normalized);
    if (lastAddressClaim && now - lastAddressClaim < this.cooldownMs) {
      const remainingMs = this.cooldownMs - (now - lastAddressClaim);
      const hours = Math.floor(remainingMs / (3600 * 1000));
      const mins = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
      throw new Error(`Bu cüzdan adresi için günlük musluk limiti doldu. Günde sadece 1 kez ${this.dispenseAmount} MYC talep edebilirsiniz. Kalan süre: ${hours} saat ${mins} dakika.`);
    }

    // Check twitter 24-hour cooldown
    const lastTwitterClaim = this.twitterHistory.get(cleanTwitter);
    if (lastTwitterClaim && now - lastTwitterClaim < this.cooldownMs) {
      const remainingMs = this.cooldownMs - (now - lastTwitterClaim);
      const hours = Math.floor(remainingMs / (3600 * 1000));
      const mins = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
      throw new Error(`Bu Twitter / X hesabı (@${cleanTwitter}) ile bugün zaten musluk alındı. Günde 1 kez talep edilebilir. Kalan süre: ${hours} saat ${mins} dakika.`);
    }

    // Transfer from faucet pool to user
    const amountBig = BigInt(this.dispenseAmount) * 10n**18n;
    const poolBal = this.token.balances.get(this.faucetPoolAddress) || 0n;
    if (poolBal < amountBig) throw new Error("Musluk havuzu tükendi.");

    this.token.balances.set(this.faucetPoolAddress, poolBal - amountBig);
    const userBal = this.token.balances.get(normalized) || 0n;
    this.token.balances.set(normalized, userBal + amountBig);

    // Record claims
    this.claimHistory.set(normalized, now);
    this.twitterHistory.set(cleanTwitter, now);

    return {
      status: "FAUCET_DISPENSED",
      recipient: normalized,
      amount: this.dispenseAmount,
      tokenSymbol: "MYC",
      twitterHandle: `@${cleanTwitter}`,
      twitterFollowed: true,
      cooldownHours: 24,
      nextEligibleAt: new Date(now + this.cooldownMs).toISOString(),
      network: "MYC-TESTNET-SPHEROID-1",
      txHash: "0x" + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join(""),
      newBalance: Number((userBal + amountBig) / 10n**18n),
      timestamp: new Date().toISOString()
    };
  }
}
