// SPDX-License-Identifier: MIT
import { execSync } from "child_process";

console.log("====================================================================");
console.log("🍄 10,000 SOLD-OUT HARDCAP & COLONY MESH PROTOCOL TEST RUNNER");
console.log("====================================================================");

try {
  execSync("node scripts/simulate_full_soldout_mesh.js", { stdio: "inherit" });
} catch (e) {
  console.error("❌ 10,000 Sold-Out & Colony Mesh test failed:", e);
  process.exit(1);
}
