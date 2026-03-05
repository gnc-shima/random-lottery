/**
 * Lambda UP:
 * - Lambda が無ければ作成、あれば更新（コード反映）
 * - パッケージ対象: TypeScript をビルドした backend/lambda/index.js, backend/shared/random.js
 */

import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootConfig, requireValue } from "./lib/config.js";

const rootDir = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const runDir = join(rootDir, ".run");
const buildDir = join(runDir, "lambda-build");
const zipPath = join(runDir, "lambda-package.zip");
const cfg = loadRootConfig();

const functionName = requireValue(cfg?.lambda?.functionName, "lambda.functionName");
const region = cfg?.aws?.region || "ap-northeast-1";
const roleArn = cfg?.lambda?.executionRoleArn || "";
const runtime = cfg?.lambda?.runtime || "nodejs22.x";
const handler = cfg?.lambda?.handler || "backend/lambda/index.handler";
const timeout = String(cfg?.lambda?.timeout ?? 10);
const memorySize = String(cfg?.lambda?.memorySize ?? 128);

/**
 * AWS CLI を実行する。`inherit=false` で出力を抑制できる。
 */
function runAws(args: string[], inherit = true): ReturnType<typeof spawnSync> {
  return spawnSync(
    "aws",
    // ページャー停止で対話待ちを防ぐ（CI/自動化でも同じ挙動にする）。
    [...args, "--region", region, "--no-cli-pager"],
    {
      stdio: inherit ? "inherit" : "pipe",
      shell: process.platform === "win32",
      env: { ...process.env, AWS_PAGER: "" }
    }
  );
}

/**
 * Lambda同梱対象の TypeScript をビルドする。
 */
function compileLambdaSources(): void {
  mkdirSync(runDir, { recursive: true });
  rmSync(buildDir, { recursive: true, force: true });

  const result = spawnSync("npx", ["--yes", "tsc", "-p", "tsconfig.lambda.json"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    console.error("Failed to compile TypeScript for lambda package.");
    process.exit(result.status ?? 1);
  }
}

/**
 * ビルド成果物を Lambda デプロイ用 ZIP に固める。
 */
function buildPackage(): void {
  rmSync(zipPath, { force: true });

  let result;
  if (process.platform === "win32") {
    const safeZipPath = zipPath.replace(/\\/g, "/");
    result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        // Windows の Compress-Archive で個別ファイル指定すると
        // ZIP 内のディレクトリ階層が崩れるため backend ディレクトリ単位で固める。
        `Compress-Archive -Path "backend" -DestinationPath "${safeZipPath}" -Force`
      ],
      { cwd: buildDir, stdio: "inherit", shell: true }
    );
  } else {
    result = spawnSync(
      "zip",
      ["-r", zipPath, "backend/lambda/index.js", "backend/shared/random.js"],
      { cwd: buildDir, stdio: "inherit" }
    );
  }

  if (result.status !== 0) {
    console.error("Failed to build lambda package.");
    process.exit(result.status ?? 1);
  }
}

/**
 * 対象 Lambda 関数が既に存在するか確認する。
 */
function functionExists(): boolean {
  // 既存関数の有無で create/update を分岐する。
  const result = runAws(["lambda", "get-function", "--function-name", functionName], false);
  return result.status === 0;
}

compileLambdaSources();
buildPackage();

if (functionExists()) {
  const updateCode = runAws([
    "lambda",
    "update-function-code",
    "--function-name",
    functionName,
    "--zip-file",
    `fileb://${zipPath}`
  ]);
  if (updateCode.status !== 0) process.exit(updateCode.status ?? 1);

  const updateConfig = runAws([
    "lambda",
    "update-function-configuration",
    "--function-name",
    functionName,
    "--runtime",
    runtime,
    "--handler",
    handler,
    "--timeout",
    timeout,
    "--memory-size",
    memorySize
  ]);
  if (updateConfig.status !== 0) process.exit(updateConfig.status ?? 1);

  console.log(`Lambda updated: ${functionName} (${region})`);
} else {
  if (!roleArn) {
    console.error("lambda.executionRoleArn is required for create.");
    process.exit(1);
  }

  const createFn = runAws([
    "lambda",
    "create-function",
    "--function-name",
    functionName,
    "--runtime",
    runtime,
    "--handler",
    handler,
    "--role",
    roleArn,
    "--timeout",
    timeout,
    "--memory-size",
    memorySize,
    "--zip-file",
    `fileb://${zipPath}`
  ]);
  if (createFn.status !== 0) process.exit(createFn.status ?? 1);

  console.log(`Lambda created: ${functionName} (${region})`);
}
