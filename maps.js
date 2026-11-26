'use strict';
// Map definitions. Each map supplies terrain, colours, vegetation, props, water, light, tackle and fish.
(function (G) {
  const { fbm, noise, smooth, lin, mixc, v3 } = G;
  const ridge = (x, z, o = 5) => { const n = fbm(x, z, o); const r = 1 - Math.abs(2 * n - 1); return r * r; };
  const C = h => lin(h);
  const M = G.MAPS = [];

  // shared: scatter helper — tries random points in a box/circle and calls test()
  async function scatter(r, n, tries, gen, test, step) {
    let k = 0;
    for (let t = 0; t < tries && k < n; t++) {
      const p = gen(); if (test(p[0], p[1])) k++;
      if (t % 4000 === 0 && step) await step(Math.min(1, k / n));
    }
  }

  // =========================== 1. PINE LAKE ===========================
  {
    const LAKE = { cx: 0, cz: -250, rx: 330, rz: 265 }, DB = [0, 15];
    const ISL = [[-150, -330, 40], [185, -440, 30], [60, -540, 22], [-60, -470, 12]];
    const land = (x, z) => {
      const dx = (x - LAKE.cx) / LAKE.rx, dz = (z - LAKE.cz) / LAKE.rz;
      let d = (Math.sqrt(dx * dx + dz * dz) - 1) * 270;
      d += (fbm(x * 0.0033 + 5, z * 0.0033 + 2, 4) - 0.5) * 240 * smooth(30, 170, Math.hypot(x - DB[0], z - DB[1]));
      for (const [ix, iz, r] of ISL) d = Math.max(d, r - Math.hypot(x - ix, z - iz) + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 14);
      return d;
    };
    const height = (x, z) => {
      const d = land(x, z), r = Math.hypot(x - LAKE.cx, (z - LAKE.cz) * 1.1);
      const mtn = smooth(480, 1400, r) * (50 + 230 * ridge(x * 0.0011 + 3, z * 0.0011 - 7));
      if (d >= 0) {
        const big = fbm(x * 0.0024 + 11, z * 0.0024 - 4, 5);
        return 1.1 * (1 - Math.exp(-d / 6)) + Math.pow(big, 1.6) * 60 * smooth(8, 180, d) + (fbm(x * 0.035, z * 0.035, 3) - 0.5) * 2.4 * smooth(2, 30, d) + mtn;
      }
      const dd = -d, big = fbm(x * 0.006 + 3, z * 0.006, 3);
      let depth = (1 - Math.exp(-dd / 20)) * (3.5 + 11 * big);
      const sd = Math.hypot(x + 50, z + 120); depth *= 1 - 0.88 * Math.exp(-sd * sd / (2 * 28 * 28));
      return -depth + (fbm(x * 0.06, z * 0.06, 2) - 0.5) * 0.5 * smooth(0, 8, dd) + mtn;
    };
    const treeDens = (x, z, d) => {
      if (d < 2.5 || Math.hypot(x - DB[0], z - DB[1]) < 24) return 0;
      return Math.max(smooth(0.4, 0.58, fbm(x * 0.006 + 1, z * 0.006 + 8, 4)), Math.exp(-(d - 3) / 30) * 0.95 * smooth(0.28, 0.5, fbm(x * 0.02, z * 0.02, 3)));
    };
    const P = { deep: C('#36342a'), bed: C('#6b5f46'), sand: C('#8d8064'), peb: C('#706a5c'), grass: C('#45602a'), grass2: C('#5e6a33'), floor: C('#3b4126'), canopy: C('#243520'), rock: C('#77726b'), far: C('#1d2b1b') };
    M.push({
      id: 'pine', name: 'Pine Lake', region: 'Origins', water: 'fresh', diff: 'Easy', country: 'Canada',
      desc: 'A quiet mountain lake at golden hour. Fish off the old jetty for bluegill, bass, trout and the odd monster pike.',
      rod: 'spin', float: 'pencil', bait: ['Red worms', 'Hook #6 · float 3 g'], tod: 0.16, clouds: 0.55, sunAz: 0.3, kgGoal: 2,
      art: ['#f0a15e', '#5b3f62', '#1f2d3a'],
      species: ['bluegill', 'perch', 'lmbass', 'trout', 'striper', 'walleye', 'carp', 'catfish', 'pike'],
      waterP: { deep: '#1f3a2c', abs: [0.7, 0.42, 0.36], clar: 1.1, waveK: 1, flow: [0, 0], swell: 0 },
      land, height,
      color(x, y, z, sl, ld) {
        if (y < 0.02) return mixc(P.bed, P.deep, smooth(0.4, 4, -y));
        if (y < 0.5 && ld < 7) return mixc(P.sand, P.peb, noise(x * 0.3, z * 0.3));
        let c = mixc(P.grass, P.grass2, fbm(x * 0.02, z * 0.02, 3));
        const td = treeDens(x, z, ld), r = Math.hypot(x - LAKE.cx, z - LAKE.cz);
        c = mixc(c, P.floor, Math.min(1, td * 1.3)); c = mixc(c, P.canopy, smooth(0.3, 0.8, td) * smooth(60, 260, r - 300));
        c = mixc(c, P.far, smooth(380, 800, r) * (0.55 + 0.45 * smooth(0.25, 0.6, fbm(x * 0.004, z * 0.004, 3) + 0.2)));
        return mixc(c, P.rock, smooth(0.45, 0.8, sl + (noise(x * 0.05, z * 0.05) - 0.5) * 0.3));
      },
      spot(w) {
        let zs = 15; for (let z = 30; z > -10; z -= 0.25) if (height(0, z) < 0.15) { zs = z; break; }
        w.dock = { z0: zs + 4.5, z1: zs - 13.5, deck: 0.74 };
        return [0, w.dock.deck + 1.62, w.dock.z1 + 0.9];
      },
      async veg(w, r, s, add, step) {
        await scatter(r, 7000 * s, 90000, () => { const a = r() * 6.283, rad = Math.sqrt(r()) * 1300; return [LAKE.cx + Math.cos(a) * rad * 1.05, LAKE.cz + Math.sin(a) * rad]; }, (x, z) => {
          const d = land(x, z); if (d < 2.5 || r() > treeDens(x, z, d) * 0.95) return false;
          const h = height(x, z); if (h > 230) return false;
          const rr = Math.hypot(x - LAKE.cx, z - LAKE.cz);
          if (h < 25 && rr < 600 && r() < 0.28) add('broad', x, h - 0.2, z, 8 + r() * 7); else add(r() < 0.5 ? 'spruceA' : 'spruceB', x, h - 0.2, z, 9 + r() * 12 + (rr > 600 ? 6 : 0));
          return true;
        }, step);
        for (const [x, z, sc] of [[-14, 21, 15], [-19, 26, 18], [16, 24, 14], [22, 20, 17], [-25, 17, 13], [27, 28, 19]]) { const h = height(x, z); if (h > 0.3) add('spruceA', x, h - 0.2, z, sc); }
        await scatter(r, 3600 * s, 60000, () => { const a = r() * 6.283, rad = 40 + r() * 420; return [LAKE.cx + Math.cos(a) * rad * 1.1, LAKE.cz + Math.sin(a) * rad]; }, (x, z) => {
          const h = height(x, z); if (h < -0.55 || h > 0.3 || fbm(x * 0.03, z * 0.03, 3) < 0.52 || (Math.abs(x) < 3 && z > w.dock.z1 - 2 && z < w.dock.z0)) return false;
          add('reeds', x, Math.min(h, 0) - 0.05, z, 0.8 + r() * 0.5); return true;
        });
        for (const [x, dz] of [[-3.2, 5], [-3.6, 8], [3.1, 7], [4, 10], [-2.8, 11], [2.8, 3]]) for (let k = 0; k < 6; k++) { const xx = x + (r() - 0.5) * 2, zz = w.dock.z1 + dz + (r() - 0.5) * 2; add('reeds', xx, Math.min(height(xx, zz), 0) - 0.05, zz, 0.8 + r() * 0.5); }
        await scatter(r, 5000 * s, 40000, () => [w.spot[0] + (r() - 0.5) * 160, w.spot[2] + 10 + (r() - 0.5) * 160], (x, z) => {
          const h = height(x, z); if (land(x, z) < 1.5 || h < 0.35 || (Math.abs(x) < 1.2 && z < w.dock.z0)) return false;
          add('grass', x, h - 0.03, z, 0.8 + r() * 0.8); return true;
        });
      },
      props(w, mb, r, s, Hh) {
        Hh.dock(w, mb, w.dock);
        mb.c(lin('#a08d68'), 5); mb.torus([0.99, w.dock.deck + 0.42, w.dock.z1 + 0.08], [0, 1, 0], 0.11, 0.014, 14, 5);
        Hh.tackleBox(mb, [0.52, w.dock.deck + 0.022, w.dock.z1 + 1.3]); Hh.bucket(mb, [-0.55, w.dock.deck + 0.02, w.dock.z1 + 1.9]);
        for (let t = 0; t < 400; t++) {
          const a = Math.PI * 0.96 + (t % 20 - 10) * 0.012, rr = 250 + Math.floor(t / 20) * 6, x = LAKE.cx + Math.cos(a) * rr, z = LAKE.cz - Math.sin(a) * rr * 0.9, d = land(x, z);
          if (d > 9 && d < 16) { Hh.cabin(mb, x, height(x, z) - 0.2, z, [LAKE.cx - x, 0, LAKE.cz - z]); break; }
        }
        const rc = ['#6d6962', '#5c5953', '#7a7469', '#615a50', '#706c66'].map(C);
        let n = 0;
        for (let t = 0; t < 40000 && n < 190 * Math.max(s, 0.5); t++) {
          const a = r() * 6.283, rad = 60 + r() * 380, x = LAKE.cx + Math.cos(a) * rad * 1.1, z = LAKE.cz + Math.sin(a) * rad;
          if (Math.abs(land(x, z)) > 5 || (Math.abs(x) < 3 && z > w.dock.z1 - 3 && z < w.dock.z0)) continue;
          const sc = 0.4 + Math.pow(r(), 2.2) * 2.4; Hh.rock(mb, x, height(x, z) - r() * 0.3 * sc, z, sc, r() * 6.28, rc[n % 5], 0.8 + r() * 0.4); n++;
        }
        for (let t = 0, k = 0; t < 4000 && k < 60; t++) {
          const x = -50 + (r() - 0.5) * 110, z = -120 + (r() - 0.5) * 110, h = height(x, z); if (h < -2.3 || h > -0.2) continue;
          const sc = 0.7 + Math.pow(r(), 1.6) * 2.4; Hh.rock(mb, x, Math.max(h, -sc * 0.45 + 0.15 + r() * 0.25), z, sc, r() * 6.28, rc[k % 5], 0.7 + r() * 0.4); k++;
        }
        for (const [x, dz, sc] of [[-3.5, -3.5, 1.1], [3.8, -2, 0.8], [-6, -1, 1.5], [6.5, -4.5, 1.2]]) Hh.rock(mb, x, height(x, w.dock.z0 + dz) - 0.2 * sc, w.dock.z0 + dz, sc, x * 3.1, rc[1], 0.85);
        let lp = 0;
        for (let t = 0; t < 40000 && lp < 1300 * s; t++) {
          const a = r() * 6.283, rad = 50 + r() * 380, x = LAKE.cx + Math.cos(a) * rad * 1.1, z = LAKE.cz + Math.sin(a) * rad, h = height(x, z);
          if (h > -0.35 || h < -1.8 || fbm(x * 0.025 + 40, z * 0.025, 3) < 0.6) continue;
          for (let k = 0; k < 5; k++) Hh.lily(mb, x + (r() - 0.5) * 6, z + (r() - 0.5) * 6, 0.12 + r() * 0.2, r); lp += 5;
        }
        for (let k = 0; k < 40; k++) { const x = -4 - r() * 7, z = w.dock.z1 + 3 + r() * 8; if (height(x, z) < -0.25) Hh.lily(mb, x, z, 0.12 + r() * 0.18, r); }
      }
    });
  }

  // =========================== 2. MURRAY RIVER (Australia) ===========================
  {
    const zc = x => -24 + 14 * Math.sin(x * 0.006) + 6 * Math.sin(x * 0.017 + 1);
    const hw = x => 24 + 5 * Math.sin(x * 0.011 + 2);
    const land = (x, z) => Math.abs(z - zc(x)) - hw(x) + (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 5 * smooth(8, 40, Math.hypot(x, z - 10));
    const height = (x, z) => {
      const d = land(x, z), far = z < zc(x), big = fbm(x * 0.003 + 5, z * 0.003, 4);
      if (d < 0) { const dd = -d; return -(1 - Math.exp(-dd / 5)) * (3 + 2.5 * fbm(x * 0.01, z * 0.01, 3)); }
      if (far) {
        const strata = Math.sin(x * 0.04) * 0.8 + (fbm(x * 0.05, z * 0.05, 3) - 0.5) * 2;
        return 0.3 * (1 - Math.exp(-d / 1.2)) + smooth(1.5, 9, d) * (13 + strata) + big * 30 * smooth(40, 400, d) + (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 3 * smooth(10, 30, d);
      }
      return 0.35 * (1 - Math.exp(-d / 3)) + 0.035 * Math.min(d, 60) + big * 22 * smooth(40, 400, d) + (fbm(x * 0.04, z * 0.04, 3) - 0.5) * 1.2 * smooth(3, 20, d);
    };
    const P = { mud: C('#4f4530'), deep: C('#2f2a1e'), wet: C('#6e5a42'), sand: C('#a08a64'), dry: C('#8f8248'), gold: C('#a99456'), floor: C('#6a5a3a'), red: C('#b4613a'), cream: C('#d9a77a'), dark: C('#7c4128'), rock: C('#8a6a52') };
    M.push({
      id: 'murray', name: 'Murray River', region: 'Australia', water: 'fresh', diff: 'Medium', country: 'Australia',
      desc: 'Slow brown water under red sandstone cliffs. Drop a bait by the snags for golden perch, redfin and the legendary Murray cod.',
      rod: 'bait', float: 'ball', bait: ['Yabby tails', 'Hook #2/0 · bobby cork'], tod: 0.2, clouds: 0.35, sunAz: 2.5, kgGoal: 5,
      art: ['#e7a052', '#9a4a2a', '#2c3326'],
      species: ['murraycod', 'goldenperch', 'redfin', 'carp', 'fwcatfish'],
      waterP: { deep: '#3a3a1e', abs: [0.95, 0.85, 0.75], clar: 2.6, waveK: 0.8, flow: [0.35, 0], swell: 0 },
      land, height, R: 3200, ahead: 160, seed: 222,
      color(x, y, z, sl, ld) {
        if (y < 0.02) return mixc(P.mud, P.deep, smooth(0.5, 3, -y));
        const far = z < zc(x);
        if (far && sl > 0.35) {
          const band = Math.sin(y * 1.7 + noise(x * 0.05, y) * 2.5);
          let c = mixc(P.red, P.cream, smooth(0.4, 0.9, band)); c = mixc(c, P.dark, smooth(-0.3, -0.9, band) * 0.7);
          return mixc(c, P.rock, noise(x * 0.3, y * 0.6) * 0.3);
        }
        if (ld < 3.5 && y < 1.2) return mixc(P.wet, P.sand, smooth(0.1, 0.8, y));
        let c = mixc(P.dry, P.gold, fbm(x * 0.03, z * 0.03, 3));
        c = mixc(c, P.floor, smooth(0.55, 0.75, fbm(x * 0.01 + 3, z * 0.01, 3)) * 0.7);
        return mixc(c, P.red, smooth(0.3, 0.6, sl) * 0.6);
      },
      spot(w) {
        let zs = 10; for (let z = 30; z > -10; z -= 0.25) if (land(0, z) < 0.3) { zs = z; break; }
        return [0, height(0, zs + 2.6) + 1.62, zs + 2.6];
      },
      async veg(w, r, s, add, step) {
        await scatter(r, 2200 * s, 60000, () => [(r() - 0.5) * 1600, (r() - 0.5) * 1400 - 200], (x, z) => {
          const d = land(x, z); if (d < 1.5 || Math.hypot(x - w.spot[0], z - w.spot[2]) < 9) return false;
          const far = z < zc(x); if (far && d < 9.5) return false;
          const dens = Math.max(Math.exp(-d / 25) * 0.9, smooth(0.5, 0.7, fbm(x * 0.006, z * 0.006, 3)) * 0.5);
          if (r() > dens) return false;
          add('gum', x, height(x, z) - 0.3, z, 14 + r() * 12); return true;
        }, step);
        await scatter(r, 3000 * s, 40000, () => [w.spot[0] + (r() - 0.5) * 140, w.spot[2] + 5 + r() * 70], (x, z) => {
          const d = land(x, z); if (d < 1.2 || Math.hypot(x - w.spot[0], z - w.spot[2]) < 1.5) return false;
          add('drygrass', x, height(x, z) - 0.03, z, 0.8 + r() * 1.2); return true;
        });
        await scatter(r, 1800 * s, 30000, () => [(r() - 0.5) * 900, (r() - 0.5) * 300 - 20], (x, z) => {
          const d = land(x, z); if (d > 1 || d < -2.5 || fbm(x * 0.04, z * 0.04, 3) < 0.5 || Math.abs(x - w.spot[0]) < 4) return false;
          add('reeds', x, Math.min(height(x, z), 0) - 0.05, z, 0.9 + r() * 0.6); return true;
        });
      },
      props(w, mb, r, s, Hh) {
        const sp = w.spot, gy = sp[1] - 1.62;
        for (const [x, z, yaw, sc] of [[-14, -6, 2.6, 1], [22, -10, 0.4, 1.2], [-40, -30, 1.2, 1.4], [55, -22, 2.9, 1.1], [8, -38, 1.9, 1.3], [-70, -8, 0.2, 1], [90, -35, 2.2, 1.2], [-110, -40, 1.0, 1.3]]) {
          const zz = zc(x) + (z + 24) * 0.8; Hh.snag(mb, [x, -0.5, zz], yaw, sc, r);
        }
        Hh.log(mb, [sp[0] - 5, gy + 0.1, sp[2] + 1], 0.4, 4, 0.25);
        Hh.chair(mb, [sp[0] - 1.3, gy, sp[2] + 1.1], 0.3);
        Hh.esky(mb, [sp[0] + 1.1, gy, sp[2] + 0.9], -0.4);
        Hh.bucket(mb, [sp[0] + 0.6, gy, sp[2] + 0.2], '#3f6a3a');
        Hh.tinnie(mb, [sp[0] + 7, height(sp[0] + 7, sp[2] - 0.5) + 0.05, sp[2] - 0.5], 1.3);
        const rc = ['#9a6a4a', '#b07a52', '#7a5a42'].map(C);
        for (let t = 0, k = 0; t < 8000 && k < 90 * Math.max(s, 0.5); t++) {
          const x = (r() - 0.5) * 900, z = zc(x) - hw(x) - 2 - r() * 6; if (land(x, z) < 0) continue;
          const sc = 0.6 + r() * 2.2; Hh.rock(mb, x, height(x, z) - 0.4, z, sc, r() * 6, rc[k % 3], 0.7); k++;
        }
      }
    });
  }

  // =========================== 3. TONGARIRO (New Zealand, fly) ===========================
  {
    const xc = z => 14 * Math.sin(z * 0.008) + 7 * Math.sin(z * 0.021 + 0.5);
    const hwr = z => 13 + 3 * Math.sin(z * 0.013);
    const VOL = [700, -5600];
    const land = (x, z) => Math.abs(x - xc(z)) - hwr(z) + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 4;
    const volcano = (x, z) => { const dv = Math.hypot(x - VOL[0], z - VOL[1]); return Math.min(2550, 2700 * Math.pow(Math.max(0, 1 - dv / 4800), 1.7)) + ridge(x * 0.002, z * 0.002) * 120 * smooth(4800, 1500, dv); };
    const height = (x, z) => {
      const d = land(x, z);
      if (d < 0) { const dd = -d; return -(1 - Math.exp(-dd / 3)) * (1.1 + 1.5 * fbm(x * 0.02, z * 0.02, 3)); }
      const base = 0.25 * (1 - Math.exp(-d / 2)) + 0.012 * d + 1.4 * smooth(32, 44, d) + 2.2 * smooth(70, 86, d) + (fbm(x * 0.05, z * 0.05, 3) - 0.5) * 0.5;
      const walls = smooth(95, 420, d) * (60 + 260 * ridge(x * 0.0016 + 2, z * 0.0016 + 9));
      return base + walls + volcano(x, z) * smooth(300, 900, d + Math.max(0, -z - 800));
    };
    const P = { bed: C('#6e6a5e'), deep: C('#3f4a44'), grav: C('#8d8a83'), grav2: C('#a39d90'), wet: C('#5e5b55'), tuss: C('#b39b55'), tuss2: C('#8a7a45'), beech: C('#24341f'), rock: C('#625c57'), vol: C('#4d4644'), scoria: C('#6b4a3e'), snow: C('#eef1f5') };
    M.push({
      id: 'tongariro', name: 'Tongariro River', region: 'New Zealand', water: 'fresh', diff: 'Medium', country: 'New Zealand',
      desc: 'Gin-clear water running off the volcanic plateau. Fly fish the gravel runs for wild brown and rainbow trout.',
      rod: 'fly', float: 'indicator', bait: ['Bead-head nymph', 'Size #14 · yarn indicator'], tod: 0.44, clouds: 0.3, sunAz: 2.6, kgGoal: 2,
      art: ['#9fd0e8', '#5f7f8a', '#2a3a30'],
      species: ['browntrout', 'trout'],
      waterP: { deep: '#2a6e6a', abs: [0.34, 0.1, 0.08], clar: 0.22, waveK: 1.6, flow: [0, 0.7], swell: 0 },
      land, height, R: 8000, ahead: 2600, seed: 333,
      color(x, y, z, sl, ld) {
        if (y < 0.02) return mixc(P.bed, P.deep, smooth(0.6, 2.5, -y));
        if (y > 1300 + (noise(x * 0.004, z * 0.004) - 0.5) * 400 + Math.sin(Math.atan2(z - VOL[1], x - VOL[0]) * 30) * 120) return P.snow;
        if (y > 300) return mixc(P.vol, P.scoria, noise(x * 0.002, z * 0.002) * 0.6);
        if (ld < 60 && y < 5) return mixc(mixc(P.grav, P.grav2, noise(x * 0.4, z * 0.4)), P.wet, smooth(0.6, 0.0, y) * (ld < 2 ? 1 : 0));
        let c = mixc(P.tuss, P.tuss2, fbm(x * 0.02, z * 0.02, 3));
        c = mixc(c, P.beech, smooth(0.48, 0.6, fbm(x * 0.004 + 7, z * 0.004, 4)) * smooth(90, 200, ld));
        return mixc(c, P.rock, smooth(0.5, 0.85, sl));
      },
      spot(w) {
        const xs = xc(0) + hwr(0) + 1.2; let x = xs; for (let k = 0; k < 40 && land(x, 0) < 0.3; k++) x += 0.25;
        return [x, Math.max(height(x, 0), 0.05) + 1.62, 0];
      },
      yaw0: 0.32,
      async veg(w, r, s, add, step) {
        await scatter(r, 5000 * s, 80000, () => [(r() - 0.5) * 3000, (r() - 0.5) * 3000 - 400], (x, z) => {
          const d = land(x, z); if (d < 90) return false;
          if (fbm(x * 0.004 + 7, z * 0.004, 4) < 0.5 || r() > 0.8) return false;
          const h = height(x, z); if (h > 600 || G.WSlope(height, x, z) > 0.9) return false;
          add('beech', x, h - 0.4, z, 10 + r() * 9); return true;
        }, step);
        await scatter(r, 4500 * s, 50000, () => [w.spot[0] + (r() - 0.5) * 500, w.spot[2] + (r() - 0.5) * 600], (x, z) => {
          const d = land(x, z); if (d < 12 || d > 400) return false;
          add('tussock', x, height(x, z) - 0.05, z, 0.9 + r() * 1.3); return true;
        });
        await scatter(r, 260 * s, 8000, () => [w.spot[0] + (r() - 0.5) * 300, w.spot[2] + (r() - 0.5) * 400], (x, z) => {
          const d = land(x, z); if (d < 3 || d > 14 || Math.hypot(x - w.spot[0], z - w.spot[2]) < 4) return false;
          add('flax', x, height(x, z) - 0.05, z, 1 + r() * 0.8); return true;
        });
      },
      props(w, mb, r, s, Hh) {
        const rc = ['#6a655e', '#7d776e', '#55524d', '#8a847a'].map(C);
        for (let t = 0, k = 0; t < 20000 && k < 160 * Math.max(s, 0.5); t++) {
          const x = w.spot[0] + (r() - 0.5) * 140, z = w.spot[2] - r() * 260 + 40, d = land(x, z);
          if (d > 8 || Math.hypot(x - w.spot[0], z - w.spot[2]) < 3) continue;
          const sc = 0.4 + Math.pow(r(), 2) * 1.6; Hh.rock(mb, x, height(x, z) - 0.15 * sc + (d < 0 ? 0.1 : 0), z, sc, r() * 6, rc[k % 4], 0.75); k++;
        }
        Hh.log(mb, [w.spot[0] + 5, height(w.spot[0] + 5, -6) + 0.15, -6], 1.1, 5, 0.22);
        Hh.log(mb, [w.spot[0] + 9, height(w.spot[0] + 9, 7) + 0.12, 7], 0.3, 3.5, 0.16);
      }
    });
  }

  // =========================== 4. LAKE KAWAGUCHI (Japan) ===========================
  {
    const LK = { cx: 0, cz: -420, rx: 700, rz: 440 }, FUJI = [-300, -8200];
    const land = (x, z) => {
      const dx = (x - LK.cx) / LK.rx, dz = (z - LK.cz) / LK.rz;
      return (Math.sqrt(dx * dx + dz * dz) - 1) * 420 + (fbm(x * 0.003 + 9, z * 0.003, 4) - 0.5) * 260 * smooth(40, 220, Math.hypot(x, z - 18));
    };
    const fuji = (x, z) => { const df = Math.hypot(x - FUJI[0], z - FUJI[1]); return Math.min(3300, 3500 * Math.pow(Math.max(0, 1 - df / 6500), 1.9)); };
    const height = (x, z) => {
      const d = land(x, z);
      if (d < 0) { const dd = -d; return -(1 - Math.exp(-dd / 25)) * (4 + 9 * fbm(x * 0.005, z * 0.005, 3)); }
      const big = fbm(x * 0.0022 + 4, z * 0.0022 + 1, 5);
      return 0.9 * (1 - Math.exp(-d / 5)) + Math.pow(big, 1.3) * 150 * smooth(15, 260, d) * (0.4 + 0.6 * ridge(x * 0.003, z * 0.003)) + (fbm(x * 0.04, z * 0.04, 3) - 0.5) * 1.5 * smooth(2, 20, d) + fuji(x, z) * smooth(200, 900, d);
    };
    const P = { bed: C('#5c5a4c'), deep: C('#2f3430'), peb: C('#8d8a84'), grass: C('#5e8a38'), grass2: C('#77964a'), forest: C('#2c4a26'), forest2: C('#46653a'), rock: C('#6e6a66'), vol: C('#4f5262'), snow: C('#f2f5fa') };
    M.push({
      id: 'kawaguchi', name: 'Lake Kawaguchi', region: 'Japan', water: 'fresh', diff: 'Easy', country: 'Japan',
      desc: 'Cherry blossom season under Mount Fuji. Fish from the old pier past the torii gate for black bass, herabuna and koi.',
      rod: 'spin', float: 'hera', bait: ['Paste bait', 'Hook #4 · hera float'], tod: 0.3, clouds: 0.4, sunAz: 2.25, kgGoal: 2,
      art: ['#f7c5d5', '#7d8fb3', '#24324a'],
      species: ['blackbass', 'herabuna', 'koi', 'biwatrout', 'bluegill'],
      waterP: { deep: '#1d4646', abs: [0.55, 0.26, 0.2], clar: 0.85, waveK: 0.85, flow: [0, 0], swell: 0 },
      land, height, R: 9000, ahead: 3000, seed: 444,
      color(x, y, z, sl, ld) {
        if (y < 0.02) return mixc(P.bed, P.deep, smooth(0.5, 5, -y));
        const df = Math.hypot(x - FUJI[0], z - FUJI[1]);
        if (df < 5200) {
          const streak = Math.sin(Math.atan2(z - FUJI[1], x - FUJI[0]) * 46) * 160 + (noise(x * 0.003, z * 0.003) - 0.5) * 260;
          if (y > 2300 + streak) return P.snow;
          if (y > 1000 + (noise(x * 0.003, z * 0.003) - 0.5) * 300) return mixc(P.vol, P.rock, noise(x * 0.002, z * 0.002) * 0.4);
          if (ld > 60) return mixc(P.forest, mixc(P.forest2, P.vol, smooth(600, 1000, y)), noise(x * 0.004, z * 0.004) * 0.6);
        }
        if (y < 0.6 && ld < 6) return P.peb;
        let c = mixc(P.grass, P.grass2, fbm(x * 0.02, z * 0.02, 3));
        c = mixc(c, mixc(P.forest, P.forest2, noise(x * 0.01, z * 0.01)), smooth(8, 60, ld) * smooth(0.35, 0.55, fbm(x * 0.006, z * 0.006, 3) + 0.15));
        return mixc(c, P.rock, smooth(0.55, 0.85, sl));
      },
      spot(w) {
        let zs = 18; for (let z = 40; z > -20; z -= 0.25) if (height(0, z) < 0.15) { zs = z; break; }
        w.dock = { z0: zs + 4, z1: zs - 16, deck: 0.7 };
        return [0, w.dock.deck + 1.62, w.dock.z1 + 0.9];
      },
      async veg(w, r, s, add, step) {
        await scatter(r, 6500 * s, 90000, () => [(r() - 0.5) * 2600, (r() - 0.5) * 2200 - 400], (x, z) => {
          const d = land(x, z); if (d < 8) return false;
          const h = height(x, z); if (h > 700 || fbm(x * 0.006, z * 0.006, 3) + 0.15 < 0.42) return false;
          add(r() < 0.55 ? 'spruceB' : 'beech', x, h - 0.3, z, 10 + r() * 10); return true;
        }, step);
        await scatter(r, 700 * s, 30000, () => [w.spot[0] + (r() - 0.5) * 700, w.spot[2] + (r() - 0.5) * 300 - 60], (x, z) => {
          const d = land(x, z); if (d < 3 || d > 45 || Math.hypot(x - w.spot[0], z - w.spot[2]) < 12) return false;
          add('cherry', x, height(x, z) - 0.2, z, 6 + r() * 4); return true;
        });
        await scatter(r, 160 * s, 8000, () => [w.spot[0] + (r() - 0.5) * 400, w.spot[2] + (r() - 0.5) * 200], (x, z) => {
          const d = land(x, z); if (d < 2 || d > 30 || Math.hypot(x - w.spot[0], z - w.spot[2]) < 10) return false;
          add('jpine', x, height(x, z) - 0.2, z, 7 + r() * 5); return true;
        });
        await scatter(r, 2500 * s, 30000, () => [w.spot[0] + (r() - 0.5) * 140, w.spot[2] + 10 + (r() - 0.5) * 100], (x, z) => {
          const h = height(x, z); if (land(x, z) < 1.5 || h < 0.3 || (Math.abs(x) < 1.2 && z < w.dock.z0)) return false;
          add('grass', x, h - 0.03, z, 0.8 + r() * 0.7); return true;
        });
        await scatter(r, 900 * s, 30000, () => [(r() - 0.5) * 800, (r() - 0.5) * 300], (x, z) => {
          const h = height(x, z); if (h < -0.5 || h > 0.2 || fbm(x * 0.03, z * 0.03, 3) < 0.55 || Math.abs(x) < 4) return false;
          add('reeds', x, Math.min(h, 0) - 0.05, z, 0.8 + r() * 0.5); return true;
        });
      },
      props(w, mb, r, s, Hh) {
        Hh.dock(w, mb, Object.assign({ woods: ['#8a7d6c', '#7a6e60', '#958877', '#6e6356'], post: '#4a4038' }, w.dock));
        Hh.tackleBox(mb, [0.5, w.dock.deck + 0.022, w.dock.z1 + 1.4], '#7a2a24');
        Hh.bucket(mb, [-0.55, w.dock.deck + 0.02, w.dock.z1 + 2.0], '#3a6a8a');
        Hh.torii(mb, -13, 0.0, w.dock.z1 - 24, 1, 0.15);
        for (let t = 0; t < 300; t++) { const x = 160 + t * 2, z = -40 - t * 0.5; if (land(x, z) > 35) { Hh.pagoda(mb, x, height(x, z) - 0.5, z, 1.4, -0.6); break; } }
        for (const dx of [-6, -12, 7, 13]) { const z = w.dock.z0 - 2 + Math.abs(dx) * 0.1; Hh.lantern(mb, [dx, height(dx, z), z]); }
        Hh.rowboat(mb, [2.4, 0.08, w.dock.z1 + 6], 1.45, '#6a4a32'); Hh.rowboat(mb, [-2.6, 0.08, w.dock.z1 + 9], 1.65, '#7d3a2a');
        const rc = ['#6f6c68', '#5d5b58', '#7a7670'].map(C);
        for (let t = 0, k = 0; t < 30000 && k < 120 * Math.max(s, 0.5); t++) {
          const x = (r() - 0.5) * 1200, z = (r() - 0.5) * 800 - 300; if (Math.abs(land(x, z)) > 4 || (Math.abs(x) < 3 && z > w.dock.z1 - 3)) continue;
          const sc = 0.4 + Math.pow(r(), 2) * 1.8; Hh.rock(mb, x, height(x, z) - 0.25 * sc, z, sc, r() * 6, rc[k % 3], 0.75); k++;
        }
        for (let k = 0; k < 60; k++) { const x = 6 + r() * 14, z = w.dock.z1 + 2 + r() * 10; if (height(x, z) < -0.3) Hh.lily(mb, x, z, 0.12 + r() * 0.18, r); }
      }
    });
  }

  // =========================== 5. CORAL SEA (offshore boat) ===========================
  {
    const ISL = [[1900, -3400, 450, 160], [-2700, -4600, 800, 320], [600, -7000, 1400, 520], [-900, -5200, 250, 60], [3800, -6200, 600, 220]];
    const land = (x, z) => { let d = -1e4; for (const [ix, iz, r] of ISL) d = Math.max(d, r - Math.hypot(x - ix, z - iz) + (fbm(x * 0.002 + ix, z * 0.002, 4) - 0.5) * r * 0.5); return d; };
    const height = (x, z) => {
      let best = -80, d = -1e4, hm = 0;
      for (const [ix, iz, r, h] of ISL) { const di = r - Math.hypot(x - ix, z - iz) + (fbm(x * 0.002 + ix, z * 0.002, 4) - 0.5) * r * 0.5; if (di > d) { d = di; hm = h; best = r; } }
      if (d < 0) return -Math.min(80, 1.2 + -d * 0.06);
      return 2 * (1 - Math.exp(-d / 25)) + Math.pow(smooth(0, best * 0.9, d), 1.3) * hm * (0.55 + 0.45 * ridge(x * 0.003, z * 0.003));
    };
    const P = { sea: C('#4a6a7a'), sand: C('#e9dfbf'), jungle: C('#2e5a2a'), jungle2: C('#447a33'), rock: C('#6a665e') };
    M.push({
      id: 'coralsea', name: 'Coral Sea', region: 'Australia', water: 'salt', diff: 'Hard', country: 'Australia',
      desc: 'Blue water off the Great Barrier Reef. Fish a live bait under a balloon from the boat for tuna, mahi-mahi, kingfish and black marlin.',
      rod: 'overhead', float: 'balloon', bait: ['Live slimy mackerel', '7/0 circle · balloon'], tod: 0.62, clouds: 0.62, sunAz: 0.9, kgGoal: 15,
      art: ['#6fc3ea', '#1f6aa8', '#0a2342'],
      species: ['yellowfin', 'mahimahi', 'kingfish', 'snapper', 'blackmarlin'],
      waterP: { deep: '#0a3a78', abs: [0.42, 0.08, 0.04], clar: 0.5, waveK: 1.25, flow: [0, 0], swell: 0.55 },
      land, height, R: 9000, ahead: 4500, seed: 555, boat: true,
      color(x, y, z, sl, ld) {
        if (y < 0.0) return P.sea;
        if (y < 3.5) return P.sand;
        return mixc(mixc(P.jungle, P.jungle2, noise(x * 0.01, z * 0.01)), P.rock, smooth(0.6, 0.9, sl));
      },
      spot() { return [-2.0, 0.38 + 0.03 + 1.62, -0.85]; },
      async veg(w, r, s, add, step) {
        await scatter(r, 400 * s, 20000, () => { const I = ISL[Math.floor(r() * ISL.length)], a = r() * 6.283, d = I[2] * (0.6 + r() * 0.5); return [I[0] + Math.cos(a) * d, I[1] + Math.sin(a) * d]; }, (x, z) => {
          const h = height(x, z); if (h < 1.5 || h > 40) return false; add('palm', x, h - 0.2, z, 12 + r() * 6); return true;
        }, step);
      },
      props() { }
    });
  }

  M.forEach((m, i) => { m.index = i; });
  G.mapById = id => M.find(m => m.id === id) || M[0];
  // shared ocean swell (must match the water vertex shader)
  G.wave = (x, z, t, A) => A * (0.55 * Math.sin(x * 0.11 + t * 1.05) + 0.3 * Math.sin(z * 0.17 - t * 1.3 + 1.7) + 0.15 * Math.sin((x + z) * 0.27 + t * 1.9));
  G.WSlope = (hf, x, z) => { const e = 2; return Math.hypot(hf(x + e, z) - hf(x - e, z), hf(x, z + e) - hf(x, z - e)) / (2 * e); };
})(window.G);
