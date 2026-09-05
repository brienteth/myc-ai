/**
 * MYC Resource Accounting Engine
 * 
 * Invariant §1.2 & §7: Gas = 0 != Resource = 0
 * Tracks real execution telemetry to enforce quotas, admission limits, and anti-spam controls.
 */
export class MycResourceAccounting {
  constructor(quotas = {}) {
    this.quotas = {
      maxCpuTimeMs: quotas.maxCpuTimeMs || 50,
      maxMemoryPeakKb: quotas.maxMemoryPeakKb || 1024,
      maxNetworkBytes: quotas.maxNetworkBytes || 65536,
      maxStorageBytes: quotas.maxStorageBytes || 32768,
      maxExecutionSteps: quotas.maxExecutionSteps || 1000,
      maxProofCost: quotas.maxProofCost || 100
    };
    this.nodeUsage = new Map(); // address/nodeId -> accumulated resources
  }

  trackExecution(targetId, {
    cpuTimeMs = 0,
    memoryPeakKb = 0,
    networkBytes = 0,
    storageBytes = 0,
    executionSteps = 0,
    proofCost = 0
  }) {
    const id = (targetId || "anonymous").toLowerCase();
    const existing = this.nodeUsage.get(id) || {
      totalCpuTimeMs: 0,
      totalMemoryPeakKb: 0,
      totalNetworkBytes: 0,
      totalStorageBytes: 0,
      totalExecutionSteps: 0,
      totalProofCost: 0,
      invocations: 0
    };

    const updated = {
      totalCpuTimeMs: existing.totalCpuTimeMs + cpuTimeMs,
      totalMemoryPeakKb: Math.max(existing.totalMemoryPeakKb, memoryPeakKb),
      totalNetworkBytes: existing.totalNetworkBytes + networkBytes,
      totalStorageBytes: existing.totalStorageBytes + storageBytes,
      totalExecutionSteps: existing.totalExecutionSteps + executionSteps,
      totalProofCost: existing.totalProofCost + proofCost,
      invocations: existing.invocations + 1,
      lastRecorded: Date.now()
    };

    this.nodeUsage.set(id, updated);

    // Admission violation check
    const violations = [];
    if (cpuTimeMs > this.quotas.maxCpuTimeMs) {
      violations.push(`CPU_LIMIT_EXCEEDED: ${cpuTimeMs}ms > ${this.quotas.maxCpuTimeMs}ms`);
    }
    if (memoryPeakKb > this.quotas.maxMemoryPeakKb) {
      violations.push(`MEMORY_LIMIT_EXCEEDED: ${memoryPeakKb}KB > ${this.quotas.maxMemoryPeakKb}KB`);
    }
    if (executionSteps > this.quotas.maxExecutionSteps) {
      violations.push(`STEPS_LIMIT_EXCEEDED: ${executionSteps} > ${this.quotas.maxExecutionSteps}`);
    }

    return {
      allowed: violations.length === 0,
      violations,
      record: updated
    };
  }

  getUsage(targetId) {
    return this.nodeUsage.get((targetId || "anonymous").toLowerCase()) || null;
  }
}
