# Creative Motley — Edition I, "The New Pantheon"

The creativemotley.com rebuild, after the architecture of Shopify Editions Winter '26. A persistent WebGL stage sits behind the page and changes scene per chapter. Every chapter opens over a painted scene the camera moves through, then settles onto paper where the offer is read. The site uses Creative Motley's own paintings, films, copy and brand. Nothing of Shopify's (code, art, copy) is used; see `docs/reference-study.md`.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/ (static; Vercel config in vercel.json)
npm run preview
```
Useful query flags: `?tier=0` forces the no-WebGL fallback (still plates), and `?tier=1` / `?tier=2` force the light or full stage.

## How it's put together
- `index.html` holds the chrome: top bar, side rail, mobile menu, still plates, the stage canvas and the modal. Chapters are included from `src/partials/*.html` at build time.
- `src/sections/*.js`: one module per chapter (auto-loaded), each importing its own CSS.
- `src/gl/stage.js`: the persistent stage. Sections say which scene they show with `data-scene`. Scenes live in `src/gl/scenes/*.js` (auto-registered).
  - The hero and method films stream as frame sequences into a texture (`src/gl/lib/frameStream.js`).
  - Paintings become depth dioramas (`src/gl/lib/plate.js`), using depth maps computed locally with MiDaS (`scripts/depth.py`).
  - Posters and process objects are real three.js geometry.
- `src/core/*`: Lenis smooth scroll on the GSAP ticker, cached layout, chapter and theme tracking, reveals.
- Every visible string traces to `docs/facts.json`; the only exceptions are the interface labels in `docs/ui-strings.json`. Check with `node scripts/factcheck.mjs` while the dev server runs.

## Assets
`public/assets` is generated from the live site's own files by `python3 -I scripts/prep_assets.py <mirror-of-creativemotley.com>`. Depth maps come from `python3 -I scripts/depth.py <midas_small.onnx> <plate> <out>`.

## Docs
- `docs/reference-study.md`: what the Editions page does and how it's built.
- `docs/concept.md`: chapter by chapter, with copy IDs.
- `docs/build-contract.md`: APIs, rules and the quality bar.
