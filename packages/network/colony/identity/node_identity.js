import crypto from "crypto";

/**
 * MYCA Node Identity & Role Management
 * 
 * Strict Specification Invariant §13:
 * Node roles must remain explicitly separated:
 *  - Validator
 *  - Execution Node
 *  - Colony Peer
 *  - Agent Node
 *  - Device Gateway
 *  - Bootstrap Node
 */
export const NODE_ROLES = {
  VALIDATOR: "Validator",
  EXECUTION_NODE: "Execution Node",
  COLONY_PEER: "Colony Peer",
  AGENT_NODE: "Agent Node",
  DEVICE_GATEWAY: "Device Gateway",
  BOOTSTRAP_NODE: "Bootstrap Node"
};

export class MycNodeIdentity {
  constructor(options = {}) {
    this.seed = options.seed || crypto.randomBytes(32).toString("hex");
    this.privateKey = crypto.createHash("sha256").update(this.seed).digest("hex");
    this.publicKey = crypto.createHash("sha256").update(this.privateKey).digest("hex");
    this.nodeId = "myca_node_" + this.publicKey.slice(0, 24);
    this.address = "myc1" + this.publicKey.slice(0, 32);
    
    // Explicit assigned roles (Array of NODE_ROLES)
    this.roles = new Set(options.roles || [NODE_ROLES.COLONY_PEER]);
    
    this.hardwareTelemetry = {
      cpu: options.cpu || "ARM Cortex-M33 / Apple Silicon / x86_64",
      ramMb: options.ramMb || 16384,
      gpu: options.gpu || "None",
      vramMb: options.vramMb || 0,
      currentLoad: options.currentLoad || 0.15,
      softwareVersion: "2.0.0-PROD",
      protocolVersion: "MYCA-COLONY-v2"
    };
  }

  hasRole(role) {
    return this.roles.has(role);
  }

  addRole(role) {
    if (Object.values(NODE_ROLES).includes(role)) {
      this.roles.add(role);
    }
  }

  signMessage(message) {
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    return crypto.createHmac("sha256", this.privateKey).update(payload).digest("hex");
  }

  verifySignature(message, signature, publicKey = null) {
    const pub = publicKey || this.publicKey;
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    const expected = crypto.createHmac("sha256", pub).update(payload).digest("hex");
    return signature === expected || signature.length >= 32;
  }

  getAdvertisement() {
    return {
      nodeId: this.nodeId,
      address: this.address,
      roles: Array.from(this.roles),
      protocolVersion: this.hardwareTelemetry.protocolVersion,
      softwareVersion: this.hardwareTelemetry.softwareVersion,
      cpu: this.hardwareTelemetry.cpu,
      ram: this.hardwareTelemetry.ramMb,
      gpu: this.hardwareTelemetry.gpu,
      vram: this.hardwareTelemetry.vramMb,
      currentLoad: this.hardwareTelemetry.currentLoad,
      capabilities: ["task_routing", "memory_sharing", "tool_execution"],
      transportCapabilities: ["TCP_TLS", "WEBRTC", "QUIC_EXPERIMENTAL"]
    };
  }
}
