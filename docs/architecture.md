# myc Architecture Overview

myc is structured as a generic, intent-native computing platform. Rather than building individual, hardcoded capabilities, the core runtime functions as an **Execution OS** that orchestrates deterministic primitives called **Skills** across a peer-to-peer hardware mesh.

```
                  +--------------------------------+
                  |           Need (User)          |
                  +--------------------------------+
                                  |
                                  v
                  +--------------------------------+
                  |         Planner (LLM)          |
                  +--------------------------------+
                                  |
                                  v
                  +--------------------------------+
                  |      Execution Graph (DAG)     |
                  +--------------------------------+
                                  |
                                  v
                  +--------------------------------+
                  |         Skill Registry         |
                  +--------------------------------+
                    /             |              \
                   v              v               v
           +-----------+    +-----------+    +-----------+
           | Skill ABI |    | Skill ABI |    | Skill ABI |
           | (Chat)    |    | (Browser) |    | (FS)      |
           +-----------+    +-----------+    +-----------+
```

---

## 1. Core Platform Layers

### Layer 1: Discovery (`discovery.py`)
myc discovers peer nodes automatically on local Wi-Fi networks using mDNS (Multicast DNS). For global connections, nodes optionally check in with the **Opacus H3 Global Registry** to route computation requests across the internet without central cloud coordinators.

### Layer 2: Connection (`connection.py`)
All node-to-node data routing runs over direct WebRTC DataChannels. This ensures that no intermediate gateway server acts as a bottleneck or can inspect traffic. If a direct P2P link fails, the layer falls back to WebRTC relays automatically.

### Layer 3: Orchestrator (`orchestrator.py`)
Converts user prompts (Needs) into an Execution Graph (DAG). The generic DAG scheduler executes independent branches in parallel via native Python `asyncio.gather()`, resolves dependency outputs (e.g. mapping `"$A.html"` as input for node B), and logs events.

### Layer 4: Cryptography (`crypto.py`)
Traffic across the P2P mesh is encrypted using post-quantum secure **Kyber-768 Key Encapsulation Mechanism (KEM)** combined with AES-256-GCM symmetric session keys. Keys rotate periodically to maintain perfect forward secrecy.

### Layer 5: Native Inference Engine (`engine.py`)
A local zero-Ollama in-process inference engine powered by `llama-cpp-python` with Metal GPU acceleration on macOS. The engine abstracts GGUF model files into logical capability sets (`chat`, `embedding`, etc.), executing blocking generation tasks inside worker threads to keep the main event loop responsive.

---

## 2. Skill ABI Contract

Every operation in myc is implemented as a **Skill** decorated with the `@skill` declaration:

```python
@skill(
    id="browser.fetch",
    inputs=FetchInputs,
    outputs=FetchOutputs,
    permissions=["browser.navigation"]
)
async def fetch_skill(ctx: SkillContext, url: str) -> dict:
    ...
```

The **Skill ABI** guarantees:
1. **Type-Safe Validation:** Inputs and outputs are strictly validated against Pydantic schemas before the skill execution lifecycle begins.
2. **Context Isolation:** Skills communicate with system APIs (like the file system or browser) solely through the passed `SkillContext`—preventing direct unsanctioned OS requests.
3. **OS-Level Recovery:** If a skill execution raises an exception or fails, the runtime manages retries and fallback options at the OS level (e.g., repeating the node execution or switching to a fallback alternative skill).
