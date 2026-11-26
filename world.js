'use strict';
// Generic world builder: a map definition (maps.js) supplies terrain, colours, vegetation and props.
(function (G) {
  const { v3, m4, MB, fbm, noise, smooth, lin, mixc } = G;
  const H = G.WH = {}; // helpers shared by map definitions
  // yield to the browser only every ~45 ms so loading stays fast but the progress bar still moves
  let lastYield = 0;
  const tick = async () => { const t = performance.now(); if (t - lastYield < 45) return; await new Promise(r => setTimeout(r, 0)); lastYield = performance.now(); };

  // ---------------- terrain ----------------
  async function buildTerrain(map, N, R, cx, cz, prog) {
    const mapU = u => R * (0.11 * u + 0.89 * u * Math.abs(u));
    const n = N + 1, pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), dl = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = cx + mapU(i / N * 2 - 1), z = cz + mapU(j / N * 2 - 1), k = j * n + i;
        pos[k * 3] = x; pos[k * 3 + 1] = map.height(x, z); pos[k * 3 + 2] = z; dl[k] = map.land(x, z);
      }
      if (j % 24 === 0) { prog(0.45 * j / n); await tick(); }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i, i0 = Math.max(0, i - 1), i1 = Math.min(N, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(N, j + 1);
        const a = j * n + i0, b = j * n + i1, c = j0 * n + i, d = j1 * n + i;
        const dx = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
        const dz = [pos[d * 3] - pos[c * 3], pos[d * 3 + 1] - pos[c * 3 + 1], pos[d * 3 + 2] - pos[c * 3 + 2]];
        const nn = v3.norm(v3.cross(dz, dx));
        nor.set(nn, k * 3);
        col.set(map.color(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], 1 - nn[1], dl[k]), k * 3);
      }
      if (j % 32 === 0) { prog(0.45 + 0.5 * j / n); await tick(); }
    }
    const idx = new Uint32Array(N * N * 6); let q = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    prog(1);
    return { pos, nor, col, idx };
  }
  // polar water grid (dense near the player, needed for ocean swell)
  function waterGrid(cx, cz) {
    const rings = 96, seg = 128, P = [], I = [];
    P.push(cx, 0, cz);
    for (let r = 1; r <= rings; r++) {
      const rad = 0.6 * (Math.pow(1.105, r) - 1);
      for (let s = 0; s < seg; s++) { const a = s / seg * Math.PI * 2; P.push(cx + Math.cos(a) * rad, 0, cz + Math.sin(a) * rad); }
    }
    for (let s = 0; s < seg; s++) I.push(0, 1 + (s + 1) % seg, 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = 1 + (r - 1) * seg + s, b = 1 + (r - 1) * seg + (s + 1) % seg, c = a + seg, d = b + seg;
      I.push(a, b, d, a, d, c);
    }
    return { pos: new Float32Array(P), idx: new Uint32Array(I) };
  }

  // ---------------- vegetation geometry ----------------
  function cone(mb, tiers, R0, h0, cols, r, opt = {}) {
    const seg = opt.seg || 9;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1);
      const yb = (opt.base || 0.1) + f * (opt.span || 0.8) + (r() - 0.5) * 0.02, yt = yb + h0 - 0.05 * f;
      const Rr = R0 * Math.pow(1 - f * 0.97, 0.9) + 0.02;
      mb.c(mixc(cols.inner, cols.tip, 0.15));
      const apex = mb.v([0, yt, 0], [0, 1, 0]);
      mb.c(cols.under);
      const ctr = mb.v([0, yb + 0.04, 0], [0, -1, 0]);
      const ring = [];
      for (let s = 0; s <= seg; s++) {
        const a = (s % seg) / seg * Math.PI * 2 + t * 0.7, rr = Rr * (0.72 + r() * 0.5), yj = yb + (r() - 0.6) * 0.04;
        mb.c(cols.snow && r() < 0.5 ? cols.snow : mixc(cols.tip, cols.inner, r() * 0.35));
        ring.push(mb.v([Math.cos(a) * rr, yj, Math.sin(a) * rr], v3.norm([Math.cos(a), 0.55, Math.sin(a)])));
      }
      for (let s = 0; s < seg; s++) { mb.tri(apex, ring[s + 1], ring[s]); mb.tri(ctr, ring[s], ring[s + 1]); }
    }
  }
  function blobs(mb, r, list, light, dark, squash = 0.85) {
    const { V, F } = G.icosphere(1);
    for (const [c, s] of list) {
      const ids = V.map(p => {
        const k = 1 + (noise(p[0] * 2 + c[0] * 9, p[2] * 2 + p[1] * 2 + c[2] * 7) - 0.5) * 0.55;
        mb.c(mixc(dark, light, Math.max(0, Math.min(1, p[1] * 0.5 + 0.45 + (r() - 0.5) * 0.3))));
        return mb.v([c[0] + p[0] * s * k, c[1] + p[1] * s * k * squash, c[2] + p[2] * s * k], v3.norm([p[0], p[1] + 0.3, p[2]]));
      });
      for (const [i, j, k] of F) mb.tri(ids[i], ids[j], ids[k]);
    }
  }
  const GEO = {
    spruceA: () => { const mb = new MB(), r = G.rng(11); mb.c(lin('#3d2d20')); mb.cyl([0, 0, 0], [0, 0.45, 0], 0.02, 0.01, 6, false); cone(mb, 9, 0.21, 0.2, { tip: lin('#34502d'), inner: lin('#13241a'), under: lin('#0c180d') }, r); return mb.build(); },
    spruceB: () => { const mb = new MB(), r = G.rng(23); mb.c(lin('#3d2d20')); mb.cyl([0, 0, 0], [0, 0.45, 0], 0.02, 0.01, 6, false); cone(mb, 12, 0.14, 0.15, { tip: lin('#2f4a2a'), inner: lin('#13241a'), under: lin('#0c180d') }, r); return mb.build(); },
    broad: () => {
      const mb = new MB(), r = G.rng(5); mb.c(lin('#4a4036'));
      mb.tube([[0, 0, 0], [0.01, 0.25, 0], [0.03, 0.5, 0.01]], [0.03, 0.022, 0.014], 6);
      const L = []; for (let b = 0; b < 7; b++) { const a = r() * 6.283, rad = r() * 0.16; L.push([[Math.cos(a) * rad, 0.55 + r() * 0.32, Math.sin(a) * rad], 0.13 + r() * 0.1]); }
      blobs(mb, r, L, lin('#4f6e2e'), lin('#22361a')); return mb.build();
    },
    // Australian river red gum: pale twisted trunk, sparse olive clumps
    gum: () => {
      const mb = new MB(), r = G.rng(77);
      mb.c(lin('#b9b0a2'));
      mb.tube([[0, 0, 0], [0.04, 0.2, 0.01], [-0.02, 0.42, 0.03], [0.03, 0.55, 0]], [0.06, 0.045, 0.032, 0.022], 8);
      const br = [[[0.03, 0.5, 0], [0.22, 0.72, 0.06]], [[0.0, 0.45, 0.02], [-0.2, 0.68, -0.05]], [[0.03, 0.55, 0], [0.02, 0.85, 0.16]], [[0.02, 0.5, 0.01], [0.08, 0.8, -0.2]]];
      mb.c(lin('#c9c0b0'));
      for (const [a, b] of br) mb.tube([a, v3.lerp(a, b, 0.5).map((v, k) => k === 1 ? v + 0.03 : v), b], [0.02, 0.014, 0.008], 6);
      const L = br.map(([, b]) => [b, 0.1 + r() * 0.06]).concat([[[0.05, 0.9, 0.02], 0.11], [[-0.1, 0.78, 0.1], 0.08]]);
      blobs(mb, r, L, lin('#7b8a4c'), lin('#2f3a1f'), 0.55); return mb.build();
    },
    cherry: () => {
      const mb = new MB(), r = G.rng(31); mb.c(lin('#3b2a26'));
      mb.tube([[0, 0, 0], [0.03, 0.22, 0], [0.0, 0.38, 0.02]], [0.045, 0.032, 0.022], 7);
      for (const b of [[0.25, 0.55, 0.05], [-0.22, 0.52, -0.06], [0.04, 0.62, 0.22], [0.02, 0.6, -0.2]]) mb.tube([[0.0, 0.36, 0.02], b], [0.018, 0.009], 5);
      const L = []; for (let b = 0; b < 10; b++) { const a = r() * 6.283, rad = 0.05 + r() * 0.28; L.push([[Math.cos(a) * rad, 0.5 + r() * 0.22, Math.sin(a) * rad], 0.1 + r() * 0.09]); }
      blobs(mb, r, L, lin('#ffd2e2'), lin('#c9708e'), 0.7); return mb.build();
    },
    beech: () => {
      const mb = new MB(), r = G.rng(41); mb.c(lin('#3a332c'));
      mb.tube([[0, 0, 0], [0.01, 0.4, 0]], [0.03, 0.018], 6);
      const L = []; for (let b = 0; b < 9; b++) { const a = r() * 6.283, rad = r() * 0.2; L.push([[Math.cos(a) * rad, 0.45 + r() * 0.45, Math.sin(a) * rad], 0.12 + r() * 0.08]); }
      blobs(mb, r, L, lin('#3d5a2a'), lin('#16241a'), 0.8); return mb.build();
    },
    jpine: () => { // Japanese black pine: crooked trunk, flat cloud-like layers
      const mb = new MB(), r = G.rng(53); mb.c(lin('#3a2c24'));
      mb.tube([[0, 0, 0], [0.06, 0.3, 0], [-0.04, 0.6, 0.03], [0.05, 0.85, 0]], [0.035, 0.03, 0.022, 0.012], 6);
      const L = [[[0.22, 0.5, 0.05], 0.16], [[-0.2, 0.66, -0.04], 0.15], [[0.08, 0.86, 0.05], 0.14], [[0.05, 0.72, -0.18], 0.12]];
      blobs(mb, r, L, lin('#3e5a32'), lin('#152218'), 0.38); return mb.build();
    },
    palm: () => {
      const mb = new MB(); mb.c(lin('#8a7558'));
      mb.tube([[0, 0, 0], [0.06, 0.35, 0], [0.16, 0.7, 0], [0.2, 0.9, 0]], [0.025, 0.02, 0.018, 0.016], 6);
      mb.c(lin('#3f6a2a'));
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.283, d = [Math.cos(a), 0, Math.sin(a)], t = [0.2, 0.9, 0];
        const p1 = v3.add(t, [d[0] * 0.18, 0.06, d[2] * 0.18]), p2 = v3.add(t, [d[0] * 0.34, -0.06, d[2] * 0.34]);
        const sd = [-d[2] * 0.05, 0, d[0] * 0.05], n = [0, 1, 0];
        const ids = [t, p1, p2].flatMap((p, k) => [mb.v(v3.add(p, v3.mul(sd, k === 2 ? 0.1 : 1)), n), mb.v(v3.sub(p, v3.mul(sd, k === 2 ? 0.1 : 1)), n)]);
        mb.quad(ids[0], ids[1], ids[3], ids[2]); mb.quad(ids[2], ids[3], ids[5], ids[4]);
      }
      return mb.build();
    },
    reeds: () => clump(3, 10, 0.9, 0.8, '#4a5728', '#a09658', true),
    grass: () => clump(9, 14, 0.22, 0.3, '#3a5220', '#7e8a3e', false),
    tussock: () => clump(15, 26, 0.35, 0.35, '#8a7a3e', '#d8c27a', false, 0.55),
    flax: () => clump(19, 14, 0.9, 0.5, '#2f4a24', '#6a7a3a', false, 0.3, 0.03),
    drygrass: () => clump(21, 18, 0.3, 0.3, '#7a6a3a', '#c9b06a', false, 0.5)
  };
  function clump(seed, nb, hMin, hVar, c0, c1, cattail, lean = 0.6, w0 = 0.011) {
    const r = G.rng(seed), mb = new MB(), base = lin(c0), tipc = lin(c1);
    for (let b = 0; b < nb; b++) {
      const a = r() * 6.283, off = r() * 0.15, h = hMin + r() * hVar;
      const la = r() * 6.283, ld = [Math.cos(la), 0, Math.sin(la)], side = [-Math.sin(la), 0, Math.cos(la)];
      const bp = [Math.cos(a) * off, 0, Math.sin(a) * off], L = lean * (0.4 + r()), ids = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4, c = v3.add(bp, [ld[0] * h * t * t * L, h * t * (1 - 0.15 * t * L), ld[2] * h * t * t * L]);
        mb.c(mixc(base, tipc, t));
        const n = v3.norm([ld[0] * 0.4, 1, ld[2] * 0.4]);
        ids.push(mb.v(v3.madd(c, side, w0 * (1 - t)), n), mb.v(v3.madd(c, side, -w0 * (1 - t)), n));
      }
      for (let k = 0; k < 4; k++) mb.quad(ids[k * 2], ids[k * 2 + 1], ids[k * 2 + 3], ids[k * 2 + 2]);
      if (cattail && b < 2) { mb.c(lin('#4a2e1a')); const top = v3.add(bp, [ld[0] * h * L * 0.7, h * 0.86, ld[2] * h * L * 0.7]); mb.cyl(top, v3.add(top, [0, 0.11, 0]), 0.014, 0.012, 6, true); }
    }
    return mb.build();
  }
  const KIND = { reeds: 1, grass: 1, tussock: 1, flax: 1, drygrass: 1 };

  // ---------------- props ----------------
  const rockVariants = [];
  function rockVariant(seed) {
    const { V, F } = G.icosphere(2), r = G.rng(seed), ox = r() * 100, oz = r() * 100;
    const P = V.map(p => {
      const k = 1 + (G.fbm(p[0] * 1.3 + ox, p[2] * 1.3 + p[1] * 1.1 + oz, 4) - 0.5) * 0.65 + (noise(p[0] * 5 + ox, p[1] * 5 + oz) - 0.5) * 0.1;
      const q = [p[0] * k, p[1] * k * 0.66, p[2] * k * 0.9];
      if (q[1] < -0.25) q[1] = -0.25 + (q[1] + 0.25) * 0.3;
      return q;
    });
    const N = P.map(() => [0, 0, 0]);
    for (const [a, b, c] of F) { const n = v3.cross(v3.sub(P[b], P[a]), v3.sub(P[c], P[a])); for (const i of [a, b, c]) N[i] = v3.add(N[i], n); }
    return { P, N: N.map(v3.norm), F };
  }
  H.rock = (mb, x, y, z, s, yaw, col, squash = 1) => {
    if (!rockVariants.length) for (let i = 0; i < 7; i++) rockVariants.push(rockVariant(100 + i));
    const rv = rockVariants[Math.floor(Math.abs(Math.sin(x * 12.9 + z * 78.2) * 43758) % rockVariants.length)];
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    mb.c(col, 2);
    const ids = rv.P.map((p, i) => {
      const q = [p[0] * s, p[1] * s * squash, p[2] * s], n = rv.N[i];
      return mb.v([x + c * q[0] - sn * q[2], y + q[1], z + sn * q[0] + c * q[2]], v3.norm([c * n[0] - sn * n[2], n[1] / squash, sn * n[0] + c * n[2]]));
    });
    for (const [a, b, cc] of rv.F) mb.tri(ids[a], ids[b], ids[cc]);
  };
  // wooden jetty along -z from z0 (land) to z1 (end) centred on x
  H.dock = (w, mb, o) => {
    const r = G.rng(7), deck = o.deck, z0 = o.z0, z1 = o.z1, x0 = o.x || 0, hw = o.hw || 0.98;
    const woods = (o.woods || ['#7b6a57', '#6a5948', '#857462', '#5d4f40', '#77624c']).map(h => lin(h));
    for (let z = z1; z < z0; z += 0.168) {
      const th = (r() - 0.5) * 0.02, ww = 0.075, col = woods[Math.floor(r() * woods.length)];
      mb.c(mixc(col, [col[0] * 0.8, col[1] * 0.85, col[2] * 0.8], r()), 1);
      mb.box([x0 + (r() - 0.5) * 0.04, deck - r() * 0.012, z + ww], [Math.cos(th) * hw, 0, Math.sin(th) * hw], [0, 0.022, 0], [-Math.sin(th) * ww, 0, Math.cos(th) * ww], r() * 10);
    }
    mb.c(lin(o.beam || '#3e342b'), 1);
    for (const x of [-0.74, 0.74]) mb.box([x0 + x * hw, deck - 0.12, (z0 + z1) / 2], [0.045, 0, 0], [0, 0.085, 0], [0, 0, (z0 - z1) / 2], 3);
    for (let z = z1 + 0.08; z < z0; z += 2.3) for (const x of [-hw, hw]) {
      const top = deck + (z < z1 + 1 ? 0.55 : 0.06) + r() * 0.05, bot = Math.min(w.height(x0 + x, z) - 0.4, -0.3);
      mb.c(lin(o.post || '#4d4034'), 1);
      mb.cyl([x0 + x, bot, z], [x0 + x + (r() - 0.5) * 0.04, top, z], 0.095, 0.085, 8, true);
    }
  };
  H.tackleBox = (mb, p, col = '#2c5a3c') => {
    mb.c(lin(col), 6); mb.box([p[0], p[1] + 0.09, p[2]], [0.21, 0, 0.02], [0, 0.09, 0], [-0.008, 0, 0.115], 0);
    mb.c(mixc(lin(col), [0, 0, 0], 0.2), 6); mb.box([p[0], p[1] + 0.195, p[2]], [0.215, 0, 0.02], [0, 0.018, 0], [-0.008, 0, 0.12], 0);
    mb.c(lin('#1b1b1b'), 6); mb.torus([p[0], p[1] + 0.215, p[2]], [0, 0, 1], 0.06, 0.008, 10, 5, Math.PI, 0, [1, 0, 0]);
  };
  H.bucket = (mb, p, col = '#5f7484') => {
    mb.c(lin(col), 6); mb.tube([p, v3.add(p, [0, 0.3, 0])], [0.12, 0.15], 16, { caps: false });
    mb.c(lin('#1d2a2c'), 6); mb.cyl(v3.add(p, [0, 0.2, 0]), v3.add(p, [0, 0.205, 0]), 0.138, 0.138, 16, true);
    mb.c(lin('#8a8a86'), 3); mb.torus(v3.add(p, [0, 0.3, 0]), [0, 0, 1], 0.15, 0.005, 12, 4, Math.PI, 0, [1, 0, 0]);
  };
  H.lily = (mb, x, z, s, r) => {
    const y = 0.012 + r() * 0.004;
    mb.c(mixc(lin('#2d5119'), lin('#557a2a'), r()), 10);
    const notch = 0.35 + r() * 0.2, a0 = r() * 6.283, seg = 12, ctr = mb.v([x, y + 0.004, z], [0, 1, 0]);
    let prev = -1;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + notch / 2 + i / seg * (Math.PI * 2 - notch), rr = s * (0.94 + r() * 0.08);
      const id = mb.v([x + Math.cos(a) * rr, y, z + Math.sin(a) * rr], v3.norm([Math.cos(a) * 0.1, 1, Math.sin(a) * 0.1]));
      if (prev >= 0) mb.tri(ctr, id, prev); prev = id;
    }
    if (r() < 0.07) {
      const pc = r() < 0.6 ? lin('#f3f0ea') : lin('#e8a9c6'), fx = x + (r() - 0.5) * s * 0.6, fz = z + (r() - 0.5) * s * 0.6;
      for (let p = 0; p < 9; p++) {
        const a = p / 9 * 6.283 + r() * 0.3, d = [Math.cos(a), 0, Math.sin(a)];
        mb.c(pc, 6);
        const b = [fx, y + 0.02, fz], t = [fx + d[0] * 0.07, y + 0.07, fz + d[2] * 0.07], sd = [-d[2] * 0.022, 0, d[0] * 0.022], n = v3.norm([d[0] * 0.3, 1, d[2] * 0.3]);
        mb.quad(mb.v(b, n), mb.v(v3.add(v3.lerp(b, t, 0.5), sd), n), mb.v(t, n), mb.v(v3.sub(v3.lerp(b, t, 0.5), sd), n));
      }
      mb.c(lin('#e7b532'), 6); mb.sphere([fx, y + 0.045, fz], 0.018, 6, 4);
    }
  };
  H.snag = (mb, p, yaw, s, r) => { // dead tree lying in the water
    const d = [Math.cos(yaw), 0, Math.sin(yaw)];
    mb.c(lin('#8a8478'), 1);
    const a = v3.add(p, [0, 0.4 * s, 0]), b = v3.add(v3.madd(p, d, 6 * s), [0, -0.6 * s, 0]);
    mb.tube([a, v3.lerp(a, b, 0.5), b], [0.28 * s, 0.22 * s, 0.14 * s], 9, { caps: true });
    for (let i = 0; i < 5; i++) {
      const t = 0.2 + i * 0.16, o = v3.lerp(a, b, t), dir = v3.norm([d[0] * 0.4 + (r() - 0.5), 0.8 + r() * 0.6, d[2] * 0.4 + (r() - 0.5)]);
      const e = v3.madd(o, dir, (1.4 + r() * 1.6) * s), m = v3.add(v3.lerp(o, e, 0.5), [(r() - 0.5) * 0.4 * s, 0, (r() - 0.5) * 0.4 * s]);
      mb.tube([o, m, e], [0.09 * s, 0.06 * s, 0.025 * s], 6, { caps: true });
    }
    // root plate
    mb.c(lin('#5e554a'), 2); mb.ell(v3.madd(a, d, -0.2 * s), [0.15 * s, 0, 0], [0, 0.9 * s, 0], [0, 0, 0.9 * s], 10, 6);
  };
  H.log = (mb, p, yaw, L, rad) => {
    const d = [Math.cos(yaw), 0, Math.sin(yaw)];
    mb.c(lin('#6e6252'), 1); mb.tube([v3.madd(p, d, -L / 2), v3.madd(p, d, L / 2)], [rad, rad * 0.8], 10, { caps: true });
  };
  H.cabin = (mb, x, y, z, toward, wall = '#7c2b20') => {
    const toL = v3.norm(toward), right = v3.cross([0, 1, 0], toL);
    mb.T = m4.basis(right, [0, 1, 0], toL, [x, y, z]);
    mb.c(lin('#555049'), 2); mb.box([0, 0.25, 0], [3.2, 0, 0], [0, 0.35, 0], [0, 0, 2.7]);
    mb.c(lin(wall), 1); mb.box([0, 1.95, 0], [3, 0, 0], [0, 1.4, 0], [0, 0, 2.5], 2);
    mb.tri(mb.v([-3, 3.35, 2.5], [0, 0, 1]), mb.v([3, 3.35, 2.5], [0, 0, 1]), mb.v([0, 5, 2.5], [0, 0, 1]));
    mb.tri(mb.v([-3, 3.35, -2.5], [0, 0, -1]), mb.v([0, 5, -2.5], [0, 0, -1]), mb.v([3, 3.35, -2.5], [0, 0, -1]));
    mb.c(lin('#2f2c2a'), 6);
    const th = Math.atan2(1.65, 3), L = Math.hypot(3.4, 1.9) / 2;
    mb.box([-1.62, 4.2, 0], [Math.cos(th) * L, Math.sin(th) * L, 0], [-Math.sin(th) * 0.07, Math.cos(th) * 0.07, 0], [0, 0, 2.9]);
    mb.box([1.62, 4.2, 0], [Math.cos(th) * L, -Math.sin(th) * L, 0], [Math.sin(th) * 0.07, Math.cos(th) * 0.07, 0], [0, 0, 2.9]);
    mb.c(lin('#6a645c'), 2); mb.box([1.6, 4.6, -1], [0.3, 0, 0], [0, 0.9, 0], [0, 0, 0.3]);
    mb.c(lin('#2a1d16'), 1); mb.box([0.9, 1.5, 2.52], [0.45, 0, 0], [0, 1.0, 0], [0, 0, 0.03]);
    mb.c(lin('#ffb06a'), 9); mb.box([-1.6, 2.1, 2.52], [0.55, 0, 0], [0, 0.45, 0], [0, 0, 0.03]);
    mb.c(lin('#6a5a48'), 1); mb.box([0, 0.55, 3.6], [3, 0, 0], [0, 0.05, 0], [0, 0, 1.1], 4);
    mb.T = null;
  };
  H.torii = (mb, x, y, z, s, yaw) => {
    const right = [Math.cos(yaw), 0, Math.sin(yaw)], fw = [-right[2], 0, right[0]];
    mb.T = m4.basis(v3.mul(right, s), [0, s, 0], v3.mul(fw, s), [x, y, z]);
    mb.c(lin('#d23a1c'), 6);
    for (const px of [-2.2, 2.2]) mb.cyl([px, -2, 0], [px * 0.94, 7, 0], 0.32, 0.28, 12, true);
    mb.c(lin('#161414'), 6); for (const px of [-2.2, 2.2]) mb.cyl([px, -2, 0], [px, 0.2, 0], 0.36, 0.36, 12, true);
    mb.c(lin('#d23a1c'), 6); mb.box([0, 5.8, 0], [3.0, 0, 0], [0, 0.22, 0], [0, 0, 0.22]);
    mb.box([0, 4.3, 0], [0.2, 0, 0], [0, 0.7, 0], [0, 0, 0.18]);
    mb.c(lin('#161414'), 6);
    const curve = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; curve.push([t * 3.9, 7.15 + t * t * 0.45, 0]); }
    mb.tube(curve, curve.map(() => 0.3), 8, { caps: true });
    mb.c(lin('#d23a1c'), 6); mb.tube(curve.map(p => [p[0] * 0.95, p[1] - 0.45, p[2]]), curve.map(() => 0.24), 8, { caps: true });
    mb.T = null;
  };
  H.pagoda = (mb, x, y, z, s, yaw) => {
    mb.T = m4.basis([Math.cos(yaw) * s, 0, Math.sin(yaw) * s], [0, s, 0], [-Math.sin(yaw) * s, 0, Math.cos(yaw) * s], [x, y, z]);
    mb.c(lin('#6b6660'), 2); mb.box([0, 0.5, 0], [4, 0, 0], [0, 0.5, 0], [0, 0, 4]);
    let yy = 1;
    for (let i = 0; i < 5; i++) {
      const w = 2.6 - i * 0.35, h = 2.1 - i * 0.1;
      mb.c(lin('#d9cbb4'), 1); mb.box([0, yy + h / 2, 0], [w, 0, 0], [0, h / 2, 0], [0, 0, w]);
      mb.c(lin('#b33a24'), 1); mb.box([0, yy + h * 0.45, 0], [w + 0.05, 0, 0], [0, 0.15, 0], [0, 0, w + 0.05]);
      yy += h;
      mb.c(lin('#2d2f33'), 6);
      const R = w + 1.3; // flared roof as a flat pyramid
      const top = mb.v([0, yy + 0.9, 0], [0, 1, 0]), c4 = [[R, yy - 0.15, R], [-R, yy - 0.15, R], [-R, yy - 0.15, -R], [R, yy - 0.15, -R]].map(p => mb.v(p, v3.norm([p[0], 2, p[2]])));
      for (let k = 0; k < 4; k++) mb.tri(top, c4[k], c4[(k + 1) % 4]);
      yy += 0.5;
    }
    mb.c(lin('#9c8a4a'), 3); mb.cyl([0, yy + 0.4, 0], [0, yy + 3.2, 0], 0.08, 0.05, 8, true);
    mb.T = null;
  };
  H.lantern = (mb, p) => {
    mb.c(lin('#8b8780'), 2);
    mb.box(v3.add(p, [0, 0.1, 0]), [0.28, 0, 0], [0, 0.1, 0], [0, 0, 0.28]);
    mb.cyl(v3.add(p, [0, 0.2, 0]), v3.add(p, [0, 0.9, 0]), 0.1, 0.09, 8, true);
    mb.c(lin('#ffcf8a'), 9); mb.box(v3.add(p, [0, 1.05, 0]), [0.2, 0, 0], [0, 0.15, 0], [0, 0, 0.2]);
    mb.c(lin('#7d7a74'), 2); mb.cyl(v3.add(p, [0, 1.2, 0]), v3.add(p, [0, 1.42, 0]), 0.42, 0.05, 6, true);
  };
  H.rowboat = (mb, p, yaw, col = '#7a5a3a') => {
    const d = [Math.cos(yaw), 0, Math.sin(yaw)], sd = [-d[2], 0, d[0]];
    mb.T = m4.basis(d, [0, 1, 0], sd, p);
    mb.c(lin(col), 1);
    const pts = [], rr = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; pts.push([t * 1.8, 0.1 - t * t * 0.05, 0]); rr.push(0.55 * Math.sqrt(1 - t * t * 0.85)); }
    mb.tube(pts, rr, 12, { caps: true });
    mb.c(lin('#4a3628'), 1); mb.box([0, 0.38, 0], [1.6, 0, 0], [0, 0.03, 0], [0, 0, 0.45]);
    mb.T = null;
  };
  H.chair = (mb, p, yaw) => { // folding camp chair
    mb.T = m4.basis([Math.cos(yaw), 0, Math.sin(yaw)], [0, 1, 0], [-Math.sin(yaw), 0, Math.cos(yaw)], p);
    mb.c(lin('#2b2f33'), 3);
    for (const [a, b] of [[[-0.25, 0, -0.25], [0.25, 0.45, 0.2]], [[0.25, 0, -0.25], [-0.25, 0.45, 0.2]], [[-0.25, 0, 0.25], [0.25, 0.45, -0.2]], [[0.25, 0, 0.25], [-0.25, 0.45, -0.2]]]) mb.cyl(a, b, 0.012, 0.012, 5, false);
    mb.c(lin('#2f5a3a'), 5); mb.box([0, 0.45, 0], [0.27, 0, 0], [0, 0.02, 0], [0, 0, 0.24]); mb.box([0, 0.75, -0.25], [0.27, 0, 0], [0, 0.3, 0.06], [0, 0, 0.02]);
    mb.T = null;
  };
  H.esky = (mb, p, yaw) => {
    mb.T = m4.basis([Math.cos(yaw), 0, Math.sin(yaw)], [0, 1, 0], [-Math.sin(yaw), 0, Math.cos(yaw)], p);
    mb.c(lin('#2c6bb3'), 6); mb.box([0, 0.2, 0], [0.32, 0, 0], [0, 0.2, 0], [0, 0, 0.22]);
    mb.c(lin('#f2f2ee'), 6); mb.box([0, 0.43, 0], [0.33, 0, 0], [0, 0.035, 0], [0, 0, 0.23]);
    mb.T = null;
  };
  H.tinnie = (mb, p, yaw) => { // aluminium dinghy pulled up on the bank
    const d = [Math.cos(yaw), 0, Math.sin(yaw)], sd = [-d[2], 0, d[0]];
    mb.T = m4.basis(d, [0, 1, 0], sd, p);
    mb.c(lin('#a8adb2'), 3);
    const pts = [], rr = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; pts.push([t * 1.9, 0.2 + (t < -0.6 ? (t + 0.6) * -0.4 : 0), 0]); rr.push(0.62 * (t > 0.7 ? 1 - (t - 0.7) * 1.5 : 1)); }
    mb.tube(pts, rr, 4, { caps: true });
    mb.c(lin('#3a5f8a'), 6); mb.box([1.5, 0.35, 0], [0.25, 0, 0], [0, 0.2, 0], [0, 0, 0.5]);
    mb.T = null;
  };
  // offshore centre-console boat, built along x (bow +x), deck at y = deck
  H.boat = mb => {
    const hull = lin('#f2f1ec'), deck = lin('#cfd3d4'), dark = lin('#2a2d31'), al = lin('#c7ccd2');
    const L = 4.2, Wd = 1.35;
    mb.c(hull, 6);
    const rows = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, x = -L + t * (L * 2 + 0.6), bow = smooth(0.62, 1, t), w = Wd * (1 - bow * 0.92), keel = -0.65 + bow * 0.35, top = 0.55 + bow * 0.35;
      const ring = [];
      for (let j = 0; j <= 10; j++) { const a = j / 10, y = top + (keel - top) * Math.sin(a * Math.PI / 2), z = w * Math.cos(a * Math.PI / 2) * (1 - (1 - Math.cos(a * Math.PI / 2)) * 0.25); ring.push([x, y, z]); }
      rows.push(ring);
    }
    for (const sd of [1, -1]) {
      const ids = rows.map(r => r.map(p => mb.v([p[0], p[1], p[2] * sd], v3.norm([0, -0.3, sd]))));
      for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) mb.quad(ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1]);
    }
    mb.c(lin('#1d3f6e'), 6); for (const sd of [1, -1]) mb.box([0, 0.3, sd * (Wd + 0.002)], [L, 0, 0], [0, 0.05, 0], [0, 0, 0.004]);
    mb.c(deck, 8); mb.box([-0.2, 0.0, 0], [L - 0.1, 0, 0], [0, 0.03, 0], [0, 0, Wd - 0.08]);
    mb.c(hull, 6); for (const sd of [1, -1]) mb.box([-0.2, 0.32, sd * (Wd - 0.06)], [L - 0.2, 0, 0], [0, 0.3, 0], [0, 0, 0.06]);
    // rails
    mb.c(al, 3);
    for (const sd of [1, -1]) {
      mb.cyl([-L + 0.4, 0.92, sd * (Wd - 0.05)], [L - 0.6, 0.92, sd * (Wd - 0.15)], 0.018, 0.018, 8, true);
      for (let x = -L + 0.4; x < L - 0.5; x += 1.4) mb.cyl([x, 0.6, sd * (Wd - 0.07)], [x, 0.92, sd * (Wd - 0.07)], 0.015, 0.015, 6, false);
    }
    // centre console + T-top
    mb.c(hull, 6); mb.box([0.6, 0.55, 0], [0.45, 0, 0], [0, 0.55, 0], [0, 0, 0.55]);
    mb.c(dark, 6); mb.box([0.95, 1.2, 0], [0.12, 0.12, 0], [0, 0.15, 0], [0, 0, 0.5]);
    mb.c(al, 3); for (const sx of [0.1, 1.1]) for (const sd of [1, -1]) mb.cyl([sx, 0.02, sd * 0.6], [sx, 2.3, sd * 0.6], 0.025, 0.025, 8, false);
    mb.c(lin('#1f3550'), 5); mb.box([0.6, 2.32, 0], [0.75, 0, 0], [0, 0.04, 0], [0, 0, 0.8]);
    // rod holders with rods on the T-top
    mb.c(lin('#16222e'), 6); for (const z of [-0.4, 0, 0.4]) mb.cyl([0.1, 2.3, z], [-1.6, 4.4, z * 1.6], 0.008, 0.003, 5, false);
    // outboards at the stern
    for (const sd of [0.45, -0.45]) {
      mb.c(dark, 6); mb.box([-L - 0.35, 0.75, sd], [0.32, 0, 0], [0, 0.4, 0], [0, 0, 0.24]);
      mb.c(lin('#d9dcde'), 6); mb.box([-L - 0.3, 1.18, sd], [0.3, 0, 0], [0, 0.05, 0], [0, 0, 0.22]);
      mb.c(dark, 6); mb.box([-L - 0.38, 0.1, sd], [0.1, 0, 0], [0, 0.5, 0], [0, 0, 0.06]);
    }
    // bait tank & cooler seat
    mb.c(lin('#e7e9ea'), 6); mb.box([-2.6, 0.4, 0], [0.4, 0, 0], [0, 0.38, 0], [0, 0, 0.45]);
    mb.c(lin('#c84a2a'), 6); mb.box([-0.6, 0.3, 0], [0.4, 0, 0], [0, 0.28, 0], [0, 0, 0.3]);
    mb.c(lin('#f2f2ee'), 8); mb.box([-0.6, 0.6, 0], [0.42, 0, 0], [0, 0.04, 0], [0, 0, 0.32]);
  };

  // ---------------- water normal map ----------------
  let nrmTex = null;
  function waterNormals(S = 256) {
    if (nrmTex) return nrmTex;
    const Hh = new Float32Array(S * S), r = G.rng(42), waves = [];
    for (let i = 0; i < 48; i++) { const fx = Math.round((r() * 2 - 1) * 16), fy = Math.round((r() * 2 - 1) * 16); if (!fx && !fy) continue; waves.push([fx, fy, r() * 6.283, 1 / Math.pow(Math.hypot(fx, fy), 1.15)]); }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let h = 0; for (const [fx, fy, ph, a] of waves) h += a * Math.sin((fx * x + fy * y) / S * 6.2832 + ph); Hh[y * S + x] = h; }
    const d = new Uint8Array(S * S * 4), k = 9;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const hx = Hh[y * S + (x + 1) % S] - Hh[y * S + (x - 1 + S) % S], hy = Hh[((y + 1) % S) * S + x] - Hh[((y - 1 + S) % S) * S + x];
      const n = v3.norm([-hx * k, -hy * k, 1]), i = (y * S + x) * 4;
      d[i] = (n[0] * 0.5 + 0.5) * 255; d[i + 1] = (n[1] * 0.5 + 0.5) * 255; d[i + 2] = (n[2] * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    return nrmTex = G.tex(S, S, { data: d, mip: true, wrap: G.gl.REPEAT });
  }

  // ---------------- build ----------------
  // q: 'high' | 'low' | 'preview'; prog(fraction, label)
  G.buildWorld = async (map, q, prog = () => { }) => {
    const t0 = performance.now(), hi = q === 'high', pv = q === 'preview';
    const w = { map, q, land: map.land, height: map.height, veg: [], meshes: [] };
    map.setup && map.setup(w);
    w.spot = map.spot(w); w.yaw0 = map.yaw0 || 0;
    prog(0.02, 'Shaping the land');
    const tN = pv ? 150 : hi ? 360 : 230;
    const ter = await buildTerrain(map, tN, map.R || 2900, w.spot[0], w.spot[2] - (map.ahead ?? 120), f => prog(0.02 + f * 0.38, 'Shaping the land'));
    w.terrain = G.mesh(ter); w.meshes.push(w.terrain);
    w.water = G.mesh(waterGrid(w.spot[0], w.spot[2])); w.meshes.push(w.water);
    w.waterNrm = waterNormals();
    prog(0.42, 'Growing trees'); await tick();
    const r = G.rng(map.seed || 1234), inst = {};
    const add = (geo, x, y, z, s) => { (inst[geo] = inst[geo] || [[], []]); inst[geo][0].push(x, y, z, s); inst[geo][1].push(r() * 6.283, r(), r(), 0); };
    const scale = pv ? 0.4 : hi ? 1 : 0.55;
    await map.veg(w, r, scale, add, async f => { prog(0.42 + f * 0.25, 'Growing trees'); await tick(); });
    for (const geo in inst) {
      const m = G.instance(G.mesh(GEO[geo]()), new Float32Array(inst[geo][0]), new Float32Array(inst[geo][1]));
      w.veg.push({ mesh: m, kind: KIND[geo] ? 1 : 0, refl: geo !== 'grass' && geo !== 'drygrass', geo }); w.meshes.push(m);
    }
    prog(0.7, 'Placing rocks and props'); await tick();
    const mb = new MB();
    map.props(w, mb, r, scale, H);
    w.statics = G.mesh(mb.build()); w.meshes.push(w.statics);
    if (map.boat) { const bm = new MB(); H.boat(bm); w.boat = G.mesh(bm.build()); w.meshes.push(w.boat); }
    prog(0.8, 'Painting the fish'); await tick();
    if (!pv) {
      const list = G.SPECIES.filter(s => map.species.includes(s.id));
      for (let i = 0; i < list.length; i++) { G.fishAsset(list[i]); prog(0.8 + 0.18 * (i + 1) / list.length, 'Painting the fish'); await tick(); }
    }
    w.buildMs = performance.now() - t0;
    prog(1, 'Ready');
    return w;
  };
  G.freeWorld = w => { if (!w) return; for (const m of w.meshes) G.free(m); w.meshes = []; };
})(window.G);
