// The night sky behind every page: small stars, a few of them gold, some slowly twinkling.
// The sky drifts slowly as you scroll, slower than the page. It is made of tiles that are generated from their
// position, so it goes on as far as the page does, never repeats and never shows an edge.

const sky = document.getElementById("sky"), ctx = sky.getContext("2d");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TILE = 900, DENSITY = 7000;
const DEPTH = .3;   // the sky moves at this fraction of the scroll, so it feels far away
let w = 0, h = 0, tiles = new Map();

// small seeded random numbers, so a tile always gets the same stars
function rng(seed) {
  let a = seed * 2654435761 >>> 0;
  return () => { a = a + 0x6D2B79F5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function tile(k) {
  let t = tiles.get(k);
  if (t) return t;
  const r = rng(k + 7919), n = Math.round(w * TILE / DENSITY);
  t = Array.from({ length: n }, () => ({
    x: r() * w, y: r() * TILE,
    r: r() < .92 ? r() * .8 + .25 : r() * .7 + 1,
    a: r() * .55 + .15, gold: r() < .08,
    tw: r() < .3 ? r() * 2 + .5 : 0, ph: r() * 6.28
  }));
  tiles.set(k, t);
  return t;
}
function size() {
  const cw = sky.clientWidth || innerWidth, ch = sky.clientHeight || innerHeight;
  if (cw !== w) tiles = new Map();          // a new width spreads the stars again; a new height does not
  w = cw; h = ch;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  sky.width = w * dpr; sky.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function draw(t) {
  ctx.clearRect(0, 0, w, h);
  const y0 = scrollY * DEPTH;
  for (let k = Math.floor(y0 / TILE); k * TILE < y0 + h; k++) {
    const top = k * TILE - y0;
    for (const s of tile(k)) {
      ctx.globalAlpha = s.tw && !still ? s.a * (.55 + .45 * Math.sin(t / 1000 * s.tw + s.ph)) : s.a;
      ctx.fillStyle = s.gold ? "#E8B84A" : "#F4F2FA";
      ctx.beginPath(); ctx.arc(s.x, top + s.y, s.r, 0, 6.283); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

let frame = 0;
const redraw = () => { if (!frame) frame = requestAnimationFrame((t) => { frame = 0; draw(t); }); };
size(); draw(0);
addEventListener("scroll", redraw, { passive: true });
let resizeT = null;
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { size(); draw(performance.now()); }, 100); });

// about 12 frames a second is plenty for a slow twinkle, and it stops while the tab is hidden
let last = 0;
function loop(t) { if (!document.hidden && t - last > 80) { last = t; redraw(); } requestAnimationFrame(loop); }
if (!still) requestAnimationFrame(loop);
