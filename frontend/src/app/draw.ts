/**
 * 抽選フロー制御モジュール
 *
 * 役割:
 * - 抽選開始時の一連処理（演出 / API / 表示 / 履歴追加）
 * - 履歴全削除処理
 */

import { BGM_FADE_IN_DELAY_MS, BGM_FADE_MS, el, getCfg, state } from "./core.js";
import { fetchUniqueWinner, getUsedWinnerSetInRange } from "./api.js";
import { fadeBgmLevelTo, ensureBgmPlayback, playCheer, playDrumroll, stopDrumroll } from "./audio.js";
import { normalizeRange } from "./config.js";
import { showConfirmDialog, showMessageDialog } from "./dialogs.js";
import { glowOff, glowOn, playWinVisualEffects, setSpinFocusMode, startSpinAnimation, toggleMascotOnResult } from "./effects.js";
import { pushHistory, renderHistory, saveHistory } from "./history.js";
import { getDialogTitle } from "./title.js";
import { waitForNextPaint, waitMs } from "./utils.js";

/**
 * 抽選開始ボタン押下時のメインフローを実行する。
 * BGMフェード、抽選API、演出、履歴保存までを担う。
 */
export async function onStart() {
  const cfg = getCfg();
  let stopSpin: null | (() => void) = null;

  try {
    ensureBgmPlayback();

    el.btnStart.classList.remove("startBurst");
    void el.btnStart.offsetWidth;
    el.btnStart.classList.add("startBurst");
    setTimeout(() => el.btnStart.classList.remove("startBurst"), 600);

    el.btnStart.disabled = true;

    el.result.classList.add("resultHidden");
    glowOff();

    const minInput = parseInt(el.min.value, 10);
    const maxInput = parseInt(el.max.value, 10);
    const { min, max } = normalizeRange(minInput, maxInput);

    const usedSet = getUsedWinnerSetInRange(min, max);
    const candidateCount = (max - min + 1) - usedSet.size;
    if (candidateCount <= 0) {
      throw new Error(
        cfg.uiText.allNumbersUsedError ||
          "この範囲の番号はすべて当選済みです。履歴をクリアするか範囲を変更してください。"
      );
    }

    await fadeBgmLevelTo(0, BGM_FADE_MS);

    setSpinFocusMode(true);
    stopSpin = startSpinAnimation(min, max);
    const winnerPromise = fetchUniqueWinner(min, max, usedSet);
    const spinWaitPromise = waitMs(cfg.animation.spinMs);
    playDrumroll();

    const [data] = await Promise.all([winnerPromise, spinWaitPromise]);
    const winner = Number(data.winner);
    stopSpin();
    setSpinFocusMode(false);

    el.slot.textContent = String(winner);
    toggleMascotOnResult();
    playCheer();
    playWinVisualEffects();

    glowOn();
    setTimeout(glowOff, cfg.animation.glowOnResultMs);

    el.result.textContent = `${cfg.uiText.resultPrefix} ${winner} ${cfg.uiText.resultSuffix}`;
    el.result.classList.remove("resultHidden");

    await waitForNextPaint();
    pushHistory({ winner, at: data.at, min: data.min, max: data.max });
    await waitMs(BGM_FADE_IN_DELAY_MS);
    await fadeBgmLevelTo(1, BGM_FADE_MS);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    showMessageDialog(getDialogTitle(), message);
    if (stopSpin) stopSpin();
    setSpinFocusMode(false);
    stopDrumroll();
    await fadeBgmLevelTo(1, BGM_FADE_MS);
  } finally {
    setSpinFocusMode(false);
    el.btnStart.disabled = false;
  }
}

/**
 * 履歴全件を削除し、画面表示を初期状態へ戻す。
 */
export async function onClear() {
  const ok = await showConfirmDialog(getDialogTitle(), "履歴をすべて削除します。よろしいですか？");
  if (!ok) return;

  state.historyItems = [];
  saveHistory();
  renderHistory();
  el.slot.textContent = "???";
  el.result.classList.add("resultHidden");
}
