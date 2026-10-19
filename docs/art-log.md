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
