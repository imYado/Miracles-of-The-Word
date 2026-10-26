// Runs on every surah page: the night sky, the word cards, the ring diagram,
// and the Edit button (the editor itself is only downloaded when it is opened).
import { createView, ringPairs } from "./render.js";
import "./sky.js";

const doc = JSON.parse(document.getElementById("doc").textContent);
const dev = document.querySelector('meta[name="motw-dev"]') != null;
const state = { doc, editing: false };
const view = createView(state);
const main = document.getElementById("main");
const narrow = matchMedia("(max-width: 760px)");
const hover = matchMedia("(hover: hover)");

/* ---------- Page ---------- */
function afterRender() {
  if (!state.editing && narrow.matches) main.querySelectorAll("details.lside").forEach((d) => d.removeAttribute("open"));
  drawRing();
  if (document.fonts) document.fonts.ready.then(drawRing);
  markOn();
}
function rerender() {
  const y = scrollY;
  main.innerHTML = view.page();
  afterRender();
  scrollTo(0, y);
}

/* ---------- Ring composition ---------- */
function drawRing() {
  const box = document.getElementById("ring"); if (!box) return;
  const ps = ringPairs(state.doc.surah.ring);
  box.querySelectorAll("svg, .r-pin").forEach((e) => e.remove());
  const maxL = ps.reduce((m, q) => Math.max(m, q.level), 0), step = innerWidth < 640 ? 24 : 30;
  box.style.setProperty("--ring-w", ps.length ? (maxL + 1) * step + 22 + "px" : "0px");
  if (!ps.length) return;
  const units = box.querySelectorAll(".r-unit"), bb = box.getBoundingClientRect();
  const x0 = units[0].getBoundingClientRect().left - bb.left;
  const y = (i) => { const u = units[i].getBoundingClientRect(); return u.top - bb.top + u.height / 2; };
  let svg = '<svg aria-hidden="true">', pins = "";
  ps.forEach((q) => {
    const off = (maxL - q.level + 1) * step, xl = x0 - off - 4, ya = y(q.a), yb = y(q.b);
    svg += '<path data-ring="' + q.i + '" d="M' + x0 + " " + ya + " C" + xl + " " + ya + " " + xl + " " + yb + " " + x0 + " " + yb + '"/>';
    // pin sits on the curve; outer rings put it higher up so pins of nested rings never overlap
    const t = maxL ? .5 - .22 * (maxL - q.level) / maxL : .5, u = 1 - t;
    const ax = x0 * (u * u * u + t * t * t) + xl * 3 * u * t, ay = ya * (u * u * u + 3 * u * u * t) + yb * (3 * u * t * t + t * t * t);
    pins += '<button type="button" class="r-pin" data-ring="' + q.i + '" style="left:' + ax + "px;top:" + ay + 'px" aria-label="Ring ' + (q.i + 1) + '">' + (q.i + 1) + "</button>";
  });
  box.insertAdjacentHTML("afterbegin", svg + "</svg>");
  box.insertAdjacentHTML("beforeend", pins);
}
let ringOn = null;
function lightRing(i) {
  ringOn = i;
  const q = i == null ? null : state.doc.surah.ring.pairs[i];
  document.querySelectorAll("[data-ring]").forEach((e) => e.classList.toggle("on", i != null && +e.dataset.ring === i));
  document.querySelectorAll(".r-unit").forEach((e) => e.classList.toggle("on", !!q && (+e.dataset.ru === +q.a || +e.dataset.ru === +q.b)));
}
document.addEventListener("mouseover", (e) => {
  const t = e.target.closest && e.target.closest("[data-ring]");
  if (t) lightRing(+t.dataset.ring); else if (ringOn != null && !e.target.closest(".ring, .r-notes")) lightRing(null);
});
document.addEventListener("click", (e) => { const t = e.target.closest("[data-ring]"); if (t) lightRing(ringOn === +t.dataset.ring ? null : +t.dataset.ring); });

/* ---------- Word card ---------- */
const card = document.getElementById("card");
let at = null, pinned = false, hideT = null, showT = null;
const HOVER_DELAY = 500;

function openCard(el, pin) {
  const vi = +el.dataset.v, wi = +el.dataset.w;
  clearTimeout(hideT);
  if (pinned && !pin && at && (at.vi !== vi || at.wi !== wi)) return;
  if (pin) pinned = true;
  const same = at && at.vi === vi && at.wi === wi && !card.hidden;
  at = { vi, wi, el };
  if (!same) card.innerHTML = view.card(vi, wi);
  card.hidden = false;
  markOn();
  place(el);
}
function refreshCard() {
  if (!at || card.hidden) return;
  const el = main.querySelector('.w[data-v="' + at.vi + '"][data-w="' + at.wi + '"]');
  if (!el || !state.doc.verses[at.vi] || !state.doc.verses[at.vi].words[at.wi]) { closeCard(); return; }
  at.el = el; card.innerHTML = view.card(at.vi, at.wi); markOn(); place(el);
}
function markOn() {
  document.querySelectorAll(".w.on").forEach((e) => e.classList.remove("on"));
  if (at) document.querySelectorAll('.w[data-v="' + at.vi + '"][data-w="' + at.wi + '"]').forEach((e) => e.classList.add("on"));
}
function place(el) {
  if (matchMedia("(max-width: 640px)").matches) { card.style.left = ""; card.style.top = ""; return; }
  const r = el.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight, m = 12;
  const left = Math.min(Math.max(m, r.left + r.width / 2 - cw / 2), innerWidth - cw - m);
  let top = r.bottom + 8;
  if (top + ch > innerHeight - m) top = Math.max(m, r.top - ch - 8);
  card.style.left = left + "px"; card.style.top = top + "px";
}
function closeCard() { card.hidden = true; pinned = false; at = null; markOn(); }

document.addEventListener("mouseover", (e) => {
  if (!hover.matches) return;
  const w = e.target.closest(".w");
  if (w) {
    clearTimeout(showT);
    // the first card waits half a second; once a card is open, moving to the next word switches at once
    if (!card.hidden && !pinned) openCard(w, false);
    else showT = setTimeout(() => openCard(w, false), HOVER_DELAY);
  } else if (e.target.closest("#card")) clearTimeout(hideT);
});
document.addEventListener("mouseout", (e) => {
  if (e.target.closest(".w")) clearTimeout(showT);
  if (!hover.matches || pinned) return;
  if (e.target.closest(".w") || e.target.closest("#card")) {
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!pinned) closeCard(); }, 220);
  }
});
document.addEventListener("click", (e) => {
  const w = e.target.closest(".w");
  if (w) { clearTimeout(showT); openCard(w, true); return; }
  if (e.target.closest("[data-close]")) { closeCard(); return; }
  if (!e.target.closest("#card") && !e.target.closest("#ebar") && !e.target.closest("#modal") && !card.hidden) closeCard();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCard();
  const w = e.target.closest && e.target.closest(".w");
  if (w && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openCard(w, true); }
});
addEventListener("scroll", () => {
  if (!at || card.hidden) return;
  if (!pinned) closeCard(); else if (at.el.isConnected) place(at.el);
}, { passive: true });
let resizeT = null;
addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { drawRing(); if (at && !card.hidden && at.el.isConnected) place(at.el); }, 120);
});

/* ---------- Edit button ---------- */
// Visitors never see it. It shows when the site runs on your computer (npm run dev), or on the live site at /<surah>#edit.
const editBtn = document.getElementById("edit-toggle");
let editor = null;
function editAllowed() { return dev || location.hash === "#edit"; }
function syncEditButton() { editBtn.hidden = !editAllowed(); }
syncEditButton();
addEventListener("hashchange", syncEditButton);
editBtn.addEventListener("click", async () => {
  if (!editor) {
    editBtn.textContent = "Loading…";
    const mod = await import("./editor.js");
    editor = mod.start({ state, view, rerender, drawRing, refreshCard, closeCard, cardAt: () => at, dev, editBtn });
  }
  editor.toggle();
});

afterRender();
if (editAllowed() && location.hash === "#edit") editBtn.click();
