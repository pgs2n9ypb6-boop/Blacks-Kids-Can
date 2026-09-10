(async function () {
  GameState.init();

  const player = GameState.get();
  if (player.settings && player.settings.largeText) {
    document.documentElement.style.fontSize = '112.5%';
  }

  await ContentEngine.loadAll();

  const root = document.getElementById('app');
  ScreenManager.init(root);
  ScreenManager.go('home');

  // Persist minutes-played periodically and on exit.
  setInterval(() => GameState.trackMinutes(), 60000);
  window.addEventListener('beforeunload', () => GameState.trackMinutes());
})();
