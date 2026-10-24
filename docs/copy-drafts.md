# Copy drafts: v3 (Track C)

Fuller copy for each chapter, for the client to approve. Plan: `docs/v3-plan.md` §5 (★ items) and §9. Researched and drafted 2026-10-19.

**v4 (2026-10-23).** The client asked us to finish the drafts from their earlier site (S7) and gave the two directors' roles (S8). Statuses below are updated: **approved** (now sourced from S7, word for word or close; `data-draft` removed, it shows with `?drafts=0`; its `kind` in facts.json is its real kind), **dropped** (off the page; in facts.json `kind: "dropped"` + `retired`, so the fact check fails if it returns), **draft** (still needs the client: the service names are S7's, the one-line descriptions are ours), **alt** (kept as an alternative, not on the page). The client summary is `docs/copy-v4.md`.

**Round 2 (2026-10-24).** The client answered the five questions in `docs/copy-v4.md` (S9). Approved: the six service descriptions (DC11, DC12, DC15–DC18), Catalogue channels (DC19) and brief steps 01–04 (DC33–DC36), so `data-draft` is off them and they show with `?drafts=0`; the two list labels, "What we run" (DC10) and "How a brief runs" (DC32), were not in the question and stay drafts. New: row 07 of "What we run", **Support — On WhatsApp and Telegram, 24/7.** (F148, S7 `index.html:641`, confirmed by S9); the Directors dek is now **"Two of the people answerable for all of it."** (F149; F105 retired); Showcase gains "On the roster", an index of all 16 creators (the nine new names F139–F147, drafts DC76–DC78 and the nine video titles DC110–DC118). The client summary is the "Round 2" section of `docs/copy-v4.md`.

**How to read this.** Every string has an ID (DC…) and is also in `docs/facts.json`, so a builder can render it and the fact check can trace it. Until v4 nothing here was approved.
- **from site**: verbatim or near-verbatim from Creative Motley's own site. The source column says whether that is the live page (S1) or an earlier version of it (S2).
- **draft**: written for v3 from those sources. The client must approve it.
- **Use** is the recommendation: *use*, *alt* (an alternative to a *use* string) or *optional* (an extra if the chapter has room).

**Rules followed.**
- Plain, confident British English with no hype.
- No new numbers, clients, quotes, awards or testimonials. Where an S2 line carried a figure, the figure is left out (see Conflicts).
- No stats or results are attached to any creator (F64 note).
- Each sentence appears once on the page. Where a draft would repeat a live line, it is reworded and the note says so.

## Sources

- **S1, live site.** https://creativemotley.com/, fetched 2026-10-19 (homepage HTML; the only page; `/about`, `/services`, `/work/` etc. return 404). Its text is already F01–F135 in facts.json, and nothing new was found on it.
- **S2, an earlier version of creativemotley.com.** Known only through search-index summaries of https://creativemotley.com/ (WebSearch, 2026-10-19, ten queries restricted to that domain). That version had services, a "How we work" sequence and an FAQ that the live page no longer has. The wording comes through a summariser, so treat it as near-verbatim at best and have the client confirm each line is still true. The Wayback Machine (web.archive.org) is blocked here, so it could not be checked directly.
- **S3, the site's own posters** (`public/assets/posters/*.webp`). Their small print names the people behind each channel and says "Managed by Creative Motley". F134 already rules this print out as a claim, so it is used only to choose videos (`docs/videos.json`).
- **S4, Companies House (search result only).** CREATIVE MOTLEY LTD, company 16849905, incorporated 12 November 2025 (https://find-and-update.company-information.service.gov.uk/company/16849905). Not fetched: the host is blocked. It is not confirmed to be this business (Crunchbase lists a "Creative Motley" that makes a finance app, WealthMotley: https://www.crunchbase.com/organization/creative-motley-ltd). Not used in copy.
- **S5, directors.** No public article, interview or profile ties Olayinka Lawal or Gbenga Sosanya to Creative Motley (searches: name + Creative Motley / YouTube / Paramount / Multichoice / Africa Magic). LinkedIn and Crunchbase show several different people called Olayinka Lawal, and none can be confirmed as the director. Nothing from them is used.
- **S7, the earlier site, Content Motley (the business's earlier name).** `/home/user/olayinkalawal/contentmotley` (the client's own repo, read-only; served at https://relaxed-crisp-6fca75.netlify.app/, which is blocked from this container). Used: the static homepage `index.html`, byte-identical to `public/index.html`; every later fix in that repo's history went into these two files and none into `src/`, so this is what the Netlify deploy served. Not used: the unfinished Next.js app (`src/app/**`, placeholder videos, forms that do not send, different headline figures, process steps and FAQ) and `blog.html` (both articles bylined to Sholz S. Laelle). Everything about Sholz S. Laelle is excluded at the client's request: name, image, bio, roles, figures, email and bylines. Cited as `index.html:<line>`. S7 is the source S2 was summarising: its FAQ lines match S2 word for word.
- **S8, the client's message, 2026-10-23.** Olayinka Lawal (the site's owner): "so I am the CTO/Co founder of wealthmotley, Gbenga is part of the board." No bios were given, so none are written. (S4 above: Crunchbase lists a "Creative Motley" that makes the finance app WealthMotley.)
- **S9, the client's message, 2026-10-24.** Olayinka Lawal, verbatim: "add emmabel and royal arts to showcase. yes its creative motley board, it includes more but leave it as two for now, none of use have the YT/paramount experience only sholz, but we will add her later. yes the online descpription is fine. yes there is support. add biodun stephen, bolu essien, ariyike dimples, officer woos, brainjotter, goldscreen TV, abayomi alvin," Read as answers to `docs/copy-v4.md` questions 1–5: the board is Creative Motley's and has more members, but the page keeps the two names for now; only Sholz had the YouTube/Paramount experience (she will be added later: nothing about her now, the credits row and "16+ years" stay off); the one-line descriptions are approved; 24/7 support is true (the 24–48-hour reply and the results timing were not confirmed and stay off); Emmabel TV and Royal Arts TV join the Showcase, with seven more of Creative Motley's creators.
- **S6, camera anatomy.** General camera part names, matched to what the exploded camera shows (the real-time 3D camera, and its still `public/assets/teardown/camera3d/still_exploded.webp`). These are descriptive labels, not claims, like the Kit part names in `docs/ui-strings.json`.
- **Creator videos.** The sources are listed per video in `docs/videos.json`.

## Density: before and after

Words counted as unique visible text in each `src/partials/*.html` today. The plan target is about 40–60 words per screen. Method drops the seven step names, which now live only in Process.

| Chapter | Plan length (vh) | Words now | Now / screen | + recommended | After / screen | With optional |
|---|---|---|---|---|---|---|
| Storytellers | 200 | 31 | 16 | 80 | **56** | 56 |
| Creators | 260 | 85 | 33 | 84 | **65** | 87 |
| Brands | 240 | 36 | 15 | 79 | **48** | 48 |
| Method | 330 | 23 | 7 | 122 | **42** | 43 |
| Showcase | 300 | 30 | 10 | 40 | **23** | 33 |
| Process | 280 | 148 | 53 | 0 | **53** | 57 |
| Kit | 525 | 46 | 9 | 0 | **9** | 11 |
| Results | 180 | 32 | 18 | 0 | **18** | 18 |
| Directors | 220 | 16 | 7 | 14 | **14** | 16 |
| Apply | 160 | 41 | 26 | 41 | **51** | 58 |

- **Creators** runs slightly over the target, even with the command-cloud items and "Reporting" left optional. If it reads dense, cut "SEO" and "Thumbnails" (the chatter cards already show both) or give the paper 280 vh. **v4:** SEO and Thumbnails are cut and Reporting is in: the chapter is 5 words shorter than before (≈ 64 a screen, from ≈ 66; the rest is the live site's own fan and feed notes).
- **v4 change in words (visible text of each partial, before → after):** Storytellers 109 → 85, Creators 172 → 167, Brands 108 → 114, Results 25 → 20, Directors 39 → 33, Apply 79 → 76. Directors stays the lightest chapter until the bios come.
- **Directors** stays light until the client supplies the two bios: about 20–25 words each would bring it to about 35 per screen.
- **Showcase** is meant to be carried by the video cards, not by text.

## Hero and film beats

No change. Keep F08 and F07 as the dek and F12 → F13 → F14 as the beats. The Organization JSON-LD `description` should use the live meta sentence F06 verbatim.

## I · Storytellers: who we are ★

Keep F20, F21 and the three ways in (F22–F25). Add DC01 (or the shorter DC02) as the paragraph under the diagram, then DC03. **v4:** DC01 is now S7's own definition and DC03 S7's reach line; both approved.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC01 | Creative Motley is a creator service provider, not a traditional multi-channel network: hands-on strategy, management and monetisation for YouTube channels, on transparent terms. No channel is a line item. | **approved** (v4) | use | Who we are (paragraph under the three ways in) | S7 `index.html:1232` (FAQ: "We're a Creator Service Provider (CSP), not a traditional MCN. We offer hands-on strategy, management and monetization support with transparent terms. We treat your channel like a media business, not just a line item in a network."), cut 37 → 29 words; "MCN" spelt out so it does not read against "Our network spans…" (DC03), F43 or DC34; "YouTube" per `:385`. Replaces the v3 paraphrase (was: "Creative Motley is a creator service provider. We run YouTube channels as businesses … so the people making the work can keep making it."). |
| DC02 | A creator service provider, not a traditional network: hands-on strategy, management and monetisation, on transparent terms. | **dropped** (v4: absorbed into DC01) | alt | Who we are (short alternative to DC01) | S2: Near-verbatim S2: "Creator Service Provider (CSP), not a traditional MCN. We offer hands-on strategy, management and monetization support with transparent terms." Changes: MCN → network (plain English), UK spelling. |
| DC03 | We work with creators and content owners anywhere who create for African audiences or the diaspora. Our network spans Africa, the UK, the US, Europe and beyond. | **approved** (v4) | use | Reach (one line after DC01) | S7 `index.html:1219` (FAQ "Do I need to be based in Africa?"): "No. We work with creators and content owners globally who create content for African audiences or the African diaspora. Our network spans Africa, UK, US, Europe and beyond." v4 changes "make work" → "create" (as the source has it), so "work with … make work" does not repeat. |

## II · Creators: services ★, more command-cloud items ★

Keep the feature block (F39–F43), the notes fan and the Media Owners block (F44–F46). Add the services list (DC10–DC18) after the Creators block and DC19 under Media Owners. The new cloud items (DC21–DC30) carry no figures, names or times, unlike F26/F27/F34, which came from the site.

**Round 2 (S9):** the six descriptions and DC19 are approved (`data-draft` off the rows; the wrapper no longer names them, so the list shows with `?drafts=0` and only its label DC10 hides). Row 07 is new: **Support — On WhatsApp and Telegram, 24/7.** (F148, kind `service`), S7 `index.html:641` ("24/7 WhatsApp/Telegram support", the creators' "What You Get" list) in the list's name — line form, confirmed true by S9 ("yes there is support"). Creators only: it is the creators' promise on S7, and Apply would say it a second time. Measured room (scout, 2026-10-24): +0 px at 1440, 1280, 1024 and 1920 (it fills the space beside Media Owners), +52 px at 820 × 1180 and 844 × 390, +76 px on phones.

**v4:** the list is six rows, 01–06: Channel strategy, Programming, Monetisation, Rights and Content ID, Brand deals, Reporting (wrapper `data-draft="DC10 DC11 DC12 DC15 DC16 DC17 DC18"`). The service names are S7's (`index.html:597–619`, `634–641`, `755`); the one-line descriptions are ours, so the list stays a draft for the client. SEO and Thumbnails are cut for density (the fan, the cloud and Process F27, F32, F91, F92 already show both). F46 is set in British spelling: "Monetise your catalogue ↗".

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC10 | What we run | **draft** (round 2: the label was not in the question; the rows under it are approved) | use | Services list label | v4: unchanged; label, no claim. —: Label for the services list; echoes F111/F08 "run like media companies". |
| DC11 | Channel strategy — A dedicated strategist: what the channel is for, and what it makes next. | **approved** (round 2, S9) | use | Services list item (name — line) | v4: line now opens "A dedicated strategist:" from S7 `index.html:636` ("Dedicated channel strategist"); name per `:597`; the rest is ours. Row 01. S2: Service name from site (S2); the line is drafted. S2 lists "strategy" first in its service list. |
| DC12 | Programming — Series, formats and the order they go out. | **approved** (round 2, S9) | use | Services list item (name — line) | v4: name confirmed by S7 `:597` ("Channel Strategy & Programming") and `:755`; the line is ours (S7's "Upload calendars, series design" is already Process F82/F83). Row 02. S2: Service name from site (S2); the line is drafted. S2 service list: "programming". Kept distinct from F83 (upload calendar), which stays in Process. |
| DC13 | SEO — Written so the right viewer finds the work. | **dropped** (v4: density; F27, F32, F91, F92 already cover it) | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 service list: "SEO". |
| DC14 | Thumbnails — Designed and tested: the click comes first. | **dropped** (v4: density; with DC13) | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 service list: "thumbnails"; F32 "/thumbnail-test", F27 (A/B chatter). |
| DC15 | Monetisation — Ads and sponsorship, set up so views pay. | **approved** (round 2, S9) | use | Services list item (name — line) | v4: name confirmed by S7 `:604–605` ("Monetization & Brand Deals — Ad optimization, sponsorships…"); the line is ours. Row 03. S2: Service name from site (S2); the line is drafted. S2: "ad optimisation and sponsorships"; F07 "Turn views into long-term revenue." |
| DC16 | Rights and Content ID — Re-uploads found, claimed and earning for you. | **approved** (round 2, S9) | use | Services list item (name — line) | v4: name confirmed by S7 `:618–619` ("Rights & Content ID — Protect your IP and monetize reuploads"); the line is ours. Row 04. S2: Service name from site (S2); the line is drafted. S2: "Rights & Content ID — protect IP and monetise reuploads"; F30, F37 (rights chatter). |
| DC17 | Brand deals — Access to the brand briefs that come to us. | **approved** (round 2, S9) | use | Services list item (name — line) | v4: confirmed by S7 `:638` ("Access to brand deal pipeline"); the line is ours. Row 05. S2: Service name from site (S2); the line is drafted. S2: "access to brand deal pipeline". |
| DC18 | Reporting — A monthly review of what moved and what changes. | **approved** (round 2, S9) | optional | Services list item (name — line) | v4: S7 `:637` says "Monthly performance reviews", which settles question 6 ("monthly" is the client's own); `:755` lists "reporting". "of what moved and what changes" is ours. Row 06. S2: Service name from site (S2); the line is drafted. S2 service list: "reporting". One search summary also listed "monthly performance reviews"; a second could not confirm it, so "monthly" needs the client’s yes. |
| F148 | Support — On WhatsApp and Telegram, 24/7. | **approved** (round 2, S9; new) | use | Services list item 07 (name — line) | S7 `index.html:641` ("24/7 WhatsApp/Telegram support"), confirmed true by S9 ("yes there is support"). Row 07. In facts.json as F148 (kind `service`), not a DC id, since it is the client's own promise. |
| DC19 | Catalogue channels — Your film and TV library, launched and programmed on YouTube. | **approved** (round 2, S9) | use | Media Owners list item (under F44–F46) | v4: the offer is S7's (`:514` "You own film, TV or digital IP and want predictable, recurring revenue from YouTube."); "launched and programmed on YouTube" is ours, not S7's. S1 F44, F45; S2: F45 "Film, TV and digital IP, earning every month."; S2 describes a Media Owners offer for holders of "film, TV or digital IP" who want recurring YouTube income. |
| DC20 | Release order — Films and series released to build an audience, not dropped all at once. | **dropped** (v4: no source) | optional | Media Owners list item (optional second) | —: Reasoning from F82/F83 (series design, upload calendar) applied to a library. No source states it for catalogues. |
| DC21 | /metadata-pass | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC22 | /rights-sweep | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC23 | /sponsor-slot | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC24 | Re-upload found — claim filed | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC25 | Shorts cut from the long episode | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC26 | Chapters added to the new upload | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC27 | Series trailer scheduled | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC28 | Sponsor read approved | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC29 | Playlist reordered for the series | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC30 | Monthly review sent | **dropped** (v4: invented chatter, no source) | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |

## III · Brands: how a brief runs ★

Keep F47–F49, the notes fan, "The room" and "The set". Add DC31 as the lead-in, then the five steps. **Recommendation:** move the credits row (F54–F59) to Directors, where "Leadership experience from" belongs (see DC91). Brands then stays about the brief.

**Round 2 (S9):** steps 01–04 (DC33–DC36) are approved; with DC37 the whole list shows with `?drafts=0`, and only its label DC32 is still a draft.

**v4:** DC31 is now S7's own Brands line (approved), and steps 04 and 05 use S7's wording. The credits row is off the page entirely (see IX).

**Brand video card:** no public brand-campaign video by Creative Motley was found. Ask the client for one, or for the reel S2 mentioned ("Success Stories Reel" / "Campaign Highlights 2024"). Until then, leave the card out rather than putting a creator's video under a brand heading.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC31 | We connect brands and agencies to African creators and IP, and manage everything from brief to reporting. | **approved** (v4) | use | Lead-in line above the brief steps | v4: now S7 `index.html:687` ("We connect your brand to premium African creators and IP – and manage everything from brief to reporting."), "premium" dropped; the section is S7's "FOR BRANDS & AGENCIES" (`:682`). Replaces "We also work with brands and agencies looking to partner with African creators." (S7 `:1206`, second sentence), which opened the block with "also". S2: Verbatim S2 (FAQ, "Who do you work with?"). |
| DC32 | How a brief runs | **draft** (round 2: the label was not in the question) | use | "How a brief runs" label | v4: unchanged; label. —: Plan §5 ★ label. |
| DC33 | Brief — You tell us the audience, the message and the budget. | **approved** (round 2, S9) | use | Brief step (name — line) | v4: unchanged; the client's own input, no claim; nothing in S7 is closer. —: F38 "Brand brief received — Lagos"; F24 "Brands — budget, no voice". Drafted. |
| DC34 | Match — We put forward creators from a vetted network whose audiences fit the brief. | **approved** (round 2, S9) | use | Brief step (name — line) | v4: S7 `:693` ("Curated network of vetted creators"), `:660–661` ("Strategic Matching"); "whose audiences fit the brief" is ours. S2: "a curated network of vetted creators". |
| DC35 | Contract — One agreement and one point of contact, however many creators are on it. | **approved** (round 2, S9) | use | Brief step (name — line) | v4: S7 `:701` ("One contract, one point of contact"); "however many creators are on it" is ours. S2: "a single contract and point of contact"; F48 "One contract." (step named "Contract" so F48 is not repeated). |
| DC36 | Make — In the creator’s own voice: a campaign that feels like content. | **approved** (round 2, S9) | use | Brief step (name — line) | v4: now draws on S7 `:697` ("YouTube-native campaigns that feel like content"); "In the creator’s own voice" is ours. Was: "Make — Made in the creator’s own voice, to your brief." —: Answers F24 "Brands — budget, no voice". Drafted. |
| DC37 | Report — Performance tracked and brand lift measured, in numbers your CMO can use. | **approved** (v4) | use | Brief step (name — line) | v4: both halves are S7's: `:705` ("Performance tracking & brand lift measurement") and `:665–666` ("Full Reporting — Numbers your CMO can use"). Was: "…from first upload to final report." Shows only with the drafted list around it. S2: "Performance tracking & brand lift measurement"; S2 campaign management "from the brief through to reporting". |

## IV · Method: the camera, part by part ★

F61 + F62 open the chapter. The seven steps leave Method entirely. The spec list names the parts the exploded render actually shows, front to back. Each part has a `data-anchor` uv on `teardown/camera3d/still_exploded.webp` (the 3D still: tier 0 and the stand-in) and a `data-anchor3d` id that the real-time camera places its marker on. The lines are descriptive camera anatomy: no sensor size, resolution, model or other spec is claimed. The plate art shows "SONY" and "α 7" (F133); nothing here names a maker.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC40 | Inside the instrument | **dropped** (v4: optional label not used) | optional | Spec list label | S1 F62: Picks up F62 "…passes through one instrument…". Optional; the list can run unlabelled. |
| DC41 | Front element — The first glass the light meets. | **draft** | use | Camera part (name — line); anchor uv 0.815 0.727 on still_exploded.webp (3D: front_element) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC42 | Lens elements — Groups of glass that bring the image into focus. | **draft** | use | Camera part (name — line); anchor uv 0.547 0.565 on still_exploded.webp (3D: lens_elements) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC43 | Aperture — Overlapping blades that set how much light gets through. | **draft** | use | Camera part (name — line); anchor uv 0.508 0.51 on still_exploded.webp (3D: aperture) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC44 | Lens mount — A bayonet with electrical contacts: lens and body talk through it. | **draft** | use | Camera part (name — line); anchor uv 0.458 0.493 on still_exploded.webp (3D: lens_mount) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC45 | Body and grip — Dials, shutter button and the hand that holds them. | **draft** | use | Camera part (name — line); anchor uv 0.421 0.703 on still_exploded.webp (3D: body_grip) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC46 | Viewfinder (EVF) — A small screen behind an eyepiece: the frame, at the eye. | **draft** | use | Camera part (name — line); anchor uv 0.427 0.103 on still_exploded.webp (3D: evf) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC47 | Battery — A removable pack. Carry a spare. | **draft** | use | Camera part (name — line); anchor uv 0.444 0.865 on still_exploded.webp (3D: battery) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC48 | Shutter — Times each exposure, just in front of the sensor. | **draft** | use | Camera part (name — line); anchor uv 0.311 0.418 on still_exploded.webp (3D: shutter) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC49 | Image sensor — Where light becomes a picture. | **draft** | use | Camera part (name — line); anchor uv 0.287 0.35 on still_exploded.webp (3D: image_sensor) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC50 | Stabiliser (IBIS) — In-body image stabilisation: the sensor moves to cancel shake. | **draft** | use | Camera part (name — line); anchor uv 0.247 0.433 on still_exploded.webp (3D: ibis) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC51 | Main board — The processor that turns what the sensor sees into files. | **draft** | use | Camera part (name — line); anchor uv 0.21 0.272 on still_exploded.webp (3D: main_board) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC52 | Rear screen (LCD) — For framing, menus and playback. | **draft** | use | Camera part (name — line); anchor uv 0.154 0.339 on still_exploded.webp (3D: rear_lcd) | S6: Descriptive camera anatomy naming what the exploded render shows; not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |

## V · Showcase: watch the work ★

Keep the poster room and F64–F72. Add the XXL video cards (thumbnail first, player in a modal only on click). Each card is the creator's name (F71-style, from F64–F70) plus the video title. Use the first video per creator (*use*) and the second as *optional*. All ids, channels and the verification status are in `docs/videos.json`. **None could be oEmbed-verified from this session**, so verify them before shipping (the command is in `videos.json`). Kunle Afolayan's second video (The CEO) is left out of facts because its id is unverified.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC60 | Watch the work | **draft** | use | Video section head | —: Plan §3.8 wording for the XXL video cards. |
| DC61 | Play video | **draft** | use | Video card button (UI) | —: Interface label; could move to ui-strings.json once approved. |
| DC62 | Watch on YouTube ↗ | **draft** | use | Video card link (UI) | —: Interface label; the ↗ matches F43/F46/F49. |
| DC63 | The Law vs. The Machine | **draft** | use | Video card title — Layi Wasabi | videos.json: Display form of the YouTube title "THE LAW VS. THE MACHINE" (id 6aheOxb7GPU). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC64 | Rugged Lawyer | **draft** | optional | Video card title — Layi Wasabi | videos.json: Display form of the YouTube title "RUGGED LAWYER" (id gc_CdEdEVrQ). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC65 | Love Was Not Invited | **alt** (v4: off card 2) | alt | Video card title — Omoni Oboli TV | v4: card 2 now plays DC66, S7's own pick. Kept as the fallback if DC66 fails oEmbed. This film is the one whose premise matches the poster ("Two exes. One wedding."). videos.json: Display form of the YouTube title "LOVE WAS NOT INVITED - Nigerian Movies 2026 Latest Full Movies" (id H9qoC981BAU). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC66 | Love in Every Word 2: The Wedding | **draft** (on the page, card 2, v4) | use | Video card title — Omoni Oboli TV | v4: the video is S7's own pick for Omoni Oboli TV (`index.html:791`, the FEATURED embed, id OQQaDqLCgKg). The title comes from search listings and is not yet confirmed on YouTube. videos.json: Display form of the YouTube title "LOVE IN EVERY WORD 2 - THE WEDDING" (id OQQaDqLCgKg). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC67 | RMD on Curiosity Made Me Ask | **draft** | use | Video card title — Isbae U | videos.json: Display form of the YouTube title "RMD ON CURIOSITY MADE ME ASK!" (id nOedKYSXuPU). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC68 | Olusegun Obasanjo on Curiosity Made Me Ask | **draft** | optional | Video card title — Isbae U | videos.json: Display form of the YouTube title "Former President Olusegun Obasanjo on curiosity made me ask" (id U-xB3IOipac). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC69 | FDI: Federal Disturbance Intelligence, episode 1 | **draft** | use | Video card title — Broda Shaggi | videos.json: Display form of the YouTube title "FDI - FEDERAL DISTURBANCE INTELLIGENCE (Epi 1) Brodashaggi" (id MTZlMqXgUZA). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC70 | New Love Story | **draft** | optional | Video card title — Broda Shaggi | videos.json: Display form of the YouTube title "New Love Story" (id HcZDHLW7cKA). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC71 | Bisola Aiyeola on intentional friendships | **draft** | use | Video card title — Diary of a Naija Girl | videos.json: Display form of the YouTube title "Bisola Aiyeola speaks on Intentional Friendships" (id 2FY9NcE2lbw). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC72 | Kunle Remi on real-life marriage | **draft** | optional | Video card title — Diary of a Naija Girl | videos.json: Display form of the YouTube title "Kunle Remi on Real-Life Marriage Struggles" (id 7OBeFS70vpg). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC73 | Reheated Passion | **draft** | use | Video card title — Kie Kie | videos.json: Display form of the YouTube title "REHEATED PASSION \| Nigerian movies 2026 Latest full movies" (id QoZJOlmynbw). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC74 | Dr Shaggi in Distress | **draft** | optional | Video card title — Kie Kie (with Broda Shaggi) | videos.json: Display form of the YouTube title "DR SHAGGI IN DISTRESS" (id RdlXuz1_iKo). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC75 | The Figurine: Araromire (2009) | **draft** | use | Video card title — Kunle Afolayan | videos.json: Display form of the YouTube title "The Figurine: Araromire (2009)" (id 7A3M-n54gG8). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |

**Round 2 (S9): On the roster.** The client added nine creators: Emmabel TV and Royal Arts TV (both on S7's gallery, `index.html:858`, `:933`) and Biodun Stephen, Bolu Essien, Ariyike Dimples, Officer Woos, Brainjotter, GoldScreen TV and Abayomi Alvin (as the client wrote them). They have no poster art, and no likeness of a real person is made for them, so they join as a type-only index, **"On the roster"**, between the poster run and "Watch the work": all 16 creators, en-GB alphabetical, two columns. Each row is the name and one action, **Watch** (plays in the shared modal; a plain YouTube link without JS); the video's title is the modal's heading and never sits beside the name (the F64 rule). The rows are written by `src/partials/showcase.videos.mjs` from `docs/videos.json` (`roster`): a creator links only to a video or channel the research rates confirmed or probable, else shows the name alone ("Channel ↗", DC78, is the fallback for a creator with a channel but no playable video). The label never presents the list as complete (Results: 70+ channels managed, F100). The name facts are F139–F147 (kind `name`, source S9). Spellings follow each creator's own channel, for the client to confirm: **Ariyiike Dimples** (her own double i; the client wrote "ariyike"), **Brain Jotter** (two words, as Wikipedia and his main channel; the client wrote "brainjotter"), **Gold Screen TV** (the YouTube channel's title; IMDb and its TikTok write "Goldscreen TV"); Biodun Stephen and Abayomi Alvin by the person's name, as Kunle Afolayan. The video row keeps its seven cards (no new art, no thumbnails from YouTube).

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC76 | On the roster | **draft** (round 2) | use | Label over the creator index | —: never "The roster", "All creators" or a count (the list is not complete). |
| DC77 | Watch | **draft** (round 2) | use | Roster row action (UI): plays the video in the modal | —: interface label, as DC61. |
| DC78 | Channel ↗ | **draft** (round 2; not on the page today) | fallback | Roster row action (UI): opens the YouTube channel | —: written only for a creator with no playable video and a confirmed or probable channel. |
| DC110 | Love and Kasala | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Emmabel TV (F139) | videos.json: display form of the indexed title "LOVE AND KASALA - Nigerian Movies 2025 latest full movies" (id 2SgtAvc1HV8). Video confirmed, channel confirmed (https://www.youtube.com/@EmmabelTV247). The client's own pick (S7 `index.html:850 (embed youtube.com/embed/2SgtAvc1HV8), :858 (label "Emmabel TV")`). |
| DC111 | Love Stood Still | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Royal Arts TV (F140) | videos.json: display form of the indexed title "LOVE STOOD STILL - Nigerian Movies 2025 Latest Full Movies" (id ScAcee_5Q4A). Video probable, channel confirmed (https://www.youtube.com/@RoyalArtsTV). The client's own pick (S7 `index.html:925 (embed youtube.com/embed/ScAcee_5Q4A), :933 (label "Royal Arts TV")`). |
| DC112 | Uninvited Bride | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Biodun Stephen (F141) | videos.json: display form of the indexed title "UNINVITED BRIDE - Blessibg Obasi\| Biodun Stephen Nigerian Movies 2025 Latest Full Movies" (id vuJBH0QyxZk). Video probable, channel confirmed (https://www.youtube.com/@BIODUNSTEPHENTV). |
| DC113 | Girls’ Hostel, episode 1: It Girl | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Bolu Essien (F142) | videos.json: display form of the indexed title "GIRLS' HOSTEL- EPISODE 1 (IT GIRL) FEAT. BOLU ESSIEN, ONYINYE ODOKORO, RONKE 'OMOOBA', EVA IBIAM" (id 8NM-yaMdmeg). Video probable, channel confirmed (https://www.youtube.com/@BoluEssien). |
| DC114 | Insult Upon Injury | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Ariyiike Dimples (F143) | videos.json: display form of the indexed title "INSULT UPON INJURY \| RISKY STUDIOS TV \| ARIYIIKE DIMPLES" (id pb2jiuqmAms). Video probable, channel confirmed (https://www.youtube.com/@RiskyStudiosTV). |
| DC115 | The Introduction | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Officer Woos (F144) | videos.json: display form of the indexed title "THE INTRODUCTION - (Officer Woos new comedy) SAKA" (id bx0QofHIX68). Video probable, channel confirmed (https://www.youtube.com/@OFFICERWOOS). |
| DC116 | Thera-Pissed | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Brain Jotter (F145) | videos.json: display form of the indexed title "THERA-PISSED - Brain Jotter comedy" (id menYRpHwVdM). Video probable, channel probable (https://www.youtube.com/@BrainJotterComedian). |
| DC117 | Never Far Away | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Gold Screen TV (F146) | videos.json: display form of the indexed title "NEVER FAR AWAY - Nigerian Movies 2025 Latest Full ... (truncated in the index)" (id eRfM081tX0I). Video probable, channel confirmed (https://www.youtube.com/@GoldScreenTV-NG). |
| DC118 | The Little Things | **draft** (round 2; not on YouTube yet: oEmbed) | use | Modal heading when the roster row plays — Abayomi Alvin (F147) | videos.json: display form of the indexed title "THE LITTLE THINGS -ABAYOMI ALVIN, CAROLINE IGBEN, LUCY EDET,OLUWADOLARZ, HERMES FULL Nigerian Movie" (id bzpqmWl8sE4). Video probable, channel confirmed (https://www.youtube.com/@AbayomiAlvinTv). |

## VI · Process: the seven steps, each named once

The steps are F75, F78, F81, F84, F87, F90 and F93, each with its two lines (short F76…F94 + long F77…F95), all from the live site. **Recommendation:** with Method now on camera parts, Process is the only place the step names appear. Set each step as name | short line + long line in one row (the plan's "dense list with long lines"). Drop the "Chapter VI · Process" kicker (F73); the opener is F74. DC80 optionally adds S2's discovery call to the first step.

**Each step named once across the page:** Kit currently labels its runs "Production", "Sound", "Sound" and "Published" (step names). DC85–DC88 offer neutral labels instead. Or drop the labels and let the device name (a UI string) stand alone.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC80 | It starts with a discovery call: your goals, your content, your audience. | **dropped** (v4: the discovery call is said once, in Apply, DC101) | optional | Optional third sentence for "Blank page" (after F76 + F77) | S2: Near-verbatim S2 ("How we work": "Discovery Call — unpack your goals, content and audience"). Its next step, "Channel audit — deep dive into analytics, SEO & monetization", is already F77. |

## VII · Kit: run labels (optional)

No new copy is needed: the device names and part names are UI strings already. These labels only replace the step names Kit borrows today.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC85 | On the desk | **draft** | optional | Kit run label for the console (replaces the step name used now) | v4: unchanged. —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |
| DC86 | At the mic | **draft** | optional | Kit run label for the microphone (replaces the step name used now) | v4: unchanged. —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |
| DC87 | In the ears | **draft** | optional | Kit run label for the headphones (replaces the step name used now) | v4: unchanged. —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |
| DC88 | In the hand | **dropped** (v4: the phone shot's head is F98) | optional | Kit run label for the phone (replaces the step name used now) | —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |

## VIII · Results

No drafts. Keep F97, F98 and the counters F99–F102. See the Conflicts list on years in media.

**v4:** three counters, F99–F101 (network figures on both the live site and S7, attached to no creator). "16+ years in media" (F102, and F18 in the old hero) is off the page and retired: on S7 it is the career length of the lead S7 names (`index.html:1026`), not a company figure. The wide-screen ledger is 2 + 1, with 13+ in its old cell (row 2, column 1), clear of the faces; no CSS change.

## IX · Directors: short bios ★

Keep F104, F105, F106, F107 and the marquee. The site never says which portrait is which (F106 note), so the bios sit under the names list, not under a face. **No public source gives either director's background**, so the bios cannot be written without inventing. Below is what can be said, plus a template for the client.

**v4 (S8):** the role lines are the client's own words: Olayinka Lawal, **Co-founder and CTO, WealthMotley** (F137); Gbenga Sosanya, **Board member** (F138). No `data-draft`. The bio slots stay empty (an empty slot renders nothing). DC91 and the "Leadership experience from" credits row (F54–F59) are **removed**: on S7 those five names are, one for one, the roles of the lead S7 names (`index.html:541–571`, `1026–1044`), whose bio the client asked us to leave out. Next to the only two people the site names, the row would read as their experience wherever it sat, and as employers (not clients or partners) it has no company-level rewording. If someone at the company today holds that experience, it comes back inside that person's bio, spelt "MultiChoice" (the company's own styling) and "Africa Magic" (S7 has "African Magic", `:565`). The title "Directors" and the deck F105 stay (the live site's lines); see question 1 below.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC90 | Director | **dropped** (v4: replaced by F137, F138, the client's roles) | use | Role line under each name | S1 F104; S2: Singular of F104 "Directors"; S2 lists each as "Director". The live site gives no other title (F106 note: no Founder/CEO). |
| DC91 | Between them, leadership experience from YouTube, Paramount, Multichoice, Africa Magic and Circo Live. | **dropped** (v4: credited one person's CV to these two; must not return) | use | Shared line under both names | S1 F54–F59: Restates F54–F59. Assumes the two directors are "the leadership" F54 refers to: confirm. If used, move the credits row out of Brands so the line appears once. |
| DC92 | Creator management and commercial growth | **dropped** (v4: no source, not in S7 either; the client gave roles) | optional | Candidate focus line (to confirm and assign per director) | S2: (search summary) says the directors focus on "creator management and commercial growth" but not who does which. Do not render until the client assigns it. |

**Round 2 (S9):** the board is Creative Motley's and has more members than the two named, who stay the only two on the page for now. F105 ("The two people answerable for all of it.") implied they are the whole board, so it is retired and the dek is **F149, "Two of the people answerable for all of it."**: the live site's own line with the smallest change that makes it true (the drop cap stays T). Not "Two of the board" (Olayinka Lawal's board seat is not stated) nor "who run Creative Motley" (no such role was given). The credits row and "16+ years" stay off: S9 says only Sholz had that experience and she will be added later; nothing about her is on the page or in the copy now.

**Bio template (client to fill; nothing here is rendered until filled):**
- **Olayinka Lawal**, Co-founder and CTO, WealthMotley. *[What Olayinka Lawal leads at Creative Motley, in one line.]* *[One line of background before Creative Motley: where, and what.]*
- **Gbenga Sosanya**, Board member. *[What Gbenga Sosanya does on the board, in one line.]* *[One line of background before Creative Motley: where, and what.]*

Keep each bio to 20–25 words, without superlatives or audience figures. If the five credits (F55–F59) are split between the two directors, the client says which belong to whom. Otherwise use DC91 for both. **v4: superseded.** DC91 is dropped and the credits are retired; they return only inside the bio of whoever actually holds them.

## X · Apply

Keep F108–F122 (the pill, the marquee, the email and the stickers). Add DC100 and DC101 above "Apply to join". DC03 (reach) can sit here instead of Storytellers if Storytellers runs long.

**v4:** DC100 and DC101 are S7's FAQ lines, approved. Every contact point stays info@creativemotley.com (F109; S7's only address too, `index.html:1291`, `1429`); S7's Formspree form (`:1303`) is not used. The "Apply to join" mailto is unchanged in both places (top bar and Apply): a prefilled body was considered and left out, since one pill would then behave differently from the other, and the S7 form's "Brand / Agency" option would send brands to the creator application when they have "Brief our team ↗" (F49).

**Round 2 (S9):** no change. 24/7 support went to Creators (F148), not here: one sentence once, and Apply's paragraphs are about joining. S7's "We typically respond within 24-48 hours" (`index.html:1393`) and the results timing were not confirmed and stay off.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC100 | For established creators, filmmakers, studios and content owners who already have traction and want to build a sustainable business. | **approved** (v4) | use | Who we work with (above "Apply to join") | v4: S7 `index.html:1206` (FAQ "Who do you work with?"), opening "For…" so the page has one "We work with" paragraph (DC03); "media companies" → "studios" (S7's own word, `:590`) so it does not repeat the deck F111; "YouTube" dropped. Was: "We work with established creators, filmmakers, media companies and content owners who already have traction and want to build a sustainable business." S2: Near-verbatim S2 (FAQ): "We work with established YouTube creators, filmmakers, media companies and content owners who have existing traction and want to build a sustainable business." |
| DC101 | Apply with your channel details. We review each application and, if there is a fit, book a discovery call. | **approved** (v4) | use | How applying works | v4: S7 `index.html:1258` (FAQ "How do I get started?"). S7's "We typically respond within 24-48 hours" (`:1393`) is not added: a promise to confirm. S2: Close paraphrase of S2 (FAQ): click "Apply to Join" and submit your channel details; the team reviews it and, "if we see a fit, we’ll schedule a discovery call". |
| DC102 | We work with creators who treat this like a real business. | **dropped** (v4: overlaps DC100 and the deck) | optional | Closing line before the marquee | S2: Near-verbatim S2: "We work with creators who treat this like a real business." |

## Conflicts and open questions for the client

1. ~~**Years in media.**~~ **Settled (v4):** both figures are Sholz S. Laelle's, not the company's: "16+ years building content…" is his bio line (S7 `index.html:1026`) and "Over 17 years commissioning and launching films, series and digital originals" (`:746`) was his card (the Next.js version of the same card still reads "We've commissioned 120+ films and 30+ series at Multichoice", S7 `src/app/page.tsx:47`; the static page carried it too until commit f596e5c, per the repo history read for this round). F18 and F102 are retired; neither number is on the page.
2. ~~**"150+ TV / series".**~~ **Settled (v4):** not used. It is his 120+ TV movies and 30+ shows (S7 Next.js `src/app/about/page.tsx:37`), not a company figure.
3. **S2 lines generally.** Every S2 string (DC02, DC03, DC31, DC80, DC100–DC102, and the service names) comes from an earlier version of the client's own site, seen only through search summaries. Ask the client to confirm each is still how they describe the business. **v4:** checked against S7, the site itself; the lines now on the page that are S7's wording are approved (DC01, DC03, DC31, DC37, DC100, DC101). The service descriptions are still ours (drafts).
4. **Directors.** Who leads what ("creator management" or "commercial growth", DC92), one line of background each, and whether "Between them, leadership experience from…" (DC91) is accurate for the two of them. **v4:** roles given (S8); DC91, DC92 dropped. Still open: is "the board" Creative Motley Ltd's, and is WealthMotley part of Creative Motley Ltd? If the board has other members, or the two of them are not the whole leadership, F105 ("The two people answerable for all of it.") should change. Bios of 20–25 words each, if wanted.
4b. **Round 2 (S9), settled:** "the board" is Creative Motley's, with more members (F149 replaces F105); the credits are Sholz's alone (added later, in her own bio); the descriptions are approved; 24/7 support is true. **Still open:** whether WealthMotley is part of Creative Motley Ltd; bios; the labels DC10 and DC32; the roster spellings (Ariyiike Dimples, Brain Jotter, Gold Screen TV); Brain Jotter's main channel (we think @BrainJotterComedian); newer videos for Emmabel TV, Royal Arts TV or Abayomi Alvin, if wanted (their picks date from late 2024 to late 2025); and oEmbed on all nine new ids (and the seven cards) once YouTube can be reached, Brain Jotter's first.
5. **Showreel and brand video.** Is there a reel ("Success Stories Reel", S2) or a brand-campaign video that can be played? The YouTube channel linked from the site (@creativemotley, F121) could not be opened from here.
6. ~~**Monthly reporting.**~~ **Settled (v4):** S7 lists "Monthly performance reviews" (`index.html:637`). DC18 stays a draft only because its wording is ours.
7. **Live-site counter.** The live Showcase reads "01 / 06" over seven posters; the rebuild's "01 / 07" (F72) is right.
8. **Legal entity.** For the Organization JSON-LD, is "Creative Motley Ltd" (F05) Companies House 16849905? This is optional; leave it out if unsure.

## For builders

- Render drafts exactly as written: the fact check matches substrings, so a changed word fails to trace. Curly apostrophes (’) are deliberate.
- Each "Name — line" draft is one fact. Render the name and the line in separate elements if the design wants (both trace), but keep the pair together.
- Once the client approves a string, flip its `kind` in facts.json from `draft` to its real kind (`positioning`, `service`, `ui-copy`…). A dropped string gets `kind: "dropped"` and a `retired` note (v4): it no longer traces, so the fact check fails if it comes back. Interface labels (DC61, DC62, DC85–DC88) and the camera part names (DC41–DC52) can move to `docs/ui-strings.json`, as with the Kit parts.

## All sources consulted

**Company and directors**
- https://creativemotley.com/ (S1, live HTML, fetched with curl on 2026-10-19; S2, earlier version via WebSearch summaries restricted to creativemotley.com)
- https://find-and-update.company-information.service.gov.uk/company/16849905 (S4, search result only)
- https://www.crunchbase.com/organization/creative-motley-ltd (search result only; a "Creative Motley" finance app, WealthMotley; may be unrelated)
- Rejected as unconfirmed (several different people share the name; none is tied to Creative Motley): https://www.linkedin.com/in/olayinkalawal0705/, https://www.linkedin.com/in/olayinka-lawal-a3839833/, https://www.crunchbase.com/person/olayinka-lawal. No result was found for Gbenga Sosanya beyond creativemotley.com.

**Creator videos (ids; details and verification in docs/videos.json)**
- Layi Wasabi: https://www.youtube.com/watch?v=6aheOxb7GPU, https://www.youtube.com/watch?v=gc_CdEdEVrQ
- Omoni Oboli TV: https://www.youtube.com/watch?v=H9qoC981BAU, https://www.youtube.com/watch?v=OQQaDqLCgKg
- Isbae U: https://www.youtube.com/watch?v=nOedKYSXuPU, https://www.youtube.com/watch?v=U-xB3IOipac
- Broda Shaggi: https://www.youtube.com/watch?v=MTZlMqXgUZA, https://www.youtube.com/watch?v=HcZDHLW7cKA
- Diary of a Naija Girl: https://www.youtube.com/watch?v=2FY9NcE2lbw, https://www.youtube.com/watch?v=7OBeFS70vpg
- Kie Kie: https://www.youtube.com/watch?v=QoZJOlmynbw, https://www.youtube.com/watch?v=RdlXuz1_iKo
- Kunle Afolayan: https://www.youtube.com/watch?v=7A3M-n54gG8, https://www.youtube.com/watch?v=bebw28CTnHA
- Emmabel TV (round 2): https://www.youtube.com/watch?v=2SgtAvc1HV8; channel https://www.youtube.com/@EmmabelTV247
- Royal Arts TV (round 2): https://www.youtube.com/watch?v=ScAcee_5Q4A; channel https://www.youtube.com/@RoyalArtsTV
- Biodun Stephen (round 2): https://www.youtube.com/watch?v=vuJBH0QyxZk; channel https://www.youtube.com/@BIODUNSTEPHENTV
- Bolu Essien (round 2): https://www.youtube.com/watch?v=8NM-yaMdmeg; channel https://www.youtube.com/@BoluEssien
- Ariyiike Dimples (round 2): https://www.youtube.com/watch?v=pb2jiuqmAms; channel https://www.youtube.com/@RiskyStudiosTV
- Officer Woos (round 2): https://www.youtube.com/watch?v=bx0QofHIX68; channel https://www.youtube.com/@OFFICERWOOS
- Brain Jotter (round 2): https://www.youtube.com/watch?v=menYRpHwVdM; channel https://www.youtube.com/@BrainJotterComedian
- Gold Screen TV (round 2): https://www.youtube.com/watch?v=eRfM081tX0I; channel https://www.youtube.com/@GoldScreenTV-NG
- Abayomi Alvin (round 2): https://www.youtube.com/watch?v=bzpqmWl8sE4; channel https://www.youtube.com/@AbayomiAlvinTv

**Articles and listings used to choose and check the videos**
- https://nation.africa/kenya/life-and-style/buzz/layi-wasabi-became-africas-favourite-struggling-lawyer--5413438
- https://www.zikoko.com/pop/omoni-oboli-youtube-romance-movies/
- https://filmflux.app/movie/cd17fd9f-59db-45d7-bcd4-d15feb24ff9a-love-was-not-invited
- https://www.youtube.com/post/UgkxJ31jwSl8qCrDVtibuqTlP62IHMm_jUkJ
- https://www.pulse.ng/story/omoni-obolis-love-in-every-word-sequel-1-million-views-reaction-2025102511574512966
- https://thewittyreview.medium.com/movie-review-love-in-every-word-the-wedding-56f5e0732de1
- https://newtelegraphng.com/rmd-slams-isbae-u-for-calling-him-by-his-first-name/
- https://www.talktalknigeria.com/home/2025/4/12/rmd-claps-back-at-isbae-u-on-curiosity-made-me-ask-show-dragging-late-father-into-the-mix
- https://www.informationng.com/2025/04/my-father-had-five-wives-having-just-one-feels-unfair-rmd.html
- https://podcasts.apple.com/ng/podcast/former-president-olusegun-obasanjo-on-curiosity-made/id1888130719?i=1000791031097
- https://www.legit.ng/entertainment/celebrities/1731714-former-president-obasanjos-unexpected-appearance-isbae-us-podcast-leaves-talking/
- https://podcasts.apple.com/ng/podcast/bisola-aiyeola-speaks-on-intentional-friendships-dear/id1888131074?i=1000757479765
- https://open.spotify.com/episode/7jFrUCxhxkNlUk5TvJzsx9
- https://pmnewsnigeria.com/2026/07/17/bisola-aiyeola-opens-up-on-loyalty-friendship-dynamics/
- https://leadership.ng/kiekie-marks-birthday-with-simple-but-meaningful-request/
- https://www.legit.ng/entertainment/celebrities/1715522-gift-i-kiekie-marks-birthday-special-request-fans/
- https://www.partyjolloftv.com/movies/heated-passion-1439
- https://filmefiko.com/cinema/kunle-afolayan-is-bringing-2009-movie-the-figurine-to-youtube/
- https://whatkeptmeup.com/nigerian-film-industry-articles/after-a-netflix-focused-era-kunle-afolayan-brings-recall-to-the-big-screen/
- https://www.qed.ng/kunle-afolayan-brings-the-ceo-to-youtube/
- https://filmefiko.com/news/kunle-afolayan-the-ceo-rerelease/
- https://www.youtube.com/@Isbae_u, https://www.youtube.com/@diaryofanaijagirl, https://www.youtube.com/@kapstream_tv, https://www.youtube.com/user/kafolayan (channel pages, via search; not opened)

**Round 2 (2026-10-24): sources for the nine new creators** (search index only; full evidence per item in `docs/videos.json`)
- https://www.instagram.com/emmabeltv247/
- https://www.facebook.com/p/Emmabel-TV-247-61573221740117/
- https://filmflux.app/channel/emmabeltv247
- https://filmflux.app/movie/52f1c324-da60-42f3-b9c3-b889541a356f-love-and-kasala
- https://www.threads.com/@sonia_uche/post/DPQntw-kZb-
- https://www.threads.com/@kunleremiofficial/post/DPhkwQVkt8G
- https://www.nollywoodtimes.com/2025/10/movie-review-love-and-kasala-charm.html
- https://filmflux.app/channels/RoyalArtsTV
- https://en.wikipedia.org/wiki/Emem_Isong
- https://x.com/BiodunStephenO/status/1974199086795624732
- https://filmflux.app/channels/BIODUNSTEPHENTV
- https://shutterspeedprojects.com/biodunstephen-tv/
- https://en.wikipedia.org/wiki/Biodun_Stephen
- https://videoblogs.com/entertainment/biodunstephen-tv-finding-my-way-nigerian-movies-2025-latest-full-movies
- https://www.premiumtimesng.com/entertainment/nollywood/829132-movie-review-biodun-stephens-uninvited-bride-thrills-despite-predictability.html
- https://nollywood.com/movies/uninvited-bride
- https://filmflux.app/movie/68b247a5-0685-4673-96a5-f0d8bc3943fc-uninvited-bride
- https://x.com/boluessien
- https://guardian.ng/life/film/bolu-essien-brings-boarding-school-drama-to-life-with-girls-hostel/
- https://www.bellanaija.com/2026/02/nostalgia-meets-drama/
- https://www.pulse.ng/story/girls-hostel-by-bolu-essien-shows-the-secondary-school-power-play-that-never-really-leaves-us-2026042309201076734
- https://odunews.com/2026/04/bolu-essien-writes-produces-and-stars-in-girls-hostel-drama/
- https://x.com/Ariyiikedimples
- https://en.wikipedia.org/wiki/Ariyike_Owolagba
- https://en.wikipedia.org/wiki/Officer_Woos
- https://www.tiktok.com/@officerwoos
- https://en.wikipedia.org/wiki/Brain_Jotter
- https://us.youtubers.me/brainjotter-comedian/youtube-estimated-earnings
- https://filmflux.app/channels/goldscreentv-ng
- https://www.tiktok.com/discover/taye-arimoro-and-his-twin-sister
- https://m.imdb.com/title/tt39300960/
- https://www.zikoko.com/pop/best-nollywood-movies-on-youtube-december-2025/
- https://culturecustodian.com/my-life-in-nollywood-abayomi-alvin/
- https://thenicheng.com/why-nollywood-actors-are-taking-their-films-to-youtube-abayomi-alvin/
- https://kolaolaiya.com/2024/12/29/the-little-things-2024/
- https://www.ngmovies.com.ng/the-little-things-2024/

**Could not be reached from this session (not routed around):** youtube.com and its oEmbed endpoint, i.ytimg.com, web.archive.org, find-and-update.company-information.service.gov.uk (egress proxy 403). WebFetch failed DNS for every host, including creativemotley.com.
