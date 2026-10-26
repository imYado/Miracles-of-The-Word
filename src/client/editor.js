// Edit mode. Downloaded only when Edit is pressed.
// On your computer (npm run dev) every change is saved straight into the content/ files.
// On the live site (/<surah>#edit) changes are kept in this browser; Copy JSON, then `npm run import`.
import { esc, empty, getPath } from "./render.js";

const ORDER = ["consensus", "scholar", "reflection"];
const BANNED = [
  { re: /qir[aā]['ʾ’]?[aā]t|qira'a|variant reading/i, msg: "Mentions qiraʾāt. Project rule: no different qiraʾāt." },
  { re: /scien(ce|tific)|modern discover/i, msg: "Possible scientific miracle claim. Project rule: none." }
];
const clone = (o) => JSON.parse(JSON.stringify(o));
const blank = () => ({ text: "", tag: "", scholar: "", sources: [], review: false });

export function start(app) {
  const { state, view } = app;
  const original = clone(state.doc);
  const KEY = "motw-draft-" + state.doc.slug + "-v" + state.doc.schema;
  const $ = (id) => document.getElementById(id);
  const get = (p) => getPath(state.doc, p);
  function set(p, v) { const ks = p.split("."), last = ks.pop(); ks.reduce((o, k) => o[k], state.doc)[last] = v; }
  let newWords = 0;

  const NEW = {
    claim: blank,
    note: () => Object.assign({ topic: "Word choice", title: "" }, blank()),
    layer: () => ({ reading: "", translation: "", note: "", explanation: blank(), tafsir: [] }),
    word: () => {
      let id; do { id = "new-word-" + (++newWords); } while (state.doc.dictionary[id]);
      state.doc.dictionary[id] = { root: "", rootTr: "", rootMeaning: "", meanings: [], translations: [], lexicon: [], review: false };
      return { entry: id, ar: "", tr: "", used: [], why: blank(), special: null };
    },
    text: () => "",
    source: () => ({ id: "", text: "" }),
    ringunit: () => ({ label: "", ref: "", text: "" }),
    ringpair: () => ({ a: 0, b: 1, note: "" }),
  };

  /* ---------- Saving ---------- */
  const status = (t) => { $("status").textContent = t; };
  let saveT = null;
  function save() {
    status("Saving…");
    clearTimeout(saveT);
    saveT = setTimeout(app.dev ? saveToFiles : saveToBrowser, app.dev ? 700 : 300);
  }
  function saveToBrowser() {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), doc: state.doc })); status("Saved in this browser · Copy JSON to keep it"); }
    catch (e) { status("Not saved: this browser blocks storage. Use Copy JSON."); }
  }
  async function saveToFiles() {
    try {
      const res = await fetch("/__save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(state.doc) });
      const out = await res.json();
      status(res.ok ? "Saved to content/surahs/" + state.doc.slug + "/" : "Not saved: " + out.error);
    } catch (e) { status("Not saved: the dev server is not answering. Is npm run dev still running?"); }
  }

  /* ---------- Keeping shared data consistent ---------- */
  // "used" lists name translations by their text, so they follow renames and drop deleted ones.
  function syncUsed() {
    for (const v of state.doc.verses) for (const w of v.words) {
      const e = state.doc.dictionary[w.entry];
      w.used = e ? w.used.filter((t) => e.translations.includes(t)) : [];
    }
  }
  function renameUsed(entry, from, to) {
    for (const v of state.doc.verses) for (const w of v.words) if (w.entry === entry) w.used = w.used.map((t) => (t === from ? to : t));
  }
  function relinkEntry(path, raw) {
    const w = get(path), id = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!id || id === w.entry) return false;
    const dict = state.doc.dictionary;
    const others = state.doc.verses.some((v) => v.words.some((x) => x !== w && x.entry === w.entry));
    if (!dict[id]) {
      // a new name: rename the entry if only this word used it, otherwise give this word its own copy
      dict[id] = others ? clone(dict[w.entry]) : dict[w.entry];
      if (!others) delete dict[w.entry];
    } else if (!others) {
      delete dict[w.entry];
    }
    w.entry = id;
    syncUsed();
    return true;
  }

  /* ---------- Rules check ---------- */
  function allClaims() {
    const out = [], s = state.doc.surah;
    const add = (c, where, at) => { if (c) out.push({ c, where, at }); };
    s.theme.forEach((c) => add(c, "Surah · Central theme", "whole"));
    s.miracle.forEach((c) => add(c, "Surah · " + (c.title || "Miracle note"), "whole"));
    add(s.revelation, "Surah · Place of revelation", "whole");
    ["previous", "next"].forEach((k) => s.links[k].claims.forEach((c) => add(c, "Surah · Neighbouring surah", "whole")));
    if (s.ring.supported) add(s.ring.claim, "Surah · Ring composition", "whole");
    state.doc.verses.forEach((v) => {
      const V = "Verse " + v.n, at = "v" + v.n;
      v.words.forEach((w) => { add(w.why, V + " · " + (w.tr || "word") + " · why", at); add(w.special, V + " · " + (w.tr || "word") + " · beyond the dictionary", at); });
      v.layers.forEach((l, i) => { add(l.explanation, V + " · Layer " + (i + 1), at); l.tafsir.forEach((c) => add(c, V + " · Layer " + (i + 1) + " · Tafsir", at)); });
      v.miracle.forEach((c) => add(c, V + " · " + (c.title || "Miracle note"), at));
      if (v.asbab.exists) {
        ["narration", "grading"].forEach((k) => add(v.asbab[k], V + " · Reason for revelation (" + k + ")", at));
        if (v.asbab.disagreement && v.asbab.disagreement.text) add(v.asbab.disagreement, V + " · Reason for revelation (disagreement)", at);
      }
    });
    return out;
  }
  function checks() {
    const issues = []; let review = 0;
    const claims = allClaims();
    const reviewed = new Set();
    claims.forEach(({ c, where, at }) => {
      if (empty(c.text)) { issues.push({ where, at, msg: "Empty claim." }); return; }
      if (!c.tag) issues.push({ where, at, msg: "No tag." });
      if (c.tag === "scholar" && empty(c.scholar)) issues.push({ where, at, msg: "Scholar's view without a scholar's name." });
      if (c.tag === "scholar" && !(c.sources || []).length) issues.push({ where, at, msg: "Scholar's view with no source.", warn: true });
      (c.sources || []).forEach((s) => { if (s.id && !state.doc.sources[s.id]) issues.push({ where, at, msg: "Unknown source \"" + s.id + "\". Add it to content/sources.yaml." }); });
      if (c.review) review++;
      BANNED.forEach((b) => { if (b.re.test(c.text)) issues.push({ where, at, msg: b.msg, warn: true }); });
    });
    const ring = state.doc.surah.ring;
    if (ring.supported) {
      if (ring.claim.tag !== "scholar" || empty(ring.claim.scholar)) issues.push({ where: "Surah · Ring composition", at: "whole", warn: !!ring.demo, msg: ring.demo ? "Shown as a demo. Cite the scholar who verifies this ring, then turn the demo label off." : "A ring is shown only when a named scholar has verified it. Tag the claim Scholar's view and name the scholar." });
      if (ring.units.length < 3) issues.push({ where: "Surah · Ring composition", at: "whole", msg: "A ring needs at least three sections." });
      ring.pairs.forEach((q, i) => { if (empty(q.note)) issues.push({ where: "Surah · Ring " + (i + 1), at: "whole", msg: "Explain what connects the two sections.", warn: true }); });
    }
    state.doc.verses.forEach((v) => {
      const V = "Verse " + v.n, at = "v" + v.n;
      if (empty(v.literal)) issues.push({ where: V, at, msg: "Literal translation is missing." });
      if (!v.layers.length) issues.push({ where: V, at, msg: "No layers of meaning.", warn: true });
      v.words.forEach((w) => {
        const W = V + " · " + (w.tr || "word"), e = state.doc.dictionary[w.entry];
        if (empty(w.ar)) issues.push({ where: W, at, msg: "Arabic word is empty." });
        if (!e) { issues.push({ where: W, at, msg: "No dictionary entry." }); return; }
        if (e.review && !reviewed.has(w.entry)) { review++; reviewed.add(w.entry); }
        if (!e.meanings.length) issues.push({ where: W, at, msg: "No classical meanings in its dictionary entry." });
        if (!w.used.length) issues.push({ where: W, at, msg: "No translation marked as meant here.", warn: true });
      });
    });
    return { issues, review, total: claims.length };
  }
  function renderChecks() {
    const r = checks(), bad = r.issues.length;
    $("btn-check").innerHTML = (bad ? '<span class="count-bad">' + bad + " to fix</span>" : '<span class="count-ok">All ' + r.total + " claims tagged</span>") + " · " + r.review + " to verify";
    $("issues").innerHTML = r.issues.length
      ? r.issues.map((i) => '<a href="#' + i.at + '"' + (i.warn ? ' class="warn"' : "") + "><span>" + esc(i.where) + "</span>" + esc(i.msg) + "</a>").join("")
      : '<a href="#whole" class="warn"><span>Project rules</span>Nothing to fix. Items marked verify still need scholar review.</a>';
  }

  /* ---------- Redrawing ---------- */
  function redraw() { app.rerender(); app.refreshCard(); renderChecks(); }

  /* ---------- Events (only act while editing) ---------- */
  document.addEventListener("input", (e) => {
    if (!state.editing) return;
    const el = e.target.closest("[data-path]");
    if (!el || el.tagName === "SELECT") return;
    const p = el.dataset.path, val = el.innerText.replace(/\n+$/, "");
    const m = /^dictionary\.([a-z0-9-]+)\.translations\.(\d+)$/.exec(p);
    if (m) renameUsed(m[1], get(p), val);
    set(p, val);
    // keep every copy of an Arabic word in sync while typing in the card
    const w = /^verses\.(\d+)\.words\.(\d+)\.ar$/.exec(p);
    if (w) document.querySelectorAll('#main .w[data-v="' + w[1] + '"][data-w="' + w[2] + '"]').forEach((x) => { x.textContent = val; });
    save(); renderChecks();
    if (p.startsWith("surah.ring.")) app.drawRing();
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!state.editing || el.tagName !== "SELECT" || !el.dataset.path) return;
    set(el.dataset.path, el.dataset.num ? +el.value : el.value);
    save(); redraw();
  });
  document.addEventListener("focusout", (e) => {
    const el = e.target.closest && e.target.closest("[data-entry]");
    if (!state.editing || !el) return;
    if (relinkEntry(el.dataset.entry, el.innerText)) { save(); redraw(); }
  });
  document.addEventListener("paste", (e) => {
    if (!state.editing || !e.target.closest || !e.target.closest("[contenteditable]")) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
  document.addEventListener("keydown", (e) => {
    const el = state.editing && e.target.closest && e.target.closest('[contenteditable="true"]');
    if (el && e.key === "Enter" && el.tagName !== "P" && el.tagName !== "DIV") { e.preventDefault(); el.blur(); }
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t || !state.editing || t.closest("#ebar")) return;
    const d = t.dataset;
    if (d.add) get(d.add).push(NEW[d.kind]());
    else if (d.del) {
      const ks = d.del.split("."), i = +ks.pop(); get(ks.join(".")).splice(i, 1);
      if (d.closecard) app.closeCard();
      syncUsed();
    }
    else if (d.cycle) { const c = get(d.cycle); c.tag = ORDER[(ORDER.indexOf(c.tag) + 1) % ORDER.length]; }
    else if (d.toggle) set(d.toggle, !get(d.toggle));
    else if (d.use) {
      const w = get(d.use), tr = state.doc.dictionary[w.entry].translations[+d.ti];
      w.used = w.used.includes(tr) ? w.used.filter((x) => x !== tr) : w.used.concat(tr);
    }
    else if (d.setclaim) set(d.setclaim, blank());
    else if (d.unset) set(d.unset, null);
    else if (d.ringsample) {
      // a neutral placeholder layout to edit, not a claim about this surah
      const r = state.doc.surah.ring;
      r.units = ["A", "B", "C", "B′", "A′"].map((l, i) => ({ label: l, ref: "Verses …", text: i === 2 ? "The center: the section the ring turns on" : "Section " + l }));
      r.pairs = [{ a: 0, b: 4, note: "What links the opening and the closing" }, { a: 1, b: 3, note: "What links these two" }];
    }
    else if (d.move) {
      const ks = d.move.split("."), i = +ks.pop(), arr = get(ks.join(".")), j = i + (+d.dir);
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      const at = app.cardAt(); if (at) at.wi = j;
    }
    else return;
    save(); redraw();
  });

  /* ---------- Bottom bar ---------- */
  $("btn-check").addEventListener("click", (e) => { const box = $("issues"); box.hidden = !box.hidden; e.currentTarget.setAttribute("aria-expanded", !box.hidden); });
  $("issues").addEventListener("click", (e) => { if (e.target.closest("a")) $("issues").hidden = true; });
  $("btn-copy").addEventListener("click", () => {
    const text = JSON.stringify(state.doc, null, 2);
    const fallback = () => { openModal(text); $("import-err").textContent = "Copying is blocked here. The JSON is selected; copy it with your keyboard."; $("import-text").select(); };
    try { navigator.clipboard.writeText(text).then(() => status("Copied. Save it as a file, then run: npm run import <file>"), fallback); } catch (err) { fallback(); }
  });
  function openModal(text) { $("modal").hidden = false; $("import-text").value = text || ""; $("import-err").textContent = ""; $("import-text").focus(); }
  $("btn-import").addEventListener("click", () => openModal(""));
  $("import-cancel").addEventListener("click", () => { $("modal").hidden = true; });
  $("import-go").addEventListener("click", () => {
    try {
      const d = JSON.parse($("import-text").value);
      if (!d || !d.surah || !Array.isArray(d.verses) || !d.dictionary) throw new Error("shape");
      if (d.slug !== state.doc.slug) throw new Error("slug");
      d.sources = state.doc.sources;
      state.doc = d; $("modal").hidden = true; save(); redraw(); status("Imported");
    } catch (err) {
      $("import-err").textContent = err.message === "shape" ? "This JSON is not a surah file from this editor." : err.message === "slug" ? "This JSON belongs to another surah." : "This is not valid JSON. Check that you pasted the whole file.";
    }
  });
  const reset = $("btn-reset"); let resetT = null;
  reset.textContent = app.dev ? "Undo this session" : "Restore original";
  reset.addEventListener("click", () => {
    if (!reset.classList.contains("armed")) {
      reset.classList.add("armed"); reset.textContent = "Click again to confirm";
      resetT = setTimeout(() => { reset.classList.remove("armed"); reset.textContent = app.dev ? "Undo this session" : "Restore original"; }, 4000);
      return;
    }
    clearTimeout(resetT); reset.classList.remove("armed"); reset.textContent = app.dev ? "Undo this session" : "Restore original";
    state.doc = clone(original);
    if (app.dev) save(); else { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    app.closeCard(); redraw(); status(app.dev ? "Undone. The files are back to how they were when you opened the page." : "Restored the published version");
  });
  $("btn-done").addEventListener("click", () => toggle());

  function toggle() {
    state.editing = !state.editing;
    app.editBtn.setAttribute("aria-pressed", state.editing);
    app.editBtn.textContent = state.editing ? "Editing" : "Edit";
    $("ebar").hidden = !state.editing;
    if (state.editing && !app.dev) {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved && saved.doc && JSON.stringify(saved.doc) !== JSON.stringify(state.doc)) {
          saved.doc.sources = state.doc.sources;
          state.doc = saved.doc;
          status("Loaded your browser draft from " + new Date(saved.at).toLocaleString());
        } else status("Editing · changes are kept in this browser");
      } catch (e) { status("Editing"); }
    } else if (state.editing) status("Editing · changes save to the content files");
    app.closeCard(); redraw();
  }
  return { toggle };
}
