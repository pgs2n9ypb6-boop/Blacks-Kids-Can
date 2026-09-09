const HomeScreen = (() => {
  function render(root) {
    const player = GameState.get();
    const hasCharacter = !!player.nickname;
    if (!player.settings) player.settings = { soundOn: true, largeText: false };

    root.innerHTML = `
      <div class="screen home-screen">
        <button id="settings-btn" aria-label="Settings" style="position:absolute;top:16px;right:16px;background:none;border:none;color:white;font-size:1.6rem;">⚙️</button>
        <div class="home-brand">BLACK KIDS CAN 🚀</div>
        <p class="home-tagline">Discover where you come from. Explore who came before you. Build what comes next.</p>
        <div class="home-actions">
          <button class="btn-primary btn-large-tap" id="start-btn">
            ${hasCharacter ? 'Continue Your Journey' : 'Start Your Journey'}
          </button>
          <button class="home-parent-link" id="parent-link">For Parents</button>
        </div>
      </div>
    `;

    root.querySelector('#start-btn').addEventListener('click', () => {
      SoundEngine.playTap();
      if (hasCharacter) {
        ScreenManager.go('world-map');
      } else {
        ScreenManager.go('character-creator');
      }
    });

    root.querySelector('#parent-link').addEventListener('click', () => {
      ScreenManager.go('parent-dashboard');
    });

    root.querySelector('#settings-btn').addEventListener('click', () => showSettings(root, player));

    if (!player.tutorialSeen) {
      showTutorial(root, player);
    }
  }

  function showSettings(root, player) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:50;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;padding:24px;max-width:320px;width:90%;color:var(--color-ink);">
        <h2 style="margin-bottom:16px;">Settings</h2>
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          Sound
          <input type="checkbox" id="sound-toggle" ${player.settings.soundOn ? 'checked' : ''} style="width:22px;height:22px;" />
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          Larger Text
          <input type="checkbox" id="text-toggle" ${player.settings.largeText ? 'checked' : ''} style="width:22px;height:22px;" />
        </label>
        <button class="btn-primary" id="close-settings" style="width:100%;">Done</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#sound-toggle').addEventListener('change', (e) => {
      player.settings.soundOn = e.target.checked;
      GameState.persist();
    });
    overlay.querySelector('#text-toggle').addEventListener('change', (e) => {
      player.settings.largeText = e.target.checked;
      document.documentElement.style.fontSize = e.target.checked ? '112.5%' : '100%';
      GameState.persist();
    });
    overlay.querySelector('#close-settings').addEventListener('click', () => overlay.remove());
  }

  function showTutorial(root, player) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;padding:28px;max-width:380px;width:100%;color:var(--color-ink);text-align:center;">
        <div style="font-size:3rem;">🚀</div>
        <h2 style="margin:12px 0;">Welcome, Explorer!</h2>
        <p style="margin-bottom:20px;">Create your character, then travel the map to meet amazing people from history. Play games to earn XP and badges along the way!</p>
        <button class="btn-primary btn-large-tap" id="tutorial-done" style="width:100%;">Let's Go!</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#tutorial-done').addEventListener('click', () => {
      player.tutorialSeen = true;
      GameState.persist();
      overlay.remove();
    });
  }

  return { render };
})();
