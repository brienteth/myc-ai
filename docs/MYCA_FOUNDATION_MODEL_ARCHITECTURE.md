# Myca Execution Engine — Technical Architecture & Specification

> **Mission Statement:**
> *"Myca is an AI-native execution operating system that compiles human intent into deterministic execution graphs. Text is optional. Execution is primary."*

---

## 1. Architectural Distinction: Execution Engine vs. Execution Model

The **Execution Foundation Model** is NOT the entire Execution Engine; it is solely the reasoning intelligence module. The **Execution Engine** is the full operating system layer that orchestrates intent compilation, intermediate representation, optimization, policy validation, capability routing, and runtime execution.

```text
Need
  │
  ▼
Need Interpreter
  │
  ▼
Execution Foundation Model (Outputs Execution AST)
  │
  ▼
Execution AST
  │
  ▼
Execution Compiler (Multi-Stage AST → Execution IR)
  │
  ▼
Execution IR (The LLVM IR of Execution OS)
  │
  ▼
Graph Optimizer (Cost, Parallelization, Cache Reuse, Energy)
  │
  ▼
Graph Validator (Type, Permission, Policy, Sandbox, Budget, Approval)
  │
  ▼
Capability Router (Hardware & Colony Mesh Dispatch)
  │
  ▼
DAG Scheduler
  │
  ▼
Runtime
  │
  ▼
Skill ABI
  │
  ▼
Result
```

---

## 2. Execution IR (Intermediate Representation) — The LLVM of Execution OS

The Execution Compiler transforms the **Execution AST** into a target-agnostic **Execution IR (Intermediate Representation)**. 

Once compiled into IR, the Execution Engine can target multiple output formats without altering the model or core compiler:
- **Execution DAG**: Native runtime graph.
- **Persistent Workflow**: Saved triggerable automation.
- **Autonomous Agent**: Interactive agent loop.
- **CLI Script**: Standalone executable script.
- **JSON Payload**: Standard network transport format.

---

## 3. The Multi-Stage OS Compiler Subsystem

The **Execution Compiler** operates as a full operating system compiler:

```text
Execution AST
      │
      ▼
  [Parser]
      │
      ▼
[Normalizer]
      │
      ▼
[Type Resolver]
      │
      ▼
[Reference Resolver]
      │
      ▼
[Dependency Builder]
      │
      ▼
[Static Analyzer]
      │
      ▼
Execution IR
```

---

## 4. Multi-Strategy Graph Optimizer

The Optimizer receives `Execution IR` and executes optimization passes independent of runtime hardware:

```text
Execution IR
      │
      ▼
Cost Optimization ──► Parallelization Pass ──► Cache Reuse Pass
      │
      ▼
Experience Ranking ──► Energy Optimization ──► Offline Optimization Pass
      │
      ▼
Optimized Execution Graph (DAG)
```

---

## 5. Policy-Enforced Validator

The **Graph Validator** enforces 9 strict security, policy, and safety boundaries:

1. **Type Safety**: Input/output schema typing.
2. **Permission Grants**: Granular permission checks (`fs.read`, `network.out`).
3. **Policy Rules**: Business logic policies (e.g., transactions $> \$1000$ require manager approval).
4. **Capability Match**: Validates node hardware requirements.
5. **Sandbox Boundaries**: Prevents illegal OS path traversal (`/etc/passwd`).
6. **Secrets Isolation**: Verifies safe secret key handling.
7. **Identity Verification**: Signature & owner verification.
8. **Human-in-the-Loop Approval**: Enforces approval gates for destructive/admin actions.
9. **Budget Ceiling**: Enforces maximum execution cost limits.

---

## 6. OS Grammar Tokenizer

The Tokenizer learns **OS Grammar & Syntax**, decoupling vocabulary from specific skill names:

- `[CALL]`: Invokes a skill primitive (`[CALL]` `filesystem.search`).
- `[PERM]`: Declares required permission scope (`[PERM]` `fs.read`).
- `[NODE]`: Defines node boundary.
- `[REF]`: OS-level reference object (`[REF]` `node_A.outputs.content`).
- `[COND]`: Dynamic branch condition.
- `[ITER]`: Loop control.

---

## 7. Execution Knowledge & Working Memory Context

Context encompasses a 10-layer OS state including **Working Memory** (transient variables during execution) and **Execution Knowledge** (Skill docs, schemas, and examples):

```text
Extended OS Context = 
  1. Conversation History
+ 2. Working Memory (Transient variables during execution)
+ 3. Document Library Index
+ 4. Execution Knowledge (Skill ABI docs, JSON Schemas, Package examples)
+ 5. Experience DB Metrics & Hints (Planner & Optimizer Hints)
+ 6. Workflow State
+ 7. Real-Time Execution State (In-flight logs, failed node states)
+ 8. Artifact Subsystem Store
+ 9. Permission Scope & Policies
+ 10. Environment State (OS, battery, network status)
```

---

## 8. Capability Router: Colony Decoupling

The Planner and Foundation Model operate purely on **Needs** and **Execution IR**; they have **zero knowledge of specific target computers**. 

The **Capability Router** sits at the Runtime layer to map DAG nodes to specific devices (MacBook vs RTX Desktop vs Colony Peer Nodes) dynamically based on real-time hardware specs, latency, and GPU availability.

---

## 9. The Three Core Pillars of Myca

1. **Execution-First**: Primary output is executable intent ($\text{AST} \to \text{IR} \to \text{DAG}$), not conversational text.
2. **OS-First**: Runtime is provider-agnostic; everything operates strictly over the Skill ABI.
3. **Local-First**: Planning, execution, and user data stay strictly local; distributed Colony execution is a natural extension of the capability router.
