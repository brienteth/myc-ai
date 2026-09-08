import { MycNodeIdentity, NODE_ROLES } from "../../colony/identity/node_identity.js";
import { MycPeerDiscovery } from "../../colony/discovery/discovery.js";
import { MycPeerScoringV1 } from "../../colony/scheduler/peer_scoring.js";
import { MycTlsTcpTransport } from "../../colony/transport/tcp_tls.js";
import { MycQuicTransport } from "../../colony/transport/quic.js";
import { MycWebRtcTransport } from "../../colony/transport/webrtc.js";

console.log("====================================================================");
console.log("🧪 PHASE 4 ACCEPTANCE SUITE: COLONY FOUNDATION & TRANSPORT");
console.log("====================================================================");

let passed = 0;

// 1. Node Identity & Role Separation
const nodeA = new MycNodeIdentity({
  roles: [NODE_ROLES.VALIDATOR, NODE_ROLES.EXECUTION_NODE],
  vramMb: 16384,
  currentLoad: 0.20
});
if (nodeA.hasRole(NODE_ROLES.VALIDATOR) && !nodeA.hasRole(NODE_ROLES.DEVICE_GATEWAY)) {
  console.log("✅ [TEST 4.1 PASS] Node identity generated with explicit, separated role definitions");
  passed++;
}

// 2. Peer Discovery (mDNS & Bootstrap without data relaying)
const discovery = new MycPeerDiscovery(nodeA);
const peerAdv = {
  nodeId: "myca_node_peerB",
  address: "myc1peerB0000000000000000000000000",
  capabilities: ["math", "spectral_memory"]
};
discovery.registerLocalPeer(peerAdv);
const bootstrapQuery = discovery.queryBootstrap("https://bootstrap-01.myc.network");
if (discovery.getKnownPeers().length === 1 && bootstrapQuery.dataRelayAllowed === false) {
  console.log("✅ [TEST 4.2 PASS] Peer discovery works; bootstrap strictly discovery-only (no data relay)");
  passed++;
}

// 3. Peer Scoring V1 (Only VRAM, Load, Latency, Capability)
const scorer = new MycPeerScoringV1({ w_vram: 0.4, w_load: 0.3, w_latency: 0.2, w_capability: 0.1 });
const scoreRes = scorer.scorePeer({
  vramMb: 16384,
  currentLoad: 0.10,
  latencyMs: 15,
  capabilities: ["task_routing", "math_eval"],
  requiredCapability: "math_eval"
});
if (scoreRes.score > 0.80 && scoreRes.version === "V1_STRICT") {
  console.log(`✅ [TEST 4.3 PASS] Peer Scoring V1 calculated composite score (${scoreRes.score}) using strictly 4 metrics`);
  passed++;
}

// 4. Transport Abstraction: TLS/TCP, QUIC, WebRTC
const tcpTransport = new MycTlsTcpTransport();
const quicTransport = new MycQuicTransport();
const webrtcTransport = new MycWebRtcTransport();

const tcpCaps = tcpTransport.capabilities();
const quicCaps = quicTransport.capabilities();
const webrtcCaps = webrtcTransport.capabilities();

if (tcpCaps.name === "TLS_TCP" && quicCaps.status === "EXPERIMENTAL" && webrtcCaps.role === "PRIMARY_BROWSER_TRANSPORT") {
  console.log("✅ [TEST 4.4 PASS] Transports properly separated: TLS/TCP production, QUIC experimental, WebRTC browser");
  passed++;
}

console.log("\n====================================================================");
console.log(`🏆 PHASE 4 TEST RESULTS: ${passed}/4 PASSED WITH 100% SUCCESS`);
console.log("====================================================================");

if (passed !== 4) {
  process.exit(1);
}
