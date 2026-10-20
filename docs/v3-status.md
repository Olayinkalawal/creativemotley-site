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

---

# Phase 2 (chapters), integrated

Measured 2026-10-19 (22:19–22:48 UTC) on the integrated phase-2 working tree (tracks S structure, O1 Creators/Brands/Showcase, O2 Results/Directors/Apply, P platform, plus the integration fixes below), production build served by `scripts/perf.mjs --dist` (gzip text, range requests, immutable `/assets/*`). Same method as phase 1 (§1), now one command: `node scripts/perf.mjs --dist <build>`. Full report: `scratchpad/p2-int/perf1/perf.md`. Load average was 5.6–10 on the shared 4 cores (phase 1: 1.2–5.9), so single timings carry ±5 fps / ±150 ms.

## P2.1 Targets: phase 1 → phase 2

| Budget | Phase 1 | **Phase 2** | Target | |
|---|---|---|---|---|
| First load, desktop @1× | 0.56 MB / 32 req | **0.62 MB / 28 req** | ≤ 1.5 MB | met |
| First load, desktop @2× | 0.61 MB | **0.62 MB** | ≤ 1.5 MB | met |
| First load, phone @2× | 0.57 MB | **0.57 MB** | ≤ 1.0 MB | met |
| Full read, desktop @1× | 77.0 MB / 1,121 req | **19.12 MB / 378 req** | ≤ 18 MB | **missed by 1.1 MB**: the device frames are 11.17 MB (phase 3) |
| Full read, phone @2× | 5.83 MB / 77 req | **3.96 MB / 87 req** | ≤ 6 MB | met |
| JS (gzip) | 29.1 KB entry + 162.6 KB lazy (all desktop scenes) | **32.7 KB entry** (index 25.7 + scroll 7.0) + **155.4 KB lazy** (three 123.1 with `three-slim`, + every desktop scene) | ≤ 60 + ≤ 160 KB | met |
| LCP unthrottled, desktop / phone | 0.70–0.76 / 0.55–0.58 s | **0.94 s** median of 5 (0.84–1.04, load 7–8; the harness's 3 runs at load 7–10: 1.06) / **0.63 s** (0.60–0.93) | ≤ 1.0 s | met, at the line under load |
| LCP throttled phone | 2.56 s | **2.40 s** (2.36 / 2.40 / 2.52) | ≤ 2.5 s | met |
| Steady wheel, WebGL off | 39–60 fps; Brands and Showcase 39–40 | **51.9–59.8 fps** in all 12 windows (median 53.8) | ≥ 50 everywhere | met (table P2.3) |
| CLS while scrolling | 0 | **0** in all 24 windows | < 0.01 | met |
| Page length, desktop / phone | 58.5 / 54.2 screens | **33.6 / 32.7** (`?tier=0`: 28.5 / 28.3) | ≈ 40 | met |
| First chapter title | top at 6.1 screens | **top at 1.96** (in view after 0.96) | ≤ 2 | met |
| Words per screen | 11.5 | **34.4** (1,157 words / 33.6 screens; 40.6 on the `?tier=0` length) | 40–60 | **missed** with WebGL: the pinned runs (Showcase, Kit, Method) carry few words; 44 draft ids await the client |
| Distinct painted worlds | 7 paintings, 10 of 10 chapters own a scene | unchanged, plus the Kit's four colour keys | ≥ 9 | met |

### Where the bytes go now
- **Desktop full read @1×, 19.12 MB:** device frames 11.17 MB (Method camera v3 orbit+explode and the Kit's one orbit + four explodes); film 3.14 MB (hero cut 1.02 + Results backdrop AV1 1.88 + …); images 2.41 MB (posters as WebGL textures, 1200 px AVIF); Directors alpha film 0.97 MB (the 1280 encode now serves 1× desktops up to 1440); scene stills 0.67 MB; JS 0.19 MB; fonts 0.09 MB. Without the devices it is 7.9 MB, so **the five devices have ≈ 10 MB of headroom** against 18 MB (phase 1 said ≈ 2 MB).
- **Phone full read @2×, 3.96 MB:** Directors film (`directors-sm.webm`) 0.97 MB, images 1.15 MB, device stills 0.85 MB, portrait paintings 0.62 MB, JS 0.16 MB.

## P2.2 Chapter lengths vs the blueprint (screens; desktop 1440×900 / phone 390×844, WebGL on; `?tier=0` in brackets where it differs)

| Chapter | Blueprint (§5; phone ≈ 0.85×) | Phase 1 | **Phase 2** | |
|---|---|---|---|---|
| Hero + film beat | 2.70 / 2.30 | 3.20 / 3.20 | **1.90 / 1.90** | under |
| I Storytellers | 2.00 / 1.70 | 4.68 / 4.45 | **1.97 / 1.82** | on |
| II Creators | 2.60 / 2.21 | 4.15 / 5.02 | **2.73 / 3.68** | desktop +0.13; **phone +1.5** |
| III Brands | 2.40 / 2.04 | 3.97 / 3.85 | **2.71 / 3.52** | desktop +0.3; **phone +1.5** |
| IV Method | 3.30 / 2.81 | 5.40 / 4.40 | **3.30 / 2.80** | on |
| V Showcase | 3.00 / 2.55 | ≈ 6.6 / 6.6 (derived) | **7.32 / 6.83** (3.28 / 2.42) | **+4.3 with WebGL** (the poster-room pin) |
| VI Process | 2.80 / 2.38 | 6.18 / 5.83 (1.74 / 2.56) | **2.84 / 2.56** (1.74 / 2.56) | on |
| VII Kit | 4.5–6.0 / 3.8–5.1 | 16.0 / 13.2 | **5.20 / 4.42** | on |
| VIII Results | 1.80 / 1.53 | 2.79 / 2.30 | **1.84 / 1.44** | on |
| IX Directors | 2.20 / 1.87 | 3.22 / 3.12 | **2.16 / 2.06** | phone +0.2 |
| X Apply | 1.60 / 1.36 | 2.34 / 2.23 | **1.63 / 1.70** | phone +0.34 (the footer alone is ≈ 0.65) |
| **Page** | 29.7 / 25.2 (sum); target ≈ 40 | 58.5 / 54.2 | **33.6 / 32.7** (28.5 / 28.3) | |

## P2.3 Smoothness by chapter (desktop 1440×900, steady wheel 50 px / 50 ms, 10 s; top 14 s)

| Window | Phase 1 WebGL off | **Phase 2 WebGL off** (p95 ms) | Phase 2 WebGL on (SwiftShader, relative only) | CLS off / on | Load avg |
|---|---|---|---|---|---|
| Top (hero → film) | 55.6 | **53.2** (33) | 2.3 | 0 / 0 | 8.6 |
| I Storytellers | — | **53.1** (33) | 3.4 | 0 / 0 | 7.8 |
| II Creators | 55.5 | **52.8** (33) | 3.1 | 0 / 0 | 7.5 |
| III Brands | 40.3 / 38.7 | **54.0** (33) | 4.0 | 0 / 0 | 6.2 |
| IV Method | 47.4 (orbit) / 51.7 (explode) | **55.8** (33) | 2.8 | 0 / 0 | 6.0 |
| V Showcase | 39.6 / 39.3 | **58.5** (17) | 3.9 | 0 / 0 | 6.1 |
| VI Process | 48.6 (→ Kit) | **54.4** (33) | 1.9 | 0 / 0 | 6.7 |
| VII Kit (console) | 48.1 | **53.8** (33) | 2.4 | 0 / 0 | 6.4 |
| VII Kit +0.5 (cuts) | 52.0 / 50.8 | **56.9** (17) | 3.5 | 0 / 0 | 6.6 |
| VIII Results | 52.4 | **51.9** (33) | 1.8 | 0 / 0 | 6.8 |
| IX Directors | 49.2 / 47.7 | **52.2** (33) | 1.7 | 0 / 0 | 6.9 |
| X Apply | 60.0 / 59.9 | **59.8** (17) | 3.7 | 0 / 0 | 5.6 |

- The WebGL-off gains are the baked paper grain (a multiply-blended `.paper-grain` layer cost ≈ 8 ms a frame; now baked into `.paper` itself), the CSS plate hidden while a sheet covers the screen, flat photo cards, one construction-line layer in the teardowns, and the shorter runs.
- WebGL on: SwiftShader on a loaded machine, 1.7–4.0 fps, not comparable with phase 1's 3.0–12.1 (load 1–6). Each window reports the governor stepping down (4–8 canvas reallocations, at scene changes). Stage renders stop in 5 s idle everywhere except the scenes that animate on their own (Process objects 21, Results TV 16, Directors 18).

## P2.4 What the integration changed
Cross-track requests applied:
- S → `base.css`: the plates stay visible until the canvas has faded in (`transition: visibility 0s linear 0.9s`), so the hero no longer dips toward black at boot.
- S → `chrome.css`: `.hero` is 190svh (the inline style in `hero.html` is gone).
- S, O1, P → `base.css`: the paper grain is baked into `.paper` (the `.paper--baked` background); `.paper-grain` is kept in markup but no longer drawn.
- O2 → `plates.js` (Results): HEVC source for Safari, cache-busted `?v=2`.
- O2 → `base.css`: the tier-0 / reduced Results plate is framed like the stage (dek above the watchers' heads).
- P → `vite.config.js`: `threeSlim()` plugin (three's engine chunk 136.5 → 123.1 KB). The optional `modulePreload` change was not taken (its LCP gain was inside the noise).
- P → Creators / Brands: the services list and the brief steps carry one wrapper `data-draft="DC10 … DC17"` / `"DC32 … DC37"`, so `?drafts=0` leaves no empty block.
- P → `.gitignore`: `qa/perf`.
- S → docs: `teardown-v2.md` (a phase-2 note at its top) and `build-contract.md` (baked paper, `data-draft`, the teardown model) describe the one-run Kit, `[data-td-shot]`, `td:kit`, `data-td-key`, `data-td-xmap` and `v3/set.json`.

Seams fixed:
- **Kit repeated lines.** The Kit's heads repeated F42 (Creators' feature block) and F88/F89 (Process's Sound step). They are now the drafts DC85 "On the desk", DC86 "At the mic", DC87 "In the ears" (`data-draft`); the phone keeps "The work went out.", answered by Results' "The world watched." A scan finds no sentence on the page in two chapters.
- **Video modal race** (`ui/modal.js`): a close during the opening morph (Esc pressed early) let the player iframe be created inside the closing dialog. `onOpen` now also checks the dialog is still open.
- Verified, nothing to change: the "Leadership experience from" credits appear once (IX Directors, with DC91; gone from Brands with their CSS); Results says only "The world watched."

Checks:
- `npx vite build` clean; `node scripts/build-pages.mjs --base /creativemotley-site/` builds, and a full read of it under that path returned no 404 on desktop or phone (canonical and Organization JSON-LD present).
- Fact check passes, desktop and mobile (500 strings), 44 draft ids listed by chapter (storytellers DC01 DC03; creators DC10–17 DC19; brands DC31–37; method DC41 DC43–47 DC50–52; showcase DC60–63 DC65 DC67 DC69 DC71 DC73 DC75; kit DC85–87; directors DC90 DC91; apply DC100 DC101). `--drafts 0` passes (410 strings, no draft shows) and leaves no gaps (`qa/shots/v3p2_drafts0/`).
- No horizontal overflow at 1440, 1280, 1024, 390 or 360 (WebGL on and `?tier=0`, every half screen).
- Console: the only errors are the blocked i.ytimg.com thumbnails (policy block in this container), in every walk. No page errors, no failed first-party requests.
- `?tier=0` and reduced motion: complete; a slow walk finds no reveal left unrevealed at 1440, 1024 and 360.
- Video cards: no iframe and no YouTube request at load; thumbnails are requested only near Showcase; a click opens the modal with the youtube-nocookie player, Tab stays inside, Esc closes, the iframe is removed and focus returns to the card (desktop WebGL, phone, `?tier=0`).
- Kit and Method with the stage: the scenes draw at 1440, 1280 and 1024. At ≤ 1280 the Method explode streams the old `camera/sm` WebP frames (its column is under 960 device px); the Kit uses the v3 sets at every width tested.

## P2.5 Visual check
Contact sheets, one frame every 0.75 screen, labelled with the screen number: `qa/shots/v3p2_desk_sheet_00…03.jpg` (1440×900, 45 frames) and `qa/shots/v3p2_mob_sheet_00…03.jpg` (390×844, 43 frames); frames in `qa/shots/v3p2_desk/` and `qa/shots/v3p2_mob/`. Openers and runs at 1280×800 and 1024×768: `qa/shots/v3p2_1280/`, `qa/shots/v3p2_1024/`. Presentation sheets: `qa/shots/v3p2_best_desk.jpg`, `qa/shots/v3p2_best_mob.jpg`.

Closed since phase 1: (a) the fan and photo crops are each chapter's own painting; (b) the Creators, Brands and Directors titles sit in the calm band, clear of the figures, at 1440, 1280 and 1024; (c) the near-black film stretch is gone (161 of 570 frames); (d) the Kit's explodes sit inside the frame (Method's front element still bleeds off the right edge at 1024–1440, the teardown doc's intended edge bleed, with its 01 marker just inside); (g) the Results counters settle before any rest frame.

Still open (ranked):
1. **Showcase with WebGL is 7.3 screens** against 3.0; the opener still has a mostly empty dark screen before the posters rise (desk 016–018, phone 018–019).
2. **Phone Creators and Brands** run 3.7 and 3.5 screens against ≈ 2.2 and 2.0 (desktop is within 0.3).
3. **Process has no giant title**, only the serif head "Seven steps, every time." (phase-1 item e). On phones the desk's last screen before the Kit is nearly blank paper (phone 030).
4. **Phone Storytellers:** around screen 1.5 the title and dek cross the upper figure's face as they rise; clear from 1.7 (`qa/shots/v3p2_best_m2/`).
5. **Directors:** the running names line touches the top of the left portrait's cap (desk 041, phone 039).
6. **Kit cuts play over about 60 px of scroll** (one wheel notch, eased by Lenis). Judge the feel on real hardware before phase 4.
7. 1024×768: mid-truck in Brands (+0.12 of the section) the woman's face is outside the right edge; both faces are in by +0.2.

## P2.6 Open issues and what phase 3 / 4 start with
1. **Phase 3 (devices):** the desktop read is 19.1 MB, of which 11.2 MB is device frames; the target leaves ≈ 10 MB for all five devices (≈ 2 MB each). Video at 1–1.5 Mb/s or real-time GLBs (≤ 0.4 MB each) both fit; the renderer swap is contained to `gl/scenes/teardowns.js` (the choreography is data plus `gl/lib/tdcore.js`). Also retire the `sm` WebP fallback Method still streams at ≤ 1280.
2. **Words per screen 34 against 40–60:** the 44 drafts need the client's yes; the Directors bios must come from the client; the pinned runs (Showcase 7.3 screens, Kit 5.2) carry few words.
3. **Client inputs:** the 14 YouTube ids are still unverified from here (oEmbed and i.ytimg are blocked); DC91 repeats the five credits (keep one); DC85–DC87 are new on the page.
4. **Safari Directors film** (`directors.mp4`, HEVC with alpha, 15.1 MB) is unchanged: it needs macOS to encode (steps in `scripts/encode-directors.sh`).
5. **Phase 4 (critique) should start with** the Showcase length and its empty opener, the phone lengths of Creators and Brands, Process's missing title, and the Kit cut feel; then a real-device check of LCP (desktop sits at the 1.0 s line under load) and of WebGL smoothness, which this machine cannot measure.
6. **Housekeeping:** unused files that can be deleted (not deleted here): `public/assets/video/film/hero-1920-{av1,h264}.mp4` (11.1 MB), `public/assets/video/results.mp4` (10.6 MB master), `public/assets/teardown/{mic,headphones,phone}/orbit/` (18.9 MB, never requested: only the console orbits), `public/assets/teardown/{mixer,mic,headphones,phone}/{hero,poster}.webp` (0.6 MB; the Kit uses `v3/`), `public/assets/teardown/*/depth.png` (1.2 MB; only `depth.webp` loads). Fallback-only, keep for now: `public/assets/frames/hero/` (79 MB, the film without a playable video), the Kit devices' old `lg`/`sm` explode frames, `camera/orbit`, `mixer/orbit`. The stray `/dist-5405` (248 MB, filesystem root) is still there.

# Masters live (2026-10-20)
The six chapter paintings are now the modernised Renaissance masterpieces (art log: `docs/art-log.md`, masters in
`.art/masters-2026-10-20/`, rebuilt by `python3 scripts/art.py --config scripts/art-masters.json --depth
/home/user/models/midas_small.onnx`, then `python3 scripts/depth-directors.py`). Two rounds: the swap, then a fix round
on two critics' reviews (desktop 1440/1280/1024/1920; phone 390/360 and tablet 820).

## M.1 Numbers: phase 2 → masters swap → after the fix round
`scripts/perf.mjs` on production builds. Load average 11–17 for the first two columns, 3–10 for the last, so the LCP
and fps gains are mostly the quieter machine; the byte columns are exact.

| | Phase 2 | Swap | Now |
|---|---|---|---|
| Full read, desktop @1× | 19.12 MB | 17.51 MB | **16.89 MB** (≤ 18) |
| Film bytes in that read | 3.14 MB (film + Results video) | 1.26 MB | **0.70 MB** (cut 161 → 106 frames) |
| Painting bytes in that read | 0.67 MB | 1.17 MB | 1.12 MB |
| First load, desktop @1× / @2× · phone @2× | 0.62 / 0.62 · 0.57 MB | 0.67 / 0.77 · 0.50 MB | 0.67 / 0.77 · 0.51 MB |
| Full read, phone @2× | 3.96 MB | 4.02 MB | 4.01 MB |
| LCP unthrottled, desktop / phone | 1.30 / 0.79 s | 1.48 / 0.68 s | 0.45 / 0.36 s |
| LCP throttled phone | — | — | 2.14 s (≤ 2.5) |
| Fps, WebGL off: top · I · II · III · VIII · IX · X | 54 · 52 · 49 · 50 · 47 · 54 · 60 | 52 · 47 · 49 · 40 · 46 · 47 · 53 | 60 · 60 · 57 · 58 · 59 · 60 · 60 |
| Results renders while idle (5 s) | 12 (the TV) | 0 | 0 |
| CLS while scrolling | 0 | 0 | 0 |

Repo: the Results videos and plates and the old Storytellers plate and depth map are gone; the fix round adds 1640-px
portraits for tablets (3.9 MB, six chapters) and 3840-px desktop encodes for Brands, Results and Apply (3.7 MB, fetched
only by 2× screens), and the film is 1.5 MB lighter.

## M.2 What changed
- **I Storytellers.** The film ends on frame 440, the machine's line art before any colour (`FILM_CUT`, `data-film-map`,
  re-encoded; the old Storytellers plate and its depth map are deleted), and the School of Athens bleeds up under it
  along the section's top edge (`data-bleed`, `data-rise`). The film above the edge dims to 0.2 as the edge climbs
  (`data-bleed="0.2"`; post.js `bleedDim`), so the line-art face recedes before the rising title reaches it (title
  worst-10% at the 0.35 screen point: 5.1 → 12.0:1). Phones: the opener's shadow is soft (0.34, masked to the right)
  and fades out with the bleed (a scroll-driven animation).
- **The rise no longer tears.** The painting rises by a plain translation (`shift` in `gl/lib/plate.js`), kept apart
  from the push and parallax centre; Directors' hand-layered depth map is feathered over ~40 px. Clean during every
  opener's rise.
- **II Creators.** A light region from the opener's top to the parapet line (74svh, full width): rail items over the
  sky and lake turn ink; over the dark parapet they stay cream.
- **III Brands.** The rest zoom is fitted to the title (`fit` in `gl/keys/brands.json`, u 0.432 → 0.48): 1.48 → 1.34 at
  1440×900, so the whole man, the contract, the joined hands and the mirror are in at rest, the title's last letter just
  left of the hat. 2× screens get a 3840 encode. Phones: the title sits clear of the top bar (nav + 1.5svh); tablets keep
  the shell's line and the painting sits lower (phoneFocus y 0.47).
- **VIII Results.** Ink type on the sky at every width with a faint pale halo (no dark halo); the ledger's veil is an
  ellipse centred on the ledger (tablets too). Wide screens: the rest framing is fitted so the title and dek sit inside
  the oculus (`fit` mode ellipse: 1920×1080 → zoom 1.5 about u 0.64; it was 3.5:1 with the R on the balusters).
  Phones: title and dek moved in from the ring and a touch lower. The hand-off pushes on into the sky and Results dims
  to 0.3 as IX bleeds up (`data-bleed="0.3"`); the phone veil runs on 30svh.
- **IX Directors.** Phone portrait: the anamorphic reel is sunk into the table's shadow (`finish.shadows` in
  art-masters.json; art.py). Brands and Directors portraits carry the edition's oil finish (umber lift in the shadows,
  greens −12%, a slight soften, craquelure).
- **X Apply.** As the title leaves, the camera trucks right onto Venus and her attendant (zoom 1.5 about the right edge),
  so the wind pair has left the frame before the join block's torn edge reaches their heads; the join block is two
  columns, the pill beside its first line. WebGL off cuts to the same frame (`landPlate`). Tablets: phoneFocus y 0.50,
  the dek on one line (11.6:1). Phones: the shell is in at rest, the ink field rising over it.
- **Stage.** A chapter whose painting is not loaded yet draws ink, never the previous painting under its title. The
  chromatic fringe is off on jumps (chapter links, scrollTo, a half-screen jump) and when idle; paintings take half of
  it, phone stills 0.35 with a lower cap. The encode is chosen for the fitted framing and the zooms seen in full
  (`sharpKeys`).
- **Upright screens without the stage** (`?tier=0`, reduced motion): a `data-rise` chapter's painting enters with its
  section, so the title never scrolls across the whole painting (Creators and Apply hold the same contrast at 0.4, 0.7
  and 1.0 of the pass).
- **Reveal.** An element a fast jump carries past is revealed too, so it is never left hidden for the way back.

## M.3 Departures from the art direction (framing)
- Storytellers comes in under the film along the section's top edge, not through the full-screen dissolve.
- Tighter rest framings, because the giant title spans about half the screen from the column: Storytellers 1.15,
  Creators 1.22 (1.17 at 4:3), Brands 1.34 (fitted; 1.15 from about 1700 px wide), Results 1.3 from the top of the
  oculus (fitted up to 1.5 on wide screens), Apply 1.26. Creators and Brands do not show the whole painting at rest.
- Apply's join copy waits below the first screen on desktop, on an ink field with the torn edge.

## M.4 Checks (this round)
- Titles and decks at rest, worst 10% of glyph pixels: desktop 1440 titles 6.9–14.6, decks 6.2–14.3; the lowest
  are Results' title (7.0 at 1280 and 1024, 6.6 at 1920) and Creators' dek (5.9 at 1280, 5.4 at 1024). Phones 390 and
  360: 6.6–16 (Results 6.6 / 6.7). Tablet 820: Results 6.3, Creators' title 6.0, Storytellers' dek 5.0, the rest 7–14.
  Results' gold labels 5.6–10.4.
- No title over a face, figure or statue at rest at 1024, 1280, 1440, 1920, 390, 360, 820.
- Fact check passes, desktop and mobile (500 strings, 44 drafts listed); `--drafts 0` passes (410 strings).
- `npx vite build` and the Pages build succeed; a full read of the Pages build under `/creativemotley-site/` (desktop
  and phone) gets no 404.
- No horizontal overflow at 1440, 1280, 1024, 390, 360, 820 (WebGL), 1440/390/360 `?tier=0`, 1440/390 reduced motion;
  no console errors apart from the blocked YouTube thumbnails; tier 0 and reduced motion leave nothing unrevealed.
- Sheets: `qa/shots/v3m_best.jpg` (the six openers at rest, desktop and phone), `qa/shots/v3m_desk_sheet_00…02.jpg`,
  `qa/shots/v3m_mob_sheet_00…02.jpg` (one frame every 0.75 screen), `qa/shots/v3-masters-sheet.jpg` (the encodes).

## M.5 Remaining issues, ranked
1. **III Brands needs the outpaint** for the plan's composition: the master widened about 25% to the left (more window
   wall), then a rest zoom near 1.12 with the couple and the mirror under the title. A few Higgsfield credits; not
   spent in this round (no credit cap was set). Creators would gain 10–15% the same way (at 4:3 her face meets the
   right edge).
2. **IX Directors on phones has one director's chair**; the second needs a generative edit of the portrait master
   (about 4 credits). The reel is now in shadow, not repainted.
3. **The film's tail** (frames 448–569) still paints the old Storytellers painting; the cut stops before it. A regen
   that resolves the line art into the School of Athens would restore the film's payoff.
4. **Results → Directors**: the ring's watchers still sit at the screen's sides beside IX's rising title, dimmed to 0.3.
5. **Brand and Directors desktop masters** keep their own finish (only the portraits got the oil finish).
6. 1366×768 and other 16:9 laptops between 1280 and 1536 px were not checked by eye; Results' fit and Brands' fit
   compute their framing there.
7. Phone: Brands' title sits 12 px above the other openers' line (to clear the chandelier); the paper sheets end on a
   straight bottom edge; Creators' tripod camera is cut at the right edge; before the stage boots a fast scroll can
   fetch a CSS plate's phone-828 as well (pre-existing).
8. The LCP ≤ 1.0 s and ≥ 50 fps targets are met on this machine at load 3–10; confirm on real hardware. Unused
   `public/assets/video/film/hero-1920-{av1,h264}.mp4` (11.1 MB) is still in the repo (P2.6).

## M.6 Painting fixes (2026-10-20, client-approved)
Three of M.5's issues are fixed and live (items 1 and 2 there are closed; art log: "Painting fixes").
- **III Brands, desktop: a wider room.** The master is now a 16:9 room with the window wall on the left (glazed into
  shadow) and the couple, the contract, the mirror, the chandelier and the dog in the right ~55%. The rest frame is the
  whole room (zoom 1.04 about u .62; the title `fit` is gone), so the whole couple shows below and right of the title
  and dek at 1024×768, 1280×800, 1280×1024, 1366×768, 1440×900 and 1920×1080; as the title leaves, the camera pushes
  into the couple (1.6 about the lower right, both figures full-length). The opener's dark gradient is down to ~0.2
  and stops before the couple. Tier 0 / reduced motion: the CSS plate holds the same frames.
- **II Creators, desktop: room for 4:3.** The master is the old painting at 0.88 with more valley on the left and sky
  on top, so her hair starts at u .661. The rest zoom is fitted to the title (its right edge at u .645; 1.09 at
  1024×768, 1.05 at 1280×1024, 1.11 at 1440×900, 1.0 from ~1660 px), one sheet for every aspect (the narrow sheet is
  gone): her face is in at 1024×768 with the title clear of her hair (the outer braid touches the edge at 1280×1024).
  The tier-0 CSS plate uses steps at or above the fitted zoom.
- **IX Directors, phone: both empty chairs** flank the two-tier stand (the right one with a folded navy jacket);
  phoneFocus x 0.50, so both show at 390 and 360 (the jacket's outer edge is cut at 390; all in at 820).

| Check | Result |
|---|---|
| Titles / decks at rest, worst 10% of glyph pixels (WebGL; tier 0 within 0.2 except Creators' dek 8.4 at 1440) | Brands 13.5–13.8 / 10.8–12.9; Creators 10.4–10.8 / 6.7 (1024), 7.1 (1280), 7.5 (1440), 11.8 (1920); Directors phone 390 / 360 / 820: 16.8 / 15.8, 16.7 / 15.3, 15.6 / 15.3 |
| Titles over a face or figure at rest | none (1024, 1280, 1280×1024, 1366, 1440, 1920; 390, 360, 820), nor during the rise |
| Full read, desktop @1× | **16.57 MB** (≤ 18; was 16.89); painting bytes 1.14 MB; first load 0.67 / 0.77 / 0.51 MB; phone full read 4.01 MB |
| LCP unthrottled (load ~15) | 0.99 / 0.66 s |
| Fact check desktop + mobile | pass (500 strings, 44 drafts listed) |
| `vite build`, Pages build, full read under `/creativemotley-site/` (desktop + phone) | pass, no 404 |
| Horizontal overflow, console errors (1440, 1024, 1920, 390, 360, 820; tier 0 at 1440 and 390) | none |

Sheet: `qa/shots/v3m_best.jpg` (the six openers at rest, desktop and phone) and `qa/shots/v3-masters-sheet.jpg`
(the encodes). The replaced masters stay beside the new ones as `*-v1.png` (SHA256SUMS updated); the paper cards'
crops are cut from those full-resolution files at the same uv (`scripts/crops.py` SOURCE; the crops are unchanged).

# 3D camera live (2026-10-20)
Method's camera is the real-time 3D camera (`src/gl/scenes/camera3d.js` on the module `src/gl/lib/camera3d.js`, the v7
snapshot of `.lab/cam3d`; the photoreal frame sets are out of the build). Two rounds: the integration (snapshot
`d2dad37`), then a fix round on two critics' reviews (desktop 1440/1280/1024/1920; phone 390/360, tablet 820; tier 0 and
reduced motion everywhere). The module and its API are unchanged: the site's art direction goes through `create()`
options and the exported `KEYS`, so the lab's final GLB and module drop in at the same paths.

## C.1 Numbers: photoreal frames → 3D (integration) → after the fix round
`scripts/perf.mjs` on production builds; SwiftShader WebGL. Load average 27–30 for the first two columns, 4–6 for the
last, so LCP is mostly the quieter machine; bytes are exact. "Phone" is 390×844 @2 on the 4-core test machine, which is
below the new CAM3D gate (below), so it keeps the stills; `--qm cam3d=1` forces the 3D camera onto it.

| | Photoreal frames | 3D, integration | **3D, now** | Target |
|---|---|---|---|---|
| First load, desktop @1× / @2× · phone @2× | 0.67 / 0.77 · 0.51 MB | 0.68 / 0.78 · 0.51 MB | **0.68 / 0.78 · 0.51 MB**, no camera asset in any mode | ≤ 1.5 · ≤ 1.0 MB |
| Full read, desktop @1× | 16.91 MB | 16.05 MB | **16.02 MB** | ≤ 18 MB |
| Method's own share of it | 3.96 MB / 97 req | 2.42 MB / 3 req | **2.44 MB / 4 req** (GLB 2.30, stills 0.12, camera3d.js 0.015) | |
| Full read, phone @2× (gated: 3D stills) | 4.01 MB | — | **3.92 MB** | ≤ 6 MB |
| Full read, phone @2× with the 3D (`cam3d=1`) | — | 5.43 MB | **5.44 MB** (phone GLB 1.49 MB) | ≤ 6 MB |
| Lazy JS if every desktop scene loads (gzip -9) | 158.2 KB | 187.1 KB | **185.0 KB** (bloom chunk no longer loaded) | ≤ 160 KB: **over** |
| LCP unthrottled, desktop / phone | 1.17 / 1.00 s | 1.66 / 1.28 s (load 27–30) | **0.65 / 0.51 s** (median of 5, load ~5) | ≤ 1.0 s |
| CLS while scrolling Method | 0 | 0 | **0** | 0 |

Real-GPU frame rates are still unmeasured (SwiftShader: 0.4–0.7 fps through Method on both builds, relative only).

## C.2 What changed in the fix round (critics' items; D = desktop review, P = phone review)
- **Still → 3D, no flip (D1, P2).** The stand-in still dissolves into the camera (0.5 s, `_teardown.css`), and the
  first 3D frame drawn while a still is on screen starts at that still's own pose (the hero key, or the exploded key
  past a quarter of the explode), then turns into the scroll's pose over 0.9 s on the stage clock (`camera3d.js`
  intro; a renderer under 10 fps shows the turn in steps). Checked on a jump to the run's start at 1440 and 390: the
  first 3D frame matches the still's angle and size; the following frames turn to the rear three-quarter.
- **Coming back after an unload (D2, P1).** The scene reports `live.ready` (true once drawn, false when disposed) and
  the section's `is-drawn` follows it both ways, also while parked far away. Method → Results → Method at 1440 and 390:
  the exploded still (with its uv markers) shows at once and the 3D dissolves in when it has reloaded; no black
  chapter. Kit keeps its one-way latch (untouched).
- **No broken-image box, no empty circle (D3, P3).** Parked stills never paint (`.td__still:not([src])`), their src
  is set 1.6 screens ahead (was 0.3), the scene's `load()` makes both stills eager and waits until they are decoded and
  painted (≤ 2.5 s) before the GLB parse and studio bakes, and the lines and ticker wait for the still or the 3D
  (eased in over 0.3 s). On a jump the first frame is the title alone, then the still with its lines.
- **Markers draw in while scrolling (D4).** An id pass every 0.025 of explode from 0.93, one as it reaches 1, and every
  third of the settle; markers fade (0.25 s) instead of popping. Stepping through s 1.70 → 2.22 at 1440 without waiting
  for idle: 0, …, 1, 3, 3, 6, 6, 6, 10, 12, 12 (was 0 until the reader stopped, then 12 at once).
- **Rows and markers read together (D5).** Where every marker shows (desktop, tablets) the rows carry the markers'
  numbers (CSS counters, gold, no copy change), and the lit row's marker turns gold.
- **Bigger in the column (D6).** `KEYS.wide.column.fill` 0.76 → 0.88 from the scene (the module untouched);
  `data-td-frame0` 1.128 → 1.306 so the stand-in still matches. 1440: the camera lands 631 px wide (was 550).
- **Lazy JS (D7, partly).** `bloom: false` (strength 0.05 over threshold 4 was invisible; one full-screen pass per
  sample less): 187.1 → 185.0 KB gzip -9 for every desktop scene. Still 25 KB over the 160 KB budget: see C.5.
- **1024–1199 (D8).** The list column is 228 px (was 290) with a 14 px gap and a slightly smaller head (4 lines at
  1024); the camera's column gains about 75 px; 12 markers at the hold.
- **Reduced motion, desktop (D9).** The static hero still is sized so the camera starts 16 px right of the chapter
  index and ends ≥ 12 px from the right edge (centred where there is room); its black margin runs off under `main`'s clip.
- **Frame lines (D11).** `data-td-box` is the union of the 3D silhouette over the orbit (s −0.45 → 0.7) at 1024 and
  1440, plus 0.012: 0.121 0.059 0.879 0.941 (was the hero still's box).
- **Dead weight (D12, mostly).** The build drops `public/assets/teardown/camera` (29 MB, 585 files: `dist` 251 → 226
  MB; `vite.config.js` RETIRED) and `teardowns.js` no longer globs its set.json; `TD_EXT.camera`, `data-td-bleed` /
  `-bleed-tall` are gone; the DC41–DC52 notes in `docs/facts.json` and `docs/copy-drafts.md` point at
  `still_exploded.webp` and the 3D anchor ids. The folder itself stays in the repo because the camera lab still reads
  it (`.lab/cam3d/build_cam.py` line 864, `compare.py`, `client_sheets.py`). `dist-pages/.git` is the Pages publish
  clone (Vite keeps `.git` when it empties an outDir): left alone.
- **A resting mouse (D13, partly).** The pointer reaches the camera in 0.02 steps, so a still mouse no longer restarts
  the 12 samples on every eased sub-pixel move.
- **Phone orbit fills the screen (P4).** `data-td-orbit-tall="1.34"`: on portrait screens the orbit's slot runs from
  16 px under the title to 24 px above the bottom, 1.34 screens wide, so the camera crosses the screen with a bleed of
  about 6 % each side (390: −27 → 417 px) instead of 85 % of the width in a band of black. The stand-in stills follow.
- **No lines over the camera on portrait (P5).** No arch on portrait screens; the mask cuts a deep hole (0.9) round
  the device; the great circle and the ticker stay.
- **A bigger phone hold (P6).** Portrait explode scales from the scene (`portraitScale`: lens 0.76, free glass and iris
  0.7, rear cards 0.74, covers 0.62, battery 0.66; every anchor still on its own part), and a tighter head and rows on
  phones: the body 110 → about 133 px wide at 390, the column slot 338 → 373 px tall.
- **A gate for phones (P7).** `core/env.js` CAM3D: the phone path gets the 3D only with ≥ 4 GB (or no report) and ≥ 6
  cores; below that, the 3D stills (no GLB, no camera3d.js). At runtime, if the governor steps down to "min" while the
  camera draws, the scene gives up (`stage.dispose`, `failed`; `data-cam3d="stills"`): checked by forcing the floor at
  390, the hero still came back at once, no errors. `?cam3d=1|0` forces it (QA), `?q=…` turns the give-up off.
- **Markers off desktop (P8, partly).** Tablets (portrait ≥ 768) get all twelve, numbered (820: 12 at the hold); phones
  get the lit row's marker only, named, its label leaning to the screen's middle.
- **360 hand-off (P9).** On portrait screens the head starts at 55 % of the hand-off (was 36 %): at 360×780 the camera
  has risen 31 px clear of the heading by the time its first line shows (half-way in).
- **Reduced motion, phones (P10).** The static hero still is scaled 1.36 for Method (the camera at 92 % of the width).
- **Tier 0, phones (P11).** The two 3D stills dip through black (hero out by 25 % of the explode, exploded in from 25 %)
  instead of a double exposure.
- **Phone look (P12, partly).** On the phone path at the high level: paint grain on, 6 samples, exposure 1.07. Body
  luminance at the column key, p50 / p90 / p99: 39 / 81 / 163 (tier-0 still 34 / 92 / 187; was 36 / 85 / 166); exposure
  1.15 gives p99 168, internal scale 1.0 gives 173: the missing highlights are the phone path's lighting (no shadows,
  scale 0.8), a lab call.
- Not changed here (routed to the lab, `.lab/cam3d`, which the site must not edit): the front ring's grooved face
  catching the warm side light mid-orbit (D10: raise its roughness to ≥ 0.6 or keep it out of the kicker, then re-check
  `desk_0.20` / `desk_0.24`); rows lighting when each part actually moves (P13: add `revealed` to each `anchors()` entry,
  an additive field; the section would then light row i at `revealed > 0.5`); and `load()` yielding between the PMREM
  bakes, the compile and the warm-up frame (P14: one long main-thread task today, a scroll hitch in Brands on a phone).

## C.3 Checks (this round)
- Every mode: no camera asset on the first load (desktop @1×/@2×, phone; the first camera request comes as Brands
  becomes active, or on a chapter link's hover/tap); no console errors (the blocked YouTube thumbnails aside); no
  horizontal overflow at 1440, 1280, 1024, 1920, 390, 360, 820 (WebGL), 1440/1024/390 tier 0, 1440/1280/1024/390
  reduced motion.
- Markers: 12 at the hold at 1440, 1280, 1024 (and 1920), each placed by the scene on its 3D anchor; 12 at 820; the
  lit row's one on phones.
- Fact check passes desktop and mobile (509 strings, 47 drafts listed) and with `--drafts 0` (416 strings).
- `npx vite build` and the Pages build pass; a full read of the Pages build under `/creativemotley-site/` gets no 404
  on desktop or phone (gated: the 3D stills; and `?cam3d=1`: `camera_mobile.glb` loads under the base).
- Sheets: `qa/shots/v3c_method_desk.jpg` (1440, 1280, 1024, 1920 WebGL; 1440 and 1024 tier 0; reduced motion at three
  sizes), `qa/shots/v3c_method_mob.jpg` (390 and 360 3D, 820 tablet, a gated phone, tier 0, reduced motion) and
  `qa/shots/v3c_best.jpg` (orbit, hand-off and take-apart with markers, desktop and phone).

## C.4 Remaining issues, ranked
1. **Real-GPU frame rate is unmeasured.** Before launch: scroll Method on an Intel Iris Xe or M1 laptop at 1440@2× and
   on a mid-range Android and an iPhone. Under 45 fps, apply the levers in order: `paintGrain`, the shadow map size,
   MSAA, `scale` (bloom is already off). The phone gate (≥ 6 cores, ≥ 4 GB) and the runtime give-up are guesses until
   then.
2. **Lazy JS is 185.0 KB against 160 KB** (gzip -9, every desktop scene): camera3d 14.9, meshopt decoder 7.1, the GLB
   reader 2.5, three's core split. Nothing more comes out without losing the camera. Needs the director's sign-off to
   re-baseline the lazy budget to 185 KB (the swap took 1.54 MB of images off Method for +27 KB of JS), or a
   per-scene budget for camera3d.
3. **Lab items** D10 (front-ring groove flare), P13 (`revealed` per anchor), P14 (yield inside `load()`), and the phone
   look (P12: p99 163 against the still's 187).
4. **`public/assets/teardown/camera`** (29 MB) can be deleted once the lab no longer reads it; then drop it from
   RETIRED in `vite.config.js`.
5. On phones only the lit row's part is marked, and at the hold that is always the last row (Rear screen); with P13
   the lit row (and its marker) would follow the parts during the explode.
6. Software GL (this machine): the camera takes ~30 s to appear after the run nears; the still holds the chapter
   meanwhile, and the jump test shows it, not a blank stage.

## C.5 When the final (v7+) camera lands from the lab
```bash
cd /home/user/creativemotley-site
cp .lab/cam3d/camera.glb .lab/cam3d/camera_mobile.glb public/assets/models/camera/
cp .lab/cam3d/stills/still_hero.webp .lab/cam3d/stills/still_exploded.webp public/assets/teardown/camera3d/
cp .lab/cam3d/camera3d.js .lab/cam3d/glb.js src/gl/lib/
# not scene_camera3d.js: src/gl/scenes/camera3d.js is the site's scene now (stand-in, intro, markers, phone options);
# if the lab changed its template, merge by hand: diff .lab/cam3d/scene_camera3d.js src/gl/scenes/camera3d.js
```
Then, only if the lab moved the camera's keys or re-rendered the stills: re-measure `data-td-frame0` (the stand-in at
the column key: 0.88 of the column, set in the scene), `data-td-box` (the 3D camera's silhouette over the orbit,
`cam.partBoxes()` at s −0.45 → 0.7, as uv of the hero framing in `live.orb`) and the twelve `data-anchor` uvs on `still_exploded.webp`; check that `KEYS.wide.column` and the part names in
the scene's `PORTRAIT` still exist. Verify with the fact check (desktop, mobile, `--drafts 0`), `npx vite build`, the
Pages build and a pass through Method at 1440 and 390 (`?cam3d=1&q=high`).
