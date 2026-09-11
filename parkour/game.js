const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const MOVE_SPEED = 4;
const JUMP_FORCE = -12;
const FRICTION = 0.8;

// Max jump: ~114px high, ~160px far on flat ground.
const levels = [
  {
    start: { x: 40, y: 380 },
    platforms: [
      { x: 0, y: 420, w: 400, h: 30 },
      { x: 480, y: 420, w: 400, h: 30 },
      { x: 600, y: 340, w: 100, h: 20 },
      { x: 960, y: 420, w: 300, h: 30 },
      { x: 1100, y: 330, w: 100, h: 20 },
      { x: 1340, y: 420, w: 260, h: 30 },
    ],
    goal: { x: 1540, y: 360, w: 30, h: 60 },
  },
  {
    start: { x: 40, y: 380 },
    platforms: [
      { x: 0, y: 420, w: 300, h: 30 },
      { x: 400, y: 390, w: 180, h: 20 },
      { x: 680, y: 340, w: 150, h: 20 },
      { x: 930, y: 340, w: 120, h: 20 },
      { x: 1150, y: 400, w: 150, h: 20 },
      { x: 1400, y: 350, w: 120, h: 20 },
      { x: 1620, y: 300, w: 120, h: 20 },
      { x: 1840, y: 300, w: 160, h: 20 },
    ],
    goal: { x: 1950, y: 240, w: 30, h: 60 },
  },
  {
    start: { x: 40, y: 380 },
    platforms: [
      { x: 0, y: 420, w: 200, h: 30 },
      { x: 320, y: 400, w: 90, h: 20 },
      { x: 530, y: 360, w: 80, h: 20 },
      { x: 740, y: 310, w: 80, h: 20 },
      { x: 950, y: 310, w: 70, h: 20 },
      { x: 1160, y: 370, w: 70, h: 20 },
      { x: 1380, y: 320, w: 60, h: 20 },
      { x: 1590, y: 270, w: 60, h: 20 },
      { x: 1800, y: 330, w: 70, h: 20 },
      { x: 2020, y: 280, w: 60, h: 20 },
      { x: 2230, y: 280, w: 170, h: 20 },
    ],
    goal: { x: 2350, y: 220, w: 30, h: 60 },
  },
  {
    start: { x: 40, y: 380 },
    platforms: [
      { x: 0, y: 420, w: 150, h: 30 },
      { x: 300, y: 400, w: 50, h: 20 },
      { x: 460, y: 340, w: 50, h: 20 },
      { x: 670, y: 340, w: 45, h: 20 },
      { x: 865, y: 280, w: 45, h: 20 },
      { x: 1075, y: 280, w: 40, h: 20 },
      { x: 1265, y: 220, w: 40, h: 20 },
      { x: 1470, y: 290, w: 40, h: 20 },
      { x: 1660, y: 230, w: 40, h: 20 },
      { x: 1865, y: 230, w: 40, h: 20 },
      { x: 2055, y: 170, w: 40, h: 20 },
      { x: 2260, y: 240, w: 40, h: 20 },
      { x: 2450, y: 180, w: 40, h: 20 },
      { x: 2650, y: 180, w: 150, h: 20 },
    ],
    goal: { x: 2750, y: 120, w: 30, h: 60 },
  },
];

const player = { x: 0, y: 0, w: 30, h: 40, vx: 0, vy: 0, onGround: false };

let levelIndex = 0;
let level = levels[0];
let levelWidth = 0;
let camX = 0;
let won = false;

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loadLevel(i) {
  levelIndex = i;
  level = levels[i];
  levelWidth = Math.max(...level.platforms.map((p) => p.x + p.w));
  resetPlayer();
}

function resetPlayer() {
  player.x = level.start.x;
  player.y = level.start.y;
  player.vx = 0;
  player.vy = 0;
}

function update() {
  if (won) {
    if (keys.Space) { won = false; loadLevel(0); }
    return;
  }

  if (keys.KeyA || keys.ArrowLeft) player.vx = -MOVE_SPEED;
  else if (keys.KeyD || keys.ArrowRight) player.vx = MOVE_SPEED;
  else player.vx *= FRICTION;

  if ((keys.KeyW || keys.ArrowUp || keys.Space) && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.vy += GRAVITY;

  player.x += player.vx;
  for (const p of level.platforms) {
    if (!overlaps(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    player.vx = 0;
  }

  player.y += player.vy;
  player.onGround = false;
  for (const p of level.platforms) {
    if (!overlaps(player, p)) continue;
    if (player.vy > 0) {
      player.y = p.y - player.h;
      player.onGround = true;
    } else if (player.vy < 0) {
      player.y = p.y + p.h;
    }
    player.vy = 0;
  }

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > levelWidth) player.x = levelWidth - player.w;
  if (player.y > canvas.height) resetPlayer();

  if (overlaps(player, level.goal)) {
    if (levelIndex + 1 < levels.length) loadLevel(levelIndex + 1);
    else won = true;
  }

  const target = player.x + player.w / 2 - canvas.width / 2;
  camX = Math.max(0, Math.min(target, levelWidth - canvas.width));
}

function drawPlayer() {
  ctx.fillStyle = '#e94560';
  ctx.fillRect(player.x, player.y, player.w, player.h);

  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(player.x + 10, player.y + 13, 3, 0, Math.PI * 2);
  ctx.arc(player.x + 20, player.y + 13, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x + 15, player.y + 22, 7, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camX, 0);

  ctx.fillStyle = '#0f3460';
  for (const p of level.platforms) ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = '#4ecca3';
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);

  drawPlayer();
  ctx.restore();

  ctx.fillStyle = '#eee';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Poziom ${levelIndex + 1} / ${levels.length}`, 12, 26);

  if (won) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4ecca3';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Wygrałeś!', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#eee';
    ctx.font = '18px sans-serif';
    ctx.fillText('Spacja — od nowa', canvas.width / 2, canvas.height / 2 + 30);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loadLevel(0);
loop();
