const WorldMapScreen = (() => {
  const WORLD_TITLES = {
    1: { title: 'World 1: Where We Come From', sub: 'Travel across Africa\'s great kingdoms.' },
    2: { title: 'World 2: The Journey', sub: 'A harder chapter - and the strength that carried people through it.' },
    3: { title: 'World 3: Building Communities', sub: 'Schools, businesses, and inventions built from determination.' },
    4: { title: 'World 4: The Fight for Freedom', sub: 'Many voices, working together, for equality and change.' },
    5: { title: 'World 5: Black Excellence', sub: 'Science, space, art, music, and sports - greatness in every field.' },
    6: { title: 'World 6: Your Future', sub: 'Your history isn\'t finished. You are part of what comes next.' }
  };

  function render(root) {
    const player = GameState.get();
    const worldNumbers = ContentEngine.getWorldNumbers();

    root.innerHTML = `
      <div class="screen map-screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back" style="color:white;">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <button class="back-btn" id="daily-btn" aria-label="Daily Challenge" style="color:var(--color-gold);font-size:1rem;">Daily 🔥${player.dailyStreak}</button>
        </div>
        <p style="color:#CFC6EE;">Hi ${player.nickname || 'Explorer'}! Keep exploring your story. <span style="opacity:0.7;font-size:0.85rem;">(Ages ${player.ageLevel || '5-8'})</span></p>
        <div id="worlds-container"></div>
      </div>
    `;

    const container = root.querySelector('#worlds-container');

    worldNumbers.forEach(worldNum => {
      const locations = ContentEngine.getLocationsByWorld(worldNum);
      const anyUnlocked = locations.some(l => ProgressEngine.isLocationUnlocked(player, l.id));
      if (!anyUnlocked) return; // don't reveal a world's section until its first location unlocks

      const info = WORLD_TITLES[worldNum] || { title: `World ${worldNum}`, sub: '' };
      const section = document.createElement('div');
      section.style.marginBottom = 'var(--space-4)';
      section.innerHTML = `
        <h1 class="map-title">${info.title}</h1>
        <p style="color:#CFC6EE;margin-top:-8px;">${info.sub}</p>
        <div class="map-path"></div>
      `;
      const pathEl = section.querySelector('.map-path');

      locations.forEach(loc => {
        const unlocked = ProgressEngine.isLocationUnlocked(player, loc.id);
        const node = document.createElement('button');
        node.className = `map-node ${unlocked ? 'unlocked' : 'locked'}`;
        node.innerHTML = `
          <span class="map-node-icon">${unlocked ? '🗺️' : '🔒'}</span>
          <span>
            <div class="map-node-title">${loc.name}</div>
            <div class="map-node-sub">${loc.topic}</div>
          </span>
        `;
        if (unlocked) {
          node.addEventListener('click', () => {
            player.activeLocationId = loc.id;
            ScreenManager.go('location');
          });
        } else {
          node.disabled = true;
        }
        pathEl.appendChild(node);
      });

      container.appendChild(section);
    });

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('home'));
    root.querySelector('#daily-btn').addEventListener('click', () => ScreenManager.go('daily-challenge'));
  }

  return { render };
})();
