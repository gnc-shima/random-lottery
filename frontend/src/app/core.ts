/**
 * フロント全体の共通定義
 *
 * 役割:
 * - 型定義（Config / 履歴 / APIレスポンス）
 * - 定数
 * - DOM参照の一元管理
 * - ランタイム状態(state)の共有
 */

export type UiText = {
  minLabel: string;
  maxLabel: string;
  startButton: string;
  clearButton: string;
  exportJsonButton: string;
  resultPrefix: string;
  resultSuffix: string;
  historyTitle: string;
  memoPlaceholder: string;
  historyEmptyText: string;
  deleteHistoryItemButton?: string;
  deleteHistoryItemConfirm?: string;
  rangeError: string;
  allNumbersUsedError?: string;
  uniqueWinnerFetchError?: string;
  apiUrlError: string;
  apiErrorPrefix: string;
  noResultForExport: string;
};

export type AppConfig = {
  appName: string;
  defaultAppName?: string;
  uiText: UiText;
  minDefault: number;
  maxDefault: number;
  api?: {
    dev?: string;
    prod?: string;
  };
  animation: {
    spinMs: number;
    tickMs: number;
    glowOnResultMs: number;
  };
  history: {
    maxItems: number;
    persistToLocalStorage: boolean;
    storageKey: string;
  };
};

export type HistoryItem = {
  winner: number;
  at: string;
  min?: number;
  max?: number;
  memo?: string;
};

export type WinnerResponse = {
  winner: number;
  min: number;
  max: number;
  at: string;
};

export const CUSTOM_TITLE_STORAGE_KEY = "lottery_custom_title_v1";
export const MASTER_VOLUME_DEFAULT = 0.4;
export const DEFAULT_LOCAL_API_PORT = 8787;
export const BGM_FADE_MS = 700;
export const BGM_FADE_IN_DELAY_MS = 1500;
export const BGM_BASE_GAIN = 0.1;
export const MASCOT_GREETING_SRC = "assets/genechma_greeting.png";
export const MASCOT_HIRAMEKI_SRC = "assets/genechma_hirameki.png";
export const MASCOT_IDLE_MOVE_CLASS = "idleMove";
export const MASCOT_IDLE_MIN_INTERVAL_MS = 4500;
export const MASCOT_IDLE_MAX_INTERVAL_MS = 11000;

export const el = {
  title: document.getElementById("title") as HTMLHeadingElement,
  mascotImage: document.getElementById("mascotImage") as HTMLImageElement,
  mascotWrap: document.querySelector(".mascot") as HTMLDivElement,
  bgmAudio: document.getElementById("bgmAudio") as HTMLAudioElement,
  drumrollAudio: document.getElementById("drumrollAudio") as HTMLAudioElement,
  cheerAudio: document.getElementById("cheerAudio") as HTMLAudioElement,
  btnMute: document.getElementById("btnMute") as HTMLButtonElement,
  volumeControl: document.getElementById("volumeControl") as HTMLInputElement,

  minLabel: document.getElementById("minLabel") as HTMLLabelElement,
  maxLabel: document.getElementById("maxLabel") as HTMLLabelElement,
  min: document.getElementById("min") as HTMLInputElement,
  max: document.getElementById("max") as HTMLInputElement,

  btnStart: document.getElementById("btnStart") as HTMLButtonElement,
  btnClear: document.getElementById("btnClear") as HTMLButtonElement,
  btnExport: document.getElementById("btnExport") as HTMLButtonElement,

  slot: document.getElementById("slot") as HTMLDivElement,
  result: document.getElementById("result") as HTMLDivElement,

  historyTitle: document.getElementById("historyTitle") as HTMLDivElement,
  historyNote: document.getElementById("historyNote") as HTMLDivElement,
  historyList: document.getElementById("historyList") as HTMLDivElement
};

export const state = {
  // main() 完了後に設定される
  cfg: null as AppConfig | null,
  // 最新の当選履歴（先頭が最新）
  historyItems: [] as HistoryItem[],
  // 全体音量（0..1）
  masterVolume: MASTER_VOLUME_DEFAULT,
  // BGMフェード用係数（0..1）
  bgmFadeLevel: 1,
  // フェード競合回避トークン
  bgmFadeToken: 0,
  // マスコット待機モーションのタイマーID
  mascotIdleTimerId: null as number | null
};

/**
 * 初期化済みのアプリ設定を返す。
 * まだ初期化されていない場合はエラーを投げる。
 */
export function getCfg(): AppConfig {
  if (!state.cfg) {
    throw new Error("App config is not initialized");
  }
  return state.cfg;
}
