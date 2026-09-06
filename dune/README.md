# 📊 DUNE ANALYTICS INTEGRATION: MYCA NETWORK ($MYC)

This directory contains the official **Dune Analytics** queries, decoded contract schemas, and Spellbook models for **MYCA Network**.

---

## 🚀 Live Dashboard & Official Query on Dune.com
* **Official Live Query URL**: [https://dune.com/queries/8625163](https://dune.com/queries/8625163)
* **Query Title**: `Mycai Network`
* **Query ID**: `8625163`
* **Author**: `@blambuer`
* **Direct REST API Endpoint**: `https://api.dune.com/api/v1/query/8625163/results`
* **CSV Export Endpoint**: `https://api.dune.com/api/v1/query/8625163/results/csv`

### API Integration Usage:
```bash
# JSON Output (Requires Dune API Key from https://dune.com/settings/api)
curl -H "x-dune-api-key: $DUNE_API_KEY" "https://api.dune.com/api/v1/query/8625163/results?limit=1000"

# CSV Output
curl -H "x-dune-api-key: $DUNE_API_KEY" "https://api.dune.com/api/v1/query/8625163/results/csv?limit=1000"
```

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
