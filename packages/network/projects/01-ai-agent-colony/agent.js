import crypto from "node:crypto";

/**
 * Lightweight Sovereign Hardware/Agent Wallet
 */
export class MycHardwareWallet {
  constructor(privateKey = null) {
    this.privateKey = privateKey || crypto.randomBytes(32).toString("hex");
    this.publicKey = crypto.createHash("sha256").update(this.privateKey).digest("hex");
    this.address = "myc1" + crypto.createHash("sha256").update(this.publicKey).digest("hex").slice(0, 32);
  }
}

/**
 * Autonomous Colony AI Agent for MYC Network (Chain ID 108)
 * Demonstrates:
 * 1. Sovereign Agent Identity & Address Generation
 * 2. Capability Registration on the Colony Marketplace
 * 3. Autonomous Cognitive Task Execution
 * 4. Dual-PoR (Proof-of-Resonance) Verification
 * 5. Zero-Gas Settlement & Reputation Accrual
 */
export class MycColonyAgent {
  constructor(options = {}) {
    this.agentId = options.agentId || "agent-autonomous-risk-" + Math.floor(Math.random() * 1000);
    this.name = options.name || "Sovereign Colony Risk & Arbitrage Agent";
    this.capability = options.capability || "financial_risk_scoring";
    this.nodeUrl = options.nodeUrl || "http://localhost:4040";
    
    // Generate deterministic sovereign agent wallet
    this.wallet = new MycHardwareWallet();
    this.address = this.wallet.address;
    this.reputation = 90;
    this.tasksCompleted = 0;
    this.totalEarned = 0;
  }

  /**
   * 1. Register Capability on Colony Marketplace
   */
  async registerCapability() {
    console.log(`📡 [${this.agentId}] Registering capability on Colony Marketplace...`);
    const res = await fetch(`${this.nodeUrl}/api/capability/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capability: this.capability,
        provider: this.address,
        policyHash: "0xpolicy_" + this.agentId,
        metadata: {
          name: this.name,
          agentId: this.agentId,
          version: "1.0.0",
          specialization: "Real-time Volatility & Escrow Solvency"
        }
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(`Capability registration failed: ${data.error}`);
    }

    console.log(`✅ [${this.agentId}] Capability '${this.capability}' registered! ID: ${data.id}`);
    return data;
  }

  /**
   * 2. Execute Cognitive Task with Dual-PoR Consensus
   */
  async executeTask(payload = {}) {
    console.log(`🧠 [${this.agentId}] Initiating Dual-PoR cognitive task execution...`);
    const taskPayload = {
      agentId: this.agentId,
      capability: this.capability,
      budget: 50,
      payload: payload.data || {
        asset: "USDC_ESCROW_COLLATERAL",
        collateralRatio: 1.75,
        volatilityIndex: 0.18,
        marketDepthUsd: 2500000
      }
    };

    const res = await fetch(`${this.nodeUrl}/api/agent/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskPayload)
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(`Task execution failed: ${data.error}`);
    }

    this.tasksCompleted++;
    this.totalEarned += data.settlement.payoutToWorkers;
    this.reputation += 10;

    console.log(`🎉 [${this.agentId}] Task #${data.taskId} finalized!`);
    console.log(`   • Proof-of-Resonance Hash: ${data.settlement.porProofHash.slice(0, 16)}...`);
    console.log(`   • Payout: ${data.settlement.payoutToWorkers} USDC (Gas Fee: 0.00 MYC)`);
    console.log(`   • Verified Provers:`, Object.values(data.provers).join(" & "));

    return data;
  }

  /**
   * 3. Fetch Live On-Chain Balance
   */
  async getBalance() {
    const res = await fetch(`${this.nodeUrl}/api/wallet/balance?address=${this.address}`);
    const data = await res.json();
    return data;
  }
}

// CLI standalone runner
if (process.argv[1] && (process.argv[1].endsWith("/agent.js") || process.argv[1] === "agent.js")) {
  const agent = new MycColonyAgent({
    agentId: "agent-colony-runner-01",
    name: "Production Colony Risk Agent"
  });

  console.log("====================================================================");
  console.log(`🤖 STARTING SOVEREIGN COLONY AI AGENT: ${agent.name}`);
  console.log(`   Address: ${agent.address} | Chain: 108 (Zero-Gas)`);
  console.log("====================================================================");

  try {
    await agent.registerCapability();
    const result = await agent.executeTask();
    console.log("\nExecution Output Result:", JSON.stringify(result.output, null, 2));
    console.log("\nAgent status: READY & MONITORING FOR TASKS.");
  } catch (err) {
    console.error("Agent run error:", err.message);
  }
}
