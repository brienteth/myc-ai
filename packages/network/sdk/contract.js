/**
 * @myca/sdk - MycContract
 * 
 * Standard Smart Contract Interface for the MYCA Sovereign Network.
 * Provides high-level developer ergonomics for:
 *  - Calling read-only contract methods (`call`)
 *  - Sending state-modifying zero-gas transactions (`send`)
 *  - Subscribing to contract events in real-time (`on`)
 *  - Inspecting ABI and deployed address
 */
export class MycContract {
  constructor(abi = [], address = "", sdk = null) {
    this.abi = Array.isArray(abi) ? abi : [];
    this.address = address;
    this.sdk = sdk;

    // Dynamically bind ABI methods onto instance for intuitive calling syntax:
    // e.g. await myToken.balanceOf(addr)
    this._bindAbiMethods();
  }

  /**
   * Execute read-only contract query
   */
  async call(method, args = [], options = {}) {
    if (!this.sdk) {
      throw new Error("SDK_NOT_ATTACHED: MycContract requires a valid SDK instance for RPC calls");
    }

    return this.sdk.rpc("myc_callContract", [{
      address: this.address,
      method,
      args: Array.isArray(args) ? args : [args],
      from: options.from || this.sdk.address
    }]);
  }

  /**
   * Execute state-changing zero-gas transaction
   */
  async send(method, args = [], options = {}) {
    if (!this.sdk) {
      throw new Error("SDK_NOT_ATTACHED: MycContract requires a valid SDK instance for RPC transactions");
    }

    return this.sdk.rpc("myc_sendTransaction", [{
      from: options.from || this.sdk.address,
      to: this.address,
      method,
      args: Array.isArray(args) ? args : [args],
      value: options.value || 0
    }]);
  }

  /**
   * Subscribe to contract events via WebSocket event stream
   */
  on(eventName, callback) {
    if (!this.sdk || typeof this.sdk.subscribe !== "function") {
      throw new Error("SUBSCRIPTION_NOT_AVAILABLE: SDK does not support event subscriptions");
    }

    const topic = `contract:${this.address}:${eventName}`;
    return this.sdk.subscribe(topic, callback);
  }

  /**
   * Deploy a new instance of this contract definition
   */
  static async deploy({ name = "UserContract", abi = [], bytecode = "", sourceCode = "", constructorArgs = [] }, sdk) {
    if (!sdk || typeof sdk.deployContract !== "function") {
      throw new Error("SDK_INVALID: deploy requires a valid MycaSDK instance");
    }

    const result = await sdk.deployContract({
      name,
      abi,
      bytecode,
      sourceCode,
      constructorArgs
    });

    return new MycContract(abi, result.contractAddress, sdk);
  }

  _bindAbiMethods() {
    for (const item of this.abi) {
      if (item.type === "function" && item.name && !this[item.name]) {
        const isView = item.stateMutability === "view" || item.stateMutability === "pure";
        this[item.name] = async (...args) => {
          if (isView) {
            return this.call(item.name, args);
          } else {
            return this.send(item.name, args);
          }
        };
      }
    }
  }
}
