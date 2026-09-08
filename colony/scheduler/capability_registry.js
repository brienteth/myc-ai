import crypto from "crypto";
import { globalEventBus } from "../../core/events/event_bus.js";

/**
 * MYCA Open Colony Capability Marketplace & Registry
 * 
 * Allows external AI teams, model providers, and DePIN networks to register
 * custom cognitive capabilities onto the MYCA network substrate.
 * Examples:
 *  - `protein_folding` (Biotech / AlphaFold integration)
 *  - `soil_analysis` (DePIN Agri-tech sensor inference)
 *  - `llama3_70b` (Decentralized LLM inference)
 *  - `satellite_image_analysis` (Geospatial telemetry)
 *  - `legal_review` (Autonomous corporate contract verification)
 */
export class MycCapabilityRegistry {
  constructor() {
    this.capabilities = new Map(); // name -> capabilityDefinition
  }

  /**
   * Register a new custom capability from a third-party developer
   */
  registerCapability(name, {
    providerAddress = "myc1provider000000000000000000000000",
    minVramMb = 8192,
    pricePerTask = 0.5,
    priceAsset = "USDC",
    handler = null,
    schema = {},
    description = ""
  } = {}) {
    if (!name || typeof name !== "string") {
      throw new Error("INVALID_CAPABILITY_NAME: Capability name must be a non-empty string");
    }

    const regId = "cap-" + crypto.createHash("sha256").update(`${name}:${providerAddress}`).digest("hex").slice(0, 16);

    const record = {
      id: regId,
      name,
      providerAddress,
      minVramMb: Number(minVramMb) || 0,
      pricePerTask: Number(pricePerTask) || 0,
      priceAsset: String(priceAsset || "USDC").toUpperCase(),
      handler: handler || (async (payload) => ({
        success: true,
        output: `Default execution for custom capability [${name}]`,
        timestamp: Date.now()
      })),
      schema,
      description: description || `Decentralized cognitive capability for ${name}`,
      registeredAt: Date.now(),
      totalExecutions: 0,
      totalEarned: 0
    };

    this.capabilities.set(name.toLowerCase(), record);

    // Broadcast registration event
    globalEventBus.emitEvent("colony:capability:registered", {
      id: regId,
      name,
      providerAddress,
      minVramMb: record.minVramMb,
      pricePerTask: record.pricePerTask,
      priceAsset: record.priceAsset
    });

    return {
      success: true,
      id: regId,
      name,
      pricePerTask: record.pricePerTask,
      priceAsset: record.priceAsset
    };
  }

  /**
   * Fetch details of a specific capability
   */
  getCapability(name) {
    return this.capabilities.get((name || "").toLowerCase()) || null;
  }

  /**
   * List all registered public capabilities
   */
  listCapabilities() {
    return Array.from(this.capabilities.values()).map(c => ({
      id: c.id,
      name: c.name,
      providerAddress: c.providerAddress,
      minVramMb: c.minVramMb,
      pricePerTask: c.pricePerTask,
      priceAsset: c.priceAsset,
      description: c.description,
      registeredAt: c.registeredAt,
      totalExecutions: c.totalExecutions,
      totalEarned: c.totalEarned
    }));
  }

  /**
   * Execute task via registered capability handler
   */
  async execute(name, payload = {}, context = {}) {
    const cap = this.getCapability(name);
    if (!cap) {
      throw new Error(`CAPABILITY_NOT_FOUND: '${name}' is not registered on the Colony marketplace`);
    }

    const startTime = Date.now();
    try {
      const result = await cap.handler(payload, context);
      cap.totalExecutions++;
      cap.totalEarned += cap.pricePerTask;

      const durationMs = Date.now() - startTime;
      const proofHash = "0x" + crypto.createHash("sha256").update(JSON.stringify(result) + cap.id).digest("hex");

      globalEventBus.emitEvent("colony:task:settled", {
        capability: name,
        proofHash,
        durationMs,
        payout: cap.pricePerTask,
        asset: cap.priceAsset,
        provider: cap.providerAddress
      });

      return {
        success: true,
        capability: name,
        output: result,
        durationMs,
        proofHash,
        cost: {
          amount: cap.pricePerTask,
          asset: cap.priceAsset
        }
      };
    } catch (err) {
      throw new Error(`CAPABILITY_EXECUTION_FAILED: ${err.message}`);
    }
  }
}

export const globalCapabilityRegistry = new MycCapabilityRegistry();
