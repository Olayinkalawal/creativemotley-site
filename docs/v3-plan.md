# Creative Motley v3: lighter, more premium, built on Editions' strengths

The client: "redo the website: take their strengths and start building an even lighter and premium website."

Source of truth for the gaps: the review at https://claude.ai/artifact/JTpy4obdupFrSUwRxQWxVY. Its full text and evidence are in `/home/user/ref-editions/review/report.md` and `/home/user/ref-editions/review/*/notes.md`. Read §2 (their pipeline), §5 (smoothness) and §8 (roadmap) before touching code.

## 1. Targets (measured, not guessed)
| Budget | v2 today | Shopify | **v3 target** |
|---|---|---|---|
| First load, desktop (no scroll) | 7.4 MB (16.6 MB @2×) | ≈2–4 MB | **≤ 1.5 MB** at any DPR |
| First load, phone | 7.4 MB | 1.5–2.1 MB | **≤ 1.0 MB** |
| Full read, desktop | 88–96 MB | ≈22 MB | **≤ 18 MB** |
| Full read, phone | 80 MB | ≈20 MB | **≤ 6 MB** |
| JS on the wire (gzip) | 70 KB + 144 KB lazy | ≈720 KB | **≤ 60 KB + ≤ 160 KB lazy** (drop GSAP) |
| LCP (unthrottled / throttled phone) | 1.1 s / 2.9 s | 5.1 s / 19.4 s | **≤ 1.0 s / ≤ 2.5 s**; never gate copy on WebGL |
| Scroll smoothness (same software-GL method as the review) | 6–13 fps in teardowns | ≈50 | **≥ 50 everywhere**; zero per-frame layout; CLS < 0.01 |
| Page length (desktop / phone) | 58.5 vh / 54 screens | 60 / 66 | **≈ 40 vh**, denser content |
| First chapter title | ≈ 5 screens | ≈ 1 | **≤ 2 screens** |
| Distinct painted worlds | 3 | 13 | **one per chapter** (≥ 9) |
| Words per screen | ≈ 11 | ≈ 75 | **≈ 40–60** (drafts for client approval) |

## 2. Keep (ours is stronger)
- **The film.** Keep it, but deliver it as video and trim it so "Storytellers" lands by about 2 screens.
- **The Showcase poster room:** real three.js, with the modal.
- **The photoreal device look.** Real-time 3D replaces the frame streams only if the camera proof passes. Otherwise use compressed video.
- **The contact ending:** marquee, email and stickers.
- **The torn-paper sheet and the fbm ink-bleed dissolve.**
- **The per-item rail theme.**
- **Fast first paint, with no loading gate.**
- **The reduced-motion and tier-0 completeness.**

## 3. Take from Editions
1. **A real scene per chapter.** Each chapter gets one painted backdrop and, where it earns it, one 3D prop with parallax. The camera is keyed per chapter with several beats and per-channel easing, and runs on a tiny JSON keyframe timeline: our own ~2 KB player, in place of Theatre's ~80 KB.
2. **Scene lifecycle.** Each scene is its own dynamic chunk. Mount a ±1 chapter window and dispose outside it. Load the next chapter's assets when the current one becomes active. Compile at idle with `compileAsync`.
3. **Tiers.**
   - A pixel-budget DPR: longest side 1280/1920/2880, at most 2.
   - A frame-time average steps quality down; the low tier caps at 30 fps.
   - **Phones get the still path:** one portrait-composed painting per chapter at native DPR, with the dissolve and the paper kept. No frame streams and no heavy 3D on phones, except one small hero prop if it holds 60 fps.
4. **Finishing.**
   - Tone mapping (ACES/AgX) for lit 3D only; the photographic plates stay pass-through.
   - Low-res bloom.
   - SMAA or MSAA on desktop.
   - A sketch phase and edge glow in the dissolve.
5. **Life between beats.** A cheap particle layer per chapter (dust, sparks, embers) keyed on the timeline.
6. **Strict typography.**
   - Titles in Archivo 700 at about 190 px desktop and 72 px phone.
   - The dek in Instrument Serif at about 44 px, line height 0.96, tracking −0.04 em.
   - A swash display-script drop cap: Imperial Script (OFL), self-hosted woff2, latin subset.
   - Body and UI at 500/600.
   - At most about 14 style combinations. No "Chapter N" kicker; the rail numbers chapters.
7. **Chrome.**
   - The top bar turns opaque after the hero.
   - Menu rows are 56 px with dividers, plus the grain and lines.
   - The dropdown lists chapters with a tiny scene thumbnail.
   - The modal morphs open with View Transitions.
8. **Watch the work.** XXL video cards (YouTube, lazy: a thumbnail first, the player in a modal only on click). Short muted loops only where they add life.
9. **Responsive media.**
   - Every `<img>` gets srcset/sizes and AVIF, with WebP fallbacks.
   - Video ladders at 480/720/1080 and about 1–1.5 Mb/s.
   - Depth maps as WebP or removed.
10. **SEO and measurement basics.** Canonical, Organization JSON-LD, robots.txt and sitemap.xml. A cookieless one-shot beacon is optional.

## 4. Lighter than Editions (our edge)
- **Textures.** Use AVIF/WebP, not KTX2, unless KTX2 measures lighter for a given texture. That means no ~0.5 MB Basis transcoder. GLB textures go inside the GLB (`EXT_texture_webp`), and geometry uses meshopt (decoder about 20 KB). Measure GPU upload cost per texture and keep it under one frame per chapter change.
- **No React or Theatre.** Vanilla three with tree-shaken imports, Lenis and our keyframe player.
- **No loader gate**, and phones never download desktop assets.

## 5. Chapter blueprint (desktop vh; phones about 0.85×)
| # | Chapter | Scene (desktop) | Phone | Content (★ = drafted copy, client approves) | Length |
|---|---|---|---|---|---|
| — | Hero | Hero painting with the golden frame and lines. A load push-in of about 2 s, never gating copy. Optional 3D prop | portrait still | index, dek | 150 |
| — | Film beat | Trimmed film as a scrubbed video, ending on the Storytellers painting | portrait still + dissolve | the hero beats | 120 |
| I | Storytellers | Storytellers painting, keyed camera | portrait still | opener; three ways, one machine; ★ a short paragraph on who we are | 200 |
| II | Creators | **NEW painting** | portrait | feature block; fan with real episode thumbnails; command cloud with ★ more items; ★ services list | 260 |
| III | Brands | **NEW painting** | portrait | feature block; credits; ★ how a brief runs; a brand video card | 240 |
| IV | Method | Camera, real-time 3D if the proof passes, otherwise video. Orbit, then hand-off, then explode, on black | stills: hero then exploded | the camera spec list with **camera part names**, not the seven steps | 330 |
| V | Showcase | Poster room (keep) | poster carousel | **XXL "watch the work" video cards** (YouTube) | 300 |
| VI | Process | Objects desk (tighter framing) | list | the seven steps, each named once; dense list with long lines | 280 |
| VII | Kit | **One run**: four devices in quick cuts, one orbit, a 2×2 explode or sequential snaps, with the background colour changing per device | stills | part callouts | 450–600 |
| VIII | Results | Results painting | portrait | counters at or below title size | 180 |
| IX | Directors | **NEW painting** or a distinct key, plus the alpha film (lighter encode) | portrait | the two directors, ★ a short bio each | 220 |
| X | Apply | **NEW painting** or a distinct crop/key | portrait | contact ending (keep) | 160 |

## 6. Art pipeline
- **Paintings.**
  - Match the house style: Renaissance oil painting, African creators and modern media kit, warm umber, gold accents. Use the existing plates in `public/assets/plates/` as style references, imported to Higgsfield from their public URLs on creativemotley.com or by `media_import_url`. Uploads to upload.higgsfield.ai are blocked.
  - Each new painting needs a distinct colour key per chapter, negative space for the giant title (left third), and no text or logos.
  - Produce a 2560×1440 master plus a portrait 1170×2532 recomposition: a separate composition, not a crop. Use outpaint/reframe or generate portrait natively from the same brief.
- **Encodes.**
  - Desktop backdrop: AVIF and WebP at 2048 and 2880 px.
  - Phone backdrop: AVIF and WebP at 1170×2532 (DPR 3), with an 828-px variant.
  - Generate with a script in `scripts/art.py`, which also writes `public/assets/scenes/<chapter>/manifest.json`.
- **3D props (phase 2).**
  - Hunyuan3D v3 from an isolated prop image (about 19 credits each).
  - Optimise with the same pipeline as the camera proof: weld, simplify, 2048 WebP textures, meshopt. Target ≤ 1 MB.
- **Budget.** Higgsfield ≤ 500 credits for v3 in total (37 already spent on the camera models). Log every spend in `docs/art-log.md`.

## 7. Engine v3 (src/gl, src/core)
- `stage.js`:
  - registry of scene *factories* (dynamic import per scene);
  - a ±1 window around the active chapter;
  - dispose on leave;
  - preload on activate or on rail/dropdown hover;
  - `compileAsync` at idle;
  - a dirty-check render loop that stops after about 300 ms idle;
  - the pixel-budget DPR and FPS governor.
- `timeline.js`:
  - JSON keyframes per chapter: channels, each `[{t, v, ease:[x1,y1,x2,y2]}]`;
  - t is in viewport units of the chapter's pass, the same as `pe`;
  - helpers for camera (zoom, focus x/y, tilt), prop transforms, bloom and particles.
- `paintScene.js`: a painted backdrop plane plus an optional GLB prop, PMREM env from RoomEnvironment (lit props only), and keyed camera parallax between them. Replaces depth-map parallax; use the depth map only if no prop exists.
- `video.js`: a scrubbed-video texture for the film and any device sequence kept as video.
  - H.264 at keyint 4–8 for all browsers, plus AV1 where `canPlayType` says so.
  - Seek via `currentTime` with `requestVideoFrameCallback`, or WebCodecs if seeking measures too slow.
  - Measure seek latency at 1×/2× speed scrolling.
- `post.js`: keep the dissolve and add the sketch phase and edge glow. Use HalfFloat targets only where bloom is on.
- **Phone path** (`env.js`): touch and narrow screens get `TIER_STILL`. The stage runs only the still-plate shader (portrait textures, dissolve, paper); no frame streams.
- **Scroll.** Lenis with trackpad detection (more than 50 wheel events per second gives a 0.15 s duration); the mouse wheel stays at a 0.85 s expo-out feel. Drop GSAP and ScrollTrigger and drive Lenis from our own rAF.
- **Smoothness rules:**
  - no `filter`/`backdrop-filter`/blurred SVG animated per frame;
  - transforms and opacity only;
  - read rects once per frame;
  - write styles only when they change;
  - no canvas reallocation mid-scene;
  - no Blob cache beyond a ±24-frame window.

## 8. Type and chrome (src/styles, src/ui, index.html chrome, public/fonts)
- **Tokens.** In `tokens.css`, define the scale: title, dek, head, lead, body, label, small and numeral. Each has a size, line height, tracking and weight, with only those combinations used.
- **Drop cap.** Self-host Imperial Script (latin woff2 via the Google Fonts CSS API) as `--script`. `.dc` uses it at about 2.6× the dek size.
- **Top bar.** Opaque ink after the hero (`html.scrolled`), with a 1 px hairline. It stays transparent over the hero only.
- **Menu.** 56 px rows with dividers; grain plus faint golden lines in the sheet.
- **Modal.** View Transitions morph from the clicked card, with a fallback fade.

## 9. Copy and video (docs only in phase 1)
- **Copy drafts.**
  - Draft fuller copy per chapter in `docs/copy-drafts.md`. Sources: the live site creativemotley.com (and its pages), public interviews or articles about Creative Motley and its directors, and the existing facts.
  - Every drafted string gets `kind: "draft"` in facts.json with its source or reasoning, so the fact check flags drafts until the client approves them.
  - No invented numbers, clients or quotes. Services and process descriptions can be paraphrased from their own site.
- **Videos.** In `docs/videos.json`, list for each showcased creator (Layi Wasabi, Omoni Oboli TV, Isbae U, Broda Shaggi, Diary of a Naija Girl, Kie Kie, Kunle Afolayan) one or two public YouTube videos: id, title, channel, and why it fits. Verify each id exists, via oEmbed or the page title.

## 10. Phases
1. **Foundations (now, in parallel).** Engine core + phone path + smoothness (A); art: new paintings + portrait set + encodes (B); copy drafts + video research (C); type system + chrome (D).
2. **Chapters.** Rebuild each chapter on the new engine with its painting, keys, content and video cards. Restructure Kit into one run, and Method to about 330 vh.
3. **Devices.** Real-time 3D for all five if the camera proof passes the client's side-by-side; otherwise video-encoded sequences with the ±1 window.
4. **Critique and verify.** Fresh desktop, phone and perf critics, fixes, then a verifier. Then republish the preview.
