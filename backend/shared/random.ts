/**
 * `exclude=1,2,3` 形式を Set<number> に変換する。
 * 不正値は 400 エラー扱いにする。
 */
export function parseExclude(raw: unknown): Set<number> {
  if (!raw) return new Set<number>();

  const values = String(raw)
    .split(",")
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => Number(v));

  if (values.some(v => !Number.isInteger(v))) {
    const err = new Error("exclude は整数のカンマ区切りで指定してください") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  return new Set<number>(values);
}

/**
 * 抽選ロジック本体（ローカルAPI / Lambda 共通）
 * - min/max を正規化
 * - exclude された番号を候補から除外
 * - 候補が無ければ 400 エラー
 */
export function pickWinner(
  min: number,
  max: number,
  excludeSet: Set<number> = new Set<number>()
): { winner: number; min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const err = new Error("min と max は数値で指定してください") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  if (min > max) [min, max] = [max, min];

  if (max - min > 1_000_000) {
    const err = new Error("範囲が大きすぎます（max-min <= 1,000,000）") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  const candidates: number[] = [];
  for (let n = min; n <= max; n++) {
    if (!excludeSet.has(n)) candidates.push(n);
  }

  if (candidates.length === 0) {
    const err = new Error("この範囲の番号はすべて当選済みです") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  return { winner, min, max };
}
