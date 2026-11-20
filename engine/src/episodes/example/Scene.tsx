// Worked example for episodes/example/script.json — no real-world map, no real brand.
// Demonstrates the shared kit end to end: one continuous camera, HeroStat, FlipBoard, District
// (as a generic "growth skyline"), a MapLabel pinned to an arbitrary 3D point, the mascot Mo,
// and a Disclaimer marking every number here as a placeholder. Copy this file's STRUCTURE for
// your own episodes, not its content — see .claude/skills/reel-pipeline/SKILL.md.
import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {CameraRig, cameraPath, type Shot, type V3} from '../../kit/camera';
import {Mo, type MoAction, type MoMood} from '../../kit/characters';
import {Disclaimer, FlipBoard, HeroStat, MapLabels} from '../../kit/Overlay';
import {useCue} from '../../kit/timeline';
import {District, Ground, NightLights} from '../../kit/world';
import {ExampleSound} from './Sound';

const MO = {x: 0, z: 0.4};
const DISTRICT = {x: 4, z: -2};

export const Scene: React.FC = () => {
	const {width, height} = useVideoConfig();
	const cue = useCue();

	const heroAt = cue('hook', '10,000');
	const twistAt = cue('twist');
	const growthWord = cue('growth', 'growth');
	const flipAt = cue('growth', '90');
	const skylineAt = cue('skyline');
	const nextAt = cue('next');
	const milestoneAt = cue('next', '50,000');
	const shipsAt = cue('next', 'referrals');
	const payoffAt = cue('payoff');
	const payoffWave = cue('payoff', 'yours');

	const shots: Shot[] = useMemo(
		() => [
			{at: 0, pos: [0, 2.3, 9], look: [0, 1, 0.2] as V3, fov: 34, drift: 0.15},
			{at: heroAt, dur: 35, pos: [0, 1.5, 4.6], look: [0, 1.1, 0.3] as V3, fov: 28, drift: 0.1},
			{at: growthWord, dur: 70, pos: [5.0, 2.2, 6.2], look: [DISTRICT.x, 1.2, DISTRICT.z] as V3, fov: 32, arc: 0.6, drift: 0.1},
			{at: nextAt, dur: 55, pos: [0.3, 3.2, 11.8], look: [1.0, 1, -1.3] as V3, fov: 40, drift: 0.14},
			{at: payoffAt, dur: 40, pos: [-0.5, 3.4, 12.2], look: [1.0, 1, -1.3] as V3, fov: 42, drift: 0.12},
		],
		[heroAt, growthWord, nextAt, payoffAt],
	);
	const path = useMemo(() => cameraPath(shots, 30), [shots]);

	const actions: {at: number; do: MoAction}[] = [
		{at: 0, do: 'idle'},
		{at: heroAt, do: 'cheer'},
		{at: twistAt, do: 'idle'},
		{at: payoffWave, do: 'wave'},
	];
	const moods: {at: number; mood: MoMood}[] = [
		{at: 0, mood: 'neutral'},
		{at: heroAt, mood: 'happy'},
		{at: twistAt, mood: 'happy'},
	];

	return (
		<AbsoluteFill>
			<ThreeCanvas width={width} height={height}>
				<NightLights />
				<CameraRig path={path} />
				<Ground />
				<Mo
				path={[
					{at: 0, ...MO},
					{at: twistAt + 10, ...MO},
					{at: growthWord - 10, x: -6, z: 3},
					{at: payoffAt - 45, ...MO},
				]}
				facing={0}
				actions={actions}
				moods={moods}
			/>
				<District x={DISTRICT.x} z={DISTRICT.z} radius={1.4} count={16} at={growthWord} seed={7} maxHeight={3} />
			</ThreeCanvas>

			<HeroStat at={heroAt} until={twistAt} value={10000} sub="weekly active users" />
			<FlipBoard at={flipAt} until={skylineAt} title="COHORT GROWTH" text="90 DAYS AGO" top={420} />
			<MapLabels
				path={path}
				labels={[{text: 'COHORT GROWTH', at: skylineAt, until: nextAt + 20, world: [DISTRICT.x, 2.6, DISTRICT.z] as V3, side: 'right'}]}
			/>
			<HeroStat at={milestoneAt} until={payoffAt + 50} value={50000} sub="next milestone" />
			<FlipBoard at={shipsAt} until={payoffAt + 50} text="REFERRALS" top={760} />
			<Disclaimer text="Placeholder numbers — swap in your own data." />

			<ExampleSound path={path} heroAt={heroAt} growthWord={growthWord} flipAt={flipAt} skylineAt={skylineAt} milestoneAt={milestoneAt} shipsAt={shipsAt} />
		</AbsoluteFill>
	);
};
