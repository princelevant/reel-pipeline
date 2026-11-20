import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

export const {fontFamily: SANS} = loadInter('normal', {weights: ['500', '700', '800'], subsets: ['latin']});
export const {fontFamily: MONO} = loadMono('normal', {weights: ['500', '700'], subsets: ['latin']});

/** Night-map palette. Change here, every episode follows. */
export const C = {
	sea: '#16294f',
	land: '#0f131c',
	fog: '#0b1222',
	road: '#323b4d',
	roadPrimary: '#4a5570',
	roadMajor: '#c9a45c',
	accent: '#3fa9ff', // the story's "hero" colour (route, pins)
	accentSoft: '#8ab4ff', // caption keyword tint (measured from reference)
	gold: '#f2c46b',
	text: '#ffffff',
	pill: 'rgba(8, 10, 16, 0.62)',
	building: ['#8ea2c8', '#a7b6d6', '#7b8fb8', '#b9c4dc'], // multiplies the facade texture
	windows: '#ffd58a',
};
