/**
 * APIアクセス / 抽選候補判定
 *
 * 役割:
 * - 抽選API呼び出し
 * - 履歴から既出番号の収集
 * - 重複回避付き当選番号取得
 */

import { getCfg, state, type WinnerResponse } from "./core.js";
import { resolveApiUrl } from "./config.js";

/**
 * APIエラーレスポンスから表示用の詳細文字列を取り出す。
 */
async function extractApiErrorDetails(res: Response): Promise<string> {
  try {
    const payload = await res.json();
    return payload?.error ? ` ${payload.error}` : "";
  } catch {
    return "";
  }
}

/**
 * 抽選APIを呼び出し、当選番号を取得する。
 */
export async function fetchWinner(min: number, max: number, excludeNumbers: number[] = []): Promise<WinnerResponse> {
  const cfg = getCfg();
  const apiUrl = resolveApiUrl();
  if (!apiUrl) {
    throw new Error(cfg.uiText.apiUrlError);
  }

  const url = new URL(apiUrl);
  url.searchParams.set("min", String(min));
  url.searchParams.set("max", String(max));
  if (excludeNumbers.length > 0) {
    url.searchParams.set("exclude", excludeNumbers.join(","));
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET" });
  } catch {
    throw new Error(`${cfg.uiText.apiErrorPrefix} 通信に失敗しました`);
  }

  if (!res.ok) {
    const details = await extractApiErrorDetails(res);
    throw new Error(`${cfg.uiText.apiErrorPrefix} ${res.status}${details}`);
  }
  return (await res.json()) as WinnerResponse;
}

/**
 * 履歴から、指定範囲内で既出の当選番号セットを作る。
 */
export function getUsedWinnerSetInRange(min: number, max: number): Set<number> {
  const used = new Set<number>();
  for (const item of state.historyItems) {
    const winner = Number(item?.winner);
    if (Number.isInteger(winner) && winner >= min && winner <= max) {
      used.add(winner);
    }
  }
  return used;
}

/**
 * 重複当選を避けながら、未当選番号を取得する。
 */
export async function fetchUniqueWinner(min: number, max: number, usedSet: Set<number>): Promise<WinnerResponse> {
  const cfg = getCfg();
  const excludeNumbers = Array.from(usedSet);
  const maxAttempts = 30;

  for (let i = 0; i < maxAttempts; i++) {
    const data = await fetchWinner(min, max, excludeNumbers);
    const winner = Number(data.winner);
    if (!usedSet.has(winner)) return data;
  }

  throw new Error(
    cfg.uiText.uniqueWinnerFetchError ||
      "未当選番号を取得できませんでした。再度お試しください。"
  );
}
