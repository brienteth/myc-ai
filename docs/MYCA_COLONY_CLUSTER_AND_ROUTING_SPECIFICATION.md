# Myca Colony Cluster Topology & Routing Layer Specifications

> **Architectural Paradigm:**
> *“No single machine should bear the entire compute load. Myca acts as a single Execution OS cluster distributing tasks across local LAN peers. Zero cloud dependency.”*

---

## 1. Dual-Layer Routing Architecture

```text
                               ┌───────────────────────────┐
                               │     Human Intent / Need   │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  Inference Router         ├─────► [RTX Desktop] (Myca Core 14B)
                               │  (Allocates LLM & Models) ├─────► [Mini PC] (Embedding Model)
                               └─────────────┬─────────────┘
                                             │ (Produces DAG)
                                             ▼
                               ┌───────────────────────────┐
                               │  Capability Router        ├─────► [MacBook Air] (FS/Office Skills)
                               │  (Allocates Skill ABI)    ├─────► [NAS Storage] (Backup/Vector DB)
                               └───────────────────────────┘
```

---

## 2. Router Layer Specifications

### 1) Inference Router
Decides which node in the Colony execution mesh runs which AI/ML capability:
- **Planner Node**: Typically runs on the client device (e.g., MacBook Air) utilizing a lightweight `Myca Core 3B` model for fast AST planning.
- **Heavy LLM Node**: Automatically offloaded to local LAN nodes with high VRAM/GPU (e.g., Gaming PC / RTX 5090 running `Myca Core 14B`).
- **Embedding/Vector Node**: Routed to a dedicated CPU/RAM resource (e.g., Mini PC / NAS) for rapid text chunk formatting and vector insertions.

### 2) Capability Router
Decides which node in the Colony execution mesh executes which Skill ABI:
- **Filesystem Skills (`filesystem.read` / `filesystem.search`)**: Must run on the machine that owns the physical data target (e.g., Laptop or local NAS storage mount).
- **Compute Heavy Skills (`vision.ocr` / `media.render`)**: Scheduled and executed on the device with hardware acceleration (e.g., NVIDIA GPU Desktop).
- **Communication Skills (`communication.send`)**: Scheduled on nodes with active network interfaces or API configurations.

---

## 3. Colony Multi-Device Execution Scenarios

### Scenario A: Standalone MacBook (Localhost Only)
- Router automatically defaults both Inference and Capability targets to `127.0.0.1`.
- Fast, secure, and operates completely offline.

### Scenario B: Ev Colony (Hybrid Laptop + RTX Desktop)
- Laptop acts as the UI and Planner compiler.
- Heavy OCR or inference tasks are routed to the RTX Desktop via the local LAN mesh.
- Results are piped back to the Laptop transparently.

### Scenario C: Home Execution Cluster (Multi-Device)
- **MacBook Air**: User Interface & Compile engine.
- **RTX Desktop**: Runs heavy reasoning models & GPU vision tasks.
- **Mini PC**: Operates semantic search and embedding layers.
- **NAS Node**: Holds experience database, long-term memory, and vector index.
- All devices act as a single logical Execution OS cluster.
