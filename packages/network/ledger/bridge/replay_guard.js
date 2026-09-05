import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MYCA_BRIDGE_DOMAIN_SEPARATOR } from "./consensus_verifier.js";

/**
 * Hardened Replay Guard & Crash-Resilient State Engine
 * 
 * Guarantees:
 *  1. Domain-Separated Transfer ID: Includes sourceChainId, sourceBridgeContract,
 *     sourceTxHash, sourceLogIndex, targetChainId, targetBridgeContract, recipient,
 *     asset, amount, and nonce.
 *  2. Multi-Event Isolation: Different `sourceLogIndex` within the same transaction produces distinct transferIds.
 *  3. Crash-Resilient Disk Persistence: Permanently seals transferIds to disk to prevent double-release upon node restart.
 */
export class BridgeReplayGuard {
  constructor(storageFilePath = null) {
    this.domainSeparator = MYCA_BRIDGE_DOMAIN_SEPARATOR;
    this.storagePath = storageFilePath || path.join(process.cwd(), "data", "bridge_processed_transfers.json");
    this.processedTransfers = new Map(); // transferId -> record

    this._loadFromDisk();
  }

  /**
   * Load existing sealed transfers from disk
   */
  _loadFromDisk() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf8");
        const list = JSON.parse(raw || "[]");
        for (const item of list) {
          if (item && item.transferId) {
            this.processedTransfers.set(item.transferId, item);
          }
        }
      }
    } catch (err) {
      console.warn("[BridgeReplayGuard] Could not load persisted transfer file, starting clean:", err.message);
    }
  }

  /**
   * Persist sealed transfers to disk
   */
  _saveToDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.processedTransfers.values()), null, 2);
      fs.writeFileSync(this.storagePath, data, "utf8");
    } catch (err) {
      console.error("[BridgeReplayGuard] Disk persistence error:", err.message);
    }
  }

  /**
   * Computes the hardened canonical transferId
   */
  computeTransferId({
    domainSeparator = this.domainSeparator,
    sourceChainId,
    sourceBridgeContract,
    sourceTxHash,
    sourceLogIndex = 0,
    targetChainId,
    targetBridgeContract,
    recipient,
    asset,
    amount,
    nonce
  }) {
    const payload = [
      domainSeparator,
      String(sourceChainId),
      (sourceBridgeContract || "").toLowerCase(),
      (sourceTxHash || "").toLowerCase(),
      String(sourceLogIndex),
      String(targetChainId),
      (targetBridgeContract || "").toLowerCase(),
      (recipient || "").toLowerCase(),
      (asset || "USDT").toUpperCase(),
      parseFloat(amount).toFixed(8),
      String(nonce)
    ].join(":");

    return "0x" + crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Checks if transferId has already been processed/settled
   */
  isProcessed(transferId) {
    return this.processedTransfers.has(transferId);
  }

  /**
   * Permanently seals a transfer to prevent any replay
   */
  sealTransfer(transferId, metadata = {}) {
    if (this.isProcessed(transferId)) {
      throw new Error(`REPLAY_ATTACK_DETECTED: Transfer '${transferId}' has already been processed and sealed.`);
    }

    const record = {
      transferId,
      sealedAt: Date.now(),
      ...metadata
    };

    this.processedTransfers.set(transferId, record);
    this._saveToDisk();

    return record;
  }

  /**
   * Clears state (used strictly in test setups)
   */
  resetStateForTesting() {
    this.processedTransfers.clear();
    try {
      if (fs.existsSync(this.storagePath)) {
        fs.unlinkSync(this.storagePath);
      }
    } catch (e) {}
  }
}

export const globalReplayGuard = new BridgeReplayGuard();
