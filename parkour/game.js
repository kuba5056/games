const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const SPEED = 4;
const JUMP_FORCE = -12;
const SIZE = 30;
const SPIKE = 20;
const LEVEL_COUNT = 20;
const STORAGE_KEY = 'parkour.unlocked';

const player = { x: 0, y: 0, w: SIZE, h: SIZE, vx: SPEED, vy: 0, onGround: false };

let state = 'menu';
let levelIndex = 0;
let level = null;
let levelWidth = 0;
let camX = 0;
let attempts = 1;
let selected = 0;
let unlocked = 0;
let jumpHeld = false;
try { unlocked = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch {}

// ---------- level generator ----------

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gap range (px) crossable by jumping when the cube's right edge reaches the platform edge,
// onto a ledge dy px higher, without clipping its wall.
function jumpRange(dy) {
  let up = -1;
  for (let n = 1, y = 0, vy = JUMP_FORCE; n < 80; n++) {
    vy += GRAVITY;
    y += vy;
    if (y <= -dy && up < 0) up = n;
    if (y > -dy && up >= 0) return { min: SPEED * up, max: SPEED * n - 4 };
  }
  return null;
}

function generateLevel(i) {
  const rand = rng(i + 1);
  const between = (a, b) => a + rand() * (b - a);
  const t = i / (LEVEL_COUNT - 1);
  const segments = 8 + Math.round(20 * t);
  const platforms = [];
  const spikes = [];
  let x = 0;
  let y = 420;

  for (let s = 0; s < segments; s++) {
    const edge = s === 0 || s === segments - 1;
    const spiky = i >= 2 && !edge && rand() < 0.3 + 0.4 * t;
    const count = spiky ? 1 + Math.floor(rand() * (1 + 2 * t)) : 0;
    let w = edge ? 220 : Math.round(between(200 - 155 * t, 320 - 100 * t));
    if (spiky) w = Math.max(w, 300 + count * SPIKE);
    platforms.push({ x, y, w, h: 20 });

    if (spiky) {
      const sx = Math.round(between(x + 140, x + w - 150 - count * SPIKE));
      for (let k = 0; k < count; k++) spikes.push({ x: sx + k * SPIKE, y: y - SPIKE });
    }
    if (s === segments - 1) break;

    let dy = Math.round(between(-70, 70) * t);
    dy = Math.max(y - 420, Math.min(y - 150, dy));
    let range = jumpRange(dy);
    if (!range) { dy = 0; range = jumpRange(0); }
    const gapMax = range.max - (44 - 32 * t);
    const gapMin = Math.max(range.min + 8, 40 + 60 * t);
    const gap = Math.round(gapMin >= gapMax ? gapMax : between(gapMin, gapMax));
    x += w + gap;
    y -= dy;
  }

  const end = platforms[platforms.length - 1];
  return { platforms, spikes, goal: { x: end.x + end.w - 40, y: end.y - 60, w: 20, h: 60 } };
}

// ---------- game state ----------

function startLevel(i) {
  levelIndex = i;
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
  camX = 0;
}

function die() {
  attempts++;
  resetPlayer();
}

function completeLevel() {
  unlocked = Math.max(unlocked, levelIndex + 1);
  try { localStorage.setItem(STORAGE_KEY, unlocked); } catch {}
  selected = Math.min(levelIndex + 1, LEVEL_COUNT - 1);
  state = levelIndex + 1 === LEVEL_COUNT ? 'won' : 'menu';
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
  if (state !== 'play') return;

  if (jumpHeld && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }
  player.vy += GRAVITY;

  player.x += SPEED;
  for (const p of level.platforms) {
    if (overlaps(player, p)) return die();
  }

  player.y += player.vy;
  player.onGround = false;
  for (const p of level.platforms) {
    if (!overlaps(player, p)) continue;
    if (player.vy > 0) {
      player.y = p.y - SIZE;
      player.onGround = true;
    } else {
      player.y = p.y + p.h;
    }
    player.vy = 0;
  }

  for (const s of level.spikes) {
    if (overlaps(player, { x: s.x + 5, y: s.y + 6, w: 10, h: 14 })) return die();
  }
  if (player.y > canvas.height) return die();
  if (overlaps(player, level.goal)) return completeLevel();

  camX = Math.max(0, Math.min(player.x + SIZE / 2 - canvas.width / 2, levelWidth - canvas.width));
}

// ---------- input ----------

const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (state === 'menu') {
    if (e.code === 'ArrowRight') selected = Math.min(LEVEL_COUNT - 1, selected + 1);
    if (e.code === 'ArrowLeft') selected = Math.max(0, selected - 1);
    if (e.code === 'ArrowDown') selected = Math.min(LEVEL_COUNT - 1, selected + 5);
    if (e.code === 'ArrowUp') selected = Math.max(0, selected - 5);
    if ((e.code === 'Enter' || e.code === 'Space') && selected <= unlocked) startLevel(selected);
  } else if (state === 'play') {
    if (e.code === 'Escape') state = 'menu';
    if (JUMP_KEYS.includes(e.code)) jumpHeld = true;
  } else {
    state = 'menu';
  }
});
window.addEventListener('keyup', (e) => { if (JUMP_KEYS.includes(e.code)) jumpHeld = false; });

function press(pt) {
  if (state === 'menu') {
    const i = tileAt(pt);
    if (i >= 0 && i <= unlocked) startLevel(i);
  } else if (state === 'play') {
    jumpHeld = true;
  } else {
    state = 'menu';
  }
}
canvas.addEventListener('mousedown', press);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); press(e.touches[0]); }, { passive: false });
window.addEventListener('mouseup', () => { jumpHeld = false; });
window.addEventListener('touchend', () => { jumpHeld = false; });

function tileRect(i) {
  return { x: 100 + (i % 5) * 120, y: 120 + Math.floor(i / 5) * 80, w: 100, h: 60 };
}

function tileAt(pt) {
  const rect = canvas.getBoundingClientRect();
  const mx = (pt.clientX - rect.left) * canvas.width / rect.width;
  const my = (pt.clientY - rect.top) * canvas.height / rect.height;
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const r = tileRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return i;
  }
  return -1;
}

// ---------- drawing ----------

function drawPlayer() {
  ctx.fillStyle = '#e94560';
  ctx.fillRect(player.x, player.y, SIZE, SIZE);
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(player.x + 10, player.y + 11, 3, 0, Math.PI * 2);
  ctx.arc(player.x + 20, player.y + 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x + 15, player.y + 17, 6, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function drawGame() {
  ctx.save();
  ctx.translate(-camX, 0);

  ctx.fillStyle = '#0f3460';
  for (const p of level.platforms) ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = '#f5f5f5';
  for (const s of level.spikes) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + SPIKE);
    ctx.lineTo(s.x + SPIKE / 2, s.y);
    ctx.lineTo(s.x + SPIKE, s.y + SPIKE);
    ctx.fill();
  }

  ctx.fillStyle = '#4ecca3';
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  drawPlayer();
  ctx.restore();

  ctx.fillStyle = '#0f3460';
  ctx.fillRect(200, 12, 400, 8);
  ctx.fillStyle = '#4ecca3';
  ctx.fillRect(200, 12, 400 * Math.min(1, player.x / (levelWidth - SIZE)), 8);

  ctx.fillStyle = '#eee';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Poziom ${levelIndex + 1}`, 12, 24);
  ctx.textAlign = 'right';
  ctx.fillText(`Próba ${attempts}`, canvas.width - 12, 24);
}

function drawMenu() {
  ctx.fillStyle = '#eee';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('PARKOUR', canvas.width / 2, 70);

  for (let i = 0; i < LEVEL_COUNT; i++) {
    const r = tileRect(i);
    const open = i <= unlocked;
    ctx.fillStyle = open ? '#e94560' : '#2a2a4a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (i === selected) {
      ctx.strokeStyle = '#4ecca3';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    }
    if (open) {
      ctx.fillStyle = '#fff';
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

  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Kliknij poziom lub strzałki + Enter', canvas.width / 2, 435);
}

function drawWon() {
  ctx.fillStyle = '#4ecca3';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('Wszystkie poziomy ukończone!', canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = '#eee';
  ctx.font = '18px sans-serif';
  ctx.fillText('Dowolny klawisz — menu', canvas.width / 2, canvas.height / 2 + 30);
}

function loop() {
  update();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state === 'play') drawGame();
  else if (state === 'menu') drawMenu();
  else drawWon();
  requestAnimationFrame(loop);
}

loop();
