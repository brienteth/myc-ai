import { MycStakingPoolContract, MycBridgeContract } from "../ledger/contracts/index.js";

console.log("====================================================================");
console.log("🛡️ DUE-DILIGENCE VERIFICATION: DYNAMIC APY & BRIDGE SECURITY MODEL");
console.log("Proving Dynamic Real Yield min(Y/X, 18%) & BFT Quorum Cross-Chain Defense");
console.log("====================================================================\n");

async function runDueDiligenceSuite() {
  let passed = 0;
  let total = 0;

  // ===========================================================================
  // AŞAMA 1: DYNAMIC REAL-YIELD STAKING MODEL
  // ===========================================================================
  console.log("--- AŞAMA 1: DYNAMIC APY PROTOCOL REVENUE COUPLING ---");
  const staking = new MycStakingPoolContract();

  // Test 1: Low Protocol Revenue -> APY drops below 18%
  total++;
  console.log("[1] Testing High Stake / Low Revenue: APY must drop below 18%...");
  // Set total staked X = 500,000 MYC
  staking.stake(500000, { msgSender: "myc1stakeralpha00000000000000000" });
  // Set annual revenue Y = 45,000 MYC (accumulated 3,750 / mo)
  staking.accumulatedDexFees = 1250;
  staking.accumulatedTaskFees = 2000;
  staking.accumulatedBridgeFees = 500;
  staking.annualizedProtocolRevenue = 45000;

  const lowApyResult = staking.getDynamicApy();
  console.log(`  Total Staked (X)    : ${lowApyResult.totalStaked} MYC`);
  console.log(`  Annual Revenue (Y)  : ${lowApyResult.annualizedRevenue} MYC`);
  console.log(`  Calculated Raw APY  : ${lowApyResult.rawApyPercent}%`);
  console.log(`  Dynamic Yield       : ${lowApyResult.dynamicApyPercent}% (Capped: ${lowApyResult.isCapped})`);

  if (lowApyResult.dynamicApyPercent === 9.0 && !lowApyResult.isCapped) {
    console.log("  ✅ [TEST 1 PASS] APY dynamically reduced to 9.00% matching real revenue (No unbacked debt).");
    passed++;
  } else {
    console.error("  ❌ [TEST 1 FAIL] Dynamic APY failed to reduce below 18% ceiling!");
  }

  // Test 2: High Protocol Revenue -> APY capped at exactly 18.00%
  total++;
  console.log("\n[2] Testing High Protocol Revenue: APY must cap at exactly 18.00%...");
  // Set annual revenue Y = 180,000 MYC for X = 500,000 MYC -> raw 36%
  staking.annualizedProtocolRevenue = 180000;
  const highApyResult = staking.getDynamicApy();
  console.log(`  Total Staked (X)    : ${highApyResult.totalStaked} MYC`);
  console.log(`  Annual Revenue (Y)  : ${highApyResult.annualizedRevenue} MYC`);
  console.log(`  Calculated Raw APY  : ${highApyResult.rawApyPercent}%`);
  console.log(`  Dynamic Yield       : ${highApyResult.dynamicApyPercent}% (Capped: ${highApyResult.isCapped})`);

  if (highApyResult.dynamicApyPercent === 18.0 && highApyResult.isCapped) {
    console.log("  ✅ [TEST 2 PASS] APY successfully capped at 18.00% max limit (Formula: min(Y/X, 0.18)).");
    passed++;
  } else {
    console.error("  ❌ [TEST 2 FAIL] APY cap violation!");
  }

  // ===========================================================================
  // AŞAMA 2: BRIDGE SECURITY MODEL & BFT QUORUM ENFORCEMENT
  // ===========================================================================
  console.log("\n--- AŞAMA 2: BRIDGE SECURITY INVARIANTS & BFT QUORUM ---");
  const bridge = new MycBridgeContract([
    "myc1val10000000000000000000000000000000",
    "myc1val20000000000000000000000000000000",
    "myc1val30000000000000000000000000000000",
    "myc1val40000000000000000000000000000000"
  ]);

  // Test 3: Quorum calculation floor(2N/3) + 1
  total++;
  console.log("\n[3] Testing BFT Quorum Threshold Calculation...");
  const quorum = bridge.getRequiredQuorum();
  console.log(`  Registered Validators: 4`);
  console.log(`  Required Quorum      : ${quorum} signatures (floor(2*4/3) + 1 = 3)`);
  if (quorum === 3) {
    console.log("  ✅ [TEST 3 PASS] BFT 2/3+1 Byzantine Quorum correctly calculated.");
    passed++;
  } else {
    console.error("  ❌ [TEST 3 FAIL] Invalid quorum threshold!");
  }

  // Test 4: Insufficient signatures rejected
  total++;
  console.log("\n[4] Testing Release with Insufficient Signatures (Sub-Quorum Attack)...");
  let subQuorumRejected = false;
  try {
    bridge.releaseWithSignatures(
      "transfer_attack_001",
      "BASE_SEPOLIA",
      "myc1recipient00000000000000000000000",
      1000,
      1,
      ["myc1val10000000000000000000000000000000", "myc1val20000000000000000000000000000000"] // Only 2 out of 3
    );
  } catch (err) {
    if (err.message.includes("INSUFFICIENT_BFT_SIGNATURES")) {
      subQuorumRejected = true;
    }
  }

  if (subQuorumRejected) {
    console.log("  ✅ [TEST 4 PASS] Sub-quorum release attempt strictly rejected.");
    passed++;
  } else {
    console.error("  ❌ [TEST 4 FAIL] Sub-quorum release bypassed security check!");
  }

  // Test 5: Valid Quorum releases tokens
  total++;
  console.log("\n[5] Testing Legitimate Release with BFT Supermajority Quorum...");
  const legitimateRelease = bridge.releaseWithSignatures(
    "transfer_legit_001",
    "BASE_SEPOLIA",
    "myc1recipient00000000000000000000000",
    1000,
    1,
    [
      "myc1val10000000000000000000000000000000",
      "myc1val20000000000000000000000000000000",
      "myc1val30000000000000000000000000000000"
    ] // 3 valid distinct validators
  );

  if (legitimateRelease.status === "COMPLETED" && legitimateRelease.signaturesCount === 3) {
    console.log("  ✅ [TEST 5 PASS] Bridge release successfully authenticated with 3/4 BFT signatures.");
    passed++;
  } else {
    console.error("  ❌ [TEST 5 FAIL] Legitimate bridge release failed!");
  }

  // Test 6: Replay Attack Prevention (Same proof submitted twice)
  total++;
  console.log("\n[6] Testing Replay Attack Defense (Double Spend of Same Lock Proof)...");
  let replayBlocked = false;
  try {
    bridge.releaseWithSignatures(
      "transfer_legit_001", // Repeated ID
      "BASE_SEPOLIA",
      "myc1recipient00000000000000000000000",
      1000,
      1,
      [
        "myc1val10000000000000000000000000000000",
        "myc1val20000000000000000000000000000000",
        "myc1val30000000000000000000000000000000"
      ]
    );
  } catch (err) {
    if (err.message.includes("REPLAY_ATTACK_DETECTED")) {
      replayBlocked = true;
    }
  }

  if (replayBlocked && bridge.isTransferProcessed("transfer_legit_001")) {
    console.log("  ✅ [TEST 6 PASS] Replay attack detected and blocked immediately.");
    passed++;
  } else {
    console.error("  ❌ [TEST 6 FAIL] Replay attack was erroneously processed!");
  }

  // Test 7: Circuit Breaker Single Transfer Limit (> 50,000 MYC)
  total++;
  console.log("\n[7] Testing Single Transfer Limit Defense (> 50,000 MYC)...");
  let limitExceeded = false;
  try {
    bridge.lockAndBridge("ETHEREUM", "0xattacker", 60000);
  } catch (err) {
    if (err.message.includes("AMOUNT_EXCEEDS_SINGLE_LIMIT")) {
      limitExceeded = true;
    }
  }

  if (limitExceeded) {
    console.log("  ✅ [TEST 7 PASS] Single transfer exceeding 50,000 MYC halted by circuit breaker.");
    passed++;
  } else {
    console.error("  ❌ [TEST 7 FAIL] Excessive transfer bypassed single limit check!");
  }

  // Test 8: Emergency Freeze / Pause
  total++;
  console.log("\n[8] Testing Emergency Bridge Freeze Circuit Breaker...");
  bridge.pauseBridge();
  let pauseProtected = false;
  try {
    bridge.lockAndBridge("ETHEREUM", "0xnormal", 1000);
  } catch (err) {
    if (err.message.includes("BRIDGE_EMERGENCY_PAUSED")) {
      pauseProtected = true;
    }
  }

  bridge.unpauseBridge();
  if (pauseProtected && !bridge.paused) {
    console.log("  ✅ [TEST 8 PASS] Emergency freeze halted all bridge operations instantly.");
    passed++;
  } else {
    console.error("  ❌ [TEST 8 FAIL] Bridge pause failed!");
  }

  console.log(`\n=== Due-Diligence Suite Result: ${passed}/${total} Passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runDueDiligenceSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
