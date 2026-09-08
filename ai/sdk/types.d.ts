/**
 * TypeScript Definitions for @resonance/core (Commercial B2B SDK)
 */

export interface LicenseTier {
  name: 'Starter' | 'Business' | 'Sovereign';
  maxNodes: number;
  allowedRuntimes: string[];
  features: string[];
  wasmRequired: boolean;
}

export interface LicenseVerificationResult {
  valid: boolean;
  tier: LicenseTier;
  expiresAt: Date | null;
  maxNodes: number;
  clientId?: string;
  reason?: string;
}

export interface IngestInput {
  data: string | Buffer | ArrayBuffer;
  type?: 'text' | 'pdf' | 'csv' | 'tsv' | 'url';
  title?: string;
  metadata?: Record<string, any>;
}

export interface IngestRecord {
  query: string;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface IngestResult {
  success: boolean;
  recordsAdded: number;
  totalMemoryNodes?: number;
  stats?: Record<string, any>;
}

export interface AskResult {
  answer: string;
  route: string;
  confidence: number;
  latencyMs: number;
  llmBypassed: boolean;
  tier: string;
  metadata?: Record<string, any>;
}

export interface SummarizeOptions {
  page?: number;
  document?: string;
  mode?: 'concise' | 'single' | 'full';
}

export interface SearchResult {
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface TelemetryMetrics {
  activeNodes: number;
  maxNodesQuota: number;
  tier: string;
  licenseValid: boolean;
  totalQueries: number;
  avgLatencyMs: number;
  bypassedLlmCount: number;
  storageType: string;
  uptimeSeconds: number;
}

export interface ResonanceConfig {
  licenseKey?: string;
  D?: number;
  storage?: BaseStorageAdapter;
  vendorSecret?: string;
  ingestion?: {
    maxChunkSize?: number;
    overlap?: number;
  };
}

export declare class BaseStorageAdapter {
  name: string;
  init(): Promise<void>;
  load(): Promise<any[]>;
  save(records: any[]): Promise<boolean>;
  clear(): Promise<boolean>;
}

export declare class MemoryStorageAdapter extends BaseStorageAdapter {}
export declare class FileStorageAdapter extends BaseStorageAdapter {
  constructor(filePath?: string);
}
export declare class IndexedDBStorageAdapter extends BaseStorageAdapter {
  constructor(dbName?: string, storeName?: string);
}

export declare class LicenseManager {
  constructor(vendorSecret?: string);
  static generateLicenseKey(opts: {
    tier: 'STARTER' | 'BUSINESS' | 'SOVEREIGN';
    expiresAt: number | Date;
    maxNodes?: number;
    clientId?: string;
  }, secret?: string): string;
  verifyLicense(key: string): LicenseVerificationResult;
  canUseFeature(featureName: string): boolean;
  checkNodeQuota(currentTotal: number, addingCount?: number): boolean;
}

export declare class IngestionEngine {
  constructor(options?: { maxChunkSize?: number; overlap?: number });
  ingest(input: IngestInput): Promise<{
    success: boolean;
    records: IngestRecord[];
    stats: Record<string, any>;
  }>;
}

export declare class GHRLatticeMemory {
  D: number;
  cellSize: number;
  sigma: number;
  cells: any[];
  constructor(config?: { D?: number; cellSize?: number; sigma?: number; seed?: number; numTables?: number; numProjections?: number });
  encodePacket(phases: Float64Array, channelIndex: number): { real: Float64Array; imag: Float64Array; channel: number };
  insert(factVector: { id: string; phases: Float64Array }, metadata?: Record<string, any>): any;
  query(queryVector: { id?: string; phases: Float64Array }, topK?: number): Array<{ item: any; score: number; rank: number; latencyMs: number }>;
  calculateSIR(queryVector: { id?: string; phases: Float64Array }, targetId: string): number;
  readonly stats: { D: number; totalCells: number; totalItems: number; cellSizeLimit: number; sigma: number };
}

export declare class ResonanceEngine {
  constructor(config?: ResonanceConfig);
  init(): Promise<this>;
  ask(prompt: string, options?: Record<string, any>): Promise<AskResult>;
  ingest(input: IngestInput): Promise<IngestResult>;
  summarize(opts?: SummarizeOptions): string;
  search(query: string, limit?: number): SearchResult[];
  clearMemory(): Promise<boolean>;
  onConflict(handler: (existing: any, incoming: any) => void): void;
  getTelemetry(): TelemetryMetrics;
}

export { ResonanceEngine as ResonanceSDK };
export default ResonanceEngine;
