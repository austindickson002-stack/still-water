'use strict';
(function (G) {
  const { v3, m4, lin, smooth, clamp, mixc } = G;
  const $ = id => document.getElementById(id);
  const canvas = $('c');
  const fail = msg => { const e = $('err'); e.hidden = false; e.textContent = msg; };
  const gl = G.initGL(canvas);
  if (!gl) { fail('This game needs WebGL 2. Try a recent Chrome, Edge, Firefox or Safari.'); return; }

  // ---------------- settings & save ----------------
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const Q = Object.assign({ hand: 'goofy', quality: isTouch ? 'low' : 'high', vol: 0.8, sens: 1, tod: 0.16, clouds: 0.55, map: 'pine', name: 'Angler', todMap: {}, cloudMap: {} }, store.get('sw_settings', {}));
  const SAVE = Object.assign({ coins: 0, kept: 0, log: {} }, store.get('sw_save', {}));
  const saveAll = () => { store.set('sw_save', SAVE); store.set('sw_settings', Q); };

  let P;
  try { P = {}; for (const k in G.SH) P[k] = G.program(G.SH[k][0], G.SH[k][1], k); }
  catch (e) { fail('Graphics error: ' + e.message); console.error(e); return; }
  let W = null, mode = 'boot';
  const floatMeshes = {}; for (const t of ['pencil', 'ball', 'indicator', 'balloon', 'hera']) floatMeshes[t] = G.mesh(G.rig.floatData(t));
  const charMesh = G.mesh(G.characterData());
  const RTY = () => G.rig.TYPES[W ? W.map.rod : 'spin'];
  const netMesh = G.mesh(G.rig.netData());
  const gripMesh = G.mesh({ pos: new Float32Array(3), nor: new Float32Array(3), col: new Float32Array(3), uv: new Float32Array(2), mat: new Float32Array(1), idx: new Uint32Array(3) }, true);
  const rigMesh = G.mesh({ pos: new Float32Array(3), nor: new Float32Array(3), col: new Float32Array(3), uv: new Float32Array(2), mat: new Float32Array(1), idx: new Uint32Array(3) }, true);
  const lineMesh = G.mesh({ pos: new Float32Array(3), uv: new Float32Array(2), idx: new Uint32Array(3) }, true);
  const ptsMesh = G.mesh({ pos: new Float32Array(3), uv: new Float32Array(2) }, true); ptsMesh.mode = gl.POINTS;

  // ---------------- render targets ----------------
  const CF = G.hdr ? gl.RGBA16F : gl.RGBA8, CT = G.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  let RW = 2, RH = 2, T = { tex: [], rbs: [], fbs: [] };
  const rb = (fmt, w, h, s) => { const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); s > 0 ? gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, fmt, w, h) : gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h); T.rbs.push(r); return r; };
  const fb = list => {
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    for (const [pt, o, tex] of list) tex ? gl.framebufferTexture2D(gl.FRAMEBUFFER, pt, gl.TEXTURE_2D, o, 0) : gl.framebufferRenderbuffer(gl.FRAMEBUFFER, pt, gl.RENDERBUFFER, o);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER); if (st !== gl.FRAMEBUFFER_COMPLETE) console.warn('FBO incomplete', st.toString(16));
    T.fbs.push(f); return f;
  };
  const tx = (w, h, o) => { const t = G.tex(w, h, o); T.tex.push(t); return t; };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, Q.quality === 'high' ? 1.5 : 1.25);
    RW = Math.max(2, Math.round(innerWidth * dpr)); RH = Math.max(2, Math.round(innerHeight * dpr));
    canvas.width = RW; canvas.height = RH;
    T.tex.forEach(t => gl.deleteTexture(t)); T.rbs.forEach(r => gl.deleteRenderbuffer(r)); T.fbs.forEach(f => gl.deleteFramebuffer(f));
    T = { tex: [], rbs: [], fbs: [] };
    const samples = Q.quality === 'high' ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES)) : 0;
    T.main = fb([[gl.COLOR_ATTACHMENT0, rb(CF, RW, RH, samples)], [gl.DEPTH_ATTACHMENT, rb(gl.DEPTH_COMPONENT24, RW, RH, samples)]]);
    T.sc = tx(RW, RH, { ifmt: CF, type: CT });
    T.sd = tx(RW, RH, { ifmt: gl.DEPTH_COMPONENT24, fmt: gl.DEPTH_COMPONENT, type: gl.UNSIGNED_INT, filter: gl.NEAREST });
    T.scene = fb([[gl.COLOR_ATTACHMENT0, T.sc, 1], [gl.DEPTH_ATTACHMENT, T.sd, 1]]);
    const rs = Q.quality === 'high' ? 0.5 : 0.35;
    T.rw = Math.max(2, Math.round(RW * rs)); T.rh = Math.max(2, Math.round(RH * rs));
    T.rc = tx(T.rw, T.rh, { ifmt: CF, type: CT });
    T.refl = fb([[gl.COLOR_ATTACHMENT0, T.rc, 1], [gl.DEPTH_ATTACHMENT, rb(gl.DEPTH_COMPONENT24, T.rw, T.rh, 0)]]);
    T.bl = []; let w = RW >> 1, h = RH >> 1;
    for (let i = 0; i < 6 && w > 3 && h > 3; i++) { const t = tx(w, h, { ifmt: CF, type: CT }); T.bl.push({ t, f: fb([[gl.COLOR_ATTACHMENT0, t, 1]]), w, h }); w >>= 1; h >>= 1; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  addEventListener('resize', resize); resize();

  // ---------------- time of day ----------------
  // elev, zenith, horizon, glow, sun, ambient sky, ambient ground, fog
  const KEYS = [
    [-7, ['#0a1122', .2], ['#202338', .22], ['#1d1520', .1], ['#000000', 0], ['#141a30', .2], ['#0a0b0e', .15], .0012],
    [-1.5, ['#1d2b52', .55], ['#b0626a', .85], ['#ff5a24', .9], ['#ff6a30', .3], ['#4a4a70', .45], ['#2a2018', .35], .0006],
    [2, ['#2c4b84', .85], ['#e99a6e', 1.15], ['#ff7a30', 1.25], ['#ffa060', 2.7], ['#8a90b0', .5], ['#4a3a28', .42], .00042],
    [7, ['#3a62a0', 1.0], ['#f0c29a', 1.25], ['#ffb070', 1.0], ['#ffc890', 3.4], ['#9aa8c8', .6], ['#4d4530', .5], .00036],
    [18, ['#3a6fb8', 1.1], ['#c8d8ea', 1.45], ['#ffeccc', .8], ['#fff0d8', 4.2], ['#9db6dc', .7], ['#4d4a36', .55], .0003],
    [55, ['#2c66c2', 1.15], ['#b5cfee', 1.5], ['#ffffff', .5], ['#fffaf2', 4.8], ['#a4bfe6', .8], ['#55523c', .6], .00025]
  ].map(k => [k[0], ...k.slice(1, 7).map(([h, m]) => lin(h, m)), k[7]]);
  const U = { uSunDir: [0, 0.05, -1], uSunCol: [1, 1, 1], uZen: [0, 0, 0], uHor: [0, 0, 0], uGlow: [0, 0, 0], uAmbSky: [0, 0, 0], uAmbGnd: [0, 0, 0], uCam: [0, 0, 0], uFogD: 0.001, uTime: 0, uClip: 0, uCloud: Q.clouds };
  let expo = 1, night = 0, elev = 0, flareCol = [1, 0.8, 0.6];
  function applyTime() {
    elev = -6 + 56 * Q.tod;
    let i = 0; while (i < KEYS.length - 2 && elev > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((elev - a[0]) / (b[0] - a[0]), 0, 1);
    const f = k => mixc(a[k], b[k], t);
    U.uZen = f(1); U.uHor = f(2); U.uGlow = f(3); U.uAmbSky = f(5); U.uAmbGnd = f(6); U.uFogD = a[7] + (b[7] - a[7]) * t;
    const az = W ? W.map.sunAz : 0.3, e = elev * Math.PI / 180;
    U.uSunDir = v3.norm([-Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)]);
    U.uSunCol = v3.mul(f(4), smooth(-1.5, 1.2, elev));
    const sc = f(4), m = Math.max(sc[0], sc[1], sc[2], 1e-3); flareCol = [sc[0] / m, sc[1] / m, sc[2] / m];
    night = smooth(0, -5, elev); expo = 0.86 + night * 1.2; G.audio.setNight(night);
    U.uCloud = Q.clouds;
    const hrs = 20.3 - (elev + 6) / 56 * 7.3, hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60);
    $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    $('temp').textContent = Math.round(13 + Math.max(0, elev) * 0.22 + 3) + '°C';
    $('wind').textContent = 'SW ' + (1.2 + Q.clouds * 1.6).toFixed(1) + ' m/s';
  }
  applyTime();

  // ---------------- camera & input ----------------
  const cam = { yaw: 0.02, pitch: -0.07, ty: 0.02, tp: -0.07, zoom: 0, pos: [0, 2, 0], auto: null, lag: [0, 0] };
  const input = { act: false, lift: false, zoom: false, locked: false, mx: 0.5, my: 0.5, actT: 0 };
  let playing = false, panel = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
  const lockPointer = () => { if (isTouch) return; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } };
  canvas.addEventListener('mousedown', e => {
    if (!playing || panel) return;
    if (!input.locked) lockPointer();
    if (e.button === 0) actionDown(); else if (e.button === 2) input.lift = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) actionUp(); else if (e.button === 2) input.lift = false; });
  addEventListener('mousemove', e => {
    if (!playing || panel) return;
    if (input.locked) { cam.ty -= e.movementX * 0.0021 * Q.sens; cam.tp -= e.movementY * 0.0021 * Q.sens; }
    else if (!isTouch) { cam.ty = (W ? W.yaw0 : 0) - (e.clientX / innerWidth - 0.5) * 2.2; cam.tp = -(e.clientY / innerHeight - 0.5) * 1.0 - 0.06; }
  });
  canvas.addEventListener('wheel', e => { if (!playing) return; e.preventDefault(); setDrag(S.drag - Math.sign(e.deltaY) * 0.05); }, { passive: false });
  // touch look
  let tid = null, tx0 = 0, ty0 = 0;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { tid = e.pointerId; tx0 = e.clientX; ty0 = e.clientY; } });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== tid || !playing || panel) return;
    cam.ty -= (e.clientX - tx0) * 0.005 * Q.sens; cam.tp -= (e.clientY - ty0) * 0.005 * Q.sens; tx0 = e.clientX; ty0 = e.clientY;
  });
  addEventListener('pointerup', e => { if (e.pointerId === tid) tid = null; });
  const keys = {};
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (!playing) return;
    if (e.code === 'Space') { e.preventDefault(); if (!panel) actionDown(); }
    if (e.code === 'KeyQ' || e.code === 'Minus') setDrag(S.drag - 0.05);
    if (e.code === 'KeyE' || e.code === 'Equal') setDrag(S.drag + 0.05);
    if (e.code === 'KeyF') input.lift = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.zoom = true;
    if (e.code === 'KeyK' && S.st === 'hold') keepFish();
    if (e.code === 'KeyX' && S.st === 'hold') releaseFish();
    if (e.code === 'KeyL') togglePanel('logP');
    if (e.code === 'KeyN') tryNet();
    if (e.code === 'Escape' && panel) togglePanel(panel);
  });
  addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Space') actionUp();
    if (e.code === 'KeyF') input.lift = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.zoom = false;
  });
  // touch buttons
  const tb = (id, down, up) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down(); }); b.addEventListener('pointerup', e => { e.preventDefault(); up && up(); }); b.addEventListener('pointerleave', () => up && up()); };
  tb('tAct', () => actionDown(), () => actionUp());
  tb('tLift', () => { input.lift = true; }, () => { input.lift = false; });
  tb('tZoom', () => { input.zoom = !input.zoom; $('tZoom').classList.toggle('on', input.zoom); });
  tb('tDm', () => setDrag(S.drag - 0.05)); tb('tDp', () => setDrag(S.drag + 0.05));
  tb('tNet', () => tryNet());
  // drag dial: drag up/down, wheel, or click to step
  { const dd = $('dragDial'); let y0 = null, d0 = 0, moved = false;
    dd.addEventListener('pointerdown', e => { e.stopPropagation(); y0 = e.clientY; d0 = S.drag; moved = false; dd.setPointerCapture(e.pointerId); });
    dd.addEventListener('pointermove', e => { if (y0 === null) return; const dy = (y0 - e.clientY) / 120; if (Math.abs(dy) > 0.03) moved = true; setDrag(d0 + dy); });
    dd.addEventListener('pointerup', () => { if (!moved) setDrag(S.drag >= 1.1 ? 0.1 : S.drag + 0.05); y0 = null; });
    dd.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); setDrag(S.drag - Math.sign(e.deltaY) * 0.05); }, { passive: false }); }

  // ---------------- game state ----------------
  const S = {
    st: 'idle', t: 0, power: 0, drag: 0.6, lineKg: 8, crank: 0, crankV: 0, bail: 0,
    rod: { pitch: 0, yaw: 0, bend: 0, lift: 0, vel: 0, grab: 1 },
    fl: { p: [0, 0, 0], vis: false, dip: 0, tilt: [0, 0], under: 0 },
    cast: null, wait: null, fight: null, hold: null, jump: null, net: null, msgT: 0, pressT: 0, reelIn: false, keepKg: 0
  };
  SAVE.wear = Object.assign({ line: 100, rod: 100, reel: 100 }, SAVE.wear || {});
  if (SAVE.bait === undefined) SAVE.bait = 30;
  SAVE.day = SAVE.day || 1;
  // ---------------- session goals (per map) ----------------
  SAVE.goalsBy = SAVE.goalsBy || {};
  function newGoals(map) {
    const sp = G.SPECIES.filter(s => map.species.includes(s.id)).sort((a, b) => b.w8 - a.w8);
    const pool = [{ t: 'Catch 3 fish', k: 'count', n: 3, r: 40 }, { t: 'Catch 6 fish', k: 'count', n: 6, r: 90 },
      { t: 'Land a fish over ' + map.kgGoal + ' kg', k: 'kg', v: map.kgGoal, n: 1, r: 70 }];
    if (sp.length > 1) pool.push({ t: 'Catch 2 different species', k: 'species', n: 2, r: 50 });
    const picks = sp.slice(0, Math.min(sp.length, 4)).sort(() => Math.random() - 0.5).slice(0, 2);
    picks.forEach(s => pool.push({ t: 'Catch a ' + s.name, k: 'sp', ids: [s.id], n: 1, r: Math.round(30 + 400 / (s.w8 + 4)) }));
    const list = []; while (list.length < 3 && pool.length) list.push(Object.assign(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], { p: 0 }));
    return SAVE.goalsBy[map.id] = { list, seen: [] };
  }
  const goalsNow = () => W ? (SAVE.goalsBy[W.map.id] || newGoals(W.map)) : { list: [], seen: [] };
  function renderGoals() {
    const gs = goalsNow();
    $('gTitle').textContent = W ? W.map.name : 'Session';
    $('gList').innerHTML = gs.list.map(g => { const p = Math.min(g.p, g.n); return `<li class="${p >= g.n ? 'done' : ''}"><span>${g.t}</span><b>${p}/${g.n}</b></li>`; }).join('');
  }
  function goalsOnCatch(sp, kg) {
    const gs = goalsNow(); if (!gs.seen.includes(sp.id)) gs.seen.push(sp.id);
    let reward = 0;
    gs.list.forEach(g => {
      if (g.p >= g.n) return;
      if (g.k === 'count' || (g.k === 'sp' && g.ids.includes(sp.id)) || (g.k === 'kg' && kg >= g.v)) g.p++;
      if (g.k === 'species') g.p = gs.seen.length;
      if (g.p >= g.n) { reward += g.r; setTimeout(() => msg('Goal complete: ' + g.t + ' · +' + g.r + ' coins', 3), 2600); }
    });
    SAVE.coins += reward;
    if (gs.list.every(g => g.p >= g.n)) { setTimeout(() => { newGoals(W.map); SAVE.day++; renderGoals(); msg('All goals done. New goals for day ' + SAVE.day, 3); saveAll(); }, 6000); }
    renderGoals();
  }
  $('gHead').onclick = () => { $('goals').classList.toggle('min'); $('gArrow').textContent = $('goals').classList.contains('min') ? '+' : '−'; };
  $('bRepair').onclick = () => {
    if (SAVE.coins < 25) { $('bRepair').textContent = 'Not enough coins'; return; }
    SAVE.coins -= 25; SAVE.wear = { line: 100, rod: 100, reel: 100 }; saveAll(); hudDirty = true; $('bRepair').textContent = 'Tackle repaired';
  };
  // compass
  { const st = $('cStrip'), L = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }; let h = '';
    for (let d = -360; d <= 720; d += 15) { const dd = (d % 360 + 360) % 360; h += L[dd] !== undefined ? `<span style="left:${d * 2}px">${L[dd]}</span>` : `<i style="left:${d * 2}px"></i>`; }
    st.innerHTML = h; }
  function tryNet() {
    if (S.st !== 'fight' || !S.fight || S.net) return;
    const F = S.fight;
    if (F.dist > 4.8) { msg('Too far for the net. Reel it closer', 1.8); return; }
    if (F.stam > 0.4 && F.kg > 0.6) { msg('Still too lively. Tire it out first', 1.8); F.beh = { n: 'run', f: 1.2, lat: (Math.random() < 0.5 ? -1 : 1) * 1.5 }; F.stT = 1.5; G.audio.splash(0.8); splash(fishPos(), 20, 2, 0.6); return; }
    S.net = { t: 0 }; G.audio.splash(0.4);
  }
  const R = G.rig;
  let spot = [0, 2, 0];
  const fwd = yaw => [-Math.sin(yaw), 0, -Math.cos(yaw)];
  function msg(t, d = 3) { const m = $('msg'); m.textContent = t; m.classList.add('on'); S.msgT = d; }
  function setDrag(v) { S.drag = clamp(Math.round(v * 20) / 20, 0.1, 1.1); hudDirty = true; }

  function actionDown() {
    if (!playing || panel) return;
    G.audio.init();
    input.act = true; S.pressT = 0;
    if (S.st === 'idle') { S.st = 'charge'; S.power = 0; S.bail = 1; }
    else if (S.st === 'bite') strike(true);
    else if (S.st === 'wait') { S.reelIn = false; }
    else if (S.st === 'hold' && isTouch) keepFish();
  }
  function actionUp() {
    if (!input.act) return;
    input.act = false;
    if (S.st === 'charge') doCast();
    else if (S.st === 'wait' && S.pressT < 0.22 && !S.reelIn) strike(false);
    S.reelIn = false;
  }
  function doCast() {
    const p = S.power;
    if (p < 0.08) { S.st = 'idle'; S.bail = 0; return; }
    let d = 5 + p * (RTY().cast - 5);
    const f = fwd(cam.yaw);
    let tgt;
    for (; d > 4; d -= 1) { tgt = [spot[0] + f[0] * d, 0, spot[2] + f[2] * d]; if (W.height(tgt[0], tgt[2]) < -0.25) break; }
    if (d <= 4) { msg('Aim at open water'); S.st = 'idle'; S.bail = 0; return; }
    S.cast = { from: null, to: tgt, t: 0, dur: 0.55 + d * 0.022, h: 2 + d * 0.2, d };
    S.st = 'cast'; S.rod.vel = -9; G.audio.cast();
    S.fl.vis = true;
  }
  function landFloat() {
    S.st = 'wait'; S.bail = 0;
    const c = S.cast.to; S.fl.p = [c[0], 0, c[2]]; S.fl.dip = 0.12;
    ripple(c[0], c[2], 1.2); splash([c[0], 0, c[2]], 10, 1.2, 0.5); G.audio.plop(0.8);
    const depth = -W.height(c[0], c[2]);
    S.wait = { bite: 4 + Math.random() * 9 * (depth < 0.8 ? 1.7 : 1), nibT: 1.5 + Math.random() * 2, nibs: Math.floor(Math.random() * 4), win: 0, fish: null, bob: 0 };
    hudDirty = true;
  }
  function chooseFish(x, z) {
    const depth = Math.max(0, -W.height(x, z)), dist = Math.hypot(x - spot[0], z - spot[2]);
    const pool = G.SPECIES.filter(sp => W.map.species.includes(sp.id));
    const ws = pool.map(sp => { let w = sp.w8; if (depth < sp.depth[0]) w *= Math.exp(-(sp.depth[0] - depth) * 1.3); if (depth > sp.depth[1]) w *= Math.exp(-(depth - sp.depth[1]) * 0.7); return w; });
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), k = 0;
    for (; k < ws.length - 1; k++) { r -= ws[k]; if (r <= 0) break; }
    const sp = pool[k];
    let kg = sp.kg[0] + (sp.kg[1] - sp.kg[0]) * Math.pow(Math.random(), 2.4) * (0.8 + 0.35 * Math.min(1, dist / 45));
    kg = Math.min(sp.kg[1], kg);
    return { sp, kg };
  }
  function strike(hit) {
    S.rod.vel = 7; G.audio.strike();
    if (hit && S.wait.fish) {
      const { sp, kg } = S.wait.fish, good = S.wait.win > S.wait.winMax * 0.45;
      const ang = Math.atan2(-(S.fl.p[0] - spot[0]), -(S.fl.p[2] - spot[2]));
      S.fight = { sp, kg, dist: Math.hypot(S.fl.p[0] - spot[0], S.fl.p[2] - spot[2]), ang, tension: 0.4, stam: 1, beh: null, stT: 0, slackT: 0, breakT: 0, hookGood: good, dragSlip: 0, depth: 0.8 };
      pickBeh(); S.st = 'fight'; G.fishAsset(sp);
      msg(good ? 'Fish on!' : 'Fish on! Light hook-set, keep it tight', 2.2);
      splash(S.fl.p, 16, 1.6, 0.6); ripple(S.fl.p[0], S.fl.p[2], 1.6); G.audio.splash(0.5);
    } else {
      S.fl.p = v3.lerp(S.fl.p, [spot[0], 0, spot[2]], 1.6 / Math.max(2, v3.dist(S.fl.p, [spot[0], 0, spot[2]])));
      ripple(S.fl.p[0], S.fl.p[2], 0.8);
      if (S.st === 'wait' && Math.hypot(S.fl.p[0] - spot[0], S.fl.p[2] - spot[2]) < 4) toIdle();
      else msg('Nothing there. Strike when the float goes under', 2.2);
    }
  }
  function pickBeh() {
    const F = S.fight, r = Math.random();
    if (F.stam < 0.15) { F.beh = { n: 'tired', f: 0.22, lat: (Math.random() - 0.5) * 0.6 }; F.stT = 1.5 + Math.random() * 2; }
    else if (r < 0.3 + 0.25 * F.stam) { F.beh = { n: 'run', f: 1.0 + Math.random() * 0.35, lat: (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 1.6) }; F.stT = 1.2 + Math.random() * 2.4; }
    else if (r < 0.82) { F.beh = { n: 'hold', f: 0.5 + Math.random() * 0.2, lat: (Math.random() - 0.5) * 1.4 }; F.stT = 1 + Math.random() * 2; }
    else { F.beh = { n: 'shake', f: 0.75, lat: 0 }; F.stT = 0.9; }
    if (F.sp.jump && F.stam > 0.3 && F.dist < 35 && !S.jump && Math.random() < F.sp.jump * 0.45) {
      S.jump = { t: 0, dur: 0.9 + Math.random() * 0.4, h: 0.5 + Math.random() * 0.6 + F.kg * 0.03, dir: Math.random() < 0.5 ? -1 : 1 };
      splash(fishPos(), 30, 2.4, 0.8); G.audio.splash(1);
    }
  }
  const fishPos = () => { const F = S.fight; return [spot[0] - Math.sin(F.ang) * F.dist, 0, spot[2] - Math.cos(F.ang) * F.dist]; };
  function lose(why) {
    const m = { snap: 'SNAP! The line broke. Lower the drag when it runs', slack: 'The fish threw the hook. Keep the line tight', spool: 'It stripped all your line', jump: 'It shook the hook on the jump' }[why];
    if (why === 'snap') G.audio.snap();
    msg(m, 3.5); S.fight = null; S.jump = null; S.net = null; S.fl.vis = false; S.st = 'idle'; S.bail = 0; useBait(); hudDirty = true; saveAll();
  }
  function useBait() {
    SAVE.bait--;
    if (SAVE.bait <= 0) { const cost = Math.min(SAVE.coins, 20); SAVE.coins -= cost; SAVE.bait = 20; setTimeout(() => msg('Out of worms. Bought 20 more for ' + cost + ' coins', 2.5), 1200); }
  }
  function toIdle() { S.st = 'idle'; S.fl.vis = false; S.fight = null; S.wait = null; S.bail = 0; hudDirty = true; }
  function landFish() {
    const F = S.fight, len = G.fishLength(F.sp, F.kg);
    const fw = fwd(cam.yaw), Lm = len / 100;
    S.hold = { sp: F.sp, kg: F.kg, len, t: 0, flop: 0, rel: 0 };
    const fp0 = fishPos();
    S.st = 'hold'; S.fight = null; S.jump = null; S.fl.vis = false;
    splash(fp0, 20, 1.8, 0.6); G.audio.splash(0.6);
    useBait(); goalsOnCatch(F.sp, F.kg);
    const L = SAVE.log[F.sp.id], first = !L, rec = L && F.kg > L.best;
    SAVE.log[F.sp.id] = { n: (L ? L.n : 0) + 1, best: Math.max(L ? L.best : 0, F.kg), len: Math.max(L ? L.len : 0, len) };
    const val = Math.round(F.sp.val * F.kg * (1 + 0.4 * F.kg / F.sp.kg[1]) + 6);
    S.hold.val = val;
    $('cTag').textContent = first ? 'New species' : rec ? 'Personal best' : 'Landed';
    $('cTag').className = 'tag' + (first || rec ? ' hot' : '');
    $('cName').textContent = F.sp.name;
    $('cKg').textContent = F.kg < 1 ? Math.round(F.kg * 1000) + ' g' : F.kg.toFixed(2) + ' kg';
    $('cLen').textContent = Math.round(len) + ' cm';
    $('cVal').textContent = val + ' coins';
    $('cHint').textContent = rec ? 'Previous best ' + L.best.toFixed(2) + ' kg' : first ? 'Added to your fish log' : 'Best ' + SAVE.log[F.sp.id].best.toFixed(2) + ' kg';
    $('catch').classList.toggle('left', Q.hand === 'goofy'); $('catch').classList.add('on'); $('goals').classList.add('hideH');
    saveAll(); hudDirty = true;
  }
  function keepFish() {
    if (S.st !== 'hold') return;
    if (S.keepKg + S.hold.kg > 25) { msg('Keepnet full. Release this one', 2.2); return; }
    S.keepKg += S.hold.kg; SAVE.coins += S.hold.val; SAVE.kept++; saveAll(); G.audio.coin();
    msg('Kept · +' + S.hold.val + ' coins', 2.5);
    $('catch').classList.remove('on'); $('goals').classList.remove('hideH'); S.hold = null; toIdle();
  }
  function releaseFish() {
    if (S.st !== 'hold') return;
    $('catch').classList.remove('on'); $('goals').classList.remove('hideH');
    S.hold.rel = 0.001; S.st = 'release'; msg('Released', 2);
  }
  $('bKeep').onclick = keepFish; $('bRel').onclick = releaseFish;

  // ---------------- effects ----------------
  const parts = [], rips = [];
  const ripArr = new Float32Array(64);
  function ripple(x, z, a) { rips.push([x, z, 0, a]); if (rips.length > 16) rips.shift(); }
  function splash(p, n, sp, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, h = Math.random();
      parts.push({ p: [p[0] + Math.cos(a) * 0.1, 0.02, p[2] + Math.sin(a) * 0.1], v: [Math.cos(a) * sp * (0.2 + Math.random() * 0.5), sp * (0.8 + h * 1.2), Math.sin(a) * sp * (0.2 + Math.random() * 0.5)], life: 0, max: 0.6 + Math.random() * 0.5, s: size * (0.4 + Math.random()) });
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }

  // ---------------- HUD ----------------
  let hudDirty = true, hudT = 0;
  const hints = {
    idle: 'Hold <b>Left click</b> to cast · aim with the mouse',
    charge: 'Release to cast',
    cast: '',
    wait: 'Wait for <b>Strike</b> · <b>Hold click</b> to reel in · <b>Shift</b> zoom',
    bite: '<b>Click</b> to strike!',
    fight: '<b>Hold click</b> reel · <b>Right click</b> lift · <b>Wheel</b> drag · <b>N</b> net',
    hold: '<b>K</b> keep · <b>X</b> release',
    release: ''
  };
  const fmtKg = k => k < 1 ? Math.round(k * 1000) + ' g' : k.toFixed(2) + ' kg';
  function hud(dt) {
    hudT -= dt;
    const st = S.st, F = S.fight;
    $('pow').classList.toggle('on', st === 'charge');
    if (st === 'charge') { $('powI').style.width = (S.power * 100) + '%'; $('powT').textContent = Math.round(5 + S.power * (RTY().cast - 5)) + ' m'; }
    if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0) $('msg').classList.remove('on'); }
    // compass every frame
    const head = ((-cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('cStrip').style.transform = `translateX(${-head * 2}px)`;
    const fishing = st === 'wait' || st === 'bite' || st === 'fight';
    if (fishing || st === 'cast') {
      const p = F ? fishPos() : S.fl.p, b = ((Math.atan2(p[0] - spot[0], -(p[2] - spot[2])) * 180 / Math.PI) + 360) % 360;
      let d = b - head; d = ((d + 540) % 360) - 180;
      const w = $('compass').clientWidth / 2;
      $('cMark').style.display = Math.abs(d * 2) < w ? 'block' : 'none'; $('cMark').style.left = (w + d * 2) + 'px';
    } else $('cMark').style.display = 'none';
    // float widget every frame
    $('floatW').classList.toggle('on', fishing || st === 'cast');
    const bobY = st === 'fight' ? 60 : clamp((S.fl.dip + S.fl.under) * 260 + Math.sin(S.t * 2.1) * 1.5, -2, 60);
    $('fwBob').style.transform = `translateY(${bobY}px) rotate(${st === 'bite' ? Math.sin(S.t * 18) * 8 : S.fl.tilt[0] * 40}deg)`;
    $('fwBob').style.opacity = st === 'fight' ? 0.35 : 1;
    if (F) {
      const t = Math.min(1.1, F.tension) / 1.1, th = $('tFill').parentNode.clientHeight, tw = $('tHf').parentNode.clientWidth;
      $('tFill').style.height = (t * 100) + '%'; $('tFill').style.background = t < 0.6 ? '#4fc36a' : t < 0.82 ? '#f2c94c' : '#ff4b3e'; void th;
      $('tHf').style.setProperty('--tw', tw + 'px'); $('tHf').style.width = (t * 100) + '%';
    }
    if (hudT > 0 && !hudDirty) return;
    hudT = 0.1; hudDirty = false;
    $('coins').textContent = SAVE.coins; $('kept').textContent = S.keepKg.toFixed(2); $('baitN').textContent = SAVE.bait; $('day').textContent = SAVE.day;
    const hk = isTouch ? '' : hints[st] || '';
    if ($('keys').dataset.k !== st) { $('keys').innerHTML = hk; $('keys').dataset.k = st; }
    const near = F && F.dist < 4.8;
    $('tAct').textContent = { idle: 'Cast', charge: 'Release', wait: 'Reel', bite: 'Strike!', fight: 'Reel', hold: 'Keep', cast: '…', release: '…' }[st] || 'Cast';
    $('touch').classList.toggle('fight', st === 'fight');
    $('tNet').classList.toggle('on', !!near);
    let lab = 'Ready', cls = '';
    if (st === 'cast') lab = 'Cast';
    else if (st === 'wait') lab = S.wait && S.fl.dip > 0.02 ? 'Nibble' : 'Wait';
    else if (st === 'bite') { lab = 'Strike!'; cls = 'strike'; }
    else if (st === 'fight') { lab = S.net ? 'Netting' : near ? 'Net it!' : F && F.dragSlip > 0 ? 'Running' : 'Reel'; cls = near ? 'net' : ''; }
    $('fwLab').textContent = lab; $('fwLab').className = cls;
    $('stamW').classList.toggle('on', !!F); if (F) $('stamI').style.width = (F.stam * 100) + '%';
    $('tens').classList.toggle('on', fishing); $('lineOut').classList.toggle('on', fishing);
    $('tDrag').style.bottom = (S.drag / 1.1 * 100) + '%';
    $('dragT').textContent = Math.round(S.drag * 100) + '%';
    $('dArc').setAttribute('stroke-dasharray', (S.drag / 1.1 * 100) + ' 100');
    const W0 = SAVE.wear;
    $('wLine').textContent = Math.round(W0.line) + '%'; $('wRod').textContent = Math.round(W0.rod) + '%'; $('wReel').textContent = Math.round(W0.reel) + '%';
    const ten = F ? F.tension : 0;
    if (!F) { $('tFill').style.height = '0%'; $('tHf').style.width = '0%'; }
    $('tH').classList.toggle('on', fishing); $('tHd').style.left = (S.drag / 1.1 * 100) + '%'; $('tHkg').textContent = (ten * S.lineKg).toFixed(1) + ' kg';
    $('tKg').textContent = (ten * S.lineKg).toFixed(1);
    $('gLine').className = 'g' + (ten > 0.92 ? ' bad' : ten > 0.75 ? ' warn' : '');
    $('gRod').className = 'g' + (input.lift && ten > 0.7 ? ' bad' : ten > 0.85 ? ' warn' : '');
    $('gReel').className = 'g' + (F && F.dragSlip > 0 ? ' warn' : '');
    $('slip').classList.toggle('on', !!(F && F.dragSlip > 0));
    const out = F ? F.dist : Math.hypot(S.fl.p[0] - spot[0], S.fl.p[2] - spot[2]);
    $('outT').textContent = out.toFixed(0); $('capT').textContent = '/ ' + RTY().cap + ' m';
    const fp = F ? fishPos() : S.fl.p;
    $('depT').textContent = Math.max(0, -W.height(fp[0], fp[2])).toFixed(1);
  }

  // ---------------- update ----------------
  let rigOut = null, curCamW = null;
  function update(dt) {
    S.t += dt; U.uTime = S.t;
    if (mode !== 'play') { menuUpdate(dt); return; }
    const st = S.st;
    if (input.act) S.pressT += dt;
    // camera
    if (false) {
      cam.ty += (S.hold.yaw - cam.ty) * Math.min(1, dt * 3); cam.tp += (S.hold.pitch - cam.tp) * Math.min(1, dt * 3);
    }
    cam.ty = clamp(cam.ty, W.yaw0 - 1.7, W.yaw0 + 1.7); cam.tp = clamp(cam.tp, -0.85, 0.55);
    const py = cam.yaw, pp = cam.pitch;
    cam.yaw += (cam.ty - cam.yaw) * Math.min(1, dt * 10); cam.pitch += (cam.tp - cam.pitch) * Math.min(1, dt * 10);
    cam.lag[0] += ((cam.yaw - py) / Math.max(dt, 1e-3) * 0.012 - cam.lag[0]) * Math.min(1, dt * 6);
    cam.lag[1] += ((cam.pitch - pp) / Math.max(dt, 1e-3) * 0.012 - cam.lag[1]) * Math.min(1, dt * 6);
    cam.zoom += ((input.zoom && (st === 'wait' || st === 'bite' || st === 'fight') ? 1 : 0) - cam.zoom) * Math.min(1, dt * 5);
    cam.pos = [spot[0] + Math.sin(S.t * 0.6) * 0.004, spot[1] + Math.sin(S.t * 1.1) * 0.006, spot[2]];
    if (W.boat) { const b = boatState(); cam.pos[1] += b.h; cam.lag[1] += (b.pitch - (S.bp || 0)) * 0.3; S.bp = b.pitch; }

    let rodPitch = 0.02, rodBend = 0.02, reeling = false;
    if (st === 'charge') { S.power = Math.min(1, S.power + dt * 0.85); rodPitch = 0.35 + S.power * 1.05; }
    else if (st === 'cast') {
      const c = S.cast; c.t += dt;
      if (!c.from) c.from = S.fl.p.slice();
      const s = Math.min(1, c.t / c.dur);
      S.fl.p = v3.lerp(c.from, c.to, s); S.fl.p[1] = c.from[1] * (1 - s) + Math.sin(s * Math.PI) * c.h * (1 - s * 0.3);
      rodPitch = -0.28 + s * 0.3;
      if (s >= 1) landFloat();
    } else if (st === 'wait' || st === 'bite') {
      const w = S.wait;
      if (input.act && S.pressT > 0.22) {
        S.reelIn = true; reeling = true;
        const d = Math.hypot(S.fl.p[0] - spot[0], S.fl.p[2] - spot[2]);
        const k = Math.min(1, 1.9 * dt / Math.max(d, 0.1));
        S.fl.p[0] += (spot[0] - S.fl.p[0]) * k; S.fl.p[2] += (spot[2] - S.fl.p[2]) * k;
        if (Math.random() < dt * 4) ripple(S.fl.p[0], S.fl.p[2], 0.3);
        if (d < 3.5 || W.height(S.fl.p[0], S.fl.p[2]) > -0.1) { toIdle(); }
        if (S.st === 'bite') { S.st = 'wait'; w.fish = null; }
      } else if (st === 'wait') {
        w.bite -= dt; w.nibT -= dt;
        if (w.nibs > 0 && w.nibT <= 0 && w.bite > 1.2) { w.nibs--; w.nibT = 0.6 + Math.random() * 1.6; S.fl.dip = 0.035 + Math.random() * 0.03; ripple(S.fl.p[0], S.fl.p[2], 0.35); G.audio.flop(); }
        if (w.bite <= 0) {
          w.fish = chooseFish(S.fl.p[0], S.fl.p[2]);
          w.winMax = w.win = 1.25 - w.fish.sp.str * 0.35; S.st = 'bite';
          ripple(S.fl.p[0], S.fl.p[2], 0.9); G.audio.plop(0.5);
          w.dir = Math.random() * 6.283;
        }
      } else {
        w.win -= dt;
        S.fl.p[0] += Math.cos(w.dir) * 0.25 * dt; S.fl.p[2] += Math.sin(w.dir) * 0.25 * dt;
        if (w.win <= 0) { if (Math.random() < 0.4) useBait(); S.st = 'wait'; w.fish = null; w.bite = 3 + Math.random() * 8; w.nibs = Math.floor(Math.random() * 3); msg('Missed! Strike as soon as the float goes under', 2.5); }
      }
      if (S.st === 'wait' || S.st === 'bite') rodPitch = 0.04;
      rodBend = 0.03;
    } else if (st === 'fight') {
      reeling = input.act;
      fightStep(dt, reeling, input.lift);
      const F = S.fight;
      if (F) {
        rodPitch = 0.3 + (input.lift ? 0.35 : 0) + F.tension * 0.1; rodBend = F.tension * 0.95;
        const fp = fishPos(), tp = v3.norm([spot[0] - fp[0], 0, spot[2] - fp[2]]);
        const want = v3.madd(fp, tp, Math.min(1.4, F.dist * 0.4));
        S.fl.p[0] += (want[0] - S.fl.p[0]) * Math.min(1, dt * 6); S.fl.p[2] += (want[2] - S.fl.p[2]) * Math.min(1, dt * 6);
        S.fl.under = S.jump ? 0 : clamp(F.tension * 0.12, 0, 0.09);
        if (Math.random() < dt * 3) ripple(S.fl.p[0], S.fl.p[2], 0.25 + F.tension * 0.3);
      }
    } else if (st === 'hold') {
      const H = S.hold; H.t += dt; H.flop -= dt;
      if (H.flop <= 0) { H.flop = 1.2 + Math.random() * 2.5; H.fl = 1; G.audio.flop(); }
      H.fl = (H.fl || 0) * Math.exp(-dt * 2.5);
      rodPitch = 0.85; rodBend = 0.03;
    } else if (st === 'release') {
      const H = S.hold; H.rel += dt; rodPitch = 0.85;
      if (H.rel > 0.75) { const p = H.wpos || H.pos || fishPos(); splash([p[0], 0, p[2]], 14, 1.4, 0.5); ripple(p[0], p[2], 1.2); G.audio.splash(0.5); S.hold = null; toIdle(); }
    }
    // rod spring
    S.rod.vel += ((rodPitch - S.rod.pitch) * 140 - S.rod.vel * 16) * dt;
    S.rod.pitch += S.rod.vel * dt;
    S.rod.bend += (rodBend - S.rod.bend) * Math.min(1, dt * 8);
    S.rod.out = (S.rod.out || 0) + (0 - (S.rod.out || 0)) * Math.min(1, dt * 4);
    S.rod.lift += ((input.lift && st === 'fight' ? 1 : 0) - S.rod.lift) * Math.min(1, dt * 6);
    // crank
    const crankTarget = reeling ? (S.fight && S.fight.dragSlip > 0 ? 6 : 14) : 0;
    S.crankV += (crankTarget - S.crankV) * Math.min(1, dt * 10);
    const before = Math.floor(S.crank / 0.5);
    S.crank += S.crankV * dt;
    if (Math.floor(S.crank / 0.5) !== before) G.audio.click(0.8);
    S.rod.grab += ((st === 'charge' || st === 'cast' ? 0 : 1) - S.rod.grab) * Math.min(1, dt * 6);
    // float bob
    if (S.fl.vis && st !== 'cast') {
      S.fl.dip *= Math.exp(-dt * 6);
      if (st !== 'fight') { const under = st === 'bite' ? 0.22 : 0; S.fl.under += (under - S.fl.under) * Math.min(1, dt * (st === 'bite' ? 9 : 4)); }
      const p = S.fl.p;
      p[1] = Math.sin(S.t * 2.1 + p[0]) * 0.006 + Math.sin(S.t * 3.3 + p[2]) * 0.004 - S.fl.dip - S.fl.under + G.wave(p[0], p[2], S.t, W.map.waterP.swell);
      const fl = W.map.waterP.flow;
      if ((st === 'wait' || st === 'bite') && (fl[0] || fl[1])) {
        p[0] += fl[0] * 0.55 * dt; p[2] += fl[1] * 0.55 * dt;
        if (st === 'wait' && (Math.hypot(p[0] - spot[0], p[2] - spot[2]) < 4 || W.height(p[0], p[2]) > -0.15)) { toIdle(); msg('Drifted back. Cast again', 1.8); }
      }
      S.fl.tilt = [Math.sin(S.t * 1.7) * 0.06, Math.cos(S.t * 1.3) * 0.06];
      if (st === 'wait' && Math.random() < dt * 0.4) ripple(p[0], p[2], 0.15);
    }
    // effects
    for (const r of rips) { r[2] += dt * 0.75; r[3] *= Math.exp(-dt * 0.9); }
    while (rips.length && rips[0][3] < 0.01) rips.shift();
    ripArr.fill(0); rips.forEach((r, i) => ripArr.set(r, i * 4));
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life += dt; q.v[1] -= 9.8 * dt; q.p = v3.madd(q.p, q.v, dt);
      if (q.life > q.max || q.p[1] < -0.05) parts.splice(i, 1);
    }
    hud(dt);
  }
  function fightStep(dt, reeling, lifting) {
    const F = S.fight, sp = F.sp;
    F.stT -= dt; if (F.stT <= 0) pickBeh();
    const kgF = 0.35 + 0.9 * Math.sqrt(F.kg / sp.kg[1]);
    let pull = sp.str * kgF * F.beh.f * (0.3 + 0.7 * F.stam);
    if (S.jump) pull *= 0.2;
    let target = reeling ? pull + 0.24 : pull * 0.85;
    if (lifting) target += 0.18;
    F.tension += (target - F.tension) * Math.min(1, dt * 5);
    F.dragSlip = 0;
    if (F.tension > S.drag) { F.dragSlip = F.tension - S.drag; F.tension = S.drag + F.dragSlip * 0.12; }
    const Wr = SAVE.wear, brk = 1.0 - (100 - Wr.line) / 260;
    if (F.tension > 0.88) Wr.line = Math.max(0, Wr.line - dt * 2.2 * (F.tension - 0.85) * 10);
    if (lifting && F.tension > 0.7) Wr.rod = Math.max(0, Wr.rod - dt * 0.6);
    if (F.dragSlip > 0) Wr.reel = Math.max(0, Wr.reel - dt * 0.25);
    if (F.tension > brk) { F.breakT += dt; if (F.breakT > 0.2) return lose('snap'); } else F.breakT = 0;
    if (F.dragSlip > 0) { F.dist += Math.min(4.5, F.dragSlip * 7 + 0.4) * dt; G.audio.drag(30 + F.dragSlip * 60, dt); }
    else if (reeling) F.dist -= RTY().reel2 * (1 - 0.55 * Math.min(1, pull)) * (lifting ? 1.25 : 1) * dt;
    const oa = F.ang;
    F.ang += F.beh.lat * (0.4 + pull) * dt / Math.max(F.dist, 3);
    const p = fishPos();
    if (W.height(p[0], p[2]) > -0.35) { F.ang = oa; F.beh.lat *= -1; }
    F.stam = Math.max(0, F.stam - dt * (0.015 + 0.09 * F.tension * (lifting ? 1.4 : 1) + (F.beh.n === 'run' ? 0.025 : 0)) / (0.5 + 0.35 * Math.min(Math.sqrt(F.kg), 4.5)));
    if (F.tension < 0.07 && !S.jump) F.slackT += dt; else F.slackT = Math.max(0, F.slackT - dt);
    if (F.slackT > (F.hookGood ? 3.5 : 2.2)) return lose('slack');
    if (S.jump) {
      const J = S.jump; J.t += dt;
      if (J.t >= J.dur) { const fp = fishPos(); splash(fp, 26, 2.0, 0.7); ripple(fp[0], fp[2], 1.8); G.audio.splash(0.9); S.jump = null; if (F.tension < 0.12 && Math.random() < 0.3) return lose('jump'); }
    }
    if (F.beh.n !== 'tired' && F.dist < 25 && Math.random() < dt * (F.beh.n === 'shake' ? 6 : 1.2) * F.stam) { const fp = fishPos(); splash(fp, 5, 1.2, 0.35); ripple(fp[0], fp[2], 0.6); }
    F.depth = (0.25 + Math.min(1.5, F.dist * 0.05) * (0.4 + 0.6 * F.stam)) * (W.map.water === 'salt' ? 1.6 : 1);
    if (F.dist > RTY().cap) return lose('spool');
    if (S.net) {
      S.net.t += dt; F.dist = Math.max(2.6, F.dist - dt * 1.5); F.tension = 0.25;
      if (S.net.t > 1.25) { S.net = null; landFish(); }
      return;
    }
    if (F.dist < 2.8) { F.dist = 2.8; if (F.kg < 0.5) { landFish(); return; } if (!F.netHint) { F.netHint = true; msg(isTouch ? 'Tap Net to land it' : 'Press N to net it', 2); } }
  }

  // ---------------- line geometry ----------------
  function lineRibbon(pts, pxA) {
    const n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = new Uint32Array((n - 1) * 6);
    for (let i = 0; i < n; i++) {
      const p = pts[i], t = v3.norm(v3.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      const toC = v3.sub(cam.pos, p), d = v3.len(toC), sd = v3.norm(v3.cross(t, toC));
      const lw = RTY().lineW, wPhys = 0.00018 * lw, wPx = d * pxA * 0.55 * Math.min(lw, 1.6), w = Math.max(wPhys, wPx);
      const a = Math.min(0.9, 0.9 * Math.max(wPhys, wPx * 0.7) / wPx);
      pos.set(v3.madd(p, sd, w), i * 6); pos.set(v3.madd(p, sd, -w), i * 6 + 3);
      uv.set([a, 0, a, 0], i * 4);
      if (i < n - 1) idx.set([i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2], i * 6);
    }
    return { pos, uv, idx };
  }

  // ---------------- render ----------------
  const ident = m4.ident();
  const SCL = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function fishModel(L, x, y, p) { const z = v3.cross(x, y); return m4.basis(v3.mul(x, L), v3.mul(y, L), v3.mul(z, L), p); }
  function worldFish() {
    // returns {asset, model, phase, amp} or null
    if (S.st === 'fight' && S.fight) {
      const F = S.fight, a = G.fishAsset(F.sp), L = G.fishLength(F.sp, F.kg) / 100, fp = fishPos();
      const away = v3.norm([fp[0] - spot[0], 0, fp[2] - spot[2]]);
      const swim = v3.norm(v3.add(away, v3.mul([away[2], 0, -away[0]], F.beh.lat * 0.4)));
      if (S.net) {
        const np = netPose(), xd = np.right;
        return { a, m: fishModel(Math.min(L, 0.7), xd, [0, 1, 0], v3.add(v3.madd(np.p, xd, -Math.min(L, 0.7) * 0.5), [0, -0.08, 0])), ph: S.t * 20, amp: 0.14 };
      }
      if (S.jump) {
        const J = S.jump, s = J.t / J.dur, y = Math.sin(s * Math.PI) * J.h - 0.15;
        const lat = v3.mul([away[2], 0, -away[0]], J.dir);
        const xd = v3.norm(v3.add(v3.mul(lat, -1), [0, -Math.cos(s * Math.PI) * 1.2, 0]));
        const yd0 = v3.norm(v3.cross(xd, v3.cross([0, 1, 0], xd)));
        const yd = v3.norm(v3.rot(yd0, xd, Math.sin(s * 9) * 0.5));
        const ctr = v3.add(v3.madd(fp, lat, (s - 0.5) * L * 1.2), [0, y, 0]);
        return { a, m: fishModel(L, xd, yd, v3.madd(ctr, xd, -L * 0.5)), ph: S.t * 22, amp: 0.12 };
      }
      if (F.dist > 9 && !S.net) return null;
      const xd = v3.mul(swim, -1), nose = v3.add(fp, [0, -F.depth, 0]);
      return { a, m: fishModel(L, xd, [0, 1, 0], v3.madd(nose, xd, -L * 0.5)), ph: S.t * (8 + F.beh.f * 8), amp: 0.06 + F.beh.f * 0.05 };
    }
    if ((S.st === 'hold' || S.st === 'release') && S.hold && curCamW) {
      const H = S.hold, a = G.fishAsset(H.sp), hp = holdPose();
      let nose = hp.nose;
      if (S.st === 'release') nose = v3.add(nose, [0, -H.rel * H.rel * 3.5, -H.rel * 0.5]);
      const noseW = m4.tp(curCamW, nose), xW = m4.td(curCamW, hp.x), yW = m4.td(curCamW, hp.y);
      H.pos = noseW; H.wpos = v3.madd(noseW, xW, hp.L * 0.5);
      return { a, m: fishModel(hp.L, xW, yW, noseW), ph: S.t * 13, amp: 0.025 + (H.fl || 0) * 0.13 };
    }
    return null;
  }
  // fish hanging from a lip-grip tool beside the rod, nose up, slowly turning (camera space)
  function holdPose() {
    const H = S.hold, L = H.len / 100, side = Q.hand === 'goofy' ? 1 : -1;
    const th = H.t * 0.42 + 0.2, ang = th - 0.42 * Math.sin(2 * th);
    const sw = Math.sin(H.t * 1.3) * 0.05 + (H.fl || 0) * Math.sin(H.t * 17) * 0.06;
    const x = v3.norm([Math.sin(sw) * 0.5, -1, Math.sin(sw * 0.7) * 0.3]);
    const y = v3.norm([Math.cos(ang), 0, -Math.sin(ang)]);
    const yo = v3.norm(v3.sub(y, v3.mul(x, v3.dot(y, x))));
    const nose = [side * (0.15 + L * 0.1), 0.12 + L * 0.3, -(0.46 + L * 0.85)];
    return { nose, x, y: yo, L };
  }
  function gripperData(hp) {
    const mb = new G.MB(), n = hp.nose, up = v3.mul(hp.x, -1);
    const jaw = v3.madd(n, hp.x, hp.L * 0.012);
    mb.c(G.lin('#b9bec4'), 3); mb.torus(jaw, hp.y, 0.011, 0.0025, 14, 5);
    const top = v3.madd(jaw, up, 0.05);
    mb.cyl(v3.madd(jaw, up, 0.01), top, 0.0035, 0.0035, 8, true);
    mb.torus(v3.madd(top, up, 0.022), v3.cross(up, hp.y), 0.02, 0.0035, 18, 6);
    mb.c(G.lin('#2b2e33'), 3); mb.cyl(v3.madd(top, up, 0.044), v3.madd(top, up, 0.09), 0.007, 0.007, 10, true);
    mb.c(G.lin('#111214'), 8); mb.cyl(v3.madd(top, up, 0.09), v3.add(v3.madd(top, up, 0.5), [0, 0, 0.12]), 0.016, 0.018, 12, true);
    mb.c(G.lin('#d4a72c'), 6); mb.cyl(v3.madd(top, up, 0.09), v3.madd(top, up, 0.1), 0.019, 0.019, 12, true);
    return mb.build();
  }
  function netPose() {
    const fp = fishPos(), t = S.net.t;
    const toC = v3.norm([cam.pos[0] - fp[0], 0, cam.pos[2] - fp[2]]), right = v3.cross([0, 1, 0], toC);
    const start = v3.add(cam.pos, v3.add(v3.mul(toC, -0.5), v3.add(v3.mul(right, 0.5), [0, -1.5, 0])));
    const under = [fp[0], -0.28, fp[2]], lift = [fp[0] + toC[0] * 0.9, 1.0, fp[2] + toC[2] * 0.9];
    const p = t < 0.55 ? v3.lerp(start, under, smooth(0, 0.55, t)) : v3.lerp(under, lift, smooth(0.6, 1.25, t));
    return { p, toC, right };
  }
  function drawFish(fd, VP) {
    if (!fd) return;
    G.use(P.fish, U, { uVP: VP, uModel: fd.m, uPhase: fd.ph, uAmp: fd.amp, uTex: 0, uFin: fd.a.fin, uSheen: fd.a.sp.sheen, uWet: 1 });
    G.bindTex(0, fd.a.tex); G.draw(fd.a.mesh);
  }
  function dangle() { return mode === 'play' && (S.st === 'idle' || S.st === 'charge'); }
  const floatScale = p => (W.map.float === 'balloon' ? 1 : 1.5) * clamp(v3.dist(p, cam.pos) / 14, 1, 3.2) * (1 - cam.zoom * 0.45);
  const floatTop = p => G.rig.FLOAT_TOP[W.map.float] * floatScale(p);
  // boat motion (offshore): heave, roll and pitch from the swell
  function boatState() {
    const A = W.map.waterP.swell, t = S.t, e = 1.5;
    const h = G.wave(0, 0, t, A), hx = (G.wave(e, 0, t, A) - G.wave(-e, 0, t, A)) / (2 * e), hz = (G.wave(0, e, t, A) - G.wave(0, -e, t, A)) / (2 * e);
    return { h, roll: Math.atan(hz) * 0.8, pitch: Math.atan(hx) * 0.6 };
  }
  function boatModel() {
    const b = boatState();
    let M0 = m4.basis([Math.cos(b.pitch), Math.sin(b.pitch), 0], [-Math.sin(b.pitch), Math.cos(b.pitch), 0], [0, 0, 1], [0, 0.38 + b.h, 0]);
    const cr = Math.cos(b.roll), sr = Math.sin(b.roll);
    return m4.mul(M0, new Float32Array([1, 0, 0, 0, 0, cr, sr, 0, 0, -sr, cr, 0, 0, 0, 0, 1]));
  }
  function charModel() {
    const ground = spot[1] - 1.62, br = 1 + Math.sin(S.t * 1.6) * 0.006, yaw = W.yaw0 + Math.sin(S.t * 0.4) * 0.05;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let base = m4.basis([c, 0, -s], [0, br, 0], [s, 0, c], [spot[0], ground, spot[2]]);
    if (W.boat) base = m4.mul(boatModel(), m4.mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, spot[0], ground - 0.38, spot[2], 1]), m4.basis([c, 0, -s], [0, br, 0], [s, 0, c], [0, 0, 0])));
    return base;
  }
  function floatModel() {
    const p = S.fl.p, tz = S.fl.tilt[0], tx2 = S.fl.tilt[1];
    const s = floatScale(p);
    let up = v3.norm([tz, 1, tx2]);
    if (S.st === 'cast') up = [0, 1, 0];
    const r = v3.norm(v3.cross(up, [0, 0, 1])), b = v3.cross(r, up);
    return m4.basis(v3.mul(r, s), v3.mul(up, s), v3.mul(b, s), p);
  }
  function drawWorld(VP, invVP, refl) {
    // sky
    gl.depthMask(false); gl.bindVertexArray(G.emptyVao);
    G.use(P.sky, U, { uInvVP: invVP }); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    G.use(P.terrain, U, { uVP: VP }); G.draw(W.terrain);
    G.use(P.veg, U, { uVP: VP, uWind: 1, uKind: 0 });
    for (const v of W.veg) { if (refl && !v.refl) continue; G.set(P.veg, { uKind: v.kind }); G.draw(v.mesh); }
    G.use(P.lit, U, { uVP: VP, uModel: ident, uFog: 1, uNight: night }); G.draw(W.statics);
    if (W.boat) { G.set(P.lit, { uModel: boatModel() }); G.draw(W.boat); }
    if (mode === 'home' || mode === 'maps') { G.set(P.lit, { uModel: charModel(), uFill: refl ? 0.3 : 0.62 }); G.draw(charMesh); G.set(P.lit, { uFill: 0 }); }
    if (mode === 'play' && (S.fl.vis || dangle())) { G.set(P.lit, { uModel: floatModel() }); G.draw(floatMeshes[W.map.float]); }
    if (S.net && S.fight) { const np = netPose(); G.use(P.lit, { uModel: m4.basis(np.right, [0, 1, 0], np.toC, np.p) }); G.draw(netMesh); }
    const held = S.st === 'hold' || S.st === 'release';
    const fd = held ? null : worldFish(); if (fd && (!refl || fd.m[13] > -0.2)) drawFish(fd, VP);
  }
  function render() {
    if (!W) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0.04, 0.05, 0.06, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    // camera
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const f = [-sy * cp, sp, -cy * cp], r = [cy, 0, -sy], u = v3.cross(r, f);
    const camW = m4.basis(r, u, v3.mul(f, -1), cam.pos), view = m4.invert(camW);
    const fovDeg = (mode === 'home' ? (RW < RH ? 60 : 38) : (RW < RH ? 70 : 55)) * (1 - cam.zoom) + 20 * cam.zoom;
    const fov = fovDeg * Math.PI / 180, asp = RW / RH;
    const proj = m4.persp(fov, asp, 0.3, 9000), projR = m4.persp(fov, asp, 0.01, 80);
    const VP = m4.mul(proj, view);
    const viewRot = view.slice(); viewRot[12] = viewRot[13] = viewRot[14] = 0;
    const invVP = m4.invert(m4.mul(proj, viewRot));
    const viewR = m4.mul(view, SCL), VPR = m4.mul(proj, viewR);
    const viewRotR = viewR.slice(); viewRotR[12] = viewRotR[13] = viewRotR[14] = 0;
    const invVPR = m4.invert(m4.mul(proj, viewRotR));

    // rig (camera space -> world)
    const rs = {
      pitch: S.rod.pitch + cam.lag[1] * 0.6, yaw: -cam.lag[0] * 0.6 + (Q.hand === 'goofy' ? 1 : -1) * S.rod.out * 0.75, bend: S.rod.bend, bendDir: [0, -1, 0], crank: S.crank, bail: S.bail, lift: S.rod.lift,
      rodType: W.map.rod, mirror: Q.hand === 'goofy', sx: -cam.lag[0] * 0.05 + Math.sin(S.t * 0.9) * 0.002, sy: -cam.lag[1] * 0.05 + Math.sin(S.t * 1.3) * 0.003, grab: S.rod.grab
    };
    // bend toward line target
    let target = null;
    if (S.st === 'fight' && S.fight) target = fishPos(); else if (S.fl.vis) target = S.fl.p;
    if (S.st === 'hold' || S.st === 'release') target = v3.add(cam.pos, [0, -50, 0]);
    if (target) { const d = m4.td(view, v3.sub(target, cam.pos)); rs.bendDir = v3.norm(d); }
    rs.hold = null;
    curCamW = camW;
    rigOut = R.build(rs);
    rigOut.tipW = m4.tp(camW, rigOut.tip);
    if (dangle()) { const tp = rigOut.tipW, hang = W.map.float === 'balloon' ? 0.9 : 0.62; S.fl.p = [tp[0] + Math.sin(S.t * 1.3) * 0.03, tp[1] - hang, tp[2] + Math.cos(S.t * 1.1) * 0.02]; S.fl.tilt = [Math.sin(S.t * 1.3) * 0.05, 0]; }
    G.update(rigMesh, rigOut.data);

    // line points (world)
    let lpts = null;
    if (mode === 'play' && (S.fl.vis || S.st === 'fight' || S.st === 'charge' || S.st === 'idle')) {
      lpts = rigOut.line.map(p => m4.tp(camW, p));
      const tip = rigOut.tipW;
      let end = null, sag = 0;
      if (S.st === 'fight' && S.fight) { end = v3.add(S.fl.p, [0, floatTop(S.fl.p), 0]); sag = Math.pow(1 - Math.min(1, S.fight.tension * 1.3), 2) * 0.05; }
      else if (S.fl.vis || dangle()) { end = v3.add(S.fl.p, [0, floatTop(S.fl.p), 0]); sag = S.st === 'cast' ? 0.01 : 0.03; }
      else if ((S.st === 'hold' || S.st === 'release') && S.hold && S.hold.pos) { end = S.hold.pos; sag = 0; }
      else { end = v3.add(tip, [0, -0.35, 0]); sag = 0; }
      const len = v3.dist(tip, end), n = 28;
      for (let i = 1; i <= n; i++) { const s = i / n; const p = v3.lerp(tip, end, s); p[1] -= sag * len * 4 * s * (1 - s); if (p[1] < 0.0 && i < n && S.st !== 'hold') p[1] = Math.max(p[1], -0.02); lpts.push(p); }
    }
    const pxA = 2 * Math.tan(fov / 2) / RH;

    // --- reflection pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.refl); gl.viewport(0, 0, T.rw, T.rh);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    U.uClip = 1; U.uCam = [cam.pos[0], -cam.pos[1], cam.pos[2]];
    drawWorld(VPR, invVPR, true);
    // --- main pass
    U.uClip = 0; U.uCam = cam.pos;
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.main); gl.viewport(0, 0, RW, RH);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawWorld(VP, invVP, false);
    // resolve for refraction
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.main); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.scene);
    gl.blitFramebuffer(0, 0, RW, RH, 0, 0, RW, RH, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.main);
    // water
    G.use(P.water, U, { uVP: VP, uRefl: 0, uRefr: 1, uDep: 2, uNrm: 3, uRes: [RW, RH], uNear: 0.3, uFar: 9000, uDeep: lin(W.map.waterP.deep, 0.18), uAbs: W.map.waterP.abs, uClar: W.map.waterP.clar, uWaveK: W.map.waterP.waveK, uFlow: W.map.waterP.flow, uSwell: W.map.waterP.swell, uRip: ripArr });
    G.bindTex(0, T.rc); G.bindTex(1, T.sc); G.bindTex(2, T.sd); G.bindTex(3, W.waterNrm);
    G.draw(W.water);
    // splash particles
    if (parts.length) {
      const pos = new Float32Array(parts.length * 3), uv = new Float32Array(parts.length * 2);
      parts.forEach((q, i) => { pos.set(q.p, i * 3); uv.set([q.s * 0.06, 0.8 * (1 - q.life / q.max)], i * 2); });
      G.update(ptsMesh, { pos, uv });
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      G.use(P.pts, U, { uVP: VP, uScale: RH * 1.2 }); G.draw(ptsMesh);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // first-person rig
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const VPr = m4.mul(projR, view);
    if (mode === 'play') { G.use(P.lit, U, { uVP: VPr, uModel: camW, uFog: 0, uNight: night }); G.draw(rigMesh); }
    if (S.st === 'hold' || S.st === 'release') {
      const hf = worldFish(); if (hf) drawFish(hf, VPr);
      if (S.st === 'hold') { G.update(gripMesh, gripperData(holdPose())); G.use(P.lit, U, { uVP: VPr, uModel: camW, uFog: 0 }); G.draw(gripMesh); }
    }
    if (lpts && lpts.length > 1) {
      G.update(lineMesh, lineRibbon(lpts, pxA));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      G.use(P.line, U, { uVP: VPr, uLineCol: lin(RTY().lineCol, RTY().lineW > 2 ? 0.8 : 0.45) }); G.draw(lineMesh);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // resolve
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.main); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.scene);
    gl.blitFramebuffer(0, 0, RW, RH, 0, 0, RW, RH, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    // bloom
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(G.emptyVao);
    let src = T.sc, sw = RW, sh = RH;
    T.bl.forEach((lv, i) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.f); gl.viewport(0, 0, lv.w, lv.h);
      G.use(P.down, { uSrc: 0, uTx: [1 / sw, 1 / sh], uFirst: i === 0 ? 1 : 0, uThr: G.hdr ? 1.1 : 0.85 }); G.bindTex(0, src);
      gl.drawArrays(gl.TRIANGLES, 0, 3); src = lv.t; sw = lv.w; sh = lv.h;
    });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = T.bl.length - 1; i > 0; i--) {
      const lo = T.bl[i], hi = T.bl[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, hi.f); gl.viewport(0, 0, hi.w, hi.h);
      G.use(P.up, { uSrc: 0, uTx: [1 / lo.w, 1 / lo.h] }); G.bindTex(0, lo.t); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    // composite
    const sc = m4.tp4(VP, v3.add(cam.pos, v3.mul(U.uSunDir, 1000)));
    let sunUv = [0.5, 0.5], vis = 0;
    if (sc[3] > 0) { sunUv = [sc[0] / sc[3] * 0.5 + 0.5, sc[1] / sc[3] * 0.5 + 0.5]; vis = smooth(1.4, 0.9, Math.max(Math.abs(sunUv[0] - 0.5), Math.abs(sunUv[1] - 0.5)) * 2) * smooth(-2, 1, elev); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, RW, RH);
    G.use(P.comp, { uScene: 0, uBloom: 1, uSun: sunUv, uSunVis: vis, uExpo: expo, uBloomK: 0.055, uTime: S.t, uAspect: asp, uFlare: 1, uHdr: 1, uFlareCol: flareCol });
    G.bindTex(0, T.sc); G.bindTex(1, T.bl[0].t); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  }

  // ---------------- UI panels ----------------
  function renderLog() {
    $('logGrid').innerHTML = G.SPECIES.map(sp => {
      const L = SAVE.log[sp.id];
      return L ? `<div class="sp"><canvas data-id="${sp.id}" width="256" height="96"></canvas><b>${sp.name}</b><span>Caught ${L.n} · best ${L.best < 1 ? Math.round(L.best * 1000) + ' g' : L.best.toFixed(2) + ' kg'} · ${Math.round(L.len)} cm</span></div>`
        : `<div class="sp unk"><div class="sil"></div><b>Unknown</b><span>Found ${sp.depth[0]}–${sp.depth[1]} m deep</span></div>`;
    }).join('');
    for (const c of $('logGrid').querySelectorAll('canvas')) {
      const sp = G.SPECIES.find(s => s.id === c.dataset.id), a = G.fishAsset(sp), x = c.getContext('2d');
      x.save(); x.beginPath(); x.ellipse(128, 48, 118, 30, 0, 0, 6.283); x.clip(); x.drawImage(a.cv, 0, 0, 512, 128, 8, 18, 240, 60); x.restore();
    }
    $('logSum').textContent = Object.keys(SAVE.log).length + ' of ' + G.SPECIES.length + ' species found';
  }
  function togglePanel(id) {
    if (panel === id) { $(id).classList.remove('on'); panel = null; return; }
    if (panel) $(panel).classList.remove('on');
    panel = id; $(id).classList.add('on');
    if (document.pointerLockElement) document.exitPointerLock();
    input.act = false; input.lift = false;
    if (id === 'logP') renderLog();
  }
  $('bLog').onclick = () => togglePanel('logP'); $('bSet').onclick = () => togglePanel('setP');
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => togglePanel(b.dataset.close));
  $('sTod').value = Q.tod * 100; $('sTod').oninput = e => { Q.tod = e.target.value / 100; applyTime(); saveAll(); };
  $('sCloud').value = Q.clouds * 100; $('sCloud').oninput = e => { Q.clouds = e.target.value / 100; applyTime(); saveAll(); };
  $('sVol').value = Q.vol * 100; $('sVol').oninput = e => { Q.vol = e.target.value / 100; G.audio.setVol(Q.vol); saveAll(); };
  $('sSens').value = Q.sens * 100; $('sSens').oninput = e => { Q.sens = e.target.value / 100; saveAll(); };
  $('sHand').value = Q.hand; $('sHand').onchange = e => { Q.hand = e.target.value; saveAll(); };
  $('sQual').value = Q.quality; $('sQual').onchange = e => { Q.quality = e.target.value; saveAll(); $('qNote').hidden = false; resize(); };
  G.audio.vol = Q.vol;

  $('touch').hidden = !isTouch;
  if (isTouch) { $('goals').classList.add('min'); $('gArrow').textContent = '+'; }
  if (isTouch) document.querySelector('.ctl').innerHTML = '<kbd>Drag</kbd><span>look around and aim</span><kbd>Cast</kbd><span>hold to charge, let go to cast</span><kbd>Strike!</kbd><span>tap when the float goes under</span><kbd>Reel</kbd><span>hold to reel in</span><kbd>Lift · + −</kbd><span>lift the rod, set the drag</span><kbd>Net</kbd><span>scoop the fish when it is close</span>';

  // ---------------- app states: loading, home, map select, play ----------------
  let mainW = null, prevW = null, prevIdx = -1, mapIdx = 0, mapFilter = 'all', building = false, prevTimer = 0;
  const TIPS = ['Lower the drag when a big fish runs; the line is stronger than you think, until it isn’t.', 'Strike when the float goes fully under, not on the first twitch.', 'Tired fish come in easily. Wait for the energy bar to drop before you net it.', 'Bigger fish live further out and deeper. Cast long.', 'Right click lifts the rod and tires the fish faster, but strains your tackle.', 'Repair worn tackle in Settings before chasing a trophy.'];
  const ROD_NAME = id => G.rig.TYPES[id].name;
  const FLOAT_NAME = { pencil: 'Pencil float', ball: 'Bobby cork', indicator: 'Yarn indicator', balloon: 'Balloon float', hera: 'Hera float' };
  const show = (id, on) => $(id).classList.toggle('on', on);
  function artCss(m) { return `linear-gradient(160deg, ${m.art[0]} 0%, ${m.art[1]} 55%, ${m.art[2]} 100%)`; }
  function resetGame() {
    S.st = 'idle'; S.fight = null; S.wait = null; S.hold = null; S.jump = null; S.net = null; S.fl.vis = false; S.bail = 0; S.keepKg = 0;
    $('catch').classList.remove('on'); $('goals').classList.remove('hideH');
  }
  let travelling = false;
  async function loadMap(id, after) {
    if (travelling) return; travelling = true;
    clearTimeout(prevTimer);
    while (building) await new Promise(r => setTimeout(r, 50));   // let a preview finish first
    building = true;
    const map = G.mapById(id);
    mode = 'loading'; playing = false;
    show('home', false); show('maps', false); $('hud').hidden = true; show('load', true);
    $('ldArt').style.background = artCss(map); $('ldName').textContent = map.name; $('ldRegion').textContent = map.country + ' · ' + (map.water === 'salt' ? 'Saltwater' : 'Freshwater') + ' · ' + map.diff;
    $('ldDesc').textContent = map.desc; $('ldRod').textContent = ROD_NAME(map.rod) + ' · ' + FLOAT_NAME[map.float];
    $('ldTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    const setP = (f, label) => { $('ldBar').style.width = Math.round(f * 100) + '%'; $('ldPct').textContent = Math.round(f * 100) + '%'; if (label) $('ldStep').textContent = label + '…'; };
    setP(0, 'Clearing the old water');
    await new Promise(r => setTimeout(r, 60));
    if (prevW) { G.freeWorld(prevW); prevW = null; prevIdx = -1; }
    if (mainW) { G.freeWorld(mainW); mainW = null; }
    W = null;
    try { mainW = await G.buildWorld(map, Q.quality, setP); }
    catch (e) { console.error(e); fail('Could not build ' + map.name + ': ' + e.message); building = false; travelling = false; return; }
    W = mainW; spot = W.spot.slice(); Q.map = map.id;
    Q.tod = Q.todMap[map.id] ?? map.tod; Q.clouds = Q.cloudMap[map.id] ?? map.clouds;
    $('sTod').value = Q.tod * 100; $('sCloud').value = Q.clouds * 100;
    applyTime(); resetGame(); renderGoals(); saveAll();
    $('baitName').textContent = map.bait[0]; $('baitSub').textContent = map.bait[1];
    $('capT').textContent = '/ ' + G.rig.TYPES[map.rod].cap + ' m';
    setP(1, 'Ready');
    await new Promise(r => setTimeout(r, 250));
    show('load', false); building = false; travelling = false;
    after && after();
  }
  function renderHome() {
    const m = W ? W.map : G.mapById(Q.map), gs = goalsNow();
    $('hmMapArt').style.background = artCss(m); $('hmMapName').textContent = m.name; $('hmDiff').textContent = m.diff;
    $('hmMapRod').textContent = ROD_NAME(m.rod);
    const done = gs.list.filter(g => g.p >= g.n).length;
    $('tdGoals').textContent = done === gs.list.length && gs.list.length ? 'All done today' : gs.list.find(g => g.p < g.n)?.t || 'Go fishing';
    $('tdGoalsN').textContent = done + '/' + gs.list.length; $('tdGoalsBar').style.width = (gs.list.length ? done / gs.list.length * 100 : 0) + '%';
    const mine = m.species.filter(id => SAVE.log[id]);
    $('tdSpecies').textContent = mine.length ? mine.map(id => G.SPECIES.find(s => s.id === id).name).slice(0, 2).join(', ') + (mine.length > 2 ? ' +' + (mine.length - 2) : '') : 'None caught here yet';
    $('tdSpeciesN').textContent = mine.length + '/' + m.species.length;
    let best = null; for (const id of m.species) { const L = SAVE.log[id]; if (L && (!best || L.best > best.kg)) best = { kg: L.best, name: G.SPECIES.find(s => s.id === id).name }; }
    $('tdBest').textContent = best ? best.name + ' · ' + fmtKg(best.kg) : 'No catch yet';
    $('hmCoins').textContent = SAVE.coins; $('hmName').textContent = Q.name; $('tdDay').textContent = SAVE.day;
  }
  function goHome() {
    if (!W) return;
    if (prevW && W === prevW) { W = mainW; }
    mode = 'home'; playing = false; resetGame();
    if (document.pointerLockElement) document.exitPointerLock();
    $('hud').hidden = true; show('maps', false); show('home', true);
    if (panel) togglePanel(panel);
    renderHome();
  }
  function enterPlay() {
    if (!W || travelling && mode !== 'loading') return;
    if (prevW && W === prevW) W = mainW;
    mode = 'play'; playing = true; resetGame();
    show('home', false); show('maps', false); $('hud').hidden = false;
    cam.ty = cam.yaw = W.yaw0; cam.tp = cam.pitch = -0.07;
    G.audio.init(); lockPointer(); hudDirty = true; renderGoals();
    msg({ fly: 'Fly rod: short casts, watch the indicator drift', bait: 'Baitcaster: fish the snags for cod', overhead: 'Boat rod: big fish, long runs, heavy drag', spin: 'Hold left click to cast' }[W.map.rod], 3);
  }
  // ----- map select -----
  const mapList = () => G.MAPS.filter(m => mapFilter === 'all' || m.water === mapFilter);
  function showMaps() {
    if (!W || travelling) return;
    mode = 'maps'; show('home', false); show('maps', true);
    const L = mapList(); mapIdx = Math.max(0, L.findIndex(m => m === W.map));
    renderMaps();
  }
  function renderMaps() {
    const L = mapList(); if (!L.length) return;
    mapIdx = (mapIdx + L.length) % L.length;
    const m = L[mapIdx];
    $('mpIdx').textContent = String(mapIdx + 1).padStart(2, '0') + ' / ' + String(L.length).padStart(2, '0');
    $('mpDiff').textContent = m.diff; $('mpDiff').dataset.d = m.diff; $('mpName').textContent = m.name; $('mpDesc').textContent = m.desc;
    $('mpRod').textContent = ROD_NAME(m.rod); $('mpFloat').textContent = FLOAT_NAME[m.float]; $('mpPlace').textContent = m.country;
    $('mpFish').textContent = m.species.map(id => G.SPECIES.find(s => s.id === id).name).join(' · ');
    const cur = mainW && mainW.map === m;
    $('mpGo').textContent = cur ? 'Fish here →' : 'Select & travel →';
    $('mpDots').innerHTML = L.map((x, i) => `<button type="button" data-i="${i}" class="${i === mapIdx ? 'on' : ''}" aria-label="${x.name}"></button>`).join('');
    document.querySelectorAll('#mpTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === mapFilter));
    $('mpArt').style.background = artCss(m);
    // live preview of the map behind the UI
    clearTimeout(prevTimer);
    if (cur) { W = mainW; $('mpArt').classList.add('hide'); }
    else if (prevW && prevIdx === m.index) { W = prevW; $('mpArt').classList.add('hide'); }
    else {
      $('mpArt').classList.remove('hide'); $('mpPrev').classList.add('on');
      prevTimer = setTimeout(async () => {
        if (mode !== 'maps' || travelling) return;
        if (building) { prevTimer = setTimeout(() => mode === 'maps' && renderMaps(), 300); return; }
        building = true;
        const old = prevW; if (old && W === old) W = mainW;
        if (old) { G.freeWorld(old); prevW = null; prevIdx = -1; }
        const pw = await G.buildWorld(m, 'preview');
        building = false;
        if (mode !== 'maps' || mapList()[mapIdx] !== m) { G.freeWorld(pw); if (mode === 'maps') renderMaps(); return; }
        prevW = pw; prevIdx = m.index; W = prevW; $('mpArt').classList.add('hide'); $('mpPrev').classList.remove('on');
      }, 350);
    }
  }
  function selectMap() {
    const m = mapList()[mapIdx]; if (!m || travelling) return;
    $('mpGo').textContent = 'Travelling\u2026';
    if (mainW && mainW.map === m && !building) { W = mainW; if (prevW) { G.freeWorld(prevW); prevW = null; prevIdx = -1; } enterPlay(); return; }
    loadMap(m.id, enterPlay);
  }
  function menuUpdate(dt) {
    if (!W) return;
    if (W.map.waterP.swell) { /* boat bobs in menus too */ }
    const f = fwd(W.yaw0), back = [-f[0], 0, -f[2]], side = [f[2], 0, -f[0]];
    const ground = W.spot[1] - 1.62;
    if (mode === 'home') {
      const sw = Math.sin(S.t * 0.25) * 0.15;
      let p = [W.spot[0] + back[0] * 3.3 - side[0] * sw, ground + 1.45, W.spot[2] + back[2] * 3.3 - side[2] * sw];
      if (W.boat) p[1] += boatState().h;
      p[1] = Math.max(p[1], W.height(p[0], p[2]) + 0.7);
      const tgt = [W.spot[0] + side[0] * 0.12, ground + 1.22 + (W.boat ? boatState().h : 0), W.spot[2] + side[2] * 0.12];
      const d = v3.sub(tgt, p);
      cam.pos = p; cam.yaw = cam.ty = Math.atan2(-d[0], -d[2]); cam.pitch = cam.tp = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    } else if (mode === 'maps' || mode === 'loading') {
      // slow drift over the water just off the fishing spot, looking back across the map
      const a = W.yaw0 + Math.sin(S.t * 0.07) * 0.5, fb = fwd(a), sd = [fb[2], 0, -fb[0]];
      const o = Math.sin(S.t * 0.05) * 8;
      const p = [W.spot[0] + f[0] * 10 + sd[0] * o, ground + 7 + (W.boat ? 3 : 0), W.spot[2] + f[2] * 10 + sd[2] * o];
      p[1] = Math.max(p[1], W.height(p[0], p[2]) + 6);
      const tgt = [W.spot[0] + fb[0] * 70, ground + 3, W.spot[2] + fb[2] * 70], d = v3.sub(tgt, p);
      cam.pos = p; cam.yaw = Math.atan2(-d[0], -d[2]); cam.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    }
    cam.zoom = 0; cam.lag = [0, 0];
    for (const r of rips) { r[2] += dt * 0.75; r[3] *= Math.exp(-dt * 0.9); }
  }
  // ----- wiring -----
  document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const n = b.dataset.nav;
    if (n === 'log') togglePanel('logP'); else if (n === 'settings') togglePanel('setP');
    else if (n === 'tasks') { renderTasks(); togglePanel('tasksP'); }
    else if (n !== 'fish') toast(b.textContent.trim() + ' is coming soon');
  });
  function renderTasks() {
    const gs = goalsNow();
    $('tasksList').innerHTML = gs.list.map(g => `<li class="${g.p >= g.n ? 'done' : ''}"><span>${g.t}</span><b>${Math.min(g.p, g.n)}/${g.n}</b><i>+${g.r} coins</i></li>`).join('');
    $('tasksMap').textContent = W ? W.map.name + ' · day ' + SAVE.day : '';
  }
  let toastT = 0;
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1800); }
  document.querySelectorAll('[data-soon]').forEach(b => b.onclick = () => toast(b.dataset.soon + ' is coming soon'));
  $('hmMap').onclick = showMaps; $('hmGo').onclick = enterPlay;
  $('hmHow').onclick = () => togglePanel('howP'); $('hmControls').onclick = () => togglePanel('howP'); $('hmLog').onclick = () => togglePanel('logP');
  $('hmGear').onclick = () => togglePanel('setP'); $('hmCoinsAdd').onclick = () => toast('Coin shop is coming soon');
  $('hmName').onclick = () => { $('hmNameIn').value = Q.name; $('hmNameIn').hidden = false; $('hmName').hidden = true; $('hmNameIn').focus(); };
  $('hmNameIn').onblur = $('hmNameIn').onchange = () => { const v = $('hmNameIn').value.trim().slice(0, 18); if (v) Q.name = v; saveAll(); $('hmNameIn').hidden = true; $('hmName').hidden = false; renderHome(); };
  $('mpBack').onclick = goHome; $('mpGo').onclick = selectMap;
  const stepMap = d => { mapIdx += d; renderMaps(); };
  $('mpPrevB').onclick = () => stepMap(-1); $('mpNextB').onclick = () => stepMap(1);
  $('mpDots').onclick = e => { const b = e.target.closest('button'); if (b) { mapIdx = +b.dataset.i; renderMaps(); } };
  // scroll wheel / trackpad: one map per gesture
  let wheelAcc = 0, wheelLock = 0;
  $('maps').addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now(); if (now < wheelLock) return;
    wheelAcc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(wheelAcc) > 40) { stepMap(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; wheelLock = now + 450; }
  }, { passive: false });
  // swipe / drag
  let sx0 = null, sy0 = 0;
  $('maps').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; sx0 = e.clientX; sy0 = e.clientY; });
  addEventListener('pointerup', e => {
    if (sx0 === null || mode !== 'maps') { sx0 = null; return; }
    const dx = e.clientX - sx0, dy = e.clientY - sy0; sx0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepMap(dx < 0 ? 1 : -1);
  });
  document.querySelectorAll('#mpTabs button').forEach(b => b.onclick = () => { mapFilter = b.dataset.f; mapIdx = 0; renderMaps(); });
  $('bMenu').onclick = goHome;
  addEventListener('keydown', e => {
    if (panel) return;
    if (mode === 'home' && e.code === 'Enter') enterPlay();
    else if (mode === 'maps') {
      if (e.code === 'ArrowLeft') { mapIdx--; renderMaps(); } else if (e.code === 'ArrowRight') { mapIdx++; renderMaps(); }
      else if (e.code === 'Escape') goHome(); else if (e.code === 'Enter') selectMap();
    } else if (mode === 'play' && e.code === 'KeyM') goHome();
  });
  loadMap(Q.map, goHome);
  // ---------------- loop ----------------
  let last = performance.now(), frames = 0, fpsT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { update(dt); render(); }
    catch (e) { console.error(e); fail('Error: ' + e.message); return; }
    frames++; fpsT += dt; if (fpsT > 1) { G.fps = frames / fpsT; frames = 0; fpsT = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug hooks for testing
  window.__sw = { S, cam, Q, U, get W() { return W; }, get mode() { return mode; }, applyTime, setPlaying: v => { if (v) enterPlay(); else goHome(); }, loadMap, showMaps, goHome, enterPlay, actionDown, actionUp, update, render, landFish, chooseFish, strike, fishPos, tryNet };
})(window.G);
