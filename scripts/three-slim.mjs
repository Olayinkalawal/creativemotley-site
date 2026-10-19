/* Vite build plugin: three.js without the parts this site can never reach (build only; dev serves three as is).
   three@0.186.1 is pinned; every patch checks the exact source it expects and is skipped, with a warning, if the
   text is not there (a three upgrade then just builds bigger, never broken).

   1. GLSL: the WebGL renderer ships every built-in material's shader source as plain strings. Comments, indentation,
      blank lines and spaces next to punctuation go. Preprocessor lines keep their own spacing and line (a function-like
      #define must stay one; #include and #pragma unroll_loop are matched per line by three), so only whitespace that
      GLSL ignores is removed.
   2. The animation system (KeyframeTrack and its six typed tracks, PropertyBinding): their prototype defaults are
      assigned after each class (`KeyframeTrack.prototype.ValueTypeName = ''`), and the bundler keeps a class whose
      properties are written at the top level even when nothing uses it. Each class and its assignments are wrapped in
      a pure IIFE, so they (and the interpolants only they use) drop out unless something imports them.
   3. WebXR: the renderer always constructs a WebXRManager (and with it the controllers and depth sensing). This site
      never enters an XR session, so the renderer gets an inert stand-in with the same surface it calls. Set
      CM_THREE_XR=1 to keep the real one. */

const GLSL = /\b(gl_FragColor|gl_Position|#include|#ifdef|#ifndef|#endif|uniform|varying|void main|vec[234]|float)\b/;

export function minifyGlsl(text) {
  const lines = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .split('\n')
    .map((l) => l.trim().replace(/[ \t]+/g, ' '))
    .filter(Boolean);
  let out = '';
  let prevPre = true;
  for (const l of lines) {
    const pre = l.startsWith('#');
    const body = pre ? l : l.replace(/ ?([(){}[\];,=]) ?/g, '$1');
    if (!out) out = body;
    else if (pre || prevPre) out += '\n' + body;               // a directive owns its line, and so does what follows one
    else out += (/[;{}]$/.test(out) || /^[{}]/.test(body) ? '' : ' ') + body;
    prevPre = pre;
  }
  return out;
}

function glsl(code) {
  let n = 0;
  const out = code.replace(/"((?:[^"\\\n]|\\.)*)"/g, (m, body) => {
    if (body.length < 40 || !body.includes('\\n') || !GLSL.test(body)) return m;
    let text;
    try { text = JSON.parse(m); } catch { return m; }
    n++;
    return JSON.stringify(minifyGlsl(text));
  });
  return { out, n };
}

/* the end of the statement that starts at i (bracket depth back to 0 at a line ending in ';') */
function statementEnd(src, i) {
  let depth = 0, q = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k) - 1; if (k < 0) return -1; }
    else if (c === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k) + 1; if (k <= 0) return -1; }
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ';' && depth === 0) return k + 1;
  }
  return -1;
}

/* class NAME { ... } plus the NAME.x = … statements that follow it (past comments and hoisted function declarations)
   → const NAME = /*@__PURE__*\/ (() => { class NAME { … } NAME.x = …; return NAME; })(); */
function pureClass(src, name) {
  const start = src.search(new RegExp(`\\nclass ${name}\\b[^\\n]*\\{\\n`));
  if (start < 0) return null;
  const close = src.indexOf('\n}\n', start + 1);
  if (close < 0) return null;
  const classEnd = close + 3;
  const stmts = [];
  let k = classEnd;
  for (;;) {
    while (/\s/.test(src[k])) k++;
    if (src.startsWith('/*', k)) { k = src.indexOf('*/', k) + 2; continue; }
    if (src.startsWith('//', k)) { k = src.indexOf('\n', k); continue; }
    if (/^function [\w$]+\s*\(/.test(src.slice(k, k + 80))) {        // a helper declaration (hoisted): step over it
      const e = src.indexOf('\n}\n', k); if (e < 0) return null; k = e + 3; continue;
    }
    if (src.startsWith(`${name}.`, k)) { const e = statementEnd(src, k); if (e < 0) return null; stmts.push([k, e]); k = e; continue; }
    break;
  }
  if (!stmts.length) return null;
  let rest = src.slice(classEnd);
  for (const [a, b] of [...stmts].reverse()) rest = rest.slice(0, a - classEnd) + rest.slice(b - classEnd);
  const body = src.slice(start + 1, classEnd) + stmts.map(([a, b]) => src.slice(a, b)).join('\n');
  return src.slice(0, start + 1) + `const ${name} = /*@__PURE__*/ (() => {\n${body}\nreturn ${name};\n})();\n` + rest;
}
const PURE = ['KeyframeTrack', 'BooleanKeyframeTrack', 'ColorKeyframeTrack', 'NumberKeyframeTrack', 'QuaternionKeyframeTrack', 'StringKeyframeTrack', 'VectorKeyframeTrack', 'PropertyBinding'];

/* the scene-graph serialisers (Object3D, Material, …: toJSON, the format ObjectLoader reads back). Methods cannot be
   tree-shaken, and only toJSON itself calls toJSON, so the big ones throw instead. */
const TOJSON = ['Object3D', 'Material', 'ShaderMaterial', 'BufferGeometry', 'Texture', 'TextureSource'];
function dropToJSON(src, name) {
  const start = src.search(new RegExp(`\\nclass ${name}\\b[^\\n]*\\{\\n`));
  if (start < 0) return null;
  const close = src.indexOf('\n}\n', start + 1);
  const a = src.indexOf('\n\ttoJSON(', start);
  if (a < 0 || a > close) return null;
  const b = src.indexOf('\n\t}\n', a);
  if (b < 0 || b > close) return null;
  return src.slice(0, a) + `\n\ttoJSON() { throw new Error( 'three-slim: ${name}.toJSON is not built into this site' ); }\n` + src.slice(b + 4);
}

const XR_NEW = 'const xr = new WebXRManager( _this, _gl );';
const XR_STUB = `const xr = { enabled: false, isPresenting: false, cameraAutoUpdate: true,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, dispose() {}, setAnimationLoop() {},
  updateCamera() {}, getCamera() { return null; }, getSession() { return null; }, getDepthSensingMesh() { return null; },
  hasDepthSensing() { return false; }, getEnvironmentBlendMode() { return undefined; }, setSession() { return Promise.reject(new Error('WebXR is not built into this site')); } };`;

export default function threeSlim({ xr = process.env.CM_THREE_XR !== '1' } = {}) {
  return {
    name: 'cm-three-slim',
    apply: 'build',
    transform(code, id) {
      const m = /node_modules[\\/]three[\\/]build[\\/]three\.(module|core)\.js$/.exec(id);
      if (!m) return null;
      const notes = [];
      let src = code;
      const g = glsl(src); src = g.out; if (g.n) notes.push(`${g.n} shader strings minified`);
      if (m[1] === 'core') {
        let n = 0;
        for (const name of PURE) { const t = pureClass(src, name); if (t) { src = t; n++; } else this.warn(`three-slim: ${name} not found as expected; left as is`); }
        if (n) notes.push(`${n} animation classes made droppable`);
        let j = 0;
        for (const name of TOJSON) { const t = dropToJSON(src, name); if (t) { src = t; j++; } else this.warn(`three-slim: ${name}.toJSON not found as expected; left as is`); }
        if (j) notes.push(`${j} toJSON serialisers dropped`);
      }
      if (m[1] === 'module' && xr) {
        if (src.includes(XR_NEW)) { src = src.replace(XR_NEW, XR_STUB); notes.push('WebXR stand-in'); }
        else this.warn('three-slim: WebXRManager construction not found; WebXR left in');
      }
      if (notes.length) this.info?.(`three-slim (${m[1]}): ${notes.join(', ')}`);
      return src === code ? null : { code: src, map: null };
    },
  };
}
