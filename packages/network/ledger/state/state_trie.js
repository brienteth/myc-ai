import crypto from "crypto";

/**
 * MYC Deterministic World State Trie
 * Tracks account balances, nonces, code hashes, and contract storage slots.
 * Computes cryptographically reproducible stateRoot hashes.
 */
export class MycStateTrie {
  constructor(storageAdapter = null) {
    this.storage = storageAdapter;
    this.accounts = new Map(); // address -> { balance, nonce, codeHash, storageRoot }
    this.contractStorage = new Map(); // address -> Map(key -> value)
    this.snapshots = [];
  }

  getAccount(address) {
    const addr = (address || "").toLowerCase();
    if (!this.accounts.has(addr)) {
      return {
        address: addr,
        balance: 0,
        nonce: 0,
        codeHash: "0x" + "0".repeat(64),
        storageRoot: "0x" + "0".repeat(64)
      };
    }
    return { ...this.accounts.get(addr) };
  }

  setAccount(address, accountData) {
    const addr = (address || "").toLowerCase();
    const existing = this.getAccount(addr);
    const updated = {
      ...existing,
      ...accountData,
      address: addr
    };
    this.accounts.set(addr, updated);
    return updated;
  }

  getBalance(address) {
    return this.getAccount(address).balance;
  }

  setBalance(address, balance) {
    const acc = this.getAccount(address);
    acc.balance = parseFloat(balance) || 0;
    this.setAccount(address, acc);
  }

  getNonce(address) {
    return this.getAccount(address).nonce;
  }

  incrementNonce(address) {
    const acc = this.getAccount(address);
    acc.nonce += 1;
    this.setAccount(address, acc);
    return acc.nonce;
  }

  getContractStorage(contractAddress, key) {
    const addr = (contractAddress || "").toLowerCase();
    if (!this.contractStorage.has(addr)) return null;
    return this.contractStorage.get(addr).get(key) || null;
  }

  setContractStorage(contractAddress, key, value) {
    const addr = (contractAddress || "").toLowerCase();
    if (!this.contractStorage.has(addr)) {
      this.contractStorage.set(addr, new Map());
    }
    this.contractStorage.get(addr).set(key, value);
  }

  getAllContractStorage(contractAddress) {
    const addr = (contractAddress || "").toLowerCase();
    if (!this.contractStorage.has(addr)) return {};
    const result = {};
    for (const [k, v] of this.contractStorage.get(addr).entries()) {
      result[k] = v;
    }
    return result;
  }

  takeSnapshot() {
    const accountsCopy = new Map();
    for (const [k, v] of this.accounts.entries()) {
      accountsCopy.set(k, { ...v });
    }
    const storageCopy = new Map();
    for (const [addr, map] of this.contractStorage.entries()) {
      storageCopy.set(addr, new Map(map));
    }
    const snapshotId = this.snapshots.length;
    this.snapshots.push({ accounts: accountsCopy, storage: storageCopy });
    return snapshotId;
  }

  revertToSnapshot(snapshotId) {
    if (snapshotId >= 0 && snapshotId < this.snapshots.length) {
      const snap = this.snapshots[snapshotId];
      this.accounts = snap.accounts;
      this.contractStorage = snap.storage;
      this.snapshots = this.snapshots.slice(0, snapshotId);
      return true;
    }
    return false;
  }

  calculateStateRoot() {
    const sortedKeys = Array.from(this.accounts.keys()).sort();
    if (sortedKeys.length === 0) {
      return "0x" + crypto.createHash("sha256").update("EMPTY_STATE_TRIE").digest("hex");
    }

    const hashes = [];
    for (const key of sortedKeys) {
      const acc = this.accounts.get(key);
      const storageMap = this.contractStorage.get(key);
      let storageData = "";
      if (storageMap) {
        const sortedStorageKeys = Array.from(storageMap.keys()).sort();
        storageData = sortedStorageKeys.map(sk => `${sk}=${JSON.stringify(storageMap.get(sk))}`).join(";");
      }
      const raw = `${acc.address}:${acc.balance}:${acc.nonce}:${acc.codeHash}:${storageData}`;
      hashes.push(crypto.createHash("sha256").update(raw).digest("hex"));
    }

    // Merkle tree root of all account states
    let level = hashes;
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left;
        next.push(crypto.createHash("sha256").update(left + right).digest("hex"));
      }
      level = next;
    }
    return "0x" + level[0];
  }
}
