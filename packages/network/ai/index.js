/**
 * mycai — Sovereign Air-Gapped Cognitive AI SDK
 * 
 * Official SDK for 100% On-Device, Offline Turkish NLP,
 * GHR-Lattice Resonance Memory, and Industrial Edge Automation.
 * 
 * @author mycai Core Team (https://mycai.pro)
 * @license Apache-2.0
 */

export { TurkishMorphology } from './core/morphology.js';
export { GHRLatticeMemory } from './core/ghr_lattice_memory.js';
export { HDCEngine, Representation } from './core/hdc.js';
export { SpectralSLM, SpectralSLM as SpectralDecoder } from './core/spectral_decoder.js';
export { WeightSpectralAnalyzer } from './core/weight_analyzer.js';
export { ReasoningRouter } from './core/reasoning_router.js';
export { SovereignAgent } from './core/sovereign_agent.js';
export { MetaSelector, computeStationarityMetric } from './core/meta_selector.js';

export { ResonanceEngine } from './sdk/resonance_engine.js';
export { ResonanceSDK } from './sdk/resonance_sdk.js';
export { LicenseManager, LICENSE_TIERS } from './sdk/licensing.js';
export { IngestionEngine, IngestionEngine as IngestionPipeline } from './sdk/ingestion.js';
export { BaseStorageAdapter, MemoryStorageAdapter, FileStorageAdapter, IndexedDBStorageAdapter } from './sdk/storage.js';

// Default export
import { ResonanceEngine } from './sdk/resonance_engine.js';
export default ResonanceEngine;

export { IndustrialPlatformBridge } from './core/industrial_platform_bridge.js';
