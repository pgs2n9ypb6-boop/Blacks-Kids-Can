const ScreenManager = (() => {
  const screens = {
    'home': HomeScreen,
    'character-creator': CharacterCreatorScreen,
    'world-map': WorldMapScreen,
    'location': LocationScreen,
    'minigame-match': MinigameMatchScreen,
    'minigame-memory': MinigameMemoryScreen,
    'minigame-map': MinigameMapScreen,
    'minigame-career-explorer': CareerExplorerScreen,
    'daily-challenge': DailyChallengeScreen,
    'parent-dashboard': ParentDashboardScreen
  };

  let root = null;

  function init(rootEl) {
    root = rootEl;
  }

  function go(screenName) {
    const screen = screens[screenName];
    if (!screen) {
      console.error('Unknown screen:', screenName);
      return;
    }
    GameState.setScreen(screenName);
    GameState.trackMinutes();
    window.scrollTo(0, 0);
    screen.render(root);
  }

  return { init, go };
})();
