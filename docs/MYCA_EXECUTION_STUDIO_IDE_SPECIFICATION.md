# Myca Execution Studio — Full Execution IDE Specification

> **Architectural Philosophy:**
> The Workflow Studio is NOT a generic visual automation tool; it is an **Execution IDE** that makes the entire OS pipeline visible and controllable:
> **Need $\rightarrow$ AST $\rightarrow$ IR $\rightarrow$ DAG $\rightarrow$ Runtime $\rightarrow$ Result**.

---

## 1. Full IDE Interface Layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Top Toolbar (Name, Version, Status, Search, Save, Validate, Optimize, Run)  │
├─────────────┬───────────────────────────────┬───────────────────────────────┤
│ Skill       │  AI Assist Bar                │         Inspector             │
│ Registry    ├───────────────────────────────┤ (General, Inputs, Outputs,    │
│             │  Execution Canvas (ReactFlow) │  Permissions, Policies,       │
│             │  Color-Coded Nodes            │  Secrets, Logs, Events)       │
│             │  Light Pulse Connections      │                               │
├─────────────┴───────────────────────────────┴───────────────────────────────┤
│ Console (Timeline • Log • Planner Decisions • Metrics • Artifacts)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Subsystem Breakdown

### 1) Top Toolbar
- **Left**: Workflow Name (`Invoice Automation`), Version Badge (`v1.4`), Status Pill (`Draft` | `Validated` | `Running` | `Paused` | `Failed` | `Published`).
- **Center**: Node Search Input (`Search Nodes...`).
- **Right Action Bar**:
  - `Save`: Creates a new version & commits to version history.
  - `Validate`: Runs **GraphValidator** (Type Match, Permissions, Policies, Secrets, Circular Dependencies, Timeouts).
  - `Optimize`: Runs **GraphOptimizer** to insert parallel branches, merge duplicate nodes, and reuse cache.
  - `Debug`: Step-by-step execution mode with breakpoints.
  - `Run` / `Pause` / `Stop`: Controls the Runtime Engine.
  - `Publish`: Publishes as `Template`, `Package`, `REST API`, `CLI Command`, or `Scheduled Job`.

### 2) Left Panel — Skill Registry
- Categorized by 10 Canonical OS Layers (`AI`, `Browser`, `Filesystem`, `Office`, `Communication`, `Vision`, `API`, `Database`, `Cloud`, `Developer`, `Finance`, `System`).
- Skill Cards display: Icon, Name, Latency ms, Offline status badge, Permission requirements, Energy grade (`A+`), and Success rate (`98%`).
- Drag-and-Drop onto the Execution Canvas.
- Semantic search input (`pdf` $\rightarrow$ `pdf.read`, `pdf.ocr`, `pdf.merge`, `pdf.split`).

### 3) AI Assist Bar (Need to DAG Engine)
- Natural language prompt bar: *"Desktop'taki PDF faturaları oku, Excel'e aktar, her cuma mail at"*.
- Live compilation animation: `Need → Planner → AST → Compiler → IR → Optimizer → Validator → Graph Ready`.
- Auto-arranges nodes on the canvas.

### 4) Execution Canvas (ReactFlow DAG)
- **Node State Colors**:
  - 🍦 Cream: Ready
  - 🟢 Green: Running
  - 🟡 Yellow: Waiting
  - 🔵 Blue: Cached
  - 🔴 Red: Error
  - 🔘 Gray: Disabled
- **Connection Type Safety**: Enforces type matching (`Image → OCR → Text` allowed; `Image → Email` blocked by Validator).
- **Node Hover Overlay**: Live CPU, RAM, Energy, and Latency stats.

### 5) Right Inspector Panel
- **General**: Description, Version, Category, Maintainer.
- **Inputs & Outputs**: Strongly-typed fields and file links.
- **Permissions**: Declared FS, Network, Camera, or Clipboard grants.
- **Policies**: Approval gates, spending limits, timeouts, rate limits.
- **Secrets**: Encrypted API keys & credentials.
- **Logs & Events**: Per-node execution event stream (`Started`, `Done`, `Retry`, `Cancelled`).
- **Benchmarks**: CPU, RAM, and Latency performance history.

### 6) Bottom Console (Execution Telemetry)
- **Timeline Tab**: Gantt chart visualization of node execution durations.
- **Execution Log Tab**: Real-time OS execution logs with microsecond timestamps.
- **Planner Decisions Tab**: Transparency engine explaining why the Planner chose specific skills, alternative skills evaluated, and rejected choices.
- **Metrics Tab**: Real-time system CPU, RAM, GPU, Energy, Latency, and Cost meters.
- **Artifacts Tab**: Vault of generated files (Excel, PDF, Images, Email drafts) with instant download.

### 7) Context Panel & Experience Suggestions
- **Current Context Overlay**: Displays active `Conversation`, `Library`, `Experience DB`, `Permissions`, and `Environment`.
- **Experience Suggestions**: One-click historical DAG optimization prompts (*"You executed a similar workflow 24 times | Success 98%"*).

### 8) Pre-Flight Execution Preview & Approval Gates
- **Execution Preview Modal**: Displays estimated duration, CPU/RAM usage, required permissions, and internet requirement before launch.
- **Approval Gates**: Auto-inserts human approval nodes for destructive operations (`Delete Files`, `System Shutdown`).

### 9) Error Recovery & Local Planner Repair
- When a node fails (`OCR Failed`), the Inspector displays 4 recovery actions:
  1. `Retry`
  2. `Use Alternative Skill`
  3. `Ignore`
  4. `Planner Repair`: Generates a localized AST repair for *only the failed node* without re-planning the entire graph.

### 10) Publishing Engine
- Export options: `Skill Package`, `Marketplace Item`, `Share Link`, `REST API Endpoint`, `CLI Command`, or `Scheduled Cron Job`.

---

## 3. End-to-End Execution Flow

```text
Need Input ──► Planner (Outputs AST) ──► Compiler (Outputs IR) ──► Optimizer ──► Validator
                                                                                    │
                                                                                    ▼
Result ◄── Experience DB ◄── Artifacts ◄── Runtime Execution ◄── Canvas DAG ◄───────┘
```
