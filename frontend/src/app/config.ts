/**
 * 設定 / 実行環境ユーティリティ
 *
 * 役割:
 * - web_config 読み込み
 * - ローカル/本番判定
 * - API URL 解決
 * - 開発時キャッシュ掃除
 * - 入力範囲の正規化
 */

import { DEFAULT_LOCAL_API_PORT, getCfg } from "./core.js";

/**
 * 指定されたJSONファイルを no-store で取得する。
 * 読み込み失敗時は null を返す。
 */
async function fetchJsonNoStore(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 画面設定を読み込む。
 * `web_config.json` -> `web_config.example.json` の順でフォールバックする。
 */
export async function loadConfig() {
  const primary = await fetchJsonNoStore("./web_config.json");
  if (primary) return primary;

  const fallback = await fetchJsonNoStore("./web_config.example.json");
  if (fallback) return fallback;

  throw new Error("web_config.json / web_config.example.json が読めません");
}

/**
 * 実行環境がローカルホストかを判定する。
 */
export function isLocalHostRuntime() {
  const host = String(location.hostname || "");
  return host.includes("localhost") || host === "127.0.0.1";
}

/**
 * 現在の実行環境に応じてAPI URLを解決する。
 */
export function resolveApiUrl() {
  const cfg = getCfg();
  const devApi = String(cfg.api?.dev || "").trim();
  const prodApi = String(cfg.api?.prod || "").trim();

  if (isLocalHostRuntime()) {
    if (devApi) return devApi;
    return `${location.protocol}//${location.hostname}:${DEFAULT_LOCAL_API_PORT}/random`;
  }
  return prodApi;
}

/**
 * 開発時のキャッシュ影響を避けるため、Service Worker と Cache Storage を掃除する。
 */
export async function clearBrowserCacheForDevMode() {
  if (!isLocalHostRuntime()) return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (err) {
    console.warn("dev cache cleanup failed:", err);
  }
}

/**
 * 入力された最小値/最大値を検証し、必要に応じて大小を入れ替えて返す。
 */
export function normalizeRange(min: number, max: number): { min: number; max: number } {
  const cfg = getCfg();
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(cfg.uiText.rangeError);
  }
  if (min > max) [min, max] = [max, min];
  return { min, max };
}
