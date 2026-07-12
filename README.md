<p align="center">
  <img src="docs/banner.svg" alt="myc banner" width="100%" />
</p>

<p align="center">
  <strong>English</strong> · <a href="README.tr.md">Türkçe</a> · <a href="README.zh.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/myc-ai/myc?style=flat-square&color=00e87a" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/myc-ai/myc?style=flat-square&color=5a5a6e" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-00e87a?style=flat-square" alt="Platform Support" />
  <img src="https://img.shields.io/discord/1234567890?style=flat-square&color=5a5a6e&label=discord" alt="Discord members" />
</p>

<p align="center">
  <a href="#getting-started">Getting Started</a> · 
  <a href="#documentation">Documentation</a> · 
  <a href="docs/MYCA_V2_MANIFESTO.md">Whitepaper</a> · 
  <a href="https://discord.gg/placeholder">Discord</a> · 
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

### myc is an open-source AI that runs on your devices, grows stronger as more people join, and never sends your data anywhere.

<p align="center">
  <img src="docs/demo.gif" alt="myc demo" width="100%" />
  <br />
  <em>1.1s local inference. No cloud. No subscription.</em>
</p>

---

## Downloads

| Platform | Download |
|---|---|
| **macOS** (Apple Silicon) | [myc.dmg](https://github.com/myc-ai/myc/releases/latest/download/myc.dmg) |
| **macOS** (Intel) | [myc-intel.dmg](https://github.com/myc-ai/myc/releases/latest/download/myc-intel.dmg) |
| **Windows** | [myc.exe](https://github.com/myc-ai/myc/releases/latest/download/myc.exe) |
| **Linux** (AppImage) | [myc.AppImage](https://github.com/myc-ai/myc/releases/latest/download/myc.AppImage) |

---

## What makes it different?

| | myc | ChatGPT | Jan |
|---|---|---|---|
| **Runs locally** | ✓ | ✗ | ✓ |
| **No account needed** | ✓ | ✗ | ✓ |
| **P2P device sharing** | ✓ | ✗ | ✗ |
| **Works offline** | ✓ | ✗ | ✓ |
| **Free forever** | ✓ | ✗ | ✓ |
| **Grows with network** | ✓ | ✗ | ✗ |
| **Open source** | ✓ | ✗ | ✓ |

---

## How it works

**1. Finds nearby devices**  
mDNS discovers other myc instances on your network. Zero configuration.

**2. Connects directly**  
WebRTC DataChannel. No server in between. Your data stays local.

**3. Shares the work**  
Weak phone + strong laptop = better model together. The more devices, the smarter the network.

---

## The Science

We are building an Intent-Native Internet where computation follows data, not the other way around.  
Read the full research details in [MYCA_V2_MANIFESTO.md](docs/MYCA_V2_MANIFESTO.md).

---

## Getting Started

```bash
# macOS
brew install myc
myc start

# or build from source
git clone https://github.com/myc-ai/myc
cd myc/ai-layer
pip install -r requirements.txt
python main.py
```

---

## System Requirements

| OS | Minimum | Recommended |
|---|---|---|
| **macOS** | 13.6+, 8GB RAM | Apple Silicon, 16GB |
| **Windows** | 10+, 8GB RAM | NVIDIA GPU, 16GB |
| **Linux** | Ubuntu 22.04+, 8GB | CUDA GPU, 16GB |

---

## Contributing

We welcome researchers, engineers, and critics. Read our [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## Links

- [Documentation](https://docs.myc.ai)
- [Whitepaper](docs/MYCA_V2_MANIFESTO.md)
- [Discord](https://discord.gg/placeholder)
- [X/Twitter](https://x.com/myc_ai)

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

myc is built on top of these open-source building blocks:
- [llama.cpp](https://github.com/ggerganov/llama.cpp) (inference engine)
- [sentence-transformers](https://github.com/UKPLab/sentence-transformers) (semantic cache)
- [zeroconf](https://github.com/python-zeroconf/python-zeroconf) (mDNS discovery)
- [aiortc](https://github.com/aiortc/aiortc) (WebRTC communication)
