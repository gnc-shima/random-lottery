/**
 * 大会タイトル関連
 *
 * 役割:
 * - タイトルの表示更新
 * - contenteditable の入力イベント処理
 * - カスタムタイトルの localStorage 保存/復元
 */

import { CUSTOM_TITLE_STORAGE_KEY, el, getCfg, state } from "./core.js";

/**
 * 保存済みのカスタムタイトルを読み込む。
 */
export function loadCustomTitle() {
  try {
    return localStorage.getItem(CUSTOM_TITLE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * カスタムタイトルを localStorage へ保存する。
 */
export function saveCustomTitle(title: string): void {
  try {
    if (title) {
      localStorage.setItem(CUSTOM_TITLE_STORAGE_KEY, title);
    } else {
      localStorage.removeItem(CUSTOM_TITLE_STORAGE_KEY);
    }
  } catch {
    // localStorage に保存できない環境でもアプリ動作は継続
  }
}

/**
 * アプリ名を画面・document.title・設定値へ反映する。
 */
export function setAppName(nextName: string): void {
  const cfg = getCfg();
  const appName = String(nextName || cfg.defaultAppName || "").trim() || cfg.defaultAppName;
  cfg.appName = appName;
  document.title = appName;
  el.title.textContent = appName;
}

/**
 * ダイアログ表示に使うタイトル文字列を優先順位付きで返す。
 */
export function getDialogTitle(): string {
  const fromHeader = String(el.title?.textContent || "").trim();
  const fromConfig = String(state.cfg?.appName || "").trim();
  const fromDoc = String(document.title || "").trim();
  return fromHeader || fromConfig || fromDoc || "抽選アプリ";
}

/**
 * タイトル入力中の内容を即時反映・保存する。
 */
export function onTitleInput() {
  const cfg = getCfg();
  const raw = (el.title.textContent || "").trim();
  const appName = raw || cfg.defaultAppName;
  cfg.appName = appName;
  document.title = appName;
  saveCustomTitle(raw);
}

/**
 * タイトル入力確定時に空文字をデフォルト名へ戻す。
 */
export function onTitleBlur() {
  const cfg = getCfg();
  const raw = (el.title.textContent || "").trim();
  setAppName(raw || cfg.defaultAppName);
  saveCustomTitle(raw);
}

/**
 * タイトル編集中の Enter 改行を抑止する。
 */
export function onTitleKeyDown(ev: KeyboardEvent): void {
  if (ev.key === "Enter") {
    ev.preventDefault();
  }
}
