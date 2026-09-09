const ParentDashboardScreen = (() => {
  function render(root) {
    const player = GameState.get();

    if (!player.parentPin) {
      renderSetupPin(root, player);
    } else {
      renderPinEntry(root, player);
    }
  }

  function renderSetupPin(root, player) {
    root.innerHTML = `
      <div class="screen parent-screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <h2>Parent Area</h2>
          <span></span>
        </div>
        <div class="pin-pad">
          <p>Create a 4-digit PIN so only grown-ups can view this area.</p>
          <input class="pin-input" id="pin-input" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" />
          <button class="btn-primary btn-large-tap" id="set-pin-btn" style="width:100%;">Set PIN</button>
        </div>
      </div>
    `;
    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('home'));
    root.querySelector('#set-pin-btn').addEventListener('click', () => {
      const val = root.querySelector('#pin-input').value.trim();
      if (/^\d{4}$/.test(val)) {
        player.parentPin = val;
        GameState.persist();
        renderDashboard(root, player);
      } else {
        alert('Please enter exactly 4 digits.');
      }
    });
  }

  function renderPinEntry(root, player) {
    root.innerHTML = `
      <div class="screen parent-screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <h2>Parent Area</h2>
          <span></span>
        </div>
        <div class="pin-pad">
          <p>Enter your PIN to view progress.</p>
          <input class="pin-input" id="pin-input" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" />
          <button class="btn-primary btn-large-tap" id="enter-btn" style="width:100%;">Enter</button>
        </div>
      </div>
    `;
    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('home'));
    root.querySelector('#enter-btn').addEventListener('click', () => {
      const val = root.querySelector('#pin-input').value.trim();
      if (val === player.parentPin) {
        renderDashboard(root, player);
      } else {
        alert('Incorrect PIN.');
      }
    });
  }

  function renderDashboard(root, player) {
    GameState.trackMinutes();
    const earnedBadges = player.badges.map(id => ContentEngine.getBadge(id)).filter(Boolean);
    const allLocations = ContentEngine.getAllLocationsOrdered();
    const topicsLearned = ContentEngine.getFiguresByIds(player.completedFigures).map(f => f.topic);
    const uniqueTopics = [...new Set(topicsLearned)];

    root.innerHTML = `
      <div class="screen parent-screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <h2>Parent Dashboard</h2>
          <span></span>
        </div>
        <p>Progress for <strong>${player.nickname || 'Explorer'}</strong></p>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-num">${player.xp}</div>XP earned</div>
          <div class="stat-card"><div class="stat-num">${player.unlockedLocations.length}/${allLocations.length}</div>Locations unlocked</div>
          <div class="stat-card"><div class="stat-num">${player.completedFigures.length}</div>Figures learned</div>
          <div class="stat-card"><div class="stat-num">${player.dailyStreak}</div>Day streak</div>
          <div class="stat-card"><div class="stat-num">${player.minutesPlayed}</div>Minutes played</div>
        </div>
        <h3>Topics Covered</h3>
        <p>${uniqueTopics.length ? uniqueTopics.join(', ') : 'None yet - encourage them to explore a location!'}</p>
        <h3>Badges Earned</h3>
        <div class="badge-grid">
          ${earnedBadges.map(b => `<div class="badge-chip">${b.icon}<div class="badge-name">${b.name}</div></div>`).join('') || '<p>No badges yet.</p>'}
        </div>
        <p style="margin-top:var(--space-3);font-size:0.85rem;color:#666;">
          Age level: ${player.ageLevel || '5-8'} &middot; No personal information is collected. All progress is stored only on this device.
        </p>
      </div>
    `;
    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('home'));
  }

  return { render };
})();
