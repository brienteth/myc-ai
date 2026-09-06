# 📊 DUNE ANALYTICS INTEGRATION: MYCA NETWORK ($MYC)

This directory contains the official **Dune Analytics** queries, decoded contract schemas, and Spellbook models for **MYCA Network**.

---

## 🚀 Live Dashboard Setup on Dune.com

1. Navigate to [Dune.com -> Create -> New Query](https://dune.com/queries).
2. Choose **Dune SQL**.
3. Copy-paste the queries from:
   [`dune/dashboards/myca_network_overview.sql`](file:///Users/bl10buer/Desktop/myc-network/dune/dashboards/myca_network_overview.sql).
4. Save query as: `MYCA Network: DePIN Node Sales, PoQR Emission & Throughput Matrix`.
5. Add to public dashboard: `https://dune.com/myca/overview`.

---

## 📜 Contract Decoding on Dune
To decode MYCA Network events directly in Dune's database:
* **Submission Portal**: [https://dune.com/contracts/new](https://dune.com/contracts/new)
* **Chain**: Base L2 / Ethereum / Custom EVM
* **Contract Address**: `0x0000000000000000000000000000000000001080`
* **Contract Name**: `MycToken` / `NodeLicenseSale`
* **ABI File**: [`contracts/base/`](file:///Users/bl10buer/Desktop/myc-network/contracts/base)

---

## 🔮 Dune Spellbook Pull Request
* **Repository**: [https://github.com/duneanalytics/spellbook](https://github.com/duneanalytics/spellbook)
* **Model**: `models/depin/myca_node_sales.sql`
* **Tags**: `depin`, `zero-gas`, `monad`, `myca`
