// npm run dev: runs the site on your computer at http://localhost:4321.
// The Edit button appears, and every edit is saved straight into the content/ files.
// Pages rebuild when content/ or src/ changes; refresh the browser to see them.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../src/lib/build.mjs";
import { saveSurah } from "../src/lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const port = +process.env.PORT || 4321;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };

function rebuild() {
  try { build(root, { dev: true }); console.log(new Date().toLocaleTimeString() + "  rebuilt"); }
  catch (e) { console.error("Build failed: " + e.message); }
}
rebuild();

let t = null;
for (const dir of ["content", "src"]) {
  fs.watch(path.join(root, dir), { recursive: true }, () => { clearTimeout(t); t = setTimeout(rebuild, 150); });
}

function send(res, code, type, body) { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); }

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "POST" && url.pathname === "/__save") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try { saveSurah(root, JSON.parse(body)); send(res, 200, "application/json", '{"ok":true}'); }
      catch (e) { send(res, 400, "application/json", JSON.stringify({ error: e.message })); }
    });
    return;
  }
  // clean URLs, like on Vercel: /112-al-ikhlas -> dist/112-al-ikhlas/index.html
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) return send(res, 403, "text/plain", "Forbidden");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return send(res, 404, TYPES[".html"], fs.readFileSync(path.join(dist, "404.html")));
  send(res, 200, TYPES[path.extname(file)] || "application/octet-stream", fs.readFileSync(file));
}).listen(port, () => console.log("Miracles of The Word is running at http://localhost:" + port + "  (Ctrl+C to stop)"));
