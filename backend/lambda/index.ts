/**
 * 本番Lambda（Node.js）
 * - min/max を受け取り、範囲内の整数乱数 winner を返す
 * - 抽選の“確定”をサーバ側に置く（フロント改ざん対策の基本）
 */

import { parseExclude, pickWinner } from "../shared/random.js";

type LambdaQuery = Record<string, string | undefined>;
type LambdaEvent = {
  queryStringParameters?: LambdaQuery | null;
};

type LambdaResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

/**
 * API Gateway からの抽選リクエストを処理する Lambda ハンドラ。
 */
export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  try {
    // API Gateway のクエリを読み取り
    const qs = event?.queryStringParameters ?? {};

    const min = Number(qs.min);
    const max = Number(qs.max);
    const exclude = parseExclude(qs.exclude);

    // 抽選ロジックは shared モジュールを利用
    const { winner, min: a, max: b } = pickWinner(min, max, exclude);

    return json(200, {
      winner,
      min: a,
      max: b,
      at: new Date().toISOString()
    });
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    return json(err.statusCode || 500, { error: err.message || "Server Error" });
  }
};

/**
 * Lambdaレスポンス形式でJSONを返すヘルパー。
 */
function json(statusCode: number, body: unknown): LambdaResponse {
  // ローカルAPIと同等のヘッダ構成（CORS有効）
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(body)
  };
}
