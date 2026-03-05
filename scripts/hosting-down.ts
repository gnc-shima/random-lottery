/**
 * Hosting DOWN:
 * - Amplify Hosting アプリを削除する（破壊的）
 * - 誤実行防止のため `config.json` の `hosting.downConfirm=DELETE` が必須
 */

import { spawnSync } from "node:child_process";
import { loadRootConfig, requireValue } from "./lib/config.js";

const cfg = loadRootConfig();
const appId = requireValue(cfg?.hosting?.appId, "hosting.appId");
const region = cfg?.aws?.region || "ap-northeast-1";
const confirm = cfg?.hosting?.downConfirm;

if (confirm !== "DELETE") {
  console.error("This operation deletes the Amplify Hosting app.");
  console.error("Set hosting.downConfirm to DELETE in config.json to continue.");
  process.exit(1);
}

const result = spawnSync(
  "aws",
  ["amplify", "delete-app", "--app-id", appId, "--region", region, "--no-cli-pager"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, AWS_PAGER: "" }
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Hosting DOWN completed: ${appId} (${region})`);
console.log("Amplify Hosting app deleted.");
