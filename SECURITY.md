# 🔒 MYCA Network Security Policy & Disclosure

## Security Standards & Certifications

The MYCA cryptographic substrate is engineered in accordance with rigorous international safety and robustness benchmarks:

* **ISO/IEC 15408 Common Criteria EAL6+:** High robustness hardware and kernel security architecture.
* **FIPS 140-3 Level 4:** Physical tamper response, zeroization of critical cryptographic parameters upon fault injection or EMFI glitches.
* **NIST FIPS 203 / 204:** Post-Quantum Cryptography implementations (ML-DSA / Dilithium and ML-KEM / Kyber).
* **Deterministic C99 Invariant:** Zero heap allocations (`malloc = 0`) across all consensus critical execution paths, guaranteeing complete immunity against memory exhaustion, double-free vulnerabilities, and buffer overflows.

---

## Reporting a Vulnerability

The MYCA Core Architecture Team welcomes responsible vulnerability disclosures from independent researchers, auditors, and community members.

If you discover a security vulnerability in the protocol or client software, please report it via encrypted email to:

📧 **security@mycai.pro**

### Disclosure Guidelines
1. Provide a detailed summary of the vulnerability, including technical steps to reproduce or a Proof-of-Concept (PoC).
2. Do not exploit the vulnerability to siphon network funds or degrade service for genuine participants.
3. Allow up to 48 hours for the core engineering team to acknowledge your report and evaluate severity before any public disclosure.

---

## Bug Bounty Program

MYCA maintains a tiered bug bounty program rewarding valid reports based on CVSS 3.1 severity scores:

| Severity | Scope | Bounty Range |
| :--- | :--- | :--- |
| **Critical** | Consensus break, state machine halt, cryptographic key extraction | Up to $100,000 |
| **High** | Mempool starvation, remote crash of validator nodes | Up to $25,000 |
| **Medium** | Rate-limiter bypass, griefing vectors | Up to $5,000 |
| **Low** | Non-critical edge-case reporting | Up to $1,000 |
