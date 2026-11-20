# Style bible — "explainer diorama" reels

This kit was distilled from dissecting two reference reels frame by frame (downloaded,
transcribed with faster-whisper, contact sheets at 1 fps + 4 fps, caption crop stacks at 10 fps —
see the `animation-reverse-engineering` skill for the method). The five rules below hold regardless
of niche. Everything else here is a template: redo the measurement pass on 1–2 reels in *your*
niche and fill in your own numbers.

## The five rules that make it work

1. **One continuous world, one continuous camera.** Zero cuts. Every "scene" is a camera move to a
   different spot in the same 3D world. Transitions are camera travel, not edits. This is the single
   biggest difference from template reels.
2. **Every number becomes an object.** A big headline number → a counter or split-flap board. A
   comparison → two filling columns or a ×N tag. A date → a flip calendar. A series of small figures →
   stacked objects on the ground. Write numbers so the Animator can turn each into a physical prop.
3. **Visual changes on the spoken word.** Counters land, pins pop, boards flip on the exact word that
   names them. Alignment comes from TTS character timestamps — never from guessed frame numbers.
4. **Captions: 2–3 word pages, no karaoke.** Bold geometric sans, white on a dark translucent rounded
   pill, centred at ~72% of frame height. One keyword per page tinted (your brand accent colour from
   `kit/theme.ts`). Pages break at punctuation. A top "kicker" pill carries context and updates as the
   story advances.
5. **Hero numerals overlay the 3D**: a huge numeral with a small label above and below, springing in
   on the word.

## Narrative skeleton

```
0–3 s   HOOK: concrete number about *the viewer* or a record
3–8 s   TWIST: the thing that makes it interesting
8–30 s  HOW: 4–6 stat beats, one prop each, camera travels between them
30–40 s WHAT'S NEXT: dates, phases, future state
last    PAYOFF tied to your goals (see profile.json) — what you want the viewer to do or feel next
end     Brand card + any required compliance disclosure
```

The payoff is the last line, not the first: lead with a fact people would argue about, land on
why it matters to them specifically.

## Redoing the measurement pass for your niche

1. Find 1–2 reels in your niche that already do this well (ask `/onboard`'s research-sources
   answer, or search your platform directly).
2. Download + transcribe with the `animation-reverse-engineering` skill; drop them in
   `research/inspo/` (git-ignored).
3. Measure: format, words/duration → wpm, whether there really are zero hard cuts (ffmpeg scene
   detection), the caption/kicker styling, the outro structure, loudness (mean/peak dB).
4. Update `engine/src/profile.json`'s `pacing` and `research/house-style.md` with what you found —
   don't just copy another niche's numbers, measure your own references.

## What does NOT move

Captions and kicker never move position. The camera never shakes or whip-pans; moves are
long ease-in-out glides (≈1–2.5 s) with slow drift during holds so the frame is never static.
