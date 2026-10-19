# v3 status: phase 1 (foundations), integrated

Measured 2026-10-19 on the integrated phase-1 build (tracks A engine, B art, C copy/video, D type/chrome, plus the
integration fixes listed below), production build (`vite build`) served by the same static server Track A used
(`scratchpad/qa/serve.mjs`: gzip for text, range requests, immutable caching for `/assets/*`).
"Before" is the review (`/home/user/ref-editions/review/report.md` §4–5) unless marked otherwise.

## 1. Targets (docs/v3-plan.md §1)

| Budget | v2 (review) | **v3 phase 1** | v3 target | |
|---|---|---|---|---|
| First load, desktop 1440×900 @1×, no scroll | 7.40 MB / 139 req | **0.56 MB / 32 req** | ≤ 1.5 MB | met |
| First load, desktop @2× | 16.64 MB | **0.61 MB / 32 req** | ≤ 1.5 MB | met |
| First load, phone 390×844 @2× | 7.40 MB / 139 req | **0.57 MB / 32 req** (@3×: 0.76 MB) | ≤ 1.0 MB | met |
| Full read, desktop @1× | 88.5–95.6 MB / ≈1,800 req | **77.0 MB / 1,121 req** (@2×: 80.2 MB) | ≤ 18 MB | **missed**: 56.0 MB is the device frame streams (phase 3) |
| Full read, phone @2× | 82.5 MB / 1,800 req | **5.83 MB / 77 req** (@3×: 6.68 MB) | ≤ 6 MB | met at 2×; 0.7 MB over at 3× |
| JS on the wire (gzip) | 70 KB + 144 KB lazy | **29.1 KB** + 134.5 KB lazy engine (three) + 0.3–6.2 KB per scene chunk, on demand (162.6 KB if every desktop scene loads) | ≤ 60 KB + ≤ 160 KB lazy | met at load; lazy at the line |
| LCP, unthrottled desktop / phone | 1.18 s / 1.05 s | **0.70–0.76 s / 0.55–0.58 s** (the hero dek) | ≤ 1.0 s | met |
| LCP, throttled phone (Lighthouse devtools profile, 4× CPU) | 2.88 s (+0.56 s document RTT) | **2.56 s** (+0.56 s document RTT) | ≤ 2.5 s | just missed |
| Scroll smoothness, WebGL off (steady wheel) | 6–13 fps in the teardowns | **47–52 fps in the teardowns**; 48–60 in most windows; **39–40 in Brands and Showcase** | ≥ 50 everywhere | partly met (table §2) |
| Scroll smoothness, WebGL on (software GL, relative only) | 1.1–6.4 fps (v2 on this machine) | 3.0–12.1 fps; higher than v2 in 8 of the 10 windows measured on both (not Top or Directors) | | relative gain only |
| Layout shift during scroll | 0.43–3.1 by window | **0 in all 34 windows** | CLS < 0.01 | met |
| Page length, desktop / phone | 58.5 vh / 54 screens | 58.5 vh / 54.2 screens | ≈ 40 vh | **missed** (phase 2) |
| First chapter title | ≈ 5 screens | top at 6.1 vh (it comes into view after 5.1 screens) | ≤ 2 screens | **missed** (film trim, phase 2) |
| Distinct painted worlds | 3 | **7 paintings** (hero, Storytellers, Creators, Brands, Results, Directors, Apply); 10 of 10 chapters now have their own scene (+ camera teardown, poster room, objects desk, Kit devices, umber room) | one per chapter (≥ 9) | met |
| Words per screen | ≈ 11 | 11.5 on the page (675 words / 58.5 screens); the drafts (`docs/copy-drafts.md`) reach 42–65 per chapter but are not on the page | ≈ 40–60 | **missed** until the client approves the drafts |

How each number was taken (the review's method throughout):
- **Bytes:** CDP Network bytes, cold cache, Chromium 1194 with SwiftShader WebGL. Desktop runs use `?tier=2&q=high` (what a real Mac gets; on SwiftShader the stage would otherwise start at its `low` level). First load is 10 s after `load` with no input. Full read scrolls in half-viewport steps, 1.2 s each, to the bottom. Script: `scratchpad/int/bytes.mjs`.
  - It fixes a counting gap in the phase-1 tracks' copy: media loads report `encodedDataLength` 0, so the film and backdrop videos counted 0 bytes. Media bodies are now counted with `dataLength`. Track A's "1.38 MB first load" was really about 2.6–3 MB, because the film buffered 1.2–1.7 MB at load. That is fixed (§3) and the 0.56 MB above includes media.
- **Smoothness:** a steady wheel of 50 px every 50 ms. Windows are 10 s each, and 14 s from the top. rAF frame times, layout-shift entries, and stage render calls (`scratchpad/qa/smooth.mjs`). Load average was 1.2–5.9: four cores shared with other agents.
- **LCP:** unthrottled, `scratchpad/int/lcp.mjs`; throttled, the review's `loadnet.mjs` (562.5 ms latency, 1474.56 kbps, 4× CPU, 390×844 @2×).

### Where the bytes go
- **Desktop full read @1×, 77.0 MB:**
  - device frame streams 56.0 MB (orbits 26.6 + explodes 29.4);
  - Directors alpha film (`directors.webm`) 7.66 MB;
  - hero film 4.74 MB (AV1);
  - Results backdrop 3.88 MB (AV1);
  - images 3.27 MB (posters as WebGL textures 2.1 MB);
  - device stills 0.92 MB, paintings 0.57 MB, JS 0.20 MB, fonts 0.09 MB.

  Without the device streams it is 21.0 MB. Re-encoding the Directors film to about 2.4 MB, as the phone already gets, would leave about 15.7 MB, so **the five devices have about 2 MB in total** if the read is to stay under 18 MB.
- **Phone full read @2×, 5.83 MB:**
  - Directors film (`directors-sm.webm`) 2.35 MB;
  - images 1.69 MB, of which the poster cards are 0.71 MB and the v2 landscape plates under the paper-card crops are 0.24 MB;
  - device stills 0.85 MB, portrait paintings 0.63 MB, JS 0.18 MB.
- **First load, desktop @1×, 0.56 MB:**
  - the three.js engine 135 KB;
  - the hero plate 114 KB, which is also the film's frame 0;
  - the Creators painting (the next chapter) 110 KB + depth 12 KB;
  - fonts 91 KB, entry JS 29 KB, HTML 15 KB, CSS 17 KB, hero depth 15 KB.

  Phone @2×: the same shell, plus the hero, Storytellers and Creators portrait paintings (828 px AVIF, 73–100 KB each), and no landscape plate.

## 2. Smoothness by chapter (fps; desktop 1440×900, steady wheel)

| Window (start) | v2 WebGL off (review) | v2 WebGL off (Track A's v2 runs) | **v3 WebGL off** | v2 WebGL on (Track A's v2 runs) | **v3 WebGL on** | v3 CLS | v3 stage renders, 5 s idle |
|---|---|---|---|---|---|---|---|
| Top (hero → film), 14 s | 54.6 | 50.8 / 52.3 | **55.6** | 4.0 / 6.4 | 3.0 | 0 | 0 |
| II Creators | 56.7 | 57.2 / 56.7 | **55.5** | 4.6 / 3.3 | 7.4 | 0 | 0 |
| III Brands | 32.3 (load 4) | — | **40.3 / 38.7** | — | 5.9 / 7.9 | 0 | 0 |
| IV Method (orbit) | 6.4 | 6.9 / 7.2 | **47.4** | 1.3 / 1.5 | 3.1 | 0 | 0 |
| IV Method +0.35 (explode) | — | 51.1 / 44.2 | **51.7** | 6.3 / 3.5 | 10.0 | 0 | 0 |
| V Showcase | 34.7 (load 4) | 35.5 / 34.0 | **39.6 / 39.3** | 5.7 / 2.5 | 9.4 / 9.6 | 0 | 0 |
| VI Process → Kit | 12.6 | 8.7 / 6.2 | **48.6** | 1.8 / 2.3 | 7.1 | 0 | 0 |
| VII Kit: console | 8.4 | 10.0 / 7.3 | **48.1** | 2.9 / 2.0 | 6.4 | 0 | 0 |
| VII Kit: mic | 8.4 | 7.1 / 6.7 | **52.0** | 2.5 / 1.5 | 6.5 | 0 | 0 |
| VII Kit: headphones | 30.9 | 7.1 / 6.3 | **50.8** | 2.9 / 1.1 | 6.2 | 0 | 0 |
| VIII Results | — | — | **52.4** | — | 4.4 | 0 | 40 (TV video, ≤ 30 fps) |
| IX Directors | 52.2 | 44.8 / 43.5 | **49.2 / 47.7** | 3.9 / 1.4 | 3.5 / 3.7 | 0 | 57 (dust, ≤ 30 fps) |
| X Apply | — | — | **60.0 / 59.9** | — | 11.8 / 12.1 | 0 | 0 |

- **WebGL on is SwiftShader**, a software rasteriser: absolute figures say nothing about a real GPU, so compare only within a column.
- **Each WebGL-on window reports 4 canvas attribute changes.** These are the governor stepping from `low` to `min`, the floor A built for software rasterisers. It happens at a scene change, never mid-scene.
- **Brands and Showcase are the two WebGL-off misses.** An ablation in Brands showed:
  - hiding the fixed CSS plate gives +4 fps;
  - hiding the fan or the credits makes no difference;
  - in Showcase, removing the list mask or the card shadows makes no difference.

  The cost is elsewhere in those chapters and needs a profile (phase 2 owns both chapters).

## 3. What the integration changed (phase 1)
Cross-track requests applied:
- A → D, `index.html`: the hidden Storytellers and Results plates are `data-bg` and load when first shown.
- A → D, `chrome.css`: `.frame.is-out::before { display: none; }`, so there is no backdrop blur once the hero frame has faded.
- A → `method.html`: the camera hero still is `loading="lazy"`.
- A → B: the nine v2 depth maps are now greyscale WebP (200–310 KB → 10–15 KB; mean error 0.4/255). `film.js`, `plates.js` and `teardowns.js` read the WebP.
- D → `showcase.js`: the modal morphs from the clicked card (`from: cards[k]`).
- D → stage: `gl/stage.js` listens for `cm:chapter-intent` and preloads that chapter's scene.
- C → `scripts/factcheck.mjs`: drafts are listed as `⚠ draft` warnings, and `--strict` fails on them.
- C/D → `docs/build-contract.md`:
  - no GSAP;
  - STILL / QUALITY;
  - the scene lifecycle, `dispose` / `ambient` / `device` / `invalidate`;
  - `KNOWN` in boot.js;
  - keys in `src/gl/keys/*.json`;
  - the type roles and `--f-*` tokens, with `.kicker` and `--t-giant` gone;
  - `.opener--light`;
  - the plate list.

Seams fixed:
- **B's paintings on desktop.** `gl/scenes/plates.js` now builds `plate:<chapter>` from every `public/assets/scenes/<chapter>/manifest.json`. It uses AVIF where it decodes (`avifOK()` in `gl/lib/loaders.js`), else WebP. It picks the smallest width that covers the canvas at the pixel budget: 2048 at 1×, 2880 at 2×. It adds the chapter's depth map, so the new paintings keep the pointer parallax and depth push.
  - The four new paintings had no depth maps. I made them locally with MiDaS, 10–11 KB each (`docs/art-log.md`).
  - New camera keys for Creators, Brands, Directors and Apply are in `src/gl/keys/plates.json`. Each pushes toward the manifest's subject focus.
- **Partials switched** (B's list):
  - Creators → `plate:creators`.
  - Brands → `plate:brands`.
  - Directors → `plate:directors` on the opener. The alpha-film run keeps `plate:umber`, the lit room it was designed against, and the painting dissolves into the room as the portraits rise.
  - Apply → `plate:apply`. It is the only light painting (manifest `titleInk: dark`), so the opener sits in a full-width `data-theme="light"` region with ink type and a pale halo (`.opener--light`). The rail flips to ink over it.
  - Tier 0 and reduced motion get CSS plates for the four chapters, with portrait files on portrait screens.
- **Phone first paint.** The hero plate is a `<picture>` with the portrait painting on portrait screens, and the preload is orientation-aware. Phones no longer fetch the 114 KB landscape plate, and the CSS plate is framed like the stage, so nothing swaps at boot.
- **First-load weight.**
  - The paper-card plate crops (`.crop`) load only when their chapter is within 1.5 screens (`.is-near`, `src/main.js`). This saves 126 KB on every first load.
  - The hero film no longer opens at load. Frame 0 is the hero plate, already fetched, so the film opens at the first wheel, touch, key or click. `VideoScrub` also no longer seeks at rest: a seek to frame 0 made Chrome buffer about 5 s of film. This saves 1.2–1.7 MB.
- **Phone full read.** The poster cards have 640/960 px WebP `srcset` variants. WebGL and the modal keep the 1200 px files. 7.19 → 5.83 MB.
- **Checks:**
  - `vite build` is clean.
  - The fact check passes, desktop 396 strings and mobile 395, with no drafts on the page.
  - There are no console errors or warnings, and no failed requests, in four walks: desktop WebGL, phone WebGL, desktop tier 0, and phone with reduced motion.
  - There is no horizontal overflow at 1440 or 390 at any stop.

## 4. Visual check
Contact sheets: `qa/shots/v3p1_desk_sheet.jpg` (1440×900) and `qa/shots/v3p1_mob_sheet.jpg` (390×844), one shot every 0.75 viewport. The frames are in `qa/shots/v3p1_desk/` and `qa/shots/v3p1_mob/`.

Found and fixed in this pass:
1. **Apply rail over the light painting was unreadable.** The inactive items were the paper-mute tone (#615a4e) on mid-tone painted stone, about 1.7:1. Over a light painting that is not paper, the rail now takes `.is-plate` with a cream halo and ink at 0.8 (`src/core/chapters.js`, `src/styles/chrome.css`).
2. **The Directors painting was clean for only about 0.2 viewport** between the Results dissolve and the dissolve into the umber room. The run now has `data-dissolve="0.25"`, which gives about 0.35 viewport clean, with the title on it.
3. **On phones the Directors run drew the portrait cut-outs over the painting's chairs.** The run now keeps the umber room on phones as on desktop (`gl/scenes/stills.js`: a region whose own `data-scene` is `plate:umber` draws the room).

Still open (none is new in v3 unless marked):

| | Where | What |
|---|---|---|
| a | Creators and Brands paper (desk 012–020, phone 012–021) | **New mismatch.** The fan cards and photo mats still crop the v2 Storytellers and hero paintings, so they no longer match the chapter's new painting. Phase 2 replaces them with real episode thumbnails. |
| b | Openers II, III, IX (desk 011, 016, 071) | **New.** The giant title starts at the column, after the one-fifth rail, so at 190 px it runs across the painted figures. B kept the left third calm. Place titles by each manifest's `titleBox`, or move the camera focus right. |
| c | Hero film (desk 003–004) | About 1.5 screens of near-black vortex. This is part of the film trim. |
| d | Method and Kit explodes (desk 026–027, 050) | The device runs off the right edge at 1440, as in v2. |
| e | Process (desk 037) | Still no giant title, only the serif head, as in v2. |
| f | Showcase opener (phone 028–029) | Two nearly empty dark screens before the posters rise. |
| g | Results counters (desk 068–069, phone 063) | Caught mid-count ("098M", "17"). They are scroll-driven and settle at rest. |

## 5. Open issues, ranked by distance from the targets
1. **Desktop full read is 77 MB against 18 MB.** The device frame streams are 56 MB (phase 3). After the Directors re-encode, the five devices have **about 2 MB in total**, which only real-time GLBs (≤ ≈0.4 MB each) can meet. Video at 1–1.5 Mb/s would be 1–1.5 MB per device.
2. **Page length and first title.** The page is 58.5 vh against ≈40, and the Storytellers title is at 6.1 vh against ≤ 2. This needs the film trim, Method at ≈330 vh and Kit as one run. Nothing changed here in phase 1.
3. **Directors alpha film:** 7.66 MB on desktop and 2.35 MB on phones. It is the largest item outside the devices in both reads, and it is what keeps phone @3× over 6 MB.
4. **Words per screen are 11.5 against 40–60.** The drafts await the client. The Directors bios have to come from the client. None of the 14 YouTube ids could be checked (Track C had no route to YouTube), so check them with oEmbed before any video card ships.
5. **Smoothness with WebGL off:**
   - Brands and Showcase run at 39–40 fps.
   - Method orbit (47), Process → Kit (48.6), Kit console (48) and Directors (48–49) are just under 50.
6. **Throttled phone LCP is 2.56 s against 2.5 s.** Four font preloads (91 KB) and the hero painting (99 KB, high priority) share the critical path with the CSS. Dropping the italic-serif and Imperial Script preloads is the cheapest lever.
7. **Lazy JS** is 162.6 KB against 160 KB, if every desktop scene loads in one read.
8. **Film seeking** is 100–140 ms median with software AV1 here. The WebCodecs and H.264 paths need a check on a real device (Track A).
9. **Phone contrast (D/B):**
   - the swash caps are 2.0–2.5:1;
   - the hero phone title is 1.9:1 in its brightest tenth;
   - the Apply phone painting needs darker space behind the title.
10. **Housekeeping:**
    - The git history holds Track A's intermediate film encodes; squash before pushing.
    - The v2 depth PNGs (2.1 MB) in `public/` are unused now (repo weight, not page weight).
    - A stray build output sits at `/dist-5405` (filesystem root, from an integration build with an unset path). The removal was blocked by the session's safety check, so delete it by hand.

## 6. What phase 2 (chapters) should start with
1. **Structure before content:**
   - trim the film so Storytellers lands by screen 2;
   - Method to ≈330 vh;
   - Kit as one run (four devices, quick cuts, one orbit).

   This is the biggest lever on page length, and it shrinks the device budget and the near-black stretches.
2. **Re-encode the Directors alpha film** to ≤ 2.5 MB desktop and ≤ 1 MB phone. That puts both full reads in reach once the devices are solved.
3. **Rebuild the openers on the new paintings:**
   - set title placement from each manifest's `titleBox` and the camera keys from `focus`;
   - replace the v2-plate crops in Creators and Brands with real episode thumbnails;
   - apply Track C's moves: the "Leadership experience from" credits go to Directors; the step names come out of Method (Process alone names them); the Kit labels become part names (DC85–DC88).
4. **Profile Brands and Showcase** (WebGL off) while those chapters are open.
5. **Prepare the watch-the-work cards.** Verify the YouTube ids, then build the lazy thumbnail plus modal player.
6. **Phase 3 can then be decided on numbers:** about 2 MB for five devices means real-time 3D, if the camera proof passes the client's side-by-side.
