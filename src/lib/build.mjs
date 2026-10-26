// Builds the static site into dist/: one pre-rendered page per surah, the home
// page, a 404 page, sitemap and robots, and the shared CSS and scripts.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadSources, loadDictionary, listSurahs, loadSurah } from "./content.mjs";
import { createView, esc } from "../client/render.js";

export const SITE_URL = "https://miraclesoftheword.vercel.app";

const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
// JSON inside a <script> tag must not be able to close it
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

export function build(root, { dev = false } = {}) {
  const src = path.join(root, "src"), out = path.join(root, "dist");
  const tpl = (name) => fs.readFileSync(path.join(src, "templates", name), "utf8");
  fs.rmSync(out, { recursive: true, force: true });

  // Assets go into a folder named after a hash of their contents (/assets/<hash>/), so browsers can
  // cache them for a year and still pick up every new version, including the scripts they import.
  const files = [["styles", "site.css"], ...fs.readdirSync(path.join(src, "client")).sort().map((f) => ["client", f])];
  const hash = crypto.createHash("sha1");
  for (const [dir, f] of files) hash.update(f).update(fs.readFileSync(path.join(src, dir, f)));
  const v = hash.digest("hex").slice(0, 10);
  fs.mkdirSync(path.join(out, "assets", v), { recursive: true });
  for (const [dir, f] of files) fs.copyFileSync(path.join(src, dir, f), path.join(out, "assets", v, f));
  const head = dev ? '<meta name="motw-dev" content="1">' : "";

  const base = tpl("base.html");
  const page = (file, vars) => {
    const html = fill(base, { v, head, ...vars });
    fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
    fs.writeFileSync(path.join(out, file), html, "utf8");
  };

  const shared = { sources: loadSources(root), dictionary: loadDictionary(root) };
  const surahs = listSurahs(root).map((slug) => loadSurah(root, slug, shared));

  for (const doc of surahs) {
    const s = doc.surah;
    const main = createView({ doc, editing: false }).page();
    page(doc.slug + "/index.html", {
      title: "Sūrat " + esc(s.nameTr) + " · Miracles of The Word",
      description: esc(s.tagline || "A verse-by-verse study of Sūrat " + s.nameTr),
      url: SITE_URL + "/" + doc.slug,
      body: fill(tpl("surah.html"), { main, doc: safeJson(doc), v }),
      head: head + '<link rel="modulepreload" href="/assets/' + v + '/render.js">',
    });
  }

  const list = surahs.map((d) => {
    const s = d.surah;
    return `<li><a href="/${d.slug}"><span class="num">${s.number}</span><span class="en">${esc(s.nameTr)}<small>${esc(s.nameEn)} · ${d.verses.length} verses</small></span><span class="ar" lang="ar">${esc(s.nameAr)}</span></a></li>`;
  }).join("");
  page("index.html", {
    title: "Miracles of The Word",
    description: "A verse-by-verse study of the Qurʾān's language for English readers: every word's root and meanings, the layers of meaning in each verse, and the linguistic miracle behind them.",
    url: SITE_URL + "/",
    body: fill(tpl("index.html"), { list, v }),
  });
  page("404.html", { title: "Page not found · Miracles of The Word", description: "", url: SITE_URL + "/", body: fill(tpl("404.html"), { v }) });

  fs.writeFileSync(path.join(out, "sitemap.xml"),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [SITE_URL + "/"].concat(surahs.map((d) => SITE_URL + "/" + d.slug)).map((u) => "  <url><loc>" + u + "</loc></url>").join("\n") + "\n</urlset>\n");
  fs.writeFileSync(path.join(out, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + SITE_URL + "/sitemap.xml\n");

  return { surahs: surahs.map((d) => d.slug) };
}
