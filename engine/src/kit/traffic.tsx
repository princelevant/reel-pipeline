// Deterministic toy traffic for one signalised 4-arm junction (diorama scale: a car ≈ 1 unit long).
// `simulateJunction` precomputes every tick from tick 0 (pure function of its config: hash-seeded arrivals,
// signal and downstream schedules as functions of the tick), so any frame can be rendered on its own.
// `<TrafficCars>` draws one frame of a simulation as instanced ToyCar look-alikes (a handful of draw calls
// for hundreds of cars), animated only from useCurrentFrame().
//
// Model: one lane per direction, straight-through movements only. Each movement's route is
//   approach cells (0 … approachCells-1, the last one is the stop line) → 2 box cells → exit cells.
// The 2×2 box cells are shared by the crossing movements; a car advances at most one cell per tick.
// Rules at the stop line (the one thing two runs usually differ by):
//   'block': on green, enter when the first box cell is free, even if the exit is full (drivers then grab
//            any cell that frees up before a car already in the box can take it). This can fill the box and,
//            with a full exit, lock four cars in a loop that never resolves.
//   'clear': on green, enter only when your exit has room for you and the far box cell is free or held by a car
//            going your way ("don't enter unless you can exit"). The box can't deadlock.
// Continue a run from another run's state (`from`) to replay "same cars, one rule changed" from any tick.
import {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import {Color, InstancedMesh, Object3D} from 'three';

/** Travel direction in sim space: E = +x, S = +z, W = −x, N = −z (three.js: −z is away from a default camera). */
export type Dir = 'E' | 'S' | 'W' | 'N';
export const DIRS: Dir[] = ['E', 'S', 'W', 'N'];
const VEC: Record<Dir, [number, number]> = {E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1]};

export type JunctionRule = 'block' | 'clear';

export type JunctionConfig = {
	seed: number;
	/** ticks to simulate (the result has ticks + 1 states, 0 … ticks) */
	ticks: number;
	rule: JunctionRule;
	approachCells: number;
	exitCells: number;
	/** probability of a new car per tick, per direction */
	arrival: (dir: Dir, tick: number) => number;
	/** is the stop line of `dir` green at `tick` */
	green: (dir: Dir, tick: number) => boolean;
	/** does the downstream end of `dir`'s exit let its front car leave at `tick` */
	release: (dir: Dir, tick: number) => boolean;
	/** continue from another run's state at its tick `from.tick` (same car ids, same pending arrivals) */
	from?: {sim: JunctionSim; tick: number};
	/** cars waiting off-screen to enter at tick 0 (warm start), per direction */
	backlog?: Partial<Record<Dir, number>>;
};

/** One car in one tick: route cell index (0 = far end of the approach). */
export type CarState = {id: number; dir: Dir; cell: number};
export type TickState = {cars: CarState[]; backlog: Record<Dir, number[]>};
export type JunctionSim = {
	config: JunctionConfig;
	/** states[t] for t = start … start + ticks; index with stateAt() */
	start: number;
	states: TickState[];
	/** route length in cells (approach + 2 box + exit) */
	routeCells: number;
	/** first box cell index (= approachCells) */
	boxCell: number;
};

/** 0…1, stable for (seed, a, b). */
export const hash01 = (seed: number, a: number, b: number) => {
	let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(b + 0x2545f491, 0x27d4eb2f);
	h ^= h >>> 15;
	h = Math.imul(h, 0x2c1b3c6d);
	h ^= h >>> 12;
	h = Math.imul(h, 0x297a2d39);
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
};

/** Box cell key for a direction's k-th box cell (k = 0, 1); cells are the 2×2 quadrants of the box. */
const boxKey = (dir: Dir, k: number) => {
	const [dx, dz] = VEC[dir];
	// right-hand traffic: the lane sits on the right of the travel direction, right = (−dz, dx)
	const rx = -dz;
	const rz = dx;
	const along = k === 0 ? -1 : 1;
	const x = Math.sign(dx * along + rx);
	const z = Math.sign(dz * along + rz);
	return `${x},${z}`;
};

/** Stable car id from the arrival (direction, tick): the same arrival is the same car in every run. */
export const carId = (dir: Dir, tick: number) => tick * 4 + DIRS.indexOf(dir);

export const simulateJunction = (config: JunctionConfig): JunctionSim => {
	const {seed, ticks, rule, approachCells: A, exitCells: X, arrival, green, release} = config;
	const B = A; // first box cell
	const EXIT = A + 2; // first exit cell
	const L = A + 2 + X;
	const start = config.from ? config.from.tick : 0;
	const init: TickState = config.from
		? stateAt(config.from.sim, config.from.tick)
		: {
				cars: [],
				backlog: Object.fromEntries(DIRS.map((d) => [d, Array.from({length: config.backlog?.[d] ?? 0}, (_, i) => carId(d, -1 - i))])) as Record<Dir, number[]>,
			};
	const states: TickState[] = [init];
	for (let tick = start + 1; tick <= start + ticks; tick++) {
		const prev = states[states.length - 1];
		// occupancy: per-direction lane cells (approach/exit) and shared box cells
		const cells = new Map<string, number>();
		const key = (dir: Dir, cell: number) => (cell === B || cell === B + 1 ? boxKey(dir, cell - B) : `${dir}${cell}`);
		const cars = prev.cars.map((c) => ({...c}));
		for (const c of cars) cells.set(key(c.dir, c.cell), c.id);
		const free = (dir: Dir, cell: number) => !cells.has(key(dir, cell));
		const move = (c: CarState, to: number) => {
			cells.delete(key(c.dir, c.cell));
			c.cell = to;
			if (to < L) cells.set(key(c.dir, to), c.id);
		};
		const byDir = (d: Dir, lo: number, hi: number) => cars.filter((c) => c.dir === d && c.cell >= lo && c.cell <= hi).sort((a, b) => b.cell - a.cell);
		// cars on the exit or in the box heading to `dir`'s exit, vs its room
		const exitRoom = (d: Dir) => X - cars.filter((c) => c.dir === d && c.cell >= B).length;

		// 1. exits, front to back; the front car leaves when downstream releases
		for (const d of DIRS) {
			for (const c of byDir(d, EXIT, L - 1)) {
				if (c.cell === L - 1) {
					if (release(d, tick)) move(c, L);
				} else if (free(d, c.cell + 1)) move(c, c.cell + 1);
			}
		}
		// 2. second box cell → exit
		for (const d of DIRS) for (const c of byDir(d, B + 1, B + 1)) if (free(d, EXIT)) move(c, EXIT);
		// 3. first box cell → second, unless a driver with green is nosing into that same cell from the cross street
		//    (cross traffic on green takes a freed cell before the car already in the box can)
		const atStopLine = (d: Dir) => (green(d, tick) ? byDir(d, A - 1, A - 1)[0] : undefined);
		// 'clear': the far box cell must be free or held by a car going your way (it moves on), and your exit must have room
		const ownOrFree = (d: Dir) => {
			const id = cells.get(key(d, B + 1));
			return id === undefined || cars.find((c) => c.id === id)?.dir === d;
		};
		const mayEnter = (d: Dir) => free(d, B) && (rule === 'block' || (ownOrFree(d) && exitRoom(d) > 0));
		for (const d of DIRS) {
			for (const c of byDir(d, B, B)) {
				const target = boxKey(d, 1);
				const cross = DIRS.find((e) => boxKey(e, 0) === target) as Dir;
				if (free(d, B + 1) && !(atStopLine(cross) && mayEnter(cross))) move(c, B + 1);
			}
		}
		// 4. stop line → box
		for (const d of DIRS) {
			const c = atStopLine(d);
			if (c && mayEnter(d)) move(c, B);
		}
		// 5. approaches, front to back (stop-line car already handled)
		for (const d of DIRS) for (const c of byDir(d, 0, A - 2)) if (free(d, c.cell + 1)) move(c, c.cell + 1);
		// 6. arrivals: hash-seeded, the same in every run; queue off-screen when the first cell is taken
		const backlog = Object.fromEntries(DIRS.map((d) => [d, [...prev.backlog[d]]])) as Record<Dir, number[]>;
		for (const d of DIRS) {
			if (hash01(seed, tick, DIRS.indexOf(d)) < arrival(d, tick)) backlog[d].push(carId(d, tick));
			if (backlog[d].length && free(d, 0)) {
				const id = backlog[d].shift() as number;
				const c = {id, dir: d, cell: 0};
				cars.push(c);
				cells.set(key(d, 0), id);
			}
		}
		states.push({cars: cars.filter((c) => c.cell < L), backlog});
	}
	return {config, start, states, routeCells: L, boxCell: B};
};

/** State at an absolute tick (clamped to the run). */
export const stateAt = (sim: JunctionSim, tick: number): TickState =>
	sim.states[Math.max(0, Math.min(sim.states.length - 1, Math.round(tick) - sim.start))];

/**
 * Cars that sit in the box waiting for a cell another box car holds, closing a cycle (the gridlock loop).
 * Empty when the box can still drain.
 */
export const boxLoop = (sim: JunctionSim, tick: number): CarState[] => {
	const s = stateAt(sim, tick);
	const B = sim.boxCell;
	const inBox = s.cars.filter((c) => c.cell === B);
	const holder = new Map(s.cars.filter((c) => c.cell === B || c.cell === B + 1).map((c) => [boxKey(c.dir, c.cell - B), c]));
	for (const startCar of inBox) {
		const seen: CarState[] = [];
		let c: CarState | undefined = startCar;
		while (c && c.cell === B && !seen.includes(c)) {
			seen.push(c);
			c = holder.get(boxKey(c.dir, 1));
		}
		if (c && c === startCar) return seen;
	}
	return [];
};

/** Geometry of the drawn junction (sim space, before any group rotation). */
export type JunctionLayout = {
	/** lane width; the box is 2 × lane square */
	lane: number;
	/** spacing of approach / exit cells (≥ car length) */
	cell: number;
	/** gap between the stop-line cell and the box edge (crosswalk) */
	stopGap: number;
};

/** World position (sim space) of a car at a fractional route position. */
export const routePoint = (sim: JunctionSim, layout: JunctionLayout, dir: Dir, pos: number): {x: number; z: number; heading: number} => {
	const {lane, cell, stopGap} = layout;
	const A = sim.boxCell;
	const along = (p: number) => {
		if (p <= A - 1) return -lane - stopGap - cell / 2 - (A - 1 - p) * cell;
		if (p <= A) return lerp(-lane - stopGap - cell / 2, -lane / 2, p - (A - 1));
		if (p <= A + 1) return lerp(-lane / 2, lane / 2, p - A);
		if (p <= A + 2) return lerp(lane / 2, lane + stopGap + cell / 2, p - (A + 1));
		return lane + stopGap + cell / 2 + (p - (A + 2)) * cell;
	};
	const [dx, dz] = VEC[dir];
	const s = along(pos);
	const off = lane / 2;
	return {x: dx * s - dz * off, z: dz * s + dx * off, heading: Math.atan2(dx, dz)};
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type CarPose = {id: number; dir: Dir; x: number; z: number; heading: number; moving: boolean; dist: number; fade: number};

/**
 * Poses of every car at a (fractional) tick: each car glides between its cells of tick k and k+1,
 * easing in when it starts from rest and out when it comes to rest. `fade` scales cars in/out at the route ends.
 */
export const carPoses = (sim: JunctionSim, layout: JunctionLayout, tick: number): CarPose[] => {
	const k = Math.floor(tick);
	const t = tick - k;
	const a = stateAt(sim, k);
	const b = stateAt(sim, k + 1);
	const p0 = stateAt(sim, k - 1);
	const after = stateAt(sim, k + 2);
	const cellOf = (s: TickState, id: number) => s.cars.find((c) => c.id === id)?.cell;
	const L = sim.routeCells;
	return a.cars.map((c) => {
		const next = cellOf(b, c.id) ?? L;
		const before = cellOf(p0, c.id) ?? c.cell - 1;
		const later = cellOf(after, c.id) ?? (next >= L ? L + 1 : next);
		const moving = next !== c.cell;
		let u = t;
		if (moving) {
			const fromRest = before === c.cell;
			const toRest = later === next;
			if (fromRest && toRest) u = t * t * (3 - 2 * t);
			else if (fromRest) u = t * t;
			else if (toRest) u = 1 - (1 - t) * (1 - t);
		}
		const pos = c.cell + (next - c.cell) * (moving ? u : 0);
		const p = routePoint(sim, layout, c.dir, pos);
		const fade = Math.min(1, pos + 0.15, L - pos);
		return {id: c.id, dir: c.dir, x: p.x, z: p.z, heading: p.heading, moving, dist: pos * layout.cell, fade: Math.max(0, fade)};
	});
};

/**
 * Instanced low-poly cars (same proportions as kit/characters ToyCar) for one simulation frame.
 * `tick` is the fractional sim tick to show (derive it from useCurrentFrame()); `color` per car; `hide` skips ids
 * drawn separately (e.g. a hero car with a character in it). Brake lights glow when a car isn't moving.
 */
export const TrafficCars: React.FC<{
	sim: JunctionSim;
	layout: JunctionLayout;
	tick: number;
	color: (car: CarPose) => string;
	scale?: number;
	hide?: number[];
	max?: number;
}> = ({sim, layout, tick, color, scale = 0.8, hide = [], max = 160}) => {
	useCurrentFrame(); // re-render per frame
	const poses = carPoses(sim, layout, tick).filter((p) => !hide.includes(p.id) && p.fade > 0).slice(0, max);
	const body = useRef<InstancedMesh>(null);
	const cabin = useRef<InstancedMesh>(null);
	const glass = useRef<InstancedMesh>(null);
	const wheels = useRef<InstancedMesh>(null);
	const heads = useRef<InstancedMesh>(null);
	const tails = useRef<InstancedMesh>(null);
	const tmp = useMemo(() => ({o: new Object3D(), p: new Object3D(), c: new Color()}), []);
	useLayoutEffect(() => {
		const {o, p, c} = tmp;
		const put = (m: InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, rz = 0) => {
			if (!m) return;
			o.position.set(x, y, z);
			o.rotation.set(rx, 0, rz);
			o.scale.set(sx, sy, sz);
			o.updateMatrix();
			o.matrix.premultiply(p.matrix);
			m.setMatrixAt(i, o.matrix);
		};
		poses.forEach((car, i) => {
			const s = scale * car.fade;
			p.position.set(car.x, 0, car.z);
			p.rotation.set(0, car.heading, 0);
			p.scale.set(s, s, s);
			p.updateMatrix();
			put(body.current, i, 0, 0.22, 0, 0.46, 0.2, 1);
			put(cabin.current, i, 0, 0.4, -0.06, 0.4, 0.17, 0.52);
			put(glass.current, i, 0, 0.41, -0.06, 0.41, 0.12, 0.47);
			const spin = car.dist / (0.1 * scale);
			[
				[-0.24, 0.32],
				[0.24, 0.32],
				[-0.24, -0.32],
				[0.24, -0.32],
			].forEach(([wx, wz], w) => put(wheels.current, i * 4 + w, wx, 0.1, wz, 1, 1, 1, spin, Math.PI / 2));
			[-0.15, 0.15].forEach((lx, l) => {
				put(heads.current, i * 2 + l, lx, 0.24, 0.505, 0.1, 0.05, 0.01);
				put(tails.current, i * 2 + l, lx, 0.24, -0.505, 0.1, 0.05, 0.01);
			});
			c.set(color(car));
			body.current?.setColorAt(i, c);
			cabin.current?.setColorAt(i, c);
			c.set(car.moving ? '#7a1515' : '#ff2d2d');
			tails.current?.setColorAt(i * 2, c);
			tails.current?.setColorAt(i * 2 + 1, c);
		});
		for (const [m, n] of [
			[body.current, 1],
			[cabin.current, 1],
			[glass.current, 1],
			[wheels.current, 4],
			[heads.current, 2],
			[tails.current, 2],
		] as const) {
			if (!m) continue;
			m.count = poses.length * n;
			m.instanceMatrix.needsUpdate = true;
			if (m.instanceColor) m.instanceColor.needsUpdate = true;
		}
	});
	return (
		<group>
			<instancedMesh ref={body} args={[undefined, undefined, max]} frustumCulled={false}>
				<boxGeometry args={[1, 1, 1]} />
				<meshStandardMaterial roughness={0.45} metalness={0.2} />
			</instancedMesh>
			<instancedMesh ref={cabin} args={[undefined, undefined, max]} frustumCulled={false}>
				<boxGeometry args={[1, 1, 1]} />
				<meshStandardMaterial roughness={0.45} />
			</instancedMesh>
			<instancedMesh ref={glass} args={[undefined, undefined, max]} frustumCulled={false}>
				<boxGeometry args={[1, 1, 1]} />
				<meshStandardMaterial color="#1b2433" roughness={0.1} metalness={0.6} />
			</instancedMesh>
			<instancedMesh ref={wheels} args={[undefined, undefined, max * 4]} frustumCulled={false}>
				<cylinderGeometry args={[0.1, 0.1, 0.07, 12]} />
				<meshStandardMaterial color="#15171c" />
			</instancedMesh>
			<instancedMesh ref={heads} args={[undefined, undefined, max * 2]} frustumCulled={false}>
				<boxGeometry args={[1, 1, 1]} />
				<meshBasicMaterial color="#fff3c4" toneMapped={false} />
			</instancedMesh>
			<instancedMesh ref={tails} args={[undefined, undefined, max * 2]} frustumCulled={false}>
				<boxGeometry args={[1, 1, 1]} />
				<meshBasicMaterial toneMapped={false} />
			</instancedMesh>
		</group>
	);
};
