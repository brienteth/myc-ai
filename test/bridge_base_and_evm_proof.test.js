import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:4040";

test("Cross-Chain Bridge: Base (EVM) <-> MYCA Lattice (Chain 108) with Cryptographic Proofs", async (t) => {
  const testAddress = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
  const evmRecipient = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const arbitrumRecipient = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A";

  let initialBalances = { MYC: 0, USDT: 0, USDC: 0 };
  let baseTxProof = null;
  let arbitrumTxProof = null;

  // 1. Check initial balances
  await t.test("1. Should query initial wallet balances", async () => {
    const res = await fetch(`${BASE_URL}/api/wallet/balance?address=${testAddress}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    initialBalances.MYC = data.mycBalance;
    initialBalances.USDT = data.usdtBalance;
    initialBalances.USDC = data.usdcBalance;
    assert.ok(initialBalances.MYC >= 0);
  });

  // 2. Inbound Bridge: Base -> MYCA (USDT)
  await t.test("2. Should execute Inbound Bridge: Base (EVM) -> MYCA with BFT Quorum & Merkle Proof", async () => {
    const customBaseTxHash = "0x9a8f3b" + Math.random().toString(16).slice(2).padEnd(58, "0");
    const bridgeAmount = 150;

    const res = await fetch(`${BASE_URL}/api/bridge/base-to-myc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseTxHash: customBaseTxHash,
        senderOnBase: evmRecipient,
        recipientOnMyc: testAddress,
        asset: "USDT",
        amount: bridgeAmount,
        nonce: 1
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.direction, "BASE_TO_MYCA");
    
    baseTxProof = data.proof;
    assert.ok(baseTxProof);
    assert.equal(baseTxProof.status, "COMPLETED");
    assert.equal(baseTxProof.asset, "USDT");
    assert.equal(baseTxProof.amount, bridgeAmount);

    // Verify Source (Base EVM) Cryptographic Proof
    assert.equal(baseTxProof.source.network, "Base Mainnet");
    assert.equal(baseTxProof.source.chainId, 8453);
    assert.equal(baseTxProof.source.txHash, customBaseTxHash);
    assert.ok(baseTxProof.source.merkleReceiptRoot.startsWith("0x"));

    // Verify Destination (MYCA Lattice)
    assert.equal(baseTxProof.destination.network, "MYC-TESTNET-SPHEROID-1");
    assert.equal(baseTxProof.destination.chainId, 108);
    assert.equal(baseTxProof.destination.recipient, testAddress);
    assert.equal(baseTxProof.destination.gasFee, "0.00000000 MYC");
    assert.equal(baseTxProof.destination.gasInvariant, "ZERO_GAS_PRESERVED");

    // Verify BFT 2/3 + 1 Quorum
    assert.equal(baseTxProof.bftQuorumProof.requiredSignatures, 3);
    assert.equal(baseTxProof.bftQuorumProof.signers.length, 3);
    assert.equal(baseTxProof.bftQuorumProof.signatures.length, 3);
    for (const sig of baseTxProof.bftQuorumProof.signatures) {
      assert.ok(sig.signature.startsWith("0x"));
      assert.ok(sig.validator.startsWith("myc1validator"));
    }

    // Verify Lattice PoR Certificate
    assert.ok(baseTxProof.latticeExecution.certificate.startsWith("POR_CERT_"));
    assert.ok(baseTxProof.latticeExecution.coherenceScore > 0.99);

    // Verify wallet received credited USDT
    assert.equal(data.updatedBalances.USDT, initialBalances.USDT + bridgeAmount);
  });

  // 3. Inbound Bridge Replay Attack Protection
  await t.test("3. Should strictly reject replay attack with identical Base Tx hash", async () => {
    const res = await fetch(`${BASE_URL}/api/bridge/base-to-myc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseTxHash: baseTxProof.source.txHash,
        senderOnBase: evmRecipient,
        recipientOnMyc: testAddress,
        asset: "USDT",
        amount: 150,
        nonce: 1
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes("REPLAY_ATTACK_DETECTED"));
  });

  // 4. Outbound Bridge: MYCA -> Arbitrum (USDT)
  await t.test("4. Should execute Outbound Bridge: MYCA -> Arbitrum (EVM) with Lattice PoR Lock Proof", async () => {
    const lockAmount = 50;
    const res = await fetch(`${BASE_URL}/api/bridge/myc-to-evm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderOnMyc: testAddress,
        targetChain: "ARBITRUM",
        recipientOnEvm: arbitrumRecipient,
        asset: "USDT",
        amount: lockAmount
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.direction, "MYCA_TO_EVM");

    arbitrumTxProof = data.proof;
    assert.ok(arbitrumTxProof);
    assert.ok(["PROOF_READY", "COMPLETED"].includes(arbitrumTxProof.status));
    assert.equal(arbitrumTxProof.asset, "USDT");
    assert.equal(arbitrumTxProof.grossAmount, lockAmount);
    assert.equal(arbitrumTxProof.bridgeFee, 0.05); // 0.1% fee
    assert.equal(arbitrumTxProof.netAmount, 49.95);

    // Verify Source (MYCA Lattice)
    assert.equal(arbitrumTxProof.source.network, "MYC-TESTNET-SPHEROID-1");
    assert.equal(arbitrumTxProof.source.chainId, 108);
    assert.equal(arbitrumTxProof.source.sender, testAddress);
    assert.equal(arbitrumTxProof.source.gasUsed, "0.00000000 MYC");
    assert.ok(arbitrumTxProof.source.latticeVertexHash.startsWith("0x"));
    assert.ok(arbitrumTxProof.source.lockProof.startsWith("LATTICE_PROOF_"));

    // Verify Destination (Arbitrum EVM)
    assert.equal(arbitrumTxProof.destination.network, "Arbitrum One");
    assert.equal(arbitrumTxProof.destination.targetChain, "ARBITRUM");
    assert.equal(arbitrumTxProof.destination.chainId, 42161);
    assert.ok(arbitrumTxProof.destination.mode === "SIMULATED" || arbitrumTxProof.destination.evmTxHash.startsWith("0x"));
    assert.ok(arbitrumTxProof.destination.evmCalldata.startsWith("0x"));

    // Verify BFT Attestation Signatures
    assert.equal(arbitrumTxProof.bftQuorumProof.requiredSignatures, 3);
    assert.equal(arbitrumTxProof.bftQuorumProof.signatures.length, 3);

    // Verify Certificate
    assert.ok(arbitrumTxProof.latticeExecution.certificate.startsWith("POR_CERT_"));
  });

  // 5. Outbound Bridge: MYCA -> Ethereum (USDC)
  await t.test("5. Should execute Outbound Bridge: MYCA -> Ethereum (EVM) for USDC", async () => {
    const lockAmount = 100;
    const res = await fetch(`${BASE_URL}/api/bridge/myc-to-evm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderOnMyc: testAddress,
        targetChain: "ETHEREUM",
        recipientOnEvm: arbitrumRecipient,
        asset: "USDC",
        amount: lockAmount
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.proof.destination.network, "Ethereum Mainnet");
    assert.equal(data.proof.destination.chainId, 1);
    assert.equal(data.proof.asset, "USDC");
    assert.equal(data.proof.grossAmount, 100);
    assert.equal(data.proof.bridgeFee, 0.1);
    assert.equal(data.proof.netAmount, 99.9);
  });

  // 6. Cryptographic Proof Query API
  await t.test("6. Should retrieve full cryptographic proof via GET /api/bridge/proof?id=...", async () => {
    const res = await fetch(`${BASE_URL}/api/bridge/proof?id=${baseTxProof.bridgeId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.proof.bridgeId, baseTxProof.bridgeId);
    assert.equal(data.proof.source.txHash, baseTxProof.source.txHash);
    assert.equal(data.proof.latticeExecution.certificate, baseTxProof.latticeExecution.certificate);
  });

  // 7. List All Proofs API
  await t.test("7. Should list all historical bridge proofs via GET /api/bridge/proofs", async () => {
    const res = await fetch(`${BASE_URL}/api/bridge/proofs`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.count >= 3);
    assert.ok(Array.isArray(data.proofs));
    assert.ok(data.proofs.some(p => p.direction === "BASE_TO_MYCA"));
    assert.ok(data.proofs.some(p => p.direction === "MYCA_TO_EVM"));
  });

  // 8. Reject unsupported asset or chain
  await t.test("8. Should reject unsupported chain or asset with clear error", async () => {
    const badAsset = await fetch(`${BASE_URL}/api/bridge/base-to-myc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset: "SHIB",
        amount: 100,
        recipientOnMyc: testAddress
      })
    });
    assert.equal(badAsset.status, 400);

    const badChain = await fetch(`${BASE_URL}/api/bridge/myc-to-evm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetChain: "AVALANCHE",
        asset: "USDT",
        amount: 100,
        recipientOnEvm: arbitrumRecipient
      })
    });
    assert.equal(badChain.status, 400);
  });
});
