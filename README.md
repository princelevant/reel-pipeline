# Reel Pipeline

A Claude Code skill + agent pipeline that turns a topic into a vertical (1080×1920) animated
explainer reel: one continuous 3D camera move, every number turned into an on-screen object,
animation locked word-for-word to a generated voiceover. Built on
[Remotion](https://www.remotion.dev/) + React Three Fiber + ElevenLabs.

It ships generic — no particular brand, niche or city baked in. Run `/onboard` once to tell it
about yours, then `/reel <topic>` to make an episode.

## What's in here

- `.claude/skills/reel-pipeline/SKILL.md` — house style, file contracts, the motion-kit API
- `.claude/agents/` — strategist → writer → animator → sound-designer → editor
- `.claude/commands/onboard.md` and `reel.md` — the two commands you actually run
- `engine/` — the Remotion project: a reusable motion kit (`src/kit/`) and one worked example
  episode (`src/episodes/example/`) with no real map and no real brand, so you can see every
  piece of the kit used before you build your own
- `research/style-bible.md` — the five rules this style is built on, plus the method for
  measuring your own reference reels

## Quickstart

```bash
cd engine && npm install
cp ../.env.local.example ../.env.local   # fill in ELEVENLABS_API_KEY later; optional for drafts
npm run sfx:sync                          # pulls the CC0 sound library (~65 MB, git-ignored)
npm run vo -- example --draft             # generates the shipped example's draft timing
npx remotion studio                       # preview the example episode in the browser
```

Then, in Claude Code, from the repo root:

```
/onboard
```

Answer its questions about your brand, niche, audience, goals, research sources, compliance
needs and (if relevant) whether any content is tied to real places. It writes
`engine/src/brand.json`, `engine/src/profile.json` and `research/house-style.md` — every agent
reads these instead of assuming a specific brand or niche.

Then:

```
/reel <topic, a news URL, or an inspo reel URL>
```

## Companion skills

The agents lean on three skills this repo doesn't vendor (install them separately if your Claude
Code setup doesn't already have them):

| skill | used by | for |
| --- | --- | --- |
| `remotion-best-practices` | animator | official Remotion patterns (3D canvas, timing, sequencing) |
| `sound-effects` | sound-designer | the SFX Kit + measurement method this pipeline's sound pass is built on |
| `animation-reverse-engineering` | strategist | dissecting an inspo reel frame-by-frame before borrowing its structure |

## The optional real-world map

Most niches don't need this — the shipped example runs on a plain backdrop
(`<NightLights>` + `<Ground>`). If your content is tied to real places, `/onboard` can turn on
`engine/src/profile.json`'s `world.map`, and walks you through setting a bounding box in
`engine/src/kit/geo.ts` and building `public/geo/world.json` from OpenStreetMap data via
`npm run geo`. Map data is © OpenStreetMap contributors (ODbL) — credit it in any post that shows
the map.

## Licence

MIT for the code in this repo (see `LICENSE`). The bundled SFX Kit sounds (`npm run sfx:sync`
pulls them in, git-ignored) are CC0 (Wyzowl); OpenStreetMap data, if you enable the map, is ODbL.
