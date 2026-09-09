const MinigameMatchScreen = (() => {
  function render(root) {
    const player = GameState.get();
    const loc = ContentEngine.getLocation(player.activeLocationId);
    const figures = ContentEngine.getFiguresByIds(loc.figureIds);

    const names = shuffle(figures.map(f => ({ id: f.id, label: f.name })));
    const topics = shuffle(figures.map(f => ({ id: f.id, label: f.topic })));

    let selectedName = null;
    let matchedCount = 0;

    root.innerHTML = `
      <div class="screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <span></span>
        </div>
        <div class="minigame-header">
          <h1>Match the Person</h1>
          <p>Tap a name, then tap what they're known for.</p>
        </div>
        <div class="match-row">
          <div class="match-col" id="name-col"></div>
          <div class="match-col" id="topic-col"></div>
        </div>
        <p id="feedback" style="text-align:center;min-height:1.5em;font-weight:600;"></p>
      </div>
    `;

    const nameCol = root.querySelector('#name-col');
    const topicCol = root.querySelector('#topic-col');
    const feedback = root.querySelector('#feedback');

    names.forEach(n => {
      const btn = document.createElement('button');
      btn.className = 'match-item';
      btn.textContent = n.label;
      btn.dataset.id = n.id;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('correct')) return;
        nameCol.querySelectorAll('.match-item').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedName = n.id;
      });
      nameCol.appendChild(btn);
    });

    topics.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'match-item';
      btn.textContent = t.label;
      btn.dataset.id = t.id;
      btn.addEventListener('click', () => {
        if (!selectedName || btn.classList.contains('correct')) return;
        const nameBtn = nameCol.querySelector(`.match-item[data-id="${selectedName}"]`);
        if (t.id === selectedName) {
          btn.classList.add('correct');
          nameBtn.classList.add('correct');
          feedback.textContent = 'Correct! ✨';
          feedback.style.color = 'var(--color-forest)';
          ProgressEngine.awardXP(player, ProgressEngine.XP_PER_CORRECT);
          ProgressEngine.markFigureComplete(player, t.id);
          const fig = ContentEngine.getFigure(t.id);
          if (fig && fig.badge) ProgressEngine.awardBadge(player, fig.badge);
          matchedCount++;
          selectedName = null;
          root.querySelector('.xp-pill').textContent = `⭐ ${player.xp} XP`;
          if (matchedCount === names.length) finish();
        } else {
          btn.classList.add('wrong');
          feedback.textContent = 'Try again!';
          feedback.style.color = '#C0392B';
          setTimeout(() => btn.classList.remove('wrong'), 500);
        }
      });
      topicCol.appendChild(btn);
    });

    function finish() {
      setTimeout(() => {
        const loc2 = ContentEngine.getLocation(player.activeLocationId);
        const allLocs = ContentEngine.getAllLocationsOrdered();
        const result = ProgressEngine.maybeUnlockNext(player, allLocs, loc2.id);
        let msg = 'All matched! Great work.';
        if (result.worldComplete) msg += ` You completed World ${result.worldComplete}! A new world is unlocked!`;
        else if (result.unlocked) msg += ' A new location is unlocked!';
        feedback.innerHTML = msg;
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn-primary btn-large-tap';
        doneBtn.textContent = 'Back to Map';
        doneBtn.style.marginTop = 'var(--space-3)';
        doneBtn.addEventListener('click', () => ScreenManager.go('world-map'));
        root.querySelector('.screen').appendChild(doneBtn);
      }, 600);
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
