import assert from "node:assert/strict";
import { MycDePINMonitor, MycBinaryFrame } from "./monitor.js";

async function runTest() {
  console.log("🧪 Testing DePIN Hardware Sentinel & 0-Byte Negation Shield...");
  const monitor = new MycDePINMonitor({ deviceId: "depin-turbine-test" });

  // 1. Check PUF Identity
  assert.ok(monitor.pufAddress.startsWith("myc1puf"), "Must have PUF hardware address prefix");

  // 2. Binary frame test
  const frame = monitor.createBinaryTelemetry(0, 130, 0xFF00);
  assert.equal(frame.length, 48, "Binary frame must be strictly 48 bytes");
  const deserialized = MycBinaryFrame.deserialize(frame);
  assert.equal(deserialized.isValidCrc, true, "CRC-16 checksum must be valid");

  // 3. Query network machines
  const machines = await monitor.fetchMachines();
  assert.ok(Array.isArray(machines), "Must return machines array");
  assert.ok(machines.length > 0, "Network should have active machines");

  // 4. Test safe actuation
  // 4. Test safe actuation on valid machine register
  const targetDid = machines[0].did;
  const targetReg = machines[0].baseRegister;
  const safeRes = await monitor.actuateRegister(targetDid, targetReg, 3500);
  assert.equal(safeRes.success, true);
  assert.equal(safeRes.register, targetReg);
  assert.equal(safeRes.newValue, 3500);

  // 5. Test Negation Shield block on out-of-bounds register
  const unsafeRes = await monitor.actuateRegister(targetDid, 999, 1);
  assert.equal(unsafeRes.success, false);
  assert.ok(unsafeRes.error.includes("BOUNDS") || unsafeRes.error.includes("LIMIT") || unsafeRes.error.includes("SAFETY"));

  console.log("✅ Project 2 (DePIN Hardware Sentinel) Test Passed with 100% Success!");
}

runTest().catch(err => {
  console.error("❌ Test Failed:", err.message);
  process.exit(1);
});
