const MinigameMemoryScreen = (() => {
  function render(root) {
    const player = GameState.get();
    const loc = ContentEngine.getLocation(player.activeLocationId);
    const figures = ContentEngine.getFiguresByIds(loc.figureIds);

    // Build pairs: name <-> topic, for up to 3 figures (6 cards max, fits 3x2 grid nicely)
    const pool = figures.slice(0, 3);
    let cards = [];
    pool.forEach(f => {
      cards.push({ pairId: f.id, label: f.name, kind: 'name' });
      cards.push({ pairId: f.id, label: f.topic, kind: 'topic' });
    });
    cards = shuffle(cards).map((c, i) => ({ ...c, cardId: i }));

    let flipped = [];
    let matchedPairs = 0;
    let lock = false;

    root.innerHTML = `
      <div class="screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <span></span>
        </div>
        <div class="minigame-header">
          <h1>History Memory</h1>
          <p>Flip two cards to find a matching pair.</p>
        </div>
        <div class="memory-grid" id="grid"></div>
        <p id="feedback" style="text-align:center;min-height:1.5em;font-weight:600;"></p>
      </div>
    `;

    const grid = root.querySelector('#grid');
    const feedback = root.querySelector('#feedback');

    cards.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'memory-card';
      btn.dataset.cardId = c.cardId;
      btn.textContent = '?';
      btn.addEventListener('click', () => {
        if (lock || btn.classList.contains('flipped') || btn.classList.contains('matched')) return;
        btn.classList.add('flipped');
        btn.textContent = c.label;
        flipped.push({ ...c, el: btn });
        if (flipped.length === 2) {
          lock = true;
          setTimeout(checkMatch, 700);
        }
      });
      grid.appendChild(btn);
    });

    function checkMatch() {
      const [a, b] = flipped;
      if (a.pairId === b.pairId) {
        a.el.classList.add('matched');
        b.el.classList.add('matched');
        matchedPairs++;
        feedback.textContent = 'Match! ✨';
        feedback.style.color = 'var(--color-forest)';
        ProgressEngine.awardXP(player, ProgressEngine.XP_PER_CORRECT);
        ProgressEngine.markFigureComplete(player, a.pairId);
        const fig = ContentEngine.getFigure(a.pairId);
        if (fig && fig.badge) ProgressEngine.awardBadge(player, fig.badge);
        root.querySelector('.xp-pill').textContent = `⭐ ${player.xp} XP`;
        if (matchedPairs === pool.length) finish();
      } else {
        a.el.classList.remove('flipped');
        b.el.classList.remove('flipped');
        a.el.textContent = '?';
        b.el.textContent = '?';
        feedback.textContent = 'Not quite - try again!';
        feedback.style.color = '#C0392B';
      }
      flipped = [];
      lock = false;
    }

    function finish() {
      setTimeout(() => {
        const allLocs = ContentEngine.getAllLocationsOrdered();
        const result = ProgressEngine.maybeUnlockNext(player, allLocs, loc.id);
        let msg = 'All matched! Wonderful memory.';
        if (result.worldComplete) msg += ` You completed World ${result.worldComplete}! A new world is unlocked!`;
        else if (result.unlocked) msg += ' A new location is unlocked!';
        feedback.innerHTML = msg;
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn-primary btn-large-tap';
        doneBtn.textContent = 'Back to Map';
        doneBtn.style.marginTop = 'var(--space-3)';
        doneBtn.addEventListener('click', () => ScreenManager.go('world-map'));
        root.querySelector('.screen').appendChild(doneBtn);
      }, 400);
    }

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('location'));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { render };
})();
