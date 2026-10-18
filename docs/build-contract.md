# Build contract

Every builder reads this, `docs/concept.md` (what each chapter is) and `docs/reference-study.md` (the Editions patterns) before writing code. The shell is done and committed: chrome, rail, hero, chapter I, the stage and the skeleton partials. Use it as the house style; `src/partials/storytellers.html` and `src/sections/storytellers.*` are the worked example.

## Stack and commands
- Vite 8 + plain ES modules (no framework), `three@0.186.1`, `gsap@3.15.0` (+ScrollTrigger), `lenis@1.3.27`. No new dependencies without a reason written in your report.
- Dev server: `npx vite --host 127.0.0.1 --port <your port>`. The shell's server is on 5173; builders use 5174, 5175 and so on. Production check: `npx vite build` must pass with no warnings from your files.
- Screenshots: `node scripts/shots.mjs --url http://127.0.0.1:<port>/ --out qa/shots/<you> --at "#creators,#creators+0.4" --wait 2200 --boot 6000 [--mode mobile] [--tier 0|1|2] [--reduced]`. Contact sheet: `python3 -I scripts/sheet.py qa/shots/<you> qa/shots/<you>_sheet 4 480 16`. Look at every shot at full size before you report.
  - WebGL here is software (SwiftShader): it is slow but correct. Allow `--wait 2000+`.
- Page probe: `node scripts/probe.mjs "<js expr>" [mobile]` evaluates in the page at 5173. Copy it and change the port if you need yours.

## Files and ownership (one owner per file, so builders never collide)
| owner | files |
|---|---|
| shell (director) | `index.html`, `src/main.js`, `src/core/*`, `src/ui/*`, `src/gl/stage.js`, `src/gl/boot.js`, `src/gl/lib/*`, `src/gl/scenes/film.js`, `src/gl/scenes/plates.js`, `src/styles/*`, hero + storytellers partial/section |
| A | `src/partials/creators.html`, `src/partials/brands.html`, `src/sections/creators.{js,css}`, `src/sections/brands.{js,css}`, `src/sections/_paper.{js,css}` (shared paper components: feature block, notes fan, command cloud, photo card, dense grid; B, D and E import them read-only) |
| B | `src/partials/{method,results,directors}.html`, `src/sections/{method,results,directors}.{js,css}`, `src/gl/scenes/method.js`, `src/gl/scenes/umber.js` |
| C | `src/partials/showcase.html`, `src/sections/showcase.{js,css}`, `src/gl/scenes/posters.js` |
| D | `src/partials/process.html`, `src/sections/process.{js,css}`, `src/gl/scenes/objects.js` |
| E | `src/partials/apply.html`, `src/sections/apply.{js,css}` |

- Need a change in a shell file? **Don't edit it.** Write the exact change in your report and the director merges it.
- Sections auto-load (`import.meta.glob('./sections/*.js')`) and so do scenes (`./gl/scenes/*.js`). A section file exports `init()` and imports its own CSS. A scene file default-exports `register(stage)`.
- Files starting with `_` in `src/sections/` are helpers. They are still auto-imported, so give them a harmless `export function init() {}` or no `init`.

## Copy: the hard rule
- Every visible word comes from `docs/facts.json`, verbatim. Splitting a fact into parts is fine, e.g. "Creators" + "audience, no system" from F22. Use the F-ids `docs/concept.md` gives your chapter.
- No new claims, numbers, names, testimonials or invented UI notes.
- Interface labels with no fact ("Close", "Next", "Previous", "Play", "Pause", "Menu", "Chapters", "Skip to content", "Chapter II", "Chapter III", "Chapter IX") must be listed in your report. The director adds them to `docs/ui-strings.json`.
- Alt text: use the facts' descriptions where they exist (F51, F53, F64–F70). Otherwise describe the painted art plainly ("Painted portrait of …"); names only from facts.
- `scripts/factcheck.mjs` (director) walks every text node and fails on anything that is not a fact substring or a listed UI string.

## Design system (use these; don't restyle the shell's classes)
- **Tokens** live in `src/styles/tokens.css`: `--ink --ink-soft --umber --bronze --ochre --gold --cream --accent --accent-ink --paper --paper-2 --paper-ink --paper-mute`, `--sans` (Archivo) and `--serif` (Instrument Serif), plus the type scale `--t-giant --t-display --t-dek --t-head --t-lead --t-body --t-small --t-label`, `--rail-w --col-pad --nav-h`, `--ease-out --ease-io`.
- **Classes** (in `base.css`):
  - Type: `.kicker` (Chapter labels), `.giant` (chapter titles), `.display`, `.dek` (serif deck over scenes), `.head` (serif editorial head on paper), `.lead` (serif body), `.label` (small bold sans), `.body`, `.mute`.
  - `.dc` is the drop cap: wrap the first letter, `<span class="dc">B</span>uilt …`.
  - `.boxlink` is the "Read help doc ↗" pattern: `<a class="boxlink" href="…">Join the network <span class="ar">↗</span></a>`. Mind F43, F46 and F49: the ↗ is part of the fact.
  - `.pill` / `.pill--solid`.
- **Layout:**
  - `.col` is the Editions right 4/5 column on desktop and full width on mobile.
  - `.opener` is a transparent ≥140svh region; the stage shows through it.
  - `.scrim` puts a soft dark halo behind opener text.
  - `.paper` is an opaque reading panel with a torn top edge. **Always** give it `data-theme="light" data-opaque`. `data-opaque` lets the stage stop rendering while paper covers the screen.
  - `.paper-grain` is a texture layer.
- **Reveal:** `data-reveal` (optionally `data-reveal="0.1"` for a delay) rises an element in once. Don't animate giant type per letter; move it as a block.
- **Accent pink:** at most once per chapter.
- **Theme:** any region with `data-theme="dark|light"` flips the nav and each rail item under it. Mark nested cards too, e.g. a dark card on paper gets `data-theme="dark"`.

## Core APIs (import from `src/core/*`, `src/ui/modal.js`)
- `onFrame((view) => …)`: per frame. `view = { y, vw, vh, velocity, time, dt }`. Returns an unsubscribe.
  - Read cached geometry with `geo(el)` → `{ top, height, bottom }` (document space). It is re-measured on resize, font load and body resize.
  - **Never call getBoundingClientRect in onFrame for scrolling elements.** Exception: fixed elements, once per resize.
- `onResize(fn)`, `onLayout(fn)`, and the helpers `clamp`, `lerp`, `smooth`, `seg(v, a, b)`.
- `scrollTo(target)`, `lockScroll(bool)`, plus `gsap` and `ScrollTrigger` re-exported from `core/scroll.js`.
- `REDUCED`, `TIER` (0 = no WebGL, 1 = light, 2 = full), `FINE` (fine pointer), `isDesktop()` from `core/env.js`.
- `openModal(node, { onClose })` / `closeModal()` from `ui/modal.js`: one shared, accessible dialog (focus trap, Esc, scrim). Put a heading with `id="modal-title"` in your node.

## The stage (WebGL): how to add a scene
- One fixed canvas renders the scene named by the `data-scene` of the section under the reading line. It dissolves across boundaries between different scenes.
- Your section needs `data-scene="<id>"` and `data-plate="<id>"`; the plate is the still shown when WebGL is off. Plates exist for `hero`, `storytellers`, `method`, `results`, `paper` and `umber`; ask the director for more.
- A scene module calls `stage.add({ id, scene, camera, load, update, render?, resize, activate?, deactivate?, post? })`. The full contract is in the header of `src/gl/stage.js`. `update(ctx, seg)` gets:
  - `ctx = { time, dt, vw, vh, w, h, dpr, pointer (eased, -1..1), velocity, tier, reduced, scrollY, renderer }`
  - `seg = { el, p (pin progress), pe (pass progress), top, height }`
- Reusable pieces in `src/gl/lib/`:
  - `plate.js`: `plateMaterial()` (cover-fit painting + depth parallax / push / zoom) and `fullscreenQuad()`.
  - `frameStream.js`: `FrameStream` (windowed frame-sequence → texture).
  - `loaders.js`: `loadTexture(url)`, `videoTexture(sources)`, `bitmap(url)`.
  - `sparks.js`: GPU sparks.
  - Film helpers `filmRanges(name)` and `frameAt(ranges, y, vh)` in `gl/scenes/film.js`: mark scroll ranges in markup with `data-film="<name>" data-frames="a-b"`.
- **Texture rule:** every texture is uploaded with `flipY = false` and sampled with `v` flipped (`vec2(uv.x, 1.0 - uv.y)`). The loaders already set this up.
- **Colour:** pass-through display sRGB (`NoColorSpace` textures, `LinearSRGBColorSpace` output). If you light anything, keep it subtle and check the result against the paper and ink tokens.
- **Performance:**
  - Load in `load()`, not at import.
  - Textures ≤ 2048 px. Phones (`ctx.vw < 900`) get smaller sources.
  - Geometry modest. No per-frame allocations. Pause videos in `deactivate()`.
  - Pick the phone frame tier from the viewport.
- **Fallbacks:** `TIER === 0` or `REDUCED` means the stage never boots. Your chapter must still read well with its CSS plate and DOM content: posters and objects as plain images, counters showing their final values.

## Quality bar for your chapter
1. **Desktop 1440×900 and mobile 390×844:** no overflow (`document.documentElement.scrollWidth === innerWidth`), no overlaps, no clipped type, safe margins.
2. **Text contrast** ≥ 4.5:1 for body and ≥ 3:1 for ≥24 px type. Scene text keeps its `.scrim`.
3. **Motion:** one hero moment per chapter, scrubbed by scroll. Paper is calm.
   - Nothing jumps when it loads.
   - Scrolling back up is exact. Scroll-driven values are pure functions of scroll position, not one-shot tweens.
4. **Reduced motion and `?tier=0`:** content complete, nothing stuck invisible.
5. **Keyboard:** everything clickable is a `<button>` or `<a>` and reachable, with a visible focus ring. Modals close on Esc.
6. **Console:** zero errors and warnings from your files.
7. **Copy:** facts only (see above).
8. **Your report:**
   - files changed
   - shell changes you need, as exact diffs
   - new UI strings
   - what you checked: desktop, mobile, tier 0 and reduced motion, with screenshot paths
   - anything you're unsure of
