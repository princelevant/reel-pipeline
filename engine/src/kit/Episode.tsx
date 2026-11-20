import {Audio} from '@remotion/media';
import {AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import brand from '../brand.json';
import {Captions} from './Captions';
import {Kicker} from './Overlay';
import {C, SANS} from './theme';
import {Sound} from './Sound';
import {FPS, TAIL_MS, TimelineContext, totalFrames, type Timeline} from './timeline';

/** Brand end card. `brand.disclosures` (brand.json) are whatever your niche requires on screen — licence numbers, permits, etc. */
const EndCard: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame, fps, config: {damping: 16, stiffness: 120}});
	return (
		<AbsoluteFill
			style={{
				background: `radial-gradient(ellipse at 50% 40%, #12305a 0%, ${C.fog} 70%)`,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'}),
				fontFamily: SANS,
				color: C.text,
				textAlign: 'center',
				gap: 18,
			}}
		>
			<div style={{fontSize: 76, fontWeight: 800, letterSpacing: -2, transform: `translateY(${(1 - s) * 30}px)`}}>{brand.name}</div>
			<div style={{fontSize: 40, fontWeight: 500, opacity: 0.8}}>{brand.tagline}</div>
			<div style={{fontSize: 32, fontWeight: 600, marginTop: 40, color: C.gold}}>{brand.contact}</div>
			{brand.disclosures.length ? (
				<div style={{fontSize: 26, fontWeight: 500, opacity: 0.6}}>{brand.disclosures.join(' · ')}</div>
			) : null}
			{brand.qrImage ? (
				<>
					<Img src={staticFile(brand.qrImage)} style={{width: 200, height: 200, marginTop: 30, borderRadius: 12}} />
					{brand.qrLabel ? <div style={{fontSize: 22, fontWeight: 500, opacity: 0.6}}>{brand.qrLabel}</div> : null}
				</>
			) : null}
		</AbsoluteFill>
	);
};

const DraftBadge: React.FC = () => (
	<AbsoluteFill style={{padding: 40}}>
		<div style={{fontFamily: SANS, fontWeight: 800, fontSize: 26, color: '#111', background: '#ffcc33', padding: '6px 14px', borderRadius: 8, alignSelf: 'flex-start'}}>
			DRAFT TIMING · NO VOICEOVER
		</div>
	</AbsoluteFill>
);

/**
 * Wraps an episode's world: provides the timeline (for cue()), plays VO + music,
 * draws captions/kicker on top, appends the end card.
 */
export const EpisodeShell: React.FC<{timeline: Timeline; children: React.ReactNode}> = ({timeline, children}) => {
	const endAt = Math.round(((timeline.voMs + TAIL_MS) / 1000) * FPS);
	return (
		<TimelineContext.Provider value={timeline}>
			<AbsoluteFill style={{backgroundColor: C.fog}}>
				{children}
				{/* loopable episodes (no end card) keep the overlays to the very last frame */}
				<Sequence durationInFrames={timeline.endCard ? endAt : Infinity} layout="none">
					<Kicker />
					<Captions />
				</Sequence>
				{timeline.audio ? <Audio src={staticFile(timeline.audio)} /> : null}
				{timeline.music ? <Audio src={staticFile(timeline.music)} volume={0.12} /> : null}
				{timeline.endCard ? (
					<>
						<Sequence from={endAt} durationInFrames={totalFrames(timeline) - endAt} name="End card">
							<EndCard />
						</Sequence>
						<Sound id="sting-warm-short" at={endAt} />
					</>
				) : null}
				{timeline.draft ? <DraftBadge /> : null}
			</AbsoluteFill>
		</TimelineContext.Provider>
	);
};
