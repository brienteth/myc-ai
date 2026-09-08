import http from "http";
import crypto from "crypto";
import { globalEventBus } from "./event_bus.js";

/**
 * MYCA RFC-6455 Zero-Dependency WebSocket Server
 * 
 * Provides real-time event streaming for dApps, indexers, and external developers:
 * - Subscribes to `contract:*:EventName`, `block:new`, `depin:telemetry`, etc.
 * - Broadcasts filtered JSON events to connected clients
 * - Can run on standalone port (e.g. 4041) or attach to HTTP server upgrade event
 */
export class MycWebSocketServer {
  constructor(options = {}) {
    this.port = options.port || 4041;
    this.clients = new Set(); // Set of active client objects: { socket, subscriptions, filter }
    this.server = null;
    this._initEventBusBridge();
  }

  start() {
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("MYCA WebSocket Event Gateway (RFC 6455)\nUse ws:// URL to connect.\n");
    });

    this.server.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });

    return new Promise((resolve) => {
      this.server.listen(this.port, "0.0.0.0", () => {
        resolve(this);
      });
    });
  }

  attachToHttpServer(httpServer) {
    httpServer.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  handleUpgrade(req, socket, head) {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    // RFC 6455 WebSocket Handshake
    const acceptKey = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "\r\n"
    ];

    socket.write(responseHeaders.join("\r\n"));

    const client = {
      socket,
      subscriptions: new Set(["*"]), // Default subscribe to all or specific topics
      filter: null,
      id: "ws-" + crypto.randomBytes(6).toString("hex")
    };

    this.clients.add(client);

    // Send welcome frame
    this._sendFrame(client, {
      type: "connected",
      clientId: client.id,
      chainId: 108,
      timestamp: Date.now()
    });

    // Handle inbound frames from client
    socket.on("data", (buffer) => {
      this._handleClientData(client, buffer);
    });

    socket.on("close", () => {
      this.clients.delete(client);
    });

    socket.on("error", () => {
      this.clients.delete(client);
    });
  }

  _handleClientData(client, buffer) {
    try {
      const decoded = this._decodeFrame(buffer);
      if (!decoded) return;

      // Opcode 8 is connection close
      if (decoded.opcode === 8) {
        client.socket.end();
        this.clients.delete(client);
        return;
      }

      // Opcode 9 is ping, reply with pong (opcode 10)
      if (decoded.opcode === 9) {
        this._sendRawFrame(client.socket, decoded.payload, 10);
        return;
      }

      // Opcode 1 is text payload
      if (decoded.opcode === 1) {
        const text = decoded.payload.toString("utf8");
        const msg = JSON.parse(text);

        // Support { subscribe: "topic", filter: {...} } or { action: "subscribe", topic: "..." }
        const topic = msg.subscribe || msg.topic;
        if (topic) {
          client.subscriptions.add(topic);
          if (msg.filter) client.filter = msg.filter;
          this._sendFrame(client, { status: "subscribed", topic, filter: client.filter });
        } else if (msg.unsubscribe) {
          client.subscriptions.delete(msg.unsubscribe);
          this._sendFrame(client, { status: "unsubscribed", topic: msg.unsubscribe });
        } else if (msg.ping || msg.action === "ping") {
          this._sendFrame(client, { action: "pong", timestamp: Date.now() });
        }
      }
    } catch (e) {}
  }

  _initEventBusBridge() {
    globalEventBus.on("*", (eventRecord) => {
      this.broadcast(eventRecord);
    });
  }

  broadcast(eventRecord) {
    const { topic, payload, timestamp } = eventRecord;

    for (const client of this.clients) {
      if (this._clientMatchesTopic(client, topic)) {
        // Check filter if present
        if (client.filter && payload) {
          let matches = true;
          for (const [k, v] of Object.entries(client.filter)) {
            if (payload[k] !== undefined && String(payload[k]).toLowerCase() !== String(v).toLowerCase()) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
        }

        this._sendFrame(client, {
          topic,
          data: payload,
          timestamp
        });
      }
    }
  }

  _clientMatchesTopic(client, topic) {
    if (client.subscriptions.has("*")) return true;
    if (client.subscriptions.has(topic)) return true;

    for (const sub of client.subscriptions) {
      if (sub.endsWith("*") && topic.startsWith(sub.slice(0, -1))) {
        return true;
      }
    }
    return false;
  }

  _sendFrame(client, jsonPayload) {
    const text = JSON.stringify(jsonPayload);
    const payloadBuffer = Buffer.from(text, "utf8");
    this._sendRawFrame(client.socket, payloadBuffer, 1);
  }

  _sendRawFrame(socket, payloadBuffer, opcode = 1) {
    if (!socket || !socket.writable) return;

    const length = payloadBuffer.length;
    let header;

    if (length <= 125) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode; // FIN + opcode
      header[1] = length;
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    try {
      socket.write(Buffer.concat([header, payloadBuffer]));
    } catch (e) {}
  }

  _decodeFrame(buffer) {
    if (buffer.length < 2) return null;

    const firstByte = buffer[0];
    const secondByte = buffer[1];

    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;

    let offset = 2;

    if (payloadLength === 126) {
      if (buffer.length < 4) return null;
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (buffer.length < 10) return null;
      payloadLength = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    let maskingKey = null;
    if (isMasked) {
      if (buffer.length < offset + 4) return null;
      maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    const payload = buffer.slice(offset, offset + payloadLength);

    if (isMasked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    return { opcode, payload };
  }

  close() {
    if (this.server) {
      this.server.close();
    }
    for (const client of this.clients) {
      try {
        client.socket.destroy();
      } catch (e) {}
    }
    this.clients.clear();
  }
}
