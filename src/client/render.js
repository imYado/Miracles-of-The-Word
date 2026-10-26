// Turns a surah document into HTML. Runs in two places with the same code:
// at build time (Node) to pre-render every page, and in the browser to draw
// word cards and to redraw the page in edit mode.

export const TAGS = { consensus: "Consensus", scholar: "Scholar's view", reflection: "Reflection" };
export const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const empty = (s) => !s || !String(s).trim();

export function getPath(doc, p) { return p.split(".").reduce((o, k) => (o == null ? o : o[k]), doc); }

// Ring pairs, normalised so a < b, with each ring's nesting level (0 = outermost).
export function ringPairs(r) {
  const ps = r.pairs.map((q, i) => ({ i, a: Math.min(+q.a, +q.b), b: Math.max(+q.a, +q.b), note: q.note }))
    .filter((q) => q.a !== q.b && q.a >= 0 && q.b < r.units.length);
  ps.forEach((q) => { q.level = ps.filter((o) => o.a < q.a && o.b > q.b).length; });
  return ps;
}
// Readers see a ring only when it is claimed and a named scholar backs it, or it is marked as a demo.
export function ringVerified(r) { return r.supported && r.claim && r.claim.tag === "scholar" && !empty(r.claim.scholar) && r.units.length >= 3; }
export function ringShown(r) { return ringVerified(r) || (r.supported && r.demo && r.units.length >= 3); }

/**
 * state: { doc, editing }
 * Everything reads state at call time, so the editor can flip `editing` and re-render.
 */
export function createView(state) {
  const get = (p) => getPath(state.doc, p);

  // Editable text. Plain text when reading; the same element becomes editable in place when editing.
  function ed(p, tag, cls, ph, ar) {
    tag = tag || "span";
    const v = get(p);
    const a = (cls ? ' class="' + cls + '"' : "") + (ar ? ' dir="rtl" lang="ar"' : "");
    if (!state.editing) return "<" + tag + a + ">" + esc(v) + "</" + tag + ">";
    return "<" + tag + a + ' contenteditable="true" spellcheck="' + (ar ? "false" : "true") + '" data-path="' + p + '" data-ph="' + esc(ph || "Write here") + '">' + esc(v) + "</" + tag + ">";
  }
  const btn = (attrs, label, x) => state.editing ? '<button type="button" class="ebtn' + (x ? " x" : "") + '" ' + attrs + ">" + label + "</button>" : "";
  const addBtn = (p, kind, label) => btn('data-add="' + p + '" data-kind="' + kind + '"', "+ " + label);
  const delBtn = (p, label) => btn('data-del="' + p + '"', label || "Remove", true);

  /* ---------- Sources ---------- */
  function srcText(s) {
    if (!s.id) return esc(s.text);
    const src = state.doc.sources[s.id];
    if (!src) return '<span class="src missing" title="Not in content/sources.yaml">' + esc(s.id) + (s.loc ? ", " + esc(s.loc) : "") + "</span>";
    const title = [src.title, src.author].filter(Boolean).join(" · ");
    return '<span class="src" title="' + esc(title) + '">' + esc(src.short || src.title) + (s.loc ? ", " + esc(s.loc) : "") + "</span>";
  }
  const srcList = (list) => (list || []).map(srcText).join("; ");
  function srcEdit(p) {
    const list = get(p) || [];
    const ids = Object.keys(state.doc.sources);
    return list.map((s, i) => {
      const q = p + "." + i;
      const opts = '<option value="">Other (type it)</option>' + ids.map((id) => '<option value="' + id + '"' + (s.id === id ? " selected" : "") + ">" + esc(state.doc.sources[id].short || id) + "</option>").join("");
      return '<span class="src-row"><select data-path="' + q + '.id" aria-label="Source">' + opts + "</select>" +
        (s.id ? ed(q + ".loc", "span", "", "where (e.g. on 112:1)") : ed(q + ".text", "span", "", "Source")) +
        '<button type="button" class="xs" data-del="' + q + '" aria-label="Remove source">×</button></span>';
    }).join("") + '<button type="button" class="tag-btn" data-add="' + p + '" data-kind="source">+ source</button>';
  }

  /* ---------- Claims ---------- */
  function byline(p) {
    const c = get(p);
    let h = '<div class="by">';
    if (state.editing) {
      h += '<button type="button" class="tag-btn tag ' + (c.tag || "none") + '" data-cycle="' + p + '" title="Click to change the tag">' + (c.tag ? TAGS[c.tag] : "Choose tag") + "</button>";
      if (c.tag === "scholar") h += ed(p + ".scholar", "span", "", "Scholar's name");
      h += srcEdit(p + ".sources");
      h += '<button type="button" class="verify' + (c.review ? "" : " off") + '" data-toggle="' + p + '.review">' + (c.review ? "verify" : "mark verify") + "</button>";
    } else {
      h += '<span class="tag ' + (c.tag || "none") + '">' + (c.tag === "scholar" ? esc(c.scholar || "Scholar's view") : c.tag ? TAGS[c.tag] : "No tag") + "</span>";
      if (c.sources && c.sources.length) h += "<span>" + srcList(c.sources) + "</span>";
      if (c.review) h += '<span class="verify">verify</span>';
    }
    return h + "</div>";
  }
  const claim = (p, ph) => '<div class="claim">' + ed(p + ".text", "p", "", ph || "Write the claim") + byline(p) + "</div>";

  /* ---------- Verses ---------- */
  function literalHtml(s) { return esc(s).replace(/\[([^\]]*)\]/g, '<span class="added">[$1]</span>'); }
  function wordsHtml(vi) {
    const v = state.doc.verses[vi];
    return v.words.map((w, wi) => '<span class="w" role="button" tabindex="0" data-v="' + vi + '" data-w="' + wi + '">' + esc(w.ar) + "</span>").join(" ") +
      ' <span class="end" aria-label="end of verse ' + v.n + '">۝' + AR(v.n) + "</span>";
  }

  function page() {
    const doc = state.doc, s = doc.surah;
    let h = '<section class="hero">' +
      '<p class="name-ar" lang="ar">' + esc(s.nameAr) + "</p>" +
      "<h1>Sūrat " + esc(s.nameTr) + "</h1>" +
      '<div class="meta">' + esc(s.nameEn) + " · Surah " + s.number + " · " + doc.verses.length + " verses</div>" +
      ed("surah.tagline", "p", "tagline", "One line about the surah") + "</section>";
    doc.verses.forEach((v, vi) => { h += '<div class="divider" aria-hidden="true">✦</div>' + verseHtml(v, vi); });
    return h + '<div class="divider" aria-hidden="true">✦</div>' + wholeHtml();
  }

  function verseHtml(v, vi) {
    const b = "verses." + vi, E = state.editing;
    let h = '<section class="verse" id="v' + v.n + '"><div class="v-label">Verse ' + v.n + "</div>" +
      '<p class="ayah" lang="ar">' + wordsHtml(vi) + "</p>";
    if (E) h += '<div class="ebar-row" style="justify-content:center">' + addBtn(b + ".words", "word", "word") + '<span class="label">Click a word to edit it</span></div>';
    h += '<div class="literal">' + (E ? ed(b + ".literal", "p", "", "Literal translation, added words in [brackets]") : "<p>" + literalHtml(v.literal) + "</p>") + "</div>";

    h += '<div class="block"><h3>Layers of meaning</h3>';
    v.layers.forEach((l, li) => {
      const p = b + ".layers." + li;
      h += '<article class="layer"><div class="lmain"><span class="n">' + (li + 1) + '</span><div class="body">' +
        ed(p + ".translation", "p", "tl", "Clear English translation") +
        ed(p + ".note", "p", "lnote", "A short, simple note on this reading") +
        delBtn(p, "Remove layer") + "</div></div>" +
        // hidden until the reader hovers the layer (or taps the toggle); always open while editing
        '<div class="lside' + (E ? " open" : "") + '"><button type="button" class="lside-toggle" aria-expanded="' + (E ? "true" : "false") + '">Sources and details</button><div class="lwrap"><div class="in">' +
        ed(p + ".reading", "span", "reading", "Which meaning this layer follows") +
        claim(p + ".explanation", "Explain this layer in detail") +
        '<div class="tafsir"><span class="label">Tafsir</span>' +
        l.tafsir.map((t, ti) => tafsirHtml(p + ".tafsir." + ti)).join("") +
        (!l.tafsir.length && !E ? '<p class="quiet">No tafsir recorded for this reading yet.</p>' : "") +
        addBtn(p + ".tafsir", "claim", "tafsir") + "</div></div></div></div></article>";
    });
    h += addBtn(b + ".layers", "layer", "layer") + "</div>";

    h += '<div class="block"><h3>The miracle in the words</h3><div class="notes">' +
      v.miracle.map((m, mi) => noteHtml(b + ".miracle." + mi)).join("") + "</div>" + addBtn(b + ".miracle", "note", "note") + "</div>";

    const a = v.asbab;
    if (a.exists || E) {
      h += '<details class="asbab"' + (E ? " open" : "") + '><summary>Reason for revelation</summary><div class="asbab-body">';
      if (E) h += '<div class="ebar-row">' + btn('data-toggle="' + b + '.asbab.exists"', a.exists ? "A narration exists ✓" : "No narration (click if one exists)") + "</div>";
      if (a.exists) {
        h += '<div><span class="label">Narration</span>' + claim(b + ".asbab.narration") + "</div>" +
          '<div><span class="label">Authenticity</span>' + claim(b + ".asbab.grading", "Grading of the narration") + "</div>" +
          (a.disagreement && (a.disagreement.text || E) ? '<div><span class="label">Disagreement</span>' + claim(b + ".asbab.disagreement", "Other reports, if any") + "</div>" : "");
      } else {
        h += ed(b + ".asbab.note", "p", "quiet", "Note");
      }
      h += "</div></details>";
    }
    return h + "</section>";
  }

  function tafsirHtml(p) {
    const c = get(p);
    if (state.editing) return '<div class="tq">' + claim(p, "What the scholar says") + delBtn(p) + "</div>";
    const who = c.tag === "scholar" ? c.scholar : TAGS[c.tag] || "No tag";
    return '<div class="tq"><span class="who ' + (c.tag || "") + '">' + esc(who) + (c.review ? ' <span class="verify">verify</span>' : "") + "</span><p>" + esc(c.text) + "</p>" +
      (c.sources && c.sources.length ? '<div class="by"><span>' + srcList(c.sources) + "</span></div>" : "") + "</div>";
  }
  function noteHtml(p) {
    return '<div class="note">' + ed(p + ".topic", "span", "topic", "Topic") + ed(p + ".title", "h4", "", "Short title") + claim(p, "What makes this remarkable") + delBtn(p) + "</div>";
  }

  /* ---------- Surah as a whole ---------- */
  function wholeHtml() {
    const s = state.doc.surah;
    let h = '<section class="whole" id="whole"><h2>The surah as a whole</h2>' + ringHtml();
    h += '<div class="block"><h3>The miracle in the surah</h3><div class="notes">' + s.miracle.map((m, i) => noteHtml("surah.miracle." + i)).join("") + "</div>" + addBtn("surah.miracle", "note", "note") + "</div>";
    h += '<div class="block"><h3>Central theme</h3><div class="stack">' + s.theme.map((c, i) => "<div>" + claim("surah.theme." + i) + delBtn("surah.theme." + i) + "</div>").join("") + "</div>" + addBtn("surah.theme", "claim", "claim") + "</div>";
    const link = (k, lbl) => '<div class="stack"><div><span class="label">' + lbl + "</span>" + ed("surah.links." + k + ".surah", "h4", "", "Surah name") + "</div>" +
      s.links[k].claims.map((c, i) => "<div>" + claim("surah.links." + k + ".claims." + i) + delBtn("surah.links." + k + ".claims." + i) + "</div>").join("") +
      addBtn("surah.links." + k + ".claims", "claim", "link") + "</div>";
    h += '<div class="block"><h3>Neighbouring surahs</h3><div class="pair">' + link("previous", "Before") + link("next", "After") + "</div></div>";
    h += '<div class="block"><h3>Place of revelation</h3>' + claim("surah.revelation") + "</div>";
    h += '<div class="legend"><span class="tag consensus">Consensus</span><span class="tag scholar">Scholar\'s view (named)</span><span class="tag reflection">Reflection</span><span><span class="verify">verify</span> needs scholar review</span></div>';
    return h + "</section>";
  }

  function ringHtml() {
    const r = state.doc.surah.ring, E = state.editing;
    if (!E && !ringShown(r)) return "";
    const ps = ringPairs(r), paired = new Set();
    ps.forEach((q) => { paired.add(q.a); paired.add(q.b); });
    let h = '<div class="block"><h3>Ring composition</h3>';
    if (E) {
      h += '<div class="ebar-row">' + btn('data-toggle="surah.ring.supported"', r.supported ? "Ring composition claimed ✓" : "No ring composition (click to claim one)") +
        (r.units.length ? "" : btn('data-ringsample="1"', "Fill a sample layout")) +
        btn('data-toggle="surah.ring.demo"', r.demo ? "Shown as a demo, not yet verified ✓" : "Show as a demo before verification") + "</div>" +
        '<p class="quiet">Readers see the diagram only when a ring is claimed and the claim below is tagged Scholar\'s view with the scholar named, or it is marked as a demo.</p>';
    }
    if (r.demo && !ringVerified(r)) h += '<p class="ring-demo"><span class="verify">demo</span> Not yet verified by a scholar.</p>';
    h += claim("surah.ring.claim", "Who verified this ring, and where");
    if (r.units.length) {
      h += '<div class="ring" id="ring">' + r.units.map((u, i) => {
        const p = "surah.ring.units." + i;
        return '<div class="r-unit' + (paired.has(i) ? "" : " center") + '" data-ru="' + i + '">' +
          ed(p + ".label", "span", "lt", "A") +
          '<span class="ref">' + ed(p + ".ref", "span", "", "Verses") + (paired.has(i) ? "" : " · <b>Center</b>") + "</span>" +
          ed(p + ".text", "p", "", "What this section says") +
          (E ? '<span></span><span class="ebar-row">' + delBtn(p) + "</span>" : "") + "</div>";
      }).join("") + "</div>";
    }
    if (E) h += addBtn("surah.ring.units", "ringunit", "section");
    if (ps.length || E) {
      h += '<ul class="r-notes">' + r.pairs.map((q, i) => {
        const lbl = (k) => esc((r.units[+q[k]] || {}).label || "?");
        if (E) {
          const opts = (k) => r.units.map((u, ui) => '<option value="' + ui + '"' + (+q[k] === ui ? " selected" : "") + ">" + esc(u.label || "Section " + (ui + 1)) + "</option>").join("");
          return '<li class="r-edit"><div class="row"><span class="num">' + (i + 1) + '</span>Ring joins <select data-path="surah.ring.pairs.' + i + '.a" data-num="1" aria-label="First section">' + opts("a") +
            '</select> and <select data-path="surah.ring.pairs.' + i + '.b" data-num="1" aria-label="Second section">' + opts("b") + "</select>" + delBtn("surah.ring.pairs." + i) + "</div>" +
            ed("surah.ring.pairs." + i + ".note", "p", "", "What connects these two sections") + "</li>";
        }
        return '<li data-ring="' + i + '"><span class="num">' + (i + 1) + '</span><span class="pairlbl">' + lbl("a") + " ↔ " + lbl("b") + "</span><p>" + esc(q.note) + "</p></li>";
      }).join("") + "</ul>";
      if (E && r.units.length >= 2) h += addBtn("surah.ring.pairs", "ringpair", "ring");
    }
    return h + "</div>";
  }

  /* ---------- Word card ---------- */
  function card(vi, wi) {
    const w = state.doc.verses[vi].words[wi], p = "verses." + vi + ".words." + wi;
    const e = state.doc.dictionary[w.entry], d = "dictionary." + w.entry, E = state.editing;
    let h = '<div class="c-head"><div>' + ed(p + ".ar", "div", "c-ar", "Arabic", true) + ed(p + ".tr", "div", "c-tr", "transliteration") + "</div>" +
      '<button type="button" class="close" data-close aria-label="Close">×</button></div>';
    if (E) {
      const uses = state.doc.verses.reduce((n, v) => n + v.words.filter((x) => x.entry === w.entry).length, 0);
      h += '<div class="sect"><span class="label">Dictionary entry</span><span contenteditable="true" spellcheck="false" data-entry="' + p + '" data-ph="entry-name">' + esc(w.entry) + "</span>" +
        '<span class="shared">Root, meanings and translations below are shared by every verse that uses this entry' + (uses > 1 ? " (" + uses + " places in this surah)" : "") + ". Type another entry's name to link to it.</span></div>";
    }
    if (!e) return h + '<p class="quiet">This word has no dictionary entry yet.</p>';
    if (E) {
      h += '<div class="efields">' +
        '<div class="f"><span class="label">Root</span>' + ed(d + ".root", "span", "", "ج ذ ر", true) + "</div>" +
        '<div class="f"><span class="label">Root (Latin)</span>' + ed(d + ".rootTr", "span", "", "j-dh-r") + "</div>" +
        '<div class="f" style="grid-column:1/-1"><span class="label">Core sense of the root</span>' + ed(d + ".rootMeaning", "span", "", "Core sense") + "</div></div>";
    } else {
      h += '<div class="c-root">' + (e.root ? 'Root <span class="r-ar" lang="ar">' + esc(e.root) + "</span> · " : "") + esc(e.rootTr) + (e.rootMeaning ? " · " + esc(e.rootMeaning) : "") + "</div>";
    }
    h += '<div class="sect"><span class="label">Possible translations · ✦ meant here</span><div class="chips">' +
      e.translations.map((t, ti) => {
        const used = w.used.includes(t);
        if (!E) return '<span class="chip' + (used ? " used" : "") + '">' + esc(t) + "</span>";
        return '<span class="chip' + (used ? " used" : "") + '">' + ed(d + ".translations." + ti, "span", "", "translation") +
          '<button type="button" data-use="' + p + '" data-ti="' + ti + '" title="Meant in this verse?">' + (used ? "unmark" : "mark") + '</button><button type="button" data-del="' + d + ".translations." + ti + '" aria-label="Remove">×</button></span>';
      }).join("") + (E ? '<button type="button" class="ebtn" data-add="' + d + '.translations" data-kind="text">+ add</button>' : "") + "</div></div>";
    h += '<div class="sect"><span class="label">Classical meanings</span><ul>' +
      e.meanings.map((m, mi) => "<li>" + ed(d + ".meanings." + mi, "span", "", "meaning") + (E ? ' <button type="button" class="ebtn x" data-del="' + d + ".meanings." + mi + '">×</button>' : "") + "</li>").join("") + "</ul>" +
      (E ? '<button type="button" class="ebtn" data-add="' + d + '.meanings" data-kind="text">+ meaning</button>' : "") + "</div>";
    h += '<div class="sect"><span class="label">Why this meaning here</span>' + claim(p + ".why") + "</div>";
    if (w.special) {
      h += '<div class="sect special"><span class="label">Beyond the dictionary</span>' + claim(p + ".special", "A meaning that comes from revelation, narration or usage") +
        (E ? '<button type="button" class="ebtn x" data-unset="' + p + '.special">Remove</button>' : "") + "</div>";
    } else if (E) {
      h += '<div class="sect"><button type="button" class="ebtn" data-setclaim="' + p + '.special">+ meaning beyond the dictionary</button></div>';
    }
    if (E) {
      h += '<div class="sect"><span class="label">Lexicon sources</span><div class="by">' + srcEdit(d + ".lexicon") +
        '<button type="button" class="verify' + (e.review ? "" : " off") + '" data-toggle="' + d + '.review">' + (e.review ? "verify" : "mark verify") + "</button></div></div>" +
        '<div class="erow"><span><button type="button" class="ebtn" data-move="' + p + '" data-dir="-1">→ earlier</button> <button type="button" class="ebtn" data-move="' + p + '" data-dir="1">later ←</button></span>' +
        '<button type="button" class="ebtn x" data-del="' + p + '" data-closecard="1">Remove word</button></div>';
    } else if (e.lexicon && e.lexicon.length) {
      h += '<div class="lex">Lexicon: ' + srcList(e.lexicon) + (e.review ? ' <span class="verify">verify</span>' : "") + "</div>";
    }
    return h;
  }

  return { page, card, wordsHtml };
}
