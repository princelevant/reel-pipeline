import {createContext, useContext, useMemo} from 'react';

/** One spoken word, timed from ElevenLabs character alignment (or the draft estimator). */
export type Word = {
	text: string; // as written, punctuation included ("2029.")
	startMs: number;
	endMs: number;
	beat: string;
	highlight: boolean; // marked *like this* in script.json
};

export type Beat = {
	id: string;
	startMs: number;
	endMs: number;
	kicker?: string;
};

/** public/episodes/<slug>/timeline.json — written by scripts/voiceover.ts */
export type Timeline = {
	slug: string;
	draft: boolean; // true = estimated timings, no audio
	audio: string | null; // path relative to public/
	voMs: number; // end of last word
	music: string | null; // optional bed, path relative to public/
	words: Word[];
	beats: Beat[];
	kicker: string;
	endCard: boolean;
};

export const FPS = 30;
export const END_CARD_MS = 2600;
export const TAIL_MS = 500; // breath after the last word before the end card

export const totalFrames = (t: Timeline) =>
	Math.ceil(((t.voMs + TAIL_MS + (t.endCard ? END_CARD_MS : 0)) / 1000) * FPS);

export const TimelineContext = createContext<Timeline | null>(null);

export const useTimeline = (): Timeline => {
	const t = useContext(TimelineContext);
	if (!t) throw new Error('useTimeline() outside <EpisodeShell>');
	return t;
};

const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}.]/gu, '').replace(/\.$/, '');

export type Cue = {
	/** Frame where `token` is first spoken inside beat `beatId` (or the beat start if no token). */
	(beatId: string, token?: string, nth?: number): number;
	end: (beatId: string) => number;
	/** Frame the voiceover ends (before tail + end card). */
	voEnd: number;
};

/**
 * Binds animation to the spoken word. Throws when a beat or token is missing so a
 * script rewrite that breaks an animation sync fails the render instead of drifting.
 */
export const makeCue = (t: Timeline): Cue => {
	const beat = (id: string) => {
		const b = t.beats.find((x) => x.id === id);
		if (!b) throw new Error(`cue: no beat "${id}" in ${t.slug} (have: ${t.beats.map((x) => x.id).join(', ')})`);
		return b;
	};
	const cue = ((beatId: string, token?: string, nth = 0) => {
		const b = beat(beatId);
		if (token === undefined) return msToFrame(b.startMs);
		const want = norm(token);
		const hits = t.words.filter((w) => w.beat === beatId && norm(w.text) === want);
		if (!hits[nth]) {
			throw new Error(
				`cue: "${token}" (#${nth}) not spoken in beat "${beatId}": ${t.words
					.filter((w) => w.beat === beatId)
					.map((w) => w.text)
					.join(' ')}`,
			);
		}
		return msToFrame(hits[nth].startMs);
	}) as Cue;
	cue.end = (beatId) => msToFrame(beat(beatId).endMs);
	cue.voEnd = msToFrame(t.voMs);
	return cue;
};

export const useCue = (): Cue => {
	const t = useTimeline();
	return useMemo(() => makeCue(t), [t]);
};
