const MinigameMapScreen = (() => {
  // Simplified, original stylized map of Africa with approximate region dots.
  // Not a literal geographic reproduction - illustrative for young learners.
  const REGIONS = [
    { id: 'nile-valley', label: 'Nile Valley', x: 72, y: 28 },
    { id: 'ghana-empire', label: 'Ghana Empire', x: 28, y: 42 },
    { id: 'mali-empire', label: 'Mali Empire', x: 34, y: 36 },
    { id: 'songhai-empire', label: 'Songhai Empire', x: 40, y: 40 },
    { id: 'great-zimbabwe', label: 'Great Zimbabwe', x: 60, y: 75 }
  ];

  function render(root) {
    const player = GameState.get();
    const loc = ContentEngine.getLocation(player.activeLocationId);
    const target = REGIONS.find(r => r.id === loc.id) || REGIONS[0];

    let attempts = 0;

    root.innerHTML = `
      <div class="screen map-screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back" style="color:white;">←</button>
          <span class="xp-pill">⭐ ${player.xp} XP</span>
          <span></span>
        </div>
        <div class="minigame-header">
          <h1>Where in the World?</h1>
          <p style="color:#CFC6EE;">Tap where you think the <strong>${loc.name}</strong> was located.</p>
        </div>
        <div class="map-tap-region" style="position:relative;height:340px;">
          <svg viewBox="0 0 100 100" style="width:100%;height:100%;">
            <path d="M50 5 C65 5 75 20 78 35 C82 50 75 60 68 72 C62 85 55 95 48 95 C40 95 35 80 32 68 C28 55 22 45 25 30 C28 15 38 5 50 5 Z"
              fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" stroke-width="1" />
          </svg>
          <div id="dots"></div>
        </div>
        <p id="feedback" style="text-align:center;min-height:1.5em;font-weight:600;color:white;"></p>
      </div>
    `;

    const container = root.querySelector('#dots');
    container.style.position = 'absolute';
    container.style.inset = '0';

    REGIONS.forEach(r => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', 'map region');
      dot.style.position = 'absolute';
      dot.style.left = `${r.x}%`;
      dot.style.top = `${r.y}%`;
      dot.style.transform = 'translate(-50%, -50%)';
      dot.style.width = '28px';
      dot.style.height = '28px';
      dot.style.borderRadius = '50%';
      dot.style.border = '2px solid white';
      dot.style.background = 'rgba(242,183,5,0.4)';
      dot.addEventListener('click', () => {
        attempts++;
        const feedback = root.querySelector('#feedback');
        if (r.id === target.id) {
          dot.style.background = 'var(--color-forest)';
          feedback.textContent = `Correct! That's where the ${loc.name} was. ✨`;
          const xp = Math.max(ProgressEngine.XP_PER_CORRECT - (attempts - 1) * 3, 4);
          ProgressEngine.awardXP(player, xp);
          root.querySelector('.xp-pill').textContent = `⭐ ${player.xp} XP`;
          finish();
        } else {
          dot.style.background = 'rgba(192,57,43,0.6)';
          feedback.textContent = 'Not quite - try another spot!';
        }
      });
      container.appendChild(dot);
    });

    function finish() {
      setTimeout(() => {
        const allLocs = ContentEngine.getAllLocationsOrdered();
        const result = ProgressEngine.maybeUnlockNext(player, allLocs, loc.id);
        const feedback = root.querySelector('#feedback');
        if (result.worldComplete) feedback.innerHTML += ` You completed World ${result.worldComplete}! A new world is unlocked!`;
        else if (result.unlocked) feedback.innerHTML += ' A new location is unlocked!';
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn-primary btn-large-tap';
        doneBtn.textContent = 'Back to Map';
        doneBtn.style.marginTop = 'var(--space-3)';
        doneBtn.addEventListener('click', () => ScreenManager.go('world-map'));
        root.querySelector('.screen').appendChild(doneBtn);
      }, 500);
    }

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('location'));
  }

  return { render };
})();
