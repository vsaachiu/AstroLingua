// AstroLingua - Retro Asteroids Chinese Learning Game
// Single-file module JS. No external deps.

// ------------------ Game Config ------------------
const CONFIG = {
  width: 960,
  height: 600,
  ship: { thrust: 0.12, rotSpeed: 0.07, friction: 0.99, radius: 14 },
  bullet: { speed: 7, life: 70, radius: 2, cooldown: 180 },
  asteroid: { baseSpeed: 0.8, minSize: 18, maxSize: 42, spawnPadding: 40 },
  level: { baseCount: 5, growth: 1.5 },
  lives: 3,
};

// ------------------ Utilities ------------------
const rand = (a, b) => a + Math.random() * (b - a);
const choose = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function wrap(x, max) { return (x + max) % max; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }
function angleToVector(angle) { return { x: Math.cos(angle), y: Math.sin(angle) }; }
function now() { return performance.now(); }

// ------------------ Vocabulary Handling ------------------
const DEFAULT_VOCAB = [
  { en: 'hello', zh: '你好' },
  { en: 'thank you', zh: '谢谢' },
  { en: 'goodbye', zh: '再见' },
  { en: 'please', zh: '请' },
  { en: 'sorry', zh: '对不起' },
  { en: 'apple', zh: '苹果' },
  { en: 'water', zh: '水' },
  { en: 'teacher', zh: '老师' },
  { en: 'student', zh: '学生' },
  { en: 'book', zh: '书' },
  { en: 'cat', zh: '猫' },
  { en: 'dog', zh: '狗' },
  { en: 'blue', zh: '蓝色' },
  { en: 'red', zh: '红色' },
  { en: 'green', zh: '绿色' },
];

function parseCSV(text) {
  // Very simple CSV: english, chinese per line
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const [en, zh] = line.split(',').map(s => s?.trim());
    if (en && zh) out.push({ en, zh });
  }
  return out;
}

async function readVocabFile(file) {
  const text = await file.text();
  if (file.name.endsWith('.json')) {
    const data = JSON.parse(text);
    const out = [];
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === 'object' && item.en && item.zh) out.push({ en: item.en, zh: item.zh });
      }
    }
    return out;
  }
  return parseCSV(text);
}

// ------------------ DOM ------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.width; canvas.height = CONFIG.height;
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const upload = document.getElementById('vocabUpload');
const hud = {
  level: document.getElementById('level'),
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  hits: document.getElementById('hits'),
  misses: document.getElementById('misses'),
  accuracy: document.getElementById('accuracy'),
  target: document.getElementById('targetWord'),
};

// ------------------ Game State ------------------
const State = {
  running: false,
  paused: false,
  level: 1,
  score: 0,
  lives: CONFIG.lives,
  hits: 0,
  misses: 0,
  bullets: [],
  asteroids: [],
  vocab: [...DEFAULT_VOCAB],
  currentTarget: null, // { en, zh }
  input: { up: false, left: false, right: false, shoot: false },
  lastShotTime: 0,
  ship: { x: CONFIG.width / 2, y: CONFIG.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invuln: 0 },
  lastFrame: 0,
};

function resetState() {
  State.running = false;
  State.paused = false;
  State.level = 1;
  State.score = 0;
  State.lives = CONFIG.lives;
  State.hits = 0;
  State.misses = 0;
  State.bullets = [];
  State.asteroids = [];
  State.currentTarget = null;
  State.lastShotTime = 0;
  State.ship = { x: CONFIG.width / 2, y: CONFIG.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invuln: 120 };
}

// ------------------ Asteroid and Level Logic ------------------
function spawnAsteroidsForLevel(level) {
  State.asteroids.length = 0;
  const vocabPool = [...State.vocab];
  const target = choose(vocabPool);
  State.currentTarget = target;
  
  const count = Math.max(3, Math.round(CONFIG.level.baseCount + (level - 1) * CONFIG.level.growth));
  // Ensure at least 1 correct asteroid
  const correctIndex = (Math.random() * count) | 0;

  for (let i = 0; i < count; i++) {
    let text = choose(vocabPool).zh;
    let isCorrect = false;
    if (i === correctIndex) { text = target.zh; isCorrect = true; }
    let x, y;
    // Spawn around edges with padding
    const side = choose(['top', 'bottom', 'left', 'right']);
    if (side === 'top') { x = rand(0, CONFIG.width); y = -CONFIG.asteroid.spawnPadding; }
    if (side === 'bottom') { x = rand(0, CONFIG.width); y = CONFIG.height + CONFIG.asteroid.spawnPadding; }
    if (side === 'left') { x = -CONFIG.asteroid.spawnPadding; y = rand(0, CONFIG.height); }
    if (side === 'right') { x = CONFIG.width + CONFIG.asteroid.spawnPadding; y = rand(0, CONFIG.height); }

    const size = rand(CONFIG.asteroid.minSize, CONFIG.asteroid.maxSize) * (1 + level * 0.05);
    const angle = Math.atan2(State.ship.y - y, State.ship.x - x) + rand(-0.6, 0.6);
    const spd = CONFIG.asteroid.baseSpeed * (1 + level * 0.08) * rand(0.8, 1.3);
    const vel = angleToVector(angle);
    const rot = rand(-0.03, 0.03);

    State.asteroids.push({ x, y, vx: vel.x * spd, vy: vel.y * spd, angle: rand(0, Math.PI * 2), rot, size, text, isCorrect, alive: true });
  }

  hud.target.textContent = target.en;
  hud.level.textContent = String(State.level);
}

// ------------------ Input ------------------
const KEY = { ArrowUp: 'up', KeyW: 'up', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'shoot' };
window.addEventListener('keydown', (e) => {
  if (e.code in KEY) { State.input[KEY[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code in KEY) { State.input[KEY[e.code]] = false; if (e.code === 'Space') e.preventDefault(); }
});

// ------------------ Game Loop ------------------
function update() {
  const t = now();
  const dt = State.lastFrame ? (t - State.lastFrame) / 16.67 : 1; // ~60fps scale
  State.lastFrame = t;
  if (!State.running || State.paused) return;

  // Ship rotation and thrust
  if (State.input.left) State.ship.angle -= CONFIG.ship.rotSpeed * dt;
  if (State.input.right) State.ship.angle += CONFIG.ship.rotSpeed * dt;
  if (State.input.up) {
    const v = angleToVector(State.ship.angle);
    State.ship.vx += v.x * CONFIG.ship.thrust * dt;
    State.ship.vy += v.y * CONFIG.ship.thrust * dt;
  }
  // Friction
  State.ship.vx *= CONFIG.ship.friction;
  State.ship.vy *= CONFIG.ship.friction;
  State.ship.x = wrap(State.ship.x + State.ship.vx, CONFIG.width);
  State.ship.y = wrap(State.ship.y + State.ship.vy, CONFIG.height);
  State.ship.invuln = Math.max(0, State.ship.invuln - 1);

  // Shooting
  if (State.input.shoot && t - State.lastShotTime > CONFIG.bullet.cooldown / (1 + State.level * 0.05)) {
    const v = angleToVector(State.ship.angle);
    State.bullets.push({ x: State.ship.x + v.x * CONFIG.ship.radius, y: State.ship.y + v.y * CONFIG.ship.radius, vx: v.x * CONFIG.bullet.speed, vy: v.y * CONFIG.bullet.speed, life: CONFIG.bullet.life });
    State.lastShotTime = t;
  }

  // Update bullets
  for (const b of State.bullets) {
    b.x = wrap(b.x + b.vx, CONFIG.width);
    b.y = wrap(b.y + b.vy, CONFIG.height);
    b.life -= 1;
  }
  State.bullets = State.bullets.filter(b => b.life > 0);

  // Update asteroids
  for (const a of State.asteroids) {
    a.x = wrap(a.x + a.vx, CONFIG.width);
    a.y = wrap(a.y + a.vy, CONFIG.height);
    a.angle += a.rot;
  }

  // Collisions: bullets vs asteroids
  let correctHit = false;
  for (const b of State.bullets) {
    for (const a of State.asteroids) {
      if (!a.alive) continue;
      if (dist(b.x, b.y, a.x, a.y) < a.size) {
        // hit
        a.alive = false; b.life = 0;
        if (a.isCorrect) {
          State.score += 100 + Math.round(5 * a.size);
          State.hits += 1;
          correctHit = true;
        } else {
          State.score = Math.max(0, State.score - 50);
          State.misses += 1;
        }
      }
    }
  }
  State.asteroids = State.asteroids.filter(a => a.alive);

  // Collisions: ship vs asteroids
  if (State.ship.invuln === 0) {
    for (const a of State.asteroids) {
      if (dist(State.ship.x, State.ship.y, a.x, a.y) < a.size + CONFIG.ship.radius) {
        // ship hit
        State.lives -= 1;
        State.ship = { x: CONFIG.width / 2, y: CONFIG.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invuln: 120 };
        break;
      }
    }
  }

  // Advance immediately when the correct asteroid is hit
  if (correctHit) {
    State.level += 1;
    // Clear remaining decoys and bullets before next wave
    State.asteroids.length = 0;
    State.bullets.length = 0;
    spawnAsteroidsForLevel(State.level);
  }

  // Game over
  if (State.lives <= 0) {
    endGame();
  }

  // Update HUD
  const totalShots = State.hits + State.misses;
  const acc = totalShots ? Math.round((State.hits / totalShots) * 100) : 0;
  hud.score.textContent = String(State.score);
  hud.lives.textContent = String(State.lives);
  hud.hits.textContent = String(State.hits);
  hud.misses.textContent = String(State.misses);
  hud.accuracy.textContent = acc + '%';
}

function drawShip() {
  const s = State.ship;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  ctx.strokeStyle = '#f2a65a';
  ctx.lineWidth = 2;
  // Stylized cowboy hat ship
  ctx.beginPath();
  ctx.moveTo(14, -2);
  ctx.quadraticCurveTo(6, -10, -6, -8);
  ctx.quadraticCurveTo(-12, -2, -16, -2);
  ctx.quadraticCurveTo(-4, 4, 12, 2);
  ctx.quadraticCurveTo(18, 0, 14, -2);
  ctx.stroke();
  // Dust trail when thrusting
  if (State.input.up && (Math.floor(now()/100) % 2 === 0)) {
    ctx.strokeStyle = '#b55239';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-22, 0);
    ctx.stroke();
  }
  // Blink when invulnerable
  if (s.invuln > 0 && Math.floor(s.invuln / 6) % 2 === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.ship.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);
  ctx.strokeStyle = '#ffe9c7';
  ctx.lineWidth = 2;
  // Wanted poster rectangle
  const w = a.size * 1.2;
  const h = a.size * 1.4;
  ctx.fillStyle = 'rgba(249,232,204,0.12)';
  ctx.fillRect(-w/2, -h/2, w, h);
  ctx.strokeRect(-w/2, -h/2, w, h);
  // small torn corners
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/2 + 6); ctx.lineTo(-w/2 + 6, -h/2);
  ctx.moveTo(w/2, h/2 - 6); ctx.lineTo(w/2 - 6, h/2);
  ctx.stroke();

  // label (Chinese)
  ctx.rotate(-a.angle);
  ctx.fillStyle = '#f6d06f';
  ctx.font = '16px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(a.text, 0, 6);
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = '#b55239';
  for (const b of State.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, CONFIG.bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
  // stars
  ctx.fillStyle = 'rgba(255,233,199,0.08)';
  for (let i = 0; i < 80; i++) {
    const x = (i * 123) % CONFIG.width;
    const y = ((i * 234) + Math.floor(now()/30)) % CONFIG.height;
    ctx.fillRect(x, y, 2, 2);
  }
  // faint corral/fence lines
  ctx.strokeStyle = 'rgba(242,166,90,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CONFIG.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.height); ctx.stroke(); }
  for (let y = 0; y < CONFIG.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CONFIG.width, y); ctx.stroke(); }

  drawShip();
  for (const a of State.asteroids) drawAsteroid(a);
  drawBullets();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// ------------------ Overlay ------------------
function showOverlay(html) {
  overlay.innerHTML = `<div class="panel">${html}</div>`;
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; }

function endGame() {
  State.running = false;
  const totalShots = State.hits + State.misses;
  const acc = totalShots ? Math.round((State.hits / totalShots) * 100) : 0;
  showOverlay(`
    <h2>Game Over</h2>
    <div class="row"><span>Level reached</span><span class="big">${State.level}</span></div>
    <div class="row"><span>Score</span><span class="big">${State.score}</span></div>
    <div class="row"><span>Hits</span><span>${State.hits}</span></div>
    <div class="row"><span>Misses</span><span>${State.misses}</span></div>
    <div class="row"><span>Accuracy</span><span class="big ${acc < 60 ? 'bad' : acc < 85 ? 'warn' : ''}">${acc}%</span></div>
    <p>Press Start to try again.</p>
  `);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = false;
}

function showIntro() {
  showOverlay(`
  <h2>AstroLingua</h2>
  <p>Saddle up! Steer your hat-ship and hit the wanted poster with the correct Chinese translation.</p>
    <ul>
      <li>WASD / Arrow keys to move</li>
      <li>Space to shoot</li>
      <li>Upload CSV or JSON vocab: <code>english, chinese</code></li>
    </ul>
    <p>Click Start to begin.</p>
  `);
}

// ------------------ Buttons & Upload ------------------
startBtn.addEventListener('click', () => {
  hideOverlay();
  resetState();
  State.running = true;
  spawnAsteroidsForLevel(State.level);
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resetBtn.disabled = false;
});

pauseBtn.addEventListener('click', () => {
  if (!State.running) return;
  State.paused = !State.paused;
  pauseBtn.textContent = State.paused ? 'Resume' : 'Pause';
});

resetBtn.addEventListener('click', () => {
  hideOverlay();
  resetState();
  showIntro();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
});

upload.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const list = await readVocabFile(file);
    if (list.length) {
      State.vocab = list;
      if (!State.running) hud.target.textContent = 'Vocab loaded! Press Start';
    } else {
      alert('No valid vocab found. Use CSV: english, chinese or JSON array of {"en","zh"}.');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to read vocabulary file.');
  } finally {
    upload.value = '';
  }
});

// ------------------ Boot ------------------
showIntro();
loop();
