// HTML layers composited over the 3D world: kicker pill, hero numerals, split-flap
// boards, map labels pinned to world points. All timed by frame numbers from cue().
// `until` everywhere = the frame by which the element has fully faded out, so the next
// element can enter on that same cue without overlapping.
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CameraPath, V3} from './camera';
import {useProjector} from './camera';
import {C, MONO, SANS} from './theme';
import {useTimeline, FPS} from './timeline';

const pill: React.CSSProperties = {
	fontFamily: SANS,
	fontWeight: 700,
	color: C.text,
	background: C.pill,
	borderRadius: 999,
	whiteSpace: 'nowrap',
};

/** Top context pill ("ROUTE 2 · 9 KM"). Text follows the active beat's `kicker`, else the episode default. */
export const Kicker: React.FC = () => {
	const t = useTimeline();
	const frame = useCurrentFrame();
	const ms = (frame / FPS) * 1000;
	const beat = [...t.beats].reverse().find((b) => b.kicker && ms >= b.startMs);
	const text = beat?.kicker ?? t.kicker;
	const [lead, ...rest] = text.split('·').map((s) => s.trim());
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: 230}}>
			<div style={{...pill, fontSize: 34, padding: '14px 30px', letterSpacing: 0.5}}>
				<span style={{color: C.gold}}>{lead}</span>
				{rest.map((r) => (
					<span key={r}>
						<span style={{opacity: 0.5}}> · </span>
						{r}
					</span>
				))}
			</div>
		</AbsoluteFill>
	);
};

/**
 * Big numeral that springs in on `at` and optionally counts up.
 * e.g. <HeroStat at={cue('cost','20.5')} pre="AED" value={20.5} decimals={1} suffix=" bn" sub="contract value" />
 */
export const HeroStat: React.FC<{
	at: number;
	until?: number;
	value: number | string;
	decimals?: number;
	countFrames?: number;
	/** count from this value instead of 0 (e.g. last week's figure, so the number moves by the real change) */
	from?: number;
	pre?: string;
	suffix?: string;
	sub?: string;
	top?: number;
	color?: string;
}> = ({at, until, value, decimals = 0, countFrames = 18, from = 0, pre, suffix = '', sub, top = 520, color = C.text}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at || (until !== undefined && frame >= until)) return null;
	const inS = spring({frame: frame - at, fps, config: {damping: 12, stiffness: 170, mass: 0.7}});
	const out = until === undefined ? 1 : interpolate(frame, [until - 8, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const shown =
		typeof value === 'number'
			? interpolate(frame - at, [0, countFrames], [from, value], {extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3)}).toLocaleString(
					'en-US',
					{minimumFractionDigits: decimals, maximumFractionDigits: decimals},
				)
			: value;
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: top, opacity: out}}>
			<div style={{textAlign: 'center', transform: `scale(${0.6 + 0.4 * inS})`, opacity: Math.min(1, inS * 1.5)}}>
				{pre ? <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 52, color: C.gold, letterSpacing: 2}}>{pre}</div> : null}
				<div
					style={{
						fontFamily: SANS,
						fontWeight: 800,
						fontSize: 230,
						lineHeight: 1,
						letterSpacing: -8,
						color,
						textShadow: '0 6px 30px rgba(0,0,0,0.9), 0 0 90px rgba(0,0,0,0.7)',
						fontVariantNumeric: 'tabular-nums',
					}}
				>
					{shown}
					{suffix}
				</div>
				{sub ? <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 44, color: C.text, opacity: 0.9, marginTop: 12, textShadow: '0 2px 16px rgba(0,0,0,0.95)'}}>{sub}</div> : null}
			</div>
		</AbsoluteFill>
	);
};

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Split-flap departure board; each cell scrambles then lands left→right (reference: airport board). */
export const FlipBoard: React.FC<{at: number; until?: number; title?: string; text: string; top?: number}> = ({
	at,
	until,
	title,
	text,
	top = 560,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at || (until !== undefined && frame >= until)) return null;
	const inS = spring({frame: frame - at, fps, config: {damping: 14, stiffness: 140}});
	const out = until === undefined ? 1 : interpolate(frame, [until - 8, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const local = frame - at;
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: top, opacity: out}}>
			<div
				style={{
					background: '#05070b',
					border: '3px solid #1d2636',
					borderRadius: 22,
					padding: '26px 30px 30px',
					boxShadow: `0 0 0 2px #000, 0 20px 80px rgba(0,0,0,0.7), 0 0 60px ${C.accent}33`,
					transform: `translateY(${(1 - inS) * -80}px)`,
				}}
			>
				{title ? (
					<div style={{fontFamily: MONO, fontWeight: 700, fontSize: 26, color: C.accentSoft, letterSpacing: 4, marginBottom: 16}}>{title}</div>
				) : null}
				<div style={{display: 'flex', gap: 8}}>
					{[...text].map((ch, i) => {
						const settle = 6 + i * 2.5;
						const isSep = !/[A-Z0-9]/i.test(ch);
						const shown = isSep || local >= settle ? ch : FLAP_CHARS[Math.floor(random(`${i}-${local}`) * FLAP_CHARS.length)];
						return (
							<div
								key={i}
								style={{
									width: isSep ? 34 : 92,
									height: 132,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									background: isSep ? 'transparent' : 'linear-gradient(#1a1f2b 49%, #000 49%, #000 51%, #151a24 51%)',
									borderRadius: 10,
									fontFamily: MONO,
									fontWeight: 700,
									fontSize: 104,
									color: local >= settle ? '#fff' : '#9aa6bd',
								}}
							>
								{shown}
							</div>
						);
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};

export type MapLabel = {text: string; sub?: string; at: number; until?: number; world: V3; side?: 'left' | 'right'};

/** Label pinned to a world point (projects through the same camera pose as the 3D scene). */
export const MapLabels: React.FC<{path: CameraPath; labels: MapLabel[]}> = ({path, labels}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const project = useProjector(path);
	return (
		<AbsoluteFill>
			{labels.map((l) => {
				if (frame < l.at || (l.until !== undefined && frame >= l.until)) return null;
				const p = project(l.world);
				if (!p.visible) return null;
				const s = spring({frame: frame - l.at, fps, config: {damping: 14, stiffness: 180}});
				const out = l.until === undefined ? 1 : interpolate(frame, [l.until - 6, l.until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
				const right = (l.side ?? 'right') === 'right';
				return (
					<div
						key={l.text}
						style={{
							position: 'absolute',
							left: p.x,
							top: p.y,
							transform: `translate(${right ? 28 : -28}px, -50%) translateX(${right ? 0 : -100}%) scale(${s})`,
							transformOrigin: right ? 'left center' : 'right center',
							opacity: out,
							...pill,
							borderRadius: 14,
							fontSize: 32,
							padding: '8px 18px',
						}}
					>
						{l.text}
						{l.sub ? <span style={{color: C.gold, fontSize: 26, marginLeft: 10}}>{l.sub}</span> : null}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

/** Small, always-on honesty line (reference reels say "Maps and models are simplified"). */
export const Disclaimer: React.FC<{text: string}> = ({text}) => (
	<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70}}>
		<div style={{fontFamily: SANS, fontWeight: 500, fontSize: 22, color: '#fff', opacity: 0.45, letterSpacing: 1}}>{text}</div>
	</AbsoluteFill>
);
