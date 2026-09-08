#!/usr/bin/env node
import { MycToken } from "../ledger/tokenomics/myc_token.js";
import { MycStakingPool } from "../ledger/tokenomics/staking.js";
import { MycSwapDex } from "../ledger/tokenomics/swap_dex.js";

const token = new MycToken();
const staking = new MycStakingPool(token);
const dex = new MycSwapDex(token);

const user = token.genesisAddress;

console.log("====================================================================");
console.log("🪙 MYC NETWORK TOKENOMICS, DEPIN STAKING & DEX SWAP ENGINE");
console.log("====================================================================");
console.log("KULLANICI CÜZDANI :", user);
console.log("BAŞLANGIÇ $MYC    :", token.balanceOf(user).toLocaleString(), "MYC");
console.log("--------------------------------------------------------------------");

console.log("1️⃣ [SWAP TESTİ] 1,000 USDT Verip $MYC Alınıyor (DEX Alımı)...");
const swapResult = dex.swap(user, "USDT", "MYC", 1000);
console.log(`   • Yatırılan : 1,000 USDT`);
console.log(`   • Alınan    : +${swapResult.amountOut.toLocaleString()} $MYC`);
console.log(`   • Birim Fiyat: $0.10`);
console.log(`   • Kayma     : ${swapResult.slippage}`);

console.log("--------------------------------------------------------------------");
console.log("2️⃣ [DEPIN STAKE TESTİ] 5,000 $MYC Stake Edilerek 50 Makineye Sıfır Gaz Kotası Açılıyor...");
const stakeResult = staking.stake(user, 5000, "DEPIN_TIER_2");
console.log(`   • Stake Edilen   : 5,000 $MYC`);
console.log(`   • Yıllık Getiri  : ${stakeResult.apyRate}`);
console.log(`   • Açılan Kota    : ${stakeResult.machineQuotaUnlocked} Adet Fiziksel Makine / Cihaz`);
console.log(`   • Cihaz Gazı     : SIFIR GAZ AKTİF (Ömür Boyu Bedelsiz İletişim)`);

console.log("--------------------------------------------------------------------");
console.log("GÜNCEL CÜZDAN $MYC BAKİYESİ:", token.balanceOf(user).toLocaleString(), "$MYC");
console.log("====================================================================");
