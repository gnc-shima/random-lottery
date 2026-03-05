/**
 * Local STOP:
 * - `.run/local-processes.json` に記録されたPIDを停止
 * - Local UP で起動したAPI/フロント配信をまとめて終了
 */

import { readFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type LocalState = {
  apiPid?: number;
  webPid?: number;
};

const rootDir = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const pidFile = join(rootDir, ".run", "local-processes.json");

if (!existsSync(pidFile)) {
  console.log("No running local processes found (PID file missing).");
  process.exit(0);
}

const state = JSON.parse(readFileSync(pidFile, "utf8")) as LocalState;
const pids = [state.apiPid, state.webPid].filter((pid): pid is number => Boolean(pid));

/**
 * 指定PIDのプロセスを停止する（Windows は taskkill を使用）。
 */
function stopPid(pid: number): void {
  if (process.platform === "win32") {
    // Windows は process.kill より taskkill の方が子プロセスまで確実に止められる。
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // process already exited
  }
}

for (const pid of pids) {
  stopPid(pid);
}

// PIDファイルを消して「停止済み」を明示する。
rmSync(pidFile, { force: true });

console.log("Local services stopped.");
for (const pid of pids) {
  console.log(`- Stopped PID: ${pid}`);
}
