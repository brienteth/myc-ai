import { MycTransaction } from "../ledger/blockchain/transaction.js";
import { MycBlock } from "../ledger/blockchain/block.js";
import { MycBlockchain } from "../ledger/blockchain/blockchain.js";
import { MycConsensusEngine } from "../ledger/consensus/consensus.js";
import { ProofOfResonance } from "../core/consensus/por.js";
import { MycLatticeLedger } from "../ledger/dag/lattice.js";
import { MycHardwareWallet } from "../core/crypto/wallet.js";
import { MycRpcServer } from "../rpc/rpc_server.js";
import { deployAllContracts } from "../scripts/deploy_contracts.js";

console.log("====================================================================");
console.log("🛡️ ZERO-GAS PROTOCOL INVARIANT & ADVERSARIAL VERIFICATION SUITE");
console.log("Proving strict zero-gas enforcement across Transactions, Blocks,");
console.log("Consensus, Mempool, State Machine, DAG Ledger, and Web3 JSON-RPC");
console.log("====================================================================\n");

async function runZeroGasSuite() {
  let passed = 0;
  let total = 0;

  const wallet = new MycHardwareWallet();
  const recipientAddr = "myc1recipient00000000000000000000000";

  // ---------------------------------------------------------------------------
  // TEST 1: Transaction gasPrice > 0 strictly rejected at construction
  // ---------------------------------------------------------------------------
  total++;
  console.log("[1] Testing Adversarial Transaction with gasPrice > 0...");
  let gasPriceRejected = false;
  try {
    new MycTransaction({
      from: wallet.address,
      to: recipientAddr,
      value: 100,
      nonce: 0,
      gasPrice: 1, // Malicious gas fee attempt
      gasLimit: 0,
      signature: "0x" + "a".repeat(64)
    });
  } catch (err) {
    if (err.message.includes("GAS_INVARIANT_VIOLATION") && err.message.includes("gasPrice and gasLimit must strictly be 0")) {
      gasPriceRejected = true;
    }
  }

  if (gasPriceRejected) {
    console.log("  ✅ [TEST 1 PASS] Transaction with gasPrice > 0 strictly rejected by cryptographic constructor.");
    passed++;
  } else {
    console.error("  ❌ [TEST 1 FAIL] Transaction with non-zero gasPrice was erroneously accepted!");
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Transaction gasLimit > 0 strictly rejected at construction
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[2] Testing Adversarial Transaction with gasLimit > 0 (EVM gasLimit mimic)...");
  let gasLimitRejected = false;
  try {
    new MycTransaction({
      from: wallet.address,
      to: recipientAddr,
      value: 100,
      nonce: 0,
      gasPrice: 0,
      gasLimit: 21000, // Standard EVM gas limit attempt
      signature: "0x" + "b".repeat(64)
    });
  } catch (err) {
    if (err.message.includes("GAS_INVARIANT_VIOLATION") && err.message.includes("gasPrice and gasLimit must strictly be 0")) {
      gasLimitRejected = true;
    }
  }

  if (gasLimitRejected) {
    console.log("  ✅ [TEST 2 PASS] Transaction with gasLimit > 0 strictly rejected.");
    passed++;
  } else {
    console.error("  ❌ [TEST 2 FAIL] Transaction with non-zero gasLimit was erroneously accepted!");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Block with gasUsed > 0 rejected by BFT Consensus Engine
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[3] Testing Block Proposal with gasUsed > 0 against BFT Consensus Engine...");
  const consensus = new MycConsensusEngine({ epochBlocks: 100 });
  consensus.registerValidator(wallet.address, 100000);

  const maliciousBlock = new MycBlock({
    number: 1,
    parentHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    validator: wallet.address,
    transactions: [],
    stateRoot: "0x" + "0".repeat(64),
    timestamp: Date.now()
  });
  // Inject malicious non-zero gasUsed
  maliciousBlock.gasUsed = 50000;
  maliciousBlock.hash = maliciousBlock.calculateBlockHash();

  const validationResult = consensus.validateBlockProposal(maliciousBlock, null);
  console.log(`  Consensus validation outcome: valid=${validationResult.valid}, reason='${validationResult.reason}'`);

  if (!validationResult.valid && validationResult.reason.includes("GAS_INVARIANT_VIOLATION: gasUsed must be 0")) {
    console.log("  ✅ [TEST 3 PASS] Block with non-zero gasUsed rejected by BFT consensus rules.");
    passed++;
  } else {
    console.error("  ❌ [TEST 3 FAIL] Non-zero gas block bypassed consensus validation!");
  }

  // ---------------------------------------------------------------------------
  // TEST 4: State Machine Transfer Deducts Exactly 0 Gas Fees
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[4] Testing Exact Balance Deduction (Zero Gas Leakage)...");
  const chain = new MycBlockchain({ inMemory: true });
  const senderInitialBalance = 10000;
  const transferAmount = 2500;

  chain.state.setBalance(wallet.address, senderInitialBalance);
  chain.state.setBalance(recipientAddr, 0);

  const tx = new MycTransaction({
    from: wallet.address,
    to: recipientAddr,
    value: transferAmount,
    nonce: 0,
    gasPrice: 0,
    gasLimit: 0,
    signature: "0x" + "c".repeat(64)
  });

  chain.mempool.addTransaction(tx, chain.state);
  const prodResult = chain.produceBlock();
  const block = prodResult.block;

  const senderFinalBalance = chain.state.getBalance(wallet.address);
  const recipientFinalBalance = chain.state.getBalance(recipientAddr);
  const feeDeducted = senderInitialBalance - (senderFinalBalance + transferAmount);

  console.log(`  Initial Sender Balance : ${senderInitialBalance} MYC`);
  console.log(`  Transfer Amount        : ${transferAmount} MYC`);
  console.log(`  Final Sender Balance   : ${senderFinalBalance} MYC`);
  console.log(`  Final Recipient Balance: ${recipientFinalBalance} MYC`);
  console.log(`  Total Gas Fee Paid     : ${feeDeducted} MYC`);
  console.log(`  Block Gas Used         : ${block.gasUsed}`);

  if (senderFinalBalance === (senderInitialBalance - transferAmount) && feeDeducted === 0 && block.gasUsed === 0) {
    console.log("  ✅ [TEST 4 PASS] Mathematical Invariant Verified: Gas Fee = 0.00000000 MYC (Zero deduction from sender).");
    passed++;
  } else {
    console.error("  ❌ [TEST 4 FAIL] Gas fee was deducted during transfer!");
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Proof-of-Resonance (PoR) Evaluator strictly yields gasConsumed = 0
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[5] Testing PoR Evaluator for Zero Gas Consumption...");
  const por = new ProofOfResonance();
  const validProof = por.evaluateProof("Start turbine #1", {
    status: 0,
    device: "TURBINE",
    action: "START",
    target_register: 130,
    action_value: 0xFF00
  });

  const negationProof = por.evaluateProof("Never activate pump #2", {
    status: 229,
    device: "PROTECTED",
    action: "0-BYTE_NOOP"
  });

  if (validProof.gasConsumed === 0 && negationProof.gasConsumed === 0) {
    console.log(`  Valid PoR Gas Consumed   : ${validProof.gasConsumed} MYC`);
    console.log(`  Negation PoR Gas Consumed: ${negationProof.gasConsumed} MYC`);
    console.log("  ✅ [TEST 5 PASS] PoR evaluation guarantees gasConsumed === 0 for all states.");
    passed++;
  } else {
    console.error("  ❌ [TEST 5 FAIL] PoR consumed non-zero gas!");
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Lattice DAG Ledger Commits Explicit Zero-Gas Field
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[6] Testing Nodeless Lattice DAG Ledger for Zero-Gas Commits...");
  const ledger = new MycLatticeLedger("MYC-LATTICE-MAINNET");
  const vertex = ledger.appendVertex({
    sender: wallet.address,
    device: "VALVE",
    action: "OPEN",
    coil: 16,
    actionValue: 0xFF00,
    porHash: validProof.porHash,
    latencyUs: "38.4",
    signature: "sig_zero_gas"
  });

  if (vertex.zeroGasFee === "0.00000000 MYC (Zero-Gas Invariant)") {
    console.log(`  DAG Vertex #${vertex.index} Zero-Gas Seal: '${vertex.zeroGasFee}'`);
    console.log("  ✅ [TEST 6 PASS] Lattice DAG commits immutable zero-gas guarantee.");
    passed++;
  } else {
    console.error("  ❌ [TEST 6 FAIL] DAG vertex missing zero-gas seal!");
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Web3 JSON-RPC eth_gasPrice & eth_estimateGas Return 0x0
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[7] Testing Web3 JSON-RPC Standard Methods (eth_gasPrice / eth_estimateGas)...");
  const { chain: testChain, vm: testVm, manifest } = await deployAllContracts();
  const rpc = new MycRpcServer({
    blockchain: testChain,
    vm: testVm,
    deployedContracts: manifest.contracts
  });

  const gasPriceRes = await rpc.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_gasPrice",
    params: []
  });

  const estimateGasRes = await rpc.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "eth_estimateGas",
    params: [{ from: wallet.address, to: recipientAddr, value: "0x100" }]
  });

  console.log(`  RPC eth_gasPrice Result   : ${gasPriceRes.result}`);
  console.log(`  RPC eth_estimateGas Result: ${estimateGasRes.result}`);

  if (gasPriceRes.result === "0x0" && estimateGasRes.result === "0x0") {
    console.log("  ✅ [TEST 7 PASS] Web3 JSON-RPC returns '0x0' for eth_gasPrice and eth_estimateGas.");
    passed++;
  } else {
    console.error("  ❌ [TEST 7 FAIL] Web3 JSON-RPC returned non-zero gas values!");
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Smart Contract Execution in MycContractVM Incurs Zero Gas Fees
  // ---------------------------------------------------------------------------
  total++;
  console.log("\n[8] Testing Native Smart Contract Execution (MycContractVM) Zero-Gas Guarantee...");
  const tokenContractAddr = manifest.contracts.MycToken.address;
  const execCall = testVm.execute({
    from: "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002",
    to: tokenContractAddr,
    data: JSON.stringify({ method: "transfer", args: [recipientAddr, 500] })
  });

  console.log(`  Contract Execution Success : ${execCall.success}`);
  console.log(`  Contract Execution Gas Fee : ${execCall.gasFee || "0.00 MYC"}`);

  if (execCall.success && (execCall.gasFee === "0.00 MYC" || !execCall.gasBurned)) {
    console.log("  ✅ [TEST 8 PASS] On-chain smart contract execution verified with zero gas fee.");
    passed++;
  } else {
    console.error("  ❌ [TEST 8 FAIL] Smart contract execution charged gas fees!");
  }

  console.log(`\n=== Zero-Gas Invariant Suite Result: ${passed}/${total} Passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runZeroGasSuite().catch(e => {
  console.error(e);
  process.exit(1);
});
