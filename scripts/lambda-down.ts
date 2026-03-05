/**
 * Lambda DOWN:
 * - 対象Lambda関数を削除する（破壊的）
 */

import { spawnSync } from "node:child_process";
import { loadRootConfig, requireValue } from "./lib/config.js";

const cfg = loadRootConfig();
const functionName = requireValue(cfg?.lambda?.functionName, "lambda.functionName");
const region = cfg?.aws?.region || "ap-northeast-1";

// up/down の命名統一に合わせ、down は関数削除を実行する。
const result = spawnSync(
  "aws",
  [
    "lambda",
    "delete-function",
    "--function-name",
    functionName,
    "--region",
    region,
    "--no-cli-pager"
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, AWS_PAGER: "" }
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Lambda DOWN completed: ${functionName} (${region})`);
console.log("Lambda function deleted.");
