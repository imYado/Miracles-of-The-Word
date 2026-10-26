// Reads the content/ folder into one "surah document" per surah, and writes an
// edited document back into the same files.
//
// content/
//   sources.yaml                 every book, written once, referenced by id
//   dictionary/<entry>.yaml      one word, shared by every verse that uses it
//   surahs/<NNN-name>/
//     surah.yaml                 overview, theme, neighbours, ring composition
//     verses/<n>.yaml            words, literal, layers, miracle notes, asbab
//
// The surah document the pages use looks like:
//   { slug, surah, verses, dictionary: { <entry>: {...} }, sources: { <id>: {...} } }

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const read = (file) => YAML.parse(fs.readFileSync(file, "utf8")) ?? {};
const write = (file, data, header) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = YAML.stringify(data, { lineWidth: 0 });
  fs.writeFileSync(file, (header ? "# " + header + "\n" : "") + body, "utf8");
};

/* ---------- Normalising (fill defaults on load, drop empties on save) ---------- */

export function claim(c) {
  if (c == null) return null;
  return {
    text: c.text ?? "",
    tag: c.tag ?? "",
    scholar: c.scholar ?? "",
    sources: (c.sources ?? []).map((s) => (typeof s === "string" ? { text: s } : s)),
    review: !!c.review,
  };
}
function compactClaim(c) {
  if (c == null) return null;
  const o = { text: c.text, tag: c.tag };
  if (c.scholar) o.scholar = c.scholar;
  const src = (c.sources ?? []).filter((s) => s.id || s.text).map((s) => (s.id ? (s.loc ? { id: s.id, loc: s.loc } : { id: s.id }) : { text: s.text }));
  if (src.length) o.sources = src;
  if (c.review) o.review = true;
  return o;
}
const note = (n) => Object.assign({ topic: n.topic ?? "", title: n.title ?? "" }, claim(n));
const compactNote = (n) => Object.assign({ topic: n.topic, title: n.title }, compactClaim(n));

function entry(e) {
  return {
    root: e.root ?? "", rootTr: e.rootTr ?? "", rootMeaning: e.rootMeaning ?? "",
    meanings: e.meanings ?? [], translations: e.translations ?? [],
    lexicon: (e.lexicon ?? []).map((s) => (typeof s === "string" ? { text: s } : s)),
    review: !!e.review,
  };
}
function compactEntry(e) {
  const o = {};
  if (e.root) o.root = e.root;
  o.rootTr = e.rootTr;
  if (e.rootMeaning) o.rootMeaning = e.rootMeaning;
  o.meanings = e.meanings;
  o.translations = e.translations;
  const lex = (e.lexicon ?? []).filter((s) => s.id || s.text);
  if (lex.length) o.lexicon = lex.map((s) => (s.id ? (s.loc ? { id: s.id, loc: s.loc } : { id: s.id }) : { text: s.text }));
  if (e.review) o.review = true;
  return o;
}

function verse(v) {
  return {
    n: v.n,
    words: (v.words ?? []).map((w) => ({
      entry: w.entry ?? "", ar: w.ar ?? "", tr: w.tr ?? "", used: w.used ?? [],
      why: claim(w.why ?? {}), special: claim(w.special),
    })),
    literal: v.literal ?? "",
    layers: (v.layers ?? []).map((l) => ({
      reading: l.reading ?? "", translation: l.translation ?? "", note: l.note ?? "",
      explanation: claim(l.explanation ?? {}), tafsir: (l.tafsir ?? []).map(claim),
    })),
    miracle: (v.miracle ?? []).map(note),
    asbab: v.asbab?.exists
      ? { exists: true, narration: claim(v.asbab.narration ?? {}), grading: claim(v.asbab.grading ?? {}), disagreement: claim(v.asbab.disagreement ?? {}) }
      : { exists: false, note: v.asbab?.note ?? "" },
  };
}
function compactVerse(v) {
  const asbab = v.asbab.exists
    ? { exists: true, narration: compactClaim(v.asbab.narration), grading: compactClaim(v.asbab.grading), ...(v.asbab.disagreement?.text ? { disagreement: compactClaim(v.asbab.disagreement) } : {}) }
    : { exists: false, ...(v.asbab.note ? { note: v.asbab.note } : {}) };
  return {
    n: v.n,
    literal: v.literal,
    words: v.words.map((w) => {
      const o = { entry: w.entry, ar: w.ar, tr: w.tr, used: w.used, why: compactClaim(w.why) };
      if (w.special) o.special = compactClaim(w.special);
      return o;
    }),
    layers: v.layers.map((l) => ({
      reading: l.reading, translation: l.translation, note: l.note,
      explanation: compactClaim(l.explanation), tafsir: l.tafsir.map(compactClaim),
    })),
    miracle: v.miracle.map(compactNote),
    asbab,
  };
}

function surahInfo(s) {
  const r = s.ring ?? {};
  return {
    number: s.number, nameAr: s.nameAr ?? "", nameTr: s.nameTr ?? "", nameEn: s.nameEn ?? "",
    tagline: s.tagline ?? "", status: s.status ?? "",
    theme: (s.theme ?? []).map(claim),
    miracle: (s.miracle ?? []).map(note),
    revelation: claim(s.revelation ?? {}),
    links: {
      previous: { surah: s.links?.previous?.surah ?? "", claims: (s.links?.previous?.claims ?? []).map(claim) },
      next: { surah: s.links?.next?.surah ?? "", claims: (s.links?.next?.claims ?? []).map(claim) },
    },
    ring: {
      supported: !!r.supported, demo: !!r.demo, claim: claim(r.claim ?? {}),
      units: (r.units ?? []).map((u) => ({ label: u.label ?? "", ref: u.ref ?? "", text: u.text ?? "" })),
      pairs: (r.pairs ?? []).map((p) => ({ a: +p.a || 0, b: +p.b || 0, note: p.note ?? "" })),
    },
  };
}
function compactSurah(s) {
  return {
    number: s.number, nameAr: s.nameAr, nameTr: s.nameTr, nameEn: s.nameEn, tagline: s.tagline,
    ...(s.status ? { status: s.status } : {}),
    theme: s.theme.map(compactClaim),
    miracle: s.miracle.map(compactNote),
    revelation: compactClaim(s.revelation),
    links: {
      previous: { surah: s.links.previous.surah, claims: s.links.previous.claims.map(compactClaim) },
      next: { surah: s.links.next.surah, claims: s.links.next.claims.map(compactClaim) },
    },
    ring: {
      supported: s.ring.supported, ...(s.ring.demo ? { demo: true } : {}),
      claim: compactClaim(s.ring.claim), units: s.ring.units, pairs: s.ring.pairs,
    },
  };
}

/* ---------- Loading ---------- */

export function loadSources(root) {
  return read(path.join(root, "content", "sources.yaml"));
}
export function loadDictionary(root) {
  const dir = path.join(root, "content", "dictionary"), out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) out[f.slice(0, -5)] = entry(read(path.join(dir, f)));
  return out;
}
export function listSurahs(root) {
  const dir = path.join(root, "content", "surahs");
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "surah.yaml"))).sort();
}
export function loadSurah(root, slug, shared) {
  const dir = path.join(root, "content", "surahs", slug);
  const sources = shared?.sources ?? loadSources(root);
  const dict = shared?.dictionary ?? loadDictionary(root);
  const verses = fs.readdirSync(path.join(dir, "verses")).filter((f) => /^\d+\.yaml$/.test(f))
    .map((f) => verse(read(path.join(dir, "verses", f)))).sort((a, b) => a.n - b.n);
  const dictionary = {};
  for (const v of verses) for (const w of v.words) {
    if (!w.entry) continue;
    if (!dict[w.entry]) throw new Error(`${slug} verse ${v.n}: word "${w.ar}" points to dictionary entry "${w.entry}", which does not exist in content/dictionary/`);
    dictionary[w.entry] = dict[w.entry];
  }
  return { schema: 4, slug, surah: surahInfo(read(path.join(dir, "surah.yaml"))), verses, dictionary, sources };
}

/* ---------- Saving ---------- */

export function saveSurah(root, doc) {
  if (!/^[0-9]{3}-[a-z0-9-]+$/.test(doc.slug ?? "")) throw new Error("The surah document has no valid slug (like 112-al-ikhlas).");
  const dir = path.join(root, "content", "surahs", doc.slug);
  const surah = surahInfo(doc.surah);
  write(path.join(dir, "surah.yaml"), compactSurah(surah), `Sūrat ${surah.nameTr} (${surah.number})`);
  const keep = new Set();
  for (const raw of doc.verses) {
    const v = verse(raw);
    write(path.join(dir, "verses", v.n + ".yaml"), compactVerse(v), `${surah.nameTr} ${surah.number}:${v.n}`);
    keep.add(v.n + ".yaml");
  }
  for (const f of fs.readdirSync(path.join(dir, "verses"))) if (/^\d+\.yaml$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(dir, "verses", f));
  // Only the dictionary entries this surah uses are written; other surahs' entries are untouched.
  const used = new Set(doc.verses.flatMap((v) => v.words.map((w) => w.entry)).filter(Boolean));
  for (const id of used) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Dictionary entry names may only use a-z, 0-9 and "-": "${id}"`);
    if (doc.dictionary[id]) write(path.join(root, "content", "dictionary", id + ".yaml"), compactEntry(entry(doc.dictionary[id])), "Shared dictionary entry. Every verse that uses this word reads it from here.");
  }
}
