/* IX · Directors on WebKit (src/sections/directors.js): the packed film (public/assets/video/directors-pack*.mp4,
   scripts/encode-directors.sh: H.264, the colour in the top half, the alpha as grey in the bottom half), drawn into a
   canvas that takes the film's box and classes by a tiny WebGL program (colour from the top half, alpha from the
   bottom, premultiplied out). This is a lazy chunk: directors.js loads it with the poster, on the packed path only.
   The video still plays (directors.js drives it as before: once, in view and faded in, the Pause button), muted and
   inline, kept in the layout under the canvas at opacity 0, so iOS keeps decoding it; the canvas is redrawn on each
   new video frame (requestVideoFrameCallback; else every animation frame while it plays) and on loadeddata / seeked.
   Its pixels are the box x DPR, never more than the video's own width (the 1280 or 1920 encode, chosen as the WebM).
   The poster is the canvas's CSS background until the first frame is drawn. No WebGL, a lost context or a video
   error: the poster stands in the film's place, and the film stops and is let go (stop: directors.js). */
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*vec2(.5,-.25)+vec2(.5,.25);gl_Position=vec4(p,0.,1.);}';
// h: half a texel, so neither half ever samples the other
const FS = 'precision highp float;uniform sampler2D t;uniform float h;varying vec2 v;void main(){vec2 c=vec2(v.x,clamp(v.y,h,.5-h));float a=texture2D(t,c+vec2(0.,.5)).g;gl_FragColor=vec4(texture2D(t,c).rgb*a,a);}';

export function pack(video, poster, stop) {
  const cv = document.createElement('canvas');
  cv.className = 'dr-video';
  cv.setAttribute('aria-hidden', 'true');
  const bg = (on) => { cv.style.background = on ? `center / 100% 100% no-repeat url("${poster}")` : 'none'; };
  const show = () => cv.classList.add('is-ready');
  bg(1);
  video.after(cv);   // over the video (the same grid cell: .dr-pack, directors.css)
  const img = new Image();
  img.onload = show; img.src = poster;
  let gl = null, dead = false, drawn = false, cw = 0, hU;
  const fail = () => {
    if (dead) return;
    dead = true;
    if (gl && !gl.isContextLost()) gl.clear(gl.COLOR_BUFFER_BIT);
    bg(1); stop();
    for (const s of video.querySelectorAll('source')) s.remove();
    video.removeAttribute('src'); video.load();   // nothing more is fetched
  };
  try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }); } catch {}
  if (!gl) return fail();
  const pr = gl.createProgram();
  for (const [k, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const s = gl.createShader(k); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(pr, s);
  }
  gl.bindAttribLocation(pr, 0, 'p');
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return fail();
  gl.useProgram(pr);
  hU = gl.getUniformLocation(pr, 'h');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle over the box
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);

  const draw = () => {
    if (dead || video.readyState < 2 || !video.videoHeight) return;
    const w = Math.max(1, Math.min(video.videoWidth, Math.round(cw * (window.devicePixelRatio || 1)) || video.videoWidth));
    if (cv.width !== w) { cv.width = w; cv.height = Math.round(w * 9 / 16); gl.viewport(0, 0, cv.width, cv.height); }
    gl.uniform1f(hU, 0.5 / video.videoHeight);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!drawn) { drawn = true; bg(0); show(); }
  };
  new ResizeObserver((es) => { cw = es[0].contentRect.width; draw(); }).observe(cv);
  if (video.requestVideoFrameCallback) {
    const f = () => { draw(); video.requestVideoFrameCallback(f); };
    video.requestVideoFrameCallback(f);
  } else {
    const tick = () => { draw(); if (!video.paused && !dead) requestAnimationFrame(tick); };
    video.addEventListener('play', tick);
    if (!video.paused) tick();   // already playing when this chunk arrived
  }
  for (const e of ['loadeddata', 'seeked']) video.addEventListener(e, draw);
  // capture: a <source>'s error does not bubble; one that fails with another <source> after it falls through to that one
  video.addEventListener('error', (e) => { if (e.target.nextElementSibling?.matches('source')) return; fail(); }, true);
  cv.addEventListener('webglcontextlost', fail);
  // every <source> may already have failed before this chunk arrived (directors.js calls load() as it asks for it)
  if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) return fail();
  draw();
}
