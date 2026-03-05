/**
 * フロント初期化モジュール
 *
 * 役割:
 * - 設定読込
 * - 初期UI反映
 * - 音声/履歴/イベントの初期化
 */

import { el, state } from "./core.js";
import { initAudioDefaults, onVolumeInput, toggleMute } from "./audio.js";
import { clearBrowserCacheForDevMode, loadConfig } from "./config.js";
import { onClear, onStart } from "./draw.js";
import { startMascotIdleMotionLoop } from "./effects.js";
import { exportLatestResult, loadHistoryFromStorage, renderHistory } from "./history.js";
import { loadCustomTitle, onTitleBlur, onTitleInput, onTitleKeyDown, setAppName } from "./title.js";
import { applyUIText } from "./ui.js";
import type { AppConfig } from "./core.js";

/**
 * フロント画面の初期化を実行し、イベントを接続する。
 */
export async function main(): Promise<void> {
  state.cfg = (await loadConfig()) as AppConfig;
  await clearBrowserCacheForDevMode();

  const cfg = state.cfg;
  cfg.defaultAppName = cfg.appName;
  applyUIText();

  const customTitle = loadCustomTitle().trim();
  setAppName(customTitle || cfg.appName);

  el.min.value = String(cfg.minDefault);
  el.max.value = String(cfg.maxDefault);

  state.historyItems = loadHistoryFromStorage();
  renderHistory();

  initAudioDefaults();
  startMascotIdleMotionLoop();

  el.btnStart.addEventListener("click", onStart);
  el.btnClear.addEventListener("click", onClear);
  el.btnExport.addEventListener("click", exportLatestResult);
  el.btnMute.addEventListener("click", toggleMute);
  el.volumeControl.addEventListener("input", onVolumeInput);
  el.title.addEventListener("input", onTitleInput);
  el.title.addEventListener("keydown", onTitleKeyDown);
  el.title.addEventListener("blur", onTitleBlur);
}
