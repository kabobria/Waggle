/**
 * Short, gentle chimes for prep-end and speak-end alerts.
 * Generated with the Web Audio API, so no audio files are needed and the
 * app stays fully offline.
 */
const WaggleAudio = (() => {
  let ctx = null;

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // Call on a user gesture (e.g. the Start button) so autoplay policies
  // don't block the alert that fires later without a fresh gesture.
  function unlock() {
    try {
      ensureContext();
    } catch (err) {
      console.warn("Waggle: audio unavailable", err);
    }
  }

  function tone(ac, freq, startAt, duration) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.22, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  function chime(freqs, duration = 0.16, gap = 0.09) {
    try {
      const ac = ensureContext();
      let t = ac.currentTime;
      freqs.forEach((f) => {
        tone(ac, f, t, duration);
        t += duration + gap;
      });
    } catch (err) {
      console.warn("Waggle: unable to play chime", err);
    }
  }

  return {
    unlock,
    playPrepEnd: () => chime([740, 988]),
    playSpeakEnd: () => chime([988, 740, 988])
  };
})();
