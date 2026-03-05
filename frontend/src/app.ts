/**
 * 抽選アプリ（フロントエントリポイント）
 * - 実装本体は `./app/` 配下の機能別モジュールへ分割
 */

import { showMessageDialog } from "./app/dialogs.js";
import { main } from "./app/main.js";
import { getDialogTitle } from "./app/title.js";

/**
 * 画面初期化に失敗した場合は、原因をモーダルでユーザーに通知する。
 */
main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error("app init failed:", e);
  showMessageDialog(getDialogTitle(), `初期化エラー: ${message}`);
});
