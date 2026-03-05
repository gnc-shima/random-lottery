/**
 * 履歴管理モジュール
 *
 * 役割:
 * - 履歴の保存/読込（localStorage）
 * - 履歴UIの描画/削除
 * - 最新結果のJSONエクスポート
 */

import { el, getCfg, state, type HistoryItem } from "./core.js";
import { showConfirmDialog, showMessageDialog } from "./dialogs.js";
import { getDialogTitle } from "./title.js";
import { formatJST, formatJSTForFilename } from "./utils.js";

/**
 * 履歴を localStorage に保存する。
 */
export function saveHistory() {
  const cfg = getCfg();
  if (!cfg.history.persistToLocalStorage) return;
  localStorage.setItem(cfg.history.storageKey, JSON.stringify(state.historyItems));
}

/**
 * localStorage から履歴を読み込む。
 */
export function loadHistoryFromStorage(): HistoryItem[] {
  const cfg = getCfg();
  if (!cfg.history.persistToLocalStorage) return [];
  const raw = localStorage.getItem(cfg.history.storageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

/**
 * 履歴一覧UIを再描画する。
 */
export function renderHistory() {
  const cfg = getCfg();
  el.historyList.innerHTML = "";
  el.historyNote.textContent = `${state.historyItems.length} 件`;

  if (state.historyItems.length === 0) {
    const empty = document.createElement("div");
    empty.style.opacity = ".85";
    empty.textContent = cfg.uiText.historyEmptyText;
    el.historyList.appendChild(empty);
    return;
  }

  for (let i = 0; i < state.historyItems.length; i++) {
    const item = state.historyItems[i];

    const row = document.createElement("div");
    row.className = "item";

    const left = document.createElement("div");
    left.className = "itemLeft";

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = String(item.winner);

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    meta.textContent = new Date(item.at).toLocaleString("ja-JP");

    left.appendChild(badge);
    left.appendChild(meta);

    const memo = document.createElement("input");
    memo.className = "memoInput";
    memo.type = "text";
    memo.placeholder = cfg.uiText.memoPlaceholder;
    memo.value = item.memo || "";

    memo.addEventListener("input", () => {
      state.historyItems[i].memo = memo.value.trim();
      saveHistory();
    });

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn danger historyDelete";
    btnDelete.textContent = cfg.uiText.deleteHistoryItemButton || "×";
    btnDelete.addEventListener("click", () => {
      void removeHistoryItem(i);
    });

    row.appendChild(left);
    row.appendChild(btnDelete);
    row.appendChild(memo);
    el.historyList.appendChild(row);
  }
}

/**
 * 指定インデックスの履歴1件を削除する。
 */
export async function removeHistoryItem(index: number): Promise<void> {
  const cfg = getCfg();
  const item = state.historyItems[index];
  if (!item) return;

  const defaultMessage = `当選番号 ${item.winner} の履歴を削除します。よろしいですか？`;
  const ok = await showConfirmDialog(getDialogTitle(), cfg.uiText.deleteHistoryItemConfirm || defaultMessage);
  if (!ok) return;

  state.historyItems.splice(index, 1);
  saveHistory();
  renderHistory();
}

/**
 * 新しい履歴を先頭に追加し、必要に応じて最大件数で切り詰める。
 */
export function pushHistory({ winner, at, min, max, memo }: { winner: number; at?: string; min?: number; max?: number; memo?: string }): void {
  const cfg = getCfg();
  state.historyItems.unshift({
    winner,
    at: at || new Date().toISOString(),
    min,
    max,
    memo: memo || ""
  });

  if (state.historyItems.length > cfg.history.maxItems) {
    state.historyItems = state.historyItems.slice(0, cfg.history.maxItems);
  }

  saveHistory();
  renderHistory();
}

/**
 * 最新履歴を含むJSONをダウンロードする。
 */
export function exportLatestResult() {
  const cfg = getCfg();
  if (state.historyItems.length === 0) {
    showMessageDialog(getDialogTitle(), cfg.uiText.noResultForExport);
    return;
  }

  const payload = {
    大会名: cfg.appName,
    当選履歴: state.historyItems.map(item => ({
      当選番号: item.winner,
      抽選時刻: formatJST(item.at),
      最小値: item.min ?? Number(el.min.value) ?? null,
      最大値: item.max ?? Number(el.max.value) ?? null,
      "当選者 商品": item.memo || ""
    })),
    JSON出力時刻: formatJST(new Date().toISOString())
  };

  const json = JSON.stringify(payload, null, 2);
  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(json);
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const bytes = new Uint8Array(bom.length + bodyBytes.length);
  bytes.set(bom, 0);
  bytes.set(bodyBytes, bom.length);

  const blob = new Blob([bytes], { type: "application/json; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeAppName = String(cfg.appName || "lottery").replace(/[\\/:*?"<>|]/g, "_").trim() || "lottery";
  const ts = formatJSTForFilename(new Date().toISOString());
  a.href = url;
  a.download = `${safeAppName}_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
