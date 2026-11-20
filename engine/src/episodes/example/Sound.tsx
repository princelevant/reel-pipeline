// Sound-designer output for episodes/example/script.json: one SFX Kit sound per on-screen
// event, on the same cue() frame Scene.tsx uses for the visual.
import type {CameraPath} from '../../kit/camera';
import {CameraWhooshes, Sound} from '../../kit/Sound';

export const ExampleSound: React.FC<{
	path: CameraPath;
	heroAt: number;
	growthWord: number;
	flipAt: number;
	skylineAt: number;
	milestoneAt: number;
	shipsAt: number;
}> = ({path, heroAt, growthWord, flipAt, skylineAt, milestoneAt, shipsAt}) => (
	<>
		<CameraWhooshes path={path} gainDb={-4} />

		{/* hook: the first HeroStat counts up and lands */}
		<Sound id="data-countup-short" at={heroAt} gainDb={-4} />
		<Sound id="data-number-land" at={heroAt + 18} gainDb={-2} />

		{/* growth: the flip board settles, the skyline starts rising */}
		<Sound id="mechanical-latch-light" at={flipAt + 20} gainDb={-4} />
		<Sound id="transform-grow" at={growthWord} gainDb={-3} />

		{/* skyline: the label pops in once the tallest block has had time to rise */}
		<Sound id="pop-small-in" at={skylineAt} gainDb={-4} />

		{/* next: the second HeroStat and the referrals board */}
		<Sound id="data-countup-short" at={milestoneAt} gainDb={-4} />
		<Sound id="data-number-land" at={milestoneAt + 18} gainDb={-2} />
		<Sound id="mechanical-latch-light" at={shipsAt + 20} gainDb={-4} />
	</>
);
