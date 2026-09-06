#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Opens all ecosystem listing portals in your default macOS browser

echo "===================================================================="
echo "🌐 OPENING ALL ECOSYSTEM LISTING PORTALS IN BROWSER..."
echo "===================================================================="

echo "1. Opening Chainlist (GitHub PR)..."
open "https://github.com/ethereum-lists/chains/new/master?filename=_data/chains/eip155-108.json"

echo "2. Opening DefiLlama (GitHub PR)..."
open "https://github.com/DefiLlama/DefiLlama-Adapters"

echo "3. Opening DePINscan (IoTeX)..."
open "https://depinscan.io/contact"

echo "4. Opening DePIN Hub..."
open "https://depinhub.io/submit"

echo "5. Opening CoinMarketCap Listing Form..."
open "https://support.coinmarketcap.com/hc/en-us/requests/new"

echo "6. Opening CoinGecko Request Form..."
open "https://www.coingecko.com/en/request"

echo "7. Opening RootData Project Submit..."
open "https://www.rootdata.com/feedback"

echo "8. Opening CryptoRank Listing Portal..."
open "https://cryptorank.io/contact-us"

echo ""
echo "✅ All listing tabs opened! Use the ready-to-copy dossiers in 'ecosystem_listings/' directory."
