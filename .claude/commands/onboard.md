---
description: Set up this project for your own brand, niche and goals (run once before the first /reel)
argument-hint: (no arguments — this is an interview)
---

Interview me, then write `engine/src/brand.json`, `engine/src/profile.json` and
`research/house-style.md`. Don't load the `reel-pipeline` skill's full SKILL.md for this — it's
written for making an episode, not for this interview — but do read the current contents of those
three files plus `engine/src/kit/theme.ts` (the default palette) first, so you know what you're
filling in and can show me the current state before asking.

Ask me, one topic at a time (a short back-and-forth beats one giant form):

1. **Brand** — name, tagline, the call to action on the end card (e.g. "Follow for the next one"),
   and whether I want a brand colour (if so, which hex, or describe it and pick one — it goes in
   `engine/src/kit/theme.ts`'s `C.accent`/`C.accentSoft`, which is also the caption-keyword tint).
2. **Niche & audience** — what my reels are about, and who's watching / what they care about.
3. **Goals** — reach, lead-gen, education, brand — whatever makes a payoff line land for me. This
   drives the Writer's last beat and the Strategist's angle criteria.
4. **Research sources** — the authoritative sites for my niche (the equivalent of a government
   statistics office or an industry body) that the Strategist should prefer over news aggregators.
5. **Compliance** — anything that legally has to appear on screen or in the post description for my
   kind of content (a licence number, a disclosure, an age rating). If genuinely none, that's fine —
   leave it empty, but say so explicitly rather than assuming.
6. **Voice** — an ElevenLabs voice ID if I have one picked (Voice Library → copy the ID), otherwise
   leave it blank and the kit falls back to a default narrative voice. Also confirm the model id if
   I want something other than `eleven_v4`.
7. **Real-world map** — is any of my content tied to real places (a city, a region)? Most niches say
   no — in that case `world.map` stays `false` and episodes use the plain backdrop (`<NightLights>` +
   `<Ground>`). If yes: get the rough bounding box (south/west/north/east lat-lon) and a centre point,
   write them into `engine/src/kit/geo.ts`'s `BBOX`/`ORIGIN` constants (same convention as the
   palette — edit the file directly, not a config value), set `world.map: true` in `profile.json`,
   and tell me to fetch OSM data into `engine/data/osm/*.json` (roads.json, coast.json, water.json,
   rail.json, places.json via Overpass) then run `npm run geo` before the first map-based episode.

Then write:

- `engine/src/brand.json` — `name`, `tagline`, `contact`, `disclosures` (array, can be empty),
  `qrImage`/`qrLabel` (optional, blank if no QR).
- `engine/src/profile.json` — `niche`, `audience`, `goals`, `pacing` (keep the shipped defaults
  unless I asked to change the pace), `voice`, `sources`, `compliance`, `world.map`.
- `research/house-style.md` — a short doc (not a replacement for `style-bible.md`'s five rules):
  my niche's voice (formal/casual, sentence length), any pacing I asked to change and why, and the
  compliance rules spelled out in plain language for the Strategist/Editor to check against.

Show me the three files' final contents before finishing, and tell me to re-load the
`reel-pipeline` skill (or just start a fresh `/reel`) so the pipeline picks up the new config. If
I want to change my mind on anything later, I can just run `/onboard` again — it should read the
existing files and treat this as an update, not start over blank.
