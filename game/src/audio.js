// All sound is synthesized with WebAudio — no audio files. Engine hum pitched by
// speed, a two-tone siren while the police are close, pickup blips, a mission
// jingle, punch and gunshot thumps, and a quiet ambient chord loop. Nothing starts
// until the player gestures (the Start button), so headless screenshots stay silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;
  let padStarted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      // Engine: a sawtooth through a low-pass, pitched by speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // Siren: one square wave, its pitch flipped by update().
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function startPad() {
    if (!ctx || !master || padStarted) return;
    padStarted = true;
    // A slow warm pad: two detuned sines an octave apart, breathing through a gain LFO.
    const notes = [110, 164.8, 220];
    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    padGain.connect(master);
    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = 4;
      osc.connect(padGain);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start();
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows the car's speed; silent on foot or at rest. */
    setEngine(speed, inCar) {
      if (!ctx || !engineOsc) return;
      const target = inCar ? Math.min(0.12, 0.02 + (speed / 30) * 0.1) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed * 5, ctx.currentTime, 0.08);
    },
    /** Two-tone siren while `on`; call every frame. */
    siren(on, dt) {
      if (!ctx || !sirenOsc) return;
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 950 : 700;
      }
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    blip() {
      tone(880, 0.12, 'sine', 0.25);
      tone(1320, 0.1, 'sine', 0.18, 0.07);
    },
    punch() {
      tone(120, 0.12, 'triangle', 0.4);
    },
    gunshot() {
      tone(220, 0.08, 'square', 0.3);
      tone(90, 0.14, 'triangle', 0.35);
    },
    crash() {
      tone(70, 0.25, 'sawtooth', 0.3);
    },
    jingle() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.28, i * 0.11));
    },
    fail() {
      tone(392, 0.25, 'triangle', 0.25);
      tone(311, 0.4, 'triangle', 0.25, 0.2);
    },
    startAmbient() {
      startPad();
    },
  };
}
