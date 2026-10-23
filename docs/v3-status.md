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

# The Kit in real time (2026-10-20)
The Kit's four devices (console, microphone, headphones, phone) are real-time 3D: one stage scene, `td:kit`
(`src/gl/scenes/kit3d.js`), on the Kit runtime (`src/gl/lib/kit3d.js` + `kit3d_devices.js`, byte-identical to
`.lab/kit3d`'s package: the camera's v5 runtime made config-driven, with the console's dialect folded in).
`python3 -I .lab/kit3d/kit_apply.py --check` passed on today's `src/`, so the wiring went in by the script; then the
Kit got the camera's behaviours, sharing the camera's code rather than copying it (K.2). Method is unchanged.

## K.1 Numbers: photoreal Kit (HEAD 154e73b's build) → real-time Kit
`scripts/perf.mjs` on production builds, SwiftShader WebGL, the same machine back to back (load average 2–3). Bytes
are exact; frame rates are relative only.

| | Photoreal Kit | **Real-time Kit** | Target |
|---|---|---|---|
| First load, desktop @1× / @2× · phone @2× | 0.68 / 0.78 · 0.51 MB | **0.68 / 0.78 · 0.51 MB**, no Kit request in any mode | ≤ 1.5 · ≤ 1.0 MB |
| Full read, desktop @1× (perf.mjs pace) | 16.05 MB / 296 req | **10.85 MB / 116 req** | ≤ 18 MB |
| The Kit's own share of it | 8.13 MB / 189 req (frame streams) | **2.93 MB / 9 req** (3 GLBs, 4 stills, kit3d.js) | |
| The Kit, each shot held until its device drew (lab `bytes.mjs`) | 8.12 MB (frame streams and stills) | **3.82 MB**: the four GLBs 3.56, the console's stills 0.16, two stand-in hero stills 0.07 (software GL was still loading those devices at their cuts), kit3d.js 0.03; phone path 2.56 MB (phone GLBs 2.30) | |
| Full read, phone @2× (gated: 3D stills) | 3.92 MB (Kit 0.65) | **3.81 MB** (Kit 0.54: 8 stills) | ≤ 6 MB |
| Full read, phone @2× with the 3D (`cam3d=1&q=high`) | 5.44 MB (camera 3D, Kit stills) | **6.34 MB** (3 of 4 phone GLBs at this pace; ~6.75 with the fourth) | ≤ 6 MB: **over** when forced |
| Lazy JS if every desktop scene loads (gzip -9) | 185.1 KB | **210.4 KB** (kit3d +30.5, teardowns −5.0 no longer loaded, camera3d −0.2) | 185 KB accepted for the camera |
| Entry JS (gzip -9, index) | 26.2 KB | **25.7 KB** (the Kit's photoreal extent tables gone) | ≤ 60 KB |
| LCP unthrottled, desktop / phone (median of 5) | 0.42 / 0.35 s | **0.39 / 0.31 s** | ≤ 1.0 s |
| CLS while scrolling the Kit (4 windows) and Method, WebGL off and on | 0 | **0** | 0 |
| Steady wheel in the Kit, WebGL off | 59.6–60 fps | **59.6–59.9 fps** | ≥ 50 |
| Steady wheel in the Kit, SwiftShader (perf.mjs windows, loads included) | 7.0–9.2 fps (a textured quad) | **0.6–1.2 fps** (Method's camera in the same run: 0.6) | relative |
| Continuous scroll through the run, every device warmed (lab `fps.mjs`, `q=low`) | 13.7 fps | **0.31–0.32 fps** (Method's camera: 0.59 fps) | relative |
| `dist` | 226 MB | **151 MB** | |

The perf.mjs full read moves half a screen every 1.2 s; on software GL one device loads in ~8–10 s, so the headphones'
shot passes before its GLB gets its turn (the scene loads one device at a time, the shot on screen first). On a GPU,
where each device loads inside its prefetch window, a desktop read is about 11.7 MB (10.85 − 2.93 + 3.82) and a
forced-3D phone read about 6.75 MB.

## K.2 What changed
- **The package, as shipped.** GLBs in `public/assets/models/{mixer,mic,headphones,phone}/` (desktop and `_mobile`),
  3D stills in `public/assets/teardown/{mixer,mic,headphones,phone}3d/`, runtime and configs in `src/gl/lib/`, the
  scene in `src/gl/scenes/kit3d.js`. `kit_apply.py`: `boot.js` (registry line; on phones under the camera's CAM3D gate),
  `teardowns.js` / `stills.js` (skip `td:kit`), `_teardown.js` (a shot's anchors place that shot's markers; the 3D
  stills' dip for every `*3d` device; stills per shot), `_teardown.css` (the stand-in dissolves for `td:kit` too) and
  `kit.html` (dev ids `mixer3d` …, framing keys on the 3D stills, 24 rows with `data-anchor3d` and a uv on
  `still_exploded.webp`, `data-td-orbit-fill="0.8"`).
- **Shared with the camera** (`gl/lib/tdcore.js`, already imported by both scenes): `tdIdDue` (the id-pass schedule:
  every 0.025 of explode from 0.93, one as it reaches 1, every third of the settle; the package's Kit scene had only the
  first rule), `tdIntroPose` + `TD_INTRO_MS` (the turn from the still's pose), `tdStandIn` (stills eager, decoded and
  painted, ≤ 2.5 s), `tdGiveUp` (phones: the governor at "min" gives up unless `?q=`; the package's Kit also skipped the
  give-up under `?cam3d=`, it now follows the camera's rule) and `tdPointerStep`. `gl/scenes/camera3d.js` calls them
  with unchanged behaviour: Method's marker draw-in at 1440 is the same sequence as HEAD's (0, 0, 0, 1, 3, 5, 7, 9, 11,
  12, 12, 12), 12 at the hold; the frames match HEAD's.
- **Still → 3D on the stage clock.** The package timed the Kit's intro turn and stand-in cross-fade by wall clock, so a
  slow renderer skipped the turn (the first 3D frame already at the scroll's pose, the still ghosting behind it). Both
  run on `ctx.dt` (≤ 0.1 s a frame) like the camera's intro: on a jump the first 3D frame matches the still and turns
  into the scroll's pose over the next frames.
- **Still fallback.** The scene's `live.ready` drives the section's two-way `is-drawn` (the Kit's one-way latch is
  gone): after an unload (Kit → Apply → back to the mic) the shot's still and its uv markers show at once, then the 3D
  dissolves in; the phone give-up (`data-kit3d="stills"`) brings the stills back the same way.
- **Numbered rows, gold lit marker.** Method's counter rules moved from `method.css` to `_teardown.css` (any `.td--mk`
  run whose markers all show: desktop, tablets), so the Kit's rows read 01–06 like its markers; the lit row and its
  marker turn gold (shared). Phones: the lit row's marker only, named, as for the camera.
- **Stills per shot, both ways.** A shot's pair loads from 1.6 screens before it to 0.6 after the next cut (the package
  had no upper bound: a return from below fetched all eight). On phones the stills are parked as on desktop where CAM3D
  lets a scene draw (a 3D phone no longer fetches the eight Kit stills it never shows); a gated phone keeps the markup's
  `loading="lazy"`.
- **Retired from the build.** `vite.config.js` RETIRED adds `assets/teardown/{mixer,mic,headphones,phone}` (83 MB, 2,140
  files). Nothing live needs them: `kit.html` points at the 3D stills, `teardowns.js` no longer globs their `set.json`
  (no run uses `teardowns.js` now; it stays as the frame-stream renderer), and `tdcore.js`'s `TD_EXT` tables for them
  are gone. The folders stay in the repo for the device labs (`.lab/kit3d/<device>/compare.py`).
- **Reduced motion.** The console's static hero gets Method's D9 rule on desktop (under the title, clear of the chapter
  index; HEAD's photoreal still was `cover` under the title, over the index) and 1.15 on phones (~92 % of the width,
  as Method's 1.36); `kit.css`.
- Copy unchanged; `docs/ui-strings.json`'s note names the 3D devices, their stills and anchors.

## K.3 Checks
- **The run** (production build, `?tier=2&q=high`) at 1440×900, 1280×800, 1024×768, 1920×1080: the console's orbit under
  "Kit" with the lines and ticker, the hand-off, the take-apart beside its list, a cut on each colour key, each device
  apart with **6 markers on its parts** at every hold, none during the cuts, the ride-out into Results. Devices loaded
  ±1 (the rest disposed). No horizontal overflow, no console errors (the blocked YouTube thumbnails aside).
- **Phones and tablets** (`?cam3d=1&q=high`: this machine is below the gate): 390×844 and 360×780 run end to end on the
  phone GLBs, the lit row's marker named on its part while each device comes apart; 820×1180 shows all six numbered.
  The gated phone (default here) gets the 3D stills only: no `kit3d` chunk, no GLB.
- **The camera's behaviours on the Kit** (1440): a jump into the orbit shows the hero still at once, then the first 3D
  frame at the still's pose, turning; a jump into the mic loads the mic first, with its exploded still and uv markers
  meanwhile; markers draw in while scrolling (0, 2, 4, 5, 6, 6 … over s 1.200 → 1.475 without waiting for idle); unload
  and return as above; forcing the governor to "min" on a 3D phone gives up to the stills at once, no errors.
- **Tier 0** (1440, 1024, 390) and **reduced motion** (1440, 1280, 1024, 1920, 390, 360): complete, no Kit 3D requested
  (reduced: no stage at all), no overflow, no errors. Method intact in both.
- **Fact check** desktop and mobile (509 strings, 47 drafts) and `--drafts 0` (416): pass, unchanged.
- **Builds**: `npx vite build` passes; the Pages build under `/creativemotley-site/` serves 0 404s on a full desktop read
  and a full 3D phone read, the GLBs loading under the base. (Its desktop read is 13.2 MB against the root build's
  10.85 MB: it fetches the 1200-px poster AVIFs in addition; not the Kit's, which match.)
- Sheets: `qa/shots/v3k_kit_desk.jpg` (the run at 1440, 1280, 1024, 1920; the jump, unload and draw-in; tier 0;
  reduced motion; Method now vs HEAD) and `qa/shots/v3k_kit_mob.jpg` (390 and 360 3D, the phone markers, 820 tablet,
  the gated phone and the give-up, tier 0, reduced motion, Method on the phone).

## K.4 Open, ranked
1. **Real-GPU frame rate is unmeasured** (as for the camera). The lab's bench puts each Kit device at 0.5–0.7× the
   camera's frame cost; on SwiftShader the perf.mjs windows draw the Kit on par with Method (0.6–1.2 against 0.6 fps),
   but a continuous scroll through the whole run, cuts included (two devices and two contact-shadow passes during a
   cut), runs at about half the camera's rate (0.31 against 0.59 fps). Check on an integrated-GPU laptop and a
   mid-range phone before launch; the levers are the camera's (stage quality, MSAA, shadow map size).
2. **Lazy JS 210.4 KB** against the 185 KB accepted for the camera (+25.2 KB, the `kit3d` chunk). The Kit already
   shares three.js, `glb.js`, the meshopt decoder and now the scenes' rules with the camera, and loads no bloom. Sharing
   the runtime itself needs the lab: the site ships the camera's v7 module as a drop-in, the Kit's runtime is a
   config-driven fork of the camera's v5. Running the camera on `kit3d.js` with a camera config (lab port + parity check)
   would drop `camera3d.js`'s 14.7 KB (→ ~196 KB). Stripping comments and whitespace from the runtimes' GLSL at build
   would save about 2 KB more.
3. **A phone that passes the gate reads ~6.75 MB** with the camera and all four Kit devices (the gated phone: 3.81 MB).
   If that matters, give the Kit its own, stricter phone gate, or load only the shot on screen on phones.
4. Lab items carried over from `.lab/kit3d/INTEGRATION.md` (not touched here): the console's side wall and family tone,
   the mic's exploded brightness, the headphones' explode and diaphragm, the phone's `load()` time and hero fill; the
   console fills its orbit slot nearly edge to edge mid-orbit.
5. Not given to the Kit (not in this brief): Method's P4 portrait orbit slot (`data-td-orbit-tall`), so on phones the
   console orbits at about 60 % of the width inside the great circle.

# 3D Kit live (2026-10-20)
A fix round on two critics' reviews of the real-time Kit: desktop D1–D11 (1440, 1280, 1024, 1920) and phone P1–P13
(390, 360, the 820 tablet, tier 0, reduced motion). `src/gl/lib/kit3d.js` and `kit3d_devices.js` are still
byte-identical to `.lab/kit3d`. The art direction goes through the scene, which sets the device keys before `create()`
(as `camera3d.js` does with the camera's `KEYS`), and through the markup's framing. Every rule that changed is shared
with Method's camera.

## L.1 Numbers: the Kit in real time (K.1) → now
`scripts/perf.mjs` on production builds, SwiftShader WebGL. Load average was 3–7 because captures ran alongside, so LCP
is noisier than K.1's (load 2–3). Bytes are exact. The perf.mjs read moves half a screen every 1.2 s. On software GL
that is too fast for every device to load, so that read pulls in only 2–3 of the 4 Kit GLBs. The ".lab per-shot" row
uses the lab's `bytes.mjs` instead: it holds each shot until its device has drawn, which is the GPU case.

| | Kit in real time (K.1) | **Now** | Target |
|---|---|---|---|
| First load, desktop @1× / @2× · phone @2× | 0.68 / 0.78 · 0.51 MB, no Kit request | **0.68 / 0.78 · 0.51 MB**, no Kit request at any size | ≤ 1.5 · ≤ 1.0 MB |
| Full read, desktop @1× (perf.mjs pace) | 10.85 MB / 116 req | **8.24 MB / 112 req**; about 9.5 MB with all four GLBs (GPU) | ≤ 18 MB |
| The Kit with each shot held until its device drew (.lab `bytes.mjs`), desktop · phone path | 3.82 · 2.56 MB | **2.39 · 1.60 MB** | |
| Full read, phone @2× (gated: 3D stills) | 3.81 MB | **3.81 MB** | ≤ 6 MB |
| Full read, phone @2× forced onto the 3D (`cam3d=1&q=high`) | 6.34 MB (~6.75 with every GLB) | **5.24 MB** at perf.mjs pace; **~5.9 MB** with all four phone GLBs (4.28 non-Kit + 1.60 Kit) | ≤ 6 MB: **passes** |
| GLBs on the wire: Kit phone set · Kit desktop set · camera phone / desktop | 2.30 · 3.56 · 1.49 / 2.30 MB | **1.33 · 2.12 · 0.98 / 1.48 MB** (gzip -9 copies) | |
| Lazy JS if every desktop scene loads (gzip -9, the same file list: everything but `index` and the preloaded `scroll` chunk) | 210.2 KB (K.1: 210.4) | **206.4 KB** | 185 KB accepted for the camera |
| `kit3d` · `camera3d` chunks (gzip -9) | 30.4 · 14.7 KB | **28.5 · 14.2 KB** (+ `glbfetch` 0.3 KB, shared) | |
| Entry JS (gzip -9, index) | 25.7 KB | **26.1 KB** (the deep-link landing) | ≤ 60 KB |
| LCP unthrottled, desktop / phone (median of 5) | 0.39 / 0.31 s | **0.48 / 0.29 s** (load 6–7) | ≤ 1.0 s |
| CLS scrolling the Kit (4 windows) and Method · steady wheel, WebGL off | 0 · 59.6–59.9 fps | **0 · 59.7–60 fps** | 0 · ≥ 50 |
| Kit stills fetched: chapter-index jump to s = 0 · jump into the mic · a 3D phone's whole read | 4 · 8 · 4–8 | **1 · 2 (+1 the scene's, for the next cut) · 3** | |
| Phone GLBs held at once (390, forward and back) | 3 | **2** | |
| `dist` | 151 MB | **156 MB** (the .gz copies) | |

## L.2 What changed (D = desktop review, P = phone review)
- **Chapter-index arrival (D1, P4).** No spin and no shrink: in the first three quarters of an orbit the 3D no longer
  turns from the hero still's pose (tdcore `tdIntroTurn`, both scenes); the 0.5 s dissolve hands over at the scroll's
  pose. The hero still now shrinks with the view over the orbit (`tdView`'s `startK`: `data-td-hero-start` /
  `-start-tall`, the start key's fill over the hero key's; Method 1.071 / 0.977, the console 0.857 / 0.913), so at s = 0
  the stand-in is the size the 3D draws and stays in frame (1440, chapter-index click: the still covers x 535–1170,
  y 325–830; the first 3D frame x 525–1185, y 325–835; was a still from x 275 past the right edge). The console's portrait hero framing is box-matched to the 3D: `data-td-hero-tall` 1.284 → 1.13
  (width within 2 % at s = 0 and 4 % at the orbit's end, 390 and 360).
- **Late GLB (D2).** A shot whose device is not in fetches both stills at once; the next shot's hero still comes 0.6
  screens ahead (phones 0.5) when its device is not in; the scene frames each still at its own pose, as the section
  does (it framed the exploded still at the scroll's partial explode: 21 % small); `live.ready` means "shot k is
  shown" (device, or the still its phase calls for), so it no longer drops through the dip and the DOM still never pops
  in over the scene's; a cut whose device and still are both late wipes in the bare key instead of freezing. Mic GLB held
  back 25 min: the cut lands on the hero still, the dip, the exploded still at the 3D's size, no pop, no blank key.
- **Console air (D3, P9).** The scene sets the console's keys before `create()` (the package's file untouched): hero
  fill 0.80 → 0.70, column 0.84 → 0.80, portrait exploded 0.89 → 0.83. 1440 orbit: right edge 1337–1357 (83–103 px of
  air; was ~10); 1280: 1187–1205 (75–93 px; was 15); 390 hold: 28 px each side (was 8), 360: 26 px. Stills re-matched:
  `data-td-hero` 1 → 0.875, `data-td-frame0` 1.081 → 1.03, `data-td-frame` 1.895 → 1.87, `data-td-frame-tall` 1.984 → 1.99.
- **Rim over the devices (D4).** The cut's rim is masked by both devices' coverage (stills included) and narrowed
  (0.045 → 0.025): an ink-lit edge on the keys only.
- **Headphones (D5).** Column fill 0.88 → 0.74, exploded 0.96 → 0.88, `fillMax` 0.96 → 0.92 (the family's; portrait
  holds at 0.92): 1440 arrival 462 × 598 px (y 175–773; was 120–830); at the hold the right cup ends 53 px from the edge
  at 1440 and 37 px at 1024 (was 21–28), the band ~120 px under the bar.
  Stills re-matched (`data-td-frame0` 1.89 → 1.589, `data-td-frame` 1.358 → 1.213, `-frame-tall` 1.201 → 1.151). The
  cushions' material is a lab item.
- **Stills only where they show (D6, P7).** Per still, not per pair: shot 0's hero 1.6 screens ahead, its exploded one
  0.6 before its explode; a later shot's hero 0.3 before its cut, its exploded one from its cut; each until just after
  the next cut. The scene's `load()` makes only the still its phase shows eager. Chapter-index jump to s = 0: 1 Kit still
  (was 4); jump into the mic: 2 (was 8); a 3D phone's whole read: 3 DOM stills (was 4–8).
- **Labels readable (D7).** Pills 0.62 → 0.78 ink (all markers); the Kit's numbered labels sit 56 px out (Method 42:
  `--td-lead`, the leader line follows), so the mic's 02/03/04 land beside their parts.
- **Markers hand over without a blink (D8).** Both scenes publish `live.turning` while the device turns from the
  still's pose; the section keeps the markers on the still's uv until then, and the first id pass after the turn hands
  them to the 3D anchors. Unload and return at 1440 (mic hold): 6 markers at every capture (was 6 → 0 → 6).
- **Deep links (D9).** `main.js`: a hash on load lands again after the sections' init, the fonts, the load and each
  layout pass (until the reader scrolls, ≤ 6 s), `scrollRestoration` manual. `/#kit` lands on the Kit (y 20650, was
  15854: 5 screens early in Showcase); `/#method` on Method; `/#results` on Results. (The browser's own jump at parse can
  still start the Kit's lazy stills before JS parks them: a deep-link-only cost.)
- **Lazy JS (D10, P13).** `scripts/three-slim.mjs` minifies the site's own GLSL template literals (`src/gl/**`: the
  runtimes, the scenes; search strings and literals with `${}` left alone): `kit3d` chunk 30.9 → 28.9 KB gzip, `camera3d`
  14.7 → 14.5. The rest is the decision below.
- **Phone bytes (D11, P3).** The build writes a gzipped copy beside every GLB (`vite.config.js` `glbGzip`, level 9);
  both scenes fetch it through `gl/lib/glbfetch.js` (`loadBuffer`, the runtimes' own hook): the .gz, inflated with
  DecompressionStream, or as it came if the host already decoded it (glTF magic), or the plain .glb (dev, no
  DecompressionStream, a host's fallback page). The Kit's phone GLBs 2.30 → 1.33 MB, the desktop ones 3.56 → 2.12 MB,
  the camera's 2.30 → 1.48 / 1.49 → 0.98 MB. No .lab or runtime file changed (the runtimes' own `loadBuffer` hook).
- **Phones name a part at every hold (P1).** On a run whose markers a real-time scene places, phones keep the last lit
  row lit through the hold (Method already did): Chassis, XLR connector, Headband, Rear glass at 390, named on the part;
  the gated phone's uv marker the same. The named marker also fades with the cut.
- **No letter tops under a waiting heading (P2).** `.td-ln__in` waits a full line plus 0.45em below its mask and is
  transparent at `--k` 0 (opacity only); shared, so Method's hand-off and the giant titles get it too.
- **Phone loading (P5, P6, D11).** On phones the next device loads from the shot's hold (`settle[0]`, when the screen is
  still) and no earlier than 0.35 screens before its cut, via `requestIdleCallback` (≤ 300 ms). Both ways: when the last
  move was up, the previous device loads near its cut (and its exploded still if it is late) and the next one is dropped
  above the hold, so a phone holds two GLBs (390 forward: console+mic, mic+headphones, headphones+phone, phone; reverse
  path 3.42 → 1.85: the same, `live.ready` true at every step, no DOM still fetched). Desktop keeps k − 1 … k + 1.
- **Give-up before the GLB (P10).** If the governor is already at "min" when the Kit (or Method) loads on a phone, the
  scene gives up at the top of `load()`: no GLB, no bakes, `data-kit3d` / `data-cam3d` = "stills", a warning only.
- **Reduced motion: the console's exploded still (P12).** Scaled 1.3 (transform) with matching room above and below.
- **Not changed here (lab, `.lab/kit3d`):** the headphones' cushion material (D5); the console's rim light, side wall,
  and the screen glare over the first third of the orbit (P11).

## L.3 Checks
- **Desktop run** (production build, `?tier=2&q=high`): 1440, 1024 and 1920 swept through the run (orbit, arrival,
  take-apart, every cut, every hold, the ride-out). 1280 was read slowly in 0.1 steps and held at each hold. Every
  hold showed 6 numbered markers, none during cuts, no horizontal overflow and no console errors. The only Kit requests
  were one still, the four `.glb.gz` and the chunk.
- **Arrivals at 1440:**
  - Chapter-index click to s = 0: no spin; the still and the 3D share one box.
  - Mic GLB held back for 25 min: the cut lands on the hero still, then the dip, then the exploded still at the 3D's
    size. No pop and no blank key; `live.ready` stayed true.
  - Jump into the mic: 2 DOM stills.
  - Unload (bottom of the page) and back to the mic hold: 6 markers at every capture, from the still to the 3D.
  - Deep links `/#kit`, `/#method`, `/#results` land exactly on their chapter (`/#results` was 69 px short until the
    250 ms check).
- **Phones and tablet** (`?cam3d=1&q=high`):
  - 390, 360 and 820 swept.
  - 390 holds: one named marker each (Chassis, XLR connector, Headband 13 px under the bar, Rear glass).
  - 360: the Headband label is clear of the bar; the console hold is 26 px from each edge.
  - 820: 6 numbered markers.
  - A heading held mid-cut at 390 shows its label only, no letter tops.
  - Jump to the Kit at 390: the still, then the 3D at the scroll pose. Widths match within 2–4 %. The heights differ,
    because the still is the wide key's render.
  - Reverse path 3.42 → 1.85 at 390: two GLBs at most, `live.ready` always true.
  - Gated 390 (no Kit JS, no GLB) names the held part on the still.
- **Method** at 1440: 12 markers at the hold, numbered rows, no errors. A jump to s = 0 shows the hero still, then the 3D
  at the scroll pose, with no turn.
- **Tier 0** at 1440, 1280, 1024, 1920 and 390, and **reduced motion** at 1440, 1280, 1024, 1920, 390, 360 and 820: complete,
  with no GLB or Kit chunk, no overflow and no errors. With reduced motion the console's exploded still spans ~54 % of
  the width at 390 (was 40–45 %).
- **Not reproduced:** P10, the give-up before the GLB. It is checked in code only, because this machine's governor
  stops at "low".
- **Fact check** desktop and mobile (509 strings, 47 drafts) and `--drafts 0` (416): pass. Copy unchanged.
- **Builds:** `npx vite build` passes and writes the `.glb.gz` copies. The Pages build under `/creativemotley-site/`
  gave 0 failed requests on a full desktop read and a full 3D phone read, with all four Kit GLBs and the camera's
  (`.gz`) loading under the base and no console errors.
- **Sheets:**
  - `qa/shots/v3k_kit_desk.jpg`: 1440, 1280 slow, 1024, 1920; the arrivals row; tier 0 and reduced; Method.
  - `qa/shots/v3k_kit_mob.jpg`: 390 run, 390 holds, mid-cut and jump; 360; 820; gated and tier 0.
  - `qa/shots/v3k_best.jpg`: each device arriving and taken apart, desktop and phone.

## L.4 Open, ranked
1. **Real-GPU frame rate is unmeasured.** On SwiftShader the Kit runs at about half the camera's rate through a cut. Before
   launch, check on an integrated-GPU laptop and a mid-range phone. The levers are the camera's: quality, MSAA and shadow size.
2. **Lazy JS is 206.4 KB against the 185 KB accepted for the camera.** Recommendation: accept it for this release; it is
   lazy and Kit-only. Book the lab port of the camera onto `kit3d.js` with a parity check. That drops `camera3d.js`,
   ~14 KB, to about 192 KB.
3. **Forced-3D phone read is ~5.9 MB with all four devices**, under 6 MB but thin. The stand-in hero stills, 0.16 MB, are
   fetched on every 3D phone read, because the next device now loads from the hold. If the CAM3D gate widens, revisit
   `STILL_AHEAD_PHONE`. The gated phone reads 3.81 MB.
4. **Lab items** (`.lab/kit3d`; the site must not edit it):
   - The headphones' cushion material (D5).
   - The console's rim light, its side wall, and the screen glare over the first third of the orbit (P11). Re-render
     its stills after.
   - A still at each orbit's start key, so a jump into the orbit dissolves between matching angles. Today the Kit's
     console and Method's camera change angle over the 0.5 s dissolve, front three-quarter to rear.
   - A portrait-key hero still for phones (P4: heights differ at s = 0).
5. **Deep link to `/#kit`:** the browser's own jump at parse still starts the Kit's lazy stills before JS parks them
   (deep links only, ~0.5 MB).
6. **Headphones at 1024:** the hold keeps 37 px of air to the right edge, under the 50–70 px the review asked for
   (1440: 53 px). Next step if wanted: exploded fill 0.86.

# Phase 4: the bright hero, drag and zoom, the site fixes (verified 2026-10-21)
A fresh verification of the three tracks that answered the client's 2026-10-21 requests and the four-lens critique:
HERO (the Creation repainted in daylight, the real-time 3D camera in the fingertip gap, the fly through its lens into
I Storytellers), SITE-FIX (28 triaged items across the other chapters, the chrome and SEO) and DRAG (drag to turn and zoom
for every real-time device). Production builds served locally (`scripts/perf.mjs --dist`, a static server on :5533,
`scripts/build-pages.mjs` under `/creativemotley-site/`), SwiftShader WebGL. Evidence:
`/tmp/claude-0/-home-user-creativemotley-site/f5fb006b-f00a-5174-8cc3-2633425655d9/scratchpad/p4v/` (perf runs in
`perf/` and `perf2/`, hero captures in `hero/`, drag runs in `drag/`, axe in `axe/`, keyboard in `kb2/`).

## P4.1 Numbers: 3D Kit live (L.1, e04c7ba) → now
| | 3D Kit live | **Now** | Target |
|---|---|---|---|
| First load, desktop @1× / @2× · phone @2× | 0.68 / 0.78 · 0.51 MB | **0.75 / 0.89 · 0.49 MB** (29 / 29 / 26 req); no GLB before the first input | ≤ 1.5 · ≤ 1.0 MB |
| Full read, desktop @1× (perf.mjs pace) | 8.24 MB / 112 req | **7.74 MB / 106 req** (camera.glb.gz 1.44 MB, the Directors film 0.97 MB) | ≤ 18 MB |
| Full read, phone @2× (gated) | 3.81 MB | **3.88 MB / 85 req** | ≤ 6 MB |
| Entry (gzip -9): index JS · CSS | 25.6 · 21.7 KB | **29.6 · 24.3 KB** | ≤ 60 KB JS |
| Lazy JS (gzip -9, every lazy chunk but the preloaded `scroll`; both builds counted the same way) | 212.4 KB | **215.5 KB** (+3.1: `drag3d` 3.6 and `hero3d` 5.4 in; `film` 6.1, `filmRanges` 0.6, `frameStream` 1.5 out; `teardowns` +1.2) | 206 KB accepted on L.1's count: **~3 KB over** |
| LCP unthrottled, desktop / phone (median of 3) | 0.48 / 0.29 s | **0.39 / 0.32 s** (the dek) | ≤ 1.0 s |
| LCP throttled phone (median of 3) | 2.41 s | **2.23 s** (2208–2248 ms; FCP the same) | ≤ 2.5 s |
| Steady wheel, WebGL off (min / median, 12 windows) | 59.6–60 fps | **58.6 / 59.4 fps** | ≥ 50 |
| CLS scrolling (every window) · a full walk at 11 sizes, tier 0, reduced motion | 0 | **0** (reduced motion at 1440 was **1.0**: fixed here, P4.3) | < 0.01 |
| CLS on deep links (desktop `#kit` `#method` `#results` `#apply`; phone the same) | phone up to 1.0 | desktop 0.001 · **0–0.12** · 0 · 0; phone 0.014 · 0.004 · **0–0.47** · 0.005 (`#method`: a timing race, P4.6) | < 0.01 |
| Page length, desktop / phone | 34.45 / 33.3 screens | **30.4 / 29.7** (tier 0: 28.1 / 27.7) | ≈ 40 |
| First chapter title | (film hero) | **1.95 screens** (desktop and phone) | ≤ 2 |
| Words per screen, desktop / phone | | **31.9 / 29.4** (969 words; 47 drafts await the client) | ≈ 40–60 |
| Horizontal overflow · console | 0 · none | **0 at 1440, 1280, 1024, 1920, 390, 360, 414, 820, 844×390, tier 0 and reduced motion · no errors** | 0 · none |

The hero painting: mean luma 0.29 → 0.49 (Shopify's 0.33); desktop-2880.avif 229 → 224 KB, phone-828.avif 99 → 56 KB;
the first-paint plate is `plates/hero.avif` (105 KB). The DOM camera stills: cam-hero 16.6 KB, cam-front 10.6 KB,
cam-lens 53.9 KB.

## P4.2 Client requests (2026-10-21)
- **"Use the mouse to move them around" — done.** Every real-time device turns under a drag (`src/gl/lib/drag3d.js`):
  the hero camera (−56° for a 160 px drag), Method's camera in the orbit and at the hold (markers follow: 11–12 at the
  hold), the four Kit devices (24.5° each; 6 markers re-placed after the drag; the drag is off through a cut, which now
  plays on a 0.7 s clock). Each returns to the scroll's pose 2.5 s after the last input, or on scrolling. Keyboard: the
  device is focusable (`role="img"`, a label naming the keys); the arrows turn it 15°, 0 or Escape resets. Touch at
  390 (`?cam3d=1`): a horizontal swipe turns it 44° and scrolls 0 px; a vertical swipe on the device scrolls 225 px. The
  one-time hint reads "Drag to turn · double-click to zoom" (mouse) / "· pinch to zoom" (touch). The glide on release is
  checked with synthetic fast drags only: SwiftShader draws about one frame a second here.
- **"Zoom in like the camera I had done" — done.** ctrl/cmd + wheel zooms about the pointer (hero 1.13× for eight
  notches; the page's own zoom stays 1; a plain wheel scrolls 57 px and the zoom eases out); double-click 2× and back;
  + / − / reset buttons beside the device (+ + = 2.25×); two-finger pinch on phones reaches 3× on the hero, Method and
  the Kit with the page scale at 1; double-tap 2× on the hero. Past 1.15× the copy steps back (Method: `d3-zoomed`).
  The 3D viewer artifact has the same zoom (`viewer-kit/out/`), ready to republish.
- **"The homepage is heavy … replace that camera with the 3D one … like Shopify's image" — done.** Against
  `pair_01_theirs.jpg`: ours is now lighter and cleaner than Editions' own (a clear cerulean sky and cumulus, fresh
  greens, no varnish; theirs is mid-key with dark pines). At 1:1 the faces, hands and fabrics are crisp. One magenta
  accent (his headphones), no floating kit. The golden frame reads as Editions' does: ink type on a frosted cream panel,
  a gilt hairline. The live 3D camera floats between the fingertips at 1024, 1280, 1440 and 1920 (141 px at 1440), turns
  slowly and takes the drag; it is a little darker than the daylight around it and has no contact shadow, so it reads
  slightly placed rather than painted in. Scrolling flies through it: the camera turns lens-on, pushes in until the
  front element fills the screen, the dark glass, seven iris blades, the aperture opening onto the School of Athens, a
  plain cut into I Storytellers; reversible (checked back up at 0.8, 0.5, 0.2, 0). The beats ride the push (ink over
  the sky, cream over the glass). Phones: the reach crop (hands, gap, sky) with the same 3D move above the gate and the
  2D move (stills and DOM blades) below it; tier 0 and reduced motion: the still at rest, a cut.

## P4.3 What this round changed (verifier)
- **Cross-track diffs applied:** `src/gl/stage.js` header comment (HERO's); the `?tier=0` class in `index.html`'s head
  script and the stopgap removed from `src/partials/creators.html`; a tighter halo on the rail's serif numerals
  (`src/styles/chrome.css`); `sitemapLastmod()` in `vite.config.js` (the production build now dates `sitemap.xml`);
  the Kit's later shots' copy hidden until the teardown's init (`src/sections/_teardown.css`).
- **Not applied, for the director:** the two late font preloads (+34 KB on a throttled LCP with 0.27 s of headroom, for a
  3 px deep-link shift); `--t-numeral: var(--t-display)` (it would shrink the phone's counters from 71 to 56 px, which
  item 5 kept unchanged); the teardown's init cost and its pre-init layout (P4.6).
- **Regression: the frame's mark and index stayed on screen beside the rail's** (desktop, about 2 loads in 5: a frame
  drawn before `measureFlip` wrote an inline opacity of 1 that beat `.frame.is-docked`). Fixed in `src/ui/hero.js`:
  desktop clears the inline value. 5 timings re-run: hidden once docked every time.
- **Regression: reduced motion at 1440 had CLS 1.0** (the teardowns' static switch now ran after the first paint, and
  the Kit's pinned still moved across the viewport for the browser). Fixed in `src/main.js`: with reduced motion the
  teardowns' init runs before the first frame, as for a deep link. Walks at 1440 and 390: 0.
- **Regression: a faint, larger copy of the 3D camera on phones and tablets** (a GLB that landed after the stage's 10 s
  idle cut-off drew three frames, and the running mean kept the camera's fitted framing from the first). Fixed in
  `src/gl/scenes/hero3d.js`: the mean starts again on the frame after the hand-over. 390 and 820 at rest: clean.

## P4.4 Item verdicts
- **HERO (16 items):** fixed: the d1 painting and encodes (2; the lower-right bush still shows a little AI hatching),
  hero3d with alpha compositing (3), the fly-through (4), the hero and rail links' focus and taps (5: the frame's nav is
  inert and hidden once out; the rail links have a box and take focus), the frame's contrast (6), the beats (7), the
  budgets (8), the dock as a 0.6 s FLIP (9, with the regression above fixed), the lines easing back (10), paper tears
  (12), touch targets (13: desktop rows stay 20 px, see P4.6), safe areas, scroll padding and forced colours (14), the
  share card, icons, `en-GB`, JSON-LD and skip link (15), `?drafts=0` Storytellers (16). **Partly:** the landscape
  phone (11): at 844×390 the mark and dek sit over his head and the dek touches the mark.
- **SITE-FIX (27 items):** fixed per SITE-FIX's evidence and re-checked here where it shows: Showcase 3.82 screens (2),
  Process (4), Results 2 × 2 (5), Apply stickers (6), Directors (7), focus moves (8: skip link, in-page links, dropdown
  Escape and tab-out, the video modal's focus return all checked), the video row (10), video hygiene (11), Directors
  credits (13), the Apply footer (14), the Creators cloud (15), `?drafts=0` (16), idle motion (17), long jumps (18),
  the dropdown thumbnails (19), the modal on phones (20), touch targets (21), 404 / robots / sitemap (22), Results type
  (23), Process polish (24), link names (25), the mailto dash (26), facts housekeeping (27), reduced-motion reload (28).
  **Partly:** deep-link CLS (3: `#method` still races), main-thread blocking (9: the teardown init), the rail theme
  (12: the numerals' halo is now applied).
- **DRAG (items 2–12):** fixed: the controller, zoom, Method, the Kit, the hero (2–6), reveals as transitions (7), Kit
  cuts on a clock (8), screen readers (9), the 820 tablet orbit (10), landscape phones (11), the lines over the device
  (12).
- **Checks:** fact check desktop, mobile (485 strings) and `--drafts 0` (392) pass. axe on the phone: no violations in
  25 states (scroll stops, menu, both modals). axe on desktop: `target-size` ×10 on the rail's 17 px rows (the same ten
  links are in the Chapters menu at 44 px: WCAG 2.5.8's equivalent-control exception) and `color-contrast` on
  `#process-title` (a false positive: axe cannot see the WebGL paper behind it). The Pages build under the base: a full
  desktop read (105 responses) and a full 3D phone read (83) with no failed request; the phone read logs the governor's
  "stage is at its floor" warnings only.

## P4.5 Sheets
- `qa/shots/v3p4_desk_sheet_00…02.jpg` (1440, every 0.75 screen), `qa/shots/v3p4_mob_sheet_00…02.jpg` (390).
- `qa/shots/v3p4_best.jpg`: the new hero, desktop and phone (3D), then the push, the iris (desktop and phone),
  Storytellers, Creators, Brands, Method taken apart and dragged, Showcase, the Kit's console, Apply.
- HERO's own: `qa/shots/v3h_hero.jpg`, `qa/shots/v3h_flythrough.mp4`.
- Some Kit frames on the desktop sheet catch a cut mid-way (the new device in, the old heading still up): the cut's
  clock runs on drawn frames, about one a second on SwiftShader.

## P4.6 Remaining, ranked
1. **Lazy JS is ~3 KB over the 206 KB accepted** (215.5 vs 212.4 counted the same way). Moving `drag3d` (3.6 KB) into
   the entry would meet it at the cost of every first load. Recommendation: accept, as L.4 did for the Kit.
2. **Deep link to `/#method`: the teardown's layout before its init differs from after** (the copy's position, the
   spec list): CLS 0–0.12 desktop, 0–0.47 phone, depending on timing. Fix in `_teardown`: match the pre-init layout.
3. **The teardown's init is one long task** (736 ms desktop, 548 ms on the throttled phone here) when the reader comes
   within two screens of Method; almost all of it is the lines' mask canvas being read back. Measure on a real GPU
   before cutting it (a CSS-gradient mask, or building it at idle).
4. **Landscape phones (844×390):** the hero's mark and dek over his head.
5. **Phone menu trap:** one Tab lands on the page body before cycling back to the Menu button.
6. **Deferred init and focus:** after jumping to the Kit, the next Tab skips the Directors' Pause button (made at its
   init); a phone deep link to `#kit` measured 0.014 CLS once (a 3 px font-swap shift; 0.004 in SITE-FIX's runs).
7. **The film's files** are no longer referenced (`public/assets/frames/hero/` 79 MB, `public/assets/video/film/` 13 MB,
   `scripts/encode-film.sh`): `git rm -r public/assets/frames/hero public/assets/video/film` when the director agrees.
8. **Real hardware:** the drag's glide and hint timing, the hero's idle turn, and the Kit's frame rate are unmeasured
   off SwiftShader. If nobody touches the page for 10 s while a device loads, its drag region waits for the next input.
9. Polish: a contact shadow or warmer key for the hero camera; the second beat sits in ink over the dark lens rim for
   s 0.42–0.47 before it turns cream; the remaining hatch strokes in the lower-right bushes.

## P4.7 Lab and client
- **Lab (`.lab`, not edited here):** carry the site's additions into `.lab/cam3d/camera3d.js` before the next drop-in
  (`opts.alpha` + `renderTexture()`, `envSky` / `envGround`, `view.shift` / `view.near`, `setZoom`, `screenBox()`) and
  `setZoom` / `screenBox()` into `.lab/kit3d`; a hero-only exterior LOD of the camera (~0.7 MB desktop, ~0.45 MB
  phone); the purple ring-light arcs inside the front element (they show through the whole push); the console's glare,
  the headphone cushions and the phone's display (L.4); a still per orbit start key.
- **Client:** approve the new homepage (the d1 painting; phones the reach crop, or the p4 recomposition with both
  figures as the fallback); the poster small print; DC91 or the credits row; "MultiChoice"; "Monetise"; Process F94 /
  F95; the four channel-probable YouTube ids; 16:9 key frames for the seven video cards; the applicant email; the 47
  drafted lines.

# Phase 5: 3D polish (verified 2026-10-22)
The client: "the 3d camera is amazeballs". This round kept every device's silhouette, choreography, framing keys and
character and made the five real-time devices hold up as product renders at 1x and at the 3x zoom (drag3d). Three
tracks, each with a critic and a fix pass: CAM (the camera in Method and on the homepage), KIT-A (console, headphones),
KIT-B (microphone, phone). Then this verification on a production build served locally, SwiftShader WebGL (no real-GPU
frame rates are claimed). Evidence: `/tmp/claude-0/-home-user-creativemotley-site/f5fb006b-f00a-5174-8cc3-2633425655d9/scratchpad/p5/verify/`
(perf runs in `perf/`, `perf_phone3d/`, `perf_smooth/`; walks in `walk/`; drag and zoom in `dz/`; the homepage push in
`hero/`; the viewer in `viewer/`); the tracks' own before/after frames under `scratchpad/p5/{cam,p5-cam,kitA,p5-kitA,kitB,p5-kitB}`.

## P5.1 Numbers: phase 4 (ac776e6) → now
| | Phase 4 | **Now** | Target |
|---|---|---|---|
| First load, desktop @1× / @2× · phone @2× | 0.75 / 0.89 · 0.49 MB | **0.75 / 0.89 · 0.49 MB** (29 / 29 / 26 req); no GLB before the first input (every `.glb.gz` in the scroll phase) | ≤ 1.5 · ≤ 1.0 MB |
| Full read, desktop @1× | 7.74 MB | **8.33 MB / 111 req** (this run loaded the camera, console, phone and mic GLBs; which Kit GLBs a SwiftShader read reaches varies: 8.31–9.00 MB across the round) | ≤ 18 MB |
| Full read, phone @2× · phone with 3D (`?cam3d=1`) | 3.88 MB · — | **3.89 MB / 85 req · 4.91 MB / 93 req** | ≤ 6 MB |
| Lazy JS (gzip -9, every lazy chunk but `scroll`; both builds counted the same way) | 215.47 KB | **215.28 KB** (−0.19: camera3d −0.23, kit3d −0.05, hero3d +0.07; three.core back to phase 4's bytes, P5.3) | must not grow |
| Entry JS · CSS (gzip -9) | 29.58 · 24.25 KB | **29.70 · 24.25 KB** (+0.12: `src/ui/hero.js`'s stills and beats, CAM) | ≤ 60 KB JS |
| LCP unthrottled, desktop / phone (median of 3) | 0.39 / 0.32 s | **0.42 / 0.32 s** (the dek) | ≤ 1.0 s |
| CLS while scrolling (5 windows, WebGL off and on) · walks at 8 sizes | 0 · 0 | **0 · 0** | < 0.01 |
| CLS on deep links `#method` `#kit` `#results` `#apply` (1440 and 390, two runs each) | desktop 0–0.12, phone up to 0.47 (`#method`) | **0 in all 16 runs** | < 0.01 |
| Steady wheel, WebGL off (min / median fps) | 58.6 / 59.4 | **56.8 / 59.8** | ≥ 50 |
| Horizontal overflow · console errors | 0 · none | **0 at 1440, 1280, 1024, 1920, 390, 360, 820, 844×390, tier 0 and reduced motion · none** | 0 · none |

GLBs (gzip -9 of the file in `public/`, phase 4 → now; the limit is +10%): camera 1,469,744 → 1,444,076 (−1.7%),
camera phone 973,937 → 946,670 (−2.8%); console 629,190 → 634,392 (+0.8%), phone model 374,941 → 379,543 (+1.2%);
microphone 404,296 → 417,842 (+3.4%), phone model 302,811 → 318,667 (+5.2%); headphones 636,573 → 647,636 (+1.7%),
phone model 383,255 → 387,869 (+1.2%); phone 432,237 → 451,771 (+4.5%: the lit screen's 512 × 1088 painting), phone
model 259,592 → 260,153 (+0.2%). The lab GLBs are byte-identical to `public/`, and every lab rebuilds its GLBs byte for byte.

## P5.2 What changed, per device (before → after at the same pose; each track's sheet has the pairs)
- **Camera (Method and the homepage), CAM.** The glass: the violet ring-light arcs inside the front element are gone
  (share of bright pixels at the push's s 0.48 / 0.55 / 0.62, 1440: 0.5 / 14.9 / 25.6% → 0 / 0 / 0; 390: 2.9 / 10.1 /
  12.9% → 0); the glass sees a softbox studio, the inner elements a softer, blurred copy of it at half strength, so their
  nested reflections blend into one glow instead of a staircase of boxes (the critic's regression, fixed); the lens
  interior is lit (centre median at s 0.55: 1 → 10). The front element at the hero key reads mid-grey (median 20–48 →
  39–46 across az −58 … −18). The knurled dial lost its bronze facets (warm pixels at 3x 438 → 102); the zoom ring's crests
  no longer sparkle at the silhouette (0 pixels above L 150 at 3x); the iris blades are satin steel with brighter cut
  edges; the homepage fades the model's own iris as the drawn blades close, so one iris reads at s 0.66–0.74. The hero at
  rest is lighter (median 35 → 46). The second beat never sits in ink over the camera; the phone's hold is one clean
  line. Shader programs 18 → 20 (desktop), 17 → 19 (phones), all compiled during load. Stills: `cam-lens` (CAM),
  `cam-hero` and `cam-front` (this verification, P5.3).
- **Console, KIT-A.** The plate's glare is gone (hero median 98 → 47); satin side walls with a crisp chamfer; fine
  brass fader caps (no wood grain), no glowing bars under the plate, dark jack bores, bead-blast slider blocks; the
  board's solder mask is satin (roughness 0.35 → 0.5). Moving-frame aliasing (1 sample against 12): knobs 7.3 → 3.8% at
  the hero, 14.5 → 4.2% at the hold; board 2.1 → 2.1%.
- **Headphones, KIT-A.** Grained leather, a real driver (pleated film, copper coil, vented basket, a satin dust cap),
  neutral caps, clean band ends and yokes; the one cap screw that crossed the bronze ring now clears it at every key. The
  exploded still matches the live device at the hold within 0.6 px (`kit.html`, commit 6cd6c45; it was 6.6% smaller).
- **Microphone, KIT-B.** Darker internals (median 123 → 110, grille 164 → 125), the yoke turned 65° so its black strap
  faces the view (choreography change, for the director's sign-off), a legible CM inlay, a transformer with leads; the
  magnet face is a 1.0 mm dome with 10-bit normals (no facets at 3x) at roughness 0.27, so it stays lit when the hold is
  dragged up 15–18° (face median 12 → 81). Grille sparkle in moving frames 11.5 → 9.4.
- **Phone, KIT-B.** The screen is lit with our Creators painting under a Creative Motley status line (display median
  17 → 81); no carbon-fibre moiré on the panel; the board's lids keep their champagne at every drag angle (a wide low
  card: mid-explode lid median 71 → 168, dragged up 15° 108 → 193); board glitter at 3x 3.1 → 1.4; a satin sheen on the
  battery pouch; dark blue glass over the lenses; the hero fills 0.72 of its slot (was 0.82), as the family.

## P5.3 What this verification changed
- **Lazy JS back under phase 4.** `src/gl/lib/kit3d.js`: the console's horizon band (`envBand`, KIT-A) used
  `THREE.CylinderGeometry`, which alone added 0.55 KB gzip to `three.core`; it is now an open 64-sided tube built in place
  (the same vertices and triangles). Console frames at the orbit (p 0.30) and the hold (p 1.0), 4 samples, before and
  after: pixel-identical (`verify/cyl/`). Lazy JS 215.77 → 215.28 KB (phase 4: 215.47).
- **The microphone's still framing** (`src/partials/kit.html`, KIT-B's diff): `data-td-frame` 1.682 → 1.649,
  `-tall` 1.636 → 1.606, `data-td-pbox` 0.232 / 0.768 → 0.227 / 0.773, to the re-rendered exploded still. Tier 0: the
  six markers land on their parts.
- **The homepage's camera stills** `cam-hero` and `cam-front` (.webp and .avif, `public/assets/scenes/hero/`, and
  `cam-stills.json`): CAM's drop-ins (same pose, size and placement metadata; only the lens glass differs), so tier 0,
  reduced motion and the first paint show the new glass.
- **Labs (no shared file changed).** `.lab/kit3d/kit3d.js` and `.lab/kit3d/kit3d_devices.js` copied from the site;
  `.lab/kit3d/{mic,phone}/kit3d.js` rebuilt (`syncrt.sh`); `.lab/kit3d/INTEGRATION.md` "Known limits" brought up to date.
- **Not merged** (both measured): the microphone's `weaveLOD` runtime proposal (moving-frame grille sparkle 9.3 → 4.8,
  phones 6.0 → 3.2) costs 1.5 KB gzip of lazy JS and turns the settled 1x grille into a flat pale sleeve, the woven mesh
  no longer visible (`verify/weave/grille_crop_2x.jpg`); the phone's `coatCard` / `screenEnvMap` proposals cost 0.16 KB
  and change nothing with the site's config. The director's call on the weave; the code is in `.lab/kit3d/mic/kit3d.js`.

## P5.4 Checks
- **Fact check:** desktop and mobile 485 strings, `--drafts 0` 392: pass. 47 drafted lines await the client (unchanged).
- **Drag and zoom** (production build, drag3d's real input, its idle returns held while reading): every scene turns
  and zooms with the page's own scale at 1 and no console error.

| Scene, 1440 | Turn (mouse) | ctrl+wheel | Double-click | + + / − / reset | Markers on their anchors |
|---|---|---|---|---|---|
| Hero camera | −50° | 3.0× | 2.0× | 2.25 / 1.5 / 1× | (none on the hero) |
| Method | anchors 63 px | 3.0× | 2.0× | 2.25 / 1.5 / 1× | 12 at rest, ≤ 0.1 px at every step |
| Console · mic · headphones · phone | anchors 82 · 103 · 116 · 89 px | 3.0× each | 2.0× each | 2.25 / 1.5 / 1× each | 6 each at rest, ≤ 0.1 px at every step |

  At 390 (`?cam3d=1`): a horizontal swipe turns the hero (−41°), Method and the four Kit devices (anchors 37–48 px); a
  two-finger pinch gives 3.0× on all six; the buttons 2.25 / 1.5 / 1×; double-tap 2× (two CDP taps sent back to back
  landed 272 ms apart; a synthetic pair 60 ms apart too). The first run's taps, spaced by a wait plus SwiftShader's slow
  frames, landed over drag3d's 300 ms window and did not zoom, as designed.
  Phones show the lit row's one marker, on its anchor (0 px). At 3× the markers whose parts leave the viewport hide.
- **The homepage push** at 1440 and 390, forced to s 0 / 0.17 / 0.30 / 0.45 / 0.55 / 0.62 / 0.70 / 0.80 with the real
  DOM beats: no purple arcs (violet share 0% from 0.45 to 0.70 at both widths; the 10% at 0.80 at 1440 is the School of
  Athens' robes through the iris, as before); the three beats are legible: ink over the sky (0.17, 0.45), cream over the
  dark glass (0.62, 0.70); the iris opens onto the painting at 0.80 (`verify/hero/strip_1440.jpg`, `strip_390.jpg`).
- **Tier 0 and reduced motion** (1440, 390): the stills show the new looks (the lit phone screen, the turned yoke, the
  clear screws, the new lens glass), no GLB is fetched, no overflow, no error. Reduced motion walks: CLS 0.
- **GitHub Pages build** (`scripts/build-pages.mjs`, served under `/creativemotley-site/`; 252 root paths rewritten,
  `noindex` on the page): a full desktop read (106 responses) and a full 3D phone read (`?cam3d=1`, 81 responses), no
  failed request, no error; the phone read logs only the stage governor's "the stage is at its floor" warnings, as in
  phase 4.

## P5.5 Remaining, ranked
1. **The microphone's grille sparkles while it moves** (moving-frame difference 9.4 at the Kit's hold against < 2).
   The `weaveLOD` proposal halves it at a visible cost (P5.3); the alternative is a finer weave texture in the GLB.
2. **The camera's iris at 3x** reaches p90 85 against the ≥ 110 asked: the critic rejected the pale blade faces that met
   it; the bright cut edges are too thin to lift the 90th percentile.
3. **Tier 0 only: a jump straight into Method** (a deep link, or a programmatic scroll) shifts Method's copy once when
   its teardown initialises (CLS 0.11 at 1440 for `#method` and for a jump; 0.67 at 390 for a jump, 0 for `#method`).
   It is P4.6 item 2 in the still path; scrolling there gives 0, and at the default tier every deep link measured 0.
   `_teardown` is shared.
4. **The exploded line shrinks toward the column edge when a Kit hold is dragged to large azimuths** (the phone's box
   narrows 335 → 252 px at 390): `kit3d.js`'s fit under `setOffset`.
5. **Smaller:** the console's knob outlines in moving frames (3.8–4.2% against 3%) and its pads (1.2% against 0.9%
   before the glare fix); the headphone driver's residual edge aliasing (2.2% against 1.8%); the microphone's internals
   (median 110 against 70–90) and its magnet's moving-frame sparkle (4.3 against 3.9 before the dome); the console plate's
   back-to-front gradient; PCB texture, bead-blast grain and pad micro-texture at 3x; the console's portrait stills
   (parked in `.lab/kit3d/mixer/stills_tall_p5/`); the camera's lens interior is near-black at s 0.62 (by design, the
   blades still read); on the Kit's holds the zoom buttons sit over the device's lower right end (they show only while it
   is hovered, focused or zoomed).
6. **For the director:** sign off the microphone's yoke turn (choreography); P4.6's open items (deep-link layout before
   the teardown's init, the init's long task, landscape phones, the phone menu trap, the retired film files) stand.

## P5.6 Lab, viewer, sheets
- **Lab drift: none.** `node .lab/cam3d/tosite.mjs` reproduces `src/gl/lib/camera3d.js` byte for byte (69 lab-only
  defaults inlined, 7 leftovers folded); `.lab/kit3d/kit3d.js` and `kit3d_devices.js` equal the site's; the mic and phone
  labs draw with the site's own files (`?rt=lab`: the copies with their proposals, `syncrt.sh --check` passes); all ten
  lab GLBs equal `public/`.
- **The client viewer** is rebuilt into `scratchpad/viewer-kit/out/` (the phase 4 copy kept in `out_p4/`) from a new
  stage, `viewer-kit/stage_p5/`: the camera from `.lab/cam3d`, and the four Kit devices from the site's own
  `kit3d.js` + `kit3d_devices.js` (the old stage ran the lab's older per-device runtimes, so the viewer did not show this
  round's looks), with the ten current GLBs. `viewer.js` 778 → 715 KB (one Kit runtime instead of three); 13.6 MB in all. Not
  published. Smoke test (served locally, 1280 × 800 and 390 × 844 touch): each of the five devices loads and fetches
  only its own GLB (phones the `_mobile` ones); at the hold the part markers show (camera 12, console 6, microphone 10,
  headphones 6, phone 8); a drag turns it (−36°, touch −42°) and the markers follow; ctrl+wheel and a two-finger pinch
  reach 3×; Zoom in, in, out, reset give 1.5 / 2.25 / 1.5 / 1×; Reset view clears the turn; the page's own scale stays 1;
  switching eight times leaves `renderer.info.memory` at the same floor each time (0 geometries, 1 texture, 2 programs);
  no request leaves the page but Google Fonts; the only console error is the local server's missing favicon. Evidence:
  `verify/viewer/`, `verify/memcycle_desk.log`, `verify/vbtn.log`.
- **Sheets:** `qa/shots/v3p5_best.jpg` (the five devices at their best key and at 3x, and the homepage inside the glass);
  the tracks' before/after sheets `qa/shots/v3p5_cam_before_after.jpg`, `v3p5_kitA_before_after.jpg`,
  `v3p5_kitA_fixes.jpg`, `v3p5_kitB_before_after.jpg`.

# Phase 6: copy (verified 2026-10-23)
The client (Olayinka Lawal, 2026-10-23): "so I am the CTO/Co founder of wealthmotley, Gbenga is part of the board. now
for the draft use this https://relaxed-crisp-6fca75.netlify.app/ that was the earlier site. u dont need to use sholz
image or bio just stick to the remaining draft. just think crititcally and make it work on the new site", then "just
make it work". Copy v4 finished the drafts from that earlier site (Content Motley, the business's earlier name; source
S7 in `docs/copy-drafts.md`) with everything about its named lead left out, and set the two role lines from the
client's message (S8). Then this verification, fresh eyes, on a production build and on the GitHub Pages build. The
client summary is `docs/copy-v4.md`; the client sheet `qa/shots/v3p6_copy.jpg` (git-ignored: force-add it to commit).
Evidence: `/tmp/claude-0/-home-user-creativemotley-site/f5fb006b-f00a-5174-8cc3-2633425655d9/scratchpad/copy4/verify/`
(fact checks `fc_*.txt`; the page read top to bottom `read_*.json`; walks `walk/`; captures `shots/`); the builder's own
in `copy4/apply/`, the plan in `copy4/plan/plan.json`.

## P6.1 Source
S7 is the static homepage of the client's repo `contentmotley` (`index.html`, byte-identical to `public/index.html`).
Its figures match the live site (100M+ monthly views, 70+ channels, 13+ with 1M+ subscribers: `index.html:453–461`);
the unfinished Next.js app in the same repo does not (1B+ views, 200+ channels, 120+ films: `src/app/page.tsx:31–47`,
its lead's CV figures) and is not used, nor is `blog.html` (bylined to the lead). Every approved line cites its
`index.html` line in facts.json; the roles cite the client's message (F137, F138).

## P6.2 What a visitor reads now, by chapter (1440 and 390 read the same words)
- **I Storytellers:** "Creative Motley is a creator service provider, not a traditional multi-channel network:
  hands-on strategy, management and monetisation for YouTube channels, on transparent terms. No channel is a line
  item." (DC01, S7 `:1232`), then the reach line (DC03, `:1219`). Both approved: they now show with `?drafts=0` too.
- **II Creators:** "What we run", six rows 01–06 (Channel strategy, Programming, Monetisation, Rights and Content ID,
  Brand deals, Reporting): S7's names, our one-liners, still a draft. SEO and Thumbnails cut. "Monetise your catalogue".
- **III Brands:** "We connect brands and agencies to African creators and IP, and manage everything from brief to
  reporting." (DC31, `:687`, approved), then "How a brief runs" 01–05 (draft; step 05, S7's own two lines, is approved
  but shows only with the drafted list around it).
- **IV Method, VI Process, VII Kit:** unchanged.
- **V Showcase:** card 2 is S7's own featured Omoni Oboli TV video (OQQaDqLCgKg, `:791`), titled "Love in Every Word 2:
  The Wedding" (draft: the title is from search listings; YouTube is blocked here, so not oEmbed-verified).
- **VIII Results:** three counters, 100M+ / 70+ / 13+ (2 + 1 on wide screens, clear of the faces). "16+ years in media"
  is gone: on S7 it is the lead's career length.
- **IX Directors:** "The two people answerable for all of it." Olayinka Lawal, "Co-founder and CTO, WealthMotley";
  Gbenga Sosanya, "Board member". No bio, career or credential for either; the shared line (DC91) and the "Leadership
  experience from" credits are gone (on S7 those five names are the lead's roles one for one, `:541–571`, `:1026–1044`;
  next to the only two names on the page they would read as theirs, and as employers they cannot be reworded into a
  company claim).
- **X Apply:** "For established creators, filmmakers, studios and content owners who already have traction and want to
  build a sustainable business." and "Apply with your channel details. We review each application and, if there is a
  fit, book a discovery call." (DC100, DC101, `:1206`, `:1258`; approved). Every contact stays info@creativemotley.com.

## P6.3 What this verification changed
- `src/partials/brands.html`, `directors.html`, `results.html`: the HTML comments ship in the built page (view-source),
  and three of them described the removed credits and the 16+ figure as the earlier site's lead's CV. Reworded to a
  neutral pointer to `docs/copy-v4.md` (Directors: "never to be set against these two names"). No visible change.
- `docs/facts.json` F106: its note said the site gives no role beyond "Directors"; it now says the role lines are the
  client's own (F137, F138) and nothing else is attached to either name.
- `docs/copy-drafts.md`: DC65's Use column `use` → `alt`, DC66's `optional` → `use` (DC66 is the card on the page; the
  showcase generator takes the "use" pick).
- `docs/copy-v4.md`: it listed the Report step among the lines that "show even with drafts hidden"; it does not (it
  sits inside the drafted brief list). Now said separately.

## P6.4 Checks
- **No trace of the earlier site's lead:** "Sholz", "Laelle", "Aforevo" (any case) in the built HTML, JS, CSS and JSON of
  both builds: none; `src/`, `public/` and `index.html`: none. The credits names and "16+" appear nowhere on the page.
- **Fact check** (production build and Pages build): desktop and mobile 471 strings, `--drafts 0` 389: pass. 38 draft ids
  on the page await the client (47 in phase 5).
- **The page read** (visible text in order, 1440 and 390, with and without drafts): no sentence repeated; no
  `data-draft` on an approved line (DC01, DC03, DC31, DC37, DC100, DC101, F137, F138); `?drafts=0` hides only the
  services, Catalogue channels, the brief list, the Method part lines, the video titles and the Kit run labels, and
  Storytellers and Apply keep their paragraphs.
- **Walks** (production build, 0.2-screen steps): CLS 0, no console error or warning, no failed request, no horizontal
  overflow and no text past the viewport at 1440, 1280, 1024, 1920, 390, 360, 820 × 1180 and 844 × 390, each with WebGL
  and at tier 0; `?drafts=0` at 1440 and 390 the same. The changed blocks, captured at 1440, 1280, 1920, 390, 360 and
  820: nothing clipped or off-screen; the only box overlap (1920, "How a brief runs" over the "01" numeral's line box,
  4 px) is font boxes with no ink touching, unchanged markup.
- **GitHub Pages build** (`scripts/build-pages.mjs`, served under `/creativemotley-site/`; 252 root paths rewritten,
  `noindex` on the page): full reads at 1440 and 390 with WebGL and at tier 0: no failed request, no error, CLS 0;
  fact check in all four modes passes. Showcase generator: `--check` ok, 7 cards.

## P6.5 For the client (short)
1. Is "the board" Creative Motley Ltd's, and is WealthMotley part of it? If the board has others, F105 ("The two people
   answerable for all of it.") changes. Bios, if wanted: 20–25 words each.
2. Does anyone at the company today hold the credits / 16+ years? If so, it returns in that person's bio only.
3. Approve or replace our wording: the six service lines, Catalogue channels, brief steps 01–04, the video titles.
4. Are 24/7 support, the 24–48-hour reply and the results timing still promises? (left out until confirmed)
5. Emmabel TV and Royal Arts TV (on the earlier site, not the live one): add to the Showcase?
6. Card 2's poster tagline ("Two exes. One wedding.") fits the previous film better; keep the new video?
