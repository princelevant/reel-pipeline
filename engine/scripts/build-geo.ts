// Only needed if profile.json "world.map" is true. Converts raw Overpass dumps in
// data/osm/*.json into one compact, pre-projected file (public/geo/world.json) that
// every episode's 3D world can load.
//
//   node --experimental-strip-types scripts/build-geo.ts
//
// Map data © OpenStreetMap contributors (ODbL). Credit it in the post description.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {BBOX, project, type XZ} from '../src/kit/geo.ts';

type LatLon = {lat: number; lon: number};
type OsmEl = {
	type: 'way' | 'relation' | 'node';
	tags?: Record<string, string>;
	geometry?: LatLon[];
	members?: {type: string; role: string; geometry?: LatLon[]}[];
	lat?: number;
	lon?: number;
};

const load = (f: string): OsmEl[] => {
	const p = `data/osm/${f}`;
	if (!existsSync(p)) return [];
	return JSON.parse(readFileSync(p, 'utf8')).elements;
};

const r = (n: number) => Math.round(n * 100) / 100;
const toXZ = (g: LatLon[]): XZ[] => g.map((p) => project(p.lon, p.lat));

// Douglas–Peucker in projected units (1 unit = 100 m).
const simplify = (pts: XZ[], tol: number): XZ[] => {
	if (pts.length < 3) return pts;
	const [ax, az] = pts[0];
	const [bx, bz] = pts[pts.length - 1];
	const dx = bx - ax;
	const dz = bz - az;
	const len = Math.hypot(dx, dz) || 1;
	let maxD = 0;
	let idx = 0;
	for (let i = 1; i < pts.length - 1; i++) {
		const d = Math.abs(dz * pts[i][0] - dx * pts[i][1] + bx * az - bz * ax) / len;
		if (d > maxD) {
			maxD = d;
			idx = i;
		}
	}
	if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
	return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
};

/**
 * Douglas–Peucker for CLOSED rings. Plain DP measures distance to the first→last chord, which for a ring is a
 * single point, so every ring collapsed to 2 points (islands and lakes vanished, e.g. Palm Jumeirah).
 * Split at the vertex farthest from the start and simplify both halves.
 */
const simplifyRing = (pts: XZ[], tol: number): XZ[] => {
	if (pts.length < 5) return pts;
	let far = 1;
	for (let i = 1; i < pts.length - 1; i++) {
		if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
	}
	return [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify(pts.slice(far), tol)];
};

const flat = (pts: XZ[]) => pts.flatMap(([x, z]) => [r(x), r(z)]);

const B = (() => {
	const a = project(BBOX.west, BBOX.south);
	const b = project(BBOX.east, BBOX.north);
	return {minX: a[0], maxX: b[0], minZ: b[1], maxZ: a[1]};
})();
const inside = ([x, z]: XZ) => x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ;

// --- roads ---------------------------------------------------------------
const roadClasses = ['motorway', 'trunk', 'primary', 'secondary'] as const;
const roads: Record<string, number[][]> = Object.fromEntries(roadClasses.map((c) => [c, []]));
for (const el of load('roads.json')) {
	const cls = el.tags?.highway?.replace('_link', '');
	if (!el.geometry || !cls || !(cls in roads)) continue;
	roads[cls].push(flat(simplify(toXZ(el.geometry), 0.08)));
}

// --- coastline → land polygons ---------------------------------------------
// OSM coastline ways keep land on the LEFT. Join them into chains; closed chains
// are islands, open chains are clipped to the bbox and closed by walking the bbox
// perimeter counter-clockwise (keeps land on the left = interior).
const joinChains = (ways: XZ[][], undirected = false): XZ[][] => {
	const key = (p: XZ) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
	const pending = ways.map((w) => [...w]);
	const chains: XZ[][] = [];
	while (pending.length) {
		let chain = pending.pop()!;
		let grown = true;
		while (grown) {
			grown = false;
			for (let i = 0; i < pending.length; i++) {
				const w = pending[i];
				if (key(chain[chain.length - 1]) === key(w[0])) chain = [...chain, ...w.slice(1)];
				else if (key(w[w.length - 1]) === key(chain[0])) chain = [...w, ...chain.slice(1)];
				else if (undirected && key(chain[chain.length - 1]) === key(w[w.length - 1])) chain = [...chain, ...[...w].reverse().slice(1)];
				else if (undirected && key(w[0]) === key(chain[0])) chain = [...[...w].reverse(), ...chain.slice(1)];
				else continue;
				pending.splice(i, 1);
				grown = true;
				break;
			}
		}
		chains.push(chain);
	}
	return chains;
};

// Clip an open polyline to the bbox: returns the pieces that lie inside, with
// their entry/exit points snapped onto the bbox edge.
const clipPolyline = (pts: XZ[]): XZ[][] => {
	const pieces: XZ[][] = [];
	let cur: XZ[] = [];
	const cross = (a: XZ, b: XZ): XZ => {
		// parametric intersection of segment a→b with the bbox boundary (first hit from the inside point)
		let tBest = 1;
		const [ax, az] = a;
		const dx = b[0] - ax;
		const dz = b[1] - az;
		for (const [edge, v] of [
			['x', B.minX],
			['x', B.maxX],
			['z', B.minZ],
			['z', B.maxZ],
		] as const) {
			const d = edge === 'x' ? dx : dz;
			if (d === 0) continue;
			const t = (v - (edge === 'x' ? ax : az)) / d;
			if (t < 0 || t > 1) continue;
			const p: XZ = [ax + dx * t, az + dz * t];
			if (p[0] >= B.minX - 1e-6 && p[0] <= B.maxX + 1e-6 && p[1] >= B.minZ - 1e-6 && p[1] <= B.maxZ + 1e-6)
				tBest = Math.min(tBest, t);
		}
		return [ax + dx * tBest, az + dz * tBest];
	};
	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const inP = inside(p);
		if (i > 0) {
			const prev = pts[i - 1];
			const inPrev = inside(prev);
			if (inPrev && !inP) {
				cur.push(cross(prev, p));
				pieces.push(cur);
				cur = [];
			} else if (!inPrev && inP) {
				cur = [cross(p, prev)];
			}
		}
		if (inP) cur.push(p);
	}
	if (cur.length) pieces.push(cur);
	return pieces.filter((p) => p.length > 1);
};

// Position along the bbox perimeter, counter-clockwise *as seen on screen*
// (x right, z down = south): bottom edge →, right edge ↑, top edge ←, left edge ↓.
const W = B.maxX - B.minX;
const H = B.maxZ - B.minZ;
const perim = ([x, z]: XZ) => {
	const e = 1e-4;
	if (Math.abs(z - B.maxZ) < e) return x - B.minX;
	if (Math.abs(x - B.maxX) < e) return W + (B.maxZ - z);
	if (Math.abs(z - B.minZ) < e) return W + H + (B.maxX - x);
	return 2 * W + H + (z - B.minZ);
};
const corners: [number, XZ][] = [
	[W, [B.maxX, B.maxZ]],
	[W + H, [B.maxX, B.minZ]],
	[2 * W + H, [B.minX, B.minZ]],
	[2 * W + 2 * H, [B.minX, B.maxZ]],
];
const P = 2 * W + 2 * H;

// OSM keeps land on the LEFT when viewed north-up, which is exactly the on-screen
// orientation `perim` uses, so the walk from an exit to the next entry keeps land on
// the left by running counter-clockwise, i.e. *increasing* perimeter position.
const closeOpenPieces = (pieces: XZ[][]): XZ[][] => {
	const rings: XZ[][] = [];
	const remaining = [...pieces];
	while (remaining.length) {
		let ring = remaining.shift()!;
		for (let guard = 0; guard < 64; guard++) {
			const exit = ring[ring.length - 1];
			const pe = perim(exit);
			// next entry = closest perimeter position walking forwards from pe
			const dist = (q: number) => (((q - pe) % P) + P) % P;
			let bestIdx = -1;
			let bestD = dist(perim(ring[0]));
			remaining.forEach((pc, i) => {
				const d = dist(perim(pc[0]));
				if (d < bestD) {
					bestD = d;
					bestIdx = i;
				}
			});
			const target = bestIdx === -1 ? ring[0] : remaining[bestIdx][0];
			const walk = corners
				.map(([pos, c]) => [dist(pos), c] as const)
				.filter(([d]) => d > 1e-6 && d < bestD)
				.sort((a, b) => a[0] - b[0])
				.map(([, c]) => c);
			ring = [...ring, ...walk];
			if (bestIdx === -1) break;
			ring = [...ring, target, ...remaining[bestIdx].slice(1)];
			remaining.splice(bestIdx, 1);
			void target;
		}
		rings.push(ring);
	}
	return rings;
};

const coastWays = load('coast.json')
	.filter((e) => e.geometry)
	.map((e) => toXZ(e.geometry!));
const chains = joinChains(coastWays);
const closed = chains.filter((c) => c.length > 3 && Math.hypot(c[0][0] - c[c.length - 1][0], c[0][1] - c[c.length - 1][1]) < 1e-3);
const open = chains.filter((c) => !closed.includes(c));
const land = [
	...closed.filter((c) => c.some(inside)),
	...closeOpenPieces(open.flatMap(clipPolyline)),
].map((ring) => flat(simplifyRing(ring, 0.05)));
const coast = chains.flatMap(clipPolyline).map((c) => flat(simplify(c, 0.05)));

// --- inland water (lakes, lagoons) -------------------------------------------
const water: number[][] = [];
for (const el of load('water.json')) {
	if (el.type === 'way' && el.geometry && el.geometry.length > 3) {
		water.push(flat(simplifyRing(toXZ(el.geometry), 0.05)));
	} else if (el.type === 'relation' && el.members) {
		const outers = el.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => toXZ(m.geometry!));
		for (const ring of joinChains(outers)) water.push(flat(simplifyRing(ring, 0.05)));
	}
}

// --- metro/rail lines, joined into chains. The red/green/blue line-name matching below is an
// example — rename to match your own city's actual line names (OSM railway=* ways, incl.
// railway=construction for lines being built).
const metroWays: Record<'red' | 'green' | 'blue', XZ[][]> = {red: [], green: [], blue: []};
for (const el of load('rail.json')) {
	const name = el.tags?.['name:en'] ?? el.tags?.name ?? '';
	const line = /blue/i.test(name) ? 'blue' : /red/i.test(name) ? 'red' : /green/i.test(name) ? 'green' : null;
	if (el.type !== 'way' || !el.geometry || !line) continue;
	metroWays[line].push(toXZ(el.geometry));
}
const metro = Object.fromEntries(
	Object.entries(metroWays).map(([k, ways]) => [k, joinChains(ways, true).map((c) => flat(simplify(c, 0.03)))]),
) as Record<'red' | 'green' | 'blue', number[][]>;

// --- metro stations (existing + planned, as mapped in OSM) -------------------
const stations = load('places.json')
	.filter((e) => e.type === 'node' && e.tags?.station === 'subway')
	.map((e) => {
		const [x, z] = project(e.lon!, e.lat!);
		return {name: e.tags!['name:en'] ?? e.tags!.name, x: r(x), z: r(z)};
	});

const out = {bounds: {minX: r(B.minX), maxX: r(B.maxX), minZ: r(B.minZ), maxZ: r(B.maxZ)}, roads, land, coast, water, metro, stations};
writeFileSync('public/geo/world.json', JSON.stringify(out));
const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(
	`public/geo/world.json ${kb} KB — roads ${Object.entries(roads)
		.map(([k, v]) => `${k}:${v.length}`)
		.join(' ')}, land rings ${land.length}, coast pieces ${coast.length}, water ${water.length}, metro ${Object.entries(metro).map(([k, v]) => `${k}:${v.length}`).join(' ')}, stations ${stations.length}`,
);
