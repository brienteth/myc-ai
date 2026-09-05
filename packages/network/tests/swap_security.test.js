/**
 * MycSwap Security Test Suite
 * 
 * Tests all 7 security layers:
 *  1. Slippage protection
 *  2. Price impact rejection
 *  3. Bot cooldown (10s per-address)
 *  4. Per-block swap limit
 *  5. Whale guard (2% max)
 *  6. TWAP oracle accuracy
 *  7. Minimum output floor
 */

import { MycSwapDex } from "../ledger/tokenomics/swap_dex.js";
import { MycToken } from "../ledger/tokenomics/myc_token.js";
import { MycUSDToken } from "../ledger/tokenomics/usdt_token.js";
import { MycUSDCToken } from "../ledger/tokenomics/usdc_token.js";

console.log("====================================================================");
console.log("🔒 RUNNING SUITE: MYCSWAP SECURITY & ANTI-BOT VERIFICATION");
console.log("====================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [TEST ${total} PASS] ${testName}`);
  } else {
    console.error(`  ❌ [TEST ${total} FAIL] ${testName}`);
  }
}

// ─── Setup ───────────────────────────────────────────────────────
const dex = new MycSwapDex(null);

// ═══════════════════════════════════════════════════════════════════
// 1. Basic Swap Functionality
// ═══════════════════════════════════════════════════════════════════
console.log("\n📊 BASIC SWAP FUNCTIONALITY\n");

const basicSwap = dex.swap("user_alice", "USDT", "MYC", 100);
assert(basicSwap.status === "SWAP_SUCCESS", "Basic USDT→MYC swap succeeds");
assert(basicSwap.amountOut > 0, `Output: ${basicSwap.amountOut} MYC`);
assert(basicSwap.gasFee === "0.00000000 MYC (Zero-Gas)", "Zero-gas invariant");
assert(basicSwap.priceImpactPercent >= 0, `Price impact: ${basicSwap.priceImpactPercent}%`);
assert(basicSwap.slippagePercent >= 0, `Slippage: ${basicSwap.slippagePercent}%`);
assert(basicSwap.lpFee > 0, `LP fee: ${basicSwap.lpFee} USDT`);
assert(basicSwap.botProtection.cooldownMs === 10000, "Cooldown tracking active");

// ═══════════════════════════════════════════════════════════════════
// 2. Quote (Read-Only)
// ═══════════════════════════════════════════════════════════════════
console.log("\n📋 QUOTE / PRICE IMPACT\n");

const smallQuote = dex.quote("MYC", "USDT", 100);
assert(smallQuote.amountOut > 0, `Small quote: 100 MYC → ${smallQuote.amountOut} USDT`);
assert(smallQuote.priceImpactPercent < 1, `Small trade impact: ${smallQuote.priceImpactPercent}% (< 1%)`);

const mediumQuote = dex.quote("MYC", "USDT", 50000);
assert(mediumQuote.priceImpactPercent > smallQuote.priceImpactPercent,
  `Medium trade has higher impact: ${mediumQuote.priceImpactPercent}%`);

// ═══════════════════════════════════════════════════════════════════
// 3. Slippage Protection
// ═══════════════════════════════════════════════════════════════════
console.log("\n🛡️ SLIPPAGE PROTECTION\n");

// Normal swap with generous slippage tolerance should pass
const slipOk = dex.swap("user_bob", "MYC", "USDT", 500, { maxSlippageBps: 500 });
assert(slipOk.status === "SWAP_SUCCESS", "Swap with 5% slippage tolerance passes");

// Tight slippage on a significant trade should fail
try {
  // Use a fresh address for cooldown and a large enough trade
  dex.swap("user_charlie_slip", "MYC", "USDT", 100000, { maxSlippageBps: 1 });
  assert(false, "Extremely tight slippage (0.01%) should reject large trade");
} catch (e) {
  const isSlippageOrWhale = e.message.includes("SLIPPAGE_EXCEEDED") || e.message.includes("WHALE_GUARD");
  assert(isSlippageOrWhale, `Trade rejected: ${e.message.split(":")[0]}`);
}

// ═══════════════════════════════════════════════════════════════════
// 4. Whale Guard (2% Max)
// ═══════════════════════════════════════════════════════════════════
console.log("\n🐳 WHALE GUARD\n");

const maxAllowed = dex.reserves.MYC * 0.02;
try {
  dex.swap("user_whale", "MYC", "USDT", maxAllowed + 1);
  assert(false, "Whale trade exceeding 2% should be rejected");
} catch (e) {
  assert(e.message.includes("WHALE_GUARD_REJECTED"),
    `Whale guard blocks >2% trade (max: ${maxAllowed.toFixed(0)} MYC)`);
}

// Just under limit should work (with adequate slippage tolerance for large trade)
const safeWhaleAmount = maxAllowed * 0.5;
const whaleSwap = dex.swap("user_safe_whale", "MYC", "USDT", safeWhaleAmount, { maxSlippageBps: 300 });
assert(whaleSwap.status === "SWAP_SUCCESS", `1% of pool swap allowed: ${safeWhaleAmount.toFixed(0)} MYC`);

// ═══════════════════════════════════════════════════════════════════
// 5. Bot Cooldown (10s per-address)
// ═══════════════════════════════════════════════════════════════════
console.log("\n🤖 BOT / SANDWICH COOLDOWN\n");

// First swap from new address (reset block limit for test isolation)
dex.currentBlockTimestamp = 0;
dex.currentBlockSwapCount = 0;
const botAddr = "bot_0xdead";
const firstSwap = dex.swap(botAddr, "USDT", "MYC", 10);
assert(firstSwap.status === "SWAP_SUCCESS", "First swap from address succeeds");

// Immediate second swap from same address should fail
try {
  dex.swap(botAddr, "USDT", "MYC", 10);
  assert(false, "Immediate second swap should be blocked by cooldown");
} catch (e) {
  assert(e.message.includes("BOT_COOLDOWN_ACTIVE"),
    "Bot cooldown correctly blocks rapid consecutive swaps");
}

// Different address should still work (within block limit)
// Note: we may hit per-block limit, so we reset block window
dex.currentBlockTimestamp = 0; // Force new block
dex.currentBlockSwapCount = 0;
const differentAddr = dex.swap("user_different", "USDT", "MYC", 10);
assert(differentAddr.status === "SWAP_SUCCESS", "Different address can swap independently");

// ═══════════════════════════════════════════════════════════════════
// 6. Per-Block Swap Limit
// ═══════════════════════════════════════════════════════════════════
console.log("\n📦 PER-BLOCK SWAP LIMIT\n");

// Reset block window
dex.currentBlockTimestamp = Date.now();
dex.currentBlockSwapCount = 0;

const blockSwap1 = dex.swap("block_user_1", "USDT", "MYC", 5);
const blockSwap2 = dex.swap("block_user_2", "USDT", "MYC", 5);
const blockSwap3 = dex.swap("block_user_3", "USDT", "MYC", 5);
assert(blockSwap1.status === "SWAP_SUCCESS" && blockSwap2.status === "SWAP_SUCCESS" && blockSwap3.status === "SWAP_SUCCESS",
  "3 swaps in same block allowed");

try {
  dex.swap("block_user_4", "USDT", "MYC", 5);
  assert(false, "4th swap in same block should be rejected");
} catch (e) {
  assert(e.message.includes("BLOCK_SWAP_LIMIT_EXCEEDED"),
    `Block limit enforced: max ${dex.MAX_SWAPS_PER_BLOCK} swaps per block`);
}

// ═══════════════════════════════════════════════════════════════════
// 7. Price Impact Rejection (>15%)
// ═══════════════════════════════════════════════════════════════════
console.log("\n💥 EXTREME PRICE IMPACT REJECTION\n");

// Temporarily allow whale guard to pass for testing price impact
const savedWhaleGuard = dex.MAX_TRADE_PERCENT_BPS;
dex.MAX_TRADE_PERCENT_BPS = 5000; // 50% of pool (to test impact independently)
dex.currentBlockTimestamp = 0;
dex.currentBlockSwapCount = 0;

try {
  // This amount would move the price significantly
  dex.swap("user_impact_test", "MYC", "USDT", dex.reserves.MYC * 0.25);
  assert(false, "25% of pool trade should be rejected for extreme impact");
} catch (e) {
  const isImpactOrSlippage = e.message.includes("EXTREME_IMPACT") || e.message.includes("SLIPPAGE_EXCEEDED");
  assert(isImpactOrSlippage, `Extreme impact rejected: ${e.message.split(":")[0]}`);
}
dex.MAX_TRADE_PERCENT_BPS = savedWhaleGuard;

// ═══════════════════════════════════════════════════════════════════
// 8. Minimum Output
// ═══════════════════════════════════════════════════════════════════
console.log("\n📉 MINIMUM OUTPUT FLOOR\n");

dex.currentBlockTimestamp = 0;
dex.currentBlockSwapCount = 0;

try {
  dex.swap("user_min_out", "USDT", "MYC", 10, { minAmountOut: 999999 });
  assert(false, "Unreachable minAmountOut should reject");
} catch (e) {
  assert(e.message.includes("MIN_OUTPUT_NOT_MET"), "Minimum output floor enforced");
}

// Reasonable minAmountOut should pass
dex.currentBlockTimestamp = 0;
dex.currentBlockSwapCount = 0;
const reasonableSwap = dex.swap("user_min_ok", "USDT", "MYC", 10, { minAmountOut: 1 });
assert(reasonableSwap.status === "SWAP_SUCCESS", "Reasonable minAmountOut passes");

// ═══════════════════════════════════════════════════════════════════
// 9. TWAP Oracle
// ═══════════════════════════════════════════════════════════════════
console.log("\n📈 TWAP ORACLE\n");

const twapPrice = dex.getTWAP("MYC", "USDT");
const spotPrice = dex.getSpotPrice("MYC", "USDT");
assert(twapPrice > 0, `TWAP MYC/USDT: ${twapPrice.toFixed(8)}`);
assert(spotPrice > 0, `Spot MYC/USDT: ${spotPrice.toFixed(8)}`);
assert(Math.abs(twapPrice - spotPrice) / spotPrice < 0.5,
  "TWAP and spot price within 50% (after multiple trades)");

// ═══════════════════════════════════════════════════════════════════
// 10. Pool Stats
// ═══════════════════════════════════════════════════════════════════
console.log("\n📊 POOL STATISTICS\n");

const stats = dex.getPoolStats();
assert(stats.totalSwaps > 0, `Total swaps: ${stats.totalSwaps}`);
assert(stats.feeBps === 30, `Fee: ${stats.feeBps} bps (0.3%)`);
assert(stats.security.maxPriceImpactPercent === 15, "Max price impact: 15%");
assert(stats.security.cooldownSeconds === 10, "Cooldown: 10s");
assert(stats.security.maxTradePercent === 2, "Whale guard: 2% max");
assert(stats.security.maxSwapsPerBlock === 3, "Per-block limit: 3");

// ═══════════════════════════════════════════════════════════════════
// 11. Unsupported Pair
// ═══════════════════════════════════════════════════════════════════
console.log("\n🚫 UNSUPPORTED PAIR\n");

dex.currentBlockTimestamp = 0;
dex.currentBlockSwapCount = 0;

try {
  dex.swap("user_bad_pair", "ETH", "BTC", 100);
  assert(false, "Unsupported pair should throw");
} catch (e) {
  assert(e.message.includes("UNSUPPORTED_PAIR"), "Unsupported pair correctly rejected");
}

// ═══════════════════════════════════════════════════════════════════
// 12. Real Testnet USDT & MYC On-Chain Balance Settlements
// ═══════════════════════════════════════════════════════════════════
console.log("\n💵 REAL TESTNET USDT & MYC BALANCE SETTLEMENTS\n");

const realToken = new MycToken();
const realUsdt = new MycUSDToken();
const realDex = new MycSwapDex(realToken, realUsdt);

const testUser = "myc1testuser000000000000000000000000001";
// Fund test user with 500 USDT from faucet
realUsdt.transfer(realUsdt.faucetPoolAddress, testUser, 500);

assert(realUsdt.balanceOf(testUser) === 500, "User funded with 500 testnet USDT");
assert(realToken.balanceOf(testUser) === 0, "User starts with 0 MYC");

// Swap 100 USDT -> MYC
const userSwapResult = realDex.swap(testUser, "USDT", "MYC", 100);

assert(realUsdt.balanceOf(testUser) === 400, "User USDT balance debited by exactly 100 USDT (500 -> 400)");
assert(realToken.balanceOf(testUser) > 990, `User MYC balance credited with ~996 MYC (balance: ${realToken.balanceOf(testUser)})`);
assert(userSwapResult.status === "SWAP_SUCCESS", "Real swap status SWAP_SUCCESS");

// Swap 100 MYC back -> USDT
realDex.lastSwapTimestamp.delete(testUser.toLowerCase()); // bypass 10s cooldown for test
realDex.currentBlockSwapCount = 0;
const swapBackResult = realDex.swap(testUser, "MYC", "USDT", 100);

assert(swapBackResult.status === "SWAP_SUCCESS", "Swap back from MYC to USDT succeeded");
assert(realUsdt.balanceOf(testUser) > 405, `User received USDT back (new USDT balance: ${realUsdt.balanceOf(testUser)})`);
assert(realToken.balanceOf(testUser) < 900, `User MYC balance debited by 100 MYC (new MYC balance: ${realToken.balanceOf(testUser)})`);

// ═══════════════════════════════════════════════════════════════════
// 13. Real Testnet USDC & USDT/USDC Multi-Asset DEX Swaps
// ═══════════════════════════════════════════════════════════════════
console.log("\n🪙 REAL TESTNET USDC & STABLE-SWAP VERIFICATION\n");

const realUsdc = new MycUSDCToken();
const multiDex = new MycSwapDex(realToken, realUsdt, realUsdc);

const usdcUser = "myc1usdcuser000000000000000000000000002";
// Fund user with 500 USDC
realUsdc.transfer(realUsdc.faucetPoolAddress, usdcUser, 500);

assert(realUsdc.balanceOf(usdcUser) === 500, "User funded with 500 testnet USDC");

// Swap 100 USDC -> MYC
const usdcToMyc = multiDex.swap(usdcUser, "USDC", "MYC", 100);
assert(usdcToMyc.status === "SWAP_SUCCESS", "USDC to MYC swap succeeded");
assert(realUsdc.balanceOf(usdcUser) === 400, "User USDC balance debited by 100 USDC (500 -> 400)");
assert(realToken.balanceOf(usdcUser) > 900, `User MYC balance credited from USDC swap (${realToken.balanceOf(usdcUser)} MYC)`);

// Swap 50 USDT -> USDC (Stable-swap pair)
realUsdt.transfer(realUsdt.faucetPoolAddress, usdcUser, 100);
multiDex.lastSwapTimestamp.delete(usdcUser.toLowerCase());
multiDex.currentBlockSwapCount = 0;

const usdtToUsdc = multiDex.swap(usdcUser, "USDT", "USDC", 50);
assert(usdtToUsdc.status === "SWAP_SUCCESS", "USDT to USDC stable-swap succeeded");
assert(usdtToUsdc.amountOut > 49 && usdtToUsdc.amountOut < 51, `USDT/USDC 1:1 Peg verified (got ${usdtToUsdc.amountOut} USDC)`);
assert(realUsdc.balanceOf(usdcUser) > 449, `User USDC credited with stable-swap output (${realUsdc.balanceOf(usdcUser)} USDC)`);

console.log("\n====================================================================");
console.log(`🏆 MYCSWAP SECURITY: ${passed}/${total} TESTS PASSED`);
if (passed === total) {
  console.log("   🎉 ALL SECURITY LAYERS FULLY OPERATIONAL!");
} else {
  console.error(`   ⚠️  ${total - passed} test(s) failed`);
  process.exit(1);
}
console.log("====================================================================\n");
