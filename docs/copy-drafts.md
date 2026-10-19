# Copy drafts: v3 (Track C)

Fuller copy for each chapter, for the client to approve. Plan: `docs/v3-plan.md` §5 (★ items) and §9. Researched and drafted 2026-10-19.

**How to read this.** Every string has an ID (DC…) and is also in `docs/facts.json` with `kind: "draft"`, so a builder can render it and the fact check can trace it. Nothing here is approved yet.
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
- **S6, camera anatomy.** General camera part names, matched to what the exploded render shows (`public/assets/teardown/camera/poster.webp`). These are descriptive labels, not claims, like the Kit part names in `docs/ui-strings.json`.
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

- **Creators** runs slightly over the target, even with the command-cloud items and "Reporting" left optional. If it reads dense, cut "SEO" and "Thumbnails" (the chatter cards already show both) or give the paper 280 vh.
- **Directors** stays light until the client supplies the two bios: about 20–25 words each would bring it to about 35 per screen.
- **Showcase** is meant to be carried by the video cards, not by text.

## Hero and film beats

No change. Keep F08 and F07 as the dek and F12 → F13 → F14 as the beats. The Organization JSON-LD `description` should use the live meta sentence F06 verbatim.

## I · Storytellers: who we are ★

Keep F20, F21 and the three ways in (F22–F25). Add DC01 (or the shorter DC02) as the paragraph under the diagram, then DC03.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC01 | Creative Motley is a creator service provider. We run YouTube channels as businesses for Africa’s creators, filmmakers and media owners: not a traditional network, but a team that takes on the strategy, the programming, the rights and the revenue, on clear terms, so the people making the work can keep making it. | **draft** | use | Who we are (paragraph under the three ways in) | S1 F06, F111; S2: Paraphrase. F06 "Africa’s creator service provider — helping creators, filmmakers and media brands turn views into long-term revenue"; F111 "We turn channels into media companies."; S2 "a Creator Service Provider (CSP), not a traditional MCN. We offer hands-on strategy, management and monetization support with transparent terms" and its service list "strategy, SEO, thumbnails, programming, monetization, rights and reporting". The last clause is reasoning, not a quote. |
| DC02 | A creator service provider, not a traditional network: hands-on strategy, management and monetisation, on transparent terms. | **from site** | alt | Who we are (short alternative to DC01) | S2: Near-verbatim S2: "Creator Service Provider (CSP), not a traditional MCN. We offer hands-on strategy, management and monetization support with transparent terms." Changes: MCN → network (plain English), UK spelling. |
| DC03 | We work with creators and content owners anywhere who make work for African audiences or the diaspora. Our network spans Africa, the UK, the US, Europe and beyond. | **from site** | use | Reach (one line after DC01; or in Apply) | S2: Near-verbatim S2 (FAQ, "Is it only African creators?"): "We work with creators and content owners globally who create content for African audiences or the African diaspora. Our network spans Africa, UK, US, Europe and beyond." |

## II · Creators: services ★, more command-cloud items ★

Keep the feature block (F39–F43), the notes fan and the Media Owners block (F44–F46). Add the services list (DC10–DC18) after the Creators block and DC19 under Media Owners. The new cloud items (DC21–DC30) carry no figures, names or times, unlike F26/F27/F34, which came from the site.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC10 | What we run | **draft** | use | Services list label | —: Label for the services list; echoes F111/F08 "run like media companies". |
| DC11 | Channel strategy — What the channel is for, and what it makes next. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 lists "strategy" first in its service list. |
| DC12 | Programming — Series, formats and the order they go out. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 service list: "programming". Kept distinct from F83 (upload calendar), which stays in Process. |
| DC13 | SEO — Written so the right viewer finds the work. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 service list: "SEO". |
| DC14 | Thumbnails — Designed and tested: the click comes first. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 service list: "thumbnails"; F32 "/thumbnail-test", F27 (A/B chatter). |
| DC15 | Monetisation — Ads and sponsorship, set up so views pay. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2: "ad optimisation and sponsorships"; F07 "Turn views into long-term revenue." |
| DC16 | Rights and Content ID — Re-uploads found, claimed and earning for you. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2: "Rights & Content ID — protect IP and monetise reuploads"; F30, F37 (rights chatter). |
| DC17 | Brand deals — Access to the brand briefs that come to us. | **draft** | use | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2: "access to brand deal pipeline". |
| DC18 | Reporting — A monthly review of what moved and what changes. | **draft** | optional | Services list item (name — line) | S2: Service name from site (S2); the line is drafted. S2 service list: "reporting". One search summary also listed "monthly performance reviews"; a second could not confirm it, so "monthly" needs the client’s yes. |
| DC19 | Catalogue channels — Your film and TV library, launched and programmed on YouTube. | **draft** | use | Media Owners list item (under F44–F46) | S1 F44, F45; S2: F45 "Film, TV and digital IP, earning every month."; S2 describes a Media Owners offer for holders of "film, TV or digital IP" who want recurring YouTube income. |
| DC20 | Release order — Films and series released to build an audience, not dropped all at once. | **draft** | optional | Media Owners list item (optional second) | —: Reasoning from F82/F83 (series design, upload calendar) applied to a library. No source states it for catalogues. |
| DC21 | /metadata-pass | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC22 | /rights-sweep | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC23 | /sponsor-slot | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC24 | Re-upload found — claim filed | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC25 | Shorts cut from the long episode | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC26 | Chapters added to the new upload | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC27 | Series trailer scheduled | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC28 | Sponsor read approved | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC29 | Playlist reordered for the series | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |
| DC30 | Monthly review sent | **draft** | optional | Command cloud item (more chatter, plan §5 ★) | —: Illustrative studio chatter in the style of F26–F38, covering the services above. Deliberately no figures, names or times (no invented numbers). |

## III · Brands: how a brief runs ★

Keep F47–F49, the notes fan, "The room" and "The set". Add DC31 as the lead-in, then the five steps. **Recommendation:** move the credits row (F54–F59) to Directors, where "Leadership experience from" belongs (see DC91). Brands then stays about the brief.

**Brand video card:** no public brand-campaign video by Creative Motley was found. Ask the client for one, or for the reel S2 mentioned ("Success Stories Reel" / "Campaign Highlights 2024"). Until then, leave the card out rather than putting a creator's video under a brand heading.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC31 | We also work with brands and agencies looking to partner with African creators. | **from site** | use | Lead-in line above the brief steps | S2: Verbatim S2 (FAQ, "Who do you work with?"). |
| DC32 | How a brief runs | **draft** | use | "How a brief runs" label | —: Plan §5 ★ label. |
| DC33 | Brief — You tell us the audience, the message and the budget. | **draft** | use | Brief step (name — line) | —: F38 "Brand brief received — Lagos"; F24 "Brands — budget, no voice". Drafted. |
| DC34 | Match — We put forward creators from a vetted network whose audiences fit the brief. | **draft** | use | Brief step (name — line) | S2: "a curated network of vetted creators". |
| DC35 | Contract — One agreement and one point of contact, however many creators are on it. | **draft** | use | Brief step (name — line) | S2: "a single contract and point of contact"; F48 "One contract." (step named "Contract" so F48 is not repeated). |
| DC36 | Make — Made in the creator’s own voice, to your brief. | **draft** | use | Brief step (name — line) | —: Answers F24 "Brands — budget, no voice". Drafted. |
| DC37 | Report — Performance tracked and brand lift measured, from first upload to final report. | **draft** | use | Brief step (name — line) | S2: "Performance tracking & brand lift measurement"; S2 campaign management "from the brief through to reporting". |

## IV · Method: the camera, part by part ★

F61 + F62 open the chapter. The seven steps leave Method entirely. The spec list names the parts the exploded render actually shows, front to back. Each part has an approximate `data-anchor` uv on `teardown/camera/poster.webp` (read off the 1920×1080 poster; fine-tune against the render). The lines are descriptive camera anatomy: no sensor size, resolution, model or other spec is claimed. The plate art shows "SONY" and "α 7" (F133); nothing here names a maker.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC40 | Inside the instrument | **draft** | optional | Spec list label | S1 F62: Picks up F62 "…passes through one instrument…". Optional; the list can run unlabelled. |
| DC41 | Front element — The first glass the light meets. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.86 0.51 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.86 0.51 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC42 | Lens elements — Groups of glass that bring the image into focus. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.62 0.52 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.62 0.52 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC43 | Aperture — Overlapping blades that set how much light gets through. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.55 0.48 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.55 0.48 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC44 | Lens mount — A bayonet with electrical contacts: lens and body talk through it. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.485 0.48 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.485 0.48 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC45 | Body and grip — Dials, shutter button and the hand that holds them. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.33 0.52 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.33 0.52 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC46 | Viewfinder (EVF) — A small screen behind an eyepiece: the frame, at the eye. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.405 0.18 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.405 0.18 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC47 | Battery — A removable pack. Carry a spare. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.405 0.815 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.405 0.815 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC48 | Shutter — Times each exposure, just in front of the sensor. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.235 0.52 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.235 0.52 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC49 | Image sensor — Where light becomes a picture. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.225 0.50 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.225 0.50 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC50 | Stabiliser (IBIS) — In-body image stabilisation: the sensor moves to cancel shake. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.21 0.55 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.21 0.55 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC51 | Main board — The processor that turns what the sensor sees into files. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.155 0.50 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.155 0.50 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |
| DC52 | Rear screen (LCD) — For framing, menus and playback. | **draft** | use | Camera part (name — line); anchor ≈ uv 0.068 0.52 | S6: Descriptive camera anatomy naming what the exploded render shows (approx. uv 0.068 0.52 on teardown/camera/poster.webp); not a claim about any model or spec. Same status as the Kit part names in ui-strings.json. |

## V · Showcase: watch the work ★

Keep the poster room and F64–F72. Add the XXL video cards (thumbnail first, player in a modal only on click). Each card is the creator's name (F71-style, from F64–F70) plus the video title. Use the first video per creator (*use*) and the second as *optional*. All ids, channels and the verification status are in `docs/videos.json`. **None could be oEmbed-verified from this session**, so verify them before shipping (the command is in `videos.json`). Kunle Afolayan's second video (The CEO) is left out of facts because its id is unverified.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC60 | Watch the work | **draft** | use | Video section head | —: Plan §3.8 wording for the XXL video cards. |
| DC61 | Play video | **draft** | use | Video card button (UI) | —: Interface label; could move to ui-strings.json once approved. |
| DC62 | Watch on YouTube ↗ | **draft** | use | Video card link (UI) | —: Interface label; the ↗ matches F43/F46/F49. |
| DC63 | The Law vs. The Machine | **draft** | use | Video card title — Layi Wasabi | videos.json: Display form of the YouTube title "THE LAW VS. THE MACHINE" (id 6aheOxb7GPU). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC64 | Rugged Lawyer | **draft** | optional | Video card title — Layi Wasabi | videos.json: Display form of the YouTube title "RUGGED LAWYER" (id gc_CdEdEVrQ). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC65 | Love Was Not Invited | **draft** | use | Video card title — Omoni Oboli TV | videos.json: Display form of the YouTube title "LOVE WAS NOT INVITED - Nigerian Movies 2026 Latest Full Movies" (id H9qoC981BAU). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC66 | Love in Every Word 2: The Wedding | **draft** | optional | Video card title — Omoni Oboli TV | videos.json: Display form of the YouTube title "LOVE IN EVERY WORD 2 - THE WEDDING" (id OQQaDqLCgKg). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC67 | RMD on Curiosity Made Me Ask | **draft** | use | Video card title — Isbae U | videos.json: Display form of the YouTube title "RMD ON CURIOSITY MADE ME ASK!" (id nOedKYSXuPU). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC68 | Olusegun Obasanjo on Curiosity Made Me Ask | **draft** | optional | Video card title — Isbae U | videos.json: Display form of the YouTube title "Former President Olusegun Obasanjo on curiosity made me ask" (id U-xB3IOipac). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC69 | FDI: Federal Disturbance Intelligence, episode 1 | **draft** | use | Video card title — Broda Shaggi | videos.json: Display form of the YouTube title "FDI - FEDERAL DISTURBANCE INTELLIGENCE (Epi 1) Brodashaggi" (id MTZlMqXgUZA). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC70 | New Love Story | **draft** | optional | Video card title — Broda Shaggi | videos.json: Display form of the YouTube title "New Love Story" (id HcZDHLW7cKA). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC71 | Bisola Aiyeola on intentional friendships | **draft** | use | Video card title — Diary of a Naija Girl | videos.json: Display form of the YouTube title "Bisola Aiyeola speaks on Intentional Friendships" (id 2FY9NcE2lbw). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC72 | Kunle Remi on real-life marriage | **draft** | optional | Video card title — Diary of a Naija Girl | videos.json: Display form of the YouTube title "Kunle Remi on Real-Life Marriage Struggles" (id 7OBeFS70vpg). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC73 | Reheated Passion | **draft** | use | Video card title — Kie Kie | videos.json: Display form of the YouTube title "REHEATED PASSION \| Nigerian movies 2026 Latest full movies" (id QoZJOlmynbw). Verification: channel-confirmed, search index only (oEmbed could not run). See docs/videos.json. |
| DC74 | Dr Shaggi in Distress | **draft** | optional | Video card title — Kie Kie (with Broda Shaggi) | videos.json: Display form of the YouTube title "DR SHAGGI IN DISTRESS" (id RdlXuz1_iKo). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |
| DC75 | The Figurine: Araromire (2009) | **draft** | use | Video card title — Kunle Afolayan | videos.json: Display form of the YouTube title "The Figurine: Araromire (2009)" (id 7A3M-n54gG8). Verification: channel-probable, search index only (oEmbed could not run). See docs/videos.json. |

## VI · Process: the seven steps, each named once

The steps are F75, F78, F81, F84, F87, F90 and F93, each with its two lines (short F76…F94 + long F77…F95), all from the live site. **Recommendation:** with Method now on camera parts, Process is the only place the step names appear. Set each step as name | short line + long line in one row (the plan's "dense list with long lines"). Drop the "Chapter VI · Process" kicker (F73); the opener is F74. DC80 optionally adds S2's discovery call to the first step.

**Each step named once across the page:** Kit currently labels its runs "Production", "Sound", "Sound" and "Published" (step names). DC85–DC88 offer neutral labels instead. Or drop the labels and let the device name (a UI string) stand alone.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC80 | It starts with a discovery call: your goals, your content, your audience. | **from site** | optional | Optional third sentence for "Blank page" (after F76 + F77) | S2: Near-verbatim S2 ("How we work": "Discovery Call — unpack your goals, content and audience"). Its next step, "Channel audit — deep dive into analytics, SEO & monetization", is already F77. |

## VII · Kit: run labels (optional)

No new copy is needed: the device names and part names are UI strings already. These labels only replace the step names Kit borrows today.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC85 | On the desk | **draft** | optional | Kit run label for the console (replaces the step name used now) | —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |
| DC86 | At the mic | **draft** | optional | Kit run label for the microphone (replaces the step name used now) | —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |
| DC87 | In the ears | **draft** | optional | Kit run label for the headphones (replaces the step name used now) | —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |
| DC88 | In the hand | **draft** | optional | Kit run label for the phone (replaces the step name used now) | —: Kit currently labels its runs "Production", "Sound", "Sound", "Published" (step names), so steps are named twice on the page. Descriptive, no claim. |

## VIII · Results

No drafts. Keep F97, F98 and the counters F99–F102. See the Conflicts list on years in media.

## IX · Directors: short bios ★

Keep F104, F105, F106, F107 and the marquee. The site never says which portrait is which (F106 note), so the bios sit under the names list, not under a face. **No public source gives either director's background**, so the bios cannot be written without inventing. Below is what can be said, plus a template for the client.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC90 | Director | **from site** | use | Role line under each name | S1 F104; S2: Singular of F104 "Directors"; S2 lists each as "Director". The live site gives no other title (F106 note: no Founder/CEO). |
| DC91 | Between them, leadership experience from YouTube, Paramount, Multichoice, Africa Magic and Circo Live. | **draft** | use | Shared line under both names | S1 F54–F59: Restates F54–F59. Assumes the two directors are "the leadership" F54 refers to: confirm. If used, move the credits row out of Brands so the line appears once. |
| DC92 | Creator management and commercial growth | **draft** | optional | Candidate focus line (to confirm and assign per director) | S2: (search summary) says the directors focus on "creator management and commercial growth" but not who does which. Do not render until the client assigns it. |

**Bio template (client to fill; nothing here is rendered until filled):**
- **Olayinka Lawal**, Director. *[What Olayinka Lawal leads at Creative Motley, in one line.]* *[One line of background before Creative Motley: where, and what.]*
- **Gbenga Sosanya**, Director. *[What Gbenga Sosanya leads at Creative Motley, in one line.]* *[One line of background before Creative Motley: where, and what.]*

Keep each bio to 20–25 words, without superlatives or audience figures. If the five credits (F55–F59) are split between the two directors, the client says which belong to whom. Otherwise use DC91 for both.

## X · Apply

Keep F108–F122 (the pill, the marquee, the email and the stickers). Add DC100 and DC101 above "Apply to join". DC03 (reach) can sit here instead of Storytellers if Storytellers runs long.

| ID | String | Status | Use | Where | Source and reasoning |
|---|---|---|---|---|---|
| DC100 | We work with established creators, filmmakers, media companies and content owners who already have traction and want to build a sustainable business. | **from site** | use | Who we work with (above "Apply to join") | S2: Near-verbatim S2 (FAQ): "We work with established YouTube creators, filmmakers, media companies and content owners who have existing traction and want to build a sustainable business." |
| DC101 | Apply with your channel details. We review each application and, if there is a fit, book a discovery call. | **from site** | use | How applying works | S2: Close paraphrase of S2 (FAQ): click "Apply to Join" and submit your channel details; the team reviews it and, "if we see a fit, we’ll schedule a discovery call". |
| DC102 | We work with creators who treat this like a real business. | **from site** | optional | Closing line before the marquee | S2: Near-verbatim S2: "We work with creators who treat this like a real business." |

## Conflicts and open questions for the client

1. **Years in media.** The live site says "16+ years in media" (F18, F102). S2 said "17 years commissioning and launching films, series and digital originals". v3 keeps 16+; ask which is current.
2. **"150+ TV / series".** This S2 figure is not on the live site and is not used. Ask whether it should come back as a fifth counter in Results.
3. **S2 lines generally.** Every S2 string (DC02, DC03, DC31, DC80, DC100–DC102, and the service names) comes from an earlier version of the client's own site, seen only through search summaries. Ask the client to confirm each is still how they describe the business.
4. **Directors.** Who leads what ("creator management" or "commercial growth", DC92), one line of background each, and whether "Between them, leadership experience from…" (DC91) is accurate for the two of them.
5. **Showreel and brand video.** Is there a reel ("Success Stories Reel", S2) or a brand-campaign video that can be played? The YouTube channel linked from the site (@creativemotley, F121) could not be opened from here.
6. **Monthly reporting.** Is the monthly review (DC18) a real part of the service?
7. **Live-site counter.** The live Showcase reads "01 / 06" over seven posters; the rebuild's "01 / 07" (F72) is right.
8. **Legal entity.** For the Organization JSON-LD, is "Creative Motley Ltd" (F05) Companies House 16849905? This is optional; leave it out if unsure.

## For builders

- Render drafts exactly as written: the fact check matches substrings, so a changed word fails to trace. Curly apostrophes (’) are deliberate.
- Each "Name — line" draft is one fact. Render the name and the line in separate elements if the design wants (both trace), but keep the pair together.
- Once the client approves a string, flip its `kind` in facts.json from `draft` to its real kind (`positioning`, `service`, `ui-copy`…). Interface labels (DC61, DC62, DC85–DC88) and the camera part names (DC41–DC52) can move to `docs/ui-strings.json`, as with the Kit parts.

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

**Could not be reached from this session (not routed around):** youtube.com and its oEmbed endpoint, i.ytimg.com, web.archive.org, find-and-update.company-information.service.gov.uk (egress proxy 403). WebFetch failed DNS for every host, including creativemotley.com.
