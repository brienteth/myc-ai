# Myca Execution OS — Navigation & UI/UX Architecture Specification

> **UX Philosophy:**
> The UI is structured around **Execution OS Layers**, not superficial product features.
> - **Assistant** $\rightarrow$ Expresses Intent & Need
> - **Knowledge** $\rightarrow$ Manages Data & Context
> - **Execution** $\rightarrow$ Automates Workflows & DAGs
> - **Colony** $\rightarrow$ Distributes Compute Mesh
> - **Second Brain** $\rightarrow$ Preserves Memory & Experience Patterns
> - **Skills / Packages / Integrations / Models** $\rightarrow$ Expands OS Capabilities

---

## 1. Canonical 10-Item Sidebar Navigation

```text
🏠 Home           # System status, live metrics, library stats, recent activities
💬 Assistant      # Execution Chat (Need → AST → IR → DAG → Runtime → Artifacts)
📚 Knowledge      # Knowledge OS (Categories, Search, AI Actions, Insights)
⚡ Execution      # Execution Studio IDE (ReactFlow Canvas, Inspector, Logs, Timeline)
🌐 Colony         # Execution Mesh Topology (Devices, Resource Meters, Skill Routing)
🧠 Second Brain   # Memory & Learned Experience (Human-friendly session timelines, Pin, Merge)
───────────────
🧩 Skills         # Installed Skill Cards, Inputs/Outputs, Permissions, Benchmarks
📦 Packages       # Visual myca-pm UI (Marketplace, Dependencies, Signatures)
🔌 Integrations   # MCP, OAuth, Webhooks, Local Apps & Database Connections
🤖 Models         # Model Management, VRAM/GPU graphs, Quantization & Benchmarks
───────────────
⚙ Settings       # Grouped OS Preferences (Permissions, Execution, Privacy, Dev Mode)
```

---

## 2. Page & Subsystem Architecture

### 🏠 1. Home (System Dashboard)
- **Status Header**: `Good Morning | Assistant Ready | All Systems Local`
- **Key Metrics Grid**:
  - Library: `12,483 documents`
  - Execution: `4 running`
  - Skills: `621 installed`
  - Colony: `3 devices`
  - Active Model: `Myca Core 3B Loaded`
  - Memory: `18GB RAM` | GPU: `Idle`
  - Experience: `324 learned workflows`
- **Recent Activities Feed**: Real-time status cards (Invoice Automation: Completed, PDF Summary: Running).

### 💬 2. Assistant (Execution Chat)
- **Top Pipeline Status Bar**: Interactive animation showing `Need → Planner → Execution → Artifacts`.
- **Left Panel**: Conversation history.
- **Center Canvas**: Execution Chat stream.
- **Right Execution Pipeline Panel**: Real-time compilation stack (`Need → AST → IR → DAG → Runtime → Artifacts`).
- **Bottom Artifact Tray**: Direct download/view of generated files (Excel, PDF, Images, Email drafts).

### 📚 3. Knowledge (Knowledge OS)
- **Category Filter**: `Documents`, `Images`, `Videos`, `Audio`, `Research`, `Code`, `Bookmarks`, `Notes`.
- **Center Library Grid**: Document cards with semantic tags.
- **Right Preview & AI Actions Panel**: `Summarize`, `Extract`, `Translate`, `Create Workflow`.
- **Bottom Insights Bar**: Most used documents, recently indexed, duplicate detector, vector health.

### ⚡ 4. Execution (Execution Studio IDE)
- **Tabs**: `Workflow Studio`, `Workflows`, `Templates`, `History`, `Marketplace`.
- **Main ReactFlow Canvas**: Drag-and-drop DAG builder.
- **Right Inspector Panel**: Node ABI config, inputs/outputs, permissions.
- **Bottom Execution Console**: `Timeline`, `Planner`, `Logs`, `Metrics`, `Artifacts`.
- **Toolbar**: `Run`, `Stop`, `Debug`, `Step`, `Replay`, `Save`, `Version`, `Publish as API`.

### 🌐 5. Colony (Execution Mesh Topology)
- **Top Topology Visualizer**: Node hierarchy (`MacBook → iPhone → NAS → Mini PC → Cloud`).
- **Device Resource Cards**: CPU, RAM, GPU, Temperature, Queue Length, Latency.
- **Skill Allocation Map**: Live skill assignment (e.g. `Vision → Mac`, `OCR → NAS`, `LLM → GPU PC`).
- **Live Execution Animation**: Real-time node routing highlight.

### 🧠 6. Second Brain (Memory & Learned Experience)
- **Memory Status Grid**: `Short-Term Memory`, `Working Memory`, `Long-Term Memory`, `Experience Engine`.
- **Learned Pattern Cards**: Recent sessions, decisions, saved context.
- **Human-Friendly Timeline**: Expandable session history (No raw JSON unless Developer Mode is toggled).
- **Actions Panel**: `Restore`, `Merge`, `Delete`, `Pin`.

### 🧩 7. Skills (OS Primitives Explorer)
- **Left Category Nav**: `AI`, `Filesystem`, `Office`, `Vision`, `Browser`, `Communication`, `Cloud`, `Finance`, `Development`.
- **Center Cards Grid**: Primitives (`pdf.read`, `spreadsheet.write`, `vision.ocr`, `email.send`).
- **Right Spec Inspector**: ABI Schema, Inputs, Outputs, Permissions, Cost Profile, Benchmarks.
- **Controls**: `Enable`, `Disable`, `Update`, `Version History`.

### 📦 8. Packages (myca-pm UI)
- **Visual Package Manager**: npm-like experience for Myca Skill Packages.
- **Views**: `Marketplace`, `Installed Packages`, `Package Inspector`.
- **Features**: Dependency graph, Ed25519 signature validation, ABI compatibility check, Rollback, One-Click Install.

### 🔌 9. Integrations (MCP & Protocol Hub)
- **Tabs**: `MCP Servers`, `OAuth Connections`, `API Keys`, `Webhooks`, `Local Apps`, `Databases`.
- **Status Matrix**: Live connection health, latency, permission scopes, invocation logs.

### 🤖 10. Models (Local LLM & Hardware Hub)
- **Metrics Dashboard**: VRAM usage, Prompt Cache hit-rate, Quantization (Q4_K_M, Q8_0), GPU load graphs.
- **Model Table**: Download, benchmark, load, unload, model comparison metrics.

---

## 3. Removals & Strategic Consolidations

- ❌ **Removed Isolated REST API Builder**: Consolidated into **"Publish as API"** inside Execution Studio.
- ❌ **Removed Isolated Web Scraper**: Integrated into `browser.*` OS primitives.
- ❌ **Renamed LLM Chatbot**: Replaced with **Assistant (Execution Chat)**.
- ❌ **Removed n8n Branding**: Replaced with **Myca Execution Studio**.

---

## 4. The 5 Strategic Core Modules

1. 📈 **Experience**: Learned DAG optimization patterns, success rates, latency reductions.
2. 📦 **Artifacts**: Central vault of workflow outputs linked to their producing DAG run.
3. 📊 **Observability**: Live system telemetry, CPU/RAM/GPU, queue latency, step retry counts.
4. 🛡️ **Policy Center**: Central approval gates, rate limits, sandbox constraints, spending ceilings.
5. 🛠️ **Developer Hub**: Skill Builder, Package Builder, Test Runner, ABI Explorer, Manifest Validator.
