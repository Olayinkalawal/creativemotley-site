# Reference study: Shopify Editions Winter '26 ("The Renaissance Edition")

Studied on 18 Oct 2026 from https://www.shopify.com/editions/winter2026: desktop 1440×900 scroll capture (every half viewport), mobile 390×844 at 2×, the DOM outline, and the shipped JS bundles. The captures live outside this repo (`/home/user/ref-editions/`) because they are Shopify's material. Nothing from the page (code, art, copy, models) is used in this site. What we take is **architecture, choreography and interaction patterns**.

## What it is built with
- **Hydrogen/Remix (React) on Oxygen**, Tailwind classes.
- **One persistent WebGL canvas behind the whole page** (`Background` chunk: three.js + React Three Fiber + `postprocessing` with Bloom). Each chapter mounts its own scene into it (`HeroScene`, `SidekickScene` … `DeveloperScene`).
- **Theatre.js** drives every scene. Each chapter has a Theatre "sheet" (camera, effects, particles, butterflies) whose sequence position is mapped from that section's scroll progress (`(sectionHeight + vh) / vh` scaling). So scrolling *is* the camera move.
- **Assets**: GLB models (Draco/Meshopt compressed), KTX2 textures, PMREM environment maps, an instanced "butterflies" particle system, a "coin rain" physics moment.
- **detect-gpu** for tiering. Low tiers get `FallbackImageScene`: a still image of each scene drawn by a shader (we captured with WebGL off, which is exactly this fallback).
- **Rive** for small UI animations inside feature cards; **Lenis** for smooth scroll (`data-lenis-prevent` on overlays).

## Page architecture (top to bottom)
1. **Fixed top bar.** Left: logo, "Shopify Editions", grey "Winter '26", an "Editions ▾" dropdown and a search button. Right: a text link and a pill CTA. Its theme flips per region (`data-nav-theme` dark/light on sections); the pill inverts (white on painting, black on paper).
2. **Hero (150svh).** Full-bleed Renaissance painting with modern props, rendered as a 3D diorama. A thin **golden-ratio frame** sits dead centre over **Da Vinci construction lines** (golden rectangles, arcs, diagonals; hairlines drawn on load). The frame holds the edition wordmark ("The Ren*ai*ssance Edition", with one syllable swapped into an italic serif), a two-line serif dek, and the **chapter index**: twelve chapter names in tight bold sans with roman numerals right-aligned in a serif.
3. **The index leaves the frame.** On scroll the frame dissolves. The wordmark docks top-left and the index docks bottom-left as a **persistent side rail** (desktop). In the rail the active chapter is full ink with a **dotted leader** running to its numeral; the others are dimmed. Legal sits under it. The rail colour flips with the theme.
4. **Chapter opener (≈140svh), twelve times.** A new full-bleed painted scene. A **giant sans chapter title** (≈150 px, tight tracking) rises through the frame. A **serif dek with a swash drop cap** follows. The camera keeps moving through the scene as you read.
5. **Chapter content (right 4/5 column).** A **paper panel** (#E3E1D6-ish, faint texture) slides over the scene. It holds:
   - **Feature blocks:** a serif heading with a swash drop cap ("Insights, proactively delivered"), a small bold sans label, two or three lines of sans body, and a boxed "Read help doc ↗" link.
   - **XXL visuals:** full-width video cards and UI shots set *inside crops of the painting*, so product UI sits on painted texture.
   - **Card fan:** six product cards fanned in 3D, tilted and overlapping, drifting with scroll.
   - **Command cloud:** slash-commands scattered in serif at several sizes and depths with parallax; one is highlighted as a dark card ("/brand-image").
   - **Dense grid:** two columns of "title | grey description" pairs for the smaller updates.
6. Content panels alternate light and dark. Some cards carry their own `data-nav-theme`, so the chrome follows the card under it.
7. **Overlays:** a product modal, a video modal (full-screen, grey backdrop) and a merch drawer.
8. **Mobile:** no rail. The top bar is logo, edition and pill CTA plus a hamburger. The hero keeps the framed index full height over the painting. Openers are a full-bleed painting with the title and dek near the top. Content is a single column; the dense grid becomes one column.

## Interaction and motion vocabulary
- Scroll scrubs the camera (no autoplay). The paintings feel inhabited: slow drift, depth parallax, particles (butterflies) and light.
- Chapter change: the scene crossfades under the paper. The rail's active item and dotted leader move. The nav theme flips exactly at panel edges.
- Text enters with soft rises and fades. Large type is never animated per letter; it moves as a block.
- Cards respond to the pointer with slight 3D tilt; links have boxed hover states.
- Restraint: one hero moment per chapter, then calm reading space on paper.

## How Creative Motley maps onto it
Creative Motley's current site already shares this DNA: painted Renaissance art with modern kit, Archivo plus Instrument Serif, drop caps, a I–IX chapter rail, and paper sections. The rebuild moves it onto the Editions *architecture*:
- One persistent WebGL stage that changes scene per chapter, with the camera driven by scroll.
- The framed hero index that docks into a side rail.
- Giant chapter openers over painted scenes, then paper content columns with feature blocks, card fans, a command cloud and dense grids.
- Theme-flipping chrome, and modals.

Where Shopify has GLB models, we have **painted plates, two pre-rendered camera films (hero 570 frames, method 453 frames), alpha video and cut-out objects**. Their 3D is rebuilt as:
- depth-parallax dioramas (per-plate depth maps computed locally with MiDaS small)
- scroll-scrubbed film textures
- GPU particles
- real three.js geometry where we have separable art: the posters and the process objects
