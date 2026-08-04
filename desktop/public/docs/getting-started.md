# Getting Started with myc

myc is a fully decentralized, private P2P intelligence network that runs local Large Language Models (LLMs) on your hardware mesh with zero external cloud dependencies.

## Prerequisites

To compile and run myc on your local machine, ensure you have the following packages installed:
- **Python 3.10+** (Required for the `ai-layer` inference engine)
- **Node.js 18+** (Required for compiling the Vite + Electron desktop application)
- **uv** (Recommended Python package manager)

---

## 1. Setup the AI Layer (Local Backend)

The backend layer is written in Python and is responsible for managing local model execution, mDNS discovery, and WebRTC P2P communication.

```bash
# Clone the repository
git clone https://github.com/brienteth/myc-ai
cd myc-ai/ai-layer

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate

# Install dependencies (llama-cpp-python compiles with Metal acceleration on Apple Silicon)
pip install -r requirements.txt
```

### Running in Simulation Mode
If you do not want to download a model immediately or are running tests, you can boot the backend in simulation mode:
```bash
python main.py --simulate
```
This spawns the mock inference endpoints and P2P registry on port `8420`.

### Running with a Local GGUF Model
myc searches for models under `~/.myca/models/` by default. You can place any GGUF formatted model (e.g. Llama-3.2-3B) in that directory. The first time you execute a capability request, the engine will automatically load, warm up the KV cache, and benchmark the local generation throughput.

---

## 2. Launch the Desktop App (Vite + Electron)

The UI interface runs in Electron for native device permissions.

```bash
# Navigate to desktop directory
cd ../desktop

# Install packages
npm install

# Run the Electron developer build
npm run dev
```

The Electron app will open instantly and establish a local link with the `ai-layer` server on port `8420`. You can begin querying prompts privately.
