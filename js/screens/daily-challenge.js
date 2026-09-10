const DailyChallengeScreen = (() => {
  function render(root) {
    const player = GameState.get();
    const status = ProgressEngine.recordDailyChallenge.name ? null : null;
    const today = new Date().toDateString();
    const alreadyDoneToday = player.lastDailyDate === today;

    root.innerHTML = `
      <div class="screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <span></span>
        </div>
        <div class="minigame-header">
          <h1>Daily Challenge 🔥</h1>
          <span class="streak-badge">${player.dailyStreak} day streak</span>
        </div>
        <div class="daily-card" id="daily-card"></div>
      </div>
    `;

    const card = root.querySelector('#daily-card');

    if (alreadyDoneToday) {
      card.innerHTML = `
        <p style="font-size:1.2rem;">You've already completed today's challenge. Come back tomorrow for a new one!</p>
        <button class="btn-primary btn-large-tap" id="map-btn" style="margin-top:var(--space-2);">Back to Map</button>
      `;
      card.querySelector('#map-btn').addEventListener('click', () => ScreenManager.go('world-map'));
      root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('world-map'));
      return;
    }

    const challenge = ContentEngine.getRandomChallenge([], player.ageLevel || '5-8');
    renderChallenge(card, challenge, player);

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('world-map'));
  }

  function renderChallenge(card, challenge, player) {
    let options = [];
    if (challenge.type === 'truefalse') {
      options = [
        { label: 'True', value: true },
        { label: 'False', value: false }
      ];
    } else if (challenge.type === 'multiplechoice') {
      options = challenge.options.map(o => ({ label: o, value: o }));
    } else {
      // Unknown/unsupported challenge type for this screen - don't fake a
      // single always-correct option. Skip to a fresh challenge instead.
      const fallback = ContentEngine.getRandomChallenge([challenge.id], player.ageLevel || '5-8');
      if (fallback && fallback.id !== challenge.id) {
        renderChallenge(card, fallback, player);
      }
      return;
    }

    card.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:8px;">${challenge.icon || '🌍'}</div>
      <h2 style="margin-bottom:var(--space-2);">${challenge.question}</h2>
      <div id="options"></div>
      <p id="explain" style="margin-top:var(--space-2);min-height:1.5em;"></p>
    `;

    const optionsEl = card.querySelector('#options');
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        if (btn.dataset.answered) return;
        const isCorrect = opt.value === challenge.answer;
        card.querySelectorAll('.choice-btn').forEach(b => b.dataset.answered = 'true');
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
        const explainEl = card.querySelector('#explain');
        explainEl.textContent = challenge.explanation;

        if (isCorrect) {
          ProgressEngine.awardXP(player, ProgressEngine.XP_PER_CORRECT);
        }
        ProgressEngine.recordDailyChallenge(player);

        if (!card.querySelector('#daily-done-btn')) {
          const doneBtn = document.createElement('button');
          doneBtn.id = 'daily-done-btn';
          doneBtn.className = 'btn-primary btn-large-tap';
          doneBtn.textContent = 'Back to Map';
          doneBtn.style.marginTop = 'var(--space-3)';
          doneBtn.addEventListener('click', () => ScreenManager.go('world-map'));
          card.appendChild(doneBtn);
        }
      });
      optionsEl.appendChild(btn);
    });
  }

  return { render };
})();
