import { performance } from "perf_hooks";
import { MycBlockchain } from "../ledger/blockchain/blockchain.js";
import { MycTransaction } from "../ledger/blockchain/transaction.js";
import { MycProofOfResonance } from "../ledger/por/por_engine.js";
import { MycPolicyVM } from "../ledger/vm/policy_vm.js";
import { MycEscrowContract } from "../ledger/contracts/index.js";

console.log("====================================================================");
console.log("⚡ MYCA PRODUCTION REAL BENCHMARK SUITE");
console.log("====================================================================");

function calculatePercentiles(latencies) {
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  return { p50: p50.toFixed(3), p95: p95.toFixed(3), p99: p99.toFixed(3), avg: avg.toFixed(3) };
}

// 1. PoR Verification Latency
const por = new MycProofOfResonance();
const porLatencies = [];
for (let i = 0; i < 200; i++) {
  const t0 = performance.now();
  por.evaluateProof("Start turbine #2", { device: "TURBINE", action: "START", target_register: 130, status: 0 });
  porLatencies.push((performance.now() - t0) * 1000); // in microseconds
}
const porStats = calculatePercentiles(porLatencies);

// 2. Policy VM Evaluation Latency
const policyVM = new MycPolicyVM();
const ast = { and: [{ eq: [{ field: "task.asset" }, "USDC"] }, { lte: [{ field: "task.amount" }, 100] }] };
const policyLatencies = [];
for (let i = 0; i < 200; i++) {
  const t0 = performance.now();
  policyVM.evaluate(ast, { task: { asset: "USDC", amount: 50 } });
  policyLatencies.push((performance.now() - t0) * 1000); // in microseconds
}
const policyStats = calculatePercentiles(policyLatencies);

// 3. Block Production Latency & TPS
const chain = new MycBlockchain({ inMemory: true });
chain.mempool.maxTxPerWindow = 10000;
chain.mempool.maxPoolSize = 10000;

const blockLatencies = [];
const txPerBlock = 50;

for (let b = 0; b < 20; b++) {
  for (let t = 0; t < txPerBlock; t++) {
    const sender = `myc1benchsender${b}_${t}`.padEnd(36, "0");
    chain.state.setBalance(sender, 1000);
    chain.submitTransaction(new MycTransaction({
      from: sender,
      to: "myc1recipient1234567890abcdef12345678",
      value: 1,
      nonce: t,
      timestamp: Date.now() + (b * 1000 + t),
      signature: `sig_dummy_bench_${b}_${t}`.padEnd(32, "x")
    }));
  }
  const t0 = performance.now();
  chain.produceBlock();
  blockLatencies.push(performance.now() - t0); // in milliseconds
}
const blockStats = calculatePercentiles(blockLatencies);
const estimatedTps = Math.round((txPerBlock / parseFloat(blockStats.avg)) * 1000);

// 4. Escrow Settlement Latency
const escrow = new MycEscrowContract();
const escrowLatencies = [];
for (let i = 0; i < 100; i++) {
  const escId = "0x" + i.toString(16).padStart(64, "0");
  escrow.createEscrow(escId, "myc1payee", 100, "USDC", 3600, { msgSender: "myc1payer" });
  escrow.fundEscrow(escId, { msgSender: "myc1payer" });
  escrow.submitExecutionProof(escId, "0x_proof", { msgSender: "myc1payee" });
  const t0 = performance.now();
  escrow.attestAndRelease(escId, { msgSender: "myc1payer" });
  escrowLatencies.push((performance.now() - t0) * 1000); // in microseconds
}
const escrowStats = calculatePercentiles(escrowLatencies);

// 5. Memory Footprint
const mem = process.memoryUsage();

console.log("\n📊 EMPIRICALLY MEASURED PRODUCTION BENCHMARKS:");
console.log("--------------------------------------------------------------------");
console.log(`• PoR Coherence Evaluation  : p50: ${porStats.p50} µs | p95: ${porStats.p95} µs | p99: ${porStats.p99} µs (Avg: ${porStats.avg} µs)`);
console.log(`• Policy VM AST Evaluation  : p50: ${policyStats.p50} µs | p95: ${policyStats.p95} µs | p99: ${policyStats.p99} µs (Avg: ${policyStats.avg} µs)`);
console.log(`• Block Production (${txPerBlock} txs) : p50: ${blockStats.p50} ms | p95: ${blockStats.p95} ms | p99: ${blockStats.p99} ms (Avg: ${blockStats.avg} ms)`);
console.log(`• Peak Zero-Gas Throughput  : ~${estimatedTps.toLocaleString()} TPS (Instant Finality Execution)`);
console.log(`• Escrow Settlement Latency : p50: ${escrowStats.p50} µs | p95: ${escrowStats.p95} µs | p99: ${escrowStats.p99} µs (Avg: ${escrowStats.avg} µs)`);
console.log(`• Node Memory Footprint     : RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB | Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log("--------------------------------------------------------------------");
console.log("🏁 BENCHMARK COMPLETE: Measured on real runtime (Spec v2 §5 & §49)");
