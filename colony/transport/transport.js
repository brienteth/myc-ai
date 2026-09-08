/**
 * MYCA Transport Base Abstraction
 * 
 * Invariant §9:
 * Transport interface defines:
 *  - connect()
 *  - listen()
 *  - send()
 *  - receive()
 *  - close()
 *  - capabilities()
 */
export class MycTransport {
  constructor(name = "base_transport") {
    this.name = name;
    this.isOpen = false;
    this.messageHandlers = new Set();
  }

  async connect(targetUri) {
    throw new Error("NOT_IMPLEMENTED: connect()");
  }

  async listen(port, host) {
    throw new Error("NOT_IMPLEMENTED: listen()");
  }

  async send(peerId, message) {
    throw new Error("NOT_IMPLEMENTED: send()");
  }

  onReceive(handler) {
    this.messageHandlers.add(handler);
  }

  dispatchMessage(peerId, message) {
    for (const handler of this.messageHandlers) {
      try {
        handler(peerId, message);
      } catch (err) {
        console.error(`Transport handler error: ${err.message}`);
      }
    }
  }

  async close() {
    this.isOpen = false;
  }

  capabilities() {
    return {
      name: this.name,
      reliable: true,
      encryption: "TLS_1_3",
      multiplexing: false,
      isBrowserCompatible: false
    };
  }
}
