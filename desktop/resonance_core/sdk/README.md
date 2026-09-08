# Resonance SDK v1.0 — Commercial Edge AI Engine

**Turkish Resonance AI Core** — Zero-Cloud, Sub-Millisecond Turkish Language Intelligence

[![License: Commercial](https://img.shields.io/badge/License-Commercial-blue.svg)]()
[![Runtime: Dual](https://img.shields.io/badge/Runtime-Browser%20%7C%20Node.js-green.svg)]()
[![WASM: Accelerated](https://img.shields.io/badge/WASM-Accelerated-orange.svg)]()

---

## Overview

Resonance SDK is a commercial-grade, edge-compatible Turkish language intelligence engine. Unlike traditional LLMs requiring GPU clusters and cloud infrastructure, Resonance SDK runs **entirely on the client device** — mobile phones, IoT devices, browsers, or standard office CPUs — with:

| Metric | Value |
|---|---|
| **Step Latency** | < 1ms (WASM), ~3ms (Pure JS) |
| **Peak RAM** | < 20 MB |
| **Vocabulary** | 53,590 active Turkish words |
| **Cloud Dependency** | **None** (100% offline) |
| **Gross Margin** | **100%** (zero inference cost) |

---

## Quick Start

### Node.js

```javascript
import { ResonanceSDK } from './sdk/resonance_sdk.js';

const sdk = new ResonanceSDK({ temperature: 0.7 });
await sdk.init();

const result = sdk.generate("evimizden yeni", { maxLength: 5 });
console.log(result.generatedText);
// => "evimizden yeni bir kitap aldık"

console.log(sdk.getMetrics());
// => { runtime: 'node', vocabSize: 53590, wasmActive: true, ... }
```

### Browser

```html
<script type="module">
  import { ResonanceSDK } from './sdk/resonance_sdk.js';

  const sdk = new ResonanceSDK();
  await sdk.init({ wasmUrl: './wasm/spectral_core.wasm' });

  const result = sdk.generate("yapay zeka", {
    maxLength: 8,
    onToken: (word) => console.log('→', word)  // Streaming callback
  });

  document.body.textContent = result.generatedText;
</script>
```

---

## API Reference

### `new ResonanceSDK(config?)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config.D` | number | 4096 | Hyperdimensional vector dimension |
| `config.temperature` | number | 0.7 | Sampling temperature (0 = greedy) |
| `config.maxLength` | number | 10 | Default max tokens to generate |

### `await sdk.init(options?)`

Initialize the engine. Must be called once before `generate()`.

| Option | Type | Description |
|---|---|---|
| `wasmBinary` | ArrayBuffer | Pre-loaded WASM binary |
| `wasmUrl` | string | Browser: URL to `.wasm` file |
| `wasmPath` | string | Node.js: filesystem path to `.wasm` |
| `corpusUrl` | string | Browser: URL to `tr_corpus_embed.js` |
| `corpusPath` | string | Node.js: path to `tr_corpus_embed.js` |

### `sdk.generate(prompt, options?)`

Autoregressive text generation.

| Option | Type | Description |
|---|---|---|
| `maxLength` | number | Override max tokens |
| `temperature` | number | Override temperature |
| `onToken` | function | Streaming callback `(word, stepInfo) => void` |

**Returns:**
```json
{
  "prompt": "evimizden yeni",
  "generatedText": "evimizden yeni bir kitap aldık",
  "newTokens": ["bir", "kitap", "aldık"],
  "steps": [{ "word": "bir", "score": 0.8234, "latencyMs": 0.72 }],
  "totalLatencyMs": 2.31,
  "finishReason": "stop",
  "vocabSize": 53590
}
```

### `sdk.analyze(word)`

Turkish morphological analysis.

```javascript
sdk.analyze("evlerimizden");
// => { word: "evlerimizden", root: "ev", suffixes: ["ler", "imiz", "den"], harmony: "front" }
```

### `sdk.getMetrics()`

Runtime diagnostics.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│               ResonanceSDK v1.0                 │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Morphology│  │   HDC    │  │  Spectral    │  │
│  │  Engine   │  │  Engine  │  │  Decoder     │  │
│  └─────┬────┘  └────┬─────┘  └──────┬───────┘  │
│        │            │               │           │
│        └────────────┼───────────────┘           │
│                     │                           │
│          ┌──────────▼──────────┐                │
│          │   WebAssembly Core  │                │
│          │  (Rust → WASM SIMD) │                │
│          └─────────────────────┘                │
├─────────────────────────────────────────────────┤
│  Runtime Auto-Detection: Browser | Node.js      │
└─────────────────────────────────────────────────┘
```

---

## Licensing

### Edge AI SDK License (B2B)
- Per-device monthly fee: **$0.05/active installation**
- Zero server-side costs = **100% gross margin**

### Enterprise On-Premise License
- Installation + customization: **$10,000 – $50,000**
- Annual maintenance: **20% of initial fee**

### LLM Distillation SaaS
- Pay-per-model compilation fee

---

## Technical Specifications

- **Algorithm:** Holographic Reduced Representation (FHRR) + FFT Circular Convolution
- **Complexity:** O(D log D) per inference step
- **Tokenizer:** Morphological rule-based (11 Turkish suffix rules)
- **Vector Space:** 4096-dimensional complex phase space
- **OOV Handling:** `<unk>` safety anchor at index 0 — zero crash guarantee
- **WASM Backend:** Rust `#![no_std]` with 16-byte aligned SIMD memory

---

© 2026 Turkish Resonance AI Core Team. All rights reserved.
