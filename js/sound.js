// SoundEngine: tiny procedural beeps via Web Audio API, so there is a real
// sound toggle without shipping audio asset files. Respects player settings.
const SoundEngine = (() => {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  function isOn() {
    const player = GameState.get();
    return !player.settings || player.settings.soundOn !== false;
  }

  function tone(freq, duration, type = 'sine') {
    if (!isOn()) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  const playCorrect = () => tone(660, 0.25);
  const playWrong = () => tone(220, 0.2, 'sawtooth');
  const playTap = () => tone(440, 0.08);
  const playUnlock = () => { tone(523, 0.15); setTimeout(() => tone(784, 0.25), 120); };

  return { playCorrect, playWrong, playTap, playUnlock, isOn };
})();
