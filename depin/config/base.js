// SPDX-License-Identifier: MIT
/**
 * @file base.js
 * @notice Centralized Smart Contract & Network Configuration for Base L2
 */

export const BASE_CONFIG = {
  mainnet: {
    chainId: 8453,
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    contracts: {
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ethUsdFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
      nodeLicense: "0x3e17A3805B73d74548074d2A28A1aD331d27A6a8",
      nodeSale: "0x8B3215286AfC44B1f96434440c41031b26284B91",
      nodeRegistry: "0x7F22A04b9319D81fF9c43D227e8E0a57B96E37cA",
      rewardDistributor: "0x2C465F559403d1B1209b5526d56A15E86D805904",
      watcherRegistry: "0x1b2853D307F50A0B3C9B6A1A7B1C9B7A6E4F8B3C",
      eligibilityRegistry: "0x6A1B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B"
    }
  },
  sepolia: {
    chainId: 84532,
    chainName: "Base Sepolia Testnet",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    contracts: {
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      ethUsdFeed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
      nodeLicense: "0x3e17A3805B73d74548074d2A28A1aD331d27A6a8",
      nodeSale: "0x8B3215286AfC44B1f96434440c41031b26284B91",
      nodeRegistry: "0x7F22A04b9319D81fF9c43D227e8E0a57B96E37cA",
      rewardDistributor: "0x2C465F559403d1B1209b5526d56A15E86D805904",
      watcherRegistry: "0x1b2853D307F50A0B3C9B6A1A7B1C9B7A6E4F8B3C",
      eligibilityRegistry: "0x6A1B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B"
    }
  },
  tiers: {
    1: { name: "Tier 1 — Spore", priceUSD: 299, supplyCap: 1000, multiplier: 1.0, role: "Edge Sensor & IoT Pulse" },
    2: { name: "Tier 2 — Hyphae", priceUSD: 449, supplyCap: 2500, multiplier: 1.3, role: "Local Mesh Relay" },
    3: { name: "Tier 3 — Mycelial", priceUSD: 699, supplyCap: 4000, multiplier: 1.8, role: "Regional Cluster Master" },
    4: { name: "Tier 4 — Fruiting Body", priceUSD: 1099, supplyCap: 2500, multiplier: 2.5, role: "Global Phase Synchronizer" }
  },
  economics: {
    maxDailyEmission: 100000,
    compoundMultiplier: 1.25,
    globalHardcap: 10000,
    referralBps: 500 // 5%
  }
};
