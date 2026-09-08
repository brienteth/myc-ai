import { MycTransport } from "./transport.js";

/**
 * QUIC Transport Adapter (Experimental)
 * 
 * Invariant §9:
 * Node-native QUIC is experimental.
 * Must NOT be an unavoidable hard dependency.
 * Gracefully provides capabilities and flags experimental status.
 */
export class MycQuicTransport extends MycTransport {
  constructor() {
    super("QUIC_EXPERIMENTAL");
    this.isNodeQuicAvailable = false;
    try {
      // Check if runtime has native quic
      if (process.features && process.features.quic) {
        this.isNodeQuicAvailable = true;
      }
    } catch (e) {}
  }

  capabilities() {
    return {
      name: "QUIC_EXPERIMENTAL",
      status: "EXPERIMENTAL",
      preferredProductionBackend: false,
      productionFallback: "TLS_TCP",
      nativeAvailable: this.isNodeQuicAvailable,
      multiplexing: true,
      encryption: "TLS_1_3",
      isBrowserCompatible: false
    };
  }

  async connect(targetUri) {
    if (!this.isNodeQuicAvailable) {
      throw new Error("QUIC_UNAVAILABLE: Node runtime lacks stable QUIC support. Falling back to TLS/TCP transport.");
    }
  }

  async listen(port, host) {
    if (!this.isNodeQuicAvailable) {
      throw new Error("QUIC_UNAVAILABLE: Node runtime lacks stable QUIC support. Falling back to TLS/TCP transport.");
    }
  }
}
