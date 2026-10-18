# Concept: Creative Motley, Edition I, "The New Pantheon"

**One line:** the Editions architecture, played in Creative Motley's own paintings. Every chapter opens on a painted scene the camera moves through, then settles onto paper where the offer is read.

**Copy rule:** every visible word comes from `docs/facts.json` (F-ids below). A handful of interface labels have no fact ("Chapters", "Menu", "Close", "Skip to content", "Next", "Previous"); they are listed in `docs/ui-strings.json` and are the only exceptions. No new claims, numbers, names or testimonials.

**Look:** the brand tokens and type of the current site (see build-contract.md §Tokens).
- Archivo 600 for giant titles and labels.
- Instrument Serif for decks and editorial heads, with an oversized italic drop cap.
- Ink, umber and gold on the paintings; paper (#E8E3D4) for reading.
- Accent pink (#E0338A) used once per chapter at most.
- Torn-paper edges are the brand's transition and are kept: paper panels arrive with a torn top edge.

## Chrome (always on screen)
- **Top bar.**
  - Left: "Creative Motley" (F01) and a grey "Edition I" (F02), then a **Chapters ▾** dropdown (UI string) listing I–IX.
  - Right: "info@creativemotley.com" (F109, mailto) and an **Apply to join** pill (F108; mailto with the application subject).
  - Theme flips on `data-theme` regions: cream text on paintings, ink on paper. The pill inverts.
- **Side rail (≥1024 px).**
  - Top-left: the edition mark, stacked "The *New* / Pantheon / Edition I" (F04 + F02).
  - Bottom-left: the index, "Storytellers I … Apply IX" (F123–F131). The active chapter is full strength with a dotted leader to its numeral; the rest are at 40%.
  - Under it: "© 2026 Creative Motley Ltd" (F113).
- **Mobile.**
  - Top bar: wordmark, "Edition I", the pill and a **Menu** button.
  - Menu sheet: the I–IX index, the email and the three socials (F114–F116).

## Hero (≈150svh scrubbed, then pinned)
- **Scene `film`:** frames 1→260 of the hero film (the figures and the floating kit; the camera is handed across). At rest it is a depth-parallax diorama of frame 1 with pointer drift.
- **Golden frame, centred.** Thin gold hairline frame over **Da Vinci construction lines** (golden rectangles, a quarter-arc spiral and diagonals) drawn on load. Inside:
  - The edition mark: "The New Pantheon" (F04) with "New" in serif italic.
  - Two serif lines: "Africa’s creators, run like media companies." (F08) and "Turn views into long-term revenue." (F07).
  - The I–IX index.
- **On scroll.** The frame and lines dissolve. The wordmark and the index **fly to the rail** (FLIP; desktop only). Three serif beat lines with drop caps arrive one at a time over the film: F12 → F13 → F14.

## I · Storytellers (`#storytellers`)
- **Scene `film` continues:** frames 260→570 (camera → lens → vortex → the machine draws → the Storytellers painting).
  - **GPU sparks** spiral out of the vortex point and settle as dust.
  - It ends on the Storytellers plate as a depth diorama. Frame 570 is that plate, so the hand-off is seamless.
- **Opener:** "Chapter I" (F19) small label; giant "Storytellers" (F20); serif dek F21 with a drop cap; a stat row of F15–F18.
- **Paper:** the "three ways in" construction diagram.
  - Three blocks, F22, F23 and F24, each split on the dash into name + need.
  - Gold hairlines draw from each block and converge on "One machine" (F25) as you scroll.

## II · Creators (`#creators`)
- **Scene `plate:storytellers`:** the camera pushes in on the left figures (depth dolly), with pointer parallax.
- **Opener:** giant "Creators" (F40); dek F41 + F42.
- **Paper:**
  - Editorial head "Built for serious storytellers." (F39), with a drop cap.
  - **Creators block:** label F40, body F41 F42, boxed link F43 (mailto, creator-network subject).
  - **Notes fan:** production notes as fanned cards F26, F27, F34, F35, tilting in 3D with scroll and pointer.
  - **Command cloud:** F28, F32, F36 scattered with depth parallax. One is a dark highlighted card, with note F33 under it.
  - **Media Owners block:** F44, F45, F46 (mailto, catalogue subject), plus a fan of F30, F31, F37.

## III · Brands (`#brands`)
- **Scene `plate:storytellers`:** the camera pans to the right-hand figure and the neon megaphone.
- **Opener:** giant "Brands" (F47); dek F48.
- **Paper:**
  - **Brands block:** F47, F48, F49 (mailto, brief subject); a notes fan of F38 and F29.
  - **Two XXL photo cards:** "The room" (F50, alt F51) and "The set" (F52, alt F53). Each sits in a painted mat (the plate texture) with pointer tilt.
  - "Leadership experience from" (F54), then F55–F59 as a dense row.

## IV · Method (`#method`)
- **Scene `film:method`:** the 453-frame method film scrubbed over a long pin. The camera crosses the alcove room and the camera body explodes into parts.
  - At rest on frame 1 it is a depth diorama.
  - At the end the dome reveal flows into the next chapter.
- **Opener:** "Chapter IV" (F60); giant "Method" (F61); dek F62.
- No paper: the film is the content.

## V · Showcase (`#showcase`)
- **Scene `posters` (three.js):** the seven posters as curved paper planes on a slow arc, warm key light, paper grain.
  - Scroll turns the arc; the poster at centre faces you squarely.
  - Pointer tilts it.
  - Click or Enter opens a **poster modal**: the large poster plus its name (F64–F70).
- **Opener:** "Chapter V · Showcase" (F63); giant "Showcase" (from F127). Caption follows the active poster: name (from F64–F70) + "01 / 07" (F72 pattern).

## VI · Process (`#process`)
- **Scene `objects` (three.js) on paper:** the seven objects float as cut-outs at different depths with soft contact shadows. A pinned horizontal camera track visits each in turn; the active one turns towards you.
- **Head:** "Chapter VI · Process" (F73); "Seven steps, every time." (F74), drop cap.
- **Per step:**
  - Short: the title + short line (F75/F76, F78/F79, F81/F82, F84/F85, F87/F88, F90/F91, F93/F94) beside the active object.
  - Long: then the **dense two-column grid** (the Editions "more updates" pattern), title | long description: F77, F80, F83, F86, F89, F92, F95.

## VII · Results (`#results`)
- **Scene `plate:results`:** the results film as a video texture on a depth diorama (the watchers on the grass, the TV cycling). The camera drifts in.
- **Opener:** "Chapter VII" (F96); giant "Results" (F97); dek F98.
- **Counters:** four big numerals count up once each as they enter: F99 100M+, F100 70+, F101 13+, F102 16+.
  - Each shows its label.
  - The final figure is laid out from the start so digits never shift.

## VIII · Directors (`#directors`)
- **Scene `plate:umber`:** a dark umber stage with soft gold light and slow dust (shader-only).
- **Opener:** "Chapter VIII" (F103); giant "Directors" (F104); dek F105.
- **Content:**
  - The directors' alpha film (two painted portraits, blinking); webm with alpha, HEVC fallback for Safari.
  - Names F106 and F107 on a serif marquee.

## IX · Apply (`#apply`)
- **Scene `plate:hero` reprise:** the hands reaching across the painting (frame 1), depth diorama, slow push. It bookends the hero.
- **Opener:** giant "Apply" (F131); dek F111; the **Apply to join** pill (F108); "Just drop us a line" (F112); "info@creativemotley.com" (F109).
- **Contact band:** "Contact ✦" (F110) marquee.
- **Stickers you can drag:** Instagram, YouTube and TikTok pills (F114–F116), an IG badge (F117), and an "Email us" badge (F118) with the F119 ring text, all linking to the F120–F122 handles.
- © line F113.

## Motion rules
- Scroll scrubs cameras and films; nothing autoplays except gentle idle drift, the results TV and the directors' blink.
- Every chapter has a single hero moment. Paper is calm: rises, fades, hairlines drawing.
- **Reduced motion:** no smooth scroll, no scrubbing and no particles. Each scene is a still plate and text simply appears.
- **Low GPU or no WebGL:** each opener shows its plate as a CSS still (the Editions FallbackImageScene idea); 3D posters and objects become plain cards.
