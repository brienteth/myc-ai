/**
 * MYCA Peer Discovery Engine
 * 
 * Invariants §1.3, §10, §11:
 *  - Bootstrap nodes provide discovery only; NOT mandatory data relays.
 *  - Local discovery via mDNS (_myca._tcp.local.)
 *  - WAN discovery via self-hosted bootstrap nodes (bootstrap-01 to bootstrap-04).
 */
export class MycPeerDiscovery {
  constructor(localIdentity, options = {}) {
    this.localIdentity = localIdentity;
    this.serviceType = "_myca._tcp.local.";
    this.bootstrapNodes = options.bootstrapNodes || [
      "https://bootstrap-01.myc.network",
      "https://bootstrap-02.myc.network",
      "https://bootstrap-03.myc.network",
      "https://bootstrap-04.myc.network"
    ];
    this.knownPeers = new Map(); // nodeId -> peerAdvertisement
  }

  registerLocalPeer(peerAdvertisement) {
    if (!peerAdvertisement || !peerAdvertisement.nodeId) return false;
    if (peerAdvertisement.nodeId === this.localIdentity.nodeId) return false; // ignore self
    this.knownPeers.set(peerAdvertisement.nodeId, {
      ...peerAdvertisement,
      discoveredAt: Date.now(),
      discoveryMethod: "mDNS_LOCAL"
    });
    return true;
  }

  queryBootstrap(bootstrapUrl) {
    // Bootstrap returns candidate peer list for DIRECT connection, never proxies traffic
    return {
      bootstrapUrl,
      role: "DISCOVERY_ONLY",
      dataRelayAllowed: false,
      candidatePeers: Array.from(this.knownPeers.values()).map(p => ({
        nodeId: p.nodeId,
        address: p.address,
        capabilities: p.capabilities,
        directEndpoint: `tcp://${p.address || "127.0.0.1"}:4041`
      }))
    };
  }

  getKnownPeers() {
    return Array.from(this.knownPeers.values());
  }

  getPeer(nodeId) {
    return this.knownPeers.get(nodeId) || null;
  }
}
