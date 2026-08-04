# Myca Skill Package Standard (v2.0 Specification)

> **Overview:**
> The Myca Skill Package Standard defines the unified, modular package layout and manifest specification for all native and third-party skills within the Myca Execution OS ecosystem.

---

## 1. Package Directory Standard

Every Myca Skill Package follows a strict 14-element layout:

```text
myca-skill-[name]/
├── manifest.yaml        # Package metadata, runtime compatibility, traits, & limits
├── abi.py               # Pure typed ABI contracts (Input/Output Pydantic schemas only)
├── implementation.py    # Execution logic implementation decorated with @skill
├── permissions.yaml     # Granular permission boundaries
├── policies.yaml        # Safety, cost, rate-limiting & approval policies
├── dependencies.yaml   # Package & Skill dependencies (e.g. filesystem.read>=1.1)
├── examples/            # Declarative YAML examples (consumed by Planner & Knowledge)
│   ├── invoice_processing.yaml
│   └── email_report.yaml
├── docs/                # Structured documentation (inputs.md, security.md, faq.md)
│   ├── overview.md
│   └── security.md
├── tests/               # Automated unit & integration tests
│   └── test_skill.py
├── benchmarks/          # Device-specific latency & memory matrices
│   ├── macbook_m2.json
│   └── raspberrypi.json
├── assets/              # Package icons & static resources
├── LICENSE
└── CHANGELOG.md
```

---

## 2. Manifest Schema (`manifest.yaml`)

```yaml
id: "document.read"
name: "Universal Document Reader"
version: "1.0.0"
category: "Document"

# Runtime & ABI Compatibility
runtime:
  min: "1.2.0"
  max: "2.0.0"
  abi: "1.0"

# Skill Dependencies
dependencies:
  - "filesystem.search>=1.0"
  - "ai.inference>=1.0"

# Structured Output Types
outputs:
  content:
    type: "text/plain"
  artifact:
    type: "document"

# Cost & Hardware Profile
cost:
  cpu: "low"
  memory: "128MB"
  network: "optional"
  gpu: false
  offline: true

# OS Execution Traits
traits:
  - "deterministic"
  - "streaming"
  - "cacheable"
  - "parallel"
  - "cancelable"
  - "stateless"

# Declared Artifact Types
artifacts:
  - "pdf"
  - "docx"
  - "txt"

# OS Events Emitted
events:
  - "Started"
  - "Progress"
  - "Artifact"
  - "Done"
  - "Error"

# Container Sandbox Isolation
sandbox: "filesystem"

# OS Enforced Resource Limits
limits:
  timeout: "30s"
  memory: "512MB"
  disk: "200MB"
  cpu: 2
  threads: 4

# Cryptographic Marketplace Signature
signature:
  publisher: "Myca Core Team"
  checksum: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  public_key: "ed25519:8d9a2c..."

# Skill Quality Metrics
quality:
  success_rate: 0.99
  avg_latency_ms: 12.0
  energy: "A+"
  verified: true
  official: true
```

---

## 3. ABI & Implementation Decoupling

`abi.py` contains **zero execution logic**, defining solely the contract:

```python
# abi.py
from pydantic import BaseModel, Field

class ReadInputs(BaseModel):
    path: str = Field(description="Absolute file path")
    format_adapter: str = Field(default="txt")

class ReadOutputs(BaseModel):
    content: str
    artifact_id: str
```

`implementation.py` contains the actual code executed by the Runtime:

```python
# implementation.py
from .abi import ReadInputs, ReadOutputs
from myca.skills.core.decorator import skill

@skill(id="document.read", inputs_schema=ReadInputs)
async def execute(ctx, path: str, format_adapter: str = "txt"):
    # Execution logic
    ...
```

This allows the **Execution OS & Planner** to inspect contracts and schemas instantly without loading heavy execution dependencies.

---

## 4. Package Manager CLI (`myca-pm`)

The Myca Package Manager handles local & marketplace packages:

```bash
# Install skill package
myca install browser.search

# Update installed packages
myca update

# Remove package
myca remove legacy.skill

# List installed package manifests
myca list
```
