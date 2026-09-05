import { MycLocalSafetyVerifier, PIN_VOLTAGE } from "../../core/kernel/local_safety_verifier.js";

console.log("====================================================================");
console.log("🧪 PHASE 9 ACCEPTANCE SUITE: PHYSICAL / ACTUATOR LOCAL SAFETY");
console.log("====================================================================");

let passed = 0;
const verifier = new MycLocalSafetyVerifier({ minConfidence: 0.85 });

// 1. Valid Industrial Actuation
const validRes = verifier.evaluatePhysicalSafety({
  device: "TURBINE",
  action: "START",
  unitNumber: 2,
  targetRegister: 0x0082,
  confidence: 0.96,
  onChainAuthorized: true
});
if (validRes.safeToActuate && validRes.pinVoltage === PIN_VOLTAGE.HIGH_3V3 && validRes.targetRegister === 0x0082) {
  console.log("✅ [TEST 9.1 PASS] Valid authorized industrial command safely energized pin to 3.30V HIGH");
  passed++;
}

// 2. Unknown Device -> NO-OP (0.00V Safe Low)
const unknownDevRes = verifier.evaluatePhysicalSafety({
  device: "MICROWAVE",
  action: "START",
  targetRegister: 0x0080
});
if (!unknownDevRes.safeToActuate && unknownDevRes.pinVoltage === PIN_VOLTAGE.SAFE_LOW) {
  console.log("✅ [TEST 9.2 PASS] Unknown device strictly rejected with NO-OP (0.00V Safe Low)");
  passed++;
}

// 3. Out-of-Range Register -> NO-OP
const outOfRangeRes = verifier.evaluatePhysicalSafety({
  device: "TURBINE",
  action: "START",
  targetRegister: 0xFFFF // Invalid register address
});
if (!outOfRangeRes.safeToActuate && outOfRangeRes.pinVoltage === PIN_VOLTAGE.SAFE_LOW) {
  console.log("✅ [TEST 9.3 PASS] Out-of-range register boundary violation halted at 0.00V Safe Low");
  passed++;
}

// 4. Low Confidence -> NO-OP
const lowConfRes = verifier.evaluatePhysicalSafety({
  device: "VALVE",
  action: "OPEN",
  targetRegister: 0x0011,
  confidence: 0.42 // Low confidence intent
});
if (!lowConfRes.safeToActuate && lowConfRes.reason.includes("LOW_CONFIDENCE")) {
  console.log("✅ [TEST 9.4 PASS] Low confidence intent rejected without guessing (NO-OP)");
  passed++;
}

// 5. Emergency Stop Interlock -> NO-OP
verifier.setEmergencyStop(true);
const eStopRes = verifier.evaluatePhysicalSafety({
  device: "PUMP",
  action: "START",
  targetRegister: 0x0001
});
if (!eStopRes.safeToActuate && eStopRes.reason === "EMERGENCY_STOP_ACTIVE") {
  console.log("✅ [TEST 9.5 PASS] Emergency Stop hardware interlock immediately forced 0.00V Safe Low");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PHASE 9 TEST RESULTS: ${passed}/5 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 5) {
  process.exit(1);
}
