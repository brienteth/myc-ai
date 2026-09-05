import { MycTransport } from "./transport.js";

/**
 * Browser-to-Node & Browser-to-Browser Transport: WebRTC DataChannel
 * 
 * Invariant §9:
 * WebRTC DataChannel is the primary, certified browser transport, NOT a fallback.
 */
export class MycWebRtcTransport extends MycTransport {
  constructor(options = {}) {
    super("WEBRTC_DATACHANNEL");
    this.iceServers = options.iceServers || [
      { urls: "stun:stun.l.google.com:19302" }
    ];
    this.channels = new Map(); // peerId -> RTCDataChannel
  }

  capabilities() {
    return {
      name: "WEBRTC_DATACHANNEL",
      role: "PRIMARY_BROWSER_TRANSPORT",
      isBrowserCompatible: true,
      encryption: "DTLS_SRTP",
      multiplexing: true,
      natTraversal: "STUN_TURN_SUPPORTED"
    };
  }

  registerChannel(peerId, dataChannel) {
    this.channels.set(peerId, dataChannel);
    dataChannel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.dispatchMessage(peerId, parsed);
      } catch (e) {
        this.dispatchMessage(peerId, event.data);
      }
    };
    dataChannel.onclose = () => {
      this.channels.delete(peerId);
    };
  }

  async send(peerId, message) {
    const channel = this.channels.get(peerId);
    if (!channel || channel.readyState !== "open") {
      throw new Error(`WEBRTC_CHANNEL_NOT_OPEN: ${peerId}`);
    }
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    channel.send(payload);
    return { sent: true };
  }
}
