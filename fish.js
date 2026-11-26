'use strict';
(function (G) {
  const { v3, MB, smooth, noise, fbm } = G;
  // depth in metres, kg range, a = length (cm) of a 1 kg fish, val = coins per kg
  G.SPECIES = [
    { id: 'bluegill', name: 'Bluegill', kg: [0.08, 0.9], a: 30, h: 0.5, w: 0.3, blunt: 0.55, arch: 0.05, tail: 0.36, fork: 0.25, eye: 1.25, dorsal: 'spiny', pat: 'bluegill', back: '#3a4f3c', side: '#7c8a63', belly: '#e9a64a', fin: '#3f4a3a', sheen: 0.06, str: 0.35, val: 40, depth: [0, 2.5], w8: 30, jump: 0, mouth: 0.05 },
    { id: 'perch', name: 'Yellow perch', kg: [0.1, 1.4], a: 36, h: 0.3, w: 0.38, blunt: 0.6, arch: 0.07, tail: 0.32, fork: 0.35, eye: 1.2, dorsal: 'spiny', pat: 'perch', back: '#4d5523', side: '#c8b048', belly: '#efe8c8', fin: '#c8692a', sheen: 0.05, str: 0.42, val: 34, depth: [0.5, 5], w8: 26, jump: 0, mouth: 0.07 },
    { id: 'lmbass', name: 'Largemouth bass', kg: [0.4, 5.5], a: 37, h: 0.3, w: 0.42, blunt: 0.55, arch: 0.06, tail: 0.33, fork: 0.25, eye: 1.0, dorsal: 'spiny', pat: 'lmbass', back: '#38451f', side: '#88935a', belly: '#ebe8d4', fin: '#58613e', sheen: 0.06, str: 0.82, val: 26, depth: [0, 4], w8: 18, jump: 0.45, mouth: 0.13 },
    { id: 'trout', name: 'Rainbow trout', kg: [0.4, 4.5], a: 42, h: 0.24, w: 0.45, blunt: 0.62, arch: 0.04, tail: 0.3, fork: 0.15, eye: 0.95, dorsal: 'soft', adipose: 1, pat: 'trout', back: '#3a4535', side: '#b8beb0', belly: '#f2efe8', fin: '#8c8a70', sheen: 0.12, str: 0.76, val: 30, depth: [2, 8], w8: 14, jump: 0.55, mouth: 0.07 },
    { id: 'striper', name: 'Striped bass', kg: [1, 14], a: 44, h: 0.26, w: 0.42, blunt: 0.6, arch: 0.05, tail: 0.33, fork: 0.45, eye: 0.85, dorsal: 'split', pat: 'striper', back: '#3b4856', side: '#ccd2d6', belly: '#f4f4f0', fin: '#7f8b96', sheen: 0.14, str: 0.95, val: 16, depth: [2, 10], w8: 9, jump: 0.15, mouth: 0.08 },
    { id: 'walleye', name: 'Walleye', kg: [0.5, 7], a: 46, h: 0.21, w: 0.46, blunt: 0.62, arch: 0.04, tail: 0.3, fork: 0.35, eye: 1.25, dorsal: 'split', pat: 'walleye', back: '#544a22', side: '#ad9d5a', belly: '#efeadb', fin: '#857745', sheen: 0.08, str: 0.7, val: 24, depth: [3, 10], w8: 10, jump: 0, mouth: 0.09 },
    { id: 'carp', name: 'Common carp', kg: [1, 18], a: 37, h: 0.33, w: 0.5, blunt: 0.52, arch: 0.1, tail: 0.34, fork: 0.35, eye: 0.75, dorsal: 'long', pat: 'carp', back: '#4b3f22', side: '#ad873a', belly: '#e3cf96', fin: '#7d5230', sheen: 0.08, str: 1.0, val: 9, depth: [0.5, 4], w8: 9, jump: 0, mouth: 0.04, barbels: 1 },
    { id: 'catfish', name: 'Channel catfish', kg: [0.8, 14], a: 46, h: 0.2, w: 0.62, blunt: 0.45, arch: 0.05, tail: 0.3, fork: 0.5, eye: 0.7, dorsal: 'cat', adipose: 1, pat: 'catfish', back: '#3b444e', side: '#8b97a3', belly: '#f0f0ea', fin: '#57606a', sheen: 0.07, str: 0.9, val: 12, depth: [3, 12], w8: 8, jump: 0, mouth: 0.08, barbels: 4 },
    // Murray River
    { id: 'murraycod', name: 'Murray cod', kg: [1, 45], a: 44, h: 0.27, w: 0.55, blunt: 0.42, arch: 0.04, tail: 0.3, fork: -0.4, eye: 0.8, dorsal: 'split', pat: 'mottle', back: '#34421f', side: '#7c8a4a', belly: '#e8e5c8', fin: '#3f4a2a', sheen: 0.05, str: 1.15, val: 14, depth: [1, 8], w8: 7, jump: 0, mouth: 0.15 },
    { id: 'goldenperch', name: 'Golden perch', kg: [0.3, 6], a: 33, h: 0.36, w: 0.4, blunt: 0.5, arch: 0.12, tail: 0.32, fork: 0.25, eye: 1.0, dorsal: 'spiny', pat: 'plain', back: '#544c22', side: '#c49f38', belly: '#f2dc96', fin: '#a3832e', sheen: 0.07, str: 0.72, val: 26, depth: [0, 6], w8: 20, jump: 0, mouth: 0.08 },
    { id: 'redfin', name: 'Redfin perch', kg: [0.15, 2.5], a: 34, h: 0.31, w: 0.38, blunt: 0.6, arch: 0.08, tail: 0.32, fork: 0.35, eye: 1.2, dorsal: 'spiny', pat: 'perch', back: '#3c4723', side: '#a2a24c', belly: '#ece6c4', fin: '#c8401f', sheen: 0.05, str: 0.5, val: 30, depth: [0.5, 6], w8: 20, jump: 0, mouth: 0.07 },
    { id: 'fwcatfish', name: 'Freshwater catfish', kg: [0.5, 6], a: 44, h: 0.2, w: 0.6, blunt: 0.45, arch: 0.04, tail: 0.28, fork: -0.2, eye: 0.6, dorsal: 'cat', pat: 'catfish', back: '#3e3a2c', side: '#7a7258', belly: '#e4e0cc', fin: '#4a4434', sheen: 0.04, str: 0.75, val: 18, depth: [1, 8], w8: 9, jump: 0, mouth: 0.07, barbels: 4 },
    // New Zealand
    { id: 'browntrout', name: 'Brown trout', kg: [0.4, 7], a: 42, h: 0.25, w: 0.45, blunt: 0.6, arch: 0.05, tail: 0.3, fork: 0.05, eye: 0.95, dorsal: 'soft', adipose: 1, pat: 'brown', back: '#463c22', side: '#b39552', belly: '#f0e2b0', fin: '#8a7448', sheen: 0.08, str: 0.85, val: 28, depth: [0, 4], w8: 12, jump: 0.45, mouth: 0.08 },
    // Japan
    { id: 'blackbass', name: 'Black bass', kg: [0.3, 5], a: 37, h: 0.3, w: 0.42, blunt: 0.55, arch: 0.06, tail: 0.33, fork: 0.25, eye: 1.0, dorsal: 'spiny', pat: 'lmbass', back: '#2f3c1c', side: '#7f8a52', belly: '#ebe8d4', fin: '#4f5838', sheen: 0.06, str: 0.82, val: 26, depth: [0, 5], w8: 20, jump: 0.45, mouth: 0.13 },
    { id: 'herabuna', name: 'Herabuna carp', kg: [0.2, 2.5], a: 30, h: 0.46, w: 0.32, blunt: 0.55, arch: 0.12, tail: 0.34, fork: 0.4, eye: 0.95, dorsal: 'long', pat: 'carp', back: '#474d50', side: '#b9bcb8', belly: '#eceae4', fin: '#7e8280', sheen: 0.12, str: 0.5, val: 34, depth: [1, 8], w8: 22, jump: 0, mouth: 0.04 },
    { id: 'koi', name: 'Koi', kg: [1, 10], a: 37, h: 0.33, w: 0.5, blunt: 0.52, arch: 0.1, tail: 0.36, fork: 0.35, eye: 0.75, dorsal: 'long', pat: 'koi', back: '#efe9df', side: '#f2ede5', belly: '#f6f3ee', fin: '#efe6dc', sheen: 0.1, str: 0.9, val: 30, depth: [0.5, 5], w8: 4, jump: 0, mouth: 0.04, barbels: 1 },
    { id: 'biwatrout', name: 'Biwa trout', kg: [0.5, 5], a: 42, h: 0.23, w: 0.45, blunt: 0.62, arch: 0.04, tail: 0.3, fork: 0.15, eye: 0.95, dorsal: 'soft', adipose: 1, pat: 'biwa', back: '#3b4650', side: '#c4c9cc', belly: '#f2f2f0', fin: '#8a9096', sheen: 0.14, str: 0.75, val: 36, depth: [3, 12], w8: 9, jump: 0.35, mouth: 0.07 },
    // Coral Sea
    { id: 'yellowfin', name: 'Yellowfin tuna', kg: [8, 90], a: 46, h: 0.27, w: 0.66, blunt: 0.55, arch: 0.03, tail: 0.55, fork: 0.95, eye: 0.8, dorsal: 'tuna', pat: 'tuna', back: '#122045', side: '#97a3b0', belly: '#eef0f2', fin: '#e8c22a', sheen: 0.22, str: 1.3, val: 7, depth: [0, 300], w8: 14, jump: 0, mouth: 0.06 },
    { id: 'mahimahi', name: 'Mahi-mahi', kg: [3, 25], a: 55, h: 0.3, w: 0.3, blunt: 0.3, arch: 0.02, tail: 0.42, fork: 0.75, eye: 0.85, dorsal: 'mahi', pat: 'mahi', back: '#1f6a4a', side: '#b6c23a', belly: '#f2e36a', fin: '#2a7aa8', sheen: 0.18, str: 1.15, val: 9, depth: [0, 300], w8: 14, jump: 0.6, mouth: 0.06 },
    { id: 'kingfish', name: 'Yellowtail kingfish', kg: [3, 40], a: 46, h: 0.24, w: 0.46, blunt: 0.6, arch: 0.04, tail: 0.42, fork: 0.7, eye: 0.85, dorsal: 'soft', pat: 'king', back: '#294a5e', side: '#c7d0d4', belly: '#f2f2ee', fin: '#e2c23a', sheen: 0.2, str: 1.3, val: 8, depth: [0, 300], w8: 14, jump: 0, mouth: 0.08 },
    { id: 'snapper', name: 'Pink snapper', kg: [1, 15], a: 33, h: 0.42, w: 0.36, blunt: 0.5, arch: 0.15, tail: 0.34, fork: 0.35, eye: 1.0, dorsal: 'spiny', pat: 'snapper', back: '#c4584f', side: '#e8968a', belly: '#f4dcd4', fin: '#d77a70', sheen: 0.12, str: 0.9, val: 16, depth: [10, 300], w8: 12, jump: 0, mouth: 0.07 },
    { id: 'blackmarlin', name: 'Black marlin', kg: [60, 450], a: 58, h: 0.2, w: 0.45, blunt: 0.55, arch: 0.03, tail: 0.75, fork: 1.0, eye: 0.6, dorsal: 'sail', pat: 'marlin', back: '#0d1932', side: '#5c6d86', belly: '#e8ecf0', fin: '#1f2c45', sheen: 0.2, str: 1.55, val: 3, depth: [0, 300], w8: 1.6, jump: 0.75, mouth: 0.05, bill: 0.22 },
    { id: 'pike', name: 'Northern pike', kg: [1, 16], a: 55, h: 0.16, w: 0.62, blunt: 0.4, arch: 0.02, tail: 0.3, fork: 0.3, eye: 0.9, dorsal: 'back', pat: 'pike', back: '#30421f', side: '#6c8743', belly: '#efebc6', fin: '#9c6e36', sheen: 0.07, str: 1.1, val: 22, depth: [1, 8], w8: 5, jump: 0.2, mouth: 0.15 }
  ];

  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function paint(sp) {
    const Wd = 512, Ht = 256, cv = document.createElement('canvas'); cv.width = Wd; cv.height = Ht;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(Wd, Ht), d = img.data;
    const back = rgb(sp.back), side = rgb(sp.side), belly = rgb(sp.belly), dark = mix(back, [10, 12, 8], 0.55);
    for (let py = 0; py < Ht; py++) for (let px = 0; px < Wd; px++) {
      const u = px / Wd, v = py / Ht, s = v <= 0.5 ? v * 2 : (1 - v) * 2;
      let c = s < 0.47 ? mix(back, side, smooth(0.04, 0.47, s)) : mix(side, belly, smooth(0.5, 0.82, s));
      const n1 = fbm(u * 18, s * 6 + (v > 0.5 ? 40 : 0), 3);
      c = mix(c, mix(c, back, 0.5), (n1 - 0.45) * 0.5 * (1 - s));
      switch (sp.pat) {
        case 'bluegill': {
          const f = 0.5 + 0.5 * Math.cos(u * 7.5 * 6.283);
          c = mix(c, dark, 0.22 * f * smooth(0.12, 0.3, u) * (1 - smooth(0.55, 0.85, s)));
          if (s > 0.62 && u < 0.6) c = mix(c, [235, 140, 45], 0.55 * smooth(0.62, 0.8, s) * (1 - smooth(0.4, 0.6, u)));
          const e = Math.hypot((u - 0.215) / 0.028, (s - 0.36) / 0.08); if (e < 1) c = mix(c, [18, 20, 38], smooth(1, 0.6, e));
          break;
        }
        case 'perch': {
          const f = smooth(0.5, 0.85, 0.5 + 0.5 * Math.cos(u * 7 * 6.283 + 0.6 + n1));
          c = mix(c, [44, 52, 18], f * 0.78 * (1 - smooth(0.4, 0.72, s)) * smooth(0.2, 0.28, u) * (1 - smooth(0.82, 0.9, u)));
          break;
        }
        case 'lmbass': {
          const band = Math.exp(-Math.pow((s - 0.43 - (n1 - 0.5) * 0.06) / 0.065, 2)) * (0.55 + 0.45 * noise(u * 26, s * 9)) * smooth(0.14, 0.24, u);
          c = mix(c, [36, 46, 22], band * 0.85);
          c = mix(c, back, smooth(0.55, 0.75, noise(u * 30, s * 14)) * 0.35 * (1 - smooth(0.25, 0.4, s)));
          break;
        }
        case 'trout': {
          c = mix(c, [205, 102, 118], Math.exp(-Math.pow((s - 0.46) / 0.085, 2)) * 0.62 * smooth(0.12, 0.22, u));
          break;
        }
        case 'striper': {
          for (let k = 0; k < 7; k++) {
            const sk = 0.13 + k * 0.072, l = Math.exp(-Math.pow((s - sk - 0.008 * Math.sin(u * 22 + k)) / 0.011, 2));
            c = mix(c, [32, 36, 42], l * (noise(u * 34 + k * 7, k * 3.1) > 0.22 ? 0.85 : 0.25) * smooth(0.2, 0.27, u) * (1 - smooth(0.8, 0.86, u)));
          }
          break;
        }
        case 'walleye': {
          const f = smooth(0.6, 0.9, 0.5 + 0.5 * Math.cos(u * 5 * 6.283));
          c = mix(c, [46, 40, 18], f * 0.55 * (1 - smooth(0.15, 0.48, s)) * smooth(0.25, 0.32, u));
          c = mix(c, [190, 170, 90], smooth(0.62, 0.8, noise(u * 60, s * 25)) * 0.35 * (1 - s));
          break;
        }
        case 'carp': {
          const gy = s * 12, row = Math.floor(gy), gx = u * 42 + (row % 2) * 0.5;
          const fx = gx - Math.floor(gx), fy = gy - row;
          const edge = smooth(0.32, 0.5, Math.max(Math.abs(fx - 0.5), Math.abs(fy - 0.5) * 0.9));
          c = mix(c, [60, 40, 15], edge * 0.4 * smooth(0.18, 0.24, u) * (1 - smooth(0.75, 0.95, s)));
          break;
        }
        case 'mottle': {
          const m = fbm(u * 14, s * 5 + (v > 0.5 ? 30 : 0), 4);
          c = mix(c, [30, 40, 18], smooth(0.5, 0.62, m) * 0.75 * (1 - smooth(0.55, 0.8, s)));
          c = mix(c, [150, 160, 90], smooth(0.42, 0.3, m) * 0.25 * (1 - s));
          break;
        }
        case 'brown': break;
        case 'koi': {
          const m = fbm(u * 5 + 3, s * 2 + (v > 0.5 ? 10 : 0), 4);
          c = mix(c, [226, 92, 32], smooth(0.5, 0.56, m) * (1 - smooth(0.7, 0.95, s)));
          if (noise(u * 22 + 5, s * 9) > 0.8 && s < 0.6) c = mix(c, [20, 20, 22], 0.8);
          break;
        }
        case 'biwa': c = mix(c, [170, 150, 160], Math.exp(-Math.pow((s - 0.46) / 0.1, 2)) * 0.2); break;
        case 'tuna': {
          c = mix(c, [210, 180, 60], Math.exp(-Math.pow((s - 0.43) / 0.025, 2)) * 0.55 * smooth(0.2, 0.3, u));
          const bars = smooth(0.6, 0.95, 0.5 + 0.5 * Math.cos(u * 26 * 6.283)) * smooth(0.6, 0.85, s);
          c = mix(c, [255, 255, 255], bars * 0.4);
          break;
        }
        case 'mahi': c = mix(c, [40, 110, 170], smooth(0.75, 0.9, noise(u * 50, s * 22)) * 0.6 * (1 - smooth(0.5, 0.8, s))); break;
        case 'king': c = mix(c, [226, 196, 60], Math.exp(-Math.pow((s - 0.42) / 0.03, 2)) * 0.85 * smooth(0.15, 0.25, u)); break;
        case 'snapper': if (noise(u * 70, s * 30) > 0.82 && s < 0.65) c = mix(c, [90, 160, 230], 0.75); break;
        case 'marlin': {
          const bars = smooth(0.65, 0.95, 0.5 + 0.5 * Math.cos(u * 14 * 6.283)) * (1 - smooth(0.2, 0.7, s)) * smooth(0.2, 0.3, u);
          c = mix(c, [130, 170, 220], bars * 0.55);
          break;
        }
        case 'plain': case 'pike': case 'catfish': break;
      }
      // scales (subtle)
      if (sp.pat !== 'catfish') {
        const gy = s * 30, row = Math.floor(gy), gx = u * 80 + (row % 2) * 0.5, fx = gx - Math.floor(gx), fy = gy - row;
        const arc = Math.abs(Math.hypot(fx - 0.15, fy - 0.5) - 0.55);
        c = mix(c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], smooth(0.08, 0.0, arc) * 0.5 * smooth(0.2, 0.26, u));
      }
      // lateral line, gill plate, head
      c = mix(c, mix(c, [30, 30, 30], 0.5), Math.exp(-Math.pow((s - 0.4 - 0.05 * Math.sin(u * 3)) / 0.006, 2)) * 0.25 * smooth(0.2, 0.3, u));
      const gx0 = 0.17 + 0.05 * s * s + (sp.pat === 'pike' ? 0.03 : 0);
      c = mix(c, [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55], smooth(0.012, 0.0, Math.abs(u - gx0)) * smooth(0.95, 0.6, s));
      if (u < gx0) c = mix(c, [c[0] * 1.05 + 8, c[1] * 1.05 + 8, c[2] * 1.05 + 8], 0.25);
      if (u < sp.mouth * 1.1 && Math.abs(s - 0.56) < 0.012 * (1 - u / sp.mouth * 0.5)) c = mix(c, [25, 18, 15], 0.85);
      c = mix(c, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7], smooth(0.04, 0.0, u) * 0.6);
      const i = (py * Wd + px) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // spots drawn mirrored on both flanks
    const r = G.rng(sp.id.charCodeAt(0) * 131 + sp.id.length);
    const spot = (u, s, rx, ry, col) => {
      ctx.fillStyle = col;
      for (const y of [s / 2 * Ht, (1 - s / 2) * Ht]) { ctx.beginPath(); ctx.ellipse(u * Wd, y, rx, ry, 0, 0, 6.283); ctx.fill(); }
    };
    if (sp.pat === 'trout') for (let k = 0; k < 220; k++) { const u = 0.08 + r() * 0.78, s = r() * 0.6; spot(u, s, 1.6 + r() * 1.8, 1.6 + r() * 1.8, 'rgba(18,16,14,.85)'); }
    if (sp.pat === 'brown') for (let k = 0; k < 160; k++) { const u = 0.1 + r() * 0.72, s = 0.05 + r() * 0.55, red = r() < 0.3, rr = 2 + r() * 2; if (red) spot(u, s, rr + 2, rr + 2, 'rgba(240,230,200,.7)'); spot(u, s, rr, rr, red ? 'rgba(190,50,30,.9)' : 'rgba(25,18,12,.85)'); }
    if (sp.pat === 'catfish') for (let k = 0; k < 120; k++) { const u = 0.2 + r() * 0.65, s = 0.08 + r() * 0.5; spot(u, s, 1.5 + r() * 1.6, 1.5 + r() * 1.6, 'rgba(22,26,30,.8)'); }
    if (sp.pat === 'pike') {
      ctx.filter = 'blur(1px)';
      for (let row = 0; row < 7; row++) for (let k = 0; k < 26; k++) {
        const u = 0.2 + k * 0.026 + (row % 2) * 0.013 + (r() - 0.5) * 0.008, s = 0.1 + row * 0.075 + (r() - 0.5) * 0.02;
        if (u > 0.86) continue;
        spot(u, s, 5 + r() * 3, 3 + r() * 1.5, 'rgba(215,212,150,.75)');
      }
      ctx.filter = 'none';
    }
    return cv;
  }

  function geo(sp) {
    const mb = new MB(), H = sp.h, WR = sp.w, BE = 0.84, NS = 36, NR = 20;
    const hAt = t => { const u = t / BE; let h = Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.93 + 0.035)), sp.blunt); h *= 1 - 0.62 * smooth(0.55, 1, u); return H * h; };
    const cyAt = t => H * sp.arch * Math.sin(Math.PI * t / BE);
    const surf = (t, a) => {
      const h = hAt(t), ca = Math.cos(a);
      return [t, cyAt(t) + 0.5 * h * ca * (ca < 0 ? 1.06 : 1), 0.5 * h * WR * Math.sin(a) * (1 - 0.32 * Math.max(0, ca))];
    };
    mb.c([1, 1, 1], 0);
    const rows = [];
    for (let i = 0; i <= NS; i++) {
      const t = BE * Math.pow(i / NS, 1.12), row = [];
      for (let j = 0; j <= NR; j++) row.push(mb.v(surf(t, j / NR * Math.PI * 2), [0, 1, 0], [t / BE, j / NR]));
      rows.push(row);
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) mb.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
    const nose = mb.v([-0.006, cyAt(0), 0], [-1, 0, 0], [0, 0.5]), tail = mb.v([BE + 0.004, cyAt(BE), 0], [1, 0, 0], [1, 0.5]);
    for (let j = 0; j < NR; j++) { mb.tri(nose, rows[0][j + 1], rows[0][j]); mb.tri(tail, rows[NS][j], rows[NS][j + 1]); }
    mb.normals();
    for (const row of rows) { // weld seam normals
      const a = row[0] * 3, b = row[NR] * 3;
      for (let k = 0; k < 3; k++) { const m = (mb.N[a + k] + mb.N[b + k]) / 2; mb.N[a + k] = mb.N[b + k] = m; }
    }
    // fins (double sided, mat 1)
    mb.mat = 1;
    const fin2 = (pts, ctr, ray) => {
      for (const sd of [1, -1]) {
        const n = [0, 0, sd], c = mb.v([ctr[0], ctr[1], sd * 0.0008], n, [ctr[0], ray(ctr)]);
        const ids = pts.map(p => mb.v([p[0], p[1], sd * 0.0008], n, [p[0], ray(p)]));
        for (let i = 0; i < ids.length - 1; i++) sd > 0 ? mb.tri(c, ids[i], ids[i + 1]) : mb.tri(c, ids[i + 1], ids[i]);
      }
    };
    const fin3 = (base, pts) => { // fan in 3D, both sides
      const e1 = v3.sub(pts[0], base), e2 = v3.sub(pts[pts.length - 1], base), n = v3.norm(v3.cross(e1, e2));
      for (const sd of [1, -1]) {
        const nn = v3.mul(n, sd), c = mb.v(base, nn, [base[0], 0]);
        const ids = pts.map((p, k) => mb.v(p, nn, [p[0], k * 0.05]));
        for (let i = 0; i < ids.length - 1; i++) sd > 0 ? mb.tri(c, ids[i], ids[i + 1]) : mb.tri(c, ids[i + 1], ids[i]);
      }
    };
    const top = t => cyAt(t) + hAt(t) * 0.5 - 0.002, bot = t => cyAt(t) - hAt(t) * 0.53 + 0.002;
    // tail
    const cy = cyAt(BE), hp = hAt(BE) * 0.5, Ht = H * sp.tail * 1.25 + 0.02, fk = sp.fork;
    fin2([[BE - 0.012, cy + hp], [0.9, cy + Ht * 0.55], [0.985, cy + Ht], [1.0, cy + Ht * 0.92], [1.0 - fk * 0.1, cy + Ht * 0.25], [0.99 - fk * 0.11, cy], [1.0 - fk * 0.1, cy - Ht * 0.25], [1.0, cy - Ht * 0.92], [0.985, cy - Ht], [0.9, cy - Ht * 0.55], [BE - 0.012, cy - hp]],
      [BE - 0.005, cy], p => Math.atan2(p[1] - cy, p[0] - BE + 0.05) * 0.4);
    const dfin = (x0, x1, hgt, spiny) => {
      const pts = [[x0, top(x0)]], n = 9;
      for (let k = 0; k <= n; k++) {
        const f = k / n, x = x0 + (x1 - x0) * f;
        let hh = spiny ? hgt * (1 - f * 0.6) * (0.7 + 0.3 * Math.abs(Math.sin(f * Math.PI * 5))) : hgt * Math.sin(Math.PI * (0.1 + f * 0.8)) * (1.15 - f * 0.4);
        if (k === 0) hh *= 0.6;
        pts.push([x + (spiny ? 0.004 : 0.01), top(x) + hh]);
      }
      pts.push([x1 + 0.015, top(x1) + 0.003], [x1 + 0.01, top(x1)]);
      fin2(pts, [(x0 + x1) / 2, top((x0 + x1) / 2) - 0.004], p => p[0] * 1.1);
    };
    const afin = (x0, x1, hgt) => {
      const pts = [[x0, bot(x0)]];
      for (let k = 0; k <= 6; k++) { const f = k / 6, x = x0 + (x1 - x0) * f; pts.push([x + 0.012, bot(x) - hgt * Math.sin(Math.PI * (0.15 + f * 0.75)) * (1.1 - f * 0.4)]); }
      pts.push([x1 + 0.01, bot(x1)]);
      fin2(pts.reverse(), [(x0 + x1) / 2, bot((x0 + x1) / 2) + 0.004], p => p[0] * 1.1);
    };
    switch (sp.dorsal) {
      case 'spiny': dfin(0.3, 0.48, H * 0.3, true); dfin(0.47, 0.66, H * 0.24, false); break;
      case 'split': dfin(0.3, 0.46, H * 0.32, true); dfin(0.52, 0.66, H * 0.28, false); break;
      case 'soft': dfin(0.38, 0.54, H * 0.36, false); break;
      case 'long': dfin(0.32, 0.68, H * 0.2, false); break;
      case 'cat': dfin(0.3, 0.37, H * 0.45, true); break;
      case 'back': dfin(0.63, 0.77, H * 0.42, false); break;
      case 'tuna': dfin(0.3, 0.44, H * 0.22, true); dfin(0.5, 0.56, H * 0.7, false);
        for (let k = 0; k < 6; k++) { const x = 0.62 + k * 0.032; fin2([[x, top(x)], [x + 0.012, top(x) + H * 0.07], [x + 0.022, top(x)]], [x + 0.011, top(x) - 0.002], p => p[0]); fin2([[x, bot(x)], [x + 0.022, bot(x)], [x + 0.012, bot(x) - H * 0.06]], [x + 0.011, bot(x) + 0.002], p => p[0]); }
        break;
      case 'mahi': dfin(0.07, 0.8, H * 0.28, false); break;
      case 'sail': dfin(0.17, 0.3, H * 0.9, true); dfin(0.3, 0.66, H * 0.15, false); break;
    }
    if (sp.adipose) dfin(0.71, 0.75, H * 0.09, false);
    if (sp.dorsal === 'back') afin(0.64, 0.77, H * 0.38); else if (sp.dorsal === 'tuna') afin(0.54, 0.6, H * 0.6); else if (sp.dorsal === 'mahi') afin(0.45, 0.8, H * 0.2); else afin(0.6, 0.72, H * 0.24);
    if (sp.bill) { mb.mat = 0; mb.tube([[0.02, cyAt(0.02) - hAt(0.02) * 0.05, 0], [-sp.bill * 0.5, cyAt(0) - hAt(0.02) * 0.04, 0], [-sp.bill, cyAt(0) - hAt(0.02) * 0.02, 0]], [hAt(0.02) * 0.18, hAt(0.02) * 0.1, 0.002], 8, { caps: true }); mb.mat = 1; }
    // pectoral & pelvic pairs
    for (const sd of [1, -1]) {
      const t = 0.23, p0 = surf(t, Math.PI * 0.62), b = [p0[0], p0[1], p0[2] * sd * 0.95];
      fin3(b, [[t + 0.002, b[1] + 0.012, b[2]], [t + 0.07, b[1] + 0.012, b[2] + sd * 0.03], [t + 0.12, b[1] - 0.005, b[2] + sd * 0.045], [t + 0.1, b[1] - 0.03, b[2] + sd * 0.035], [t + 0.012, b[1] - 0.01, b[2]]]);
      const t2 = sp.dorsal === 'back' ? 0.5 : 0.36, q = surf(t2, Math.PI * 0.88), b2 = [q[0], q[1], q[2] * sd];
      fin3(b2, [[t2, b2[1], b2[2]], [t2 + 0.06, b2[1] - 0.02, b2[2] + sd * 0.025], [t2 + 0.1, b2[1] - 0.035, b2[2] + sd * 0.03], [t2 + 0.05, b2[1] - 0.005, b2[2] + sd * 0.006]]);
    }
    // eyes
    const te = sp.dorsal === 'back' ? 0.1 : 0.085, he = hAt(te), ye = cyAt(te) + he * 0.17, a = Math.acos(Math.min(1, (ye - cyAt(te)) / (0.5 * he)));
    const ze = 0.5 * he * WR * Math.sin(a) * (1 - 0.32 * Math.max(0, Math.cos(a))), re = H * 0.07 * sp.eye;
    for (const sd of [1, -1]) {
      mb.mat = 3; mb.ell([te, ye, sd * ze * 0.86], [re, 0, 0], [0, re, 0], [0, 0, re * 0.5], 12, 8);
      mb.mat = 2; mb.ell([te, ye, sd * (ze * 0.86 + re * 0.28)], [re * 0.58, 0, 0], [0, re * 0.6, 0], [0, 0, re * 0.32], 10, 6);
    }
    // barbels
    if (sp.barbels) {
      mb.mat = 1;
      for (const sd of [1, -1]) for (let k = 0; k < sp.barbels; k++) {
        const L = (k === 0 ? 0.16 : 0.07) * (sp.barbels > 1 ? 1 : 0.5), y0 = cyAt(0.02) - hAt(0.02) * (0.1 + k * 0.12), z0 = sd * hAt(0.02) * WR * 0.35;
        mb.tube([[0.015, y0, z0], [0.0, y0 - L * 0.3, z0 + sd * L * 0.4], [0.02, y0 - L * 0.6, z0 + sd * L * 0.8]], [0.004, 0.0025, 0.001], 5);
      }
    }
    return mb.build();
  }

  const cache = {};
  G.fishAsset = sp => {
    if (cache[sp.id]) return cache[sp.id];
    const cv = paint(sp);
    const tex = G.tex(cv.width, cv.height, { data: cv, mip: true });
    return cache[sp.id] = { mesh: G.mesh(geo(sp)), tex, cv, fin: G.lin(sp.fin), sp };
  };
  G.fishLength = (sp, kg) => sp.a * Math.cbrt(kg); // cm
})(window.G);
