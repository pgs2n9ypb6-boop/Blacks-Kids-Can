const LocationScreen = (() => {
  function render(root) {
    const player = GameState.get();
    const loc = ContentEngine.getLocation(player.activeLocationId);
    if (!loc) { ScreenManager.go('world-map'); return; }

    const figures = ContentEngine.getFiguresByIds(loc.figureIds);
    const isCareerWorld = loc.minigame === 'career-explorer';

    root.innerHTML = `
      <div class="screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <span></span>
        </div>
        <h1>${loc.name}</h1>
        <div class="location-story">${loc.story}</div>
        ${figures.length ? `
          <h2 style="margin-bottom:var(--space-2);">Meet the People</h2>
          <div class="figure-card-list" id="figure-list"></div>
        ` : ''}
        <button class="btn-primary btn-large-tap" id="play-btn" style="margin-top:var(--space-3);">
          ${isCareerWorld ? 'Explore Your Future' : 'Play &amp; Earn XP'}
        </button>
      </div>
    `;

    const listEl = root.querySelector('#figure-list');
    if (listEl) {
      const usesDetailed = player.ageLevel === '9-12' || player.ageLevel === '13-17';
      const isTeen = player.ageLevel === '13-17';
      figures.forEach(fig => {
        const card = document.createElement('div');
        card.className = 'figure-card';
        card.innerHTML = `
          <span class="topic-tag">${fig.topic}</span>
          <h3>${fig.name}</h3>
          <p>${usesDetailed ? fig.detailedFact : fig.childFact}</p>
          ${usesDetailed ? `<p style="font-size:0.8rem;color:#888;margin-top:4px;">Source: ${fig.source}</p>` : ''}
          ${isTeen && fig.criticalQuestion ? `
            <div style="margin-top:10px;padding:10px;background:var(--color-cream-dim);border-radius:10px;border-left:4px solid var(--color-indigo);">
              <strong style="font-size:0.85rem;">🤔 Think About It</strong>
              <p style="font-size:0.9rem;margin:4px 0 0;">${fig.criticalQuestion}</p>
            </div>
          ` : ''}
        `;
        listEl.appendChild(card);
      });
    }

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('world-map'));
    root.querySelector('#play-btn').addEventListener('click', () => {
      ScreenManager.go(`minigame-${loc.minigame}`);
    });
  }

  return { render };
})();
