import { describe, it, expect, beforeEach } from "vitest";
import { deployAllContracts } from "../../scripts/deploy_contracts.js";
import { getNFTValuation } from "../../colony/scheduler/nft_node_scorer.js";

describe("Phase 9: Dedicated Living Machine Marketplace Suite", () => {
  let deployed;
  let resonanceAsset;
  let marketplace;
  let nodeRegistry;
  let usdc;

  beforeEach(async () => {
    deployed = await deployAllContracts();
    resonanceAsset = deployed.instances.resonanceAsset;
    marketplace = deployed.instances.marketplace;
    nodeRegistry = deployed.instances.nodeRegistry;
    usdc = deployed.instances.usdc;
  });

  it("1. Should list a Living Machine with minEnergy floor protection", () => {
    const seller = "myc1machineworker000000000000000000000000";
    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_living_compute_node.json",
      [7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500],
      432,
      10,
      null,
      { msgSender: seller }
    );

    // Charge the machine to 6,000 Energy
    resonanceAsset.assets.get(tokenId).energyScore = 6000;

    const listing = marketplace.listForSale(tokenId, 890, 2000, true, { msgSender: seller });
    expect(listing.tokenId).toBe(tokenId);
    expect(listing.priceUSDC).toBe(890);
    expect(listing.minEnergy).toBe(2000);
    expect(listing.active).toBe(true);

    const retrieved = marketplace.getListing(tokenId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.active).toBe(true);
  });

  it("2. Should format listings into data-rich financial format for buyers", () => {
    const seller = "myc1machineworker000000000000000000000000";
    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_high_yield_cluster.json",
      [9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000],
      528,
      10,
      null,
      { msgSender: seller }
    );

    // Charge the machine to 7,500 Energy
    resonanceAsset.assets.get(tokenId).energyScore = 7500;

    marketplace.listForSale(tokenId, 1200, 2500, true, { msgSender: seller });

    const rawListings = marketplace.getActiveListings();
    const formatted = rawListings.map(l => {
      const val = getNFTValuation(l.tokenId, resonanceAsset, l.priceUSDC);
      const paybackMatch = val.impliedValue && val.impliedValue.paybackPeriod ? parseInt(val.impliedValue.paybackPeriod) : 0;
      return {
        tokenId: l.tokenId,
        seller: l.seller,
        price: l.priceUSDC,
        currency: "USDC",
        minEnergy: l.minEnergy,
        dailyYield: val.last30Days.avgDailyYield,
        energy: val.currentEnergy,
        tier: val.tier,
        bonds: val.resonanceBonds,
        bondMultiplier: val.bondMultiplier,
        tasks30d: val.last30Days.tasksCompleted,
        paybackDays: isNaN(paybackMatch) ? 0 : paybackMatch,
        energyTrajectory: val.impliedValue.energyTrajectory,
        annualYield: val.impliedValue.annualYield
      };
    });

    expect(formatted.length).toBeGreaterThanOrEqual(1);
    const item = formatted.find(f => f.tokenId === tokenId);
    expect(item).toBeDefined();
    expect(item.currency).toBe("USDC");
    expect(item.price).toBe(1200);
    expect(item.dailyYield).toBeGreaterThan(0);
    expect(item.energy).toBe(7500);
    expect(item.tasks30d).toBeGreaterThan(0);
    expect(item.paybackDays).toBeGreaterThan(0);
    expect(["RISING", "STABLE", "DECAYING"]).toContain(item.energyTrajectory);
  });

  it("3. Should delist active listing only when requested by authorized seller", () => {
    const seller = "myc1machineworker000000000000000000000000";
    const intruder = "myc1intruder0000000000000000000000000000";
    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_temp_node.json",
      [6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000],
      432,
      10,
      null,
      { msgSender: seller }
    );

    marketplace.listForSale(tokenId, 500, 1000, true, { msgSender: seller });

    // Intruder cannot delist
    expect(() => {
      marketplace.delist(tokenId, { msgSender: intruder });
    }).toThrow("ONLY_SELLER_CAN_CANCEL");

    // Seller can delist
    const ok = marketplace.delist(tokenId, { msgSender: seller });
    expect(ok).toBe(true);

    const listing = marketplace.getListing(tokenId);
    expect(listing.active).toBe(false);
  });

  it("4. Should execute atomic purchase with 2% protocol fee and transfer Colony Node to buyer", () => {
    const seller = "myc1selleroperator000000000000000000000000";
    const buyer = "myc1buyerinvestor00000000000000000000000000";

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_turnkey_rig.json",
      [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
      432,
      10,
      null,
      { msgSender: seller }
    );

    // Charge the machine to 4,000 Energy
    resonanceAsset.assets.get(tokenId).energyScore = 4000;

    marketplace.listForSale(tokenId, 1000, 2000, true, { msgSender: seller });

    const buyResult = marketplace.buy(tokenId, 1000, { msgSender: buyer });
    expect(buyResult.success).toBe(true);
    expect(buyResult.buyer).toBe(buyer);
    expect(buyResult.priceUSDC).toBe(1000);
    expect(buyResult.sellerProceeds).toBe(980); // 98%
    expect(buyResult.fee).toBe(20); // 2%

    // Asset ownership in resonanceAsset
    const updatedAsset = resonanceAsset.getAsset(tokenId);
    expect(updatedAsset.creator.toLowerCase()).toBe(buyer.toLowerCase());

    // Colony node ownership in nodeRegistry
    const updatedNode = nodeRegistry.getNode(String(tokenId));
    expect(updatedNode.owner.toLowerCase()).toBe(buyer.toLowerCase());
    expect(updatedNode.operator.toLowerCase()).toBe(buyer.toLowerCase());
  });

  it("5. Should automatically abort buy and delist if asset energy decayed below minEnergy", () => {
    const seller = "myc1decayedvendor000000000000000000000000";
    const buyer = "myc1unsuspectingbuyer00000000000000000000";

    const tokenId = resonanceAsset.mintResonanceAsset(
      "ipfs://bafkreia_decayed_node.json",
      [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
      432,
      10,
      null,
      { msgSender: seller }
    );

    // Charge initial energy to 5,000 then list with minEnergy 3,500
    resonanceAsset.assets.get(tokenId).energyScore = 5000;
    marketplace.listForSale(tokenId, 600, 3500, true, { msgSender: seller });

    // Simulate severe decay down to 2,000 (below 3,500)
    resonanceAsset.assets.get(tokenId).energyScore = 2000;

    // Buyer attempts purchase -> must abort
    expect(() => {
      marketplace.buy(tokenId, 600, { msgSender: buyer });
    }).toThrow(/ENERGY_DROPPED_BELOW_MINIMUM/);

    // Listing must now be inactive
    const listing = marketplace.getListing(tokenId);
    expect(listing.active).toBe(false);
  });
});
