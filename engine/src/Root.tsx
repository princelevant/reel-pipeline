import {Composition, staticFile, type CalculateMetadataFunction} from 'remotion';
import {EpisodeShell} from './kit/Episode';
import {FPS, totalFrames, type Timeline} from './kit/timeline';

// Every engine/src/episodes/<slug>/Scene.tsx that exports `Scene` becomes composition <slug>.
// No shared registry to edit, so episodes can be built in parallel.
const ctx = require.context('./episodes', true, /^\.\/[a-z0-9-]+\/Scene\.tsx$/);
const EPISODES = ctx.keys().map((key) => {
	const mod = ctx(key) as {Scene?: React.FC};
	const slug = key.split('/')[1];
	if (!mod.Scene) throw new Error(`episodes/${slug}/Scene.tsx must export \`Scene\``);
	return {slug, Scene: mod.Scene};
});

type Props = {timeline: Timeline | null};

const loadTimeline =
	(slug: string): CalculateMetadataFunction<Props> =>
	async () => {
		const res = await fetch(staticFile(`episodes/${slug}/timeline.json`));
		if (!res.ok) throw new Error(`No timeline for "${slug}" — run: npm run vo -- ${slug} [--draft]`);
		const timeline = (await res.json()) as Timeline;
		return {durationInFrames: totalFrames(timeline), props: {timeline}};
	};

export const RemotionRoot: React.FC = () => (
	<>
		{EPISODES.map(({slug, Scene}) => (
			<Composition
				key={slug}
				id={slug}
				component={({timeline}: Props) => (timeline ? <EpisodeShell timeline={timeline}><Scene /></EpisodeShell> : null)}
				width={1080}
				height={1920}
				fps={FPS}
				durationInFrames={FPS}
				defaultProps={{timeline: null}}
				calculateMetadata={loadTimeline(slug)}
			/>
		))}
	</>
);
