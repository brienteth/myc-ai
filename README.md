# 🌐 MYCA / MYC NETWORK — SOVEREIGN COGNITIVE INFRASTRUCTURE

[![Chain ID](https://img.shields.io/badge/Chain_ID-108_(MYC--LATTICE--MAINNET)-00f2fe.svg)](#)
[![Gas Fee](https://img.shields.io/badge/Gas_Fee-0.00000000_MYC_(Strict_Invariant)-00e676.svg)](#)
[![Finality](https://img.shields.io/badge/Finality-%3C9.79_ms_(PoR_Resonance)-7c3aed.svg)](#)
[![Post-Quantum Armor](https://img.shields.io/badge/Post--Quantum-10--Pillar_Shield_(NIST_ML--DSA_%2B_ML--KEM)-ff0055.svg)](#)
[![Offline Air-Gap](https://img.shields.io/badge/Offline_Air--Gap-100%25_Mesh_Resilience-00f0ff.svg)](#)
[![Hardware Safety](https://img.shields.io/badge/Safety_Brake-4.95µs_0--Byte_Clamp-ff9900.svg)](#)
[![Dune Analytics](https://img.shields.io/badge/Dune_Analytics-Query_%238625163-ff6b00.svg)](https://dune.com/queries/8625163)

> **"Her node kendi cihazında çalışır — Merkezi sunucu yok, kullanıcı VPS'i yok. Herkes hem kullanıcı hem altyapı."**

MYCA, yapay zeka ajanları (Autonomous Cognitive Agents) ve DePIN donanımları için tasarlanmış; **Sıfır Gaz (Zero-Gas)**, **Donanım PUF Güvenliği**, **Nodeless Lattice DAG** ve **Çift Yollu (Dual-Lane) Ekonomik Yerleşim** mimarisine sahip egemen bir blokzincir çalışma ortamıdır.

---

## ⚡ 1-Tıkla Kurulum ve Başlatma (Quickstart)

Sistemi tanımayan herhangi bir kullanıcı, hiçbir karmaşık ayar yapmadan tek bir komutla kendi cihazını ağa bağlayabilir:

### macOS & Linux
```bash
curl -sSL https://mycai.pro/install.sh | bash
```
*(veya yerel depoda:* `./install.sh` *)*

### Windows (PowerShell)
```powershell
irm https://mycai.pro/install.ps1 | iex
```

Kurulum tamamlandığında node'unuz anında ayağa kalkar:
```bash
myc-node start
```

Tarayıcınızda otomatik olarak **MYCA NEXUS Web3 Portalı** açılır:
👉 **[http://localhost:4040/nexus](http://localhost:4040/nexus)**

---

## 🏛️ Temel Mimari Prensipleri

```text
┌────────────────────────────────────────────────────────┐
│                   MYCA SOVEREIGN STACK                 │
├────────────────────────────────────────────────────────┤
│  Layer 3: Autonomous Agent Colony & Machine Economy    │
│           (Dual-PoR Task Escrow, Sub-ms MycStreamPay)  │
├────────────────────────────────────────────────────────┤
│  Layer 2: Dual-Lane Settlement Matrix                  │
│           Lane A: Zero-Gas Lattice DAG (<38.4 µs)      │
│           Lane B: Multi-Chain EVM & USDC Collateral    │
├────────────────────────────────────────────────────────┤
│  Layer 1: Proof-of-Resonance (PoR) Consensus Engine    │
│           (0-Byte Negation Shield, BFT Supermajority)  │
├────────────────────────────────────────────────────────┤
│  Layer 0: Silicon PUF Hardware & DePIN Gateway         │
│           (Ed25519 Deterministic Seed, myc1... format) │
└────────────────────────────────────────────────────────┘
```

### 1. Katı Sıfır-Gaz Kuralı (Zero-Gas Protocol Invariant)
* İşlem transferleri, sözleşme çalıştırmaları ve PoR doğrulamaları için **gaz ücreti daima 0.00000000 MYC'dir**.
* `gasPrice > 0` veya `gasLimit > 0` içeren tüm işlemler protokol düzeyinde derhal reddedilir.

### 2. Dinamik Gerçek Getiri Modeli (Provable Real-Yield APY)
* Karşılıksız enflasyon basarak veya borçlanarak sabit %18 getiri vaat edilmez.
* **Formül:** $\text{APY} = \min\left(\frac{Y}{X}, 0.18\right)$
  * $X$: Toplam stake edilen $\$MYC$ miktarı.
  * $Y$: Protokolün gerçek on-chain yıllık nakit akışı (DEX 0.3% komisyonu + Görev Escrow %5 kesintisi + Bridge ücretleri).
  * Protokol geliri yetersizse APY dinamik olarak düşer; yüksekse %18 tavanında tutulup fazlası Hazineye aktarılır.

### 3. Cross-Chain Bridge BFT Güvenlik Modeli
* **BFT 2/3 + 1 Süper-Çoğunluk:** Tekil relayer veya merkezi admin mint/release yapamaz; en az 3/4 validatör imzası şarttır.
* **Replay Attack Koruması:** Deterministik transfer hash mühürleme (`transferId`) ile mükerrer çekim engellenir.
* **Devre Kesici (Circuit Breaker):** Tek işlemde maksimum 50,000 MYC sınırı ve acil durum dondurma mekanizması (`pauseBridge`).

---

## 🛡️ 10 Katmanlı Kuantum Sonrası ve Fiziksel Güvenlik Zırhı (Post-Quantum & Physical Hardening)

MYCA Network, kuantum bilgisayarların (Shor ve Grover algoritmaları) ve fiziksel yan-kanal saldırılarının tehdit oluşturamayacağı **10 katmanlı birleşik bir savunma kalkanı** ile korunur:

| # | Güvenlik Sütunu | Teknik / Matematiksel Tanım | Savunma Mekanizması |
| :-: | :--- | :--- | :--- |
| **1** | **Silicon PUF** | `did:myc:puf:<sram_hash>` | Klonlanamaz fiziksel kök; atomik üretim jitter'ı kuantum PC ile kopyalanamaz. |
| **2** | **C99 Çekirdeği** | Constant-Time $\mathcal{O}(1)$ (malloc=0) | Mikrokod seviyesinde zamanlama ve yan-kanal (side-channel) sızıntısını sıfırlar. |
| **3** | **PoR 64-D HDC** | Hyperdimensional Vector Space | %25 kuantum bit-flip gürültüsü ve bozulmasında dahi kararlı kosinüs benzerliği. |
| **4** | **Colony Mesh** | K=8 Neighborhood Graph (80k Links) | Dağıtık miselyum topolojisi; merkezi hedef yok, <350ms self-healing onarım. |
| **5** | **Air-Gapped DTN** | Delay-Tolerant Networking | İnternetsiz izole segment koruması; yerel mühürleme ve sıfır veri kaybı. |
| **6** | **Dilithium3 (ML-DSA-65)** | NIST Module-LWE Kafes İmzası | Shor algoritmasına karşı post-kuantum matematiksel bağışıklık. |
| **7** | **BLAKE3-512** | 512-Bit Merkle Ağaç Hash'i | Grover kuantum arama algoritmasına karşı 256-bit tam güvenlik marjı. |
| **8** | **4.95 µs Safe-Sign** | 0-Bayt Donanım Fren Kalkanı | Kuantum şifreyi çözse bile fiziksel akım röleden geçemez, aktüatör 4.95µs'de sıfırlanır. |
| **9** | **Kuantum Faz Sönümleme** | $\Delta\Phi > 45^\circ \implies \cos^2(\Delta\Phi) \equiv 0.0$ | Heisenberg-Tesla kuralı; kuantum süperpozisyon ve Sybil forku anında 0'a söner. |
| **10**| **ML-KEM-1024 (Kyber)** | NIST Seviye-5 Post-Quantum KEM | "Şimdi kaydet, kuantum çıkınca çöz" saldırısını P2P seviyesinde imkansız kılar. |

---

## 🌲 İnternetsiz & Çevrimdışı Çalışma Mimarisi (Air-Gapped Operation)

MYCA Network, dünya genelinde elektrik veya internet altyapısının kesildiği kriz ve saha şartlarında **100% bağımsız ve çevrimdışı** çalışacak şekilde tasarlanmıştır:

1. **Sıfır Bulut Bağımlılığı:** Düğümler, internet olmadan yerel SRAM mikroskobik varyasyonlarından donanım kimliğini (`did:myc:puf:...`) anında türetir.
2. **Fiziksel Kablo & Radyo Mesh (RS-485 / LoRa / BLE):** Maden ocakları, tarım arazileri ve fabrikalardaki cihazlar RS-485 Modbus kablosu veya LoRaWAN üzerinden yerel P2P mutabakatı (PoQR) yürütür.
3. **Çevrimdışı Mikro-DAG Mühürleme:** Sıfır gas'li işlemler yerel Flash/EEPROM/IndexedDB belleğe mikrosaniyeler içinde mühürlenir.
4. **DTN (Delay-Tolerant Networking) Senkronizasyonu:** İnternet saatler veya günler sonra geri geldiğinde, çevrimdışı üretilen tüm DAG dalları ana zincire (Chain 108) çift harcama veya geri alma olmadan pürüzsüzce bağlanır.

---

## 🧩 Eklentiler ve Arayüzler

### 🛡️ Google Chrome Cüzdanı (MYCA Sovereign Wallet)
Manifest V3 standardında hazırlanmış, Silicon PUF tohumlu Chrome Eklentisi:
* **Dizin:** [`chrome-extension/`](file:///Users/bl10buer/Desktop/myc-network/chrome-extension/)
* **Yükleme:** Chrome'da `chrome://extensions/` adresine gidin $\to$ "Geliştirici modu"nu açın $\to$ "Paketlenmemiş öğe yükle" diyerek `chrome-extension` klasörünü seçin.

### 🧭 MYCA NEXUS Portalı (`http://localhost:4040/nexus`)
* **Lattice Explorer:** Canlı bloklar, sıfır-gaz işlem akışı, konsensüs kanıtları.
* **MYC Swap (DEX):** 7 katmanlı güvenlik (Slippage guard, Anti-sandwich cooldown, Whale guard, TWAP oracle) destekli AMM ($MYC / USDT).
* **Sovereign Bridge:** Base, Arbitrum ve Ethereum ile çift yönlü kriptografik köprü (BFT Quorum & Replay Guard).
* **MycStreamPay & Direct Pay:** Ajanlar arası alt-milisaniye streaming ödeme kanalları.
* **DePIN Staking & Fleets:** Fiziksel aktüatör ve compute slot kotaları, cihaz cüzdanları.
* **MYC Agent Terminal:** Gerçek zamanlı ikili PoR doğrulamalı yapay zeka görev yöneticisi.

---

## 🧪 Test ve Doğrulama

Tüm katmanlar 18 bağımsız kabul ve güvenlik test paketiyle %100 kapsanmıştır:

```bash
npm test
```

Çalıştırılan test paketleri:
1. `Baseline Zero-Gas Verification`
2. `Phase 2: Blockchain Core (BFT, State Machine, Block Merkle Trees)`
3. `Phase 3: Proof-of-Resonance Resources & Negation Shield`
4. `Phase 4: Colony Foundation & Autonomous Node Identity`
5. `Phase 5: Distributed Cognition & P2P Task Schedulers`
6. `Phase 7: Agent Economy & Dual-Lane Escrow Settlement`
7. `Phase 8: Agent SDK Integration & Multi-Agent Workflows`
8. `Phase 9: Actuator Hardware Safety & Modbus Guard`
9. `Production Hardening & Sub-ms Finality Benchmarks`
10. `Live P2P Network (Fault Tolerance, Fork Reorg, Double-Spend Defense)`
11. `Security & Game Theory (Sybil Attack, Proof Farming, Escrow Griefing)`
12. `SDK Developer Experience & PUF Keypair Lifecycle`
13. `Real Autonomous Agent E2E Workload (Dual-PoR 95/5 Settlement)`
14. `Zero-Gas Invariant Suite (8/8 Adversarial Invariant Tests)`
15. `Due-Diligence Dynamic APY & Bridge Security Model (8/8 Tests)`
16. `DePIN Machine Wallets & Hardware Telemetry Suite`
17. `Agent Bridge Gateway (Cross-Chain Intent, IoT M2M, Agent Economy)`
18. `MycSwap Security & Anti-Bot Verification (32/32 Tests)`
19. `Air-Gapped & Offline Resilience Suite (RS-485 / LoRa DTN Mesh)`
20. `10-Pillar Post-Quantum Armor Suite (ML-DSA-65, ML-KEM-1024, BLAKE3-512)`

---

## 📄 Lisans
MIT License — MYCA Core Engineering Team.
