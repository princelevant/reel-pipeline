// Final loudness pass on the EXPORTED video (VO + SFX + music as the viewer hears them):
// pins integrated loudness to -16 LUFS with true peak ≤ -4 dBTP so nothing clips after the
// platform's AAC re-encode or on a phone speaker. Video stream is copied untouched.
//
//   npm run master -- <slug> [in=out/<slug>.mp4]     → overwrites the input, prints before/after (stereo + mono)
import {spawnSync, execFileSync} from 'node:child_process';
import {renameSync} from 'node:fs';

const TARGET_LUFS = -16;
const LIMIT_DB = -5; // sample-peak ceiling; leaves ~1 dB for inter-sample peaks under the -4 dBTP target

const [slug, input = `out/${slug}.mp4`] = process.argv.slice(2);
if (!slug) {
	console.error('usage: npm run master -- <slug> [video]');
	process.exit(1);
}

/** Integrated loudness + true peak from ffmpeg's ebur128 summary (it reports on stderr). */
const loudness = (file: string, mono = false) => {
	const {stderr} = spawnSync('ffmpeg', ['-nostats', '-hide_banner', '-i', file, ...(mono ? ['-ac', '1'] : []), '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8'});
	const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
	const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
	const tp = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
	if (Number.isNaN(lufs) || Number.isNaN(tp)) throw new Error(`could not measure ${file}:\n${stderr.slice(-500)}`);
	return {lufs, tp};
};

const before = loudness(input);
const tmp = input.replace(/\.mp4$/, '.master.mp4');
execFileSync('ffmpeg', [
	'-v', 'error', '-y', '-i', input,
	'-c:v', 'copy',
	'-af', `volume=${(TARGET_LUFS - before.lufs).toFixed(2)}dB,alimiter=limit=${Math.pow(10, LIMIT_DB / 20).toFixed(3)}:level=false`,
	'-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
	'-movflags', '+faststart', tmp,
]);
renameSync(tmp, input);
const after = loudness(input);
const mono = loudness(input, true);
console.log(`${input}: ${before.lufs} LUFS / ${before.tp} dBTP  →  ${after.lufs} LUFS / ${after.tp} dBTP (mono ${mono.lufs} LUFS / ${mono.tp} dBTP)`);
if (Math.abs(after.lufs - TARGET_LUFS) > 1 || after.tp > -4) console.log('⚠ outside target (-16 ±1 LUFS, ≤ -4 dBTP): look for one sound dominating the mix');
