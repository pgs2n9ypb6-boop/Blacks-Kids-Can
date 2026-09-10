/* HISTORY BLAST - core gameplay loop
   Physics: Matter.js (loaded via CDN in index.html)
   Logical table resolution: 400 x 800 (portrait), scaled to fit any viewport.
   This is the CORE LOOP pass: table, ball physics, flippers, plunger,
   scoring, and a handful of history targets. Audio, haptics, PWA/offline,
   and achievement/collection screens are NOT part of this pass.
*/

const HistoryBlast = (() => {
  const { Engine, World, Bodies, Body, Constraint, Events, Composite, Vector } = Matter;

  const TABLE_W = 400;
  const TABLE_H = 800;
  const LANE_X = 350; // plunger lane starts here
  const WALL = 12;

  let engine, world;
  let canvas, ctx;
  let ball = null;
  let flippers = {};
  let bumpers = [];
  let drainSensor = null;
  let plungerLaneGapY = { top: 90, bottom: 160 }; // opening where lane feeds into table

  let state = 'START'; // START | PLAYING | PAUSED | GAME_OVER
  let score = 0;
  let ballsLeft = 3;
  let combo = 0;
  let comboTimer = 0;
  let discoveries = new Set();

  let leftPressed = false;
  let rightPressed = false;
  let plungerCharging = false;
  let plungerCharge = 0; // 0..1
  const PLUNGER_MAX_CHARGE_MS = 900;
  let plungerChargeStart = 0;

  let scaleFactor = 1;
  let lastFrameTime = 0;
  let rafId = null;

  // ---------- Setup ----------

  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 150));

    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1.1;

    buildTable();
    wireControls();
    wireCollisions();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseLoop();
      else if (state === 'PLAYING') resumeLoop();
    });
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = TABLE_W / TABLE_H;
    let cssW, cssH;
    if (vw / vh > aspect) {
      cssH = vh;
      cssW = vh * aspect;
    } else {
      cssW = vw;
      cssH = vw / aspect;
    }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scaleFactor = (cssW * dpr) / TABLE_W;
    ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
  }

  function buildTable() {
    const parts = [];

    // Outer walls (static)
    parts.push(Bodies.rectangle(TABLE_W / 2, -WALL / 2, TABLE_W, WALL, { isStatic: true })); // top
    parts.push(Bodies.rectangle(-WALL / 2, TABLE_H / 2, WALL, TABLE_H, { isStatic: true })); // left
    parts.push(Bodies.rectangle(TABLE_W + WALL / 2, TABLE_H / 2, WALL, TABLE_H, { isStatic: true })); // right

    // Plunger lane divider wall, with a gap near the top so a launched ball
    // can roll out of the lane into the main play area.
    const laneWallTopH = plungerLaneGapY.top;
    const laneWallBottomY = plungerLaneGapY.bottom;
    const laneWallBottomH = TABLE_H - laneWallBottomY;
    parts.push(Bodies.rectangle(LANE_X, laneWallTopH / 2, WALL, laneWallTopH, { isStatic: true, render: {} }));
    parts.push(Bodies.rectangle(LANE_X, laneWallBottomY + laneWallBottomH / 2, WALL, laneWallBottomH, { isStatic: true }));

    // Angled funnel walls near the bottom, guiding the ball toward the flipper gap
    parts.push(Bodies.fromVertices(70, 700, [[
      { x: 0, y: 0 }, { x: 90, y: 0 }, { x: 0, y: 90 }
    ]], { isStatic: true }, true));
    parts.push(Bodies.fromVertices(LANE_X - 70, 700, [[
      { x: 0, y: 0 }, { x: 0, y: 90 }, { x: 90, y: 0 }
    ]], { isStatic: true }, true));

    World.add(world, parts);

    buildFlippers();
    buildBumpers();
    buildDrainSensor();
  }

  function buildFlippers() {
    const flipLen = 78;
    const flipThick = 16;

    // Left flipper: pivot near bottom-left of the main gap
    const leftPivot = { x: 118, y: 686 };
    const leftBody = Bodies.rectangle(leftPivot.x + flipLen / 2, leftPivot.y, flipLen, flipThick, {
      chamfer: { radius: flipThick / 2 }, density: 0.02, friction: 0.4, restitution: 0.2
    });
    Body.setAngle(leftBody, 0.55);
    const leftConstraint = Constraint.create({
      pointA: leftPivot, bodyB: leftBody, pointB: { x: -flipLen / 2, y: 0 },
      stiffness: 1, length: 0
    });
    flippers.left = {
      body: leftBody, constraint: leftConstraint,
      restAngle: 0.55, activeAngle: -0.55,
      flipSpeed: 0.5, returnSpeed: 0.18
    };

    // Right flipper: mirrored
    const rightPivot = { x: LANE_X - 118, y: 686 };
    const rightBody = Bodies.rectangle(rightPivot.x - flipLen / 2, rightPivot.y, flipLen, flipThick, {
      chamfer: { radius: flipThick / 2 }, density: 0.02, friction: 0.4, restitution: 0.2
    });
    Body.setAngle(rightBody, Math.PI - 0.55);
    const rightConstraint = Constraint.create({
      pointA: rightPivot, bodyB: rightBody, pointB: { x: flipLen / 2, y: 0 },
      stiffness: 1, length: 0
    });
    flippers.right = {
      body: rightBody, constraint: rightConstraint,
      restAngle: Math.PI - 0.55, activeAngle: Math.PI + 0.55,
      flipSpeed: 0.5, returnSpeed: 0.18
    };

    World.add(world, [leftBody, leftConstraint, rightBody, rightConstraint]);
  }

  function buildBumpers() {
    const positions = [
      { x: 90, y: 220 }, { x: 260, y: 180 }, { x: 175, y: 320 },
      { x: 80, y: 420 }, { x: 260, y: 420 }
    ];
    bumpers = positions.map((pos, i) => {
      const target = HISTORY_TARGETS[i % HISTORY_TARGETS.length];
      const body = Bodies.circle(pos.x, pos.y, 22, {
        isStatic: true, restitution: 1.3, label: 'bumper:' + target.id
      });
      body.historyTarget = target;
      World.add(world, body);
      return body;
    });
  }

  function buildDrainSensor() {
    drainSensor = Bodies.rectangle(LANE_X / 2, 780, LANE_X - 40, 20, {
      isStatic: true, isSensor: true, label: 'drain'
    });
    World.add(world, drainSensor);
  }

  // ---------- Ball ----------

  function spawnBall() {
    if (ball) World.remove(world, ball);
    ball = Bodies.circle(TABLE_W - 25, 720, 10, {
      restitution: 0.55, friction: 0.02, frictionAir: 0.0008, density: 0.04, label: 'ball'
    });
    World.add(world, ball);
  }

  function launchBall(power) {
    if (!ball) return;
    const force = -0.09 - power * 0.11; // negative y = upward
    Body.setVelocity(ball, { x: 0, y: force * 22 });
  }

  // ---------- Controls ----------

  function wireControls() {
    const leftZone = document.getElementById('flipper-left-zone');
    const rightZone = document.getElementById('flipper-right-zone');
    const plungerZone = document.getElementById('plunger-zone');

    const bind = (el, onDown, onUp) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onUp);
    };

    bind(leftZone, () => { leftPressed = true; }, () => { leftPressed = false; });
    bind(rightZone, () => { rightPressed = true; }, () => { rightPressed = false; });

    bind(plungerZone,
      () => { plungerCharging = true; plungerChargeStart = performance.now(); },
      () => {
        if (plungerCharging) {
          const held = performance.now() - plungerChargeStart;
          const power = Math.min(held / PLUNGER_MAX_CHARGE_MS, 1);
          plungerCharging = false;
          plungerCharge = 0;
          if (state === 'PLAYING') launchBall(power);
        }
      }
    );

    // Keyboard support for desktop (secondary, per spec priority)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyZ') leftPressed = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyM') rightPressed = true;
      if (e.code === 'Space') { plungerCharging = true; plungerChargeStart = performance.now(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyZ') leftPressed = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyM') rightPressed = false;
      if (e.code === 'Space' && plungerCharging) {
        const held = performance.now() - plungerChargeStart;
        const power = Math.min(held / PLUNGER_MAX_CHARGE_MS, 1);
        plungerCharging = false;
        if (state === 'PLAYING') launchBall(power);
      }
    });
  }

  function updateFlipper(f) {
    const pressed = f === flippers.left ? leftPressed : rightPressed;
    const target = pressed ? f.activeAngle : f.restAngle;
    const diff = target - f.body.angle;
    if (Math.abs(diff) < 0.02) {
      Body.setAngularVelocity(f.body, 0);
      Body.setAngle(f.body, target);
    } else {
      const speed = pressed ? f.flipSpeed : f.returnSpeed;
      Body.setAngularVelocity(f.body, Math.sign(diff) * speed);
    }
  }

  // ---------- Collisions ----------

  function wireCollisions() {
    Events.on(engine, 'collisionStart', (evt) => {
      evt.pairs.forEach((pair) => {
        const bodies = [pair.bodyA, pair.bodyB];
        const ballBody = bodies.find(b => b.label === 'ball');
        if (!ballBody) return;
        const other = bodies.find(b => b !== ballBody);
        if (!other) return;

        if (other.label && other.label.startsWith('bumper:')) {
          onBumperHit(other, ballBody);
        } else if (other.label === 'drain') {
          onDrain();
        }
      });
    });
  }

  function onBumperHit(bumperBody, ballBody) {
    const t = bumperBody.historyTarget;
    combo += 1;
    comboTimer = 2500;
    const multiplier = Math.min(1 + (combo - 1) * 0.5, 4);
    const points = Math.round(t.xp * multiplier);
    score += points;

    // Give the ball a satisfying kick away from the bumper (classic pinball feel)
    const dir = Vector.normalise(Vector.sub(ballBody.position, bumperBody.position));
    Body.setVelocity(ballBody, Vector.mult(dir, 9));

    const firstTime = !discoveries.has(t.id);
    discoveries.add(t.id);
    showFactCard(t, points, firstTime);
    updateHUD();
  }

  function onDrain() {
    if (!ball || state !== 'PLAYING') return;
    World.remove(world, ball);
    ball = null;
    ballsLeft -= 1;
    combo = 0;
    updateHUD();
    if (ballsLeft <= 0) {
      endGame();
    } else {
      spawnBall();
    }
  }

  // ---------- Game flow ----------

  function startGame() {
    score = 0;
    ballsLeft = 3;
    combo = 0;
    discoveries = new Set();
    state = 'PLAYING';
    updateHUD();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
    spawnBall();
    resumeLoop();
  }

  function endGame() {
    state = 'GAME_OVER';
    document.getElementById('final-score').textContent = score.toLocaleString();
    document.getElementById('final-discoveries').textContent = discoveries.size;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('controls').classList.add('hidden');
  }

  function updateHUD() {
    document.getElementById('score-display').textContent = score.toLocaleString();
    document.getElementById('balls-display').textContent = ballsLeft;
    document.getElementById('combo-display').textContent = combo > 1 ? `${Math.min(1 + (combo - 1) * 0.5, 4)}X` : '';
  }

  function showFactCard(target, points, firstTime) {
    const card = document.getElementById('fact-card');
    card.innerHTML = `
      <div class="fact-card-inner">
        <div class="fact-emoji">${target.emoji}</div>
        <div class="fact-name">${target.name}</div>
        <div class="fact-text">${target.fact}</div>
        <div class="fact-xp">+${points.toLocaleString()} HISTORY XP${firstTime ? ' &middot; NEW!' : ''}</div>
      </div>
    `;
    card.classList.remove('hidden');
    card.classList.add('show');
    clearTimeout(card._hideTimer);
    card._hideTimer = setTimeout(() => {
      card.classList.remove('show');
      setTimeout(() => card.classList.add('hidden'), 250);
    }, 2200);
  }

  // ---------- Loop ----------

  function pauseLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function resumeLoop() {
    if (rafId) return;
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(now - lastFrameTime, 33);
    lastFrameTime = now;

    if (state === 'PLAYING') {
      updateFlipper(flippers.left);
      updateFlipper(flippers.right);
      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) { combo = 0; updateHUD(); }
      }
      Engine.update(engine, dt);
    }
    render();
  }

  function render() {
    ctx.clearRect(0, 0, TABLE_W, TABLE_H);

    // table background
    ctx.fillStyle = '#0F0B2E';
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);

    // plunger lane
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(LANE_X, 0, TABLE_W - LANE_X, TABLE_H);

    // bumpers
    bumpers.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = b.historyTarget.color;
      ctx.fill();
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.historyTarget.emoji, b.position.x, b.position.y);
    });

    // flippers
    [flippers.left, flippers.right].forEach(f => {
      if (!f) return;
      ctx.save();
      ctx.translate(f.body.position.x, f.body.position.y);
      ctx.rotate(f.body.angle);
      ctx.fillStyle = '#F2B705';
      const w = 78, h = 16;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      ctx.restore();
    });

    // ball
    if (ball) {
      ctx.beginPath();
      ctx.arc(ball.position.x, ball.position.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FBF3E7';
      ctx.fill();
    }

    // plunger charge meter
    if (plungerCharging) {
      const held = performance.now() - plungerChargeStart;
      const power = Math.min(held / PLUNGER_MAX_CHARGE_MS, 1);
      const meterH = 120 * power;
      ctx.fillStyle = '#E8622C';
      ctx.fillRect(LANE_X + 14, 760 - meterH, 16, meterH);
    }
  }

  return { init, startGame };
})();
