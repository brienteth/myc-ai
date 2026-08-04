# Contributing to myc

We welcome contributions from researchers, software engineers, and AI enthusiasts. Since myc is a localized, decentralized P2P intelligence network, our contribution workflow emphasizes system security, ABI compatibility, and performance optimization.

---

## How to Contribute

### 1. Code Style Guidelines
- **Python (AI Layer):** We follow strict PEP 8 formatting. Run `ruff check` or `black` before submitting PRs. Ensure all new skills implement the `SkillABI` contract and define valid Pydantic input/output schemas.
- **Javascript (Desktop App):** Follow standard ESLint guidelines. Keep UI components responsive, lightweight, and localized in English.
- **Rust (Runtime):** Code must be formatted via `cargo fmt` and compile without warning flags.

### 2. Testing Your Changes
Before submitting a pull request, run the test suites to prevent regression errors:

```bash
# Verify the generic OS ABI lifecycle and graph recovery
cd ai-layer
python -m pytest myca/skills/test_os_sdk.py
```

### 3. Submitting a Pull Request
1. Fork the repository `brienteth/myc-ai`.
2. Create a feature branch: `git checkout -b feat/my-cool-feature`.
3. Commit your changes with descriptive messages following Conventional Commits (e.g. `feat: add audio transcription skill`).
4. Push your branch and open a Pull Request against the `main` branch.

---

## Code of Conduct

Please help us keep myc an inclusive and respectful community. By participating, you agree to abide by our Code of Conduct.

For direct security reports or questions, reach out via our Discord channel.
