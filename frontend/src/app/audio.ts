/**
 * 音声制御モジュール
 *
 * 役割:
 * - BGM / ドラムロール / 歓声音の再生制御
 * - ミュート、音量、BGMフェード制御
 *
 * 補足:
 * - iOS Safari など一部ブラウザは `HTMLMediaElement.volume` が効きにくいため、
 *   BGM は Web Audio API(GainNode) によるフェードにも対応する。
 */

import {
  BGM_BASE_GAIN,
  BGM_FADE_MS,
  MASTER_VOLUME_DEFAULT,
  el,
  state
} from "./core.js";

// BGMをWeb Audio APIで制御するためのノード群（対応ブラウザのみ使用）
let bgmAudioContext: AudioContext | null = null;
let bgmMediaSourceNode: MediaElementAudioSourceNode | null = null;
let bgmGainNode: GainNode | null = null;
let useBgmGainNode = false;

/**
 * AudioContext コンストラクタを取得する（Safariのwebkit系を含む）。
 */
function getAudioContextCtor(): (new () => AudioContext) | undefined {
  const w = window as Window & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext;
}

/**
 * BGM用の GainNode 経路を初期化する。
 * 失敗時は HTMLAudioElement.volume 制御へフォールバックする。
 */
function ensureBgmGainGraph(): void {
  if (useBgmGainNode) return;

  const Ctor = getAudioContextCtor();
  if (!Ctor) return;

  try {
    if (!bgmAudioContext) {
      bgmAudioContext = new Ctor();
    }
    if (!bgmMediaSourceNode) {
      bgmMediaSourceNode = bgmAudioContext.createMediaElementSource(el.bgmAudio);
    }
    if (!bgmGainNode) {
      bgmGainNode = bgmAudioContext.createGain();
    }

    bgmMediaSourceNode.connect(bgmGainNode);
    bgmGainNode.connect(bgmAudioContext.destination);
    useBgmGainNode = true;

    // GainNode経路では element.volume を固定(1.0)し、音量は gain のみで制御する。
    el.bgmAudio.volume = 1;
    applySoundVolumes();
  } catch {
    // 失敗時は従来どおり HTMLAudioElement.volume を使用する
  }
}

/**
 * BGM用 AudioContext が suspend 状態なら再開を試みる。
 */
function resumeBgmContextIfNeeded(): void {
  if (!bgmAudioContext) return;
  if (bgmAudioContext.state !== "suspended") return;
  void bgmAudioContext.resume().catch(() => {
    // ユーザー操作前などで resume できない場合は無視
  });
}

/**
 * 効果音を単発で再生する（先頭に戻して loop を無効化）。
 */
function playAudioOnce(player: HTMLAudioElement): void {
  try {
    player.currentTime = 0;
    player.loop = false;
    const p = player.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // 自動再生制限などで再生できない場合は無音で続行
      });
    }
  } catch {
    // 音声再生に失敗しても抽選処理は継続
  }
}

/**
 * アプリ内で扱う音声プレイヤー一覧を返す。
 */
export function getSoundPlayers(): HTMLAudioElement[] {
  return [el.bgmAudio, el.drumrollAudio, el.cheerAudio].filter(Boolean);
}

/**
 * 全プレイヤーへ一括でミュート状態を適用する。
 */
export function setMutedForAllSounds(muted: boolean): void {
  for (const player of getSoundPlayers()) {
    player.muted = muted;
  }
}

/**
 * masterVolume / bgmFadeLevel に基づいて実際の音量へ反映する。
 */
export function applySoundVolumes() {
  const clampedMaster = Math.max(0, Math.min(1, Number(state.masterVolume)));
  const clampedBgmFade = Math.max(0, Math.min(1, Number(state.bgmFadeLevel)));
  const bgmVolume = clampedMaster * clampedBgmFade * BGM_BASE_GAIN;

  // モバイルで volume が効かない場合は GainNode 側で制御する
  if (useBgmGainNode && bgmGainNode) {
    // GainNode経路時の二重減衰を防ぐ。
    if (el.bgmAudio.volume !== 1) {
      el.bgmAudio.volume = 1;
    }
    bgmGainNode.gain.value = bgmVolume;
  } else {
    el.bgmAudio.volume = bgmVolume;
  }

  el.drumrollAudio.volume = clampedMaster;
  el.cheerAudio.volume = clampedMaster;
}

/**
 * マスター音量（0..1）を更新して反映する。
 */
export function setMasterVolume(volume: number): void {
  state.masterVolume = Math.max(0, Math.min(1, Number(volume)));
  applySoundVolumes();
}

/**
 * BGM再生を開始（または再開）する。
 */
export function ensureBgmPlayback() {
  // ユーザー操作後に呼ばれるタイミングで GainNode を準備する。
  ensureBgmGainGraph();
  resumeBgmContextIfNeeded();

  el.bgmAudio.loop = true;
  const p = el.bgmAudio.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      // ユーザー操作前で再生不可の場合は無視
    });
  }
}

/**
 * ドラムロールを先頭から再生する。
 */
export function playDrumroll() {
  playAudioOnce(el.drumrollAudio);
}

/**
 * 歓声音を先頭から再生する。
 */
export function playCheer() {
  playAudioOnce(el.cheerAudio);
}

/**
 * ドラムロール再生を停止して先頭位置に戻す。
 */
export function stopDrumroll() {
  el.drumrollAudio.pause();
  el.drumrollAudio.currentTime = 0;
  el.drumrollAudio.loop = false;
}

/**
 * 現在のミュート状態をミュートボタン表示に反映する。
 */
export function renderMuteButton() {
  const [firstPlayer] = getSoundPlayers();
  const muted = firstPlayer ? Boolean(firstPlayer.muted) : true;
  el.btnMute.textContent = muted ? "🔇" : "🔊";
  el.btnMute.setAttribute("aria-pressed", muted ? "true" : "false");
  el.btnMute.setAttribute("aria-label", muted ? "音声をオンにする" : "音声をミュートにする");
}

/**
 * ミュート状態をトグルし、BGM再生も確保する。
 */
export function toggleMute() {
  const [firstPlayer] = getSoundPlayers();
  if (!firstPlayer) return;
  const nextMuted = !firstPlayer.muted;
  setMutedForAllSounds(nextMuted);
  renderMuteButton();
  // 初回のミュート解除時に再生を開始し、Autoplay制限に抵触しないようにする。
  if (!nextMuted) {
    ensureBgmPlayback();
  }
}

/**
 * 音量スライダー入力を masterVolume に反映する。
 */
export function onVolumeInput() {
  const normalized = Number(el.volumeControl.value) / 100;
  setMasterVolume(normalized);
}

/**
 * BGMフェード係数を指定値へアニメーション遷移させる。
 */
export function fadeBgmLevelTo(targetLevel: number, durationMs = BGM_FADE_MS): Promise<void> {
  const target = Math.max(0, Math.min(1, Number(targetLevel)));
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    state.bgmFadeLevel = target;
    applySoundVolumes();
    return Promise.resolve();
  }

  const token = ++state.bgmFadeToken;
  const start = state.bgmFadeLevel;
  const diff = target - start;
  const startedAt = performance.now();

  return new Promise<void>(resolve => {
    const step = (now: number) => {
      if (token !== state.bgmFadeToken) {
        resolve();
        return;
      }

      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      state.bgmFadeLevel = start + diff * t;
      applySoundVolumes();

      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * 初期音量・初期ミュート状態をセットする。
 * BGM再生はユーザー操作（ミュート解除や抽選開始）まで開始しない。
 */
export function initAudioDefaults() {
  const initialVolumeRaw = Number(el.volumeControl.value) / 100;
  const initialVolume = Number.isFinite(initialVolumeRaw) ? initialVolumeRaw : MASTER_VOLUME_DEFAULT;

  setMasterVolume(initialVolume);
  state.bgmFadeLevel = 1;
  applySoundVolumes();
  setMutedForAllSounds(true);
  renderMuteButton();
}
