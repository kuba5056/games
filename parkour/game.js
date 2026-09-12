const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const SPEED = 4;
const JUMP_FORCE = -12;
const SIZE = 30;
const SPIKE = 20;
const LEVEL_COUNT = 20;
const IMPOSSIBLE_COUNT = 10;
const TOTAL_LEVELS = LEVEL_COUNT + IMPOSSIBLE_COUNT;
const STORAGE_KEY = 'parkour.unlocked';
const INK = '#1a1a2e';
const CORRIDOR = 250;
const W = 800;
const H = 450;
const SCALE = canvas.width / W;
const ORB_R = 18;

const ZONES = {
  fast: { speed: 6, label: '» fast', color: '#ffd23f' },
  slow: { speed: 2.5, label: '« slow', color: '#7fc8ff' },
  heavy: { gravity: 1, jump: -15.5, label: '▼ heavy', color: '#ff6f61' },
  moon: { gravity: 0.3, jump: -9, label: '○ moon', color: '#c8c8ff' },
};

const THEMES = [
  { name: 'Cute Anime', sky: ['#ffd6e8', '#fff0f5'], ground: '#c9a7ff', spike: '#ff6fa8', cube: '#ff8fb8', text: INK, deco: 'heart', face: 'cat', doubleJump: true, rule: 'Double jump' },
  { name: 'Retro 8-bit', sky: ['#0b0b2a', '#1a1a4a'], ground: '#3adf5a', spike: '#ffe94a', cube: '#ff5a5a', text: '#fff', deco: 'pixel', face: 'pixel', variable: true, rule: 'Hold to jump higher' },
  { name: 'Space', sky: ['#000010', '#101040'], ground: '#5a3fa0', spike: '#c8c8ff', cube: '#ffb347', text: '#fff', deco: 'star', face: 'helmet', gravity: 0.3, jump: -9, rule: 'Low gravity' },
  { name: 'Neon', sky: ['#120024', '#2a0050'], ground: '#00e5ff', spike: '#ff00c8', cube: '#faff00', text: '#fff', deco: 'tower', face: 'glasses' },
  { name: 'Halloween', sky: ['#1a0a00', '#4a2000'], ground: '#ff7a00', spike: '#ffd23f', cube: '#8a2be2', text: '#fff', deco: 'bat', face: 'fangs', dark: true, rule: 'Darkness' },
  { name: 'Candy', sky: ['#bff5e0', '#fff7b0'], ground: '#ff9ecf', spike: '#7b3fe4', cube: '#4ecca3', text: INK, deco: 'ring', face: 'sparkle' },
  { name: 'Ice', sky: ['#dff6ff', '#ffffff'], ground: '#7fc8ff', spike: '#2f6fb0', cube: '#ff6f61', text: INK, deco: 'flake', face: 'hat' },
  { name: 'Hell', sky: ['#000000', '#5a0000'], ground: '#401212', spike: '#ff4500', cube: '#ff9f1c', text: '#fff', deco: 'flame', face: 'horns' },
  { name: 'Vaporwave', sky: ['#ff71ce', '#01cdfe'], ground: '#b967ff', spike: '#fffb96', cube: '#05ffa1', text: INK, deco: 'grid', face: 'shades' },
  { name: 'Demonic', sky: ['#000000', '#1a0000'], ground: '#3a0000', spike: '#ffffff', cube: '#e01010', text: '#fff', deco: 'pentagram', face: 'demon', flip: true, rule: 'Jump = flip gravity' },
];

const player = { x: 0, y: 0, w: SIZE, h: SIZE, vy: 0, dir: 1, airJumps: 0, onGround: false, zone: null };

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
let orbPressed = false;
let steps = 0;
let tab = 0;
let wonText = '';
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

const SPEEDS = [50, 75, 100, 125, 150];
let speedPct = 100;
try { speedPct = SPEEDS.includes(Number(localStorage.getItem('parkour.speed'))) ? Number(localStorage.getItem('parkour.speed')) : 100; } catch {}

function cycleSpeed(dir) {
  speedPct = SPEEDS[(SPEEDS.indexOf(speedPct) + dir + SPEEDS.length) % SPEEDS.length];
  try { localStorage.setItem('parkour.speed', speedPct); } catch {}
}

const skinInput = document.getElementById('skin');
let skin = null;

function setSkin(dataUrl) {
  if (!dataUrl) {
    skin = null;
    try { localStorage.removeItem('parkour.skin'); } catch {}
    return;
  }
  const img = new Image();
  img.onload = () => { skin = img; };
  img.src = dataUrl;
}
try { setSkin(localStorage.getItem('parkour.skin')); } catch {}

skinInput.addEventListener('change', () => {
  const file = skinInput.files[0];
  skinInput.value = '';
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(img.src);
    const side = Math.min(img.width, img.height);
    const out = document.createElement('canvas');
    out.width = out.height = side <= 48 ? 32 : 96;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = side > 48;
    octx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out.width, out.height);
    const data = out.toDataURL('image/png');
    try { localStorage.setItem('parkour.skin', data); } catch {}
    setSkin(data);
  };
  img.src = URL.createObjectURL(file);
});

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

function physicsOf(p) {
  const z = (p && p.zone && ZONES[p.zone]) || {};
  return { speed: z.speed ?? SPEED, gravity: z.gravity ?? theme.gravity ?? GRAVITY, jump: z.jump ?? theme.jump ?? JUMP_FORCE };
}

// Gap range (px) crossable from anywhere on the platform (up to hanging SIZE-1 px over its edge)
// onto a ledge dy px higher without clipping its wall; `far` is the longest landing distance.
function jumpRange(dy, z) {
  if (theme.flip) {
    // Gravity flip: fall from rest to the opposite surface, which is nearer on one side by |dy|;
    // a step of |dy| must also be cleared before the cube reaches the next column's wall.
    let near = 0;
    let clear = 0;
    for (let n = 1, y = 0, vy = 0; n < 200; n++) {
      vy += z.gravity;
      y += vy;
      if (!clear && y >= Math.abs(dy)) clear = n;
      if (!near && y >= CORRIDOR - SIZE - Math.abs(dy)) near = n;
      if (y >= CORRIDOR - SIZE + Math.abs(dy)) return { min: dy ? z.speed * (clear + 1) + SIZE : 0, max: z.speed * near - 4, far: z.speed * n + SIZE };
    }
    return null;
  }
  let up = -1;
  for (let n = 1, y = 0, vy = z.jump; n < 200; n++) {
    vy += z.gravity;
    y += vy;
    if (y <= -dy && up < 0) up = n;
    if (y > -dy && up >= 0) return { min: z.speed * up + SIZE, max: z.speed * n - 4, far: z.speed * n + SIZE };
  }
  return null;
}

// Edge jump with an orb at the apex: landing distances for the earliest and latest frames in
// which the orb can be pressed, plus the orb position relative to the jump start.
function orbArc(dy, z) {
  const pts = [{ x: 0, y: 0 }];
  let apex = 0;
  for (let f = 1, vy = z.jump; f < 200; f++) {
    vy += z.gravity;
    pts.push({ x: pts[f - 1].x + z.speed, y: pts[f - 1].y + vy });
    if (!apex && vy >= 0) apex = f;
    if (apex && pts[f].y > 0) break;
  }
  const orb = pts[apex];
  const land = (f) => {
    let { x, y } = pts[f];
    for (let n = f + 1, vy = z.jump; n < 400; n++) {
      vy += z.gravity;
      y += vy;
      x += z.speed;
      if (vy > 0 && y > -dy) return x;
    }
    return Infinity;
  };
  const dists = pts.map((q, f) => (f > 0 && Math.hypot(q.x - orb.x, q.y - orb.y) <= ORB_R ? land(f) : null)).filter((d) => d !== null);
  return { orb: { x: orb.x + SIZE / 2, y: orb.y + SIZE / 2 }, min: 0, max: Math.min(...dists) - 4, far: Math.max(...dists) + SIZE };
}

const mod = (a, m) => ((a % m) + m) % m;

// Each pattern returns platform specs: { w, dy (ledge rises by dy), spikes, groups, far, zone, blink, orb }.
const PATTERNS = [
  { from: 0, make: (r, t, i) => [{ w: r(160, 300), spikes: i >= 2 && r() < 0.5 + 0.3 * t ? 1 + Math.floor(r() * (1 + 2 * t)) : 0 }] },
  { from: 0, make: (r, t) => Array.from({ length: 3 + Math.floor(r() * 4) }, () => ({ w: r(40 + 30 * (1 - t), 80 + 40 * (1 - t)), dy: r(-20, 20) })) },
  { from: 1, make: (r, t) => Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ w: r(60 + 30 * (1 - t), 100 + 40 * (1 - t)), dy: 40 })) },
  { from: 1, make: (r, t) => Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ w: r(60 + 30 * (1 - t), 100 + 40 * (1 - t)), dy: -50 })) },
  { from: 2, make: (r, t) => [{ w: r(500, 700), spikes: 1 + Math.floor(r() * (1 + 2 * t)), groups: 2 + Math.floor(r() * (1 + t)) }] },
  { from: 3, make: (r) => [{ w: r(150, 250), dy: r(-40, 30), far: true }] },
  { from: 5, make: (r) => [{ w: r(80, 120), dy: 70 }, { w: r(80, 120), dy: -70 }] },
];

const ZONE_NAMES = Object.keys(ZONES);
const HARD_PATTERNS = [
  (r) => { const zone = ZONE_NAMES[Math.floor(r() * ZONE_NAMES.length)]; return Array.from({ length: 4 + Math.floor(r() * 3) }, () => ({ w: r(36, 60), dy: r(-25, 25), zone })); },
  (r) => [{ w: r(80, 120), zone: null }, ...Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ w: r(50, 90), dy: r(-30, 10), blink: true }))],
  (r) => [{ w: r(100, 160), zone: null }, ...Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ w: r(50, 100), dy: r(-40, 0), orb: true }))],
  (r) => [{ w: r(600, 800), zone: 'fast', spikes: 3 + Math.floor(r() * 2), groups: 3 }],
  (r) => [...Array.from({ length: 3 }, () => ({ w: r(50, 70), dy: 45, zone: 'heavy' })), { w: r(80, 120), dy: -90, zone: 'moon' }],
  (r) => [{ w: r(100, 140), zone: null }, { w: r(70, 110), dy: r(-30, 0), orb: true, blink: true }],
  (r) => [{ w: r(60, 90), zone: 'slow' }, { w: r(40, 60), dy: r(-20, 20), zone: 'fast', blink: true }, { w: r(40, 60), dy: r(-20, 20), zone: 'fast', blink: true }],
];

function generateLevel(i) {
  const rand = rng(i + 1);
  const r = (a, b) => (a === undefined ? rand() : a + rand() * (b - a));
  const hard = i >= LEVEL_COUNT;
  const t = hard ? 1 + 0.4 * (i - LEVEL_COUNT) / (IMPOSSIBLE_COUNT - 1) : i / (LEVEL_COUNT - 1);
  const target = hard ? 5000 + 2500 * (i - LEVEL_COUNT) / (IMPOSSIBLE_COUNT - 1) : 2000 + 4000 * t;
  const platforms = [];
  const spikes = [];
  const orbs = [];
  let x = 0;
  let y = 420;
  let zone = null;

  function place(spec) {
    const prev = platforms[platforms.length - 1];
    const zPrev = physicsOf(prev);
    if (spec.zone !== undefined) zone = spec.zone;
    const z = physicsOf({ zone });
    const flight = jumpRange(0, z).far - SIZE;
    const spacing = flight + 60;
    const count = Math.min(spec.spikes || 0, Math.floor((flight - 70) / SPIKE));
    const groups = count ? spec.groups || 1 : 0;
    const spikeWidth = (lead) => lead + (groups - 1) * spacing + 60 + count * SPIKE + flight - 10;
    let w = Math.max(36, Math.round(spec.w));
    if (count) w = Math.max(w, spikeWidth(140));
    let lead = 140;
    let orb = null;
    let range = null;

    if (prev) {
      let dy = Math.round(Math.max(y - 420, Math.min(y - (theme.flip ? 280 : 150), spec.dy || 0)));
      const jumpHeight = zPrev.jump * zPrev.jump / (2 * zPrev.gravity);
      if (spec.orb && y > 2 * jumpHeight + 10) {
        dy = Math.min(dy, 0);
        range = orbArc(dy, zPrev);
        orb = range.orb;
      } else {
        range = jumpRange(dy, zPrev);
        if (!range || (theme.flip && range.max + 4 - range.min < 52)) { dy = 0; range = jumpRange(0, zPrev); }
      }
      const margin = Math.max(8, 44 - 32 * t) * zPrev.speed / SPEED;
      // Flipping has a much narrower press window than jumping, so keep flip gaps well below the max.
      const gapMax = theme.flip ? Math.max(Math.min(range.max * (0.45 + 0.12 * t), range.max - 48), range.min + 8) : range.max - margin;
      const gapMin = Math.max(range.min + 8, theme.flip ? 30 : (40 + 60 * Math.min(t, 1)) * zPrev.speed / SPEED, range.far + 4 - w);
      const gap = Math.round(spec.far || orb ? gapMax : gapMin >= gapMax ? gapMax : r(gapMin, gapMax));
      lead = Math.max(lead, range.far - gap - 21);
      w = Math.round(Math.max(w, range.far + 4 - gap, count ? spikeWidth(lead) : 0));
      if (orb) orbs.push({ x: x - SIZE + orb.x, y: y - SIZE + orb.y });
      x += gap;
      y -= dy;
    }

    const platform = { x, y, w, h: H - y, zone, index: platforms.length };
    if (spec.blink && prev) {
      // Timer starts when the cube lands on the previous platform; solid from just before the
      // earliest possible landing until well after the latest one.
      const on = Math.floor((range.max + 4) / zPrev.speed) - 6;
      const off = Math.ceil((prev.w - SIZE) / zPrev.speed + (range.far - SIZE) / zPrev.speed + w / z.speed) + 15;
      const period = off - on;
      platform.blink = { period, phase: mod(-on, 2 * period), trigAt: null };
    }
    platforms.push(platform);
    for (let g = 0; g < groups; g++) {
      const sx = x + lead + g * spacing + Math.round(r(0, 60));
      for (let k = 0; k < count; k++) spikes.push({ x: sx + k * SPIKE, y: y - SPIKE });
    }
    x += w;
  }

  place({ w: 220, zone: null });
  const pool = PATTERNS.filter((p) => i >= p.from).map((p) => p.make);
  let last = null;
  while (x < target) {
    const list = hard && rand() < 0.65 ? HARD_PATTERNS : pool;
    let pat = list[Math.floor(rand() * list.length)];
    if (pat === last) pat = list[(list.indexOf(pat) + 1) % list.length];
    for (const spec of pat(r, t, i)) place(spec);
    last = pat;
  }
  place({ w: 220, zone: null });

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
  return { platforms, spikes, orbs, deco, goal };
}

// ---------- game state ----------

function startLevel(i) {
  levelIndex = i;
  theme = THEMES[i % THEMES.length];
  if (i >= LEVEL_COUNT) theme = { ...theme, flip: false, doubleJump: false };
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
  player.zone = level.platforms[0];
  steps = 0;
  for (const p of level.platforms) if (p.blink) p.blink.trigAt = null;
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
  selected = Math.min(levelIndex + 1, TOTAL_LEVELS - 1);
  tab = selected >= LEVEL_COUNT ? 1 : 0;
  const done = levelIndex + 1;
  wonText = done === TOTAL_LEVELS ? 'You beat the impossible!' : 'All 20 levels completed! Impossible mode unlocked.';
  state = done === LEVEL_COUNT || done === TOTAL_LEVELS ? 'won' : 'menu';
  tone(500, 1000, 0.15, 'square');
  setTimeout(() => tone(750, 1500, 0.2, 'square'), 120);
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solid(p) {
  if (!p.blink) return true;
  const b = p.blink;
  return b.trigAt !== null && Math.floor((steps - b.trigAt + b.phase) / b.period) % 2 === 0;
}

function update() {
  if (state !== 'play') return;
  steps++;
  const z = physicsOf(player.zone);

  if (theme.flip) {
    if (jumpPressed && player.onGround) {
      player.dir = -player.dir;
      player.onGround = false;
      tone(200, 500, 0.15, 'sawtooth');
    }
  } else if (jumpHeld && player.onGround) {
    player.vy = z.jump;
    player.onGround = false;
    player.airJumps = theme.doubleJump ? 1 : 0;
    tone(300, 700, 0.12, 'square');
  } else if (jumpPressed && player.airJumps > 0) {
    player.vy = z.jump;
    player.airJumps--;
    tone(500, 1000, 0.12, 'square');
  } else if (orbPressed && !player.onGround && level.orbs.some((o) => Math.hypot(player.x + SIZE / 2 - o.x, player.y + SIZE / 2 - o.y) <= ORB_R)) {
    player.vy = z.jump;
    tone(600, 1200, 0.15, 'square');
  }
  if (theme.variable && !jumpHeld && player.vy < -4) player.vy = -4;
  jumpPressed = orbPressed = false;
  player.vy += z.gravity * player.dir;

  player.x += z.speed;
  for (const p of level.platforms) {
    if (solid(p) && overlaps(player, p)) return die();
  }

  player.y += player.vy;
  player.onGround = false;
  for (const p of level.platforms) {
    if (!solid(p) || !overlaps(player, p)) continue;
    const inside = player.dir > 0 ? player.y + SIZE - player.vy > p.y + 1 : player.y - player.vy < p.y + p.h - 1;
    if (p.blink && inside) return die();
    player.y = player.dir > 0 ? p.y - SIZE : p.y + p.h;
    player.vy = 0;
    player.onGround = true;
    player.zone = p;
    const next = level.platforms[p.index + 1];
    if (next && next.blink && next.blink.trigAt === null) next.blink.trigAt = steps;
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

const OPTION_ITEMS = [
  { label: () => `Game speed: ${speedPct}%`, hint: '← →', action: () => cycleSpeed(1), adjust: cycleSpeed },
  { label: () => 'Fullscreen', hint: 'F', code: 'KeyF', action: toggleFullscreen },
  { label: () => `Sound: ${muted ? 'off' : 'on'}`, hint: 'M', code: 'KeyM', action: toggleMute },
];
const PAUSE_ITEMS = [
  { label: () => 'Resume', hint: 'Esc', code: 'Escape', action: () => { state = 'play'; } },
  { label: () => 'Restart', hint: 'R', code: 'KeyR', action: () => { attempts = 1; resetPlayer(); state = 'play'; } },
  ...OPTION_ITEMS,
  { label: () => 'Main menu', hint: 'Q', code: 'KeyQ', action: () => { state = 'menu'; } },
];
const OPTIONS_ITEMS = [
  OPTION_ITEMS[0],
  { label: () => (skin ? 'Skin: change photo' : 'Skin: upload photo'), hint: '', preview: true, action: () => skinInput.click() },
  { label: () => 'Skin: default cube', hint: '', action: () => setSkin(null) },
  ...OPTION_ITEMS.slice(1),
  { label: () => 'Back', hint: 'Esc', code: 'Escape', action: () => { state = 'menu'; } },
];
const SETTINGS_BUTTON = { x: 630, y: 18, w: 150, h: 34 };
let pauseSel = 0;

function panelItems() {
  return state === 'pause' ? PAUSE_ITEMS : OPTIONS_ITEMS;
}

function openPanel(next) {
  state = next;
  jumpHeld = false;
  pauseSel = 0;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  initAudio();
  if (e.code === 'KeyF') return toggleFullscreen();
  if (e.code === 'KeyM') return toggleMute();
  if (state === 'menu') {
    const lo = tab ? LEVEL_COUNT : 0;
    const hi = tab ? TOTAL_LEVELS - 1 : LEVEL_COUNT - 1;
    if (e.code === 'ArrowRight') selected = Math.min(hi, selected + 1);
    if (e.code === 'ArrowLeft') selected = Math.max(lo, selected - 1);
    if (e.code === 'ArrowDown') selected = Math.min(hi, selected + 5);
    if (e.code === 'ArrowUp') selected = Math.max(lo, selected - 5);
    if (e.code === 'Tab') { e.preventDefault(); setTab(1 - tab); }
    if ((e.code === 'Enter' || e.code === 'Space') && selected <= unlocked) startLevel(selected);
    if (e.code === 'KeyS') openPanel('options');
  } else if (state === 'play') {
    if (e.code === 'Escape') openPanel('pause');
    if (JUMP_KEYS.includes(e.code)) jumpHeld = jumpPressed = orbPressed = true;
  } else if (state === 'pause' || state === 'options') {
    const items = panelItems();
    const cur = items[pauseSel];
    if (e.code === 'ArrowDown') pauseSel = (pauseSel + 1) % items.length;
    if (e.code === 'ArrowUp') pauseSel = (pauseSel + items.length - 1) % items.length;
    if (e.code === 'ArrowRight' && cur.adjust) cur.adjust(1);
    if (e.code === 'ArrowLeft' && cur.adjust) cur.adjust(-1);
    if (e.code === 'Enter') cur.action();
    const item = items.find((it) => it.code === e.code);
    if (item) item.action();
  } else {
    state = 'menu';
  }
});
window.addEventListener('keyup', (e) => { if (JUMP_KEYS.includes(e.code)) jumpHeld = false; });

function press(pt) {
  initAudio();
  if (state === 'menu') {
    const base = tab ? LEVEL_COUNT : 0;
    const i = hitIndex(pt, tab ? IMPOSSIBLE_COUNT : LEVEL_COUNT, (k) => tileRect(base + k));
    if (i >= 0 && base + i <= unlocked) startLevel(base + i);
    if (hitIndex(pt, 1, () => SETTINGS_BUTTON) === 0) openPanel('options');
    const tb = hitIndex(pt, 2, tabRect);
    if (tb >= 0) setTab(tb);
  } else if (state === 'play') {
    jumpHeld = jumpPressed = true;
  } else if (state === 'pause' || state === 'options') {
    const items = panelItems();
    const k = hitIndex(pt, items.length, pauseRow);
    if (k >= 0) { pauseSel = k; items[k].action(); }
  } else {
    state = 'menu';
  }
}
canvas.addEventListener('mousedown', press);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); press(e.touches[0]); }, { passive: false });
window.addEventListener('mouseup', () => { jumpHeld = false; });
window.addEventListener('touchend', () => { jumpHeld = false; });

function tileRect(i) {
  const k = i >= LEVEL_COUNT ? i - LEVEL_COUNT : i;
  return { x: 100 + (k % 5) * 120, y: 104 + Math.floor(k / 5) * 80, w: 100, h: 60 };
}

function tabRect(k) {
  return { x: 230 + k * 180, y: 62, w: 160, h: 28 };
}

function setTab(k) {
  tab = k;
  selected = tab ? Math.max(LEVEL_COUNT, Math.min(selected, TOTAL_LEVELS - 1)) : Math.min(selected, LEVEL_COUNT - 1);
  if (tab && selected < LEVEL_COUNT) selected = LEVEL_COUNT;
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
  if (skin) {
    ctx.imageSmoothingEnabled = skin.width > 32;
    ctx.drawImage(skin, x, y, SIZE, SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return;
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

  for (const p of level.platforms) {
    if (!solid(p)) {
      ctx.strokeStyle = theme.ground;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = theme.ground;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    if (p.zone && p.y > 0) {
      const zn = ZONES[p.zone];
      ctx.fillStyle = zn.color;
      ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zn.label, p.x + p.w / 2, p.y + 22);
    }
  }

  for (const o of level.orbs) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    dot(o.x, o.y, ORB_R);
    ctx.fillStyle = '#fff';
    dot(o.x, o.y, 8);
    ctx.strokeStyle = theme.spike;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

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
  const title = levelIndex >= LEVEL_COUNT ? `Impossible ${levelIndex - LEVEL_COUNT + 1}` : `Level ${levelIndex + 1}`;
  ctx.fillText(`${title} · ${theme.name}`, 12, 24);
  if (theme.rule) {
    ctx.font = '13px sans-serif';
    ctx.fillText(theme.rule, 12, 44);
  }
  ctx.textAlign = 'right';
  ctx.fillText(`Attempt ${attempts}`, W - 12, 24);
}

function drawMenu() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#eee';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('PARKOUR', W / 2, 46);

  const b = SETTINGS_BUTTON;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#eee';
  ctx.font = '16px sans-serif';
  ctx.fillText('Settings (S)', b.x + b.w / 2, b.y + 23);

  ['Levels', 'Impossible'].forEach((name, k) => {
    const r = tabRect(k);
    ctx.fillStyle = k === tab ? (k ? '#e01010' : '#4ecca3') : 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = k === tab ? INK : '#eee';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(name, r.x + r.w / 2, r.y + 19);
  });

  const base = tab ? LEVEL_COUNT : 0;
  const count = tab ? IMPOSSIBLE_COUNT : LEVEL_COUNT;
  for (let k = 0; k < count; k++) {
    const i = base + k;
    const r = tileRect(i);
    const open = i <= unlocked;
    ctx.fillStyle = open ? THEMES[i % THEMES.length].cube : '#2a2a4a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (tab && open) {
      ctx.strokeStyle = '#e01010';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    }
    if (i === selected) {
      ctx.strokeStyle = '#4ecca3';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    }
    if (open) {
      ctx.fillStyle = INK;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(k + 1, r.x + r.w / 2, r.y + r.h / 2 + 9);
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
  if (tab) {
    const desc = unlocked < LEVEL_COUNT ? 'Beat level 20 to unlock' : `Impossible ${selected - LEVEL_COUNT + 1} · ${th.name} — zones, blinking platforms, orbs${th.rule && !['Double jump', 'Jump = flip gravity'].includes(th.rule) ? ', ' + th.rule.toLowerCase() : ''}`;
    ctx.fillText(desc, W / 2, 300);
  } else {
    ctx.fillText(`${selected + 1}. ${th.name}${th.rule ? ' — ' + th.rule : ''}`, W / 2, 420);
  }
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Click a level or use arrows + Enter · Tab — switch section · S — settings · F — fullscreen · M — sound', W / 2, 442);
}

function drawPanel() {
  if (state === 'pause') drawGame();
  else {
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(state === 'pause' ? 'PAUSED' : 'SETTINGS', W / 2, 90);
  ctx.font = '20px sans-serif';
  panelItems().forEach((item, k) => {
    const r = pauseRow(k);
    const active = k === pauseSel;
    ctx.fillStyle = active ? (state === 'pause' ? theme.cube : '#4ecca3') : 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = active ? INK : '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(item.label(), r.x + 16, r.y + 29);
    ctx.textAlign = 'right';
    ctx.fillText(item.hint, r.x + r.w - 16, r.y + 29);
    if (item.preview && skin) ctx.drawImage(skin, r.x + r.w - 46, r.y + 7, 30, 30);
  });
}

function drawWon() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4ecca3';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(wonText, W / 2, H / 2 - 10);
  ctx.fillStyle = '#eee';
  ctx.font = '18px sans-serif';
  ctx.fillText('Any key — menu', W / 2, H / 2 + 30);
}

let last = performance.now();
let acc = 0;

function loop(now) {
  acc += Math.min(now - last, 100);
  last = now;
  const tick = 1000 / (165 * speedPct / 100);
  while (acc >= tick) {
    update();
    acc -= tick;
  }
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (state === 'play') drawGame();
  else if (state === 'pause' || state === 'options') drawPanel();
  else if (state === 'menu') drawMenu();
  else drawWon();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
