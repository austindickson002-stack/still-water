'use strict';
(function (G) {
  const A = G.audio = { ok: false, vol: 0.8 };
  let ctx, master, noiseBuf, windG, lapG, lapF, dragAcc = 0, night = 0;
  A.init = () => {
    if (A.ok) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = A.vol; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); let b = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.6 + b * 3; }
      // wind
      const wn = loopNoise(); const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
      windG = ctx.createGain(); windG.gain.value = 0.05; wn.connect(wf).connect(windG).connect(master);
      // water lapping
      const ln = loopNoise(); lapF = ctx.createBiquadFilter(); lapF.type = 'bandpass'; lapF.frequency.value = 700; lapF.Q.value = 0.8;
      lapG = ctx.createGain(); lapG.gain.value = 0.0; ln.connect(lapF).connect(lapG).connect(master);
      A.ok = true;
      setInterval(ambience, 400);
    } catch (e) { A.ok = false; }
  };
  function loopNoise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 1.5); return s; }
  function burst(dur, type, f0, f1, gain, q = 1, delay = 0) {
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(f0, f1, dur, gain, type = 'sine', delay = 0, pan = 0) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(master); } else o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function ambience() {
    if (!A.ok) return;
    const t = ctx.currentTime;
    lapG.gain.setTargetAtTime(0.02 + Math.random() * 0.05, t, 0.3);
    lapF.frequency.setTargetAtTime(450 + Math.random() * 600, t, 0.4);
    windG.gain.setTargetAtTime(0.03 + Math.random() * 0.04, t, 1.5);
    if (night < 0.5 && Math.random() < 0.09) bird();
    if (night >= 0.5 && Math.random() < 0.5) cricket();
    if (Math.random() < 0.015) loon();
  }
  function bird() {
    const pan = Math.random() * 2 - 1, base = 2600 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 5), kind = Math.random();
    for (let i = 0; i < n; i++) {
      const d = i * (0.09 + Math.random() * 0.05);
      if (kind < 0.5) tone(base, base * (1.2 + Math.random() * 0.3), 0.07, 0.025, 'sine', d, pan);
      else tone(base * 1.3, base * 0.8, 0.11, 0.02, 'sine', d, pan);
    }
  }
  function cricket() { const pan = Math.random() * 2 - 1; for (let i = 0; i < 4; i++) tone(4300, 4250, 0.03, 0.006, 'sine', i * 0.05, pan); }
  function loon() { const pan = Math.random() * 2 - 1; tone(620, 980, 0.9, 0.012, 'sine', 0, pan); tone(980, 760, 1.1, 0.01, 'sine', 0.9, pan); }
  A.setNight = v => { night = v; };
  A.setVol = v => { A.vol = v; if (master) master.gain.value = v; };
  A.cast = () => { if (!A.ok) return; burst(0.45, 'bandpass', 500, 2600, 0.25, 1.2); };
  A.plop = (k = 1) => { if (!A.ok) return; burst(0.18 + k * 0.1, 'lowpass', 1800, 300, 0.15 * k); tone(220, 90, 0.12, 0.05 * k); };
  A.splash = (k = 1) => { if (!A.ok) return; burst(0.5 + 0.4 * k, 'lowpass', 3500, 400, 0.35 * k); burst(0.25, 'highpass', 2500, 2000, 0.06 * k, 0.7, 0.05); };
  A.click = (k = 1) => { if (!A.ok) return; burst(0.025, 'highpass', 3200, 3000, 0.035 * k, 2); };
  A.drag = (rate, dt) => { if (!A.ok) return; dragAcc += rate * dt; while (dragAcc > 1) { dragAcc -= 1; burst(0.02, 'bandpass', 4200, 4000, 0.045, 4); } };
  A.snap = () => { if (!A.ok) return; tone(1400, 300, 0.12, 0.08, 'triangle'); burst(0.2, 'highpass', 4000, 1500, 0.1); };
  A.strike = () => { if (!A.ok) return; burst(0.22, 'bandpass', 800, 3000, 0.16, 1.5); };
  A.coin = () => { if (!A.ok) return; tone(1320, 1320, 0.12, 0.05, 'triangle'); tone(1760, 1760, 0.25, 0.05, 'triangle', 0.08); };
  A.flop = () => { if (!A.ok) return; burst(0.08, 'lowpass', 900, 400, 0.08); };
})(window.G);
