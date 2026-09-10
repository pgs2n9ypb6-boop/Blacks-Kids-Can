// ProgressEngine: pure XP/badge/unlock logic, no UI coupling.
const ProgressEngine = (() => {
  const XP_PER_CORRECT = 10;
  const XP_TO_UNLOCK_NEXT = 30;

  function awardXP(player, amount) {
    player.xp += amount;
    GameState.persist();
    return player.xp;
  }

  function awardBadge(player, badgeId) {
    if (!player.badges.includes(badgeId)) {
      player.badges.push(badgeId);
      GameState.persist();
      return true; // newly earned
    }
    return false;
  }

  function markFigureComplete(player, figureId) {
    if (!player.completedFigures.includes(figureId)) {
      player.completedFigures.push(figureId);
      GameState.persist();
    }
  }

  function unlockLocation(player, locationId) {
    if (!player.unlockedLocations.includes(locationId)) {
      player.unlockedLocations.push(locationId);
      GameState.persist();
      return true;
    }
    return false;
  }

  function isLocationUnlocked(player, locationId) {
    return player.unlockedLocations.includes(locationId);
  }

  function maybeUnlockNext(player, locations, currentLocationId) {
    const idx = locations.findIndex(l => l.id === currentLocationId);
    if (idx < 0 || idx + 1 >= locations.length) return { unlocked: false, worldComplete: null };
    const current = locations[idx];
    const next = locations[idx + 1];
    const unlocked = unlockLocation(player, next.id);
    let worldComplete = null;
    if (next.world > current.world) {
      const badgeId = `world${current.world}-complete`;
      if (awardBadge(player, badgeId)) worldComplete = current.world;
    }
    return { unlocked, worldComplete };
  }

  function recordDailyChallenge(player) {
    const today = new Date().toDateString();
    if (player.lastDailyDate === today) return { alreadyDone: true, streak: player.dailyStreak };
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    player.dailyStreak = player.lastDailyDate === yesterday ? player.dailyStreak + 1 : 1;
    player.lastDailyDate = today;
    GameState.persist();
    return { alreadyDone: false, streak: player.dailyStreak };
  }

  return {
    XP_PER_CORRECT, XP_TO_UNLOCK_NEXT,
    awardXP, awardBadge, markFigureComplete, unlockLocation,
    isLocationUnlocked, maybeUnlockNext, recordDailyChallenge
  };
})();
