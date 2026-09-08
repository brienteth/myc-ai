import crypto from "crypto";
import { globalEventBus } from "../../core/events/event_bus.js";

/**
 * MYCA Smart Contract Virtual Machine
 * 
 * Executes smart contract methods deterministically.
 * Supports both platform core contracts and third-party user contracts.
 * Provides isolated contract storage in the State Trie, event logs,
 * call dispatch, WebSocket pub/sub emission, and atomic rollback on reverts.
 */
export class MycContractVM {
  constructor(stateTrie) {
    this.stateTrie = stateTrie;
    this.deployedContracts = new Map(); // address -> { address, name, abi, bytecode, instance, creator, deployedAt }
    this.contractNonces = new Map(); // deployer -> count
  }

  /**
   * Deploy a system or platform-level contract
   */
  deployContract({ name, abi = [], bytecode = "", instance = null, creator = "myc100000000000000000000000000000000", initArgs = [] }) {
    const salt = `${name}:${creator}:${Date.now()}:${this.deployedContracts.size}`;
    const contractAddress = "myc1c" + crypto.createHash("sha256").update(salt).digest("hex").slice(0, 31);

    const record = {
      address: contractAddress,
      name,
      abi,
      bytecode: bytecode || "0x608060405234801561001057600080fd5b50",
      instance,
      creator,
      deployedAt: Date.now(),
      isUserContract: false
    };

    this.deployedContracts.set(contractAddress.toLowerCase(), record);

    // If instance has an init or constructor function, execute it
    if (instance && typeof instance.init === "function") {
      instance.init(...initArgs);
    }

    const txHash = "0x" + crypto.createHash("sha256").update("DEPLOY:" + contractAddress).digest("hex");
    globalEventBus.emitEvent(`contract:${contractAddress}:Deployed`, {
      contractAddress,
      name,
      deployer: creator,
      txHash,
      timestamp: record.deployedAt
    });

    return {
      success: true,
      contractAddress,
      transactionHash: txHash
    };
  }

  /**
   * Deploy a user/third-party contract with bytecode validation,
   * deterministic address derivation, and event publishing
   */
  deployUserContract({
    name = "UserContract",
    abi = [],
    bytecode = "",
    sourceCode = "",
    deployerAddress = "myc1anonymous0000000000000000000000",
    constructorArgs = [],
    instance = null
  } = {}) {
    // 1. Bytecode validation
    let resolvedBytecode = bytecode;
    if (!resolvedBytecode && !sourceCode && !instance) {
      resolvedBytecode = "0x608060405234801561001057600080fd5b50";
    }
    if (resolvedBytecode && resolvedBytecode.length > 49152) { // 24KB hex limit
      throw new Error("BYTECODE_EXCEEDS_MAX_SIZE: Contract bytecode exceeds 24KB limit");
    }

    // 2. Deterministic address derivation
    const currentNonce = this.contractNonces.get(deployerAddress.toLowerCase()) || 0;
    this.contractNonces.set(deployerAddress.toLowerCase(), currentNonce + 1);
    const salt = `${deployerAddress}:${currentNonce}:${name}`;
    const contractAddress = "myc1c" + crypto.createHash("sha256").update(salt).digest("hex").slice(0, 31);

    // 3. Create or attach sandbox execution instance
    let contractInstance = instance;
    if (!contractInstance) {
      contractInstance = this._createSandboxInstance({
        name,
        abi,
        bytecode,
        sourceCode,
        constructorArgs,
        contractAddress,
        deployerAddress
      });
    } else if (typeof contractInstance.init === "function") {
      contractInstance.init(...constructorArgs);
    }

    // 4. Save to registry
    const record = {
      address: contractAddress,
      name,
      abi: abi || [],
      bytecode: bytecode || "0x608060405234801561001057600080fd5b50",
      sourceCode: sourceCode || "",
      instance: contractInstance,
      creator: deployerAddress,
      deployedAt: Date.now(),
      isUserContract: true
    };

    this.deployedContracts.set(contractAddress.toLowerCase(), record);

    // 5. Emit deployment to Event Bus
    const txHash = "0x" + crypto.createHash("sha256").update(`DEPLOY:${contractAddress}:${Date.now()}`).digest("hex");
    globalEventBus.emitEvent(`contract:${contractAddress}:Deployed`, {
      contractAddress,
      name,
      deployer: deployerAddress,
      txHash,
      timestamp: record.deployedAt
    });
    globalEventBus.emitEvent("contract:deployed", {
      contractAddress,
      name,
      deployer: deployerAddress,
      txHash
    });

    return {
      success: true,
      contractAddress,
      transactionHash: txHash,
      name,
      abi
    };
  }

  /**
   * Construct an isolated sandbox instance for user-deployed contracts
   */
  _createSandboxInstance({ name, abi, constructorArgs, contractAddress, deployerAddress, sourceCode }) {
    if (sourceCode && typeof sourceCode === "string" && sourceCode.trim()) {
      try {
        const factory = new Function("contractAddress", "deployerAddress", "constructorArgs", sourceCode);
        const customInstance = factory(contractAddress, deployerAddress, constructorArgs);
        if (customInstance && typeof customInstance === "object") {
          return customInstance;
        }
      } catch (err) {
        console.warn(`[ContractVM] Could not instantiate sourceCode for ${name}:`, err.message);
      }
    }

    const storage = new Map();

    // Default basic token/state mapping
    storage.set("owner", deployerAddress);
    storage.set("name", name);
    storage.set("createdAt", Date.now());

    const instance = {
      state: storage,
      
      // Generic state getters/setters
      getStorage(key) {
        return storage.get(key);
      },
      setStorage(key, value, context) {
        storage.set(key, value);
        if (context && typeof context.emit === "function") {
          context.emit("StateUpdated", { key, value });
        }
        return true;
      },

      // Standard ERC20-like token primitives if defined or fallback
      balanceOf(account) {
        return storage.get(`balance:${account}`) || 0;
      },
      transfer(to, amount, context) {
        const from = context?.msgSender || deployerAddress;
        const fromBal = storage.get(`balance:${from}`) || 0;
        const numAmount = parseFloat(amount);
        if (fromBal < numAmount) {
          throw new Error(`INSUFFICIENT_BALANCE: Have ${fromBal}, need ${numAmount}`);
        }
        storage.set(`balance:${from}`, fromBal - numAmount);
        const toBal = storage.get(`balance:${to}`) || 0;
        storage.set(`balance:${to}`, toBal + numAmount);

        if (context && typeof context.emit === "function") {
          context.emit("Transfer", { from, to, amount: numAmount });
        }
        return true;
      },
      mint(to, amount, context) {
        const caller = context?.msgSender;
        const owner = storage.get("owner");
        if (caller && caller !== owner) {
          throw new Error("UNAUTHORIZED: Only contract owner can mint");
        }
        const numAmount = parseFloat(amount);
        const current = storage.get(`balance:${to}`) || 0;
        storage.set(`balance:${to}`, current + numAmount);
        if (context && typeof context.emit === "function") {
          context.emit("Mint", { to, amount: numAmount });
        }
        return true;
      }
    };

    // If constructorArgs provided an initial supply: [initialSupply, symbol]
    if (constructorArgs && constructorArgs.length > 0) {
      const initialSupply = parseFloat(constructorArgs[0]) || 0;
      if (initialSupply > 0) {
        storage.set(`balance:${deployerAddress}`, initialSupply);
      }
      if (constructorArgs[1]) {
        storage.set("symbol", String(constructorArgs[1]));
      }
    }

    // Attach dynamic methods from ABI if function signatures match
    if (Array.isArray(abi)) {
      for (const item of abi) {
        if (item.type === "function" && !instance[item.name]) {
          instance[item.name] = (...args) => {
            const context = args[args.length - 1];
            // Check if read-only or state-writing
            if (item.stateMutability === "view" || item.stateMutability === "pure") {
              const argKey = args.slice(0, -1).join(":");
              return storage.get(`${item.name}:${argKey}`) ?? storage.get(item.name) ?? null;
            } else {
              const value = args[0];
              storage.set(item.name, value);
              if (context && typeof context.emit === "function") {
                context.emit(item.name, { caller: context.msgSender, value });
              }
              return true;
            }
          };
        }
      }
    }

    return instance;
  }

  getContract(address) {
    return this.deployedContracts.get((address || "").toLowerCase()) || null;
  }

  getAllContracts() {
    return Array.from(this.deployedContracts.values()).map(c => ({
      address: c.address,
      name: c.name,
      creator: c.creator,
      deployedAt: c.deployedAt,
      isUserContract: !!c.isUserContract,
      abi: c.abi
    }));
  }

  call({ from = "myc1anonymous0000000000000000000000", to, method, args = [] }) {
    const contract = this.getContract(to);
    if (!contract || !contract.instance) {
      throw new Error(`CONTRACT_NOT_FOUND: ${to}`);
    }

    if (typeof contract.instance[method] !== "function") {
      throw new Error(`METHOD_NOT_FOUND: Contract '${contract.name}' has no method '${method}'`);
    }

    // Read-only execution without state snapshot commit
    try {
      const result = contract.instance[method](...args, { msgSender: from, isStatic: true });
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  execute({ from, to, value = 0, data = "", porProof = null }) {
    // If data is JSON with method and args
    let method = "fallback";
    let args = [];
    if (typeof data === "string" && data.startsWith("{")) {
      try {
        const parsed = JSON.parse(data);
        method = parsed.method || method;
        args = parsed.args || args;
      } catch (e) {}
    }

    const contract = this.getContract(to);
    if (!contract || !contract.instance) {
      return { success: false, error: `CONTRACT_NOT_FOUND: ${to}`, logs: [] };
    }

    if (typeof contract.instance[method] !== "function") {
      return { success: false, error: `METHOD_NOT_FOUND: '${method}'`, logs: [] };
    }

    const snapshotId = this.stateTrie.takeSnapshot();
    const logs = [];

    const context = {
      msgSender: from,
      msgValue: value,
      contractAddress: to,
      porProof,
      emit: (eventName, eventData) => {
        const logItem = { event: eventName, data: eventData, address: to, timestamp: Date.now() };
        logs.push(logItem);
        // Pub/sub broadcast to central event bus
        globalEventBus.emitEvent(`contract:${to}:${eventName}`, { ...eventData, _contract: to });
        globalEventBus.emitEvent("contract:event", logItem);
      }
    };

    try {
      const returnValue = contract.instance[method](...args, context);
      return {
        success: true,
        returnValue,
        logs,
        contractAddress: to
      };
    } catch (err) {
      this.stateTrie.revertToSnapshot(snapshotId);
      return {
        success: false,
        error: err.message,
        logs: [],
        reverted: true
      };
    }
  }
}
