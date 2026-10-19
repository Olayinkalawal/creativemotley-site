# Teardowns v2: the orbit, the hand-off, the explode (Editions Retail choreography)

The client's notes, verbatim in spirit:
1. "The camera needs to be big and fill the screen and REPLACE the painted Method opener."
2. "Create another section for the other electronic parts" (console, microphone, headphones, phone).
3. "The camera — or the viewport we're seeing — needs to ROTATE AROUND IT, just like the reference, with good motion graphics."
4. "Look at the Shopify website as the major reference." Premium, ultra-photoreal.

## v3 phase 2: what this document no longer describes (read this first)
The choreography below (orbit → hand-off → explode → settle) still holds for **Method**. The **Kit** and the plumbing changed in phase 2 (track S):
- **Kit is one run, not four.** `section#kit.td.td--seq[data-scene="td:kit"]`, one pin (`--td-run: 520svh`, phones `--td-run-m: 442svh`). Shot 0 (the console) is the run's only orbit, with the chapter title over it; it glides into the column and comes apart. Each later shot (microphone, headphones, phone) is a **cut**: a wipe in that device's colour key with an ink-bled edge while the heading crossfades, then the device, whole in the column, comes apart.
- **Shots are data.** Each `.td__copy[data-td-shot]` carries `data-td-dev` (device), `data-td-key` ("centre edge" colour key), the framings `data-td-hero` / `data-td-frame0` / `data-td-frame` (+ `-tall`), `data-td-box` / `data-td-pbox`, and `data-td-xmap` (explode re-timing). Stills and DOM keys for shot k carry `data-td-still="k"`. The plans (`TD_PLAN.single` for Method, `TD_PLAN.seq` for the Kit) and every phase helper live in `src/gl/lib/tdcore.js`, shared by `gl/scenes/teardowns.js` and `sections/_teardown.js`; phase 3 only swaps the renderer.
- **Frames:** `public/assets/teardown/<dev>/v3/` (re-timed, subsampled AVIF with a baked alpha matte; `scripts/prep_v3sets.py`), indexed by `v3/set.json`. `data-td-orbit` and the old `TD_PHASE` export are gone; the old `orbit/` and `lg`/`sm` streams are fallback-only.
- **Method** lists nine camera parts (names are UI strings, lines are drafts DC41, DC43–47, DC50–52); the seven step names left Method (Process alone names them).
- **Kit copy (phase 2 integration):** labels are the device names; heads are drafts DC85 "On the desk", DC86 "At the mic", DC87 "In the ears" (F42 is already in Creators and F88/F89 in Process's Sound step, so the Kit does not repeat them), and the phone keeps F98's first sentence, "The work went out.", which Results answers with "The world watched."
- Run lengths are now Method 3.30 / 2.80 screens and Kit 5.20 / 4.42 screens (desktop / phone), not the 540 / 400 svh below.

## The reference moment (Shopify Editions Winter '26, chapter IV Retail)
Desktop captures: `/home/user/ref-editions/cap/desktop_nogl/s_041_18450.jpg` … `s_050_22500.jpg`. Phones: `/home/user/ref-editions/cap/mobile_nogl/s_044_18568.jpg` … `s_050_21100.jpg`.
- `s_043`/`s_044`: the device is **huge**. It takes up most of the viewport and runs off the bottom edge. A medium sans headline, a serif dek and a small boxed link sit top-left above it. The 3D camera **orbits** the device as you scroll: top-down, front, under, back.
- `s_047`→`s_048`: the stage goes black. The device turns, moves to the **right half** of the screen and comes apart (exploded hub). The left column holds the headline, dek, link and a spec list (icon + bold line, hairline rules). The device stays very large, bleeding off the top of the screen.
- Phones: copy first, with the device full width below it. Then the spec list, with the exploded device full width below that.

## What we have (all in `public/assets/teardown/<name>/`, names: camera, mixer, mic, headphones, phone)
- `orbit/{lg,sm}/f_0001.webp … f_0097.webp`: the **orbit**, 97 frames, 16:9, on pure black. lg is 1920 px wide, sm 1080. f_0001 is the far angle and f_0097 is the hero angle. The frames are already re-timed to a constant visual speed and reversed, so play them **forwards** with scroll.
- `lg|sm/f_0001.webp … f_0145.webp`: the **explode**, 145 frames. f_0001 is the hero angle (it matches orbit f_0097 within about 1/255 mean difference) and f_0145 is fully exploded.
- `hero.webp` (whole device at the hero angle, 1920) and `poster.webp` (fully exploded, 1920): the stills used with WebGL off.
- `depth.png`: depth of the exploded frame, used for the settle parallax.

What the orbits look like:
- **camera:** rear three-quarter, coming around to the front three-quarter.
- **mixer (console):** bird's-eye, craning down to a low front three-quarter.
- **mic:** windscreen toward us, swinging to the side three-quarter.
- **headphones:** looking down on the headband, then swooping over the top, close and dramatic, to the front three-quarter.
- **phone:** the back with its camera module, flipping over to the screen side.

## Page structure (new)
- **IV · Method** = the camera, one section, nothing painted. `section#method.chapter.td[data-chapter][data-scene="td:camera"]`. In its hero phase the chapter opener (kicker "Chapter IV", giant h2 "Method") sits over the camera filling the screen. The copy column then carries F62 "Everything we make passes through one instrument, and one way of working." and the seven steps as the spec list (the current `#instrument` copy). `#instrument` and `partials/teardown.html` merge into `partials/method.html`. The painted `plate:method` scene is no longer used by Method: drop the `.plates [data-plate=method]` still, and do not register anything for it.
- **VII · Kit** (NEW chapter, after Process, before Results) = `partials/kit.html`, `section#kit.chapter[data-chapter]` with four teardown runs in this order: console, microphone, headphones, phone. In the first run's hero phase the chapter opener (kicker "Chapter VII", giant h2 "Kit") sits over the console orbit. No dek: F85 and F86, the only "kit" lines, already sit in Process just above.
- The teardowns come **out of** Creators (`#td-mixer`), Process (`#td-mic`, `#td-headphones`) and Results (`#td-phone`). Those chapters are restored to their pre-teardown shape:
  - **Creators:** restore its Creators `.pf` feature block (see `git show 7b57f5f^:src/partials/creators.html`).
  - **Process:** the pinned object run goes straight into the dense sheet as before (`git show 07fe4c1^:src/partials/process.html`, plus later fixes). The sheet's bottom tears off onto the Kit's black.
  - **Results:** the opener dek becomes "The world watched." The four counters return (`git show f2f7f40^:src/partials/results.html` and results.js), and `data-scene`/cam keys go back on the section.
- **Numbering:** I Storytellers, II Creators, III Brands, IV Method, V Showcase, VI Process, **VII Kit**, VIII Results, IX Directors, X Apply. Update:
  - the hero index (`partials/hero.html`, the source of the rail, dropdown and menu);
  - the kickers (Results "Chapter VIII", Directors "Chapter IX", Apply "Chapter X");
  - the index facts F123–F131 in `docs/facts.json` (`ui-copy`, e.g. "Kit  VII", "Results  VIII", "Apply  X");
  - `docs/ui-strings.json` ("Kit", "Chapter X", and the new part and device labels below).

## Kit copy (every string traced: facts.json, or a UI label added to ui-strings.json)
Device labels and part names are descriptive labels of what the render shows. They are UI strings, not claims. Check each against the final exploded frame and rename a part if the render shows something else (e.g. "Display glass" vs "Front glass").

| run | label (`.td__label`) | head (`.td__head`) | dek | link | spec list: part callouts (icon + name) |
|---|---|---|---|---|---|
| console `#td-console` (scene `td:mixer`) | Console | Systems, not chaos. (F42) | — | — | Faceplate · Display · Pad matrix · Fader bank · Main board · Chassis |
| microphone `#td-mic` | Sound (F87) | Because bad audio loses the audience first. (F88) | — | — | Windscreen · Capsule grille · Diaphragm · Voice coil · Yoke mount · XLR connector |
| headphones `#td-headphones` | Headphones | Mixed and mastered for phone speakers, because that is where it is heard. (F89) | — | — | Outer cap · Ear cup · Driver · Baffle · Cushion · Headband |
| phone `#td-phone` | Published (F93) | The work went out. (F98, first sentence) | — | — | Display · Logic board · Battery · Charging coil · Camera module · Rear glass |

"The work went out." on the phone then hands over to Results: "The world watched." plus the counters.

## Choreography of one run (desktop ≥1024; numbers are pin progress p of `[data-td-run]`, tune by eye)
1. **Orbit / hero, p 0 → ~0.34.**
   - The device fills the screen. The slot is the whole viewport, and the frame is contain-fit with a hero zoom of about 1.15–1.45 per device (`data-td-hero="zoom sx sy"`, plus `data-td-hero-tall` for portrait), so the device spans roughly 75–95% of the width and may run off an edge as in `s_044`.
   - The orbit frames play 1 → 97 over this span, with a slow push-in (zoom +4%).
   - Hero copy sits top-left over a soft radial ink scrim:
     - first run of a chapter: the chapter opener, kicker plus giant h2, rising and fading with scroll like the other openers;
     - other runs: label plus head, in the Editions "Not your standard hub" scale.
2. **Hand-off, p ~0.26 → ~0.42** (overlapping the end of the orbit).
   - The slot glides and shrinks from the full viewport to its column-layout rect on the right, at the same rect as today's `.td__slot` or larger. It may bleed off the right and top like `s_048`, because the frame is not clipped to the slot.
   - The zoom eases from the hero zoom to `data-td-frame`.
   - The copy block takes its column position at the left, with the head written once (no duplicate text). The spec rows stagger in.
   - Crossfade the orbit's last frame into explode f_0001 over about 2% of p; they match.
3. **Explode, p ~0.42 → ~0.86.**
   - Frames run 1 → 145, eased.
   - Spec rows light in step (`--on`, `.is-hot` gold), as today.
4. **Settle, p ~0.86 → 1.** The depth parallax and slow push as today, then fade to black at the hand-off to the next scene.

**Phones (portrait).**
- Hero: the device runs full width, about 100–115% (`data-td-hero-tall`), placed in the middle third. The hero copy goes at the top (Editions mobile puts copy above the device) or at the bottom over a gradient; pick whichever reads best.
- Hand-off: the device moves into the top slot (today's `-tall` framing), and the copy column with its specs settles at the bottom. Compact two-column specs: titles only, as today.
- Keep the total run shorter on phones (`--td-run-m`).

Run lengths to start from:
- desktop: Method 540svh, Kit runs 400svh each;
- phones: Method 440svh, Kit runs 330svh each.

## Motion graphics (the "good motion graphics" ask: restrained, Editions/Apple-grade, all scroll-driven and reversible)
- **Construction lines in the hero phase.** Thin gold (#C9A55C-ish, 0.5–0.7 opacity) SVG hairlines draw around the device: a large circle and arc, the golden-rectangle verticals, a diagonal or two. These echo the hero's Da Vinci lines (`[data-lines]` in `ui/hero.js`; reuse its look). They draw with stroke-dashoffset as the orbit progresses and dissolve as the hand-off starts. Keep them `aria-hidden` and `pointer-events: none`, and don't let them cross the copy.
- **Degree ticker.** A small gold arc with tick marks (a compass or turntable scale) sits under or around the device in the hero phase. It rotates with the orbit. No text and no numbers.
- **Kinetic copy.**
  - Heads reveal line by line with a mask (translateY 100% → 0, inside an overflow-hidden line). They never animate per letter.
  - Spec rows stagger in during the hand-off.
  - Everything is tied to scroll, so scrolling back reverses it.
- **Part markers in the settle phase.**
  - Each spec row gets a small gold numbered dot (01…06) placed on its part in the exploded frame, with a short leader hairline. Anchors are in the frame's UV and mapped through exactly the shader's transform (rect, contain scale, zoom, shift) to screen px.
  - Markers draw in staggered as the explode completes, ride the push and parallax approximately, and fade out with the scene.
  - Hovering or focusing a spec row highlights its marker.
  - Pick the anchors by looking at `poster.webp` for each device. Record them in the markup as `data-anchor="u v"` on each `li.td__spec`.
  - Desktop only. Phones keep the list compact and skip the markers.
- **Edge light.** As the stage arrives, a faint warm umber falloff at the top and bottom of the black. This is the existing `.td::before/::after`; keep or improve it.

## Engine changes (src/gl/scenes/teardowns.js + src/sections/_teardown.{js,css})
- Per scene, two FrameStreams:
  - the orbit: `/assets/teardown/<name>/orbit/<tier>`, count from `data-td-orbit` (default 97);
  - the explode, as today.
  - Load the orbit first, since it's what shows first. The explode can start streaming when the run is within one viewport.
- The shader gets a second map plus `mixT` for the junction crossfade, or swap maps once the junction is passed.
- Slot geometry:
  - The **section JS** (`_teardown.js`) drives the slot rect: it writes left, top, width and height (or a transform) every frame from the hero rect (the viewport) and the column rect. The column rect is measured from the CSS-defined layout, e.g. a hidden `.td__slot-target`, or by computing it from the CSS variables.
  - `teardowns.js` keeps reading `slot.getBoundingClientRect()`, so the WebGL frame and the CSS fallback still follow the same element.
  - Zoom and shift interpolate from `data-td-hero` to `data-td-frame` (and the `-tall` variants on portrait).
  - Export the phase helpers (`tdPhases(p)`: orbit, hand-off, explode and settle fractions) from one place and use them in both the scene and the section JS.
- Tier: the phone tier is 'sm'. Use 'lg' when `vw*min(2,dpr) ≥ 1500`.
- **Fallbacks.** With `?tier=0`, reduced motion or no WebGL, the stage never boots.
  - Show `hero.webp` big in the hero phase (CSS, same layout) and `poster.webp` in the column phase. The stills are already `.td__still`; you may add a second `img` for the hero.
  - With reduced motion, the run is static (no pin): the hero image with the opener or head, then the exploded still with the spec list.
  - Nothing may be stuck invisible.
- Performance:
  - one draw per scene;
  - no layout thrash: read rects once per frame, and write styles only when they change (as in results.js);
  - SVG line drawing via CSS custom properties.

## Done means
- At 1440×900, 1280×720, 1024×768, 390×844 and 360×780:
  - Method opens on the camera filling the screen.
  - The view orbits around it, then the camera moves aside and comes apart beside the spec list.
  - The Kit chapter does the same for the console, the microphone, the headphones and the phone.
- No clipping of the device by the viewport except intended edge bleeds, no copy over the device in the column phase, no horizontal overflow, and no console errors.
- Fact check passes (desktop + mobile), `npx vite build` is clean, and `?tier=0` plus reduced motion are complete and attractive.
- Rail, dropdown and menu show I–X. The rail's active item tracks Kit. Nav and rail colours read correctly over the black stages.
