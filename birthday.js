/* ============================================================
   HAPPY BIRTHDAY — a birthday film in four acts
   Vanilla canvas 2D for the tree + GSAP for the orchestration.

   ACT 1  a real recurve bow with a Cupid's arrow nocked — you
          DRAW the string down and RELEASE to fire (pointer drag,
          or keyboard). A softly beating heart waits above as the
          target.
   ACT 2  the arrow flies up and strikes the heart; the heart
          jolts, falls, and bursts into a flood of rose that
          swallows the frame (no cross-fade).
   ACT 3  a kinetic wish hinges up out of that colour, glyph by
          glyph, under cinema bars and a slow camera push.
   ACT 4  a gold light blooms, and the tree grows into one heart
          of lit blossoms with the hand-lettered wish.

   A GSAP master timeline runs the shot + Acts 2–3; at its end it
   starts the canvas tree (Act 4), which owns its own rAF and
   plays once, then holds — living, never looping.
   ============================================================ */

import gsap from 'gsap';
import QRCode from 'qrcode';

/* the pen-stroke plugin: a `drawn` 0..1 property for the underline */
gsap.registerPlugin({
  name: 'drawn',
  init(target, value) {
    const len = target.getTotalLength();
    target.style.strokeDasharray = len;
    this.target = target; this.len = len; this.value = value;
  },
  render(ratio, data) {
    data.target.style.strokeDashoffset = data.len * (1 - data.value * ratio);
  },
});

const $ = (id) => document.getElementById(id);

const canvas = $('tree');
const ctx    = canvas.getContext('2d');
const wishEl = $('wish');

const hero       = $('hero');
const eyebrow    = $('eyebrow');
const hint       = $('hint');
const motes      = $('motes');
const target     = $('target');
const targetHeart= $('targetHeart');
const heartGlow  = target.querySelector('.heart__glow');
const aim        = $('aim');

const archery = $('archery');
const bow     = $('bow');
const arrow   = $('arrow');
const strL    = $('strL');
const strR    = $('strR');
const serving = $('serving');

const flood   = $('flood');
const field   = $('field');
const camera  = $('camera');
const fgrid   = $('fgrid');
const kEyebrow= $('kEyebrow');
const kSub    = $('kSub');
const barTop  = $('barTop');
const barBot  = $('barBot');
const uline   = $('uline').querySelector('.uline__path');
const bloom   = $('bloom');
const replay  = $('replay');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isRecord     = new URLSearchParams(location.search).has('record');

/* --- cue log for the recorder: the page stays muted, but it timestamps every
   beat the film crosses, and the offline sound synth fires foley at those exact
   times so the audio can never drift from the picture. --- */
if (isRecord) window.bdayCues = [];
let recT0 = 0;
function cue(name){ if (isRecord && recT0) window.bdayCues.push({ cue: name, t: (performance.now() - recT0) / 1000 }); }

/* ============================================================
   MATH HELPERS
   ============================================================ */
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = (a)    => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack  = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* ============================================================
   TREE ENGINE (Act 4) — canvas
   ============================================================ */
const BLOSSOM = [
  { c0: '#ffe1ec', c1: '#ff80aa' },
  { c0: '#ffd0e0', c1: '#f4577f' },
  { c0: '#ffc4d2', c1: '#e23b67' },
  { c0: '#ffd9c4', c1: '#ff8a5b' },
  { c0: '#ffeec2', c1: '#f6b13e' },
  { c0: '#ffd2e6', c1: '#e84d9a' },
];

/* timeline (seconds, relative to the tree's own start) — brisk */
const T = {
  trunkStart: 0.10,
  branchSpan: 1.80,
  bloomT0:    1.25,
  bloomSpan:  2.00,
  petalT0:    2.45,
  noteStart:  0.45,
  done:       4.60,
};

const SS = 168;

function heartShape(c, x, top, w, h){
  c.beginPath();
  c.moveTo(x, top + h * 0.28);
  c.bezierCurveTo(x, top, x - w * 0.5, top, x - w * 0.5, top + h * 0.28);
  c.bezierCurveTo(x - w * 0.5, top + h * 0.60, x - w * 0.16, top + h * 0.80, x, top + h);
  c.bezierCurveTo(x + w * 0.16, top + h * 0.80, x + w * 0.5, top + h * 0.60, x + w * 0.5, top + h * 0.28);
  c.bezierCurveTo(x + w * 0.5, top, x, top, x, top + h * 0.28);
  c.closePath();
}

function makeBlossom({ c0, c1 }, soft){
  const cv = document.createElement('canvas'); cv.width = cv.height = SS;
  const c = cv.getContext('2d');
  const w = SS * 0.62, h = SS * 0.58, x = SS / 2, top = SS * 0.17;

  c.save();
  c.shadowColor = 'rgba(150,38,72,0.32)';
  c.shadowBlur = SS * 0.085; c.shadowOffsetY = SS * 0.05;
  c.fillStyle = c1; heartShape(c, x, top, w, h); c.fill();
  c.restore();

  const g = c.createRadialGradient(x - w * 0.20, top + h * 0.20, h * 0.04, x, top + h * 0.42, h * 0.92);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, shade(c1, -26));
  heartShape(c, x, top, w, h); c.fillStyle = g; c.fill();

  c.save(); heartShape(c, x, top, w, h); c.clip();
  const g2 = c.createLinearGradient(0, top, 0, top + h);
  g2.addColorStop(0, 'rgba(255,255,255,0)');
  g2.addColorStop(0.65, 'rgba(110,16,46,0)');
  g2.addColorStop(1, 'rgba(110,16,46,0.26)');
  c.fillStyle = g2; c.fillRect(0, 0, SS, SS);
  c.globalAlpha = 0.55; c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(x - w * 0.15, top + h * 0.24, w * 0.17, h * 0.11, -0.5, 0, Math.PI * 2); c.fill();
  c.restore();

  if (!soft) return cv;

  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = SS;
  const c2 = cv2.getContext('2d');
  c2.filter = 'blur(2.6px)'; c2.drawImage(cv, 0, 0); c2.filter = 'none';
  c2.globalCompositeOperation = 'source-atop';
  c2.globalAlpha = 0.42; c2.fillStyle = '#fff3ea'; c2.fillRect(0, 0, SS, SS);
  return cv2;
}

function makeBokeh(rgb){
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.45, `rgba(${rgb},0.22)`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return cv;
}

function makeSparkle(){
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'); const m = S / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(255,236,200,0.5)'); g.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = g; c.beginPath(); c.arc(m, m, m, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.translate(m, m);
  for (let k = 0; k < 2; k++){
    c.beginPath();
    c.moveTo(0, -m); c.quadraticCurveTo(0, 0, m, 0); c.quadraticCurveTo(0, 0, 0, m); c.quadraticCurveTo(0, 0, -m, 0); c.quadraticCurveTo(0, 0, 0, -m);
    c.fill(); c.rotate(Math.PI / 4); c.scale(0.5, 0.5);
  }
  return cv;
}

let SPR = { crisp: [], soft: [] }, BOKEH = [], SPARKLE = null;
function buildSprites(){
  SPR = { crisp: BLOSSOM.map((b) => makeBlossom(b, false)), soft: BLOSSOM.map((b) => makeBlossom(b, true)) };
  BOKEH = [makeBokeh('255,224,188'), makeBokeh('255,196,214'), makeBokeh('255,238,210')];
  SPARKLE = makeSparkle();
}

function drawSprite(sprite, x, y, size, rot, alpha){
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, -size * 0.5, -size * 0.47, size, size);
  ctx.restore();
}

let heartPoly = null;
function buildHeartPoly(){
  const raw = []; let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i <= 160; i++){
    const t = (i / 160) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    raw.push([x, y]);
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2, hw = (maxX - minX) / 2, hh = (maxY - minY) / 2;
  heartPoly = raw.map(([x, y]) => [(x - midX) / hw, (y - midY) / hh]);
}
function pointInPoly(x, y){
  let inside = false; const p = heartPoly;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++){
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

let W = 0, H = 0, dpr = 1;
let cx = 0, cy = 0, rx = 0, ry = 0, groundY = 0;
let branches = [], hearts = [], petals = [], rested = [], orbs = [], floaters = [], twinkles = [];
let bgGrad = null, glowGrad = null, groundGrad = null;

const quad = (b, t) => { const m = 1 - t, a = m * m, k = 2 * m * t, d = t * t; return { x: a * b.x1 + k * b.cx + d * b.x2, y: a * b.y1 + k * b.cy + d * b.y2 }; };

function barkGrad(x1, y1, x2, y2, depth){
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, `hsl(348 26% ${26 + depth * 3}%)`);
  g.addColorStop(1, `hsl(346 24% ${40 + depth * 5}%)`);
  return g;
}

function buildScene(){
  branches = []; hearts = []; petals = []; rested = []; twinkles = []; orbs = []; floaters = [];
  buildHeartPoly();

  const wide = W / H > 1.2;
  cx = W * (wide ? 0.57 : 0.5);
  cy = H * (wide ? 0.37 : 0.38);
  ry = Math.min(H * (wide ? 0.33 : 0.33), W * 0.34);
  rx = ry * 1.16;
  groundY = H * 0.93;

  bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#fff3e9');
  bgGrad.addColorStop(0.46, '#ffe7d6');
  bgGrad.addColorStop(0.78, '#fcd9c4');
  bgGrad.addColorStop(1, '#f3c4b5');
  glowGrad = ctx.createRadialGradient(cx, cy, ry * 0.1, cx, cy, ry * 1.55);
  glowGrad.addColorStop(0, 'rgba(255,219,170,0.6)');
  glowGrad.addColorStop(0.5, 'rgba(255,170,150,0.2)');
  glowGrad.addColorStop(1, 'rgba(255,170,150,0)');
  groundGrad = ctx.createRadialGradient(cx, H * 1.02, ry * 0.2, cx, H * 1.02, ry * 1.6);
  groundGrad.addColorStop(0, 'rgba(255,205,165,0.5)');
  groundGrad.addColorStop(1, 'rgba(255,205,165,0)');

  for (let i = 0; i < 11; i++){
    orbs.push({ x: rand(0, W), y: rand(0, H), r: rand(W * 0.05, W * 0.17), vy: rand(-6, -16), drift: rand(-0.3, 0.3), phase: rand(0, 6.28), alpha: rand(0.05, 0.13), sprite: pick(BOKEH) });
  }

  const FN = wide ? 18 : 15;
  for (let i = 0; i < FN; i++){
    const depth = Math.random();
    floaters.push({
      x: rand(0, W), y: rand(-H * 0.1, H * 1.1), depth,
      idx: (Math.random() * BLOSSOM.length) | 0,
      box: lerp(Math.min(W, H) * 0.025, Math.min(W, H) * 0.075, depth),
      vy: lerp(7, 20, depth), sway: rand(8, 22), phase: rand(0, 6.28),
      rot: rand(-0.4, 0.4), vrot: rand(-0.5, 0.5),
      baseA: lerp(0.16, 0.5, depth), soft: depth < 0.45,
    });
  }

  const baseX = cx, baseY = H * 1.0;
  const trunkTopY = cy + ry * 0.62;
  const trunkW = Math.max(9, W * 0.024);
  const limbLen = ry * 0.6;
  const insidePx = (x, y, m = 0.9) => pointInPoly((x - cx) / (rx * m), (cy - y) / (ry * m));

  function addBranch(x, y, ang, len, w0, depth, t0){
    let ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, clipped = false;
    if (!insidePx(ex, ey)){
      let lo = 0, hi = 1;
      for (let k = 0; k < 12; k++){ const mid = (lo + hi) / 2; (insidePx(x + Math.cos(ang) * len * mid, y + Math.sin(ang) * len * mid) ? lo = mid : hi = mid); }
      ex = x + Math.cos(ang) * len * lo; ey = y + Math.sin(ang) * len * lo; clipped = true;
    }
    const mx = (x + ex) / 2, my = (y + ey) / 2, perp = ang + Math.PI / 2, bend = rand(-1, 1) * len * 0.12, w1 = w0 * 0.66;
    branches.push({ x1: x, y1: y, cx: mx + Math.cos(perp) * bend, cy: my + Math.sin(perp) * bend, x2: ex, y2: ey, w0, w1, t0, dur: Math.max(0.14, 0.32 - depth * 0.03), depth, grad: barkGrad(x, y, ex, ey, depth) });
    return { ex, ey, w1, clipped };
  }
  function grow(x, y, ang, len, w, depth, t0){
    const r = addBranch(x, y, ang, len, w, depth, t0);
    if (r.clipped || depth >= 6 || len < ry * 0.06) return;
    const childT0 = t0 + (0.32 - depth * 0.03) * 0.6;
    const n = Math.random() < 0.55 ? 2 : 3;
    for (let i = 0; i < n; i++){
      const spread = 0.6 * (i - (n - 1) / 2) + rand(-0.22, 0.22), lift = -0.06 + rand(-0.05, 0.05);
      grow(r.ex, r.ey, ang + spread + lift, len * rand(0.74, 0.84), r.w1, depth + 1, childT0 + i * 0.03);
    }
  }
  addBranch(baseX, baseY, -Math.PI / 2, baseY - trunkTopY, trunkW, 0, T.trunkStart);
  branches[0].dur = 0.55;
  const limbT0 = T.trunkStart + 0.36, L = 3;
  for (let i = 0; i < L; i++){
    const ang = -Math.PI / 2 + 0.62 * (i - (L - 1) / 2) + rand(-0.12, 0.12);
    grow(baseX, trunkTopY, ang, limbLen, trunkW * 0.7, 1, limbT0 + i * 0.05);
  }
  const maxT0 = branches.reduce((m, b) => Math.max(m, b.t0 + b.dur), 0);
  const sc = (T.branchSpan - T.trunkStart) / (maxT0 - T.trunkStart);
  for (const b of branches) b.t0 = T.trunkStart + (b.t0 - T.trunkStart) * sc;

  const COUNT = Math.round(clamp(rx * ry / 56, 250, 440));
  const baseBox = clamp(Math.min(W, H) * 0.115, 30, 74);
  let guard = 0;
  while (hearts.length < COUNT && guard < COUNT * 50){
    guard++;
    const u = rand(-1.06, 1.06), v = rand(-1.06, 1.06);
    if (!pointInPoly(u, v)) continue;
    const x = cx + u * rx, y = cy - v * ry;
    const d = clamp01(Math.hypot(u, v + 1) / 2.4);
    const t0 = T.bloomT0 + d * (T.bloomSpan * 0.82) + rand(0, T.bloomSpan * 0.18);
    const soft = Math.random() < 0.42;
    hearts.push({ x, y, idx: (Math.random() * BLOSSOM.length) | 0, soft, box: baseBox * (soft ? rand(0.6, 0.85) : rand(0.78, 1.12)), rot: rand(-0.55, 0.55), sway: rand(0, 6.28), t0 });
  }
  hearts.sort((a, b) => (a.soft === b.soft ? a.y - b.y : a.soft ? -1 : 1));
}

function drawBackground(){
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1; ctx.fillStyle = groundGrad; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawGodRays(t, intensity){
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ox = cx, oy = cy - ry * 0.35, R = Math.hypot(W, H) * 1.1;
  const rays = 9, sweep = Math.sin(t * 0.07) * 0.18;
  for (let i = 0; i < rays; i++){
    const a = -Math.PI / 2 + sweep + (i - (rays - 1) / 2) * 0.2;
    const hw = 0.035 + 0.02 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.7));
    const a1 = a - hw, a2 = a + hw;
    const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * R, oy + Math.sin(a) * R);
    g.addColorStop(0, `rgba(255,232,190,${0.10 * intensity})`);
    g.addColorStop(0.5, `rgba(255,214,170,${0.05 * intensity})`);
    g.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a1) * R, oy + Math.sin(a1) * R);
    ctx.lineTo(ox + Math.cos(a2) * R, oy + Math.sin(a2) * R);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawGlow(t){
  const gi = clamp01((t - T.bloomT0) / (T.bloomSpan * 0.9));
  if (gi <= 0) return;
  ctx.save(); ctx.globalAlpha = gi; ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glowGrad; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawBokeh(t, dt){
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const o of orbs){
    o.y += o.vy * dt; o.x += Math.sin(t * 0.3 + o.phase) * o.drift;
    if (o.y < -o.r){ o.y = H + o.r; o.x = rand(0, W); }
    ctx.globalAlpha = o.alpha;
    ctx.drawImage(o.sprite, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
  }
  ctx.restore();
}

function drawFloaters(t, dt, front){
  const appear = clamp01((t - 0.2) / 1.4);
  if (appear <= 0) return;
  for (const f of floaters){
    if ((f.depth >= 0.6) !== front) continue;
    f.y -= f.vy * dt;
    f.x += Math.sin(t * 0.5 + f.phase) * f.sway * dt;
    f.rot += f.vrot * dt;
    if (f.y < -f.box){ f.y = H + f.box; f.x = rand(0, W); }
    drawSprite((f.soft ? SPR.soft : SPR.crisp)[f.idx], f.x, f.y, f.box, f.rot, f.baseA * appear);
  }
}

function drawBranches(t){
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const b of branches){
    const f = clamp01((t - b.t0) / b.dur);
    if (f <= 0) continue;
    const e = easeOutCubic(f);
    ctx.strokeStyle = b.grad;
    const steps = 12, last = Math.max(1, Math.ceil(steps * e));
    let prev = quad(b, 0);
    for (let i = 1; i <= last; i++){
      const tt = Math.min(e, i / steps), p = quad(b, tt);
      ctx.lineWidth = lerp(b.w0, b.w1, tt);
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      prev = p;
    }
  }
}

function drawHearts(t){
  const breathe = 1 + Math.sin(t * 0.8) * 0.012;
  for (const h of hearts){
    const p = clamp01((t - h.t0) / 0.6);
    if (p <= 0) continue;
    const scale = Math.max(0, easeOutBack(p));
    let alpha = clamp01(p * 1.7); if (h.soft) alpha *= 0.8;
    const settled = clamp01((t - h.t0 - 0.6) / 0.7);
    const sway = settled * Math.sin(t * 1.5 + h.sway) * (h.box * 0.05);
    const rise = (1 - easeOutCubic(p)) * h.box * 0.45;
    const hx = cx + (h.x - cx) * breathe + sway;
    const hy = cy + (h.y - cy) * breathe - rise;
    drawSprite((h.soft ? SPR.soft : SPR.crisp)[h.idx], hx, hy, h.box * scale, h.rot + sway * 0.012, alpha);
  }
}

function updateTwinkles(t, dt){
  const active = t > T.bloomT0 + T.bloomSpan * 0.45;
  if (active && twinkles.length < 9 && Math.random() < 0.5){
    const h = hearts[(Math.random() * hearts.length) | 0];
    if (h) twinkles.push({ x: h.x, y: h.y, size: rand(0.6, 1.3) * (Math.min(W, H) * 0.05), age: 0, life: rand(0.7, 1.2), rot: rand(0, 6.28) });
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = twinkles.length - 1; i >= 0; i--){
    const s = twinkles[i]; s.age += dt;
    const k = s.age / s.life;
    if (k >= 1){ twinkles.splice(i, 1); continue; }
    const a = Math.sin(k * Math.PI);
    drawSprite(SPARKLE, s.x, s.y, s.size * (0.6 + 0.4 * a), s.rot + k * 1.2, a);
  }
  ctx.restore();
}

function spawnPetal(){
  const h = hearts[(Math.random() * hearts.length) | 0];
  if (!h) return;
  petals.push({ x: h.x + rand(-8, 8), y: h.y + rand(-8, 8), vy: rand(14, 30), vx: rand(-8, 8), sway: rand(0.6, 1.4), phase: rand(0, 6.28), box: h.box * rand(0.34, 0.6), idx: h.idx, rot: rand(0, 6.28), vrot: rand(-1.4, 1.4), age: 0, land: groundY + rand(-6, H * 0.05) });
}
function drawPetals(t, dt){
  for (let i = petals.length - 1; i >= 0; i--){
    const p = petals[i]; p.age += dt; p.vy += 8 * dt;
    p.x += (p.vx + Math.sin(t * p.sway + p.phase) * 16) * dt;
    p.y += p.vy * dt; p.rot += p.vrot * dt;
    if (p.y >= p.land){
      rested.push({ x: clamp(p.x, 6, W - 6), y: p.land, box: p.box, idx: p.idx, rot: p.rot, a: rand(0.7, 0.95) });
      if (rested.length > 90) rested.shift();
      petals.splice(i, 1); continue;
    }
    const a = p.age < 0.3 ? p.age / 0.3 : 1;
    drawSprite(SPR.crisp[p.idx], p.x, p.y, p.box, p.rot, a);
  }
}
function drawRested(){
  for (const r of rested) drawSprite(SPR.crisp[r.idx], r.x, r.y, r.box, r.rot, r.a);
}

function showWish(on){ wishEl.classList.toggle('is-in', on); }

/* the tree's own rAF: plays once from treeStart(), then holds, living */
let treeStartT = 0, treeLastT = 0, treeRAF = 0, lastPetal = 0, replayArmed = false;
window.bdayDone = false;

function treeFrame(now){
  if (!treeStartT){ treeStartT = now; treeLastT = now; }
  const t  = (now - treeStartT) / 1000;
  const dt = Math.min(0.05, (now - treeLastT) / 1000); treeLastT = now;

  const rays = clamp01((t - T.bloomT0) / T.bloomSpan);

  drawBackground();
  drawGodRays(t, rays);
  drawGlow(t);
  drawBokeh(t, dt);
  drawFloaters(t, dt, false);
  drawBranches(t);
  drawHearts(t);
  updateTwinkles(t, dt);
  if (t > T.petalT0 && now - lastPetal > 150){ spawnPetal(); spawnPetal(); lastPetal = now; }
  drawPetals(t, dt);
  drawRested();
  drawFloaters(t, dt, true);

  showWish(t >= T.noteStart);

  if (!window.bdayDone && t >= T.done) window.bdayDone = true;
  if (!replayArmed && t >= T.done + 1.0){ replayArmed = true; armReplay(); }

  treeRAF = requestAnimationFrame(treeFrame);
}

function treeStart(){
  treeStartT = 0; treeLastT = 0; lastPetal = 0; replayArmed = false; window.bdayDone = false;
  cue('grow');
  buildScene();
  if (!treeRAF) treeRAF = requestAnimationFrame(treeFrame);
}
function treeStop(){
  if (treeRAF){ cancelAnimationFrame(treeRAF); treeRAF = 0; }
  ctx.clearRect(0, 0, W, H);
}

function drawFinal(){
  buildScene();
  drawBackground(); drawGodRays(0, 1); drawGlow(T.done); drawBokeh(0, 0); drawFloaters(99, 0, false);
  drawBranches(99); drawHearts(99);
  for (let i = 0; i < 40; i++){ const h = hearts[(Math.random() * hearts.length) | 0]; if (h) rested.push({ x: clamp(h.x + rand(-W * 0.3, W * 0.3), 6, W - 6), y: groundY + rand(-6, H * 0.05), box: h.box * 0.5, idx: h.idx, rot: rand(0, 6.28), a: 0.85 }); }
  drawRested(); drawFloaters(99, 0, true);
  showWish(true);
  window.bdayDone = true;
}

/* ============================================================
   ACTS 1–3 (GSAP) — the bow, the shot, the wish
   ============================================================ */

/* the two headline words become per-glyph spans so each hinges up on its own */
function splitWord(el){
  if (!el) return [];
  const chars = [...el.textContent];
  el.textContent = '';
  return chars.map((c) => {
    const s = document.createElement('span');
    s.className = 'hl__ch';
    s.textContent = c === ' ' ? '\u00A0' : c;
    el.appendChild(s);
    return s;
  });
}
let line1Chars = splitWord($('wLine1'));
let line2Chars = splitWord($('wLine2'));
let kChars = [...line1Chars, ...line2Chars];

function rebuildKineticChars(){
  line1Chars = splitWord($('wLine1'));
  line2Chars = splitWord($('wLine2'));
  kChars = [...line1Chars, ...line2Chars];
}

/* ============================================================
   FRIEND & WISH CUSTOMIZATION SYSTEM
   ============================================================ */
const STORAGE_KEY = 'bday_friends_list_v2';
const ACTIVE_KEY = 'bday_active_friend_id_v2';

const TELUGU_NANI_PAGES = [
  {
    title: 'డియర్ నాని (Manideepika) ✨',
    body: "చిన్నప్పటి నుండి నా బెస్ట్ ఫ్రెండ్ గా ఉన్నందుకు చాలా చాలా థాంక్స్ నాని.\n\nమన పరిచయం, మన స్నేహం ఇప్పటిది కాదు... చిన్ననాటి రోజుల నుండి మొదలైన ఈ బంధం నా జీవితంలో ఎప్పటికీ చాలా ప్రత్యేకం."
  },
  {
    title: 'మన పాత రోజులు 🌸',
    body: "నిన్ను, మన పాత రోజులను చాలా మిస్ అవుతున్నాను.\n\nచిన్నప్పుడు మనం కలిసి ఆడుకున్న ఆటలు, గడిపిన క్షణాలు, చేసిన అల్లరి... ప్రతి జ్ఞాపకం నా మనసులో ఇంకా తాజాగా ఉంది. ఎంత కాలం గడిచినా ఆ రోజులు ఎప్పటికీ మరచిపోలేను."
  },
  {
    title: 'స్నేహానికి ధన్యవాదాలు 💖',
    body: "కాలం మారుతున్నా, మనం ఎక్కడ ఉన్నా... మన చిన్ననాటి స్నేహం ఎప్పటికీ అలాగే నిలిచి ఉంటుంది.\n\nఎటువంటి భేషజాలు లేకుండా నాతో మాట్లాడే ఒక నిజమైన స్నేహితురాలివి నువ్వు. నీలాంటి మంచి ఫ్రెండ్ నా జీవితంలో ఉండటం నా అదృష్టం."
  },
  {
    title: 'నా హృదయపూర్వక శుభాకాంక్షలు 🎂',
    body: "ఈ పుట్టినరోజు నీకు ఎన్నో సంతోషాలను, విజయాలను తీసుకురావాలని మనస్ఫూర్తిగా కోరుకుంటున్నాను.\n\nనువ్వు అనుకున్న ప్రతి కల నిజం కావాలి. నీ ముఖంలో చిరునవ్వు ఎల్లప్పుడూ వెలుగుతూ ఉండాలి."
  },
  {
    title: 'హ్యాపీ బర్త్ డే నాని! 💐',
    body: "Once again, Happy Birthday Manideepika (Nani)! 🎉\n\nజీవితంలో నువ్వు మరింత ఉన్నత స్థాయికి ఎదగాలని, ఎల్లప్పుడూ ఆనందంగా, ఆరోగ్యంగా ఉండాలని కోరుకుంటున్నాను.\n\nమన స్నేహం ఇలాగే ఎప్పటికీ కొనసాగాలని ఆశిస్తూ...\n- నీ చిన్ననాటి బెస్ట్ ఫ్రెండ్ ♥"
  }
];

const PRESET_MESSAGES = {
  nani: {
    wLine1: 'Happy',
    wLine2: 'Birthday Nani!',
    wHero: 'Happy Birthday Manideepika',
    eyebrow: 'చిన్ననాటి స్నేహితురాలు నానికి... ప్రేమతో',
    kSub: 'చిన్నప్పటి నుండి నా బెస్ట్ ఫ్రెండ్ గా ఉన్నందుకు థాంక్స్',
    wSub: 'నిన్ను, మన పాత రోజులను చాలా మిస్ అవుతున్నాను నాని',
    letterPages: TELUGU_NANI_PAGES
  },
  bestie: {
    wLine1: 'Happy',
    wLine2: 'Birthday!',
    wHero: 'Happy Birthday',
    eyebrow: 'a little something, for my best friend',
    kSub: 'to someone worth celebrating every day',
    wSub: "here's to a year that blooms with endless joy",
    letterPages: [
      { title: 'Dear Bestie', body: "Where do I even begin? You're the one person who's been there through every laugh, every cry, and every late-night conversation that somehow lasted until sunrise.\n\nI know life hasn't always been easy, but you've faced every challenge with a strength that inspires me every single day." },
      { title: 'Our Memories', body: "Remember that time we got completely lost on that road trip and ended up at the most amazing little café? Or when we stayed up all night watching terrible movies and laughing until our stomachs hurt?\n\nThose memories are my treasures. Every single one of them." },
      { title: 'What You Mean To Me', body: "You're not just my friend — you're my chosen family. The person I can be completely, unapologetically myself around. You see me at my worst and still somehow think I'm at my best.\n\nThat kind of love? It's rare. And I never take it for granted." },
      { title: 'My Wish For You', body: "On this birthday, I wish you everything your beautiful heart desires. May this year bring you adventures that take your breath away, love that fills your soul, and moments that make you feel truly alive.\n\nYou deserve the world and then some." },
      { title: 'Forever & Always', body: "Happy Birthday, my incredible best friend. Thank you for being YOU — perfectly, wonderfully, beautifully you.\n\nHere's to another year of making memories together. I love you more than words could ever express.\n\nForever yours,\nYour Bestie ♥" }
    ]
  },
  sweet: {
    wLine1: 'Wishing You',
    wLine2: 'Pure Joy',
    wHero: 'Happy Birthday',
    eyebrow: 'a little something, wrapped with love',
    kSub: 'to a truly wonderful soul',
    wSub: 'may your day bloom with happiness & light',
    letterPages: [
      { title: 'My Dearest Friend', body: "Today is YOUR day, and I want you to feel every ounce of love that surrounds you. Because you are so, so loved.\n\nFrom the moment you came into my life, everything became a little brighter, a little warmer, a little more magical." },
      { title: 'Your Beautiful Soul', body: "There's something about you that lights up every room you walk into. It's not just your smile (though that's pretty incredible too) — it's your heart.\n\nThe way you care about others, the way you listen, the way you love — it's beautiful." },
      { title: 'The Little Things', body: "I love the way your eyes light up when you talk about something you're passionate about. I love your laugh — the real one, not the polite one.\n\nI love how you always know exactly what to say when I need to hear it most. These little things? They mean everything." },
      { title: 'A Birthday Promise', body: "I promise to always be there — in the celebrations and in the quiet moments. When the world feels too heavy, I'll help you carry it. When you forget how amazing you are, I'll remind you.\n\nThat's my birthday promise to you." },
      { title: 'With All My Love', body: "May this birthday mark the beginning of your most beautiful chapter yet. May every sunrise bring new hope, every sunset bring peace, and every moment in between bring joy.\n\nHappy Birthday, sweetheart. You are endlessly loved.\n\nWith all my heart ♥" }
    ]
  },
  poetic: {
    wLine1: 'Celebrate',
    wLine2: 'Your Light',
    wHero: 'Happy Birthday',
    eyebrow: 'as another golden year unfolds',
    kSub: 'to a star that shines brighter than all',
    wSub: "here's to a year that blooms in radiant grace",
    letterPages: [
      { title: 'A Star Was Born', body: "On this day, the universe conspired to create something extraordinary — you. The stars aligned, the winds whispered, and into this world came a soul unlike any other.\n\nAnd what a magnificent soul you are." },
      { title: 'Written in the Stars', body: "If I could write your story across the sky, it would be the most beautiful constellation — a map of courage, kindness, and infinite light.\n\nEvery chapter of your life has been a poem, and every verse has been worth reading." },
      { title: 'The Garden of You', body: "You are a garden in perpetual bloom. Even in winter, when the world turns cold and grey, you find a way to blossom.\n\nYour resilience is the soil. Your hope is the rain. Your love is the sunlight that makes everything grow." },
      { title: 'Time & Tide', body: "As the tides of time carry us forward, some things remain constant — the North Star in my sky, the anchor in my storm, the light in my darkness.\n\nThat constant is you.\n\nThrough every season, every storm, every sunrise — you remain." },
      { title: 'An Eternal Wish', body: "So on this birthday, I don't just wish you happiness — I wish you wonder. The kind that makes you stop and stare at the sunset. The kind that makes your heart race with possibility.\n\nMay you forever bloom, forever shine, forever be.\n\nWith love beyond measure ♥" }
    ]
  },
  fun: {
    wLine1: 'Time To',
    wLine2: 'Party!',
    wHero: 'Happy Birthday',
    eyebrow: 'get ready to blow out the candles!',
    kSub: 'the legend was born on this day',
    wSub: 'cheers to extra cake, laughter & good times',
    letterPages: [
      { title: "It's Party Time! 🎉", body: "HAPPY BIRTHDAY, YOU ABSOLUTE LEGEND! 🎂\n\nAnother year older, another year wiser (debatable 😂), and another year more awesome. Let's be real — you're aging like fine wine. Actually, scratch that. You're aging like pizza — somehow getting better every time." },
      { title: 'The Highlight Reel', body: "Let's talk about your greatest hits this year:\n\n• That time you tripped over literally nothing and played it off like a dance move? ICONIC. 💃\n• Your cooking experiments that ranged from 'actually delicious' to 'is this a crime?'\n• All those 'I'll go to bed early tonight' lies you told yourself\n\nNever change. 😂" },
      { title: 'Birthday Commandments', body: "On this sacred day, I hereby declare the following Birthday Commandments:\n\n1. Thou SHALT eat cake for breakfast 🍰\n2. Thou SHALT NOT count calories today\n3. Thou SHALT take at least 47 selfies 📸\n4. Thou SHALT dance like nobody's watching\n5. Thou SHALT accept ALL compliments without deflecting" },
      { title: "What I Won't Say", body: "I won't say something mushy like 'you're the best person I know' because... okay fine, YOU ARE.\n\nI won't tell you that my life is infinitely better because of you, or that you make even the most boring days fun, or that your laugh is literally my favorite sound.\n\nOh wait. I just did. 😏" },
      { title: "Here's To You! 🥂", body: "Happy Birthday to the person who:\n• Makes everything more fun\n• Has the best meme game\n• Can turn any situation into a good time\n• Is low-key (high-key) the best human ever\n\nNow go celebrate like the absolute LEGEND you are! 🎉🎊🥳\n\nLove you to the moon and back! 🚀♥" }
    ]
  }
};

const DEFAULT_FRIENDS = [
  {
    id: 'friend_nani',
    name: 'Manideepika (Nani)',
    photos: ['/photos/memory1.jpg', '/photos/memory2.jpg', '/photos/memory3.jpg'],
    photo: '/photos/memory1.jpg',
    wLine1: 'Happy',
    wLine2: 'Birthday Nani!',
    wHero: 'Happy Birthday Manideepika',
    eyebrow: 'చిన్ననాటి స్నేహితురాలు నానికి... ప్రేమతో',
    kSub: 'చిన్నప్పటి నుండి నా బెస్ట్ ఫ్రెండ్ గా ఉన్నందుకు థాంక్స్',
    wSub: 'నిన్ను, మన పాత రోజులను చాలా మిస్ అవుతున్నాను నాని',
    letterPages: TELUGU_NANI_PAGES
  }
];

let savedFriends = [];
let activeFriendId = null;
let currentPhotos = [];
let modalPhotos = [];
let activePhotoIndex = 0;
let deckSlideshowTimer = null;
let lightboxActiveIdx = 0;
let currentLetterPages = [];
let currentLetterPageIdx = 0;
let modalLetterPages = [];

function loadFriendsList(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    savedFriends = raw ? JSON.parse(raw) : [...DEFAULT_FRIENDS];
  } catch (_) {
    savedFriends = [...DEFAULT_FRIENDS];
  }
  activeFriendId = localStorage.getItem(ACTIVE_KEY) || (savedFriends[0] && savedFriends[0].id) || 'friend_nani';
}

function saveFriendsList(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFriends));
    localStorage.setItem(ACTIVE_KEY, activeFriendId);
  } catch (_) {}
}

function parseURLParams(){
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name');
  if (name){
    const pics = params.get('pics');
    const photoArr = pics ? pics.split(',') : (params.get('pic') ? [params.get('pic')] : []);
    return {
      id: 'url_' + Date.now(),
      name: name,
      photos: photoArr,
      photo: photoArr[0] || '',
      wLine1: params.get('w1') || 'Happy',
      wLine2: params.get('w2') || (`Birthday ${name}!`),
      wHero: params.get('hero') || (`Happy Birthday ${name}`),
      eyebrow: params.get('eyebrow') || (`a little something, for ${name}`),
      kSub: params.get('kSub') || 'to someone worth celebrating',
      wSub: params.get('wSub') || "here's to a year that blooms"
    };
  }
  return null;
}

function applyWishData(data){
  if (!data) return;
  
  const eb = $('eyebrow'); if (eb) eb.textContent = data.eyebrow || 'a little something, for you';
  const web = $('wEyebrow'); if (web) web.textContent = data.eyebrow || 'a little something, for you';
  
  const wl1 = $('wLine1'); if (wl1) wl1.textContent = data.wLine1 || 'Happy';
  const wl2 = $('wLine2'); if (wl2) wl2.textContent = data.wLine2 || 'Birthday';
  
  const ks = $('kSub'); if (ks) ks.textContent = data.kSub || 'to someone worth celebrating';
  const wh = $('wHero'); if (wh) wh.textContent = data.wHero || 'Happy Birthday';
  const ws = $('wSub'); if (ws) ws.textContent = data.wSub || "here's to a year that blooms";

  rebuildKineticChars();

  // Multi-Photo album
  currentPhotos = data.photos && data.photos.length > 0 ? [...data.photos] : (data.photo ? [data.photo] : []);
  activePhotoIndex = 0;
  renderPhotoDeck();

  // Personal letter pages
  currentLetterPages = data.letterPages && data.letterPages.length > 0 ? [...data.letterPages] : [];
  currentLetterPageIdx = 0;
  
  const letterBtn = $('openLetterBtn');
  if (letterBtn) {
    letterBtn.hidden = currentLetterPages.length === 0;
  }
}

/* ============================================================
   MULTI-PHOTO DECK & CAROUSEL (ACT 4)
   ============================================================ */
function renderPhotoDeck(){
  const photoDeck = $('wishPhotoDeck');
  const stackEl = $('photoDeckStack');
  const dotsEl = $('photoDeckDots');
  const prevBtn = $('photoNavPrev');
  const nextBtn = $('photoNavNext');
  
  if (!photoDeck || !stackEl) return;

  if (!currentPhotos || currentPhotos.length === 0){
    photoDeck.hidden = true;
    stopDeckSlideshow();
    return;
  }

  photoDeck.hidden = false;
  stackEl.innerHTML = '';
  if (dotsEl) dotsEl.innerHTML = '';

  currentPhotos.forEach((src, idx) => {
    const card = document.createElement('div');
    card.className = 'photoDeck__card';
    card.dataset.index = idx;

    card.innerHTML = `
      <div class="photoDeck__imgWrap">
        <img class="photoDeck__img" src="${src}" alt="Memory Photo ${idx + 1}" />
        <div class="photoDeck__badge">♥</div>
      </div>
      <div class="photoDeck__caption">Memory #${idx + 1}</div>
    `;

    const triggerOpen = (e) => {
      if (e) {
        e.stopPropagation();
      }
      openLightbox(idx);
    };

    card.addEventListener('click', triggerOpen);
    card.addEventListener('pointerup', (e) => {
      // Prevent drag vs click conflicts
      if (e.pointerType === 'touch') {
        triggerOpen(e);
      }
    });

    stackEl.appendChild(card);

    if (dotsEl && currentPhotos.length > 1){
      const dot = document.createElement('span');
      dot.className = `photoDeck__dot ${idx === activePhotoIndex ? 'is-active' : ''}`;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        activePhotoIndex = idx;
        updateDeckStack();
      });
      dotsEl.appendChild(dot);
    }
  });

  if (prevBtn){
    prevBtn.disabled = currentPhotos.length <= 1;
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      activePhotoIndex = (activePhotoIndex - 1 + currentPhotos.length) % currentPhotos.length;
      updateDeckStack();
    };
  }

  if (nextBtn){
    nextBtn.disabled = currentPhotos.length <= 1;
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      activePhotoIndex = (activePhotoIndex + 1) % currentPhotos.length;
      updateDeckStack();
    };
  }

  updateDeckStack();
  startDeckSlideshow();
}

function updateDeckStack(){
  const stackEl = $('photoDeckStack');
  const dotsEl = $('photoDeckDots');
  if (!stackEl) return;

  const cards = stackEl.querySelectorAll('.photoDeck__card');
  const dots = dotsEl ? dotsEl.querySelectorAll('.photoDeck__dot') : [];
  const total = currentPhotos.length;

  if (total === 0) return;

  if (activePhotoIndex >= total) activePhotoIndex = 0;
  if (activePhotoIndex < 0) activePhotoIndex = total - 1;

  cards.forEach((card, idx) => {
    card.classList.remove('is-active', 'is-prev', 'is-next', 'is-hidden');

    if (idx === activePhotoIndex){
      card.classList.add('is-active');
    } else if (idx === (activePhotoIndex - 1 + total) % total){
      card.classList.add('is-prev');
    } else if (idx === (activePhotoIndex + 1) % total){
      card.classList.add('is-next');
    } else {
      card.classList.add('is-hidden');
    }
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle('is-active', idx === activePhotoIndex);
  });
}

function startDeckSlideshow(){
  stopDeckSlideshow();
  if (currentPhotos.length <= 1) return;
  deckSlideshowTimer = setInterval(() => {
    activePhotoIndex = (activePhotoIndex + 1) % currentPhotos.length;
    updateDeckStack();
  }, 4500);
}

function stopDeckSlideshow(){
  if (deckSlideshowTimer){
    clearInterval(deckSlideshowTimer);
    deckSlideshowTimer = null;
  }
}

/* ============================================================
   LIGHTBOX PHOTO VIEWER MODAL
   ============================================================ */
function openLightbox(idx){
  stopDeckSlideshow();
  lightboxActiveIdx = idx;
  const lb = $('photoLightbox');
  if (!lb) return;
  
  lb.hidden = false;
  lb.style.display = 'flex';
  updateLightbox();
}

function closeLightbox(){
  const lb = $('photoLightbox');
  if (lb) {
    lb.hidden = true;
    lb.style.display = 'none';
  }
  startDeckSlideshow();
}

function updateLightbox(){
  const img = $('lightboxImg');
  const counter = $('lightboxCounter');
  const thumbs = $('lightboxThumbs');
  if (!img) return;

  if (!currentPhotos || currentPhotos.length === 0){
    closeLightbox();
    return;
  }

  if (lightboxActiveIdx >= currentPhotos.length) lightboxActiveIdx = 0;
  if (lightboxActiveIdx < 0) lightboxActiveIdx = currentPhotos.length - 1;

  img.src = currentPhotos[lightboxActiveIdx];
  if (counter) counter.textContent = `${lightboxActiveIdx + 1} / ${currentPhotos.length}`;

  if (thumbs){
    thumbs.innerHTML = '';
    currentPhotos.forEach((src, idx) => {
      const t = document.createElement('div');
      t.className = `lightbox__thumb ${idx === lightboxActiveIdx ? 'is-active' : ''}`;
      t.innerHTML = `<img src="${src}" alt="Thumb ${idx + 1}" />`;
      t.addEventListener('click', () => {
        lightboxActiveIdx = idx;
        updateLightbox();
      });
      thumbs.appendChild(t);
    });
  }
}

function initLightboxEvents(){
  const closeBtn = $('lightboxClose');
  const backdrop = $('lightboxBackdrop');
  const prevBtn = $('lightboxPrev');
  const nextBtn = $('lightboxNext');

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (backdrop) backdrop.addEventListener('click', closeLightbox);

  if (prevBtn) prevBtn.addEventListener('click', () => {
    lightboxActiveIdx = (lightboxActiveIdx - 1 + currentPhotos.length) % currentPhotos.length;
    updateLightbox();
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    lightboxActiveIdx = (lightboxActiveIdx + 1) % currentPhotos.length;
    updateLightbox();
  });

  window.addEventListener('keydown', (e) => {
    const lb = $('photoLightbox');
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft'){
      lightboxActiveIdx = (lightboxActiveIdx - 1 + currentPhotos.length) % currentPhotos.length;
      updateLightbox();
    }
    if (e.key === 'ArrowRight'){
      lightboxActiveIdx = (lightboxActiveIdx + 1) % currentPhotos.length;
      updateLightbox();
    }
  });
}

/* ============================================================
   ACT 5 — PERSONAL LETTER BOOK (display + navigation)
   ============================================================ */
function openLetterBook(){
  const lb = $('letterBook');
  if (!lb || currentLetterPages.length === 0) return;
  currentLetterPageIdx = 0;
  renderLetterBookPages();
  lb.hidden = false;
}

function closeLetterBook(){
  const lb = $('letterBook');
  if (lb) lb.hidden = true;
}

function renderLetterBookPages(){
  const bookEl = $('letterBookPages');
  const dotsEl = $('letterDots');
  if (!bookEl) return;

  bookEl.innerHTML = '';
  if (dotsEl) dotsEl.innerHTML = '';

  currentLetterPages.forEach((page, idx) => {
    const pageEl = document.createElement('div');
    pageEl.className = 'letterPage';
    pageEl.dataset.index = idx;

    const isFirstPage = idx === 0;
    const isLastPage = idx === currentLetterPages.length - 1;

    pageEl.innerHTML = `
      <div class="letterPage__inner">
        <div class="letterPage__header">
          <span class="letterPage__pageNum">Page ${idx + 1} of ${currentLetterPages.length}</span>
          <span class="letterPage__heart">♥</span>
        </div>
        ${page.title ? `<div class="letterPage__title">${page.title}</div>` : ''}
        <div class="letterPage__divider"></div>
        <div class="letterPage__body">${escapeHtml(page.body || '')}</div>
        <div class="letterPage__footer">
          <span class="letterPage__footerHeart">♥</span>
          <span class="letterPage__footerText">${isLastPage ? 'with love, always' : 'turn the page...'}</span>
          <span class="letterPage__footerHeart">♥</span>
        </div>
      </div>
    `;
    bookEl.appendChild(pageEl);

    if (dotsEl) {
      const dot = document.createElement('span');
      dot.className = `letterDot ${idx === currentLetterPageIdx ? 'is-active' : ''}`;
      dot.addEventListener('click', () => {
        currentLetterPageIdx = idx;
        updateLetterBookPage();
      });
      dotsEl.appendChild(dot);
    }
  });

  updateLetterBookPage();
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function updateLetterBookPage(){
  const bookEl = $('letterBookPages');
  const dotsEl = $('letterDots');
  const indicator = $('letterPageIndicator');
  const prevBtn = $('letterPrev');
  const nextBtn = $('letterNext');
  if (!bookEl) return;

  const total = currentLetterPages.length;
  if (currentLetterPageIdx < 0) currentLetterPageIdx = 0;
  if (currentLetterPageIdx >= total) currentLetterPageIdx = total - 1;

  const pages = bookEl.querySelectorAll('.letterPage');
  pages.forEach((p, idx) => {
    p.classList.remove('is-active', 'is-prev', 'is-next');
    if (idx === currentLetterPageIdx) {
      p.classList.add('is-active');
    } else if (idx < currentLetterPageIdx) {
      p.classList.add('is-prev');
    } else {
      p.classList.add('is-next');
    }
  });

  if (dotsEl) {
    dotsEl.querySelectorAll('.letterDot').forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === currentLetterPageIdx);
    });
  }

  if (indicator) indicator.textContent = `Page ${currentLetterPageIdx + 1} / ${total}`;
  if (prevBtn) prevBtn.disabled = currentLetterPageIdx <= 0;
  if (nextBtn) nextBtn.disabled = currentLetterPageIdx >= total - 1;
}

function initLetterBookEvents(){
  const closeBtn = $('letterBookClose');
  const backdrop = $('letterBookBackdrop');
  const prevBtn = $('letterPrev');
  const nextBtn = $('letterNext');
  const openBtn = $('openLetterBtn');

  if (openBtn) openBtn.addEventListener('click', openLetterBook);
  if (closeBtn) closeBtn.addEventListener('click', closeLetterBook);
  if (backdrop) backdrop.addEventListener('click', closeLetterBook);

  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentLetterPageIdx > 0) {
      currentLetterPageIdx--;
      updateLetterBookPage();
    }
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentLetterPageIdx < currentLetterPages.length - 1) {
      currentLetterPageIdx++;
      updateLetterBookPage();
    }
  });

  window.addEventListener('keydown', (e) => {
    const lb = $('letterBook');
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeLetterBook();
    if (e.key === 'ArrowLeft' && currentLetterPageIdx > 0) {
      currentLetterPageIdx--;
      updateLetterBookPage();
    }
    if (e.key === 'ArrowRight' && currentLetterPageIdx < currentLetterPages.length - 1) {
      currentLetterPageIdx++;
      updateLetterBookPage();
    }
  });
}

/* ============================================================
   LETTER PAGES EDITOR (inside customizer modal)
   ============================================================ */
const DEFAULT_LETTER_PAGES = [
  { title: 'Dear Friend', body: '' },
  { title: 'Our Memories', body: '' },
  { title: 'What You Mean To Me', body: '' },
  { title: 'My Birthday Wish', body: '' },
  { title: 'With All My Love', body: '' }
];

function renderLetterPagesEditor(){
  const editorEl = $('letterPagesEditor');
  const countEl = $('letterPageCount');
  if (!editorEl) return;

  editorEl.innerHTML = '';

  modalLetterPages.forEach((page, idx) => {
    const item = document.createElement('div');
    item.className = 'letterPageEditorItem';
    
    const canRemove = modalLetterPages.length > 5;

    item.innerHTML = `
      <div class="letterPageEditorItem__header">
        <span class="letterPageEditorItem__label">📄 Page ${idx + 1}</span>
        ${canRemove ? `<button type="button" class="letterPageEditorItem__removeBtn" title="Remove page">&times;</button>` : ''}
      </div>
      <input type="text" class="letterPageEditorItem__titleInput" placeholder="Page title (e.g. Dear Friend)" value="${escapeAttr(page.title || '')}" data-idx="${idx}" data-field="title" />
      <textarea class="letterPageEditorItem__textarea" placeholder="Write your message here... Pour your heart out! ♥" data-idx="${idx}" data-field="body">${escapeHtml(page.body || '')}</textarea>
    `;

    // Title input sync
    const titleInput = item.querySelector('.letterPageEditorItem__titleInput');
    titleInput.addEventListener('input', (e) => {
      modalLetterPages[idx].title = e.target.value;
    });

    // Body textarea sync
    const textarea = item.querySelector('.letterPageEditorItem__textarea');
    textarea.addEventListener('input', (e) => {
      modalLetterPages[idx].body = e.target.value;
    });

    // Remove button
    if (canRemove) {
      const removeBtn = item.querySelector('.letterPageEditorItem__removeBtn');
      removeBtn.addEventListener('click', () => {
        modalLetterPages.splice(idx, 1);
        renderLetterPagesEditor();
      });
    }

    editorEl.appendChild(item);
  });

  if (countEl) countEl.textContent = `${modalLetterPages.length} page${modalLetterPages.length !== 1 ? 's' : ''}`;
}

function escapeAttr(str){
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================================
   MULTI-PHOTO CUSTOMIZER UPLOAD GRID
   ============================================================ */
function renderMultiPhotoGrid(){
  const grid = $('multiPhotoGrid');
  const placeholder = $('photoPlaceholder');
  const clearBtn = $('btnClearAllPhotos');

  if (!grid) return;
  grid.innerHTML = '';

  if (modalPhotos.length > 0){
    if (placeholder) placeholder.hidden = true;
    if (clearBtn) clearBtn.hidden = false;

    modalPhotos.forEach((src, idx) => {
      const item = document.createElement('div');
      item.className = 'multiPhotoGrid__item';
      item.innerHTML = `
        <img class="multiPhotoGrid__img" src="${src}" alt="Photo ${idx + 1}" />
        <button type="button" class="multiPhotoGrid__remove" title="Remove photo">&times;</button>
      `;
      item.querySelector('.multiPhotoGrid__remove').addEventListener('click', () => {
        modalPhotos.splice(idx, 1);
        renderMultiPhotoGrid();
      });
      grid.appendChild(item);
    });
  } else {
    if (placeholder) placeholder.hidden = false;
    if (clearBtn) clearBtn.hidden = true;
  }
}

function handleMultiplePhotoFiles(files){
  if (!files || !files.length) return;
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim){
          if (w > h){ h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const c = cv.getContext('2d');
        c.drawImage(img, 0, 0, w, h);
        const dataUrl = cv.toDataURL('image/jpeg', 0.85);
        modalPhotos.push(dataUrl);
        renderMultiPhotoGrid();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function populateModalForm(data){
  const inputName = $('inputFriendName');
  const inputHero = $('inputwHero');
  const inputLine1 = $('inputWLine1');
  const inputLine2 = $('inputWLine2');
  const inputEyebrow = $('inputEyebrow');
  const inputKSub = $('inputKSub');
  const inputWSub = $('inputWSub');

  if (inputName) inputName.value = data.name || '';
  if (inputHero) inputHero.value = data.wHero || '';
  if (inputLine1) inputLine1.value = data.wLine1 || '';
  if (inputLine2) inputLine2.value = data.wLine2 || '';
  if (inputEyebrow) inputEyebrow.value = data.eyebrow || '';
  if (inputKSub) inputKSub.value = data.kSub || '';
  if (inputWSub) inputWSub.value = data.wSub || '';
  
  modalPhotos = data.photos && data.photos.length > 0 ? [...data.photos] : (data.photo ? [data.photo] : []);
  renderMultiPhotoGrid();

  // Letter pages
  if (data.letterPages && data.letterPages.length > 0) {
    modalLetterPages = data.letterPages.map(p => ({ title: p.title || '', body: p.body || '' }));
  } else {
    modalLetterPages = DEFAULT_LETTER_PAGES.map(p => ({ title: p.title, body: p.body }));
  }
  // Ensure minimum 5 pages
  while (modalLetterPages.length < 5) {
    modalLetterPages.push({ title: '', body: '' });
  }
  renderLetterPagesEditor();
}

function renderFriendsList(){
  const friendsListEl = $('friendsList');
  if (!friendsListEl) return;
  friendsListEl.innerHTML = '';
  savedFriends.forEach((friend) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `friendPill ${friend.id === activeFriendId ? 'is-active' : ''}`;
    pill.innerHTML = `<span>♥ ${friend.name}</span>`;
    pill.addEventListener('click', () => {
      activeFriendId = friend.id;
      populateModalForm(friend);
      renderFriendsList();
    });
    friendsListEl.appendChild(pill);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'friendPill friendPill__add';
  addBtn.innerHTML = '<span>+ New Friend</span>';
  addBtn.addEventListener('click', () => {
    activeFriendId = 'new_' + Date.now();
    populateModalForm({
      name: '',
      photos: [],
      wLine1: 'Happy',
      wLine2: 'Birthday!',
      wHero: 'Happy Birthday',
      eyebrow: 'a little something, for you',
      kSub: 'to someone worth celebrating',
      wSub: "here's to a year that blooms",
      letterPages: DEFAULT_LETTER_PAGES.map(p => ({ ...p }))
    });
    renderFriendsList();
  });
  friendsListEl.appendChild(addBtn);
}

function initCustomizer(){
  loadFriendsList();
  initLightboxEvents();
  initLetterBookEvents();
  
  const urlFriend = parseURLParams();
  let currentFriend = urlFriend || savedFriends.find((f) => f.id === activeFriendId) || savedFriends[0];
  
  if (currentFriend){
    applyWishData(currentFriend);
  }

  const modal = $('customizerModal');
  const openBtn = $('openCustomizerBtn');
  const closeBtn = $('closeCustomizerBtn');
  const backdrop = $('modalBackdrop');
  const photoInput = $('friendPhotoInput');
  const dropZone = $('photoDropZone');
  const browseBtn = $('btnBrowsePhoto');
  const clearAllPhotosBtn = $('btnClearAllPhotos');

  const inputName = $('inputFriendName');
  const inputHero = $('inputwHero');
  const inputLine1 = $('inputWLine1');
  const inputLine2 = $('inputWLine2');
  const inputEyebrow = $('inputEyebrow');
  const inputKSub = $('inputKSub');
  const inputWSub = $('inputWSub');

  const saveBtn = $('btnSaveWish');
  const showQrBtn = $('btnShowQr');
  const qrModal = $('qrModal');
  const closeQrModalBtn = $('closeQrModalBtn');
  const qrModalBackdrop = $('qrModalBackdrop');

  if (!modal || !openBtn) return;

  // Open / Close Modal
  openBtn.addEventListener('click', () => {
    renderFriendsList();
    const active = savedFriends.find((f) => f.id === activeFriendId) || currentFriend || {};
    populateModalForm(active);
    modal.hidden = false;
  });

  const closeModal = () => { modal.hidden = true; };
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  // Photo handlers
  if (browseBtn && photoInput) browseBtn.addEventListener('click', () => photoInput.click());
  if (photoInput) photoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) handleMultiplePhotoFiles(e.target.files);
  });

  if (clearAllPhotosBtn) clearAllPhotosBtn.addEventListener('click', () => {
    modalPhotos = [];
    renderMultiPhotoGrid();
  });

  if (dropZone){
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('is-dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('is-dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleMultiplePhotoFiles(e.dataTransfer.files);
    });
  }

  // Presets
  document.querySelectorAll('.presetPill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pKey = btn.dataset.preset;
      const p = PRESET_MESSAGES[pKey];
      if (!p) return;
      const fname = inputName.value.trim() || 'Friend';
      inputLine1.value = p.wLine1;
      inputLine2.value = p.wLine2.includes('!') ? p.wLine2 : `${p.wLine2} ${fname}!`;
      inputHero.value = `${p.wHero} ${fname}`;
      inputEyebrow.value = p.eyebrow.includes('friend') ? p.eyebrow : `${p.eyebrow}, for ${fname}`;
      inputKSub.value = p.kSub;
      inputWSub.value = p.wSub;
      // Also set letter pages from preset
      if (p.letterPages && p.letterPages.length > 0) {
        modalLetterPages = p.letterPages.map(lp => ({
          title: lp.title.replace(/Friend/g, fname),
          body: lp.body
        }));
        renderLetterPagesEditor();
      }
    });
  });

  if (inputName){
    inputName.addEventListener('input', () => {
      const val = inputName.value.trim();
      if (val){
        if (!inputHero.value || inputHero.value.startsWith('Happy Birthday')){
          inputHero.value = `Happy Birthday ${val}`;
        }
      }
    });
  }

  // Save wish
  if (saveBtn){
    saveBtn.addEventListener('click', () => {
      const nameVal = inputName.value.trim() || 'Friend';
      const friendObj = {
        id: activeFriendId || ('friend_' + Date.now()),
        name: nameVal,
        photos: [...modalPhotos],
        photo: modalPhotos[0] || '',
        wLine1: inputLine1.value.trim() || 'Happy',
        wLine2: inputLine2.value.trim() || 'Birthday!',
        wHero: inputHero.value.trim() || `Happy Birthday ${nameVal}`,
        eyebrow: inputEyebrow.value.trim() || `a little something, for ${nameVal}`,
        kSub: inputKSub.value.trim() || 'to someone worth celebrating',
        wSub: inputWSub.value.trim() || "here's to a year that blooms",
        letterPages: modalLetterPages.filter(p => p.title.trim() || p.body.trim()).map(p => ({ title: p.title, body: p.body }))
      };

      const existingIdx = savedFriends.findIndex((f) => f.id === friendObj.id);
      if (existingIdx >= 0){
        savedFriends[existingIdx] = friendObj;
      } else {
        savedFriends.push(friendObj);
      }
      activeFriendId = friendObj.id;
      saveFriendsList();

      applyWishData(friendObj);
      closeModal();

      if (typeof resetAll === 'function'){
        resetAll();
      }
    });
  }

  // QR Code sharing
  const closeQr = () => { if (qrModal) qrModal.hidden = true; };
  if (closeQrModalBtn) closeQrModalBtn.addEventListener('click', closeQr);
  if (qrModalBackdrop) qrModalBackdrop.addEventListener('click', closeQr);

  if (showQrBtn) {
    showQrBtn.addEventListener('click', () => {
      const nameVal = inputName.value.trim() || 'Friend';
      const url = new URL(window.location.href);
      url.searchParams.set('name', nameVal);
      url.searchParams.set('w1', inputLine1.value.trim() || 'Happy');
      url.searchParams.set('w2', inputLine2.value.trim() || 'Birthday!');
      url.searchParams.set('hero', inputHero.value.trim() || `Happy Birthday ${nameVal}`);
      url.searchParams.set('eyebrow', inputEyebrow.value.trim() || `a little something, for ${nameVal}`);
      url.searchParams.set('kSub', inputKSub.value.trim() || 'to someone worth celebrating');
      url.searchParams.set('wSub', inputWSub.value.trim() || "here's to a year that blooms");

      if (modalPhotos.length > 0) {
        url.searchParams.set('pics', modalPhotos.slice(0, 3).join(','));
      }

      const qrCanvas = $('qrCanvas');
      const qrLabel = $('qrFriendLabel');
      if (qrLabel) qrLabel.textContent = `For: ${nameVal}`;

      if (qrCanvas) {
        QRCode.toCanvas(qrCanvas, url.toString(), {
          width: 200,
          margin: 1,
          color: {
            dark: '#12040b',
            light: '#ffffff'
          }
        }, (err) => {
          if (err) console.error('QR generation error:', err);
        });
      }

      if (qrModal) qrModal.hidden = false;
    });
  }

  // Add Letter Page button
  const addPageBtn = $('btnAddLetterPage');
  if (addPageBtn) {
    addPageBtn.addEventListener('click', () => {
      modalLetterPages.push({ title: '', body: '' });
      renderLetterPagesEditor();
      // Scroll to the new page
      const editorEl = $('letterPagesEditor');
      if (editorEl) {
        requestAnimationFrame(() => {
          editorEl.scrollTop = editorEl.scrollHeight;
        });
      }
    });
  }
}

/* drifting light motes behind the scene */
function buildMotes(){
  motes.innerHTML = '';
  for (let i = 0; i < 12; i++){
    const m = document.createElement('span');
    m.className = 'mote';
    const s = rand(4, 12);
    m.style.width = m.style.height = `${s}px`;
    m.style.left = `${rand(4, 96)}%`;
    m.style.top  = `${rand(10, 96)}%`;
    motes.appendChild(m);
    gsap.set(m, { opacity: rand(0.25, 0.7) });
    gsap.to(m, { y: -rand(40, 140), x: rand(-30, 30), duration: rand(7, 14), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: -rand(0, 8) });
    gsap.to(m, { opacity: rand(0.1, 0.5), duration: rand(2.5, 5), repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }
}

/* --- bow geometry (measured; re-measured on resize) -------------------------
   The rig lives lower-left and is rotated so its local "up" axis points at the
   heart; the shot therefore travels on a diagonal. The draw + arrow math all
   live in the rig's LOCAL space (offset geometry is transform-independent, so
   rotation never corrupts it); only the aim ANGLE and the flight DISTANCE come
   from screen measurements. */
const tip = $('tip');
let svgScale = 1, arrowBaseX = 0, arrowBaseY = 0, maxDraw = 120, curDraw = 0;
let pullUX = 0, pullUY = 1;                               // screen unit: string pull-back
const REST_NOCK = 96;                                    // string nock, in bow viewBox units
const nockProxy = { val: REST_NOCK };

function applyNock(){
  const y = nockProxy.val;
  strL.setAttribute('y2', y); strR.setAttribute('y2', y); serving.setAttribute('cy', y);
}

function refreshRig(){
  // the grip is anchored here, and the heart sits at its layout centre (33% down,
  // centred) — using the layout point, not a live rect, keeps the aim steady even
  // while the heart is scaling in.
  const gripX = W * 0.24, gripY = H * 0.76;
  const heartX = W * 0.5, heartY = H * 0.33;
  // rotation so local "up" (0,-1) maps to the grip→heart direction
  const aimRad = Math.atan2(heartX - gripX, gripY - heartY);
  pullUX = -Math.sin(aimRad); pullUY = Math.cos(aimRad);  // opposite of aim = pull-back

  // #bow / #arrow are SVG — no offset* — so measure rects in the rig's LOCAL
  // frame: neutralise the rig transform first (getBBox-style, sync, no paint).
  nockProxy.val = REST_NOCK; applyNock();
  gsap.set(archery, { rotation: 0, scale: 1, x: 0, y: 0 });
  archery.style.left = '0px'; archery.style.top = '0px';
  gsap.set(arrow, { x: 0, y: 0 });
  const aR = archery.getBoundingClientRect();
  const bR = bow.getBoundingClientRect();
  const sR = serving.getBoundingClientRect();
  const rR = arrow.getBoundingClientRect();
  svgScale = bR.width / 460;
  const gripLX = (bR.left - aR.left) + 0.5 * bR.width;
  const gripLY = (bR.top  - aR.top ) + (240 / 300) * bR.height;   // grip ~y240 in viewBox
  const nockLX = (sR.left - aR.left) + 0.5 * sR.width;
  const nockLY = (sR.top  - aR.top ) + 0.5 * sR.height;
  arrowBaseX = nockLX - ((rR.left - aR.left) + 0.5 * rR.width);
  arrowBaseY = nockLY - ((rR.top  - aR.top ) + (205 / 220) * rR.height);

  // anchor the grip at (gripX,gripY) and rotate the rig around it
  archery.style.left = (gripX - gripLX) + 'px';
  archery.style.top  = (gripY - gripLY) + 'px';
  gsap.set(archery, { transformOrigin: `${gripLX}px ${gripLY}px`, rotation: aimRad * 180 / Math.PI });
  gsap.set(arrow, { x: arrowBaseX, y: arrowBaseY });
  maxDraw = Math.min(bR.height * 0.72, H * 0.16, 132);
  curDraw = 0;
}

function setDraw(d){
  curDraw = clamp(d, 0, maxDraw);
  gsap.set(arrow, { x: arrowBaseX, y: arrowBaseY + curDraw });   // local +Y = pull back
  nockProxy.val = REST_NOCK + curDraw / svgScale; applyNock();
  gsap.set(aim, { opacity: 0.55 * (curDraw / maxDraw) });
}

/* the target heart's beat — gentle, alive; killed the instant we fire */
let beatTL = null;
function startBeat(){
  gsap.set(targetHeart, { scale: 1 });
  gsap.set(heartGlow, { scale: 1, opacity: 0.7 });
  beatTL = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
  beatTL.to(targetHeart, { scale: 1.07, duration: 0.13, ease: 'power2.out' }, 0)
        .to(heartGlow,   { scale: 1.15, opacity: 0.9, duration: 0.13, ease: 'power2.out' }, 0)
        .to(targetHeart, { scale: 1.0, duration: 0.2, ease: 'power2.in' }, 0.13)
        .to(targetHeart, { scale: 1.05, duration: 0.12, ease: 'power2.out' }, 0.3)
        .to(targetHeart, { scale: 1.0, duration: 0.5, ease: 'power2.inOut' }, 0.42)
        .to(heartGlow,   { scale: 1.0, opacity: 0.7, duration: 0.7, ease: 'power2.inOut' }, 0.3);
}
function stopBeat(){ if (beatTL){ beatTL.kill(); beatTL = null; } gsap.set(targetHeart, { scale: 1 }); }

/* a little burst of hearts + sparks where the arrow strikes */
function miniHeartSVG(fill){
  return `<svg viewBox="0 0 24 22" width="100%" height="100%"><path d="M12 20C5.5 15 1.5 11.4 1.5 6.9 1.5 3.6 4 1.5 7 1.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3 0 5.5 2.1 5.5 5.4C23.5 11.4 19.5 15 12 20Z" fill="${fill}"/></svg>`;
}
function burstHearts(){
  const r = target.getBoundingClientRect();
  const hr = hero.getBoundingClientRect();
  const ox = r.left - hr.left + r.width / 2;
  const oy = r.top - hr.top + r.height * 0.42;
  const cols = ['#ff6f97', '#ffb14e', '#ff8fae', '#ffd36a', '#e23b67'];
  const frag = document.createDocumentFragment();
  const nodes = [];
  for (let i = 0; i < 12; i++){
    const heart = i < 8;
    const el = document.createElement('span');
    el.className = 'burst';
    const s = heart ? rand(12, 22) : rand(4, 8);
    el.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;pointer-events:none;z-index:4;`;
    if (heart) el.innerHTML = miniHeartSVG(pick(cols));
    else { el.style.borderRadius = '50%'; el.style.background = 'radial-gradient(circle,#fff,rgba(255,210,150,0) 70%)'; }
    frag.appendChild(el); nodes.push({ el, heart });
  }
  hero.appendChild(frag);
  nodes.forEach(({ el, heart }) => {
    const ang = rand(-Math.PI, 0);                       // fan upward + out
    const dist = rand(heart ? 70 : 40, heart ? 190 : 120);
    gsap.to(el, {
      x: Math.cos(ang) * dist, y: Math.sin(ang) * dist - rand(10, 50),
      rotation: rand(-120, 120), scale: heart ? rand(0.7, 1.2) : rand(0.4, 1),
      duration: rand(0.7, 1.15), ease: 'power2.out',
    });
    gsap.to(el, { opacity: 0, duration: 0.5, delay: rand(0.35, 0.6), ease: 'power1.in', onComplete: () => el.remove() });
  });
}

/* --- the shot + Acts 2–3 timeline ------------------------------------------ */
function shotGeom(){
  // flight distance = straight-line from the arrow tip to the heart (measured on
  // screen, rotation-aware). Moving the arrow that far along its local "up" axis
  // — which is aimed at the heart — lands the tip dead-centre on it.
  const tipR = tip.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const tipX = tipR.left + tipR.width / 2, tipY = tipR.top + tipR.height / 2;
  const tcx = tRect.left + tRect.width / 2, tcy = tRect.top + tRect.height / 2;
  const flightDist = Math.hypot(tcx - tipX, tcy - tipY);
  const fallPx = Math.min(H * 0.26, H - tcy - tRect.height * 0.4);
  const impactX = tcx, impactY = tcy + fallPx;
  const distC = Math.hypot(Math.max(impactX, W - impactX), Math.max(impactY, H - impactY));
  const reach = Math.hypot(W / 2, H / 2);
  return {
    arrowStartY: arrowBaseY + curDraw,
    arrowFlyY:   arrowBaseY + curDraw - flightDist,       // local -Y = toward the heart
    drawnNock:   REST_NOCK + curDraw / svgScale,
    fallPx, fx: impactX - W / 2, fy: impactY - H / 2,
    floodScale: (distC * 1.12) / 70, bloomScale: (reach * 1.2) / 30,
  };
}

let filmTL = null;
function buildFilm(m){
  const t = gsap.timeline({
    paused: true,
    onComplete: () => {
      gsap.set(field, { autoAlpha: 0 });
      treeStart();
      // fade promptly so the growing tree is revealed with no white hold
      gsap.to(bloom, { autoAlpha: 0, duration: 1.15, ease: 'power2.out' });
    },
  });

  // reset (t=0)
  t.set(target, { y: 0, scaleX: 1, scaleY: 1, opacity: 1 })
   .set(arrow, { opacity: 1, x: arrowBaseX, y: m.arrowStartY, scaleY: 1 })
   .set([flood, bloom], { autoAlpha: 0, scale: 0.001, x: 0, y: 0 })
   .set(flood, { x: m.fx, y: m.fy })
   .set(field, { autoAlpha: 0 })
   .set('.blob', { opacity: 0 })
   .set(camera, { scale: 1, yPercent: 0 })
   .set(fgrid, { xPercent: 0, yPercent: 0 })
   .set(barTop, { yPercent: -100 })
   .set(barBot, { yPercent: 100 })
   .set(kEyebrow, { opacity: 0, y: 12 })
   .set(kSub, { opacity: 0, y: 12 })
   .set(kChars, { transformPerspective: 620, transformOrigin: '50% 100%', yPercent: 135, rotationX: -82 })
   .set(uline, { drawn: 0 });

  // --- the shot: string snaps (twang), arrow flies up into the heart --------
  t.fromTo(nockProxy, { val: m.drawnNock }, { val: REST_NOCK, duration: 0.5, ease: 'elastic.out(1,0.34)', onUpdate: applyNock }, 0)
   .to(arrow, { y: m.arrowFlyY, duration: 0.26, ease: 'power2.in' }, 0)
   .to(arrow, { scaleY: 1.16, duration: 0.14, ease: 'power2.in' }, 0)
   .to(arrow, { scaleY: 1.0, duration: 0.1, ease: 'power1.out' }, 0.16)
   .to(aim, { opacity: 0, duration: 0.18 }, 0)
   .to([eyebrow, hint], { opacity: 0, duration: 0.2, ease: 'power1.out' }, 0);

  // --- the strike: the arrow embeds, the heart recoils, then holds pierced --
  t.add(burstHearts, 0.26)
   // recoil along the arrow's line (up + right), springing back
   .to(target, { x: 7, y: -9, duration: 0.06, ease: 'power2.out' }, 0.26)
   .to(target, { x: 0, y: 0, duration: 0.32, ease: 'power2.out' }, 0.32)
   .to(target, { scale: 1.14, duration: 0.06, ease: 'power2.out' }, 0.26)
   .to(target, { scale: 1.0, duration: 0.26, ease: 'power2.inOut' }, 0.32)
   // the arrow shudders in the wound, holds embedded so the hit reads, then sinks in
   .to(arrow, { rotation: '+=4', duration: 0.05, yoyo: true, repeat: 4, ease: 'sine.inOut' }, 0.27)
   .set(arrow, { rotation: 0 }, 0.52)
   .to(arrow, { opacity: 0, duration: 0.16, ease: 'power1.out' }, 0.56);

  // --- the fall + the burst / flood -----------------------------------------
  t.to(target, { y: m.fallPx, scaleX: 0.84, scaleY: 1.3, duration: 0.34, ease: 'power1.in' }, 0.64)
   .to(target, { scaleX: 1.4, scaleY: 0.6, duration: 0.07, ease: 'power2.out' }, 0.98)
   .set(flood, { autoAlpha: 1 }, 1.00)
   .fromTo(flood, { scale: 0.02 }, { scale: m.floodScale, duration: 0.34, ease: 'power2.in' }, 1.00)
   .to(target, { opacity: 0, duration: 0.12, ease: 'power1.out' }, 1.06);

  // seam: the field is the same rose as the flood
  t.set(field, { autoAlpha: 1 }, 1.32)
   .set(hero, { autoAlpha: 0 }, 1.33)
   .to('.blob', { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.34)
   .set(flood, { autoAlpha: 0 }, 1.36);

  // --- the camera push -------------------------------------------------------
  // duration matched to when the bloom covers (3.98) — a longer push used to
  // keep the timeline (and a white bloom) alive after the tree should already
  // be growing, which read as dead time before the tree appeared.
  t.fromTo(camera, { scale: 1.0, yPercent: 0 }, { scale: 1.07, yPercent: -1.3, duration: 2.6, ease: 'none' }, 1.38)
   .fromTo(fgrid, { xPercent: 0, yPercent: 0 }, { xPercent: -1.5, yPercent: -1.0, duration: 2.6, ease: 'none' }, 1.38);

  // beat markers for the recorder's soundtrack (no-ops off ?record)
  t.call(cue, ['hit'], 0.26)
   .call(cue, ['flood'], 1.00)
   .call(cue, ['wish'], 1.68)
   .call(cue, ['wish2'], 2.06)
   .call(cue, ['bloom'], 3.42);

  // cinema bars ease into a letterbox
  t.to(barTop, { yPercent: 0, duration: 0.6, ease: 'power2.out' }, 1.5)
   .to(barBot, { yPercent: 0, duration: 0.6, ease: 'power2.out' }, 1.5);

  // --- the kinetic wish ------------------------------------------------------
  t.to(kEyebrow, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 1.54)
   .to(line1Chars, { yPercent: 0, rotationX: 0, duration: 0.55, ease: 'power3.out', stagger: 0.033 }, 1.68)
   .to(line2Chars, { yPercent: 0, rotationX: 0, duration: 0.55, ease: 'power3.out', stagger: 0.033 }, 2.06)
   .to(uline, { drawn: 1, duration: 0.45, ease: 'power2.inOut' }, 2.54)
   .to(kSub, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 2.74);

  // --- the handoff bloom -----------------------------------------------------
  t.to(barTop, { yPercent: -100, duration: 0.5, ease: 'power2.in' }, 3.32)
   .to(barBot, { yPercent: 100, duration: 0.5, ease: 'power2.in' }, 3.32)
   .set(bloom, { autoAlpha: 1 }, 3.42)
   .fromTo(bloom, { scale: 0.02 }, { scale: m.bloomScale, duration: 0.58, ease: 'power2.in' }, 3.42);

  return t;
}

/* --- draw / release interaction -------------------------------------------- */
let played = false, drawing = false, startPX = 0, startPY = 0, startDraw = 0;

function fire(){
  if (played) return;
  played = true;
  drawing = false;
  stopBeat();
  cue('release'); cue('whoosh');
  filmTL = buildFilm(shotGeom());
  filmTL.play(0);
}

function springBack(){
  const from = curDraw;
  gsap.to({ d: from }, { d: 0, duration: 0.55, ease: 'elastic.out(1,0.4)', onUpdate() { setDraw(this.targets()[0].d); } });
}

function autoFire(){
  if (played) return;
  recT0 = performance.now(); cue('draw');       // t=0 of the soundtrack
  gsap.to({ d: curDraw }, {
    d: maxDraw * 0.94, duration: 0.62, ease: 'power2.inOut',
    onUpdate() { setDraw(this.targets()[0].d); },
    onComplete: () => gsap.delayedCall(0.16, fire),
  });
}

archery.addEventListener('pointerdown', (e) => {
  if (played) return;
  drawing = true;
  try { archery.setPointerCapture(e.pointerId); } catch (_) {}
  startPX = e.clientX; startPY = e.clientY; startDraw = curDraw;
  e.preventDefault();
});
archery.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  // project the drag onto the pull-back axis, so dragging back along the aim
  // (down + away from the heart) draws the string — on any shot angle.
  const proj = (e.clientX - startPX) * pullUX + (e.clientY - startPY) * pullUY;
  setDraw(startDraw + proj);
});
function endDraw(){
  if (!drawing) return;
  drawing = false;
  if (curDraw > maxDraw * 0.26) fire(); else springBack();
}
archery.addEventListener('pointerup', endDraw);
archery.addEventListener('pointercancel', endDraw);
archery.addEventListener('keydown', (e) => {
  if (played) return;
  if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); autoFire(); }
});

/* boot Act 1: reveal the target + bow + hint, then start the beat */
function enter(){
  gsap.set(hero, { autoAlpha: 1 });
  refreshRig();
  setDraw(0);
  gsap.set([eyebrow, hint], { opacity: 0, y: 14 });
  gsap.set(target, { opacity: 0, y: 10, scaleX: 0.9, scaleY: 0.9 });
  gsap.set(archery, { opacity: 0, scale: 0.85 });        // scale from the grip; keeps rotation
  gsap.set(heartGlow, { opacity: 0, scale: 1 });
  gsap.set(arrow, { opacity: 1 });

  const tl = gsap.timeline({ onComplete: startBeat });
  tl.to(target,   { opacity: 1, y: 0, scaleX: 1, scaleY: 1, duration: 0.8, ease: 'power3.out' }, 0.1)
    .to(heartGlow,{ opacity: 0.7, duration: 0.8, ease: 'power2.out' }, 0.2)
    .to(archery,  { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }, 0.28)
    .to(eyebrow,  { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.4)
    .to(hint,     { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.7);
}

function armReplay(){
  replay.hidden = false;
  requestAnimationFrame(() => replay.classList.add('is-shown'));
}

/* back to Act 1, ready to be drawn again */
function resetAll(){
  treeStop();
  showWish(false);
  window.bdayDone = false; replayArmed = false;
  replay.classList.remove('is-shown'); replay.hidden = true;
  if (filmTL){ filmTL.pause(0); }
  gsap.set([flood, bloom], { autoAlpha: 0 });
  gsap.set(field, { autoAlpha: 0 });
  gsap.set(arrow, { opacity: 1, scaleY: 1 });
  played = false;
  enter();
}

/* ============================================================
   SIZING + BOOT
   ============================================================ */
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildSprites();
  buildScene();
  if (reduceMotion){ drawFinal(); return; }
  if (played && filmTL){
    const at = filmTL.time(); const active = filmTL.isActive();
    const isFinished = at >= (filmTL.duration() - 0.05);
    filmTL = buildFilm(shotGeom());
    if (isFinished) {
      filmTL.pause(filmTL.duration());
      gsap.set([bloom, flood, field], { autoAlpha: 0 });
    } else {
      filmTL.pause(at);
      if (active) filmTL.play(at);
    }
  } else {
    refreshRig(); setDraw(0);
  }
}
let resizeRAF = 0;
window.addEventListener('resize', () => { if (resizeRAF) return; resizeRAF = requestAnimationFrame(() => { resizeRAF = 0; resize(); }); });

initCustomizer();
resize();

if (reduceMotion){
  drawFinal();
} else {
  buildMotes();
  document.fonts && document.fonts.ready.then(() => { refreshRig(); setDraw(0); });
  enter();
  replay.addEventListener('click', resetAll);
}

/* ============================================================
   RECORDING HOOK — the rig draws + fires after its pre-roll
   ============================================================ */
if (isRecord){
  window.bdayAPI = {
    start(){ autoFire(); },
    replay(){ resetAll(); },
  };
}
