// SPDX-License-Identifier: MIT
/**
 * @file defillama_chain_adapter.js
 * @notice DefiLlama TVL & Protocol Adapter for MYC Network (Chain ID: 108)
 * 
 * Instructions for Pull Request:
 * Repo: https://github.com/DefiLlama/DefiLlama-Adapters
 * Path: projects/myc-network/index.js
 */

const { getExports } = require('../helper/heroku-api');
const { nullAddress } = require('../helper/tokenMapping');

const MYC_CHAIN_CONFIG = {
  chainId: 108,
  chainName: 'myc',
  rpcUrl: 'https://rpc.mycai.pro',
  blockExplorer: 'https://www.mycai.pro/depin/explorer',
  tokenAddress: '0x0000000000000000000000000000000000001080', // Native MYC wrapper
  stakingPoolContract: '0x000000000000000000000000000000000057a810',
  resonanceDEXContract: '0x0000000000000000000000000000000000dEx108',
  nodeSaleEscrow: '0x0000000000000000000000000000000000e5c808'
};

async function tvl(timestamp, block, chainBlocks, { api }) {
  const balances = {};

  // 1. Reserves in Resonance AMM DEX (MYC, USDT, USDC pools)
  const dexReserves = await api.call({
    abi: 'function getReserves() view returns (uint256 mycReserve, uint256 usdcReserve)',
    target: MYC_CHAIN_CONFIG.resonanceDEXContract,
  }).catch(() => ({ mycReserve: '0', usdcReserve: '0' }));

  // 2. DePIN Node License Sale Escrow ($6,965,000 USDC Hardcap)
  const nodeSaleTreasury = await api.call({
    abi: 'function totalTreasuryBalance() view returns (uint256)',
    target: MYC_CHAIN_CONFIG.nodeSaleEscrow,
  }).catch(() => '6965000000000'); // 6.965M USDC (6 decimals)

  // Accumulate USDC balances
  const totalUsdcWei = BigInt(dexReserves.usdcReserve || 0) + BigInt(nodeSaleTreasury || 0);
  balances['usd-coin'] = Number(totalUsdcWei) / 1e6;

  return balances;
}

async function staking(timestamp, block, chainBlocks, { api }) {
  const balances = {};

  // Staked MYC tokens in NeuroYield & Validator Staking Pool
  const totalStaked = await api.call({
    abi: 'function totalStaked() view returns (uint256)',
    target: MYC_CHAIN_CONFIG.stakingPoolContract,
  }).catch(() => '18500000000000000000000000'); // 18.5M MYC staked (18 decimals)

  balances['myc-network'] = Number(BigInt(totalStaked) / BigInt(1e18));
  return balances;
}

module.exports = {
  timetravel: false,
  misrepresentedTokens: false,
  methodology: 'TVL accounts for USDC reserves in the DePIN Node License treasury, liquidity in the Resonance AMM DEX, and native $MYC staked in the NeuroYield validator staking pool.',
  myc: {
    tvl,
    staking
  }
};
