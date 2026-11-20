// Editor QA: one frame per beat (start+0.5 s and middle) from a rendered video, tiled into a
// contact sheet, plus the beat text — so a reviewer can check "does the picture say what the
// voice says, on time" in one look.
//
//   npm run qa -- <slug> [video=out/<slug>.mp4]
//   → out/<slug>-qa.png  (rows = beats, left = beat start, right = beat middle)
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync} from 'node:fs';
import type {Timeline} from '../src/kit/timeline.ts';

const [slug, video = `out/${slug}.mp4`] = process.argv.slice(2);
if (!slug) {
	console.error('usage: npm run qa -- <slug> [video]');
	process.exit(1);
}
const t: Timeline = JSON.parse(readFileSync(`public/episodes/${slug}/timeline.json`, 'utf8'));
const tmp = `out/.qa-${slug}`;
rmSync(tmp, {recursive: true, force: true});
mkdirSync(tmp, {recursive: true});

const shots: {sec: number; label: string}[] = [];
for (const b of t.beats) {
	shots.push({sec: b.startMs / 1000 + 0.5, label: `${b.id} start`});
	shots.push({sec: (b.startMs + b.endMs) / 2000, label: `${b.id} mid`});
}
shots.push({sec: t.voMs / 1000 + 1.5, label: 'end card'});

shots.forEach((s, i) => {
	execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', s.sec.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=360:-1', `${tmp}/${String(i).padStart(3, '0')}.png`]);
});
const out = `out/${slug}-qa.png`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', `${tmp}/*.png`, '-vf', `tile=4x${Math.ceil(shots.length / 4)}:padding=6`, '-frames:v', '1', out]);
rmSync(tmp, {recursive: true, force: true});

console.log(`${out} — read left→right, top→bottom:`);
shots.forEach((s, i) => console.log(`  [${i + 1}] ${s.sec.toFixed(1)}s ${s.label}`));
console.log('\nBeat text:');
for (const b of t.beats) {
	console.log(`  ${b.id}: ${t.words.filter((w) => w.beat === b.id).map((w) => w.text).join(' ')}`);
}
if (t.draft) console.log('\n⚠ DRAFT timeline (estimated timing, no VO) — sync is approximate until `npm run vo -- ' + slug + '`');
