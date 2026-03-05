import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type RootConfig = {
  aws?: { region?: string };
  local?: { apiPort?: number; webPort?: number };
  hosting?: {
    appId?: string;
    appName?: string;
    branch?: string;
    repository?: string;
    oauthToken?: string;
    platform?: string;
    downConfirm?: string;
  };
  lambda?: {
    functionName?: string;
    executionRoleArn?: string;
    runtime?: string;
    handler?: string;
    timeout?: number;
    memorySize?: number;
  };
};

/**
 * `scripts/lib` から見たプロジェクトルート絶対パスを返す。
 */
export function getRootDir(): string {
  return resolve(join(fileURLToPath(new URL(".", import.meta.url)), "..", ".."));
}

/**
 * プロジェクトルートの `config.json` を読み込み、設定オブジェクトを返す。
 */
export function loadRootConfig(): RootConfig {
  const rootDir = getRootDir();
  const path = join(rootDir, "config.json");
  // config.json はこのプロジェクトの実行設定の単一ソース。
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as RootConfig;
}

/**
 * 必須設定値を検証し、空の場合はエラー終了する。
 */
export function requireValue<T>(value: T, keyName: string): NonNullable<T> {
  // 必須値がないままAWS CLIを叩くと意図しない操作になるため、即時終了する。
  if (value === undefined || value === null || value === "") {
    console.error(`${keyName} is required in config.json`);
    process.exit(1);
  }
  return value as NonNullable<T>;
}

/**
 * `config.json` の `hosting.appId` を指定値で更新する。
 */
export function saveHostingAppId(appId: string): void {
  const rootDir = getRootDir();
  const path = join(rootDir, "config.json");
  const raw = readFileSync(path, "utf8");
  const cfg = JSON.parse(raw) as RootConfig;

  const current = String(cfg?.hosting?.appId || "").trim();
  if (current === appId) return;

  cfg.hosting = cfg.hosting || {};
  cfg.hosting.appId = appId;
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}
