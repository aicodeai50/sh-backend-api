#!/usr/bin/env node
/**
 * Full backend verification: platform health + company flow.
 * Usage: node scripts/verify-all.js
 *        API_BASE=http://127.0.0.1:8080 node scripts/verify-all.js
 */

const { spawnSync } = require("child_process");
const path = require("path");

function run(script) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("=== Platform / Railway health ===");
run("verify-railway.js");

console.log("\n=== Company enterprise flow (production) ===");
process.env.API_BASE =
  process.env.API_BASE || "https://sh-backend-api-production.up.railway.app";
run("verify-company.js");

console.log("\nAll verification checks passed.");
