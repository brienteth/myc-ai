import assert from "node:assert";
import { MycLocalSafetyVerifier, PIN_VOLTAGE } from "../../core/kernel/local_safety_verifier.js";

console.log("====================================================================");
console.log("🧪 PHASE 9 ACCEPTANCE SUITE: PHYSICAL & ACTUATOR SAFETY VERIFICATION");
console.log("====================================================================");

const verifier = new MycLocalSafetyVerifier({ minConfidence: 0.85 });

// 1. Valid authorized industrial command safely energizes pin to 3.30V HIGH
const validRes = verifier.evaluatePhysicalSafety({
  device: "TURBINE",
  action: "START",
  unitNumber: 2,
  targetRegister: 0x0082,
  confidence: 0.96,
  onChainAuthorized: true
});
assert.strictEqual(validRes.safeToActuate, true);
assert.strictEqual(validRes.pinVoltage, PIN_VOLTAGE.HIGH_3V3);
assert.strictEqual(validRes.targetRegister, 0x0082);
console.log("✅ [TEST 9.1 PASS] Valid authorized industrial command safely energizes pin to 3.30V HIGH");

// 2. Unknown device is strictly rejected with NO-OP (0.00V Safe Low)
const unknownDevRes = verifier.evaluatePhysicalSafety({
  device: "MICROWAVE",
  action: "START",
  targetRegister: 0x0080
});
assert.strictEqual(unknownDevRes.safeToActuate, false);
assert.strictEqual(unknownDevRes.pinVoltage, PIN_VOLTAGE.SAFE_LOW);
console.log("✅ [TEST 9.2 PASS] Unknown device is strictly rejected with NO-OP (0.00V Safe Low)");

// 3. Out-of-range register boundary violation is halted at 0.00V Safe Low
const outOfRangeRes = verifier.evaluatePhysicalSafety({
  device: "TURBINE",
  action: "START",
  targetRegister: 0xFFFF
});
assert.strictEqual(outOfRangeRes.safeToActuate, false);
assert.strictEqual(outOfRangeRes.pinVoltage, PIN_VOLTAGE.SAFE_LOW);
console.log("✅ [TEST 9.3 PASS] Out-of-range register boundary violation is halted at 0.00V Safe Low");

// 4. Low confidence intent is rejected without guessing (NO-OP)
const lowConfRes = verifier.evaluatePhysicalSafety({
  device: "VALVE",
  action: "OPEN",
  targetRegister: 0x0011,
  confidence: 0.42
});
assert.strictEqual(lowConfRes.safeToActuate, false);
assert.ok(lowConfRes.reason.includes("LOW_CONFIDENCE"));
console.log("✅ [TEST 9.4 PASS] Low confidence intent is rejected without guessing (NO-OP)");

// 5. Emergency Stop hardware interlock immediately forces 0.00V Safe Low
const safeVerifier = new MycLocalSafetyVerifier({ minConfidence: 0.85 });
safeVerifier.setEmergencyStop(true);
const eStopRes = safeVerifier.evaluatePhysicalSafety({
  device: "PUMP",
  action: "START",
  targetRegister: 0x0001
});
assert.strictEqual(eStopRes.safeToActuate, false);
assert.strictEqual(eStopRes.reason, "EMERGENCY_STOP_ACTIVE");
console.log("✅ [TEST 9.5 PASS] Emergency Stop hardware interlock immediately forces 0.00V Safe Low");

console.log("\n====================================================================");
console.log("🏆 PHASE 9 TEST RESULTS: 5/5 PASSED WITH 100% SUCCESS");
console.log("====================================================================");

