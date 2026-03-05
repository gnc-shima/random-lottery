/**
 * 汎用ユーティリティ
 *
 * 役割:
 * - await系ヘルパー
 * - 日時フォーマット
 * - 乱数ユーティリティ
 */

type JstPart = "year" | "month" | "day" | "hour" | "minute" | "second";

/**
 * 次の描画フレームまで待機する。
 */
export function waitForNextPaint(): Promise<void> {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * 指定ミリ秒だけ待機する。
 */
export function waitMs(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * ISO日時を JST 部品に分解し、部品取得用の関数を返す。
 */
function getJstPartGetter(iso: string): (type: JstPart) => string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);

  return (type: JstPart): string => parts.find(p => p.type === type)?.value || "00";
}

/**
 * ISO日時を `YYYY-MM-DD HH:mm:ss`（JST）で返す。
 */
export function formatJST(iso: string): string {
  const get = getJstPartGetter(iso);
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * ISO日時をファイル名向け `YYYYMMDDHHmmss`（JST）で返す。
 */
export function formatJSTForFilename(iso: string): string {
  const get = getJstPartGetter(iso);
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

/**
 * min..max（両端含む）の整数乱数を返す。
 */
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
