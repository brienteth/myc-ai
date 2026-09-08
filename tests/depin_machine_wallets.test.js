import { describe, it } from "node:test";
import assert from "node:assert";
import { MycMachineWalletManager } from "../depin/machine_wallet_manager.js";
import { MycHardwareWallet } from "../core/crypto/wallet.js";

describe("DePIN Machine Wallets & Silicon PUF Architecture Suite", () => {
  const manager = new MycMachineWalletManager();

  it("should initialize default machine fleet with valid myc1... sovereign addresses", () => {
    const machines = manager.getMachines();
    assert.ok(machines.length >= 5, "Fleet should have at least 5 default machines");

    for (const m of machines) {
      assert.ok(MycHardwareWallet.isValidAddress(m.walletAddress), `Address ${m.walletAddress} must be a valid myc1 address`);
      assert.strictEqual(m.walletAddress.startsWith("myc1"), true);
      assert.strictEqual(m.walletAddress.length, 36);
      assert.ok(m.balance > 0, "Machine must have autonomous balance");
      assert.strictEqual(m.safetyShield.includes("0-Byte Negation"), true);
    }
  });

  it("should provision a new machine wallet dynamically using Silicon PUF entropy", () => {
    const newMachine = manager.registerMachine({
      did: "ROBOT_ARM_01",
      name: "6-Axis Precision Assembly Robotic Arm",
      deviceType: "MOTOR",
      baseRegister: 0x0060,
      maxRegister: 0x0065,
      initialBalance: 500.00
    });

    assert.strictEqual(newMachine.did, "ROBOT_ARM_01");
    assert.ok(MycHardwareWallet.isValidAddress(newMachine.walletAddress));
    assert.strictEqual(newMachine.balance, 500.00);
    assert.strictEqual(newMachine.deviceType, "MOTOR");
  });

  it("should fund a machine maintenance wallet with 0 gas fee", () => {
    const pre = manager.getMachine("TURBINE_01");
    const res = manager.fundMachine("TURBINE_01", 100.00);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.tx.gasFee, "0.00000000 MYC", "H2M funding must incur 0 gas fee");
    assert.strictEqual(res.machine.balance, pre.balance + 100.00);
  });

  it("should withdraw accumulated earnings from machine to operator with PUF signature", () => {
    const pre = manager.getMachine("GPU_EDGE_01");
    const res = manager.withdrawFromMachine("GPU_EDGE_01", 50.00, "myc1operator99999999999999999999999");

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.tx.gasFee, "0.00000000 MYC", "M2H withdrawal must incur 0 gas fee");
    assert.ok(res.tx.pufSignature, "Withdrawal must be cryptographically signed by hardware PUF");
    assert.strictEqual(res.machine.balance, pre.balance - 50.00);
  });

  it("should execute autonomous Machine-to-Machine (M2M) micro-payment with 0 gas", () => {
    const turbinePre = manager.getMachine("TURBINE_01");
    const valvePre = manager.getMachine("VALVE_01");

    const res = manager.executeM2MPayment({
      fromDid: "TURBINE_01",
      toDid: "VALVE_01",
      amount: 25.00,
      purpose: "Urgent Cooling Cycle Flow Increase"
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.tx.gasFee, "0.00000000 MYC");
    assert.strictEqual(res.sender.balance, turbinePre.balance - 25.00);
    assert.strictEqual(res.receiver.balance, valvePre.balance + 25.00);
    assert.ok(res.tx.pufSignature, "M2M transaction must include hardware PUF signature");
  });

  it("should strictly reject M2M actuation if 0-Byte Negation Shield detects contradiction", () => {
    assert.throws(() => {
      manager.executeM2MPayment({
        fromDid: "TURBINE_01",
        toDid: "VALVE_01",
        amount: 10.00,
        triggerActuator: true,
        isNegationOrContradiction: true // Adversarial or contradictory command
      });
    }, /0-BYTE_NEGATION_SHIELD_BLOCKED/);
  });

  it("should successfully execute safe actuation within register bounds", () => {
    const res = manager.actuateDevice({
      did: "VALVE_01",
      register: 0x0010, // 16
      value: 90
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.shieldStatus, "PASSED_HARDWARE_INTERLOCK");
    assert.strictEqual(res.machine.registers[16], 90);
  });

  it("should generate compliant W3C DID documents (did:myc:puf:0x...) for machines", () => {
    const turbine = manager.getMachine("TURBINE_01");
    assert.ok(turbine.w3cDid.startsWith("did:myc:puf:0x"), "Must follow did:myc:puf:0x format");

    // Resolve by alias
    const docByAlias = manager.getDidDocument("TURBINE_01");
    assert.ok(docByAlias);
    assert.strictEqual(docByAlias.id, turbine.w3cDid);
    assert.strictEqual(docByAlias["@context"][0], "https://www.w3.org/ns/did/v1");
    assert.ok(docByAlias.verificationMethod.length > 0);
    assert.strictEqual(docByAlias.verificationMethod[0].type, "SiliconPufVerificationKey2026");
    assert.strictEqual(docByAlias.verificationMethod[0].hardwareAttestation.standard, "MYCA-RHIZOME-PUF-V1");
    assert.strictEqual(docByAlias.service[0].type, "MyceliumM2MWalletService");
    assert.strictEqual(docByAlias.service[0].gasPolicy, "ZERO_GAS_GUARANTEED");

    // Resolve by W3C DID string
    const docByW3C = manager.getDidDocument(turbine.w3cDid);
    assert.ok(docByW3C);
    assert.strictEqual(docByW3C.id, turbine.w3cDid);

    // Resolve by walletAddress
    const docByWallet = manager.getDidDocument(turbine.walletAddress);
    assert.ok(docByWallet);
    assert.strictEqual(docByWallet.id, turbine.w3cDid);
  });

  it("should verify hardware attestation challenge against machine PUF key", () => {
    const turbine = manager.getMachine("TURBINE_01");
    const raw = manager.machines.get("TURBINE_01");
    const challenge = "MYC_SESSION_NONCE_" + Date.now();
    const signature = MycHardwareWallet.sign(challenge, raw.walletInstance.keypair.privateKey);

    const attestation = manager.verifyHardwareAttestation("TURBINE_01", challenge, signature);
    assert.strictEqual(attestation.valid, true);
    assert.strictEqual(attestation.did, turbine.w3cDid);
    assert.strictEqual(attestation.alias, "TURBINE_01");

    // Fake signature should fail
    const invalidAttestation = manager.verifyHardwareAttestation("TURBINE_01", challenge, "00".repeat(64));
    assert.strictEqual(invalidAttestation.valid, false);
  });
});

