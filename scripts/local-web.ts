/**
 * Local Web server:
 * - frontend ディレクトリを静的配信する
 * - ローカル開発用の最小HTTPサーバ
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const WEB_ROOT = process.env.WEB_ROOT
  ? resolve(process.env.WEB_ROOT)
  : resolve(process.cwd(), "frontend");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon"
};

/**
 * パストラバーサルを避けるため、URLパスを配信ルート相対パスへ正規化する。
 */
function safePath(pathname: string): string {
  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const rel = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  return rel || "index.html";
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
    let filePath = safePath(url.pathname);
    let absPath = join(WEB_ROOT, filePath);

    try {
      const data = await readFile(absPath);
      const type = MIME[extname(absPath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(data);
      return;
    } catch {
      // index.html fallback for SPA-like routes
      if (!extname(filePath)) {
        absPath = join(WEB_ROOT, "index.html");
        const html = await readFile(absPath);
        res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
        res.end(html);
        return;
      }
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Server Error");
  }
}).listen(PORT, () => {
  console.log(`Local web running: http://localhost:${PORT}`);
});
