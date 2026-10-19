# Art log: v3 chapter paintings, portrait set, encodes (Track B)

Owner: Track B. Budget for this track: at most 170 Higgsfield credits (inside the v3 total of 500, plan §6).
Every spend is logged below with its job id. Balance is checked before and after each batch.

## Style references (imported from the live site, no uploads)
| Ref | Live URL | Higgsfield media id |
|---|---|---|
| Hero painting (film frame 1) | https://creativemotley.com/frames/f_0001.webp | `70d440b1-109c-40f9-9860-076f4986a3ae` |
| Storytellers painting (film frame 570) | https://creativemotley.com/frames/f_0570.webp | `2a6bfdb5-4d4b-4f6a-bfda-bbfaf7f96067` |
| Method rotunda (frame 1) | https://creativemotley.com/method/m_0001.jpg | `0251804d-2731-4ab8-9bc5-b53ce9d8b201` |
| Social card painting | https://creativemotley.com/og.jpg | `e2e5e653-f36b-41b9-bf13-46ff6683b0ea` |

The Results painting is not served as a still on the live site; it exists only inside `results/results_stage.mp4`
(with third-party thumbnails cycling on the TV). Its portrait is therefore generated natively from the same brief,
which plan §6 allows ("or generate portrait natively from the same brief").

House style, from the four references: museum-grade Renaissance/Baroque oil on canvas, visible brushwork and fine
craquelure, chiaroscuro, warm umber shadows and gold accents. Young African creators in flowing Renaissance silks
worn with modern details (sport sunglasses, sneakers, gold chains), and modern media kit (camera, microphones,
headphones, ring light, mixer) painted in the same oil technique. Occasional neon-magenta props.

Colour keys already taken: Hero = sky blue + coral + umber; Storytellers = night black + magenta + teal line work;
Method = stone umber + candle; Results = Arcadian blue-green sky + grass. Every new painting below takes a key that
none of these use.

## Rules for every painting
- No text, letters, numbers, logos, brand marks, watermarks or signatures. Screens show abstract light only.
- The left third is calm negative space (darker or softer, low detail) for the giant title. Subjects sit in the
  right two-thirds.
- Phone versions are separate vertical compositions, not crops: the subject is re-staged large in the lower part of
  the frame, with a calm zone at the top for the title. They ship as the whole 9:16 frame (1170 x 2080 and
  828 x 1472), not 1170 x 2532: see "Phone aspect" below.
- Model: Nano Banana Pro at 4K (16:9 is 5504 x 3072; 9:16 is 3072 x 5504), 4 credits each.

## Briefs (grounded in the chapter copy, docs/facts.json)

### II Creators: "The Atelier" (key: verdigris green + candle gold)
Copy it serves: "Move from creator to media company." (F41), "Systems, not chaos." (F42), "Creators: audience,
no system" (F22), and the command cloud of retention checks, thumbnail tests and upload calendars (F26 to F37).
Picture: a candlelit Renaissance atelier with verdigris-green plaster walls. A young African woman creator works at a
long oak table: an open laptop glowing with abstract timeline bars, a mirrorless camera on a small tripod, a ring
light's soft halo, a podcast microphone on an arm. Behind her, a neat grid of small framed painted vignettes (her
thumbnails, no text) and pinned sketches: order, a system. A young man in a mustard doublet and white sneakers leans
in, pointing at the grid. Window light from the right; the left third falls into deep green shadow and a drape.

### III Brands: "The Commission" (key: oxblood crimson damask + gold)
Copy it serves: "Africa's most trusted creators. One contract." (F48), "Brands: budget, no voice" (F24),
"Brief our team" (F49), "Brand brief received, Lagos" (F38).
Picture: after Holbein's The Ambassadors. A grand hall hung with oxblood-crimson damask. At the right, a poised
African woman patron in a structured crimson-and-gold gown holds out a rolled brief tied with a gold ribbon and a
blank wax seal. Centre-right, a young African creator in cream silk and a dark velvet jacket reaches to take it.
Between them, a draped two-tier table: a cinema camera, a phone on a small gimbal, a shotgun microphone, a brass
globe turned to Africa, a fountain pen on a blank contract sheet. A tall arched window shows a lagoon city at
golden hour. The left third is crimson drapery falling into shadow.

### IX Directors: "The Empty Set" (key: midnight indigo + tungsten gold)
Copy it serves: "The two people answerable for all of it." (F105). The directors' own faces come from the alpha film
(two painted portraits), so the painting shows no people and never stands in for them.
Picture: a vast dark Renaissance theatre stage at night, deep indigo and ultramarine. One warm tungsten pool of light
on the wooden floor centre-right. Two empty director's chairs with blank canvas backs side by side at the right,
angled toward the light; a cinema camera on a wooden tripod; a megaphone and a blank clapperboard on a stool. Heavy
indigo velvet curtains, a coffered ceiling lost in shadow, dust in the beam. Calm, reverent. The centre stays open
because the portraits rise there; the left third is dark.

### X Apply: "The Open Gate" (key: dawn rose + apricot + pale gold)
Copy it serves: "Apply to join" (F108), "We turn channels into media companies." (F111), "Just drop us a line"
(F112). This is the one light, open painting at the end of the read.
Picture: a carved sandstone gateway at dawn, its heavy doors swung wide onto a luminous river valley and a distant
modern African city skyline under a rose and apricot sky with gold clouds. On the threshold, a young African creator
in a flowing rose cloak and white sneakers, a camera on a shoulder rig, looks back over her shoulder as if inviting
the viewer through. A few blank paper sheets drift in the warm air like letters. The left third is soft dawn sky and
pale stone, calm.

### Portrait set (phones, about 1170 x 2532)
| Chapter | Source | Vertical staging |
|---|---|---|
| hero | ref f_0001 | woman floats upper right reaching down, man reclines lower left reaching up, the camera between their hands; calm sky upper left for the index and dek |
| storytellers | ref f_0570 | the three figures, line-drawn crowd and magenta props stacked in the lower 60%; starfield above for the title |
| creators | chosen master | creator and table large in the lower 60%; dark green wall above |
| brands | chosen master | patron, creator and the brief in the lower 60%; crimson damask above |
| results | brief only (see note above) | three creators lounging on grass watching a TV on a plinth, lower half; tall cumulus sky above |
| directors | chosen master | two empty chairs and the pool of light low; indigo dark above |
| apply | chosen master | the gateway and the creator low; rose sky above |

## Spend ledger
| When (UTC) | What | Model / tool | Job ids | Credits | Balance after |
|---|---|---|---|---|---|
| 2026-10-19 14:05 | Balance before Track B | | | | 631.03 |
| 2026-10-19 14:12 | Imported 4 live-site paintings as references | media_import_url | see table above | 0 | 631.03 |
| 2026-10-19 14:15 | Round 1: 2 candidates each for Creators, Brands, Directors, Apply (16:9) + hero and Storytellers portraits (9:16) | Nano Banana Pro 4K | creators `8bc87c5a` `d1253c5c`; brands `4ce5fe76` `f91298aa`; directors `84f73476` `e37d510f`; apply `ebe11b6c` `ece7f93b`; hero-p `e51061e5` `f5b19950`; storytellers-p `b989c120` `89884a5e` | 48 | 583.03 |
| 2026-10-19 14:20 | Round 2: retakes of Directors and Apply (round 1 read as illustration, not oil); Results portrait from the brief; Creators and Brands portraits | Nano Banana Pro 4K | directors `0c9f02b1` `161c8667`; apply `e9405529` `4b22d074`; results-p `2dd9e92d` `45b71cda`; creators-p `9191240c` `67648a82`; brands-p `9eac530d` `1f54ecf8` | 40 | 543.03 |
| 2026-10-19 14:20 | 4K upscales of the live hero and Storytellers frames (1920 px sources) | Bytedance upscale 4K | hero `3845158a`; storytellers `0f6104cd` | 4 | 539.03 |
| 2026-10-19 14:23 | Directors and Apply portraits | Nano Banana Pro 4K | directors-p `87ef8956` `42160efe`; apply-p `da6a82b3` `397c34ba` | 16 | 523.03 |
| 2026-10-19 14:24 | Results portrait retake (round 2 put the TV against the frame edge) | Nano Banana Pro 4K | results-p `141b5c72` `ace05070` | 8 | 515.03 |
| | **Track B total** | | 28 generations + 2 upscales | **116 of 170** | 515.03 |

Balance checks: 631.03 before; 539.03 after the first 92; 515.03 at the end. Every spend from 14:15 to 14:24 in the
account's transaction list is one of the jobs above (no other track spent in that window).

## Picks (looked at full size, details at 1:1)
| Chapter | Desktop master | Why | Phone master | Why |
|---|---|---|---|---|
| hero | live f_0001, 4K upscale `3845158a` | the client's painting; the upscale is clean at 1:1 (faces, kit, cloud edges) | `e51061e5` | the woman top right, the man bottom left, the camera between their hands; `f5b19950` cropped her at the edge |
| storytellers | live f_0570, 4K upscale `0f6104cd` | as above | `89884a5e` | cleaner night above than `b989c120` (no dark foliage at the left) |
| creators | `8bc87c5a` | the drape carries the painting into the left third; `d1253c5c` left a hard flat black panel with a seam | `9191240c` | the man stays whole in frame |
| brands | `4ce5fe76` | deeper light and a quieter left third than `f91298aa` | `1f54ecf8` | larger figures than `9eac530d` |
| results | the existing 1920 px plate | no other master exists | `141b5c72` | the TV and all three friends inside the frame; round 2 had the TV against the edge |
| directors | `0c9f02b1` | true indigo key with gilt and craquelure; round 1 was umber like Method (`84f73476`) or flat illustration (`e37d510f`) | `87ef8956` | richer gilt pilasters than `42160efe` |
| apply | `4b22d074` | Old Master finish, Corinthian gate, the calmest left third; round 1 (`ebe11b6c`, `ece7f93b`) read as a storybook | `397c34ba` | the arch and both pilasters whole |

Rejected candidates stay in the Higgsfield library under the job ids above.

## Phone aspect: 9:16 rather than 1170 x 2532
1170 x 2532 is the whole iPhone screen, status bar included; a web page never gets it. The canvas a phone browser
shows is 0.49 to 0.59 wide-per-tall (Safari with its bars about 390 x 664, bars collapsed about 0.52, Chrome Android
about 0.49 to 0.52). A 0.462 file would be cut top and bottom on most phones, eating the title zone or the subject.
A 9:16 (0.5625) file is cover-fit with at most a few percent off the sides, and on the tallest screens the engine
trims the sides around `phoneFocus`. The widths are the requested 1170 and 828 px (DPR 3 and 2 at about 390 px).

## Known limits
- **Results desktop** stops at 2048 px (from the 1920 px plate, a 1.07x upscale); there is no 2880. The live site
  serves that painting only inside `results/results_stage.mp4`, so it cannot be imported for an AI upscale, and
  uploads are blocked. Its TV shows a real thumbnail with lettering (Omoni Oboli TV, fact F135: plate art). The
  Results portrait is a new painting from the same brief, with an abstract screen.
- **Results and hero desktop** were composed before the left-third rule. Hero keeps the left third (dark trees and
  the man; light ink measures 9:1 at the mean); Results names the sky above the figures as its title zone
  (`titleSide: "top"`).
- **Apply** is the one light painting: its title zone needs dark ink (or a scrim), and `titleInk` says so.
- **Kit backdrop** (optional): not made. Kit changes its background colour per device, so a painting would be
  covered most of the time.

## Encodes (scripts/art.py, final run)
Sizes in KB. AVIF: libaom via Pillow, speed 6, 4:2:0, tune=ssim, q72 ceiling; WebP: q86 ceiling, method 6,
sharp YUV. Every file sits under its budget at the ceiling except three 828 px phone AVIFs, held to 100 KB:
hero q67, Storytellers q65, Results q69. All 82 files (encodes, thumbnails, placeholders) decode in Chromium at their stated size,
and AVIF and WebP means match within 1 code value.

| Chapter | desktop AVIF 2048 / 2880 | desktop WebP 2048 / 2880 | phone AVIF 1170 / 828 | phone WebP 1170 / 828 | title ink (desktop / phone), mean and worst-10% contrast |
|---|---|---|---|---|---|
| hero | 152 / 224 | 190 / 284 | 173 / 97 | 211 / 130 | light 9.2, 3.6 / dark 7.8, **1.9** |
| storytellers | 179 / 271 | 206 / 307 | 169 / 97 | 191 / 123 | light 20.5, 20.1 / light 20.2, 19.7 |
| creators | 107 / 161 | 149 / 240 | 111 / 72 | 152 / 93 | light 19.2, 18.1 / light 13.0, 11.0 |
| brands | 129 / 192 | 179 / 272 | 133 / 87 | 182 / 113 | light 19.8, 18.4 / light 19.0, 17.3 |
| results | 184 / none | 216 / none | 162 / 99 | 212 / 136 | light 5.3, 3.6 / dark 6.1, 4.5 |
| directors | 113 / 180 | 156 / 245 | 121 / 78 | 173 / 107 | light 20.6, 20.3 / light 11.7, **2.9** |
| apply | 161 / 274 | 213 / 376 | 139 / 85 | 192 / 114 | dark 10.3, 9.5 / dark 10.5, 9.6 |

Targets: desktop 2048 AVIF at most 250 KB (largest 184), phone 1170 AVIF at most 180 KB (largest 173). The two
bold worst-decile figures mean the hero phone title and the Directors phone title need the stage's scrim: the
hero's clouds vary from bright to mid, and the Directors light shaft runs through the top of the frame.

Banding check: the Apply dawn sky and the Directors indigo dark were inspected at 1:1 and with their levels
stretched 3x and 6x. The sky shows no bands (the canvas weave and craquelure carry it). The indigo dark shows faint
AV1 block patches only under the 6x stretch, at 2048 and in every setting tried (q80, aq-mode 1, 4:4:4, and a
10-bit ffmpeg encode), so the q72 ceiling stays.

Before and after (same measure on both sides: the mean absolute Laplacian, a proxy for edge detail):
- Desktop at 2880 px: hero 2.61 (v2 1920 plate, upscaled) to 3.58 (v3, from the 4K upscale); Storytellers 2.94 to 4.92.
- Phone at 1170 x 2080: v2 cropped the 1920 x 1080 landscape plate into portrait, at 0.52 source px per device px.
  Detail went 1.30 to 6.21 (hero), 1.81 to 6.48 (Storytellers) and 2.14 to 5.64 (Results). v3 supplies 1.0 source
  px per device px on a 390 px wide screen at DPR 3, from a composition made for the portrait frame.
- Weight per scene: v2 plate + depth map = 113 + 309 KB (hero) to 179 + 206 KB (results). v3 desktop AVIF 2048 is
  107 to 184 KB with no depth map; the phone AVIF 1170 is 111 to 173 KB.

Also written: `thumb-320.{avif,webp}` per chapter (5 to 9 KB, for the menu and rail thumbnails, plan section 3.7),
a 32 x 18 and a 12 x 26 WebP placeholder as data URIs in each manifest, and `public/assets/scenes/index.json`
(every chapter's manifest path, key, placeholder and thumbnail). Contact sheet: `qa/shots/v3-art-sheet.jpg`.

Re-running: `python3 scripts/art.py` downloads the masters from d8j0ntlcm91z4.cloudfront.net into
`$ART_CACHE` (default `~/.cache/cm-art`) and re-encodes; `--sheet` rebuilds only the sheet.

## Phase 1 integration (no credits spent)
- Depth maps for the four new paintings, so the desktop plates keep the v2 pointer parallax and depth-weighted push:
  `public/assets/scenes/{creators,brands,directors,apply}/depth.webp` (MiDaS small, local ONNX:
  `python3 -I scripts/depth.py /home/user/models/midas_small.onnx public/assets/scenes/<ch>/desktop-2048.webp
  <out>.png 3`, then 1920 x 1080 greyscale WebP q85, 10-11 KB each). Not in `scripts/art.py`; re-run by hand if a
  painting changes.
- The v2 depth maps re-encoded as greyscale WebP q85 next to the PNGs (`public/assets/plates/*-depth.webp`,
  `public/assets/teardown/*/depth.webp`): 200-310 KB to 10-15 KB, mean error 0.4 of 255 (max 14). The engine reads
  the WebP; the PNGs are unused.
- Poster cards: 640 and 960 px WebP q80 variants (`public/assets/posters/*-{640,960}.webp`) for the phone carousel's
  srcset; WebGL and the modal keep the 1200 px files.

## Masters, modernised (client request)
**Request (2026-10-19):** "the pictures u did, or used — i would prefer renaissance popular ones but make them modern."
So every chapter painting after the hero becomes a famous Renaissance masterpiece, recognisable at a glance, re-staged
with young Black African creators and modern media kit and painted as a museum oil. The hero (a modern Creation of
Adam) stays. Everything below is **staged, not live**: masters and encodes are in the session scratchpad
(`.../scratchpad/masters/<chapter>/` and `.../scratchpad/masters/encoded/<chapter>/`), and
`.../scratchpad/masters/swap-plan.md` lists what the director changes to put them live.

### Chapter → masterpiece
| Chapter | Masterpiece | Desktop pick (16:9) | Phone pick (9:16) |
|---|---|---|---|
| I Storytellers | Raphael, *The School of Athens* (1509-11) | `storytellers/d7_r3.png`: job `cbee6a1a` + local retouch | `storytellers/p1_r3.png`: job `d32e86f3` + local retouch |
| II Creators | Leonardo, *Mona Lisa* (c. 1503-19) | `creators/d7_r3.png`: job `506535aa` + local retouch | `creators/p1_r3.png`: job `5f92e37c` + local retouch |
| III Brands | Van Eyck, *The Arnolfini Portrait* (1434) | `brands/d5_r3.png`: job `322047e0` + local retouch | `brands/p1_r3.png`: job `b5fd8ac6` + local retouch |
| VIII Results | Mantegna, oculus of the *Camera degli Sposi* (1465-74) | `results/d9.png`: job `922b10cb` + local retouch and grade | `results/p3.png`: job `9bc59196` + grade |
| IX Directors | Holbein, *The Ambassadors* (1533), the ambassadors' places left to two empty director's chairs | `directors/d8.png`: job `da8b8160` + local retouch | `directors/p3.png`: job `add24dd7` + local retouch |
| X Apply | Botticelli, *The Birth of Venus* (c. 1484-86) | `apply/d8.png`: job `e47abfe4` + local retouch | `apply/p3.png`: built in post from d8 (no model phone passed) |

### Prompts (short; full text in each chapter's `log.md`)
Model: Nano Banana Pro 4K (`nano_banana_pro`, 5504 x 3072 or 3072 x 5504), 4 credits per image. Every prompt names
the masterpiece and fixes its composition in words, recasts every figure as a young Black African creator in the
original's garments with modern touches, asks for museum oil (glazes, visible brushwork, craquelure, aged varnish),
names a calm title zone, and bans text, logos and frames. What worked: text-to-image to get the composition, then
EDITS of our own job ids ("Edit this painting. Keep ... Change only ...") for the recast and the kit; the phone is a
9:16 recomposition with the chosen 16:9 job as the image input. Text-to-image alone reproduced the famous original
(European faces, no kit) for the School of Athens and the Mona Lisa.
- **Storytellers:** "...instantly recognisable as Raphael's The School of Athens... every figure a young Black African
  man or woman... central figure holds a smartphone aloft, the other carries a closed laptop... the editor on a
  laptop with headphones... the upper 35% only the coffered vault, dim warm shadow". Chain: `e5dca105` (t2i) →
  `ecb56a24` (recast edit) → `69bf0b47` (people/statues/kit edit) → `cbee6a1a` (lighting + re-varnish edit);
  phone `d32e86f3` ("recompose as a new vertical 9:16 painting... top 30% the coffered vault in deep umber shadow").
- **Creators:** "...re-stages Leonardo's Mona Lisa with a new present-day sitter... a young Black African woman...
  lavalier mic, plain phone in her folded hands, gold hoops, a small mirrorless camera with a red tally on the
  parapet... the left 45% calm hazy landscape". Chain: `88f177c9` (t2i) → `f931edb0` (edit) → `506535aa` (seam +
  detail edit); phone `5f92e37c`.
- **Brands:** "...Jan van Eyck's The Arnolfini Portrait... he a young creator in a black wide-brim hat, velvet
  blazer and white sneakers; she the brand's patron in the emerald gown; their joined hands hold a contract with a
  blank red wax seal; the convex mirror reflects a tiny film crew". Chain: `2c6c6c5e` (t2i) → `322047e0` (edit:
  inscription out, crew in the mirror, blank seal); phone `b5fd8ac6`.
- **Results:** "...Mantegna's painted ceiling oculus... we look straight up... people lean over the parapet with
  phones, a camcorder and a ring light... potted orange tree on a pole". Chain: `e04207f9` (t2i) → `922b10cb`
  (edit: camcorder blanked, ring light moved, branch shortened); phone `9bc59196` (tall oval ring).
- **Directors:** "...Holbein's The Ambassadors, but with the two ambassadors absent... green damask, the two-tier
  table and carpet, the instruments... two empty black director's chairs... the anamorphic smear on the floor".
  Chain: `c07d697d` (t2i) → `da8b8160` (edit: modern cinema camera, monitor, de-lettering, darker upper damask; hero
  `70d440b1` passed for technique only); phone `add24dd7`.
- **Apply:** "...Botticelli's The Birth of Venus... Venus elegantly clothed in rose silk, white sneakers, a phone on a
  gimbal; the wind pair as two young creators flying in with a boom mic; the attendant with a small camera". Chain:
  `5f652579` (t2i) → `e47abfe4` (edit, hero for technique only). Both model phones (`493260e7`, `bafadb4e`) came
  back as a letterboxed paste with a hard sky seam, so the phone is a post build from d8.

### Spend (Higgsfield credits)
| Round (UTC) | Who | Jobs (credits) | Credits |
|---|---|---|---|
| 20:15-20:23 round 1 | painter A | storytellers `66c3b7f9` (failed, refunded) `0b9ccb87` `d99d5df9` `e5dca105` `584b5080` `ecb56a24`; creators `b99b857d` `393a615d` `8772387a` `a953d847` `88f177c9` `f931edb0`; brands `909b9a48` `2c6c6c5e` `6e037fc9` `8d6735e7` | 60 |
| 20:16-20:22 round 1 | painter B | results `0bcc2eae` `c2e4b846` `2353258a` `e7977179` `e04207f9` `12237d44`; directors `6be15cf2` `f61d0ddb` `c07d697d` `fa2e6bce`; apply `9c1f4669` `6d867c67` `c99068d1` `b1585640` `5f652579` | 60 |
| 20:51-20:59 round 2 | painter A | storytellers `69bf0b47` `cbee6a1a` `d32e86f3`; creators `cbb41d1e` `506535aa` `70ffb7b5` (outpaint, 2) `ebcad88c` `5f92e37c`; brands `322047e0` `4c1aace6` `b5fd8ac6` | 42 |
| 20:45-20:55 round 2 | painter B | results `922b10cb` `9f8c2d62` `9bc59196` `a482c4e7`; directors `e155f489` `400e896f` `da8b8160` `add24dd7` `b15c5190`; apply `e47abfe4` `c2b6db7a` `493260e7` `bafadb4e` | 52 |
| 21:25-22:30 round 3 | both painters | local retouch only (OpenCV/numpy, scripts in the scratchpad `_workA3/`, `_workB3/`) | 0 |
| 22:36-23:00 encode | encoder | `scripts/art.py --config ... --out ...`, MiDaS depth | 0 |
| | **total** | 53 images charged + 1 outpaint, 1 refund | **214** |

By chapter: Storytellers 32, Creators 42, Brands 28, Results 40, Directors 36, Apply 36. Balance: **515.03 before,
301.03 after** (checked with `balance` and `transactions`: the 214 is exactly the Nano Banana Pro and Outpaint spends
from 20:15:26 to 20:59:47 less the 20:17:52 refund; nothing has been spent since 20:59:47). The account floor is 300,
so no further image could be made (the cheapest, Nano Banana Pro 1K, costs 2): the judges' retake and edit specs in
each `log.md` were not run.

### Picks and why
- **Storytellers** d7_r3: the only candidate that is both the School of Athens at a glance and fully recast (the
  text-to-image tries were the original fresco with European faces; one had a gilt frame and a lettered plaque).
  d7_r3 is d7 plus a crisper finish, fine craquelure, smoky sunglasses and two odd faces glazed down. Phone p1_r3:
  a true vertical School of Athens (central pair under the arch, the sprawled man with the gimbal, the brooder with
  the podcast mic), book-spine pseudo-letters removed, painted skin, terracotta robe, warmer varnish.
- **Creators** d7_r3: the clearest Mona Lisa with a new sitter (braids, hoops, veil), a calm hazy valley on the left;
  neckline glyph band repainted as plain pleats, camera badge removed, lavalier added, sky seam colour step removed
  (dE 14.4 to 1.1). Phone p1_r3: Leonardo's classic vertical framing; neckline, specks, path and sleeves fixed.
- **Brands** d5_r3: the only desktop with the film crew in the convex mirror and no inscription; neat blank seal,
  plain chair back, softened mirror, painted skin, window wall glazed into shadow (title box mean L 95 to 58). d6
  (darker wall) misses the crew. Phone p1_r3: very close to the original vertical Arnolfini; inscription removed.
- **Results** d9: d7 with the tub's relief band and letter-like marks flattened, the orange branch kept right of
  u 0.64, the oculus sky graded to mid cerulean (L 190 to 144) so a cream title can hold, varnish and canvas grain.
  Phone p3 (graded p1) over p2: p2's parapets melt into smears and its pole runs into the sky.
- **Directors** d8: the only candidate with modern kit in Holbein's layout; screens, light meter, sundial numerals
  and book lines blanked. Phone p3 (retouched p1): the best Directors finish of the set; monitor, displays, sundial
  and hymn book cleaned; the clapperboard is plain stripes.
- **Apply** d8: d6 with the second camera removed, Botticelli's roses restored, the far-left drapery made silk, the
  fourth foot added, the neck coil turned into hair. Phone p3 over p1/p2: both model phones have a hard horizontal
  seam where a flat outpainted sky meets the painting.

### Encodes (staged; `scripts/art.py`, now with `--out`, `--config`, `--sheet-path`, `--depth`)
Run: `python3 scripts/art.py --config <scratchpad>/_enc/masters.json --out <scratchpad>/masters/encoded
--sheet-path qa/shots/v3-masters-sheet.jpg --depth /home/user/models/midas_small.onnx`. The default run (no flags)
is unchanged. Same codecs, budgets and ceilings as the live set (AVIF q72 / WebP q86 ceilings, byte budgets as in
the plan, triangular dither before encoding). Sizes in KB (quality):

| Chapter | desktop AVIF 2048 / 2880 | desktop WebP 2048 / 2880 | phone AVIF 1170 / 828 | phone WebP 1170 / 828 | thumb AVIF / WebP | depth |
|---|---|---|---|---|---|---|
| storytellers | 211 (q72) / 310 (q72) | 274 (q86) / 434 (q86) | 174 (q64) / 94 (q61) | 261 (q85) / 145 (q84) | 13.0 / 13.1 | 11.6 |
| creators | 108 (q72) / 172 (q72) | 153 (q86) / 268 (q86) | 162 (q72) / 93 (q72) | 221 (q86) / 126 (q86) | 5.2 / 6.0 | 11.3 |
| brands | 100 (q72) / 151 (q72) | 143 (q86) / 222 (q86) | 143 (q72) / 90 (q72) | 201 (q86) / 121 (q86) | 6.3 / 6.8 | 12.3 |
| results | 239 (q62) / 439 (q65) | 368 (q84) / 668 (q85) | 172 (q57) / 98 (q54) | 258 (q80) / 148 (q79) | 13.7 / 13.7 | 12.7 |
| directors | 202 (q72) / 330 (q72) | 258 (q86) / 444 (q86) | 171 (q61) / 99 (q59) | 265 (q84) / 148 (q83) | 9.8 / 10.4 | 10.2 |
| apply | 245 (q70) / 393 (q72) | 313 (q86) / 507 (q86) | 178 (q69) / 99 (q65) | 249 (q86) / 146 (q86) | 13.1 / 12.9 | 13.1 |

Checked by eye at 1:1 and with levels stretched 4-5x (AVIF vs WebP vs the master resized): no banding in any sky
(the craquelure and grain carry the gradients). Under the stretch only, the Apply phone sky and the Results sky show
AV1 block patches and the Directors damask some smearing; at normal levels they are clean. Results is the heaviest
file because d9's canvas grain is expensive: a light denoise before encoding only bought q62 to q67, so the grain was
kept. Depth maps: MiDaS small via `scripts/depth.py` on desktop-2048, 1920 x 1080 greyscale WebP q85, now written by
`art.py --depth` (Storytellers and Results get their own maps for the first time).

Each staged manifest carries the live fields (desktop/phone lists, thumb, focus, phoneFocus, titleSide, phoneTitle,
titleBox, key, titleBg, titleInk, titleContrast, placeholder, credit) plus `masterpiece`, `artNote`, `depth` and
`titleScrim` (the scrim alpha needed for 3:1 title and 4.5:1 dek contrast in the zone's worst decile, the zone's
luma sd, and the art direction's calming scrim where one is asked for).

| Chapter | focus (16:9) | phoneFocus (9:16) | desktop titleBox, ink | phone titleBox, ink | key |
|---|---|---|---|---|---|
| storytellers | 0.51, 0.48 | 0.55, 0.55 | 0.06 0.04 0.50 0.32, light over a ~0.6 dark scrim (the Apollo statue) | 0.05 0.03 0.95 0.19, light | #A62A16 |
| creators | 0.69, 0.30 | 0.56, 0.50 | 0.04 0.04 0.46 0.28, dark (moved up from the judge's mid-height 0.06 0.22 0.46 0.56 to match the opener's near-top title: luma sd 12 vs 34, worst decile 8.9:1 vs 3.9:1) | 0.05 0.03 0.95 0.20, dark | #9A6A2A |
| brands | 0.69, 0.36 | 0.52, 0.55 | 0.07 0.08 0.36 0.40, light (~0.3-0.45 dark scrim) | 0.05 0.02 0.95 0.19, light | #6E1418 |
| results | 0.50, 0.52 | 0.50, 0.50 | 0.31 0.05 0.60 0.30, light (cream needs a ~0.1 halo for 3:1, ~0.3 for the dek) | 0.12 0.165 0.86 0.30, dark | #7298A6 |
| directors | 0.66, 0.40 | 0.58, 0.58 | 0.03 0.04 0.50 0.34, light | 0.08 0.06 0.92 0.34, light | #3F4D1F |
| apply | 0.62, 0.42 | 0.50, 0.68 | 0.05 0.06 0.45 0.33, dark | 0.08 0.04 0.92 0.30, dark | #DFAFA0 |

(x, y from the top-left; the camera key sheets use y from the bottom.) Keys are sampled from each painting's
identity hue (Raphael's vermilion robe, the Mona Lisa's ochre, the Arnolfini bed's crimson, Mantegna's sky,
Holbein's damask, Botticelli's rose). Contact sheets: `qa/shots/v3-masters-sheet.jpg` (each chapter, title zones in
magenta, sizes, ink and scrim) and `qa/shots/v3-masters-vs-current.jpg` (live painting beside the new one).

### Known limits (no credits were left to fix these; the judges' specs are in each `log.md`)
- **Storytellers desktop** is soft at 1:1 (faces), still has two camcorders in the director group, and the Apollo
  niche statue sits in the title zone, so the site must lay the ~0.6 dark scrim. Phone: the blue-robed figure's palm
  is open, not turned down; the gimbal is about 6% from the right edge (phoneFocus 0.55 keeps it in).
- **Creators**: the sky seam is now a texture change, not a colour step (smooth sky left of u 0.50, weathered panel
  right of it); the face is smooth rather than sfumato with craquelure. Phone: the camera sits near the right edge.
- **Brands**: faces are painterly but not true Van Eyck glazes; the chandelier arms are irregular. Phone: a faint
  translucent duplicate of her fingers on the contract, a cog-shaped mirror frame, the phone and podcast mic out of
  frame, the pattens near the left edge.
- **Results**: the heaviest scene (AVIF q62 desktop, q54-57 phone, inside budget). Phone: the terracotta tub and its
  pole sit in the lower right corner of the title box (keep the dek left of u 0.76). The painting no longer has a TV,
  so the Results video backdrop goes (see the swap plan).
- **Directors**: the finish is still short of Holbein's hard-edged panel; a faint, illegible smudge remains on the
  monitor's lower bezel. The judge's text-only retake is the fix.
- **Apply phone** is a post build (a scaled crop of d8 under a painted-sky extension): Venus is ~48% of the frame
  height and the wind pair is out of frame, so only their boom mic enters from the left edge.
