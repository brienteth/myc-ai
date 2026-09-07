# @resonance/core — Commercial B2B Infrastructure SDK

**Turkish Resonance AI Core & Sovereign Cognitive Runtime v2.0**  
*100% Air-Gapped, Sub-Millisecond Turkish Language Intelligence & Living Memory Engine*

[![License: Commercial](https://img.shields.io/badge/License-Commercial%20B2B-blue.svg)]()
[![Runtime: Node.js | Browser | Electron | IoT](https://img.shields.io/badge/Runtime-Universal-green.svg)]()
[![Air--Gapped: Certified](https://img.shields.io/badge/Air--Gapped-Zero--Cloud-brightgreen.svg)]()
[![TypeScript: Included](https://img.shields.io/badge/TypeScript-Strict%20Types-blue.svg)]()

---

## 💎 Executive Summary & Value Proposition

Traditional generative AI models (OpenAI, Claude, Llama) require power-hungry GPU clusters, constant internet connectivity, and introduce unpredictable token billing, telemetry leaks, and 500ms–3000ms latency.

**Resonance SDK** is an enterprise-grade, edge-compatible cognitive infrastructure library engineered specifically for **Turkish language intelligence, tactical edge devices, defense systems, and regulated enterprise environments (Banking, Legal, Telecom)**.

| Metric | Resonance SDK (@resonance/core) | Traditional Cloud LLM APIs |
| :--- | :--- | :--- |
| **Reaction Latency** | **< 0.05 ms (Math/Rules) / < 3 ms (Memory)** | 500 ms – 3000 ms |
| **Cloud Dependency** | **Zero (100% Offline / Air-Gapped)** | Mandatory Internet Connection |
| **Hardware Footprint** | **< 20 MB RAM (Runs on MCU / SBC / Laptop)** | Server Racks / High-End GPUs |
| **Data Privacy** | **Zero Telemetry Leak (Data never leaves device)** | Sent to 3rd party cloud |
| **Inference Margins** | **100% Gross Margin (Zero per-query cost)** | Recurring API bill per token |

---

## 📦 Commercial License Tiers

Resonance SDK enforces cryptographic, zero-cloud offline license keys (`RES-{TIER}-{EXPIRY}-{MAX_NODES}-{CLIENT_ID}-{SIG}`):

| Feature | Starter Tier | Business Tier | Sovereign / Tactical Tier |
| :--- | :--- | :--- | :--- |
| **Memory Node Quota** | Up to **1,000 Nodes** | Up to **50,000 Nodes** | **Unlimited Nodes** |
| **Cognitive Gates** | AST Math, Rule Gates | Math, Morphology, Q&A | All Gates + Custom Rules |
| **Ingestion Pipeline** | Plain Text, Markdown | Text, CSV, PDF, Web HTML | All Formats + Streaming Chunker |
| **Storage Adapters** | RAM (In-Memory) | RAM, Local Disk, IndexedDB | Pluggable Custom Storage |
| **Hardware Acceleration**| Standard CPU | Multi-Core Optimization | WASM SIMD / FPGA / Embedded |
| **Target Clients** | Prototyping & Startups | Medium Enterprises / Apps | Defense, Banking, Critical Infra |

---

## 🚀 Quick Start (Node.js & TypeScript)

### 1. Installation

```bash
# From private scoped registry or vendor tgz archive
npm install @resonance/core
```

### 2. Implementation

```javascript
import { ResonanceEngine, LicenseManager, FileStorageAdapter } from '@resonance/core';

// 1. Initialize Engine with Offline License & Disk Persistence
const engine = new ResonanceEngine({
  licenseKey: process.env.RESONANCE_LICENSE_KEY,
  storage: new FileStorageAdapter('./data/enterprise_memory.json')
});

await engine.init();

// 2. Ingest Multi-Page Documents, Laws, or Business Data
await engine.ingest({
  type: 'text',
  title: '6100 Sayılı HMK',
  data: 'Madde 2: Asliye hukuk mahkemelerinin görevi malvarlığı davalarını görmektir.'
});

// 3. Sub-Millisecond Q&A
const reply = await engine.ask('Asliye hukuk mahkemelerinin görevi nedir?');
console.log(reply.answer);
console.log(`Latency: ${reply.latencyMs}ms | Route: ${reply.route}`);

// 4. Real-time Operational Telemetry
console.log(engine.getTelemetry());
// => { activeNodes: 45, maxNodesQuota: 50000, avgLatencyMs: 0.85, ... }
```

---

## 🛠️ Architecture & Core Components

```
┌────────────────────────────────────────────────────────────────────────┐
│               @resonance/core — Commercial Architecture                │
├────────────────────────────────────────────────────────────────────────┤
│  [1] ResonanceEngine (Public Facade API)                               │
│      • ask(prompt) → { answer, route, latencyMs, confidence }          │
│      • ingest({ data, type, title }) → { success, recordsAdded }       │
│      • summarize({ page, mode: 'concise'|'single' })                   │
│      • search(query, limit)                                            │
│      • getTelemetry()                                                  │
├────────────────────────────────────────────────────────────────────────┤
│  [2] Cognitive Dispatcher & Routing Gates                              │
│      • Math Gate (Deterministic AST Parser, 0.02ms)                    │
│      • Morphology Gate (Turkish Inflection & Root Engine, 0.1ms)       │
│      • Precision Q&A Gate (Direct snippet and article extraction)       │
│      • Concise Page Summarizer (Filters boilerplate, single sentence)  │
├────────────────────────────────────────────────────────────────────────┤
│  [3] Ingestion Pipeline (Modular Zero-Bloat)                           │
│      • Text / Markdown (Native 0-dependency)                           │
│      • CSV / Tabular (Native column mapper)                            │
│      • PDF Ingestion (On-demand dynamic import)                        │
│      • Web HTML Ingestion (HTML sanitization & chunking)               │
├────────────────────────────────────────────────────────────────────────┤
│  [4] Pluggable Persistence Layer                                       │
│      • MemoryStorageAdapter (Ultra-fast RAM)                           │
│      • FileStorageAdapter (Node.js JSON/Binary on disk)                │
│      • IndexedDBStorageAdapter (Browser / Electron persistent store)   │
├────────────────────────────────────────────────────────────────────────┤
│  [5] Cryptographic Licensing & Security                                │
│      • 100% Air-Gapped HMAC/Ed25519 Token Validation                   │
│      • Constant-Time Signature Comparison                              │
│      • Quota & Feature Gating                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Vendor License Generation (For Sales & Operations)

Vendors can generate cryptographic offline licenses using the SDK CLI or programmatic API:

```javascript
import { LicenseManager } from '@resonance/core';

const enterpriseLicense = LicenseManager.generateLicenseKey({
  tier: 'BUSINESS',
  expiresAt: new Date('2027-12-31'),
  maxNodes: 50000,
  clientId: 'turkcell-fintech'
}, process.env.VENDOR_MASTER_SECRET);

console.log(enterpriseLicense);
// => RES-BUSINESS-1830211200000-50000-turkcellfintech-9f8a7b6c...
```

---

## 📄 Full TypeScript Support

Full type declarations (`types.d.ts`) are bundled with IntelliSense support for Visual Studio Code, Cursor, and WebStorm.

---

## 📞 Enterprise Commercial Support

For custom military/defense hardware deployments, specialized rule sets, or volume licensing contracts:
* **Email:** enterprise@mycai.pro
* **SLA:** 24/7 Air-Gapped On-Premise Support Available
