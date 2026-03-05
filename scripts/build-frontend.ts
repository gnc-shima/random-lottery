/**
 * Frontend Build:
 * - TypeScriptソースを1ファイルにbundle
 * - minifyして配信用 `frontend/dist/app.js` を生成
 */

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const outFile = join(rootDir, "frontend", "dist", "app.js");
const versionFile = join(rootDir, "frontend", "dist", "app.version.json");

mkdirSync(dirname(outFile), { recursive: true });

const result = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    "frontend/src/app.ts",
    "--bundle",
    "--minify",
    "--format=esm",
    "--platform=browser",
    "--target=es2020",
    "--outfile=frontend/dist/app.js"
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

if (result.status !== 0) {
  console.error("Failed to bundle frontend.");
  process.exit(result.status ?? 1);
}

/**
 * Date を `YYYYMMDDHHmmss` 形式に整形する。
 */
function formatVersionFromDate(date: Date): string {
  const pad2 = (n: number): string => String(n).padStart(2, "0");
  return [
    String(date.getFullYear()),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds())
  ].join("");
}

const appMtime = statSync(outFile).mtime;
const version = formatVersionFromDate(appMtime);
writeFileSync(versionFile, JSON.stringify({ version }, null, 2), "utf8");

console.log(`Frontend bundle generated: ${outFile}`);
console.log(`Frontend version generated: ${versionFile} (v=${version})`);
