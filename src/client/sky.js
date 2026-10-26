// The night sky behind every page: a canvas of small stars, a few of them gold, some slowly twinkling.

const sky = document.getElementById("sky"), ctx = sky.getContext("2d");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let stars = [], skyT = null;
function seedSky() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  sky.width = innerWidth * dpr; sky.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round(innerWidth * innerHeight / 7000);
  stars = Array.from({ length: n }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() < .92 ? Math.random() * .8 + .25 : Math.random() * .7 + 1,
    a: Math.random() * .55 + .15, gold: Math.random() < .08,
    tw: Math.random() < .3 ? Math.random() * 2 + .5 : 0, ph: Math.random() * 6.28
  }));
}
function drawSky(t) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const s of stars) {
    ctx.globalAlpha = s.tw && !still ? s.a * (.55 + .45 * Math.sin(t / 1000 * s.tw + s.ph)) : s.a;
    ctx.fillStyle = s.gold ? "#E8B84A" : "#F4F2FA";
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// about 12 frames a second is plenty for a slow twinkle, and it stops while the tab is hidden
let last = 0;
function loop(t) { if (!document.hidden && t - last > 80) { drawSky(t); last = t; } requestAnimationFrame(loop); }
seedSky(); drawSky(0);
if (!still) requestAnimationFrame(loop);

addEventListener("resize", () => { clearTimeout(skyT); skyT = setTimeout(() => { seedSky(); drawSky(performance.now()); }, 150); });
