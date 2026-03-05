/**
 * Local UP:
 * - ローカルAPI (`backend/local/server.ts`) と静的フロント配信を同時起動
 * - PID を `.run/` 配下に保存
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRootConfig } from "./lib/config.js";

const rootDir = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const runDir = join(rootDir, ".run");
const pidFile = join(runDir, "local-processes.json");
const cfg = loadRootConfig();
const apiPort = Number(cfg?.local?.apiPort ?? 8787);
const webPort = Number(cfg?.local?.webPort ?? 5173);

mkdirSync(runDir, { recursive: true });

if (existsSync(pidFile)) {
  console.log("Existing local services detected. Running local-stop before local-up...");
  const stopResult = spawnSync("npm", ["run", "local-stop"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (stopResult.status !== 0) {
    console.error("Failed to stop existing local services.");
    process.exit(stopResult.status ?? 1);
  }
}

const buildFrontend = spawnSync("npm", ["run", "build:frontend"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: process.platform === "win32"
});
if (buildFrontend.status !== 0) {
  console.error("Failed to build frontend TypeScript.");
  process.exit(buildFrontend.status ?? 1);
}

/**
 * PowerShell 文字列リテラルとして安全に使えるようクォートする。
 */
function psQuote(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * 子プロセスをバックグラウンド起動し、取得できればPIDを返す。
 */
function startDetached(command: string, args: string[], cwd: string, env?: Record<string, string>): number | undefined {
  if (process.platform === "win32") {
    const envAssignments = Object.entries(env || {})
      .map(([k, v]) => `$env:${k}=${psQuote(v)};`)
      .join("");
    const argList = `@(${args.map(a => psQuote(a)).join(",")})`;
    const script = `${envAssignments}$p=Start-Process -FilePath ${psQuote(command)} -ArgumentList ${argList} -WorkingDirectory ${psQuote(cwd)} -WindowStyle Hidden -PassThru;$p.Id`;
    const launched = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      stdio: "pipe",
      shell: false,
      windowsHide: true
    });
    if (launched.status !== 0) return undefined;
    const pidText = launched.stdout.toString("utf8").trim();
    const pid = Number(pidText);
    return Number.isFinite(pid) ? pid : undefined;
  }

  const child = spawn(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    detached: true,
    stdio: "ignore",
    shell: false
  });
  child.unref();
  return child.pid;
}

/**
 * 既定ブラウザで指定URLを開く。
 */
function openBrowser(url: string): void {
  let command = "";
  let args: string[] = [];

  if (process.platform === "win32") {
    command = "explorer.exe";
    args = [url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    shell: false,
    windowsHide: true
  });
  child.unref();
}

const tsxCliPath = join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
const apiPid = startDetached(process.execPath, [tsxCliPath, "backend/local/server.ts"], rootDir, {
  PORT: String(apiPort)
});
const webPid = startDetached(process.execPath, [tsxCliPath, "scripts/local-web.ts"], rootDir, {
  PORT: String(webPort),
  WEB_ROOT: join(rootDir, "frontend")
});
const webUrl = `http://localhost:${webPort}`;

// 停止処理(local-stop)で参照するため、起動メタ情報をJSONで永続化する。
writeFileSync(
  pidFile,
  JSON.stringify(
    {
      startedAt: new Date().toISOString(),
      apiPid,
      webPid,
      apiUrl: `http://localhost:${apiPort}/random`,
      webUrl
    },
    null,
    2
  )
);

openBrowser(webUrl);

console.log("Local services started.");
console.log(`- API PID: ${apiPid} (http://localhost:${apiPort}/random)`);
console.log(`- Web PID: ${webPid} (${webUrl})`);
console.log(`- Browser opened: ${webUrl}`);
console.log(`- PID file: ${pidFile}`);
