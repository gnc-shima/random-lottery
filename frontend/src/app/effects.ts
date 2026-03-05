/**
 * 視覚演出モジュール
 *
 * 役割:
 * - スロット回転演出
 * - 当選時の光/バンプ演出
 * - マスコット切り替え・待機モーション
 */

import {
  MASCOT_GREETING_SRC,
  MASCOT_HIRAMEKI_SRC,
  MASCOT_IDLE_MAX_INTERVAL_MS,
  MASCOT_IDLE_MIN_INTERVAL_MS,
  MASCOT_IDLE_MOVE_CLASS,
  el,
  state
} from "./core.js";
import { getRandomInt } from "./utils.js";

const SPIN_THEME_COLOR = "#2c4b76";
const FALLBACK_THEME_COLOR = "#5fa0f0";

/**
 * ブラウザUI用の theme-color を抽選状態に合わせて切り替える。
 */
function setThemeColorForSpin(enabled: boolean): void {
  const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeMeta) return;

  if (!themeMeta.dataset.defaultColor) {
    themeMeta.dataset.defaultColor = themeMeta.content || FALLBACK_THEME_COLOR;
  }
  themeMeta.content = enabled ? SPIN_THEME_COLOR : themeMeta.dataset.defaultColor;
}

/**
 * 当選確定までのスロット回転アニメーションを開始する。
 * 戻り値は停止関数。
 */
export function startSpinAnimation(min: number, max: number): () => void {
  el.slot.classList.add("shake");

  const id = setInterval(() => {
    el.slot.textContent = String(Math.floor(Math.random() * (max - min + 1)) + min);
  }, state.cfg?.animation.tickMs || 45);

  return () => {
    clearInterval(id);
    el.slot.classList.remove("shake");
  };
}

/**
 * スロットのグロー演出を有効化する。
 */
export function glowOn() {
  el.slot.classList.add("glow");
}

/**
 * スロットのグロー演出を無効化する。
 */
export function glowOff() {
  el.slot.classList.remove("glow");
}

/**
 * 当選ごとにマスコット画像を2パターンで切り替える。
 */
export function toggleMascotOnResult() {
  const currentSrc = String(el.mascotImage.getAttribute("src") || "");
  const nextSrc = currentSrc.includes("genechma_hirameki.png")
    ? MASCOT_GREETING_SRC
    : MASCOT_HIRAMEKI_SRC;
  el.mascotImage.setAttribute("src", nextSrc);
}

/**
 * 抽選中のフォーカスモード（背景暗転・待機モーション停止）を切り替える。
 */
export function setSpinFocusMode(enabled: boolean): void {
  if (enabled) {
    el.mascotWrap.classList.remove(MASCOT_IDLE_MOVE_CLASS);
  }
  document.documentElement.classList.toggle("isSpinning", enabled);
  document.body.classList.toggle("isSpinning", enabled);
  setThemeColorForSpin(enabled);
}

/**
 * マスコット待機モーションの次回実行を予約する。
 */
function queueNextMascotIdleMove(): void {
  if (state.mascotIdleTimerId !== null) {
    clearTimeout(state.mascotIdleTimerId);
  }

  const waitMs = getRandomInt(MASCOT_IDLE_MIN_INTERVAL_MS, MASCOT_IDLE_MAX_INTERVAL_MS);
  state.mascotIdleTimerId = window.setTimeout(() => {
    if (!document.body.classList.contains("isSpinning") && !el.mascotWrap.classList.contains("winnerHit")) {
      el.mascotWrap.classList.add(MASCOT_IDLE_MOVE_CLASS);
    }
    queueNextMascotIdleMove();
  }, waitMs);
}

/**
 * マスコット待機モーションのループ処理を開始する。
 */
export function startMascotIdleMotionLoop(): void {
  if (state.mascotIdleTimerId !== null) return;

  el.mascotWrap.addEventListener("animationend", ev => {
    const animationName = (ev as AnimationEvent).animationName;
    if (animationName === "mascotIdleWiggle" || animationName === "mascotIdleWiggleMobile") {
      el.mascotWrap.classList.remove(MASCOT_IDLE_MOVE_CLASS);
    }
  });

  queueNextMascotIdleMove();
}

/**
 * 当選時の一括ビジュアル演出（バンプ + 画面フラッシュ）を再生する。
 */
export function playWinVisualEffects() {
  const targets = [el.slot, el.result, el.mascotWrap];
  for (const t of targets) {
    t.classList.remove("winnerHit");
    void t.offsetWidth;
  }

  document.body.classList.remove("winnerFlash");
  void document.body.offsetWidth;

  el.slot.classList.add("winnerHit");
  el.result.classList.add("winnerHit");
  el.mascotWrap.classList.add("winnerHit");
  document.body.classList.add("winnerFlash");

  setTimeout(() => {
    el.slot.classList.remove("winnerHit");
    el.result.classList.remove("winnerHit");
    el.mascotWrap.classList.remove("winnerHit");
    document.body.classList.remove("winnerFlash");
  }, 1100);
}
