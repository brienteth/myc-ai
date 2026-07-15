<p align="center">
  <img src="hero.png" alt="Myca - The internet, but alive." width="100%" />
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.tr.md">Türkçe</a> · <strong>中文</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/brienteth/myc-ai?style=flat-square&color=00e87a" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/brienteth/myc-ai?style=flat-square&color=5a5a6e" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-00e87a?style=flat-square" alt="Platform Support" />
  <img src="https://img.shields.io/discord/1234567890?style=flat-square&color=5a5a6e&label=discord" alt="Discord members" />
</p>

<p align="center">
  <a href="#开始使用">开始使用</a> · 
  <a href="#官方文档">官方文档</a> · 
  <a href="docs/MYCA_V2_MANIFESTO.md">白皮书 (Whitepaper)</a> · 
  <a href="https://discord.gg/placeholder">Discord</a> · 
  <a href="CHANGELOG.md">更新日志</a>
</p>

---

### myc 是一款开源的、本地优先 (Local-first) 的 AI 自动化操作系统。它运行在您的本地设备上，安全地连接各种工具，并完全保护您的个人数据隐私。

<p align="center">
  <em>本地推理。支持模型上下文协议 (MCP)。无需云端。无需订阅。</em>
</p>

---

## 核心特性

- **工作流画布 (Workflow Studio):** 内置节点编辑器，用于设计自动化工作流（需求 ➔ 规划器 ➔ 执行图 ➔ 完成），支持实时日志和可视化状态追踪。
- **模型上下文协议 (MCP):** 直接连接 Claude 开源 MCP 服务器（通过 stdio 或 SSE），将外部工具动态注册为 AI 技能。
- **持续调度器 (Scheduler):** 在后台持续监视系统触发器（如文件夹监控、定时任务和剪贴板变化）。
- **安全凭证库 (Secrets Vault):** 安全地在本地存储 API 密钥、机器人 Token 和数据库密码。
- **执行控制:** 实时监控活动执行，并支持一键取消/停止运行。

## 软件下载

| 支持平台 | 下载链接 |
|---|---|
| **macOS** (Apple Silicon) | [Myca-macOS.dmg](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-macOS.dmg) |
| **macOS** (Intel / Universal) | [Myca-macOS.zip](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-macOS.zip) |
| **Windows** | [Myca-Windows.zip](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-Windows.zip) |
| **Linux** | [Myca-Linux.zip](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-Linux.zip) |

---

## 我们有何不同？

| | myc | ChatGPT | Jan |
|---|---|---|---|
| **本地运行** | ✓ | ✗ | ✓ |
| **无需注册账号** | ✓ | ✗ | ✓ |
| **P2P 设备共享** | ✓ | ✗ | ✗ |
| **支持离线使用** | ✓ | ✗ | ✓ |
| **永久免费** | ✓ | ✗ | ✓ |
| **随网络规模增长** | ✓ | ✗ | ✗ |
| **完全开源** | ✓ | ✗ | ✓ |

---

## 工作原理

**1. 自动发现周边设备**  
利用 mDNS 自动发现局域网内的其他 myc 实例。零配置，即插即用。

**2. 点对点直接连接**  
基于 WebRTC DataChannel。无中间服务器。数据完全保存在本地。

**3. 共享计算资源**  
手机性能不足 + 强劲的笔记本 ➔ 融合成更强大的协同推理模型。设备越多，网络越聪明。

---

## 科学原理

我们正在构建一个“意图原生 (Intent-Native)”的网络，其中计算跟着数据走，而非数据跟着计算走。  
欲了解完整研究细节，请阅读 [MYCA_V2_MANIFESTO.md](docs/MYCA_V2_MANIFESTO.md)。

---

## 开始使用

```bash
# macOS 安装
brew install myc
myc start

# 或通过源码构建
git clone https://github.com/brienteth/myc-ai
cd myc-ai/ai-layer
pip install -r requirements.txt
python main.py
```

### 构建桌面客户端 (Electron)

在开发模式下运行桌面客户端，或打包成独立的生产安装包（macOS `.dmg`，Windows `.exe`）：

```bash
cd desktop
npm install

# 在本地开发模式下启动应用
npm run electron:start

# 构建独立的客户端安装包 (.dmg / .exe)
npm run electron:build
```

独立的安装包将生成在 `desktop/release/` 目录下。

---

## 系统要求

| 操作系统 | 最低配置 | 推荐配置 |
|---|---|---|
| **macOS** | 13.6+, 8GB RAM | Apple Silicon, 16GB |
| **Windows** | 10+, 8GB RAM | NVIDIA 显卡, 16GB |
| **Linux** | Ubuntu 22.04+, 8GB | CUDA 显卡, 16GB |

---

## 参与贡献

我们随时欢迎研究人员、工程师和批评者加入。在开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 相关链接

- [官方文档](https://docs.myc.ai)
- [学术白皮书](docs/MYCA_V2_MANIFESTO.md)
- [Discord 社区](https://discord.gg/placeholder)
- [X/Twitter](https://x.com/myc_ai)

---

## 开源协议

本项目采用 [MIT 许可证](LICENSE)。

---

## 特别鸣谢

myc 建立在以下优秀的开源基石之上：
- [llama.cpp](https://github.com/ggerganov/llama.cpp) (推理引擎)
- [sentence-transformers](https://github.com/UKPLab/sentence-transformers) (语义缓存)
- [zeroconf](https://github.com/python-zeroconf/python-zeroconf) (mDNS 自动发现)
- [aiortc](https://github.com/aiortc/aiortc) (WebRTC 通信)
