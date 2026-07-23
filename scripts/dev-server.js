/**
 * Zero-dependency static file server for local development.
 * Serves the /web folder so the app can be viewed at http://localhost:PORT
 * instead of file:// (avoids browser file:// quirks with caching/extensions).
 * Not part of the shipped app — dev convenience only.
 */
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 5500;
const ROOT = path.join(__dirname, "..", "web");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Waggle dev server running at http://localhost:${PORT}`);
});
