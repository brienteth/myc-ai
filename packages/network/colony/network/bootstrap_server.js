import net from "net";

/**
 * MYCA Bootstrap Discovery Server (bootstrap-01)
 * 
 * Invariants:
 *  - Discovery only; NEVER proxies or relays data plane traffic.
 *  - Accepts peer registration and peer query requests over TCP.
 *  - Can be stopped at any time to verify P2P peer resilience.
 */
export class MycBootstrapServer {
  constructor(name = "bootstrap-01") {
    this.name = name;
    this.server = null;
    this.port = null;
    this.host = "127.0.0.1";
    this.peers = new Map(); // nodeId -> { nodeId, role, host, port, capabilities }
    this.sockets = new Set();
    this.isRunning = false;
  }

  async start(preferredPort = 0) {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.sockets.add(socket);
        let buffer = "";

        socket.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep remainder

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              const response = this.handleMessage(msg);
              socket.write(JSON.stringify(response) + "\n");
            } catch (err) {
              socket.write(JSON.stringify({ error: err.message }) + "\n");
            }
          }
        });

        socket.on("close", () => this.sockets.delete(socket));
        socket.on("error", () => this.sockets.delete(socket));
      });

      this.server.listen(preferredPort, this.host, () => {
        this.port = this.server.address().port;
        this.isRunning = true;
        resolve({ name: this.name, host: this.host, port: this.port });
      });

      this.server.on("error", reject);
    });
  }

  handleMessage(msg) {
    if (msg.action === "REGISTER") {
      this.peers.set(msg.peer.nodeId, {
        nodeId: msg.peer.nodeId,
        role: msg.peer.role,
        host: msg.peer.host,
        port: msg.peer.port,
        capabilities: msg.peer.capabilities || []
      });
      return { status: "REGISTERED", registeredNodeId: msg.peer.nodeId };
    }

    if (msg.action === "GET_PEERS") {
      // Exclude the querying peer
      const peerList = Array.from(this.peers.values())
        .filter((p) => p.nodeId !== msg.nodeId);
      return {
        status: "SUCCESS",
        role: "DISCOVERY_ONLY",
        dataRelayAllowed: false,
        peers: peerList
      };
    }

    return { status: "UNKNOWN_ACTION" };
  }

  async stop() {
    this.isRunning = false;
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
    this.peers.clear();
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
  }
}
