const CareerExplorerScreen = (() => {
  const XP_PER_CAREER = 5;

  function render(root) {
    const player = GameState.get();
    if (!player.viewedCareers) player.viewedCareers = [];
    const careers = ContentEngine.getAllCareers();

    root.innerHTML = `
      <div class="screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <span></span>
        </div>
        <div class="minigame-header">
          <h1>What Will You Become?</h1>
          <p>Tap a card to explore a path. There's no wrong answer - just discover!</p>
          <p id="progress-line" style="font-weight:600;"></p>
        </div>
        <div class="career-grid" id="career-grid"></div>
        <div id="career-detail"></div>
        <div id="finish-area"></div>
      </div>
    `;

    const grid = root.querySelector('#career-grid');
    const detail = root.querySelector('#career-detail');
    const progressLine = root.querySelector('#progress-line');

    function updateProgress() {
      progressLine.textContent = `${player.viewedCareers.length} of ${careers.length} explored`;
    }
    updateProgress();

    careers.forEach(career => {
      const card = document.createElement('button');
      card.className = 'career-card';
      const viewed = player.viewedCareers.includes(career.id);
      if (viewed) card.classList.add('viewed');
      card.innerHTML = `
        <span class="career-icon">${career.icon}</span>
        <span class="career-title">${career.title}</span>
      `;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.career-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        showDetail(career);
        if (!player.viewedCareers.includes(career.id)) {
          player.viewedCareers.push(career.id);
          ProgressEngine.awardXP(player, XP_PER_CAREER);
          root.querySelector('.xp-pill').textContent = `⭐ ${player.xp} XP`;
          card.classList.add('viewed');
          updateProgress();
          checkComplete();
        }
      });
      grid.appendChild(card);
    });

    function showDetail(career) {
      let connectionHtml = '';
      if (career.connectionFigureId) {
        const fig = ContentEngine.getFigure(career.connectionFigureId);
        if (fig) {
          connectionHtml = `<p style="margin-top:8px;font-size:0.9rem;color:var(--color-indigo);">You already met someone like this: <strong>${fig.name}</strong>!</p>`;
        }
      }
      detail.innerHTML = `
        <div class="career-detail-card">
          <div style="font-size:2.5rem;">${career.icon}</div>
          <h2>${career.title}</h2>
          <p>${career.blurb}</p>
          ${connectionHtml}
        </div>
      `;
    }

    function checkComplete() {
      if (player.viewedCareers.length === careers.length) {
        const newly = ProgressEngine.awardBadge(player, 'world6-complete');
        const finishArea = root.querySelector('#finish-area');
        finishArea.innerHTML = `
          <div class="daily-card" style="margin-top:var(--space-3);">
            <div style="font-size:2.5rem;">🔭</div>
            <h2>You explored every path!</h2>
            <p>Know where you come from. Understand what came before you. Discover what you can become.</p>
            <button class="btn-primary btn-large-tap" id="finish-btn" style="margin-top:var(--space-2);">Back to Map</button>
          </div>
        `;
        finishArea.querySelector('#finish-btn').addEventListener('click', () => ScreenManager.go('world-map'));
      }
    }

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('location'));
  }

  return { render };
})();
