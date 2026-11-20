// script.json → vo.mp3 + timeline.json (word-level timing the animation binds to).
//
//   npm run vo -- <slug>            # ElevenLabs text-to-speech with timestamps (key in ../.env.local)
//   npm run vo -- <slug> --draft    # no API call: estimated timings for a silent animatic
//
// Reads  ../episodes/<slug>/script.json   (Writer output)
// Writes public/episodes/<slug>/{vo.mp3,timeline.json}
// The key is loaded by `node --env-file=../.env.local` (package.json); the SDK reads
// ELEVENLABS_API_KEY from the environment. Set it up with `npx -y @elevenlabs/cli@latest onboard init`.
import {ElevenLabsClient, type ElevenLabs} from '@elevenlabs/elevenlabs-js';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import type {Beat, Timeline, Word} from '../src/kit/timeline.ts';

// George: premade narrative voice, usable on every plan (Voice Library voices need a paid plan).
// Overridden by engine/src/profile.json "voice" (set during /onboard), falling back to George.
const FALLBACK_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const profile = JSON.parse(readFileSync(new URL('../src/profile.json', import.meta.url), 'utf8')) as {
	voice?: {voiceId?: string; modelId?: string};
};
const DEFAULT_VOICE_ID = profile.voice?.voiceId || FALLBACK_VOICE_ID;
const DEFAULT_MODEL_ID = profile.voice?.modelId || 'eleven_v4';

const ScriptSchema = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/),
	kicker: z.string(),
	endCard: z.boolean().default(true),
	voice: z
		.object({
			voiceId: z.string().default(DEFAULT_VOICE_ID),
			modelId: z.string().default(DEFAULT_MODEL_ID),
			stability: z.number().min(0).max(1).default(0.5),
			similarityBoost: z.number().min(0).max(1).default(0.75),
			// v2/v3 models only; Eleven v4 paces with punctuation and audio tags instead
			style: z.number().min(0).max(1).optional(),
			speed: z.number().min(0.7).max(1.2).optional(),
		})
		.prefault({}),
	beats: z
		.array(
			z.object({
				id: z.string().regex(/^[a-z0-9-]+$/),
				text: z.string().min(1),
				kicker: z.string().optional(),
				visual: z.string().optional(), // Writer → Animator note; not spoken
			}),
		)
		.min(1),
});

const [slug, ...flags] = process.argv.slice(2);
if (!slug) {
	console.error('usage: npm run vo -- <slug> [--draft | --reuse]');
	process.exit(1);
}
const draft = flags.includes('--draft');
// --reuse: re-process the last ElevenLabs take (vo.raw.mp3 + alignment.json) without spending credits,
// e.g. after changing the mastering chain. Fails if the script text changed since that take.
const reuse = flags.includes('--reuse');

const scriptPath = `../episodes/${slug}/script.json`;
const script = ScriptSchema.parse(JSON.parse(readFileSync(scriptPath, 'utf8')));
const outDir = `public/episodes/${slug}`;
mkdirSync(outDir, {recursive: true});

// ---- tokenise: "*Blue Line*" marks caption highlights; asterisks are never spoken
type Token = {text: string; beat: string; highlight: boolean; start: number; end: number};
const tokens: Token[] = [];
let spoken = '';
for (const beat of script.beats) {
	if (spoken) spoken += ' ';
	let inHi = false;
	for (const raw of beat.text.trim().split(/\s+/)) {
		const opens = raw.startsWith('*');
		const closes = /\*[^\p{L}\p{N}]*$/u.test(raw);
		const text = raw.replaceAll('*', '');
		if (opens) inHi = true;
		if (spoken && !spoken.endsWith(' ')) spoken += ' ';
		tokens.push({text, beat: beat.id, highlight: inHi, start: spoken.length, end: spoken.length + text.length});
		spoken += text;
		if (closes) inHi = false;
	}
}

// ---- timings
type Alignment = ElevenLabs.CharacterAlignmentResponseModel;

const estimate = (): Alignment => {
	// ~172 wpm: a fast spoken-explainer pace for draft timing; longer words take longer, punctuation adds pauses.
	const avgLetters = tokens.reduce((s, t) => s + t.text.length, 0) / tokens.length;
	const perWord = 60 / 172;
	const chars: string[] = [];
	const st: number[] = [];
	const en: number[] = [];
	let clock = 0;
	tokens.forEach((tok, i) => {
		const weight = (tok.text.replace(/\d/g, 'dd').length + 2) / (avgLetters + 2);
		const dur = perWord * weight;
		for (let c = 0; c < tok.text.length; c++) {
			chars.push(tok.text[c]);
			st.push(clock + (dur * c) / tok.text.length);
			en.push(clock + (dur * (c + 1)) / tok.text.length);
		}
		clock += dur;
		if (/[.?!]$/.test(tok.text)) clock += 0.32;
		else if (/[,:;—]$/.test(tok.text)) clock += 0.16;
		if (tokens[i + 1] && tokens[i + 1].beat !== tok.beat) clock += 0.12;
		if (i < tokens.length - 1) {
			chars.push(' ');
			st.push(clock);
			en.push(clock);
		}
	});
	return {characters: chars, characterStartTimesSeconds: st, characterEndTimesSeconds: en};
};

const elevenlabs = async (): Promise<{alignment: Alignment; audio: Buffer}> => {
	if (!process.env.ELEVENLABS_API_KEY) {
		throw new Error('ELEVENLABS_API_KEY not set: run `npx -y @elevenlabs/cli@latest onboard init` in the project root, or pass --draft');
	}
	const {voiceId, modelId, stability, similarityBoost, style, speed} = script.voice;
	if (modelId.startsWith('eleven_v4') && (style !== undefined || speed !== undefined)) {
		throw new Error(`voice.style / voice.speed are not supported on ${modelId}; remove them or pick a v2/v3 model`);
	}
	const client = new ElevenLabsClient();
	const res = await client.textToSpeech.convertWithTimestamps(voiceId, {
		text: spoken,
		modelId,
		outputFormat: 'mp3_44100_128',
		voiceSettings: {stability, similarityBoost, style, speed},
	});
	if (!res.alignment) throw new Error('ElevenLabs returned no alignment');
	return {alignment: res.alignment, audio: Buffer.from(res.audioBase64, 'base64')};
};

const rawPath = `${outDir}/vo.raw.mp3`;
const alignmentPath = `${outDir}/alignment.json`;
const take = async (): Promise<{alignment: Alignment; audio: Buffer | null}> => {
	if (draft) return {alignment: estimate(), audio: null};
	if (reuse) return {alignment: JSON.parse(readFileSync(alignmentPath, 'utf8')), audio: readFileSync(rawPath)};
	const fresh = await elevenlabs();
	writeFileSync(rawPath, fresh.audio);
	writeFileSync(alignmentPath, JSON.stringify(fresh.alignment));
	return fresh;
};
const {alignment, audio} = await take();

// alignment.characters is the original text char-by-char → map token char spans to times
const aligned = alignment.characters.join('');
if (aligned !== spoken) {
	throw new Error(`alignment text differs from sent text:\nsent:    ${spoken.slice(0, 200)}\naligned: ${aligned.slice(0, 200)}`);
}
const s = alignment.characterStartTimesSeconds;
const e = alignment.characterEndTimesSeconds;
const words: Word[] = tokens.map((t) => ({
	text: t.text,
	startMs: Math.round(s[t.start] * 1000),
	endMs: Math.round(e[t.end - 1] * 1000),
	beat: t.beat,
	highlight: t.highlight,
}));
const beats: Beat[] = script.beats.map((b) => {
	const ws = words.filter((w) => w.beat === b.id);
	return {id: b.id, startMs: ws[0].startMs, endMs: ws[ws.length - 1].endMs, ...(b.kicker ? {kicker: b.kicker} : {})};
});

if (audio) {
	// Remotion mixes this mono take into both stereo channels, which reads +3 LU louder on the exported MP4.
	// -19 LUFS here ≈ -16 LUFS in the mix: the level SFX Kit's gains are referenced to, and what
	// `npm run master` then pins exactly. Gentle compression → loudnorm → limiter (gain/dynamics only,
	// no time-stretch, so the word timings stay valid).
	const chain = 'acompressor=threshold=-26dB:ratio=3:attack=5:release=120:makeup=2,loudnorm=I=-19:TP=-4:LRA=11,alimiter=limit=0.6:level=false';
	execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', rawPath, '-af', chain, '-ar', '44100', '-b:a', '192k', `${outDir}/vo.mp3`]);
}
const musicSrc = `../episodes/${slug}/music.mp3`;
if (existsSync(musicSrc)) copyFileSync(musicSrc, `${outDir}/music.mp3`);

const timeline: Timeline = {
	slug,
	draft,
	audio: audio ? `episodes/${slug}/vo.mp3` : null,
	music: existsSync(musicSrc) ? `episodes/${slug}/music.mp3` : null,
	voMs: words[words.length - 1].endMs,
	words,
	beats,
	kicker: script.kicker,
	endCard: script.endCard,
};
writeFileSync(`${outDir}/timeline.json`, JSON.stringify(timeline, null, '\t'));

const secs = timeline.voMs / 1000;
console.log(
	`${draft ? 'DRAFT ' : ''}timeline → ${outDir}/timeline.json: ${words.length} words, ${secs.toFixed(1)} s, ${Math.round((words.length / secs) * 60)} wpm`,
);
for (const b of beats) console.log(`  ${b.id.padEnd(12)} ${(b.startMs / 1000).toFixed(2)}–${(b.endMs / 1000).toFixed(2)} s`);
