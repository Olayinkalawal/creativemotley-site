# Build contract

Every builder reads this, `docs/concept.md` (what each chapter is) and `docs/reference-study.md` (the Editions patterns) before writing code. The shell is done and committed: chrome, rail, hero, chapter I, the stage and the skeleton partials. Use it as the house style; `src/partials/storytellers.html` and `src/sections/storytellers.*` are the worked example.

## Stack and commands
- Vite 8 + plain ES modules (no framework), `three@0.186.1`, `lenis@1.3.27` (driven from our own rAF in `core/scroll.js`). **GSAP and ScrollTrigger are uninstalled (v3)**: scroll-driven values are pure functions of `onFrame`'s `view`, and timed tweens are CSS transitions or the keyframe player (`gl/timeline.js`). No new dependencies without a reason written in your report.
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
- Every visible word comes from `docs/facts.json`, verbatim. Drafted copy awaiting the client (`docs/copy-drafts.md`) is in facts.json with `kind: "draft"`: it traces, but the fact check lists each draft on the page as a warning (`⚠ draft F…`), and `--strict` fails on them. **v3 phase 2:** every element whose text is a draft carries `data-draft="DCxx"` (a wrapper around a block of drafts may list several ids, `data-draft="DC32 DC33 …"`); `?drafts=0` hides them all (`html.no-drafts`), and `node scripts/factcheck.mjs --drafts 0` fails if any draft still shows. Splitting a fact into parts is fine, e.g. "Creators" + "audience, no system" from F22. Use the F-ids `docs/concept.md` gives your chapter.
- No new claims, numbers, names, testimonials or invented UI notes.
- Interface labels with no fact ("Close", "Next", "Previous", "Play", "Pause", "Menu", "Chapters", "Skip to content") must be listed in your report. There are no "Chapter N" kickers in v3: the rail numbers the chapters. The director adds them to `docs/ui-strings.json`.
- Alt text: use the facts' descriptions where they exist (F51, F53, F64–F70). Otherwise describe the painted art plainly ("Painted portrait of …"); names only from facts.
- `scripts/factcheck.mjs` (director) walks every text node and fails on anything that is not a fact substring or a listed UI string.

## Design system (use these; don't restyle the shell's classes)
- **Tokens** live in `src/styles/tokens.css`: `--ink --ink-soft --umber --bronze --ochre --gold --cream --cream-mute --hair --accent --accent-ink --paper --paper-2 --paper-ink --paper-mute`, `--sans` (Archivo), `--serif` (Instrument Serif), `--script` (Imperial Script, drop caps only), `--rail-w --col-pad --nav-h`, `--ease-out --ease-io`.
- **Type scale (v3, the only sizes on the page):** ten roles, each a `--f-<role>` font shorthand plus `--ls-<role>` tracking (and `--t-<role>` size, `--lh-<role>` line height): `title` (Archivo 700, 190 / 71 px), `numeral` (= title), `display` (serif 121 / 56), `dek` (serif 44 / 28, lh 0.96, −0.04em), `cap` (Imperial Script, 2.6 × dek), `head` (Archivo 700, 28), `lead` (serif 28 / 24), `label` (Archivo 600, 18), `body` (Archivo 500, 16), `small` (Archivo 600, 12; caps take `--ls-caps`). Write `font: var(--f-label); letter-spacing: var(--ls-label);` and nothing else. The v2 tokens `--t-giant` and `.kicker` are gone.
- **Classes** (in `base.css`):
  - Type roles: `.giant` (chapter titles: the title role), `.numeral`, `.display`, `.dek` (serif deck over scenes), `.head` (serif head on paper, the dek's size), `.t-head` (sans head), `.lead` (serif body), `.label`, `.body`, `.small`, `.mute`.
  - `.dc` is the drop cap (Imperial Script, self-hosted A–Z subset): wrap the first letter, `<span class="dc">B</span>uilt …`.
  - `.boxlink` is the "Read help doc ↗" pattern: `<a class="boxlink" href="…">Join the network <span class="ar">↗</span></a>`. Mind F43, F46 and F49: the ↗ is part of the fact.
  - `.pill` / `.pill--solid`.
- **Layout:**
  - `.col` is the Editions right 4/5 column on desktop and full width on mobile.
  - `.opener` is a transparent ≥140svh region; the stage shows through it.
  - `.scrim` puts a soft dark halo behind opener text.
  - `.opener--light`: an opener over a light painting (its manifest's `titleInk` is `"dark"`): ink type and a pale halo. Wrap it in a **full-width** `<div data-theme="light">` (the rail reads themes across the page width, and `.col` does not reach under the rail). X Apply is the example.
  - `.paper` is an opaque reading panel with a torn top edge. **Always** give it `data-theme="light" data-opaque`. `data-opaque` lets the stage stop rendering while paper covers the screen.
  - The paper's grain is baked into `.paper`'s own background (v3 phase 2: a separate multiply-blended layer cost ~8 ms a scrolled frame with WebGL off). `.paper-grain` is kept in markup but no longer drawn; don't add blend layers over paper.
- **Reveal:** `data-reveal` (optionally `data-reveal="0.1"` for a delay) rises an element in once. Don't animate giant type per letter; move it as a block.
- **Accent pink:** at most once per chapter.
- **Theme:** any region with `data-theme="dark|light"` flips the nav and each rail item under it. Mark nested cards too, e.g. a dark card on paper gets `data-theme="dark"`.

## Core APIs (import from `src/core/*`, `src/ui/modal.js`)
- `onFrame((view) => …)`: per frame. `view = { y, vw, vh, velocity, time, dt }`. Returns an unsubscribe.
  - Read cached geometry with `geo(el)` → `{ top, height, bottom }` (document space). It is re-measured on resize, font load and body resize.
  - **Never call getBoundingClientRect in onFrame for scrolling elements.** Exception: fixed elements, once per resize.
- `onResize(fn)`, `onLayout(fn)`, and the helpers `clamp`, `lerp`, `smooth`, `seg(v, a, b)`.
- `scrollTo(target)`, `lockScroll(bool)`, `lenis`, `input.trackpad` from `core/scroll.js` (no `gsap` / `ScrollTrigger` any more).
- `REDUCED`, `TIER` (0 = no WebGL, 1 = light, 2 = full), `FINE` (fine pointer), `isDesktop()` from `core/env.js`, plus (v3) `STILL` (the phone still path: touch screens under 900 px on their short side and windows under 640 px; `?still=1|0`) and `QUALITY` (the stage's starting level `min | low | medium | high`; `?q=`).
- Chapter intent: hovering or focusing a chapter in the rail or dropdown dispatches `cm:chapter-intent` on `document` (`detail` = chapter id); the stage preloads that chapter's scene.
- `openModal(node, { onClose })` / `closeModal()` from `ui/modal.js`: one shared, accessible dialog (focus trap, Esc, scrim). Put a heading with `id="modal-title"` in your node.

## The stage (WebGL): how to add a scene
- One fixed canvas renders the scene named by the `data-scene` of the section under the reading line. It dissolves across boundaries between different scenes.
- **Lifecycle (v3):** each scene module is its own chunk, imported the first time one of its ids enters the mount window (the active run ±1, plus a hovered or announced chapter). Scenes outside the window are disposed after ~2.5 s; programs compile at idle (`compileAsync` where parallel) and textures upload at idle, before the first draw. The loop draws only while something changes and stops ~300 ms after the last change. Pixel budget: longest side 1280 / 1920 / 2880 px, DPR ≤ 2 (phones 2560, DPR ≤ 3); a frame-rate governor steps down below 45 fps, and "low" caps at 30 fps.
- Your section needs `data-scene="<id>"` and `data-plate="<id>"`; the plate is the still shown when WebGL is off (and the first paint). CSS plates exist in `index.html` for `hero`, `storytellers`, `creators`, `brands`, `results`, `directors`, `apply`, `paper`, `ink` and `umber`; a plate other than the hero is marked `data-bg` (+ `data-bg-phone` for portrait screens) and loads when first shown.
- **Painted chapters:** `plate:<chapter>` exists for every painting in `public/assets/scenes/<chapter>/manifest.json` (the art track's encodes, `scripts/art.py`): AVIF where it decodes, else WebP, at the smallest width that covers the canvas, plus the depth map listed in `gl/scenes/plates.js` (`public/assets/scenes/<chapter>/depth.webp`, made with `scripts/depth.py`). In use: `plate:creators`, `plate:brands`, `plate:results`, `plate:directors`, `plate:apply`; `plate:umber` is the shader-only room. Phones draw each chapter's portrait recomposition from the same manifest (`gl/scenes/stills.js`).
- **Camera keys** live in `src/gl/keys/*.json` (one sheet per chapter, played by `gl/timeline.js`: per-channel keyframes in viewports of the section's pass, cubic-bezier eases). A plate chapter without a sheet falls back to `data-cam-from` / `data-cam-to` on the section.
- **New scene module:** add a line to the `KNOWN` list in `src/gl/boot.js` (which ids it answers), so the stage can import it on demand.
- A scene module calls `stage.add({ id, scene, camera, load, dispose?, update, render?, resize, activate?, deactivate?, ambient?, device?, post? })`. The full contract is in the header of `src/gl/stage.js`.
  - `dispose(ctx)` frees what `load()` made (textures, streams, videos); `load()` runs again on return.
  - `ambient(ctx)` returns true while the scene moves on its own (dust, a playing video): the loop keeps drawing at ≤ 30 fps.
  - `device: true` marks a teardown scene (the device stills show in its section on the still path).
  - Call `ctx.stage.invalidate()` when something lands between scrolls (a texture, a stream frame) so the loop draws it.
- `update(ctx, seg)` gets:
  - `ctx = { stage, time, dt, frame, vw, vh, w, h, dpr, pointer (eased, -1..1), velocity, tier, still, quality, reduced, scrollY, renderer }`
  - `seg = { el, p (pin progress), pe (pass progress), top, height }`
- **Teardowns (v3 phase 2):** Method (`td:camera`) and the Kit (`td:kit`, one run of four shots) follow `docs/teardown-v2.md` as amended at its top: the choreography is data on `[data-td-shot]` elements plus `src/gl/lib/tdcore.js` (`TD_PLAN`, phase helpers), frames from `public/assets/teardown/<dev>/v3/set.json`.
- Reusable pieces in `src/gl/lib/`:
  - `plate.js`: `plateMaterial()` (cover-fit painting + depth parallax / push / zoom) and `fullscreenQuad()`.
  - `frameStream.js`: `FrameStream` (frame-sequence → texture; keeps a ±24-frame window and frees the rest).
  - `video.js` / `codecStream.js`: scrubbed video (`<video>` seek, or WebCodecs on a hardware decoder) for the film.
  - `loaders.js`: `loadTexture(url)`, `videoTexture(sources)`, `bitmap(url)`, `avifOK()` (a promise: AVIF decodes here).
  - `sparks.js`: GPU sparks.
  - Film helpers `filmRanges(name)` and `frameAt(ranges, y, vh)` in `gl/lib/filmRanges.js`: mark scroll ranges in markup with `data-film="<name>" data-frames="a-b"`.
- **Texture rule:** every texture is uploaded with `flipY = false` and sampled with `v` flipped (`vec2(uv.x, 1.0 - uv.y)`). The loaders already set this up.
- **Colour:** pass-through display sRGB (`NoColorSpace` textures, `LinearSRGBColorSpace` output). If you light anything, keep it subtle and check the result against the paper and ink tokens.
- **Performance:**
  - Load in `load()`, not at import.
  - Textures sized to the pixel budget (≤ 2048 px at 1×, 2880 at 2×); AVIF/WebP, depth maps as WebP. Phones are on the still path and never fetch desktop assets.
  - Smoothness rules: no `filter` / `backdrop-filter` / blurred SVG animated per frame; transforms and opacity only; read rects once per resize (`geo()`), write styles only when they change; no canvas reallocation mid-scene.
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
