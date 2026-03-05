/**
 * Deploy DOWN:
 * - Amplify Hosting と Lambda を削除する（破壊的）
 */

import { spawnSync } from "node:child_process";

/**
 * TypeScript スクリプトを実行し、失敗時は即終了する。
 */
function runTsScript(scriptPath: string, label: string): void {
  console.log(`\n${label}`);
  const result = spawnSync("npx", ["--yes", "tsx", scriptPath], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Hosting -> Lambda の順で破壊的削除を実行する。
 */
function main(): void {
  console.log("Deploy down start");

  // 削除順は Hosting -> Lambda。参照側を先に落として整合を保つ。
  runTsScript("scripts/hosting-down.ts", "[1/2] Hosting down");
  runTsScript("scripts/lambda-down.ts", "[2/2] Lambda down");

  console.log("Deploy down completed");
}

main();
