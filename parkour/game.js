const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const SPEED = 4;
const JUMP_FORCE = -12;
const SIZE = 30;
const SPIKE = 20;
const LEVEL_COUNT = 20;
const STORAGE_KEY = 'parkour.unlocked';
const INK = '#1a1a2e';
const CORRIDOR = 250;
const W = 800;
const H = 450;
const SCALE = canvas.width / W;

const THEMES = [
  { name: 'Słodkie anime', sky: ['#ffd6e8', '#fff0f5'], ground: '#c9a7ff', spike: '#ff6fa8', cube: '#ff8fb8', text: INK, deco: 'heart', face: 'cat', doubleJump: true, rule: 'Podwójny skok' },
  { name: 'Retro 8-bit', sky: ['#0b0b2a', '#1a1a4a'], ground: '#3adf5a', spike: '#ffe94a', cube: '#ff5a5a', text: '#fff', deco: 'pixel', face: 'pixel', variable: true, rule: 'Przytrzymaj = wyższy skok' },
  { name: 'Kosmos', sky: ['#000010', '#101040'], ground: '#5a3fa0', spike: '#c8c8ff', cube: '#ffb347', text: '#fff', deco: 'star', face: 'helmet', gravity: 0.3, jump: -9, rule: 'Niska grawitacja' },
  { name: 'Neon', sky: ['#120024', '#2a0050'], ground: '#00e5ff', spike: '#ff00c8', cube: '#faff00', text: '#fff', deco: 'tower', face: 'glasses' },
  { name: 'Halloween', sky: ['#1a0a00', '#4a2000'], ground: '#ff7a00', spike: '#ffd23f', cube: '#8a2be2', text: '#fff', deco: 'bat', face: 'fangs', dark: true, rule: 'Ciemność' },
  { name: 'Cukierkowy', sky: ['#bff5e0', '#fff7b0'], ground: '#ff9ecf', spike: '#7b3fe4', cube: '#4ecca3', text: INK, deco: 'ring', face: 'sparkle' },
  { name: 'Lodowy', sky: ['#dff6ff', '#ffffff'], ground: '#7fc8ff', spike: '#2f6fb0', cube: '#ff6f61', text: INK, deco: 'flake', face: 'hat' },
  { name: 'Piekło', sky: ['#000000', '#5a0000'], ground: '#401212', spike: '#ff4500', cube: '#ff9f1c', text: '#fff', deco: 'flame', face: 'horns' },
  { name: 'Vaporwave', sky: ['#ff71ce', '#01cdfe'], ground: '#b967ff', spike: '#fffb96', cube: '#05ffa1', text: INK, deco: 'grid', face: 'shades' },
  { name: 'Demoniczny', sky: ['#000000', '#1a0000'], ground: '#3a0000', spike: '#ffffff', cube: '#e01010', text: '#fff', deco: 'pentagram', face: 'demon', flip: true, rule: 'Skok = odwrócenie grawitacji' },
];

const player = { x: 0, y: 0, w: SIZE, h: SIZE, vy: 0, dir: 1, airJumps: 0, onGround: false };

let state = 'menu';
let levelIndex = 0;
let level = null;
let theme = THEMES[0];
let levelWidth = 0;
let camX = 0;
let attempts = 1;
let selected = 0;
let unlocked = 0;
let jumpHeld = false;
let jumpPressed = false;
try { unlocked = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch {}

// ---------- audio & options ----------

let audio = null;
let muted = false;
try { muted = localStorage.getItem('parkour.muted') === '1'; } catch {}

function initAudio() {
  if (!audio) audio = new AudioContext();
  if (audio.state === 'suspended') audio.resume();
}

function tone(from, to, seconds, type) {
  if (!audio || muted) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + seconds);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + seconds);
}

function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('parkour.muted', muted ? '1' : '0'); } catch {}
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.getElementById('wrap').requestFullscreen();
}

// ---------- level generator ----------

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gap range (px) crossable from anywhere on the platform (up to hanging SIZE-1 px over its edge)
// onto a ledge dy px higher without clipping its wall; `far` is the longest landing distance.
function jumpRange(dy) {
  const g = theme.gravity ?? GRAVITY;
  if (theme.flip) {
    // Gravity flip: fall from rest to the opposite surface, which is nearer on one side by |dy|.
    let near = 0;
    for (let n = 1, y = 0, vy = 0; n < 120; n++) {
      vy += g;
      y += vy;
      if (!near && y >= CORRIDOR - SIZE - Math.abs(dy)) near = n;
      if (y >= CORRIDOR - SIZE + Math.abs(dy)) return { min: 0, max: SPEED * near - 4, far: SPEED * n + SIZE };
    }
    return null;
  }
  let up = -1;
  for (let n = 1, y = 0, vy = theme.jump ?? JUMP_FORCE; n < 120; n++) {
    vy += g;
    y += vy;
    if (y <= -dy && up < 0) up = n;
    if (y > -dy && up >= 0) return { min: SPEED * up + SIZE, max: SPEED * n - 4, far: SPEED * n + SIZE };
  }
  return null;
}

// Each pattern returns platform specs: { w, dy (ledge rises by dy), spikes, groups, far }.
const PATTERNS = [
  { from: 0, make: (r, t, i) => [{ w: r(160, 300), spikes: i >= 2 && r() < 0.5 + 0.3 * t ? 1 + Math.floor(r() * (1 + 2 * t)) : 0 }] },
  { from: 0, make: (r, t) => Array.from({ length: 3 + Math.floor(r() * 4) }, () => ({ w: r(40 + 30 * (1 - t), 80 + 40 * (1 - t)), dy: r(-20, 20) })) },
  { from: 1, make: (r, t) => Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ w: r(60 + 30 * (1 - t), 100 + 40 * (1 - t)), dy: 40 })) },
  { from: 1, make: (r, t) => Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ w: r(60 + 30 * (1 - t), 100 + 40 * (1 - t)), dy: -50 })) },
  { from: 2, make: (r, t) => [{ w: r(500, 700), spikes: 1 + Math.floor(r() * (1 + 2 * t)), groups: 2 + Math.floor(r() * (1 + t)) }] },
  { from: 3, make: (r) => [{ w: r(150, 250), dy: r(-40, 30), far: true }] },
  { from: 5, make: (r) => [{ w: r(80, 120), dy: 70 }, { w: r(80, 120), dy: -70 }] },
];

function generateLevel(i) {
  const rand = rng(i + 1);
  const r = (a, b) => (a === undefined ? rand() : a + rand() * (b - a));
  const t = i / (LEVEL_COUNT - 1);
  const target = 2000 + 4000 * t;
  const platforms = [];
  const spikes = [];
  let x = 0;
  let y = 420;

  function place(spec) {
    const count = spec.spikes || 0;
    const groups = count ? spec.groups || 1 : 0;
    let w = Math.round(spec.w);
    if (count) w = Math.max(w, 140 + (groups - 1) * 220 + 60 + count * SPIKE + 170);

    if (platforms.length) {
      let dy = Math.round(Math.max(y - 420, Math.min(y - (theme.flip ? 280 : 150), spec.dy || 0)));
      let range = jumpRange(dy);
      if (!range) { dy = 0; range = jumpRange(0); }
      const gapMax = range.max - (44 - 32 * t);
      const gapMin = Math.max(range.min + 8, 40 + 60 * t, range.far + 4 - w);
      const gap = Math.round(spec.far ? gapMax : gapMin >= gapMax ? gapMax : r(gapMin, gapMax));
      w = Math.max(w, range.far + 4 - gap);
      x += gap;
      y -= dy;
    }
    platforms.push({ x, y, w, h: H - y });
    for (let g = 0; g < groups; g++) {
      const sx = x + 140 + g * 220 + Math.round(r(0, 60));
      for (let k = 0; k < count; k++) spikes.push({ x: sx + k * SPIKE, y: y - SPIKE });
    }
    x += w;
  }

  place({ w: 220 });
  const pool = PATTERNS.filter((p) => i >= p.from);
  let last = null;
  while (x < target) {
    let pat = pool[Math.floor(rand() * pool.length)];
    if (pat === last) pat = pool[(pool.indexOf(pat) + 1) % pool.length];
    for (const spec of pat.make(r, t, i)) place(spec);
    last = pat;
  }
  place({ w: 220 });

  const end = platforms[platforms.length - 1];
  const decoRand = rng(i + 100);
  const deco = Array.from({ length: 35 }, () => ({
    x: decoRand() * ((end.x + end.w - W) * 0.3 + W),
    y: 20 + decoRand() * 380,
    s: 6 + decoRand() * 12,
  }));
  const goal = { x: end.x + end.w - 40, y: end.y - 60, w: 20, h: 60 };
  if (theme.flip) {
    for (const p of [...platforms]) platforms.push({ x: p.x, y: 0, w: p.w, h: p.y - CORRIDOR });
    goal.y = end.y - CORRIDOR;
    goal.h = CORRIDOR;
  }
  return { platforms, spikes, deco, goal };
}

// ---------- game state ----------

function startLevel(i) {
  levelIndex = i;
  theme = THEMES[i % THEMES.length];
  level = generateLevel(i);
  levelWidth = Math.max(...level.platforms.map((p) => p.x + p.w));
  attempts = 1;
  resetPlayer();
  state = 'play';
}

function resetPlayer() {
  player.x = 40;
  player.y = level.platforms[0].y - SIZE;
  player.vy = 0;
  player.dir = 1;
  player.airJumps = 0;
  camX = 0;
}

function die() {
  attempts++;
  resetPlayer();
  tone(220, 40, 0.35, 'sawtooth');
}

function completeLevel() {
  unlocked = Math.max(unlocked, levelIndex + 1);
  try { localStorage.setItem(STORAGE_KEY, unlocked); } catch {}
  selected = Math.min(levelIndex + 1, LEVEL_COUNT - 1);
  state = levelIndex + 1 === LEVEL_COUNT ? 'won' : 'menu';
  tone(500, 1000, 0.15, 'square');
  setTimeout(() => tone(750, 1500, 0.2, 'square'), 120);
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
  if (state !== 'play') return;

  const jump = theme.jump ?? JUMP_FORCE;
  if (theme.flip) {
    if (jumpPressed && player.onGround) {
      player.dir = -player.dir;
      player.onGround = false;
      tone(200, 500, 0.15, 'sawtooth');
    }
  } else if (jumpHeld && player.onGround) {
    player.vy = jump;
    player.onGround = false;
    player.airJumps = theme.doubleJump ? 1 : 0;
    tone(300, 700, 0.12, 'square');
  } else if (jumpPressed && player.airJumps > 0) {
    player.vy = jump;
    player.airJumps--;
    tone(500, 1000, 0.12, 'square');
  }
  if (theme.variable && !jumpHeld && player.vy < -4) player.vy = -4;
  jumpPressed = false;
  player.vy += (theme.gravity ?? GRAVITY) * player.dir;

  player.x += SPEED;
  for (const p of level.platforms) {
    if (overlaps(player, p)) return die();
  }

  player.y += player.vy;
  player.onGround = false;
  for (const p of level.platforms) {
    if (!overlaps(player, p)) continue;
    player.y = player.dir > 0 ? p.y - SIZE : p.y + p.h;
    player.vy = 0;
    player.onGround = true;
  }

  for (const s of level.spikes) {
    if (overlaps(player, { x: s.x + 5, y: s.y + 6, w: 10, h: 14 })) return die();
  }
  if (player.y > H || player.y + SIZE < 0) return die();
  if (overlaps(player, level.goal)) return completeLevel();

  camX = Math.max(0, Math.min(player.x + SIZE / 2 - W / 2, levelWidth - W));
}

// ---------- input ----------

const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];

const PAUSE_ITEMS = [
  { label: () => 'Wznów', hint: 'Esc', code: 'Escape', action: () => { state = 'play'; } },
  { label: () => 'Od nowa', hint: 'R', code: 'KeyR', action: () => { attempts = 1; resetPlayer(); state = 'play'; } },
  { label: () => 'Pełny ekran', hint: 'F', code: 'KeyF', action: toggleFullscreen },
  { label: () => `Dźwięk: ${muted ? 'wył.' : 'wł.'}`, hint: 'M', code: 'KeyM', action: toggleMute },
  { label: () => 'Menu główne', hint: 'Q', code: 'KeyQ', action: () => { state = 'menu'; } },
];
let pauseSel = 0;

function pause() {
  state = 'pause';
  jumpHeld = false;
  pauseSel = 0;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  initAudio();
  if (e.code === 'KeyF') return toggleFullscreen();
  if (e.code === 'KeyM') return toggleMute();
  if (state === 'menu') {
    if (e.code === 'ArrowRight') selected = Math.min(LEVEL_COUNT - 1, selected + 1);
    if (e.code === 'ArrowLeft') selected = Math.max(0, selected - 1);
    if (e.code === 'ArrowDown') selected = Math.min(LEVEL_COUNT - 1, selected + 5);
    if (e.code === 'ArrowUp') selected = Math.max(0, selected - 5);
    if ((e.code === 'Enter' || e.code === 'Space') && selected <= unlocked) startLevel(selected);
  } else if (state === 'play') {
    if (e.code === 'Escape') pause();
    if (JUMP_KEYS.includes(e.code)) jumpHeld = jumpPressed = true;
  } else if (state === 'pause') {
    if (e.code === 'ArrowDown') pauseSel = (pauseSel + 1) % PAUSE_ITEMS.length;
    if (e.code === 'ArrowUp') pauseSel = (pauseSel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
    if (e.code === 'Enter') PAUSE_ITEMS[pauseSel].action();
    const item = PAUSE_ITEMS.find((it) => it.code === e.code);
    if (item) item.action();
  } else {
    state = 'menu';
  }
});
window.addEventListener('keyup', (e) => { if (JUMP_KEYS.includes(e.code)) jumpHeld = false; });

function press(pt) {
  initAudio();
  if (state === 'menu') {
    const i = hitIndex(pt, LEVEL_COUNT, tileRect);
    if (i >= 0 && i <= unlocked) startLevel(i);
  } else if (state === 'play') {
    jumpHeld = jumpPressed = true;
  } else if (state === 'pause') {
    const k = hitIndex(pt, PAUSE_ITEMS.length, pauseRow);
    if (k >= 0) PAUSE_ITEMS[k].action();
  } else {
    state = 'menu';
  }
}
canvas.addEventListener('mousedown', press);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); press(e.touches[0]); }, { passive: false });
window.addEventListener('mouseup', () => { jumpHeld = false; });
window.addEventListener('touchend', () => { jumpHeld = false; });

function tileRect(i) {
  return { x: 100 + (i % 5) * 120, y: 100 + Math.floor(i / 5) * 80, w: 100, h: 60 };
}

function pauseRow(k) {
  return { x: 250, y: 130 + k * 50, w: 300, h: 44 };
}

function hitIndex(pt, count, rectOf) {
  const rect = canvas.getBoundingClientRect();
  const mx = (pt.clientX - rect.left) * W / rect.width;
  const my = (pt.clientY - rect.top) * H / rect.height;
  for (let i = 0; i < count; i++) {
    const r = rectOf(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return i;
  }
  return -1;
}

// ---------- drawing ----------

function tri(ax, ay, bx, by, cx, cy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.fill();
}

function dot(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function star(x, y, s) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = k * Math.PI / 5 - Math.PI / 2;
    const d = k % 2 ? s / 2 : s;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function drawShape(kind, x, y, s) {
  switch (kind) {
    case 'heart':
      ctx.beginPath();
      ctx.arc(x - s / 2, y, s / 2, Math.PI, 0);
      ctx.arc(x + s / 2, y, s / 2, Math.PI, 0);
      ctx.lineTo(x, y + s);
      ctx.fill();
      break;
    case 'pixel': ctx.fillRect(x, y, s, s); break;
    case 'star': star(x, y, s); ctx.fill(); break;
    case 'tower': ctx.fillRect(x, y + 100, s * 3, H); break;
    case 'bat':
      ctx.beginPath();
      ctx.arc(x - s / 2, y, s / 2, Math.PI, 0);
      ctx.arc(x + s / 2, y, s / 2, Math.PI, 0);
      ctx.fill();
      break;
    case 'ring': ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.stroke(); break;
    case 'flake':
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 3;
        ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      ctx.stroke();
      break;
    case 'flame': tri(x - s / 2, y + s, x, y - s, x + s / 2, y + s); break;
    case 'pentagram': star(x, y, s); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.stroke(); break;
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = ctx.strokeStyle = theme.spike;
  ctx.lineWidth = 2;
  if (theme.deco === 'grid') {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const gy = 230 + k * k * 4; ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    for (let k = -8; k <= 8; k++) { ctx.moveTo(400 + k * 30, 230); ctx.lineTo(400 + k * 160, H); }
    ctx.stroke();
  } else {
    ctx.translate(-camX * 0.3, 0);
    for (const d of level.deco) drawShape(theme.deco, d.x, d.y, d.s);
  }
  ctx.restore();
}

function drawPlayer() {
  const { x, y } = player;
  const f = theme.face;
  ctx.save();
  if (player.dir < 0) {
    ctx.translate(0, 2 * y + SIZE);
    ctx.scale(1, -1);
  }
  ctx.fillStyle = theme.cube;
  ctx.fillRect(x, y, SIZE, SIZE);

  if (f === 'cat' || f === 'horns' || f === 'demon') {
    ctx.fillStyle = f === 'cat' ? theme.cube : INK;
    tri(x + 3, y, x + 8, y - 10, x + 14, y);
    tri(x + 16, y, x + 22, y - 10, x + 27, y);
  }
  if (f === 'hat') {
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x + 2, y - 8, 26, 9);
    ctx.fillStyle = '#fff';
    dot(x + 26, y - 8, 4);
  }
  if (f === 'helmet') {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + 15, y + 15, 18, Math.PI, 0);
    ctx.stroke();
  }

  ctx.fillStyle = f === 'demon' ? '#ff2020' : INK;
  if (f === 'pixel') {
    ctx.fillRect(x + 7, y + 8, 6, 6);
    ctx.fillRect(x + 17, y + 8, 6, 6);
  } else {
    const r = f === 'sparkle' ? 5 : 3;
    dot(x + 10, y + 11, r);
    dot(x + 20, y + 11, r);
  }
  if (f === 'sparkle') {
    ctx.fillStyle = '#fff';
    dot(x + 12, y + 9, 2);
    dot(x + 22, y + 9, 2);
  }
  if (f === 'glasses' || f === 'shades') {
    ctx.fillStyle = f === 'shades' ? INK : 'rgba(0, 229, 255, 0.5)';
    ctx.fillRect(x + 4, y + 7, 22, 8);
  }
  if (f === 'cat') {
    ctx.fillStyle = 'rgba(255, 105, 180, 0.6)';
    dot(x + 6, y + 18, 3);
    dot(x + 24, y + 18, 3);
  }

  const angry = f === 'horns' || f === 'demon';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (angry) ctx.arc(x + 15, y + 26, 6, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(x + 15, y + 17, 6, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (angry) {
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 4); ctx.lineTo(x + 13, y + 7);
    ctx.moveTo(x + 25, y + 4); ctx.lineTo(x + 17, y + 7);
    ctx.stroke();
  }
  if (f === 'fangs') {
    ctx.fillStyle = '#fff';
    tri(x + 10, y + 20, x + 12, y + 26, x + 14, y + 20);
    tri(x + 16, y + 20, x + 18, y + 26, x + 20, y + 20);
  }
  ctx.restore();
}

function drawGame() {
  drawBackground();
  ctx.save();
  ctx.translate(-camX, 0);

  ctx.fillStyle = theme.ground;
  for (const p of level.platforms) ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = theme.spike;
  for (const s of level.spikes) tri(s.x, s.y + SPIKE, s.x + SPIKE / 2, s.y, s.x + SPIKE, s.y + SPIKE);

  ctx.fillStyle = '#4ecca3';
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  drawPlayer();
  ctx.restore();

  if (theme.dark) {
    const cx = player.x - camX + SIZE / 2, cy = player.y + SIZE / 2;
    const light = ctx.createRadialGradient(cx, cy, 50, cx, cy, 200);
    light.addColorStop(0, 'rgba(0, 0, 0, 0)');
    light.addColorStop(1, 'rgba(0, 0, 0, 0.94)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(200, 12, 400, 8);
  ctx.fillStyle = theme.cube;
  ctx.fillRect(200, 12, 400 * Math.min(1, player.x / (levelWidth - SIZE)), 8);

  ctx.fillStyle = theme.text;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Poziom ${levelIndex + 1} · ${theme.name}`, 12, 24);
  if (theme.rule) {
    ctx.font = '13px sans-serif';
    ctx.fillText(theme.rule, 12, 44);
  }
  ctx.textAlign = 'right';
  ctx.fillText(`Próba ${attempts}`, W - 12, 24);
}

function drawMenu() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#eee';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('PARKOUR', W / 2, 62);

  for (let i = 0; i < LEVEL_COUNT; i++) {
    const r = tileRect(i);
    const open = i <= unlocked;
    ctx.fillStyle = open ? THEMES[i % THEMES.length].cube : '#2a2a4a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (i === selected) {
      ctx.strokeStyle = '#4ecca3';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    }
    if (open) {
      ctx.fillStyle = INK;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(i + 1, r.x + r.w / 2, r.y + r.h / 2 + 9);
    } else {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.fillStyle = '#666';
      ctx.fillRect(cx - 8, cy - 2, 16, 12);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 5, Math.PI, 0);
      ctx.stroke();
    }
  }

  const th = THEMES[selected % THEMES.length];
  ctx.fillStyle = '#eee';
  ctx.font = '16px sans-serif';
  ctx.fillText(`${selected + 1}. ${th.name}${th.rule ? ' — ' + th.rule : ''}`, W / 2, 420);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Kliknij poziom lub strzałki + Enter · F — pełny ekran · M — dźwięk', W / 2, 442);
}

function drawPause() {
  drawGame();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('PAUZA', W / 2, 90);
  ctx.font = '20px sans-serif';
  PAUSE_ITEMS.forEach((item, k) => {
    const r = pauseRow(k);
    const active = k === pauseSel;
    ctx.fillStyle = active ? theme.cube : 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = active ? INK : '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(item.label(), r.x + 16, r.y + 29);
    ctx.textAlign = 'right';
    ctx.fillText(item.hint, r.x + r.w - 16, r.y + 29);
  });
}

function drawWon() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4ecca3';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('Wszystkie poziomy ukończone!', W / 2, H / 2 - 10);
  ctx.fillStyle = '#eee';
  ctx.font = '18px sans-serif';
  ctx.fillText('Dowolny klawisz — menu', W / 2, H / 2 + 30);
}

const TICK = 1000 / 165;
let last = performance.now();
let acc = 0;

function loop(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= TICK) {
    update();
    acc -= TICK;
  }
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (state === 'play') drawGame();
  else if (state === 'pause') drawPause();
  else if (state === 'menu') drawMenu();
  else drawWon();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
