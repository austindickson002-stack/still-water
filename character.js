'use strict';
// Third-person angler for the home screen. Local space: feet at y=0, facing +z.
// Clothing is built from smooth lofted surfaces (one continuous mesh per garment) with
// folds baked into the radius and shaded darker in the creases, so it reads as loose fabric.
(function (G) {
  const { v3, MB, lin } = G;

  // Catmull-Rom through control points; each point: [x, y, z, rx, rz, foldAmp]
  function spline(cp, n) {
    const out = [];
    for (let s = 0; s < cp.length - 1; s++) {
      const p0 = cp[Math.max(0, s - 1)], p1 = cp[s], p2 = cp[s + 1], p3 = cp[Math.min(cp.length - 1, s + 2)];
      for (let i = 0; i < n; i++) {
        const t = i / n, t2 = t * t, t3 = t2 * t;
        out.push(p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(cp[cp.length - 1].slice());
    return out;
  }
  // loft a garment along a spline; folds = radial wrinkles, darker in the valleys
  function loft(mb, cp, o) {
    const pm = new MB(), seg = o.seg || 32, pts = spline(cp, o.sub || 6), col = o.col, mat = o.mat ?? 15;
    const rows = [], ref = o.ref || [1, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const c = pts[i].slice(0, 3), t = v3.norm(v3.sub(pts[Math.min(pts.length - 1, i + 1)].slice(0, 3), pts[Math.max(0, i - 1)].slice(0, 3)));
      const X = v3.norm(v3.sub(ref, v3.mul(t, v3.dot(ref, t)))), Z = v3.cross(X, t);
      const [, , , rx, rz, amp] = pts[i], row = [];
      for (let j = 0; j <= seg; j++) {
        const a = (j % seg) / seg * Math.PI * 2;
        const w = Math.sin(a * (o.k || 5) + i * 0.55 + (o.ph || 0)) * 0.6 + Math.sin(a * (o.k || 5) * 2.2 + i * 1.3 + (o.ph || 0) * 1.7) * 0.4;
        const fold = 1 + (amp || 0) * w;
        const shade = 1 - 0.38 * Math.max(0, -w) * Math.min(1, (amp || 0) * 14) - (o.ao ? o.ao(i / (pts.length - 1), a) : 0);
        pm.c([col[0] * shade, col[1] * shade, col[2] * shade], mat);
        row.push(pm.v(v3.add(c, v3.add(v3.mul(X, Math.cos(a) * rx * fold), v3.mul(Z, Math.sin(a) * rz * fold))), [0, 1, 0], [j / seg, i / (pts.length - 1)]));
      }
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) pm.quad(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
    const cap = (row, c, dir) => { pm.c(col.map(x => x * 0.55), mat); const ci = pm.v(c, dir); for (let j = 0; j < seg; j++) dir[1] > 0 || o.flip ? pm.tri(ci, row[j + 1], row[j]) : pm.tri(ci, row[j], row[j + 1]); };
    if (o.capStart) cap(rows[0], pts[0].slice(0, 3), [0, -1, 0]);
    if (o.capEnd) cap(rows[rows.length - 1], pts[pts.length - 1].slice(0, 3), [0, 1, 0]);
    pm.normals();
    for (const row of rows) { const a = row[0] * 3, b = row[seg] * 3; for (let k = 0; k < 3; k++) { const m = (pm.N[a + k] + pm.N[b + k]) / 2; pm.N[a + k] = pm.N[b + k] = m; } }
    mb.append(pm);
    return pts;
  }
  // flat ring surface (hat brim), double sided
  function brim(mb, c, r0, r1, y0, y1, col, mat) {
    const seg = 36;
    for (const sd of [1, -1]) {
      const pm = new MB(); pm.c(col, mat);
      const A = [], B = [];
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * Math.PI * 2, wob = 1 + Math.sin(a * 3) * 0.04, d = [Math.cos(a), 0, Math.sin(a)];
        A.push(pm.v([c[0] + d[0] * r0, y0 + sd * 0.002, c[2] + d[2] * r0], [0, sd, 0], [j / seg, 0]));
        B.push(pm.v([c[0] + d[0] * r1 * wob, y1 + sd * 0.002 + Math.sin(a * 2) * 0.006, c[2] + d[2] * r1 * wob], [0, sd, 0], [j / seg, 1]));
      }
      for (let j = 0; j < seg; j++) sd > 0 ? pm.quad(A[j], A[j + 1], B[j + 1], B[j]) : pm.quad(A[j], B[j], B[j + 1], A[j + 1]);
      pm.normals(); if (sd < 0) for (let i = 0; i < pm.N.length; i++) pm.N[i] = -pm.N[i];
      mb.append(pm);
    }
  }

  G.characterData = (look = {}) => {
    const mb = new MB();
    const jacket = lin(look.jacket || '#2e5560'), jacketD = lin('#1f3c45'), pants = lin(look.pants || '#968f78'), pantsD = lin('#77715d');
    const glove = lin('#1b1c1e'), skin = lin('#c99272'), shoe = lin('#ecebe6'), sole = lin('#3a3a3a'), hat = lin(look.hat || '#b39b6b');
    const acc = lin(look.accent || '#ff6a2b');

    // ---- chunky sneakers (mostly hidden by the stacked pant hems) ----
    for (const sx of [-1, 1]) {
      const x = sx * 0.115;
      loft(mb, [[x, 0.03, -0.07, 0.05, 0.035, 0], [x, 0.045, -0.02, 0.058, 0.05, 0], [x, 0.05, 0.05, 0.06, 0.05, 0], [x, 0.04, 0.12, 0.052, 0.04, 0], [x, 0.03, 0.155, 0.035, 0.028, 0]], { col: shoe, mat: 6, ref: [1, 0, 0], sub: 5, seg: 22, capStart: true, capEnd: true });
      mb.c(sole, 6); mb.ell([x, 0.016, 0.04], [0.064, 0, 0], [0, 0.017, 0], [0, 0, 0.13], 16, 6);
      mb.c(acc, 6); mb.ell([x + sx * 0.055, 0.048, 0.03], [0.006, 0, 0], [0, 0.016, 0], [0, 0, 0.05], 8, 5);
    }
    // ---- baggy pants: wide legs that stack at the ankle ----
    for (const sx of [-1, 1]) {
      const x = sx * 0.108;
      loft(mb, [
        [x * 0.9, 0.98, -0.005, 0.135, 0.135, 0.01],
        [x, 0.82, 0.0, 0.14, 0.135, 0.022],
        [x * 1.05, 0.6, 0.012, 0.13, 0.128, 0.03],
        [x * 1.08, 0.4, 0.005, 0.128, 0.126, 0.034],
        [x * 1.1, 0.22, 0.0, 0.132, 0.13, 0.06],
        [x * 1.1, 0.1, 0.01, 0.138, 0.136, 0.09],
        [x * 1.1, 0.045, 0.02, 0.14, 0.14, 0.07]
      ], { col: pants, mat: 15, ref: [1, 0, 0], k: 6, ph: sx * 2, sub: 7, seg: 34 });
      mb.c(pantsD, 15); // cargo pocket
      mb.box([x * 1.12 + sx * 0.122, 0.6, 0.0], [0.006, 0, 0], [0, 0.075, 0], [0, 0, 0.06]);
      mb.box([x * 1.12 + sx * 0.126, 0.672, 0.0], [0.006, 0, 0], [0, 0.012, 0], [0, 0, 0.062]);
    }
    loft(mb, [[0, 0.78, 0, 0.17, 0.12, 0], [0, 0.88, -0.005, 0.215, 0.145, 0.01], [0, 1.0, -0.005, 0.2, 0.14, 0.0]], { col: pants, mat: 15, sub: 4, capStart: true });

    // ---- oversized high-collar jacket ----
    const torso = [
      [0, 0.84, 0.005, 0.24, 0.175, 0.03],
      [0, 0.95, 0.0, 0.235, 0.168, 0.026],
      [0, 1.1, 0.0, 0.225, 0.158, 0.02],
      [0, 1.26, 0.005, 0.232, 0.152, 0.014],
      [0, 1.38, 0.0, 0.245, 0.142, 0.01],
      [0, 1.46, -0.005, 0.19, 0.122, 0.006],
      [0, 1.51, 0.0, 0.112, 0.105, 0.0],
      [0, 1.57, 0.008, 0.106, 0.108, 0.012],
      [0, 1.645, 0.012, 0.104, 0.106, 0.008]
    ];
    loft(mb, torso, { col: jacket, mat: 15, k: 7, sub: 6, seg: 40, ao: (t) => t > 0.92 ? 0 : 0 });
    // hem band, zip, chest pocket, drawcords, collar lining
    mb.c(jacketD, 15); mb.tube([[0, 0.835, 0.005], [0, 0.875, 0.004]], [0.243, 0.238], 40, { caps: false });
    mb.c(lin('#15282e'), 3);
    const zipPts = [[0, 0.85, 0.182], [0, 1.0, 0.172], [0, 1.15, 0.163], [0, 1.3, 0.16], [0, 1.42, 0.146], [0, 1.52, 0.11], [0, 1.6, 0.118], [0, 1.64, 0.12]];
    mb.tube(zipPts, zipPts.map(() => 0.0035), 6, { caps: true });
    mb.c(lin('#c9a227'), 3); mb.ell([0.004, 1.615, 0.124], [0.006, 0, 0], [0, 0.014, 0], [0, 0, 0.004], 6, 4);
    mb.c(jacketD, 15); mb.box([0.11, 1.28, 0.152], [0.055, 0, -0.01], [0, 0.05, 0], [0.002, 0, 0.006]);
    mb.c(acc, 6); mb.box([0.11, 1.325, 0.156], [0.05, 0, -0.009], [0, 0.004, 0], [0.002, 0, 0.004]);
    mb.c(lin('#e8e4da'), 5); for (const sx of [-1, 1]) { mb.tube([[sx * 0.03, 1.6, 0.115], [sx * 0.034, 1.53, 0.125], [sx * 0.03, 1.47, 0.13]], [0.0035, 0.0035, 0.0035], 5, { round: true }); mb.ell([sx * 0.03, 1.465, 0.13], [0.007, 0, 0], [0, 0.012, 0], [0, 0, 0.007], 6, 4); }
    mb.c(lin('#16262c'), 15); mb.tube([[0, 1.6, 0.012], [0, 1.648, 0.012]], [0.098, 0.1], 32, { caps: false });
    // bunched hood behind the collar
    loft(mb, [[0, 1.5, -0.1, 0.11, 0.05, 0.05], [0, 1.58, -0.12, 0.13, 0.06, 0.06], [0, 1.65, -0.1, 0.1, 0.05, 0.04]], { col: jacket, mat: 15, k: 5, sub: 4, capStart: true, capEnd: true });

    // ---- loose sleeves with gathered cuffs ----
    const sleeve = (pts) => loft(mb, pts, { col: jacket, mat: 15, ref: [0, 0, 1], k: 5, sub: 7, seg: 26, ph: pts[0][0] * 9 });
    const R = sleeve([[0.16, 1.41, 0.0, 0.08, 0.08, 0.0], [0.235, 1.35, 0.0, 0.085, 0.082, 0.02], [0.27, 1.22, 0.02, 0.08, 0.078, 0.035], [0.285, 1.11, 0.06, 0.078, 0.074, 0.06], [0.285, 1.0, 0.125, 0.07, 0.068, 0.06], [0.282, 0.955, 0.165, 0.06, 0.058, 0.08]]);
    const L = sleeve([[-0.16, 1.41, 0.0, 0.08, 0.08, 0.0], [-0.235, 1.35, -0.005, 0.085, 0.082, 0.02], [-0.268, 1.2, -0.02, 0.08, 0.078, 0.035], [-0.272, 1.08, -0.01, 0.076, 0.074, 0.06], [-0.264, 0.96, 0.015, 0.068, 0.066, 0.06], [-0.258, 0.905, 0.03, 0.058, 0.056, 0.08]]);
    mb.c(jacketD, 15);
    const cuff = (pts) => { const a = pts[pts.length - 2].slice(0, 3), b = pts[pts.length - 1].slice(0, 3), d = v3.norm(v3.sub(b, a)); mb.tube([v3.madd(b, d, -0.02), v3.madd(b, d, 0.012)], [0.05, 0.047], 22, { caps: false }); return v3.madd(b, d, 0.012); };
    const rCuff = cuff(R), lCuff = cuff(L);
    mb.c(acc, 6); mb.ell([0.3, 1.3, 0.03], [0.004, -0.0, 0], [0, 0.022, 0], [0, 0, 0.022], 8, 6);

    // ---- gloved hands ----
    mb.c(glove, 11);
    mb.ell([rCuff[0] + 0.01, rCuff[1] - 0.04, rCuff[2] + 0.025], [0.042, 0, 0], [0, 0.052, 0], [0, 0, 0.036], 14, 10);
    for (let f = 0; f < 4; f++) mb.tube([[0.27, 0.935 - f * 0.021, 0.212], [0.32, 0.935 - f * 0.021, 0.222], [0.34, 0.93 - f * 0.021, 0.192]], [0.0105, 0.0098, 0.009], 8, { round: true });
    mb.tube([[0.29, 0.955, 0.17], [0.31, 0.975, 0.2], [0.32, 0.98, 0.215]], [0.012, 0.011, 0.0095], 8, { round: true });
    mb.ell([lCuff[0], lCuff[1] - 0.05, lCuff[2] + 0.005], [0.034, 0, 0], [0, 0.058, 0], [0, 0, 0.044], 14, 10);
    for (let f = 0; f < 4; f++) mb.tube([[-0.24, 0.83, 0.05 - f * 0.022], [-0.236, 0.78, 0.052 - f * 0.022], [-0.248, 0.75, 0.046 - f * 0.022]], [0.0098, 0.009, 0.0082], 8, { round: true });

    // ---- head: face mostly covered by the collar, sunglasses, bucket hat ----
    mb.c(skin, 4); mb.ell([0, 1.705, 0.0], [0.086, 0, 0], [0, 0.105, 0], [0, 0, 0.098], 20, 14);
    for (const sx of [-1, 1]) mb.ell([sx * 0.086, 1.7, -0.01], [0.012, 0, 0], [0, 0.024, 0], [0, 0, 0.017], 8, 6);
    mb.ell([0, 1.69, 0.094], [0.015, 0, 0], [0, 0.02, 0], [0, 0, 0.017], 8, 6);
    mb.c(lin('#11151b'), 3); mb.torus([0, 1.718, 0.0], [0, 1, 0], 0.094, 0.017, 28, 6, Math.PI * 1.05, Math.PI * 0.975, [1, 0, 0]);
    mb.c(lin('#ff8a3a'), 3); mb.torus([0, 1.724, 0.006], [0, 1, 0], 0.096, 0.008, 28, 5, Math.PI * 0.6, Math.PI * 1.2, [1, 0, 0]);
    loft(mb, [[0, 1.765, -0.004, 0.104, 0.112, 0.01], [0, 1.82, -0.006, 0.1, 0.108, 0.02], [0, 1.87, -0.008, 0.088, 0.094, 0.015], [0, 1.885, -0.008, 0.06, 0.064, 0.0]], { col: hat, mat: 15, k: 4, sub: 5, capEnd: true });
    mb.c(lin('#7a6744'), 15); mb.tube([[0, 1.77, -0.004], [0, 1.79, -0.005]], [0.106, 0.104], 30, { caps: false });
    brim(mb, [0, 0, -0.004], 0.1, 0.165, 1.768, 1.738, hat, 15);

    // ---- rod held upright, butt on the ground ----
    const base = [0.33, 0.02, 0.2], topP = [0.36, 2.25, 0.12];
    const dir = v3.norm(v3.sub(topP, base)), at = t => v3.madd(base, dir, t);
    mb.c(lin('#1c1c1e'), 8); mb.tube([at(0.0), at(0.34)], [0.014, 0.014], 12, { caps: true });
    mb.c(lin('#a4835a'), 8); mb.tube([at(0.95), at(1.08)], [0.013, 0.012], 12, { caps: true });
    mb.c(lin('#2a2e34'), 3); mb.tube([at(0.34), at(0.95)], [0.012, 0.012], 12, { caps: true });
    mb.c(lin('#16222e'), 6); mb.tube([at(1.08), at(2.3)], [0.008, 0.002], 8, { caps: true });
    const out = [1, 0, 0];
    mb.c(lin('#2f3338'), 6); mb.ell(v3.madd(at(0.78), out, 0.07), [0.03, 0, 0], [0, 0.034, 0], [0, 0, 0.028], 14, 8);
    mb.c(lin('#9ea4ab'), 3); mb.tube([v3.madd(at(0.78), out, 0.07), v3.madd(at(0.86), out, 0.07)], [0.024, 0.024], 14, { caps: true });
    mb.c(lin('#2a2e34'), 3); mb.cyl(at(0.78), v3.madd(at(0.78), out, 0.05), 0.005, 0.005, 6, false);
    mb.c(lin('#8d939b'), 3); for (const t of [1.25, 1.5, 1.75, 1.95, 2.12]) mb.torus(v3.madd(at(t), out, 0.018), dir, 0.012 - t * 0.003, 0.0012, 10, 4);
    return mb.build();
  };
})(window.G);
