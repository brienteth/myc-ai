#!/usr/bin/env bash
set -e

echo "===================================================================="
echo "🚀 EXECUTING ALL 5 MYCA NETWORK SHOWCASE PROJECTS"
echo "===================================================================="

echo -e "\n📌 [1/5] Running Project 1: Autonomous Colony AI Agent..."
node 01-ai-agent-colony/test_agent.js

echo -e "\n📌 [2/5] Running Project 2: DePIN Industrial Hardware Monitor..."
node 02-depin-hardware-monitor/test_monitor.js

echo -e "\n📌 [3/5] Running Project 3: Custom DeFi Smart Contract Vault..."
node 03-custom-defi-contract/deploy_and_interact.js

echo -e "\n📌 [4/5] Running Project 4: Frontend Web3 dApp Portal..."
node 04-web3-dapp-portal/test_dapp.js

echo -e "\n📌 [5/5] Running Project 5: Sub-ms StreamPay LLM Paywall..."
node 05-streampay-paywall/test_paywall.js

echo -e "\n===================================================================="
echo "🎉 ALL 5 SHOWCASE PROJECTS VERIFIED WITH 100% SUCCESS ON CHAIN ID 108!"
echo "===================================================================="
