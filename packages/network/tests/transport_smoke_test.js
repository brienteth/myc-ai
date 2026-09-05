import { MycTlsTcpTransport } from "../colony/transport/tcp_tls.js";
import { MycQuicTransport } from "../colony/transport/quic.js";
import { MycWebRtcTransport } from "../colony/transport/webrtc.js";

async function runTransportSmokeTest() {
  console.log("=== [SMOKE TEST] Multi-Transport Subsystem Verification ===");

  let passed = 0;
  let total = 0;

  // 1. TCP / TLS Server-to-Server Transport
  total++;
  console.log("\n[1] Testing MycTlsTcpTransport...");
  const tcpServer = new MycTlsTcpTransport();
  const tcpClient = new MycTlsTcpTransport();
  const testPort = 5389;

  try {
    let receivedServerMsg = null;
    let receivedClientMsg = null;

    tcpServer.onReceive((peerId, msg) => {
      receivedServerMsg = msg;
    });
    tcpClient.onReceive((peerId, msg) => {
      receivedClientMsg = msg;
    });

    await tcpServer.listen(testPort, "127.0.0.1");
    const connection = await tcpClient.connect(`tcp://127.0.0.1:${testPort}`);

    // Send from client to server
    await tcpClient.send(connection.peerId, { type: "PING", timestamp: Date.now() });
    
    // Give event loop tick
    await new Promise(r => setTimeout(r, 20));

    if (!receivedServerMsg || receivedServerMsg.type !== "PING") {
      throw new Error("Server did not receive client message over TCP");
    }

    // Send back from server to client
    const serverPeerKey = Array.from(tcpServer.peers.keys())[0];
    await tcpServer.send(serverPeerKey, { type: "PONG", status: "OK" });

    await new Promise(r => setTimeout(r, 20));

    if (!receivedClientMsg || receivedClientMsg.type !== "PONG") {
      throw new Error("Client did not receive server response over TCP");
    }

    await tcpClient.close();
    await tcpServer.close();

    console.log("  ✅ MycTlsTcpTransport: Bidirectional message transfer passed.");
    passed++;
  } catch (err) {
    console.error("  ❌ MycTlsTcpTransport failed:", err.message);
    try { await tcpClient.close(); } catch (_) {}
    try { await tcpServer.close(); } catch (_) {}
  }

  // 2. QUIC Transport Runtime Capability & Fallback Smoke Test
  total++;
  console.log("\n[2] Testing MycQuicTransport runtime capability & fallback...");
  const quicTransport = new MycQuicTransport();
  const quicCaps = quicTransport.capabilities();

  console.log("  QUIC Capabilities:", JSON.stringify(quicCaps, null, 2));

  try {
    if (quicCaps.nativeAvailable) {
      console.log("  ⚡ Native QUIC runtime detected on this platform.");
    } else {
      console.log(`  ℹ️ Native Node QUIC not enabled in this runtime (experimental in Node.js). Fallback: ${quicCaps.productionFallback}`);
      let caughtExpectedFallback = false;
      try {
        await quicTransport.connect("quic://127.0.0.1:4043");
      } catch (e) {
        if (e.message.includes("QUIC_UNAVAILABLE") || e.message.includes("Falling back to TLS/TCP")) {
          caughtExpectedFallback = true;
        }
      }
      if (!caughtExpectedFallback) {
        throw new Error("QUIC should cleanly indicate unavailability and propose TLS/TCP fallback");
      }
    }
    console.log("  ✅ MycQuicTransport: Capability detection and fallback mechanics verified.");
    passed++;
  } catch (err) {
    console.error("  ❌ MycQuicTransport failed:", err.message);
  }

  // 3. WebRTC DataChannel Adapter Smoke Test
  total++;
  console.log("\n[3] Testing MycWebRtcTransport (Browser Edge Adapter)...");
  const webrtc = new MycWebRtcTransport();
  const rtcCaps = webrtc.capabilities();

  try {
    if (rtcCaps.name !== "WEBRTC_DATACHANNEL" || !rtcCaps.isBrowserCompatible) {
      throw new Error("WebRTC capabilities incorrect");
    }

    // Mock an RTCDataChannel
    let mockChannelReceived = null;
    const mockChannel = {
      readyState: "open",
      send: (data) => {
        mockChannelReceived = JSON.parse(data);
      },
      onmessage: null,
      onclose: null
    };

    webrtc.registerChannel("browser-peer-01", mockChannel);

    let webrtcIncoming = null;
    webrtc.onReceive((peerId, msg) => {
      webrtcIncoming = { peerId, msg };
    });

    // Simulate browser peer receiving data from network
    await webrtc.send("browser-peer-01", { action: "INFERENCE_REQUEST", model: "spectral-q4" });
    if (!mockChannelReceived || mockChannelReceived.action !== "INFERENCE_REQUEST") {
      throw new Error("WebRTC send did not route to RTCDataChannel");
    }

    // Simulate browser peer sending data to node
    mockChannel.onmessage({ data: JSON.stringify({ action: "INFERENCE_RESPONSE", token: "42" }) });
    if (!webrtcIncoming || webrtcIncoming.msg.action !== "INFERENCE_RESPONSE") {
      throw new Error("WebRTC onMessage did not bubble up");
    }

    console.log("  ✅ MycWebRtcTransport: DataChannel bridging verified.");
    passed++;
  } catch (err) {
    console.error("  ❌ MycWebRtcTransport failed:", err.message);
  }

  // 4. Parallel Execution: Server-to-Server TCP + Browser WebRTC Concurrent Activity
  total++;
  console.log("\n[4] Testing Concurrent Coexistence (Server TCP + Browser WebRTC)...");
  try {
    const tcp = new MycTlsTcpTransport();
    const rtc = new MycWebRtcTransport();

    await tcp.listen(5390, "127.0.0.1");
    const client = new MycTlsTcpTransport();
    const conn = await client.connect("tcp://127.0.0.1:5390");

    let tcpDone = false;
    let rtcDone = false;

    tcp.onReceive((_, msg) => {
      if (msg.task === "SERVER_SYNC") tcpDone = true;
    });

    const mockBrowserChannel = {
      readyState: "open",
      send: () => {},
      onmessage: null,
      onclose: null
    };
    rtc.registerChannel("browser-user-123", mockBrowserChannel);
    rtc.onReceive((_, msg) => {
      if (msg.task === "BROWSER_QUERY") rtcDone = true;
    });

    // Concurrent send
    await Promise.all([
      client.send(conn.peerId, { task: "SERVER_SYNC" }),
      new Promise(res => {
        mockBrowserChannel.onmessage({ data: JSON.stringify({ task: "BROWSER_QUERY" }) });
        res();
      })
    ]);

    await new Promise(r => setTimeout(r, 20));

    if (!tcpDone || !rtcDone) {
      throw new Error("Parallel transport messages were not simultaneously received");
    }

    await client.close();
    await tcp.close();

    console.log("  ✅ Parallel Coexistence: Server-to-Server TCP & Browser WebRTC work concurrently without collision.");
    passed++;
  } catch (err) {
    console.error("  ❌ Parallel Coexistence failed:", err.message);
  }

  console.log(`\n=== Transport Smoke Test Result: ${passed}/${total} Passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTransportSmokeTest().catch(e => {
  console.error(e);
  process.exit(1);
});
