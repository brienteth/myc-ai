import crypto from "crypto";

/**
 * MYC Agent Bridge Gateway
 * 
 * Unified Orchestration Layer for three core scenarios:
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ SENARYO 1 — Opacus Cross-Chain Intent                         │
 * │   Opacus intent → MycBridge lock → Colony execute → Settle    │
 * │                                                                │
 * │ SENARYO 2 — IoT / DePIN M2M Data Marketplace                 │
 * │   Turbine sensor → data publish → Pump agent buys → PoR+Act  │
 * │                                                                │
 * │ SENARYO 3 — Agent Economy Substrate                           │
 * │   Opacus orchestrator → MycAgentRegistry → Colony → Settle   │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Invariants:
 *  - Zero Gas: All transactions strictly 0.00 MYC gas
 *  - 0-Byte Negation Shield: Physical actuation interlocks enforced
 *  - BFT Bridge Quorum: 2/3 + 1 supermajority for cross-chain release
 */
export class MycAgentBridgeGateway {
  constructor({
    bridgeContract,
    escrowContract,
    taskRegistryContract,
    agentRegistryContract,
    reputationContract,
    tokenContract,
    colonyScheduler,
    machineManager,
    streamPayContract,
    opacusPayContract
  }) {
    this.bridge = bridgeContract;
    this.escrow = escrowContract;
    this.taskRegistry = taskRegistryContract;
    this.agentRegistry = agentRegistryContract;
    this.reputation = reputationContract;
    this.token = tokenContract;
    this.colony = colonyScheduler;
    this.machines = machineManager;
    this.streamPay = streamPayContract || opacusPayContract;
    this.opacusPay = this.streamPay;

    // Event log for tracing full flows
    this.flowLog = [];
    this.completedFlows = [];
  }

  _log(flowId, step, detail) {
    const entry = {
      flowId,
      step,
      detail,
      timestamp: Date.now(),
      gasUsed: "0.00000000 MYC"
    };
    this.flowLog.push(entry);
    return entry;
  }

  _generateId(prefix) {
    return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SENARYO 1: Opacus Cross-Chain Intent
  // ═══════════════════════════════════════════════════════════════════
  // Flow: Opacus intent → MycBridge lock → Colony execute → Settle
  // ═══════════════════════════════════════════════════════════════════
  async executeOpacusCrossChainIntent({
    agentId = "opacus-orchestrator",
    targetChain = "BASE",
    recipientRemote = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    bridgeAmount = 100,
    taskCapability = "financial_risk_scoring",
    taskPayload = {},
    taskBudget = 50,
    sender = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002"
  }) {
    const flowId = this._generateId("flow_opacus_xchain");
    const result = { flowId, scenario: "OPACUS_CROSS_CHAIN_INTENT", steps: [], success: false };

    try {
      // Step 1: Register agent if not exists
      this._log(flowId, "AGENT_CHECK", { agentId });
      try {
        this.agentRegistry.registerAgent(
          agentId,
          `Opacus Cross-Chain Agent (${agentId})`,
          [taskCapability, "bridge_operations"],
          crypto.createHash("sha256").update(agentId).digest("hex"),
          { msgSender: sender }
        );
        result.steps.push({ step: "AGENT_REGISTERED", agentId });
      } catch (e) {
        // Already registered — expected
        result.steps.push({ step: "AGENT_ALREADY_REGISTERED", agentId });
      }

      // Step 2: Bridge Lock — lock MYC tokens for cross-chain transfer
      this._log(flowId, "BRIDGE_LOCK", { targetChain, amount: bridgeAmount });
      const bridgeRecord = this.bridge.lockAndBridge(
        targetChain,
        recipientRemote,
        bridgeAmount,
        { msgSender: sender }
      );
      result.steps.push({
        step: "BRIDGE_LOCKED",
        bridgeId: bridgeRecord.bridgeId,
        amount: bridgeRecord.amount,
        fee: bridgeRecord.fee,
        targetChain: bridgeRecord.targetChain,
        lockProof: bridgeRecord.lockProof
      });

      // Step 3: Create & fund escrow for task execution
      const escrowId = this._generateId("esc");
      this._log(flowId, "ESCROW_CREATE", { escrowId, budget: taskBudget });
      this.escrow.createEscrow(
        escrowId,
        "myc1colonyprovers0000000000000000",
        taskBudget,
        "MYC",
        600,
        { msgSender: sender }
      );
      this.escrow.fundEscrow(escrowId, { msgSender: sender });
      result.steps.push({ step: "ESCROW_FUNDED", escrowId, amount: taskBudget });

      // Step 4: Register task on-chain
      const taskId = this._generateId("task");
      this._log(flowId, "TASK_REGISTER", { taskId, escrowId });
      this.taskRegistry.registerTask(taskId, escrowId, taskCapability, { msgSender: sender });
      result.steps.push({ step: "TASK_REGISTERED", taskId, escrowId, capability: taskCapability });

      // Step 5: Colony dual-execution with PoR
      this._log(flowId, "COLONY_EXECUTE", { taskId });
      const cogTask = {
        taskId,
        creatorNodeId: agentId,
        capabilityRequired: taskCapability,
        payload: taskPayload,
        rewardAmount: taskBudget,
        requiresDualVerification: true,
        assignTo(n) { this.assignedTo = n; },
        startExecution() { this.status = "EXECUTING"; },
        complete(res, proof) { this.result = res; this.proof = proof; this.status = "COMPLETED"; },
        fail(err) { this.error = err; this.status = "FAILED"; },
        canRetry() { return false; }
      };
      const execResult = await this.colony.scheduleWithDualVerification(cogTask);

      if (!execResult.success) {
        throw new Error(execResult.task?.error || "COLONY_DUAL_EXECUTION_FAILED");
      }
      result.steps.push({
        step: "COLONY_DUAL_VERIFIED",
        proofHash: execResult.executionProof?.proofHash,
        primaryNode: execResult.executionProof?.primaryExecutor,
        verifierNode: execResult.executionProof?.verifierNode,
        outputHash: execResult.executionProof?.outputHash
      });

      // Step 6: Settle escrow with proof
      this._log(flowId, "ESCROW_SETTLE", { escrowId });
      this.escrow.submitExecutionProof(
        escrowId,
        execResult.executionProof?.proofHash || "0x_default_proof",
        { msgSender: "myc1colonyprovers0000000000000000" }
      );
      this.escrow.attestAndRelease(escrowId, { msgSender: sender });
      result.steps.push({ step: "ESCROW_SETTLED", escrowId, payout: taskBudget * 0.95 });

      // Step 7: BFT Bridge Release on target chain (simulated validator signatures)
      this._log(flowId, "BRIDGE_RELEASE", { bridgeId: bridgeRecord.bridgeId });
      const releaseRecord = this.bridge.releaseWithSignatures(
        bridgeRecord.bridgeId,
        "MYC-LATTICE",
        recipientRemote.toLowerCase(),
        bridgeRecord.amount,
        bridgeRecord.nonce,
        Array.from(this.bridge.validatorSet).slice(0, this.bridge.getRequiredQuorum()),
        { msgSender: sender }
      );
      result.steps.push({
        step: "BRIDGE_RELEASED",
        transferId: releaseRecord.transferId,
        recipient: releaseRecord.recipient,
        amount: releaseRecord.amount,
        signaturesCount: releaseRecord.signaturesCount,
        requiredQuorum: releaseRecord.requiredQuorum
      });

      // Step 8: Update reputation for provers
      this._log(flowId, "REPUTATION_UPDATE", { nodes: ["colony_worker_alpha", "colony_worker_beta"] });
      this.reputation.recordSuccess("colony_worker_alpha");
      this.reputation.recordSuccess("colony_worker_beta");
      result.steps.push({ step: "REPUTATION_UPDATED", provers: ["colony_worker_alpha", "colony_worker_beta"] });

      result.success = true;
      result.summary = {
        bridgeLocked: bridgeRecord.amount,
        bridgeFee: bridgeRecord.fee,
        taskPayout: taskBudget * 0.95,
        taskFee: taskBudget * 0.05,
        bridgeReleased: releaseRecord.amount,
        totalSteps: result.steps.length,
        gasUsed: "0.00000000 MYC"
      };
      this.completedFlows.push(result);
      return result;

    } catch (err) {
      result.error = err.message;
      this._log(flowId, "FLOW_FAILED", { error: err.message });
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SENARYO 2: IoT / DePIN M2M Data Marketplace
  // ═══════════════════════════════════════════════════════════════════
  // Flow: Turbine sensor → data publish → Pump agent buys → 
  //       PoR verify → Actuator trigger → Escrow settle
  // ═══════════════════════════════════════════════════════════════════
  async executeM2MDataTrade({
    sellerDid = "TURBINE_01",
    buyerDid = "PUMP_01",
    dataType = "TEMPERATURE_READINGS",
    pricePerUnit = 5,
    units = 10,
    actuateOnPurchase = null // e.g., { device: "PUMP", action: "START" }
  }) {
    const flowId = this._generateId("flow_m2m_data");
    const result = { flowId, scenario: "IOT_M2M_DATA_MARKETPLACE", steps: [], success: false };

    try {
      // Step 1: Verify seller machine exists and has data
      const seller = this.machines.getMachine(sellerDid);
      if (!seller) throw new Error(`SELLER_MACHINE_NOT_FOUND: ${sellerDid}`);
      result.steps.push({
        step: "SELLER_VERIFIED",
        did: sellerDid,
        wallet: seller.walletAddress,
        balance: seller.balance,
        telemetry: seller.telemetry
      });

      // Step 2: Verify buyer machine exists and has funds
      const buyer = this.machines.getMachine(buyerDid);
      if (!buyer) throw new Error(`BUYER_MACHINE_NOT_FOUND: ${buyerDid}`);
      const totalCost = pricePerUnit * units;
      if (buyer.balance < totalCost) throw new Error(`INSUFFICIENT_BUYER_BALANCE: ${buyer.balance} < ${totalCost}`);
      result.steps.push({
        step: "BUYER_VERIFIED",
        did: buyerDid,
        wallet: buyer.walletAddress,
        balance: buyer.balance,
        required: totalCost
      });

      // Step 3: Create escrow for data trade
      const escrowId = this._generateId("esc_m2m");
      this._log(flowId, "M2M_ESCROW_CREATE", { sellerDid, buyerDid, totalCost });
      this.escrow.createEscrow(
        escrowId,
        seller.walletAddress,
        totalCost,
        "MYC",
        120,
        { msgSender: buyer.walletAddress }
      );
      this.escrow.fundEscrow(escrowId, { msgSender: buyer.walletAddress });
      result.steps.push({ step: "M2M_ESCROW_FUNDED", escrowId, amount: totalCost });

      // Step 4: Register data trade task
      const taskId = this._generateId("task_m2m");
      this._log(flowId, "M2M_TASK_REGISTER", { taskId, dataType, units });
      this.taskRegistry.registerTask(taskId, escrowId, `DATA_FEED_${dataType}`, { msgSender: buyer.walletAddress });
      result.steps.push({ step: "M2M_TASK_REGISTERED", taskId, dataType, units });

      // Step 5: Simulate data delivery with PoR proof
      const sensorData = {
        source: sellerDid,
        dataType,
        readings: Array.from({ length: units }, (_, i) => ({
          timestamp: Date.now() - (units - i) * 60000,
          value: seller.telemetry ? Object.values(seller.telemetry)[0] + (Math.random() * 2 - 1) : 42 + Math.random() * 5,
          unit: dataType === "TEMPERATURE_READINGS" ? "°C" : "unit"
        })),
        integrityHash: crypto.createHash("sha256").update(`${sellerDid}:${dataType}:${units}:${Date.now()}`).digest("hex")
      };
      const proofHash = "0x" + crypto.createHash("sha256").update(JSON.stringify(sensorData)).digest("hex");
      result.steps.push({
        step: "DATA_DELIVERED",
        readings: sensorData.readings.length,
        proofHash,
        integrityHash: sensorData.integrityHash
      });

      // Step 6: Submit PoR proof and settle escrow
      this._log(flowId, "M2M_PROOF_SUBMIT", { proofHash });
      this.escrow.submitExecutionProof(escrowId, proofHash, { msgSender: seller.walletAddress });
      this.escrow.attestAndRelease(escrowId, { msgSender: buyer.walletAddress });
      result.steps.push({ step: "M2M_ESCROW_SETTLED", escrowId, payoutToSeller: totalCost * 0.95 });

      // Step 7: Execute M2M payment through machine wallets
      this._log(flowId, "M2M_PAYMENT", { from: buyerDid, to: sellerDid, amount: totalCost });
      const paymentResult = this.machines.executeM2MPayment({
        fromDid: buyerDid,
        toDid: sellerDid,
        amount: totalCost,
        memo: `DATA_PURCHASE:${dataType}:${units}_units`
      });
      result.steps.push({
        step: "M2M_PAYMENT_SETTLED",
        txHash: paymentResult.tx?.txHash,
        from: buyerDid,
        to: sellerDid,
        amount: totalCost,
        gasUsed: "0.00000000 MYC"
      });

      // Step 8: Optional actuator trigger after purchase
      if (actuateOnPurchase) {
        this._log(flowId, "ACTUATOR_TRIGGER", actuateOnPurchase);
        const actResult = this.machines.actuateDevice({
          did: buyerDid,
          action: actuateOnPurchase.action || "START",
          register: actuateOnPurchase.register || 0,
          value: actuateOnPurchase.value || 0xFF00
        });
        result.steps.push({
          step: "ACTUATOR_EXECUTED",
          device: buyerDid,
          action: actuateOnPurchase.action,
          shieldStatus: actResult.shieldStatus,
          success: actResult.success
        });
      }

      // Step 9: Update reputations
      this.reputation.recordSuccess(sellerDid.toLowerCase());
      this.reputation.recordSuccess(buyerDid.toLowerCase());
      result.steps.push({ step: "M2M_REPUTATION_UPDATED", seller: sellerDid, buyer: buyerDid });

      result.success = true;
      result.summary = {
        seller: sellerDid,
        buyer: buyerDid,
        dataType,
        units,
        totalCost,
        payoutToSeller: totalCost * 0.95,
        protocolFee: totalCost * 0.05,
        gasUsed: "0.00000000 MYC",
        actuatorTriggered: !!actuateOnPurchase,
        totalSteps: result.steps.length
      };
      this.completedFlows.push(result);
      return result;

    } catch (err) {
      result.error = err.message;
      this._log(flowId, "M2M_FLOW_FAILED", { error: err.message });
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SENARYO 3: Agent Economy Substrate
  // ═══════════════════════════════════════════════════════════════════
  // Flow: Opacus orchestrator → register agents → task scheduling →
  //       Colony execution → PoR verification → Settlement → Reputation
  // ═══════════════════════════════════════════════════════════════════
  async executeAgentEconomyWorkflow({
    orchestratorId = "opacus-orchestrator",
    agentIds = ["opacus-risk-agent", "opacus-compliance-agent"],
    taskCapability = "financial_risk_scoring",
    taskPayload = {},
    totalBudget = 100,
    sender = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002"
  }) {
    const flowId = this._generateId("flow_agent_econ");
    const result = { flowId, scenario: "AGENT_ECONOMY_SUBSTRATE", steps: [], success: false };

    try {
      // Step 1: Register orchestrator
      this._log(flowId, "ORCHESTRATOR_REGISTER", { orchestratorId });
      try {
        this.agentRegistry.registerAgent(
          orchestratorId,
          "Opacus Master Orchestrator",
          ["orchestration", "task_routing", "budget_management"],
          crypto.createHash("sha256").update(orchestratorId + "_policy").digest("hex"),
          { msgSender: sender }
        );
        result.steps.push({ step: "ORCHESTRATOR_REGISTERED", id: orchestratorId });
      } catch (e) {
        result.steps.push({ step: "ORCHESTRATOR_ALREADY_REGISTERED", id: orchestratorId });
      }

      // Step 2: Register sub-agents
      const registeredAgents = [];
      for (const agId of agentIds) {
        try {
          this.agentRegistry.registerAgent(
            agId,
            `Opacus Sub-Agent (${agId})`,
            [taskCapability, "reasoning"],
            crypto.createHash("sha256").update(agId + "_policy").digest("hex"),
            { msgSender: sender }
          );
          registeredAgents.push(agId);
        } catch (e) {
          // Already registered
          registeredAgents.push(agId);
        }
      }
      result.steps.push({ step: "SUB_AGENTS_REGISTERED", agents: registeredAgents });

      // Step 3: Open OpacusPay channel for micro-payments
      const channelId = this._generateId("ch_agent");
      this._log(flowId, "PAYMENT_CHANNEL_OPEN", { channelId, budget: totalBudget });
      const channel = this.opacusPay.openChannel(
        channelId,
        "myc1colonyprovers0000000000000000",
        totalBudget,
        3600,
        { msgSender: sender }
      );
      result.steps.push({ step: "PAYMENT_CHANNEL_OPENED", channelId, deposit: totalBudget });

      // Step 4: Create tasks and escrows per sub-agent
      const perAgentBudget = totalBudget / agentIds.length;
      const taskResults = [];

      for (const agId of agentIds) {
        const taskId = this._generateId(`task_${agId.replace(/-/g, "_")}`);
        const escrowId = this._generateId("esc_agent");

        // Create escrow
        this.escrow.createEscrow(
          escrowId,
          "myc1colonyprovers0000000000000000",
          perAgentBudget,
          "MYC",
          300,
          { msgSender: sender }
        );
        this.escrow.fundEscrow(escrowId, { msgSender: sender });

        // Register task
        this.taskRegistry.registerTask(taskId, escrowId, taskCapability, { msgSender: sender });

        // Colony dual-execution
        const cogTask = {
          taskId,
          creatorNodeId: agId,
          capabilityRequired: taskCapability,
          payload: { ...taskPayload, agentId: agId, subBudget: perAgentBudget },
          rewardAmount: perAgentBudget,
          requiresDualVerification: true,
          assignTo(n) { this.assignedTo = n; },
          startExecution() { this.status = "EXECUTING"; },
          complete(res, proof) { this.result = res; this.proof = proof; this.status = "COMPLETED"; },
          fail(err) { this.error = err; this.status = "FAILED"; },
          canRetry() { return false; }
        };

        const execResult = await this.colony.scheduleWithDualVerification(cogTask);

        if (execResult.success) {
          // Settle escrow
          this.escrow.submitExecutionProof(
            escrowId,
            execResult.executionProof?.proofHash || "0x_default",
            { msgSender: "myc1colonyprovers0000000000000000" }
          );
          this.escrow.attestAndRelease(escrowId, { msgSender: sender });

          // Settle micro-payment in channel
          const prevSettled = channel.settledAmount || 0;
          try {
            this.opacusPay.settleMicroPayment(
              channelId,
              prevSettled + perAgentBudget * 0.95,
              { msgSender: sender }
            );
          } catch (e) {
            // Ignore if settlement exceeds deposit
          }

          // Record reputation
          this.reputation.recordSuccess("colony_worker_alpha");
          this.reputation.recordSuccess("colony_worker_beta");

          taskResults.push({
            agentId: agId,
            taskId,
            escrowId,
            status: "SETTLED",
            proofHash: execResult.executionProof?.proofHash,
            payout: perAgentBudget * 0.95
          });
        } else {
          this.reputation.recordTimeout("colony_worker_alpha");
          taskResults.push({
            agentId: agId,
            taskId,
            escrowId,
            status: "FAILED",
            error: execResult.task?.error
          });
        }
      }

      result.steps.push({ step: "TASKS_EXECUTED_AND_SETTLED", results: taskResults });

      // Step 5: Close payment channel
      try {
        this.opacusPay.closeChannel(channelId, { msgSender: sender });
        result.steps.push({ step: "PAYMENT_CHANNEL_CLOSED", channelId });
      } catch (e) {
        result.steps.push({ step: "PAYMENT_CHANNEL_CLOSE_NOTE", note: e.message });
      }

      const settled = taskResults.filter(t => t.status === "SETTLED");
      const failed = taskResults.filter(t => t.status === "FAILED");

      result.success = settled.length > 0;
      result.summary = {
        orchestratorId,
        totalAgents: agentIds.length,
        settledTasks: settled.length,
        failedTasks: failed.length,
        totalPayout: settled.reduce((s, t) => s + t.payout, 0),
        totalFees: settled.reduce((s, t) => s + (perAgentBudget * 0.05), 0),
        gasUsed: "0.00000000 MYC",
        totalSteps: result.steps.length
      };
      this.completedFlows.push(result);
      return result;

    } catch (err) {
      result.error = err.message;
      this._log(flowId, "AGENT_ECON_FLOW_FAILED", { error: err.message });
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Standalone Bridge Release (BFT Quorum Verification)
  // ═══════════════════════════════════════════════════════════════════
  releaseBridgeTransfer({
    bridgeId,
    sourceChain = "MYC-LATTICE",
    recipient,
    amount,
    nonce = 0,
    validatorSigners = null,
    asset = "MYC"
  }) {
    // Auto-select minimum quorum validators if not specified
    const signers = validatorSigners ||
      Array.from(this.bridge.validatorSet).slice(0, this.bridge.getRequiredQuorum());

    return this.bridge.releaseWithSignatures(
      bridgeId,
      sourceChain,
      recipient,
      amount,
      nonce,
      signers,
      {},
      asset
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Status & Introspection
  // ═══════════════════════════════════════════════════════════════════
  getFlowLog() {
    return this.flowLog;
  }

  getCompletedFlows() {
    return this.completedFlows;
  }

  getFlowStats() {
    const byScenario = {};
    for (const flow of this.completedFlows) {
      const key = flow.scenario || "UNKNOWN";
      byScenario[key] = (byScenario[key] || 0) + 1;
    }
    return {
      totalFlows: this.completedFlows.length,
      totalEvents: this.flowLog.length,
      byScenario,
      bridgeStats: {
        totalLocked: this.bridge.totalLockedMYC,
        processedTransfers: this.bridge.processedTransfers.size,
        validatorCount: this.bridge.validatorSet.size,
        requiredQuorum: this.bridge.getRequiredQuorum()
      }
    };
  }
}
