import fs from "fs";
import path from "path";

/**
 * MYC Blockchain Deterministic Key-Value Storage Adapter
 * LevelDB-compatible interface with atomic disk persistence and memory caching.
 */
export class MycStorageAdapter {
  constructor(dbPath = "./data/myc_ledger.db", options = {}) {
    this.dbPath = path.resolve(process.cwd(), dbPath);
    this.inMemory = options.inMemory || false;
    this.store = new Map();
    this.dirty = false;
    this.init();
  }

  init() {
    if (this.inMemory) return;
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, "utf-8");
        const json = JSON.parse(data || "{}");
        for (const [k, v] of Object.entries(json)) {
          this.store.set(k, v);
        }
      }
    } catch (err) {
      console.warn(`Storage adapter initialization fallback to memory: ${err.message}`);
    }
  }

  async put(key, value) {
    this.store.set(key, value);
    this.dirty = true;
    this.scheduleFlush();
  }

  async get(key) {
    if (!this.store.has(key)) {
      throw new Error(`NotFoundError: Key '${key}' not found in storage.`);
    }
    return this.store.get(key);
  }

  async has(key) {
    return this.store.has(key);
  }

  async del(key) {
    const existed = this.store.delete(key);
    if (existed) {
      this.dirty = true;
      this.scheduleFlush();
    }
  }

  async batch(operations = []) {
    for (const op of operations) {
      if (op.type === "put") {
        this.store.set(op.key, op.value);
      } else if (op.type === "del") {
        this.store.delete(op.key);
      }
    }
    this.dirty = true;
    this.flushSync();
  }

  scheduleFlush() {
    if (this.inMemory) return;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushSync();
    }, 50);
  }

  flushSync() {
    if (this.inMemory || !this.dirty) return;
    try {
      const obj = {};
      for (const [k, v] of this.store.entries()) {
        obj[k] = v;
      }
      const tmpPath = this.dbPath + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), "utf-8");
      fs.renameSync(tmpPath, this.dbPath);
      this.dirty = false;
    } catch (e) {
      console.error(`Storage flush failure: ${e.message}`);
    }
  }

  async close() {
    this.flushSync();
  }

  clear() {
    this.store.clear();
    this.dirty = true;
    this.flushSync();
  }
}
