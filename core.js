'use strict';
window.G = window.G || {};
(function (G) {
  // ---------------- vec3 ----------------
  const v3 = G.v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    // rotate v about unit axis k by angle a (Rodrigues)
    rot(v, k, a) {
      const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
      const cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
      return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
    },
    perp(v) { // any unit vector perpendicular to v
      const a = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      return v3.norm(v3.cross(v, a));
    }
  };

  // ---------------- mat4 (column-major) ----------------
  const m4 = G.m4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    // world matrix from axes (right, up, back) and position
    basis: (r, u, b, p) => new Float32Array([r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, b[0], b[1], b[2], 0, p[0], p[1], p[2], 1]),
    tp: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
    td: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]],
    tp4(m, p) { // returns clip coords
      return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]];
    },
    invert(a) {
      const o = new Float32Array(16);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return m4.ident();
      det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    }
  };

  // ---------------- noise / random ----------------
  function hash2(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  G.noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  G.fbm = (x, y, o = 5) => {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < o; i++) { s += a * G.noise(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };
  G.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  G.smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.lin = (hex, k = 1) => { const n = parseInt(hex.slice(1), 16); return [Math.pow((n >> 16 & 255) / 255, 2.2) * k, Math.pow((n >> 8 & 255) / 255, 2.2) * k, Math.pow((n & 255) / 255, 2.2) * k]; };
  G.mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---------------- WebGL helpers ----------------
  const ATTR = { aPos: 0, aNor: 1, aCol: 2, aUv: 3, aMat: 4, iA: 5, iB: 6 };
  G.initGL = canvas => {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return null;
    G.gl = gl;
    G.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    G.emptyVao = gl.createVertexArray();
    return gl;
  };
  G.program = (vs, fs, name) => {
    const gl = G.gl;
    const mk = (t, s) => {
      const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        console.error(name, log, '\n' + s.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
        throw new Error('Shader ' + name + ': ' + log);
      }
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    for (const k in ATTR) gl.bindAttribLocation(p, ATTR[k], k);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link ' + name + ': ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
    }
    return { p, u, name };
  };
  G.use = (pr, ...sets) => { G.gl.useProgram(pr.p); for (const s of sets) G.set(pr, s); };
  G.set = (pr, un) => {
    const gl = G.gl;
    for (const k in un) {
      const u = pr.u[k]; if (!u) continue; const v = un[k];
      switch (u.type) {
        case gl.FLOAT: u.size > 1 ? gl.uniform1fv(u.loc, v) : gl.uniform1f(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
        default: gl.uniform1i(u.loc, v);
      }
    }
  };
  G.mesh = (d, dynamic) => {
    const gl = G.gl;
    const m = { vao: gl.createVertexArray(), bufs: {}, count: 0, inst: 0, idx: null, mode: gl.TRIANGLES, dyn: !!dynamic };
    gl.bindVertexArray(m.vao);
    const add = (name, data, size) => {
      if (!data) return;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(ATTR[name]); gl.vertexAttribPointer(ATTR[name], size, gl.FLOAT, false, 0, 0);
      m.bufs[name] = b;
    };
    add('aPos', d.pos, 3); add('aNor', d.nor, 3); add('aCol', d.col, 3); add('aUv', d.uv, 2); add('aMat', d.mat, 1);
    if (d.idx) {
      m.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.idx, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      m.count = d.idx.length;
    } else m.count = d.pos.length / 3;
    gl.bindVertexArray(null);
    return m;
  };
  G.update = (m, d) => {
    const gl = G.gl;
    gl.bindVertexArray(m.vao);
    for (const [name, arr] of [['aPos', d.pos], ['aNor', d.nor], ['aCol', d.col], ['aUv', d.uv], ['aMat', d.mat]]) {
      if (!arr || !m.bufs[name]) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.bufs[name]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    }
    if (d.idx && m.idx) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.idx, gl.DYNAMIC_DRAW); m.count = d.idx.length; }
    else if (!m.idx) m.count = d.pos.length / 3;
    gl.bindVertexArray(null);
  };
  G.instance = (m, iA, iB) => {
    const gl = G.gl;
    gl.bindVertexArray(m.vao);
    for (const [loc, data] of [[5, iA], [6, iB]]) {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, 1);
      (m.ibufs = m.ibufs || []).push(b);
    }
    gl.bindVertexArray(null);
    m.inst = iA.length / 4;
    return m;
  };
  G.free = m => {
    const gl = G.gl; if (!m) return;
    for (const k in m.bufs) gl.deleteBuffer(m.bufs[k]);
    (m.ibufs || []).forEach(b => gl.deleteBuffer(b));
    if (m.idx) gl.deleteBuffer(m.idx);
    gl.deleteVertexArray(m.vao); m.count = 0;
  };
  G.draw = m => {
    const gl = G.gl;
    if (!m || !m.count) return;
    gl.bindVertexArray(m.vao);
    if (m.inst) { m.idx ? gl.drawElementsInstanced(m.mode, m.count, gl.UNSIGNED_INT, 0, m.inst) : gl.drawArraysInstanced(m.mode, 0, m.count, m.inst); }
    else m.idx ? gl.drawElements(m.mode, m.count, gl.UNSIGNED_INT, 0) : gl.drawArrays(m.mode, 0, m.count);
    gl.bindVertexArray(null);
  };
  G.tex = (w, h, opt = {}) => {
    const gl = G.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const f = opt.filter || gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opt.mip ? gl.LINEAR_MIPMAP_LINEAR : f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opt.wrap || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opt.wrap || gl.CLAMP_TO_EDGE);
    if (opt.data instanceof HTMLCanvasElement || opt.data instanceof ImageData) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, opt.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, opt.ifmt || gl.RGBA8, w, h, 0, opt.fmt || gl.RGBA, opt.type || gl.UNSIGNED_BYTE, opt.data || null);
    if (opt.mip) { gl.generateMipmap(gl.TEXTURE_2D); const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8); }
    return t;
  };
  G.bindTex = (unit, t) => { const gl = G.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };

  // ---------------- Mesh builder ----------------
  class MB {
    constructor() { this.P = []; this.N = []; this.C = []; this.U = []; this.M = []; this.I = []; this.T = null; this.col = [1, 1, 1]; this.mat = 0; }
    c(col, mat) { this.col = col; if (mat !== undefined) this.mat = mat; return this; }
    v(p, n, uv) {
      if (this.T) { p = m4.tp(this.T, p); n = v3.norm(m4.td(this.T, n)); }
      this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]);
      this.C.push(this.col[0], this.col[1], this.col[2]); this.U.push(uv ? uv[0] : 0, uv ? uv[1] : 0); this.M.push(this.mat);
      return this.P.length / 3 - 1;
    }
    tri(a, b, c) { this.I.push(a, b, c); }
    quad(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
    // tube along a polyline, radii per point; round caps optional
    tube(pts, radii, seg = 8, opt = {}) {
      const n = pts.length; if (n < 2) return;
      const T = [];
      for (let i = 0; i < n; i++) T.push(v3.norm(v3.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
      let nr = opt.up ? v3.norm(v3.sub(opt.up, v3.mul(T[0], v3.dot(opt.up, T[0])))) : v3.perp(T[0]);
      const rings = [];
      const P2 = [], R2 = [], T2 = [];
      const capR = (p, t, r, dirSign) => { for (let k = 3; k >= 1; k--) { const a = k * Math.PI / 8; P2.push(v3.madd(p, t, -dirSign * r * Math.sin(a) * 0 + dirSign * r * Math.cos(a) * 0)); } };
      // build expanded list with caps
      const add = (p, r, t) => { P2.push(p); R2.push(r); T2.push(t); };
      if (opt.round) for (let k = 3; k >= 1; k--) { const a = k * Math.PI / 7; add(v3.madd(pts[0], T[0], -radii[0] * Math.sin(a)), radii[0] * Math.cos(a), T[0]); }
      for (let i = 0; i < n; i++) add(pts[i], radii[i], T[i]);
      if (opt.round) for (let k = 1; k <= 3; k++) { const a = k * Math.PI / 7; add(v3.madd(pts[n - 1], T[n - 1], radii[n - 1] * Math.sin(a)), radii[n - 1] * Math.cos(a), T[n - 1]); }
      void capR;
      for (let i = 0; i < P2.length; i++) {
        const t = T2[i];
        nr = v3.norm(v3.sub(nr, v3.mul(t, v3.dot(nr, t))));
        const b = v3.cross(t, nr), ring = [];
        for (let j = 0; j <= seg; j++) {
          const a = j / seg * Math.PI * 2, d = v3.add(v3.mul(nr, Math.cos(a)), v3.mul(b, Math.sin(a)));
          ring.push(this.v(v3.madd(P2[i], d, R2[i]), d, [i / (P2.length - 1), j / seg]));
        }
        rings.push(ring);
      }
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++)
        this.quad(rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]);
      if (opt.round) {
        const s = this.v(v3.madd(pts[0], T[0], -radii[0]), v3.mul(T[0], -1)), e = this.v(v3.madd(pts[n - 1], T[n - 1], radii[n - 1]), T[n - 1]);
        const r0 = rings[0], r1 = rings[rings.length - 1];
        for (let j = 0; j < seg; j++) { this.tri(s, r0[j], r0[j + 1]); this.tri(e, r1[j + 1], r1[j]); }
      } else if (opt.caps) {
        const s = this.v(pts[0], v3.mul(T[0], -1)), e = this.v(pts[n - 1], T[n - 1]);
        const base = this.P.length / 3;
        const r0 = rings[0], r1 = rings[rings.length - 1];
        for (let j = 0; j < seg; j++) { this.tri(s, r0[j + 1], r0[j]); this.tri(e, r1[j], r1[j + 1]); }
        void base;
      }
    }
    cyl(a, b, r0, r1, seg = 10, caps = true, up) { this.tube([a, b], [r0, r1], seg, { caps, up }); }
    // ellipsoid with orthogonal axis vectors (lengths = radii)
    ell(c, ax, ay, az, seg = 12, rings = 8) {
      const la = v3.len(ax), lb = v3.len(ay), lc = v3.len(az), ua = v3.mul(ax, 1 / la), ub = v3.mul(ay, 1 / lb), uc = v3.mul(az, 1 / lc);
      const idx = [];
      for (let i = 0; i <= rings; i++) {
        const ph = i / rings * Math.PI, row = [];
        for (let j = 0; j <= seg; j++) {
          const th = j / seg * Math.PI * 2, sx = Math.sin(ph) * Math.cos(th), sy = Math.cos(ph), sz = Math.sin(ph) * Math.sin(th);
          const p = v3.add(c, v3.add(v3.add(v3.mul(ax, sx), v3.mul(ay, sy)), v3.mul(az, sz)));
          const n = v3.norm(v3.add(v3.add(v3.mul(ua, sx / la), v3.mul(ub, sy / lb)), v3.mul(uc, sz / lc)));
          row.push(this.v(p, n, [j / seg, i / rings]));
        }
        idx.push(row);
      }
      for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) this.quad(idx[i][j], idx[i][j + 1], idx[i + 1][j + 1], idx[i + 1][j]);
    }
    sphere(c, r, seg, rings) { this.ell(c, [r, 0, 0], [0, r, 0], [0, 0, r], seg, rings); }
    // box: center, half-extent axis vectors; uv scale for wood grain along ax
    box(c, ax, ay, az, uvOff = 0) {
      const F = [[ax, ay, az], [v3.mul(ax, -1), ay, v3.mul(az, -1)], [az, ay, v3.mul(ax, -1)], [v3.mul(az, -1), ay, ax], [ax, v3.mul(az, -1), ay], [ax, az, v3.mul(ay, -1)]];
      const la = v3.len(ax);
      for (const [u, w, nrm] of F) {
        const n = v3.norm(nrm), o = v3.add(c, nrm);
        const q = [v3.sub(v3.sub(o, u), w), v3.sub(v3.add(o, u), w), v3.add(v3.add(o, u), w), v3.add(v3.sub(o, u), w)];
        const vi = q.map((p, k) => this.v(p, n, [uvOff + (k === 1 || k === 2 ? 1 : 0) * la, uvOff * 3 + (k >= 2 ? 0.05 : 0)]));
        this.quad(vi[0], vi[1], vi[2], vi[3]);
      }
    }
    torus(c, axis, R, r, seg = 16, tseg = 6, arc = Math.PI * 2, a0 = 0, ref) {
      const k = v3.norm(axis), e1 = ref ? v3.norm(v3.sub(ref, v3.mul(k, v3.dot(ref, k)))) : v3.perp(k), e2 = v3.cross(k, e1);
      const rows = [];
      for (let i = 0; i <= seg; i++) {
        const a = a0 + i / seg * arc, d = v3.add(v3.mul(e1, Math.cos(a)), v3.mul(e2, Math.sin(a))), row = [];
        for (let j = 0; j <= tseg; j++) {
          const b = j / tseg * Math.PI * 2, n = v3.add(v3.mul(d, Math.cos(b)), v3.mul(k, Math.sin(b)));
          row.push(this.v(v3.add(c, v3.add(v3.mul(d, R), v3.mul(n, r))), n));
        }
        rows.push(row);
      }
      for (let i = 0; i < seg; i++) for (let j = 0; j < tseg; j++) this.quad(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
    }
    append(o) {
      const base = this.P.length / 3;
      this.P.push(...o.P); this.N.push(...o.N); this.C.push(...o.C); this.U.push(...o.U); this.M.push(...o.M);
      for (const i of o.I) this.I.push(i + base);
    }
    normals() { // recompute smooth normals from indices
      const N = new Array(this.P.length).fill(0), P = this.P;
      for (let i = 0; i < this.I.length; i += 3) {
        const a = this.I[i] * 3, b = this.I[i + 1] * 3, c = this.I[i + 2] * 3;
        const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        const n = v3.cross(e1, e2);
        for (const k of [a, b, c]) { N[k] += n[0]; N[k + 1] += n[1]; N[k + 2] += n[2]; }
      }
      for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
      this.N = N; return this;
    }
    build() {
      return { pos: new Float32Array(this.P), nor: new Float32Array(this.N), col: new Float32Array(this.C), uv: new Float32Array(this.U), mat: new Float32Array(this.M), idx: new Uint32Array(this.I) };
    }
  }
  G.MB = MB;

  // icosphere (indexed) for rocks / blobs
  G.icosphere = (sub = 2) => {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v3.norm);
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) {
      const cache = {}, NF = [];
      const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] !== undefined) return cache[k]; V.push(v3.norm(v3.mul(v3.add(V[a], V[b]), 0.5))); return cache[k] = V.length - 1; };
      for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = NF;
    }
    return { V, F };
  };
})(window.G);
