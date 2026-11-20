import {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, SANS} from './theme';
import {FPS, useTimeline, type Word} from './timeline';

const MAX_WORDS = 3;
const MAX_CHARS = 20;
const LINGER_MS = 350;

type Page = {words: Word[]; startMs: number; endMs: number};

/** Reference style: 2–3 word pages, break on punctuation, no per-word karaoke. */
export const paginate = (words: Word[]): Page[] => {
	const pages: Page[] = [];
	let cur: Word[] = [];
	const flush = () => {
		if (cur.length) pages.push({words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs});
		cur = [];
	};
	for (const w of words) {
		const chars = cur.map((x) => x.text).join(' ').length + w.text.length + 1;
		if (cur.length && (cur.length >= MAX_WORDS || chars > MAX_CHARS || cur[0].beat !== w.beat)) flush();
		cur.push(w);
		if (/[,.?!:;—]$/.test(w.text)) flush();
	}
	flush();
	// each page stays up until the next one replaces it (no flicker between pages)
	return pages.map((p, i) => ({...p, endMs: pages[i + 1]?.startMs ?? p.endMs + LINGER_MS}));
};

export const Captions: React.FC<{bottomPct?: number}> = ({bottomPct = 27}) => {
	const t = useTimeline();
	const frame = useCurrentFrame();
	const pages = useMemo(() => paginate(t.words), [t.words]);
	const ms = (frame / FPS) * 1000;
	const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
	if (!page) return null;
	const local = frame - (page.startMs / 1000) * FPS;
	const pop = interpolate(local, [0, 4], [0.9, 1], {extrapolateRight: 'clamp'});
	const opacity = interpolate(local, [0, 2], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: `${bottomPct}%`}}>
			<div
				style={{
					fontFamily: SANS,
					fontWeight: 700,
					fontSize: 58,
					letterSpacing: -0.5,
					color: C.text,
					background: C.pill,
					borderRadius: 18,
					padding: '10px 26px 14px',
					transform: `scale(${pop})`,
					opacity,
					whiteSpace: 'nowrap',
				}}
			>
				{page.words.map((w, i) => (
					<span key={i} style={{color: w.highlight ? C.accentSoft : C.text}}>
						{i > 0 ? ' ' : ''}
						{w.text}
					</span>
				))}
			</div>
		</AbsoluteFill>
	);
};
