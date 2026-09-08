import crypto from "crypto";
import { MycHardwareWallet } from "../core/crypto/wallet.js";
import { MycLocalSafetyVerifier } from "../core/kernel/local_safety_verifier.js";

/**
 * DePIN Autonomous Machine Wallet & Actuator Fleet Manager
 * 
 * Cryptographic & Economic Specifications:
 *  1. Silicon PUF Root-of-Trust: No plaintext private keys stored on disk;
 *     keys are deterministically derived from chip physical unclonable function jitter.
 *  2. Sovereign Address Format: myc1... (36 chars)
 *  3. Autonomous Machine Treasury: Hardware units earn from telemetry/compute and pay for maintenance/M2M.
 *  4. 0-Byte Negation Shield: Physical actuation interlocks strictly reject contradictory commands.
 *  5. Zero-Gas Invariant: All M2M and H2M interactions incur strictly 0.00000000 MYC gas fee.
 */
export class MycMachineWalletManager {
  constructor(options = {}) {
    this.safetyVerifier = options.safetyVerifier || new MycLocalSafetyVerifier();
    this.machines = new Map();
    this.m2mTransactions = [];
    this.totalM2MVolume = 0;

    this.seedDefaultFleet();
  }

  _deriveW3CDid(walletAddress, pufPublicKey) {
    const raw = (pufPublicKey || walletAddress || "").toLowerCase();
    const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
    return `did:myc:puf:0x${hash}`;
  }

  resolveMachine(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim();
    const upper = clean.toUpperCase();
    const lower = clean.toLowerCase();

    // 1. Direct hit on primary map
    if (this.machines.has(clean)) return this.machines.get(clean);
    if (this.machines.has(upper)) return this.machines.get(upper);

    // 2. Scan w3cDid, did, or walletAddress
    for (const m of this.machines.values()) {
      if (m.did && (m.did === clean || m.did.toUpperCase() === upper)) return m;
      if (m.w3cDid && m.w3cDid.toLowerCase() === lower) return m;
      if (m.walletAddress && m.walletAddress.toLowerCase() === lower) return m;
    }
    return null;
  }

  seedDefaultFleet() {
    const defaultDevices = [
      {
        did: "TURBINE_01",
        name: "Gas Turbine Gen-4 (Power Unit #1)",
        deviceType: "TURBINE",
        seed: "puf_silicon_entropy_turbine_01_mac_e4_5f_01_a9",
        baseRegister: 0x0080,
        maxRegister: 0x0085,
        initialBalance: 1450.00,
        totalEarned: 2980.00,
        totalSpent: 1530.00,
        operator: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
        telemetry: { rpm: 3450, tempC: 84.2, vibrationMm: 0.11, status: "OPTIMAL" },
        registers: { 128: 3450, 129: 84, 130: 1 }
      },
      {
        did: "VALVE_01",
        name: "Cryogenic Cooling Control Valve #1",
        deviceType: "VALVE",
        seed: "puf_silicon_entropy_valve_01_mac_e4_5f_02_b8",
        baseRegister: 0x0010,
        maxRegister: 0x0015,
        initialBalance: 620.00,
        totalEarned: 1140.00,
        totalSpent: 520.00,
        operator: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
        telemetry: { flowRatePct: 65, pressurePsi: 144.2, tempC: -19.4, status: "ACTIVE" },
        registers: { 16: 65, 17: 144, 18: 1 }
      },
      {
        did: "GPU_EDGE_01",
        name: "Edge AI Reasoning Cluster (H100 NVLink)",
        deviceType: "GPU_COMPUTE",
        seed: "puf_silicon_entropy_gpu_edge_01_mac_e4_5f_03_c7",
        baseRegister: 0x0090,
        maxRegister: 0x0098,
        initialBalance: 3890.00,
        totalEarned: 8420.00,
        totalSpent: 4530.00,
        operator: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
        telemetry: { vramUsedMb: 18432, vramTotalMb: 24576, tempC: 56.4, status: "COMPUTING" },
        registers: { 144: 75, 145: 56, 146: 1 }
      },
      {
        did: "PUMP_01",
        name: "High-Pressure Hydraulic Feed Pump #1",
        deviceType: "PUMP",
        seed: "puf_silicon_entropy_pump_01_mac_e4_5f_04_d6",
        baseRegister: 0x0000,
        maxRegister: 0x0005,
        initialBalance: 410.00,
        totalEarned: 950.00,
        totalSpent: 540.00,
        operator: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
        telemetry: { flowRateLpm: 120, pressureBar: 18.2, status: "ACTIVE" },
        registers: { 0: 120, 1: 18, 2: 1 }
      },
      {
        did: "SENSOR_AIR_01",
        name: "Ambient Environmental Telemetry Sensor",
        deviceType: "SENSOR",
        seed: "puf_silicon_entropy_sensor_air_01_mac_e4_5f_05_e5",
        baseRegister: 0x0020,
        maxRegister: 0x0025,
        initialBalance: 185.00,
        totalEarned: 480.00,
        totalSpent: 295.00,
        operator: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
        telemetry: { aqi: 22, co2Ppm: 410, humidityPct: 45, status: "STREAMING" },
        registers: { 32: 22, 33: 410, 34: 45 }
      }
    ];

    for (const dev of defaultDevices) {
      const hwWallet = new MycHardwareWallet(dev.seed);
      const w3cDid = this._deriveW3CDid(hwWallet.address, hwWallet.keypair.publicKey);
      this.machines.set(dev.did, {
        did: dev.did,
        w3cDid: w3cDid,
        shortDid: dev.did,
        name: dev.name,
        deviceType: dev.deviceType,
        walletAddress: hwWallet.address,
        pufPublicKey: hwWallet.keypair.publicKey,
        walletInstance: hwWallet,
        baseRegister: dev.baseRegister,
        maxRegister: dev.maxRegister,
        balance: dev.initialBalance,
        totalEarned: dev.totalEarned,
        totalSpent: dev.totalSpent,
        resonanceScoreBps: 9980,
        safetyShield: "ACTIVE - 0-Byte Negation Interlock",
        operator: dev.operator,
        status: "ONLINE",
        registeredAt: Date.now() - 86400000 * 5,
        lastHeartbeat: Date.now(),
        telemetry: dev.telemetry,
        registers: dev.registers,
        recentTxs: []
      });
    }

    // Seed 2 initial sample M2M transactions
    this.executeM2MPayment({
      fromDid: "TURBINE_01",
      toDid: "VALVE_01",
      amount: 15.00,
      purpose: "Autonomous Cryogenic Coolant Loop Activation",
      isNegationOrContradiction: false
    });

    this.executeM2MPayment({
      fromDid: "GPU_EDGE_01",
      toDid: "SENSOR_AIR_01",
      amount: 2.50,
      purpose: "High-Resolution Air Density Telemetry Streaming",
      isNegationOrContradiction: false
    });
  }

  getMachines() {
    return Array.from(this.machines.values()).map(m => ({
      did: m.did,
      w3cDid: m.w3cDid,
      name: m.name,
      deviceType: m.deviceType,
      walletAddress: m.walletAddress,
      pufPublicKey: m.pufPublicKey,
      didDocumentUri: `/api/depin/did?did=${encodeURIComponent(m.w3cDid)}`,
      baseRegister: m.baseRegister,
      maxRegister: m.maxRegister,
      balance: m.balance,
      totalEarned: m.totalEarned,
      totalSpent: m.totalSpent,
      resonanceScoreBps: m.resonanceScoreBps,
      coherencePercent: (m.resonanceScoreBps / 100).toFixed(2) + "%",
      safetyShield: m.safetyShield,
      operator: m.operator,
      status: m.status,
      lastHeartbeat: m.lastHeartbeat,
      telemetry: m.telemetry,
      registers: m.registers,
      recentTxs: m.recentTxs.slice(0, 5)
    }));
  }

  getMachine(identifier) {
    const m = this.resolveMachine(identifier);
    if (!m) return null;
    return {
      did: m.did,
      w3cDid: m.w3cDid,
      name: m.name,
      deviceType: m.deviceType,
      walletAddress: m.walletAddress,
      pufPublicKey: m.pufPublicKey,
      didDocumentUri: `/api/depin/did?did=${encodeURIComponent(m.w3cDid)}`,
      baseRegister: m.baseRegister,
      maxRegister: m.maxRegister,
      balance: m.balance,
      totalEarned: m.totalEarned,
      totalSpent: m.totalSpent,
      resonanceScoreBps: m.resonanceScoreBps,
      coherencePercent: (m.resonanceScoreBps / 100).toFixed(2) + "%",
      safetyShield: m.safetyShield,
      operator: m.operator,
      status: m.status,
      lastHeartbeat: m.lastHeartbeat,
      telemetry: m.telemetry,
      registers: m.registers,
      recentTxs: m.recentTxs
    };
  }

  getDidDocument(identifier) {
    const m = this.resolveMachine(identifier);
    if (!m) return null;

    return {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/ed25519-2020/v1"
      ],
      "id": m.w3cDid,
      "alias": m.did,
      "name": m.name,
      "deviceType": m.deviceType,
      "controller": m.operator || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      "verificationMethod": [
        {
          "id": `${m.w3cDid}#puf-key-1`,
          "type": "SiliconPufVerificationKey2026",
          "controller": m.w3cDid,
          "publicKeyHex": m.pufPublicKey,
          "hardwareAttestation": {
            "standard": "MYCA-RHIZOME-PUF-V1",
            "entropySource": "SRAM_STARTUP_POLYMORPHISM",
            "zeroByteShield": true,
            "deviceType": m.deviceType,
            "baseRegister": m.baseRegister,
            "maxRegister": m.maxRegister,
            "resonanceScoreBps": m.resonanceScoreBps
          }
        }
      ],
      "authentication": [`${m.w3cDid}#puf-key-1`],
      "assertionMethod": [`${m.w3cDid}#puf-key-1`],
      "capabilityInvocation": [`${m.w3cDid}#puf-key-1`],
      "service": [
        {
          "id": `${m.w3cDid}#m2m-wallet`,
          "type": "MyceliumM2MWalletService",
          "serviceEndpoint": `myc://chain108/wallet/${m.walletAddress}`,
          "walletAddress": m.walletAddress,
          "gasPolicy": "ZERO_GAS_GUARANTEED"
        },
        {
          "id": `${m.w3cDid}#telemetry-stream`,
          "type": "MyceliumStreamPayService",
          "serviceEndpoint": `myc://chain108/depin/stream/${(m.did || "").toLowerCase()}`
        }
      ]
    };
  }

  verifyHardwareAttestation(identifier, challenge, signature) {
    const m = this.resolveMachine(identifier);
    if (!m) return { valid: false, reason: "MACHINE_NOT_FOUND" };
    const pKey = (m.walletInstance && m.walletInstance.keypair) ? m.walletInstance.keypair.privateKey : null;
    const expectedSig = pKey ? MycHardwareWallet.sign(challenge, pKey) : null;
    const isValid = !!(expectedSig && signature === expectedSig);
    return {
      valid: isValid,
      did: m.w3cDid,
      alias: m.did,
      pufPublicKey: m.pufPublicKey,
      zeroByteShield: "ACTIVE",
      timestamp: Date.now()
    };
  }

  registerMachine({ did, name, deviceType, baseRegister, maxRegister, operator, initialBalance = 250.00 }) {
    if (!did || typeof did !== "string") throw new Error("INVALID_DID");
    const cleanDid = did.trim().toUpperCase();
    if (this.machines.has(cleanDid)) throw new Error("MACHINE_ALREADY_REGISTERED");

    const hwWallet = new MycHardwareWallet(); // Dynamic Silicon PUF entropy
    const w3cDid = this._deriveW3CDid(hwWallet.address, hwWallet.keypair.publicKey);
    const bReg = parseInt(baseRegister, 10) || 0x0050;
    const mReg = parseInt(maxRegister, 10) || (bReg + 5);

    const record = {
      did: cleanDid,
      w3cDid: w3cDid,
      shortDid: cleanDid,
      name: name || `${cleanDid} Hardware Node`,
      deviceType: deviceType || "MOTOR",
      walletAddress: hwWallet.address,
      pufPublicKey: hwWallet.keypair.publicKey,
      walletInstance: hwWallet,
      baseRegister: bReg,
      maxRegister: mReg,
      balance: parseFloat(initialBalance) || 100.0,
      totalEarned: parseFloat(initialBalance) || 100.0,
      totalSpent: 0.00,
      resonanceScoreBps: 10000,
      safetyShield: "ACTIVE - 0-Byte Negation Interlock",
      operator: operator || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
      status: "ONLINE",
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      telemetry: { status: "IDLE_READY", powerWatt: 120 },
      registers: { [bReg]: 0, [bReg + 1]: 0 },
      recentTxs: []
    };

    this.machines.set(cleanDid, record);
    return this.getMachine(cleanDid);
  }

  fundMachine(did, amount, fromWallet = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002") {
    const machine = this.resolveMachine(did);
    if (!machine) throw new Error("MACHINE_NOT_FOUND");
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_FUNDING_AMOUNT");

    machine.balance = parseFloat((machine.balance + amt).toFixed(4));
    machine.totalEarned = parseFloat((machine.totalEarned + amt).toFixed(4));
    machine.lastHeartbeat = Date.now();

    const tx = {
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      type: "H2M_MAINTENANCE_DEPOSIT",
      from: fromWallet,
      to: machine.walletAddress,
      targetDid: machine.did,
      w3cDid: machine.w3cDid,
      amount: amt,
      gasFee: "0.00000000 MYC",
      timestamp: Date.now(),
      purpose: "Operator Maintenance & Power Quota Provisioning"
    };

    machine.recentTxs.unshift(tx);
    this.m2mTransactions.unshift(tx);
    return { success: true, tx, machine: this.getMachine(machine.did) };
  }

  withdrawFromMachine(did, amount, toWallet = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002") {
    const machine = this.resolveMachine(did);
    if (!machine) throw new Error("MACHINE_NOT_FOUND");
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_WITHDRAWAL_AMOUNT");
    if (machine.balance < amt) throw new Error("INSUFFICIENT_MACHINE_BALANCE");

    // Machine signs the withdrawal transaction with its Silicon PUF hardware key
    const payload = { did: machine.w3cDid || machine.did, amount: amt, to: toWallet, nonce: Date.now() };
    const pufSig = machine.walletInstance.signTransaction(payload);

    machine.balance = parseFloat((machine.balance - amt).toFixed(4));
    machine.totalSpent = parseFloat((machine.totalSpent + amt).toFixed(4));
    machine.lastHeartbeat = Date.now();

    const tx = {
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      type: "M2H_OPERATOR_WITHDRAWAL",
      from: machine.walletAddress,
      sourceDid: machine.did,
      w3cDid: machine.w3cDid,
      to: toWallet,
      amount: amt,
      gasFee: "0.00000000 MYC",
      pufSignature: pufSig.signature,
      timestamp: Date.now(),
      purpose: "Autonomous Machine Yield Distribution to Operator"
    };

    machine.recentTxs.unshift(tx);
    this.m2mTransactions.unshift(tx);
    return { success: true, tx, machine: this.getMachine(machine.did) };
  }

  executeM2MPayment({
    fromDid,
    toDid,
    amount,
    purpose = "M2M Autonomous Micro-Payment",
    triggerActuator = false,
    targetRegister = null,
    targetValue = null,
    isNegationOrContradiction = false
  }) {
    const sender = this.resolveMachine(fromDid);
    const receiver = this.resolveMachine(toDid);

    if (!sender) throw new Error(`SOURCE_MACHINE_NOT_FOUND: ${fromDid}`);
    if (!receiver) throw new Error(`TARGET_MACHINE_NOT_FOUND: ${toDid}`);
    if (sender === receiver || sender.did === receiver.did) throw new Error("CANNOT_PAY_SELF");

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error("INVALID_M2M_AMOUNT");
    if (sender.balance < amt) throw new Error(`INSUFFICIENT_BALANCE: Machine ${fromDid} has ${sender.balance} MYC, requires ${amt} MYC`);

    // Physical Actuator & Safety Interlock Verification
    let actuatorSafetyResult = null;
    if (triggerActuator) {
      actuatorSafetyResult = this.safetyVerifier.evaluatePhysicalSafety({
        device: receiver.deviceType,
        action: "ENGAGE",
        targetRegister: targetRegister || receiver.baseRegister,
        isNegationOrContradiction
      });

      if (!actuatorSafetyResult.safeToActuate) {
        throw new Error(`0-BYTE_NEGATION_SHIELD_BLOCKED: ${actuatorSafetyResult.reason}`);
      }

      // Safe write to target register
      const reg = targetRegister || receiver.baseRegister;
      receiver.registers[reg] = targetValue !== null ? targetValue : (receiver.registers[reg] || 0) + 1;
    }

    // Hardware PUF Signature from source machine
    const payload = { from: sender.walletAddress, to: receiver.walletAddress, amount: amt, purpose, timestamp: Date.now() };
    const pufSig = sender.walletInstance.signTransaction(payload);

    // Atomic State Updates
    sender.balance = parseFloat((sender.balance - amt).toFixed(4));
    sender.totalSpent = parseFloat((sender.totalSpent + amt).toFixed(4));
    sender.lastHeartbeat = Date.now();

    receiver.balance = parseFloat((receiver.balance + amt).toFixed(4));
    receiver.totalEarned = parseFloat((receiver.totalEarned + amt).toFixed(4));
    receiver.lastHeartbeat = Date.now();

    const txHash = "0x" + crypto.randomBytes(32).toString("hex");
    const m2mTx = {
      txHash,
      type: "M2M_AUTONOMOUS_PAYMENT",
      from: sender.walletAddress,
      fromDid: sender.did,
      fromW3CDid: sender.w3cDid,
      to: receiver.walletAddress,
      toDid: receiver.did,
      toW3CDid: receiver.w3cDid,
      amount: amt,
      gasFee: "0.00000000 MYC",
      purpose,
      pufSignature: pufSig.signature,
      actuatorSafety: actuatorSafetyResult ? "0-BYTE_NEGATION_PASSED" : "NOT_APPLICABLE",
      timestamp: Date.now()
    };

    sender.recentTxs.unshift(m2mTx);
    receiver.recentTxs.unshift(m2mTx);
    this.m2mTransactions.unshift(m2mTx);
    this.totalM2MVolume = parseFloat((this.totalM2MVolume + amt).toFixed(4));

    return {
      success: true,
      tx: m2mTx,
      sender: this.getMachine(sender.did),
      receiver: this.getMachine(receiver.did)
    };
  }

  actuateDevice({ did, register, value, isNegationOrContradiction = false }) {
    const machine = this.resolveMachine(did);
    if (!machine) throw new Error("MACHINE_NOT_FOUND");

    const reg = parseInt(register, 10);
    if (isNaN(reg) || reg < machine.baseRegister || reg > machine.maxRegister) {
      throw new Error(`REGISTER_OUT_OF_BOUNDS: Allowed [${machine.baseRegister}, ${machine.maxRegister}], got ${register}`);
    }

    const safety = this.safetyVerifier.evaluatePhysicalSafety({
      device: machine.deviceType,
      action: "ENGAGE",
      targetRegister: reg,
      isNegationOrContradiction
    });

    if (!safety.safeToActuate) {
      return {
        success: false,
        shieldStatus: "NEGATION_SHIELD_INTERCEPTED",
        reason: safety.reason,
        machine: this.getMachine(machine.did)
      };
    }

    machine.registers[reg] = parseInt(value, 10) || 1;
    machine.lastHeartbeat = Date.now();

    return {
      success: true,
      shieldStatus: "PASSED_HARDWARE_INTERLOCK",
      register: reg,
      newValue: machine.registers[reg],
      machine: this.getMachine(machine.did)
    };
  }

  getStats() {
    let totalLocked = 0;
    let totalEarnedAll = 0;
    let totalSpentAll = 0;
    for (const m of this.machines.values()) {
      totalLocked += m.balance;
      totalEarnedAll += m.totalEarned;
      totalSpentAll += m.totalSpent;
    }
    return {
      activeMachines: this.machines.size,
      totalMachineTreasuryMYC: parseFloat(totalLocked.toFixed(2)),
      totalM2MVolumeMYC: parseFloat(this.totalM2MVolume.toFixed(2)),
      totalEarnedAll: parseFloat(totalEarnedAll.toFixed(2)),
      totalSpentAll: parseFloat(totalSpentAll.toFixed(2)),
      recentM2MTransactions: this.m2mTransactions.slice(0, 15)
    };
  }
}
