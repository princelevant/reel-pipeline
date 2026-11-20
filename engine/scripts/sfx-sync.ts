// Pulls Wyzowl's SFX Kit (320 CC0 sounds with sync points and mix data) into the engine.
//
//   npm run sfx:sync
//
// → public/sfx-kit/{sounds/…wav, sounds.json, catalogue.md, GUIDE.md}   (git-ignored, 65 MB)
// → src/kit/sfx-catalog.json   (committed: the placement data <Sound> needs, ~50 KB)
//
// Pinned to one commit and every file is checked against its sha256, so a render never
// changes because the upstream kit did. Bump SFX_KIT_COMMIT to update.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const SFX_KIT_COMMIT = '92780e7ab0cdfb557497a988089c47f46e8c7412'; // wyzowl/sfx-kit v1.0.0
const DEST = 'public/sfx-kit';

type KitSound = {
	id: string;
	category: string;
	file: string;
	duration: number;
	sync: {at: number; meets: string};
	timing: {onset: number; body_end: number};
	fits_seconds?: [number, number];
	under_voiceover_db: number;
	adapt: {rate: [number, number]};
	avoid_for: string[];
	sha256: string;
};

const tmp = mkdtempSync(join(tmpdir(), 'sfx-kit-'));
try {
	const tgz = join(tmp, 'kit.tar.gz');
	const res = await fetch(`https://codeload.github.com/wyzowl/sfx-kit/tar.gz/${SFX_KIT_COMMIT}`);
	if (!res.ok) throw new Error(`download failed: ${res.status}`);
	writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
	execFileSync('tar', ['-xzf', tgz, '-C', tmp, '--strip-components=1']);

	const kit = JSON.parse(readFileSync(join(tmp, 'sounds.json'), 'utf8')) as {sounds: KitSound[]};
	for (const s of kit.sounds) {
		const sha = createHash('sha256').update(readFileSync(join(tmp, s.file))).digest('hex');
		if (sha !== s.sha256) throw new Error(`checksum mismatch: ${s.file}`);
	}

	if (existsSync(DEST)) rmSync(DEST, {recursive: true});
	for (const f of ['sounds', 'sounds.json', 'catalogue.md', 'GUIDE.md', 'LICENSE']) cpSync(join(tmp, f), join(DEST, f), {recursive: true});

	const catalog = Object.fromEntries(
		kit.sounds.map((s) => [
			s.id,
			{
				file: s.file,
				duration: s.duration,
				syncAt: s.sync.at,
				meets: s.sync.meets,
				onset: s.timing.onset,
				bodyEnd: s.timing.body_end,
				fits: s.fits_seconds ?? null,
				underVoDb: s.under_voiceover_db,
				rate: s.adapt.rate,
				coversVoice: s.avoid_for.some((a) => a.startsWith('On top of speech')),
			},
		]),
	);
	writeFileSync('src/kit/sfx-catalog.json', JSON.stringify(catalog, null, '\t'));
	console.log(`sfx-kit @ ${SFX_KIT_COMMIT.slice(0, 7)}: ${kit.sounds.length} sounds verified → ${DEST}, catalog → src/kit/sfx-catalog.json`);
} finally {
	rmSync(tmp, {recursive: true, force: true});
}
