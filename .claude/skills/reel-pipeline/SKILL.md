---
name: reel-pipeline
description: House style, file contracts and motion-kit API for this project's vertical explainer reels (Remotion + React Three Fiber + ElevenLabs). Load whenever writing a brief, script.json, a Scene.tsx, or reviewing a render.
---

# Explainer reels — house rules

First run? There's no project to make reels about yet — run `/onboard` first. It interviews you
about your brand, niche, audience and goals and writes `engine/src/profile.json` +
`engine/src/brand.json` + `research/house-style.md`, which every agent below reads. Everything in
this file is the part that stays the same across niches; your specifics live in those three files.

Reference dissection method: `research/style-bible.md` (read it once). The five rules that hold
regardless of niche:

1. **One continuous 3D world, one continuous camera — zero cuts.** Scenes are camera glides
   (`cameraPath` shots) between places in the same world.
2. **Every number becomes an object** (counter, flip board, ring, skyline rising, pins).
3. **Visuals land on the spoken word** — every timing is `cue(beat, word)`; never a hard-coded frame.
4. **Captions: 2–3 word pages**, one tinted keyword (`*word*` in the script), dark pill, lower third.
5. **Hero numerals** overlay the 3D on the word that says them.

Pacing defaults (override in `profile.json.pacing`): 130–140 wpm (ceiling 145). Pauses ≥ 0.3 s,
0.5–0.7 s before a punchline; speed-up ≤ ×1.05. Picture: each idea holds ≥ 3 s, camera glides
1.5–2.5 s then holds ≥ 2 s, one new element per sentence, effects on key beats only. First word at
0.00 s, 30–45 s total, 75–90 words, end card 2.6 s. The payoff (tied to `profile.json.goals`) goes
in the LAST beat, not the first.

## Pipeline & files

```
episodes/<slug>/brief.md        Strategist: angle, hook, fact sheet (claim → source URL), compliance notes
episodes/<slug>/script.json     Writer: beats (see schema below)
engine/public/episodes/<slug>/  npm run vo: vo.mp3 + timeline.json (word timings)
engine/src/episodes/<slug>/Scene.tsx   Animator; must `export const Scene` (Root auto-discovers it, no registry)
engine/out/<slug>.mp4           Editor render;  out/<slug>-qa.png contact sheet
episodes/<slug>/qa.md           Editor verdict + post description
```

Commands (run in `engine/`):

| step | command |
| --- | --- |
| silent animatic timing | `npm run vo -- <slug> --draft` |
| real voiceover (ElevenLabs) | `npm run vo -- <slug>` (key in root `.env.local`; SDK `@elevenlabs/elevenlabs-js`, timestamps per character) |
| typecheck | `npx tsc --noEmit` |
| one still | `npx remotion still <slug> out/<slug>-f<N>.png --frame=<N>` |
| preview render | `npx remotion render <slug> out/<slug>-preview.mp4 --scale=0.5` |
| final render | `npx remotion render <slug> out/<slug>.mp4` then `npm run master -- <slug>` (−16 LUFS, ≤ −4 dBTP) |
| QA sheet | `npm run qa -- <slug> [video]` |
| SFX library | `npm run sfx:sync` (SFX Kit, pinned + checksummed → `public/sfx-kit/`; read its `GUIDE.md`, `catalogue.md`) |
| re-master VO without credits | `npm run vo -- <slug> --reuse` (re-processes the last ElevenLabs take) |
| rebuild map data (only if `profile.json.world.map`) | `npm run geo` (after refreshing `data/osm/*.json` from Overpass; bbox/origin in `src/kit/geo.ts`) |
| render while other agents run | wrap renders in `flock /tmp/reel-pipeline-render.lock …`, TTS in `flock /tmp/reel-pipeline-tts.lock …` |

## script.json schema (validated by scripts/voiceover.ts)

```jsonc
{
  "slug": "example",                   // = folder name, [a-z0-9-]
  "kicker": "DEMO · PLACEHOLDER",       // top pill default
  "endCard": true,
  "voice": {"voiceId": "...", "modelId": "eleven_v4", "stability": 0.5, "similarityBoost": 0.75},  // all optional; defaults come from profile.json
  // style / speed only on v2/v3 models (e.g. "eleven_multilingual_v2"); on eleven_v4 pace with punctuation and audio tags
  "beats": [
    {
      "id": "hook",                    // [a-z0-9-], used by cue()
      "kicker": "WEEK 1 · WEEKLY ACTIVE USERS",   // optional, switches the pill from this beat on
      "text": "Picture this: your product just crossed *10,000* weekly users.",
      "visual": "HeroStat 10,000 on '10,000'; sub 'weekly active users'"  // Writer → Animator note
    }
  ]
}
```

Writing rules: `*…*` marks the caption keyword (asterisks are not spoken). Write numbers as digits when
they should appear as digits in captions ("90 days", "20.5 billion"). Spell out anything TTS might
misread (currency codes, abbreviations). Words used as cues must be unique-enough within their beat,
or use `nth`.

## Motion kit (engine/src/kit)

| import | what |
| --- | --- |
| `useCue()` → `cue(beat, word?, nth?)`, `cue.end(beat)`, `cue.voEnd` | frame numbers bound to the VO; throws if a word is missing |
| `cameraPath(shots, fps)` + `<CameraRig path>` | continuous camera; shot = `{at, dur, pos, look, fov, arc, drift}` |
| `<NightLights>` `<Ground>` | the generic backdrop (fog/lighting + a plain dark ground plane) — use these unless `profile.json.world.map` is true |
| `useGeo()` `<WorldMap geo>` `<MetroContext geo>` `<NightLights>` | **optional**, only if `profile.json.world.map`: loads `public/geo/world.json` (OSM roads, land, water, transit lines, stations; 1 unit = 100 m, x east, z south) |
| `<RouteLine points from to>` | glowing route drawing itself (map only) |
| `<Train points keys=[{at,t}]>` + `nearestParam(points, xz)` | a light travelling a route, reaching stations on cue (map only) |
| `<StationPin x z at>` `<CatchmentRing x z radius at>` | pop-in markers, walking-radius rings (map only, but just take x/z so they work on any ground plane) |
| `<District x z radius count at seed maxHeight avoid>` | procedural towers rising centre-out — works with or without the map, a good generic "growth" visual |
| `<HeroStat at until value from pre suffix sub decimals>` | big numeral, counts up (from `from`, default 0) |
| `<FlipBoard at until title text>` | split-flap board (dates, codes) — keep `text` short (≤ ~10 characters), it doesn't wrap and will run off-frame |
| `<MapLabels path labels=[{text, sub, at, until, world, side}]>` | HTML label pinned to ANY 3D point via the camera projector — doesn't require the map |
| `<Disclaimer text>` | small print |
| `EpisodeShell` (automatic via Root) | VO, music bed, captions, kicker, end card, draft badge |
| `<Sound id at gainDb rate>` | SFX Kit sound whose sync point lands on frame `at`; ducks itself under speech by the kit's `under_voiceover_db`; `id` is type-checked |
| `<CameraWhooshes path>` | a soft whoosh at the fastest point of every camera glide (sized to the move) |
| `<Tower x z floors scan marks riseAt>` + `floorY()` (kit/props) | per-floor tower; floors light up on cue; scan plane sweeps up |
| `<ValueColumns points at stagger maxHeight>` (kit/props) | columns on the ground, height ∝ value |
| `<LineChart series at drawFrames marks>` `<RankList items>` (kit/Charts) | self-drawing chart; ranked bars, one per cue |
| `<Mo path actions moods scale facing>` (kit/characters) | a channel mascot: walk/wave/shrug/facepalm/point/cheer/shock/phone/sit; moods happy/neutral/shock/sad/annoyed — give him a path with a hold waypoint before and after any "walk off" move, or `poseOnPath` interpolates a slow drift the entire span |
| `<ToyCar path kind color braking blink driver>` + `poseOnPath()` (kit/characters) | low-poly sedan/suv/taxi; wheels spin with distance; brake lights; flashing beacon |

`until` (HeroStat, FlipBoard, MapLabels) is the frame by which the element is fully gone, so the next
one can enter on that same cue without overlapping. When two elements' `at`/`until` windows overlap in
the same screen region, stagger them — see `engine/src/episodes/example/Scene.tsx` for a worked fix
(a HeroStat/District collision and a FlipBoard/MapLabel timing overlap, both resolved by moving one
element's window).

Remotion rules that bite: never `useFrame()`; animate only from `useCurrentFrame()`; `<Sequence layout="none">`
inside `<ThreeCanvas>`; load data with `delayRender`. Load the `remotion-best-practices` skill for anything else.

## Sound

Every episode has `engine/src/episodes/<slug>/Sound.tsx` (sound-designer), rendered from Scene.tsx.
One sound per on-screen event, on the same cue as the visual; nothing on every word. Library: SFX Kit
(Wyzowl, CC0, 320 sounds with sync points and mix data) — choose by `GUIDE.md` §1 "On screen → Sounds".
Mix priority: voice > SFX > music. The VO is pre-levelled so the mix lands near −16 LUFS; `npm run master`
pins the exported MP4 to −16 LUFS / ≤ −4 dBTP and prints stereo + mono numbers. Claude can't hear: report
numbers and 5 timestamps for a human, never "it sounds good". Method reference: the `sound-effects` skill.

## Compliance

Whatever your niche legally requires on screen or in the post — a licence number, a disclosure,
an age rating — goes in `engine/src/brand.json`'s `disclosures` array (and `qrImage`/`qrLabel` if you
need a QR code) and `engine/src/profile.json`'s `compliance` array. If both are empty, there's nothing
required — but keep any projection ("could grow by X") hedged and attributed regardless, and never
state a projection as settled fact. When the optional map is used, description ends with
"Maps simplified · © OpenStreetMap contributors".
