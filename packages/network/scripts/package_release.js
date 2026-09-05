import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const distDir = path.resolve("./dist");
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const archivePath = path.join(distDir, "myc-network-latest.tar.gz");

console.log("Packaging MYCA Sovereign Core bundle...");
// Create tar.gz excluding node_modules, .git, and temporary files
execSync(`tar --exclude="node_modules" --exclude=".git" --exclude="dist" --exclude="*.log" -czf "${archivePath}" .`, {
  stdio: "inherit"
});

const stat = fs.statSync(archivePath);
console.log(`✅ Bundle created: ${archivePath} (${(stat.size / 1024).toFixed(1)} KB)`);
