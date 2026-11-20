---
description: Make a vertical explainer reel end to end (strategist → writer → voice → animator → sound designer → editor)
argument-hint: <topic | news URL | inspo reel URL> [--draft]
---

Produce one vertical explainer reel for: $ARGUMENTS

Load the `reel-pipeline` skill first. If `engine/src/profile.json`'s `niche` field is still empty,
stop and tell me to run `/onboard` first — the agents below need it. Run the pipeline below with
the project subagents, in order — each step reads the previous step's files, so never skip one.
Pass each subagent the slug and the paths it needs; they do not see this conversation.

1. **strategist** → `episodes/<slug>/brief.md`. Show me the angle, hook and fact sheet in 5 lines.
2. **writer** → `episodes/<slug>/script.json` (validated with `npm run vo -- <slug> --draft`).
3. **Voice** (you, not a subagent), in `engine/`:
   - `ELEVENLABS_API_KEY` set in `.env.local` (check with `npx -y @elevenlabs/cli@latest onboard check --env-path .env.local`) and no `--draft` in the arguments →
     `npm run vo -- <slug>`; otherwise keep the draft timeline and say so.
   - Print the per-beat timings it outputs.
4. **animator** → `engine/src/episodes/<slug>/Scene.tsx` (exports `Scene`; auto-registered), stills checked.
5. **sound-designer** → `engine/src/episodes/<slug>/Sound.tsx` (SFX Kit, cued like the visuals), rendered and
   mastered with `npm run master -- <slug>`; reports the cue table, LUFS / true peak and 5 timestamps for me to check.
6. **editor** → `episodes/<slug>/qa.md` with PASS / FIX / PICTURE LOCK.
   - FIX: send the fix list to the owner (writer, animator or sound-designer), re-run voice if the script
     changed, then the editor again. At most 2 fix rounds; after that report what is still open.
7. Report: video path(s), duration, QA verdict, the post description, the 5 headphone timestamps, and
   anything I must supply (voice ID, compliance disclosures listed in `engine/src/profile.json`).

Ground rules: every number traces to a URL in the brief; projections are hedged; no cuts; every
animation is cued to a spoken word.
