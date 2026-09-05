# Security Policy — MYCA Network

## Supported Versions
We actively maintain and provide security patches for the following versions of MYCA Sovereign Cognitive Infrastructure:

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| 2.x.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability
We take the security of MYCA Network, the Proof-of-Resonance (PoR) consensus, the Silicon PUF hardware interlocks, and our 0-Byte Negation Shield very seriously.

If you discover a security vulnerability in any repository or smart contract of MYCA:
1. **DO NOT** open a public issue on GitHub.
2. Please send a detailed report to our dedicated security team: `security@mycai.pro`.
3. Include detailed steps to reproduce the issue, proof-of-concept (PoC) code if applicable, and expected vs. actual impact.
4. We acknowledge receipt within 24 hours and provide regular status updates until resolution.

## Scope & Bounties
- **In Scope:** Living Lattice DAG consensus, C99 Safe-Sign kernel, Cross-chain BFT Bridge, Smart Contracts (`MycToken`, `MycEscrow`, `MycBridge`), and DePIN Machine Wallets.
- **Out of Scope:** Social engineering, physical attacks requiring direct hardware destruction, and third-party upstream libraries unless patched by MYCA.
