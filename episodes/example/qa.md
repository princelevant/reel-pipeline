# QA — example — PICTURE LOCK (needs VO)

Verified by rendering `out/example-preview.mp4` and `out/example-qa.png` against the draft
timeline (no ElevenLabs credits spent).

| # | time | issue | owner | fix |
| --- | --- | --- | --- | --- |
| 1 | 0–2s | none | — | hook number on screen within 2s, something moving frame 1 (Mo) |
| 2 | throughout | none | — | no cuts, camera glides only, no dead-still stretches |
| 3 | throughout | none | — | captions never covered; HeroStat/FlipBoard/MapLabel never collide (fixed two overlaps during review: a HeroStat/District collision in the "next" shot, and a FlipBoard/MapLabel timing overlap in "skyline") |
| 4 | end | none | — | end card shows brand name/tagline/contact from `brand.json`; no disclosures set (none needed — every number is a placeholder, flagged by the on-screen `Disclaimer`) |

**Draft check:** `timeline.json` has `"draft": true` (no ElevenLabs key used for this demo), so
this cannot pass final QA — verdict is **PICTURE LOCK — needs VO**. Run `npm run vo -- example`
with an `ELEVENLABS_API_KEY` set, re-render, and re-run `npm run qa -- example` to confirm sync
holds with real timing before calling it PASS.

Loudness (`npm run master -- example`, full-res `out/example.mp4`): -18.3 LUFS / -4.6 dBTP,
measured with no VO track (draft has no audio). This is expected to land nearer -16 LUFS once a
real voiceover is mixed in — the gain structure is tuned against the VO level, not SFX alone.

## Post description

This is the kit's own worked example, not a real post — every number in it is an invented
placeholder (see `brief.md`). A real episode's description would end with its sources; see the
`strategist` agent and `.claude/skills/reel-pipeline/SKILL.md`.
