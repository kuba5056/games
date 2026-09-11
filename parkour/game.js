const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const MOVE_SPEED = 4;
const JUMP_FORCE = -12;
const FRICTION = 0.8;

const START = { x: 60, y: 350 };

const player = {
  x: START.x,
  y: START.y,
  w: 30,
  h: 40,
  vx: 0,
  vy: 0,
  onGround: false,
};

const platforms = [
  { x: 0, y: 420, w: 800, h: 30 },
  { x: 200, y: 340, w: 120, h: 20 },
  { x: 380, y: 270, w: 120, h: 20 },
  { x: 560, y: 200, w: 120, h: 20 },
  { x: 700, y: 130, w: 100, h: 20 },
];

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function reset() {
  player.x = START.x;
  player.y = START.y;
  player.vx = 0;
  player.vy = 0;
}

function update() {
  if (keys.KeyA || keys.ArrowLeft) player.vx = -MOVE_SPEED;
  else if (keys.KeyD || keys.ArrowRight) player.vx = MOVE_SPEED;
  else player.vx *= FRICTION;

  if ((keys.KeyW || keys.ArrowUp || keys.Space) && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.vy += GRAVITY;

  player.x += player.vx;
  for (const p of platforms) {
    if (!overlaps(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    player.vx = 0;
  }

  player.y += player.vy;
  player.onGround = false;
  for (const p of platforms) {
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
  if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;
  if (player.y > canvas.height) reset();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f3460';
  for (const p of platforms) ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = '#e94560';
  ctx.fillRect(player.x, player.y, player.w, player.h);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
