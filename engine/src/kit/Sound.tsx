// Sound effects from Wyzowl's SFX Kit (CC0), placed by its data instead of by ear:
//   start = moment − sync.at        (sync.at points at the part of the sound that meets the moment)
//   gain  = gainDb + under_voiceover_db   when the sound's body overlaps speech
// Files: public/sfx-kit (npm run sfx:sync). Pick sounds from public/sfx-kit/catalogue.md + GUIDE.md.
import {Audio} from '@remotion/media';
import {Sequence, staticFile, useVideoConfig} from 'remotion';
import type {CameraPath} from './camera';
import catalog from './sfx-catalog.json';
import {useTimeline} from './timeline';

export type SoundId = keyof typeof catalog;

type Entry = {
	file: string;
	duration: number;
	syncAt: number;
	onset: number;
	bodyEnd: number;
	underVoDb: number;
	rate: number[];
	coversVoice: boolean;
};

/**
 * One sound effect whose sync point lands on frame `at` (a cue(), a camera move peak, an element's entrance).
 * `rate` speeds up / slows down (pitch moves with it) within the kit's allowed range — e.g. to fit a count-up's length.
 */
export const Sound: React.FC<{id: SoundId; at: number; gainDb?: number; rate?: number}> = ({id, at, gainDb = 0, rate = 1}) => {
	const {fps} = useVideoConfig();
	const t = useTimeline();
	const s: Entry = catalog[id];
	if (rate < s.rate[0] || rate > s.rate[1]) throw new Error(`Sound ${id}: rate ${rate} outside ${s.rate.join('–')}`);
	const startSec = at / fps - s.syncAt / rate;
	const bodyMs: [number, number] = [(startSec + s.onset / rate) * 1000, (startSec + s.bodyEnd / rate) * 1000];
	const overSpeech = t.words.some((w) => w.startMs < bodyMs[1] && w.endMs > bodyMs[0]);
	const db = gainDb + (overSpeech ? s.underVoDb : 0);
	const from = Math.round(startSec * fps);
	return (
		<Sequence from={Math.max(0, from)} durationInFrames={Math.ceil((s.duration / rate) * fps) + 1} layout="none" name={`sfx ${id}`}>
			<Audio src={staticFile(`sfx-kit/${s.file}`)} volume={Math.pow(10, db / 20)} playbackRate={rate} trimBefore={from < 0 ? -from * rate : undefined} />
		</Sequence>
	);
};

/**
 * A whoosh on every camera glide, sized to the move (SFX Kit fits: medium 0.28–0.81 s, slow 0.52–1.5 s)
 * and placed at its fastest point — the middle, since cameraPath eases in-out. Moves longer than 1.5 s
 * get a slow whoosh at the peak; pair those with a riser in the episode if they build to a reveal.
 */
export const CameraWhooshes: React.FC<{path: CameraPath; intensity?: 'soft' | 'medium'; gainDb?: number}> = ({
	path,
	intensity = 'soft',
	gainDb = 0,
}) => {
	const {fps} = useVideoConfig();
	return (
		<>
			{path.moves.map((m) => {
				const secs = m.dur / fps;
				const id: SoundId = secs <= 0.81 ? `whoosh-medium-${intensity}` : `whoosh-slow-${intensity}`;
				return <Sound key={m.start} id={id} at={m.start + Math.round(m.dur / 2)} gainDb={gainDb} />;
			})}
		</>
	);
};
