# 🌐 MYCA NETWORK: GLOBAL ECOSYSTEM LISTING & RECOGNITION ACTION GUIDE

This master operational guide provides direct application links, pull request commands, and submission steps to register, index, and list **MYCA Network ($MYC)** across all primary Web3 aggregators, data platforms, and DePIN directories.

---

## 📑 DIRECT APPLICATION DIRECTORY & PLATFORM LINKS

| Platform | Category | Submission Link | Required Prepared File |
| :--- | :--- | :--- | :--- |
| **Chainlist.org** | EVM Chain Directory | [ethereum-lists/chains GitHub](https://github.com/ethereum-lists/chains) | `ecosystem_listings/chainlist_eip3014.json` |
| **DefiLlama** | TVL & Chain Analytics | [DefiLlama-Adapters GitHub](https://github.com/DefiLlama/DefiLlama-Adapters) | `ecosystem_listings/defillama_chain_adapter.js` |
| **DePINscan (IoTeX)** | DePIN Hardware Index | [DePINscan Project Form](https://depinscan.io/contact) | `ecosystem_listings/depinscan_iotex_application.json` |
| **DePIN Hub** | DePIN Project Directory | [DePIN Hub Submit Form](https://depinhub.io/submit) | `ecosystem_listings/depinhub_listing_dossier.md` |
| **CoinMarketCap** | Market Data Aggregator | [CMC Request Form](https://support.coinmarketcap.com/hc/en-us/requests/new) | `ecosystem_listings/coinmarketcap_application_dossier.md` |
| **CoinGecko** | Token & Chain Listing | [CoinGecko Listing Form](https://www.coingecko.com/en/request) | `ecosystem_listings/coingecko_application_dossier.md` |
| **RootData** | Web3 Intelligence | [RootData Submit Project](https://www.rootdata.com/feedback) | `ecosystem_listings/rootdata_cryptorank_dossier.md` |
| **CryptoRank** | Funding & Ecosystem | [CryptoRank Listing Form](https://cryptorank.io/contact-us) | `ecosystem_listings/rootdata_cryptorank_dossier.md` |
| **Dropstab** | Analytics & Tokenomics | [Dropstab Request](https://dropstab.com/request) | `ecosystem_listings/rootdata_cryptorank_dossier.md` |
| **Token Lists** | DEX / Wallet Standard | [Uniswap Token Lists Repo](https://github.com/Uniswap/token-lists) | `ecosystem_listings/canonical_tokenlist.json` |

---

## 🛠️ STEP-BY-STEP EXECUTION INSTRUCTIONS

### 1. Chainlist (Ethereum-Lists) PR Submission
To have MYC Network natively selectable in MetaMask, Rabby, and Web3 wallets:
1. Fork [https://github.com/ethereum-lists/chains](https://github.com/ethereum-lists/chains).
2. Add a new file at `_data/chains/eip155-108.json` with the exact contents of:
   [ecosystem_listings/chainlist_eip3014.json](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/chainlist_eip3014.json).
3. Submit a Pull Request titled:
   `Add MYC Living Lattice Mainnet (Chain ID 108)`.

---

### 2. DefiLlama Chain & TVL Adapter PR Submission
To track MYC Network's TVL ($6.965M Node License Treasury + AMM DEX + Staking):
1. Fork [https://github.com/DefiLlama/DefiLlama-Adapters](https://github.com/DefiLlama/DefiLlama-Adapters).
2. Create directory `projects/myc-network/` and copy:
   [ecosystem_listings/defillama_chain_adapter.js](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/defillama_chain_adapter.js) to `projects/myc-network/index.js`.
3. Test locally using DefiLlama CLI:
   `node test.js projects/myc-network/index.js`
4. Submit a Pull Request titled:
   `Listing MYC Network (Chain ID 108) TVL and Staking Adapter`.

---

### 3. DePINscan (by IoTeX) Submission
DePINscan is the premier tracking dashboard for physical nodes and hardware networks:
1. Go to [https://depinscan.io/contact](https://depinscan.io/contact) or join the IoTeX DePIN discord.
2. Select **"List my DePIN project"**.
3. Upload and copy the values from:
   [ecosystem_listings/depinscan_iotex_application.json](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/depinscan_iotex_application.json).
4. Highlight the **10,000 Silicon PUF DIDs** and **Proof-of-Quantum-Resonance (PoQR) mesh consensus**.

---

### 4. DePIN Hub Submission
1. Navigate to [https://depinhub.io/submit](https://depinhub.io/submit).
2. Fill the project form using the pre-formatted answers in:
   [ecosystem_listings/depinhub_listing_dossier.md](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/depinhub_listing_dossier.md).
3. Confirm Node License Tiers (Spore $299, Hyphae $449, Highway $699, Fruiting Body $1,099).

---

### 5. CoinMarketCap (CMC) Listing
1. Navigate to [CoinMarketCap Request Form](https://support.coinmarketcap.com/hc/en-us/requests/new).
2. Choose **"Listing Application -> Cryptoasset / Blockchain"**.
3. Copy-paste all fields from:
   [ecosystem_listings/coinmarketcap_application_dossier.md](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/coinmarketcap_application_dossier.md).
4. Verify using official Twitter `@myc_ai`.

---

### 6. CoinGecko (CG) Listing
1. Navigate to [CoinGecko Token Request Form](https://www.coingecko.com/en/request).
2. Select **"Add New Token / Chain"**.
3. Copy-paste answers from:
   [ecosystem_listings/coingecko_application_dossier.md](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/coingecko_application_dossier.md).
4. Attach circulating supply verification API endpoints.

---

### 7. RootData & CryptoRank Submissions
1. Visit [https://www.rootdata.com/feedback](https://www.rootdata.com/feedback) -> "Submit a Project".
2. Visit [https://cryptorank.io/contact-us](https://cryptorank.io/contact-us) -> "List Project / Token".
3. Use data from:
   [ecosystem_listings/rootdata_cryptorank_dossier.md](file:///Users/bl10buer/Desktop/myc-network/ecosystem_listings/rootdata_cryptorank_dossier.md).

---

## 🎯 SUMMARY OF VERIFIED METRICS FOR APPLICATIONS
* **Total Max Supply**: `100,000,000 MYC`
* **Circulating Supply**: `25,000,000 MYC`
* **Node Hardcap**: `10,000 Nodes ($6,965,000 USDC)`
* **Daily PoQR Emission**: `100,000.000000 MYC`
* **Chain ID**: `108` (Zero-Gas Invariant)
* **Tested TPS**: `15,147+ Effective TPS` (`20,449+ Peak Burst TPS`, `318+ Mgas/s`)
* **Finality**: `9.79 ms` (Hardware Safety Brake: `4.95 µs`)
