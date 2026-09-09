// StorageAdapter: wraps localStorage now. Swap this file's internals for a
// real backend later without touching any other module.
const StorageAdapter = (() => {
  const KEY = 'roots_player_v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage load failed', e);
      return null;
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save failed', e);
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      console.error('Storage clear failed', e);
    }
  }

  return { load, save, clear };
})();
