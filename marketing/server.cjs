// Tiny zero-dependency static file server for the BundleForge marketing site.
//
// Why CJS + plain Node http: Railway gives the service a Node 20 runtime by
// default; pulling in Express/serve just to map a single index.html would
// inflate the image and add an attack surface. This file is small enough
// to audit at a glance.
//
// Behaviour:
//   GET /            → marketing/index.html
//   GET /health      → 200 "ok"  (Railway healthcheck)
//   GET /<path>.html → marketing/<path>.html if exists
//   GET /<asset>     → marketing/<asset>      if exists (any file extension)
//   anything else    → 404 with a small fallback page that links home

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...extraHeaders });
  res.end(body);
}

function notFound(res) {
  send(
    res,
    404,
    `<!doctype html><meta charset="utf-8"><title>Not found · BundleForge</title>
     <body style="font-family:Inter,system-ui,sans-serif;padding:4rem;text-align:center;color:#1e293b">
     <h1 style="font-size:2rem">Page not found</h1>
     <p><a href="/" style="color:#1f5fa6">Back to bundleforge.app</a></p>`,
    { "Content-Type": "text/html; charset=utf-8" },
  );
}

function safeJoin(base, target) {
  // Resolve and ensure the result stays within base (no path traversal).
  const resolved = path.resolve(base, "." + target);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "method not allowed", { Allow: "GET, HEAD" });
  }

  // Strip query string for filesystem lookup.
  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath === "/health") {
    return send(res, 200, "ok", { "Content-Type": "text/plain" });
  }

  // Default route → index.html
  const targetPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = safeJoin(ROOT, targetPath);
  if (!filePath) return notFound(res);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    // Long cache for hashed assets, shorter for HTML so deploys propagate.
    const cache = ext === ".html" ? "public, max-age=300" : "public, max-age=3600";
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": cache,
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`bundleforge-marketing listening on :${PORT}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`received ${signal}, closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
