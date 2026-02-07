(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);

  // Game state
  const state = {
    running: false,
    score: 0,
    lives: 3,
    bullets: [],
    enemies: [],
    particles: [],
    stars: [],
    keys: {},
    lastSpawn: 0,
    spawnInterval: 900,
    lastTime: 0,
    player: { x: 0, w: 56, h: 18, speed: 420 },
    gameOver: false,
    assets: {}
  };

  const elScore = document.getElementById('score');
  const elLives = document.getElementById('lives');
  const btnStart = document.getElementById('startBtn');

  // helper: create image from SVG string
  function svgToImage(svg) {
    const img = new Image();
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return img;
  }

  // generate simple sprites (SVG) so we don't need external assets
  function makeAssets() {
    const playerSvg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'>
        <defs>
          <linearGradient id='g' x1='0' x2='1'>
            <stop offset='0' stop-color='#4EE0A4'/>
            <stop offset='1' stop-color='#2CB67D'/>
          </linearGradient>
          <filter id='s' x='-50%' y='-50%' width='200%' height='200%'>
            <feDropShadow dx='0' dy='2' stdDeviation='4' flood-color='#000' flood-opacity='0.4'/>
          </filter>
        </defs>
        <g filter='url(#s)'>
          <polygon points='60,8 14,64 106,64' fill='url(#g)' />
          <rect x='48' y='54' width='24' height='6' rx='3' fill='#074C3B' />
        </g>
      </svg>`;

    const enemySvg = (c = '#FF6B6B') => `
      <svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
        <defs>
          <radialGradient id='e' cx='50%' cy='35%'>
            <stop offset='0' stop-color='white' stop-opacity='0.9'/>
            <stop offset='1' stop-color='${c}' stop-opacity='1'/>
          </radialGradient>
        </defs>
        <circle cx='40' cy='32' r='22' fill='url(#e)' />
        <rect x='24' y='46' width='32' height='8' rx='4' fill='#222' opacity='0.25' />
      </svg>`;

    const bulletSvg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'>
        <circle cx='10' cy='10' r='6' fill='#FFD166'/>
      </svg>`;

    state.assets.player = svgToImage(playerSvg);
    state.assets.bullet = svgToImage(bulletSvg);
    state.assets.enemyRed = svgToImage(enemySvg('#FF6B6B'));
    state.assets.enemyPurple = svgToImage(enemySvg('#C084FC'));
    state.assets.enemyBlue = svgToImage(enemySvg('#60A5FA'));
  }

  function initStars() {
    state.stars = [];
    const count = Math.max(60, Math.floor(canvas.clientWidth / 8));
    for (let i = 0; i < count; i++) {
      state.stars.push({ x: Math.random() * canvas.clientWidth, y: Math.random() * canvas.clientHeight, r: Math.random() * 1.6 + 0.3, speed: Math.random() * 20 + 10, alpha: Math.random() * 0.8 + 0.2 });
    }
  }

  function startGame() {
    state.running = true;
    state.score = 0;
    state.lives = 3;
    state.bullets = [];
    state.enemies = [];
    state.particles = [];
    state.spawnInterval = 900;
    state.lastSpawn = 0;
    state.gameOver = false;
    elScore.textContent = '0';
    elLives.textContent = '3';
    resize();
    state.player.x = canvas.clientWidth / 2;
    initStars();
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  btnStart.addEventListener('click', startGame);

  // Input
  window.addEventListener('keydown', e => (state.keys[e.code] = true));
  window.addEventListener('keyup', e => (state.keys[e.code] = false));
  canvas.addEventListener('click', e => shoot());

  function shoot() {
    if (!state.running || state.gameOver) return;
    state.bullets.push({ x: state.player.x, y: canvas.clientHeight - 82, r: 6, speed: 900 });
  }

  function spawnEnemy() {
    const pw = canvas.clientWidth;
    const x = Math.random() * (pw - 80) + 40;
    const speed = 60 + Math.random() * 140 + state.score * 0.4;
    const types = [state.assets.enemyRed, state.assets.enemyPurple, state.assets.enemyBlue];
    const img = types[Math.floor(Math.random() * types.length)];
    state.enemies.push({ x, y: -40, r: 24, speed, img });
  }

  function spawnParticles(x, y, color) {
    const n = 14 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 220 + 60;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9 + Math.random() * 0.6, color });
    }
  }

  function loop(ts) {
    const dt = Math.min(50, ts - state.lastTime) / 1000;
    state.lastTime = ts;
    update(dt);
    render();
    if (state.running && !state.gameOver) requestAnimationFrame(loop);
  }

  function update(dt) {
    const move = (state.keys['ArrowLeft'] ? -1 : 0) + (state.keys['ArrowRight'] ? 1 : 0);
    const px = state.player.x + move * state.player.speed * dt;
    state.player.x = Math.min(Math.max(state.player.w / 2, px), canvas.clientWidth - state.player.w / 2);

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.y -= b.speed * dt;
      if (b.y < -20) state.bullets.splice(i, 1);
    }

    state.lastSpawn += dt * 1000;
    if (state.lastSpawn > state.spawnInterval) {
      state.lastSpawn = 0;
      spawnEnemy();
      if (state.spawnInterval > 300) state.spawnInterval *= 0.993;
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      e.y += e.speed * dt;
      if (e.y > canvas.clientHeight - 60) {
        state.enemies.splice(i, 1);
        state.lives -= 1;
        elLives.textContent = state.lives;
        spawnParticles(e.x, canvas.clientHeight - 72, '#FFB4B4');
        if (state.lives <= 0) { state.gameOver = true; showGameOver(); }
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
          const color = '#ff8b8b';
          spawnParticles(e.x, e.y, color);
          state.enemies.splice(i, 1);
          state.bullets.splice(j, 1);
          state.score += 10;
          elScore.textContent = state.score;
          break;
        }
      }
    }

    // particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // stars
    for (let s of state.stars) {
      s.y += (s.speed * 0.5) * dt;
      if (s.y > canvas.clientHeight) s.y = -2;
    }
  }

  function showGameOver() { btnStart.textContent = 'Restart'; }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // convert client coords
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    // background stars
    ctx.fillStyle = '#061321';
    ctx.fillRect(0, 0, W, H);
    for (let s of state.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // subtle gradient overlay
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,18,30,0.0)');
    g.addColorStop(1, 'rgba(3,7,12,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // player
    const px = state.player.x;
    const py = H - 60;
    if (state.assets.player.complete) {
      const sw = 80; const sh = 60;
      ctx.drawImage(state.assets.player, px - sw / 2, py - sh / 2, sw, sh);
    } else {
      ctx.fillStyle = '#4ee0a4';
      ctx.beginPath(); ctx.moveTo(px, py - 18); ctx.lineTo(px - state.player.w / 2, py + state.player.h); ctx.lineTo(px + state.player.w / 2, py + state.player.h); ctx.closePath(); ctx.fill();
    }

    // bullets
    for (let b of state.bullets) {
      if (state.assets.bullet.complete) ctx.drawImage(state.assets.bullet, b.x - 8, b.y - 8, 16, 16);
      else { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); }
    }

    // enemies
    for (let e of state.enemies) {
      if (e.img && e.img.complete) ctx.drawImage(e.img, e.x - 28, e.y - 28, 56, 56);
      else { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill(); }
    }

    // particles
    for (let p of state.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color || '#ff8b8b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // overlay when not running
    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    }

    if (state.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '28px system-ui, Arial'; ctx.fillText('Game Over', W/2, H/2 - 20);
      ctx.font = '18px system-ui, Arial'; ctx.fillText('Score: ' + state.score, W/2, H/2 + 12);
    }
  }

  // initialize
  function init() {
    resize();
    makeAssets();
    state.player.x = canvas.clientWidth / 2;
    initStars();
    // touch controls
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      const w = canvas.clientWidth;
      state.keys['ArrowLeft'] = t.clientX < w / 2;
      state.keys['ArrowRight'] = t.clientX > w / 2;
      shoot(); e.preventDefault();
    }, {passive:false});
    canvas.addEventListener('touchend', e => { state.keys['ArrowLeft']=false; state.keys['ArrowRight']=false; }, {passive:true});
  }

  init();
})();
