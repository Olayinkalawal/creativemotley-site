# Handoff: where the rebuild stands (branch `editions-rebuild`)

## Done
- **Shell:** the persistent WebGL stage, the top bar, the side rail, the hero with its golden frame and Da Vinci lines, and the mobile menu.
- **All nine chapters are built**, and every chapter except Storytellers and Apply has been through at least one fresh-critic + fix round:
  - I Storytellers: hero film, stats, three-ways diagram.
  - II Creators: notes fan, command cloud, Media Owners.
  - III Brands: photo cards, leadership row.
  - IV Method: painted room → camera teardown.
  - V Showcase: WebGL poster arc + modal.
  - VI Process: object track, Sound teardowns, long-description grid.
  - VII Results: painting → phone teardown with the four stats.
  - VIII Directors: alpha film + names line.
  - IX Apply: hands reprise, Contact marquee, draggable stickers.
- **Photoreal teardowns** (Editions exploded-hub pattern), five of them:
  - camera (one-to-one with the brand camera, unbranded) in Method
  - podcast console in Creators
  - microphone + headphones in Process (Sound)
  - phone in Results

  Frames are in `public/assets/teardown/<name>/{lg,sm}`. The shared block is `src/sections/_teardown.{js,css}` and the scene is `src/gl/scenes/teardowns.js`. Framing per device is set by `data-td-frame` (desktop) and `data-td-frame-tall` (portrait), as "zoom shiftX shiftY".
- **Copy:** every visible string traces to `docs/facts.json`. `node scripts/factcheck.mjs` passes on desktop and mobile.

## Left to do
1. **Fresh critic + fix rounds** on the parts nobody has reviewed yet:
   - Storytellers and Apply.
   - All five teardowns.
   - The seams between chapters, especially Method → Showcase, Process → Sound teardowns → Results, and Results → Directors.
2. **Whole-site audit:**
   - Desktop 1440×900, 1280, 1024; mobile 390×844 and 360.
   - `?tier=0` (no WebGL) and reduced motion.
   - Keyboard and contrast.
   - Load weight: the teardown frames total about 63 MB, but they are fetched in a window around the playhead.
3. **Known nits:**
   - The Directors film on iPhone is 15 MB (it needs a smaller HEVC-with-alpha encode, made on a Mac with `hevc_videotoolbox`).
   - Phones get 1100 px hero frames.
   - The Sound teardown headings repeat the Process step lines word for word.
4. **Publish the preview:** `node scripts/build-pages.mjs`, then push `dist-pages` to the `gh-pages` branch. Repo Settings → Pages must be set to deploy from `gh-pages` / root. Production target: Vercel (`vercel.json`).

## Running it locally
```bash
npm install
npm run dev                      # http://localhost:5173  (?tier=0 forces the no-WebGL fallback)
npm i -D playwright && npx playwright install chromium   # for the QA scripts
node scripts/shots.mjs --url http://localhost:5173/ --out qa/shots/x --at "#method,#instrument+0.5" [--mode mobile] [--tier 0]
node scripts/factcheck.mjs --url http://localhost:5173/
```
Read `docs/build-contract.md` first: it covers file ownership, the stage API, the copy rule and the quality bar.
