import fs from "fs";
import path from "path";
import { MycContractVM } from "../ledger/vm/contract_vm.js";
import { MycBlockchain } from "../ledger/blockchain/blockchain.js";
import {
  MycTokenContract,
  MycUSDTokenContract,
  MycUSDCTokenContract,
  MycDeviceRegistryContract,
  MycStakingPoolContract,
  MycDEXContract,
  MycResonanceDEXContract,
  MycEscrowContract,
  MycActuatorGuardContract,
  MycAgentRegistryContract,
  MycTaskRegistryContract,
  MycExecutionProofContract,
  MycPolicyRegistryContract,
  MycNodeRegistryContract,
  MycReputationContract,
  MycStreamPayContract,
  MycOpacusPayContract,
  MycBridgeContract,
  MycResonanceAssetContract,
  MycResonanceMarketplaceContract
} from "../ledger/contracts/index.js";

/**
 * MYCA Automated Smart Contract Deployment Pipeline
 * Deploys Core & Agent Economy Contracts on Chain ID 108
 */
export async function deployAllContracts(blockchain = null) {
  const chain = blockchain || new MycBlockchain({ inMemory: true });
  const vm = new MycContractVM(chain.state);
  chain.attachVM(vm);

  const genesisDeployer = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";

  console.log("🚀 DEPLOYING MYCA CORE SMART CONTRACTS ON CHAIN ID 108...");

  // 1. MycToken ($MYC)
  const tokenInstance = new MycTokenContract(100000000);
  const tokenDep = vm.deployContract({
    name: "MycToken",
    instance: tokenInstance,
    creator: genesisDeployer,
    abi: ["function balanceOf(address)", "function transfer(address,uint256)"]
  });

  // 1b. MycUSDToken (Testnet $USDT)
  const usdtInstance = new MycUSDTokenContract(10000000);
  const usdtDep = vm.deployContract({
    name: "MycUSDToken",
    instance: usdtInstance,
    creator: genesisDeployer,
    abi: ["function balanceOf(address)", "function transfer(address,uint256)", "function mint(address,uint256)"]
  });

  // 1c. MycUSDCToken (Testnet $USDC)
  const usdcInstance = new MycUSDCTokenContract(10000000);
  const usdcDep = vm.deployContract({
    name: "MycUSDCToken",
    instance: usdcInstance,
    creator: genesisDeployer,
    abi: ["function balanceOf(address)", "function transfer(address,uint256)", "function mint(address,uint256)"]
  });

  // 2. MycDeviceRegistry
  const deviceInstance = new MycDeviceRegistryContract();
  const deviceDep = vm.deployContract({
    name: "MycDeviceRegistry",
    instance: deviceInstance,
    creator: genesisDeployer,
    abi: ["function registerDevice(string,bytes32,uint8,uint16,uint16)", "function recordHeartbeat(string,uint16)"]
  });

  // 3. MycStakingPool
  const stakingInstance = new MycStakingPoolContract();
  const stakingDep = vm.deployContract({
    name: "MycStakingPool",
    instance: stakingInstance,
    creator: genesisDeployer,
    abi: ["function stake(uint256)", "function unstake(uint256)", "function getStakeInfo(address)"]
  });

  // 4. MycDEX (MYC Native AMM DEX)
  const dexInstance = new MycDEXContract(250000, 50000);
  const dexDep = vm.deployContract({
    name: "MycDEX",
    instance: dexInstance,
    creator: genesisDeployer,
    abi: ["function swap(string,string,uint256)"]
  });

  // 5. MycEscrow
  const escrowInstance = new MycEscrowContract();
  const escrowDep = vm.deployContract({
    name: "MycEscrow",
    instance: escrowInstance,
    creator: genesisDeployer,
    abi: ["function createEscrow", "function fundEscrow", "function submitExecutionProof", "function attestAndRelease"]
  });

  // 6. MycActuatorGuard
  const guardInstance = new MycActuatorGuardContract();
  const guardDep = vm.deployContract({
    name: "MycActuatorGuard",
    instance: guardInstance,
    creator: genesisDeployer,
    abi: ["function authorizeActuation"]
  });

  // 7. MycAgentRegistry
  const agentRegInstance = new MycAgentRegistryContract();
  const agentRegDep = vm.deployContract({
    name: "MycAgentRegistry",
    instance: agentRegInstance,
    creator: genesisDeployer,
    abi: ["function registerAgent", "function getAgent"]
  });

  // 8. MycTaskRegistry
  const taskRegInstance = new MycTaskRegistryContract();
  const taskRegDep = vm.deployContract({
    name: "MycTaskRegistry",
    instance: taskRegInstance,
    creator: genesisDeployer,
    abi: ["function registerTask", "function assignTask", "function completeTask"]
  });

  // 9. MycExecutionProof
  const proofInstance = new MycExecutionProofContract();
  const proofDep = vm.deployContract({
    name: "MycExecutionProof",
    instance: proofInstance,
    creator: genesisDeployer,
    abi: ["function submitProof"]
  });

  // 10. MycPolicyRegistry
  const policyRegInstance = new MycPolicyRegistryContract();
  const policyRegDep = vm.deployContract({
    name: "MycPolicyRegistry",
    instance: policyRegInstance,
    creator: genesisDeployer,
    abi: ["function registerPolicy"]
  });

  // 11. MycNodeRegistry
  const nodeRegInstance = new MycNodeRegistryContract();
  const nodeRegDep = vm.deployContract({
    name: "MycNodeRegistry",
    instance: nodeRegInstance,
    creator: genesisDeployer,
    abi: ["function registerNode"]
  });

  // 12. MycReputation
  const repInstance = new MycReputationContract();
  const repDep = vm.deployContract({
    name: "MycReputation",
    instance: repInstance,
    creator: genesisDeployer,
    abi: ["function recordOutcome", "function getScore"]
  });

  // 13. MycStreamPay (Continuous micro-payment streaming rail)
  const streamPayInstance = new MycStreamPayContract();
  const streamPayDep = vm.deployContract({
    name: "MycStreamPay",
    instance: streamPayInstance,
    creator: genesisDeployer,
    abi: ["function openChannel", "function settleMicroPayment", "function closeChannel", "function directPay"]
  });

  // 14. MycBridge
  const bridgeInstance = new MycBridgeContract();
  const bridgeDep = vm.deployContract({
    name: "MycBridge",
    instance: bridgeInstance,
    creator: genesisDeployer,
    abi: ["function lockAndBridge", "function releaseFromRemote", "function getBridgeStatus"]
  });

  // 16. MycResonanceAsset (ERC-721R Living Resonance Assets)
  const resonanceAssetInstance = new MycResonanceAssetContract();
  resonanceAssetInstance.attachNodeRegistry(nodeRegInstance);
  const resonanceAssetDep = vm.deployContract({
    name: "MycResonanceAsset",
    instance: resonanceAssetInstance,
    creator: genesisDeployer,
    abi: [
      "function mintSeed(address)",
      "function mintResonant(address)",
      "function mintSovereign(address)",
      "function getRemainingSupply(string)",
      "function getTierOfToken(uint256)",
      "function mintResonanceAsset(string,uint256[8],uint256,uint256,address)",
      "function interact(uint256,uint8)",
      "function bondResonance(uint256,uint256)",
      "function observe(uint256,bytes32)",
      "function getAsset(uint256)",
      "function getObservationCount(uint256)",
      "function transferShares(uint256,address,uint256)",
      "function getShares(uint256,address)",
      "function transfer(address,uint256)",
      "function transferNodeOwnership(uint256,address)",
      "function ownerOf(uint256)"
    ]
  });

  // 17. MycResonanceMarketplace (Secondary Living NFT Marketplace)
  const marketplaceInstance = new MycResonanceMarketplaceContract();
  marketplaceInstance.attachContracts(resonanceAssetInstance, usdcInstance);
  const marketplaceDep = vm.deployContract({
    name: "MycResonanceMarketplace",
    instance: marketplaceInstance,
    creator: genesisDeployer,
    abi: [
      "function listForSale(uint256,uint256,uint256,bool)",
      "function cancelListing(uint256)",
      "function buy(uint256,uint256)",
      "function getListing(uint256)",
      "function getActiveListings()"
    ]
  });

  // Pre-seed initial DePIN devices
  deviceInstance.registerDevice("TURBINE_01", "0x" + "1".repeat(64), "TURBINE", 0x0080, 0x0085, { msgSender: genesisDeployer });
  deviceInstance.registerDevice("TURBINE_02", "0x" + "2".repeat(64), "TURBINE", 0x0080, 0x0085, { msgSender: genesisDeployer });
  deviceInstance.registerDevice("VALVE_01",   "0x" + "3".repeat(64), "VALVE",   0x0010, 0x0015, { msgSender: genesisDeployer });
  deviceInstance.registerDevice("PUMP_01",    "0x" + "4".repeat(64), "PUMP",    0x0000, 0x0005, { msgSender: genesisDeployer });

  // Pre-seed initial stake (5,000 MYC -> 5 quotas)
  stakingInstance.stake(5000, { msgSender: genesisDeployer });

  const deployedManifest = {
    network: "MYC-TESTNET-SPHEROID-1",
    chainId: 108,
    deployedAt: new Date().toISOString(),
    contracts: {
      MycToken: { address: tokenDep.contractAddress, name: "MycToken" },
      MycUSDToken: { address: usdtDep.contractAddress, name: "MycUSDToken" },
      MycUSDCToken: { address: usdcDep.contractAddress, name: "MycUSDCToken" },
      MycDeviceRegistry: { address: deviceDep.contractAddress, name: "MycDeviceRegistry" },
      MycStakingPool: { address: stakingDep.contractAddress, name: "MycStakingPool" },
      MycDEX: { address: dexDep.contractAddress, name: "MycDEX" },
      MycResonanceDEX: { address: dexDep.contractAddress, name: "MycDEX" },
      MycEscrow: { address: escrowDep.contractAddress, name: "MycEscrow" },
      MycActuatorGuard: { address: guardDep.contractAddress, name: "MycActuatorGuard" },
      MycAgentRegistry: { address: agentRegDep.contractAddress, name: "MycAgentRegistry" },
      MycTaskRegistry: { address: taskRegDep.contractAddress, name: "MycTaskRegistry" },
      MycExecutionProof: { address: proofDep.contractAddress, name: "MycExecutionProof" },
      MycPolicyRegistry: { address: policyRegDep.contractAddress, name: "MycPolicyRegistry" },
      MycNodeRegistry: { address: nodeRegDep.contractAddress, name: "MycNodeRegistry" },
      MycReputation: { address: repDep.contractAddress, name: "MycReputation" },
      MycStreamPay: { address: streamPayDep.contractAddress, name: "MycStreamPay" },
      MycOpacusPay: { address: streamPayDep.contractAddress, name: "MycStreamPay" },
      MycBridge: { address: bridgeDep.contractAddress, name: "MycBridge" },
      MycResonanceAsset: { address: resonanceAssetDep.contractAddress, name: "MycResonanceAsset" },
      MycResonanceMarketplace: { address: marketplaceDep.contractAddress, name: "MycResonanceMarketplace" }
    }
  };

  try {
    fs.writeFileSync(
      path.resolve(process.cwd(), "deployed_contracts.json"),
      JSON.stringify(deployedManifest, null, 2),
      "utf-8"
    );
  } catch (e) {}

  console.log(`✅ ALL ${Object.keys(deployedManifest.contracts).length} CONTRACTS SUCCESSFULLY DEPLOYED & EXECUTABLE:`);
  for (const [k, v] of Object.entries(deployedManifest.contracts)) {
    console.log(`   • ${k.padEnd(24)}: ${v.address}`);
  }

  const seedSupply = resonanceAssetInstance.getRemainingSupply("SEED");
  const resSupply = resonanceAssetInstance.getRemainingSupply("RESONANT");
  const sovSupply = resonanceAssetInstance.getRemainingSupply("SOVEREIGN");
  console.log(`📊 RESONANCE ASSET 3-TIER SUPPLY: SEED: ${seedSupply.minted}/${seedSupply.max} | RESONANT: ${resSupply.minted}/${resSupply.max} | SOVEREIGN: ${sovSupply.minted}/${sovSupply.max}`);

  return {
    chain,
    vm,
    manifest: deployedManifest,
    instances: {
      token: tokenInstance,
      usdt: usdtInstance,
      usdc: usdcInstance,
      device: deviceInstance,
      staking: stakingInstance,
      dex: dexInstance,
      escrow: escrowInstance,
      guard: guardInstance,
      agentRegistry: agentRegInstance,
      taskRegistry: taskRegInstance,
      executionProof: proofInstance,
      policyRegistry: policyRegInstance,
      nodeRegistry: nodeRegInstance,
      reputation: repInstance,
      streamPay: streamPayInstance,
      opacusPay: streamPayInstance,
      bridge: bridgeInstance,
      resonanceAsset: resonanceAssetInstance,
      marketplace: marketplaceInstance
    }
  };
}

if (process.argv[1] && process.argv[1].endsWith("deploy_contracts.js")) {
  deployAllContracts().then(() => process.exit(0));
}
