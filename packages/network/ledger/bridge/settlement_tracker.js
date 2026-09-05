/**
 * Cross-Chain Settlement Tracker & State Machine
 * 
 * Strict State Machine:
 *  - PROOF_READY: Funds locked on MYCA, 3/4 BFT signatures collected, calldata ready.
 *  - SUBMITTED: Sent to remote EVM RPC via eth_sendRawTransaction.
 *  - FINALIZED: Inclusion verified in remote block with receipt.status == 1.
 *  - SIMULATED: Testnet/simulation mode without live EVM broadcast.
 *  - FAILED: Remote execution reverted or timed out.
 */

export const SETTLEMENT_STATUSES = {
  PROOF_READY: "PROOF_READY",
  SUBMITTED: "SUBMITTED",
  FINALIZED: "FINALIZED",
  SIMULATED: "SIMULATED",
  FAILED: "FAILED"
};

export class SettlementTracker {
  constructor() {
    this.records = new Map(); // transferId -> record
  }

  register({
    transferId,
    direction,
    asset,
    amount,
    source,
    destination,
    bftQuorum,
    initialStatus = SETTLEMENT_STATUSES.PROOF_READY
  }) {
    const record = {
      transferId,
      direction,
      asset,
      amount,
      status: initialStatus,
      source,
      destination,
      bftQuorum,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      history: [
        { status: initialStatus, timestamp: Date.now(), detail: "Transfer recorded" }
      ]
    };

    this.records.set(transferId, record);
    return record;
  }

  updateStatus(transferId, status, details = {}) {
    const record = this.records.get(transferId);
    if (!record) throw new Error(`UNKNOWN_TRANSFER: ${transferId}`);

    record.status = status;
    record.updatedAt = Date.now();
    record.history.push({
      status,
      timestamp: Date.now(),
      ...details
    });

    if (details.destinationUpdates) {
      record.destination = { ...record.destination, ...details.destinationUpdates };
    }

    return record;
  }

  get(transferId) {
    return this.records.get(transferId) || null;
  }

  getAll() {
    return Array.from(this.records.values()).reverse();
  }
}

export const globalSettlementTracker = new SettlementTracker();
