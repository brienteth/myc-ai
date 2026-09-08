// SPDX-License-Identifier: MIT
import { execSync } from "child_process";

console.log("====================================================================");
console.log("🧪 PRODUCTION-v2.1 HARDENED ADVERSARIAL GATE TEST RUNNER");
console.log("====================================================================");

try {
  execSync("node scripts/simulate_node_sale_and_rewards.js", { stdio: "inherit" });
} catch (e) {
  console.error("❌ Adversarial test runner failed");
  process.exit(1);
}
