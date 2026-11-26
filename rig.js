'use strict';
(function (G) {
  const { v3, MB, lin, mixc } = G;
  const R = G.rig = {};
  const C = {
    eva: lin('#1c1c1e'), cork: lin('#a4835a'), blank: lin('#16222e'), wrap: lin('#b8922a'), metal: lin('#2a2e34'), gun: lin('#2f3338'),
    chrome: lin('#a9adb2'), gf: lin('#1b1c1e'), gp: lin('#2a2c2f'), panel: lin('#26282b'), trim: lin('#8e9298'), knit: lin('#141516'), gold: lin('#b8913f'), spool: lin('#7d8389'), line: lin('#d9ddc6'), knob: lin('#141414'), skin: lin('#b08068'), glove: lin('#232628'),
    stripe: lin('#a7acb2'), sleeve: lin('#39412f'), cuff: lin('#262b22'), ring: lin('#8d939b'), insert: lin('#2b2d30'), accent: lin('#b33a24')
  };
  R.C = C;
  // rod types: L blank length, r0/r1 blank radius base/tip, b0 where the blank starts
  R.TYPES = {
    spin: { reel: 'spin', L: 1.92, r0: 0.0078, r1: 0.0016, b0: 0.18, name: 'Spinning rod', lineKg: 8, cap: 150, cast: 52, reel2: 2.4, lineCol: '#d8dccb', lineW: 1 },
    bait: { reel: 'bait', L: 1.8, r0: 0.0085, r1: 0.0018, b0: 0.18, name: 'Baitcaster', lineKg: 12, cap: 120, cast: 45, reel2: 2.7, lineCol: '#c9d2a8', lineW: 1.1 },
    fly: { reel: 'fly', L: 2.55, r0: 0.0064, r1: 0.0012, b0: 0.14, name: 'Fly rod', lineKg: 5, cap: 90, cast: 24, reel2: 1.7, lineCol: '#d9ff3a', lineW: 2.6 },
    overhead: { reel: 'over', L: 1.45, r0: 0.0135, r1: 0.0036, b0: 0.17, name: 'Overhead boat rod', lineKg: 24, cap: 400, cast: 36, reel2: 2.2, lineCol: '#e8e2c8', lineW: 1.3 }
  };

  // s: pitch, yaw, bend, bendDir(cam space), crank, bail(0/1), lift, sx, sy, grab (left hand on crank 0..1)
  // Built for a right-hand grip, then mirrored so the rod sits in the left hand and the right hand winds.
  R.build = s0 => {
    if (!s0.mirror) return R.buildRaw(s0);
    const s = Object.assign({}, s0, { yaw: -s0.yaw, sx: -s0.sx, bendDir: s0.bendDir ? [-s0.bendDir[0], s0.bendDir[1], s0.bendDir[2]] : undefined });
    const out = R.buildRaw(s);
    const d = out.data;
    for (let i = 0; i < d.pos.length; i += 3) { d.pos[i] = -d.pos[i]; d.nor[i] = -d.nor[i]; }
    for (let i = 0; i < d.idx.length; i += 3) { const t = d.idx[i + 1]; d.idx[i + 1] = d.idx[i + 2]; d.idx[i + 2] = t; }
    out.line = out.line.map(p => [-p[0], p[1], p[2]]);
    out.tip = out.line[out.line.length - 1];
    return out;
  };
  R.buildRaw = s => {
    const mb = new MB();
    const grip = [0.15 + s.sx, -0.14 + s.sy + s.lift * 0.05, -0.55 + s.lift * 0.02];
    let D = v3.norm([-0.13, 0.34, -1]);
    D = v3.norm(v3.rot(D, [1, 0, 0], s.pitch)); D = v3.norm(v3.rot(D, [0, 1, 0], s.yaw));
    const side = v3.norm(v3.cross(D, [0, 1, 0])), up = v3.cross(side, D);
    const at = (o, u = 0, sd = 0) => v3.add(v3.add(v3.add(grip, v3.mul(D, o)), v3.mul(up, u)), v3.mul(side, sd));

    const RT = R.TYPES[s.rodType || 'spin'];
    const ca = v3.add(v3.mul(D, Math.cos(s.crank)), v3.mul(up, Math.sin(s.crank)));
    let K, lineStart;
    // ---- handle + reel seat per rod type ----
    if (RT.reel === 'spin') {
      mb.c(C.eva, 8); mb.tube([at(-0.3), at(-0.2), at(-0.1), at(-0.04)], [0.0135, 0.0152, 0.0158, 0.0148], 14, { round: true });
      mb.c(C.metal, 3); mb.tube([at(-0.045), at(0.075)], [0.0118, 0.0112], 14, { caps: true });
      mb.c(C.gun, 3); mb.tube([at(0.07), at(0.09)], [0.0135, 0.0125], 14, { caps: true });
      mb.c(C.cork, 8); mb.tube([at(0.09), at(0.13), at(0.17)], [0.0132, 0.0128, 0.0112], 14, { caps: true });
    } else if (RT.reel === 'bait') {
      mb.c(C.eva, 8); mb.tube([at(-0.26), at(-0.16), at(-0.05)], [0.0135, 0.0155, 0.0145], 14, { round: true });
      mb.c(C.metal, 3); mb.tube([at(-0.05), at(0.1)], [0.0122, 0.0115], 14, { caps: true });
      mb.box(at(0.0, -0.022), v3.mul(D, 0.008), v3.mul(up, 0.012), v3.mul(side, 0.004));
      mb.c(C.eva, 8); mb.tube([at(0.1), at(0.17)], [0.0128, 0.011], 14, { caps: true });
    } else if (RT.reel === 'fly') {
      mb.c(C.metal, 3); mb.tube([at(-0.25), at(-0.15)], [0.0125, 0.0118], 14, { caps: true });
      mb.c(C.cork, 8); mb.tube([at(-0.15), at(-0.08), at(0.0), at(0.08), at(0.14)], [0.0125, 0.0145, 0.0152, 0.0135, 0.009], 14, { caps: true });
    } else {
      mb.c(C.metal, 3); mb.tube([at(-0.48), at(-0.42)], [0.017, 0.017], 12, { caps: true });
      mb.c(C.eva, 8); mb.tube([at(-0.42), at(-0.14)], [0.0165, 0.0165], 14, { caps: true });
      mb.c(lin('#b8922a'), 3); mb.tube([at(-0.14), at(-0.02)], [0.0155, 0.0155], 14, { caps: true });
      mb.c(C.eva, 8); mb.tube([at(-0.02), at(0.06), at(0.16)], [0.0175, 0.0182, 0.016], 14, { caps: true });
    }
    mb.c(C.accent, 6); mb.tube([at(RT.b0 - 0.01), at(RT.b0 + 0.005)], [RT.r0 + 0.0018, RT.r0 + 0.0012], 12, { caps: true });

    // ---- blank with bend ----
    const N = 22, L = RT.L, seg = L / N;
    let k = v3.cross(D, s.bendDir || [0, -1, 0]);
    const kl = v3.len(k); k = kl > 1e-4 ? v3.mul(k, 1 / kl) : side;
    const pts = [at(RT.b0)], rad = [RT.r0], dirs = [D];
    for (let i = 1; i <= N; i++) {
      const f = i / N, dir = v3.norm(v3.rot(D, k, s.bend * 1.25 * f * f));
      pts.push(v3.madd(pts[i - 1], dir, seg)); rad.push(RT.r0 * (1 - f) + RT.r1 * f); dirs.push(dir);
    }
    mb.c(C.blank, 6); mb.tube(pts, rad, 8, { caps: true });
    const tip = pts[N];

    // ---- reels ----
    if (RT.reel === 'spin') {
      const stemTop = at(0.015, -0.012), stemBot = v3.add(stemTop, v3.add(v3.mul(up, -0.062), v3.mul(D, -0.004)));
      const B = v3.add(stemBot, v3.add(v3.mul(up, -0.018), v3.mul(D, -0.006)));
      lineStart = v3.add(v3.add(B, v3.mul(D, 0.082)), v3.mul(up, 0.022));
      mb.c(C.metal, 3); mb.tube([at(0.0, -0.011), stemTop, v3.add(stemBot, v3.mul(up, 0.004))], [0.006, 0.0045, 0.0058], 8, { caps: true });
      mb.box(at(0.015, -0.011), v3.mul(D, 0.03), v3.mul(up, 0.002), v3.mul(side, 0.0055));
      mb.c(C.gun, 6); mb.ell(B, v3.mul(D, 0.034), v3.mul(up, 0.031), v3.mul(side, 0.026), 16, 10);
      mb.c(C.chrome, 3); mb.ell(v3.madd(B, side, -0.024), v3.mul(D, 0.022), v3.mul(up, 0.022), v3.mul(side, 0.004), 14, 6);
      mb.c(C.accent, 6); mb.ell(v3.madd(B, side, 0.024), v3.mul(D, 0.02), v3.mul(up, 0.02), v3.mul(side, 0.005), 14, 6);
      const rotA = s.crank * 5.2;
      mb.c(C.metal, 6); mb.tube([v3.madd(B, D, 0.022), v3.madd(B, D, 0.04), v3.madd(B, D, 0.058)], [0.026, 0.031, 0.029], 18, { caps: true });
      const arm = v3.add(v3.mul(up, Math.cos(rotA)), v3.mul(side, Math.sin(rotA)));
      for (const sg of [1, -1]) mb.box(v3.add(v3.madd(B, D, 0.05), v3.mul(arm, sg * 0.031)), v3.mul(D, 0.013), v3.mul(arm, 0.004), v3.mul(v3.cross(D, arm), 0.006));
      mb.c(C.chrome, 3);
      mb.torus(v3.madd(B, D, 0.062), s.bail ? v3.cross(D, arm) : v3.cross(arm, D), 0.033, 0.0016, 18, 5, Math.PI, 0, arm);
      mb.c(C.spool, 3); mb.tube([v3.madd(B, D, 0.058), v3.madd(B, D, 0.082)], [0.0245, 0.0245], 18, { caps: false });
      mb.c(C.line, 6); mb.tube([v3.madd(B, D, 0.06), v3.madd(B, D, 0.08)], [0.0228, 0.0228], 18, { caps: false });
      mb.c(C.chrome, 3); mb.torus(v3.madd(B, D, 0.082), D, 0.0245, 0.0022, 18, 5);
      mb.c(C.accent, 6); mb.cyl(v3.madd(B, D, 0.082), v3.madd(B, D, 0.088), 0.012, 0.007, 12, true);
      const Bc = v3.madd(B, side, -0.036);
      mb.c(C.metal, 3); mb.cyl(v3.madd(B, side, -0.02), Bc, 0.0048, 0.0042, 8, true);
      K = v3.add(v3.madd(Bc, ca, 0.052), v3.mul(side, -0.004));
      mb.c(C.gun, 3); mb.tube([v3.madd(Bc, ca, -0.012), Bc, K], [0.0046, 0.0044, 0.0038], 8, { round: true });
    } else if (RT.reel === 'bait' || RT.reel === 'over') {
      const big = RT.reel === 'over';
      const B = big ? at(-0.075, 0.05) : at(0.035, 0.03);
      const rr = big ? 0.04 : 0.026, hw = big ? 0.034 : 0.03;
      lineStart = v3.add(B, v3.add(v3.mul(up, rr * 0.8), v3.mul(D, big ? 0.02 : 0.03)));
      mb.c(C.metal, 3); mb.box(v3.madd(B, up, -rr * (big ? 0.95 : 0.8)), v3.mul(D, big ? 0.05 : 0.03), v3.mul(up, 0.004), v3.mul(side, 0.006));
      if (big) {
        mb.c(lin('#c9a227'), 3); mb.tube([v3.madd(B, side, -hw), v3.madd(B, side, hw)], [rr, rr], 24, { caps: false });
        mb.c(C.line, 6); mb.tube([v3.madd(B, side, -hw * 0.85), v3.madd(B, side, hw * 0.85)], [rr * 0.82, rr * 0.82], 24, { caps: false });
        mb.c(C.knob, 6); for (const sg of [1, -1]) mb.cyl(v3.madd(B, side, sg * hw), v3.madd(B, side, sg * (hw + 0.012)), rr * 1.05, rr * 0.95, 24, true);
        mb.c(C.chrome, 3); for (const sg of [1, -1]) mb.torus(v3.madd(B, side, sg * (hw + 0.006)), side, rr * 1.02, 0.003, 24, 5);
        mb.c(lin('#c9a227'), 3); mb.box(v3.add(v3.madd(B, side, hw + 0.018), v3.mul(up, 0.02)), v3.mul(D, 0.02), v3.mul(up, 0.02), v3.mul(side, 0.005));
      } else {
        mb.c(C.gun, 6); mb.ell(B, v3.mul(D, 0.042), v3.mul(up, 0.026), v3.mul(side, 0.034), 16, 10);
        mb.c(C.accent, 6); for (const sg of [1, -1]) mb.ell(v3.madd(B, side, sg * 0.03), v3.mul(D, 0.036), v3.mul(up, 0.026), v3.mul(side, 0.006), 16, 6);
        mb.c(C.line, 6); mb.tube([v3.add(v3.madd(B, side, -0.022), v3.mul(up, 0.012)), v3.add(v3.madd(B, side, 0.022), v3.mul(up, 0.012))], [0.012, 0.012], 14, { caps: false });
        mb.c(C.chrome, 3); mb.box(v3.add(B, v3.add(v3.mul(D, 0.04), v3.mul(up, 0.006))), v3.mul(D, 0.006), v3.mul(up, 0.008), v3.mul(side, 0.024));
      }
      const Bc = v3.madd(B, side, -(hw + (big ? 0.024 : 0.012)));
      mb.c(C.metal, 3); mb.cyl(v3.madd(B, side, -hw), Bc, 0.005, 0.005, 8, true);
      K = v3.add(v3.madd(Bc, ca, big ? 0.068 : 0.045), v3.mul(side, -0.004));
      mb.c(C.gun, 3); mb.tube([v3.madd(Bc, ca, big ? -0.03 : -0.02), Bc, K], [0.005, 0.005, 0.0042], 8, { round: true });
    } else { // fly reel below the butt
      const B = at(-0.2, -0.062);
      lineStart = v3.add(B, v3.mul(up, 0.04));
      mb.c(C.metal, 3); mb.box(at(-0.2, -0.016), v3.mul(D, 0.03), v3.mul(up, 0.004), v3.mul(side, 0.006));
      mb.cyl(at(-0.2, -0.016), v3.madd(B, up, 0.044), 0.004, 0.004, 6, false);
      mb.c(C.gun, 3); mb.tube([v3.madd(B, side, -0.016), v3.madd(B, side, 0.016)], [0.046, 0.046], 28, { caps: false });
      mb.c(lin('#cfe84a'), 6); mb.tube([v3.madd(B, side, -0.013), v3.madd(B, side, 0.013)], [0.036, 0.036], 28, { caps: false });
      mb.c(C.knob, 6); mb.cyl(v3.madd(B, side, 0.016), v3.madd(B, side, 0.02), 0.046, 0.044, 28, true);
      mb.c(C.chrome, 3); mb.cyl(v3.madd(B, side, -0.016), v3.madd(B, side, -0.019), 0.046, 0.04, 28, true);
      K = v3.add(v3.madd(B, side, -0.02), v3.mul(ca, 0.032));
    }
    const Kn = v3.madd(K, side, -0.018);
    mb.c(C.knob, 6); mb.ell(Kn, v3.mul(side, 0.017), v3.mul(ca, 0.0105), v3.mul(v3.cross(side, ca), 0.0105), 12, 8);

    // ---- guides ----
    const linePts = [lineStart];
    const gi = [3, 6, 9, 12, 15, 18, 20], gr = RT.reel === 'fly' ? [0.012, 0.006, 0.0055, 0.005, 0.0045, 0.004, 0.0038] : RT.reel === 'over' ? [0.016, 0.013, 0.011, 0.01, 0.009, 0.008, 0.007] : [0.019, 0.012, 0.0085, 0.0066, 0.0055, 0.0048, 0.0042];
    const gs = RT.reel === 'bait' || RT.reel === 'over' ? 1 : -1;
    gi.forEach((i, n) => {
      const dir = dirs[i], u2 = v3.mul(v3.norm(v3.sub(up, v3.mul(dir, v3.dot(up, dir)))), -gs), ringR = gr[n];
      const cen = v3.madd(pts[i], u2, -(rad[i] + ringR + 0.006 + ringR * 0.4));
      mb.c(C.wrap, 6); mb.tube([v3.madd(pts[i], dir, -0.012), v3.madd(pts[i], dir, 0.012)], [rad[i] + 0.0011, rad[i] + 0.0011], 8, { caps: true });
      mb.c(C.ring, 3); mb.cyl(v3.madd(pts[i], u2, -rad[i]), v3.madd(cen, u2, ringR), 0.0011, 0.0011, 4, false);
      mb.cyl(v3.madd(v3.madd(pts[i], u2, -rad[i]), dir, -0.008 - ringR * 0.5), v3.madd(cen, u2, ringR * 0.7), 0.0009, 0.0009, 4, false);
      mb.torus(cen, dir, ringR, RT.reel === 'over' ? 0.0025 : 0.0013, 14, 5);
      mb.c(C.insert, 6); mb.torus(cen, dir, ringR * 0.82, 0.0009, 14, 4);
      linePts.push(cen);
    });
    mb.c(C.ring, 3); mb.torus(v3.madd(tip, dirs[N], 0.002), dirs[N], 0.0032, 0.0009, 10, 4);
    linePts.push(v3.madd(tip, dirs[N], 0.003));

    // ---- hands: black gloves with jointed fingers ----
    const cross = v3.cross, norm = v3.norm, add = v3.add, sub = v3.sub, mul = v3.mul, madd = v3.madd;
    // joint chain wrapping around an axis (ctr, ax) in the plane spanned by ra/rb; curls toward decreasing angle
    const chain = (ctr, ax, ra, rb, a0, rho0, lens, drift, ell = [1, 1]) => {
      const pt = (a, r, k) => add(add(ctr, mul(ax, drift * k)), add(mul(ra, Math.cos(a) * r * ell[0]), mul(rb, Math.sin(a) * r * ell[1])));
      const J = [pt(a0, rho0, 0)]; let a = a0, rho = rho0;
      lens.forEach((L, k) => { const r2 = rho - 0.0035, avg = (rho + r2) / 2; a -= 2 * Math.asin(Math.min(0.98, L / (2 * avg))); rho = r2; J.push(pt(a, rho, k + 1)); });
      return J;
    };
    const drawFinger = (J, rf, back) => {
      const m = (a, b) => v3.lerp(a, b, 0.5);
      mb.tube([madd(J[0], back, 0.018), J[0], m(J[0], J[1]), J[1], m(J[1], J[2]), J[2], m(J[2], J[3]), J[3]],
        [rf * 1.12, rf * 1.13, rf * 0.97, rf * 1.04, rf * 0.93, rf * 0.97, rf * 0.88, rf * 0.83], 12, { round: true });
    };
    // palm: lofted rounded box from wrist (Wc) to knuckles (Kc)
    const palm = (Wc, Kc, X, Z, w0, w1, xoff) => {
      const pm = new MB(); pm.c(C.gf, 11);
      const rows = [], NS = 7, NR = 20;
      for (let i = 0; i <= NS; i++) {
        const t = i / NS * 1.08, c = madd(v3.lerp(Wc, Kc, t), X, xoff * t), end = t > 1 ? 0.7 : 1;
        const wx = (w0 + (w1 - w0) * Math.min(t, 1)) * end, wz = (0.0155 - 0.003 * Math.min(t, 1)) * (t > 1 ? 0.75 : 1), row = [];
        for (let j = 0; j <= NR; j++) {
          const f = j / NR * Math.PI * 2, cx = Math.cos(f), sz = Math.sin(f);
          const bx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.55), bz = Math.sign(sz) * Math.pow(Math.abs(sz), 0.8) * (sz < 0 ? 1.25 : 1);
          row.push(pm.v(add(c, add(mul(X, bx * wx), mul(Z, bz * wz))), [0, 1, 0], [t, j / NR]));
        }
        rows.push(row);
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) pm.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
      const cap = pm.v(madd(v3.lerp(Wc, Kc, 1.1), X, xoff), [0, 1, 0]);
      for (let j = 0; j < NR; j++) pm.tri(cap, rows[NS][j + 1], rows[NS][j]);
      pm.normals();
      mb.append(pm);
    };
    const cuff = (Wc, F) => { // ribbed knit cuff with two gold stripes
      const bands = [[0.0, 0.022, C.knit], [0.022, 0.028, C.gold], [0.028, 0.034, C.knit], [0.034, 0.04, C.gold], [0.04, 0.07, C.knit]];
      for (const [a, b, col] of bands) {
        mb.c(col, 5);
        const pts = [], rr = [];
        for (let k = 0; k <= 6; k++) { const s = a + (b - a) * k / 6; pts.push(madd(Wc, F, s + 0.004)); rr.push(0.031 + s * 0.06 + (col === C.knit && k % 2 ? 0.0012 : 0)); }
        mb.tube(pts, rr, 16, { caps: false });
      }
    };
    const hand = o => {
      // o: ctr, ax (rod/knob axis), ra, rb, a0, rho0, offs, rad, lens, thumb [pts], elbow, uncurl
      const Js = o.offs.map((off, j) => chain(madd(o.ctr, o.ax, off), o.ax, o.ra, o.rb, o.a0 + (o.da ? o.da[j] : 0), o.rho0, o.lens[j], o.drift || 0, o.ell));
      const K = Js.map(J => J[0]);
      const Kc = mul(K.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / K.length);
      const pdir = norm(sub(Js[1][1], Js[1][0]));
      const Y = norm(v3.rot(pdir, norm(cross(o.ra, o.rb)), o.uncurl));
      const Wc = madd(Kc, Y, -0.09);
      let r = sub(Kc, madd(o.ctr, o.ax, v3.dot(sub(Kc, o.ctr), o.ax)));
      const Z = norm(sub(r, mul(Y, v3.dot(r, Y))));
      const X = norm(sub(o.ax, mul(Y, v3.dot(o.ax, Y))));
      const span = v3.dot(sub(K[0], K[3]), X);
      mb.c(C.gf, 11);
      Js.forEach((J, j) => drawFinger(J, o.rad[j], mul(Y, -1)));
      palm(Wc, Kc, X, Z, Math.abs(span) * 0.42, Math.abs(span) * 0.5 + 0.008, 0);
      // knuckle ridge + back-of-hand panel
      mb.c(C.gp, 11);
      K.forEach((k, j) => mb.ell(madd(k, Z, 0.0045), mul(X, o.rad[j] * 1.05), mul(Y, 0.009), mul(Z, 0.006), 10, 6));
      mb.c(C.panel, 11); mb.ell(madd(v3.lerp(Wc, Kc, 0.55), Z, 0.0118), mul(X, Math.abs(span) * 0.36), mul(Y, 0.03), mul(Z, 0.004), 14, 6);
      mb.c(C.trim, 5); mb.ell(madd(v3.lerp(Wc, Kc, 0.55), Z, 0.0152), mul(X, Math.abs(span) * 0.22), mul(Y, 0.0025), mul(Z, 0.0016), 10, 4);
      // thumb with thenar pad
      const sgn = Math.sign(v3.dot(sub(K[0], K[3]), X)) || 1;
      const cmc = add(Wc, add(mul(X, sgn * 0.026), add(mul(Y, 0.018), mul(Z, -0.009))));
      const tp = [cmc, ...o.thumb];
      mb.c(C.gf, 11);
      mb.tube([tp[0], v3.lerp(tp[0], tp[1], 0.5), tp[1], v3.lerp(tp[1], tp[2], 0.5), tp[2], tp[3]], [0.0135, 0.0125, 0.0112, 0.0104, 0.0101, 0.0092], 12, { round: true });
      const th = v3.lerp(tp[0], tp[1], 0.45);
      mb.ell(madd(th, Z, -0.006), mul(norm(sub(tp[1], tp[0])), 0.026), mul(X, 0.013), mul(Z, 0.011), 12, 8);
      // cuff + sleeve
      const F = norm(sub(o.elbow, Wc));
      mb.c(C.gf, 11); mb.tube([madd(Wc, F, -0.012), madd(Wc, F, 0.01)], [0.026, 0.029], 14, { caps: false });
      cuff(Wc, F);
      mb.c(C.sleeve, 5); mb.tube([madd(Wc, F, 0.072), v3.lerp(Wc, o.elbow, 0.6), o.elbow], [0.047, 0.055, 0.062], 16, { caps: false });
      mb.c(C.cuff, 5); mb.torus(madd(Wc, F, 0.074), F, 0.046, 0.004, 18, 5);
    };
    // right hand: palm on the right of the grip, fingers wrap under, thumb along the top
    const R0 = 0.0135;
    hand({
      ctr: grip, ax: D, ra: side, rb: up, a0: -2.05, rho0: 0.0345, drift: -0.002,
      offs: [0.053, 0.031, 0.002, -0.021], da: [-0.05, 0, 0.05, 0.14],
      rad: [0.0087, 0.0091, 0.0086, 0.0075],
      lens: [[0.045, 0.026, 0.02], [0.049, 0.03, 0.021], [0.046, 0.028, 0.02], [0.037, 0.021, 0.018]],
      uncurl: 0.95,
      thumb: [at(0.004, R0 + 0.016, 0.02), at(0.036, R0 + 0.012, 0.005), at(0.062, R0 + 0.0095, -0.003)],
      elbow: [0.44 + s.sx * 0.5, -0.6 + s.sy * 0.5 + s.lift * 0.04, 0.12]
    });
    // free hand holding the catch
    if (s.hold) {
      const h = s.hold;
      hand({
        ctr: h.grip, ax: h.ax, ra: h.z, rb: h.y, a0: -2.2, rho0: h.rho, ell: h.ell, drift: 0,
        offs: [-0.032, -0.011, 0.01, 0.029], da: [0.1, 0, -0.05, -0.15],
        rad: [0.0085, 0.0089, 0.0084, 0.0073],
        lens: [[0.044, 0.026, 0.019], [0.048, 0.029, 0.02], [0.045, 0.027, 0.019], [0.036, 0.02, 0.017]],
        uncurl: 0.8, thumb: h.thumb, elbow: h.elbow
      });
    }
    // left hand: fist around the crank knob, following it as it turns
    else if (s.grab > 0.01) {
      const g = s.grab, kk = v3.lerp([-0.18, -0.5, -0.3], K, g), A = mul(side, -1);
      hand({
        ctr: kk, ax: A, ra: D, rb: up, a0: 2.25, rho0: 0.028, drift: 0.001,
        offs: [-0.003, 0.014, 0.03, 0.045], da: [0, -0.05, -0.1, -0.2],
        rad: [0.0085, 0.0089, 0.0084, 0.0073],
        lens: [[0.044, 0.026, 0.019], [0.048, 0.029, 0.02], [0.045, 0.027, 0.019], [0.036, 0.02, 0.017]],
        uncurl: 0.7,
        thumb: [add(kk, add(mul(A, -0.002), add(mul(D, -0.03), mul(up, -0.026)))), add(kk, add(mul(A, 0.004), add(mul(D, -0.008), mul(up, -0.02)))), add(kk, add(mul(A, 0.01), add(mul(D, 0.008), mul(up, -0.015))))],
        elbow: [-0.45 + s.sx * 0.5, -0.6 + s.sy * 0.5, -0.02]
      });
    }
    return { data: mb.build(), line: linePts, tip: linePts[linePts.length - 1], D };
  };

  // landing net: hoop at origin (axis y), handle toward +z
  R.netData = () => {
    const mb = new MB(), Rr = 0.3, bag = lin('#2b3a2c'), N = 16;
    mb.c(lin('#1c1d1f'), 6); mb.torus([0, 0, 0], [0, 1, 0], Rr, 0.012, 32, 6);
    mb.c(bag, 5);
    const bottom = [0, -0.42, 0.02];
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, p = [Math.cos(a) * Rr, 0, Math.sin(a) * Rr];
      mb.tube([p, v3.lerp(p, bottom, 0.5).map((v, k) => k === 1 ? v - 0.04 : v * 1.05), bottom], [0.0028, 0.0028, 0.0028], 4);
    }
    for (const f of [0.25, 0.5, 0.75]) mb.torus([0, -0.42 * f - 0.03 * Math.sin(f * Math.PI), 0.02 * f], [0, 1, 0], Rr * (1 - f * 0.85) * 1.02, 0.0025, 24, 4);
    mb.c(lin('#30343a'), 3); mb.cyl([0, 0, Rr], [0, 0.5, 1.9], 0.016, 0.018, 10, true);
    mb.c(lin('#111111'), 8); mb.cyl([0, 0.4, 1.6], [0, 0.5, 1.9], 0.021, 0.021, 10, true);
    return mb.build();
  };
  // floats (waterline at y=0). top = line attachment height
  R.FLOAT_TOP = { pencil: 0.125, ball: 0.06, indicator: 0.035, balloon: 0.3, hera: 0.25 };
  R.floatData = (type = 'pencil') => {
    const mb = new MB();
    if (type === 'pencil') {
      const ys = [], rs = [];
      for (let i = 0; i <= 10; i++) { const y = -0.095 + i * 0.012; ys.push(y); rs.push(0.0035 + 0.0125 * Math.pow(Math.sin(Math.PI * i / 10), 0.75)); }
      mb.c(lin('#1f3a24'), 6); mb.tube(ys.slice(0, 8).map(y => [0, y, 0]), rs.slice(0, 8), 12, { caps: true });
      mb.c(lin('#efeee8'), 6); mb.tube(ys.slice(7).map(y => [0, y, 0]), rs.slice(7), 12, { caps: true });
      mb.c(lin('#111111'), 6); mb.tube([[0, 0.024, 0], [0, 0.029, 0]], [0.0062, 0.0055], 12, { caps: true });
      mb.c(lin('#ff3d0f', 1.6), 7); mb.tube([[0, 0.029, 0], [0, 0.1, 0]], [0.0034, 0.0032], 8, { caps: true });
      mb.c(lin('#ffd21a', 1.6), 7); mb.tube([[0, 0.1, 0], [0, 0.125, 0]], [0.0033, 0.003], 8, { round: true });
      mb.c(lin('#333333'), 6); mb.tube([[0, -0.1, 0], [0, -0.15, 0]], [0.0016, 0.0012], 5, { caps: true });
    } else if (type === 'ball') { // red and white bobby cork
      mb.c(lin('#e8e6e0'), 6); mb.ell([0, -0.005, 0], [0.032, 0, 0], [0, 0.032, 0], [0, 0, 0.032], 18, 12);
      mb.c(lin('#e02b18', 1.3), 7); mb.ell([0, 0.006, 0], [0.033, 0, 0], [0, 0.026, 0], [0, 0, 0.033], 18, 8);
      mb.c(lin('#d9cfa8'), 8); mb.tube([[0, -0.06, 0], [0, 0.06, 0]], [0.004, 0.004], 6, { caps: true });
    } else if (type === 'indicator') { // fluffy yarn strike indicator
      mb.c(lin('#ff6a14', 1.5), 7); for (let i = 0; i < 6; i++) { const a = i * 1.05; mb.ell([Math.cos(a) * 0.008, 0.012 + (i % 2) * 0.006, Math.sin(a) * 0.008], [0.014, 0, 0], [0, 0.012, 0], [0, 0, 0.014], 10, 6); }
      mb.c(lin('#f2f2f2'), 6); mb.torus([0, 0.004, 0], [0, 1, 0], 0.012, 0.003, 12, 5);
    } else if (type === 'balloon') {
      mb.c(lin('#f4f2ee'), 6); mb.ell([0, 0.16, 0], [0.11, 0, 0], [0, 0.13, 0], [0, 0, 0.11], 20, 14);
      mb.c(lin('#ff7a1a', 1.2), 7); mb.ell([0, 0.16, 0], [0.112, 0, 0], [0, 0.04, 0], [0, 0, 0.112], 20, 6);
      mb.c(lin('#d8d4c8'), 6); mb.tube([[0, 0.03, 0], [0, 0.0, 0]], [0.008, 0.004], 8, { caps: true });
    } else if (type === 'hera') { // long herabuna float with coloured bands
      mb.c(lin('#c9a66a'), 6); mb.tube([[0, -0.2, 0], [0, -0.12, 0], [0, -0.04, 0], [0, 0.03, 0]], [0.0015, 0.007, 0.006, 0.0025], 10, { caps: true });
      const cols = ['#ff3d0f', '#1fa84a', '#ffd21a', '#ff3d0f', '#1f1f1f', '#ffd21a', '#ff3d0f', '#1fa84a'];
      cols.forEach((c, i) => { mb.c(lin(c, 1.5), 7); mb.tube([[0, 0.03 + i * 0.027, 0], [0, 0.057 + i * 0.027, 0]], [0.0018, 0.0016], 6, { caps: true }); });
    }
    return mb.build();
  };
})(window.G);
