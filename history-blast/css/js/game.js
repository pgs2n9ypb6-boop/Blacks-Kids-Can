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
  const SPINNER_CENTER = { x: 175, y: 320 };
  let spinner = null; // { body, constraint, lastAngle, rotationAccum, totalSpins }
  const SPIN_POINTS = 75;

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
    initStarfield();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseLoop();
      else if (state === 'PLAYING') resumeLoop();
    });

    setupFullscreen();
  }

  // ---------- Fullscreen ----------
  // Feature-detected: some browsers (notably iOS Safari on iPhone) don't
  // support the Fullscreen API for regular elements at all. Per spec, we
  // never show a control that won't work - just hide it silently.

  function isFullscreenSupported() {
    const el = document.documentElement;
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      el.requestFullscreen || el.webkitRequestFullscreen
    );
  }

  function isCurrentlyFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    const el = document.getElementById('game-container');
    if (!isCurrentlyFullscreen()) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  function setupFullscreen() {
    const iconBtn = document.getElementById('fullscreen-btn');
    const startBtn = document.getElementById('fullscreen-start-btn');
    if (!isFullscreenSupported()) {
      // Leave both buttons hidden (their default state) and do nothing further.
      return;
    }
    iconBtn.classList.remove('hidden');
    startBtn.classList.remove('hidden');

    const syncIcon = () => {
      const fs = isCurrentlyFullscreen();
      iconBtn.textContent = fs ? '⤢' : '⛶';
      startBtn.textContent = fs ? '⤢ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
      setTimeout(resizeCanvas, 100); // fullscreen transition doesn't always fire 'resize'
    };
    document.addEventListener('fullscreenchange', syncIcon);
    document.addEventListener('webkitfullscreenchange', syncIcon);
    syncIcon();
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

    // Plunger lane floor - WITHOUT this, the ball has nothing to rest on
    // and falls straight through the bottom of the lane under gravity
    // before the player ever gets a chance to launch it. (This was the
    // actual bug behind "holding the plunger does nothing" - the ball was
    // already gone by the time the player touched the screen.)
    parts.push(Bodies.rectangle(
      LANE_X + (TABLE_W - LANE_X) / 2, TABLE_H + WALL / 2, TABLE_W - LANE_X, WALL,
      { isStatic: true }
    ));

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
    buildSpinner();
    buildDrainSensor();
  }

  function buildFlippers() {
    const flipLen = 70;
    const flipThick = 16;

    // Left flipper: pivot positioned well clear of center, so its swept tip
    // never crosses the right flipper's tip (verified numerically - see
    // dev notes). Rest = drooped down-and-out (wide open drain gap when
    // idle); active = swings up-and-in toward center.
    const leftPivot = { x: 95, y: 686 };
    const leftBody = Bodies.rectangle(leftPivot.x + flipLen / 2, leftPivot.y, flipLen, flipThick, {
      chamfer: { radius: flipThick / 2 }, density: 0.02, friction: 0.4, restitution: 0.2
    });
    Body.setAngle(leftBody, 0.85);
    const leftConstraint = Constraint.create({
      pointA: leftPivot, bodyB: leftBody, pointB: { x: -flipLen / 2, y: 0 },
      stiffness: 1, length: 0
    });
    flippers.left = {
      body: leftBody, constraint: leftConstraint,
      restAngle: 0.85, activeAngle: -0.25,
      flipSpeed: 0.5, returnSpeed: 0.18
    };

    // Right flipper: TRUE mirror of the left. The correct mirror angle is
    // simply the negation of the left's angle (verified numerically) - an
    // earlier version of this used a `Math.PI +/- angle` convention which
    // was mathematically wrong and caused the two flippers' tips to cross
    // into an overlapping X shape instead of leaving a gap between them.
    const rightPivot = { x: LANE_X - 95, y: 686 };
    const rightBody = Bodies.rectangle(rightPivot.x - flipLen / 2, rightPivot.y, flipLen, flipThick, {
      chamfer: { radius: flipThick / 2 }, density: 0.02, friction: 0.4, restitution: 0.2
    });
    Body.setAngle(rightBody, -0.85);
    const rightConstraint = Constraint.create({
      pointA: rightPivot, bodyB: rightBody, pointB: { x: flipLen / 2, y: 0 },
      stiffness: 1, length: 0
    });
    flippers.right = {
      body: rightBody, constraint: rightConstraint,
      restAngle: -0.85, activeAngle: 0.25,
      flipSpeed: 0.5, returnSpeed: 0.18
    };

    World.add(world, [leftBody, leftConstraint, rightBody, rightConstraint]);
  }

  function buildBumpers() {
    // Spread across the FULL table height (top, middle-left/right, and
    // lower-center), like a real pinball table, instead of clustering
    // together in one tight band - verified pairwise spacing numerically
    // before committing to these positions.
    const positions = [
      { x: 85, y: 160 }, { x: 265, y: 140 }, { x: 85, y: 460 },
      { x: 265, y: 460 }, { x: 175, y: 560 }
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
    // Spans the FULL main play area width (not just the center) so there's
    // no narrow uncovered strip near the side walls where a ball could also
    // fall through without triggering ball-lost detection.
    drainSensor = Bodies.rectangle(LANE_X / 2, 780, LANE_X, 20, {
      isStatic: true, isSensor: true, label: 'drain'
    });
    World.add(world, drainSensor);
  }

  function buildSpinner() {
    // A free-spinning blade pivoted through its own center, like a classic
    // pinball spinner target. The ball knocks it and it spins with real
    // angular momentum, slowly decaying via frictionAir. Every full rotation
    // scores points, and the light ring around it is driven by this body's
    // actual angle (not a canned animation).
    const body = Bodies.rectangle(SPINNER_CENTER.x, SPINNER_CENTER.y, 66, 7, {
      density: 0.006, friction: 0, frictionAir: 0.012, restitution: 0.3,
      label: 'spinner'
    });
    const constraint = Constraint.create({
      pointA: SPINNER_CENTER, bodyB: body, pointB: { x: 0, y: 0 },
      stiffness: 1, length: 0
    });
    spinner = { body, constraint, lastAngle: body.angle, rotationAccum: 0 };
    World.add(world, [body, constraint]);
  }

  function updateSpinner() {
    if (!spinner) return;
    const delta = spinner.body.angle - spinner.lastAngle;
    spinner.lastAngle = spinner.body.angle;
    spinner.rotationAccum += Math.abs(delta);
    while (spinner.rotationAccum >= Math.PI * 2) {
      spinner.rotationAccum -= Math.PI * 2;
      score += SPIN_POINTS;
      updateHUD();
    }
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
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('pressed'); onDown(e); }, { passive: false });
      el.addEventListener('pointerup', (e) => { el.classList.remove('pressed'); onUp(e); });
      el.addEventListener('pointercancel', (e) => { el.classList.remove('pressed'); onUp(e); });
      el.addEventListener('pointerleave', (e) => { el.classList.remove('pressed'); onUp(e); });
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
    if (spinner) {
      Body.setAngularVelocity(spinner.body, 0);
      spinner.rotationAccum = 0;
    }
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
      updateSpinner();
    }
    render();
  }

  // ---------- Visual table art (drawn to match the physics geometry) ----------

  let stars = [];
  let glowBlooms = [];
  function initStarfield() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * TABLE_W,
        y: Math.random() * TABLE_H,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.5 + 0.15
      });
    }
    glowBlooms = [
      { x: 60, y: 90, r: 70, a: 0.12 },
      { x: 300, y: 500, r: 60, a: 0.10 },
      { x: 250, y: 620, r: 50, a: 0.08 }
    ];
  }

  function drawBackground() {
    // Warmer violet/purple palette, closer to Space Cadet's saturated
    // blue-violet table color instead of the flatter navy/indigo before.
    const bgGrad = ctx.createRadialGradient(TABLE_W / 2, TABLE_H * 0.32, 30, TABLE_W / 2, TABLE_H * 0.55, TABLE_H * 0.95);
    bgGrad.addColorStop(0, '#3d2f7a');
    bgGrad.addColorStop(0.55, '#251a52');
    bgGrad.addColorStop(1, '#0d0824');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);

    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fill();
    });

    // A few soft magenta/pink glow blooms scattered around, echoing the
    // pink starburst highlights visible on the reference table.
    glowBlooms.forEach(g => {
      const rad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      rad.addColorStop(0, `rgba(255,120,180,${g.a})`);
      rad.addColorStop(1, 'rgba(255,120,180,0)');
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // plunger lane tint
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(LANE_X, 0, TABLE_W - LANE_X, TABLE_H);
  }

  function chromeStroke(widthPx) {
    const g = ctx.createLinearGradient(0, 0, widthPx, 0);
    g.addColorStop(0, '#8f95a8');
    g.addColorStop(0.5, '#f4f6fa');
    g.addColorStop(1, '#6b7180');
    return g;
  }

  function drawRails() {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Outer table border
    ctx.strokeStyle = chromeStroke(TABLE_W);
    ctx.lineWidth = WALL;
    ctx.strokeRect(WALL / 2, WALL / 2, TABLE_W - WALL, TABLE_H - WALL);

    // Plunger lane divider (matches the two static wall segments, with the
    // launch-feed gap left visibly open between them)
    ctx.beginPath();
    ctx.moveTo(LANE_X, 0);
    ctx.lineTo(LANE_X, plungerLaneGapY.top);
    ctx.moveTo(LANE_X, plungerLaneGapY.bottom);
    ctx.lineTo(LANE_X, TABLE_H);
    ctx.strokeStyle = chromeStroke(TABLE_W);
    ctx.lineWidth = WALL * 0.85;
    ctx.stroke();

    // Little arrow marking the feed gap, since it's the one visually "open" spot
    ctx.fillStyle = 'rgba(242,183,5,0.55)';
    ctx.beginPath();
    ctx.moveTo(LANE_X - 8, plungerLaneGapY.top + (plungerLaneGapY.bottom - plungerLaneGapY.top) / 2);
    ctx.lineTo(LANE_X + 6, plungerLaneGapY.top + (plungerLaneGapY.bottom - plungerLaneGapY.top) / 2 - 8);
    ctx.lineTo(LANE_X + 6, plungerLaneGapY.top + (plungerLaneGapY.bottom - plungerLaneGapY.top) / 2 + 8);
    ctx.closePath();
    ctx.fill();

    // Kicker slingshots above the flippers - drawn as bold yellow triangles,
    // matching the reference table's signature look (previously these were
    // subtle chrome-outlined guides, easy to miss).
    ctx.beginPath();
    ctx.moveTo(70, 700); ctx.lineTo(160, 700); ctx.lineTo(70, 790);
    ctx.closePath();
    const kickerGradL = ctx.createLinearGradient(70, 700, 160, 790);
    kickerGradL.addColorStop(0, '#fff3c4');
    kickerGradL.addColorStop(1, '#e0a600');
    ctx.fillStyle = kickerGradL;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(LANE_X - 70, 700); ctx.lineTo(LANE_X - 70, 790); ctx.lineTo(LANE_X - 160, 700);
    ctx.closePath();
    const kickerGradR = ctx.createLinearGradient(LANE_X - 160, 700, LANE_X - 70, 790);
    kickerGradR.addColorStop(0, '#e0a600');
    kickerGradR.addColorStop(1, '#fff3c4');
    ctx.fillStyle = kickerGradR;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function drawDecorativeArrows() {
    // Small yellow directional arrows scattered around, purely cosmetic -
    // echoes the reference table's little yellow arrow accents.
    const arrows = [
      { x: 40, y: 500, angle: 0.3 },
      { x: 320, y: 250, angle: Math.PI + 0.3 },
      { x: 30, y: 620, angle: -0.2 }
    ];
    arrows.forEach(a => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.beginPath();
      ctx.moveTo(-5, -6); ctx.lineTo(6, 0); ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(242,183,5,0.65)';
      ctx.fill();
      ctx.restore();
    });
  }

  function drawOrbitRing() {
    // Light ring around the spinner - rotation now driven by the spinner's
    // REAL physics angle, not a canned time-based animation.
    const cx = SPINNER_CENTER.x, cy = SPINNER_CENTER.y, r = 46;
    const angle = spinner ? spinner.body.angle : 0;
    const speed = spinner ? Math.abs(spinner.body.angularVelocity) : 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + angle;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      // brighter when the spinner is actually spinning fast
      const brightness = Math.min(0.35 + speed * 1.5, 1);
      ctx.fillStyle = `rgba(242,183,5,${brightness})`;
      ctx.fill();
    }
  }

  function drawSpinner() {
    if (!spinner) return;
    const { x, y } = spinner.body.position;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spinner.body.angle);
    const grad = ctx.createLinearGradient(-33, 0, 33, 0);
    grad.addColorStop(0, '#2A2060');
    grad.addColorStop(0.5, '#8f95ff');
    grad.addColorStop(1, '#2A2060');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-33, -3.5, 66, 7, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // small hub cap at the pivot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#F2B705';
    ctx.fill();
  }

  function drawBumper(b) {
    const { x, y } = b.position;
    const r = 22;

    // outer glow
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.8);
    glow.addColorStop(0, b.historyTarget.color + 'aa');
    glow.addColorStop(1, b.historyTarget.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // body with radial shading for a domed look
    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    body.addColorStop(0, lighten(b.historyTarget.color, 40));
    body.addColorStop(1, b.historyTarget.color);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    // Gem-cut facet lines, like a cut jewel catching light - gives the
    // bumpers a sparkle instead of a flat painted-circle look.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4);
      ctx.stroke();
    }
    ctx.restore();

    // Bright sparkle highlight (small white dot, upper-left of center)
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    // rim ring
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '19px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.historyTarget.emoji, x, y + 1);
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 0xff) + amt);
    const b = Math.min(255, (n & 0xff) + amt);
    return `rgb(${r},${g},${b})`;
  }

  function drawFlipper(f) {
    ctx.save();
    ctx.translate(f.body.position.x, f.body.position.y);
    ctx.rotate(f.body.angle);
    const w = 78, h = 16;
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, '#fff3c4');
    grad.addColorStop(0.5, '#F2B705');
    grad.addColorStop(1, '#b5820a');
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    if (!ball) return;
    const { x, y } = ball.position;
    const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#c9c4d8');
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, TABLE_W, TABLE_H);
    drawBackground();
    drawRails();
    drawDecorativeArrows();
    drawOrbitRing();
    drawSpinner();
    bumpers.forEach(drawBumper);
    [flippers.left, flippers.right].forEach(f => { if (f) drawFlipper(f); });
    drawBall();

    // plunger charge meter
    if (plungerCharging) {
      const held = performance.now() - plungerChargeStart;
      const power = Math.min(held / PLUNGER_MAX_CHARGE_MS, 1);
      const meterH = 120 * power;
      const grad = ctx.createLinearGradient(0, 760 - meterH, 0, 760);
      grad.addColorStop(0, '#ffd27a');
      grad.addColorStop(1, '#E8622C');
      ctx.fillStyle = grad;
      ctx.fillRect(LANE_X + 14, 760 - meterH, 16, meterH);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(LANE_X + 14, 640, 16, 120);
    }
  }

  return { init, startGame, toggleFullscreen };
})();
