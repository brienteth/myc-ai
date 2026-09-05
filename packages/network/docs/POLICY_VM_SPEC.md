# MYCA Policy VM — Deterministic Authorization Policy Machine Specification v1

**Version:** 1.0.0-PROD  
**Invariant §26:** The Policy VM evaluates deterministic authorization policies using a constrained JSON AST. Arbitrary code execution is strictly prohibited.

---

## 1. Formal Grammar

```text
expression :=
    and(expression*)
  | or(expression*)
  | not(expression)
  | comparison

comparison :=
    eq(value, value)
  | neq(value, value)
  | gt(value, value)
  | gte(value, value)
  | lt(value, value)
  | lte(value, value)
  | in(value, list)
  | not_in(value, list)

value :=
    field(path)
  | constant(value)
```

---

## 2. Example Policy AST

```json
{
  "and": [
    {
      "eq": [
        { "field": "task.asset" },
        "USDC"
      ]
    },
    {
      "lte": [
        { "field": "task.amount" },
        100
      ]
    },
    {
      "in": [
        { "field": "caller.role" },
        ["Validator", "Execution Node", "Colony Peer"]
      ]
    }
  ]
}
```

---

## 3. Guarantees

1. **Deterministic:** Same inputs always yield the same boolean outcome.
2. **Side-Effect Free:** Read-only evaluation against context object.
3. **Bounded Complexity:** Maximum AST depth of 16, maximum 64 leaf expressions.
4. **Auditable:** Produces an evaluation trace for on-chain proof attachment.
