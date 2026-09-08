/**
 * M6 Sovereign Autonomous Agent Benchmark Suite (m6_agent_bench.js)
 * Validates fully local ReAct (Thought -> Action -> Observation) loops,
 * tool invocation consistency, and otonom planning resolution.
 */

import { ResonanceSDK } from '../sdk/resonance_sdk.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [\x1b[32mPASS\x1b[0m] ${message}`);
  } else {
    failed++;
    console.error(`  [\x1b[31mFAIL\x1b[0m] ${message}`);
  }
}

export async function runM6AgentBenchmark() {
  console.log("======================================================================");
  console.log("       M6 SOVEREIGN AUTONOMOUS AGENT BENCHMARKS (ReAct Loop)");
  console.log("======================================================================");

  // Initialize Resonance SDK (using small dimension 1024 to speed up FHRR memory indexing)
  const sdk = new ResonanceSDK({ D: 1024 });
  
  // Seed Memory Engine with target knowledge
  const colorVec = sdk.router.vectorize("favori renk");
  sdk.memory.addRecord({
    id: "color-memory",
    content: "Kullanıcının favori rengi kırmızıdır.",
    representation: colorVec
  });

  const cityVec = sdk.router.vectorize("doğduğu şehir");
  sdk.memory.addRecord({
    id: "city-memory",
    content: "Kullanıcının doğduğu şehir Ankara'dır.",
    representation: cityVec
  });

  const agent = sdk.createAgent();

  // ── TASK 1: MULTI-STEP MEMORY & MORPHOLOGY RE-ENTRY ───────────
  console.log("\n[Task 1] Running memory retrieval + morphology analysis task...");
  const goal1 = "Benim favori rengimi hafızadan bul ve bulduğun rengi morfolojik olarak analiz et.";
  
  const result1 = await agent.execute(goal1, 5);
  
  console.log("Execution steps run:", result1.stepsRun);
  for (const step of result1.logs) {
    console.log(`  Step ${step.step}:`);
    console.log(`    Thought    : ${step.thought}`);
    console.log(`    Action     : ${step.action}`);
    console.log(`    Argument   : ${step.argument}`);
    console.log(`    Observation: ${step.observation}`);
  }

  assert(result1.stepsRun >= 2, `ReAct loop executed multiple steps: ${result1.stepsRun}`);
  assert(result1.logs[0].action === "memory_lookup", `First action was memory lookup`);
  assert(result1.logs[0].observation.includes("kırmızıdır"), `First tool output successfully retrieved memory`);
  assert(result1.logs[1].action === "morphology_analyze", `Second action was morphology analysis`);
  assert(result1.logs[1].observation.includes("kırmızı"), `Second tool output analyzed root 'kırmızı'`);
  assert(result1.finalAnswer.includes("kırmızı"), `Final Answer correctly presents resolved color`);


  // ── TASK 2: ARITHMETIC EVALUATION & SPECTRAL SIGNATURE ────────
  console.log("\n[Task 2] Running arithmetic evaluation + spectral transform task...");
  const goal2 = "5 * 3 + 2 ifadesini hesapla ve çıkan sonucu spektral analizden geçir.";
  
  const result2 = await agent.execute(goal2, 5);
  
  console.log("Execution steps run:", result2.stepsRun);
  for (const step of result2.logs) {
    console.log(`  Step ${step.step}:`);
    console.log(`    Thought    : ${step.thought}`);
    console.log(`    Action     : ${step.action}`);
    console.log(`    Argument   : ${step.argument}`);
    console.log(`    Observation: ${step.observation}`);
  }

  assert(result2.stepsRun >= 2, `ReAct loop executed multiple steps: ${result2.stepsRun}`);
  assert(result2.logs[0].action === "math_eval", `First action was math evaluation`);
  assert(result2.logs[0].observation === "17", `First tool evaluated expression to '17'`);
  assert(result2.logs[1].action === "spectral_transform", `Second action was spectral transform`);
  assert(result2.finalAnswer.includes("17"), `Final Answer correctly presents evaluated result`);

  console.log("======================================================================");
  console.log(`M6 AGENT BENCHMARK COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("======================================================================\n");
}

if (process.argv[1] && (process.argv[1].endsWith('m6_agent_bench.js') || process.argv[1].endsWith('m6_agent_bench'))) {
  runM6AgentBenchmark();
}
