/* The first frame paints before any page code runs.
   - index.html marks html.cv (when there is no #fragment to land on): base.css then skips style and layout for every
     chapter after the hero (content-visibility), so that first frame (the hero, the LCP) costs the hero's layout only.
   - The entry (main.js) does its init work, chapters, chrome, sections, measuring, in afterFirstPaint(): it lifts
     html.cv and runs once that frame has been produced, so neither the full layout nor the init code can land in
     front of the first paint. A hidden tab paints nothing, so it runs at once there. */
export function afterFirstPaint(fn) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    document.documentElement.classList.remove('cv');
    fn();
  };
  if (document.visibilityState === 'hidden') { go(); return; }
  requestAnimationFrame(() => setTimeout(go, 0));   // rAF runs ahead of the frame's style, layout and paint; the task after it, after them
  setTimeout(go, 1500);                             // a frame that never comes (a throttled or headless renderer)
}
