// HTML/SVG data overlays for the upper half of the frame (captions own the lower third).
// All frame-driven; `until` = frame by which the element is fully gone (same as Overlay.tsx).
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, MONO, SANS} from './theme';

const fadeOut = (frame: number, until?: number) =>
	until === undefined ? 1 : interpolate(frame, [until - 8, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export type Series = {label: string; color?: string; points: {x: number; y: number}[]};

/**
 * Line chart that draws itself left → right between `at` and `at + drawFrames`.
 * `marks` pin a callout to a point (e.g. "2008 crash") on the frame the voice says it.
 */
export const LineChart: React.FC<{
	at: number;
	until?: number;
	drawFrames?: number;
	series: Series[];
	title?: string;
	formatY?: (y: number) => string;
	formatX?: (x: number) => string;
	marks?: {x: number; seriesIndex?: number; text: string; at: number}[];
	top?: number;
	height?: number;
}> = ({at, until, drawFrames = 60, series, title, formatY = (y) => Math.round(y).toLocaleString('en-US'), formatX = (x) => String(x), marks = [], top = 330, height = 620}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at || (until !== undefined && frame >= until)) return null;
	const W = 940;
	const H = height;
	const pad = {l: 30, r: 150, t: 70, b: 60};
	const xs = series.flatMap((s) => s.points.map((p) => p.x));
	const ys = series.flatMap((s) => s.points.map((p) => p.y));
	const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
	const [y0, y1] = [Math.min(0, ...ys), Math.max(...ys) * 1.08];
	const px = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
	const py = (y: number) => H - pad.b - ((y - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);
	const p = interpolate(frame - at, [0, drawFrames], [0, 1], {extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 2)});
	const xNow = x0 + (x1 - x0) * p;
	const inS = spring({frame: frame - at, fps, config: {damping: 16, stiffness: 140}});
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: top, opacity: Math.min(1, inS * 1.4) * fadeOut(frame, until)}}>
			<div style={{background: 'rgba(6,9,16,0.78)', borderRadius: 28, padding: '26px 22px 10px', boxShadow: '0 30px 90px rgba(0,0,0,0.6)'}}>
				{title ? <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 34, color: C.text, marginLeft: 12}}>{title}</div> : null}
				<svg width={W} height={H}>
					{[0.25, 0.5, 0.75, 1].map((g) => (
						<line key={g} x1={pad.l} x2={W - pad.r} y1={py(y0 + (y1 - y0) * g)} y2={py(y0 + (y1 - y0) * g)} stroke="#ffffff" strokeOpacity={0.08} />
					))}
					{series.map((s, si) => {
						const pts = s.points.filter((pt) => pt.x <= xNow);
						const prev = pts[pts.length - 1];
						const next = s.points.find((pt) => pt.x > xNow);
						const head = prev && next ? {x: xNow, y: prev.y + ((next.y - prev.y) * (xNow - prev.x)) / (next.x - prev.x)} : prev;
						const all = head && head !== prev ? [...pts, head] : pts;
						if (!all.length) return null;
						const d = all.map((pt, i) => `${i ? 'L' : 'M'}${px(pt.x).toFixed(1)},${py(pt.y).toFixed(1)}`).join(' ');
						const color = s.color ?? (si === 0 ? C.accent : C.gold);
						const last = all[all.length - 1];
						return (
							<g key={s.label}>
								<path d={d} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
								<circle cx={px(last.x)} cy={py(last.y)} r={11} fill="#fff" />
								<text x={px(last.x) + 18} y={py(last.y) + 12} fontFamily={MONO} fontWeight={700} fontSize={34} fill={color}>
									{formatY(last.y)}
								</text>
							</g>
						);
					})}
					<text x={pad.l} y={H - 14} fontFamily={MONO} fontSize={28} fill="#ffffff" fillOpacity={0.55}>
						{formatX(x0)}
					</text>
					<text x={W - pad.r} y={H - 14} textAnchor="end" fontFamily={MONO} fontSize={28} fill="#ffffff" fillOpacity={0.55}>
						{formatX(Math.round(xNow))}
					</text>
					{marks.map((m) => {
						if (frame < m.at) return null;
						const s = series[m.seriesIndex ?? 0];
						const pt = s.points.reduce((a, b) => (Math.abs(b.x - m.x) < Math.abs(a.x - m.x) ? b : a));
						const k = spring({frame: frame - m.at, fps, config: {damping: 14, stiffness: 180}});
						return (
							<g key={m.text} opacity={k}>
								<line x1={px(pt.x)} x2={px(pt.x)} y1={py(pt.y)} y2={pad.t - 10} stroke="#fff" strokeOpacity={0.5} strokeDasharray="6 8" />
								<text x={px(pt.x)} y={pad.t - 20} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={30} fill="#fff">
									{m.text}
								</text>
							</g>
						);
					})}
				</svg>
			</div>
		</AbsoluteFill>
	);
};

export type RankItem = {label: string; value: number; display?: string; sub?: string; at: number; color?: string};

/** Ranked bars that slide in one per cue (top-3 sales, cheapest areas…). Bar width ∝ value. */
export const RankList: React.FC<{items: RankItem[]; until?: number; title?: string; top?: number}> = ({items, until, title, top = 360}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (!items.length || frame < items[0].at || (until !== undefined && frame >= until)) return null;
	const max = Math.max(...items.map((i) => i.value));
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: top, opacity: fadeOut(frame, until)}}>
			<div style={{width: 940, display: 'flex', flexDirection: 'column', gap: 22}}>
				{title ? <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 40, color: C.text, textShadow: '0 4px 20px rgba(0,0,0,0.9)'}}>{title}</div> : null}
				{items.map((it, i) => {
					if (frame < it.at) return null;
					const s = spring({frame: frame - it.at, fps, config: {damping: 15, stiffness: 150}});
					return (
						<div key={it.label} style={{transform: `translateX(${(1 - s) * -80}px)`, opacity: Math.min(1, s * 1.5), background: 'rgba(6,9,16,0.8)', borderRadius: 20, padding: '18px 22px'}}>
							<div style={{display: 'flex', justifyContent: 'space-between', fontFamily: SANS, color: C.text, alignItems: 'baseline'}}>
								<span style={{fontWeight: 700, fontSize: 38}}>
									<span style={{color: C.gold, marginRight: 14}}>{i + 1}</span>
									{it.label}
								</span>
								<span style={{fontFamily: MONO, fontWeight: 700, fontSize: 38, color: it.color ?? C.accentSoft}}>{it.display ?? it.value.toLocaleString('en-US')}</span>
							</div>
							{it.sub ? <div style={{fontFamily: SANS, fontSize: 28, color: '#fff', opacity: 0.65, marginTop: 4}}>{it.sub}</div> : null}
							<div style={{height: 10, marginTop: 12, borderRadius: 5, background: 'rgba(255,255,255,0.08)'}}>
								<div style={{height: 10, borderRadius: 5, width: `${(it.value / max) * 100 * s}%`, background: it.color ?? C.accent}} />
							</div>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
