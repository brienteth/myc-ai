import test from "node:test";
import assert from "node:assert/strict";
import { MycFaucet } from "../ledger/tokenomics/faucet.js";
import { MycHardwareWallet } from "../core/crypto/wallet.js";

test("MYC Testnet Faucet: 5 MYC, 24h Cooldown, Twitter @myc_ai Verification, Custom Recipient", async (t) => {
  const mockToken = {
    balances: new Map(),
    balanceOf(addr) {
      return Number((this.balances.get(addr) || 0n) / 10n**18n);
    }
  };

  const faucet = new MycFaucet(mockToken);
  const testWalletA = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
  const testWalletB = "myc16999b6c4b38b2ac4a6e2bbb9c4d7c999";

  await t.test("1. Should fail when recipient address is missing or invalid", () => {
    assert.throws(() => faucet.requestTokens("", "@testuser", true), /Hedef cüzdan adresi girilmelidir/);
    assert.throws(() => faucet.requestTokens("0x1234", "@testuser", true), /Geçersiz cüzdan adresi/);
  });

  await t.test("2. Should fail when Twitter handle is missing or invalid", () => {
    assert.throws(() => faucet.requestTokens(testWalletA, "", true), /Geçerli bir Twitter \/ X kullanıcı adı/);
    assert.throws(() => faucet.requestTokens(testWalletA, "@", true), /Geçerli bir Twitter \/ X kullanıcı adı/);
  });

  await t.test("3. Should fail when Twitter follow is not confirmed", () => {
    assert.throws(() => faucet.requestTokens(testWalletA, "@testuser", false), /@myc_ai hesabını takip etmeniz gerekmektedir/);
  });

  await t.test("4. Should successfully dispense 5 MYC to custom recipient address", () => {
    const claim = faucet.requestTokens(testWalletA, "@dev_pilot", true);
    assert.equal(claim.status, "FAUCET_DISPENSED");
    assert.equal(claim.amount, 5);
    assert.equal(claim.recipient, testWalletA);
    assert.equal(claim.twitterHandle, "@dev_pilot");
    assert.equal(claim.twitterFollowed, true);
    assert.equal(claim.cooldownHours, 24);
    assert.equal(mockToken.balanceOf(testWalletA), 5);
  });

  await t.test("5. Should reject second claim from same address within 24 hours", () => {
    assert.throws(
      () => faucet.requestTokens(testWalletA, "@different_twitter", true),
      /Bu cüzdan adresi için günlük musluk limiti doldu/
    );
  });

  await t.test("6. Should reject claim from different address using same Twitter handle within 24 hours", () => {
    assert.throws(
      () => faucet.requestTokens(testWalletB, "@dev_pilot", true),
      /Bu Twitter \/ X hesabı \(@dev_pilot\) ile bugün zaten musluk alındı/
    );
  });

  await t.test("7. Should allow different address with different Twitter handle", () => {
    const claim = faucet.requestTokens(testWalletB, "@crypto_analyst", true);
    assert.equal(claim.amount, 5);
    assert.equal(claim.recipient, testWalletB);
    assert.equal(claim.twitterHandle, "@crypto_analyst");
    assert.equal(mockToken.balanceOf(testWalletB), 5);
  });

  await t.test("8. Should provide accurate status via getStatus()", () => {
    const statusA = faucet.getStatus(testWalletA, "@dev_pilot");
    assert.equal(statusA.eligible, false);
    assert.equal(statusA.addressEligible, false);
    assert.equal(statusA.twitterEligible, false);
    assert.equal(statusA.dispenseAmount, 5);

    const statusC = faucet.getStatus("myc19999b6c4b38b2ac4a6e2bbb9c4d7c999", "@brand_new_handle");
    assert.equal(statusC.eligible, true);
    assert.equal(statusC.addressEligible, true);
    assert.equal(statusC.twitterEligible, true);
  });
});
