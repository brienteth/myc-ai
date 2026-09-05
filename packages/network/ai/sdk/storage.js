/**
 * Resonance SDK - Storage Adapter Interface & Implementations
 * Pluggable persistence layer for living memory nodes and telemetry across runtimes.
 * 
 * @license Commercial
 * @author Turkish Resonance AI Core Team
 */

import fs from 'fs';
import path from 'path';

/**
 * Base abstract storage adapter
 */
export class BaseStorageAdapter {
  constructor(name = 'default') {
    this.name = name;
  }
  async init() {}
  async load() { return []; }
  async save(records) { return true; }
  async clear() { return true; }
}

/**
 * In-Memory RAM Storage Adapter (Ultra-fast, zero disk dependency, default)
 */
export class MemoryStorageAdapter extends BaseStorageAdapter {
  constructor() {
    super('memory');
    this._records = [];
  }

  async load() {
    return [...this._records];
  }

  async save(records) {
    this._records = Array.isArray(records) ? [...records] : [];
    return true;
  }

  async clear() {
    this._records = [];
    return true;
  }
}

/**
 * Node.js Local File Storage Adapter (Persists memory snapshots to disk)
 */
export class FileStorageAdapter extends BaseStorageAdapter {
  /**
   * @param {string} filePath - Path to JSON persistence file
   */
  constructor(filePath = './resonance_memory.json') {
    super('file');
    this.filePath = path.resolve(filePath);
  }

  async init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async load() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const content = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn(`[Resonance Storage] Failed to load from ${this.filePath}:`, e.message);
      return [];
    }
  }

  async save(records) {
    try {
      await this.init();
      fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error(`[Resonance Storage] Failed to save to ${this.filePath}:`, e.message);
      return false;
    }
  }

  async clear() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}

/**
 * Browser / Electron IndexedDB Storage Adapter
 */
export class IndexedDBStorageAdapter extends BaseStorageAdapter {
  constructor(dbName = 'ResonanceMemoryDB', storeName = 'nodes') {
    super('indexeddb');
    this.dbName = dbName;
    this.storeName = storeName;
    this._db = null;
  }

  async init() {
    if (typeof indexedDB === 'undefined') {
      return; // Fallback to memory if indexedDB not in environment
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => {
        this._db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async load() {
    if (!this._db) await this.init();
    if (!this._db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async save(records) {
    if (!this._db) await this.init();
    if (!this._db) return false;

    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        (records || []).forEach(r => store.add(r));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async clear() {
    if (!this._db) await this.init();
    if (!this._db) return true;

    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
}
