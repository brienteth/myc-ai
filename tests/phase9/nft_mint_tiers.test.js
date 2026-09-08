import { describe, it, expect, beforeEach } from "vitest";
import { deployAllContracts } from "../../scripts/deploy_contracts.js";
import { getNFTNodeCapacity, TIER_LIMITS } from "../../colony/scheduler/nft_node_scorer.js";

describe("Phase 9: MYCA Resonance Asset — 3-Tier Colony Node Mint Suite", () => {
  let deployed;
  let resonanceAsset;
  let nodeRegistry;
  let usdc;

  beforeEach(async () => {
    deployed = await deployAllContracts();
    resonanceAsset = deployed.instances.resonanceAsset;
    nodeRegistry = deployed.instances.nodeRegistry;
    usdc = deployed.instances.usdc;
  });

  // LAYER: Blockchain & Colony — Test 1: Seed Mint
  it("Test 1: Seed mint — 50 USDC, tokenId generation, SEED tier assignment, energy=500, Colony node registration", () => {
    const user = "myc1seeduser0000000000000000000000000000";
    const res = resonanceAsset.mintSeed(user, { msgSender: user });

    expect(res.tokenId).toBeGreaterThan(0);
    expect(res.tier).toBe("SEED");
    expect(res.energy).toBe(500);
    expect(res.role).toBe("COLONY_PEER");
    expect(res.dominantHz).toBe(432);

    // Colony Node Registration on-chain verification
    const node = nodeRegistry.getNode(String(res.tokenId));
    expect(node).not.toBeNull();
    expect(node.owner.toLowerCase()).toBe(user.toLowerCase());
    expect(node.role).toBe("COLONY_PEER");
    expect(node.tier).toBe("SEED");
    expect(node.energyScore).toBe(500);

    // Immutable Tier on contract
    expect(resonanceAsset.getTierOfToken(res.tokenId)).toBe("SEED");
  });

  // LAYER: Blockchain & Colony — Test 2: Resonant Mint
  it("Test 2: Resonant mint — 500 USDC, energy=3500, RESONANT tier, 5 task capacity", () => {
    const user = "myc1resonantuser000000000000000000000000";
    const res = resonanceAsset.mintResonant(user, { msgSender: user });

    expect(res.tokenId).toBeGreaterThan(0);
    expect(res.tier).toBe("RESONANT");
    expect(res.energy).toBe(3500);
    expect(res.maxTasks).toBe(5);

    // Node registry check
    const node = nodeRegistry.getNode(String(res.tokenId));
    expect(node).not.toBeNull();
    expect(node.tier).toBe("RESONANT");
    expect(node.energyScore).toBe(3500);

    // Scheduler capacity check
    const capacity = getNFTNodeCapacity(res.tokenId, resonanceAsset);
    expect(capacity.maxConcurrentTasks).toBe(5);
    expect(capacity.tier).toBe("RESONANT");
  });

  // LAYER: Blockchain & Colony — Test 3: Sovereign Mint
  it("Test 3: Sovereign mint — 5000 USDC, energy=9000, SOVEREIGN tier, VALIDATOR role", () => {
    const user = "myc1sovereignvalidator0000000000000000000";
    const res = resonanceAsset.mintSovereign(user, { msgSender: user });

    expect(res.tokenId).toBeGreaterThan(0);
    expect(res.tier).toBe("SOVEREIGN");
    expect(res.energy).toBe(9000);
    expect(res.role).toBe("VALIDATOR");
    expect(res.dominantHz).toBe(963);

    // Node registry verification (Must be VALIDATOR role, not COLONY_PEER)
    const node = nodeRegistry.getNode(String(res.tokenId));
    expect(node).not.toBeNull();
    expect(node.role).toBe("VALIDATOR");
    expect(node.tier).toBe("SOVEREIGN");
    expect(node.energyScore).toBe(9000);

    // Scheduler capacity check: 20 concurrent tasks
    const capacity = getNFTNodeCapacity(res.tokenId, resonanceAsset);
    expect(capacity.maxConcurrentTasks).toBe(20);
    expect(capacity.capabilityTypes).toContain("validator");
    expect(capacity.capabilityTypes).toContain("escrow_arbitration");
  });

  // LAYER: Blockchain — Test 4: Supply limit enforcement
  it("Test 4: Supply limit — Reverts when tier supply exhausted", () => {
    const user = "myc1stressuser00000000000000000000000000";

    // Fast-forward Sovereign supply (max 200)
    resonanceAsset.tierMintedCount.set("SOVEREIGN", 200);

    // 201st mint attempt must strictly revert
    expect(() => {
      resonanceAsset.mintSovereign(user, { msgSender: user });
    }).toThrow("Tier supply exhausted");

    // Fast-forward Seed supply (max 10000)
    resonanceAsset.tierMintedCount.set("SEED", 10000);
    expect(() => {
      resonanceAsset.mintSeed(user, { msgSender: user });
    }).toThrow("Tier supply exhausted");
  });

  // LAYER: VM & API — Test 5: Supply query consistency
  it("Test 5: Supply query — getRemainingSupply returns accurate counts and prices", () => {
    const seedSup = resonanceAsset.getRemainingSupply("SEED");
    expect(seedSup.max).toBe(10000);
    expect(seedSup.price).toBe(50);
    expect(seedSup.remaining).toBe(10000);

    const user = "myc1seedbuyer00000000000000000000000000";
    resonanceAsset.mintSeed(user);

    const seedSupAfter = resonanceAsset.getRemainingSupply("SEED");
    expect(seedSupAfter.minted).toBe(1);
    expect(seedSupAfter.remaining).toBe(9999);

    const resSup = resonanceAsset.getRemainingSupply("RESONANT");
    expect(resSup.max).toBe(2000);
    expect(resSup.price).toBe(500);

    const sovSup = resonanceAsset.getRemainingSupply("SOVEREIGN");
    expect(sovSup.max).toBe(200);
    expect(sovSup.price).toBe(5000);
  });

  // LAYER: VM & Colony — Test 6: Tier capabilities
  it("Test 6: Tier capabilities — Each tier returns exact specified capability list", () => {
    const user = "myc1captestuser0000000000000000000000000";
    const seedId = resonanceAsset.mintSeed(user).tokenId;
    const resId = resonanceAsset.mintResonant(user).tokenId;
    const sovId = resonanceAsset.mintSovereign(user).tokenId;

    const seedCaps = resonanceAsset.getTierCapabilities(seedId);
    expect(seedCaps).toEqual(["telemetry", "ping", "light_inference"]);

    const resCaps = resonanceAsset.getTierCapabilities(resId);
    expect(resCaps).toEqual(["ai_inference", "depin_actuation", "m2m_payment", "telemetry"]);

    const sovCaps = resonanceAsset.getTierCapabilities(sovId);
    expect(sovCaps).toEqual(["validator", "escrow_arbitration", "ai_inference", "depin_actuation", "m2m_payment", "telemetry"]);
  });

  // LAYER: Colony Scheduler — Test 7: Max concurrent tasks based on tier
  it("Test 7: Colony scheduler — maxConcurrentTasks is 1 for SEED, 5 for RESONANT, and 20 for SOVEREIGN", () => {
    const user = "myc1schedulertestuser00000000000000000";
    const seedId = resonanceAsset.mintSeed(user).tokenId;
    const resId = resonanceAsset.mintResonant(user).tokenId;
    const sovId = resonanceAsset.mintSovereign(user).tokenId;

    const seedCap = getNFTNodeCapacity(seedId, resonanceAsset);
    expect(seedCap.maxConcurrentTasks).toBe(1);

    const resCap = getNFTNodeCapacity(resId, resonanceAsset);
    expect(resCap.maxConcurrentTasks).toBe(5);

    const sovCap = getNFTNodeCapacity(sovId, resonanceAsset);
    expect(sovCap.maxConcurrentTasks).toBe(20);
  });
});
