# MYCA Agent VM — Deterministic Task Orchestration Machine Specification v1

**Version:** 1.0.0-PROD  
**Invariant §23:** The Agent VM is a deterministic task orchestration machine, **NOT** a general-purpose programming language. It executes a strictly constrained instruction set without arbitrary JavaScript execution (`eval` and `new Function` are mathematically prohibited).

---

## 1. Instruction Set Architecture (ISA)

The Agent VM executes only the following 12 primitive opcodes:

| Opcode | Parameters | Description |
| :--- | :--- | :--- |
| `LOAD_CONTEXT` | `key`, `target` | Loads immutable task or environment context into register. |
| `MEMORY_GET` | `key` | Retrieves a value from the agent's local memory store. |
| `MEMORY_PUT` | `key`, `value` | Persists a value to the agent's local memory store. |
| `ROUTE` | `capability` | Selects a capable Colony peer for the next operation. |
| `CALL_TOOL` | `tool`, `args` | Invokes an allowlisted local or Colony cognitive tool. |
| `ASSERT` | `condition`, `expected` | Deterministic verification of invariant; terminates on failure. |
| `WAIT` | `timeoutMs` | Bounded pause for asynchronous event resolution. |
| `EMIT` | `event`, `data` | Emits an auditable on-chain or network event. |
| `CREATE_TASK` | `capability`, `payload` | Spawns a subtask in the Colony task protocol. |
| `LOCK_ESCROW` | `taskId`, `amount`, `asset` | Locks funds in the Escrow contract for task execution. |
| `SUBMIT_PROOF` | `taskId`, `proofHash` | Submits verifiable execution proof to chain. |
| `RETURN` | `value` | Halts execution and returns final result. |

---

## 2. Program Format

Agent programs are deterministic JSON-serialized plans:

```json
{
  "version": "1",
  "name": "math_orchestration_plan",
  "maxSteps": 100,
  "memoryLimitKb": 512,
  "instructions": [
    { "op": "LOAD_CONTEXT", "key": "user.intent", "target": "intent" },
    { "op": "ROUTE", "capability": "math_eval" },
    { "op": "CALL_TOOL", "tool": "math_eval", "args": { "expr": "intent.expr" } },
    { "op": "ASSERT", "condition": "result.valid", "expected": true },
    { "op": "RETURN", "value": "result.data" }
  ]
}
```

---

## 3. Finite State Machine (FSM)

The Agent VM strictly transitions through the following 8 states:

```
[CREATED] ──► [READY] ──► [RUNNING] ──┬──► [WAITING] ──► [RUNNING]
                            │         ├──► [VERIFYING] ──► [COMPLETED]
                            │         └──► [FAILED]
                            └─────────► [CANCELLED]
```
