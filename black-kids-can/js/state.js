// GameState: single source of truth for the current player session.
const GameState = (() => {
  const defaultPlayer = () => ({
    nickname: '',
    ageLevel: '5-8',
    character: { skinTone: 'tone-3', hair: 'afro', outfit: 'explorer', accessory: 'none' },
    xp: 0,
    badges: [],
    unlockedLocations: ['nile-valley'],
    completedFigures: [],
    viewedCareers: [],
    dailyStreak: 0,
    lastDailyDate: null,
    createdAt: null,
    minutesPlayed: 0
  });

  let player = null;
  let currentScreen = 'home';
  let sessionStart = Date.now();

  function init() {
    const saved = StorageAdapter.load();
    player = saved || defaultPlayer();
    if (!player.createdAt) player.createdAt = new Date().toISOString();
    if (!player.ageLevel) player.ageLevel = '5-8';
  }

  function get() {
    return player;
  }

  function persist() {
    StorageAdapter.save(player);
  }

  function setScreen(name) {
    currentScreen = name;
  }

  function getScreen() {
    return currentScreen;
  }

  function trackMinutes() {
    const elapsedMin = Math.round((Date.now() - sessionStart) / 60000);
    if (elapsedMin > 0) {
      player.minutesPlayed += elapsedMin;
      sessionStart = Date.now();
      persist();
    }
  }

  function resetProgress() {
    player = defaultPlayer();
    player.createdAt = new Date().toISOString();
    persist();
  }

  return { init, get, persist, setScreen, getScreen, trackMinutes, resetProgress };
})();
