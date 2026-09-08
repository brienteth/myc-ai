import { describe, it, expect, beforeEach } from "vitest";
import { deployAllContracts } from "../../scripts/deploy_contracts.js";
import { getNFTNodeCapacity, onTaskSettled, scheduleResonantTask, TIER_LIMITS } from "../../colony/scheduler/nft_node_scorer.js";

describe("Phase 9: NFT = Colony Node Architecture (Ownership is Participation)", () => {
  let deployed;
  let resonanceAsset;
  let nodeRegistry;
  let reputation;
  let usdc;

  beforeEach(async () => {
    deployed = await deployAllContracts();
    resonanceAsset = deployed.instances.resonanceAsset;
    nodeRegistry = deployed.instances.nodeRegistry;
    reputation = deployed.instances.reputation;
    usdc = deployed.instances.usdc;
  });

  it("1. NFT Minting automatically registers Colony Node (nodeId = tokenId, tier = SEED)", () => {
    const creator = "myc1useralice000000000000000000000000000000";
    const harmonics = [6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500];

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_alice_resonant_node.json",
      harmonics,
      528,
      10,
      null,
      { msgSender: creator }
    );

    expect(tokenId).toBeGreaterThanOrEqual(2);

    // Verify Colony Node Registration
    const node = nodeRegistry.getNode(String(tokenId));
    expect(node).not.toBeNull();
    expect(node.nodeId).toBe(String(tokenId));
    expect(node.owner.toLowerCase()).toBe(creator.toLowerCase());
    expect(node.role).toBe("COLONY_PEER");
    expect(node.tier).toBe("SEED");
    expect(node.energyScore).toBe(1000);

    // Verify Capacity
    const capacity = getNFTNodeCapacity(tokenId, resonanceAsset);
    expect(capacity.tier).toBe("SEED");
    expect(capacity.maxConcurrentTasks).toBe(TIER_LIMITS.SEED.tasks); // 1
    expect(capacity.capabilityTypes).toContain("LIGHT_TELEMETRY");
    expect(capacity.priorityScore).toBe(0.1);
  });

  it("2. Energy accumulation escalates Node Tier (SEED -> RESONANT -> SOVEREIGN)", () => {
    const creator = "myc1userbob0000000000000000000000000000000";
    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_bob_machine.json",
      [7000, 7000, 7000, 7000, 7000, 7000, 7000, 7000],
      432,
      10,
      null,
      { msgSender: creator }
    );

    // Initial SEED tier
    let cap = getNFTNodeCapacity(tokenId, resonanceAsset);
    expect(cap.tier).toBe("SEED");
    expect(cap.maxConcurrentTasks).toBe(1);

    // Interact to gain energy: 1000 + 4 * 600 = 3400 -> Promotes to RESONANT
    resonanceAsset.interact(tokenId, 4); // +600
    resonanceAsset.interact(tokenId, 4); // +600
    resonanceAsset.interact(tokenId, 4); // +600
    resonanceAsset.interact(tokenId, 4); // +600

    cap = getNFTNodeCapacity(tokenId, resonanceAsset);
    expect(cap.energyScore).toBe(3400);
    expect(cap.tier).toBe("RESONANT");
    expect(cap.maxConcurrentTasks).toBe(5);
    expect(cap.capabilityTypes).toContain("AI_INFERENCE");

    const node = nodeRegistry.getNode(String(tokenId));
    expect(node.tier).toBe("RESONANT");
    expect(node.energyScore).toBe(3400);

    // Accumulate to 8000+ -> Promotes to SOVEREIGN
    for (let i = 0; i < 8; i++) {
      resonanceAsset.interact(tokenId, 4); // 8 * 600 = +4800 -> 8200
    }

    cap = getNFTNodeCapacity(tokenId, resonanceAsset);
    expect(cap.energyScore).toBe(8200);
    expect(cap.tier).toBe("SOVEREIGN");
    expect(cap.maxConcurrentTasks).toBe(20);
    expect(cap.capabilityTypes).toContain("POR_VALIDATION");
    expect(cap.capabilityTypes).toContain("ESCROW_SETTLEMENT");
  });

  it("3. Colony Task Settlement executes 3-way atomic reward (USDC 95/5, Energy +600, Reputation +10)", async () => {
    const owner = "myc1usercharlie0000000000000000000000000000";
    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_charlie_node.json",
      [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
      432,
      10,
      null,
      { msgSender: owner }
    );

    const initialEnergy = resonanceAsset.getAsset(tokenId).energyScore;
    expect(initialEnergy).toBe(1000);

    const settlement = await onTaskSettled({
      taskId: "task_test_001",
      nodeTokenId: tokenId,
      result: { output: "Inference completed in 18ms" },
      usdcAmount: 20.0,
      resonanceContract: resonanceAsset,
      nodeRegistryContract: nodeRegistry,
      reputationContract: reputation,
      escrowContract: deployed.instances.escrow,
      usdcContract: usdc
    });

    expect(settlement.success).toBe(true);
    expect(settlement.settlement.totalUSDC).toBe(20.0);
    expect(settlement.settlement.ownerPayoutUSDC).toBe(19.0); // 95%
    expect(settlement.settlement.protocolFeeUSDC).toBe(1.0);  // 5%
    expect(settlement.settlement.ownerAddress.toLowerCase()).toBe(owner.toLowerCase());

    // Check Energy Score Increase
    const updatedAsset = resonanceAsset.getAsset(tokenId);
    expect(updatedAsset.energyScore).toBe(1600); // 1000 + 600

    // Check Reputation
    const repScore = reputation.getScore(owner);
    expect(repScore.successfulTasks).toBe(1);
    expect(repScore.score).toBeGreaterThanOrEqual(110); // 100 base + 10
  });

  it("4. Tesla Frequency Coherence: Dual verification bonds coherent nodes and yields energy boost", async () => {
    // Mint two highly coherent nodes (identical harmonic ratios)
    const tokenA = resonanceAsset.mintResonanceAsset(
      "ipfs://node_a.json",
      [8500, 8500, 8500, 8500, 8500, 8500, 8500, 8500],
      432,
      10
    );

    const tokenB = resonanceAsset.mintResonanceAsset(
      "ipfs://node_b.json",
      [8500, 8500, 8500, 8500, 8500, 8500, 8500, 8500],
      432,
      10
    );

    // Schedule task requiring dual execution
    const task = {
      taskId: "task_dual_001",
      capabilityRequired: "LIGHT_TELEMETRY",
      payload: { sensor: "SEISMIC_01", sampleHz: 100 }
    };

    const scheduled = await scheduleResonantTask({
      task,
      candidateNodeIds: [tokenA, tokenB],
      resonanceContract: resonanceAsset,
      nodeRegistryContract: nodeRegistry
    });

    expect(scheduled.success).toBe(true);
    expect(scheduled.primaryNodeId).toBe(tokenA);
    expect(scheduled.resonantPartnerId).toBe(tokenB);
    expect(scheduled.resonanceBondFormed).toBe(true);
    expect(scheduled.harmonicSimilarityBasisPoints).toBe(10000); // 1.0000 cosine similarity
    expect(scheduled.resonantEnergyBoost).toBeGreaterThan(0);

    // Both nodes should have received energy boost
    const assetA = resonanceAsset.getAsset(tokenA);
    const assetB = resonanceAsset.getAsset(tokenB);
    expect(assetA.energyScore).toBeGreaterThan(1000);
    expect(assetB.energyScore).toBeGreaterThan(1000);
    expect(assetA.bonds).toContain(tokenB);
    expect(assetB.bonds).toContain(tokenA);
  });

  it("5. NFT Transfer synchronizes Colony Node ownership in NodeRegistry", () => {
    const originalOwner = "myc1originalowner0000000000000000000000000";
    const buyer = "myc1buyerinvestor00000000000000000000000000";

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://productive_asset.json",
      [9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000],
      432,
      10,
      null,
      { msgSender: originalOwner }
    );

    let node = nodeRegistry.getNode(String(tokenId));
    expect(node.owner.toLowerCase()).toBe(originalOwner.toLowerCase());

    // Transfer NFT to buyer
    resonanceAsset.transfer(tokenId, buyer, { msgSender: originalOwner });

    // Verify NFT owner updated
    expect(resonanceAsset.ownerOf(tokenId).toLowerCase()).toBe(buyer.toLowerCase());

    // Verify Colony Node Registry synchronized
    node = nodeRegistry.getNode(String(tokenId));
    expect(node.owner.toLowerCase()).toBe(buyer.toLowerCase());
    expect(node.address.toLowerCase()).toBe(buyer.toLowerCase());
  });
});
