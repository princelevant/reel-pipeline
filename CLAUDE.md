# Reel Pipeline — vertical explainer reels for your own brand/niche

Vertical (1080×1920, 30 fps) animated explainers in the style dissected in `research/style-bible.md`:
one continuous 3D world, camera glides instead of cuts, every number turned into an object,
animation locked to the voiceover word by word.

**First time in this repo?** Run `/onboard` before anything else — it interviews you about your
brand, niche, audience and goals and writes the three config files every agent below reads
(`engine/src/brand.json`, `engine/src/profile.json`, `research/house-style.md`). Nothing produces
a sensible reel until that's done.

Make one: `/reel <topic | news URL | inspo URL>` → strategist → writer → voice → animator → sound designer → editor.
House rules, file contracts and the motion-kit API: `.claude/skills/reel-pipeline/SKILL.md` — load it.

## Layout

- `episodes/<slug>/` — creative: `brief.md` (fact sheet with sources), `script.json`, `qa.md`, optional `music.mp3`
- `engine/` — Remotion project (React Three Fiber). `src/kit/` reusable motion kit, `src/episodes/<slug>/Scene.tsx`
  per episode (`src/episodes/example/` is the shipped worked reference — no real map, no real brand),
  `scripts/` (voiceover, qa, master, sfx-sync, optional build-geo), `src/profile.json` + `src/brand.json`
  (written by `/onboard`), `public/geo/world.json` (only if the optional map is enabled)
- `research/` — reference reels you collect, `style-bible.md` (the method + the five universal rules)
- `.claude/agents/` — strategist, writer, animator, sound-designer, editor · `.claude/commands/` — `/reel`, `/onboard`
- `.claude/skills/reel-pipeline/` — house style, file contracts, motion-kit API (load it for any reel work)
- Companion skills this pipeline leans on but doesn't vendor (install separately if you don't have them):
  `remotion-best-practices` (official Remotion docs skill, for the Animator), `sound-effects` (SFX Kit +
  measurement method, for the Sound Designer), `animation-reverse-engineering` (for the Strategist, to
  dissect inspo reels)
- Sound effects: Wyzowl SFX Kit (CC0), pulled by `npm run sfx:sync` into `engine/public/sfx-kit/` (git-ignored)

## Environment

- ElevenLabs key in `.env.local` (git-ignored), set up with `npx -y @elevenlabs/cli@latest onboard init`;
  verify with `npx -y @elevenlabs/cli@latest onboard check --env-path .env.local` (never print the file).
  `npm run vo` loads it via `node --env-file=../.env.local`; the voice defaults come from `profile.json`,
  overridable per episode in `script.json`.
- Rendering 3D headless: GL backend defaults to `angle-egl` (works on Linux/NVIDIA);
  override with `REMOTION_GL=angle` (macOS) or `REMOTION_GL=swangle` (CPU) — see `engine/remotion.config.ts`.
- If headless Chrome fails to launch with a `libnss3.so`/`libnspr4.so` error, either
  `sudo apt install libnss3 libnspr4`, or prefix Remotion commands with
  `LD_LIBRARY_PATH=<path to those libs>` until you do.

## Rules

- Every on-screen/spoken number traces to a source URL in the episode brief. Projections stay hedged.
- Every animation timing is `cue(beat, word)`; never hard-code frames.
- Animate only from `useCurrentFrame()` (no `useFrame`, no self-running shaders).
- Whatever `engine/src/profile.json`'s `compliance` list requires goes on the end card
  (`engine/src/brand.json`'s `disclosures`/`qrImage`) — empty is fine if `/onboard` says your niche
  has nothing to disclose, but don't assume that without asking.
