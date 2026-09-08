import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MycCrossChainRelayer } from "../ledger/bridge/cross_chain_relayer.js";
import { BFTConsensusVerifier } from "../ledger/bridge/consensus_verifier.js";
import { BridgeReplayGuard } from "../ledger/bridge/replay_guard.js";
import { SourceVerifier } from "../ledger/bridge/source_verifier.js";
import { SettlementAdapter, SETTLEMENT_STATUSES } from "../ledger/bridge/settlement_adapter.js";
import { MycSwapDex } from "../ledger/tokenomics/swap_dex.js";

const TEST_STORAGE_PATH = path.resolve(process.cwd(), "data/test_bridge_replay_persistence.json");

test("Bridge Hardening & Adversarial Cryptographic Verification Suite", async (t) => {
  // Clean up any test persistence file
  if (fs.existsSync(TEST_STORAGE_PATH)) {
    fs.unlinkSync(TEST_STORAGE_PATH);
  }

  const verifier = new BFTConsensusVerifier();
  const sourceVerifier = new SourceVerifier();
  const replayGuard = new BridgeReplayGuard(TEST_STORAGE_PATH);
  const settlementAdapter = new SettlementAdapter();
  const relayer = new MycCrossChainRelayer();

  const mockParams = {
    sourceChainId: 8453,
    sourceBridgeContract: "0x8453000000000000000000000000000000000001",
    sourceTxHash: "0x" + crypto.randomBytes(32).toString("hex"),
    sourceLogIndex: 0,
    targetChainId: 108,
    targetBridgeContract: "0x1080000000000000000000000000000000000001",
    recipient: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
    asset: "USDT",
    amount: 500,
    nonce: 10
  };

  // ───────────────────────────────────────────────────────────────────
  // CRITERION 1: Base Receipt Commitment & Payload Verification
  // ───────────────────────────────────────────────────────────────────
  await t.test("1. SourceVerifier explicitly marks locallyReconstructedReceiptCommitment and validates parameters", () => {
    const commitment = sourceVerifier.verifyInboundLock({
      sourceChainId: mockParams.sourceChainId,
      sourceTxHash: mockParams.sourceTxHash,
      sourceLogIndex: mockParams.sourceLogIndex,
      sender: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      recipient: mockParams.recipient,
      amount: mockParams.amount,
      asset: mockParams.asset,
      blockNumber: 21450000,
      nonce: mockParams.nonce
    });

    assert.equal(commitment.verified, true);
    assert.equal(commitment.verificationType, "locallyReconstructedReceiptCommitment");
    assert.ok(commitment.receiptCommitment.startsWith("0x"));
    assert.equal(commitment.sourceLogIndex, 0);

    // Invalid parameters throw error
    assert.throws(() => {
      sourceVerifier.verifyInboundLock({
        ...mockParams,
        amount: -5
      });
    }, /INVALID_SOURCE_AMOUNT/);
  });

  // ───────────────────────────────────────────────────────────────────
  // CRITERION 2: Real Cryptographic secp256k1 ECDSA & Canonical EIP-712
  // ───────────────────────────────────────────────────────────────────
  await t.test("2. ConsensusVerifier uses real secp256k1 ECDSA signatures over canonical messageHash", () => {
    const transferId = replayGuard.computeTransferId(mockParams);
    const messageHash = verifier.computeCanonicalMessageHash({
      bridgeId: transferId,
      ...mockParams
    });

    assert.ok(messageHash.startsWith("0x"));
    assert.equal(messageHash.length, 66); // 0x + 64 hex chars

    // Generate real ECDSA signatures from 3 validators
    const signatures = verifier.generateCommitteeSignatures(messageHash, 3);
    assert.equal(signatures.length, 3);

    // Verify 3/4 BFT Quorum
    const quorum = verifier.verifyQuorum({
      messageHash,
      signatures,
      requiredQuorum: 3
    });

    assert.equal(quorum.valid, true);
    assert.equal(quorum.verifiedSigners.length, 3);
    assert.equal(quorum.requiredQuorum, 3);
  });

  // ───────────────────────────────────────────────────────────────────
  // CRITERION 3: Honest Destination Settlement Status (SIMULATED vs FINALIZED)
  // ───────────────────────────────────────────────────────────────────
  await t.test("3. SettlementAdapter explicitly enforces SIMULATED (PROOF_READY) vs FINALIZED", async () => {
    const transferId = replayGuard.computeTransferId(mockParams);
    const messageHash = verifier.computeCanonicalMessageHash({
      bridgeId: transferId,
      ...mockParams
    });
    const signatures = verifier.generateCommitteeSignatures(messageHash, 3);

    const simulatedResult = await settlementAdapter.settleOnTarget({
      targetChainId: 42161,
      targetChainName: "Arbitrum One",
      targetBridgeContract: "0x4216100000000000000000000000000000000001",
      transferId,
      recipient: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
      amount: 100,
      asset: "USDT",
      nonce: 1,
      signatures,
      forceSimulate: true
    });

    assert.equal(simulatedResult.mode, "SIMULATED");
    assert.equal(simulatedResult.settlementStatus, SETTLEMENT_STATUSES.PROOF_READY);
    assert.equal(simulatedResult.broadcast, false);
    assert.ok(simulatedResult.calldata.startsWith("0x"));
  });

  // ───────────────────────────────────────────────────────────────────
  // CRITERION 4: Adversarial Attack Rejections
  // ───────────────────────────────────────────────────────────────────
  await t.test("4a. Adversarial: Cross-Chain Replay Attack Rejection", () => {
    const replayTxParams = { ...mockParams, sourceTxHash: "0x" + crypto.randomBytes(32).toString("hex") };
    const transferId = replayGuard.computeTransferId(replayTxParams);
    assert.equal(replayGuard.isProcessed(transferId), false);

    // Seal first execution
    replayGuard.sealTransfer(transferId, replayTxParams);
    assert.equal(replayGuard.isProcessed(transferId), true);

    // Replaying must throw error
    assert.throws(() => {
      replayGuard.sealTransfer(transferId, replayTxParams);
    }, /REPLAY_ATTACK_DETECTED/);
  });

  await t.test("4b. Adversarial: Multi-Event in Same Tx Isolated via sourceLogIndex", () => {
    const multiTxHash = "0x" + crypto.randomBytes(32).toString("hex");
    const eventLog0 = { ...mockParams, sourceTxHash: multiTxHash, sourceLogIndex: 0 };
    const eventLog1 = { ...mockParams, sourceTxHash: multiTxHash, sourceLogIndex: 1 };

    const transferId0 = replayGuard.computeTransferId(eventLog0);
    const transferId1 = replayGuard.computeTransferId(eventLog1);

    assert.notEqual(transferId0, transferId1, "Different log indices in the same transaction must produce distinct transferIds");

    replayGuard.sealTransfer(transferId0, eventLog0);
    assert.equal(replayGuard.isProcessed(transferId0), true);
    assert.equal(replayGuard.isProcessed(transferId1), false, "Log index 1 must still be eligible when log index 0 is sealed");

    replayGuard.sealTransfer(transferId1, eventLog1);
    assert.equal(replayGuard.isProcessed(transferId1), true);
  });

  await t.test("4c. Adversarial: Signature Tampering & Substitution Rejection", () => {
    const transferId = replayGuard.computeTransferId({ ...mockParams, nonce: 99 });
    const messageHash = verifier.computeCanonicalMessageHash({
      bridgeId: transferId,
      ...mockParams,
      nonce: 99
    });

    const signatures = verifier.generateCommitteeSignatures(messageHash, 3);

    // Corrupt one signature
    const corruptedSignatures = [
      signatures[0],
      {
        ...signatures[1],
        signature: "0x" + "aa".repeat(64) // fake 64-byte signature
      },
      signatures[2]
    ];

    const tamperedQuorum = verifier.verifyQuorum({
      messageHash,
      signatures: corruptedSignatures,
      requiredQuorum: 3
    });

    assert.equal(tamperedQuorum.valid, false, "Corrupted signature must cause quorum check to fail");
    assert.ok(tamperedQuorum.verifiedCount < 3);
  });

  await t.test("4d. Adversarial: Malicious Foreign Key Substitution Rejection", () => {
    const transferId = replayGuard.computeTransferId({ ...mockParams, nonce: 101 });
    const messageHash = verifier.computeCanonicalMessageHash({
      bridgeId: transferId,
      ...mockParams,
      nonce: 101
    });

    // Create an unauthorized rogue keypair
    const rogueKeypair = crypto.generateKeyPairSync("ec", { namedCurve: "secp256k1" });
    const rogueSigner = crypto.createSign("SHA256");
    rogueSigner.update(Buffer.from(messageHash.slice(2), "hex"));
    rogueSigner.end();
    const rogueSig = "0x" + rogueSigner.sign({ key: rogueKeypair.privateKey, dsaEncoding: "ieee-p1363" }).toString("hex");

    const rogueSignatures = [
      {
        validator: "myc1roguevalidator666",
        name: "Rogue Validator",
        signature: rogueSig
      },
      ...verifier.generateCommitteeSignatures(messageHash, 2)
    ];

    const rogueQuorum = verifier.verifyQuorum({
      messageHash,
      signatures: rogueSignatures,
      requiredQuorum: 3
    });

    assert.equal(rogueQuorum.valid, false, "Signatures from non-committee keys must be rejected");
    assert.ok(rogueQuorum.verifiedCount < 3);
  });

  await t.test("4e. Adversarial: Chain-ID Confusion & Domain Mismatch Rejection", () => {
    const hashForChain108 = verifier.computeCanonicalMessageHash({
      bridgeId: "bridge_1",
      ...mockParams,
      targetChainId: 108
    });

    const hashForChain42161 = verifier.computeCanonicalMessageHash({
      bridgeId: "bridge_1",
      ...mockParams,
      targetChainId: 42161
    });

    assert.notEqual(hashForChain108, hashForChain42161, "Message hashes across different target chain IDs must never collide");

    // Sign message intended for chain 108
    const signaturesChain108 = verifier.generateCommitteeSignatures(hashForChain108, 3);

    // Attempt to verify those signatures against chain 42161 message hash
    const confusionQuorum = verifier.verifyQuorum({
      messageHash: hashForChain42161,
      signatures: signaturesChain108,
      requiredQuorum: 3
    });

    assert.equal(confusionQuorum.valid, false, "Signatures meant for chain 108 must fail verification for chain 42161");
  });

  // ───────────────────────────────────────────────────────────────────
  // CRITERION 5: Crash/Restart Persistence & Double-Release Prevention
  // ───────────────────────────────────────────────────────────────────
  await t.test("5. Crash Recovery: BridgeReplayGuard state persists across re-instantiation", () => {
    const recoveryParams = { ...mockParams, nonce: 777 };
    const transferId = replayGuard.computeTransferId(recoveryParams);

    // Fresh guard instance 1
    const guard1 = new BridgeReplayGuard(TEST_STORAGE_PATH);
    assert.equal(guard1.isProcessed(transferId), false);
    guard1.sealTransfer(transferId, recoveryParams);
    assert.equal(guard1.isProcessed(transferId), true);

    // Simulate process crash and node reboot by creating fresh guard instance 2
    const guard2 = new BridgeReplayGuard(TEST_STORAGE_PATH);
    assert.equal(guard2.isProcessed(transferId), true, "Sealed transferId must persist on disk across node restart");

    assert.throws(() => {
      guard2.sealTransfer(transferId, recoveryParams);
    }, /REPLAY_ATTACK_DETECTED/, "Post-restart attempt to double-release must be blocked");
  });

  // ───────────────────────────────────────────────────────────────────
  // CRITERION 6: AMM Constant-Product DEX Reserve Invariant
  // ───────────────────────────────────────────────────────────────────
  await t.test("6. AMM DEX: Constant-product reserves strictly contain { MYC, USDT, USDC } without ZERO_G pollution", () => {
    const dex = new MycSwapDex();
    const stats = dex.getPoolStats();

    // Invariant: Only trading pairs in constant-product reserves
    assert.deepEqual(Object.keys(stats.reserves).sort(), ["MYC", "USDC", "USDT"].sort());
    assert.ok(stats.reserves.MYC > 0);
    assert.ok(stats.reserves.USDT > 0);
    assert.ok(stats.reserves.USDC > 0);
    assert.equal(stats.reserves.ZERO_G, undefined, "ZERO_G must not pollute AMM reserves");

    // ZERO_G belongs to protocolBalances
    assert.equal(stats.protocolBalances.ZERO_G, 5_000_000);

    // Swap quote works
    const quote = dex.quote("MYC", "USDT", 100);
    assert.ok(quote.amountOut > 0);
    assert.ok(quote.priceImpactPercent >= 0);
  });

  // Clean up test persistence file
  if (fs.existsSync(TEST_STORAGE_PATH)) {
    fs.unlinkSync(TEST_STORAGE_PATH);
  }
});
