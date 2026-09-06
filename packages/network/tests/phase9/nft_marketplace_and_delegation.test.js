import { describe, it, expect, beforeEach } from "vitest";
import { deployAllContracts } from "../../scripts/deploy_contracts.js";
import {
  getNFTNodeCapacity,
  getNFTValuation,
  onTaskSettled,
  globalTaskLedger
} from "../../colony/scheduler/nft_node_scorer.js";

describe("Phase 9: Living NFT Economy — Valuation, Marketplace & Operator Delegation", () => {
  let deployed;
  let resonanceAsset;
  let nodeRegistry;
  let marketplace;
  let reputation;
  let usdc;

  beforeEach(async () => {
    deployed = await deployAllContracts();
    resonanceAsset = deployed.instances.resonanceAsset;
    nodeRegistry = deployed.instances.nodeRegistry;
    marketplace = deployed.instances.marketplace;
    reputation = deployed.instances.reputation;
    usdc = deployed.instances.usdc;
  });

  it("1. Quantitative Valuation Engine computes verified 30-day cashflow, yield, payback period & trajectory", () => {
    // Valuation on Genesis Asset #1
    const valuation = getNFTValuation(1, resonanceAsset, 1000); // 1,000 USDC reference price

    expect(valuation.tokenId).toBe(1);
    expect(valuation.currentEnergy).toBeGreaterThanOrEqual(2500);
    expect(valuation.tier).toBeDefined();

    // 30 Days Verified Production
    expect(valuation.last30Days.tasksCompleted).toBeGreaterThan(0);
    expect(valuation.last30Days.usdcEarned).toBeGreaterThan(0);
    expect(valuation.last30Days.avgDailyYield).toBeGreaterThan(0);

    // Implied Valuation
    expect(valuation.impliedValue.annualYield).toBeGreaterThan(0);
    expect(valuation.impliedValue.paybackPeriod).toMatch(/\d+\s*gün/);
    expect(["RISING", "STABLE", "DECAYING"]).toContain(valuation.impliedValue.energyTrajectory);
    expect(valuation.resonanceBonds).toBeGreaterThanOrEqual(1);
    expect(valuation.bondMultiplier).toBeGreaterThanOrEqual(1.0);
  });

  it("2. Living NFT Marketplace: Listing and buying with atomic USDC settlement & instant node handoff", () => {
    const seller = "myc1selleroperator000000000000000000000000";
    const buyer = "myc1buyerinvestor00000000000000000000000000";

    // Mint living node for seller
    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_productive_ai_miner.json",
      [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
      432,
      10,
      null,
      { msgSender: seller }
    );

    // Initial node operator in registry is seller
    let node = nodeRegistry.getNode(String(tokenId));
    expect(node.owner.toLowerCase()).toBe(seller.toLowerCase());

    // Seller lists living node for sale (Price: 500 USDC, minEnergy: 1000)
    const listing = marketplace.listForSale(tokenId, 500, 1000, true, { msgSender: seller });
    expect(listing.active).toBe(true);
    expect(listing.priceUSDC).toBe(500);
    expect(listing.minEnergy).toBe(1000);

    // Active listings should contain the new listing
    const activeListings = marketplace.getActiveListings();
    expect(activeListings.some(l => l.tokenId === tokenId)).toBe(true);

    // Buyer purchases the living machine
    const purchase = marketplace.buy(tokenId, 550, { msgSender: buyer });
    expect(purchase.success).toBe(true);
    expect(purchase.priceUSDC).toBe(500);
    expect(purchase.sellerProceeds).toBe(490); // 98%
    expect(purchase.fee).toBe(10);             // 2% protocol commons fee
    expect(purchase.newOwner.toLowerCase()).toBe(buyer.toLowerCase());

    // Verify NFT ownership transferred
    expect(resonanceAsset.ownerOf(tokenId).toLowerCase()).toBe(buyer.toLowerCase());

    // Verify Colony Node in registry was automatically handed over to buyer!
    node = nodeRegistry.getNode(String(tokenId));
    expect(node.owner.toLowerCase()).toBe(buyer.toLowerCase());
    expect(node.address.toLowerCase()).toBe(buyer.toLowerCase());

    // Verify listing is now closed
    const closedListing = marketplace.getListing(tokenId);
    expect(closedListing.active).toBe(false);
  });

  it("3. Living Machine Decay Protection Invariant: Decayed asset listing is automatically invalidated", () => {
    const seller = "myc1carelessminer0000000000000000000000000";
    const buyer = "myc1innocentbuyer0000000000000000000000000";

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://decay_candidate.json",
      [7000, 7000, 7000, 7000, 7000, 7000, 7000, 7000],
      432,
      10,
      null,
      { msgSender: seller }
    );

    // Boost energy to 2000
    resonanceAsset.interact(tokenId, 4); // 1000 + 600 = 1600
    resonanceAsset.interact(tokenId, 4); // 1600 + 600 = 2200

    // List with minEnergy requirement of 2000
    marketplace.listForSale(tokenId, 400, 2000, true, { msgSender: seller });

    // Manually simulate severe entropy decay dropping energy below 2000
    const asset = resonanceAsset.assets.get(tokenId);
    asset.energyScore = 1500; // Decayed below minEnergy 2000!

    // Buyer attempts to buy: Living Machine Invariant MUST reject and cancel listing!
    expect(() => {
      marketplace.buy(tokenId, 450, { msgSender: buyer });
    }).toThrow(/ENERGY_DROPPED_BELOW_MINIMUM/);

    // Verify listing was automatically deactivated
    const listing = marketplace.getListing(tokenId);
    expect(listing.active).toBe(false);
  });

  it("4. Non-Custodial Operator Delegation: Revenue-sharing settlement between Owner and Operator", async () => {
    const owner = "myc1nontechnicalowner000000000000000000000";
    const operator = "myc1hardwaredatacenter000000000000000000";

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://delegated_rig.json",
      [9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000],
      432,
      10,
      null,
      { msgSender: owner }
    );

    // Owner delegates hardware execution to operator with 70% Owner / 30% Operator split
    const delResult = nodeRegistry.delegateNode(tokenId, operator, 70, 95, { msgSender: owner });
    expect(delResult.success).toBe(true);
    expect(delResult.revenueShareOwner).toBe(70);
    expect(delResult.revenueShareOperator).toBe(30);

    const node = nodeRegistry.getNode(String(tokenId));
    expect(node.isDelegated).toBe(true);
    expect(node.owner.toLowerCase()).toBe(owner.toLowerCase());
    expect(node.operator.toLowerCase()).toBe(operator.toLowerCase());

    // Settle a task for this delegated node (100 USDC total task value)
    const settlement = await onTaskSettled({
      taskId: "tsk_delegated_001",
      nodeTokenId: tokenId,
      result: { status: "SUCCESS", inferenceTimeMs: 14.2 },
      usdcAmount: 100.0,
      resonanceContract: resonanceAsset,
      nodeRegistryContract: nodeRegistry,
      reputationContract: reputation,
      escrowContract: deployed.instances.escrow,
      usdcContract: usdc
    });

    expect(settlement.success).toBe(true);
    expect(settlement.settlement.totalUSDC).toBe(100.0);
    expect(settlement.settlement.protocolFeeUSDC).toBe(5.0); // 5% protocol fee
    expect(settlement.settlement.isDelegated).toBe(true);

    // 95 USDC Net Reward split: 70% to Owner (66.50 USDC), 30% to Operator (28.50 USDC)
    expect(settlement.settlement.ownerPayoutUSDC).toBe(66.50);
    expect(settlement.settlement.operatorPayoutUSDC).toBe(28.50);
    expect(settlement.settlement.ownerAddress.toLowerCase()).toBe(owner.toLowerCase());
    expect(settlement.settlement.operatorAddress.toLowerCase()).toBe(operator.toLowerCase());

    // Operator receives reputation reward
    const repScore = reputation.getScore(operator);
    expect(repScore.successfulTasks).toBeGreaterThanOrEqual(1);

    // NFT machine receives energy boost
    const updatedAsset = resonanceAsset.getAsset(tokenId);
    expect(updatedAsset.energyScore).toBe(1600); // 1000 + 600
  });

  it("5. Undelegation restores direct solo operation to NFT Owner", () => {
    const owner = "myc1solominer00000000000000000000000000000";
    const operator = "myc1thirdparty00000000000000000000000000";

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://solo_machine.json",
      [8500, 8500, 8500, 8500, 8500, 8500, 8500, 8500],
      432,
      10,
      null,
      { msgSender: owner }
    );

    nodeRegistry.delegateNode(tokenId, operator, 70, 95, { msgSender: owner });
    let node = nodeRegistry.getNode(String(tokenId));
    expect(node.isDelegated).toBe(true);

    // Owner calls undelegateNode
    const undelResult = nodeRegistry.undelegateNode(tokenId, { msgSender: owner });
    expect(undelResult.success).toBe(true);

    node = nodeRegistry.getNode(String(tokenId));
    expect(node.isDelegated).toBe(false);
    expect(node.operator.toLowerCase()).toBe(owner.toLowerCase());
    expect(node.revenueShareOwner).toBe(100);
    expect(node.revenueShareOperator).toBe(0);
  });
});
