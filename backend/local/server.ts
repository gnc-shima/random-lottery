/**
 * ローカル用 API サーバ（HTTP）
 * - API Gateway + Lambda の代わりに /random を提供する
 * - 本番と同じJSON形式を返す（winner, min, max, at）
 */

import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { parseExclude, pickWinner } from "../shared/random.js";

/**
 * Lambda 互換ヘッダー付きJSONレスポンスを返す。
 */
function sendJson(res: ServerResponse<IncomingMessage>, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(body));
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

http
  .createServer((req, res) => {
    try {
      // CORS preflight / favicon は即時応答
      if (req.method === "OPTIONS") return sendJson(res, 204, {});
      if (req.method === "GET" && req.url === "/favicon.ico") return sendJson(res, 204, {});

      const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);

      if (req.method === "GET" && url.pathname === "/random") {
        const min = Number(url.searchParams.get("min"));
        const max = Number(url.searchParams.get("max"));
        const exclude = parseExclude(url.searchParams.get("exclude"));

        // 抽選ロジックは shared モジュールを利用
        const { winner, min: a, max: b } = pickWinner(min, max, exclude);

        return sendJson(res, 200, {
          winner,
          min: a,
          max: b,
          at: new Date().toISOString()
        });
      }

      return sendJson(res, 404, { error: "Not Found" });
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return sendJson(res, err.statusCode || 500, { error: err.message || "Server Error" });
    }
  })
  .listen(PORT, () => {
    console.log(`Local API running: http://localhost:${PORT}/random`);
  });
