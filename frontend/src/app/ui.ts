/**
 * UIテキスト反映モジュール
 *
 * 役割:
 * - web_config の uiText を画面要素へ適用する
 */

import { el, getCfg } from "./core.js";

/**
 * 設定ファイルの `uiText` を各UI要素へ反映する。
 */
export function applyUIText() {
  const t = getCfg().uiText;

  const minLabelText = el.minLabel.querySelector(".labelText") as HTMLSpanElement;
  const maxLabelText = el.maxLabel.querySelector(".labelText") as HTMLSpanElement;

  minLabelText.textContent = t.minLabel;
  maxLabelText.textContent = t.maxLabel;

  el.btnStart.textContent = t.startButton;
  el.btnClear.textContent = t.clearButton;
  el.btnExport.textContent = t.exportJsonButton;

  el.historyTitle.textContent = t.historyTitle;
}
